const flaticonIds = {
  home: "1946488",
  star: "4081317",
  bag: "1288610",
  cart: "1170678",
  gift: "505941",
  user: "747376",
  search: "622669",
  back: "271220",
  trash: "1214428",
  heart: "833472"
};

const fallbackPaths = {
  home: "M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10.5Z",
  menu: "M4 6h16M4 12h16M4 18h16",
  tag: "M20 12l-8 8-9-9V4h7l10 8Z M7 7h.01",
  star: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.1L12 18.7 6.4 21.1 7.5 15 3 10.6l6.2-.9L12 3Z",
  bag: "M6 8h12l-1 13H7L6 8Z M9 8a3 3 0 0 1 6 0",
  cart: "M4 5h2l2 10h9l2-7H7 M9 20h.01 M17 20h.01",
  bell: "M18 16H6l1.5-2V10a4.5 4.5 0 0 1 9 0v4L18 16Z M10 19a2 2 0 0 0 4 0",
  heart: "M20 8.5c0 5-8 9.5-8 9.5S4 13.5 4 8.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8 2.5Z",
  share: "M16 8a3 3 0 1 0-2.8-4M8 12l6-4M8 12l6 4M6 15a3 3 0 1 0 0-6M16 20a3 3 0 1 0-2.8-4",
  back: "M15 6l-6 6 6 6",
  trash: "M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 14h8l1-14",
  gear: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4",
  search: "M10.5 18a7.5 7.5 0 1 1 5.3-2.2L21 21",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21a8 8 0 0 1 16 0",
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 1.9.6 2.8a2 2 0 0 1-.4 2.1L8 9.9a16 16 0 0 0 6.1 6.1l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.8.6a2 2 0 0 1 1.7 2Z",
  gift: "M4 10h16v11H4V10Z M12 10v11M4 14h16M8.5 10C6 8 6.5 5 9 5c2 0 3 5 3 5s1-5 3-5c2.5 0 3 3 0.5 5"
  ,warning: "M12 3 2.5 20.5h19L12 3Zm0 5.8v5.6m0 3.8h.01"
};

function flaticonUrl(id) {
  const bucket = String(id).slice(0, -3);
  return `https://cdn-icons-png.flaticon.com/512/${bucket}/${id}.png`;
}

export default function Icon({ name, size = 20, className = "" }) {
  const id = flaticonIds[name];

  if (id) {
    const url = flaticonUrl(id);
    return (
      <span
        className={`flaticon-mask icon-ux ${className}`}
        style={{
          width: size,
          height: size,
          WebkitMaskImage: `url(${url})`,
          maskImage: `url(${url})`
        }}
        aria-hidden="true"
      />
    );
  }

  return (
    <svg className={`icon-ux ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={fallbackPaths[name] || fallbackPaths.star} />
    </svg>
  );
}
