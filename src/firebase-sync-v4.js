import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
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

const EMPTY_VALUES = {
  tasks: [],
  taskTags: [],
  notes: [],
  brain: [],
  birthdays: [],
  links: [],
  spotifyConfig: { clientId: "" },
  calendarLinks: []
};

const nativeSet = Storage.prototype.setItem;
const nativeRemove = Storage.prototype.removeItem;
const DEVICE_KEY = "homebase.firebase.deviceId";
const deviceId = localStorage.getItem(DEVICE_KEY) || crypto.randomUUID();
nativeSet.call(localStorage, DEVICE_KEY, deviceId);

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
const docUrl = () => `${BASE}/${encodeURIComponent(user.uid)}`;
const clone = (value) => JSON.parse(JSON.stringify(value));

function localSnapshot() {
  const out = {};
  for (const key of KEYS) {
    const field = fieldFor(key);
    const raw = localStorage.getItem(key);
    if (raw == null) {
      out[field] = clone(EMPTY_VALUES[field]);
      continue;
    }
    try {
      out[field] = JSON.parse(raw);
    } catch {
      out[field] = clone(EMPTY_VALUES[field]);
    }
  }
  return out;
}

function decodeValue(value) {
  if (!value || typeof value !== "object") return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue?.values || []).map(decodeValue);
  if ("mapValue" in value) {
    const out = {};
    for (const [key, child] of Object.entries(value.mapValue?.fields || {})) out[key] = decodeValue(child);
    return out;
  }
  return null;
}

function decodeDocument(raw) {
  const fields = raw?.fields || {};
  const legacy = fields.dashboard ? (decodeValue(fields.dashboard) || {}) : {};
  let json = {};
  if (fields.dashboardJson?.stringValue) {
    try {
      const parsed = JSON.parse(fields.dashboardJson.stringValue);
      if (parsed && typeof parsed === "object") json = parsed;
    } catch {}
  }
  return {
    dashboard: { ...legacy, ...json },
    clientUpdatedAt: Number(fields.clientUpdatedAt?.integerValue || 0),
    updatedBy: fields.updatedBy?.stringValue || "",
    schemaVersion: Number(fields.schemaVersion?.integerValue || 0)
  };
}

async function headers(force = false) {
  const token = await user.getIdToken(force);
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function request(method, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    let response = await fetch(docUrl(), {
      method,
      headers: await headers(false),
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: controller.signal
    });
    if (response.status === 401) {
      response = await fetch(docUrl(), {
        method,
        headers: await headers(true),
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
        signal: controller.signal
      });
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function readCloud() {
  const response = await request("GET");
  if (response.status === 404) return null;
  if (!response.ok) {
    let message = `Firestore HTTP ${response.status}`;
    try { message = (await response.json())?.error?.message || message; } catch {}
    throw new Error(message);
  }
  return decodeDocument(await response.json());
}

function status(text, state = "", detail = "") {
  const el = document.querySelector("[data-homebase-sync-status]");
  if (!el) return;
  el.textContent = text;
  el.dataset.state = state;
  el.title = detail || text;
}

function snapshotSummary(snapshot = localSnapshot()) {
  const taskCount = Array.isArray(snapshot.tasks) ? snapshot.tasks.length : 0;
  const calendarCount = Array.isArray(snapshot.calendarLinks) ? snapshot.calendarLinks.length : 0;
  return `${taskCount} tasks · ${calendarCount} calendars`;
}

function good(detail, snapshot) {
  failures = 0;
  lastGood = Date.now();
  status("Synced", "ok", `${detail} · ${snapshotSummary(snapshot)}`);
}

function bad(error, where) {
  failures += 1;
  console.error(`Homebase sync ${where} failed`, error);
  if (lastGood && failures < 3) status("Synced · retrying", "busy", `${where}: ${error?.message || error}`);
  else status("Sync error", "error", `${where}: ${error?.message || error}`);
}

function normalizeCloudDashboard(data) {
  const out = {};
  for (const key of KEYS) {
    const field = fieldFor(key);
    out[field] = Object.prototype.hasOwnProperty.call(data || {}, field)
      ? data[field]
      : clone(EMPTY_VALUES[field]);
  }
  return out;
}

function sameSnapshot(a, b) {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

function applyCloud(data) {
  const normalized = normalizeCloudDashboard(data);
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
  } finally {
    suppress = false;
  }
  return { changed, normalized };
}

async function writeCloud(detail = "Saved and verified in cloud") {
  const stamp = Date.now();
  const snapshot = localSnapshot();
  const payload = {
    fields: {
      dashboardJson: { stringValue: JSON.stringify(snapshot) },
      displayName: { stringValue: user.displayName || "" },
      email: { stringValue: user.email || "" },
      photoURL: { stringValue: user.photoURL || "" },
      updatedAtIso: { stringValue: new Date().toISOString() },
      clientUpdatedAt: { integerValue: String(stamp) },
      updatedBy: { stringValue: deviceId },
      schemaVersion: { integerValue: "4" }
    }
  };

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
    status("Saving…", "busy");
    const cloud = await readCloud();
    if (cloud && cloud.clientUpdatedAt > lastCloudStamp && cloud.updatedBy !== deviceId) {
      const { changed, normalized } = applyCloud(cloud.dashboard);
      lastCloudStamp = cloud.clientUpdatedAt;
      good("Pulled newer cloud data before saving", normalized);
      if (changed) setTimeout(() => location.reload(), 60);
      return;
    }
    await writeCloud();
  } catch (error) {
    bad(error, "save");
  } finally {
    saving = false;
  }
}

function queueSave() {
  if (!user || !hydrated || suppress) return;
  clearTimeout(saveTimer);
  status("Saving…", "busy");
  saveTimer = setTimeout(saveNow, 350);
}

Storage.prototype.setItem = function patchedSetItem(key, value) {
  nativeSet.call(this, key, value);
  if (this === localStorage && KEYS.includes(String(key))) queueSave();
};
Storage.prototype.removeItem = function patchedRemoveItem(key) {
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
  style.textContent = `.homebase-account{position:fixed;top:18px;right:18px;z-index:1000;display:none!important;align-items:center;gap:9px;max-width:390px;padding:8px 10px;border:1px solid rgba(220,177,139,.22);border-radius:12px;background:rgba(38,31,27,.94);box-shadow:0 12px 28px rgba(0,0,0,.3);color:#efd3b7;font-family:Nunito,system-ui,sans-serif;backdrop-filter:blur(10px)}.homebase-account img{width:30px;height:30px;border-radius:50%;object-fit:cover}.homebase-account-copy{min-width:0;line-height:1.15}.homebase-account-name{display:block;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:700}.homebase-sync-status{display:block;margin-top:3px;color:#bfa389;font-size:10px;max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.homebase-sync-status[data-state="ok"]{color:#a9bd82}.homebase-sync-status[data-state="error"]{color:#e59082}.homebase-sync-status[data-state="busy"]{color:#d5b681}.homebase-account button{border:1px solid rgba(213,135,117,.25);border-radius:9px;background:linear-gradient(#805046,#5f3934);color:#efd3b7;padding:7px 9px;font:700 12px Nunito,system-ui,sans-serif;cursor:pointer}`;
  document.head.appendChild(style);

  box = document.createElement("div");
  box.className = "homebase-account";
  box.dataset.homebaseAccount = "";
  box.innerHTML = `<div class="homebase-account-copy"><span class="homebase-account-name">Cloud sync</span><span class="homebase-sync-status" data-homebase-sync-status>Sign in to sync</span></div><button type="button">Sign in with Google</button>`;
  document.body.appendChild(box);

  box.querySelector("button").addEventListener("click", async () => {
    try {
      if (auth.currentUser) await signOut(auth);
      else {
        try { await signInWithPopup(auth, provider); }
        catch (error) {
          if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/cancelled-popup-request"].includes(error?.code)) await signInWithRedirect(auth, provider);
          else throw error;
        }
      }
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
    status("Sign in to sync");
    button.textContent = "Sign in with Google";
    return;
  }
  if (current.photoURL) {
    const img = document.createElement("img"); img.src = current.photoURL; img.alt = ""; box.insertBefore(img, copy);
  }
  copy.querySelector(".homebase-account-name").textContent = current.email || current.displayName || "Signed in";
  status("Checking cloud…", "busy");
  button.textContent = "Sign out";
  updateAccountVisibility();
}

async function poll() {
  if (!user || !hydrated || saving) return;
  try {
    const cloud = await readCloud();
    if (!cloud) { await writeCloud("Created missing cloud dashboard"); return; }

    const normalizedCloud = normalizeCloudDashboard(cloud.dashboard);
    const local = localSnapshot();
    const cloudDiffers = !sameSnapshot(normalizedCloud, local);

    // Firestore is the source of truth for cross-device state. If this device's
    // localStorage differs and there is no save in progress, always pull cloud.
    // This is intentionally stronger than the old timestamp/device checks so a
    // stale phone cannot sit forever on its own local copy.
    if (cloudDiffers) {
      const { changed } = applyCloud(normalizedCloud);
      lastCloudStamp = cloud.clientUpdatedAt || lastCloudStamp;
      good("Pulled cloud dashboard", normalizedCloud);
      if (changed) setTimeout(() => location.reload(), 60);
      return;
    }

    lastCloudStamp = Math.max(lastCloudStamp, cloud.clientUpdatedAt || 0);
    good("Cloud read verified", normalizedCloud);
  } catch (error) { bad(error, "poll"); }
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
      await writeCloud("Created cloud dashboard from this device");
    } else {
      // On every sign-in/reload, cloud wins. This is the important mobile fix.
      const { changed, normalized } = applyCloud(cloud.dashboard);
      lastCloudStamp = cloud.clientUpdatedAt || 0;
      hydrated = true;

      const missingFields = KEYS.some((key) => !Object.prototype.hasOwnProperty.call(cloud.dashboard || {}, fieldFor(key)));
      if (cloud.schemaVersion < 4 || missingFields) await writeCloud("Migrated complete cloud dashboard");
      else good("Cloud dashboard loaded", normalized);

      if (changed) {
        status("Applying cloud data…", "busy");
        setTimeout(() => location.reload(), 60);
        return;
      }
    }
    pollTimer = setInterval(poll, 5000);
  } catch (error) {
    hydrated = true;
    bad(error, "initial load");
    pollTimer = setInterval(poll, 5000);
  }
});

window.addEventListener("focus", () => { if (user && hydrated) poll(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && user && hydrated) poll(); });

const navObserver = new MutationObserver(() => updateAccountVisibility());
navObserver.observe(document.documentElement, { subtree:true, attributes:true, attributeFilter:["class"], childList:true });
document.addEventListener("click", () => requestAnimationFrame(updateAccountVisibility), true);
ensureAccount();
