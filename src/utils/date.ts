import { DAY_MS } from '../constants/design';

export const todayAtMidnight = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const fmtKey = (d: Date) => d.toISOString().slice(0, 10);

export const fmtMD = (d: Date) =>
  `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(
    2,
    '0'
  )}`;

export const fmtDOW = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'long' });

export const fmtDOWShort = (d: Date) =>
  (d.toLocaleDateString('en-US', { weekday: 'short' }) || '').slice(0, 3).toUpperCase();

export const genRange = (future: number) => {
  const s = new Date(todayAtMidnight().getTime() - 30 * DAY_MS),
    e = new Date(todayAtMidnight().getTime() + future * DAY_MS),
    a: Date[] = [];
  for (let t = s.getTime(); t <= e.getTime(); t += DAY_MS) a.push(new Date(t));
  return a;
};
