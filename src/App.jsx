import { useMemo, useState } from 'react';
import { HABIT_TASKS, PROFILE_KEY, REDEEM_KEY, STORAGE_KEY } from './constants';
import { postRecordToSheets } from './sheets';

const todayISO = () => new Date().toISOString().slice(0, 10);
const isWeekend = (d) => [0, 6].includes(new Date(d).getDay());
const mondayOf = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
};

const blankTaskState = { tidyRoom: false, exercise: false, typing: false, duolingo: false, reading: false, music: false, schoolTaskDone: false };

function computeRecord({ childName, date, tasks, notes, priorWeekRecords }) {
  const weekStart = mondayOf(date);
  const dailyPositive = HABIT_TASKS.reduce((sum, t) => sum + (tasks[t.key] ? 1 : 0), 0);
  const missedHabits = HABIT_TASKS.filter((t) => !tasks[t.key]).length;
  const previouslyUsedMiss = priorWeekRecords.some((r) => r.freeMissUsed);
  let freeMissUsed = previouslyUsedMiss;
  let missedPenalties = 0;

  if (missedHabits > 0 && !freeMissUsed && !isWeekend(date)) {
    freeMissUsed = true;
    missedPenalties = Math.max(missedHabits - 1, 0);
  } else {
    missedPenalties = !isWeekend(date) ? missedHabits : 0;
  }

  const schoolPenalty = tasks.schoolTaskDone || isWeekend(date) ? 0 : 1;
  const penalties = missedPenalties + schoolPenalty;
  const netPoints = dailyPositive - penalties;
  return {
    timestamp: new Date().toISOString(),
    date,
    weekStart,
    childName,
    ...tasks,
    freeMissUsed,
    positivePoints: dailyPositive,
    penalties,
    netPoints,
    computerMinutesEarned: Math.max(netPoints, 0) * 15,
    computerMinutesRedeemed: 0,
    notes
  };
}

export default function App() {
  const [childName, setChildName] = useState(localStorage.getItem(PROFILE_KEY) || '');
  const [screen, setScreen] = useState(childName ? 'dashboard' : 'login');
  const [date, setDate] = useState(todayISO());
  const [tasks, setTasks] = useState(blankTaskState);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [redeemedToday, setRedeemedToday] = useState(Number(localStorage.getItem(REDEEM_KEY) || 0));
  const [records, setRecords] = useState(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));

  const weekStart = mondayOf(date);
  const weekRecords = useMemo(() => records.filter((r) => r.weekStart === weekStart), [records, weekStart]);
  const weekPoints = weekRecords.reduce((s, r) => s + r.netPoints, 0);
  const weekendMinutes = Math.min(Math.max(weekPoints, 0) * 15, 240);

  const saveDaily = async () => {
    const rec = computeRecord({ childName, date, tasks, notes, priorWeekRecords: weekRecords });
    const next = [rec, ...records];
    setRecords(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    const result = await postRecordToSheets(rec);
    setMessage(result.warning || 'Mission completed. Flight log updated!');
    setTasks(blankTaskState);
    setNotes('');
  };

  const redeem = (minutes, activity) => {
    const allowed = Math.min(120 - redeemedToday, weekendMinutes);
    if (minutes > allowed) return setMessage('Cannot redeem beyond daily or weekend limits.');
    if (minutes === 120 && activity !== 'Flight simulator / piloting') return setMessage('2-hour block is only allowed for flight simulator / piloting.');
    const redeemed = redeemedToday + minutes;
    setRedeemedToday(redeemed);
    localStorage.setItem(REDEEM_KEY, String(redeemed));
    setMessage(`Redeemed ${minutes} minutes for ${activity}.`);
  };

  if (screen === 'login') return <section className="wrap"><h1>✈️ Flight Points</h1><p>Captain name</p><input value={childName} onChange={(e)=>setChildName(e.target.value)} /><button onClick={()=>{localStorage.setItem(PROFILE_KEY, childName);setScreen('dashboard')}}>Start Flight</button></section>;

  return <main className="wrap">
    <header><h1>Captain’s dashboard</h1><p>Fuel Points: {weekPoints} • Weekend Flight Time: {weekendMinutes} min</p></header>
    <nav className="tabs">{['dashboard','checklist','weekly','redeem','admin','rules'].map((s)=><button key={s} className={screen===s?'active':''} onClick={()=>setScreen(s)}>{s}</button>)}</nav>
    {message && <div className="msg">{message}</div>}

    {screen==='dashboard' && <section className="card"><h2>Daily cockpit</h2><label>Date <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} /></label><p>{isWeekend(date)?'Weekend missions count toward next week!':'Weekday missions earn points now.'}</p></section>}

    {screen==='checklist' && <section className="card"><h2>Task checklist</h2>{HABIT_TASKS.map(t=><label key={t.key} className="check"><input type="checkbox" checked={tasks[t.key]} onChange={(e)=>setTasks({...tasks,[t.key]:e.target.checked})}/>{t.label}</label>)}<label className="check special"><input type="checkbox" checked={tasks.schoolTaskDone} onChange={(e)=>setTasks({...tasks,schoolTaskDone:e.target.checked})}/>School task / check school plan</label><textarea placeholder="Flight log notes" value={notes} onChange={(e)=>setNotes(e.target.value)} /><button onClick={saveDaily}>Mission completed</button></section>}

    {screen==='weekly' && <section className="card"><h2>Weekly points summary</h2><p>Week start: {weekStart}</p><ul>{weekRecords.slice(0,7).map((r,i)=><li key={i}>{r.date}: +{r.positivePoints} / -{r.penalties} = {r.netPoints}</li>)}</ul></section>}

    {screen==='redeem' && <section className="card"><h2>Weekend computer-time redemption</h2><p>Available this weekend: {weekendMinutes} min (max 240)</p><p>Used today: {redeemedToday} / 120 min</p><div className="grid"><button onClick={()=>redeem(30,'Coding game')}>30 min Coding game</button><button onClick={()=>redeem(60,'Minecraft build')}>60 min Minecraft</button><button onClick={()=>redeem(120,'Flight simulator / piloting')}>120 min Flight simulator</button></div><p>No Reels, Shorts, or infinite scrolling feeds.</p></section>}

    {screen==='admin' && <section className="card"><h2>Parent/admin review</h2><p>Total flight log records: {records.length}</p><p>School misses penalize -1 each weekday. One free missed habit task per week.</p></section>}

    {screen==='rules' && <section className="card"><h2>Rules screen</h2><ol><li>Tasks Monday-Friday earn Fuel Points.</li><li>Weekend redemptions: 1 point = 15 minutes.</li><li>4 points = 1 hour, max 4 hours per weekend.</li><li>Max 2 hours per day, full 2 hours only for flight simulator / piloting.</li><li>School task gives no points, but missing it costs -1.</li><li>One free missed habit task each week (not school task).</li><li>Weekend tasks count toward next week.</li></ol></section>}
  </main>;
}
