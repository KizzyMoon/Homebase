import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";

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

const DB = "(default)";
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

const nativeSet = Storage.prototype.setItem;
const nativeRemove = Storage.prototype.removeItem;
const DEVICE_KEY = "homebase.firebase.deviceId";
const VERSION_KEY = "homebase.firebase.cloudVersion";
const deviceId = localStorage.getItem(DEVICE_KEY) || crypto.randomUUID();
nativeSet.call(localStorage, DEVICE_KEY, deviceId);

let user = null;
let hydrated = false;
let suppress = false;
let saving = false;
let saveTimer = null;
let pollTimer = null;
let failures = 0;
let lastGood = 0;

function docUrl() { return `${BASE}/${encodeURIComponent(user.uid)}`; }
function fieldFor(key) { return key.replace("homebase.", ""); }

function localSnapshot() {
  const out = {};
  for (const key of KEYS) {
    const raw = localStorage.getItem(key);
    if (raw == null) continue;
    try { out[fieldFor(key)] = JSON.parse(raw); } catch {}
  }
  return out;
}

function decodeValue(v) {
  if (!v || typeof v !== "object") return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return Boolean(v.booleanValue);
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue?.values || []).map(decodeValue);
  if ("mapValue" in v) {
    const out = {};
    for (const [k, child] of Object.entries(v.mapValue?.fields || {})) out[k] = decodeValue(child);
    return out;
  }
  return null;
}

function decodeDocument(raw) {
  const fields = raw?.fields || {};
  let dashboard = {};

  // Current format.
  if (fields.dashboardJson?.stringValue) {
    try { dashboard = JSON.parse(fields.dashboardJson.stringValue) || {}; } catch {}
  }

  // Backward compatibility with the original Firestore map format. This is
  // important because older Homebase builds saved calendars/tasks here.
  if ((!dashboard || !Object.keys(dashboard).length) && fields.dashboard) {
    dashboard = decodeValue(fields.dashboard) || {};
  }

  return {
    dashboard: dashboard && typeof dashboard === "object" ? dashboard : {},
    clientUpdatedAt: Number(fields.clientUpdatedAt?.integerValue || 0),
    updatedBy: fields.updatedBy?.stringValue || ""
  };
}

async function headers(force = false) {
  const token = await user.getIdToken(force);
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function request(method, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    let h = await headers(false);
    let res = await fetch(docUrl(), { method, headers: h, body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: controller.signal });
    if (res.status === 401) {
      h = await headers(true);
      res = await fetch(docUrl(), { method, headers: h, body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: controller.signal });
    }
    return res;
  } finally { clearTimeout(timer); }
}

async function readCloud() {
  const res = await request("GET");
  if (res.status === 404) return null;
  if (!res.ok) {
    let msg = `Firestore HTTP ${res.status}`;
    try { msg = (await res.json())?.error?.message || msg; } catch {}
    throw new Error(msg);
  }
  return decodeDocument(await res.json());
}

async function writeCloud() {
  const stamp = Date.now();
  const payload = {
    fields: {
      dashboardJson: { stringValue: JSON.stringify(localSnapshot()) },
      displayName: { stringValue: user.displayName || "" },
      email: { stringValue: user.email || "" },
      photoURL: { stringValue: user.photoURL || "" },
      updatedAtIso: { stringValue: new Date().toISOString() },
      clientUpdatedAt: { integerValue: String(stamp) },
      updatedBy: { stringValue: deviceId },
      schemaVersion: { integerValue: "2" }
    }
  };
  const res = await request("PATCH", payload);
  if (!res.ok) throw new Error(`Firestore save HTTP ${res.status}`);
  sessionStorage.setItem(VERSION_KEY, String(stamp));
  good("Saved and verified in cloud");
}

function applyCloud(data) {
  if (!data || typeof data !== "object") return false;
  let changed = false;
  suppress = true;
  try {
    for (const key of KEYS) {
      const field = fieldFor(key);
      if (!Object.prototype.hasOwnProperty.call(data, field)) continue;
      const encoded = JSON.stringify(data[field]);
      if (localStorage.getItem(key) !== encoded) {
        nativeSet.call(localStorage, key, encoded);
        changed = true;
      }
    }
  } finally { suppress = false; }
  return changed;
}

function status(text, state = "", detail = "") {
  const el = document.querySelector("[data-homebase-sync-status]");
  if (!el) return;
  el.textContent = text;
  el.dataset.state = state;
  el.title = detail || text;
}

function good(detail) {
  failures = 0;
  lastGood = Date.now();
  status("Synced", "ok", detail);
}

function bad(error, where) {
  failures += 1;
  console.error(`Homebase sync ${where} failed`, error);
  if (lastGood && failures < 3) status("Synced · retrying", "busy", `${where}: ${error?.message || error}`);
  else status("Sync error", "error", `${where}: ${error?.message || error}`);
}

async function saveNow() {
  if (!user || !hydrated || saving) return;
  saving = true;
  try { status("Saving…", "busy"); await writeCloud(); }
  catch (e) { bad(e, "save"); }
  finally { saving = false; }
}

function queueSave() {
  if (!user || !hydrated || suppress) return;
  clearTimeout(saveTimer);
  status("Saving…", "busy");
  saveTimer = setTimeout(saveNow, 500);
}

Storage.prototype.setItem = function(key, value) {
  nativeSet.call(this, key, value);
  if (this === localStorage && KEYS.includes(String(key))) queueSave();
};
Storage.prototype.removeItem = function(key) {
  nativeRemove.call(this, key);
  if (this === localStorage && KEYS.includes(String(key))) queueSave();
};

function ensureAccount() {
  let box = document.querySelector("[data-homebase-account]");
  if (box) return box;
  const style = document.createElement("style");
  style.textContent = `.homebase-account{position:fixed;top:18px;right:18px;z-index:1000;display:flex;align-items:center;gap:9px;max-width:320px;padding:8px 10px;border:1px solid rgba(220,177,139,.22);border-radius:12px;background:rgba(38,31,27,.94);box-shadow:0 12px 28px rgba(0,0,0,.3);color:#efd3b7;font-family:Nunito,system-ui,sans-serif;backdrop-filter:blur(10px)}.homebase-account img{width:30px;height:30px;border-radius:50%;object-fit:cover}.homebase-account-copy{min-width:0;line-height:1.15}.homebase-account-name{display:block;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:700}.homebase-sync-status{display:block;margin-top:3px;color:#bfa389;font-size:10px;max-width:185px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.homebase-sync-status[data-state="ok"]{color:#a9bd82}.homebase-sync-status[data-state="error"]{color:#e59082}.homebase-sync-status[data-state="busy"]{color:#d5b681}.homebase-account button{border:1px solid rgba(213,135,117,.25);border-radius:9px;background:linear-gradient(#805046,#5f3934);color:#efd3b7;padding:7px 9px;font:700 12px Nunito,system-ui,sans-serif;cursor:pointer}`;
  document.head.appendChild(style);
  box = document.createElement("div");
  box.className = "homebase-account";
  box.dataset.homebaseAccount = "";
  box.innerHTML = `<div class="homebase-account-copy"><span class="homebase-account-name">Cloud sync</span><span class="homebase-sync-status" data-homebase-sync-status>Sign in to sync</span></div><button type="button">Sign in with Google</button>`;
  document.body.appendChild(box);
  box.querySelector("button").addEventListener("click", async () => {
    try { if (auth.currentUser) await signOut(auth); else await signInWithPopup(auth, provider); }
    catch (e) { bad(e, "sign-in"); }
  });
  return box;
}

function renderAccount(current) {
  const box = ensureAccount();
  const copy = box.querySelector(".homebase-account-copy");
  box.querySelector("img")?.remove();
  const btn = box.querySelector("button");
  if (!current) {
    copy.querySelector(".homebase-account-name").textContent = "Cloud sync";
    status("Sign in to sync");
    btn.textContent = "Sign in with Google";
    return;
  }
  if (current.photoURL) {
    const img = document.createElement("img"); img.src = current.photoURL; img.alt = ""; box.insertBefore(img, copy);
  }
  copy.querySelector(".homebase-account-name").textContent = current.displayName || current.email || "Signed in";
  status("Checking cloud…", "busy");
  btn.textContent = "Sign out";
}

async function poll() {
  if (!user || !hydrated || saving) return;
  try {
    const cloud = await readCloud();
    if (!cloud) { await writeCloud(); return; }
    const seen = Number(sessionStorage.getItem(VERSION_KEY) || 0);
    if (cloud.clientUpdatedAt > seen && cloud.updatedBy !== deviceId) {
      const changed = applyCloud(cloud.dashboard);
      sessionStorage.setItem(VERSION_KEY, String(cloud.clientUpdatedAt || 0));
      good("Pulled newer cloud data");
      if (changed) setTimeout(() => location.reload(), 80);
    } else good("Cloud read verified");
  } catch (e) { bad(e, "poll"); }
}

onAuthStateChanged(auth, async (current) => {
  user = current;
  hydrated = false;
  clearInterval(pollTimer);
  renderAccount(current);
  if (!current) return;

  try {
    const cloud = await readCloud();
    if (!cloud) {
      hydrated = true;
      await writeCloud();
    } else {
      const changed = applyCloud(cloud.dashboard);
      sessionStorage.setItem(VERSION_KEY, String(cloud.clientUpdatedAt || 0));
      hydrated = true;
      good(Object.keys(cloud.dashboard || {}).length ? "Cloud dashboard loaded" : "Cloud document verified");
      if (changed) {
        status("Applying cloud data…", "busy");
        setTimeout(() => location.reload(), 80);
        return;
      }
    }
    pollTimer = setInterval(poll, 15000);
  } catch (e) {
    hydrated = true;
    bad(e, "initial load");
    pollTimer = setInterval(poll, 15000);
  }
});

ensureAccount();
