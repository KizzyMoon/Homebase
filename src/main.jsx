import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Circle,
  ClipboardList,
  Cloud,
  Coffee,
  Edit3,
  ExternalLink,
  FileText,
  Gamepad2,
  Heart,
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
  Star,
  Timer,
  Trash2,
  MessageCircle,
  Video
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

const events = [
  { day: "MON", date: "11" },
  { day: "TUE", date: "12" },
  { day: "WED", date: "13", active: true },
  { day: "THU", date: "14" },
  { day: "FRI", date: "15" },
  { day: "SAT", date: "16" },
  { day: "SUN", date: "17" }
];

const nav = [
  [Home, "Home"],
  [FileText, "Notes"],
  [ClipboardList, "Tasks"],
  [CalendarDays, "Planner"],
  [Link, "Links"],
  [Timer, "Focus"],
  [Music, "Music"],
  [Settings, "Settings"]
];

function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    if (!timerRunning) return undefined;
    const timer = setInterval(() => {
      setSecondsLeft((value) => {
        if (value <= 1) {
          setTimerRunning(false);
          return 25 * 60;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timerRunning]);

  const timeLabel = useMemo(() => {
    return now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }, [now]);

  const timerLabel = useMemo(() => {
    const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
    const seconds = (secondsLeft % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [secondsLeft]);

  return (
    <main className="shell" aria-label="Homebase dashboard">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="avatar">
          <span>KM</span>
          <Sparkles size={18} />
        </div>
        <nav>
          {nav.map(([Icon, label], index) => (
            <button className={index === 0 ? "nav-item active" : "nav-item"} key={label} aria-label={label}>
              <Icon size={25} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="dashboard">
        <Panel className="todo-panel span-2" title="To-Do List" icon={<Sparkles />}>
          <div className="panel-action">
            <Plus size={17} /> Add Task
          </div>
          <div className="chips" aria-label="Task filters">
            {["All", "Work", "Personal", "Health", "Other"].map((label) => (
              <button key={label}>{label}</button>
            ))}
          </div>
          <div className="task-list">
            {tasks.map((task) => (
              <div className={task.done ? "task done" : "task"} key={task.text}>
                <span className="drag" aria-hidden="true">::</span>
                <span className="box">{task.done && <Check size={15} />}</span>
                <span className="task-text">{task.text}</span>
                <span className={`tag ${task.tag.toLowerCase()}`}>{task.tag}</span>
                <button aria-label={`Edit ${task.text}`}><Edit3 size={16} /></button>
                <button aria-label={`Delete ${task.text}`}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <button className="inline-add"><Plus size={15} /> Add new task</button>
        </Panel>

        <section className="paper-card">
          <div className="binder"></div>
          <div className="paper-head">
            <h2>Today <Star size={22} /></h2>
            <button><Plus size={16} /> Add</button>
          </div>
          {["Client call at 11am", "Finish stream overlay", "Take meds", "Walk Luna"].map((item, index) => (
            <div className={index === 1 ? "paper-row complete" : "paper-row"} key={item}>
              {index === 1 ? <Check size={18} /> : <Circle size={20} />}
              <span>{item}</span>
            </div>
          ))}
          <div className="cat" aria-hidden="true">
            <span className="cat-ear left"></span>
            <span className="cat-ear right"></span>
            <span className="cat-face">o o</span>
          </div>
          <div className="sticky">You have got this!</div>
        </section>

        <Panel className="week-panel span-2" title="Week at a Glance" icon={<CalendarDays />}>
          <div className="panel-action"><Plus size={17} /> Add Event</div>
          <div className="dates">
            {events.map((event) => (
              <div className={event.active ? "date active" : "date"} key={event.day}>
                <span>{event.day}</span>
                <strong>{event.date}</strong>
              </div>
            ))}
          </div>
          <div className="event-grid">
            <EventCard dot="lavender" title="Team Meeting" time="10:00 AM" />
            <EventCard dot="green" title="Stream Night" time="7:00 PM" icon={<Gamepad2 size={18} />} />
            <EventCard dot="rose" title="Dentist Appointment" time="2:30 PM" />
            <EventCard dot="gold" title="Community Movie Night" time="8:00 PM" />
          </div>
          <button className="view-week">View full week <ChevronRight size={18} /></button>
        </Panel>

        <section className="weather-card">
          <Sparkles className="spark one" size={16} />
          <Sparkles className="spark two" size={16} />
          <div className="time">{timeLabel}<span>AM</span></div>
          <div className="date-line">Wed, May 13</div>
          <div className="weather-divider"></div>
          <div className="weather-row">
            <Cloud size={52} />
            <div>
              <strong>18 C</strong>
              <span>Partly Cloudy</span>
              <small>Feels like 18</small>
            </div>
          </div>
        </section>

        <Panel className="brain-panel span-2" title="Brain Dump" icon={<Cloud />}>
          <div className="note-input">
            <input aria-label="Brain dump note" placeholder="Type something..." />
            <button>Add</button>
          </div>
          {[
            ["Idea: cozy Minecraft build new cottagecore area", "Today"],
            ["Check out new lo-fi playlist", "Today"],
            ["Look into new mic", "Yesterday"],
            ["Book vet appointment", "May 11"],
            ["Try that new pasta recipe", "May 10"]
          ].map(([text, date]) => (
            <div className="dump-row" key={text}>
              <span className="mini-drag">:</span>
              <span>{text}</span>
              <time>{date}</time>
            </div>
          ))}
          <div className="brain-actions">
            <button><ChevronRight size={16} /> To-Do</button>
            <button><Trash2 size={16} /> Clear All</button>
          </div>
        </Panel>

        <Panel className="focus-panel" title="Focus Timer" icon={<Timer />}>
          <button className="ghost-gear" aria-label="Timer settings"><Settings size={20} /></button>
          <div className="segments">
            <button className="selected">Focus</button>
            <button>Short Break</button>
          </div>
          <div className="timer-ring" style={{ "--progress": `${(secondsLeft / 1500) * 360}deg` }}>
            <span>{timerLabel}</span>
          </div>
          <button className="start" onClick={() => setTimerRunning((value) => !value)}>
            {timerRunning ? "Pause" : "Start"}
          </button>
          <div className="mini-controls">
            <button aria-label="Reset timer" onClick={() => { setSecondsLeft(25 * 60); setTimerRunning(false); }}>
              <Timer size={18} />
            </button>
            <button aria-label="Music mode"><Music size={18} /></button>
          </div>
        </Panel>

        <Panel className="music-panel span-2" title="Now Playing" icon={<Music />}>
          <button className="ghost-gear" aria-label="Music options"><Sparkles size={18} /></button>
          <div className="player">
            <div className="cozy-art" role="img" aria-label="Cozy night desk illustration">
              <span className="window"></span>
              <span className="lamp"></span>
              <span className="desk-line"></span>
              <span className="notebook"></span>
              <span className="plant one"></span>
              <span className="plant two"></span>
            </div>
            <div>
              <h3>{isPlaying ? "Cozy Night Desk" : "No song playing"}</h3>
              <p>{isPlaying ? "Lo-fi focus mix" : "Play something you love"}</p>
            </div>
          </div>
          <div className="track"><span style={{ width: isPlaying ? "42%" : "18%" }}></span></div>
          <div className="player-controls">
            <button aria-label="Previous"><SkipBack size={24} /></button>
            <button className="play" onClick={() => setIsPlaying((value) => !value)} aria-label="Play or pause">
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>
            <button aria-label="Next"><SkipForward size={24} /></button>
          </div>
        </Panel>

        <aside className="right-rail">
          <section className="pinned-note">
            <strong>Quick Note</strong>
            <p>Do not forget to be proud of how far you have come</p>
            <Heart size={20} />
          </section>
          <MiniPanel title="Active CC LOAs" icon={<Settings size={18} />} action={<Plus size={17} />}>
            <InfoLine title="Kaida" main="May 10 - May 24" meta="Returns May 25" badge="1" />
          </MiniPanel>
          <MiniPanel title="Next Stream" icon={<CalendarDays size={18} />} action={<Edit3 size={17} />}>
            <InfoLine title="Highlife RP" main="May 16, 2025" meta="7:00 PM BST" badge={<Gamepad2 size={17} />} />
          </MiniPanel>
          <MiniPanel title="Upcoming Birthdays" icon={<Coffee size={18} />} action={<Plus size={17} />}>
            {["Mira  May 15  in 2d", "Luna  May 20  in 7d", "Ash  May 28  in 15d"].map((birthday, index) => (
              <div className="birthday" key={birthday}>
                <span>{["M", "L", "A"][index]}</span>
                <p>{birthday}</p>
              </div>
            ))}
          </MiniPanel>
        </aside>

        <Panel className="links-panel span-4" title="Quick Links" icon={<ExternalLink />}>
          <div className="link-grid">
            <QuickLink label="Gmail" icon={<Mail />} />
            <QuickLink label="Notion" icon={<FileText />} />
            <QuickLink label="Twitch" icon={<MessageCircle />} />
            <QuickLink label="Canva" icon={<Sparkles />} />
            <QuickLink label="Discord" icon={<Gamepad2 />} />
            <QuickLink label="Drive" icon={<Cloud />} />
            <QuickLink label="YouTube" icon={<Video />} />
            <QuickLink label="ChatGPT" icon={<Sparkles />} />
          </div>
        </Panel>
      </section>
    </main>
  );
}

function Panel({ title, icon, className = "", children }) {
  return (
    <section className={`panel ${className}`}>
      <header>
        <span className="title-icon">{React.cloneElement(icon, { size: 24 })}</span>
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

function EventCard({ dot, icon, title, time }) {
  return (
    <article className={`event-card ${dot}`}>
      <div>{icon || <span className="dot" />}{title}</div>
      <time>{time}</time>
    </article>
  );
}

function MiniPanel({ title, icon, action, children }) {
  return (
    <section className="mini-panel">
      <header>
        <span>{icon}</span>
        <h2>{title}</h2>
        <button aria-label={`Add to ${title}`}>{action}</button>
      </header>
      {children}
    </section>
  );
}

function InfoLine({ title, main, meta, badge }) {
  return (
    <article className="info-line">
      <span className="badge">{badge}</span>
      <div>
        <strong>{title}</strong>
        <p>{main}</p>
        <small>{meta}</small>
      </div>
    </article>
  );
}

function QuickLink({ icon, label }) {
  return (
    <button className="quick-link" aria-label={label}>
      {React.cloneElement(icon, { size: 34 })}
      <span>{label}</span>
    </button>
  );
}

createRoot(document.getElementById("root")).render(<App />);
