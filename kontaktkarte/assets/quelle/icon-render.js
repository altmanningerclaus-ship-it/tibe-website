const { chromium } = require('playwright');
// Erzeugt alle App-Icons neu: node assets/quelle/icon-render.js <Zielordner>
// (benötigt Playwright mit Chromium)
const out = process.argv[2];

// Motiv: Visitenkarte (leicht schräg) mit Kartenpin – Farben aus der App
const BG = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#2A6FD6"/><stop offset="1" stop-color="#143C80"/>
  </linearGradient>
  <pattern id="grid" width="128" height="128" patternUnits="userSpaceOnUse">
    <path d="M128 0H0V128" fill="none" stroke="#FFFFFF" stroke-opacity=".07" stroke-width="3"/>
  </pattern>
</defs>
<rect width="1024" height="1024" fill="url(#bg)"/>
<rect width="1024" height="1024" fill="url(#grid)"/>
<path d="M-40 760 C 220 640, 380 860, 620 720 S 960 600, 1080 680" fill="none" stroke="#FFFFFF" stroke-opacity=".10" stroke-width="26" stroke-linecap="round"/>`;

// mono=true: einfarbige Silhouette (Android-Themensymbol)
function motif(mono) {
  const W = mono ? '#FFFFFF' : '#FFFFFF';
  const line = mono ? '#000000' : '#C9D3E3';
  const nameBar = mono ? '#000000' : '#1F2937';
  const pin = mono ? '#FFFFFF' : '#E53935';
  const pinDot = mono ? '#000000' : '#FFFFFF';
  const shadow = mono ? '' : `<filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#081a3a" flood-opacity=".45"/></filter>`;
  const f = mono ? '' : 'filter="url(#sh)"';
  const chips = mono ? '' : `
      <circle cx="-150" cy="88" r="17" fill="#D32F2F"/>
      <circle cx="-105" cy="88" r="17" fill="#2E7D32"/>
      <circle cx="-60" cy="88" r="17" fill="#F57C00"/>`;
  return `<defs>${shadow}
    <mask id="cut"><rect x="-600" y="-600" width="1200" height="1200" fill="#fff"/>
      <g transform="translate(168 -92)"><path d="M0 120 C -70 40 -96 -10 -96 -52 a96 96 0 0 1 192 0 C 96 -10 70 40 0 120 Z" fill="#000" stroke="#000" stroke-width="44" stroke-linejoin="round"/></g>
    </mask></defs>
    <g transform="translate(512 548) rotate(-8)">
      <g ${f} ${mono ? 'mask="url(#cut)"' : ''}>
        <rect x="-250" y="-160" width="500" height="320" rx="34" fill="${W}"/>
      </g>
      <g ${mono ? 'mask="url(#cut)"' : ''}>
        <rect x="-196" y="-104" width="200" height="34" rx="17" fill="${nameBar}"/>
        <rect x="-196" y="-46" width="140" height="22" rx="11" fill="${line}"/>
        <rect x="-196" y="4" width="250" height="20" rx="10" fill="${line}"/>
        <rect x="-196" y="40" width="190" height="20" rx="10" fill="${line}"/>
        ${chips}
      </g>
    </g>
    <g transform="translate(512 548) rotate(-8) translate(168 -92)" ${f}>
      <path d="M0 120 C -70 40 -96 -10 -96 -52 a96 96 0 0 1 192 0 C 96 -10 70 40 0 120 Z" fill="${pin}"/>
      <circle cx="0" cy="-52" r="38" fill="${pinDot}" ${mono ? 'fill-opacity="0"' : ''}/>
    </g>
    ${mono ? `<g transform="translate(512 548) rotate(-8) translate(168 -92)"><circle cx="0" cy="-52" r="38" fill="#000"/></g>` : ''}`;
}

const svg = (inner, size = 1024, scale = 1) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">` +
  (scale === 1 ? inner : `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">${inner}</g>`) + `</svg>`;

// Monochrom: Löcher statt schwarzer Flächen (Maske über alles)
function monoSvg(scale) {
  const inner = `<defs><mask id="m"><rect width="1024" height="1024" fill="#000"/>${motif(true)}</mask></defs>
    <rect width="1024" height="1024" fill="#FFFFFF" mask="url(#m)"/>`;
  return svg(inner, 1024, scale);
}

const jobs = [
  ['icon.png', svg(BG + `<g transform="translate(512 512) scale(1.18) translate(-512 -530)">${motif(false)}</g>`), 1024, false],
  ['android-icon-background.png', svg(BG), 1024, false],
  // Adaptive Icons: Inhalt in die sichere Zone (mittlere ~66 %) skalieren
  ['android-icon-foreground.png', svg(motif(false), 1024, 0.84), 1024, true],
  ['android-icon-monochrome.png', monoSvg(0.84), 1024, true],
  ['splash-icon.png', svg(motif(false), 1024, 0.9), 1024, true],
  ['favicon.png', svg(BG + `<g transform="translate(512 512) scale(1.25) translate(-512 -530)">${motif(false)}</g>`), 48, false],
  ['preview.png', null, 0, false],
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [name, s, size, transparent] of jobs) {
    if (!s) continue;
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:transparent">${s.replace('width="1024" height="1024" viewBox', `width="${size}" height="${size}" viewBox`)}</body></html>`);
    await p.screenshot({ path: `${out}/${name}`, omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
  }
  // Vorschau: iOS-Maske, Android-Kreis, Themensymbol, klein
  const img = (n) => 'data:image/png;base64,' + require('fs').readFileSync(`${out}/${n}`).toString('base64');
  await p.setViewportSize({ width: 1000, height: 330 });
  await p.setContent(`<html><body style="margin:0;background:#E9ECF1;display:flex;gap:40px;align-items:center;justify-content:center;height:330px;font:14px -apple-system,sans-serif;color:#333">
    <figure style="text-align:center;margin:0"><img src="${img('icon.png')}" style="width:200px;border-radius:45px"><figcaption>iOS</figcaption></figure>
    <figure style="text-align:center;margin:0"><div style="width:200px;height:200px;border-radius:50%;overflow:hidden;position:relative"><img src="${img('android-icon-background.png')}" style="position:absolute;inset:-25px;width:250px"><img src="${img('android-icon-foreground.png')}" style="position:absolute;inset:-25px;width:250px"></div><figcaption>Android</figcaption></figure>
    <figure style="text-align:center;margin:0"><div style="width:200px;height:200px;border-radius:50%;overflow:hidden;position:relative;background:#DCE6D2"><img src="${img('android-icon-monochrome.png')}" style="position:absolute;inset:-25px;width:250px;filter:brightness(0) saturate(100%) invert(22%) sepia(18%) saturate(900%) hue-rotate(60deg)"></div><figcaption>Android-Themensymbol</figcaption></figure>
    <figure style="text-align:center;margin:0"><img src="${img('icon.png')}" style="width:60px;border-radius:14px"><figcaption>klein</figcaption></figure>
  </body></html>`);
  await p.screenshot({ path: `${out}/preview.png` });
  await b.close();
})();
