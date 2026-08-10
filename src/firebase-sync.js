import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCaIISHveAxSq6lIAATy3I3ELdV8175Pxw",
  authDomain: "home-dashboard-bd412.firebaseapp.com",
  projectId: "home-dashboard-bd412",
  storageBucket: "home-dashboard-bd412.firebasestorage.app",
  messagingSenderId: "1033182718857",
  appId: "1:1033182718857:web:56187c08ba35080a794f58"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

const FIRESTORE_DATABASE_ID = "(default)";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${encodeURIComponent(FIRESTORE_DATABASE_ID)}/documents/users`;
const POLL_INTERVAL_MS = 20000;
const REQUEST_TIMEOUT_MS = 12000;
const MAX_TRANSIENT_FAILURES = 2;

const SYNC_KEYS = [
  "homebase.tasks",
  "homebase.taskTags",
  "homebase.notes",
  "homebase.brain",
  "homebase.birthdays",
  "homebase.links",
  "homebase.spotifyConfig",
  "homebase.calendarLinks"
];

const originalSetItem = Storage.prototype.setItem;
const deviceIdKey = "homebase.firebase.deviceId";
const cloudLoadedKey = "homebase.firebase.cloudLoadedUid";
const cloudVersionKey = "homebase.firebase.cloudVersion";
const lastSuccessKey = "homebase.firebase.lastSuccess";
const deviceId = sessionStorage.getItem(deviceIdKey) || crypto.randomUUID();
sessionStorage.setItem(deviceIdKey, deviceId);

let currentUser = null;
let readyToSync = false;
let suppressLocalSync = false;
let requestInFlight = false;
let saveTimer = null;
let pollTimer = null;
let consecutiveFailures = 0;

function documentUrl() {
  return `${FIRESTORE_BASE}/${encodeURIComponent(currentUser.uid)}`;
}

function readLocalDashboard() {
  const data = {};
  for (const key of SYNC_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw == null) continue;
    try { data[key.replace("homebase.", "")] = JSON.parse(raw); } catch {}
  }
  return data;
}

function applyCloudDashboard(data) {
  if (!data || typeof data !== "object") return;
  suppressLocalSync = true;
  try {
    for (const key of SYNC_KEYS) {
      const field = key.replace("homebase.", "");
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        originalSetItem.call(localStorage, key, JSON.stringify(data[field]));
      }
    }
  } finally {
    suppressLocalSync = false;
  }
}

function decodeFirestoreValue(value) {
  if (!value || typeof value !== "object") return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue?.values || []).map(decodeFirestoreValue);
  if ("mapValue" in value) {
    const result = {};
    for (const [key, child] of Object.entries(value.mapValue?.fields || {})) result[key] = decodeFirestoreValue(child);
    return result;
  }
  return null;
}

function decodeDocument(raw) {
  const fields = raw?.fields || {};
  let dashboard = {};
  if (fields.dashboardJson?.stringValue) {
    try { dashboard = JSON.parse(fields.dashboardJson.stringValue); } catch {}
  } else if (fields.dashboard) {
    dashboard = decodeFirestoreValue(fields.dashboard) || {};
  }
  return {
    dashboard,
    clientUpdatedAt: Number(fields.clientUpdatedAt?.integerValue || 0),
    updatedBy: fields.updatedBy?.stringValue || ""
  };
}

async function authHeaders(forceRefresh = false) {
  if (!currentUser) throw Object.assign(new Error("No signed-in Firebase user"), { code: "UNAUTHENTICATED" });
  const token = await currentUser.getIdToken(forceRefresh);
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function firestoreError(response) {
  let code = String(response.status);
  let message = `Firestore HTTP ${response.status}`;
  try {
    const body = await response.json();
    code = body?.error?.status || code;
    message = body?.error?.message || message;
  } catch {}
  return Object.assign(new Error(message), { code, httpStatus: response.status });
}

function errorInfo(error) {
  const code = String(error?.code || "network").replace(/^auth\//, "");
  const message = String(error?.message || error || "Unknown sync error").replace(/^Firebase:\s*/i, "").trim();
  return { short: `Sync error · ${code}`, detail: message };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw Object.assign(new Error("Firestore request timed out"), { code: "TIMEOUT" });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function firestoreRequest(method, body) {
  let headers = await authHeaders(false);
  let response = await fetchWithTimeout(documentUrl(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  });

  // A stale Firebase ID token can surface as 401/UNAUTHENTICATED. Force-refresh
  // the token once before treating it as a real sync failure.
  if (response.status === 401) {
    headers = await authHeaders(true);
    response = await fetchWithTimeout(documentUrl(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });
  }
  return response;
}

async function readCloudDocument() {
  const response = await firestoreRequest("GET");
  if (response.status === 404) return null;
  if (!response.ok) throw await firestoreError(response);
  return decodeDocument(await response.json());
}

async function writeCloudDocument() {
  const clientUpdatedAt = Date.now();
  const payload = {
    fields: {
      dashboardJson: { stringValue: JSON.stringify(readLocalDashboard()) },
      displayName: { stringValue: currentUser.displayName || "" },
      email: { stringValue: currentUser.email || "" },
      photoURL: { stringValue: currentUser.photoURL || "" },
      updatedAtIso: { stringValue: new Date().toISOString() },
      clientUpdatedAt: { integerValue: String(clientUpdatedAt) },
      updatedBy: { stringValue: deviceId }
    }
  };
  const response = await firestoreRequest("PATCH", payload);
  if (!response.ok) throw await firestoreError(response);
  sessionStorage.setItem(cloudVersionKey, String(clientUpdatedAt));
  markSyncSuccess();
  return clientUpdatedAt;
}

function setSyncStatus(text, state = "", detail = "") {
  const status = document.querySelector("[data-homebase-sync-status]");
  if (!status) return;
  status.textContent = text;
  status.dataset.state = state;
  status.title = detail || text;
}

function markSyncSuccess() {
  consecutiveFailures = 0;
  const stamp = Date.now();
  sessionStorage.setItem(lastSuccessKey, String(stamp));
  return stamp;
}

function handleSyncFailure(error, context) {
  consecutiveFailures += 1;
  const info = errorInfo(error);
  console.error(`Homebase cloud ${context} failed (${consecutiveFailures}):`, error);

  // One-off network hiccups should not turn a healthy sync badge red. We keep
  // the last-known-good state and retry on the next poll. Persistent failures
  // are surfaced with the exact Firestore error in the tooltip.
  if (consecutiveFailures <= MAX_TRANSIENT_FAILURES) {
    const lastSuccess = Number(sessionStorage.getItem(lastSuccessKey) || 0);
    if (lastSuccess) {
      const secondsAgo = Math.max(0, Math.round((Date.now() - lastSuccess) / 1000));
      setSyncStatus("Synced · retrying", "busy", `${info.detail} · Last successful sync ${secondsAgo}s ago`);
      return;
    }
  }
  setSyncStatus(info.short, "error", `${info.detail} · ${context} · failure ${consecutiveFailures}`);
}

async function saveDashboardToCloud() {
  if (!currentUser || !readyToSync || requestInFlight) return;
  requestInFlight = true;
  try {
    setSyncStatus("Saving…", "busy");
    await writeCloudDocument();
    setSyncStatus("Synced", "ok", "Cloud sync active · Firestore (default)");
  } catch (error) {
    handleSyncFailure(error, "save");
  } finally {
    requestInFlight = false;
  }
}

function queueCloudSave() {
  if (!readyToSync || !currentUser || suppressLocalSync) return;
  setSyncStatus("Saving…", "busy");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDashboardToCloud, 550);
}

Storage.prototype.setItem = function patchedSetItem(key, value) {
  originalSetItem.call(this, key, value);
  if (this === localStorage && SYNC_KEYS.includes(String(key))) queueCloudSave();
};

function ensureAccountControl() {
  let control = document.querySelector("[data-homebase-account]");
  if (control) return control;
  const style = document.createElement("style");
  style.textContent = `
    .homebase-account{position:fixed;top:18px;right:18px;z-index:1000;display:flex;align-items:center;gap:9px;max-width:320px;padding:8px 10px;border:1px solid rgba(220,177,139,.22);border-radius:12px;background:rgba(38,31,27,.94);box-shadow:0 12px 28px rgba(0,0,0,.3);color:#efd3b7;font-family:Nunito,system-ui,sans-serif;backdrop-filter:blur(10px)}
    .homebase-account img{width:30px;height:30px;flex:none;border-radius:50%;object-fit:cover;border:1px solid rgba(239,211,183,.25)}
    .homebase-account-copy{min-width:0;line-height:1.15}.homebase-account-name{display:block;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:700}.homebase-sync-status{display:block;margin-top:3px;color:#bfa389;font-size:10px;max-width:185px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.homebase-sync-status[data-state="ok"]{color:#a9bd82}.homebase-sync-status[data-state="error"]{color:#e59082}.homebase-sync-status[data-state="busy"]{color:#d5b681}
    .homebase-account button{flex:none;border:1px solid rgba(213,135,117,.25);border-radius:9px;background:linear-gradient(#805046,#5f3934);color:#efd3b7;padding:7px 9px;font:700 12px Nunito,system-ui,sans-serif;cursor:pointer}@media(max-width:700px){.homebase-account{top:8px;right:8px;max-width:240px}.homebase-account-name{max-width:88px}.homebase-sync-status{max-width:115px}}
  `;
  document.head.appendChild(style);
  control = document.createElement("div");
  control.className = "homebase-account";
  control.dataset.homebaseAccount = "";
  control.innerHTML = `<div class="homebase-account-copy"><span class="homebase-account-name">Cloud sync</span><span class="homebase-sync-status" data-homebase-sync-status>Sign in to sync</span></div><button type="button" data-homebase-auth-button>Sign in with Google</button>`;
  document.body.appendChild(control);
  control.querySelector("[data-homebase-auth-button]").addEventListener("click", async () => {
    const button = control.querySelector("[data-homebase-auth-button]");
    button.disabled = true;
    try {
      if (auth.currentUser) await signOut(auth);
      else await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google sign-in failed:", error);
      if (error?.code === "auth/popup-closed-by-user") setSyncStatus("Sign-in cancelled", "error");
      else {
        const info = errorInfo(error);
        setSyncStatus(`Sign-in error · ${String(error?.code || "unknown").replace(/^auth\//, "")}`, "error", info.detail);
      }
    } finally {
      button.disabled = false;
    }
  });
  return control;
}

function renderAccount(user) {
  const control = ensureAccountControl();
  const button = control.querySelector("[data-homebase-auth-button]");
  const copy = control.querySelector(".homebase-account-copy");
  control.querySelector("img")?.remove();
  if (!user) {
    copy.querySelector(".homebase-account-name").textContent = "Cloud sync";
    setSyncStatus("Sign in to sync");
    button.textContent = "Sign in with Google";
    return;
  }
  if (user.photoURL) {
    const photo = document.createElement("img");
    photo.src = user.photoURL;
    photo.alt = "";
    control.insertBefore(photo, copy);
  }
  copy.querySelector(".homebase-account-name").textContent = user.displayName || user.email || "Signed in";
  setSyncStatus("Connecting…", "busy");
  button.textContent = "Sign out";
}

async function pollCloudDocument() {
  if (!currentUser || !readyToSync || requestInFlight) return;
  requestInFlight = true;
  try {
    const cloud = await readCloudDocument();
    markSyncSuccess();
    if (!cloud) {
      setSyncStatus("Synced", "ok", "Cloud sync active · waiting for first cloud document");
      return;
    }
    const lastApplied = Number(sessionStorage.getItem(cloudVersionKey) || 0);
    if (cloud.clientUpdatedAt > lastApplied && cloud.updatedBy !== deviceId) {
      sessionStorage.setItem(cloudVersionKey, String(cloud.clientUpdatedAt));
      applyCloudDashboard(cloud.dashboard);
      setSyncStatus("Updated from another device", "ok");
      setTimeout(() => window.location.reload(), 80);
      return;
    }
    setSyncStatus("Synced", "ok", "Cloud sync active · Firestore (default)");
  } catch (error) {
    handleSyncFailure(error, "poll");
  } finally {
    requestInFlight = false;
  }
}

function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(pollCloudDocument, POLL_INTERVAL_MS);
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  readyToSync = false;
  consecutiveFailures = 0;
  clearInterval(pollTimer);
  pollTimer = null;
  renderAccount(user);
  if (!user) {
    sessionStorage.removeItem(cloudLoadedKey);
    return;
  }

  try {
    const cloud = await readCloudDocument();
    markSyncSuccess();
    const alreadyLoaded = sessionStorage.getItem(cloudLoadedKey) === user.uid;
    if (cloud && !alreadyLoaded && Object.keys(cloud.dashboard || {}).length) {
      applyCloudDashboard(cloud.dashboard);
      sessionStorage.setItem(cloudLoadedKey, user.uid);
      sessionStorage.setItem(cloudVersionKey, String(cloud.clientUpdatedAt || 0));
      setSyncStatus("Loading your dashboard…", "busy");
      setTimeout(() => window.location.reload(), 80);
      return;
    }

    sessionStorage.setItem(cloudLoadedKey, user.uid);
    if (cloud) sessionStorage.setItem(cloudVersionKey, String(cloud.clientUpdatedAt || 0));
    readyToSync = true;

    if (!cloud || !Object.keys(cloud.dashboard || {}).length) await saveDashboardToCloud();
    else setSyncStatus("Synced", "ok", "Cloud sync active · Firestore (default)");
    startPolling();
  } catch (error) {
    handleSyncFailure(error, "initial load");
  }
});

ensureAccountControl();
