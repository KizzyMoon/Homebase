import React, { useEffect, useMemo, useState } from "react";
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
  Heart,
  Home,
  Link,
  Mail,
  Music,
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

const tasks = [
  { text: "Reply to important emails", tag: "Work" },
  { text: "Finish dashboard mockups", tag: "Work", done: true },
  { text: "Plan content for next week", tag: "Work" },
  { text: "Grocery shopping", tag: "Personal" },
  { text: "Call mum", tag: "Personal", done: true },
  { text: "Drink more water", tag: "Health" },
  { text: "Read for 20 minutes", tag: "Personal" }
];

const dates = [
  ["MON", "11"],
  ["TUE", "12"],
  ["WED", "13", true],
  ["THU", "14"],
  ["FRI", "15"],
  ["SAT", "16"],
  ["SUN", "17"]
];

const nav = [
  [Home, "Home"],
  [FileText, "Notes"],
  [ClipboardList, "Tasks"],
  [CalendarDays, "Planner"],
  [Link, "Links"],
  [Sparkles, "Focus"],
  [Music, "Music"],
  [Settings, "Settings"]
];

function App() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeLabel = useMemo(
    () => now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    [now]
  );

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="avatar"><span>KM</span><Sparkles size={15} /></div>
        <nav>
          {nav.map(([Icon, label], index) => (
            <button className={index === 0 ? "nav-item active" : "nav-item"} key={label}>
              <Icon size={22} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="dashboard">
        <Panel className="todo-panel" title="To-Do List" icon={<Sparkles />} action={<><Plus size={14}/> Add Task</>}>
          <div className="chips">
            {["All", "Work", "Personal", "Health", "Other"].map((label) => <button key={label}>{label}</button>)}
          </div>
          <div className="task-list">
            {tasks.map((task) => (
              <div className={task.done ? "task done" : "task"} key={task.text}>
                <span className="drag">•••</span>
                <span className="box">{task.done && <Check size={13}/>}</span>
                <span className="task-text">{task.text}</span>
                <span className={`tag ${task.tag.toLowerCase()}`}>{task.tag}</span>
                <button><Edit3 size={14}/></button>
                <button><X size={14}/></button>
              </div>
            ))}
          </div>
          <button className="inline-add"><Plus size={14}/> Add new task</button>
        </Panel>

        <section className="today-card">
          <div className="tape"/>
          <div className="today-head"><h2>Today ♡</h2><button><Plus size={14}/> Add</button></div>
          {["Client call at 11am", "Finish stream overlay", "Take meds", "Walk Luna"].map((item, i) => (
            <div className={i === 1 ? "today-row complete" : "today-row"} key={item}>
              {i === 1 ? <Check size={17}/> : <Circle size={18}/>}<span>{item}</span>
            </div>
          ))}
          <div className="bear">ʕ•ᴥ•ʔ</div>
        </section>

        <Panel className="week-panel" title="Week at a Glance" icon={<CalendarDays />} action={<><Plus size={14}/> Add Event</>}>
          <div className="dates">
            {dates.map(([day, date, active]) => (
              <div className={active ? "date active" : "date"} key={day}><span>{day}</span><strong>{date}</strong></div>
            ))}
          </div>
          <div className="event-grid">
            <EventCard className="purple" title="Team Meeting" time="10:00 AM" />
            <EventCard className="green" title="Stream Night" time="7:00 PM" icon={<Gamepad2 size={14}/>} />
            <EventCard className="rose" title="Dentist Appointment" time="2:30 PM" />
            <EventCard className="gold" title="Community Movie Night" time="8:00 PM" />
          </div>
          <button className="view-week">View full week <ChevronDown size={16}/></button>
        </Panel>

        <aside className="right-top">
          <section className="weather-card">
            <div className="time">{timeLabel}<small>AM</small></div>
            <div className="date-line">WED, MAY 13</div>
            <div className="weather-divider"/>
            <div className="weather-row"><CloudSun size={47}/><div><strong>18°C</strong><span>Partly Cloudy</span><small>Feels like 18°</small></div></div>
          </section>
          <section className="brain-sticky">
            <div className="pin"/>
            <h2>Brain Dump ☁</h2>
            <p>• Idea: cozy Minecraft</p>
            <p className="indent">build new cottagecore</p>
            <p className="indent">area</p>
            <p>• Check out new lo-fi</p>
            <p className="indent">playlist</p>
            <p>• Look into new mic</p>
          </section>
        </aside>

        <Panel className="music-panel" title="Now Playing" icon={<Music />}>
          <div className="player-body">
            <div className="album-art">
              <span className="sun"/><span className="window"/><span className="desk"/><span className="plant"/>
            </div>
            <div className="song-copy"><h3>No song playing</h3><p>Play something<br/>you love ♡</p></div>
          </div>
          <div className="progress"><span/></div>
          <div className="timecodes"><span>0:00</span><span>0:00</span></div>
          <div className="player-controls"><button><SkipBack/></button><button className="play"><Play fill="currentColor"/></button><button><SkipForward/></button></div>
        </Panel>

        <div className="middle-stack">
          <MiniPanel title="Active CC LOAs" icon={<Settings size={18}/>} action={<Plus size={16}/>}>
            <InfoLine badge="1" title="Kaida" main="May 10 - May 24" meta="Returns May 25" />
          </MiniPanel>
          <MiniPanel title="Next Stream" icon={<CalendarDays size={18}/>} action={<Edit3 size={16}/>}>
            <InfoLine badge={<Gamepad2 size={15}/>} title="Highlife RP" main="May 16, 2025" meta="◷ 7:00 PM BST" pill="in 2d 8h" />
          </MiniPanel>
        </div>

        <MiniPanel className="birthday-panel" title="Upcoming Birthdays" icon={<span className="cupcake">🧁</span>} action={<Plus size={16}/>}>
          <Birthday avatar="👩🏻" name="Mira" date="May 15" pill="in 2d" />
          <Birthday avatar="👩🏼" name="Luna" date="May 20" pill="in 7d" />
          <Birthday avatar="👩🏽" name="Ash" date="May 28" pill="in 15d" />
        </MiniPanel>

        <Panel className="links-panel" title="Quick Links" icon={<ExternalLink />} action={<><Plus size={14}/> Add Link</>}>
          <div className="link-grid">
            <QuickLink icon={<Mail/>} label="Gmail" />
            <QuickLink icon={<FileText/>} label="Notion" />
            <QuickLink icon={<span className="brand-letter">T</span>} label="Twitch" />
            <QuickLink icon={<span className="brand-letter">C</span>} label="Canva" />
            <QuickLink icon={<Gamepad2/>} label="Discord" />
            <QuickLink icon={<span className="brand-letter">▲</span>} label="Drive" />
            <QuickLink icon={<Video/>} label="YouTube" />
            <QuickLink icon={<Sparkles/>} label="ChatGPT" />
          </div>
        </Panel>

        <div className="desktop-decor cat-decor">🐱</div>
        <div className="desktop-decor journal">take it<br/>easy!<br/>♥</div>
        <div className="desktop-decor coffee">☕</div>
      </section>
    </main>
  );
}

function Panel({ title, icon, action, className = "", children }) {
  return <section className={`panel ${className}`}><header><span className="title-icon">{React.cloneElement(icon, { size: 22 })}</span><h2>{title}</h2>{action && <button className="panel-action">{action}</button>}</header>{children}</section>;
}

function EventCard({ title, time, icon, className }) {
  return <article className={`event-card ${className}`}><div>{icon || <span className="dot"/>}<span>{title}</span></div><time>{time}</time></article>;
}

function MiniPanel({ title, icon, action, className = "", children }) {
  return <section className={`mini-panel ${className}`}><header><span>{icon}</span><h2>{title}</h2><button>{action}</button></header>{children}</section>;
}

function InfoLine({ badge, title, main, meta, pill }) {
  return <article className="info-line"><span className="badge">{badge}</span><div><strong>{title}</strong><p>{main}</p><small>{meta}</small></div>{pill && <span className="pill">{pill}</span>}</article>;
}

function Birthday({ avatar, name, date, pill }) {
  return <div className="birthday"><span className="birthday-avatar">{avatar}</span><strong>{name}</strong><span className="birthday-date">{date}</span><span className="birthday-pill">{pill}</span></div>;
}

function QuickLink({ icon, label }) {
  const rendered = React.isValidElement(icon) ? React.cloneElement(icon, icon.type === "span" ? {} : { size: 28 }) : icon;
  return <button className="quick-link">{rendered}<span>{label}</span></button>;
}

createRoot(document.getElementById("root")).render(<App />);
