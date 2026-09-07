/**
 * Icon – a tiny inline SVG icon set (no external icon library needed).
 * Icons are decorative by default (aria-hidden); pass a `label` to make one
 * meaningful to assistive technology.
 */

const PATHS = {
  // navigation / actions
  home: 'M3 11.5 12 4l9 7.5M5 10v10h14V10',
  dashboard: 'M4 4h6v7H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 15h6v5H4z',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
  edit: 'M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3zM13.5 6.5l3 3',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  back: 'M15 18l-6-6 6-6',
  close: 'M18 6 6 18M6 6l12 12',
  menu: 'M4 6h16M4 12h16M4 18h16',
  sun: 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  check: 'M5 13l4 4L19 7',
  refresh: 'M4 4v6h6M20 20v-6h-6M20 9A8 8 0 0 0 6.3 6.3L4 10M4 15a8 8 0 0 0 13.7 2.7L20 14',
  swap: 'M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4',
  arrowUp: 'M12 19V5M5 12l7-7 7 7',
  arrowDown: 'M12 5v14M19 12l-7 7-7-7',
  wallet: 'M3 7a2 2 0 0 1 2-2h14v4M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2zM16 13.5h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  shield: 'M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  calendar: 'M4 5h16v15H4zM4 10h16M8 3v4M16 3v4',
  tag: 'M3 12V4h8l9 9-8 8zM7.5 7.5h.01',
  card: 'M3 6h18v12H3zM3 10h18M7 15h4',
  filter: 'M3 5h18l-7 8v6l-4-2v-4z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  cloud: 'M7 18a4 4 0 0 1-.6-7.95A6 6 0 0 1 18 8.5a4.5 4.5 0 0 1-.5 9.5H7z',
  upload: 'M12 16V4M6 10l6-6 6 6M4 20h16',
  database:
    'M12 3c5 0 8 1.3 8 3s-3 3-8 3-8-1.3-8-3 3-3 8-3zM4 6v12c0 1.7 3 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3 3 8 3s8-1.3 8-3',
  // category icons
  food: 'M6 3v8a3 3 0 0 0 6 0V3M9 3v18M17 3c-2 2-2 6-2 8h4c0-2 0-6-2-8zM17 11v10',
  transport: 'M5 16a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM15 16a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM3 16V9l3-5h12l3 5v7M3 9h18',
  shopping: 'M6 7h12l1 14H5zM9 7V5a3 3 0 0 1 6 0v2',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  film: 'M4 4h16v16H4zM4 9h16M4 15h16M9 4v16M15 4v16',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 3v16',
  plane: 'M2 14l8 1 3 6 2-1-1-7 6-4a2 2 0 0 0-2-3l-6 3-6-3-2 1 5 4z',
  banknotes: 'M3 7h18v10H3zM12 12a2 2 0 1 0 0 .01M6 10h.01M18 14h.01',
  laptop: 'M4 6h16v10H4zM2 19h20',
  cube: 'M12 3 4 7v10l8 4 8-4V7zM4 7l8 4 8-4M12 11v10',
}

export default function Icon({ name, size = 20, className = '', label, strokeWidth = 1.8 }) {
  const d = PATHS[name] ?? PATHS.cube
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={label ? undefined : 'true'}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
    >
      <path d={d} />
    </svg>
  )
}
