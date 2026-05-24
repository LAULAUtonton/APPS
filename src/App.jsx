import { useMemo, useState } from 'react';
import { HABIT_TASKS, PROFILE_KEY, REDEEM_KEY, STORAGE_KEY } from './constants';
import { postRecordToSheets } from './sheets';
import { byDateAsc, isWeekend, mondayOf, nextMondayOf, toLocalISODate } from './utils';

const blankTaskState = {
  tidyRoom: false,
  exercise: false,
  typing: false,
  duolingo: false,
  reading: false,
  music: false,
  schoolTaskDone: false
};

const ACTIVITY = {
  CODING: 'coding_game',
  MINECRAFT: 'minecraft_build',
  FLIGHT_SIM: 'flight_sim'
};

function computeRecord({ childName, date, tasks, notes, records }) {
  const recordWeekStart = isWeekend(date) ? nextMondayOf(date) : mondayOf(date);
  const priorWeekRecords = records.filter((r) => r.weekStart === recordWeekStart);
  const positivePoints = HABIT_TASKS.reduce((sum, t) => sum + (tasks[t.key] ? 1 : 0), 0);
  const missedHabits = HABIT_TASKS.filter((t) => !tasks[t.key]).length;

  const freeMissAlreadyUsed = priorWeekRecords.some((r) => r.freeMissUsed);
  let freeMissUsed = freeMissAlreadyUsed;
  let missedPenalties = 0;

  if (!isWeekend(date)) {
    if (missedHabits > 0 && !freeMissAlreadyUsed) {
      freeMissUsed = true;
      missedPenalties = Math.max(missedHabits - 1, 0);
    } else {
      missedPenalties = missedHabits;
    }
  }

  const schoolPenalty = tasks.schoolTaskDone || isWeekend(date) ? 0 : 1;
  const penalties = missedPenalties + schoolPenalty;
  const netPoints = positivePoints - penalties;

  return {
    timestamp: new Date().toISOString(),
    date,
    weekStart: recordWeekStart,
    childName,
    ...tasks,
    freeMissUsed,
    positivePoints,
    penalties,
    netPoints,
    computerMinutesEarned: Math.max(netPoints, 0) * 15,
    computerMinutesRedeemed: 0,
    notes
  };
}

export default function App() {
  const [authName, setAuthName] = useState(localStorage.getItem(PROFILE_KEY) || '');
  const [draftName, setDraftName] = useState(localStorage.getItem(PROFILE_KEY) || '');
  const [activeTab, setActiveTab] = useState(localStorage.getItem('flight-points-tab') || 'dashboard');
  const [date, setDate] = useState(toLocalISODate());
  const [tasks, setTasks] = useState(blankTaskState);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [records, setRecords] = useState(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  const [redeemLedger, setRedeemLedger] = useState(JSON.parse(localStorage.getItem(REDEEM_KEY) || '{}'));

  const selectedWeekStart = mondayOf(date);
  const weekRecords = useMemo(
    () => records.filter((r) => r.weekStart === selectedWeekStart).sort(byDateAsc),
    [records, selectedWeekStart]
  );

  const weekPoints = weekRecords.reduce((s, r) => s + r.netPoints, 0);
  const weekendMinutes = Math.min(Math.max(weekPoints, 0) * 15, 240);
  const usedThisWeekend = useMemo(() => {
    return Object.entries(redeemLedger)
      .filter(([k]) => mondayOf(k) === selectedWeekStart && isWeekend(k))
      .reduce((sum, [, value]) => sum + Number(value || 0), 0);
  }, [redeemLedger, selectedWeekStart]);
  const redeemedToday = Number(redeemLedger[date] || 0);
  const remainingWeekend = Math.max(weekendMinutes - usedThisWeekend, 0);

  const saveDaily = async () => {
    if (isSaving) return;
    if (!authName.trim()) return setMessage('Please enter captain name first.');

    const duplicateIndex = records.findIndex((r) => r.date === date && r.childName === authName.trim());
    const rec = computeRecord({ childName: authName.trim(), date, tasks, notes, records });

    const next = [...records];
    if (duplicateIndex >= 0) next.splice(duplicateIndex, 1, rec);
    else next.unshift(rec);

    setIsSaving(true);
    setRecords(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    const result = await postRecordToSheets(rec);
    setIsSaving(false);

    setMessage(result.warning || (duplicateIndex >= 0 ? 'Mission updated for this date.' : 'Mission completed. Flight log updated!'));
    setTasks(blankTaskState);
    setNotes('');
  };

  const redeem = (minutes, activityId) => {
    if (!isWeekend(date)) return setMessage('Redemption is only allowed on Saturday and Sunday.');
    if (!Number.isFinite(minutes) || minutes <= 0) return setMessage('Minutes must be a valid number greater than zero.');

    const dailyRemaining = Math.max(120 - redeemedToday, 0);
    const allowed = Math.min(dailyRemaining, remainingWeekend);
    if (minutes > allowed) return setMessage('Cannot redeem beyond daily or weekend limits.');
    if (minutes === 120 && activityId !== ACTIVITY.FLIGHT_SIM) return setMessage('2-hour block is only allowed for flight simulator / piloting.');

    const updated = { ...redeemLedger, [date]: redeemedToday + minutes };
    setRedeemLedger(updated);
    localStorage.setItem(REDEEM_KEY, JSON.stringify(updated));
    setMessage(`Redeemed ${minutes} minutes.`);
  };

  if (!authName) {
    return (
      <section className="wrap">
        <h1>✈️ Flight Points</h1>
        <p>Enter captain name</p>
        <input value={draftName} onChange={(e) => setDraftName(e.target.value)} />
        <button
          onClick={() => {
            if (!draftName.trim()) return setMessage('Please type a name first.');
            const clean = draftName.trim();
            localStorage.setItem(PROFILE_KEY, clean);
            setAuthName(clean);
            setMessage('Welcome aboard, Captain!');
          }}
        >Start Flight</button>
        {message && <div className="msg">{message}</div>}
      </section>
    );
  }

  const setTab = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('flight-points-tab', tab);
  };

  return (
    <main className="wrap">
      <header>
        <h1>Captain’s dashboard</h1>
        <p>Fuel Points: {weekPoints} • Weekend Flight Time: {weekendMinutes} min</p>
      </header>
      <nav className="tabs">
        {['dashboard', 'checklist', 'weekly', 'redeem', 'admin', 'rules'].map((s) => (
          <button key={s} className={activeTab === s ? 'active' : ''} onClick={() => setTab(s)}>{s}</button>
        ))}
      </nav>
      {message && <div className="msg">{message}</div>}

      {activeTab === 'dashboard' && <section className="card"><h2>Daily cockpit dashboard</h2><label>Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><p>{isWeekend(date) ? 'Weekend missions count toward next week.' : 'Weekday missions earn points this week.'}</p></section>}
      {activeTab === 'checklist' && <section className="card"><h2>Task checklist</h2>{HABIT_TASKS.map((t)=><label key={t.key} className="check"><input type="checkbox" checked={tasks[t.key]} onChange={(e)=>setTasks({ ...tasks, [t.key]: e.target.checked })}/>{t.label}</label>)}<label className="check special"><input type="checkbox" checked={tasks.schoolTaskDone} onChange={(e)=>setTasks({ ...tasks, schoolTaskDone: e.target.checked })}/>School task / check school plan</label><textarea placeholder="Flight log notes" value={notes} onChange={(e)=>setNotes(e.target.value)} /><button disabled={isSaving} onClick={saveDaily}>{isSaving ? 'Saving...' : 'Mission completed'}</button></section>}
      {activeTab === 'weekly' && <section className="card"><h2>Weekly points summary</h2><p>Week start: {selectedWeekStart}</p><ul>{weekRecords.slice(0,7).map((r,i)=><li key={`${r.date}-${i}`}>{r.date}: +{r.positivePoints} / -{r.penalties} = {r.netPoints}</li>)}</ul></section>}
      {activeTab === 'redeem' && <section className="card"><h2>Weekend computer-time redemption</h2><p>Available this weekend: {weekendMinutes} min (max 240)</p><p>Used this weekend: {usedThisWeekend} min</p><p>Used today: {redeemedToday} / 120 min</p><div className="grid"><button onClick={()=>redeem(30, ACTIVITY.CODING)}>30 min Coding game</button><button onClick={()=>redeem(60, ACTIVITY.MINECRAFT)}>60 min Minecraft</button><button onClick={()=>redeem(120, ACTIVITY.FLIGHT_SIM)}>120 min Flight simulator</button></div><p>No Reels, Shorts, or infinite scrolling feeds.</p></section>}
      {activeTab === 'admin' && <section className="card"><h2>Parent/admin review</h2><p>Total flight log records: {records.length}</p><p>School misses penalize -1 each weekday. One free missed habit task per week.</p></section>}
      {activeTab === 'rules' && <section className="card"><h2>Rules screen</h2><ol><li>Tasks Monday-Friday earn Fuel Points.</li><li>Weekend tasks are allowed and count to the following week.</li><li>School task gives no points, but missing it costs -1 on weekdays.</li><li>One free missed habit task each week (never applies to school task).</li><li>After free miss is used, every missed habit task costs -1.</li><li>1 point = 15 minutes, 4 points = 1 hour.</li><li>Max weekend reward is 4 hours and max daily use is 2 hours.</li><li>Full 2-hour single activity only for flight simulator / piloting.</li></ol></section>}
    </main>
  );
}
