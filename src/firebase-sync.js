import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "firebase/auth";
import {
  doc,
  getDoc,
  initializeFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc
} from "firebase/firestore";

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
// Force Firestore to use long polling. This is more reliable behind VPNs,
// privacy extensions and networks that interfere with Firestore's streaming transport.
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false
});
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

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
let unsubscribeSnapshot = null;
let suppressLocalSync = false;

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
  suppressLocalSync = true;
  try {
    for (const key of SYNC_KEYS) {
      const field = key.replace("homebase.", "");
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        originalSetItem.call(localStorage, key, JSON.stringify(data[field]));
      }
    }
  } finally { suppressLocalSync = false; }
}

function firebaseErrorLabel(error) {
  const rawCode = String(error?.code || "unknown");
  const code = rawCode.replace(/^firestore\//, "").replace(/^auth\//, "");
  const message = String(error?.message || "").replace(/^Firebase:\s*/i, "").trim();
  return {
    short: `Sync error · ${code}`,
    detail: message ? `${rawCode}: ${message}` : rawCode
  };
}

async function saveDashboardToCloud() {
  if (!currentUser || !readyToSync) return;
  const clientUpdatedAt = Date.now();
  sessionStorage.setItem(cloudVersionKey, String(clientUpdatedAt));
  try {
    await setDoc(doc(db, "users", currentUser.uid), {
      dashboard: readLocalDashboard(),
      displayName: currentUser.displayName || "",
      email: currentUser.email || "",
      photoURL: currentUser.photoURL || "",
      updatedAt: serverTimestamp(),
      clientUpdatedAt,
      updatedBy: deviceId
    }, { merge: true });
    setSyncStatus("Synced", "ok");
  } catch (error) {
    console.error("Homebase cloud save failed:", error);
    const info = firebaseErrorLabel(error);
    setSyncStatus(info.short, "error", info.detail);
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
    .homebase-account{position:fixed;top:18px;right:18px;z-index:1000;display:flex;align-items:center;gap:9px;max-width:300px;padding:8px 10px;border:1px solid rgba(220,177,139,.22);border-radius:12px;background:rgba(38,31,27,.94);box-shadow:0 12px 28px rgba(0,0,0,.3);color:#efd3b7;font-family:Nunito,system-ui,sans-serif;backdrop-filter:blur(10px)}
    .homebase-account img{width:30px;height:30px;flex:none;border-radius:50%;object-fit:cover;border:1px solid rgba(239,211,183,.25)}
    .homebase-account-copy{min-width:0;line-height:1.15}.homebase-account-name{display:block;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:700}.homebase-sync-status{display:block;margin-top:3px;color:#bfa389;font-size:10px;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.homebase-sync-status[data-state="ok"]{color:#a9bd82}.homebase-sync-status[data-state="error"]{color:#e59082}
    .homebase-account button{flex:none;border:1px solid rgba(213,135,117,.25);border-radius:9px;background:linear-gradient(#805046,#5f3934);color:#efd3b7;padding:7px 9px;font:700 12px Nunito,system-ui,sans-serif;cursor:pointer}@media(max-width:700px){.homebase-account{top:8px;right:8px;max-width:240px}.homebase-account-name{max-width:88px}.homebase-sync-status{max-width:115px}}
  `;
  document.head.appendChild(style);
  control = document.createElement("div");
  control.className = "homebase-account";
  control.dataset.homebaseAccount = "";
  control.innerHTML = `<div class="homebase-account-copy"><span class="homebase-account-name">Cloud sync</span><span class="homebase-sync-status" data-homebase-sync-status>Sign in to sync</span></div><button type="button" data-homebase-auth-button>Sign in with Google</button>`;
  document.body.appendChild(control);
  control.querySelector("[data-homebase-auth-button]").addEventListener("click", async () => {
    const button = control.querySelector("[data-homebase-auth-button]"); button.disabled = true;
    try { if (auth.currentUser) await signOut(auth); else await signInWithPopup(auth, provider); }
    catch (error) {
      console.error("Google sign-in failed:", error);
      if (error?.code === "auth/popup-closed-by-user") setSyncStatus("Sign-in cancelled", "error");
      else {
        const info = firebaseErrorLabel(error);
        setSyncStatus(`Sign-in error · ${String(error?.code || "unknown").replace(/^auth\//, "")}`, "error", info.detail);
      }
    } finally { button.disabled = false; }
  });
  return control;
}

function renderAccount(user) {
  const control=ensureAccountControl(); const button=control.querySelector("[data-homebase-auth-button]"); const copy=control.querySelector(".homebase-account-copy"); const existing=control.querySelector("img"); if(existing)existing.remove();
  if(!user){copy.querySelector(".homebase-account-name").textContent="Cloud sync";setSyncStatus("Sign in to sync");button.textContent="Sign in with Google";return;}
  if(user.photoURL){const photo=document.createElement("img");photo.src=user.photoURL;photo.alt="";control.insertBefore(photo,copy);} copy.querySelector(".homebase-account-name").textContent=user.displayName||user.email||"Signed in";setSyncStatus("Connecting…","busy");button.textContent="Sign out";
}

function watchCloudDocument(user) {
  unsubscribeSnapshot?.(); const userRef=doc(db,"users",user.uid); let firstSnapshot=true;
  unsubscribeSnapshot=onSnapshot(userRef,(snapshot)=>{
    if(firstSnapshot){firstSnapshot=false;return;} if(!snapshot.exists())return;
    const data=snapshot.data(); const version=Number(data.clientUpdatedAt||0); const lastApplied=Number(sessionStorage.getItem(cloudVersionKey)||0); if(!version||version<=lastApplied||data.updatedBy===deviceId)return;
    sessionStorage.setItem(cloudVersionKey,String(version));applyCloudDashboard(data.dashboard||{});setSyncStatus("Updated from another device","ok");setTimeout(()=>window.location.reload(),80);
  },(error)=>{
    console.error("Homebase cloud listener failed:",error);
    const info = firebaseErrorLabel(error);
    setSyncStatus(info.short,"error",info.detail);
  });
}

onAuthStateChanged(auth, async (user) => {
  currentUser=user;readyToSync=false;renderAccount(user);unsubscribeSnapshot?.();unsubscribeSnapshot=null;
  if(!user){sessionStorage.removeItem(cloudLoadedKey);return;}
  const userRef=doc(db,"users",user.uid);
  try {
    const snapshot=await getDoc(userRef); const alreadyLoaded=sessionStorage.getItem(cloudLoadedKey)===user.uid;
    if(snapshot.exists()&&!alreadyLoaded){const data=snapshot.data();applyCloudDashboard(data.dashboard||{});sessionStorage.setItem(cloudLoadedKey,user.uid);sessionStorage.setItem(cloudVersionKey,String(data.clientUpdatedAt||0));setSyncStatus("Loading your dashboard…","busy");setTimeout(()=>window.location.reload(),80);return;}
    if(!snapshot.exists()){sessionStorage.setItem(cloudLoadedKey,user.uid);readyToSync=true;await saveDashboardToCloud();}
    else{sessionStorage.setItem(cloudLoadedKey,user.uid);sessionStorage.setItem(cloudVersionKey,String(snapshot.data().clientUpdatedAt||0));readyToSync=true;setSyncStatus("Synced","ok");}
    watchCloudDocument(user);
  } catch(error){
    console.error("Homebase cloud load failed:",error);
    const info = firebaseErrorLabel(error);
    setSyncStatus(info.short,"error",info.detail);
  }
});

ensureAccountControl();
