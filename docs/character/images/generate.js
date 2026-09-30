// Generates three-view (front / side / back) SVG model sheets for 3 characters and renders PNGs.
// Usage: node docs/character/images/generate.js docs/character/images
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const OUT = process.argv[2];
const L = '#3B2B3F'; // line color
const LW = 4;
const SKIN = '#FFE6D5';
const SKIN_SH = '#F7C9B3';
const BLUSH = '#FF8FA3';

const s = (o) => Object.entries(o).map(([k, v]) => `${k}="${v}"`).join(' ');
const p = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" stroke="${L}" stroke-width="${LW}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
const limb = (x1, y1, x2, y2, w, fill) =>
  `<line ${s({ x1, y1, x2, y2 })} stroke="${L}" stroke-width="${w + LW * 2}" stroke-linecap="round"/>` +
  `<line ${s({ x1, y1, x2, y2 })} stroke="${fill}" stroke-width="${w}" stroke-linecap="round"/>`;
const circ = (cx, cy, r, fill, sw = LW) => `<circle ${s({ cx, cy, r, fill })} stroke="${L}" stroke-width="${sw}"/>`;
const ell = (cx, cy, rx, ry, fill, sw = LW, extra = '') => `<ellipse ${s({ cx, cy, rx, ry, fill })} stroke="${sw ? L : 'none'}" stroke-width="${sw}" ${extra}/>`;

const HEAD = () => ell(200, 170, 105, 95, SKIN);
const HEAD_SIDE = () => p('M 200 75 C 262 75 306 115 306 172 C 306 232 262 265 200 265 C 138 265 95 230 95 172 C 95 115 138 75 200 75 Z', SKIN);
const blush = (x, y, rx = 18) =>
  ell(x, y, rx, rx * 0.5, BLUSH, 0, 'opacity="0.75"') +
  `<path d="M ${x - 8} ${y + 3} l 5 -7 M ${x} ${y + 3} l 5 -7 M ${x + 8} ${y + 3} l 5 -7" stroke="#E0607A" stroke-width="2" stroke-linecap="round"/>`;

// ---------- Eyes ----------
let uid = 0;
function stripeEye(x, y, sx = 1) {
  const id = `se${uid++}`;
  const rx = 22 * sx, ry = 28;
  const bands = ['#5B2350', '#D94A6A', '#FF7A3D', '#FFC94A'];
  const bh = (ry * 2) / bands.length;
  return `<defs><clipPath id="${id}"><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/></clipPath></defs>
  <g clip-path="url(#${id})">${bands.map((c, i) => `<rect x="${x - rx}" y="${y - ry + i * bh}" width="${rx * 2}" height="${bh + 0.5}" fill="${c}"/>`).join('')}</g>
  <ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="none" stroke="${L}" stroke-width="4"/>
  <path d="M ${x - rx - 4} ${y - ry + 6} Q ${x} ${y - ry - 8} ${x + rx + 4} ${y - ry + 6}" fill="none" stroke="${L}" stroke-width="6" stroke-linecap="round"/>
  <ellipse cx="${x - 7 * sx}" cy="${y - 12}" rx="${7 * sx}" ry="8" fill="#fff"/>
  <circle cx="${x + 8 * sx}" cy="${y + 12}" r="3.5" fill="#fff"/>`;
}
function almondEye(x, y, sx = 1, dir = 1) {
  // dir: 1 => outer corner to the right
  const id = `ae${uid++}`, gid = `ag${uid++}`, pid = `pg${uid++}`;
  const w = 30 * sx;
  const outer = x + dir * w, inner = x - dir * w;
  const d = `M ${inner} ${y + 4} Q ${x - dir * w * 0.3} ${y - 26} ${outer} ${y - 14} Q ${x + dir * w * 0.4} ${y + 24} ${inner} ${y + 4} Z`;
  return `<defs>
    <clipPath id="${id}"><path d="${d}"/></clipPath>
    <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B3FD8"/><stop offset="1" stop-color="#9B4DFF"/></linearGradient>
    <linearGradient id="${pid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF5FA2"/><stop offset=".35" stop-color="#FFE14D"/><stop offset=".65" stop-color="#3DF0C5"/><stop offset="1" stop-color="#4DA3FF"/></linearGradient>
  </defs>
  <path d="${d}" fill="#fff"/>
  <g clip-path="url(#${id})">
    <ellipse cx="${x + dir * 2}" cy="${y - 2}" rx="${15 * sx}" ry="17" fill="url(#${gid})"/>
    <path d="M ${x + dir * 2} ${y - 14} L ${x + dir * 2 + 8 * sx} ${y - 2} L ${x + dir * 2} ${y + 10} L ${x + dir * 2 - 8 * sx} ${y - 2} Z" fill="#140F2E"/>
    <path d="M ${x + dir * 2 - 1} ${y - 9} L ${x + dir * 2 + 3 * sx} ${y - 3} L ${x + dir * 2 - 1} ${y + 2} L ${x + dir * 2 - 5 * sx} ${y - 3} Z" fill="url(#${pid})"/>
  </g>
  <path d="${d}" fill="none" stroke="${L}" stroke-width="3"/>
  <path d="M ${inner - dir * 2} ${y + 2} Q ${x - dir * w * 0.3} ${y - 28} ${outer + dir * 6} ${y - 18}" fill="none" stroke="${L}" stroke-width="6.5" stroke-linecap="round"/>
  <circle cx="${x - dir * 6 * sx}" cy="${y - 8}" r="3.5" fill="#fff"/>`;
}
function flowerEye(x, y, sx = 1) {
  const id = `fe${uid++}`;
  const r = 32;
  const petals = [0, 72, 144, 216, 288].map((a) => {
    const rad = ((a - 90) * Math.PI) / 180;
    return `<ellipse cx="${x + Math.cos(rad) * 7 * sx}" cy="${y + 2 + Math.sin(rad) * 7}" rx="${5.5 * sx}" ry="5.5" fill="#123C3A"/>`;
  }).join('');
  return `<defs><clipPath id="${id}"><ellipse cx="${x}" cy="${y}" rx="${r * sx}" ry="${r + 2}"/></clipPath></defs>
  <ellipse cx="${x}" cy="${y}" rx="${r * sx}" ry="${r + 2}" fill="#fff"/>
  <g clip-path="url(#${id})">
    <ellipse cx="${x}" cy="${y + 3}" rx="${27 * sx}" ry="30" fill="#1FB5A5"/>
    <ellipse cx="${x}" cy="${y + 14}" rx="${22 * sx}" ry="14" fill="#6FE8D3"/>
    ${petals}<circle cx="${x}" cy="${y + 2}" r="3.5" fill="#FFE45C"/>
    <path d="M ${x - 26 * sx} ${y + 24} Q ${x} ${y + 34} ${x + 26 * sx} ${y + 24}" fill="none" stroke="#BFF3FF" stroke-width="4"/>
  </g>
  <ellipse cx="${x}" cy="${y}" rx="${r * sx}" ry="${r + 2}" fill="none" stroke="${L}" stroke-width="4.5"/>
  <ellipse cx="${x - 10 * sx}" cy="${y - 13}" rx="${9 * sx}" ry="10" fill="#fff"/>
  <circle cx="${x + 11 * sx}" cy="${y - 4}" r="4" fill="#fff"/>
  <circle cx="${x + 6 * sx}" cy="${y + 18}" r="2.5" fill="#fff"/>`;
}

// ---------- Generic body ----------
function body(view, c) {
  // c: { top, top2, bottom, shoe, leg, detail(view) }
  let g = '';
  if (view === 'side') {
    g += limb(188, 420, 186, 518, 30, c.leg) + ell(198, 530, 30, 14, c.shoe);
    g += limb(202, 420, 204, 518, 30, c.leg) + ell(215, 532, 30, 14, c.shoe);
    g += c.torsoSide();
    g += limb(203, 282, 212, 372, 26, c.sleeve) + circ(213, 384, 15, SKIN);
  } else {
    g += limb(180, 420, 178, 518, 32, c.leg) + limb(220, 420, 222, 518, 32, c.leg);
    g += ell(174, 530, 26, 15, c.shoe) + ell(226, 530, 26, 15, c.shoe);
    g += c.torsoFront(view);
    g += limb(153, 280, 120, 368, 26, c.sleeve) + circ(116, 380, 15, SKIN);
    g += limb(247, 280, 280, 368, 26, c.sleeve) + circ(284, 380, 15, SKIN);
  }
  return g;
}

// ---------- Character 1: relatable (coral) ----------
const C1 = {
  hair: '#FF7A4D', hairDark: '#E85A33',
  leg: SKIN, shoe: '#E8503A', sleeve: '#FF6B4A',
  torsoFront: (view) =>
    p('M 158 255 L 128 422 Q 200 440 272 422 L 242 255 Z', '#FF6B4A') +
    (view === 'front'
      ? p('M 165 256 Q 200 285 235 256 Z', '#FFF3E0') + p('M 172 360 L 228 360 L 226 395 L 174 395 Z', '#FF8E6E') +
        `<circle cx="200" cy="300" r="5" fill="#FFF3E0" stroke="${L}" stroke-width="3"/>`
      : p('M 150 262 Q 200 300 250 262 L 244 256 L 156 256 Z', '#FF8E6E')),
  torsoSide: () => p('M 176 255 L 158 422 Q 200 436 246 422 L 226 255 Z', '#FF6B4A') + p('M 220 258 Q 232 272 226 285 L 214 262 Z', '#FFF3E0'),
  cloud: (x, y, k = 1) => `<path d="M ${x - 16 * k} ${y + 7} Q ${x - 22 * k} ${y - 3} ${x - 11 * k} ${y - 5} Q ${x - 8 * k} ${y - 15} ${x + 2 * k} ${y - 10} Q ${x + 12 * k} ${y - 16} ${x + 15 * k} ${y - 4} Q ${x + 24 * k} ${y - 1} ${x + 17 * k} ${y + 7} Z" fill="#fff" stroke="${L}" stroke-width="3" stroke-linejoin="round"/>`,
  front() {
    return p('M 90 170 C 80 60 320 60 310 170 L 318 282 Q 300 300 280 284 L 120 284 Q 100 300 82 282 Z', this.hair) +
      body('front', this) + HEAD() +
      stripeEye(158, 198) + stripeEye(242, 198) +
      `<path d="M 138 160 Q 150 152 166 160 M 234 160 Q 250 152 262 160" fill="none" stroke="${L}" stroke-width="4" stroke-linecap="round"/>` +
      blush(128, 232) + blush(272, 232) +
      p('M 182 236 Q 190 228 200 236 Q 210 244 220 234 Q 214 254 200 252 Q 186 252 182 236 Z', '#C8354E') +
      p('M 92 190 C 85 90 150 62 200 64 C 250 62 315 90 308 190 Q 300 150 275 158 Q 262 140 230 150 Q 214 112 200 100 Q 186 112 170 150 Q 138 140 125 158 Q 100 150 92 190 Z', this.hair) +
      `<path d="M 130 90 Q 150 80 165 84" fill="none" stroke="#FFB08F" stroke-width="5" stroke-linecap="round"/>` +
      this.cloud(200, 136) +
      `<path d="M 322 150 Q 314 166 322 172 Q 330 166 322 150 Z" fill="#8FD8FF" stroke="${L}" stroke-width="3"/>`;
  },
  side() {
    return body('side', this) + HEAD_SIDE() +
      stripeEye(256, 196, 0.5) + blush(240, 232, 13) +
      `<path d="M 244 160 Q 254 154 264 160" fill="none" stroke="${L}" stroke-width="4" stroke-linecap="round"/>` +
      p('M 252 238 Q 260 234 268 238 Q 262 250 254 246 Z', '#C8354E') +
      p('M 302 168 C 306 95 250 60 195 62 C 125 64 85 110 88 190 L 92 285 Q 140 300 182 284 L 186 240 C 188 200 205 172 238 160 Q 258 152 266 172 Q 282 150 302 168 Z', this.hair) +
      `<path d="M 130 92 Q 160 78 190 80" fill="none" stroke="#FFB08F" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M 180 200 Q 176 240 178 270" fill="none" stroke="${this.hairDark}" stroke-width="3" stroke-linecap="round"/>`;
  },
  back() {
    return body('back', this) + HEAD() +
      p('M 90 170 C 76 38 324 38 310 170 L 318 282 Q 300 300 280 284 Q 200 296 120 284 Q 100 300 82 282 Z', this.hair) +
      `<path d="M 200 72 L 200 150 M 150 110 Q 140 200 150 280 M 250 110 Q 260 200 250 280" fill="none" stroke="${this.hairDark}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M 130 92 Q 150 80 165 84" fill="none" stroke="#FFB08F" stroke-width="5" stroke-linecap="round"/>`;
  },
};

// ---------- Character 2: admired / cool (blue-violet) ----------
const BOLT = '#2EE6FF';
const C2 = {
  hair: '#2A2360', hairHi: '#5146A8',
  leg: SKIN, shoe: '#221C4D', sleeve: '#7B3FE4',
  torsoFront: (view) =>
    p('M 150 382 L 128 438 Q 200 452 272 438 L 250 382 Z', '#1E5BFF') +
    p('M 156 255 L 146 392 Q 200 404 254 392 L 244 255 Z', '#7B3FE4') +
    (view === 'front'
      ? p('M 184 256 L 200 330 L 216 256 Z', '#F5F3FF') + p('M 168 250 L 184 256 L 196 300 Z', '#9D6BFF') + p('M 232 250 L 216 256 L 204 300 Z', '#9D6BFF') +
        `<path d="M 200 330 L 200 392" stroke="${L}" stroke-width="3"/>`
      : p('M 160 246 Q 200 262 240 246 L 244 270 Q 200 280 156 270 Z', '#9D6BFF')) +
    `<path d="M 146 392 Q 200 404 254 392" fill="none" stroke="${BOLT}" stroke-width="3"/>`,
  torsoSide: () =>
    p('M 176 382 L 160 438 Q 200 448 246 438 L 228 382 Z', '#1E5BFF') +
    p('M 178 255 L 170 392 Q 200 400 234 392 L 226 255 Z', '#7B3FE4') + p('M 214 246 L 232 250 L 226 280 L 212 266 Z', '#9D6BFF'),
  bolt: (x, y, k = 1, f = 1) => `<path d="M ${x} ${y} L ${x + 16 * k * f} ${y} L ${x + 4 * k * f} ${y + 34 * k} L ${x + 18 * k * f} ${y + 34 * k} L ${x - 12 * k * f} ${y + 92 * k} L ${x - 2 * k * f} ${y + 48 * k} L ${x - 16 * k * f} ${y + 48 * k} Z" fill="${BOLT}" stroke="${L}" stroke-width="3" stroke-linejoin="round"/>`,
  front() {
    return p('M 94 165 C 84 52 316 52 306 165 L 318 435 Q 300 448 280 438 L 272 300 L 128 300 L 120 438 Q 100 448 82 435 Z', this.hair) +
      body('front', this) + HEAD() +
      almondEye(160, 200, 1, -1) + almondEye(240, 200, 1, 1) +
      `<path d="M 134 164 L 176 172 M 266 164 L 224 172" fill="none" stroke="${L}" stroke-width="4.5" stroke-linecap="round"/>` +
      blush(132, 232, 14) + blush(268, 232, 14) +
      `<path d="M 188 240 Q 202 246 214 236" fill="none" stroke="${L}" stroke-width="4" stroke-linecap="round"/>` +
      p('M 92 205 C 84 80 150 58 205 60 C 268 58 320 90 308 205 Q 298 160 276 138 L 262 158 L 250 128 L 224 152 L 216 124 L 190 150 Q 150 150 132 128 L 124 160 Q 104 170 92 205 Z', this.hair) +
      `<path d="M 230 78 Q 262 80 280 104" fill="none" stroke="${this.hairHi}" stroke-width="6" stroke-linecap="round"/>` +
      this.bolt(128, 68, 0.95);
  },
  side() {
    return body('side', this) + HEAD_SIDE() +
      almondEye(262, 198, 0.5, 1) + blush(242, 232, 11) +
      `<path d="M 246 164 L 274 170" fill="none" stroke="${L}" stroke-width="4.5" stroke-linecap="round"/>` +
      `<path d="M 254 244 Q 262 246 268 240" fill="none" stroke="${L}" stroke-width="4" stroke-linecap="round"/>` +
      p('M 304 175 C 308 92 250 56 195 58 C 118 60 80 110 86 205 L 72 438 Q 120 452 176 440 L 182 300 C 184 230 202 184 240 160 L 252 180 L 264 150 L 286 178 Z', this.hair) +
      `<path d="M 160 78 Q 210 66 250 82" fill="none" stroke="${this.hairHi}" stroke-width="6" stroke-linecap="round"/>` +
      this.bolt(150, 90, 1.25);
  },
  back() {
    return body('back', this) + HEAD() +
      p('M 90 168 C 76 34 324 34 310 168 L 322 438 Q 260 452 200 440 Q 140 452 78 438 Z', this.hair) +
      `<path d="M 200 70 L 200 430 M 150 90 Q 132 250 140 430 M 250 90 Q 268 250 260 430" fill="none" stroke="${this.hairHi}" stroke-width="3" stroke-linecap="round"/>` +
      this.bolt(252, 88, 0.95, 1);
  },
};

// ---------- Character 3: little one (lemon / mint) ----------
const C3 = {
  hair: '#FFD21F', hairDark: '#F0A800',
  leg: SKIN, shoe: '#FFC21A', sleeve: '#5FE3B5',
  torsoFront: (view) =>
    p('M 160 255 L 136 420 Q 200 436 264 420 L 240 255 Z', '#5FE3B5') +
    (view === 'front'
      ? p('M 170 300 L 230 300 L 236 380 Q 200 392 164 380 Z', '#A8F5D8') +
        circ(176, 306, 6, '#FFD21F', 3) + circ(224, 306, 6, '#FFD21F', 3) + p('M 172 256 Q 200 276 228 256 Z', '#FFFBEA')
      : `<path d="M 176 256 L 176 300 M 224 256 L 224 300" stroke="#2FB88A" stroke-width="6" stroke-linecap="round"/>`) +
    `<path d="M 200 410 L 200 430" stroke="${L}" stroke-width="3"/>`,
  torsoSide: () => p('M 178 255 L 164 420 Q 200 432 244 420 L 228 255 Z', '#5FE3B5') + p('M 216 300 L 236 300 L 240 378 Q 226 386 218 380 Z', '#A8F5D8'),
  sprout: () =>
    `<path d="M 200 60 Q 196 40 204 24" fill="none" stroke="${L}" stroke-width="9" stroke-linecap="round"/>` +
    `<path d="M 200 60 Q 196 40 204 24" fill="none" stroke="#2FB88A" stroke-width="4" stroke-linecap="round"/>` +
    p('M 203 28 Q 184 2 158 14 Q 176 38 203 28 Z', '#3DDC97') + p('M 204 26 Q 222 -4 252 6 Q 236 36 204 26 Z', '#6CF0B2') +
    `<path d="M 200 26 Q 182 18 168 16 M 208 24 Q 226 14 242 9" fill="none" stroke="#2FB88A" stroke-width="2"/>`,
  front() {
    return body('front', this) + HEAD() +
      flowerEye(152, 204) + flowerEye(248, 204) +
      `<path d="M 130 160 Q 146 150 162 158 M 238 158 Q 254 150 270 160" fill="none" stroke="${L}" stroke-width="4" stroke-linecap="round"/>` +
      blush(118, 240) + blush(282, 240) +
      ell(200, 244, 8, 9, '#C8354E', 3.5) +
      p('M 95 200 Q 80 150 100 120 Q 95 80 135 72 Q 160 45 200 55 Q 240 45 265 72 Q 305 80 300 120 Q 320 150 305 200 Q 295 160 280 150 Q 265 135 245 140 Q 225 120 200 135 Q 175 120 155 140 Q 135 135 120 150 Q 105 160 95 200 Z', this.hair) +
      `<path d="M 140 88 Q 158 76 176 78" fill="none" stroke="#FFF1A6" stroke-width="6" stroke-linecap="round"/>` +
      this.sprout();
  },
  side() {
    return body('side', this) + HEAD_SIDE() +
      flowerEye(258, 202, 0.5) + blush(238, 238, 13) +
      `<path d="M 246 160 Q 258 152 270 158" fill="none" stroke="${L}" stroke-width="4" stroke-linecap="round"/>` +
      ell(262, 246, 5, 7, '#C8354E', 3) +
      p('M 296 152 Q 304 110 272 80 Q 250 50 205 55 Q 160 45 130 72 Q 90 85 92 130 Q 80 170 98 205 Q 112 228 134 216 Q 162 232 182 206 Q 186 172 216 152 Q 246 140 262 154 Q 278 136 296 152 Z', this.hair) +
      `<path d="M 150 84 Q 176 70 206 72" fill="none" stroke="#FFF1A6" stroke-width="6" stroke-linecap="round"/>` +
      this.sprout();
  },
  back() {
    return body('back', this) + HEAD() +
      p('M 95 200 Q 80 150 100 120 Q 95 80 135 72 Q 160 45 200 55 Q 240 45 265 72 Q 305 80 300 120 Q 320 150 305 200 Q 310 240 280 252 Q 250 272 200 262 Q 150 272 120 252 Q 90 240 95 200 Z', this.hair) +
      `<path d="M 150 110 Q 160 150 150 190 M 200 90 Q 210 150 200 220 M 250 110 Q 240 150 250 190" fill="none" stroke="${this.hairDark}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M 140 88 Q 158 76 176 78" fill="none" stroke="#FFF1A6" stroke-width="6" stroke-linecap="round"/>` +
      this.sprout();
  },
};

// small figure scale for the child
const wrap = (inner, scale) => (scale === 1 ? inner : `<g transform="translate(200 550) scale(${scale}) translate(-200 -550)">${inner}</g>`);
const shadow = (scale) => `<ellipse cx="200" cy="548" rx="${95 * scale}" ry="12" fill="#000" opacity="0.07"/>`;

function sheet(ch, scale) {
  const views = ['front', 'side', 'back'];
  const panels = views.map((v, i) => `<g transform="translate(${i * 400} 20)">${shadow(scale)}${wrap(ch[v](), scale)}</g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600"><rect width="1200" height="600" fill="#fff"/>${panels}</svg>`;
}
function lineup() {
  const items = [[C1, 1], [C2, 1], [C3, 0.85]].map(([ch, sc], i) => `<g transform="translate(${i * 400} 20)">${shadow(sc)}${wrap(ch.front(), sc)}</g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600"><rect width="1200" height="600" fill="#fff"/>${items}</svg>`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const files = {
    'turnaround-1-relatable': sheet(C1, 1),
    'turnaround-2-admired': sheet(C2, 1),
    'turnaround-3-little': sheet(C3, 0.85),
    'lineup-front': lineup(),
  };
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 600 }, deviceScaleFactor: 2 });
  for (const [name, svg] of Object.entries(files)) {
    fs.writeFileSync(path.join(OUT, `${name}.svg`), svg);
    await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
    await page.locator('svg').first().screenshot({ path: path.join(OUT, `${name}.png`) });
  }
  await browser.close();
  console.log('done');
})();
