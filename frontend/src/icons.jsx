// Small hand-rolled icon set: each icon accepts `active` to switch between
// an outline (inactive) and filled (active) rendering, keeping the bottom
// nav visually quiet until a tab is selected.

export function HomeIcon({ active, className }) {
  return active ? (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M11.47 3.84a.75.75 0 0 1 1.06 0l8.25 8.25a.75.75 0 0 1-1.06 1.06l-.72-.72V19.5a1.5 1.5 0 0 1-1.5 1.5h-3a.75.75 0 0 1-.75-.75v-4.5h-3v4.5a.75.75 0 0 1-.75.75h-3a1.5 1.5 0 0 1-1.5-1.5v-7.06l-.72.72a.75.75 0 1 1-1.06-1.06l8.25-8.25Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v8.5A1.5 1.5 0 0 0 7 20h3v-5h4v5h3a1.5 1.5 0 0 0 1.5-1.5V10" />
    </svg>
  );
}

export function LogIcon({ active, className }) {
  return active ? (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 3a.75.75 0 0 1 .75.75v7.5h7.5a.75.75 0 0 1 0 1.5h-7.5v7.5a.75.75 0 0 1-1.5 0v-7.5h-7.5a.75.75 0 0 1 0-1.5h7.5v-7.5A.75.75 0 0 1 12 3Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function HistoryIcon({ active, className }) {
  return active ? (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path fillRule="evenodd" d="M12 2a10 10 0 1 0 10 10h-1.75A8.25 8.25 0 1 1 12 3.75V2Z" clipRule="evenodd" />
      <path d="M12 2v5.5l4 2.1-.75 1.35L11 8.4V2h1Z" />
      <path d="M3.5 8.5 6 6l1.3 1.3L4.8 9.8 3.5 8.5ZM3.5 15.5 6 18l1.3-1.3-2.5-2.5-1.3 1.3Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8a8 8 0 1 1 1.6 9.6" />
      <path d="M4 4v4h4" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function CycleIcon({ active, className }) {
  return active ? (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <rect x="6.5" y="1.5" width="2" height="4" rx="1" fill="var(--icon-bg,#111318)" />
      <rect x="15.5" y="1.5" width="2" height="4" rx="1" fill="var(--icon-bg,#111318)" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <path d="M8 2.5v4M16 2.5v4M3.5 9.5h17" />
    </svg>
  );
}
