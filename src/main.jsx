import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle, CalendarDays, Check, ClipboardList, Edit3, ExternalLink, FileText,
  GripVertical, Heart, Home, Lightbulb, Link, Music, Pause, Play, Plus, Save,
  Settings, SkipBack, SkipForward, Star, Trash2, X
} from "lucide-react";
import "./styles.css";
import "./react-rebuild.css";

const CC_API_BASE = "https://developing-wolverine-creatorcore-c7c5c977.koyeb.app";
const DEFAULT_TAGS = [
  { id: "cc", name: "CC" }, { id: "mod", name: "Mod" },
  { id: "ems", name: "EMS" }, { id: "personal", name: "Personal" }
];
const DEFAULT_TASKS = [
  { id: 1, text: "Review CC applications", done: false, tagId: "cc", priority: false },
  { id: 2, text: "Monthly achievements update", done: false, tagId: "cc", priority: false },
  { id: 3, text: "Plan Creator Spotlight", done: true, tagId: "cc", priority: false },
  { id: 4, text: "Update discord announcements", done: true, tagId: "mod", priority: false },
  { id: 5, text: "Check LOA requests", done: false, tagId: "cc", priority: false },
  { id: 6, text: "Prepare monthly tickets", done: false, tagId: "cc", priority: false },
  { id: 7, text: "Dashboard & stats check", done: false, tagId: "personal", priority: false }
];
const DEFAULT_NOTES = [{ id: 1, title: "Homebase ideas", body: "Keep the dashboard calm, useful and easy to scan.\n\nAdd anything I want to remember here.", updatedAt: Date.now() }];
const DEFAULT_LINKS = [
  { id: 1, label: "Gmail", url: "https://mail.google.com" }, { id: 2, label: "Notion", url: "https://www.notion.so" },
  { id: 3, label: "Twitch", url: "https://www.twitch.tv" }, { id: 4, label: "Canva", url: "https://www.canva.com" },
  { id: 5, label: "Discord", url: "https://discord.com/app" }, { id: 6, label: "Google Drive", url: "https://drive.google.com" },
  { id: 7, label: "YouTube", url: "https://www.youtube.com" }, { id: 8, label: "ChatGPT", url: "https://chatgpt.com" }
];
const DEFAULT_BRAIN = ["New alert ideas", "Halloween event planning", "Update CC guide", "Karaoke night?", "More lo-fi overlays"];
const CAL_TYPES = {
  "event-team": { label: "Event Team", className: "cal-blue" },
  appointments: { label: "Appointments", className: "cal-green" },
  birthdays: { label: "Birthdays", className: "cal-purple" },
  other: { label: "Other", className: "cal-neutral" }
};
const NAV = [
  [Home, "Home", "home"], [FileText, "Notes", "notes"], [ClipboardList, "Tasks", "tasks"],
  [CalendarDays, "Planner", "planner"], [Link, "Links", "links"], [Music, "Music", "music"], [Settings, "Settings", "settings"]
];

function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) : initialValue; } catch { return initialValue; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }, [key, value]);
  useEffect(() => {
    const onStorage = (event) => { if (event.key === key && event.newValue) try { setValue(JSON.parse(event.newValue)); } catch {} };
    window.addEventListener("storage", onStorage); return () => window.removeEventListener("storage", onStorage);
  }, [key]);
  return [value, setValue];
}

function App() {
  const [page, setPage] = useState("home");
  const [now, setNow] = useState(new Date());
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [modal, setModal] = useState(null);
  const [tasks, setTasks] = usePersistentState("homebase.tasks", DEFAULT_TASKS);
  const [taskTags, setTaskTags] = usePersistentState("homebase.taskTags", DEFAULT_TAGS);
  const [notes, setNotes] = usePersistentState("homebase.notes", DEFAULT_NOTES);
  const [quickLinks, setQuickLinks] = usePersistentState("homebase.links", DEFAULT_LINKS);
  const [brainNotes, setBrainNotes] = usePersistentState("homebase.brain", DEFAULT_BRAIN);
  const [calendars, setCalendars] = usePersistentState("homebase.calendarLinks", []);
  const [spotifyConfig, setSpotifyConfig] = usePersistentState("homebase.spotifyConfig", { clientId: "" });
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarStatus, setCalendarStatus] = useState("No calendars configured");
  const [ccData, setCcData] = useState({ loas: [], warnings: [], status: "Loading…" });
  const [weather, setWeather] = useState({ temperature: null, condition: "Loading weather…", feelsLike: null, rain: null });
  const [spotifyPlayback, setSpotifyPlayback] = useState(null);
  const [spotifyStatus, setSpotifyStatus] = useState("Not connected");
  const [isPlaying, setIsPlaying] = useState(true);
  const [trackSeconds, setTrackSeconds] = useState(83);

  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { if (!isPlaying) return; const id = setInterval(() => setTrackSeconds((s) => (s + 1) % 166), 1000); return () => clearInterval(id); }, [isPlaying]);
  useEffect(() => { refreshCc(setCcData); const id = setInterval(() => refreshCc(setCcData), 300000); return () => clearInterval(id); }, []);
  useEffect(() => { refreshWeather(setWeather); const id = setInterval(() => refreshWeather(setWeather), 900000); return () => clearInterval(id); }, []);
  useEffect(() => {
    let cancelled = false;
    loadCalendarEvents(calendars).then(({ events, status }) => { if (!cancelled) { setCalendarEvents(events); setCalendarStatus(status); } });
    return () => { cancelled = true; };
  }, [calendars]);
  useEffect(() => {
    handleSpotifyCallback(spotifyConfig.clientId, setSpotifyStatus).then((handled) => { if (handled) window.history.replaceState({}, "", spotifyRedirectUri()); });
  }, [spotifyConfig.clientId]);
  useEffect(() => {
    let stopped = false;
    async function updatePlayback() {
      const token = await getSpotifyAccessToken(spotifyConfig.clientId);
      if (!token) { if (!stopped) setSpotifyStatus(spotifyConfig.clientId ? "Ready to connect" : "Add your Spotify Client ID"); return; }
      try {
        const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 204) { if (!stopped) { setSpotifyPlayback(null); setSpotifyStatus("Connected · nothing playing"); } return; }
        if (!res.ok) throw new Error(`Spotify ${res.status}`);
        const data = await res.json(); if (!stopped) { setSpotifyPlayback(data); setSpotifyStatus("Connected"); }
      } catch { if (!stopped) setSpotifyStatus("Spotify connection needs attention"); }
    }
    updatePlayback(); const id = setInterval(updatePlayback, 10000); return () => { stopped = true; clearInterval(id); };
  }, [spotifyConfig.clientId, page]);

  const sortedTasks = useMemo(() => tasks.map((t) => ({ priority: false, ...t })).sort((a, b) => Number(b.priority) - Number(a.priority)), [tasks]);
  const weekEvents = useMemo(() => calendarEvents.filter((e) => isThisWeek(e.start)).slice(0, 8), [calendarEvents]);
  const birthdays = useMemo(() => calendarEvents.filter((e) => e.calendar.type === "birthdays" && e.start >= startToday()).slice(0, 5), [calendarEvents]);

  const openTaskModal = (task = null) => setModal({ type: "task", task });
  const openTagModal = (tag = null) => setModal({ type: "tag", tag });
  const openLinkModal = (link = null) => setModal({ type: "link", link });
  const openCalendarModal = (calendar = null) => setModal({ type: "calendar", calendar });
  const confirmDelete = (title, text, onConfirm) => setModal({ type: "confirm", title, text, onConfirm });

  function togglePriority(id) {
    setTasks((current) => current.map((t) => t.id === id ? { ...t, priority: !t.priority } : t));
  }
  function dropTask(targetId) {
    if (draggedTaskId == null || draggedTaskId === targetId) return;
    setTasks((current) => {
      const ordered = current.map((t) => ({ priority: false, ...t })).sort((a, b) => Number(b.priority) - Number(a.priority));
      const from = ordered.findIndex((t) => t.id === draggedTaskId), to = ordered.findIndex((t) => t.id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...ordered]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); return next;
    });
    setDraggedTaskId(null);
  }

  const common = { modal, setModal, tasks, setTasks, taskTags, setTaskTags, quickLinks, setQuickLinks, calendars, setCalendars, openTaskModal, openTagModal, openLinkModal, openCalendarModal, confirmDelete };
  return <main className="shell">
    <Sidebar page={page} onNavigate={setPage}/>
    <section className="page-shell">
      {page === "home" && <HomePage {...{ now, sortedTasks, setTasks, draggedTaskId, setDraggedTaskId, dropTask, togglePriority, openTaskModal, brainNotes, setBrainNotes, setModal, quickLinks, weekEvents, birthdays, calendarStatus, ccData, weather, spotifyPlayback, isPlaying, setIsPlaying, trackSeconds, setTrackSeconds }}/>} 
      {page === "notes" && <NotesPage notes={notes} setNotes={setNotes} confirmDelete={confirmDelete}/>} 
      {page === "tasks" && <TasksPage {...common}/>} 
      {page === "planner" && <PlannerPage events={calendarEvents} status={calendarStatus}/>} 
      {page === "links" && <LinksPage {...common}/>} 
      {page === "music" && <MusicPage config={spotifyConfig} setConfig={setSpotifyConfig} playback={spotifyPlayback} status={spotifyStatus} setModal={setModal}/>} 
      {page === "settings" && <SettingsPage calendars={calendars} openCalendarModal={openCalendarModal}/>} 
    </section>
    {modal && <ModalHost {...common} brainNotes={brainNotes} setBrainNotes={setBrainNotes}/>} 
  </main>;
}

function Sidebar({ page, onNavigate }) {
  return <aside className="sidebar"><nav>{NAV.map(([Icon, label, target]) => <button key={label} className={page === target ? "nav-item active" : "nav-item"} onClick={() => { onNavigate(target); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Icon size={24}/><span>{label}</span></button>)}</nav></aside>;
}
function PageHeader({ icon: Icon, title, subtitle, action }) {
  return <header className="subpage-header"><div><span className="subpage-icon"><Icon size={24}/></span><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div></div>{action}</header>;
}

function HomePage({ now, sortedTasks, setTasks, draggedTaskId, setDraggedTaskId, dropTask, togglePriority, openTaskModal, brainNotes, setBrainNotes, setModal, quickLinks, weekEvents, birthdays, calendarStatus, ccData, weather, spotifyPlayback, isPlaying, setIsPlaying, trackSeconds, setTrackSeconds }) {
  const spotifyItem = spotifyPlayback?.item;
  const spotifyDuration = Math.max(1, Math.round((spotifyItem?.duration_ms || 165000) / 1000));
  const spotifySeconds = spotifyPlayback ? Math.round((spotifyPlayback.progress_ms || 0) / 1000) : trackSeconds;
  const progress = Math.min(100, (spotifySeconds / spotifyDuration) * 100);
  const dayName = now.toLocaleDateString("en-GB", { weekday: "long" });
  const dateLabel = now.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const timeLabel = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return <section className="dashboard-grid">
    <section className="panel clock-card"><div className="day-script">{dayName} <Heart size={24}/></div><div className="big-time">{timeLabel}</div><div className="date-label">{dateLabel}</div><div className="divider"/><div className="weather-line"><span className="weather-emoji">{weatherEmoji(weather.condition)}</span><div><strong>{weather.temperature == null ? "—" : `${weather.temperature}°C`}</strong><span>{weather.condition}</span><small>Reading, UK · Met Office</small></div></div><div className="weather-meta">{weather.feelsLike != null ? `Feels like ${weather.feelsLike}°C` : ""}{weather.rain ? ` · Rain ${weather.rain}` : ""}</div></section>
    <section className="panel todo-card"><header><div><ClipboardList/><h2>TO DO</h2></div><button onClick={() => openTaskModal()}><Plus size={18}/> Add Task</button></header><div className="task-list">{sortedTasks.map((task) => <div key={task.id} className={`${task.done ? "task-row done" : "task-row"}${task.priority ? " priority" : ""}`} draggable onDragStart={() => setDraggedTaskId(task.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => dropTask(task.id)} onDragEnd={() => setDraggedTaskId(null)}><GripVertical className="grip" size={17}/><button className="check" onClick={() => setTasks((c) => c.map((t) => t.id === task.id ? { ...t, done: !t.done } : t))}>{task.done && <Check size={14}/>}</button><button className="task-text" onClick={() => openTaskModal(task)}>{task.text}</button><button className={`star${task.priority ? " active" : ""}`} title={task.priority ? "Remove priority" : "Mark as priority"} onClick={() => togglePriority(task.id)}><Star size={18}/></button></div>)}</div><div className="todo-decor"><span>small<br/>steps,<br/>big impact<br/>♡</span></div></section>
    <section className="panel week-card"><header><div><CalendarDays/><h2>WEEK AT A GLANCE</h2></div></header><div className="week-events">{weekEvents.length ? weekEvents.map((event) => <div className={`week-event ${CAL_TYPES[event.calendar.type]?.className || "cal-neutral"}`} key={event.uid}><span>{event.title}</span><strong>{formatEventTime(event)}</strong></div>) : <div className="empty-state">{calendarStatus === "No calendars configured" ? "Add calendars in Settings" : "Nothing in your calendars this week"}</div>}</div></section>
    <section className="panel birthdays-card"><header><div><span className="cake">♨</span><h2>UPCOMING BIRTHDAYS</h2></div></header><div className="people-list">{birthdays.length ? birthdays.map((b) => <div className="person-row" key={b.uid}><span className="avatar-dot">{b.title.slice(0,1).toUpperCase()}</span><strong>{b.title}</strong><span>{b.start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span></div>) : <div className="empty-state">Add a Birthday calendar in Settings</div>}</div><div className="celebrate">✦ &nbsp; Celebrate them! 🎉 &nbsp; ✦</div></section>
    <section className="panel cc-card loa-card"><header><div><span>🌴</span><h2>CURRENT CC LOA'S</h2></div></header><div className="cc-list">{ccData.loas.length ? ccData.loas.map((item) => <div className="cc-row" key={`${item.name}-${item.end}`}><span className="avatar-dot">{item.name.slice(0,1).toUpperCase()}</span><div><strong>{item.name}</strong><small>{item.start} → {item.end}</small></div></div>) : <div className="empty-state">No active LOAs</div>}</div><div className="cc-footer">{ccData.loas.length} creator{ccData.loas.length === 1 ? "" : "s"} on LOA · {ccData.status}</div></section>
    <section className="panel cc-card warnings-card"><header><div><AlertTriangle/><h2>CC'S WITH 2+ ACTIVE WARNINGS</h2></div></header><div className="cc-list">{ccData.warnings.length ? ccData.warnings.map((item) => <div className="cc-row warning" key={item.name}><span className="avatar-dot">{item.name.slice(0,1).toUpperCase()}</span><div><strong>{item.name}</strong><small>{item.count} active warnings</small></div><span className="warning-dot"/></div>) : <div className="empty-state">No creators currently have 2+ warnings</div>}</div><div className="cc-footer">◉ &nbsp; Keep an eye out</div></section>
    <button className="panel brain-card" onClick={() => setModal({ type: "brain" })}><header><div><FileText/><h2>BRAIN DUMP</h2></div></header><div className="sticky-note real-sticky"><ul>{brainNotes.map((note, i) => <li key={`${note}-${i}`}>{note}</li>)}</ul><Lightbulb size={42}/></div></button>
    <section className="panel music-card"><header><div><Music/><h2>NOW PLAYING</h2></div></header><div className="music-main">{spotifyItem?.album?.images?.[0]?.url ? <img className="album-image" src={spotifyItem.album.images[0].url} alt=""/> : <div className="album-art"><span className="sun"/><span className="window"/><span className="desk"/><span className="plant"/></div>}<div className="song-info"><strong>{spotifyItem?.name || "Nothing playing"}</strong><span>{spotifyItem?.artists?.map((a) => a.name).join(", ") || "Connect Spotify from Music"}</span><Heart/></div></div><div className="progress"><span style={{ width: `${progress}%` }}/></div><div className="timecodes"><span>{formatSeconds(spotifySeconds)}</span><span>{formatSeconds(spotifyDuration)}</span></div><div className="controls"><span>⤨</span><button onClick={() => setTrackSeconds((s) => Math.max(0, s - 15))}><SkipBack/></button><button className="play" onClick={() => setIsPlaying((v) => !v)}>{isPlaying ? <Pause/> : <Play/>}</button><button onClick={() => setTrackSeconds((s) => Math.min(spotifyDuration, s + 15))}><SkipForward/></button><span>↔</span></div></section>
    <section className="panel home-links-card"><header><div><Link/><h2>QUICK LINKS</h2></div></header><div className="home-links-grid">{quickLinks.slice(0,8).map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer"><SiteIcon url={item.url}/><span>{item.label}</span></a>)}</div></section>
  </section>;
}

function NotesPage({ notes, setNotes, confirmDelete }) {
  const [selected, setSelected] = useState(notes[0]?.id || null);
  const current = notes.find((n) => n.id === selected) || null;
  function addNote() { const note = { id: Date.now(), title: "Untitled note", body: "", updatedAt: Date.now() }; setNotes((c) => [note, ...c]); setSelected(note.id); }
  function update(field, value) { setNotes((c) => c.map((n) => n.id === selected ? { ...n, [field]: value, updatedAt: Date.now() } : n)); }
  return <div className="subpage notebook-page"><PageHeader icon={FileText} title="Notes" subtitle="Your notebook" action={<button className="primary-btn" onClick={addNote}><Plus size={17}/> New note</button>}/><div className="notebook-layout"><aside className="note-index">{notes.map((n) => <button key={n.id} className={selected === n.id ? "note-tab active" : "note-tab"} onClick={() => setSelected(n.id)}><strong>{n.title || "Untitled"}</strong><small>{new Date(n.updatedAt || Date.now()).toLocaleDateString("en-GB")}</small></button>)}</aside><section className="paper-sheet">{current ? <><div className="paper-tools"><span>Notebook</span><button onClick={() => confirmDelete("Delete note?", "This note will be removed.", () => { setNotes((c) => c.filter((n) => n.id !== current.id)); setSelected(notes.find((n) => n.id !== current.id)?.id || null); })}><Trash2 size={17}/></button></div><input className="note-title-input" value={current.title} onChange={(e) => update("title", e.target.value)} placeholder="Note title"/><textarea className="note-body-input" value={current.body} onChange={(e) => update("body", e.target.value)} placeholder="Write anything…"/></> : <div className="empty-page">Create a note to start writing.</div>}</section></div></div>;
}

function TasksPage({ tasks, setTasks, taskTags, openTaskModal, openTagModal, confirmDelete }) {
  return <div className="subpage"><PageHeader icon={ClipboardList} title="Tasks & Tags" subtitle="Manage the tags used by your Home to-do list" action={<button className="primary-btn" onClick={() => openTaskModal()}><Plus size={17}/> Add task</button>}/><div className="management-grid"><section className="manage-panel"><div className="manage-title"><h2>Tags</h2><button onClick={() => openTagModal()}><Plus size={16}/> Add tag</button></div><div className="tag-manager">{taskTags.map((tag) => <div className="tag-manage-row" key={tag.id}><span className={`task-tag tag-${tag.id}`}>{tag.name}</span><div><button onClick={() => openTagModal(tag)}><Edit3 size={16}/></button><button onClick={() => confirmDelete("Delete tag?", `Remove ${tag.name}? Tasks using it will become untagged.`, () => { setTasks((c) => c.map((t) => t.tagId === tag.id ? { ...t, tagId: "" } : t)); localStorage.setItem("homebase.taskTags", JSON.stringify(taskTags.filter((t) => t.id !== tag.id))); window.dispatchEvent(new StorageEvent("storage", { key: "homebase.taskTags", newValue: JSON.stringify(taskTags.filter((t) => t.id !== tag.id)) })); })}><Trash2 size={16}/></button></div></div>)}</div></section><section className="manage-panel"><div className="manage-title"><h2>To-do items</h2><span>{tasks.length} tasks</span></div><div className="manage-task-list">{tasks.map((task) => { const tag = taskTags.find((t) => t.id === task.tagId); return <div className="manage-task-row" key={task.id}><button className="check" onClick={() => setTasks((c) => c.map((t) => t.id === task.id ? { ...t, done: !t.done } : t))}>{task.done && <Check size={14}/>}</button><button className={task.done ? "done-text" : ""} onClick={() => openTaskModal(task)}>{task.text}</button>{task.priority && <Star size={15} className="mini-priority"/>}{tag && <span className={`task-tag tag-${tag.id}`}>{tag.name}</span>}</div>; })}</div></section></div></div>;
}

function LinksPage({ quickLinks, openLinkModal }) {
  return <div className="subpage"><PageHeader icon={Link} title="Quick Links" subtitle="Your shortcuts, all in one place" action={<button className="primary-btn" onClick={() => openLinkModal()}><Plus size={17}/> Add link</button>}/><div className="links-grid">{quickLinks.map((item) => <article className="link-card" key={item.id}><button className="link-open" onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}><SiteIcon url={item.url}/><div><strong>{item.label}</strong><small>{safeHost(item.url)}</small></div><ExternalLink size={18}/></button><button className="link-edit" onClick={() => openLinkModal(item)}><Edit3 size={16}/> Edit</button></article>)}</div></div>;
}

function PlannerPage({ events, status }) {
  return <div className="subpage"><PageHeader icon={CalendarDays} title="Planner" subtitle={status}/><div className="planner-list">{events.filter((e) => e.start >= startToday()).slice(0,30).map((event) => <div className={`planner-row ${CAL_TYPES[event.calendar.type]?.className || "cal-neutral"}`} key={event.uid}><div><strong>{event.title}</strong><span>{event.calendar.name}</span></div><time>{event.start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · {formatEventTime(event)}</time></div>)}</div></div>;
}

function SettingsPage({ calendars, openCalendarModal }) {
  return <div className="subpage"><PageHeader icon={Settings} title="Settings" subtitle="Choose the exact Google calendars Homebase reads" action={<button className="primary-btn" onClick={() => openCalendarModal()}><Plus size={17}/> Add calendar</button>}/><section className="manage-panel settings-calendar-panel"><h2>Google Calendars</h2><p className="settings-help">Add each calendar separately using its Google Calendar iCal address, then choose how Homebase should colour it.</p><div className="settings-calendar-list">{calendars.length ? calendars.map((calendar) => <button key={calendar.id} className={`settings-calendar-row ${CAL_TYPES[calendar.type]?.className || "cal-neutral"}`} onClick={() => openCalendarModal(calendar)}><span className="calendar-dot"/><div><strong>{calendar.name}</strong><small>{CAL_TYPES[calendar.type]?.label || "Other"}</small></div><Edit3 size={16}/></button>) : <div className="empty-state">No calendars added yet.</div>}</div><div className="calendar-key"><span className="cal-blue">Event Team</span><span className="cal-green">Appointments</span><span className="cal-purple">Birthdays</span></div></section></div>;
}

function MusicPage({ config, setConfig, playback, status, setModal }) {
  const [draft, setDraft] = useState(config.clientId || ""); const item = playback?.item;
  async function connect() { if (!config.clientId) { setModal({ type: "message", title: "Spotify setup", text: "Save your Spotify Client ID first." }); return; } await startSpotifyLogin(config.clientId); }
  function disconnect() { clearSpotifyTokens(); setModal({ type: "message", title: "Spotify disconnected", text: "Spotify has been disconnected from this browser." }); }
  return <div className="subpage"><PageHeader icon={Music} title="Music" subtitle="Connect Spotify so Homebase can show what you're listening to"/><div className="spotify-grid"><section className="manage-panel spotify-setup"><h2>Spotify Developer setup</h2><p>Create a Spotify developer app, then paste its <strong>Client ID</strong> here. Do not add a Client Secret to Homebase.</p><label>Client ID<input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Your Spotify Client ID"/></label><label>Redirect URI<input readOnly value={spotifyRedirectUri()}/></label><small>Add that redirect URI exactly to your Spotify app's Redirect URIs.</small><div className="spotify-actions"><button className="primary-btn" onClick={() => setConfig({ clientId: draft.trim() })}><Save size={16}/> Save Client ID</button><button onClick={connect}>Connect Spotify</button><button onClick={disconnect}>Disconnect</button></div><div className="connection-status">{status}</div></section><section className="manage-panel now-playing-large"><h2>Currently playing</h2>{item ? <div className="spotify-track">{item.album?.images?.[0]?.url ? <img src={item.album.images[0].url} alt=""/> : <div className="spotify-art-placeholder"><Music/></div>}<div><strong>{item.name}</strong><span>{item.artists?.map((a) => a.name).join(", ")}</span><small>{playback.is_playing ? "Playing now" : "Paused"}</small></div></div> : <div className="empty-page">Nothing is playing on Spotify right now.</div>}</section></div></div>;
}

function ModalHost({ modal, setModal, tasks, setTasks, taskTags, setTaskTags, quickLinks, setQuickLinks, calendars, setCalendars, brainNotes, setBrainNotes }) {
  const close = () => setModal(null);
  if (modal.type === "confirm") return <Modal title={modal.title} onClose={close}><p className="modal-copy">{modal.text}</p><ModalActions onCancel={close} danger onConfirm={() => { modal.onConfirm?.(); close(); }} confirmText="Delete"/></Modal>;
  if (modal.type === "message") return <Modal title={modal.title} onClose={close}><p className="modal-copy">{modal.text}</p><ModalActions onCancel={close} onConfirm={close} confirmText="Okay" hideCancel/></Modal>;
  if (modal.type === "brain") return <BrainForm initial={brainNotes} onCancel={close} onSave={(value) => { setBrainNotes(value); close(); }}/>
  if (modal.type === "task") return <TaskForm task={modal.task} tags={taskTags} onCancel={close} onSave={(task) => { setTasks((c) => modal.task ? c.map((t) => t.id === modal.task.id ? { ...t, ...task } : t) : [...c, { id: Date.now(), done: false, priority: false, ...task }]); close(); }} onDelete={modal.task ? () => { setTasks((c) => c.filter((t) => t.id !== modal.task.id)); close(); } : null}/>;
  if (modal.type === "tag") return <TagForm tag={modal.tag} onCancel={close} onSave={(name) => { setTaskTags((c) => modal.tag ? c.map((t) => t.id === modal.tag.id ? { ...t, name } : t) : [...c, { id: `tag-${Date.now()}`, name }]); close(); }} onDelete={modal.tag ? () => { setTaskTags((c) => c.filter((t) => t.id !== modal.tag.id)); setTasks((c) => c.map((t) => t.tagId === modal.tag.id ? { ...t, tagId: "" } : t)); close(); } : null}/>;
  if (modal.type === "link") return <LinkForm link={modal.link} onCancel={close} onSave={(value) => { setQuickLinks((c) => modal.link ? c.map((x) => x.id === modal.link.id ? { ...x, ...value } : x) : [...c, { id: Date.now(), ...value }]); close(); }} onDelete={modal.link ? () => { setQuickLinks((c) => c.filter((x) => x.id !== modal.link.id)); close(); } : null}/>;
  if (modal.type === "calendar") return <CalendarForm calendar={modal.calendar} onCancel={close} onSave={(value) => { setCalendars((c) => modal.calendar ? c.map((x) => x.id === modal.calendar.id ? { ...x, ...value } : x) : [...c, { id: `cal-${Date.now()}`, ...value }]); close(); }} onDelete={modal.calendar ? () => { setCalendars((c) => c.filter((x) => x.id !== modal.calendar.id)); close(); } : null}/>;
  return null;
}
function Modal({ title, onClose, children }) { return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className="site-modal" role="dialog" aria-modal="true"><header><h2>{title}</h2><button onClick={onClose}><X size={20}/></button></header>{children}</div></div>; }
function ModalActions({ onCancel, onConfirm, confirmText = "Save", danger = false, hideCancel = false }) { return <div className="modal-actions">{!hideCancel && <button className="modal-secondary" onClick={onCancel}>Cancel</button>}<button className={danger ? "modal-danger" : "modal-primary"} onClick={onConfirm}>{confirmText}</button></div>; }
function TaskForm({ task, tags, onCancel, onSave, onDelete }) { const [text, setText] = useState(task?.text || ""); const [tagId, setTagId] = useState(task?.tagId || ""); return <Modal title={task ? "Edit task" : "Add task"} onClose={onCancel}><div className="modal-body"><label>Task<input value={text} onChange={(e) => setText(e.target.value)} autoFocus/></label><label>Tag<select value={tagId} onChange={(e) => setTagId(e.target.value)}><option value="">No tag</option>{tags.map((t) => <option value={t.id} key={t.id}>{t.name}</option>)}</select></label>{onDelete && <button className="inline-delete" onClick={onDelete}><Trash2 size={15}/> Delete task</button>}</div><ModalActions onCancel={onCancel} onConfirm={() => text.trim() && onSave({ text: text.trim(), tagId })} confirmText={task ? "Save changes" : "Add task"}/></Modal>; }
function TagForm({ tag, onCancel, onSave, onDelete }) { const [name, setName] = useState(tag?.name || ""); return <Modal title={tag ? "Edit tag" : "Add tag"} onClose={onCancel}><div className="modal-body"><label>Tag name<input value={name} onChange={(e) => setName(e.target.value)} autoFocus/></label>{onDelete && <button className="inline-delete" onClick={onDelete}><Trash2 size={15}/> Delete tag</button>}</div><ModalActions onCancel={onCancel} onConfirm={() => name.trim() && onSave(name.trim())}/></Modal>; }
function LinkForm({ link, onCancel, onSave, onDelete }) { const [label, setLabel] = useState(link?.label || ""); const [url, setUrl] = useState(link?.url || "https://"); return <Modal title={link ? "Edit quick link" : "Add quick link"} onClose={onCancel}><div className="modal-body"><label>Name<input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus/></label><label>Website URL<input value={url} onChange={(e) => setUrl(e.target.value)}/></label>{onDelete && <button className="inline-delete" onClick={onDelete}><Trash2 size={15}/> Delete link</button>}</div><ModalActions onCancel={onCancel} onConfirm={() => { let clean = url.trim(); if (!/^https?:\/\//i.test(clean)) clean = `https://${clean}`; if (label.trim() && clean) onSave({ label: label.trim(), url: clean }); }}/></Modal>; }
function BrainForm({ initial, onCancel, onSave }) { const [value, setValue] = useState(initial.join("\n")); return <Modal title="Edit brain dump" onClose={onCancel}><div className="modal-body"><label>One thought per line<textarea rows="9" value={value} onChange={(e) => setValue(e.target.value)} autoFocus/></label></div><ModalActions onCancel={onCancel} onConfirm={() => onSave(value.split("\n").map((v) => v.trim()).filter(Boolean))}/></Modal>; }
function CalendarForm({ calendar, onCancel, onSave, onDelete }) { const [name, setName] = useState(calendar?.name || ""); const [type, setType] = useState(calendar?.type || "other"); const [url, setUrl] = useState(calendar?.url || ""); return <Modal title={calendar ? "Edit calendar" : "Add calendar"} onClose={onCancel}><div className="modal-body"><label>Calendar name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Appointments" autoFocus/></label><label>Calendar type<select value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(CAL_TYPES).map(([key, meta]) => <option value={key} key={key}>{meta.label}</option>)}</select></label><label>Google Calendar iCal URL<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/..."/></label><small>Use that specific calendar's public or secret iCal address from Google Calendar settings.</small>{onDelete && <button className="inline-delete" onClick={onDelete}><Trash2 size={15}/> Remove calendar</button>}</div><ModalActions onCancel={onCancel} onConfirm={() => name.trim() && url.trim() && onSave({ name: name.trim(), type, url: url.trim() })}/></Modal>; }

function SiteIcon({ url }) { const [failed, setFailed] = useState(false); const host = safeHost(url); return <span className="site-icon">{!failed && host ? <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`} alt="" onError={() => setFailed(true)}/> : <ExternalLink size={22}/>}</span>; }
function safeHost(url) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } }
function formatSeconds(value) { const m = Math.floor(value / 60); const s = String(Math.max(0, value % 60)).padStart(2, "0"); return `${m}:${s}`; }
function startToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }
function startOfWeek(date = new Date()) { const d = new Date(date); d.setHours(0,0,0,0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
function isThisWeek(date) { const start = startOfWeek(); const end = new Date(start); end.setDate(end.getDate() + 7); return date >= start && date < end; }
function formatEventTime(event) { return event.allDay ? "All day" : event.start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); }
function weatherEmoji(condition = "") { const c = condition.toLowerCase(); if (/rain|shower|drizzle/.test(c)) return "🌧️"; if (/cloud|overcast/.test(c)) return "⛅"; if (/sun|clear/.test(c)) return "☀️"; if (/snow|sleet/.test(c)) return "🌨️"; if (/fog|mist/.test(c)) return "🌫️"; return "🌤️"; }

async function refreshCc(setCcData) { try { const res = await fetch(`${CC_API_BASE}/api/homebase-summary`, { cache: "no-store" }); if (!res.ok) throw new Error(); const data = await res.json(); setCcData({ loas: data.loas || [], warnings: data.warnings || [], status: "Live" }); } catch { setCcData({ loas: [], warnings: [], status: "CC data unavailable" }); } }
async function refreshWeather(setWeather) { try { const res = await fetch(`${CC_API_BASE}/api/homebase-weather`, { cache: "no-store" }); if (!res.ok) throw new Error(); const data = await res.json(); setWeather(data); } catch { setWeather({ temperature: null, condition: "Weather unavailable", feelsLike: null, rain: null }); } }

function parseGoogleCalendarUrl(raw) { const value = String(raw || "").trim(); try { const url = new URL(value); if (url.hostname === "calendar.google.com" && url.searchParams.get("cid") && !url.pathname.includes("/ical/")) { let id = url.searchParams.get("cid"); try { id = atob(id.replace(/-/g, "+").replace(/_/g, "/")); } catch {} return `https://calendar.google.com/calendar/ical/${encodeURIComponent(id)}/public/basic.ics`; } } catch {} return value; }
function unfoldIcs(text) { return String(text || "").replace(/\r?\n[ \t]/g, ""); }
function parseIcsDate(value) { const v = String(value || "").trim(); if (/^\d{8}$/.test(v)) return new Date(+v.slice(0,4), +v.slice(4,6)-1, +v.slice(6,8)); const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/); if (!m) return null; return m[7] ? new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0))) : new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0)); }
function parseIcs(text, calendar) { return unfoldIcs(text).split("BEGIN:VEVENT").slice(1).map((block, index) => { block = block.split("END:VEVENT")[0] || block; const event = { calendar, uid: `${calendar.id}-${index}` }; for (const line of block.split(/\r?\n/)) { const colon = line.indexOf(":"); if (colon < 0) continue; const lhs = line.slice(0, colon), value = line.slice(colon + 1), key = lhs.split(";")[0]; if (key === "UID") event.uid = `${calendar.id}-${value}`; if (key === "SUMMARY") event.title = value.replace(/\\,/g, ",").replace(/\\n/g, " ").replace(/\\;/g, ";"); if (key === "DTSTART") { event.start = parseIcsDate(value); event.allDay = /^\d{8}$/.test(value); } if (key === "RRULE") event.rrule = value; } return event; }).filter((e) => e.start && e.title); }
function recurrenceParts(rule = "") { return Object.fromEntries(rule.split(";").map((part) => part.split("=",2))); }
function expandEvent(event, from, to) { if (!event.rrule) return event.start >= from && event.start < to ? [event] : []; const parts = recurrenceParts(event.rrule), out = []; if (parts.FREQ === "YEARLY") { for (let year = from.getFullYear() - 1; year <= to.getFullYear() + 1; year++) { const d = new Date(year, event.start.getMonth(), event.start.getDate(), event.start.getHours(), event.start.getMinutes()); if (d >= from && d < to) out.push({ ...event, uid: `${event.uid}-${year}`, start: d }); } return out; } if (parts.FREQ === "WEEKLY") { const days = { SU:0, MO:1, TU:2, WE:3, TH:4, FR:5, SA:6 }; const by = (parts.BYDAY || Object.keys(days).find((k) => days[k] === event.start.getDay()) || "").split(","); const interval = Number(parts.INTERVAL || 1); for (let d = new Date(from); d < to; d.setDate(d.getDate() + 1)) { if (!by.some((key) => days[key] === d.getDay())) continue; const occ = new Date(d); occ.setHours(event.start.getHours(), event.start.getMinutes(), 0, 0); if (occ < event.start) continue; const weeks = Math.floor((startOfWeek(occ) - startOfWeek(event.start)) / 604800000); if (weeks % interval) continue; out.push({ ...event, uid: `${event.uid}-${occ.toISOString()}`, start: occ }); } return out; } return event.start >= from && event.start < to ? [event] : []; }
async function loadCalendarEvents(calendars) { if (!calendars.length) return { events: [], status: "No calendars configured" }; const from = startOfWeek(), to = new Date(); to.setFullYear(to.getFullYear() + 1); const all = []; let successes = 0; await Promise.all(calendars.map(async (calendar) => { try { const res = await fetch(`${CC_API_BASE}/api/homebase-calendar?url=${encodeURIComponent(parseGoogleCalendarUrl(calendar.url))}`, { cache: "no-store" }); if (!res.ok) throw new Error(); const text = await res.text(); parseIcs(text, calendar).forEach((event) => all.push(...expandEvent(event, from, to))); successes++; } catch {} })); all.sort((a,b) => a.start - b.start); return { events: all, status: successes === calendars.length ? "Calendars synced" : `${successes}/${calendars.length} calendars synced` }; }

function spotifyRedirectUri() { return `${window.location.origin}${window.location.pathname}`; }
function base64UrlEncode(bytes) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""); }
async function sha256(text) { return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))); }
function randomVerifier() { const bytes = new Uint8Array(64); crypto.getRandomValues(bytes); return base64UrlEncode(bytes); }
async function startSpotifyLogin(clientId) { const verifier = randomVerifier(), challenge = base64UrlEncode(await sha256(verifier)), state = crypto.randomUUID(); sessionStorage.setItem("spotify.pkce.verifier", verifier); sessionStorage.setItem("spotify.pkce.state", state); const params = new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: spotifyRedirectUri(), scope: "user-read-currently-playing user-read-playback-state", code_challenge_method: "S256", code_challenge: challenge, state }); window.location.href = `https://accounts.spotify.com/authorize?${params}`; }
async function handleSpotifyCallback(clientId, setStatus) { const params = new URLSearchParams(window.location.search), code = params.get("code"); if (!code) return false; const expected = sessionStorage.getItem("spotify.pkce.state"), returned = params.get("state"); if (expected && returned !== expected) { setStatus("Spotify sign-in rejected: state mismatch"); return true; } const verifier = sessionStorage.getItem("spotify.pkce.verifier"); if (!clientId || !verifier) { setStatus("Spotify setup is missing the Client ID or PKCE verifier"); return true; } const body = new URLSearchParams({ client_id: clientId, grant_type: "authorization_code", code, redirect_uri: spotifyRedirectUri(), code_verifier: verifier }); const res = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }); if (!res.ok) { setStatus("Spotify authorization failed"); return true; } const data = await res.json(); localStorage.setItem("spotify.accessToken", data.access_token); localStorage.setItem("spotify.refreshToken", data.refresh_token || ""); localStorage.setItem("spotify.expiresAt", String(Date.now() + data.expires_in * 1000)); sessionStorage.removeItem("spotify.pkce.verifier"); sessionStorage.removeItem("spotify.pkce.state"); setStatus("Spotify connected"); return true; }
async function getSpotifyAccessToken(clientId) { const token = localStorage.getItem("spotify.accessToken"), expires = Number(localStorage.getItem("spotify.expiresAt") || 0); if (token && Date.now() < expires - 60000) return token; const refresh = localStorage.getItem("spotify.refreshToken"); if (!refresh || !clientId) return null; const body = new URLSearchParams({ client_id: clientId, grant_type: "refresh_token", refresh_token: refresh }); const res = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }); if (!res.ok) return null; const data = await res.json(); localStorage.setItem("spotify.accessToken", data.access_token); if (data.refresh_token) localStorage.setItem("spotify.refreshToken", data.refresh_token); localStorage.setItem("spotify.expiresAt", String(Date.now() + data.expires_in * 1000)); return data.access_token; }
function clearSpotifyTokens() { ["spotify.accessToken", "spotify.refreshToken", "spotify.expiresAt"].forEach((key) => localStorage.removeItem(key)); }

createRoot(document.getElementById("root")).render(<App/>);
