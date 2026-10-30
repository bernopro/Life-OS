/* ============================================================
   Life OS — core: state, storage, helpers, UI primitives
   Plain scripts (no modules) so the app also runs from file://
   ============================================================ */
'use strict';

const App = {
  views: {},      // route -> { title, render(), mount?(el) }
  actions: {},    // data-act / data-change / data-input handlers
  ui: {},         // transient (non-persisted) view state
  state: null,
  route: 'dashboard',
  modals: [],
  charts: new Map(),
  chartSeq: 0,
  persistOk: true,
};
// Each account gets its own storage slot; the legacy key holds data from before accounts existed.
const LEGACY_KEY = 'lifeos.data.v1';
const Auth = { user: null };
const storeKey = () => (Auth.user ? 'lifeos.data.u.' + Auth.user.id : LEGACY_KEY);

/* ---------- DOM + string helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = n => String(n).padStart(2, '0');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sum = arr => arr.reduce((a, b) => a + (Number(b) || 0), 0);
const num = (n, d = 0) => (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 });
const plural = (n, w, p) => `${n} ${n === 1 ? w : (p || w + 's')}`;
const db = () => App.state;
const cfg = () => App.state.settings;

/* ---------- Dates (always local, stored as YYYY-MM-DD) ---------- */
const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const todayStr = () => ymd(new Date());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addDaysStr = (s, n) => ymd(addDays(parseYmd(s), n));
const dayDiff = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 864e5); // b - a
const monthKey = s => String(s).slice(0, 7);
const addMonths = (mk, n) => { const [y, m] = mk.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const monthLabel = (mk, long = true) => { const [y, m] = mk.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: long ? 'long' : 'short', year: 'numeric' }); };
const daysInMonth = mk => { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); };
function startOfWeek(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const diff = (x.getDay() - (cfg().weekStart || 0) + 7) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}
function fmtDate(s, opts = { month: 'short', day: 'numeric' }) { return s ? parseYmd(s).toLocaleDateString(undefined, opts) : ''; }
function fmtLong(s) { return parseYmd(s).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }
function relDay(s) {
  if (!s) return '';
  const diff = dayDiff(todayStr(), s);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const d = parseYmd(s);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  if (diff > 1 && diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (cfg().clock24) return `${pad(h)}:${pad(m)}`;
  return `${(h % 12) || 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`;
}
const timeToMin = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
const minToTime = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
function weekdayNames(style = 'short') {
  const base = new Date(2024, 0, 7); // a Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const d = ((cfg().weekStart || 0) + i) % 7;
    return { d, name: addDays(base, d).toLocaleDateString(undefined, { weekday: style }) };
  });
}
/* ---------- Currencies ----------
   Every amount is stored with its own currency code. Rates are "units per 1 USD"
   and only used to convert totals into the currency you choose to view in. */
const DEFAULT_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', rate: 1, after: false, dec: 2, on: true },
  { code: 'AMD', name: 'Armenian Dram', symbol: '֏', rate: 387, after: true, dec: 0, on: true },
  { code: 'EUR', name: 'Euro', symbol: '€', rate: 0.92, after: false, dec: 2, on: true },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', rate: 80, after: true, dec: 0, on: false },
  { code: 'GBP', name: 'British Pound', symbol: '£', rate: 0.79, after: false, dec: 2, on: false },
  { code: 'GEL', name: 'Georgian Lari', symbol: '₾', rate: 2.7, after: true, dec: 2, on: false },
];
const curList = () => cfg().currencies;
const curInfo = code => curList().find(c => c.code === code) || curList().find(c => c.code === cfg().baseCur) || curList()[0];
const dispCur = () => curInfo(cfg().dispCur).code;
const baseCur = () => curInfo(cfg().baseCur).code;
const curSym = (code = dispCur()) => curInfo(code).symbol;
/** Convert an amount between currency codes. */
function conv(amount, from, to = dispCur()) {
  const a = Number(amount) || 0;
  if (!from || from === to) return a;
  const rf = Number(curInfo(from).rate) || 1, rt = Number(curInfo(to).rate) || 1;
  return a / rf * rt;
}
/** Format an amount. By default it is already in the display currency; pass {cur} for another one. */
function fmtMoney(n, { sign = false, short = false, cur } = {}) {
  const c = curInfo(cur || dispCur());
  const v = Math.abs(Number(n) || 0);
  const dec = short && v >= 1000 ? 0 : (c.dec ?? 2);
  const s = v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const pre = n < 0 ? '−' : (sign && n > 0 ? '+' : '');
  return c.after ? `${pre}${s} ${c.symbol}` : `${pre}${c.symbol}${s}`;
}
/** Short axis label in the display currency, e.g. "$1.2k" / "450k ֏". */
function fmtMoneyAxis(v) {
  const c = curInfo(dispCur());
  const s = v >= 1e6 ? num(v / 1e6, 1) + 'M' : v >= 1000 ? num(v / 1000, 1) + 'k' : num(v);
  return c.after ? `${s} ${c.symbol}` : `${c.symbol}${s}`;
}
function fmtDuration(min) {
  min = Math.round(min || 0);
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}h${m ? ' ' + m + 'm' : ''}` : `${m}m`;
}

/* ---------- Icons (inline SVG, lucide-style) ---------- */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  tasks: '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  apple: '<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  note: '<path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M10 2h4"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  play: '<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" fill="currentColor"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  skip: '<path d="m5 4 10 8-10 8z"/><path d="M19 5v14"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  pin: '<path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="m2 2 20 20M6.7 6.7C3.9 8.4 2 12 2 12s3 7 10 7c1.9 0 3.6-.5 5-1.3M10.6 5.1c.5-.1.9-.1 1.4-.1 7 0 10 7 10 7a13 13 0 0 1-1.7 2.7"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  shrink: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  bed: '<path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  map: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  scale: '<path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1zM2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1zM7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8H8M16 12H8M13 16H8"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  keyboard: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>',
  panel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
  palette: '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.56-2.5 5.56-5.55C21.97 6.01 17.46 2 12 2z"/>',
  user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  cloudok: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="m9.5 14 2 2 3.5-3.5"/>',
  cloudoff: '<path d="m2 2 20 20"/><path d="M5.78 5.78A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.31-.2M21.53 16.08A4.5 4.5 0 0 0 17.5 10h-1.79A7 7 0 0 0 10.12 5.1"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  cap: '<path d="M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z"/><path d="M22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
};
function ic(name, size = 18, extra = '') {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${ICONS[name] || ''}</svg>`;
}

const PALETTE = ['#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#64748b'];
const EMOJIS = ['💪', '🏃', '🧘', '📚', '💧', '🥗', '😴', '🧠', '✍️', '🎸', '🧹', '💊', '🚭', '☀️', '🙏', '💻', '🎯', '🌱', '🚴', '🏊', '🦷', '📵', '💰', '❤️', '🍎', '🚶', '🎨', '🧴'];

/* ---------- Modules & widgets registry ---------- */
const MODULES = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home', fixed: true },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'tasks', label: 'Tasks', icon: 'tasks' },
  { id: 'habits', label: 'Habits', icon: 'flame' },
  { id: 'fitness', label: 'Gym & Fitness', icon: 'dumbbell' },
  { id: 'health', label: 'Nutrition & Sleep', icon: 'apple' },
  { id: 'finance', label: 'Money', icon: 'wallet' },
  { id: 'study', label: 'Study', icon: 'cap' },
  { id: 'journal', label: 'Journal', icon: 'book' },
  { id: 'notes', label: 'Notes', icon: 'note' },
  { id: 'goals', label: 'Goals', icon: 'target' },
  { id: 'focus', label: 'Focus Timer', icon: 'timer' },
  { id: 'settings', label: 'Settings', icon: 'sliders', fixed: true },
];
const WIDGETS = [
  { id: 'today', label: 'Overview', icon: 'sparkles', module: 'dashboard', size: 2 },
  { id: 'agenda', label: 'Agenda', icon: 'calendar', module: 'calendar', size: 1 },
  { id: 'tasks', label: 'Tasks', icon: 'tasks', module: 'tasks', size: 1 },
  { id: 'habits', label: 'Habits today', icon: 'flame', module: 'habits', size: 1 },
  { id: 'fitness', label: 'Training', icon: 'dumbbell', module: 'fitness', size: 1 },
  { id: 'study', label: 'Study', icon: 'cap', module: 'study', size: 1 },
  { id: 'water', label: 'Water', icon: 'droplet', module: 'health', size: 1 },
  { id: 'nutrition', label: 'Nutrition', icon: 'apple', module: 'health', size: 1 },
  { id: 'mood', label: 'Mood', icon: 'smile', module: 'journal', size: 1 },
  { id: 'finance', label: 'Money', icon: 'wallet', module: 'finance', size: 1 },
  { id: 'goals', label: 'Goals', icon: 'target', module: 'goals', size: 1 },
  { id: 'sleep', label: 'Sleep', icon: 'moon', module: 'health', size: 1 },
  { id: 'focus', label: 'Focus', icon: 'timer', module: 'focus', size: 1 },
  { id: 'notes', label: 'Pinned notes', icon: 'pin', module: 'notes', size: 1 },
  { id: 'weekchart', label: 'Week at a glance', icon: 'trend', module: 'dashboard', size: 2 },
  { id: 'quote', label: 'Daily quote', icon: 'star', module: 'dashboard', size: 1 },
];
const moduleOn = id => { const m = MODULES.find(x => x.id === id); return !!m && (m.fixed || cfg().modules[id] !== false); };

/* ---------- Default state ---------- */
function defaultState() {
  return {
    version: 1,
    created: todayStrSafe(),
    settings: {
      name: '',
      theme: 'system', accent: '#6366f1', font: 'inter', fontSize: 'medium', density: 'comfortable', radius: 'rounded',
      sidebar: 'expanded', motion: 'full',
      weekStart: 1, clock24: false, weightUnit: 'kg', distUnit: 'km',
      currencies: DEFAULT_CURRENCIES.map(c => ({ ...c })), baseCur: 'USD', dispCur: 'USD', ratesUpdated: null,
      studyGoalMin: 600,
      waterGoal: 8, glassMl: 250, calorieGoal: 2200, proteinGoal: 150, carbGoal: 250, fatGoal: 70,
      sleepGoal: 8, workoutGoal: 4, goalWeight: null, defaultRest: 90,
      focusMin: 25, shortMin: 5, longMin: 15, longEvery: 4, autoBreak: false, autoFocus: false, focusSound: true, focusTitle: true,
      calView: 'month', calStartHour: 7, calLayers: { events: true, tasks: true, workouts: true, bills: true, exams: true },
      taskSort: 'due', taskGroup: 'auto', taskShowDone: false,
      habitStrip: 'week',
      notesView: 'grid', notesSort: 'updated',
      showQuote: true,
      modules: Object.fromEntries(MODULES.map(m => [m.id, true])),
      moduleOrder: MODULES.map(m => m.id),
      widgets: WIDGETS.map(w => ({ id: w.id, on: !['notes', 'weekchart'].includes(w.id), size: w.size })),
      expenseCats: ['Housing', 'Groceries', 'Dining', 'Transport', 'Utilities', 'Health', 'Fitness', 'Shopping', 'Entertainment', 'Subscriptions', 'Travel', 'Education', 'Gifts', 'Other'],
      incomeCats: ['Salary', 'Freelance', 'Investments', 'Gifts', 'Refunds', 'Other'],
      journalTags: ['Work', 'Exercise', 'Friends', 'Family', 'Reading', 'Outdoors', 'Gaming', 'Travel', 'Learning', 'Rest', 'Sick', 'Date'],
      goalCats: ['Health', 'Fitness', 'Career', 'Finance', 'Learning', 'Personal', 'Relationships', 'Travel'],
    },
    events: [], tasks: [],
    lists: [
      { id: 'inbox', name: 'Inbox', color: '#64748b' },
      { id: 'personal', name: 'Personal', color: '#6366f1' },
      { id: 'work', name: 'Work', color: '#f97316' },
      { id: 'errands', name: 'Errands', color: '#22c55e' },
    ],
    habits: [], workouts: [], templates: [], bodyweight: [],
    meals: [], foods: [], water: {}, sleep: [],
    transactions: [], budgets: {}, bills: [],
    journal: {}, notes: [], goals: [], focusLog: {},
    subjects: [], studyLog: [], exams: [],
  };
}
function todayStrSafe() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function normalize(raw) {
  const d = defaultState();
  const s = raw && typeof raw === 'object' ? raw : {};
  const out = { ...d, ...s };
  for (const k of Object.keys(d)) {
    if (Array.isArray(d[k]) && !Array.isArray(out[k])) out[k] = d[k];
    if (!Array.isArray(d[k]) && d[k] && typeof d[k] === 'object' && (typeof out[k] !== 'object' || out[k] === null || Array.isArray(out[k]))) out[k] = d[k];
  }
  const ss = s.settings || {};
  out.settings = { ...d.settings, ...ss };
  out.settings.modules = { ...d.settings.modules, ...(ss.modules || {}) };
  out.settings.calLayers = { ...d.settings.calLayers, ...(ss.calLayers || {}) };
  const ord = [...new Set((Array.isArray(ss.moduleOrder) ? ss.moduleOrder : []).filter(id => MODULES.some(m => m.id === id)))];
  // modules added in later versions slot in at their default position
  MODULES.forEach((m, i) => { if (!ord.includes(m.id)) ord.splice(Math.min(i, ord.length), 0, m.id); });
  out.settings.moduleOrder = ord;
  const ws = (Array.isArray(ss.widgets) ? ss.widgets : []).filter(w => w && WIDGETS.some(x => x.id === w.id));
  const seen = new Set();
  out.settings.widgets = ws.filter(w => !seen.has(w.id) && seen.add(w.id)).map(w => ({ id: w.id, on: w.on !== false, size: [1, 2, 3].includes(w.size) ? w.size : 1 }));
  d.settings.widgets.forEach(w => { if (!seen.has(w.id)) out.settings.widgets.push({ ...w }); });
  // currencies: keep user edits, add any new defaults, make sure base/display exist
  const curs = (Array.isArray(ss.currencies) ? ss.currencies : []).filter(c => c && c.code && c.symbol && Number(c.rate) > 0);
  DEFAULT_CURRENCIES.forEach(c => { if (!curs.some(x => x.code === c.code)) curs.push({ ...c }); });
  out.settings.currencies = curs;
  if (!curs.some(c => c.code === out.settings.baseCur)) out.settings.baseCur = 'USD';
  if (!curs.some(c => c.code === out.settings.dispCur)) out.settings.dispCur = out.settings.baseCur;
  ['expenseCats', 'incomeCats', 'journalTags', 'goalCats'].forEach(k => { if (!Array.isArray(out.settings[k]) || !out.settings[k].length) out.settings[k] = d.settings[k]; });
  if (!out.lists.some(l => l.id === 'inbox')) out.lists.unshift(d.lists[0]);
  return out;
}

/* ---------- Persistence ---------- */
function loadState() {
  try {
    const raw = localStorage.getItem(storeKey());
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { console.warn('Load failed', e); }
  return null;
}
let saveTimer = null;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 120); }
function saveNow() {
  clearTimeout(saveTimer);
  if (!App.state) return;
  try {
    localStorage.setItem(storeKey(), JSON.stringify(App.state));
    if (!App.persistOk) toast('Saving works again', { type: 'success' });
    App.persistOk = true;
  } catch (e) {
    if (App.persistOk) toast('Could not save: browser storage is full or blocked. Export a backup in Settings.', { type: 'error', ms: 8000 });
    App.persistOk = false;
  }
  App.onSaved?.(); // cloud sync hook
}

/** Mutate state, persist, re-render the current view. */
function update(fn, { render = true } = {}) {
  fn(App.state);
  save();
  if (render) renderView();
}
/** Same as update, but shows a toast with Undo that restores the previous state. */
function withUndo(label, fn) {
  const snap = JSON.stringify(App.state);
  update(fn);
  renderNav();
  toast(label, { action: 'Undo', onAction: () => { App.state = normalize(JSON.parse(snap)); save(); renderAll(); toast('Restored'); } });
}

/* ---------- Rendering ---------- */
function renderView() {
  const el = $('#view');
  const v = App.views[App.route];
  if (!el || !v) return;
  const a = document.activeElement;
  const focus = a && a.id && el.contains(a) ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null;
  const scrollers = $$('[data-keep-scroll]', el).map(n => [n.dataset.keepScroll, n.scrollTop]);
  App.charts.clear();
  el.innerHTML = v.render();
  v.mount?.(el);
  drawCharts(el);
  scrollers.forEach(([k, t]) => { const n = el.querySelector(`[data-keep-scroll="${k}"]`); if (n) n.scrollTop = t; });
  if (focus) {
    const n = document.getElementById(focus.id);
    if (n) { n.focus({ preventScroll: true }); try { if (focus.s != null) n.setSelectionRange(focus.s, focus.e); } catch (e) {} }
  }
}
function renderAll() { applySettings(); renderNav(); renderTopbar(); renderView(); }
function go(route) {
  if (location.hash === '#/' + route) { renderView(); return; }
  location.hash = '#/' + route;
}

/* ---------- Global delegated events ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t || t.disabled) return;
  const fn = App.actions[t.dataset.act];
  if (fn) { if (t.tagName === 'A') e.preventDefault(); fn(t, e); }
});
document.addEventListener('change', e => {
  const t = e.target.closest('[data-change]');
  if (t) App.actions[t.dataset.change]?.(t, e);
});
document.addEventListener('input', e => {
  const t = e.target.closest('[data-input]');
  if (t) App.actions[t.dataset.input]?.(t, e);
});
document.addEventListener('keydown', e => {
  const t = e.target.closest && e.target.closest('[data-enter]');
  if (t && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); App.actions[t.dataset.enter]?.(t, e); }
});

/* ---------- Small UI builders ---------- */
function seg(act, opts, val, attrs = '') {
  return `<div class="seg" ${attrs}>${opts.map(o => {
    const v = typeof o === 'object' ? o.value : o, l = typeof o === 'object' ? o.label : o;
    return `<button type="button" class="${String(v) === String(val) ? 'on' : ''}" data-act="${act}" data-val="${esc(v)}">${l}</button>`;
  }).join('')}</div>`;
}
function tabs(act, opts, val) {
  return `<div class="tabs" role="tablist">${opts.map(o => `<button type="button" role="tab" class="${o.value === val ? 'on' : ''}" data-act="${act}" data-val="${esc(o.value)}">${o.icon ? ic(o.icon, 16) : ''}${esc(o.label)}${o.count != null ? ` <span class="badge">${o.count}</span>` : ''}</button>`).join('')}</div>`;
}
function emptyState(icon, title, text = '', action = '', small = false) {
  return `<div class="empty ${small ? 'sm' : ''}"><div class="e-ic">${ic(icon, small ? 20 : 24)}</div><h4>${esc(title)}</h4>${text ? `<p>${text}</p>` : ''}${action}</div>`;
}
function bar(pct, color = '', cls = '') {
  const p = clamp((pct || 0) * 100, 0, 100);
  return `<div class="bar ${cls} ${pct > 1 && cls.includes('cap') ? 'over' : ''}" ${color ? `style="--c:${color}"` : ''}><i style="width:${p}%"></i></div>`;
}
function ring(p, o = {}) {
  const size = o.size || 96, sw = o.sw || 10, r = (size - sw) / 2, c = 2 * Math.PI * r, pc = clamp(p || 0, 0, 1);
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${sw}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${o.color || 'var(--accent)'}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - pc)).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg><div class="ring-c" style="font-size:${o.font || Math.round(size / 5)}px">${o.center ?? Math.round(pc * 100) + '%'}${o.sub ? `<small>${o.sub}</small>` : ''}</div></div>`;
}
function dateNav(act, ds, { pickAct } = {}) {
  return `<div class="date-nav">
    <button class="btn-icon sm" data-act="${act}" data-d="-1" aria-label="Previous day">${ic('left', 16)}</button>
    <label class="dl" style="cursor:pointer;position:relative">${esc(relDay(ds))}${relDay(ds).length < 10 ? ` <span class="faint small">${fmtDate(ds)}</span>` : ''}
      <input type="date" value="${ds}" data-change="${pickAct || act + 'Pick'}" aria-label="Pick date"></label>
    <button class="btn-icon sm" data-act="${act}" data-d="1" aria-label="Next day">${ic('right', 16)}</button>
    ${ds !== todayStr() ? `<button class="btn btn-sm btn-ghost" data-act="${act}" data-d="0">Today</button>` : ''}
  </div>`;
}
// clicking the date label opens the native picker
document.addEventListener('click', e => {
  const l = e.target.closest('.date-nav .dl');
  if (!l) return;
  const inp = l.querySelector('input[type=date]');
  try { inp.showPicker(); } catch (err) { inp.focus(); }
});

/* ---------- Toast ---------- */
function toast(msg, o = {}) {
  const host = $('#toasts');
  if (!host) return;
  const t = document.createElement('div');
  t.className = 'toast ' + (o.type || '');
  t.innerHTML = `<span>${esc(msg)}</span>${o.action ? `<button class="toast-btn">${esc(o.action)}</button>` : ''}`;
  host.appendChild(t);
  while (host.children.length > 3) host.firstChild.remove();
  const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 220); };
  const timer = setTimeout(kill, o.ms || (o.action ? 6000 : 3200));
  if (o.action) t.querySelector('.toast-btn').onclick = () => { clearTimeout(timer); kill(); o.onAction?.(); };
}

/* ---------- Modal ---------- */
function openModal({ title = '', body = '', footer = '', size = '', cls = '', onMount, onClose, dismissable = true }) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-back';
  wrap.innerHTML = `<div class="modal ${size} ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h3>${esc(title)}</h3><button type="button" class="btn-icon" data-close aria-label="Close">${ic('x')}</button></div>
    <div class="modal-body">${body}</div>${footer ? `<div class="modal-foot">${footer}</div>` : ''}</div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));
  let closed = false;
  const m = { el: wrap, dismissable };
  const close = () => {
    if (closed) return; closed = true;
    wrap.classList.remove('show');
    setTimeout(() => wrap.remove(), 200);
    App.modals = App.modals.filter(x => x !== m);
    onClose?.();
  };
  m.close = close;
  m.tryClose = () => (m.beforeClose ? m.beforeClose() : close());
  let downOnBack = false;
  wrap.addEventListener('mousedown', e => { downOnBack = e.target === wrap; });
  wrap.addEventListener('click', e => { if (e.target === wrap && downOnBack && dismissable) m.tryClose(); });
  wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) m.tryClose(); });
  App.modals.push(m);
  onMount?.(wrap, close, m);
  setTimeout(() => {
    if (!wrap.isConnected || wrap.contains(document.activeElement)) return;
    const f = wrap.querySelector('[autofocus], .modal-body input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=date]):not([type=time]), .modal-body textarea');
    if (f && window.matchMedia('(hover: hover)').matches) f.focus(); else wrap.querySelector('.modal').focus?.();
  }, 40);
  return m;
}

function confirmDialog(msg, { title = 'Are you sure?', ok = 'Confirm', danger = false } = {}) {
  return new Promise(res => {
    let done = false;
    openModal({
      title, size: 'sm', body: `<p class="muted">${esc(msg)}</p>`,
      footer: `<span class="spacer"></span><button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(ok)}</button>`,
      onMount: (w, close) => { const b = w.querySelector('[data-ok]'); b.onclick = () => { done = true; res(true); close(); }; setTimeout(() => b.focus(), 50); },
      onClose: () => { if (!done) res(false); },
    });
  });
}
function choiceDialog(title, msg, choices) {
  return new Promise(res => {
    let done = false;
    openModal({
      title, size: 'sm', body: `<p class="muted">${esc(msg)}</p>`,
      footer: `<span class="spacer"></span><button type="button" class="btn btn-ghost" data-close>Cancel</button>${choices.map((c, i) => `<button type="button" class="btn ${c.cls || ''}" data-ch="${i}">${esc(c.label)}</button>`).join('')}`,
      onMount: (w, close) => w.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => { done = true; res(choices[b.dataset.ch].value); close(); }),
      onClose: () => { if (!done) res(null); },
    });
  });
}

/* ---------- Form builder ---------- */
const optList = opts => (typeof opts === 'function' ? opts() : opts || []).map(o => typeof o === 'object' ? o : { value: o, label: String(o) });
function clRow(item = {}) {
  return `<div class="cl-row" data-id="${esc(item.id || uid())}"><input type="checkbox" ${item.done ? 'checked' : ''} aria-label="Done"><input type="text" class="input input-sm" value="${esc(item.title || '')}" placeholder="Item…"><button type="button" class="btn-icon sm danger" data-cl-del aria-label="Remove">${ic('x', 14)}</button></div>`;
}
function fieldHtml(f, v) {
  const k = f.key, id = 'f_' + k;
  const cls = `field ${f.half ? 'half' : ''} ${f.third ? 'third' : ''}`;
  const lab = f.label ? `<span class="flabel">${esc(f.label)}${f.required ? ' <em>*</em>' : ''}</span>` : '';
  const hint = f.hint ? `<small class="fhint">${f.hint}</small>` : '';
  if (v === undefined || v === null) v = f.default ?? (f.type === 'checkbox' ? false : (f.type === 'checklist' || f.type === 'days' ? [] : ''));
  switch (f.type) {
    case 'textarea':
      return `<label class="${cls}" data-field="${k}">${lab}<textarea class="input" name="${k}" id="${id}" rows="${f.rows || 4}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>${hint}</label>`;
    case 'select':
      return `<label class="${cls}" data-field="${k}">${lab}<select class="input" name="${k}" id="${id}">${optList(f.options).map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>${hint}</label>`;
    case 'checkbox':
      return `<label class="${cls} check-field" data-field="${k}"><input type="checkbox" name="${k}" ${v ? 'checked' : ''}><span class="switch"></span><span>${esc(f.label)}</span></label>`;
    case 'color': {
      const cols = [...(f.colors || PALETTE)];
      if (v && !cols.includes(v)) cols.push(v);
      if (!v) v = cols[0];
      return `<div class="${cls}" data-field="${k}">${lab}<div class="swatches">${cols.map(c => `<label class="sw" style="--c:${c}" title="${c}"><input type="radio" name="${k}" value="${c}" ${c === v ? 'checked' : ''}><span></span></label>`).join('')}</div></div>`;
    }
    case 'seg':
      return `<div class="${cls}" data-field="${k}">${lab}<div class="seg full">${optList(f.options).map(o => `<label><input type="radio" name="${k}" value="${esc(o.value)}" ${String(o.value) === String(v) ? 'checked' : ''}><span>${o.label}</span></label>`).join('')}</div></div>`;
    case 'days':
      return `<div class="${cls}" data-field="${k}">${lab}<div class="seg full">${weekdayNames().map(({ d, name }) => `<label><input type="checkbox" name="${k}" value="${d}" ${(v || []).includes(d) ? 'checked' : ''}><span>${esc(name.slice(0, 2))}</span></label>`).join('')}</div>${hint}</div>`;
    case 'emoji':
      return `<div class="${cls}" data-field="${k}">${lab}<div class="emoji-field"><input class="input emoji-input" name="${k}" id="${id}" value="${esc(v)}" maxlength="8" aria-label="Emoji"><div class="emoji-opts">${EMOJIS.map(e => `<button type="button" class="emo" data-emoji="${e}">${e}</button>`).join('')}</div></div></div>`;
    case 'checklist':
      return `<div class="${cls}" data-field="${k}">${lab}<div class="checklist" data-cl="${k}">${(v || []).map(clRow).join('')}</div><div><button type="button" class="btn btn-sm btn-ghost" data-cl-add="${k}">${ic('plus', 14)} Add item</button></div></div>`;
    case 'range':
      return `<label class="${cls}" data-field="${k}">${lab}<div class="range-row"><input type="range" name="${k}" min="${f.min ?? 0}" max="${f.max ?? 10}" step="${f.step ?? 1}" value="${esc(v)}"><output>${esc(v)}</output></div>${hint}</label>`;
    default:
      return `<label class="${cls}" data-field="${k}">${lab}<input class="input" type="${f.type || 'text'}" name="${k}" id="${id}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} ${f.step ? `step="${f.step}"` : ''} ${f.list ? `list="${f.list}"` : ''} ${f.autofocus ? 'autofocus' : ''} ${f.type === 'number' ? 'inputmode="decimal"' : ''} autocomplete="off">${hint}</label>`;
  }
}
function collectForm(form, fields) {
  const v = {};
  fields.forEach(f => {
    const k = f.key;
    if (f.type === 'checkbox') v[k] = !!form.querySelector(`input[name="${k}"]`)?.checked;
    else if (f.type === 'color' || f.type === 'seg') v[k] = form.querySelector(`input[name="${k}"]:checked`)?.value ?? '';
    else if (f.type === 'days') v[k] = $$(`input[name="${k}"]:checked`, form).map(i => Number(i.value));
    else if (f.type === 'number' || f.type === 'range') { const x = form.querySelector(`[name="${k}"]`)?.value ?? ''; v[k] = x === '' || isNaN(Number(x)) ? null : Number(x); }
    else if (f.type === 'checklist') v[k] = $$(`[data-cl="${k}"] .cl-row`, form).map(r => ({ id: r.dataset.id || uid(), title: r.querySelector('input[type=text]').value.trim(), done: r.querySelector('input[type=checkbox]').checked })).filter(x => x.title);
    else v[k] = (form.querySelector(`[name="${k}"]`)?.value ?? '').trim();
  });
  return v;
}
/**
 * Generic form modal. fields: [{key,label,type,options,required,half,third,showIf(vals),...}]
 * onSave(vals) returning false keeps the modal open.
 */
function formModal(o) {
  const fields = o.fields;
  const body = `${o.intro || ''}<form class="form-grid" novalidate autocomplete="off">${fields.map(f => fieldHtml(f, o.values?.[f.key])).join('')}<button type="submit" hidden></button></form>`;
  const foot = `${o.onDelete ? `<button type="button" class="btn btn-ghost danger" data-del>${ic('trash', 16)} Delete</button>` : ''}${o.extraFoot || ''}<span class="spacer"></span><button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="button" class="btn btn-primary" data-save>${esc(o.submit || 'Save')}</button>`;
  return openModal({
    title: o.title, body, footer: foot, size: o.size,
    onMount: (wrap, close, m) => {
      const form = wrap.querySelector('form');
      const vis = () => {
        const vals = collectForm(form, fields);
        fields.forEach(f => { if (!f.showIf) return; const el = form.querySelector(`[data-field="${f.key}"]`); if (el) el.hidden = !f.showIf(vals); });
      };
      form.addEventListener('input', e => {
        e.target.closest('.field')?.classList.remove('invalid');
        if (e.target.type === 'range') e.target.nextElementSibling.textContent = e.target.value;
        vis();
      });
      form.addEventListener('change', vis);
      vis();
      form.addEventListener('click', e => {
        const em = e.target.closest('[data-emoji]');
        if (em) { const inp = em.closest('.emoji-field').querySelector('input'); inp.value = em.dataset.emoji; inp.dispatchEvent(new Event('input', { bubbles: true })); }
        const add = e.target.closest('[data-cl-add]');
        if (add) { const list = form.querySelector(`[data-cl="${add.dataset.clAdd}"]`); list.insertAdjacentHTML('beforeend', clRow()); list.lastElementChild.querySelector('input[type=text]').focus(); }
        const del = e.target.closest('[data-cl-del]');
        if (del) del.closest('.cl-row').remove();
      });
      form.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.closest('.cl-row')) {
          e.preventDefault();
          const row = e.target.closest('.cl-row');
          row.insertAdjacentHTML('afterend', clRow());
          row.nextElementSibling.querySelector('input[type=text]').focus();
        }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doSave(); }
      });
      const doSave = () => {
        const vals = collectForm(form, fields);
        for (const f of fields) {
          const el = form.querySelector(`[data-field="${f.key}"]`);
          if (el?.hidden) continue;
          const val = vals[f.key];
          if (f.required && (val === '' || val == null)) {
            el?.classList.add('invalid'); el?.querySelector('input,textarea,select')?.focus();
            toast(`${f.label || 'This field'} is required`, { type: 'error' }); return;
          }
          if (f.type === 'number' && val != null && ((f.min != null && val < f.min) || (f.max != null && val > f.max))) {
            el?.classList.add('invalid'); el?.querySelector('input')?.focus();
            toast(`${f.label} must be between ${f.min ?? '−∞'} and ${f.max ?? '∞'}`, { type: 'error' }); return;
          }
        }
        if (o.onSave(vals, form) !== false) close();
      };
      form.addEventListener('submit', e => { e.preventDefault(); doSave(); });
      wrap.querySelector('[data-save]').onclick = doSave;
      const delBtn = wrap.querySelector('[data-del]');
      if (delBtn) delBtn.onclick = () => { close(); o.onDelete(); };
      o.onMount?.(form, wrap, close, m);
    },
  });
}

/* ---------- Popover menu ---------- */
function openMenu(anchor, items, { align = 'left' } = {}) {
  closeMenu();
  const m = document.createElement('div');
  m.className = 'menu';
  m.setAttribute('role', 'menu');
  m.innerHTML = items.map((it, i) => it === '-' ? '<div class="sep"></div>'
    : it.check != null ? `<label><input type="checkbox" data-mi="${i}" ${it.check ? 'checked' : ''}>${esc(it.label)}</label>`
      : `<button type="button" role="menuitem" data-mi="${i}">${it.icon ? `<span class="m-ic" style="${it.color ? `--c:${it.color}` : ''}">${ic(it.icon, 16)}</span>` : ''}${esc(it.label)}${it.hint ? `<span class="spacer"></span><kbd>${esc(it.hint)}</kbd>` : ''}</button>`).join('');
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let left = align === 'right' ? r.right - mw : r.left;
  left = clamp(left, 8, window.innerWidth - mw - 8);
  let top = r.bottom + 6;
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  m.style.left = left + 'px'; m.style.top = top + 'px';
  m.addEventListener('click', e => {
    const b = e.target.closest('[data-mi]');
    if (!b) return;
    const it = items[b.dataset.mi];
    if (it.check != null) { it.onChange?.(b.checked); return; }
    closeMenu(); it.onClick?.();
  });
  App.menu = m;
  setTimeout(() => document.addEventListener('mousedown', menuOutside), 0);
}
function menuOutside(e) { if (App.menu && !App.menu.contains(e.target)) closeMenu(); }
function closeMenu() { if (App.menu) { App.menu.remove(); App.menu = null; } document.removeEventListener('mousedown', menuOutside); }

/* ---------- Charts (drawn after mount at real pixel width) ---------- */
function chartSlot(spec) {
  const id = 'c' + (++App.chartSeq);
  App.charts.set(id, spec);
  return `<div class="chart-slot" data-chart="${id}" style="height:${spec.h || 180}px"></div>`;
}
function drawCharts(root = document) {
  $$('.chart-slot[data-chart]', root).forEach(el => {
    const spec = App.charts.get(el.dataset.chart);
    if (!spec) return;
    const w = Math.floor(el.clientWidth);
    if (!w) return;
    el.innerHTML = spec.type === 'bar' ? barSvg(spec, w) : lineSvg(spec, w);
  });
}
function axisFmt(spec, v) { return spec.fmt ? spec.fmt(v) : num(v, Math.abs(v) < 10 && v % 1 ? 1 : 0); }
function labelStep(n, W) { return Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - 60) / 64)))); }
function lineSvg(s, W) {
  const H = s.h || 180, pl = 42, pr = 14, pt = 12, pb = 24;
  const pts = s.points || [];
  const valid = pts.map((p, i) => ({ ...p, i })).filter(p => p.v != null && !isNaN(p.v));
  if (!valid.length) return `<div class="chart-empty">${esc(s.empty || 'No data yet')}</div>`;
  const vals = valid.map(p => p.v);
  if (s.goal != null) vals.push(s.goal);
  let mn = s.min0 ? 0 : Math.min(...vals), mx = Math.max(...vals);
  if (s.yMin != null) mn = s.yMin;
  if (s.yMax != null) mx = s.yMax;
  if (mn === mx) { mx += 1; if (!s.min0) mn -= 1; }
  const span = mx - mn;
  if (!s.min0 && s.yMin == null) mn -= span * .15;
  if (s.yMax == null) mx += span * .12;
  const n = pts.length;
  const X = i => n === 1 ? pl + (W - pl - pr) / 2 : pl + i * (W - pl - pr) / (n - 1);
  const Y = v => pt + (mx - v) / (mx - mn) * (H - pt - pb);
  const color = s.color || 'var(--accent)';
  const gid = 'g' + Math.random().toString(36).slice(2, 8);
  let g = '';
  for (let k = 0; k <= 3; k++) {
    const v = mn + (mx - mn) * k / 3, y = Y(v);
    g += `<line class="grid-line" x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}"/><text x="${pl - 8}" y="${y + 4}" text-anchor="end">${esc(axisFmt(s, v))}</text>`;
  }
  const step = labelStep(n, W);
  pts.forEach((p, i) => { if (i % step === 0 || i === n - 1 && (n - 1) % step > step / 2) g += `<text x="${X(i)}" y="${H - 6}" text-anchor="middle">${esc(p.label)}</text>`; });
  const line = valid.map((p, j) => `${j ? 'L' : 'M'}${X(p.i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L${X(valid[valid.length - 1].i).toFixed(1)},${H - pb} L${X(valid[0].i).toFixed(1)},${H - pb} Z`;
  const goal = s.goal != null ? `<line class="goal-line" x1="${pl}" x2="${W - pr}" y1="${Y(s.goal)}" y2="${Y(s.goal)}"/><text x="${W - pr}" y="${Y(s.goal) - 5}" text-anchor="end">${esc(s.goalLabel || 'Goal')}</text>` : '';
  const dots = valid.length <= 45 ? valid.map(p => `<circle class="pt" cx="${X(p.i)}" cy="${Y(p.v)}" r="${valid.length > 20 ? 2.5 : 3.5}" fill="var(--surface)" stroke="${color}" stroke-width="2"><title>${esc(p.tip || `${p.label}: ${axisFmt(s, p.v)}`)}</title></circle>`).join('') : '';
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(s.label || 'Chart')}">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${g}${valid.length > 1 && s.area !== false ? `<path d="${area}" fill="url(#${gid})"/>` : ''}
    ${valid.length > 1 ? `<path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
    ${goal}${dots}</svg>`;
}
function barSvg(s, W) {
  const H = s.h || 180, pl = 42, pr = 10, pt = 12, pb = 24;
  const labels = s.labels || [], series = s.series || [];
  const all = series.flatMap(x => x.values).filter(v => v != null && !isNaN(v));
  if (!all.length || all.every(v => v === 0) && s.goal == null) return `<div class="chart-empty">${esc(s.empty || 'No data yet')}</div>`;
  const mx = Math.max(1e-9, ...all, s.goal || 0) * 1.12;
  const n = labels.length, ns = series.length;
  const gw = (W - pl - pr) / n;
  const bw = Math.max(3, Math.min(30, (gw * .72) / ns));
  const Y = v => pt + (1 - v / mx) * (H - pt - pb);
  let g = '';
  for (let k = 0; k <= 3; k++) {
    const v = mx * k / 3, y = Y(v);
    g += `<line class="grid-line" x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}"/><text x="${pl - 8}" y="${y + 4}" text-anchor="end">${esc(axisFmt(s, v))}</text>`;
  }
  const step = labelStep(n, W);
  let bars = '';
  labels.forEach((lab, i) => {
    const cx = pl + i * gw + gw / 2;
    series.forEach((se, j) => {
      const v = se.values[i] || 0;
      const x = cx - (bw * ns) / 2 + j * bw + (ns > 1 ? 1 : 0);
      const y = Y(Math.max(0, v)), h = Math.max(v > 0 ? 2 : 0, H - pb - y);
      const col = typeof se.color === 'function' ? se.color(v, i) : se.color;
      bars += `<rect class="b" x="${x.toFixed(1)}" y="${(H - pb - h).toFixed(1)}" width="${(bw - (ns > 1 ? 2 : 0)).toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(4, bw / 3)}" fill="${col || 'var(--accent)'}"><title>${esc(`${lab}${se.name ? ' · ' + se.name : ''}: ${axisFmt(s, v)}`)}</title></rect>`;
    });
    if (i % step === 0) g += `<text x="${cx}" y="${H - 6}" text-anchor="middle">${esc(lab)}</text>`;
  });
  const goal = s.goal != null ? `<line class="goal-line" x1="${pl}" x2="${W - pr}" y1="${Y(s.goal)}" y2="${Y(s.goal)}"/>` : '';
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(s.label || 'Chart')}">${g}${bars}${goal}</svg>`;
}
let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => drawCharts(document), 150); });

/* ---------- Misc ---------- */
function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function beep(freq = 880, dur = 0.18, times = 3) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = freq; o.type = 'sine';
      o.connect(g); g.connect(ctx.destination);
      const t0 = ctx.currentTime + i * (dur + 0.12);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.start(t0); o.stop(t0 + dur + 0.02);
    }
    setTimeout(() => ctx.close(), (dur + 0.15) * times * 1000 + 300);
  } catch (e) {}
}
function colorContrast(hex) {
  const h = hex.replace('#', '');
  if (h.length < 6) return '#fff';
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  const L = .2126 * r + .7152 * g + .0722 * b;
  return L > .45 ? '#111318' : '#ffffff';
}
const listById = id => db().lists.find(l => l.id === id) || db().lists[0];
