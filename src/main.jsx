import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ClipboardList,
  CloudSun,
  FileText,
  GripVertical,
  Heart,
  Home,
  Lightbulb,
  Link,
  Music,
  Pause,
  Play,
  Plus,
  Settings,
  SkipBack,
  SkipForward,
  Sparkles,
  Star,
  X
} from "lucide-react";
import "./styles.css";

const DEFAULT_TASKS = [
  { id: 1, text: "Review CC applications", done: false },
  { id: 2, text: "Monthly achievements update", done: false },
  { id: 3, text: "Plan Creator Spotlight", done: true },
  { id: 4, text: "Update discord announcements", done: true },
  { id: 5, text: "Check LOA requests", done: false },
  { id: 6, text: "Prepare monthly tickets", done: false },
  { id: 7, text: "Dashboard & stats check", done: false }
];

const DEFAULT_BIRTHDAYS = [
  { id: 1, name: "LioraArcher", date: "12 Aug" },
  { id: 2, name: "Sage_Nights", date: "16 Aug" },
  { id: 3, name: "RowanTheWise", date: "21 Aug" },
  { id: 4, name: "KaiOnDuty", date: "28 Aug" }
];

const DEFAULT_BRAIN = [
  "New alert ideas",
  "Halloween event planning",
  "Update CC guide",
  "Karaoke night?",
  "More lo-fi overlays"
];

const NAV = [
  [Home, "Home", "top"],
  [FileText, "Notes", "brain"],
  [ClipboardList, "Tasks", "tasks"],
  [CalendarDays, "Planner", "week"],
  [Link, "Links", "links"],
  [Music, "Music", "music"],
  [Settings, "Settings", "settings"]
];

function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);
  return [value, setValue];
}

function parseDMY(value) {
  const [d, m, y] = String(value || "").split("/").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d, 23, 59, 59);
}

function App() {
  const [now, setNow] = useState(new Date());
  const [activeNav, setActiveNav] = useState("Home");
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [tasks, setTasks] = usePersistentState("homebase.tasks", DEFAULT_TASKS);
  const [birthdays, setBirthdays] = usePersistentState("homebase.birthdays", DEFAULT_BIRTHDAYS);
  const [brainNotes, setBrainNotes] = usePersistentState("homebase.brain", DEFAULT_BRAIN);
  const [isPlaying, setIsPlaying] = useState(true);
  const [trackSeconds, setTrackSeconds] = useState(83);
  const [ccData, setCcData] = useState({ loas: [], warnings: [], status: "Loading CC data…" });
  const refs = useRef({});

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => setTrackSeconds((s) => (s + 1) % 166), 1000);
    return () => clearInterval(timer);
  }, [isPlaying]);

  useEffect(() => {
    let cancelled = false;
    async function loadCcData() {
      try {
        const [loaRes, ccRes] = await Promise.all([
          fetch("https://developing-wolverine-creatorcore-c7c5c977.koyeb.app/api/loas"),
          fetch("https://developing-wolverine-creatorcore-c7c5c977.koyeb.app/api/ccs")
        ]);
        if (!loaRes.ok || !ccRes.ok) throw new Error("CC API unavailable");
        const [loaJson, ccJson] = await Promise.all([loaRes.json(), ccRes.json()]);
        const today = new Date();
        today.setHours(0,0,0,0);
        const loas = Object.entries(loaJson || {}).map(([name, item]) => ({
          name,
          start: item.start,
          end: item.end,
          reason: item.reason || ""
        })).filter((item) => {
          const end = parseDMY(item.end);
          return end && end >= today;
        });
        const warnings = Object.values(ccJson || {}).filter((item) => Number(item.warnings || 0) >= 2).map((item) => ({
          name: item.discord_name || item.name || "Unknown creator",
          count: Number(item.warnings || 0)
        }));
        if (!cancelled) setCcData({ loas, warnings, status: "Live from CC Bot" });
      } catch (error) {
        console.error(error);
        if (!cancelled) setCcData({ loas: [], warnings: [], status: "CC data unavailable" });
      }
    }
    loadCcData();
    const timer = setInterval(loadCcData, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const dayName = now.toLocaleDateString("en-GB", { weekday: "long" });
  const dateLabel = now.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const timeLabel = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  const progress = Math.min(100, (trackSeconds / 165) * 100);

  function scrollTo(key, label) {
    setActiveNav(label);
    if (key === "settings") {
      alert("Homebase is synced through Firebase when you're signed in with Google.");
      return;
    }
    refs.current[key]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function addTask() {
    const text = prompt("Task name:");
    if (!text?.trim()) return;
    setTasks((current) => [...current, { id: Date.now(), text: text.trim(), done: false }]);
  }

  function editTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const text = prompt("Edit task (leave blank to delete):", task.text);
    if (text === null) return;
    if (!text.trim()) return setTasks((current) => current.filter((t) => t.id !== id));
    setTasks((current) => current.map((t) => t.id === id ? { ...t, text: text.trim() } : t));
  }

  function dropTask(targetId) {
    if (draggedTaskId == null || draggedTaskId === targetId) return;
    setTasks((current) => {
      const from = current.findIndex((t) => t.id === draggedTaskId);
      const to = current.findIndex((t) => t.id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDraggedTaskId(null);
  }

  function editBrainDump() {
    const value = prompt("Brain Dump — one note per line:", brainNotes.join("\n"));
    if (value === null) return;
    setBrainNotes(value.split("\n").map((v) => v.trim()).filter(Boolean));
  }

  function addBirthday() {
    const name = prompt("Name:");
    if (!name?.trim()) return;
    const date = prompt("Birthday:", "12 Aug") || "";
    setBirthdays((current) => [...current, { id: Date.now(), name: name.trim(), date: date.trim() }]);
  }

  function editBirthday(id) {
    const item = birthdays.find((b) => b.id === id);
    if (!item) return;
    const name = prompt("Name (leave blank to delete):", item.name);
    if (name === null) return;
    if (!name.trim()) return setBirthdays((current) => current.filter((b) => b.id !== id));
    const date = prompt("Birthday:", item.date) ?? item.date;
    setBirthdays((current) => current.map((b) => b.id === id ? { ...b, name: name.trim(), date: date.trim() } : b));
  }

  return (
    <main className="shell" ref={(node) => { refs.current.top = node; }}>
      <aside className="sidebar">
        <nav>
          {NAV.map(([Icon, label, target]) => (
            <button key={label} className={activeNav === label ? "nav-item active" : "nav-item"} onClick={() => scrollTo(target, label)}>
              <Icon size={24}/><span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="dashboard-grid">
        <section className="panel clock-card">
          <div className="day-script">{dayName} <Heart size={24}/></div>
          <div className="big-time">{timeLabel}<span>PM</span></div>
          <div className="date-label">{dateLabel}</div>
          <div className="divider"/>
          <div className="weather-line"><CloudSun size={72}/><div><strong>18°C</strong><span>Partly Cloudy</span></div></div>
          <div className="weather-meta">20°C / 14°C &nbsp; 💧 10%</div>
        </section>

        <section className="panel todo-card" ref={(node) => { refs.current.tasks = node; }}>
          <header><div><ClipboardList/> <h2>TO DO</h2></div><button onClick={addTask}><Plus size={18}/> Add Task</button></header>
          <div className="task-list">
            {tasks.map((task) => (
              <div key={task.id} className={task.done ? "task-row done" : "task-row"} draggable onDragStart={() => setDraggedTaskId(task.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => dropTask(task.id)} onDragEnd={() => setDraggedTaskId(null)}>
                <GripVertical className="grip" size={17}/>
                <button className="check" onClick={() => setTasks((current) => current.map((t) => t.id === task.id ? { ...t, done: !t.done } : t))}>{task.done && <Check size={14}/>}</button>
                <button className="task-text" onClick={() => editTask(task.id)}>{task.text}</button>
                <button className="star"><Star size={18}/></button>
              </div>
            ))}
          </div>
          <div className="todo-decor"><span>small<br/>steps,<br/>big impact<br/>♡</span></div>
        </section>

        <section className="panel week-card" ref={(node) => { refs.current.week = node; }}>
          <header><div><CalendarDays/><h2>WEEK AT A GLANCE</h2></div></header>
          <div className="week-list">
            {[
              ["Mon","11","Highlife RP","Medic Mondays","8PM"],
              ["Tue","12","Highlife RP","Trauma Tuesdays","8PM"],
              ["Wed","13","Rest & Glow","","☾"],
              ["Thu","14","Chat's Choice","Witchy Thursdays","8PM"],
              ["Fri","15","Highlife RP","Frantic Fridays","8PM"],
              ["Sat","16","Rest & Glow","","☾"],
              ["Sun","17","Rest & Glow","","☾"]
            ].map(([day,date,title,badge,time]) => <div className="week-row" key={day}><div className="week-day"><em>{day}</em><small>{date}</small></div><div className="week-title">{title}</div><div>{badge && <span className="week-badge">{badge}</span>}</div><strong>{time}</strong></div>)}
          </div>
        </section>

        <section className="panel birthdays-card">
          <header><div><span className="cake">♨</span><h2>UPCOMING BIRTHDAYS</h2></div><button onClick={addBirthday}><Plus size={18}/></button></header>
          <div className="people-list">
            {birthdays.map((b) => <button className="person-row" key={b.id} onClick={() => editBirthday(b.id)}><span className="avatar-dot">{b.name.slice(0,1)}</span><strong>{b.name}</strong><span>{b.date}</span></button>)}
          </div>
          <div className="celebrate">✦ &nbsp; Celebrate them! 🎉 &nbsp; ✦</div>
        </section>

        <section className="panel cc-card loa-card">
          <header><div><span className="palm">🌴</span><h2>CURRENT CC LOA'S</h2></div></header>
          <div className="cc-list">
            {ccData.loas.length ? ccData.loas.map((item) => <div className="cc-row" key={`${item.name}-${item.end}`}><span className="avatar-dot">{item.name.slice(0,1).toUpperCase()}</span><div><strong>{item.name}</strong><small>{item.start} → {item.end}</small></div></div>) : <div className="empty-state">No active LOAs</div>}
          </div>
          <div className="cc-footer">{ccData.loas.length} creator{ccData.loas.length === 1 ? "" : "s"} on LOA · {ccData.status}</div>
        </section>

        <section className="panel cc-card warnings-card">
          <header><div><AlertTriangle/><h2>CC'S WITH 2 ACTIVE WARNINGS</h2></div></header>
          <div className="cc-list">
            {ccData.warnings.length ? ccData.warnings.map((item) => <div className="cc-row warning" key={item.name}><span className="avatar-dot">{item.name.slice(0,1).toUpperCase()}</span><div><strong>{item.name}</strong><small>{item.count} active warnings</small></div><span className="warning-dot"/></div>) : <div className="empty-state">No creators currently have 2+ warnings</div>}
          </div>
          <div className="cc-footer">◉ &nbsp; Keep an eye out</div>
        </section>

        <button className="panel brain-card" ref={(node) => { refs.current.brain = node; }} onClick={editBrainDump}>
          <header><div><FileText/><h2>BRAIN DUMP</h2></div></header>
          <div className="sticky-note">
            <ul>{brainNotes.map((note, i) => <li key={`${note}-${i}`}>{note}</li>)}</ul>
            <Lightbulb size={48}/>
          </div>
        </button>

        <section className="panel music-card" ref={(node) => { refs.current.music = node; }}>
          <header><div><Music/><h2>NOW PLAYING</h2></div></header>
          <div className="music-main">
            <div className="album-art"><span className="sun"/><span className="window"/><span className="desk"/><span className="plant"/></div>
            <div className="song-info"><strong>Sleepless Nights</strong><span>Lofi Girl</span><Heart/></div>
          </div>
          <button className="progress" onClick={(e) => { const r=e.currentTarget.getBoundingClientRect(); setTrackSeconds(Math.round(((e.clientX-r.left)/r.width)*165)); }}><span style={{width:`${progress}%`}}/></button>
          <div className="timecodes"><span>{formatSeconds(trackSeconds)}</span><span>02:45</span></div>
          <div className="controls"><span>⤨</span><button onClick={() => setTrackSeconds((s)=>Math.max(0,s-15))}><SkipBack/></button><button className="play" onClick={() => setIsPlaying((v)=>!v)}>{isPlaying ? <Pause/> : <Play/>}</button><button onClick={() => setTrackSeconds((s)=>Math.min(165,s+15))}><SkipForward/></button><span>↔</span></div>
        </section>

        <section className="decor-card" ref={(node) => { refs.current.links = node; }}>
          <div className="plant-pot">✦</div><div className="book">progress<br/>over<br/>perfection<br/>♡</div><div className="candle">🕯</div><div className="notebook">ideas<br/>in progress<br/>❀</div><div className="lantern">🏮</div>
        </section>
      </section>
    </main>
  );
}

function formatSeconds(value) {
  const minutes = Math.floor(value / 60);
  const seconds = String(value % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

createRoot(document.getElementById("root")).render(<App/>);
