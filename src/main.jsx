import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Check,
  ClipboardList,
  Edit3,
  ExternalLink,
  Home,
  MonitorCog,
  Play,
  Plus,
  Search,
  Trash2,
  Tv,
  Users,
  Video,
  X
} from "lucide-react";
import "./styles.css";

const CC_API_BASE = "https://bright-carley-creatorcore-60c09cd3.koyeb.app";
const LINKS_KEY = "homebase.links.v2";
const TODAY_KEY = "homebase.todayTasks.v2";
const LISTS_KEY = "homebase.todoLists.v2";
const PROJECTS_KEY = "homebase.projectUpdates.v2";
const CURRENTLY_KEY = "homebase.currently.v2";

const DEFAULT_LINKS = {
  creators: CC_API_BASE,
  ems: "https://kizzymoon.github.io/EMS-Personal/",
  treatment: "https://docs.google.com/spreadsheets/d/10wmM-u_9DZTCWArD_eGuSkbXvdjTFJpiOlQ5siERWCM/edit?gid=0#gid=0",
  twitch: "https://dashboard.twitch.tv/u/itsjustkizzy/home",
  youtube: "https://studio.youtube.com"
};

const DEFAULT_PROJECTS = [
  { id: "creators", label: "Creators", accent: "orange", text: "" },
  { id: "ems", label: "EMS", accent: "moss", text: "" },
  { id: "twitch", label: "Twitch", accent: "pink", text: "" },
  { id: "youtube", label: "YouTube", accent: "red", text: "" }
];

const DEFAULT_CURRENTLY = {
  title: "Cozy Mix",
  subtitle: "Optional static note for now"
};

function useStoredState(key, initialValue) {
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
      // Some browsers can disable storage; the dashboard still works until refresh.
    }
  }, [key, value]);

  return [value, setValue];
}

function App() {
  const [page, setPage] = useState("home");
  const [now, setNow] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [links, setLinks] = useStoredState(LINKS_KEY, DEFAULT_LINKS);
  const [todayTasks, setTodayTasks] = useStoredState(TODAY_KEY, []);
  const [todoLists, setTodoLists] = useStoredState(LISTS_KEY, []);
  const [projectUpdates, setProjectUpdates] = useStoredState(PROJECTS_KEY, DEFAULT_PROJECTS);
  const [currently, setCurrently] = useStoredState(CURRENTLY_KEY, DEFAULT_CURRENTLY);
  const [modal, setModal] = useState(null);
  const [creatorData, setCreatorData] = useState({ loas: [], warnings: [], status: "Loading creator data..." });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => refreshCreatorData().then((data) => {
      if (!cancelled) setCreatorData(data);
    });
    load();
    const timer = setInterval(load, 300000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const searchItems = useMemo(() => buildSearchItems(links), [links]);
  const common = {
    links,
    setLinks,
    todayTasks,
    setTodayTasks,
    todoLists,
    setTodoLists,
    projectUpdates,
    setProjectUpdates,
    currently,
    setCurrently,
    creatorData,
    setModal,
    navigate: setPage
  };

  function runSearch(event) {
    event.preventDefault();
    const query = searchTerm.trim().toLowerCase();
    if (!query) return;
    const match = searchItems.find((item) => item.keywords.some((word) => word.includes(query) || query.includes(word)));
    if (!match) {
      setModal({ type: "message", title: "No match found", text: "Try creators, EMS, treatment, Twitch, YouTube, links, or to do." });
      return;
    }
    if (match.page) setPage(match.page);
    if (match.url) window.open(match.url, "_blank", "noopener,noreferrer");
    setSearchTerm("");
  }

  return (
    <main className="homebase">
      <Hero now={now} searchTerm={searchTerm} setSearchTerm={setSearchTerm} runSearch={runSearch} />
      <section className="workspace">
        <DecorScene />
        {page === "home" && <HomePage {...common} />}
        {page === "todos" && <TodosPage {...common} />}
        {page === "creators" && <CreatorsPage {...common} />}
        {page === "ems" && <EmsPage {...common} />}
        {page === "links" && <LinksPage {...common} />}
      </section>
      {modal && <ModalHost modal={modal} close={() => setModal(null)} {...common} />}
    </main>
  );
}

function Hero({ now, searchTerm, setSearchTerm, runSearch }) {
  const weekday = now.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase();
  const date = now.toLocaleDateString("en-GB", { day: "numeric", month: "short" }).toUpperCase();
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s?[AP]M$/i, "");

  return (
    <header className="hero">
      <div className="ivy ivy-left" aria-hidden="true" />
      <div className="hero-copy">
        <div className="tiny-nav"><span className="leaf-mark">◆</span> Home</div>
        <h1>Welcome back, <span>Kizzy ♡</span></h1>
        <p>Big plans<br />cosy spaces<br />progress always</p>
      </div>
      <div className="progress-note">A little progress<br />each day<br /><span>♡</span></div>
      <form className="searchbar" onSubmit={runSearch}>
        <Search size={24} />
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search projects, notes, or anything..."
          aria-label="Search Home Base"
        />
      </form>
      <time className="clock-box" dateTime={now.toISOString()}>
        <span>{weekday} {date}</span>
        <strong>{time}</strong>
      </time>
    </header>
  );
}

function HomePage(props) {
  const { links, todayTasks, setTodayTasks, projectUpdates, setProjectUpdates, setModal, creatorData, navigate } = props;
  return (
    <div className="home-page">
      <SectionTitle>Quick Access</SectionTitle>
      <div className="quick-grid">
        <QuickTile icon={<Users />} label="Creators Dashboard" tone="rose" onClick={() => navigate("creators")} />
        <QuickTile icon={<MonitorCog />} label="EMS Dashboard" tone="moss" onClick={() => navigate("ems")} />
        <QuickTile icon={<Tv />} label="Twitch" tone="plum" href={links.twitch} />
        <QuickTile icon={<Video />} label="YouTube" tone="orange" href={links.youtube} />
        <QuickTile icon={<ClipboardList />} label="To Do Lists" tone="wine" onClick={() => navigate("todos")} />
      </div>
      <div className="main-grid">
        <TodayCard tasks={todayTasks} setTasks={setTodayTasks} setModal={setModal} />
        <ProjectUpdates updates={projectUpdates} setUpdates={setProjectUpdates} setModal={setModal} creatorData={creatorData} />
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="section-title"><span>◆</span>{children}</h2>;
}

function QuickTile({ icon, label, tone, href, onClick }) {
  const content = (
    <>
      <span className="quick-icon">{icon}</span>
      <span>{label}</span>
      <small>→</small>
    </>
  );
  if (href) return <a className={`quick-tile ${tone}`} href={href} target="_blank" rel="noreferrer">{content}</a>;
  return <button className={`quick-tile ${tone}`} onClick={onClick}>{content}</button>;
}

function TodayCard({ tasks, setTasks, setModal }) {
  return (
    <section className="card today-card">
      <CardHeader title="To Do" note="Small steps still count ♡" action={<button onClick={() => setModal({ type: "todayTask" })}><Plus size={16} /> Add</button>} />
      <div className="task-list">
        {tasks.slice(0, 7).length ? tasks.slice(0, 7).map((task) => (
          <div className="task-row" key={task.id}>
            <button className={task.done ? "checkbox checked" : "checkbox"} onClick={() => toggleToday(task.id, setTasks)} aria-label="Toggle task">{task.done && <Check size={14} />}</button>
            <button className={task.done ? "task-title done" : "task-title"} onClick={() => setModal({ type: "todayTask", task })}>{task.text}</button>
            <button className="ghost-icon" onClick={() => removeToday(task.id, setTasks)} aria-label="Delete task"><Trash2 size={15} /></button>
          </div>
        )) : <p className="empty">No tasks yet. Add what actually needs doing today.</p>}
      </div>
    </section>
  );
}

function ProjectUpdates({ updates, setModal, creatorData }) {
  const rows = updates.map((item) => item.id === "creators" && !item.text
    ? { ...item, text: creatorOverviewText(creatorData) }
    : item
  );
  return (
    <section className="card updates-card">
      <CardHeader title="Project Updates" note="Keep going ♡" action={<button onClick={() => setModal({ type: "projectUpdates" })}><Edit3 size={15} /> Edit</button>} />
      <div className="update-list">
        {rows.map((item) => (
          <div className="update-row" key={item.id}>
            <span className={`status-dot ${item.accent}`} />
            <strong>{item.label}</strong>
            <span>{item.text || "No update set"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CurrentlyCard({ currently, setModal }) {
  return (
    <section className="card currently-card">
      <CardHeader title="Currently" action={<button onClick={() => setModal({ type: "currently" })}><Edit3 size={15} /> Edit</button>} />
      <div className="currently-body">
        <div className="album-plate" aria-hidden="true"><span className="mini-window" /><span className="mini-candle" /></div>
        <div>
          <strong>{currently.title || "Optional"}</strong>
          <span>{currently.subtitle || "Static for now, ready to wire later"}</span>
          <div className="static-player"><span /><button aria-label="Static currently widget"><Play size={16} /></button></div>
        </div>
      </div>
    </section>
  );
}

function CreatorTodoCard({ creatorData, action }) {
  const attentionRows = [
    ...creatorData.warnings.map((item) => ({
      id: `warning-${item.discordId || item.name}`,
      name: item.name,
      detail: `${item.count} active warnings`,
      tone: "warning"
    })),
    ...creatorData.loas.map((item) => ({
      id: `loa-${item.name}`,
      name: item.name,
      detail: `LOA ${item.start || "Unknown start"} -> ${item.end || "Unknown end"}`,
      tone: "loa"
    }))
  ];

  return (
    <section className="card creator-todo-card">
      <CardHeader title="CC To Do" note={creatorOverviewText(creatorData)} action={action} />
      {attentionRows.length ? (
        <div className="attention-list">
          {attentionRows.map((item) => (
            <div className={`attention-row ${item.tone}`} key={item.id}>
              <span className="status-dot" />
              <strong>{item.name}</strong>
              <span>{item.detail}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty">{creatorData.status === "Creator data unavailable" ? "Creator data unavailable." : "No CC warning or LOA items need attention right now."}</p>
      )}
      <p className="data-status">{creatorData.status}</p>
    </section>
  );
}

function TodosPage({ todayTasks, setTodayTasks, todoLists, setTodoLists, setModal, creatorData, navigate }) {
  return (
    <SubPage title="To Do Lists" onHome={() => navigate("home")}>
      <section className="management-layout">
        <TodayCard tasks={todayTasks} setTasks={setTodayTasks} setModal={setModal} />
        <section className="card list-manager">
          <CardHeader title="Lists" action={<button onClick={() => setModal({ type: "todoList" })}><Plus size={16} /> New list</button>} />
          {todoLists.length ? todoLists.map((list) => (
            <article className="todo-list-card" key={list.id}>
              <div className="todo-list-title">
                <button onClick={() => setModal({ type: "todoList", list })}><Edit3 size={15} /></button>
                <h3>{list.title}</h3>
                <button onClick={() => removeList(list.id, setTodoLists)}><Trash2 size={15} /></button>
              </div>
              <ListItems list={list} setTodoLists={setTodoLists} setModal={setModal} />
            </article>
          )) : <p className="empty">Create separate lists for bigger bits, like stream planning or admin chores.</p>}
        </section>
        <CreatorTodoCard creatorData={creatorData} action={<button onClick={() => navigate("creators")}>Creators</button>} />
      </section>
    </SubPage>
  );
}

function ListItems({ list, setTodoLists, setModal }) {
  return (
    <div className="task-list">
      {(list.items || []).map((item) => (
        <div className="task-row" key={item.id}>
          <button className={item.done ? "checkbox checked" : "checkbox"} onClick={() => toggleListItem(list.id, item.id, setTodoLists)}>{item.done && <Check size={14} />}</button>
          <button className={item.done ? "task-title done" : "task-title"} onClick={() => setModal({ type: "listItem", listId: list.id, item })}>{item.text}</button>
          <button className="ghost-icon" onClick={() => removeListItem(list.id, item.id, setTodoLists)}><Trash2 size={15} /></button>
        </div>
      ))}
      <button className="add-inline" onClick={() => setModal({ type: "listItem", listId: list.id })}><Plus size={15} /> Add item</button>
    </div>
  );
}

function CreatorsPage({ links, creatorData, navigate }) {
  return (
    <SubPage title="Creators" onHome={() => navigate("home")}>
      <CreatorTodoCard creatorData={creatorData} action={<a className="small-link" href={links.creators} target="_blank" rel="noreferrer">Full dashboard <ExternalLink size={14} /></a>} />
      <div className="two-column">
        <section className="card">
          <CardHeader title="Current LOAs" action={<a className="small-link" href={links.creators} target="_blank" rel="noreferrer">Full dashboard <ExternalLink size={14} /></a>} />
          <DataRows rows={creatorData.loas} empty="No active LOAs returned by the CC backend." render={(item) => (
            <><strong>{item.name}</strong><span>{item.start || "Unknown start"} → {item.end || "Unknown end"}</span></>
          )} />
          <p className="data-status">{creatorData.status}</p>
        </section>
        <section className="card">
          <CardHeader title="2+ Active Warnings" />
          <DataRows rows={creatorData.warnings} empty="No creator warning rows returned." render={(item) => (
            <><strong>{item.name}</strong><span>{item.count} active warnings</span></>
          )} />
        </section>
      </div>
    </SubPage>
  );
}

function EmsPage({ links, navigate }) {
  return (
    <SubPage title="EMS" onHome={() => navigate("home")}>
      <div className="two-column">
        <section className="card">
          <CardHeader title="EMS Personal Dashboard" />
          <p className="soft-copy">This opens your personal EMS dashboard, not the public EMS dashboard.</p>
          <a className="primary-link" href={links.ems} target="_blank" rel="noreferrer">Open EMS Personal <ExternalLink size={16} /></a>
        </section>
        <section className="card">
          <CardHeader title="Clinical & Treatment" />
          <p className="soft-copy">The Basic Treatment Guide lives inside the EMS area, where you asked for it.</p>
          <a className="primary-link" href={links.treatment} target="_blank" rel="noreferrer">Open Basic Treatment Guide <ExternalLink size={16} /></a>
        </section>
      </div>
    </SubPage>
  );
}

function LinksPage({ links, setLinks, navigate }) {
  return (
    <SubPage title="Dashboard Links" onHome={() => navigate("home")}>
      <section className="card link-editor">
        <CardHeader title="Edit Where Tiles Open" />
        {Object.entries(links).map(([key, value]) => (
          <label key={key}>
            <span>{labelForLink(key)}</span>
            <input value={value} onChange={(event) => setLinks((current) => ({ ...current, [key]: event.target.value }))} />
          </label>
        ))}
      </section>
    </SubPage>
  );
}

function SubPage({ title, onHome, children }) {
  return (
    <div className="sub-page">
      <div className="sub-header">
        <button onClick={onHome}><Home size={16} /> Home</button>
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function CardHeader({ title, note, action }) {
  return (
    <header className="card-header">
      <div><span className="leaf-mark">◆</span><h3>{title}</h3></div>
      {note && <em>{note}</em>}
      {action}
    </header>
  );
}

function DataRows({ rows, empty, render }) {
  if (!rows.length) return <p className="empty">{empty}</p>;
  return <div className="data-rows">{rows.map((row, index) => <div className="data-row" key={`${row.name}-${index}`}>{render(row)}</div>)}</div>;
}

function DecorScene() {
  return (
    <div className="decor-scene" aria-hidden="true">
      <div className="window"><span /><span /></div>
      <div className="book-stack"><i /> <i /> <i /></div>
      <div className="candle"><span /></div>
      <div className="plant plant-one" />
      <div className="plant plant-two" />
    </div>
  );
}

function ModalHost(props) {
  const { modal, close, setTodayTasks, setTodoLists, projectUpdates, setProjectUpdates, currently, setCurrently } = props;
  if (modal.type === "message") return <Modal title={modal.title} close={close}><p>{modal.text}</p></Modal>;
  if (modal.type === "todayTask") return <TextModal title={modal.task ? "Edit Today task" : "Add Today task"} initial={modal.task?.text || ""} close={close} onSave={(text) => saveTodayTask(text, modal.task, setTodayTasks)} onDelete={modal.task ? () => removeToday(modal.task.id, setTodayTasks) : null} />;
  if (modal.type === "todoList") return <TextModal title={modal.list ? "Edit list" : "Create list"} initial={modal.list?.title || ""} close={close} onSave={(title) => saveList(title, modal.list, setTodoLists)} onDelete={modal.list ? () => removeList(modal.list.id, setTodoLists) : null} />;
  if (modal.type === "listItem") return <TextModal title={modal.item ? "Edit item" : "Add item"} initial={modal.item?.text || ""} close={close} onSave={(text) => saveListItem(modal.listId, text, modal.item, setTodoLists)} onDelete={modal.item ? () => removeListItem(modal.listId, modal.item.id, setTodoLists) : null} />;
  if (modal.type === "projectUpdates") return <ProjectModal updates={projectUpdates} close={close} onSave={setProjectUpdates} />;
  if (modal.type === "currently") return <CurrentlyModal currently={currently} close={close} onSave={setCurrently} />;
  return null;
}

function Modal({ title, close, children }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal">
        <header><h3>{title}</h3><button onClick={close}><X size={18} /></button></header>
        {children}
      </section>
    </div>
  );
}

function TextModal({ title, initial, close, onSave, onDelete }) {
  const [value, setValue] = useState(initial);
  return (
    <Modal title={title} close={close}>
      <label className="modal-field">Text<input value={value} onChange={(event) => setValue(event.target.value)} autoFocus /></label>
      <div className="modal-actions">
        {onDelete && <button className="danger" onClick={() => { onDelete(); close(); }}>Delete</button>}
        <button onClick={close}>Cancel</button>
        <button className="save" onClick={() => { if (value.trim()) { onSave(value.trim()); close(); } }}>Save</button>
      </div>
    </Modal>
  );
}

function ProjectModal({ updates, close, onSave }) {
  const [draft, setDraft] = useState(updates);
  return (
    <Modal title="Edit Project Updates" close={close}>
      <div className="project-edit-list">
        {draft.map((item) => (
          <label className="modal-field" key={item.id}>
            {item.label}
            <input value={item.text} onChange={(event) => setDraft((rows) => rows.map((row) => row.id === item.id ? { ...row, text: event.target.value } : row))} placeholder="Leave blank for no update" />
          </label>
        ))}
      </div>
      <div className="modal-actions"><button onClick={close}>Cancel</button><button className="save" onClick={() => { onSave(draft); close(); }}>Save</button></div>
    </Modal>
  );
}

function CurrentlyModal({ currently, close, onSave }) {
  const [draft, setDraft] = useState(currently);
  return (
    <Modal title="Edit Currently" close={close}>
      <label className="modal-field">Title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <label className="modal-field">Subtitle<input value={draft.subtitle} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} /></label>
      <div className="modal-actions"><button onClick={close}>Cancel</button><button className="save" onClick={() => { onSave(draft); close(); }}>Save</button></div>
    </Modal>
  );
}

function saveTodayTask(text, task, setTasks) {
  setTasks((tasks) => task ? tasks.map((item) => item.id === task.id ? { ...item, text } : item) : [...tasks, { id: crypto.randomUUID(), text, done: false }]);
}

function toggleToday(id, setTasks) {
  setTasks((tasks) => tasks.map((task) => task.id === id ? { ...task, done: !task.done } : task));
}

function removeToday(id, setTasks) {
  setTasks((tasks) => tasks.filter((task) => task.id !== id));
}

function saveList(title, list, setLists) {
  setLists((lists) => list ? lists.map((item) => item.id === list.id ? { ...item, title } : item) : [...lists, { id: crypto.randomUUID(), title, items: [] }]);
}

function removeList(id, setLists) {
  setLists((lists) => lists.filter((list) => list.id !== id));
}

function saveListItem(listId, text, item, setLists) {
  setLists((lists) => lists.map((list) => {
    if (list.id !== listId) return list;
    const items = item
      ? list.items.map((entry) => entry.id === item.id ? { ...entry, text } : entry)
      : [...(list.items || []), { id: crypto.randomUUID(), text, done: false }];
    return { ...list, items };
  }));
}

function toggleListItem(listId, itemId, setLists) {
  setLists((lists) => lists.map((list) => list.id === listId
    ? { ...list, items: list.items.map((item) => item.id === itemId ? { ...item, done: !item.done } : item) }
    : list
  ));
}

function removeListItem(listId, itemId, setLists) {
  setLists((lists) => lists.map((list) => list.id === listId
    ? { ...list, items: list.items.filter((item) => item.id !== itemId) }
    : list
  ));
}

function buildSearchItems(links) {
  return [
    { keywords: ["home", "dashboard"], page: "home" },
    { keywords: ["todo", "to do", "tasks", "lists"], page: "todos" },
    { keywords: ["creator", "creators", "cc", "cc todo", "loa", "warnings", "2 warnings"], page: "creators" },
    { keywords: ["ems", "treatment", "medical"], page: "ems" },
    { keywords: ["links", "settings"], page: "links" },
    { keywords: ["full creators dashboard", "cc dashboard"], url: links.creators },
    { keywords: ["ems personal dashboard"], url: links.ems },
    { keywords: ["basic treatment guide", "treatment guide"], url: links.treatment },
    { keywords: ["twitch"], url: links.twitch },
    { keywords: ["youtube", "studio"], url: links.youtube }
  ];
}

function labelForLink(key) {
  return {
    creators: "Creators Dashboard",
    ems: "EMS Personal Dashboard",
    treatment: "Basic Treatment Guide",
    twitch: "Twitch",
    youtube: "YouTube"
  }[key] || key;
}

async function refreshCreatorData() {
  try {
    const response = await fetch(`${CC_API_BASE}/api/homebase-summary`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Summary HTTP ${response.status}`);
    const data = await response.json();
    return {
      loas: normalizeLoas(data.loas),
      warnings: normalizeWarnings(data.warnings),
      status: "Live"
    };
  } catch {
    try {
      const [loas, creators] = await Promise.all([
        fetchJson(`${CC_API_BASE}/api/loas`),
        fetchJson(`${CC_API_BASE}/api/ccs`)
      ]);
      return {
        loas: activeLoasFrom(loas),
        warnings: warningRowsFrom(creators),
        status: "Live via fallback"
      };
    } catch {
      return { loas: [], warnings: [], status: "Creator data unavailable" };
    }
  }
}

function creatorOverviewText(creatorData) {
  if (creatorData.status !== "Live" && creatorData.status !== "Live via fallback") return creatorData.status;
  const loaCount = creatorData.loas.length;
  const warningCount = creatorData.warnings.length;
  return `${loaCount} on LOA • ${warningCount} with 2+ warnings`;
}

function normalizeLoas(rows) {
  return Array.isArray(rows)
    ? rows.map((item) => ({
      name: item.name || item.discord_name || item.discordName || "Unknown creator",
      start: item.start || "",
      end: item.end || ""
    })).sort((a, b) => a.name.localeCompare(b.name))
    : [];
}

function normalizeWarnings(rows) {
  return Array.isArray(rows)
    ? rows.map((item) => ({
      discordId: item.discordId || item.discord_id || item.id || "",
      name: item.name || item.discord_name || item.discordName || item.discordId || item.discord_id || "Unknown creator",
      count: Number(item.count ?? item.warnings ?? item.activeWarnings ?? 0)
    })).filter((item) => item.count >= 2)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    : [];
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function activeLoasFrom(raw) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Object.entries(raw || {}).flatMap(([name, entry]) => {
    const history = Array.isArray(entry?.history) ? entry.history : Array.isArray(entry?.loas) ? entry.loas : entry?.start ? [entry] : [];
    const active = history.find((loa) => {
      const start = parseDate(loa.start);
      const end = parseDate(loa.end);
      return start && end && start <= today && today <= end;
    });
    return active ? [{ name, start: active.start || "", end: active.end || "" }] : [];
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function warningRowsFrom(raw) {
  return Object.entries(raw || {}).flatMap(([discordId, entry]) => {
    const count = Number(entry?.warnings || entry?.activeWarnings || 0);
    if (count < 2) return [];
    return [{ discordId, name: entry.discord_name || entry.discordName || entry.name || discordId, count }];
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function parseDate(value) {
  const text = String(value || "").trim();
  let match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12);
  match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

createRoot(document.getElementById("root")).render(<App />);
