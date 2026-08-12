import { getApps } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  projectId: "home-dashboard-bd412"
};

const DB = "default";
const BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${encodeURIComponent(DB)}/documents/users`;
const ACCESS_KEY = "spotify.accessToken";
const REFRESH_KEY = "spotify.refreshToken";
const EXPIRES_KEY = "spotify.expiresAt";
const UPDATED_KEY = "spotify.accountUpdatedAt";

let user = null;
let hydrating = false;
let lastLocalSignature = "";
let lastCloudCheck = 0;
let timer = null;

function localAuth() {
  return {
    accessToken: localStorage.getItem(ACCESS_KEY) || "",
    refreshToken: localStorage.getItem(REFRESH_KEY) || "",
    expiresAt: Number(localStorage.getItem(EXPIRES_KEY) || 0),
    updatedAt: Number(localStorage.getItem(UPDATED_KEY) || 0)
  };
}

function authSignature(auth) {
  return JSON.stringify([
    auth.accessToken || "",
    auth.refreshToken || "",
    Number(auth.expiresAt || 0)
  ]);
}

function hasConnection(auth) {
  return Boolean(auth?.accessToken || auth?.refreshToken);
}

function setLocalAuth(auth) {
  hydrating = true;
  try {
    if (auth?.accessToken) localStorage.setItem(ACCESS_KEY, auth.accessToken);
    else localStorage.removeItem(ACCESS_KEY);

    if (auth?.refreshToken) localStorage.setItem(REFRESH_KEY, auth.refreshToken);
    else localStorage.removeItem(REFRESH_KEY);

    if (auth?.expiresAt) localStorage.setItem(EXPIRES_KEY, String(auth.expiresAt));
    else localStorage.removeItem(EXPIRES_KEY);

    localStorage.setItem(UPDATED_KEY, String(Number(auth?.updatedAt || Date.now())));
    lastLocalSignature = authSignature(localAuth());
  } finally {
    hydrating = false;
  }

  window.dispatchEvent(new StorageEvent("storage", { key: ACCESS_KEY }));
  window.dispatchEvent(new CustomEvent("homebase:spotify-account-sync"));
}

async function idToken() {
  if (!user) throw new Error("Not signed in");
  return user.getIdToken();
}

function docUrl() {
  return `${BASE}/${encodeURIComponent(user.uid)}`;
}

async function readCloud() {
  const token = await idToken();
  const response = await fetch(docUrl(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Spotify account sync read HTTP ${response.status}`);
  const data = await response.json();
  const raw = data?.fields?.spotifyAuthJson?.stringValue || "";
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      accessToken: String(parsed.accessToken || ""),
      refreshToken: String(parsed.refreshToken || ""),
      expiresAt: Number(parsed.expiresAt || 0),
      updatedAt: Number(parsed.updatedAt || 0)
    };
  } catch {
    return null;
  }
}

async function writeCloud(auth) {
  if (!user) return;
  const token = await idToken();
  const updatedAt = Number(auth.updatedAt || Date.now());
  const payload = {
    accessToken: String(auth.accessToken || ""),
    refreshToken: String(auth.refreshToken || ""),
    expiresAt: Number(auth.expiresAt || 0),
    updatedAt
  };
  const params = new URLSearchParams();
  params.append("updateMask.fieldPaths", "spotifyAuthJson");
  params.append("updateMask.fieldPaths", "spotifyAuthUpdatedAt");
  const response = await fetch(`${docUrl()}?${params.toString()}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fields: {
        spotifyAuthJson: { stringValue: JSON.stringify(payload) },
        spotifyAuthUpdatedAt: { integerValue: String(updatedAt) }
      }
    })
  });
  if (!response.ok) throw new Error(`Spotify account sync save HTTP ${response.status}`);
}

async function reconcile() {
  if (!user || hydrating) return;

  const local = localAuth();
  let cloud = null;
  try { cloud = await readCloud(); }
  catch (error) {
    console.warn("Spotify account sync cloud read failed", error);
    return;
  }

  if (!cloud) {
    if (hasConnection(local)) {
      const next = { ...local, updatedAt: local.updatedAt || Date.now() };
      localStorage.setItem(UPDATED_KEY, String(next.updatedAt));
      try { await writeCloud(next); } catch (error) { console.warn("Spotify account sync initial save failed", error); }
    }
    lastLocalSignature = authSignature(localAuth());
    return;
  }

  if (!hasConnection(local) || Number(cloud.updatedAt || 0) > Number(local.updatedAt || 0)) {
    setLocalAuth(cloud);
    return;
  }

  if (Number(local.updatedAt || 0) > Number(cloud.updatedAt || 0) && authSignature(local) !== authSignature(cloud)) {
    try { await writeCloud(local); } catch (error) { console.warn("Spotify account sync save failed", error); }
  }

  lastLocalSignature = authSignature(localAuth());
}

async function watchLocalChanges() {
  if (!user || hydrating) return;
  const current = localAuth();
  const signature = authSignature(current);

  if (lastLocalSignature && signature !== lastLocalSignature) {
    const updatedAt = Date.now();
    localStorage.setItem(UPDATED_KEY, String(updatedAt));
    const next = { ...current, updatedAt };
    lastLocalSignature = signature;
    try { await writeCloud(next); }
    catch (error) { console.warn("Spotify account sync change save failed", error); }
    window.dispatchEvent(new CustomEvent("homebase:spotify-account-sync"));
  } else if (!lastLocalSignature) {
    lastLocalSignature = signature;
  }

  if (Date.now() - lastCloudCheck > 8000) {
    lastCloudCheck = Date.now();
    await reconcile();
  }
}

function stopWatching() {
  if (timer) clearInterval(timer);
  timer = null;
}

const app = getApps()[0];
if (app) {
  const auth = getAuth(app);
  onAuthStateChanged(auth, async (nextUser) => {
    user = nextUser || null;
    stopWatching();
    if (!user) return;
    lastLocalSignature = authSignature(localAuth());
    await reconcile();
    timer = setInterval(watchLocalChanges, 1500);
  });
}

window.addEventListener("focus", () => { if (user) reconcile(); });
window.addEventListener("homebase:spotify-account-sync", () => { if (user) reconcile(); });
