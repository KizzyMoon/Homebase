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

/*
 * Homebase uses Firestore's HTTPS REST API for dashboard sync.
 * The Firestore console for this project shows the database ID as `default`.
 * Older/default Firebase projects commonly use `(default)`, so we support both
 * and remember whichever one actually exists.
 */
const FIRESTORE_DATABASE_CANDIDATES = ["default", "(default)"];
let firestoreDatabaseId = localStorage.getItem("homebase.firebase.databaseId") || "default";

function firestoreDocUrl(databaseId = firestoreDatabaseId) {
  return `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${encodeURIComponent(databaseId)}/documents/users/${encodeURIComponent(currentUser.uid)}`;
}

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
const deviceId = sessionStorage.getItem(deviceIdKey) || crypto.randomUUID();
sessionStorage.setItem(deviceIdKey, deviceId);

let currentUser = null;
let readyToSync = false;
let saveTimer = null;
let pollTimer = null;
let suppressLocalSync = false;
let requestInFlight = false;

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
    const out = {};
    for (const [key, child] of Object.entries(value.mapValue?.fields || {})) out[key] = decodeFirestoreValue(child);
    return out;
  }
  return null;
}

function decodeRestDocument(doc) {
  const fields = doc?.fields || {};
  let dashboard = null;
  if (fields.dashboardJson?.stringValue) {
    try { dashboard = JSON.parse(fields.dashboardJson.stringValue); } catch {}
  }
  if (!dashboard && fields.dashboard) dashboard = decodeFirestoreValue(fields.dashboard);
  return {
    dashboard: dashboard && typeof dashboard === "object" ? dashboard : {},
    clientUpdatedAt: Number(fields.clientUpdatedAt?.integerValue || 0),
    updatedBy: fields.updatedBy?.stringValue || ""
  };
}

function errorInfo(error) {
  const code = String(error?.code || error?.status || "network").replace(/^firestore\//, "").replace(/^auth\//, "");
  const message = String(error?.message || error || "Unknown sync error").replace(/^Firebase:\s*/i, "").trim();
  return { short: `Sync error · ${code}`, detail: message };
}

async function authHeaders() {
  if (!currentUser) throw Object.assign(new Error("No signed-in Firebase user"), { code: "unauthenticated" });
  const token = await currentUser.getIdToken();
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function parseFirestoreError(response) {
  let message = `Firestore HTTP ${response.status}`;
  let code = response.status;
  try {
    const body = await response.json();
    message = body?.error?.message || message;
    code = body?.error?.status || response.status;
  } catch {}
  return { message, code };
}

function isMissingDatabase(message = "") {
  return /database.*(not found|does not exist)|requested entity was not found/i.test(String(message));
}

function rememberDatabase(databaseId) {
  firestoreDatabaseId = databaseId;
  originalSetItem.call(localStorage, "homebase.firebase.databaseId", databaseId);
}

async function readFromDatabase(databaseId, headers) {
  const response = await fetch(firestoreDocUrl(databaseId), { method: "GET", headers, cache: "no-store" });
  if (response.ok) {
    rememberDatabase(databaseId);
    return { foundDatabase: true, document: decodeRestDocument(await response.json()) };
  }
  if (response.status === 404) {
    const info = await parseFirestoreError(response);
    if (isMissingDatabase(info.message)) return { foundDatabase: false, document: null, error: info };
    rememberDatabase(databaseId);
    return { foundDatabase: true, document: null };
  }
  const info = await parseFirestoreError(response);
  throw Object.assign(new Error(info.message), { code: info.code });
}

async function readCloudDocument() {
  const headers = await authHeaders();
  const candidates = [firestoreDatabaseId, ...FIRESTORE_DATABASE_CANDIDATES].filter((v, i, a) => a.indexOf(v) === i);
  let lastMissing = null;
  for (const databaseId of candidates) {
    const result = await readFromDatabase(databaseId, headers);
    if (result.foundDatabase) return result.document;
    lastMissing = result.error;
  }
  throw Object.assign(new Error(lastMissing?.message || "Firestore database not found"), { code: lastMissing?.code || "NOT_FOUND" });
}

async function writeToDatabase(databaseId, headers, payload) {
  const response = await fetch(firestoreDocUrl(databaseId), {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  if (response.ok) {
    rememberDatabase(databaseId);
    return true;
  }
  const info = await parseFirestoreError(response);
  if (response.status === 404 && isMissingDatabase(info.message)) return false;
  throw Object.assign(new Error(info.message), { code: info.code });
}

async function writeCloudDocument() {
  const headers = await authHeaders();
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

  const candidates = [firestoreDatabaseId, ...FIRESTORE_DATABASE_CANDIDATES].filter((v, i, a) => a.indexOf(v) === i);
  for (const databaseId of candidates) {
    if (await writeToDatabase(databaseId, headers, payload)) {
      sessionStorage.setItem(cloudVersionKey, String(clientUpdatedAt));
      return clientUpdatedAt;
    }
  }
  throw Object.assign(new Error("Firestore database not found"), { code: "NOT_FOUND" });
}

async function saveDashboardToCloud() {
  if (!currentUser || !readyToSync || requestInFlight) return;
  requestInFlight = true;
  try {
    setSyncStatus("Saving…", "busy");
    await writeCloudDocument();
    setSyncStatus("Synced", "ok", `Cloud sync active · Firestore database: ${firestoreDatabaseId}`);
  } catch (error) {
    console.error("Homebase REST cloud save failed:", error);
    const info = errorInfo(error);
    setSyncStatus(info.short, "error", info.detail);
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

function setSyncStatus(text, state = "", detail = "") {
  const status = document.querySelector("[data-homebase-sync-status]");
  if (!status) return;
  status.textContent = text;
  status.dataset.state = state;
  status.title = detail || text;
}

function ensureAccountControl() {
  let control = document.querySelector("[data-homebase-account]");
  if (control) return control;
  const style = document.createElement("style");
  style.textContent = `
    .homebase-account{position:fixed;top:18px;right:18px;z-index:1000;display:flex;align-items:center;gap:9px;max-width:320px;padding:8px 10px;border:1px solid rgba(220,177,139,.22);border-radius:12px;background:rgba(38,31,27,.94);box-shadow:0 12px 28px rgba(0,0,0,.3);color:#efd3b7;font-family:Nunito,system-ui,sans-serif;backdrop-filter:blur(10px)}
    .homebase-account img{width:30px;height:30px;flex:none;border-radius:50%;object-fit:cover;border:1px solid rgba(239,211,183,.25)}
    .homebase-account-copy{min-width:0;line-height:1.15}.homebase-account-name{display:block;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:700}.homebase-sync-status{display:block;margin-top:3px;color:#bfa389;font-size:10px;max-width:185px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.homebase-sync-status[data-state="ok"]{color:#a9bd82}.homebase-sync-status[data-state="error"]{color:#e59082}
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
  const existing = control.querySelector("img");
  if (existing) existing.remove();
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
    if (!cloud) return;
    const lastApplied = Number(sessionStorage.getItem(cloudVersionKey) || 0);
    if (cloud.clientUpdatedAt > lastApplied && cloud.updatedBy !== deviceId) {
      sessionStorage.setItem(cloudVersionKey, String(cloud.clientUpdatedAt));
      applyCloudDashboard(cloud.dashboard);
      setSyncStatus("Updated from another device", "ok");
      setTimeout(() => window.location.reload(), 80);
      return;
    }
    setSyncStatus("Synced", "ok", `Cloud sync active · Firestore database: ${firestoreDatabaseId}`);
  } catch (error) {
    console.error("Homebase REST cloud poll failed:", error);
    const info = errorInfo(error);
    setSyncStatus(info.short, "error", info.detail);
  } finally {
    requestInFlight = false;
  }
}

function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(pollCloudDocument, 20000);
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  readyToSync = false;
  clearInterval(pollTimer);
  pollTimer = null;
  renderAccount(user);
  if (!user) {
    sessionStorage.removeItem(cloudLoadedKey);
    return;
  }

  try {
    const cloud = await readCloudDocument();
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
    else setSyncStatus("Synced", "ok", `Cloud sync active · Firestore database: ${firestoreDatabaseId}`);

    startPolling();
  } catch (error) {
    console.error("Homebase REST cloud load failed:", error);
    const info = errorInfo(error);
    setSyncStatus(info.short, "error", info.detail);
  }
});

ensureAccountControl();
