/* ===================== DIMORA DATA MODEL, CATALOGS & COSTS ===================== */
const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r2 = v => Math.round(v * 100) / 100;
const snap = (v, s = 0.05) => Math.round(v / s) * s;
const deep = o => JSON.parse(JSON.stringify(o));
const inr = v => '₹' + Math.round(v).toLocaleString('en-IN');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WALL_T = 0.12, DOOR_H = 2.1, FLOOR_TOP = 0.04;

const ROOM_TYPES = {
  living: { label: 'Living Room', tint: '#f3d9b1', min: 9.5, icon: '🛋️' },
  bedroom: { label: 'Bedroom', tint: '#c9dccb', min: 9.5, icon: '🛏️' },
  master: { label: 'Master Bedroom', tint: '#b9d3c0', min: 12, icon: '🛏️' },
  kitchen: { label: 'Kitchen', tint: '#f2c6a7', min: 5, icon: '🍳' },
  dining: { label: 'Dining', tint: '#ead1b8', min: 7.5, icon: '🍽️' },
  bathroom: { label: 'Bathroom', tint: '#bcd7e6', min: 1.8, icon: '🚿' },
  balcony: { label: 'Balcony', tint: '#d4e5c2', min: 2.5, icon: '🌿' },
  study: { label: 'Study', tint: '#d9cfe8', min: 6, icon: '📚' },
  office: { label: 'Home Office', tint: '#cfd6ea', min: 6.5, icon: '💼' },
  gaming: { label: 'Gaming Room', tint: '#cbc4ea', min: 8, icon: '🎮' },
  reading: { label: 'Reading Corner', tint: '#e8dcc0', min: 4, icon: '📖' },
  closet: { label: 'Walk-in Closet', tint: '#e6d3dc', min: 3.5, icon: '👗' },
  nursery: { label: 'Nursery', tint: '#f3d3d8', min: 7, icon: '🧸' },
  gym: { label: 'Home Gym', tint: '#d2e0dc', min: 8, icon: '🏋️' },
  guest: { label: 'Guest Room', tint: '#d8e2c8', min: 9, icon: '🛏️' },
  pooja: { label: 'Pooja Room', tint: '#f5dfb0', min: 1.5, icon: '🪔' },
  utility: { label: 'Utility', tint: '#d6d6d6', min: 2, icon: '🧺' },
  hall: { label: 'Passage', tint: '#e5e1da', min: 2, icon: '🚪' },
  empty: { label: 'Empty Room', tint: '#e8e8e8', min: 4, icon: '⬜' },
};
const TRANSFORMS = [
  { to: 'office', label: 'Home Office' }, { to: 'gaming', label: 'Gaming Room' }, { to: 'reading', label: 'Reading Corner' },
  { to: 'study', label: 'Study Room' }, { to: 'closet', label: 'Walk-in Closet' }, { to: 'nursery', label: 'Nursery' },
  { to: 'gym', label: 'Home Gym' }, { to: 'guest', label: 'Guest Room' }, { to: 'pooja', label: 'Pooja Room' }, { to: 'bedroom', label: 'Bedroom' },
];

/* Floor materials: ₹ per sq ft incl. laying (illustrative) */
const FLOORS = {
  vitrified: { label: 'Vitrified Tiles', color: '#e7e3dc', c2: '#cdc7bd', pattern: 2, scale: 0.6, rate: 85, fam: 'tile' },
  ceramic: { label: 'Ceramic Matte Tiles', color: '#cdbba5', c2: '#a8998a', pattern: 2, scale: 0.45, rate: 55, fam: 'tile' },
  antiskid: { label: 'Anti-skid Tiles', color: '#cdd3d5', c2: '#9ea6aa', pattern: 2, scale: 0.3, rate: 60, fam: 'tile' },
  marble: { label: 'Italian Marble', color: '#f0ede7', c2: '#a9a49b', pattern: 3, scale: 0.9, rate: 380, fam: 'stone' },
  indian_marble: { label: 'Indian Marble (Makrana)', color: '#ece8e0', c2: '#b9b2a4', pattern: 3, scale: 0.8, rate: 180, fam: 'stone' },
  granite: { label: 'Black Granite', color: '#38383a', c2: '#56565a', pattern: 6, scale: 0.6, rate: 150, fam: 'stone' },
  kota: { label: 'Kota Stone', color: '#7f8b74', c2: '#66705c', pattern: 6, scale: 0.6, rate: 60, fam: 'stone' },
  oak: { label: 'Oak Laminate', color: '#c39a6b', c2: '#8a6644', pattern: 1, scale: 0.19, rate: 110, fam: 'wood' },
  walnut: { label: 'Walnut Engineered Wood', color: '#6f4c35', c2: '#4a3020', pattern: 1, scale: 0.19, rate: 260, fam: 'wood' },
  herringbone: { label: 'Herringbone Oak', color: '#b8895a', c2: '#7d5a3a', pattern: 5, scale: 0.42, rate: 340, fam: 'wood' },
  vinyl: { label: 'Wood-look Vinyl (LVT)', color: '#b79471', c2: '#8a6d50', pattern: 1, scale: 0.18, rate: 75, fam: 'wood' },
  carpet: { label: 'Carpet Tiles', color: '#8d9198', c2: '#6f737a', pattern: 4, scale: 1, rate: 90, fam: 'soft' },
  concrete: { label: 'Polished Concrete', color: '#a7a6a2', c2: '#8a8985', pattern: 8, scale: 1.2, rate: 95, fam: 'stone' },
  deck: { label: 'Outdoor Deck (WPC)', color: '#8d6a4c', c2: '#5c4330', pattern: 1, scale: 0.14, rate: 160, fam: 'wood' },
};
const FLOOR_CHEAPER = { marble: 'indian_marble', indian_marble: 'vitrified', herringbone: 'oak', walnut: 'oak', oak: 'vinyl', granite: 'kota', vitrified: 'ceramic', carpet: 'vinyl', concrete: 'kota', deck: 'ceramic', antiskid: 'ceramic' };
/* Paint tiers ₹ per sq ft of wall */
const PAINT = { budget: { label: 'Economy emulsion', rate: 14 }, standard: { label: 'Premium emulsion', rate: 26 }, premium: { label: 'Luxury / texture finish', rate: 48 } };
const CEILINGS = {
  flat: { label: 'Plain ceiling', rate: 0 }, peripheral: { label: 'Peripheral false ceiling', rate: 95 },
  cove: { label: 'Cove-lit false ceiling', rate: 125 }, tray: { label: 'Tray ceiling with downlights', rate: 150 },
};
const LIGHT_COST = { ambient: 220 /* per m² */, task: 3500, accent: 5000 };
const SQFT = 10.7639;

/* Themes */
const THEMES = {
  Modern: { walls: ['#e9e6e1', '#d8d3cb', '#cfd6d8'], accent: '#2f4858', wood: '#4a4440', fabric: '#8e9aaf', metal: '#2a2a2a', rug: '#6b7a8f', curtain: '#c9c3b8', floor: 'vitrified', wet: 'antiskid', ceiling: 'peripheral', desc: 'Clean lines, neutral greys and a slate accent.' },
  Minimalist: { walls: ['#f4f2ee', '#ebe8e2'], accent: '#9a9187', wood: '#d6c2a6', fabric: '#e2ddd5', metal: '#bdbdbd', rug: '#d9d3c9', curtain: '#efebe4', floor: 'concrete', wet: 'antiskid', ceiling: 'flat', desc: 'Less, but better — airy whites and pale timber.' },
  Japandi: { walls: ['#e7ddcf', '#ddd2c1', '#d3cbbb'], accent: '#5b6650', wood: '#a47e5a', fabric: '#c8bba6', metal: '#3b3631', rug: '#b7a78e', curtain: '#e0d6c6', floor: 'oak', wet: 'ceramic', ceiling: 'cove', desc: 'Japanese calm meets Nordic warmth: oak, linen, olive.' },
  Scandinavian: { walls: ['#f3f3ef', '#e6ebea', '#eef0ea'], accent: '#7f9c96', wood: '#d9b98f', fabric: '#b9c4c2', metal: '#555', rug: '#c8cdc9', curtain: '#f2f1ec', floor: 'oak', wet: 'antiskid', ceiling: 'flat', desc: 'Bright, cosy and practical with light woods.' },
  Industrial: { walls: ['#a29d97', '#8f8a84', '#b9b2a8'], accent: '#b5651d', wood: '#5a3e2b', fabric: '#6b4f3a', metal: '#1e1e1e', rug: '#5d5650', curtain: '#7d756c', floor: 'concrete', wet: 'granite', ceiling: 'flat', desc: 'Raw concrete, dark metal and leather tones.' },
  'Indian Contemporary': { walls: ['#f3e3c8', '#efd7b5', '#e9dcc5'], accent: '#b5452f', wood: '#7a4a2a', fabric: '#c2563b', metal: '#a8843d', rug: '#9e3d2b', curtain: '#d9a441', floor: 'indian_marble', wet: 'antiskid', ceiling: 'cove', desc: 'Sheesham wood, terracotta and brass on marble.' },
  Luxury: { walls: ['#ede6da', '#e3d9c9', '#d9d2c7'], accent: '#1f2a44', wood: '#4a3426', fabric: '#2c3a5c', metal: '#b8975a', rug: '#3a4562', curtain: '#cdbfa6', floor: 'marble', wet: 'marble', ceiling: 'tray', desc: 'Italian marble, deep navy velvet and brushed gold.' },
  Bohemian: { walls: ['#f0d9c0', '#e8c9a8', '#efe0c9'], accent: '#c86b4a', wood: '#8b5e3c', fabric: '#d08a5e', metal: '#7a6a4a', rug: '#b0503a', curtain: '#e3b77c', floor: 'walnut', wet: 'ceramic', ceiling: 'flat', desc: 'Layered textures, warm earth tones and plants.' },
};
const WOOD_FINISHES = { 'Light Oak': '#d2b48c', 'Teak': '#9a6a3a', 'Walnut': '#5d4030', 'Sheesham': '#7a4a2a', 'White Laminate': '#efeeea', 'Matte Black': '#262626', 'Grey Ash': '#9b958c' };
const NAMED_COLORS = {
  white: '#f4f3ef', 'off white': '#efe9de', ivory: '#f2ecd9', cream: '#efe4cc', beige: '#e3d4b8', sand: '#d9c4a0', taupe: '#b5a593', grey: '#bfbfbb', gray: '#bfbfbb', 'light grey': '#d8d8d4', charcoal: '#4a4a4a',
  black: '#2a2a2a', blue: '#9fb8d4', 'sky blue': '#b8d6ea', 'powder blue': '#c4d6e4', navy: '#2e3f5c', teal: '#4f8a8b', turquoise: '#7cc6c0', green: '#a9c4a0', 'sage green': '#b5c4a8', sage: '#b5c4a8', mint: '#c6e3d1', olive: '#8a8f5c', 'emerald': '#3f7d5f', 'forest green': '#3f5e46',
  yellow: '#f1dc8f', mustard: '#d4a73a', peach: '#f3c8a8', coral: '#ee9a85', pink: '#efc2c8', 'blush': '#efd1cf', 'dusty pink': '#d9a7a7', red: '#c75a4a', maroon: '#7a2e2e', terracotta: '#c56c4b', orange: '#e59a5b',
  lavender: '#cfc3e3', lilac: '#d6c7e3', purple: '#8e6fae', brown: '#8b6447', 'warm white': '#f3eee3', greige: '#cdc5b8', 'pastel green': '#cfe5c9', 'pastel blue': '#cfe0ee',
};

/* ---------- furniture catalog ---------- */
const B = (w, h, d, x, y, z, role, o = {}) => Object.assign({ k: 'box', w, h, d, x, y, z, role }, o);
const C = (r, h, x, y, z, role, o = {}) => Object.assign({ k: 'cyl', r, h, x, y, z, role }, o);
const SP = (r, x, y, z, role, o = {}) => Object.assign({ k: 'sph', r, x, y, z, role }, o);
const legs4 = (W, D, h, t = 0.04, inset = 0.04, role = 'wood') => [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => B(t, h, t, a * (W / 2 - inset), 0, b * (D / 2 - inset), role));
const chairParts = (x, z, ry, role = 'wood', seat = 'fabric') => {
  const rot = (px, pz) => [x + px * Math.cos(ry) + pz * Math.sin(ry), z - px * Math.sin(ry) + pz * Math.cos(ry)];
  const P = []; const add = (p, lx, lz) => { const [a, b] = rot(lx, lz); p.x = a; p.z = b; p.ry = ry; P.push(p); };
  [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(([a, b]) => add(B(0.035, 0.45, 0.035, 0, 0, 0, role), a, b));
  add(B(0.44, 0.05, 0.44, 0, 0.45, 0, seat), 0, 0); add(B(0.42, 0.42, 0.04, 0, 0.5, 0, role), 0, -0.2);
  return P;
};
const CATALOG = {
  bed_double: { label: 'Double Bed', icon: '🛏️', w: 1.6, d: 2.05, h: 1.0, cat: 'Bedroom', price: [11000, 32000, 78000], tall: false,
    build: (W, D) => [B(W, 0.32, D, 0, 0.06, 0, 'wood'), ...legs4(W, D, 0.06, 0.06, 0.06), B(W - 0.06, 0.22, D - 0.12, 0, 0.36, 0.04, 'mattress'),
      B(W + 0.04, 1.0, 0.08, 0, 0, -D / 2 + 0.04, 'headboard'), B(W * 0.38, 0.12, 0.34, -W * 0.24, 0.58, -D / 2 + 0.3, 'white'), B(W * 0.38, 0.12, 0.34, W * 0.24, 0.58, -D / 2 + 0.3, 'white'),
      B(W - 0.02, 0.06, D * 0.52, 0, 0.56, D * 0.22, 'fabric')] },
  bed_single: { label: 'Single Bed', icon: '🛏️', w: 1.0, d: 2.0, h: 0.9, cat: 'Bedroom', price: [9000, 19000, 42000],
    build: (W, D) => [B(W, 0.3, D, 0, 0.06, 0, 'wood'), ...legs4(W, D, 0.06, 0.06, 0.06), B(W - 0.05, 0.2, D - 0.1, 0, 0.34, 0.03, 'mattress'), B(W + 0.02, 0.9, 0.07, 0, 0, -D / 2 + 0.035, 'headboard'),
      B(W * 0.6, 0.11, 0.32, 0, 0.54, -D / 2 + 0.28, 'white'), B(W - 0.02, 0.05, D * 0.5, 0, 0.54, D * 0.22, 'fabric')] },
  bunk_bed: { label: 'Bunk Bed', icon: '🪜', w: 1.0, d: 2.0, h: 1.75, cat: 'Kids', price: [18000, 32000, 60000],
    build: (W, D) => [...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => B(0.06, 1.75, 0.06, a * (W / 2 - 0.03), 0, b * (D / 2 - 0.03), 'wood')),
      B(W - 0.04, 0.08, D - 0.04, 0, 0.2, 0, 'wood'), B(W - 0.1, 0.16, D - 0.12, 0, 0.28, 0, 'mattress'), B(W - 0.04, 0.08, D - 0.04, 0, 1.05, 0, 'wood'), B(W - 0.1, 0.15, D - 0.12, 0, 1.13, 0, 'fabric'),
      B(W - 0.04, 0.05, 0.04, 0, 1.45, D / 2 - 0.03, 'wood'), ...[0.4, 0.65, 0.9].map(y => B(0.04, 0.04, 0.4, W / 2 - 0.02, y, D / 2 - 0.35, 'accent'))] },
  wardrobe: { label: 'Wardrobe', icon: '🚪', w: 1.8, d: 0.6, h: 2.1, cat: 'Storage', price: [12000, 40000, 98000], tall: true, storage: 2.2, perW: true,
    build: (W, D, H) => { const n = Math.max(2, Math.round(W / 0.6)); const P = [B(W, H, D, 0, 0, 0, 'wood')];
      for (let i = 1; i < n; i++) P.push(B(0.008, H - 0.06, 0.01, -W / 2 + W * i / n, 0.03, D / 2, 'metal'));
      for (let i = 0; i < n; i++) P.push(B(0.02, 0.22, 0.02, -W / 2 + W * (i + 0.5) / n + (i % 2 ? -1 : 1) * (W / n / 2 - 0.06), H * 0.45, D / 2 + 0.012, 'metal'));
      P.push(B(W, 0.04, D + 0.01, 0, H - 0.04, 0, 'accent')); return P; } },
  side_table: { label: 'Bedside Table', icon: '◻️', w: 0.45, d: 0.4, h: 0.55, cat: 'Bedroom', price: [2500, 6500, 16000],
    build: (W, D, H) => [B(W, H - 0.06, D, 0, 0.06, 0, 'wood'), ...legs4(W, D, 0.06, 0.03, 0.03, 'metal'), B(W * 0.7, 0.02, 0.02, 0, H * 0.55, D / 2 + 0.01, 'metal'), C(0.07, 0.03, 0.08, H, -0.05, 'metal'), C(0.015, 0.25, 0.08, H + 0.03, -0.05, 'metal'), C(0.11, 0.16, 0.08, H + 0.26, -0.05, 'lamp', { c: 0.7 })] },
  dresser: { label: 'Dresser + Mirror', icon: '🪞', w: 1.0, d: 0.45, h: 1.7, cat: 'Bedroom', price: [8000, 18000, 45000], storage: 0.4,
    build: (W, D) => [B(W, 0.78, D, 0, 0, 0, 'wood'), B(W - 0.04, 0.008, 0.01, 0, 0.4, D / 2, 'metal'), B(W * 0.62, 0.8, 0.03, 0, 0.82, -D / 2 + 0.05, 'mirror'), B(W * 0.66, 0.84, 0.02, 0, 0.8, -D / 2 + 0.03, 'wood')] },
  desk: { label: 'Work Desk', icon: '🖥️', w: 1.2, d: 0.6, h: 0.75, cat: 'Office', price: [5000, 14000, 38000],
    build: (W, D) => [B(W, 0.04, D, 0, 0.71, 0, 'wood'), ...legs4(W, D, 0.71, 0.04, 0.04, 'metal'), B(0.4, 0.5, D - 0.06, W / 2 - 0.24, 0.2, 0, 'wood'),
      B(0.55, 0.32, 0.03, 0, 0.9, -D / 2 + 0.12, 'screen'), B(0.05, 0.15, 0.05, 0, 0.75, -D / 2 + 0.12, 'metal'), B(0.4, 0.015, 0.14, 0, 0.75, 0.06, 'metal')] },
  office_chair: { label: 'Ergonomic Chair', icon: '🪑', w: 0.6, d: 0.6, h: 1.1, cat: 'Office', price: [4500, 12000, 32000],
    build: () => [C(0.3, 0.05, 0, 0.03, 0, 'metal'), C(0.03, 0.42, 0, 0.05, 0, 'metal'), B(0.5, 0.08, 0.48, 0, 0.46, 0.02, 'seat'), B(0.46, 0.55, 0.06, 0, 0.56, -0.22, 'seat', { rx: -0.12 }), B(0.06, 0.2, 0.3, -0.26, 0.5, 0, 'metal'), B(0.06, 0.2, 0.3, 0.26, 0.5, 0, 'metal')] },
  sofa_3: { label: '3-Seater Sofa', icon: '🛋️', w: 2.1, d: 0.92, h: 0.85, cat: 'Living', price: [18000, 46000, 125000],
    build: (W, D) => [B(W, 0.08, D, 0, 0.06, 0, 'wood'), B(W - 0.36, 0.2, D - 0.24, 0, 0.14, 0.08, 'fabric'), ...[0, 1, 2].map(i => B((W - 0.4) / 3 - 0.02, 0.14, D - 0.28, -W / 2 + 0.2 + (W - 0.4) / 6 * (2 * i + 1), 0.34, 0.09, 'fabric2')),
      B(W, 0.5, 0.22, 0, 0.14, -D / 2 + 0.11, 'fabric'), B(0.18, 0.46, D, -W / 2 + 0.09, 0.14, 0, 'fabric'), B(0.18, 0.46, D, W / 2 - 0.09, 0.14, 0, 'fabric'),
      B(0.4, 0.36, 0.12, -W / 2 + 0.45, 0.46, -D / 2 + 0.28, 'accent', { rx: -0.25 }), B(0.4, 0.36, 0.12, W / 2 - 0.45, 0.46, -D / 2 + 0.28, 'accent', { rx: -0.25 }), ...legs4(W, D, 0.06, 0.04, 0.08, 'metal')] },
  sofa_l: { label: 'L-shaped Sofa', icon: '🛋️', w: 2.5, d: 1.65, h: 0.85, cat: 'Living', price: [32000, 72000, 185000],
    build: (W, D) => [B(W, 0.2, 0.92, 0, 0.06, -D / 2 + 0.46, 'fabric'), B(0.92, 0.2, D - 0.92, W / 2 - 0.46, 0.06, 0.46, 'fabric'), B(W - 0.2, 0.13, 0.66, 0, 0.26, -D / 2 + 0.55, 'fabric2'), B(0.7, 0.13, D - 0.92, W / 2 - 0.46, 0.26, 0.46, 'fabric2'),
      B(W, 0.55, 0.22, 0, 0.06, -D / 2 + 0.11, 'fabric'), B(0.2, 0.42, 0.92, -W / 2 + 0.1, 0.06, -D / 2 + 0.46, 'fabric'), B(0.22, 0.55, D, W / 2 - 0.11, 0.06, 0, 'fabric'), B(0.4, 0.36, 0.12, -W / 2 + 0.5, 0.4, -D / 2 + 0.3, 'accent', { rx: -0.25 })] },
  armchair: { label: 'Armchair', icon: '💺', w: 0.85, d: 0.85, h: 0.85, cat: 'Living', price: [7000, 18000, 52000],
    build: (W, D) => [...legs4(W, D, 0.12, 0.035, 0.08, 'wood'), B(W, 0.18, D, 0, 0.12, 0, 'fabric'), B(W - 0.3, 0.12, D - 0.24, 0, 0.3, 0.06, 'fabric2'), B(W, 0.5, 0.18, 0, 0.3, -D / 2 + 0.09, 'fabric'), B(0.15, 0.3, D, -W / 2 + 0.075, 0.3, 0, 'fabric'), B(0.15, 0.3, D, W / 2 - 0.075, 0.3, 0, 'fabric')] },
  coffee_table: { label: 'Coffee Table', icon: '☕', w: 1.1, d: 0.6, h: 0.42, cat: 'Living', price: [4000, 11000, 34000],
    build: (W, D) => [B(W, 0.05, D, 0, 0.37, 0, 'wood'), B(W - 0.1, 0.03, D - 0.1, 0, 0.12, 0, 'wood'), ...legs4(W, D, 0.37, 0.035, 0.05, 'metal'), C(0.06, 0.1, 0.25, 0.42, 0, 'accent'), B(0.22, 0.04, 0.16, -0.25, 0.42, 0.05, 'white')] },
  tv_unit: { label: 'TV Unit + TV', icon: '📺', w: 1.8, d: 0.42, h: 1.4, cat: 'Living', price: [9000, 24000, 70000],
    build: (W, D) => [B(W, 0.45, D, 0, 0.08, 0, 'wood'), B(W, 0.08, D - 0.04, 0, 0, 0, 'metal'), B(Math.min(1.4, W * 0.75), 0.78, 0.05, 0, 0.75, -D / 2 + 0.05, 'screen'), B(W * 0.32, 0.12, 0.25, -W * 0.3, 0.53, -0.02, 'accent'), SP(0.08, W * 0.38, 0.62, 0, 'plant')] },
  dining_set: { label: 'Dining Set (6)', icon: '🍽️', w: 1.7, d: 1.9, h: 0.9, cat: 'Dining', price: [22000, 52000, 140000],
    build: (W, D) => { const tw = W - 0.1, td = D - 1.0; const P = [B(tw, 0.05, td, 0, 0.71, 0, 'wood'), ...legs4(tw, td, 0.71, 0.06, 0.08, 'wood'), C(0.08, 0.2, 0, 0.76, 0, 'accent', { c: 0.6 })];
      [-1, 0, 1].forEach(i => { P.push(...chairParts(i * tw / 3.2, -td / 2 - 0.22, 0)); P.push(...chairParts(i * tw / 3.2, td / 2 + 0.22, Math.PI)); }); return P; } },
  dining_4: { label: 'Dining Set (4)', icon: '🍽️', w: 1.25, d: 1.75, h: 0.9, cat: 'Dining', price: [14000, 32000, 85000],
    build: (W, D) => { const tw = W - 0.05, td = D - 0.95; const P = [B(tw, 0.05, td, 0, 0.71, 0, 'wood'), ...legs4(tw, td, 0.71, 0.05, 0.06, 'wood')];
      [-1, 1].forEach(i => { P.push(...chairParts(i * tw / 4.5, -td / 2 - 0.22, 0)); P.push(...chairParts(i * tw / 4.5, td / 2 + 0.22, Math.PI)); }); return P; } },
  kitchen_counter: { label: 'Kitchen Counter', icon: '🍳', w: 2.4, d: 0.62, h: 2.2, cat: 'Kitchen', price: [45000, 110000, 260000], tall: true, storage: 1.2, perW: true,
    build: (W, D) => { const P = [B(W, 0.1, D - 0.06, 0, 0, -0.03, 'metal'), B(W, 0.76, D - 0.02, 0, 0.1, 0, 'cabinet'), B(W + 0.02, 0.04, D + 0.02, 0, 0.86, 0, 'stone'),
      B(W, 0.7, 0.34, 0, 1.45, -D / 2 + 0.17, 'cabinet'), B(0.6, 0.45, 0.42, -W / 2 + 0.6, 1.5, -D / 2 + 0.21, 'metal'), B(0.55, 0.04, 0.4, W * 0.18, 0.88, 0, 'metal'), B(0.5, 0.02, 0.36, W * 0.18, 0.9, 0, 'dark'),
      C(0.08, 0.02, -W / 2 + 0.45, 0.9, -0.08, 'dark'), C(0.08, 0.02, -W / 2 + 0.75, 0.9, -0.08, 'dark'), C(0.07, 0.02, -W / 2 + 0.45, 0.9, 0.14, 'dark'), C(0.07, 0.02, -W / 2 + 0.75, 0.9, 0.14, 'dark'), B(0.02, 0.3, 0.02, W * 0.18, 0.9, -D / 2 + 0.08, 'metal')];
      const n = Math.max(2, Math.round(W / 0.6)); for (let i = 1; i < n; i++) { P.push(B(0.006, 0.7, 0.01, -W / 2 + W * i / n, 0.12, D / 2 - 0.01, 'dark')); P.push(B(0.006, 0.66, 0.01, -W / 2 + W * i / n, 1.47, -D / 2 + 0.345, 'dark')); }
      return P; } },
  fridge: { label: 'Refrigerator', icon: '🧊', w: 0.72, d: 0.72, h: 1.8, cat: 'Kitchen', price: [22000, 38000, 95000], tall: true,
    build: (W, D, H) => [B(W, H, D, 0, 0, 0, 'appliance'), B(W - 0.02, 0.006, 0.01, 0, H * 0.62, D / 2, 'dark'), B(0.025, 0.4, 0.03, -W / 2 + 0.07, H * 0.68, D / 2 + 0.015, 'metal'), B(0.025, 0.3, 0.03, -W / 2 + 0.07, H * 0.25, D / 2 + 0.015, 'metal')] },
  toilet: { label: 'Western Toilet', icon: '🚽', w: 0.42, d: 0.68, h: 0.8, cat: 'Bath', price: [6000, 14000, 38000],
    build: () => [B(0.26, 0.32, 0.4, 0, 0, 0.08, 'ceramic'), C(0.19, 0.08, 0, 0.32, 0.12, 'ceramic'), B(0.4, 0.4, 0.18, 0, 0.38, -0.25, 'ceramic'), B(0.38, 0.02, 0.4, 0, 0.405, 0.1, 'white')] },
  wash_basin: { label: 'Wash Basin + Mirror', icon: '🚰', w: 0.6, d: 0.45, h: 1.7, cat: 'Bath', price: [4000, 11000, 30000],
    build: (W, D) => [B(W, 0.5, D - 0.05, 0, 0.3, -0.02, 'cabinet'), B(W, 0.08, D, 0, 0.8, 0, 'ceramic'), B(0.04, 0.12, 0.04, 0, 0.88, -D / 2 + 0.08, 'metal'), B(W * 0.9, 0.7, 0.03, 0, 1.05, -D / 2 + 0.02, 'mirror')] },
  shower: { label: 'Shower Enclosure', icon: '🚿', w: 0.95, d: 0.95, h: 2.0, cat: 'Bath', price: [9000, 24000, 65000], tall: true,
    build: (W, D) => [B(W, 0.05, D, 0, 0, 0, 'ceramic'), B(W, 1.95, 0.01, 0, 0.05, D / 2 - 0.01, 'glass'), B(0.01, 1.95, D, W / 2 - 0.01, 0.05, 0, 'glass'), C(0.1, 0.02, 0, 1.95, -D / 2 + 0.25, 'metal'), B(0.03, 0.03, 0.25, 0, 1.97, -D / 2 + 0.12, 'metal')] },
  bookshelf: { label: 'Bookshelf', icon: '📚', w: 0.9, d: 0.35, h: 1.9, cat: 'Storage', price: [4500, 12000, 36000], tall: true, storage: 0.5,
    build: (W, D, H) => { const P = [B(0.03, H, D, -W / 2 + 0.015, 0, 0, 'wood'), B(0.03, H, D, W / 2 - 0.015, 0, 0, 'wood'), B(W, H, 0.02, 0, 0, -D / 2 + 0.01, 'wood')];
      const cols = ['#a64b2a', '#2e5e7e', '#d4a73a', '#3f6e4a', '#7a3e6e', '#e6dcc8', '#444'];
      for (let i = 0; i <= 4; i++) { const y = i * (H - 0.03) / 4; P.push(B(W - 0.04, 0.025, D, 0, y, 0, 'wood'));
        if (i < 4) { let x = -W / 2 + 0.05; let k = i * 3; while (x < W / 2 - 0.12) { const bw = 0.03 + ((k * 7) % 5) * 0.008, bh = 0.2 + ((k * 13) % 7) * 0.015; P.push(B(bw, bh, D * 0.75, x + bw / 2, y + 0.025, 0.01, 'c:' + cols[k % cols.length])); x += bw + 0.004; k++; if (k % 9 === 0) x += 0.12; } } }
      return P; } },
  plant: { label: 'Indoor Plant', icon: '🪴', w: 0.45, d: 0.45, h: 1.15, cat: 'Decor', price: [800, 2500, 7500], decor: true,
    build: () => [C(0.16, 0.34, 0, 0, 0, 'pot', { c: 1.25 }), C(0.012, 0.4, 0, 0.3, 0, 'wood'), SP(0.24, 0, 0.75, 0, 'plant'), SP(0.18, 0.11, 0.92, 0.05, 'plant2'), SP(0.16, -0.1, 0.62, -0.06, 'plant')] },
  rug: { label: 'Area Rug', icon: '🟫', w: 2.0, d: 1.4, h: 0.012, cat: 'Decor', price: [3000, 9000, 32000], flat: true, decor: true,
    build: (W, D) => [B(W, 0.012, D, 0, 0.002, 0, 'rug', { pattern: 7, patScale: 0.25 }), B(W - 0.2, 0.013, D - 0.2, 0, 0.002, 0, 'rug2')] },
  floor_lamp: { label: 'Floor Lamp', icon: '💡', w: 0.4, d: 0.4, h: 1.65, cat: 'Lighting', price: [2200, 6500, 22000], decor: true,
    build: () => [C(0.16, 0.03, 0, 0, 0, 'metal'), C(0.015, 1.35, 0, 0.03, 0, 'metal'), C(0.2, 0.3, 0, 1.33, 0, 'lamp', { c: 0.65 })] },
  gaming_desk: { label: 'Gaming Setup', icon: '🎮', w: 1.5, d: 0.72, h: 1.2, cat: 'Gaming', price: [35000, 85000, 220000],
    build: (W, D) => [B(W, 0.045, D, 0, 0.72, 0, 'dark'), B(0.06, 0.72, D - 0.1, -W / 2 + 0.05, 0, 0, 'dark'), B(0.06, 0.72, D - 0.1, W / 2 - 0.05, 0, 0, 'dark'), B(W, 0.012, 0.012, 0, 0.71, D / 2 - 0.006, 'led'),
      B(0.62, 0.36, 0.03, -0.33, 0.92, -D / 2 + 0.16, 'screen', { ry: 0.25 }), B(0.62, 0.36, 0.03, 0.33, 0.92, -D / 2 + 0.16, 'screen', { ry: -0.25 }), B(0.06, 0.18, 0.06, -0.3, 0.765, -D / 2 + 0.16, 'metal'), B(0.06, 0.18, 0.06, 0.3, 0.765, -D / 2 + 0.16, 'metal'),
      B(0.22, 0.48, 0.45, W / 2 - 0.25, 0.765, -0.05, 'dark'), B(0.012, 0.44, 0.4, W / 2 - 0.36, 0.785, -0.05, 'led'), B(0.45, 0.02, 0.15, 0, 0.765, 0.12, 'dark')] },
  gaming_chair: { label: 'Gaming Chair', icon: '🪑', w: 0.65, d: 0.65, h: 1.3, cat: 'Gaming', price: [9000, 22000, 48000],
    build: () => [C(0.32, 0.05, 0, 0.03, 0, 'metal'), C(0.035, 0.42, 0, 0.05, 0, 'metal'), B(0.52, 0.1, 0.5, 0, 0.46, 0.02, 'dark'), B(0.5, 0.8, 0.08, 0, 0.56, -0.24, 'dark', { rx: -0.14 }), B(0.3, 0.6, 0.085, 0, 0.62, -0.235, 'accent', { rx: -0.14 }), B(0.06, 0.18, 0.32, -0.28, 0.52, 0, 'dark'), B(0.06, 0.18, 0.32, 0.28, 0.52, 0, 'dark')] },
  beanbag: { label: 'Bean Bag', icon: '🫘', w: 0.85, d: 0.85, h: 0.6, cat: 'Living', price: [2500, 5500, 14000], decor: true,
    build: () => [SP(0.42, 0, 0.27, 0, 'accent', { sy: 0.65 }), SP(0.3, 0, 0.42, -0.18, 'accent', { sy: 0.8 })] },
  shoe_rack: { label: 'Shoe Rack', icon: '👟', w: 0.9, d: 0.35, h: 0.95, cat: 'Storage', price: [2500, 7000, 18000], storage: 0.25,
    build: (W, D, H) => [B(W, H, D, 0, 0, 0, 'wood'), B(W - 0.02, 0.006, 0.01, 0, H / 2, D / 2, 'dark'), B(W, 0.03, D + 0.01, 0, H - 0.03, 0, 'accent')] },
  storage_cabinet: { label: 'Storage Cabinet', icon: '🗄️', w: 0.9, d: 0.45, h: 1.85, cat: 'Storage', price: [6000, 15000, 42000], tall: true, storage: 0.7,
    build: (W, D, H) => [B(W, H, D, 0, 0, 0, 'wood'), B(0.006, H - 0.04, 0.01, 0, 0.02, D / 2, 'dark'), B(0.02, 0.18, 0.02, -0.05, H * 0.5, D / 2 + 0.01, 'metal'), B(0.02, 0.18, 0.02, 0.05, H * 0.5, D / 2 + 0.01, 'metal')] },
  closet_rack: { label: 'Open Closet System', icon: '👔', w: 1.6, d: 0.55, h: 2.1, cat: 'Storage', price: [12000, 30000, 85000], tall: true, storage: 1.8, perW: true,
    build: (W, D, H) => { const P = [B(0.03, H, D, -W / 2 + 0.015, 0, 0, 'wood'), B(0.03, H, D, W / 2 - 0.015, 0, 0, 'wood'), B(0.03, H, D, 0, 0, 0, 'wood'), B(W, 0.03, D, 0, H - 0.03, 0, 'wood'), B(W, 0.03, D, 0, 0.35, 0, 'wood'), B(W, 0.02, D, 0, H - 0.4, 0, 'wood'), C(0.012, W - 0.06, -W / 2 + 0.03, 1.6, 0, 'metal', { rz: -Math.PI / 2 })];
      const cols = ['#c9b79c', '#5d6d7e', '#e8e2d6', '#9e3d2b', '#2f3e46', '#d4a73a', '#7f9c96'];
      for (let i = 0; i < Math.floor((W - 0.1) / 0.09); i++) { const x = -W / 2 + 0.08 + i * 0.09; if (Math.abs(x) < 0.05) continue; P.push(B(0.03, 0.75 + (i % 3) * 0.12, D * 0.8, x, 1.55 - 0.75 - (i % 3) * 0.12, 0, 'c:' + cols[i % cols.length])); }
      for (let i = 0; i < 5; i++) P.push(B(0.12, 0.1, 0.25, -W / 2 + 0.15 + i * (W - 0.3) / 4, 0.03, 0.05, 'dark'));
      return P; } },
  washing_machine: { label: 'Washing Machine', icon: '🧺', w: 0.62, d: 0.62, h: 0.86, cat: 'Utility', price: [16000, 28000, 60000],
    build: (W, D, H) => [B(W, H, D, 0, 0, 0, 'appliance'), C(0.2, 0.02, 0, H * 0.45, D / 2, 'dark', { rx: Math.PI / 2 }), C(0.14, 0.025, 0, H * 0.45, D / 2, 'glass2', { rx: Math.PI / 2 }), B(W - 0.04, 0.08, 0.01, 0, H - 0.12, D / 2, 'dark')] },
  crib: { label: 'Baby Crib', icon: '🧸', w: 0.75, d: 1.3, h: 1.0, cat: 'Kids', price: [7000, 16000, 40000],
    build: (W, D) => { const P = [...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => B(0.05, 1.0, 0.05, a * (W / 2 - 0.025), 0, b * (D / 2 - 0.025), 'white')), B(W - 0.04, 0.05, D - 0.04, 0, 0.3, 0, 'white'), B(W - 0.08, 0.1, D - 0.08, 0, 0.35, 0, 'mattress'), B(W, 0.04, 0.04, 0, 0.92, -D / 2 + 0.02, 'white'), B(W, 0.04, 0.04, 0, 0.92, D / 2 - 0.02, 'white'), B(0.04, 0.04, D, -W / 2 + 0.02, 0.92, 0, 'white'), B(0.04, 0.04, D, W / 2 - 0.02, 0.92, 0, 'white')];
      for (let i = 1; i < 9; i++) { P.push(B(0.02, 0.58, 0.02, -W / 2 + 0.02, 0.35, -D / 2 + D * i / 9, 'white')); P.push(B(0.02, 0.58, 0.02, W / 2 - 0.02, 0.35, -D / 2 + D * i / 9, 'white')); }
      return P; } },
  treadmill: { label: 'Treadmill', icon: '🏃', w: 0.8, d: 1.85, h: 1.35, cat: 'Gym', price: [28000, 55000, 140000],
    build: (W, D) => [B(W, 0.18, D, 0, 0, 0.05, 'dark'), B(W - 0.24, 0.02, D - 0.3, 0, 0.18, 0.1, 'rubber'), B(0.05, 1.2, 0.06, -W / 2 + 0.06, 0.1, -D / 2 + 0.2, 'metal', { rx: 0.12 }), B(0.05, 1.2, 0.06, W / 2 - 0.06, 0.1, -D / 2 + 0.2, 'metal', { rx: 0.12 }), B(W - 0.05, 0.2, 0.3, 0, 1.2, -D / 2 + 0.22, 'dark', { rx: -0.4 }), B(0.3, 0.14, 0.01, 0, 1.28, -D / 2 + 0.32, 'led', { rx: -0.4 })] },
  pet_bed: { label: 'Pet Bed', icon: '🐾', w: 0.75, d: 0.6, h: 0.22, cat: 'Pets', price: [1500, 3500, 9000], decor: true,
    build: () => [C(0.34, 0.2, 0, 0, 0, 'fabric', { sy: 1 }), C(0.27, 0.12, 0, 0.06, 0, 'mattress')] },
  pooja_unit: { label: 'Pooja Mandir', icon: '🪔', w: 0.75, d: 0.45, h: 1.6, cat: 'Living', price: [8000, 22000, 65000],
    build: (W, D) => [B(W, 0.75, D, 0, 0, 0, 'wood'), B(W, 0.05, D, 0, 0.75, 0, 'metal'), B(0.05, 0.7, 0.05, -W / 2 + 0.05, 0.8, D / 2 - 0.05, 'wood'), B(0.05, 0.7, 0.05, W / 2 - 0.05, 0.8, D / 2 - 0.05, 'wood'), B(W, 0.18, D, 0, 1.42, 0, 'wood'), B(W * 0.5, 0.12, D * 0.6, 0, 1.6, 0, 'metal'), B(W - 0.1, 0.65, 0.02, 0, 0.8, -D / 2 + 0.02, 'accent'), SP(0.035, 0, 0.83, 0.1, 'diya'), SP(0.035, -0.18, 0.83, 0.1, 'diya'), SP(0.035, 0.18, 0.83, 0.1, 'diya')] },
  outdoor_chair: { label: 'Rattan Chair', icon: '🪑', w: 0.65, d: 0.65, h: 0.8, cat: 'Outdoor', price: [3500, 8500, 22000],
    build: (W, D) => [B(W, 0.08, D, 0, 0.35, 0, 'rattan'), B(W, 0.4, 0.06, 0, 0.42, -D / 2 + 0.03, 'rattan', { rx: -0.15 }), ...legs4(W, D, 0.35, 0.04, 0.04, 'rattan'), B(W - 0.1, 0.08, D - 0.15, 0, 0.43, 0.05, 'fabric2')] },
  side_table_round: { label: 'Round Side Table', icon: '⚪', w: 0.55, d: 0.55, h: 0.55, cat: 'Outdoor', price: [1800, 4500, 12000], decor: true,
    build: () => [C(0.27, 0.035, 0, 0.5, 0, 'wood'), C(0.025, 0.5, 0, 0, 0, 'metal'), C(0.16, 0.02, 0, 0, 0, 'metal')] },
  bathtub: { label: 'Bathtub', icon: '🛁', w: 0.8, d: 1.7, h: 0.6, cat: 'Bath', price: [18000, 45000, 140000],
    build: (W, D) => [B(W, 0.5, D, 0, 0, 0, 'ceramic'), B(W - 0.14, 0.03, D - 0.14, 0, 0.49, 0, 'water'), C(0.025, 0.2, 0, 0.5, -D / 2 + 0.05, 'metal')] },
};
const CAT_ORDER = ['Bedroom', 'Living', 'Dining', 'Kitchen', 'Bath', 'Office', 'Storage', 'Gaming', 'Kids', 'Gym', 'Outdoor', 'Utility', 'Decor', 'Lighting', 'Pets'];
const TIER_IX = { budget: 0, standard: 1, premium: 2 };
const TIERS = ['budget', 'standard', 'premium'];

/* ---------- application state ---------- */
const S = {
  prefs: { style: 'Japandi', budget: 1000000, colors: ['#b5c4a8', '#e3d4b8'], family: 4, pets: false, kids: false, wfh: true, storage: 'medium', furniture: 'standard', onboarded: false },
  apiKey: '', model: 'gemma-4-31b-it', gemmaOK: null,
  project: null, sel: null, view: '3d', panel: 'design', history: [], future: [], variants: [], original: null,
  hour: 10, cutaway: false, labels: true, overlay: 'none', projects: [], structuralLog: [],
};
const store = {
  get(k, d) { try { const v = localStorage.getItem('dimora_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('dimora_' + k, JSON.stringify(v)); } catch (e) { } },
};

function newProject(name = 'My Home') {
  return { id: uid('p'), name, created: Date.now(), updated: Date.now(), north: 0, theme: S.prefs.style || 'Japandi', scaleNote: '', wallThickness: null, floors: [newFloor('Ground Floor', 0)], activeFloor: 0, planImage: null };
}
function newFloor(name, level) { return { id: uid('f'), name, level, height: 2.9, rooms: [], doors: [], windows: [], stairs: [] }; }
const P = () => S.project;
const FL = () => S.project.floors[S.project.activeFloor];
const allRooms = () => S.project ? S.project.floors.flatMap(f => f.rooms) : [];
function findRoom(id) { for (const f of S.project.floors) { const r = f.rooms.find(r => r.id === id); if (r) return r; } return null; }
function floorOfRoom(room) { return S.project.floors.find(f => f.rooms.includes(room)) || FL(); }
function findItem(id) { for (const f of S.project.floors) for (const r of f.rooms) { const it = r.furniture.find(i => i.id === id); if (it) return { it, room: r, floor: f }; } return null; }
function makeRoom(o) {
  const t = ROOM_TYPES[o.type] ? o.type : 'empty';
  const th = THEMES[S.project?.theme || 'Japandi'];
  return Object.assign({ id: uid('r'), name: ROOM_TYPES[t].label, type: t, x: 0, y: 0, w: 3, d: 3, wall: null, floor: null, tier: S.prefs.furniture || 'standard', ceiling: null, lights: { ambient: true, task: t !== 'hall', accent: false }, curtains: true, theme: null, furniture: [] }, o, { type: t });
}
function roomTheme(room) { return THEMES[room.theme || S.project.theme] || THEMES.Japandi; }
function roomFloorKey(room) { if (room.floor) return room.floor; const th = roomTheme(room); if (['bathroom', 'utility'].includes(room.type)) return th.wet; if (room.type === 'balcony') return 'deck'; if (room.type === 'kitchen') return th.floor === 'oak' || th.floor === 'walnut' || th.floor === 'carpet' ? 'vitrified' : th.floor; return th.floor; }
function roomWall(room) { if (room.wall) return room.wall; const th = roomTheme(room); const i = Object.keys(ROOM_TYPES).indexOf(room.type); return th.walls[i % th.walls.length]; }
function roomCeiling(room) { return room.ceiling || (['bathroom', 'balcony', 'utility', 'hall'].includes(room.type) ? 'flat' : roomTheme(room).ceiling); }
const area = r => r.w * r.d;
const inRoom = (r, x, y, m = 0) => x >= r.x - m && x <= r.x + r.w + m && y >= r.y - m && y <= r.y + r.d + m;
function roomAt(x, y, floor = FL()) { let best = null; floor.rooms.forEach(r => { if (inRoom(r, x, y) && (!best || area(r) < area(best))) best = r; }); return best; }
function itemFootprint(it) { const a = ((it.rot % 360) + 360) % 360; const sw = (a === 90 || a === 270); const w = sw ? it.d : it.w, d = sw ? it.w : it.d; return { x: it.x - w / 2, y: it.y - d / 2, w, d }; }
function rectOverlap(a, b) { const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y); return ox > 0 && oy > 0 ? ox * oy : 0; }
function homeBounds(floor) {
  const rooms = floor ? floor.rooms : allRooms(); if (!rooms.length) return { x: 0, y: 0, w: 10, d: 8 };
  const x0 = Math.min(...rooms.map(r => r.x)), y0 = Math.min(...rooms.map(r => r.y)), x1 = Math.max(...rooms.map(r => r.x + r.w)), y1 = Math.max(...rooms.map(r => r.y + r.d));
  return { x: x0, y: y0, w: x1 - x0, d: y1 - y0 };
}
function makeItem(type, room, extra = {}) {
  const c = CATALOG[type]; if (!c) return null;
  return Object.assign({ id: uid('i'), type, x: room.x + room.w / 2, y: room.y + room.d / 2, rot: 0, w: c.w, d: c.d, h: c.h, tier: room.tier || 'standard', color: null, finish: null }, extra);
}

/* ---------- walls & openings ---------- */
function wallLines(floor) {
  const map = new Map();
  const add = (o, c, a, b) => { const k = o + ':' + Math.round(c * 20); if (!map.has(k)) map.set(k, { o, c, iv: [] }); map.get(k).iv.push([Math.min(a, b), Math.max(a, b)]); };
  floor.rooms.forEach(r => { add('h', r.y, r.x, r.x + r.w); add('h', r.y + r.d, r.x, r.x + r.w); add('v', r.x, r.y, r.y + r.d); add('v', r.x + r.w, r.y, r.y + r.d); });
  const lines = [];
  map.forEach(L => {
    L.iv.sort((a, b) => a[0] - b[0]); const m = [];
    L.iv.forEach(iv => { if (m.length && iv[0] <= m[m.length - 1][1] + 0.02) m[m.length - 1][1] = Math.max(m[m.length - 1][1], iv[1]); else m.push(iv.slice()); });
    m.forEach(([a, b]) => lines.push({ o: L.o, c: L.c, a, b }));
  });
  return lines;
}
function isExteriorPoint(floor, o, c, t) { // point on wall line; exterior if one side is outside all rooms
  const e = 0.12; const p1 = o === 'h' ? [t, c - e] : [c - e, t], p2 = o === 'h' ? [t, c + e] : [c + e, t];
  const in1 = floor.rooms.some(r => inRoom(r, p1[0], p1[1])), in2 = floor.rooms.some(r => inRoom(r, p2[0], p2[1]));
  return in1 !== in2;
}
function openingsOn(floor, L) {
  const res = [];
  floor.doors.forEach(d => { if (d.o === L.o && Math.abs((L.o === 'h' ? d.y : d.x) - L.c) < 0.2) { const t = L.o === 'h' ? d.x : d.y; if (t > L.a - 0.05 && t < L.b + 0.05) res.push({ kind: 'door', ref: d, a: Math.max(L.a, t - d.w / 2), b: Math.min(L.b, t + d.w / 2) }); } });
  floor.windows.forEach(d => { if (d.o === L.o && Math.abs((L.o === 'h' ? d.y : d.x) - L.c) < 0.2) { const t = L.o === 'h' ? d.x : d.y; if (t > L.a - 0.05 && t < L.b + 0.05) res.push({ kind: 'window', ref: d, a: Math.max(L.a, t - d.w / 2), b: Math.min(L.b, t + d.w / 2) }); } });
  return res.sort((p, q) => p.a - q.a);
}
// pieces: [{o,c,a,b,y0,y1,kind}]
function wallPieces(floor) {
  const H = floor.height, out = [];
  wallLines(floor).forEach(L => {
    const ext = isExteriorPoint(floor, L.o, L.c, (L.a + L.b) / 2);
    let cur = L.a;
    openingsOn(floor, L).forEach(op => {
      if (op.a > cur + 0.01) out.push({ o: L.o, c: L.c, a: cur, b: op.a, y0: 0, y1: H, kind: 'solid', ext });
      if (op.kind === 'door') out.push({ o: L.o, c: L.c, a: op.a, b: op.b, y0: DOOR_H, y1: H, kind: 'lintel', ext, ref: op.ref });
      else { const w = op.ref; out.push({ o: L.o, c: L.c, a: op.a, b: op.b, y0: 0, y1: w.sill, kind: 'sill', ext, ref: w }); out.push({ o: L.o, c: L.c, a: op.a, b: op.b, y0: Math.min(H, w.sill + w.h), y1: H, kind: 'head', ext, ref: w }); }
      cur = Math.max(cur, op.b);
    });
    if (L.b > cur + 0.01) out.push({ o: L.o, c: L.c, a: cur, b: L.b, y0: 0, y1: H, kind: 'solid', ext });
  });
  return out;
}
// which side of room an opening lies on
function roomSideOf(room, o, x, y) {
  if (o === 'h') { if (Math.abs(y - room.y) < 0.2 && x >= room.x - 0.05 && x <= room.x + room.w + 0.05) return 'N'; if (Math.abs(y - room.y - room.d) < 0.2 && x >= room.x - 0.05 && x <= room.x + room.w + 0.05) return 'S'; }
  else { if (Math.abs(x - room.x) < 0.2 && y >= room.y - 0.05 && y <= room.y + room.d + 0.05) return 'W'; if (Math.abs(x - room.x - room.w) < 0.2 && y >= room.y - 0.05 && y <= room.y + room.d + 0.05) return 'E'; }
  return null;
}
function roomOpenings(room, floor) {
  const res = [];
  floor.doors.forEach(d => { const s = roomSideOf(room, d.o, d.x, d.y); if (s) res.push({ kind: 'door', side: s, t: d.o === 'h' ? d.x : d.y, w: d.w, ref: d }); });
  floor.windows.forEach(d => { const s = roomSideOf(room, d.o, d.x, d.y); if (s) res.push({ kind: 'window', side: s, t: d.o === 'h' ? d.x : d.y, w: d.w, ref: d, ext: isExteriorPoint(floor, d.o, d.o === 'h' ? d.y : d.x, d.o === 'h' ? d.x : d.y) }); });
  return res;
}
function doorSwingRect(room, op) {
  const s = Math.min(op.w, 1.0);
  if (op.side === 'N') return { x: op.t - op.w / 2, y: room.y, w: op.w, d: s };
  if (op.side === 'S') return { x: op.t - op.w / 2, y: room.y + room.d - s, w: op.w, d: s };
  if (op.side === 'W') return { x: room.x, y: op.t - op.w / 2, w: s, d: op.w };
  return { x: room.x + room.w - s, y: op.t - op.w / 2, w: s, d: op.w };
}
function sharedEdge(a, b) {
  const t = 0.15;
  if (Math.abs(a.x + a.w - b.x) < t || Math.abs(b.x + b.w - a.x) < t) { const c = Math.abs(a.x + a.w - b.x) < t ? (a.x + a.w + b.x) / 2 : (b.x + b.w + a.x) / 2; const lo = Math.max(a.y, b.y), hi = Math.min(a.y + a.d, b.y + b.d); if (hi - lo > 0.6) return { o: 'v', c, lo, hi }; }
  if (Math.abs(a.y + a.d - b.y) < t || Math.abs(b.y + b.d - a.y) < t) { const c = Math.abs(a.y + a.d - b.y) < t ? (a.y + a.d + b.y) / 2 : (b.y + b.d + a.y) / 2; const lo = Math.max(a.x, b.x), hi = Math.min(a.x + a.w, b.x + b.w); if (hi - lo > 0.6) return { o: 'h', c, lo, hi }; }
  return null;
}
function doorBetween(a, b, floor) {
  const e = sharedEdge(a, b); if (!e) return null;
  return floor.doors.find(d => d.o === e.o && Math.abs((e.o === 'h' ? d.y : d.x) - e.c) < 0.2 && (e.o === 'h' ? d.x : d.y) > e.lo - 0.05 && (e.o === 'h' ? d.x : d.y) < e.hi + 0.05) || null;
}
function connectivity(floor) {
  const R = floor.rooms, adj = new Map(R.map(r => [r.id, []]));
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) { if (doorBetween(R[i], R[j], floor)) { adj.get(R[i].id).push(R[j].id); adj.get(R[j].id).push(R[i].id); } }
  const entryDoor = floor.doors.find(d => d.main) || floor.doors.find(d => isExteriorPoint(floor, d.o, d.o === 'h' ? d.y : d.x, d.o === 'h' ? d.x : d.y));
  let start = null;
  if (entryDoor) start = R.find(r => roomSideOf(r, entryDoor.o, entryDoor.x, entryDoor.y));
  if (!start) start = R.find(r => r.type === 'living') || R[0];
  const order = [], seen = new Set(); const q = start ? [start.id] : [];
  if (start) seen.add(start.id);
  while (q.length) { const id = q.shift(); order.push(id); (adj.get(id) || []).forEach(n => { if (!seen.has(n)) { seen.add(n); q.push(n); } }); }
  return { adj, order, start, entryDoor, unreachable: R.filter(r => !seen.has(r.id)) };
}
// ensure doors & windows exist (used after detection)
function autoOpenings(floor, { doors = true, windows = true } = {}) {
  const R = floor.rooms; const hubs = ['living', 'dining', 'hall'];
  const pri = r => hubs.includes(r.type) ? 0 : r.type === 'kitchen' ? 1 : 2;
  const addDoor = (a, b) => { const e = sharedEdge(a, b); if (!e || doorBetween(a, b, floor)) return false; const w = (a.type === 'bathroom' || b.type === 'bathroom') ? 0.75 : 0.9; const t = clamp((e.lo + e.hi) / 2, e.lo + w / 2 + 0.1, e.hi - w / 2 - 0.1); floor.doors.push({ id: uid('d'), o: e.o, x: e.o === 'h' ? t : e.c, y: e.o === 'h' ? e.c : t, w }); return true; };
  if (doors) {
    R.forEach(a => R.forEach(b => { if (a !== b && pri(a) === 0 && pri(b) <= 1 && a.id < b.id) addDoor(a, b); }));
    const PREF = { bathroom: ['master', 'bedroom', 'hall', 'living'], utility: ['kitchen', 'hall', 'dining'], balcony: ['living', 'master', 'bedroom'], closet: ['master', 'bedroom'], pooja: ['living', 'hall', 'dining'] };
    const score = (r, o) => { const l = PREF[r.type]; if (l && l.includes(o.type)) return l.indexOf(o.type); return 10 + pri(o) + (o.type === 'bathroom' ? 20 : 0); };
    const order = R.slice().sort((a, b) => (a.type === 'bathroom') - (b.type === 'bathroom'));
    order.forEach(r => { if (pri(r) < 2) return; if (connectivity(floor).adj.get(r.id).length) return; const nb = R.filter(o => o !== r && sharedEdge(r, o)).sort((p, q) => score(r, p) - score(r, q)); if (nb.length) addDoor(r, nb[0]); });
    for (let k = 0; k < 6; k++) { const c = connectivity(floor); if (!c.unreachable.length) break; const u = c.unreachable[0]; const nb = R.filter(o => o !== u && sharedEdge(u, o) && !c.unreachable.includes(o)); if (nb.length) addDoor(u, nb.sort((p, q) => pri(p) - pri(q))[0]); else break; }
    if (!floor.doors.some(d => d.main)) {
      const lv = R.find(r => r.type === 'living') || R.slice().sort((a, b) => area(b) - area(a))[0];
      if (lv) { const sides = [['h', lv.y, lv.x, lv.x + lv.w], ['h', lv.y + lv.d, lv.x, lv.x + lv.w], ['v', lv.x, lv.y, lv.y + lv.d], ['v', lv.x + lv.w, lv.y, lv.y + lv.d]];
        let best = null; sides.forEach(([o, c, a, b]) => { const t = (a + b) / 2; if (isExteriorPoint(floor, o, c, t)) { const len = b - a; if (!best || len > best.len) best = { o, c, t: a + Math.min(1.0, len / 3), len }; } });
        if (best) floor.doors.push({ id: uid('d'), o: best.o, x: best.o === 'h' ? best.t : best.c, y: best.o === 'h' ? best.c : best.t, w: 1.0, main: true }); }
    }
  }
  if (windows) R.forEach(r => {
    const sides = [['h', r.y, r.x, r.x + r.w], ['h', r.y + r.d, r.x, r.x + r.w], ['v', r.x, r.y, r.y + r.d], ['v', r.x + r.w, r.y, r.y + r.d]];
    let n = 0;
    sides.sort((p, q) => (q[3] - q[2]) - (p[3] - p[2])).forEach(([o, c, a, b]) => {
      if (n >= (r.type === 'living' || r.type === 'master' ? 2 : 1)) return;
      const len = b - a; const t = (a + b) / 2; if (len < 1.2 || !isExteriorPoint(floor, o, c, t)) return;
      const blocked = floor.doors.some(d => d.o === o && Math.abs((o === 'h' ? d.y : d.x) - c) < 0.2 && Math.abs((o === 'h' ? d.x : d.y) - t) < (d.w / 2 + 0.8));
      const wt = blocked ? (a + len * 0.75) : t;
      if (floor.windows.some(w => w.o === o && Math.abs((o === 'h' ? w.y : w.x) - c) < 0.2 && Math.abs((o === 'h' ? w.x : w.y) - wt) < 1)) { n++; return; }
      const bath = r.type === 'bathroom'; const ww = bath ? 0.6 : r.type === 'balcony' ? Math.min(2.4, len - 0.6) : Math.min(r.type === 'living' ? 1.8 : 1.4, len - 0.6);
      floor.windows.push({ id: uid('w'), o, x: o === 'h' ? wt : c, y: o === 'h' ? c : wt, w: r2(ww), sill: bath ? 1.5 : r.type === 'balcony' ? 0.15 : 0.9, h: bath ? 0.6 : r.type === 'balcony' ? 2.0 : 1.25 });
      n++;
    });
  });
}
function snapRooms(floor, tol = 0.25) {
  const xs = [], ys = [];
  floor.rooms.forEach(r => { xs.push(r.x, r.x + r.w); ys.push(r.y, r.y + r.d); });
  const cluster = arr => { const s = [...arr].sort((a, b) => a - b), groups = []; s.forEach(v => { const g = groups[groups.length - 1]; if (g && v - g[g.length - 1] < tol) g.push(v); else groups.push([v]); }); return v => { const g = groups.find(g => v >= g[0] - 1e-9 && v <= g[g.length - 1] + 1e-9); return g ? snap(g.reduce((a, b) => a + b, 0) / g.length, 0.05) : v; }; };
  const fx = cluster(xs), fy = cluster(ys);
  floor.rooms.forEach(r => { const x0 = fx(r.x), x1 = fx(r.x + r.w), y0 = fy(r.y), y1 = fy(r.y + r.d); r.x = r2(x0); r.w = r2(Math.max(0.6, x1 - x0)); r.y = r2(y0); r.d = r2(Math.max(0.6, y1 - y0)); });
}

/* ---------- sample home (2BHK, Indian layout) ---------- */
function sampleHome() {
  const p = newProject('Sample 2BHK Apartment');
  const f = p.floors[0]; S.project = p;
  const R = (name, type, x, y, w, d) => f.rooms.push(makeRoom({ name, type, x, y, w, d }));
  R('Living Room', 'living', 0, 0, 5.2, 4.6); R('Dining', 'dining', 5.2, 0, 3.4, 3.2); R('Kitchen', 'kitchen', 8.6, 0, 3.0, 3.2);
  R('Passage', 'hall', 5.2, 3.2, 3.4, 1.4); R('Utility', 'utility', 8.6, 3.2, 3.0, 1.4);
  R('Master Bedroom', 'master', 0, 4.6, 4.4, 4.2); R('Common Bath', 'bathroom', 4.4, 4.6, 1.8, 2.1); R('Attached Bath', 'bathroom', 4.4, 6.7, 1.8, 2.1);
  R('Bedroom 2', 'bedroom', 6.2, 4.6, 3.6, 4.2); R('Study', 'study', 9.8, 4.6, 1.8, 2.8); R('Store', 'closet', 9.8, 7.4, 1.8, 1.4); R('Balcony', 'balcony', 0, 8.8, 4.4, 1.4);
  const by = n => f.rooms.find(r => r.name === n);
  const D = (a, b, w = 0.9, at = 0.5) => { const e = sharedEdge(by(a), by(b)); const t = r2(e.lo + (e.hi - e.lo) * at); f.doors.push({ id: uid('d'), o: e.o, x: e.o === 'h' ? t : e.c, y: e.o === 'h' ? e.c : t, w }); };
  f.doors.push({ id: uid('d'), o: 'h', x: 1.1, y: 0, w: 1.0, main: true });
  D('Living Room', 'Dining', 1.4, 0.55); D('Living Room', 'Passage', 0.9); D('Dining', 'Kitchen', 0.9, 0.7); D('Passage', 'Common Bath', 0.75);
  D('Passage', 'Bedroom 2', 0.9, 0.6); D('Living Room', 'Master Bedroom', 0.9, 0.8); D('Master Bedroom', 'Attached Bath', 0.75); D('Kitchen', 'Utility', 0.8);
  D('Bedroom 2', 'Study', 0.8, 0.3); D('Bedroom 2', 'Store', 0.75); D('Master Bedroom', 'Balcony', 0.9, 0.3);
  autoOpenings(f, { doors: false });
  return p;
}
