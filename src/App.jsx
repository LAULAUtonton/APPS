import { useEffect, useMemo, useRef, useState } from 'react';
import { HABIT_TASKS, PROFILE_KEY, REDEEM_KEY, STORAGE_KEY } from './constants';
import { postRecordToSheets } from './sheets';

const MINUTES_PER_POINT = 10;
const MAX_WEEKEND_MINUTES = 240;
const MAX_DAILY_REDEEM_MINUTES = 120;

const todayISO = () => new Date().toISOString().slice(0, 10);
const taskKeyForDate = (date) => `flight-points-tasks-${date}`;
const redeemKeyForDate = (date) => `${REDEEM_KEY}-${date}`;

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

const soundFiles = {
  takeoff: './sounds/takeoff.mp3',
  welcome: './sounds/welcome.mp3',
  click: './sounds/click.mp3',
  taskComplete: './sounds/click.mp3',
  success: './sounds/success.mp3',
  reward: './sounds/reward.mp3',
  exit: './sounds/exit.mp3',
  background: './sounds/background.mp3'
};

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
    computerMinutesEarned: dailyPoints * MINUTES_PER_POINT,
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
  const backgroundRef = useRef(null);
  const effectRef = useRef(null);
  const welcomeTimeoutRef = useRef(null);

  const [childName, setChildName] = useState('');
  const [screen, setScreen] = useState('login');
  const [date, setDateState] = useState(todayISO());

  const [tasks, setTasksState] = useState(() =>
    JSON.parse(
      localStorage.getItem(taskKeyForDate(todayISO())) ||
        JSON.stringify(blankTaskState)
    )
  );

  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(false);

  const [redeemedToday, setRedeemedToday] = useState(
    Number(localStorage.getItem(redeemKeyForDate(todayISO())) || 0)
  );

  const [records, setRecords] = useState(
    JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  );

  const weekStart = mondayOf(date);

  useEffect(() => {
    backgroundRef.current = new Audio(soundFiles.background);
    backgroundRef.current.loop = true;
    backgroundRef.current.volume = 0.16;

    return () => {
      if (backgroundRef.current) {
        backgroundRef.current.pause();
      }
    };
  }, []);

  const stopEffect = () => {
    if (effectRef.current) {
      effectRef.current.pause();
      effectRef.current.currentTime = 0;
    }
  };

  const playSound = (type) => {
    if (!soundEnabled) return;

    const file = soundFiles[type];
    if (!file) return;

    stopEffect();

    const audio = new Audio(file);
    audio.volume =
      type === 'takeoff' || type === 'exit' ? 0.6 : 0.45;

    effectRef.current = audio;

    audio.play().catch(() => {});
  };

  const startBackgroundMusic = () => {
    if (!backgroundRef.current) return;

    backgroundRef.current.volume = 0.16;
    backgroundRef.current.loop = true;

    backgroundRef.current.play().catch(() => {});
    setMusicEnabled(true);
  };

  const stopBackgroundMusic = () => {
    if (!backgroundRef.current) return;

    backgroundRef.current.pause();
    backgroundRef.current.currentTime = 0;

    setMusicEnabled(false);
  };

  const toggleMusic = () => {
    if (musicEnabled) {
      stopBackgroundMusic();
    } else {
      startBackgroundMusic();
    }
  };

  const setDate = (newDate) => {
    setDateState(newDate);

    const savedTasks = JSON.parse(
      localStorage.getItem(taskKeyForDate(newDate)) ||
        JSON.stringify(blankTaskState)
    );

    setTasksState(savedTasks);

    setRedeemedToday(
      Number(localStorage.getItem(redeemKeyForDate(newDate)) || 0)
    );
  };

  const setTasks = (nextTasks) => {
    setTasksState(nextTasks);

    localStorage.setItem(
      taskKeyForDate(date),
      JSON.stringify(nextTasks)
    );
  };

  const cleanRecordPoints = (r) => {
    const points = HABIT_TASKS.reduce(
      (sum, t) => sum + (r[t.key] ? 1 : 0),
      0
    );

    return {
      ...r,
      positivePoints: points,
      penalties: 0,
      netPoints: points,
      completedTaskLabels:
        r.completedTaskLabels ||
        HABIT_TASKS.filter((t) => r[t.key]).map((t) => t.label)
    };
  };

  const weekRecords = useMemo(
    () =>
      records
        .filter(
          (r) =>
            r.weekStart === weekStart &&
            r.childName === childName
        )
        .map(cleanRecordPoints)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [records, weekStart, childName]
  );

  const weekPoints = weekRecords.reduce(
    (sum, r) => sum + Number(r.netPoints || 0),
    0
  );

  const weekendMinutes = Math.min(
    weekPoints * MINUTES_PER_POINT,
    MAX_WEEKEND_MINUTES
  );

  const remainingToday = Math.max(
    0,
    MAX_DAILY_REDEEM_MINUTES - redeemedToday
  );

  const enterFlight = () => {
    if (!childName.trim()) {
      setMessage('Write the captain name first.');
      playSound('click');
      return;
    }

    localStorage.setItem(PROFILE_KEY, childName.trim());

    setChildName(childName.trim());
    setMessage('');
    setScreen('dashboard');

    stopBackgroundMusic();

    playSound('takeoff');

    if (welcomeTimeoutRef.current) {
      clearTimeout(welcomeTimeoutRef.current);
    }

    welcomeTimeoutRef.current = setTimeout(() => {
      playSound('welcome');

      welcomeTimeoutRef.current = setTimeout(() => {
        startBackgroundMusic();
      }, 2500);
    }, 1600);
  };

  const exitFlight = () => {
    if (welcomeTimeoutRef.current) {
      clearTimeout(welcomeTimeoutRef.current);
    }

    stopBackgroundMusic();
    stopEffect();

    localStorage.removeItem(PROFILE_KEY);

    setChildName('');
    setScreen('login');
    setMessage('');

    playSound('exit');
  };

  const saveDaily = async () => {
    if (!childName.trim()) {
      setMessage(
        'Captain name is missing. Please enter the flight again.'
      );

      setScreen('login');

      playSound('click');

      return;
    }

    const rec = computeRecord({
      childName,
      date,
      tasks,
      notes
    });

    const next = [
      rec,
      ...records.filter(
        (r) =>
          !(
            r.date === date &&
            r.childName === childName
          )
      )
    ];

    const newWeekRecords = next
      .filter(
        (r) =>
          r.weekStart === weekStart &&
          r.childName === childName
      )
      .map(cleanRecordPoints);

    const newWeeklyTotal = newWeekRecords.reduce(
      (sum, r) => sum + Number(r.netPoints || 0),
      0
    );

    setRecords(next);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(next)
    );

    localStorage.setItem(
      taskKeyForDate(date),
      JSON.stringify(tasks)
    );

    const result = await postRecordToSheets(rec);

    setMessage(
      result.warning ||
        `🛫 Daily log saved. Today: ${rec.netPoints} points. Weekly total: ${newWeeklyTotal} points.`
    );

    playSound('success');
  };

  const redeem = (minutes, activity) => {
    const maxAllowedNow = Math.min(
      remainingToday,
      weekendMinutes
    );

    if (minutes > maxAllowedNow) {
      setMessage(
        '⛔ You cannot redeem more than 2 hours in the same day.'
      );

      playSound('click');

      return;
    }

    const redeemed = redeemedToday + minutes;

    setRedeemedToday(redeemed);

    localStorage.setItem(
      redeemKeyForDate(date),
      String(redeemed)
    );

    setMessage(
      `🎮 Redeemed ${minutes} minutes for ${activity}.`
    );

    playSound('reward');
  };

  if (screen === 'login') {
    return (
      <section className="wrap aviation-bg">
        <div className="hero-card">
          <div className="plane-badge">✈️</div>

          <h1>Flight Points</h1>

          <p className="subtitle">
            Identify the captain and prepare for takeoff.
          </p>

          <label className="field-label">
            Captain name

            <input
              value={childName}
              onChange={(e) =>
                setChildName(e.target.value)
              }
              onKeyDown={(e) =>
                e.key === 'Enter' && enterFlight()
              }
              placeholder="Write your pilot name"
            />
          </label>

          <button
            className="primary-btn"
            onClick={enterFlight}
          >
            🛫 Start Flight
          </button>

          <button
            className="secondary-btn"
            onClick={toggleMusic}
          >
            {musicEnabled
              ? '🎵 Music On'
              : '🎵 Music Off'}
          </button>

          <button
            className="secondary-btn"
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              playSound('click');
            }}
          >
            {soundEnabled
              ? '🔊 Sound On'
              : '🔇 Sound Off'}
          </button>

          {message && (
            <div className="msg">{message}</div>
          )}
        </div>
      </section>
    );
  }

  return (
    <main className="wrap aviation-bg">
      <header className="cockpit-header">
        <div>
          <p className="eyebrow">
            ✈️ Pilot control panel
          </p>

          <h1>Flight Deck</h1>

          <p className="subtitle">
            Captain {childName} · Week start{' '}
            {weekStart}
          </p>
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
            onClick={toggleMusic}
          >
            {musicEnabled
              ? '🎵 Music On'
              : '🎵 Music Off'}
          </button>

          <button
            className="secondary-btn"
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              playSound('click');
            }}
          >
            {soundEnabled
              ? '🔊 Sound On'
              : '🔇 Sound Off'}
          </button>

          <button
            className="logout-btn"
            onClick={exitFlight}
          >
            🛬 Exit Flight
          </button>
        </div>
      </header>

      <nav className="tabs">
        {Object.entries(screenLabels).map(
          ([key, label]) => (
            <button
              key={key}
              className={
                screen === key ? 'active' : ''
              }
              onClick={() => {
                setScreen(key);
                playSound('click');
              }}
            >
              {label}
            </button>
          )
        )}
      </nav>

      {message && (
        <div className="msg">{message}</div>
      )}

      {screen === 'dashboard' && (
        <section className="card runway-card">
          <h2>🛬 Daily Cockpit</h2>

          <label className="field-label">
            Mission date

            <input
              type="date"
              value={date}
              onChange={(e) =>
                setDate(e.target.value)
              }
            />
          </label>

          <div className="status-strip">
            <span>
              Daily checklist is saved
            </span>

            <span>
              Weekly points: {weekPoints}
            </span>

            <span>
              Today redeemed: {redeemedToday} /{' '}
              {MAX_DAILY_REDEEM_MINUTES} min
            </span>
          </div>

          <p>
            Each completed task gives +1 point.
            Each point gives{' '}
            {MINUTES_PER_POINT} minutes.
            Maximum weekend reward:{' '}
            {MAX_WEEKEND_MINUTES} minutes.
            Never more than 2 hours in the
            same day.
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
                  const checked = e.target.checked;

                  setTasks({
                    ...tasks,
                    [t.key]: checked
                  });

                  if (checked) {
                    playSound('taskComplete');
                  }
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
                const checked = e.target.checked;

                setTasks({
                  ...tasks,
                  schoolTaskDone: checked
                });

                if (checked) {
                  playSound('taskComplete');
                }
              }}
            />

            <span>
              School task / check school
              plan
            </span>
          </label>

          <textarea
            placeholder="Flight log notes"
            value={notes}
            onChange={(e) =>
              setNotes(e.target.value)
            }
          />

          <button
            className="primary-btn"
            onClick={saveDaily}
          >
            🛫 Save Daily Flight Log
          </button>
        </section>
      )}

      {screen === 'weekly' && (
        <section className="card">
          <h2>📊 Weekly Flight Log</h2>

          <p>Week start: {weekStart}</p>

          <p>
            Weekly total: {weekPoints} points
          </p>

          <ul className="flight-log">
            {weekRecords.length === 0 && (
              <li>No missions recorded yet.</li>
            )}

            {weekRecords.map((r, i) => (
              <li key={`${r.date}-${i}`}>
                <strong>{r.date}</strong>

                <span>
                  {r.completedTaskLabels?.join(
                    ', '
                  ) || 'No tasks'}{' '}
                  · {r.netPoints} points
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
              <span>
                Available Weekend Time
              </span>

              <strong>
                {weekendMinutes} min
              </strong>
            </div>

            <div className="gauge">
              <span>Used Today</span>

              <strong>
                {redeemedToday} /{' '}
                {MAX_DAILY_REDEEM_MINUTES}
              </strong>
            </div>
          </div>

          <div className="grid">
            <button
              onClick={() =>
                redeem(30, 'Coding game')
              }
            >
              30 min Coding Game
            </button>

            <button
              onClick={() =>
                redeem(60, 'Minecraft build')
              }
            >
              60 min Minecraft
            </button>

            <button
              onClick={() =>
                redeem(
                  120,
                  'Flight simulator / piloting'
                )
              }
            >
              120 min Flight Simulator
            </button>
          </div>

          <p className="warning">
            No Reels, Shorts, or infinite
            scrolling feeds. Never more than
            2 hours in the same day.
          </p>
        </section>
      )}

      {screen === 'admin' && (
        <section className="card">
          <h2>🧑‍✈️ Control Tower</h2>

          <p>
            Total flight log records:{' '}
            {records.length}
          </p>

          <p>
            Current week starts on:{' '}
            {weekStart}
          </p>

          <p>
            Current weekly points:{' '}
            {weekPoints}
          </p>

          <button
            className="logout-btn"
            onClick={() => {
              localStorage.removeItem(
                STORAGE_KEY
              );

              setRecords([]);

              setMessage(
                'Flight log cleared.'
              );

              playSound('exit');
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
            <li>
              The weekly counter starts every
              Monday.
            </li>

            <li>
              Each completed task gives +1
              Fuel Point.
            </li>

            <li>
              Each point gives{' '}
              {MINUTES_PER_POINT} minutes.
            </li>

            <li>
              The checklist stays marked
              during the same day.
            </li>

            <li>
              At midnight, a new clean
              checklist starts.
            </li>

            <li>
              If you save again on the same
              day, the daily log is updated.
            </li>

            <li>
              The weekly total is the sum of
              the saved daily logs.
            </li>

            <li>
              Maximum weekend reward:{' '}
              {MAX_WEEKEND_MINUTES} minutes.
            </li>

            <li>
              Never more than 2 hours in the
              same day.
            </li>
          </ol>
        </section>
      )}
    </main>
  );
}
