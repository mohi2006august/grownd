// Line icons from the GROWND design, drawn on a 24px grid. Decorative: hidden from screen readers.
const PATHS = {
  arrow: ["M5 12h14", "M13 6l6 6-6 6"],
  arrowL: ["M19 12H5", "M11 6l-6 6 6 6"],
  chev: ["M6 9l6 6 6-6"],
  check: ["M5 12.5l4.5 4.5L19 7"],
  cake: ["M4 21h16", "M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7", "M5 16.5c2.3 1.4 4.7 1.4 7 0s4.7-1.4 7 0", "M12 12V8", "M12 5.5c.9-.8.9-1.7 0-2.5-.9.8-.9 1.7 0 2.5z"],
  home: ["M3 11l9-7 9 7", "M5 9.5V20h14V9.5", "M12 17.5s-3-1.8-3-3.8a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 2-3 3.8-3 3.8z"],
  flask: ["M9 3h6", "M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3", "M7.2 15h9.6"],
  school: ["M3 21h18", "M5 21V10l7-5 7 5v11", "M10 21v-5h4v5", "M12 5V2h4v2h-4"],
  code: ["M8 8l-4 4 4 4", "M16 8l4 4-4 4", "M14 5l-4 14"],
  star: ["M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"],
  play: ["M8 5l11 7-11 7z"],
  info: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 11v6", "M12 7.5v.01"],
  cal: ["M4 6h16v14H4z", "M4 10h16", "M8 3v4", "M16 3v4"],
  menu: ["M4 7h16", "M4 12h16", "M4 17h16"],
  sun: ["M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M12 2v2", "M12 20v2", "M4.9 4.9l1.4 1.4", "M17.7 17.7l1.4 1.4", "M2 12h2", "M20 12h2", "M4.9 19.1l1.4-1.4", "M17.7 6.3l1.4-1.4"],
  moon: ["M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"],
  download: ["M12 4v11", "M7 10l5 5 5-5", "M5 20h14"],
  close: ["M6 6l12 12", "M18 6L6 18"],
  refresh: ["M20 11a8 8 0 1 0-2.3 5.7", "M20 5v6h-6"]
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24, stroke = 1.9 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none" }}>
      {PATHS[name].map(d => <path key={d} d={d} />)}
    </svg>
  );
}

/** The icon set the pages use, at the design's sizes. */
export const ic = {
  arrow: <Icon name="arrow" size={20} />,
  arrowL: <Icon name="arrowL" size={20} />,
  arrowXL: <Icon name="arrow" size={44} stroke={2.2} />,
  arrowUp: <span style={{ display: "inline-flex", transform: "rotate(-90deg)" }}><Icon name="arrow" size={22} stroke={2.2} /></span>,
  flaskS: <Icon name="flask" size={18} stroke={2.4} />,
  flask: <Icon name="flask" />,
  chev: <Icon name="chev" />,
  check: <Icon name="check" />,
  info: <Icon name="info" />,
  cal: <Icon name="cal" />,
  play: <Icon name="play" />,
  menu: <Icon name="menu" />,
  close: <Icon name="close" />,
  sun: <Icon name="sun" />,
  moon: <Icon name="moon" />,
  download: <Icon name="download" />,
  refresh: <Icon name="refresh" />
};
