import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Circle,
  ClipboardList,
  CloudSun,
  Edit3,
  ExternalLink,
  FileText,
  Gamepad2,
  GripVertical,
  Home,
  Link,
  Mail,
  Music,
  Pause,
  Play,
  Plus,
  Settings,
  SkipBack,
  SkipForward,
  Sparkles,
  Video,
  X
} from "lucide-react";
import "./styles.css";

const DEFAULT_TASKS = [
  { id: 1, text: "Reply to important emails", tag: "Work", done: false },
  { id: 2, text: "Finish dashboard mockups", tag: "Work", done: true },
  { id: 3, text: "Plan content for next week", tag: "Work", done: false },
  { id: 4, text: "Grocery shopping", tag: "Personal", done: false },
  { id: 5, text: "Call mum", tag: "Personal", done: true },
  { id: 6, text: "Drink more water", tag: "Health", done: false },
  { id: 7, text: "Read for 20 minutes", tag: "Personal", done: false }
];

const DEFAULT_TODAY = [
  { id: 1, text: "Client call at 11am", done: false },
  { id: 2, text: "Finish stream overlay", done: true },
  { id: 3, text: "Take meds", done: false },
  { id: 4, text: "Walk Luna", done: false }
];

const DEFAULT_EVENTS = [
  { id: 1, title: "Team Meeting", time: "10:00 AM", tone: "purple" },
  { id: 2, title: "Stream Night", time: "7:00 PM", tone: "green", game: true },
  { id: 3, title: "Dentist Appointment", time: "2:30 PM", tone: "rose" },
  { id: 4, title: "Community Movie Night", time: "8:00 PM", tone: "gold" }
];

const DEFAULT_BRAIN = [
  "Idea: cozy Minecraft build new cottagecore area",
  "Check out new lo-fi playlist",
  "Look into new mic"
];

const DEFAULT_LOAS = [
  { id: 1, name: "Kaida", dates: "May 10 - May 24", returns: "Returns May 25" }
];

const DEFAULT_BIRTHDAYS = [
  { id: 1, avatar: "👩🏻", name: "Mira", date: "May 15", pill: "in 2d" },
  { id: 2, avatar: "👩🏼", name: "Luna", date: "May 20", pill: "in 7d" },
  { id: 3, avatar: "👩🏽", name: "Ash", date: "May 28", pill: "in 15d" }
];

const DEFAULT_LINKS = [
  { id: 1, label: "Gmail", url: "https://mail.google.com", kind: "mail" },
  { id: 2, label: "Notion", url: "https://www.notion.so", kind: "file" },
  { id: 3, label: "Twitch", url: "https://www.twitch.tv", kind: "twitch" },
  { id: 4, label: "Canva", url: "https://www.canva.com", kind: "canva" },
  { id: 5, label: "Discord", url: "https://discord.com/app", kind: "discord" },
  { id: 6, label: "Drive", url: "https://drive.google.com", kind: "drive" },
  { id: 7, label: "YouTube", url: "https://www.youtube.com", kind: "youtube" },
  { id: 8, label: "ChatGPT", url: "https://chatgpt.com", kind: "chatgpt" }
];

const DATES = [
  ["MON", "11"], ["TUE", "12"], ["WED", "13", true], ["THU", "14"],
  ["FRI", "15"], ["SAT", "16"], ["SUN", "17"]
];

const NAV = [
  [Home, "Home", "top"],
  [FileText, "Notes", "brain"],
  [ClipboardList, "Tasks", "tasks"],
  [CalendarDays, "Planner", "planner"],
  [Link, "Links", "links"],
  [Sparkles, "Focus", "today"],
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
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // localStorage can be unavailable in strict/private browser modes.
    }
  }, [key, value]);

  return [value, setValue];
}

function App() {
  const [now, setNow] = useState(new Date());
  const [activeNav, setActiveNav] = useState("Home");
  const [taskFilter, setTaskFilter] = useState("All");
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [tasks, setTasks] = usePersistentState("homebase.tasks", DEFAULT_TASKS);
  const [todayItems, setTodayItems] = usePersistentState("homebase.today", DEFAULT_TODAY);
  const [events, setEvents] = usePersistentState("homebase.events", DEFAULT_EVENTS);
  const [brainNotes, setBrainNotes] = usePersistentState("homebase.brain", DEFAULT_BRAIN);
  const [loas, setLoas] = usePersistentState("homebase.loas", DEFAULT_LOAS);
  const [nextStream, setNextStream] = usePersistentState("homebase.nextStream", {
    title: "Highlife RP", date: "May 16, 2025", time: "7:00 PM BST", pill: "in 2d 8h"
  });
  const [birthdays, setBirthdays] = usePersistentState("homebase.birthdays", DEFAULT_BIRTHDAYS);
  const [quickLinks, setQuickLinks] = usePersistentState("homebase.links", DEFAULT_LINKS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackSeconds, setTrackSeconds] = useState(0);
  const refs = useRef({});

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = setInterval(() => setTrackSeconds((value) => (value + 1) % 181), 1000);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const timeLabel = useMemo(
    () => now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    [now]
  );

  const visibleTasks = taskFilter === "All" ? tasks : tasks.filter((task) => task.tag === taskFilter);
  const progressPercent = Math.min(100, (trackSeconds / 180) * 100);

  function scrollTo(key, label) {
    setActiveNav(label);
    if (key === "settings") {
      alert("Homebase settings are currently saved automatically in this browser. Your task, planner, note, LOA, birthday and quick-link changes persist locally.");
      return;
    }
    const target = refs.current[key];
    if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function addTask() {
    const text = prompt("Task name:");
    if (!text?.trim()) return;
    const rawTag = prompt("Category: Work, Personal, Health or Other", "Personal") || "Other";
    const allowed = ["Work", "Personal", "Health", "Other"];
    const tag = allowed.find((item) => item.toLowerCase() === rawTag.trim().toLowerCase()) || "Other";
    setTasks((current) => [...current, { id: Date.now(), text: text.trim(), tag, done: false }]);
  }

  function editTask(id) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    const text = prompt("Edit task:", task.text);
    if (!text?.trim()) return;
    const rawTag = prompt("Category: Work, Personal, Health or Other", task.tag) || task.tag;
    const allowed = ["Work", "Personal", "Health", "Other"];
    const tag = allowed.find((item) => item.toLowerCase() === rawTag.trim().toLowerCase()) || task.tag;
    setTasks((current) => current.map((item) => item.id === id ? { ...item, text: text.trim(), tag } : item));
  }

  function deleteTask(id) {
    if (confirm("Delete this task?")) setTasks((current) => current.filter((item) => item.id !== id));
  }

  function dropTask(targetId) {
    if (draggedTaskId == null || draggedTaskId === targetId) return;
    setTasks((current) => {
      const from = current.findIndex((item) => item.id === draggedTaskId);
      const to = current.findIndex((item) => item.id === targetId);
      if (from < 0 || to < 0) return current;
      const reordered = [...current];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);
      return reordered;
    });
    setDraggedTaskId(null);
  }

  function addToday() {
    const text = prompt("Add something to Today:");
    if (!text?.trim()) return;
    setTodayItems((current) => [...current, { id: Date.now(), text: text.trim(), done: false }]);
  }

  function editToday(id) {
    const item = todayItems.find((entry) => entry.id === id);
    if (!item) return;
    const text = prompt("Edit Today item (leave blank to delete):", item.text);
    if (text === null) return;
    if (!text.trim()) {
      setTodayItems((current) => current.filter((entry) => entry.id !== id));
      return;
    }
    setTodayItems((current) => current.map((entry) => entry.id === id ? { ...entry, text: text.trim() } : entry));
  }

  function addEvent() {
    const title = prompt("Event name:");
    if (!title?.trim()) return;
    const time = prompt("Time:", "7:00 PM") || "";
    const tones = ["purple", "green", "rose", "gold"];
    setEvents((current) => [...current, { id: Date.now(), title: title.trim(), time: time.trim(), tone: tones[current.length % tones.length] }]);
  }

  function editEvent(id) {
    const event = events.find((entry) => entry.id === id);
    if (!event) return;
    const title = prompt("Edit event name (leave blank to delete):", event.title);
    if (title === null) return;
    if (!title.trim()) {
      setEvents((current) => current.filter((entry) => entry.id !== id));
      return;
    }
    const time = prompt("Edit event time:", event.time) ?? event.time;
    setEvents((current) => current.map((entry) => entry.id === id ? { ...entry, title: title.trim(), time: time.trim() } : entry));
  }

  function editBrainDump() {
    const value = prompt("Brain Dump — put each note on a new line:", brainNotes.join("\n"));
    if (value === null) return;
    setBrainNotes(value.split("\n").map((item) => item.trim()).filter(Boolean));
  }

  function addLoa() {
    const name = prompt("Creator name:");
    if (!name?.trim()) return;
    const dates = prompt("LOA dates:", "May 10 - May 24") || "";
    const returns = prompt("Return date:", "Returns May 25") || "";
    setLoas((current) => [...current, { id: Date.now(), name: name.trim(), dates: dates.trim(), returns: returns.trim() }]);
  }

  function editLoa(id) {
    const loa = loas.find((entry) => entry.id === id);
    if (!loa) return;
    const name = prompt("Creator name (leave blank to delete):", loa.name);
    if (name === null) return;
    if (!name.trim()) {
      setLoas((current) => current.filter((entry) => entry.id !== id));
      return;
    }
    const dates = prompt("LOA dates:", loa.dates) ?? loa.dates;
    const returns = prompt("Return date:", loa.returns) ?? loa.returns;
    setLoas((current) => current.map((entry) => entry.id === id ? { ...entry, name: name.trim(), dates: dates.trim(), returns: returns.trim() } : entry));
  }

  function editNextStream() {
    const title = prompt("Stream title:", nextStream.title);
    if (!title?.trim()) return;
    const date = prompt("Stream date:", nextStream.date) ?? nextStream.date;
    const time = prompt("Stream time:", nextStream.time) ?? nextStream.time;
    const pill = prompt("Countdown label:", nextStream.pill) ?? nextStream.pill;
    setNextStream({ title: title.trim(), date: date.trim(), time: time.trim(), pill: pill.trim() });
  }

  function addBirthday() {
    const name = prompt("Name:");
    if (!name?.trim()) return;
    const date = prompt("Birthday date:", "May 20") || "";
    const pill = prompt("Countdown label:", "in 7d") || "";
    setBirthdays((current) => [...current, { id: Date.now(), avatar: "🎂", name: name.trim(), date: date.trim(), pill: pill.trim() }]);
  }

  function editBirthday(id) {
    const birthday = birthdays.find((entry) => entry.id === id);
    if (!birthday) return;
    const name = prompt("Name (leave blank to delete):", birthday.name);
    if (name === null) return;
    if (!name.trim()) {
      setBirthdays((current) => current.filter((entry) => entry.id !== id));
      return;
    }
    const date = prompt("Birthday date:", birthday.date) ?? birthday.date;
    const pill = prompt("Countdown label:", birthday.pill) ?? birthday.pill;
    setBirthdays((current) => current.map((entry) => entry.id === id ? { ...entry, name: name.trim(), date: date.trim(), pill: pill.trim() } : entry));
  }

  function addQuickLink() {
    const label = prompt("Link name:");
    if (!label?.trim()) return;
    let url = prompt("URL (including https://):", "https://") || "";
    if (!url.trim()) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    setQuickLinks((current) => [...current, { id: Date.now(), label: label.trim(), url: url.trim(), kind: "custom" }]);
  }

  function openQuickLink(link) {
    window.open(link.url, "_blank", "noopener,noreferrer");
  }

  function showFullWeek() {
    alert(events.length ? events.map((event) => `${event.title} — ${event.time}`).join("\n") : "No events yet.");
  }

  return (
    <main className="shell" ref={(node) => { refs.current.top = node; }}>
      <aside className="sidebar">
        <div className="avatar"><span>KM</span><Sparkles size={15} /></div>
        <nav>
          {NAV.map(([Icon, label, target]) => (
            <button
              type="button"
              className={activeNav === label ? "nav-item active" : "nav-item"}
              key={label}
              onClick={() => scrollTo(target, label)}
              aria-label={label}
            >
              <Icon size={22} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="dashboard">
        <div ref={(node) => { refs.current.tasks = node; }} className="panel-anchor todo-anchor">
          <Panel className="todo-panel" title="To-Do List" icon={<Sparkles />} action={<><Plus size={14}/> Add Task</>} onAction={addTask}>
            <div className="chips">
              {["All", "Work", "Personal", "Health", "Other"].map((label) => (
                <button type="button" className={taskFilter === label ? "selected" : ""} key={label} onClick={() => setTaskFilter(label)}>{label}</button>
              ))}
            </div>
            <div className="task-list">
              {visibleTasks.map((task) => (
                <div
                  className={`${task.done ? "task done" : "task"}${draggedTaskId === task.id ? " dragging" : ""}`}
                  key={task.id}
                  draggable
                  onDragStart={(event) => {
                    setDraggedTaskId(task.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropTask(task.id)}
                  onDragEnd={() => setDraggedTaskId(null)}
                >
                  <span className="drag" title="Drag to reorder"><GripVertical size={16}/></span>
                  <button type="button" className="box task-check" onClick={() => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))} aria-label={`Mark ${task.text} ${task.done ? "not done" : "done"}`}>{task.done && <Check size={13}/>}</button>
                  <span className="task-text">{task.text}</span>
                  <span className={`tag ${task.tag.toLowerCase()}`}>{task.tag}</span>
                  <button type="button" onClick={() => editTask(task.id)} aria-label={`Edit ${task.text}`}><Edit3 size={14}/></button>
                  <button type="button" onClick={() => deleteTask(task.id)} aria-label={`Delete ${task.text}`}><X size={14}/></button>
                </div>
              ))}
            </div>
            <button type="button" className="inline-add" onClick={addTask}><Plus size={14}/> Add new task</button>
          </Panel>
        </div>

        <section className="today-card" ref={(node) => { refs.current.today = node; }}>
          <div className="tape"/>
          <div className="today-head"><h2>Today ♡</h2><button type="button" onClick={addToday}><Plus size={14}/> Add</button></div>
          {todayItems.map((item) => (
            <div className={item.done ? "today-row complete" : "today-row"} key={item.id}>
              <button type="button" className="today-toggle" onClick={() => setTodayItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, done: !entry.done } : entry))} aria-label={`Toggle ${item.text}`}>
                {item.done ? <Check size={17}/> : <Circle size={18}/>}
              </button>
              <button type="button" className="today-text" onClick={() => editToday(item.id)}>{item.text}</button>
            </div>
          ))}
          <div className="bear">ʕ•ᴥ•ʔ</div>
        </section>

        <div ref={(node) => { refs.current.planner = node; }} className="panel-anchor week-anchor">
          <Panel className="week-panel" title="Week at a Glance" icon={<CalendarDays />} action={<><Plus size={14}/> Add Event</>} onAction={addEvent}>
            <div className="dates">
              {DATES.map(([day, date, active]) => (
                <div className={active ? "date active" : "date"} key={day}><span>{day}</span><strong>{date}</strong></div>
              ))}
            </div>
            <div className="event-grid">
              {events.slice(0, 4).map((event) => (
                <EventCard key={event.id} className={event.tone} title={event.title} time={event.time} icon={event.game ? <Gamepad2 size={14}/> : undefined} onClick={() => editEvent(event.id)} />
              ))}
            </div>
            <button type="button" className="view-week" onClick={showFullWeek}>View full week <ChevronDown size={16}/></button>
          </Panel>
        </div>

        <aside className="right-top">
          <section className="weather-card">
            <div className="time">{timeLabel}<small>{now.getHours() >= 12 ? "PM" : "AM"}</small></div>
            <div className="date-line">{now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }).toUpperCase()}</div>
            <div className="weather-divider"/>
            <div className="weather-row"><CloudSun size={47}/><div><strong>18°C</strong><span>Partly Cloudy</span><small>Feels like 18°</small></div></div>
          </section>
          <button type="button" className="brain-sticky brain-button" ref={(node) => { refs.current.brain = node; }} onClick={editBrainDump} title="Click to edit Brain Dump">
            <div className="pin"/>
            <h2>Brain Dump ☁</h2>
            {brainNotes.slice(0, 5).map((note, index) => <p key={`${note}-${index}`}>• {note}</p>)}
          </button>
        </aside>

        <Panel className="music-panel" title="Now Playing" icon={<Music />} panelRef={(node) => { refs.current.music = node; }}>
          <div className="player-body">
            <div className="album-art"><span className="sun"/><span className="window"/><span className="desk"/><span className="plant"/></div>
            <div className="song-copy"><h3>{isPlaying ? "Cozy Lo-fi" : "No song playing"}</h3><p>{isPlaying ? "Homebase ambient mix" : <>Play something<br/>you love ♡</>}</p></div>
          </div>
          <button type="button" className="progress progress-button" aria-label="Seek track" onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setTrackSeconds(Math.round(((event.clientX - rect.left) / rect.width) * 180));
          }}><span style={{ width: `${progressPercent}%` }}/></button>
          <div className="timecodes"><span>{formatSeconds(trackSeconds)}</span><span>3:00</span></div>
          <div className="player-controls">
            <button type="button" onClick={() => setTrackSeconds((value) => Math.max(0, value - 15))} aria-label="Back 15 seconds"><SkipBack/></button>
            <button type="button" className="play" onClick={() => setIsPlaying((value) => !value)} aria-label={isPlaying ? "Pause" : "Play"}>{isPlaying ? <Pause fill="currentColor"/> : <Play fill="currentColor"/>}</button>
            <button type="button" onClick={() => setTrackSeconds((value) => Math.min(180, value + 15))} aria-label="Forward 15 seconds"><SkipForward/></button>
          </div>
        </Panel>

        <div className="middle-stack">
          <MiniPanel title="Active CC LOAs" icon={<Settings size={18}/>} action={<Plus size={16}/>} onAction={addLoa}>
            {loas.map((loa, index) => <InfoLine key={loa.id} badge={index + 1} title={loa.name} main={loa.dates} meta={loa.returns} onClick={() => editLoa(loa.id)} />)}
          </MiniPanel>
          <MiniPanel title="Next Stream" icon={<CalendarDays size={18}/>} action={<Edit3 size={16}/>} onAction={editNextStream}>
            <InfoLine badge={<Gamepad2 size={15}/>} title={nextStream.title} main={nextStream.date} meta={`◷ ${nextStream.time}`} pill={nextStream.pill} onClick={editNextStream} />
          </MiniPanel>
        </div>

        <MiniPanel className="birthday-panel" title="Upcoming Birthdays" icon={<span className="cupcake">🧁</span>} action={<Plus size={16}/>} onAction={addBirthday}>
          {birthdays.map((birthday) => <Birthday key={birthday.id} {...birthday} onClick={() => editBirthday(birthday.id)} />)}
        </MiniPanel>

        <div ref={(node) => { refs.current.links = node; }} className="panel-anchor links-anchor">
          <Panel className="links-panel" title="Quick Links" icon={<ExternalLink />} action={<><Plus size={14}/> Add Link</>} onAction={addQuickLink}>
            <div className="link-grid">
              {quickLinks.map((link) => <QuickLink key={link.id} link={link} onClick={() => openQuickLink(link)} />)}
            </div>
          </Panel>
        </div>

        <div className="desktop-decor cat-decor">🐱</div>
        <div className="desktop-decor journal">take it<br/>easy!<br/>♥</div>
        <div className="desktop-decor coffee">☕</div>
      </section>
    </main>
  );
}

function formatSeconds(value) {
  const minutes = Math.floor(value / 60);
  const seconds = String(value % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function Panel({ title, icon, action, onAction, className = "", children, panelRef }) {
  return <section ref={panelRef} className={`panel ${className}`}><header><span className="title-icon">{React.cloneElement(icon, { size: 22 })}</span><h2>{title}</h2>{action && <button type="button" className="panel-action" onClick={onAction}>{action}</button>}</header>{children}</section>;
}

function EventCard({ title, time, icon, className, onClick }) {
  return <button type="button" className={`event-card ${className}`} onClick={onClick} title="Click to edit"><div>{icon || <span className="dot"/>}<span>{title}</span></div><time>{time}</time></button>;
}

function MiniPanel({ title, icon, action, onAction, className = "", children }) {
  return <section className={`mini-panel ${className}`}><header><span>{icon}</span><h2>{title}</h2><button type="button" onClick={onAction} aria-label={`${title} action`}>{action}</button></header>{children}</section>;
}

function InfoLine({ badge, title, main, meta, pill, onClick }) {
  return <button type="button" className="info-line info-button" onClick={onClick} title="Click to edit"><span className="badge">{badge}</span><span className="info-copy"><strong>{title}</strong><span>{main}</span><small>{meta}</small></span>{pill && <span className="pill">{pill}</span>}</button>;
}

function Birthday({ avatar, name, date, pill, onClick }) {
  return <button type="button" className="birthday birthday-button" onClick={onClick} title="Click to edit"><span className="birthday-avatar">{avatar}</span><strong>{name}</strong><span className="birthday-date">{date}</span><span className="birthday-pill">{pill}</span></button>;
}

function QuickLink({ link, onClick }) {
  let icon;
  switch (link.kind) {
    case "mail": icon = <Mail size={28}/>; break;
    case "file": icon = <FileText size={28}/>; break;
    case "twitch": icon = <span className="brand-letter">T</span>; break;
    case "canva": icon = <span className="brand-letter">C</span>; break;
    case "discord": icon = <Gamepad2 size={28}/>; break;
    case "drive": icon = <span className="brand-letter">▲</span>; break;
    case "youtube": icon = <Video size={28}/>; break;
    case "chatgpt": icon = <Sparkles size={28}/>; break;
    default: icon = <ExternalLink size={28}/>;
  }
  return <button type="button" className="quick-link" onClick={onClick} title={`Open ${link.label}`}>{icon}<span>{link.label}</span></button>;
}

createRoot(document.getElementById("root")).render(<App />);
