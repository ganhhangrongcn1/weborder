const paths = {
  checkin: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></>,
  history: <><path d="M4 8a9 9 0 1 1-1 6M4 3v5h5"/><path d="M12 7v5l3 2"/></>,
  corrections: <><path d="M15 4H6a2 2 0 0 0-2 2v14h14V11M14 4l3-2 4 4-9 9-4 1 1-4Z"/></>,
  training: <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3Z"/></>,
  account: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
};

export default function NavigationIcon({ name }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
