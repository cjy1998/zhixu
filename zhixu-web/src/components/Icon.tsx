import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export type IconName = keyof typeof icons;

const icons = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  chart: <path d="M4 4v16h17M8 16v-5m5 5V7m5 9v-8" />,
  route: <><circle cx="6" cy="5" r="2" /><circle cx="18" cy="19" r="2" /><path d="M6 7v7a4 4 0 0 0 4 4h6M8 5h6a4 4 0 0 1 0 8h-4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  left: <path d="M19 12H5m5-5-5 5 5 5" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  down: <path d="m6 9 6 6 6-6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m5 12 4 5L20 6" />,
  circleCheck: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  circle: <circle cx="12" cy="12" r="8" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4m-2-2h4" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" />,
  coffee: <path d="M5 9h12v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9ZM17 10h2a3 3 0 0 1 0 6h-2M8 3v3m4-3v3m4-3v3M3 21h16" />,
  pen: <path d="m14 4 6 6M3 21l5-1 13-13-5-5L3 15v6Z" />,
  language: <path d="M3 5h12M9 3v2m-4 0c0 7 7 11 7 11M13 5c0 7-5 11-10 12m10 4 5-13 5 13m-8-5h6" />,
  book: <path d="M12 6c-3-3-7-3-10-2v15c4-1 7 0 10 2m0-15c3-3 7-3 10-2v15c-4-1-7 0-10 2V6Z" />,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  flame: <><path d="M12 2c2 5 6 6 6 11a7 7 0 1 1-12-4c0 3 2 4 3 3-1-4 3-6 3-10Z" /><path d="M12 13c2 2 3 3 3 4a3 3 0 0 1-6 0c0-1 1-2 3-4Z" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 11h18M8 15h1m6 0h1m-8 3h1" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  leaf: <path d="M20 3C10 2 3 5 3 12a7 7 0 0 0 14 1c0-4 1-7 3-10ZM3 21l10-12" />,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2" /></>,
  logout: <path d="M10 3H5v18h5m-1-9h12m-4-4 4 4-4 4" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-9h.01" /></>,
  alert: <path d="m12 3 10 18H2L12 3ZM12 9v5m0 3h.01" />,
  folder: <path d="M3 5h6l2 3h10v12H3V5Z" />,
  file: <path d="M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 12h8m-8 4h6" />,
  video: <><rect x="2" y="5" width="14" height="14" rx="2" /><path d="m16 10 6-4v12l-6-4" /></>,
  code: <path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18" />,
  link: <path d="m9 15 6-6m-5-2 3-3a5 5 0 0 1 7 7l-3 3M7 10l-3 3a5 5 0 0 0 7 7l3-3" />,
  external: <path d="M14 3h7v7m0-7L11 13m0-8H3v16h16v-8" />,
  award: <><circle cx="12" cy="8" r="5" /><path d="m8 12-2 9 6-3 6 3-2-9" /></>,
  filter: <path d="M4 6h16M7 12h10m-7 6h4" />,
  loading: <path d="M21 12a9 9 0 1 1-9-9" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  play: <path d="m8 4 12 8-12 8V4Z" />,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 1 1 4 3v2m0 3h.01" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>,
  cap: <path d="m2 8 10-5 10 5-10 5L2 8Zm4 2v7c4 3 8 3 12 0v-7m4-2v8" />,
} satisfies Record<string, ReactNode>;

export function Icon({ name, cls, className }: { name: IconName | string; cls?: string; className?: string }) {
  const body = (icons as Record<string, ReactNode>)[name] ?? icons.book;
  return (
    <svg className={cx('icon', cls, className)} viewBox="0 0 24 24" aria-hidden="true">
      {body}
    </svg>
  );
}
