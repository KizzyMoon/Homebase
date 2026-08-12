import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCaIISHveAxSq6lIAATy3I3ELdV8175Pxw",
  authDomain: "home-dashboard-bd412.firebaseapp.com",
  projectId: "home-dashboard-bd412",
  storageBucket: "home-dashboard-bd412.firebasestorage.app",
  messagingSenderId: "1033182718857",
  appId: "1:1033182718857:web:56187c08ba35080a794f58"
};

const app = getApps()[0] || initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

// Safari/iOS is especially sensitive to auth storage. Explicitly keep the
// Firebase session in first-party browser storage. Importantly, this version
// does NOT fall back to signInWithRedirect: Firebase documents that redirect
// auth on non-Firebase-hosted sites breaks on Safari 16.1+ unless special
// third-party-storage mitigation is installed. Homebase is on GitHub Pages, so
// popup auth is the supported simple path here.
const persistenceReady = setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Homebase auth persistence setup failed", error);
  return null;
});

// This project uses a named Firestore database whose ID is `default`.
// `(default)` is a different database ID and does not exist in this project.
const DB = "default";
const BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${encodeURIComponent(DB)}/documents/users`;
const KEYS = [
  "homebase.tasks",
  "homebase.taskTags",
  "homebase.notes",
  "homebase.brain",
  "homebase.birthdays",
  "homebase.links",
  "homebase.spotifyConfig",
  "homebase.calendarLinks"
];
const EMPTY = {
  tasks: [], taskTags: [], notes: [], brain: [], birthdays: [], links: [],
  spotifyConfig: { clientId: "" }, calendarLinks: []
};

const nativeSet = Storage.prototype.setItem;
const nativeRemove = Storage.prototype.removeItem;
const DEVICE_KEY = "homebase.firebase.deviceId";
let deviceId = localStorage.getItem(DEVICE_KEY);
if (!deviceId) {
  deviceId = (globalThis.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  nativeSet.call(localStorage, DEVICE_KEY, deviceId);
}

let user = null;
let hydrated = false;
let suppress = false;
let saving = false;
let saveTimer = null;
let pollTimer = null;
let lastCloudStamp = 0;
let failures = 0;
let lastGood = 0;

const fieldFor = (key) => key.replace("homebase.", "");
const clone = (value) => JSON.parse(JSON.stringify(value));
const docUrl = () => `${BASE}/${encodeURIComponent(user.uid)}`;

function localSnapshot() {
  const out = {};
  for (const key of KEYS) {
    const field = fieldFor(key);
    const raw = localStorage.getItem(key);
    if (raw == null) {
      out[field] = clone(EMPTY[field]);
      continue;
    }
    try { out[field] = JSON.parse(raw); }
    catch { out[field] = clone(EMPTY[field]); }
  }
  return out;
}

function normalize(snapshot = {}) {
  const out = {};
  for (const key of KEYS) {
    const field = fieldFor(key);
    const value = snapshot[field];
    if (field === "spotifyConfig") out[field] = value && typeof value === "object" && !Array.isArray(value) ? value : clone(EMPTY[field]);
    else out[field] = Array.isArray(value) ? value : clone(EMPTY[field]);
  }
  return out;
}

function same(a, b) {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

async function token() {
  if (!user) throw new Error("Not signed in");
  return user.getIdToken();
}
async function request(method = "GET", body = null) {
  const idToken = await token();
  const options = { method, headers: { Authorization: `Bearer ${idToken}` } };
  if (body != null) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  return fetch(docUrl(), options);
}

function fromFirestoreValue(value) {
  if (!value || typeof value !== "object") return null;
  if (Object.prototype.hasOwnProperty.call(value, "stringValue")) return value.stringValue;
  if (Object.prototype.hasOwnProperty.call(value, "integerValue")) return Number(value.integerValue || 0);
  return null;
}

async function readCloud() {
  const response = await request("GET");
  if (response.status === 404) return null;
  if (!response.ok) {
    let message = `Firestore read HTTP ${response.status}`;
    try { message = (await response.json())?.error?.message || message; } catch {}
    throw new Error(message);
  }
  const data = await response.json();
  const fields = data.fields || {};
  const raw = fromFirestoreValue(fields.dashboardJson);
  let dashboard = {};
  try { dashboard = raw ? JSON.parse(raw) : {}; } catch {}
  return {
    dashboard,
    clientUpdatedAt: Number(fromFirestoreValue(fields.clientUpdatedAt) || 0),
    updatedBy: String(fromFirestoreValue(fields.updatedBy) || ""),
    schemaVersion: Number(fromFirestoreValue(fields.schemaVersion) || 0)
  };
}

function shortError(error) {
  const text = String(error?.message || error || "Unknown error").replace(/\s+/g, " ").trim();
  return text.length > 220 ? `${text.slice(0,217)}…` : text;
}
function accountEls() {
  return {
    statusEl: document.querySelector("[data-homebase-sync-status]"),
    detailEl: document.querySelector("[data-homebase-sync-detail]")
  };
}
function status(label, state = "", detail = "") {
  const { statusEl, detailEl } = accountEls();
  if (statusEl) {
    statusEl.textContent = label;
    statusEl.dataset.state = state;
  }
  if (detailEl) detailEl.textContent = detail || "";
}

function summary(snapshot = localSnapshot()) {
  return `${Array.isArray(snapshot.tasks) ? snapshot.tasks.length : 0} tasks · ${Array.isArray(snapshot.calendarLinks) ? snapshot.calendarLinks.length : 0} calendars`;
}
function good(detail, snapshot) {
  failures = 0; lastGood = Date.now();
  status("Synced", "ok", `${detail} · ${summary(snapshot)}`);
}
function bad(error, where) {
  failures += 1;
  const detail = `${where}: ${shortError(error)}`;
  console.error(`Homebase sync ${where} failed`, error);
  if (lastGood && failures < 3) status("Synced · retrying", "busy", detail);
  else status("Sync error", "error", detail);
}

function applyCloud(data) {
  const normalized = normalize(data);
  let changed = false;
  suppress = true;
  try {
    for (const key of KEYS) {
      const field = fieldFor(key);
      const encoded = JSON.stringify(normalized[field]);
      if (localStorage.getItem(key) !== encoded) {
        nativeSet.call(localStorage, key, encoded);
        changed = true;
      }
    }
  } finally { suppress = false; }
  return { changed, normalized };
}

async function writeCloud(detail = "Saved to cloud") {
  const stamp = Date.now();
  const snapshot = localSnapshot();
  const payload = { fields: {
    dashboardJson: { stringValue: JSON.stringify(snapshot) },
    displayName: { stringValue: user.displayName || "" },
    email: { stringValue: user.email || "" },
    photoURL: { stringValue: user.photoURL || "" },
    updatedAtIso: { stringValue: new Date().toISOString() },
    clientUpdatedAt: { integerValue: String(stamp) },
    updatedBy: { stringValue: deviceId },
    schemaVersion: { integerValue: "5" }
  }};
  const response = await request("PATCH", payload);
  if (!response.ok) {
    let message = `Firestore save HTTP ${response.status}`;
    try { message = (await response.json())?.error?.message || message; } catch {}
    throw new Error(message);
  }
  lastCloudStamp = stamp;
  good(detail, snapshot);
}

async function saveNow() {
  if (!user || !hydrated || saving) return;
  saving = true;
  try {
    status("Saving…", "busy", "Checking cloud before save");
    const cloud = await readCloud();
    if (cloud && cloud.clientUpdatedAt > lastCloudStamp && cloud.updatedBy !== deviceId) {
      const { changed, normalized } = applyCloud(cloud.dashboard);
      lastCloudStamp = cloud.clientUpdatedAt;
      good("Pulled newer cloud copy before save", normalized);
      if (changed) setTimeout(() => location.reload(), 80);
      return;
    }
    await writeCloud();
  } catch (error) { bad(error, "save"); }
  finally { saving = false; }
}

function queueSave() {
  if (!user || !hydrated || suppress) return;
  clearTimeout(saveTimer);
  status("Saving…", "busy", "Local change waiting to upload");
  saveTimer = setTimeout(saveNow, 400);
}

Storage.prototype.setItem = function(key, value) {
  nativeSet.call(this, key, value);
  if (this === localStorage && KEYS.includes(String(key))) queueSave();
};
Storage.prototype.removeItem = function(key) {
  nativeRemove.call(this, key);
  if (this === localStorage && KEYS.includes(String(key))) queueSave();
};

function settingsOpen() {
  const active = document.querySelector(".nav-item.active");
  return String(active?.textContent || "").trim().toLowerCase() === "settings";
}
function updateAccountVisibility() {
  const box = document.querySelector("[data-homebase-account]");
  if (box) box.style.setProperty("display", settingsOpen() ? "flex" : "none", "important");
}

function ensureAccount() {
  let box = document.querySelector("[data-homebase-account]");
  if (box) { updateAccountVisibility(); return box; }
  const style = document.createElement("style");
  style.textContent = `.homebase-account{position:fixed;top:18px;right:18px;z-index:1000;display:none!important;align-items:center;gap:9px;max-width:min(430px,calc(100vw - 24px));padding:8px 10px;border:1px solid rgba(220,177,139,.22);border-radius:12px;background:rgba(38,31,27,.96);box-shadow:0 12px 28px rgba(0,0,0,.3);color:#efd3b7;font-family:Nunito,system-ui,sans-serif;backdrop-filter:blur(10px)}.homebase-account img{width:30px;height:30px;border-radius:50%;object-fit:cover}.homebase-account-copy{min-width:0;line-height:1.15}.homebase-account-name{display:block;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:700}.homebase-sync-status{display:block;margin-top:3px;color:#bfa389;font-size:10px}.homebase-sync-detail{display:block;margin-top:3px;color:#9f8d85;font-size:9px;line-height:1.25;max-width:240px;white-space:normal}.homebase-sync-status[data-state="ok"]{color:#a9bd82}.homebase-sync-status[data-state="error"]{color:#e59082}.homebase-sync-status[data-state="busy"]{color:#d5b681}.homebase-account button{border:1px solid rgba(213,135,117,.25);border-radius:9px;background:linear-gradient(#805046,#5f3934);color:#efd3b7;padding:7px 9px;font:700 12px Nunito,system-ui,sans-serif;cursor:pointer;white-space:nowrap}@media(max-width:820px){.homebase-account{position:static!important;margin:12px 0!important;width:100%!important;box-sizing:border-box!important}.homebase-sync-detail{max-width:none}}`;
  document.head.appendChild(style);
  box = document.createElement("div");
  box.className = "homebase-account";
  box.dataset.homebaseAccount = "";
  box.innerHTML = `<div class="homebase-account-copy"><span class="homebase-account-name">Cloud sync</span><span class="homebase-sync-status" data-homebase-sync-status>Sign in to sync</span><span class="homebase-sync-detail" data-homebase-sync-detail></span></div><button type="button">Sign in with Google</button>`;
  document.body.appendChild(box);
  box.querySelector("button").addEventListener("click", async () => {
    try {
      await persistenceReady;
      if (auth.currentUser) await signOut(auth);
      else await signInWithPopup(auth, provider);
    } catch (error) { bad(error, "sign-in"); }
  });
  updateAccountVisibility();
  return box;
}

function renderAccount(current) {
  const box = ensureAccount();
  const copy = box.querySelector(".homebase-account-copy");
  box.querySelector("img")?.remove();
  const button = box.querySelector("button");
  if (!current) {
    copy.querySelector(".homebase-account-name").textContent = "Cloud sync";
    status("Sign in to sync", "", "Use Google sign-in on this device");
    button.textContent = "Sign in with Google";
    return;
  }
  if (current.photoURL) {
    const img = document.createElement("img"); img.src = current.photoURL; img.alt = ""; box.insertBefore(img, copy);
  }
  copy.querySelector(".homebase-account-name").textContent = current.email || current.displayName || "Signed in";
  status("Checking cloud…", "busy", `Signed in as ${current.email || current.uid}`);
  button.textContent = "Sign out";
  updateAccountVisibility();
}

async function pullCloud(reason = "Cloud dashboard loaded") {
  const cloud = await readCloud();
  if (!cloud) {
    hydrated = true;
    await writeCloud("Created cloud dashboard from this device");
    return false;
  }
  const { changed, normalized } = applyCloud(cloud.dashboard);
  lastCloudStamp = cloud.clientUpdatedAt || 0;
  hydrated = true;
  const missing = KEYS.some((key) => !Object.prototype.hasOwnProperty.call(cloud.dashboard || {}, fieldFor(key)));
  if (cloud.schemaVersion < 5 || missing) await writeCloud("Migrated complete cloud dashboard");
  else good(reason, normalized);
  if (changed) setTimeout(() => location.reload(), 80);
  return changed;
}

async function poll() {
  if (!user || !hydrated || saving) return;
  try {
    const cloud = await readCloud();
    if (!cloud) { await writeCloud("Created missing cloud dashboard"); return; }
    const normalized = normalize(cloud.dashboard);
    if (!same(normalized, localSnapshot())) {
      const { changed } = applyCloud(normalized);
      lastCloudStamp = cloud.clientUpdatedAt || lastCloudStamp;
      good("Pulled changes from another device", normalized);
      if (changed) setTimeout(() => location.reload(), 80);
      return;
    }
    lastCloudStamp = Math.max(lastCloudStamp, cloud.clientUpdatedAt || 0);
    good("Cloud read verified", normalized);
  } catch (error) { bad(error, "poll"); }
}

onAuthStateChanged(auth, async (current) => {
  await persistenceReady;
  user = current;
  hydrated = false;
  clearInterval(pollTimer);
  renderAccount(current);
  if (!current) return;
  try {
    const changed = await pullCloud("Cloud dashboard loaded");
    if (!changed) pollTimer = setInterval(poll, 7000);
  } catch (error) {
    hydrated = true;
    bad(error, "initial load");
    pollTimer = setInterval(poll, 7000);
  }
});

window.addEventListener("focus", () => { if (user && hydrated) poll(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && user && hydrated) poll(); });
const navObserver = new MutationObserver(updateAccountVisibility);
navObserver.observe(document.documentElement, { subtree:true, attributes:true, attributeFilter:["class"], childList:true });
document.addEventListener("click", () => requestAnimationFrame(updateAccountVisibility), true);
ensureAccount();