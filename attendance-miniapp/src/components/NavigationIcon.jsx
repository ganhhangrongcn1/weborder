const paths = {
  home: <><path className="icon-tone" d="m3 10 9-7 9 7v10H3Z"/><path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/></>,
  membership: <><path className="icon-tone" d="m12 3 3 6 6 1-4.5 4.5 1 6.5-5.5-3-5.5 3 1-6.5L3 10l6-1Z"/><path d="m12 3 3 6 6 1-4.5 4.5 1 6.5-5.5-3-5.5 3 1-6.5L3 10l6-1Z"/></>,
  checkin: <><rect className="icon-tone" x="4" y="5" width="16" height="16" rx="3"/><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 10h16m-12 5 2.5 2.5L16 13"/></>,
  history: <><circle className="icon-tone" cx="12" cy="12" r="8"/><path d="M4.5 7.5A8.5 8.5 0 1 1 3.6 15M3.5 3.5v4.5H8"/><path d="M12 7.5V12l3 2"/></>,
  corrections: <><path className="icon-tone" d="M6 3h8l4 4v5l-7 8H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M10 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8l4 4v3M13 3v5h5M8 12h3m-3 4h1m5 5-2.5.5L12 19l6.5-6.5a1.4 1.4 0 0 1 2 2L14 21Zm3-7 2 2"/></>,
  training: <><rect className="icon-tone" x="3" y="4" width="18" height="14" rx="3"/><rect x="3" y="4" width="18" height="14" rx="3"/><path d="m10 8 5 3-5 3V8Zm-2 13h8m-4-3v3"/></>,
  account: <><rect className="icon-tone" x="4" y="3" width="16" height="18" rx="3"/><rect x="4" y="3" width="16" height="18" rx="3"/><circle cx="12" cy="9" r="2.5"/><path d="M8 17a4 4 0 0 1 8 0"/></>,
  location: <><path className="icon-tone" d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  qr: <><path d="M8 3H4a1 1 0 0 0-1 1v4m13-5h4a1 1 0 0 1 1 1v4M3 16v4a1 1 0 0 0 1 1h4m8 0h4a1 1 0 0 0 1-1v-4"/><path d="M7 7h3v3H7V7Zm7 0h3v3h-3V7ZM7 14h3v3H7v-3Zm7 0h3v3h-3v-3Z"/></>,
  network: <><path d="M3 8.5a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0m-9 3.5a4.5 4.5 0 0 1 6 0"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/></>,
  camera: <><path className="icon-tone" d="M8 6 9.5 3h5L16 6h3a2 2 0 0 1 2 2v11H3V8a2 2 0 0 1 2-2h3Z"/><path d="M8 6 9.5 3h5L16 6h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3Z"/><circle cx="12" cy="12.5" r="3.5"/></>,
};

export default function NavigationIcon({ name }) {
  return <svg className="attendance-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
