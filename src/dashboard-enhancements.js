const CC_API_BASE = "https://developing-wolverine-creatorcore-c7c5c977.koyeb.app";
const CALENDAR_KEY = "homebase.calendarLinks";
const TASK_KEY = "homebase.tasks";
const TAG_KEY = "homebase.taskTags";
const LINKS_KEY = "homebase.links";
const BRAIN_KEY = "homebase.brain";

const CATEGORY_META = {
  "event-team": { label: "Event Team", cls: "calendar-event-team" },
  appointments: { label: "Appointments", cls: "calendar-appointments" },
  birthdays: { label: "Birthdays", cls: "calendar-birthdays" },
  other: { label: "Other", cls: "calendar-other" }
};

function readJson(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } }
function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function esc(value) { return String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function escAttr(value) { return esc(value); }
function reloadSoon() { setTimeout(() => window.location.reload(), 80); }

function modal({ title, body, confirmText = "Save", cancelText = "Cancel", danger = false }) {
  return new Promise((resolve) => {
    document.querySelector(".hb-modal-backdrop")?.remove();
    const wrap = document.createElement("div");
    wrap.className = "hb-modal-backdrop";
    wrap.innerHTML = `<div class="hb-modal" role="dialog" aria-modal="true"><div class="hb-modal-head"><h2>${esc(title)}</h2><button class="hb-modal-x" aria-label="Close">×</button></div><div class="hb-modal-body">${body}</div><div class="hb-modal-actions"><button class="hb-modal-cancel">${esc(cancelText)}</button><button class="hb-modal-confirm ${danger ? "danger" : ""}">${esc(confirmText)}</button></div></div>`;
    const finish = (value) => { if (!wrap.isConnected) return; wrap.remove(); resolve(value); };
    wrap.querySelector(".hb-modal-x").onclick = () => finish(null);
    wrap.querySelector(".hb-modal-cancel").onclick = () => finish(null);
    wrap.querySelector(".hb-modal-confirm").onclick = () => finish(wrap);
    wrap.addEventListener("click", (e) => { if (e.target === wrap) finish(null); });
    document.body.appendChild(wrap);
    setTimeout(() => wrap.querySelector("input,textarea,select")?.focus(), 20);
  });
}
async function confirmModal(message, confirmText = "Delete") { return Boolean(await modal({ title: "Are you sure?", body: `<p class="hb-modal-copy">${esc(message)}</p>`, confirmText, danger: true })); }

function getTags() { return readJson(TAG_KEY, []); }
function tagOptions(selected = "") { return getTags().map((t) => `<option value="${escAttr(t.id)}" ${t.id === selected ? "selected" : ""}>${esc(t.name)}</option>`).join(""); }
function findTaskForRow(row) { const text = row.querySelector(".task-text")?.textContent.trim() || row.querySelector(".manage-task-row>button:nth-child(2)")?.textContent.trim(); return readJson(TASK_KEY, []).find((t) => String(t.text).trim() === text); }

async function taskModal(task = null) {
  const p = modal({ title: task ? "Edit task" : "Add task", confirmText: task ? "Save changes" : "Add task", body: `<label class="hb-field">Task<input class="hb-task-text" value="${escAttr(task?.text || "")}" placeholder="What needs doing?"></label><label class="hb-field">Tag<select class="hb-task-tag"><option value="">No tag</option>${tagOptions(task?.tagId || "")}</select></label>${task ? `<button class="hb-inline-danger hb-delete-task">Delete task</button>` : ""}` });
  if (task) setTimeout(() => { const btn = document.querySelector(".hb-delete-task"); if (btn) btn.onclick = async () => { if (!await confirmModal("Delete this task?")) return; writeJson(TASK_KEY, readJson(TASK_KEY, []).filter((t) => t.id !== task.id)); document.querySelector(".hb-modal-backdrop")?.remove(); reloadSoon(); }; }, 0);
  const result = await p; if (!result) return;
  const text = result.querySelector(".hb-task-text").value.trim(); if (!text) return;
  const tagId = result.querySelector(".hb-task-tag").value;
  const tasks = readJson(TASK_KEY, []);
  writeJson(TASK_KEY, task ? tasks.map((t) => t.id === task.id ? { ...t, text, tagId } : t) : [...tasks, { id: Date.now(), text, done: false, tagId, priority: false }]);
  reloadSoon();
}

function togglePriority(row) {
  const task = findTaskForRow(row); if (!task) return;
  const updated = readJson(TASK_KEY, []).map((t) => t.id === task.id ? { ...t, priority: !task.priority } : t);
  updated.sort((a,b) => Number(Boolean(b.priority)) - Number(Boolean(a.priority)));
  writeJson(TASK_KEY, updated); reloadSoon();
}
function applyPriorityVisuals() {
  document.querySelectorAll(".todo-card .task-row").forEach((row) => { const task = findTaskForRow(row); const star = row.querySelector(".star"); if (!star) return; star.classList.toggle("priority-active", Boolean(task?.priority)); star.title = task?.priority ? "Remove priority" : "Mark as priority"; });
}

async function brainModal() {
  const current = readJson(BRAIN_KEY, []);
  const result = await modal({ title: "Brain dump", body: `<label class="hb-field">One thought per line<textarea class="hb-brain-input" rows="9">${esc(current.join("\n"))}</textarea></label>`, confirmText: "Save brain dump" });
  if (!result) return; writeJson(BRAIN_KEY, result.querySelector(".hb-brain-input").value.split("\n").map((x) => x.trim()).filter(Boolean)); reloadSoon();
}

async function linkModal(item = null) {
  const p = modal({ title: item ? "Edit quick link" : "Add quick link", body: `<label class="hb-field">Name<input class="hb-link-name" value="${escAttr(item?.label || "")}"></label><label class="hb-field">Website URL<input class="hb-link-url" value="${escAttr(item?.url || "https://")}"></label>${item ? `<button class="hb-inline-danger hb-delete-link">Delete link</button>` : ""}`, confirmText: item ? "Save changes" : "Add link" });
  if (item) setTimeout(() => { const btn = document.querySelector(".hb-delete-link"); if (btn) btn.onclick = async () => { if (!await confirmModal(`Delete ${item.label}?`)) return; writeJson(LINKS_KEY, readJson(LINKS_KEY, []).filter((x) => x.id !== item.id)); document.querySelector(".hb-modal-backdrop")?.remove(); reloadSoon(); }; }, 0);
  const result = await p; if (!result) return;
  const name = result.querySelector(".hb-link-name").value.trim(); let url = result.querySelector(".hb-link-url").value.trim(); if (!name || !url) return; if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const links = readJson(LINKS_KEY, []); writeJson(LINKS_KEY, item ? links.map((x) => x.id === item.id ? { ...x, label:name, url } : x) : [...links, { id:Date.now(), label:name, url }]); reloadSoon();
}

async function tagModal(tag = null) {
  const p = modal({ title: tag ? "Edit tag" : "Add tag", body: `<label class="hb-field">Tag name<input class="hb-tag-name" value="${escAttr(tag?.name || "")}"></label>${tag ? `<button class="hb-inline-danger hb-delete-tag">Delete tag</button>` : ""}`, confirmText: tag ? "Save changes" : "Add tag" });
  if (tag) setTimeout(() => { const btn = document.querySelector(".hb-delete-tag"); if (btn) btn.onclick = async () => { if (!await confirmModal(`Delete the ${tag.name} tag? Tasks using it will become untagged.`)) return; writeJson(TAG_KEY, getTags().filter((t)=>t.id!==tag.id)); writeJson(TASK_KEY, readJson(TASK_KEY,[]).map((t)=>t.tagId===tag.id?{...t,tagId:""}:t)); document.querySelector(".hb-modal-backdrop")?.remove(); reloadSoon(); }; }, 0);
  const result = await p; if (!result) return; const name = result.querySelector(".hb-tag-name").value.trim(); if (!name) return;
  const tags = getTags(); writeJson(TAG_KEY, tag ? tags.map((t) => t.id === tag.id ? { ...t, name } : t) : [...tags, { id:`tag-${Date.now()}`, name }]); reloadSoon();
}

function inferCalendarType(name) { const n=String(name).toLowerCase(); if(n.includes("birthday"))return "birthdays"; if(n.includes("appointment")||n.includes("health")||n.includes("medical"))return "appointments"; if(n.includes("event"))return "event-team"; return "other"; }
function getCalendars() { const items=readJson(CALENDAR_KEY,[]); return (Array.isArray(items)?items:[]).map((item,index)=>typeof item==="string"?{id:`cal-${index}`,name:`Calendar ${index+1}`,type:"other",url:item}:{id:item.id||`cal-${index}`,name:item.name||item.label||`Calendar ${index+1}`,type:CATEGORY_META[item.type]?item.type:inferCalendarType(item.name||item.label||""),url:item.url||item.link||item.ics||""}).filter((x)=>x.url); }
function saveCalendars(value){writeJson(CALENDAR_KEY,value)}

async function calendarModal(item = null) {
  const options=Object.entries(CATEGORY_META).map(([value,meta])=>`<option value="${value}" ${item?.type===value?"selected":""}>${meta.label}</option>`).join("");
  const p=modal({title:item?"Edit calendar":"Add calendar",body:`<label class="hb-field">Calendar name<input class="hb-cal-name" value="${escAttr(item?.name||"")}" placeholder="e.g. Appointments"></label><label class="hb-field">Calendar type<select class="hb-cal-type">${options}</select></label><label class="hb-field">Google Calendar iCal URL<input class="hb-cal-url" value="${escAttr(item?.url||"")}" placeholder="https://calendar.google.com/calendar/ical/..."></label><p class="hb-modal-hint">Use that specific calendar's public or secret iCal address from Google Calendar settings.</p>${item?`<button class="hb-inline-danger hb-delete-calendar">Remove calendar</button>`:""}`,confirmText:item?"Save calendar":"Add calendar"});
  if(item)setTimeout(()=>{const btn=document.querySelector(".hb-delete-calendar");if(btn)btn.onclick=async()=>{if(!await confirmModal(`Remove ${item.name} from Homebase?`))return;saveCalendars(getCalendars().filter((x)=>x.id!==item.id));document.querySelector(".hb-modal-backdrop")?.remove();renderSettingsPage();refreshCalendars();};},0);
  const result=await p;if(!result)return;const name=result.querySelector(".hb-cal-name").value.trim(),type=result.querySelector(".hb-cal-type").value,url=result.querySelector(".hb-cal-url").value.trim();if(!name||!url)return;const calendars=getCalendars();saveCalendars(item?calendars.map((x)=>x.id===item.id?{...x,name,type,url}:x):[...calendars,{id:`cal-${Date.now()}`,name,type,url}]);renderSettingsPage();refreshCalendars();
}

function showSettings(){document.querySelector(".hb-settings-overlay")?.remove();const o=document.createElement("div");o.className="hb-settings-overlay";o.innerHTML=`<div class="hb-settings-panel"><button class="hb-settings-close">×</button><div class="hb-settings-content"></div></div>`;o.querySelector(".hb-settings-close").onclick=()=>o.remove();o.addEventListener("click",e=>{if(e.target===o)o.remove()});document.body.appendChild(o);renderSettingsPage();}
function renderSettingsPage(){const c=document.querySelector(".hb-settings-content");if(!c)return;const calendars=getCalendars();c.innerHTML=`<div class="hb-settings-title"><div><h1>Settings</h1><p>Add the exact Google calendars Homebase should read.</p></div><button class="hb-add-calendar">+ Add calendar</button></div><div class="hb-calendar-list">${calendars.length?calendars.map(x=>`<button class="hb-calendar-card ${CATEGORY_META[x.type]?.cls||"calendar-other"}" data-id="${escAttr(x.id)}"><span class="hb-calendar-dot"></span><span><strong>${esc(x.name)}</strong><small>${esc(CATEGORY_META[x.type]?.label||"Other")}</small></span><span class="hb-calendar-edit">Edit</span></button>`).join(""):`<div class="hb-settings-empty">No calendars added yet.</div>`}</div><div class="hb-settings-key"><span class="calendar-event-team">Event Team</span><span class="calendar-appointments">Appointments</span><span class="calendar-birthdays">Birthdays</span></div>`;c.querySelector(".hb-add-calendar").onclick=()=>calendarModal();c.querySelectorAll(".hb-calendar-card").forEach(btn=>btn.onclick=()=>calendarModal(calendars.find(x=>x.id===btn.dataset.id)));}

function parseGoogleCalendarUrl(raw){const value=String(raw||"").trim();try{const u=new URL(value);if(u.hostname==="calendar.google.com"&&u.searchParams.get("cid")&&!u.pathname.includes("/ical/")){let id=u.searchParams.get("cid");try{id=atob(id.replace(/-/g,"+").replace(/_/g,"/"))}catch{}return `https://calendar.google.com/calendar/ical/${encodeURIComponent(id)}/public/basic.ics`;}}catch{}return value;}
function unfoldIcs(text){return String(text||"").replace(/\r?\n[ \t]/g,"")}
function parseIcsDate(v){v=String(v||"").trim();if(/^\d{8}$/.test(v))return new Date(+v.slice(0,4),+v.slice(4,6)-1,+v.slice(6,8));const m=v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);if(!m)return null;return m[7]?new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0))):new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0));}
function parseIcs(text,calendar){return unfoldIcs(text).split("BEGIN:VEVENT").slice(1).map(block=>{block=block.split("END:VEVENT")[0]||block;const e={calendar};for(const line of block.split(/\r?\n/)){const colon=line.indexOf(":");if(colon<0)continue;const lhs=line.slice(0,colon),value=line.slice(colon+1),key=lhs.split(";")[0];if(key==="SUMMARY")e.title=value.replace(/\\,/g,",").replace(/\\n/g," ").replace(/\\;/g,";");if(key==="DTSTART"){e.start=parseIcsDate(value);e.allDay=/^\d{8}$/.test(value)}if(key==="RRULE")e.rrule=value;}return e}).filter(e=>e.start&&e.title)}
function startOfWeek(d=new Date()){const x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x}function endOfWeek(){const x=startOfWeek();x.setDate(x.getDate()+7);return x}function recurrenceParts(rule=""){return Object.fromEntries(rule.split(";").map(p=>p.split("=",2)))}
function expandEvent(event,from,to){if(!event.rrule)return event.start>=from&&event.start<to?[event]:[];const p=recurrenceParts(event.rrule),out=[];if(p.FREQ==="YEARLY"){for(let y=from.getFullYear()-1;y<=to.getFullYear()+1;y++){const d=new Date(y,event.start.getMonth(),event.start.getDate(),event.start.getHours(),event.start.getMinutes());if(d>=from&&d<to)out.push({...event,start:d})}return out}if(p.FREQ==="WEEKLY"){const days={SU:0,MO:1,TU:2,WE:3,TH:4,FR:5,SA:6};const by=(p.BYDAY||Object.keys(days).find(k=>days[k]===event.start.getDay())||"").split(","),interval=Number(p.INTERVAL||1);for(let d=new Date(from);d<to;d.setDate(d.getDate()+1)){if(!by.some(k=>days[k]===d.getDay()))continue;const occ=new Date(d);occ.setHours(event.start.getHours(),event.start.getMinutes(),0,0);if(occ<event.start)continue;const weeks=Math.floor((startOfWeek(occ)-startOfWeek(event.start))/604800000);if(weeks%interval)continue;out.push({...event,start:occ})}return out}return event.start>=from&&event.start<to?[event]:[]}
function formatTime(e){return e.allDay?"All day":e.start.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
async function fetchAllCalendarEvents(){const calendars=getCalendars(),from=startOfWeek(),to=new Date();to.setFullYear(to.getFullYear()+1);const all=[];await Promise.all(calendars.map(async calendar=>{try{const res=await fetch(`${CC_API_BASE}/api/homebase-calendar?url=${encodeURIComponent(parseGoogleCalendarUrl(calendar.url))}`,{cache:"no-store"});if(!res.ok)throw new Error(`Calendar ${res.status}`);const text=await res.text();parseIcs(text,calendar).forEach(e=>all.push(...expandEvent(e,from,to)))}catch(err){console.error(`Calendar failed: ${calendar.name}`,err)}}));all.sort((a,b)=>a.start-b.start);return all}
function renderWeek(events){const list=document.querySelector(".week-card .week-list");if(!list)return;const from=startOfWeek(),to=endOfWeek(),week=events.filter(e=>e.start>=from&&e.start<to).slice(0,8);list.innerHTML=week.length?week.map(e=>`<div class="hb-week-event ${CATEGORY_META[e.calendar.type]?.cls||"calendar-other"}"><span class="hb-week-name">${esc(e.title)}</span><strong>${esc(formatTime(e))}</strong></div>`).join(""):`<div class="hb-week-empty">Nothing in your calendars this week.</div>`}
function renderBirthdays(events){const card=document.querySelector(".birthdays-card"),list=card?.querySelector(".people-list");if(!list)return;const now=new Date();now.setHours(0,0,0,0);const birthdays=events.filter(e=>e.calendar.type==="birthdays"&&e.start>=now).slice(0,5);list.innerHTML=birthdays.length?birthdays.map(e=>`<div class="person-row hb-birthday-row"><span class="avatar-dot">${esc(e.title.slice(0,1).toUpperCase())}</span><strong>${esc(e.title)}</strong><span>${esc(e.start.toLocaleDateString("en-GB",{day:"numeric",month:"short"}))}</span></div>`).join(""):`<div class="empty-state">No upcoming birthdays in your Birthday calendar</div>`;card?.querySelector("header button")?.remove()}
async function refreshCalendars(){const events=await fetchAllCalendarEvents();renderWeek(events);renderBirthdays(events)}

async function refreshCc(){try{const res=await fetch(`${CC_API_BASE}/api/homebase-summary`,{cache:"no-store"});if(!res.ok)throw new Error(`CC ${res.status}`);const data=await res.json(),loa=document.querySelector(".loa-card .cc-list"),foot=document.querySelector(".loa-card .cc-footer"),warn=document.querySelector(".warnings-card .cc-list");if(loa)loa.innerHTML=data.loas?.length?data.loas.map(x=>`<div class="cc-row"><span class="avatar-dot">${esc(x.name.slice(0,1).toUpperCase())}</span><div><strong>${esc(x.name)}</strong><small>${esc(x.start)} → ${esc(x.end)}</small></div></div>`).join(""):`<div class="empty-state">No active LOAs</div>`;if(foot)foot.textContent=`${data.loas?.length||0} creator${data.loas?.length===1?"":"s"} on LOA · Live`;if(warn)warn.innerHTML=data.warnings?.length?data.warnings.map(x=>`<div class="cc-row warning"><span class="avatar-dot">${esc(x.name.slice(0,1).toUpperCase())}</span><div><strong>${esc(x.name)}</strong><small>${Number(x.count)} active warnings</small></div><span class="warning-dot"></span></div>`).join(""):`<div class="empty-state">No creators currently have 2+ warnings</div>`}catch(err){console.error("CC summary failed",err)}}
function weatherIcon(c=""){c=c.toLowerCase();if(c.includes("rain")||c.includes("shower")||c.includes("drizzle"))return"🌧️";if(c.includes("cloud")||c.includes("overcast"))return"⛅";if(c.includes("clear")&&c.includes("night"))return"🌙";if(c.includes("sun"))return"☀️";if(c.includes("snow")||c.includes("sleet"))return"🌨️";if(c.includes("mist")||c.includes("fog"))return"🌫️";return"🌤️"}
async function refreshWeather(){try{const res=await fetch(`${CC_API_BASE}/api/homebase-weather`,{cache:"no-store"});if(!res.ok)throw new Error(`Weather ${res.status}`);const d=await res.json(),line=document.querySelector(".clock-card .weather-line"),meta=document.querySelector(".clock-card .weather-meta");if(line)line.innerHTML=`<div class="hb-weather-icon">${weatherIcon(d.condition)}</div><div><strong>${esc(d.temperature)}°C</strong><span>${esc(d.condition)}</span><small>Reading, UK · Met Office</small></div>`;if(meta)meta.textContent=`${d.feelsLike!=null?`Feels like ${d.feelsLike}°C`:""}${d.rain?` · Rain ${d.rain}`:""}`}catch(err){console.error("Met Office weather failed",err)}}

function renderQuickLinksHome(){const box=document.querySelector(".decor-card");if(!box)return;const links=readJson(LINKS_KEY,[]).slice(0,8),sig=JSON.stringify(links.map(x=>[x.id,x.label,x.url]));if(box.dataset.hbLinksSignature===sig)return;box.dataset.hbLinksSignature=sig;box.className="panel decor-card home-quick-links";box.innerHTML=`<header><div><span class="hb-link-heading-icon">🔗</span><h2>QUICK LINKS</h2></div></header><div class="hb-home-links">${links.map(x=>{let host="";try{host=new URL(x.url).hostname}catch{}return`<a href="${escAttr(x.url)}" target="_blank" rel="noopener noreferrer"><span class="hb-link-favicon">${host?`<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64" alt="">`:"↗"}</span><strong>${esc(x.label)}</strong></a>`}).join("")}</div>`}
function restyleBrain(){document.querySelector(".brain-card .sticky-note")?.classList.add("hb-real-sticky")}

function interceptClicks(){document.addEventListener("click",async e=>{const target=e.target,nav=target.closest(".nav-item");if(nav?.textContent.trim()==="Settings"){e.preventDefault();e.stopImmediatePropagation();showSettings();return}const star=target.closest(".todo-card .star");if(star){e.preventDefault();e.stopImmediatePropagation();togglePriority(star.closest(".task-row"));return}const add=target.closest(".todo-card header button");if(add){e.preventDefault();e.stopImmediatePropagation();taskModal();return}const text=target.closest(".todo-card .task-text");if(text){e.preventDefault();e.stopImmediatePropagation();const task=findTaskForRow(text.closest(".task-row"));if(task)taskModal(task);return}const brain=target.closest(".brain-card");if(brain){e.preventDefault();e.stopImmediatePropagation();brainModal();return}const linkEdit=target.closest(".link-edit");if(linkEdit){e.preventDefault();e.stopImmediatePropagation();const label=linkEdit.closest(".link-card")?.querySelector("strong")?.textContent.trim(),item=readJson(LINKS_KEY,[]).find(x=>x.label===label);if(item)linkModal(item);return}const pageBtn=target.closest(".subpage-header .primary-btn");if(pageBtn){const title=document.querySelector(".subpage-header h1")?.textContent.trim();if(title==="Quick Links"){e.preventDefault();e.stopImmediatePropagation();linkModal();return}if(title==="Tasks & Tags"){e.preventDefault();e.stopImmediatePropagation();taskModal();return}}const addTag=target.closest(".manage-title button");if(addTag&&addTag.textContent.includes("Add tag")){e.preventDefault();e.stopImmediatePropagation();tagModal();return}const tagRow=target.closest(".tag-manage-row");if(tagRow){const clicked=target.closest("button");if(clicked){e.preventDefault();e.stopImmediatePropagation();const name=tagRow.querySelector(".task-tag")?.textContent.trim(),tag=getTags().find(t=>t.name===name),buttons=[...tagRow.querySelectorAll("button")];if(!tag)return;if(clicked===buttons[0])tagModal(tag);else if(clicked===buttons[1]&&await confirmModal(`Delete the ${tag.name} tag? Tasks using it will become untagged.`)){writeJson(TAG_KEY,getTags().filter(t=>t.id!==tag.id));writeJson(TASK_KEY,readJson(TASK_KEY,[]).map(t=>t.tagId===tag.id?{...t,tagId:""}:t));reloadSoon()}return}}const manageTask=target.closest(".manage-task-row>button:nth-child(2)");if(manageTask){e.preventDefault();e.stopImmediatePropagation();const row=manageTask.closest(".manage-task-row"),task=readJson(TASK_KEY,[]).find(t=>String(t.text).trim()===manageTask.textContent.trim());if(task)taskModal(task);return}const noteDelete=target.closest(".paper-tools button");if(noteDelete){e.preventDefault();e.stopImmediatePropagation();if(await confirmModal("Delete this note?")){noteDelete.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:window,__hbApproved:true}))}return}},true)}

function observe(){let scheduled=false;const o=new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;applyPriorityVisuals();if(document.querySelector(".decor-card"))renderQuickLinksHome();restyleBrain()})});o.observe(document.body,{childList:true,subtree:true})}
function init(){interceptClicks();applyPriorityVisuals();renderQuickLinksHome();restyleBrain();refreshCc();refreshCalendars();refreshWeather();setInterval(refreshCc,300000);setInterval(refreshCalendars,600000);setInterval(refreshWeather,900000);observe()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(init,250));else setTimeout(init,250);
