function computeRecord({ childName, date, tasks, notes, priorWeekRecords }) {
  const weekStart = mondayOf(date);

  const completedHabits = HABIT_TASKS.filter((t) => tasks[t.key]).length;
  const missedHabits = HABIT_TASKS.filter((t) => !tasks[t.key]).length;
  const previouslyUsedMiss = priorWeekRecords.some((r) => r.freeMissUsed);

  let freeMissUsed = previouslyUsedMiss;
  let habitPenalty = 0;

  if (!isWeekend(date) && missedHabits > 0) {
    if (!previouslyUsedMiss) {
      freeMissUsed = true;
      habitPenalty = Math.max(missedHabits - 1, 0);
    } else {
      habitPenalty = missedHabits;
    }
  }

  const schoolPenalty = !isWeekend(date) && !tasks.schoolTaskDone ? 1 : 0;
  const penalties = habitPenalty + schoolPenalty;
  const netPoints = completedHabits - penalties;

  return {
    timestamp: new Date().toISOString(),
    date,
    weekStart,
    childName,
    ...tasks,
    freeMissUsed,
    positivePoints: completedHabits,
    penalties,
    netPoints,
    computerMinutesEarned: Math.max(netPoints, 0) * 15,
    computerMinutesRedeemed: 0,
    notes
  };
}
