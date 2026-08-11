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
const REQUEST_TIMEOUT_MS = 12000;
const POLL_INTERVAL_MS = 15000;
const SAVE_DELAY_MS = 450;

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
const originalRemoveItem = Storage.prototype.removeItem;
const deviceIdKey = "homebase.firebase.deviceId";
const cloudVersionKey = "homebase.firebase.cloudVersion";
const deviceId = localStorage.getItem(deviceIdKey) || crypto.randomUUID();
originalSetItem.call(localStorage, deviceIdKey, deviceId);

let currentUser = null;
let readyToSync = false;
let suppressLocalSync = false;
let requestInFlight = false;
let saveTimer = null;
let pollTimer = null;
let lastSuccessfulSync = 0;
let consecutiveFailures = 0;

function documentUrl() {
  return `${FIRESTORE_BASE}/${encodeURIComponent(currentUser.uid)}`;
}

function readLocalDashboard() {
  const data = {};
  for (const key of SYNC_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw == null) continue;
    try {
      data[key.replace("homebase.", "")] = JSON.parse(raw);
    } catch {}
  }
  return data;
}

function snapshotsEqual(local, cloud) {
  for (const key of SYNC_KEYS) {
    const field = key.replace("homebase.", "");
    if (!Object.prototype.hasOwnProperty.call(cloud || {}, field)) continue;
    const localHas = Object.prototype.hasOwnProperty.call(local || {}, field);
    if (!localHas || JSON.stringify(local[field]) !== JSON.stringify(cloud[field])) return false;
  }
  return true;
}

function applyCloudDashboard(data) {
  if (!data || typeof data !== "object") return false;
  let changed = false;
  suppressLocalSync = true;
  try {
    for (const key of SYNC_KEYS) {
      const field = key.replace("homebase.", "");
      if (!Object.prototype.hasOwnProperty.call(data, field)) continue;
      const next = JSON.stringify(data[field]);
      if (localStorage.getItem(key) !== next) {
        originalSetItem.call(localStorage, key, next);
        changed = true;
      }
    }
  } finally {
    suppressLocalSync = false;
  }
  return changed;
}

function decodeDocument(raw) {
  const fields = raw?.fields || {};
  let dashboard = {};
  if (fields.dashboardJson?.stringValue) {
    try { dashboard = JSON.parse(fields.dashboardJson.stringValue); } catch {}
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

async function firestoreRequest(method, body) {
  let headers = await authHeaders(false);
  let response = await fetchWithTimeout(documentUrl(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  });
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
  lastSuccessfulSync = Date.now();
  consecutiveFailures = 0;
  return clientUpdatedAt;
}

function errorInfo(error) {
  const code = String(error?.code || "network").replace(/^auth\//, "");
  const detail = String(error?.message || error || "Unknown sync error").replace(/^Firebase:\s*/i, "").trim();
  return { code, detail };
}

function setSyncStatus(text, state = "", detail = "") {
  const status = document.querySelector("[data-homebase-sync-status]");
  if (!status) return;
  status.textContent = text;
  status.dataset.state = state;
  status.title = detail || text;
}

function syncSucceeded(detail = "Cloud data is up to date") {
  lastSuccessfulSync = Date.now();
  consecutiveFailures = 0;
  setSyncStatus("Synced", "ok", detail);
}

function syncFailed(error, context) {
  consecutiveFailures += 1;
  const info = errorInfo(error);
  console.error(`Homebase cloud ${context} failed:`, error);
  if (lastSuccessfulSync && consecutiveFailures < 3) {
    setSyncStatus("Synced · retrying", "busy", `${info.detail} · ${context}`);
  } else {
    setSyncStatus(`Sync error · ${info.code}`, "error", `${info.detail} · ${context}`);
  }
}

async function saveDashboardToCloud() {
  if (!currentUser || !readyToSync || requestInFlight) return;
  requestInFlight = true;
  try {
    setSyncStatus("Saving…", "busy");
    await writeCloudDocument();
    syncSucceeded("Saved to Google/Firebase cloud");
  } catch (error) {
    syncFailed(error, "save");
  } finally {
    requestInFlight = false;
  }
}

function queueCloudSave() {
  if (!readyToSync || !currentUser || suppressLocalSync) return;
  clearTimeout(saveTimer);
  setSyncStatus("Saving…", "busy");
  saveTimer = setTimeout(saveDashboardToCloud, SAVE_DELAY_MS);
}

Storage.prototype.setItem = function patchedSetItem(key, value) {
  originalSetItem.call(this, key, value);
  if (this === localStorage && SYNC_KEYS.includes(String(key))) queueCloudSave();
};

Storage.prototype.removeItem = function patchedRemoveItem(key) {
  originalRemoveItem.call(this, key);
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
        setSyncStatus(`Sign-in error · ${info.code}`, "error", info.detail);
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
    if (!cloud) {
      await writeCloudDocument();
      syncSucceeded("Created cloud copy from this device");
      return;
    }

    const lastApplied = Number(sessionStorage.getItem(cloudVersionKey) || 0);
    if (cloud.clientUpdatedAt > lastApplied && cloud.updatedBy !== deviceId) {
      const changed = applyCloudDashboard(cloud.dashboard);
      sessionStorage.setItem(cloudVersionKey, String(cloud.clientUpdatedAt || 0));
      syncSucceeded("Downloaded newer data from another device");
      if (changed) setTimeout(() => window.location.reload(), 80);
      return;
    }
    syncSucceeded("Cloud data is up to date");
  } catch (error) {
    syncFailed(error, "poll");
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
  clearInterval(pollTimer);
  pollTimer = null;
  renderAccount(user);

  if (!user) return;

  try {
    const cloud = await readCloudDocument();
    if (!cloud) {
      readyToSync = true;
      await saveDashboardToCloud();
      startPolling();
      return;
    }

    const local = readLocalDashboard();
    const changed = !snapshotsEqual(local, cloud.dashboard) && applyCloudDashboard(cloud.dashboard);
    sessionStorage.setItem(cloudVersionKey, String(cloud.clientUpdatedAt || 0));
    readyToSync = true;
    syncSucceeded("Loaded cloud dashboard for this Google account");
    startPolling();

    if (changed) {
      setSyncStatus("Applying cloud data…", "busy");
      setTimeout(() => window.location.reload(), 80);
    }
  } catch (error) {
    readyToSync = true;
    syncFailed(error, "initial load");
    startPolling();
  }
});

ensureAccountControl();
