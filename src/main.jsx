import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle, ArrowLeft, CalendarDays, Check, ClipboardList, CloudSun, Edit3,
  ExternalLink, FileText, GripVertical, Heart, Home, Lightbulb, Link, Music,
  Pause, Play, Plus, Save, Settings, SkipBack, SkipForward, Star, Trash2, X
} from "lucide-react";
import "./styles.css";

const DEFAULT_TAGS = [
  { id: "cc", name: "CC" },
  { id: "mod", name: "Mod" },
  { id: "ems", name: "EMS" },
  { id: "personal", name: "Personal" }
];

const DEFAULT_TASKS = [
  { id: 1, text: "Review CC applications", done: false, tagId: "cc" },
  { id: 2, text: "Monthly achievements update", done: false, tagId: "cc" },
  { id: 3, text: "Plan Creator Spotlight", done: true, tagId: "cc" },
  { id: 4, text: "Update discord announcements", done: true, tagId: "mod" },
  { id: 5, text: "Check LOA requests", done: false, tagId: "cc" },
  { id: 6, text: "Prepare monthly tickets", done: false, tagId: "cc" },
  { id: 7, text: "Dashboard & stats check", done: false, tagId: "personal" }
];

const DEFAULT_NOTES = [
  { id: 1, title: "Homebase ideas", body: "Keep the dashboard calm, useful and easy to scan.\n\nAdd anything I want to remember here.", updatedAt: Date.now() }
];

const DEFAULT_LINKS = [
  { id: 1, label: "Gmail", url: "https://mail.google.com" },
  { id: 2, label: "Notion", url: "https://www.notion.so" },
  { id: 3, label: "Twitch", url: "https://www.twitch.tv" },
  { id: 4, label: "Canva", url: "https://www.canva.com" },
  { id: 5, label: "Discord", url: "https://discord.com/app" },
  { id: 6, label: "Google Drive", url: "https://drive.google.com" },
  { id: 7, label: "YouTube", url: "https://www.youtube.com" },
  { id: 8, label: "ChatGPT", url: "https://chatgpt.com" }
];

const DEFAULT_BIRTHDAYS = [
  { id: 1, name: "LioraArcher", date: "12 Aug" },
  { id: 2, name: "Sage_Nights", date: "16 Aug" },
  { id: 3, name: "RowanTheWise", date: "21 Aug" },
  { id: 4, name: "KaiOnDuty", date: "28 Aug" }
];

const DEFAULT_BRAIN = ["New alert ideas", "Halloween event planning", "Update CC guide", "Karaoke night?", "More lo-fi overlays"];

const NAV = [
  [Home, "Home", "home"], [FileText, "Notes", "notes"], [ClipboardList, "Tasks", "tasks"],
  [CalendarDays, "Planner", "home"], [Link, "Links", "links"], [Music, "Music", "music"], [Settings, "Settings", "settings"]
];

function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) : initialValue; } catch { return initialValue; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }, [key, value]);
  return [value, setValue];
}

function parseDMY(value) {
  const [d, m, y] = String(value || "").split("/").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d, 23, 59, 59);
}

function App() {
  const [page, setPage] = useState("home");
  const [activeNav, setActiveNav] = useState("Home");
  const [now, setNow] = useState(new Date());
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [tasks, setTasks] = usePersistentState("homebase.tasks", DEFAULT_TASKS);
  const [taskTags, setTaskTags] = usePersistentState("homebase.taskTags", DEFAULT_TAGS);
  const [notes, setNotes] = usePersistentState("homebase.notes", DEFAULT_NOTES);
  const [quickLinks, setQuickLinks] = usePersistentState("homebase.links", DEFAULT_LINKS);
  const [birthdays, setBirthdays] = usePersistentState("homebase.birthdays", DEFAULT_BIRTHDAYS);
  const [brainNotes, setBrainNotes] = usePersistentState("homebase.brain", DEFAULT_BRAIN);
  const [spotifyConfig, setSpotifyConfig] = usePersistentState("homebase.spotifyConfig", { clientId: "" });
  const [spotifyPlayback, setSpotifyPlayback] = useState(null);
  const [spotifyStatus, setSpotifyStatus] = useState("Not connected");
  const [isPlaying, setIsPlaying] = useState(true);
  const [trackSeconds, setTrackSeconds] = useState(83);
  const [ccData, setCcData] = useState({ loas: [], warnings: [], status: "Loading CC data…" });
  const refs = useRef({});

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!isPlaying) return; const timer = setInterval(() => setTrackSeconds((s) => (s + 1) % 166), 1000); return () => clearInterval(timer); }, [isPlaying]);

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
        const today = new Date(); today.setHours(0,0,0,0);
        const loas = Object.entries(loaJson || {}).map(([name, item]) => ({ name, start:item.start, end:item.end, reason:item.reason||"" }))
          .filter((item) => { const end=parseDMY(item.end); return end && end >= today; });
        const warnings = Object.values(ccJson || {}).filter((item) => Number(item.warnings || 0) >= 2)
          .map((item) => ({ name:item.discord_name || item.name || "Unknown creator", count:Number(item.warnings || 0) }));
        if (!cancelled) setCcData({ loas, warnings, status:"Live from CC Bot" });
      } catch (error) {
        console.error(error); if (!cancelled) setCcData({ loas:[], warnings:[], status:"CC data unavailable" });
      }
    }
    loadCcData(); const timer=setInterval(loadCcData, 5*60*1000);
    return () => { cancelled=true; clearInterval(timer); };
  }, []);

  useEffect(() => {
    handleSpotifyCallback(spotifyConfig.clientId, setSpotifyStatus).then((didHandle) => {
      if (didHandle) window.history.replaceState({}, "", spotifyRedirectUri());
    });
  }, [spotifyConfig.clientId]);

  useEffect(() => {
    let stopped = false;
    async function updatePlayback() {
      const token = await getSpotifyAccessToken(spotifyConfig.clientId);
      if (!token) { if (!stopped) setSpotifyStatus(spotifyConfig.clientId ? "Ready to connect" : "Add your Spotify Client ID"); return; }
      try {
        const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", { headers:{ Authorization:`Bearer ${token}` } });
        if (res.status === 204) { if (!stopped) { setSpotifyPlayback(null); setSpotifyStatus("Connected · nothing playing"); } return; }
        if (!res.ok) throw new Error(`Spotify ${res.status}`);
        const data = await res.json();
        if (!stopped) { setSpotifyPlayback(data); setSpotifyStatus("Connected"); }
      } catch (error) { console.error(error); if (!stopped) setSpotifyStatus("Spotify connection needs attention"); }
    }
    updatePlayback(); const timer=setInterval(updatePlayback, 10000);
    return () => { stopped=true; clearInterval(timer); };
  }, [spotifyConfig.clientId, page]);

  const dayName = now.toLocaleDateString("en-GB", { weekday:"long" });
  const dateLabel = now.toLocaleDateString("en-GB", { day:"2-digit", month:"long", year:"numeric" });
  const timeLabel = now.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit", hour12:false });
  const progress = Math.min(100, (trackSeconds/165)*100);

  function navigate(label, target) {
    setActiveNav(label);
    if (target === "settings") { alert("Homebase syncs through Firebase when you're signed in with Google. Spotify authorization stays on each device for security."); return; }
    setPage(target);
    window.scrollTo({ top:0, behavior:"smooth" });
  }

  function addTask() {
    const text=prompt("Task name:"); if (!text?.trim()) return;
    const tagId=promptForTag(taskTags, "Choose tag", taskTags[0]?.id || "");
    setTasks((c)=>[...c,{ id:Date.now(), text:text.trim(), done:false, tagId }]);
  }
  function editTask(id) {
    const task=tasks.find((t)=>t.id===id); if (!task) return;
    const text=prompt("Edit task (leave blank to delete):",task.text); if (text===null) return;
    if (!text.trim()) return setTasks((c)=>c.filter((t)=>t.id!==id));
    const tagId=promptForTag(taskTags,"Choose tag",task.tagId || "");
    setTasks((c)=>c.map((t)=>t.id===id?{...t,text:text.trim(),tagId}:t));
  }
  function dropTask(targetId) {
    if (draggedTaskId==null || draggedTaskId===targetId) return;
    setTasks((current)=>{ const from=current.findIndex((t)=>t.id===draggedTaskId); const to=current.findIndex((t)=>t.id===targetId); if(from<0||to<0)return current; const next=[...current]; const [moved]=next.splice(from,1); next.splice(to,0,moved); return next; });
    setDraggedTaskId(null);
  }
  function addTag() { const name=prompt("New tag name:"); if(!name?.trim())return; setTaskTags((c)=>[...c,{id:`tag-${Date.now()}`,name:name.trim()}]); }
  function editTag(id) { const tag=taskTags.find((t)=>t.id===id); if(!tag)return; const name=prompt("Rename tag:",tag.name); if(!name?.trim())return; setTaskTags((c)=>c.map((t)=>t.id===id?{...t,name:name.trim()}:t)); }
  function deleteTag(id) { if(!confirm("Remove this tag? Tasks using it will become untagged."))return; setTaskTags((c)=>c.filter((t)=>t.id!==id)); setTasks((c)=>c.map((t)=>t.tagId===id?{...t,tagId:""}:t)); }
  function editBrainDump() { const value=prompt("Brain Dump — one note per line:",brainNotes.join("\n")); if(value===null)return; setBrainNotes(value.split("\n").map((v)=>v.trim()).filter(Boolean)); }
  function addBirthday() { const name=prompt("Name:"); if(!name?.trim())return; const date=prompt("Birthday:","12 Aug")||""; setBirthdays((c)=>[...c,{id:Date.now(),name:name.trim(),date:date.trim()}]); }
  function editBirthday(id) { const item=birthdays.find((b)=>b.id===id); if(!item)return; const name=prompt("Name (leave blank to delete):",item.name); if(name===null)return; if(!name.trim())return setBirthdays((c)=>c.filter((b)=>b.id!==id)); const date=prompt("Birthday:",item.date)??item.date; setBirthdays((c)=>c.map((b)=>b.id===id?{...b,name:name.trim(),date:date.trim()}:b)); }

  return <main className="shell" ref={(n)=>{refs.current.top=n;}}>
    <Sidebar activeNav={activeNav} onNavigate={navigate}/>
    <section className="page-shell">
      {page === "home" && <HomePage {...{now,dayName,dateLabel,timeLabel,tasks,setTasks,draggedTaskId,setDraggedTaskId,dropTask,editTask,addTask,birthdays,addBirthday,editBirthday,ccData,brainNotes,editBrainDump,isPlaying,setIsPlaying,trackSeconds,setTrackSeconds,progress,spotifyPlayback}} />}
      {page === "notes" && <NotesPage notes={notes} setNotes={setNotes}/>} 
      {page === "tasks" && <TasksPage tasks={tasks} setTasks={setTasks} tags={taskTags} addTag={addTag} editTag={editTag} deleteTag={deleteTag} addTask={addTask} editTask={editTask}/>} 
      {page === "links" && <LinksPage links={quickLinks} setLinks={setQuickLinks}/>} 
      {page === "music" && <MusicPage config={spotifyConfig} setConfig={setSpotifyConfig} playback={spotifyPlayback} status={spotifyStatus}/>} 
    </section>
  </main>;
}

function Sidebar({activeNav,onNavigate}) {
  return <aside className="sidebar"><nav>{NAV.map(([Icon,label,target])=><button key={label} className={activeNav===label?"nav-item active":"nav-item"} onClick={()=>onNavigate(label,target)}><Icon size={24}/><span>{label}</span></button>)}</nav></aside>;
}

function PageHeader({ icon:Icon, title, subtitle, action }) {
  return <header className="subpage-header"><div><span className="subpage-icon"><Icon size={24}/></span><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div></div>{action}</header>;
}

function NotesPage({notes,setNotes}) {
  const [selected,setSelected]=useState(notes[0]?.id || null);
  const current=notes.find((n)=>n.id===selected) || null;
  function addNote(){ const note={id:Date.now(),title:"Untitled note",body:"",updatedAt:Date.now()}; setNotes((c)=>[note,...c]); setSelected(note.id); }
  function update(field,value){ setNotes((c)=>c.map((n)=>n.id===selected?{...n,[field]:value,updatedAt:Date.now()}:n)); }
  function remove(){ if(!current||!confirm("Delete this note?"))return; setNotes((c)=>c.filter((n)=>n.id!==current.id)); setSelected(notes.find((n)=>n.id!==current.id)?.id||null); }
  return <div className="subpage notebook-page"><PageHeader icon={FileText} title="Notes" subtitle="Your notebook" action={<button className="primary-btn" onClick={addNote}><Plus size={17}/> New note</button>}/><div className="notebook-layout"><aside className="note-index">{notes.map((n)=><button key={n.id} className={selected===n.id?"note-tab active":"note-tab"} onClick={()=>setSelected(n.id)}><strong>{n.title||"Untitled"}</strong><small>{new Date(n.updatedAt||Date.now()).toLocaleDateString("en-GB")}</small></button>)}</aside><section className="paper-sheet">{current?<><div className="paper-tools"><span>Notebook</span><button onClick={remove}><Trash2 size={17}/></button></div><input className="note-title-input" value={current.title} onChange={(e)=>update("title",e.target.value)} placeholder="Note title"/><textarea className="note-body-input" value={current.body} onChange={(e)=>update("body",e.target.value)} placeholder="Write anything…"/></>:<div className="empty-page">Create a note to start writing.</div>}</section></div></div>;
}

function TasksPage({tasks,setTasks,tags,addTag,editTag,deleteTag,addTask,editTask}) {
  return <div className="subpage"><PageHeader icon={ClipboardList} title="Tasks & Tags" subtitle="Manage the tags used by your Home to-do list" action={<button className="primary-btn" onClick={addTask}><Plus size={17}/> Add task</button>}/><div className="management-grid"><section className="manage-panel"><div className="manage-title"><h2>Tags</h2><button onClick={addTag}><Plus size={16}/> Add tag</button></div><div className="tag-manager">{tags.map((tag)=><div className="tag-manage-row" key={tag.id}><span className={`task-tag tag-${tag.id}`}>{tag.name}</span><div><button onClick={()=>editTag(tag.id)}><Edit3 size={16}/></button><button onClick={()=>deleteTag(tag.id)}><Trash2 size={16}/></button></div></div>)}</div></section><section className="manage-panel"><div className="manage-title"><h2>To-do items</h2><span>{tasks.length} tasks</span></div><div className="manage-task-list">{tasks.map((task)=>{const tag=tags.find((t)=>t.id===task.tagId);return <div className="manage-task-row" key={task.id}><button className="check" onClick={()=>setTasks((c)=>c.map((t)=>t.id===task.id?{...t,done:!t.done}:t))}>{task.done&&<Check size={14}/>}</button><button className={task.done?"done-text":""} onClick={()=>editTask(task.id)}>{task.text}</button>{tag&&<span className={`task-tag tag-${tag.id}`}>{tag.name}</span>}</div>})}</div></section></div></div>;
}

function LinksPage({links,setLinks}) {
  function add(){ const label=prompt("Link name:"); if(!label?.trim())return; let url=prompt("Website URL:","https://")||""; if(!url.trim())return; if(!/^https?:\/\//i.test(url))url=`https://${url}`; setLinks((c)=>[...c,{id:Date.now(),label:label.trim(),url:url.trim()}]); }
  function edit(item){ const label=prompt("Link name (leave blank to delete):",item.label); if(label===null)return; if(!label.trim())return setLinks((c)=>c.filter((x)=>x.id!==item.id)); let url=prompt("Website URL:",item.url)??item.url; if(!/^https?:\/\//i.test(url))url=`https://${url}`; setLinks((c)=>c.map((x)=>x.id===item.id?{...x,label:label.trim(),url:url.trim()}:x)); }
  return <div className="subpage"><PageHeader icon={Link} title="Quick Links" subtitle="Your shortcuts, all in one place" action={<button className="primary-btn" onClick={add}><Plus size={17}/> Add link</button>}/><div className="links-grid">{links.map((item)=><article className="link-card" key={item.id}><button className="link-open" onClick={()=>window.open(item.url,"_blank","noopener,noreferrer")}><SiteIcon url={item.url}/><div><strong>{item.label}</strong><small>{safeHost(item.url)}</small></div><ExternalLink size={18}/></button><button className="link-edit" onClick={()=>edit(item)}><Edit3 size={16}/> Edit</button></article>)}</div></div>;
}

function MusicPage({config,setConfig,playback,status}) {
  const [draft,setDraft]=useState(config.clientId||"");
  const item=playback?.item;
  async function connect(){ if(!config.clientId){ alert("Save your Spotify Client ID first."); return; } await startSpotifyLogin(config.clientId); }
  function disconnect(){ clearSpotifyTokens(); window.location.reload(); }
  return <div className="subpage"><PageHeader icon={Music} title="Music" subtitle="Connect Spotify so Homebase can show what you're listening to"/><div className="spotify-grid"><section className="manage-panel spotify-setup"><h2>Spotify Developer setup</h2><p>Create a Spotify developer app, then paste its <strong>Client ID</strong> here. Do not add a Client Secret to Homebase.</p><label>Client ID<input value={draft} onChange={(e)=>setDraft(e.target.value)} placeholder="Your Spotify Client ID"/></label><label>Redirect URI<input readOnly value={spotifyRedirectUri()}/></label><small>Add that redirect URI exactly to your Spotify app's Redirect URIs.</small><div className="spotify-actions"><button className="primary-btn" onClick={()=>setConfig({clientId:draft.trim()})}><Save size={16}/> Save Client ID</button><button onClick={connect}>Connect Spotify</button><button onClick={disconnect}>Disconnect</button></div><div className="connection-status">{status}</div></section><section className="manage-panel now-playing-large"><h2>Currently playing</h2>{item?<div className="spotify-track">{item.album?.images?.[0]?.url?<img src={item.album.images[0].url} alt=""/>:<div className="spotify-art-placeholder"><Music/></div>}<div><strong>{item.name}</strong><span>{item.artists?.map((a)=>a.name).join(", ")}</span><small>{playback.is_playing?"Playing now":"Paused"}</small></div></div>:<div className="empty-page">Nothing is playing on Spotify right now.</div>}</section></div></div>;
}

function HomePage({dayName,dateLabel,timeLabel,tasks,setTasks,draggedTaskId,setDraggedTaskId,dropTask,editTask,addTask,birthdays,addBirthday,editBirthday,ccData,brainNotes,editBrainDump,isPlaying,setIsPlaying,trackSeconds,setTrackSeconds,progress,spotifyPlayback}) {
  const spotifyItem=spotifyPlayback?.item;
  return <section className="dashboard-grid">
    <section className="panel clock-card"><div className="day-script">{dayName} <Heart size={24}/></div><div className="big-time">{timeLabel}<span></span></div><div className="date-label">{dateLabel}</div><div className="divider"/><div className="weather-line"><CloudSun size={72}/><div><strong>18°C</strong><span>Partly Cloudy</span></div></div><div className="weather-meta">20°C / 14°C &nbsp; 💧 10%</div></section>
    <section className="panel todo-card"><header><div><ClipboardList/><h2>TO DO</h2></div><button onClick={addTask}><Plus size={18}/> Add Task</button></header><div className="task-list">{tasks.map((task)=><div key={task.id} className={task.done?"task-row done":"task-row"} draggable onDragStart={()=>setDraggedTaskId(task.id)} onDragOver={(e)=>e.preventDefault()} onDrop={()=>dropTask(task.id)} onDragEnd={()=>setDraggedTaskId(null)}><GripVertical className="grip" size={17}/><button className="check" onClick={()=>setTasks((c)=>c.map((t)=>t.id===task.id?{...t,done:!t.done}:t))}>{task.done&&<Check size={14}/>}</button><button className="task-text" onClick={()=>editTask(task.id)}>{task.text}</button><button className="star"><Star size={18}/></button></div>)}</div><div className="todo-decor"><span>small<br/>steps,<br/>big impact<br/>♡</span></div></section>
    <section className="panel week-card"><header><div><CalendarDays/><h2>WEEK AT A GLANCE</h2></div></header><div className="week-list">{[["Mon","11","Highlife RP","Medic Mondays","8PM"],["Tue","12","Highlife RP","Trauma Tuesdays","8PM"],["Wed","13","Rest & Glow","","☾"],["Thu","14","Chat's Choice","Witchy Thursdays","8PM"],["Fri","15","Highlife RP","Frantic Fridays","8PM"],["Sat","16","Rest & Glow","","☾"],["Sun","17","Rest & Glow","","☾"]].map(([day,date,title,badge,time])=><div className="week-row" key={day}><div className="week-day"><em>{day}</em><small>{date}</small></div><div className="week-title">{title}</div><div>{badge&&<span className="week-badge">{badge}</span>}</div><strong>{time}</strong></div>)}</div></section>
    <section className="panel birthdays-card"><header><div><span className="cake">♨</span><h2>UPCOMING BIRTHDAYS</h2></div><button onClick={addBirthday}><Plus size={18}/></button></header><div className="people-list">{birthdays.map((b)=><button className="person-row" key={b.id} onClick={()=>editBirthday(b.id)}><span className="avatar-dot">{b.name.slice(0,1)}</span><strong>{b.name}</strong><span>{b.date}</span></button>)}</div><div className="celebrate">✦ &nbsp; Celebrate them! 🎉 &nbsp; ✦</div></section>
    <section className="panel cc-card loa-card"><header><div><span className="palm">🌴</span><h2>CURRENT CC LOA'S</h2></div></header><div className="cc-list">{ccData.loas.length?ccData.loas.map((item)=><div className="cc-row" key={`${item.name}-${item.end}`}><span className="avatar-dot">{item.name.slice(0,1).toUpperCase()}</span><div><strong>{item.name}</strong><small>{item.start} → {item.end}</small></div></div>):<div className="empty-state">No active LOAs</div>}</div><div className="cc-footer">{ccData.loas.length} creator{ccData.loas.length===1?"":"s"} on LOA · {ccData.status}</div></section>
    <section className="panel cc-card warnings-card"><header><div><AlertTriangle/><h2>CC'S WITH 2+ ACTIVE WARNINGS</h2></div></header><div className="cc-list">{ccData.warnings.length?ccData.warnings.map((item)=><div className="cc-row warning" key={item.name}><span className="avatar-dot">{item.name.slice(0,1).toUpperCase()}</span><div><strong>{item.name}</strong><small>{item.count} active warnings</small></div><span className="warning-dot"/></div>):<div className="empty-state">No creators currently have 2+ warnings</div>}</div><div className="cc-footer">◉ &nbsp; Keep an eye out</div></section>
    <button className="panel brain-card" onClick={editBrainDump}><header><div><FileText/><h2>BRAIN DUMP</h2></div></header><div className="sticky-note"><ul>{brainNotes.map((note,i)=><li key={`${note}-${i}`}>{note}</li>)}</ul><Lightbulb size={48}/></div></button>
    <section className="panel music-card"><header><div><Music/><h2>NOW PLAYING</h2></div></header><div className="music-main">{spotifyItem?.album?.images?.[0]?.url?<img className="album-image" src={spotifyItem.album.images[0].url} alt=""/>:<div className="album-art"><span className="sun"/><span className="window"/><span className="desk"/><span className="plant"/></div>}<div className="song-info"><strong>{spotifyItem?.name || "Sleepless Nights"}</strong><span>{spotifyItem?.artists?.map((a)=>a.name).join(", ") || "Lofi Girl"}</span><Heart/></div></div><button className="progress" onClick={(e)=>{const r=e.currentTarget.getBoundingClientRect();setTrackSeconds(Math.round(((e.clientX-r.left)/r.width)*165));}}><span style={{width:`${progress}%`}}/></button><div className="timecodes"><span>{formatSeconds(trackSeconds)}</span><span>02:45</span></div><div className="controls"><span>⤨</span><button onClick={()=>setTrackSeconds((s)=>Math.max(0,s-15))}><SkipBack/></button><button className="play" onClick={()=>setIsPlaying((v)=>!v)}>{isPlaying?<Pause/>:<Play/>}</button><button onClick={()=>setTrackSeconds((s)=>Math.min(165,s+15))}><SkipForward/></button><span>↔</span></div></section>
    <section className="decor-card"><div className="plant-pot">✦</div><div className="book">progress<br/>over<br/>perfection<br/>♡</div><div className="candle">🕯</div><div className="notebook">ideas<br/>in progress<br/>❀</div><div className="lantern">🏮</div></section>
  </section>;
}

function SiteIcon({url}) {
  const [failed,setFailed]=useState(false); const origin=safeOrigin(url);
  return <span className="site-icon">{!failed&&origin?<img src={`${origin}/favicon.ico`} alt="" onError={()=>setFailed(true)}/>:<ExternalLink size={22}/>}</span>;
}
function safeOrigin(url){try{return new URL(url).origin}catch{return ""}}
function safeHost(url){try{return new URL(url).hostname.replace(/^www\./,"")}catch{return url}}
function promptForTag(tags,title,current){ if(!tags.length)return ""; const options=tags.map((t,i)=>`${i+1}. ${t.name}`).join("\n"); const currentIndex=Math.max(0,tags.findIndex((t)=>t.id===current)); const raw=prompt(`${title}:\n${options}`,String(currentIndex+1)); if(raw===null)return current; const idx=Number(raw)-1; return tags[idx]?.id || current || tags[0].id; }
function formatSeconds(value){const m=Math.floor(value/60);const s=String(value%60).padStart(2,"0");return `${m}:${s}`;}

function spotifyRedirectUri(){ return `${window.location.origin}${window.location.pathname}`; }
function base64UrlEncode(bytes){ return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""); }
async function sha256(text){ return new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text))); }
function randomVerifier(){ const bytes=new Uint8Array(64); crypto.getRandomValues(bytes); return base64UrlEncode(bytes); }
async function startSpotifyLogin(clientId){ const verifier=randomVerifier(); const challenge=base64UrlEncode(await sha256(verifier)); const state=crypto.randomUUID(); sessionStorage.setItem("spotify.pkce.verifier",verifier); sessionStorage.setItem("spotify.pkce.state",state); const params=new URLSearchParams({client_id:clientId,response_type:"code",redirect_uri:spotifyRedirectUri(),scope:"user-read-currently-playing user-read-playback-state",code_challenge_method:"S256",code_challenge:challenge,state}); window.location.href=`https://accounts.spotify.com/authorize?${params}`; }
async function handleSpotifyCallback(clientId,setStatus){ const params=new URLSearchParams(window.location.search); const code=params.get("code"); if(!code)return false; const expected=sessionStorage.getItem("spotify.pkce.state"); const returned=params.get("state"); if(expected && returned!==expected){setStatus("Spotify sign-in rejected: state mismatch");return true;} const verifier=sessionStorage.getItem("spotify.pkce.verifier"); if(!clientId||!verifier){setStatus("Spotify setup is missing the Client ID or PKCE verifier");return true;} const body=new URLSearchParams({client_id:clientId,grant_type:"authorization_code",code,redirect_uri:spotifyRedirectUri(),code_verifier:verifier}); const res=await fetch("https://accounts.spotify.com/api/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body}); if(!res.ok){setStatus("Spotify authorization failed");return true;} const data=await res.json(); localStorage.setItem("spotify.accessToken",data.access_token); localStorage.setItem("spotify.refreshToken",data.refresh_token||""); localStorage.setItem("spotify.expiresAt",String(Date.now()+data.expires_in*1000)); sessionStorage.removeItem("spotify.pkce.verifier");sessionStorage.removeItem("spotify.pkce.state");setStatus("Spotify connected");return true; }
async function getSpotifyAccessToken(clientId){ const token=localStorage.getItem("spotify.accessToken"); const expires=Number(localStorage.getItem("spotify.expiresAt")||0); if(token&&Date.now()<expires-60000)return token; const refresh=localStorage.getItem("spotify.refreshToken"); if(!refresh||!clientId)return null; const body=new URLSearchParams({client_id:clientId,grant_type:"refresh_token",refresh_token:refresh}); const res=await fetch("https://accounts.spotify.com/api/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body}); if(!res.ok)return null; const data=await res.json(); localStorage.setItem("spotify.accessToken",data.access_token); if(data.refresh_token)localStorage.setItem("spotify.refreshToken",data.refresh_token); localStorage.setItem("spotify.expiresAt",String(Date.now()+data.expires_in*1000)); return data.access_token; }
function clearSpotifyTokens(){["spotify.accessToken","spotify.refreshToken","spotify.expiresAt"].forEach((k)=>localStorage.removeItem(k));}

createRoot(document.getElementById("root")).render(<App/>);