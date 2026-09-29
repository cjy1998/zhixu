import { useMemo, useState } from 'react';
import type { HeatmapDay } from '../api/types';
import { todayISO, weekdayOfISO } from '../domain/dates';
import { cx } from '../lib/cx';
import s from './Heatmap.module.css';

interface HeatmapProps {
  days: HeatmapDay[];
  from: string;
  to: string;
  total: number;
  onSelectDate?: (info: { date: string; count: number } | null) => void;
}

export function Heatmap({ days, from, to, total, onSelectDate }: HeatmapProps) {
  const [selected, setSelected] = useState<{ date: string; count: number } | null>(null);
  const today = todayISO();
  const countMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const day of days) map.set(day.date, day.count);
    return map;
  }, [days]);

  const cells = useMemo(() => {
    const list: { date: string; count: number; future: boolean }[] = [];
    let cursor = from;
    let guard = 0;
    while (cursor <= to && guard < 800) {
      const count = countMap.get(cursor) ?? 0;
      list.push({ date: cursor, count, future: cursor > today });
      cursor = nextDay(cursor);
      guard += 1;
    }
    return list;
  }, [from, to, countMap, today]);

  const months = useMemo(() => {
    const labels: string[] = [];
    let lastMonth = '';
    for (const cell of cells) {
      const year = cell.date.slice(0, 4);
      const month = cell.date.slice(5, 7);
      if (month !== lastMonth) {
        const isFirst = labels.length === 0;
        const withYear = isFirst || month === '01';
        labels.push(withYear ? `${year} / ${Number(month)}` : `${Number(month)} 月`);
        lastMonth = month;
      }
    }
    return labels;
  }, [cells]);

  const weekdayCells = useMemo(() => {
    const firstWeekday = weekdayOfISO(from);
    return Array.from({ length: 7 }, (_, index) => {
      const weekday = (firstWeekday + index) % 7;
      return weekday === 1 ? '一' : weekday === 3 ? '三' : weekday === 5 ? '五' : weekday === 0 ? '日' : '';
    });
  }, [from]);

  return (
    <div
      className={s.heatmap}
      role="group"
      aria-label={`打卡热力图：${total} 个已通过检验的节点`}
    >
      <div className={s.heatDays}>
        {weekdayCells.map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </div>
      <div className={s.heatArea}>
        <div className={s.heatMonths}>
          {months.map((label, index) => (
            <span key={index}>{label}</span>
          ))}
        </div>
        <div className={s.heatGrid}>
          {cells.map((cell) => {
            const level = cell.count ? `level${Math.min(4, cell.count + 1)}` : '';
            const info = `${cell.date} · ${cell.future ? '尚未到来' : cell.count ? `${cell.count} 个节点通过检验` : '没有打卡记录，积累需要时间'}`;
            return (
              <button
                key={cell.date}
                type="button"
                className={cx(s.heatCell, s[level], cell.future && s.future, cell.date === today && s.today)}
                title={info}
                aria-label={info}
                disabled={cell.future}
                onClick={() => {
                  const next = selected?.date === cell.date ? null : { date: cell.date, count: cell.count };
                  setSelected(next);
                  onSelectDate?.(next);
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function HeatLegend() {
  return (
    <div className={s.heatLegend}>
      <span>少</span>
      <i />
      <i />
      <i />
      <i />
      <i />
      <span>多</span>
    </div>
  );
}

function nextDay(iso: string): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
}
