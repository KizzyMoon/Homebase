const CC_API_BASE = "https://developing-wolverine-creatorcore-c7c5c977.koyeb.app";
const CALENDAR_KEY = "homebase.calendarLinks";
const TASK_KEY = "homebase.tasks";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RRULE_DAYS = { SU:0, MO:1, TU:2, WE:3, TH:4, FR:5, SA:6 };

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getCalendarLinks() {
  const direct = readJson(CALENDAR_KEY, null);
  if (Array.isArray(direct)) return normaliseLinks(direct);

  for (const legacyKey of ["homebase.googleCalendars", "homebase.calendars", "calendarLinks", "googleCalendars"]) {
    const legacy = readJson(legacyKey, null);
    if (Array.isArray(legacy) && legacy.length) {
      const normalised = normaliseLinks(legacy);
      writeJson(CALENDAR_KEY, normalised);
      return normalised;
    }
  }
  return [];
}

function normaliseLinks(items) {
  return items.map((item, index) => {
    if (typeof item === "string") return { id:`calendar-${index}`, name:`Calendar ${index + 1}`, url:item };
    return {
      id: item.id || `calendar-${index}`,
      name: item.name || item.label || `Calendar ${index + 1}`,
      url: item.url || item.link || item.ics || ""
    };
  }).filter((item) => item.url);
}

function parseGoogleCalendarUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.hostname === "calendar.google.com" && url.searchParams.get("cid") && !url.pathname.includes("/ical/")) {
      let calendarId = url.searchParams.get("cid");
      try { calendarId = atob(calendarId.replace(/-/g, "+").replace(/_/g, "/")); } catch {}
      return `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
    }
    return value;
  } catch {
    return value;
  }
}

function unfoldIcs(text) {
  return String(text || "").replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function parseIcsDate(value, params = "") {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{8}$/.test(raw)) {
    return new Date(Number(raw.slice(0,4)), Number(raw.slice(4,6))-1, Number(raw.slice(6,8)), 0, 0, 0);
  }
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!match) return null;
  const [,y,m,d,hh,mm,ss="00",z] = match;
  if (z) return new Date(Date.UTC(+y,+m-1,+d,+hh,+mm,+ss));
  return new Date(+y,+m-1,+d,+hh,+mm,+ss);
}

function cleanIcsText(value) {
  return String(value || "").replace(/\\n/g, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function parseIcs(text, calendarName) {
  const source = unfoldIcs(text);
  return source.split("BEGIN:VEVENT").slice(1).map((block) => {
    block = block.split("END:VEVENT")[0] || block;
    const lines = block.split(/\r?\n/);
    const event = { calendarName, exdates:[] };
    for (const line of lines) {
      const colon = line.indexOf(":");
      if (colon < 0) continue;
      const lhs = line.slice(0, colon);
      const value = line.slice(colon + 1);
      const [key, ...paramParts] = lhs.split(";");
      const params = paramParts.join(";");
      if (key === "SUMMARY") event.title = cleanIcsText(value);
      if (key === "DTSTART") { event.start = parseIcsDate(value, params); event.allDay = /^\d{8}$/.test(value); }
      if (key === "DTEND") event.end = parseIcsDate(value, params);
      if (key === "RRULE") event.rrule = value;
      if (key === "EXDATE") event.exdates.push(...value.split(",").map((v) => parseIcsDate(v, params)).filter(Boolean));
    }
    return event;
  }).filter((event) => event.start && event.title);
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function sameDay(a,b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function expandEventForWeek(event, weekStart) {
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
  if (!event.rrule) return event.start >= weekStart && event.start < weekEnd ? [event] : [];

  const bits = Object.fromEntries(event.rrule.split(";").map((part) => part.split("=",2)));
  if (bits.FREQ !== "WEEKLY") return event.start >= weekStart && event.start < weekEnd ? [event] : [];

  const interval = Number(bits.INTERVAL || 1);
  const until = bits.UNTIL ? parseIcsDate(bits.UNTIL) : null;
  const byDays = (bits.BYDAY || Object.keys(RRULE_DAYS).find((key) => RRULE_DAYS[key] === event.start.getDay()) || "").split(",").filter(Boolean);
  const results = [];

  for (let offset = 0; offset < 7; offset++) {
    const day = new Date(weekStart); day.setDate(day.getDate() + offset);
    if (!byDays.some((key) => RRULE_DAYS[key] === day.getDay())) continue;
    const occurrence = new Date(day);
    occurrence.setHours(event.start.getHours(), event.start.getMinutes(), event.start.getSeconds(), 0);
    if (occurrence < event.start || (until && occurrence > until)) continue;
    const originalWeek = startOfWeek(event.start);
    const weekDistance = Math.round((startOfWeek(occurrence) - originalWeek) / 604800000);
    if (weekDistance % interval !== 0) continue;
    if (event.exdates.some((ex) => sameDay(ex, occurrence) && ex.getHours() === occurrence.getHours() && ex.getMinutes() === occurrence.getMinutes())) continue;
    results.push({ ...event, start: occurrence });
  }
  return results;
}

async function fetchCalendarEvents() {
  const links = getCalendarLinks();
  if (!links.length) return { events:[], status:"No calendars configured" };
  const weekStart = startOfWeek();
  const all = [];
  let successes = 0;

  await Promise.all(links.map(async (calendar) => {
    try {
      const target = parseGoogleCalendarUrl(calendar.url);
      const response = await fetch(`${CC_API_BASE}/api/homebase-calendar?url=${encodeURIComponent(target)}`, { cache:"no-store" });
      if (!response.ok) throw new Error(`Calendar ${response.status}`);
      const text = await response.text();
      parseIcs(text, calendar.name).forEach((event) => all.push(...expandEventForWeek(event, weekStart)));
      successes += 1;
    } catch (error) {
      console.error(`Calendar load failed for ${calendar.name}:`, error);
    }
  }));

  all.sort((a,b) => a.start - b.start);
  return { events:all, status: successes === links.length ? "Calendars synced" : `${successes}/${links.length} calendars synced` };
}

function formatTime(event) {
  if (event.allDay) return "All day";
  return event.start.toLocaleTimeString("en-GB", { hour:"numeric", minute:event.start.getMinutes() ? "2-digit" : undefined, hour12:true }).replace(" ", "");
}

function renderWeek(events, status) {
  const list = document.querySelector(".week-card .week-list");
  if (!list) return;
  const weekStart = startOfWeek();
  list.innerHTML = "";

  for (let offset = 0; offset < 7; offset++) {
    const day = new Date(weekStart); day.setDate(day.getDate() + offset);
    const dayEvents = events.filter((event) => sameDay(event.start, day));
    const primary = dayEvents[0];
    const row = document.createElement("div");
    row.className = "week-row";
    row.innerHTML = `
      <div class="week-day"><em>${WEEKDAYS[day.getDay()]}</em><small>${day.getDate()}</small></div>
      <div class="week-title">${escapeHtml(primary?.title || "")}</div>
      <div>${primary ? `<span class="week-badge">${escapeHtml(primary.calendarName || "Calendar")}</span>` : ""}</div>
      <strong>${primary ? escapeHtml(formatTime(primary)) : ""}</strong>
    `;
    if (dayEvents.length > 1) row.title = dayEvents.map((e) => `${e.title} · ${formatTime(e)}`).join("\n");
    list.appendChild(row);
  }
  const header = document.querySelector(".week-card header");
  if (header) header.title = status;
}

async function refreshCalendar() {
  const data = await fetchCalendarEvents();
  renderWeek(data.events, data.status);
  return data;
}

async function refreshCcData() {
  try {
    const response = await fetch(`${CC_API_BASE}/api/homebase-summary`, { cache:"no-store" });
    if (!response.ok) throw new Error(`CC summary ${response.status}`);
    const data = await response.json();
    renderCcCard(".loa-card", data.loas || [], "loa");
    renderCcCard(".warnings-card", data.warnings || [], "warning");
  } catch (error) {
    console.error("Homebase CC summary failed:", error);
    setCcUnavailable(".loa-card", "CC data unavailable");
    setCcUnavailable(".warnings-card", "CC data unavailable");
  }
}

function renderCcCard(selector, items, type) {
  const card = document.querySelector(selector);
  if (!card) return;
  const list = card.querySelector(".cc-list");
  const footer = card.querySelector(".cc-footer");
  if (!list) return;
  if (!items.length) {
    list.innerHTML = `<div class="empty-state">${type === "loa" ? "No active LOAs" : "No creators currently have 2+ warnings"}</div>`;
  } else {
    list.innerHTML = items.map((item) => type === "loa" ? `
      <div class="cc-row"><span class="avatar-dot">${escapeHtml(item.name.slice(0,1).toUpperCase())}</span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.start)} → ${escapeHtml(item.end)}</small></div></div>
    ` : `
      <div class="cc-row warning"><span class="avatar-dot">${escapeHtml(item.name.slice(0,1).toUpperCase())}</span><div><strong>${escapeHtml(item.name)}</strong><small>${Number(item.count)} active warnings</small></div><span class="warning-dot"></span></div>
    `).join("");
  }
  if (footer && type === "loa") footer.textContent = `${items.length} creator${items.length === 1 ? "" : "s"} on LOA · Live from CC Bot`;
}

function setCcUnavailable(selector, message) {
  const card = document.querySelector(selector);
  if (!card) return;
  const footer = card.querySelector(".cc-footer");
  if (footer && selector.includes("loa")) footer.textContent = `0 creators on LOA · ${message}`;
}

function taskRows() {
  return [...document.querySelectorAll(".todo-card .task-row")];
}

function applyPriorityVisuals() {
  const tasks = readJson(TASK_KEY, []);
  const byText = new Map(tasks.map((task) => [String(task.text), task]));
  taskRows().forEach((row) => {
    const text = row.querySelector(".task-text")?.textContent || "";
    const button = row.querySelector(".star");
    if (!button) return;
    const active = Boolean(byText.get(text)?.priority);
    button.classList.toggle("priority-active", active);
    button.title = active ? "Remove priority" : "Mark as priority";
    button.setAttribute("aria-label", button.title);
  });
}

function togglePriorityFromRow(row) {
  const text = row.querySelector(".task-text")?.textContent || "";
  const tasks = readJson(TASK_KEY, []);
  const index = tasks.findIndex((task) => String(task.text) === text);
  if (index < 0) return;
  const task = { ...tasks[index], priority: !tasks[index].priority };
  const rest = tasks.filter((_, i) => i !== index);
  const next = task.priority ? [task, ...rest] : [...rest, task];
  writeJson(TASK_KEY, next);

  const list = row.parentElement;
  if (list) task.priority ? list.prepend(row) : list.append(row);
  applyPriorityVisuals();
  setTimeout(() => window.location.reload(), 700);
}

function createOverlay(kind) {
  document.querySelector(".homebase-enhancement-overlay")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "homebase-enhancement-overlay";
  overlay.innerHTML = `<div class="enhancement-panel"><button class="enhancement-close" aria-label="Close">×</button><div class="enhancement-content"></div></div>`;
  overlay.querySelector(".enhancement-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  const content = overlay.querySelector(".enhancement-content");
  if (kind === "settings") renderCalendarSettings(content);
  if (kind === "planner") renderPlanner(content);
}

function renderCalendarSettings(container) {
  const links = getCalendarLinks();
  container.innerHTML = `
    <h1>Settings</h1>
    <p class="enhancement-subtitle">Google Calendars used by Week at a Glance</p>
    <div class="calendar-settings-list"></div>
    <button class="enhancement-primary add-calendar">+ Add calendar</button>
    <p class="enhancement-help">Use the Google Calendar public or secret iCal address. Your calendar links sync with Homebase through Firebase.</p>
  `;
  const list = container.querySelector(".calendar-settings-list");
  const draw = () => {
    const current = getCalendarLinks();
    list.innerHTML = current.map((item, index) => `
      <div class="calendar-setting-row" data-index="${index}">
        <input class="calendar-name" value="${escapeAttr(item.name)}" placeholder="Calendar name">
        <input class="calendar-url" value="${escapeAttr(item.url)}" placeholder="Google Calendar iCal URL">
        <button class="calendar-remove" title="Remove calendar">×</button>
      </div>
    `).join("");
    list.querySelectorAll(".calendar-setting-row").forEach((row) => {
      const index = Number(row.dataset.index);
      row.querySelector(".calendar-name").addEventListener("change", (e) => updateCalendar(index, "name", e.target.value));
      row.querySelector(".calendar-url").addEventListener("change", (e) => updateCalendar(index, "url", e.target.value));
      row.querySelector(".calendar-remove").addEventListener("click", () => { const arr=getCalendarLinks(); arr.splice(index,1); writeJson(CALENDAR_KEY,arr); draw(); refreshCalendar(); });
    });
  };
  function updateCalendar(index, field, value) { const arr=getCalendarLinks(); if(!arr[index])return; arr[index]={...arr[index],[field]:value.trim()}; writeJson(CALENDAR_KEY,arr); refreshCalendar(); }
  container.querySelector(".add-calendar").addEventListener("click", () => { const arr=getCalendarLinks(); arr.push({id:`calendar-${Date.now()}`,name:`Calendar ${arr.length+1}`,url:""}); writeJson(CALENDAR_KEY,arr); draw(); });
  draw();
}

async function renderPlanner(container) {
  container.innerHTML = `<h1>Planner</h1><p class="enhancement-subtitle">This week from your Google Calendars</p><div class="planner-events">Loading calendars…</div>`;
  const target = container.querySelector(".planner-events");
  const { events, status } = await fetchCalendarEvents();
  target.innerHTML = events.length ? events.map((event) => `
    <div class="planner-event"><div><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(event.calendarName || "Calendar")}</span></div><time>${event.start.toLocaleDateString("en-GB", {weekday:"short",day:"numeric",month:"short"})} · ${escapeHtml(formatTime(event))}</time></div>
  `).join("") : `<div class="empty-state">${escapeHtml(status)}. Add calendar links in Settings.</div>`;
}

function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char])); }
function escapeAttr(value) { return escapeHtml(value); }

// Capture clicks before React's current no-op/alert handlers.
document.addEventListener("click", (event) => {
  const star = event.target.closest?.(".todo-card .star");
  if (star) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const row = star.closest(".task-row");
    if (row) togglePriorityFromRow(row);
    return;
  }

  const nav = event.target.closest?.(".nav-item");
  const label = nav?.textContent?.trim();
  if (label === "Settings" || label === "Planner") {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    createOverlay(label === "Settings" ? "settings" : "planner");
  }
}, true);

const observer = new MutationObserver(() => applyPriorityVisuals());
observer.observe(document.documentElement, { childList:true, subtree:true });

window.addEventListener("DOMContentLoaded", () => {
  applyPriorityVisuals();
  refreshCalendar();
  refreshCcData();
});

setInterval(refreshCcData, 5 * 60 * 1000);
setInterval(refreshCalendar, 10 * 60 * 1000);
