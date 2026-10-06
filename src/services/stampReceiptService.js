// Receipt graphics use the server balance; printing never earns a stamp.
export default function buildStampReceiptSvg(available) {
  const count = Math.max(0, Math.min(10, Math.floor(Number(available) || 0)));
  const slots = Array.from({ length: 10 }, (_, index) => {
    const x = 13 + index * 26;
    const y = 14;
    return `<circle cx="${x}" cy="${y}" r="9"/>${index < count ? `<path d="M ${x - 4} ${y} l 3 3 l 5 -6"/>` : ""}`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 28" role="img" aria-label="${count} trên 10 ô tem" style="display:block;width:100%;max-width:264px;margin:4px auto;break-inside:avoid" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${slots}</svg>`;
}
