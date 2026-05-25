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
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const sounds = {
      click: [520, 0.08],
      takeoff: [220, 0.25],
      success: [740, 0.18],
      error: [140, 0.22],
      reward: [880, 0.22],
      landing: [330, 0.25]
    };

    const [freq, duration] = sounds[type] || sounds.click;

    osc.type = type === 'error' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.6, ctx.currentTime + duration);

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Sound is optional.
  }
}

function computeRecord({ childName, date, tasks, notes }) {
  const weekStart = mondayOf(date);

  const habitPoints = HABIT_TASKS.reduce((sum, t) => {
    return sum + (tasks[t.key] ? 1 : 0);
  }, 0);

  const schoolPenalty = !isWeekend(date) && !tasks.schoolTaskDone ? 1 : 0;
  const netPoints = habitPoints - schoolPenalty;

  return {
    timestamp: new Date().toISOString(),
    date,
    weekStart,
    childName,
    ...tasks,
    freeMissUsed: false,
    positivePoints: habitPoints,
    penalties: schoolPenalty,
    netPoints,
    computerMinutesEarned: Math.max(netPoints, 0) * 15,
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
  const [date, setDate] = useState(todayISO());
  const [tasks, setTasks] = useState(blankTaskState);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [redeemedToday, setRedeemedToday] = useState(Number(localStorage.getItem(REDEEM_KEY) || 0));
  const [records, setRecords] = useState(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));

  const weekStart = mondayOf(date);
  const weekRecords = useMemo(
    () => records.filter((r) => r.weekStart === weekStart),
    [records, weekStart]
  );

  const weekPoints = weekRecords.reduce((s, r) => s + r.netPoints, 0);
  const weekendMinutes = Math.min(Math.max(weekPoints, 0) * 15, 240);

  const sound = (type) => {
    if (soundEnabled) playSound(type);
  };

  const enterFlight = () => {
    if (!childName.trim()) {
      sound('error');
      setMessage('Write the captain name first.');
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
    setTasks(blankTaskState);
    setNotes('');
    sound('landing');
  };

  const saveDaily = async () => {
    if (!childName.trim()) {
      sound('error');
      setMessage('Captain name is missing. Please enter the flight again.');
      setScreen('login');
      return;
    }

    const rec = computeRecord({ childName, date, tasks, notes });
    const next = [rec, ...records];

    setRecords(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

    const result = await postRecordToSheets(rec);
    setMessage(result.warning || `🛫 Mission completed. You earned ${rec.netPoints} points today.`);
    setTasks(blankTaskState);
    setNotes('');
    sound(rec.netPoints >= 0 ? 'success' : 'error');
  };

  const redeem = (minutes, activity) => {
    const allowed = Math.min(120 - redeemedToday, weekendMinutes);

    if (minutes > allowed) {
      sound('error');
      return setMessage('⛔ Cannot redeem beyond daily or weekend limits.');
    }

    if (minutes === 120 && activity !== 'Flight simulator / piloting') {
      sound('error');
      return setMessage('⛔ A 2-hour block is only allowed for flight simulator / piloting.');
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
          <p className="subtitle">Identify the captain and enter the cockpit.</p>

          <label className="field-label">
            Captain name
            <input
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') enterFlight();
              }}
              placeholder="Write your pilot name"
            />
          </label>

          <button className="primary-btn" onClick={enterFlight}>
            🛫 Start Flight
          </button>

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
          <p className="subtitle">
            Captain {childName || 'Pilot'} · Week start {weekStart}
          </p>
        </div>

        <div className="instrument-panel">
          <div className="gauge">
            <span>Fuel Points</span>
            <strong>{weekPoints}</strong>
          </div>
          <div className="gauge">
            <span>Weekend Time</span>
            <strong>{weekendMinutes} min</strong>
          </div>
        </div>

        <div className="top-actions">
          <button className="secondary-btn" onClick={() => setSoundEnabled(!soundEnabled)}>
            {soundEnabled ? '🔊 Sound On' : '🔇 Sound Off'}
          </button>
          <button className="logout-btn" onClick={exitFlight}>
            🛬 Exit Flight
          </button>
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
            <span>Altitude: Ready</span>
            <span>Weather: Clear</span>
            <span>{isWeekend(date) ? 'Weekend mission' : 'Weekday mission'}</span>
          </div>

          <p>
            Each completed habit gives +1 point. The school task does not give points,
            but missing it on a weekday subtracts 1 point.
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
            🛫 Mission Completed
          </button>
        </section>
      )}

      {screen === 'weekly' && (
        <section className="card">
          <h2>📊 Weekly Flight Log</h2>
          <p>Week start: {weekStart}</p>

          <ul className="flight-log">
            {weekRecords.length === 0 && <li>No missions recorded yet.</li>}
            {weekRecords.slice(0, 7).map((r, i) => (
              <li key={i}>
                <strong>{r.date}</strong>
                <span>
                  +{r.positivePoints} / -{r.penalties} = {r.netPoints}
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
          <p>Monday to Friday habits add points. Uncompleted habits no longer subtract points.</p>
          <p>Missing the school task on a weekday subtracts 1 point.</p>
        </section>
      )}

      {screen === 'rules' && (
        <section className="card">
          <h2>📜 Flight Rules</h2>
          <ol className="rules-list">
            <li>Each completed habit gives +1 Fuel Point.</li>
            <li>Uncompleted habit tasks do not subtract points.</li>
            <li>The school task gives no points, but missing it on a weekday subtracts -1.</li>
            <li>Weekend redemptions: 1 point = 15 minutes.</li>
            <li>4 points = 1 hour, max 4 hours per weekend.</li>
            <li>Max 2 hours per day.</li>
            <li>Full 2 hours only for flight simulator / piloting.</li>
            <li>Weekend tasks count toward next week.</li>
          </ol>
        </section>
      )}
    </main>
  );
}
