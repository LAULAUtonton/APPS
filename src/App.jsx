import { useMemo, useState } from 'react';
import { HABIT_TASKS, PROFILE_KEY, REDEEM_KEY, STORAGE_KEY } from './constants';
import { postRecordToSheets } from './sheets';

const todayISO = () => new Date().toISOString().slice(0, 10);
const taskKeyForDate = (date) => `flight-points-tasks-${date}`;

const mondayOf = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
};

const blankTaskState = {
  tidyRoom: false,
  exercise: false,
  typing: false,
  duolingo: false,
  reading: false,
  music: false,
  schoolTaskDone: false
};

function playSound(type = 'click') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);

    const tone = (freq, delay, duration, wave = 'triangle') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + delay;

      osc.type = wave;
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.24, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + duration);
    };

    if (type === 'takeoff') {
      [140, 220, 340, 520, 760].forEach((f, i) => tone(f, i * 0.12, 0.16, 'sawtooth'));
      return;
    }

    if (type === 'landing') {
      [620, 420, 260, 160].forEach((f, i) => tone(f, i * 0.12, 0.16));
      return;
    }

    if (type === 'success') {
      [523, 659, 784].forEach((f, i) => tone(f, i * 0.1, 0.14));
      return;
    }

    if (type === 'reward') {
      [659, 784, 988, 1318].forEach((f, i) => tone(f, i * 0.1, 0.16));
      return;
    }

    if (type === 'error') {
      tone(180, 0, 0.2, 'square');
      tone(120, 0.18, 0.24, 'square');
      return;
    }

    tone(620, 0, 0.08);
  } catch {
    // optional
  }
}

function computeRecord({ childName, date, tasks, notes }) {
  const weekStart = mondayOf(date);
  const completedTasks = HABIT_TASKS.filter((t) => tasks[t.key]);
  const completedTaskLabels = completedTasks.map((t) => t.label);
  const dailyPoints = completedTasks.length;

  return {
    timestamp: new Date().toISOString(),
    date,
    weekStart,
    childName,
    completedTaskLabels,
    ...tasks,
    positivePoints: dailyPoints,
    penalties: 0,
    netPoints: dailyPoints,
    computerMinutesEarned: dailyPoints * 15,
    computerMinutesRedeemed: 0,
    notes
  };
}

const screenLabels = {
  dashboard: '🛫 Flight Deck',
  checklist: '✅ Mission Checklist',
  weekly: '📊 Flight Log',
  redeem: '🎮 Rewards',
  admin: '🧑‍✈️ Control Tower',
  rules: '📜 Rules'
};

export default function App() {
  const [childName, setChildName] = useState('');
  const [screen, setScreen] = useState('login');
  const [date, setDateState] = useState(todayISO());
  const [tasks, setTasksState] = useState(() => {
    return JSON.parse(localStorage.getItem(taskKeyForDate(todayISO())) || JSON.stringify(blankTaskState));
  });
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [redeemedToday, setRedeemedToday] = useState(Number(localStorage.getItem(REDEEM_KEY) || 0));
  const [records, setRecords] = useState(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));

  const weekStart = mondayOf(date);

  const setDate = (newDate) => {
    setDateState(newDate);
    const savedTasks = JSON.parse(
      localStorage.getItem(taskKeyForDate(newDate)) || JSON.stringify(blankTaskState)
    );
    setTasksState(savedTasks);
  };

  const setTasks = (nextTasks) => {
    setTasksState(nextTasks);
    localStorage.setItem(taskKeyForDate(date), JSON.stringify(nextTasks));
  };

  const cleanRecordPoints = (r) => {
    const points = HABIT_TASKS.reduce((sum, t) => sum + (r[t.key] ? 1 : 0), 0);
    return {
      ...r,
      positivePoints: points,
      penalties: 0,
      netPoints: points,
      completedTaskLabels: r.completedTaskLabels || HABIT_TASKS.filter((t) => r[t.key]).map((t) => t.label)
    };
  };

  const weekRecords = useMemo(
    () =>
      records
        .filter((r) => r.weekStart === weekStart && r.childName === childName)
        .map(cleanRecordPoints)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [records, weekStart, childName]
  );

  const weekPoints = weekRecords.reduce((sum, r) => sum + Number(r.netPoints || 0), 0);
  const weekendMinutes = Math.min(weekPoints * 15, 240);

  const sound = (type) => {
    if (soundEnabled) playSound(type);
  };

  const enterFlight = () => {
    if (!childName.trim()) {
      setMessage('Write the captain name first.');
      sound('error');
      return;
    }

    localStorage.setItem(PROFILE_KEY, childName.trim());
    setChildName(childName.trim());
    setMessage('');
    setScreen('dashboard');
    sound('takeoff');
  };

  const exitFlight = () => {
    localStorage.removeItem(PROFILE_KEY);
    setChildName('');
    setScreen('login');
    setMessage('');
    sound('landing');
  };

  const saveDaily = async () => {
    if (!childName.trim()) {
      setMessage('Captain name is missing. Please enter the flight again.');
      setScreen('login');
      sound('error');
      return;
    }

    const rec = computeRecord({ childName, date, tasks, notes });

    const next = [
      rec,
      ...records.filter((r) => !(r.date === date && r.childName === childName))
    ];

    const newWeekRecords = next
      .filter((r) => r.weekStart === weekStart && r.childName === childName)
      .map(cleanRecordPoints);

    const newWeeklyTotal = newWeekRecords.reduce(
      (sum, r) => sum + Number(r.netPoints || 0),
      0
    );

    setRecords(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem(taskKeyForDate(date), JSON.stringify(tasks));

    const result = await postRecordToSheets(rec);

    setMessage(
      result.warning ||
        `🛫 Daily log saved. Today: ${rec.netPoints} points. Weekly total: ${newWeeklyTotal} points.`
    );

    sound('success');
  };

  const redeem = (minutes, activity) => {
    const allowed = Math.min(120 - redeemedToday, weekendMinutes);

    if (minutes > allowed) {
      setMessage('⛔ Cannot redeem beyond daily or weekend limits.');
      sound('error');
      return;
    }

    const redeemed = redeemedToday + minutes;
    setRedeemedToday(redeemed);
    localStorage.setItem(REDEEM_KEY, String(redeemed));
    setMessage(`🎮 Redeemed ${minutes} minutes for ${activity}.`);
    sound('reward');
  };

  if (screen === 'login') {
    return (
      <section className="wrap aviation-bg">
        <div className="hero-card">
          <div className="plane-badge">✈️</div>
          <h1>Flight Points</h1>
          <p className="subtitle">Identify the captain and prepare for takeoff.</p>

          <label className="field-label">
            Captain name
            <input
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && enterFlight()}
              placeholder="Write your pilot name"
            />
          </label>

          <button className="primary-btn" onClick={enterFlight}>🛫 Start Flight</button>

          <button
            className="secondary-btn"
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              playSound('click');
            }}
          >
            {soundEnabled ? '🔊 Sound On' : '🔇 Sound Off'}
          </button>

          {message && <div className="msg">{message}</div>}
        </div>
      </section>
    );
  }

  return (
    <main className="wrap aviation-bg">
      <header className="cockpit-header">
        <div>
          <p className="eyebrow">✈️ Pilot control panel</p>
          <h1>Flight Deck</h1>
          <p className="subtitle">Captain {childName} · Week start {weekStart}</p>
        </div>

        <div className="instrument-panel">
          <div className="gauge">
            <span>Weekly Points</span>
            <strong>{weekPoints}</strong>
          </div>
          <div className="gauge">
            <span>Weekend Time</span>
            <strong>{weekendMinutes} min</strong>
          </div>
        </div>

        <div className="top-actions">
          <button
            className="secondary-btn"
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              playSound('click');
            }}
          >
            {soundEnabled ? '🔊 Sound On' : '🔇 Sound Off'}
          </button>

          <button className="logout-btn" onClick={exitFlight}>🛬 Exit Flight</button>
        </div>
      </header>

      <nav className="tabs">
        {Object.entries(screenLabels).map(([key, label]) => (
          <button
            key={key}
            className={screen === key ? 'active' : ''}
            onClick={() => {
              setScreen(key);
              sound('click');
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {message && <div className="msg">{message}</div>}

      {screen === 'dashboard' && (
        <section className="card runway-card">
          <h2>🛬 Daily Cockpit</h2>

          <label className="field-label">
            Mission date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <div className="status-strip">
            <span>Daily checklist is saved</span>
            <span>Weekly points: {weekPoints}</span>
            <span>New checklist every midnight</span>
          </div>

          <p>
            Each completed task gives +1 point. The checklist stays marked for the day.
            Tomorrow starts with a clean checklist.
          </p>
        </section>
      )}

      {screen === 'checklist' && (
        <section className="card">
          <h2>✅ Mission Checklist</h2>

          {HABIT_TASKS.map((t) => (
            <label key={t.key} className="check">
              <input
                type="checkbox"
                checked={tasks[t.key]}
                onChange={(e) => {
                  setTasks({ ...tasks, [t.key]: e.target.checked });
                  sound('click');
                }}
              />
              <span>{t.label}</span>
            </label>
          ))}

          <label className="check special">
            <input
              type="checkbox"
              checked={tasks.schoolTaskDone}
              onChange={(e) => {
                setTasks({ ...tasks, schoolTaskDone: e.target.checked });
                sound('click');
              }}
            />
            <span>School task / check school plan</span>
          </label>

          <textarea
            placeholder="Flight log notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <button className="primary-btn" onClick={saveDaily}>
            🛫 Save Daily Flight Log
          </button>
        </section>
      )}

      {screen === 'weekly' && (
        <section className="card">
          <h2>📊 Weekly Flight Log</h2>
          <p>Week start: {weekStart}</p>
          <p>Weekly total: {weekPoints} points</p>

          <ul className="flight-log">
            {weekRecords.length === 0 && <li>No missions recorded yet.</li>}

            {weekRecords.map((r, i) => (
              <li key={`${r.date}-${i}`}>
                <strong>{r.date}</strong>
                <span>
                  {r.completedTaskLabels?.join(', ') || 'No tasks'} · {r.netPoints} points
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {screen === 'redeem' && (
        <section className="card">
          <h2>🎮 Weekend Rewards</h2>

          <div className="instrument-panel">
            <div className="gauge">
              <span>Available</span>
              <strong>{weekendMinutes} min</strong>
            </div>
            <div className="gauge">
              <span>Used Today</span>
              <strong>{redeemedToday} / 120</strong>
            </div>
          </div>

          <div className="grid">
            <button onClick={() => redeem(30, 'Coding game')}>30 min Coding Game</button>
            <button onClick={() => redeem(60, 'Minecraft build')}>60 min Minecraft</button>
            <button onClick={() => redeem(120, 'Flight simulator / piloting')}>
              120 min Flight Simulator
            </button>
          </div>

          <p className="warning">No Reels, Shorts, or infinite scrolling feeds.</p>
        </section>
      )}

      {screen === 'admin' && (
        <section className="card">
          <h2>🧑‍✈️ Control Tower</h2>
          <p>Total flight log records: {records.length}</p>
          <p>Current week starts on: {weekStart}</p>
          <p>Current weekly points: {weekPoints}</p>

          <button
            className="logout-btn"
            onClick={() => {
              localStorage.removeItem(STORAGE_KEY);
              setRecords([]);
              setMessage('Flight log cleared.');
              sound('landing');
            }}
          >
            🧹 Clear Flight Log
          </button>
        </section>
      )}

      {screen === 'rules' && (
        <section className="card">
          <h2>📜 Flight Rules</h2>
          <ol className="rules-list">
            <li>The weekly counter starts every Monday.</li>
            <li>Each completed task gives +1 Fuel Point.</li>
            <li>The checklist stays marked during the same day.</li>
            <li>At midnight, a new clean checklist starts.</li>
            <li>If you save again on the same day, the daily log is updated.</li>
            <li>The weekly total is the sum of the saved daily logs.</li>
            <li>Weekend redemptions: 1 point = 15 minutes.</li>
            <li>Max 4 hours per weekend and 2 hours per day.</li>
          </ol>
        </section>
      )}
    </main>
  );
}
