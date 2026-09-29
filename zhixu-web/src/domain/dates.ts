const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

export function todayISO(): string {
  return new Date(Date.now() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

export function shiftISO(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

export function dayDiff(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000,
  );
}

export function weekdayOfISO(iso: string): number {
  return new Date(Date.parse(`${iso}T00:00:00Z`)).getUTCDay();
}

export function mondayOfCurrentWeekISO(): string {
  const today = todayISO();
  const weekday = weekdayOfISO(today);
  return shiftISO(today, weekday === 0 ? -6 : 1 - weekday);
}

export function heatmapRange(weeks: number): { from: string; to: string } {
  const from = shiftISO(mondayOfCurrentWeekISO(), -(weeks - 1) * 7);
  return { from, to: shiftISO(from, weeks * 7 - 1) };
}

export function formatZhDate(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${Number(month)}.${Number(day)}`;
}

export function formatLongDate(iso: string): string {
  return `${Number(iso.slice(0, 4))} 年 ${Number(iso.slice(5, 7))} 月 ${Number(iso.slice(8, 10))} 日`;
}

export function weekdayZh(iso: string): string {
  return ['日', '一', '二', '三', '四', '五', '六'][weekdayOfISO(iso)];
}

export function greetingByHour(): string {
  const hour = Number(
    new Date(Date.now() + TZ_OFFSET_MS).toISOString().slice(11, 13),
  );
  if (hour >= 5 && hour < 12) return '上午好';
  if (hour >= 12 && hour < 18) return '下午好';
  return '晚上好';
}
