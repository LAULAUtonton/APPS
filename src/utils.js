export const toLocalISODate = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isWeekend = (d) => [0, 6].includes(new Date(d).getDay());

export const mondayOf = (d) => {
  const date = new Date(`${d}T12:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toLocalISODate(date);
};

export const nextMondayOf = (d) => {
  const monday = new Date(`${mondayOf(d)}T12:00:00`);
  monday.setDate(monday.getDate() + 7);
  return toLocalISODate(monday);
};

export const byDateAsc = (a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0);
