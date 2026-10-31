/* ===================== 3D SCENE BUILDER & INTERACTION ===================== */
let E = null, CTL = null, lastT = 0, buildAnim = null;
const floorY = f => f.level * (f.height + 0.25);
function palette(room, it) {
  const th = roomTheme(room);
  const wood = it && it.finish ? WOOD_FINISHES[it.finish] : th.wood;
  return {
    wood, headboard: (it && it.color) || mixHex(th.fabric, th.wood, 0.25), fabric: (it && it.color) || th.fabric, fabric2: mixHex((it && it.color) || th.fabric, '#ffffff', 0.18), seat: (it && it.color) || mixHex(th.fabric, '#333333', 0.35),
    accent: th.accent, metal: th.metal, white: '#f3f2ee', mattress: '#f4f1ea', glass: '#c9e6f0', glass2: '#9fc3cf', screen: '#121418', plant: '#4f7d3c', plant2: '#6a9a48', pot: '#b56a45',
    stone: room.type === 'kitchen' ? (th.floor === 'marble' ? '#ece8e0' : '#2e2d2c') : '#3a3836', mirror: '#d7e6ec', rug: (it && it.color) || th.rug, rug2: mixHex((it && it.color) || th.rug, '#ffffff', 0.2), lamp: '#f6e7c8', dark: '#2b2b2d', ceramic: '#f6f6f4',
    cabinet: th.name === 'Luxury' ? '#efe9df' : mixHex(wood, '#f2efe9', 0.35), appliance: '#d9dcdf', rattan: '#b08a5b', led: th.accent, diya: '#ffb347', rubber: '#1d1d1d', water: '#9fd3e6',
  };
}
function init3D() {
  const cv = document.getElementById('gl');
  try { E = new Engine(cv); } catch (e) { document.getElementById('gl-fallback').style.display = 'flex'; document.getElementById('gl-fallback').querySelector('p').textContent = e.message; return false; }
  CTL = new Controls(E, cv);
  CTL.onClick = (x, y) => pick3D(x, y);
  CTL.onDragStart = (x, y) => dragStart3D(x, y);
  CTL.onDrag = (x, y) => drag3D(x, y);
  CTL.onDragEnd = (cancel) => dragEnd3D(cancel);
  CTL.onChange = () => { E.dirty = true; };
  CTL.collide = walkCollide;
  const loop = t => {
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
    let moving = CTL.tick(dt);
    const fovT = (S.touring || CTL.mode === 'walk' ? 68 : 50) * Math.PI / 180; if (Math.abs(E.cam.fov - fovT) > 0.002) { E.cam.fov += (fovT - E.cam.fov) * 0.12; moving = true; }
    if (buildAnim) { stepBuildAnim(t); moving = true; }
    if (S.view !== '2d' && (E.dirty || moving)) { E.render(); updateLabels(); updateCompass(); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.addEventListener('resize', () => { if (E) E.dirty = true; });
  return true;
}
function rebuild(opts = {}) {
  if (!E || !S.project) { if (S.view === '2d') render2D(); return; }
  const keepSel = S.sel;
  E.clear();
  const pj = S.project; const act = pj.floors[pj.activeFloor];
  const b = homeBounds(); const cx = b.x + b.w / 2, cz = b.y + b.d / 2;
  E.bounds = { c: [cx, 1.5, cz], r: Math.max(b.w, b.d) * 0.75 + 3 };
  const g0 = E.addGroup('ground', { kind: 'ground' });
  E.part(g0, { geo: E.geo('box', 160, 0.05, 160), x: cx, y: -0.08, z: cz, color: '#1a2336', color2: '#24304a', pattern: 2, patScale: 1, cast: false });
  E.part(g0, { geo: E.geo('box', b.w + 2.2, 0.06, b.d + 2.2), x: cx, y: -0.04, z: cz, color: '#3a4459', color2: '#2c3547', pattern: 2, patScale: 0.6, cast: false });
  // simple garden trees
  [[b.x - 3.2, b.y + 1.2], [b.x + b.w + 3.2, b.y + b.d * 0.3], [b.x + b.w * 0.65, b.y + b.d + 3.4], [b.x - 2.8, b.y + b.d - 0.6]].forEach((p, i) => { E.part(g0, { geo: E.geo('cyl', 0.1, 1.5, 1, 8), x: p[0], y: 0, z: p[1], color: '#6b4a32' }); E.part(g0, { geo: E.geo('sph', 0.75 + (i % 2) * 0.2, 12), x: p[0], y: 1.9, z: p[1], color: i % 2 ? '#5f8a4a' : '#4d7a41' }); E.part(g0, { geo: E.geo('sph', 0.5, 10), x: p[0] + 0.35, y: 2.35, z: p[1] - 0.2, color: '#6a9a50' }); });
  pj.floors.forEach(f => {
    if (f.level > act.level && !S.showAllFloors) return;
    buildFloor(f, f === act);
  });
  applyEnv();
  selectApply(keepSel);
  E.dirty = true;
  if (S.view === '2d') render2D();
  refreshSidePanel && refreshSidePanel();
  updateTopStats && updateTopStats();
}
function buildFloor(f, active) {
  const yOff = floorY(f), H = f.height;
  const cut = S.cutaway ? 1.15 : null;
  // floors
  f.rooms.forEach(r => {
    const fm = FLOORS[roomFloorKey(r)];
    const g = E.addGroup('room:' + r.id, { kind: 'room', ref: r.id, x: r.x + r.w / 2, y: yOff, z: r.y + r.d / 2 });
    E.part(g, { geo: E.geo('box', r.w, FLOOR_TOP, r.d), color: fm.color, color2: fm.c2, pattern: fm.pattern, patScale: fm.scale, cast: false });
    // roof/ceiling slab (casts sunlight shadows; visible only from inside)
    E.part(g, { geo: E.geo('box', r.w + 0.12, 0.12, r.d + 0.12), y: H, color: '#f4f2ee', cast: roofCasts(), showBelow: yOff + H - 0.05, noCull: true });
    // false ceiling
    const ck = roomCeiling(r); const lightsOn = isNight() && r.lights?.ambient;
    if (ck !== 'flat') {
      const bw = ck === 'tray' ? 0.6 : ck === 'cove' ? 0.45 : 0.32, th = 0.1, y = H - (ck === 'tray' ? 0.3 : 0.22);
      const vis = { showBelow: yOff + y - 0.02, cast: false, color: '#f7f5f1' };
      E.part(g, Object.assign({ geo: E.geo('box', r.w, th, bw), y, z: -r.d / 2 + bw / 2 }, vis)); E.part(g, Object.assign({ geo: E.geo('box', r.w, th, bw), y, z: r.d / 2 - bw / 2 }, vis));
      E.part(g, Object.assign({ geo: E.geo('box', bw, th, r.d - 2 * bw), y, x: -r.w / 2 + bw / 2 }, vis)); E.part(g, Object.assign({ geo: E.geo('box', bw, th, r.d - 2 * bw), y, x: r.w / 2 - bw / 2 }, vis));
      if (ck !== 'peripheral') { const em = lightsOn || r.lights?.accent && isNight() ? '#ffcf8a' : '#000000'; const es = { showBelow: yOff + y - 0.02, cast: false, color: '#fff4dc', emissive: em };
        E.part(g, Object.assign({ geo: E.geo('box', r.w - 2 * bw, 0.025, 0.03), y: y + th, z: -r.d / 2 + bw }, es)); E.part(g, Object.assign({ geo: E.geo('box', r.w - 2 * bw, 0.025, 0.03), y: y + th, z: r.d / 2 - bw }, es)); }
      if (ck === 'tray') for (let i = -1; i <= 1; i += 2) for (let j = -1; j <= 1; j += 2) E.part(g, { geo: E.geo('cyl', 0.06, 0.02, 1, 10), x: i * (r.w / 2 - bw / 2), y: y - 0.015, z: j * (r.d / 2 - bw / 2), color: '#ffffff', emissive: lightsOn ? '#ffe2b0' : '#222222', showBelow: yOff + y, cast: false });
    }
    if (ck === 'flat' || ck === 'peripheral') E.part(g, { geo: E.geo('cyl', 0.18, 0.03, 1, 16), y: H - 0.03, color: '#ffffff', emissive: lightsOn ? '#fff0d0' : '#1a1a1a', showBelow: yOff + H - 0.1, cast: false });
    if (S.overlay === 'heat' && active) { /* handled in 2D */ }
  });
  // walls: two half-slabs per piece, each coloured by the room on its side
  const wg = E.addGroup('walls:' + f.id, { kind: 'wall', y: yOff });
  const extCol = '#ebe5da';
  wallPieces(f).forEach(p => {
    let y0 = p.y0, y1 = p.y1; if (cut != null) { if (y0 >= cut) return; y1 = Math.min(y1, cut); }
    if (y1 - y0 < 0.01) return;
    const len = p.b - p.a, solid = p.kind === 'solid', ext = solid ? WALL_T / 2 : 0;
    const mid = (p.a + p.b) / 2;
    [-1, 1].forEach(side => {
      const pt = p.o === 'h' ? [mid, p.c + side * 0.2] : [p.c + side * 0.2, mid];
      const rm = roomAt(pt[0], pt[1], f);
      const col = rm ? roomWall(rm) : extCol;
      const off = side * WALL_T / 4;
      const geo = p.o === 'h' ? E.geo('box', len + ext * 2, y1 - y0, WALL_T / 2) : E.geo('box', WALL_T / 2, y1 - y0, len + ext * 2);
      const d = E.part(wg, { geo, x: p.o === 'h' ? mid : p.c + off, y: y0, z: p.o === 'h' ? p.c + off : mid, color: col, pattern: rm && rm.wallpaper ? 7 : 0, color2: rm ? mixHex(col, '#ffffff', 0.25) : col, patScale: 0.08 });
    });
    if (p.kind === 'sill' && cut == null) {
      const w = p.ref; const gy = w.sill, gh = w.h; const glass = { color: '#bfe0ee', alpha: 0.28, cast: false };
      const fr = { color: '#f2f1ed' };
      if (p.o === 'h') { E.part(wg, Object.assign({ geo: E.geo('box', len, gh, 0.02), x: mid, y: gy, z: p.c }, glass)); E.part(wg, Object.assign({ geo: E.geo('box', len, 0.05, WALL_T + 0.02), x: mid, y: gy - 0.02, z: p.c }, fr)); E.part(wg, Object.assign({ geo: E.geo('box', len, 0.05, WALL_T * 0.6), x: mid, y: gy + gh - 0.05, z: p.c }, fr)); E.part(wg, Object.assign({ geo: E.geo('box', 0.05, gh, WALL_T * 0.6), x: p.a + 0.025, y: gy, z: p.c }, fr)); E.part(wg, Object.assign({ geo: E.geo('box', 0.05, gh, WALL_T * 0.6), x: p.b - 0.025, y: gy, z: p.c }, fr)); E.part(wg, Object.assign({ geo: E.geo('box', 0.04, gh, WALL_T * 0.4), x: mid, y: gy, z: p.c }, fr)); }
      else { E.part(wg, Object.assign({ geo: E.geo('box', 0.02, gh, len), x: p.c, y: gy, z: mid }, glass)); E.part(wg, Object.assign({ geo: E.geo('box', WALL_T + 0.02, 0.05, len), x: p.c, y: gy - 0.02, z: mid }, fr)); E.part(wg, Object.assign({ geo: E.geo('box', WALL_T * 0.6, 0.05, len), x: p.c, y: gy + gh - 0.05, z: mid }, fr)); E.part(wg, Object.assign({ geo: E.geo('box', WALL_T * 0.6, gh, 0.05), x: p.c, y: gy, z: p.a + 0.025 }, fr)); E.part(wg, Object.assign({ geo: E.geo('box', WALL_T * 0.6, gh, 0.05), x: p.c, y: gy, z: p.b - 0.025 }, fr)); E.part(wg, Object.assign({ geo: E.geo('box', WALL_T * 0.4, gh, 0.04), x: p.c, y: gy, z: mid }, fr)); }
      // curtains on room side(s)
      [-1, 1].forEach(side => {
        const pt = p.o === 'h' ? [mid, p.c + side * 0.25] : [p.c + side * 0.25, mid]; const rm = roomAt(pt[0], pt[1], f);
        if (!rm || !rm.curtains || ['bathroom', 'kitchen', 'utility', 'balcony'].includes(rm.type)) return;
        const col = roomTheme(rm).curtain; const top = Math.min(H - 0.08, w.sill + w.h + 0.25), hh = top - 0.08; const o = side * (WALL_T / 2 + 0.07);
        [p.a - 0.12, p.b + 0.12].forEach(t => E.part(wg, p.o === 'h' ? { geo: E.geo('box', 0.32, hh, 0.06), x: t, y: 0.08, z: p.c + o, color: col, pattern: 7, patScale: 0.06, color2: mixHex(col, '#000000', 0.12) } : { geo: E.geo('box', 0.06, hh, 0.32), x: p.c + o, y: 0.08, z: t, color: col, pattern: 7, patScale: 0.06, color2: mixHex(col, '#000000', 0.12) }));
        E.part(wg, p.o === 'h' ? { geo: E.geo('box', len + 0.6, 0.03, 0.03), x: mid, y: top, z: p.c + o, color: '#777' } : { geo: E.geo('box', 0.03, 0.03, len + 0.6), x: p.c + o, y: top, z: mid, color: '#777' });
      });
    }
  });
  // doors
  f.doors.forEach(d => {
    if (cut != null) return;
    const hinge = d.o === 'h' ? [d.x - d.w / 2, d.y] : [d.x, d.y - d.w / 2];
    const base = d.o === 'h' ? 0 : -Math.PI / 2; const open = -1.48;
    const g = E.addGroup('door:' + d.id, { kind: 'door', ref: d.id, x: hinge[0], y: yOff, z: hinge[1], rot: base + open });
    const col = d.main ? '#5a3b26' : '#a07a55';
    E.part(g, { geo: E.geo('box', d.w - 0.04, DOOR_H - 0.03, 0.04), x: (d.w - 0.04) / 2 + 0.02, y: 0.01, z: 0, color: col });
    E.part(g, { geo: E.geo('box', 0.12, 0.03, 0.03), x: d.w - 0.12, y: 1.0, z: 0.04, color: '#c9a45c' });
    const fg = E.addGroup('doorframe:' + d.id, { kind: 'misc', x: d.x, y: yOff, z: d.y });
    const fcol = '#6d5038';
    if (d.o === 'h') { E.part(fg, { geo: E.geo('box', 0.05, DOOR_H, WALL_T + 0.02), x: -d.w / 2 + 0.025, color: fcol }); E.part(fg, { geo: E.geo('box', 0.05, DOOR_H, WALL_T + 0.02), x: d.w / 2 - 0.025, color: fcol }); E.part(fg, { geo: E.geo('box', d.w, 0.05, WALL_T + 0.02), y: DOOR_H - 0.05, color: fcol }); }
    else { E.part(fg, { geo: E.geo('box', WALL_T + 0.02, DOOR_H, 0.05), z: -d.w / 2 + 0.025, color: fcol }); E.part(fg, { geo: E.geo('box', WALL_T + 0.02, DOOR_H, 0.05), z: d.w / 2 - 0.025, color: fcol }); E.part(fg, { geo: E.geo('box', WALL_T + 0.02, 0.05, d.w), y: DOOR_H - 0.05, color: fcol }); }
  });
  // furniture
  f.rooms.forEach(r => r.furniture.forEach(it => buildItem(it, r, yOff)));
  // stairs
  (f.stairs || []).forEach(st => {
    const g = E.addGroup('stairs:' + st.id, { kind: 'misc', x: st.x, y: yOff + FLOOR_TOP, z: st.y });
    const n = 16, rise = (f.height + 0.25) / n, run = st.d / n;
    for (let i = 0; i < n; i++) E.part(g, { geo: E.geo('box', st.w, rise * (i + 1), run), z: -st.d / 2 + run * (i + 0.5), color: '#cdbfa9', pattern: 1, patScale: 0.2, color2: '#9c8a70' });
    E.part(g, { geo: E.geo('box', 0.04, 1.0, st.d), x: st.w / 2, y: (f.height + 0.25) / 2, z: 0, color: '#333', rx: -Math.atan2(f.height + 0.25, st.d), cast: false });
  });
}
function buildItem(it, room, yOff = floorY(floorOfRoom(room))) {
  const c = CATALOG[it.type]; if (!c) return;
  const g = E.addGroup('item:' + it.id, { kind: 'item', ref: it.id, x: it.x, y: yOff + FLOOR_TOP, z: it.y, rot: it.rot * Math.PI / 180 });
  const pal = palette(room, it); const night = isNight() && room.lights?.ambient !== false;
  c.build(it.w, it.d, it.h).forEach(p => {
    let col = p.role.startsWith('c:') ? p.role.slice(2) : (pal[p.role] || '#999999');
    const geo = p.k === 'box' ? E.geo('box', p.w, p.h, p.d) : p.k === 'cyl' ? E.geo('cyl', p.r, p.h, p.c || 1, 16) : E.geo('sph', p.r, 14);
    const em = p.role === 'lamp' ? (night ? '#ffd9a0' : '#3a3428') : p.role === 'led' ? mixHex(pal.accent, '#ffffff', 0.2) : p.role === 'diya' ? '#ff9a2e' : p.role === 'screen' ? '#0a0e14' : '#000000';
    E.part(g, { geo, x: p.x, y: p.y, z: p.z, ry: p.ry || 0, rx: p.rx || 0, rz: p.rz || 0, sy: p.sy || 1, color: col, color2: p.role === 'rug' ? mixHex(col, '#000000', 0.15) : col, pattern: p.pattern || (p.role === 'fabric' || p.role === 'rug2' ? 4 : 0), patScale: p.patScale || 1, alpha: p.role === 'glass' ? 0.3 : 1, emissive: em, cast: p.role !== 'glass' && !c.flat });
  });
  g.pick = { w: it.w, d: it.d, h: Math.max(0.05, it.h) };
  return g;
}
const isNight = () => S.hour < 6.4 || S.hour > 18.4;
const roofCasts = () => !!(S.daylightSim || S.touring || (CTL && CTL.mode === 'walk'));
function fmtHour(h) { const hh = Math.floor(h) % 24, mm = Math.round((h - Math.floor(h)) * 60); return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`; }
function applyEnv() {
  if (!E) return; const h = S.hour; const env = E.env;
  const t = (h - 6) / 12.6; const el = Math.max(-0.2, Math.sin(Math.PI * t)) * 1.22; // radians, peak ~70°
  const az = sunAz(h) * Math.PI / 180 + (S.project?.north || 0) * Math.PI / 180;
  const ce = Math.cos(el); env.sunDir = V3.norm([ce * Math.sin(az), Math.max(0.03, Math.sin(el)), -ce * Math.cos(az)]);
  const k = clamp(Math.sin(el) * 1.6, 0, 1); const day = clamp((Math.sin(el) + 0.1) * 3, 0, 1);
  const warm = [2.5, 1.35, 0.6], noon = [2.35, 2.2, 2.0];
  env.sunCol = day > 0 ? noon.map((v, i) => (warm[i] + (v - warm[i]) * k) * day) : [0, 0, 0];
  env.sky = day > 0.5 ? mixHex('#f2c49b', '#cfe0ea', k) : mixHex('#1c2438', '#f2b38a', day * 2);
  env.clear = day > 0.5 ? mixHex('#1a1028', '#0b0f19', k) : mixHex('#05050a', '#1a1028', day * 2);
  env.ground = '#5a6378'; env.amb = 0.42 + 0.6 * day; env.fog = 0.022;
  env.shadows = day > 0.05;
  // interior lights at night (closest 16 to camera target)
  const lights = [];
  if (isNight() || S.lightsAlways) {
    const tgt = E.cam.target; const act = S.project.floors[S.project.activeFloor];
    const rooms = act.rooms.filter(r => r.lights?.ambient !== false).map(r => ({ r, d: Math.hypot(r.x + r.w / 2 - tgt[0], r.y + r.d / 2 - tgt[2]) })).sort((a, b) => a.d - b.d).slice(0, 14);
    rooms.forEach(({ r }) => lights.push({ p: [r.x + r.w / 2, floorY(act) + act.height - 0.4, r.y + r.d / 2], c: r.lights.accent ? [2.4, 1.9, 1.3] : [1.9, 1.6, 1.15], r: Math.max(r.w, r.d) * 1.1 + 1 }));
    act.rooms.forEach(r => r.furniture.forEach(it => { if (it.type === 'floor_lamp' && lights.length < 16) lights.push({ p: [it.x, floorY(act) + 1.4, it.y], c: [1.3, 0.95, 0.55], r: 2.6 }); }));
  }
  E.setLights(lights);
  E.dirty = true;
  const el2 = document.getElementById('time-label'); if (el2) el2.textContent = fmtHour(h);
}
function setHour(h) { const wasNight = isNight(); S.hour = clamp(h, 0, 23.99); const ts = document.getElementById('time-slider'); if (ts) ts.value = S.hour; if (wasNight !== isNight()) rebuild(); else applyEnv(); if (S.view === '2d' && S.overlay === 'heat') render2D(); }

/* labels */
function updateLabels() {
  const box = document.getElementById('labels'); if (!box) return;
  if (!S.labels || CTL.mode === 'walk' || S.touring || S.view === '2d') { box.innerHTML = ''; box._k = ''; return; }
  const act = FL(); const yOff = floorY(act);
  const key = act.rooms.map(r => r.id + r.name).join('|');
  if (box._k !== key) { box.innerHTML = act.rooms.map(r => `<div class="lbl" data-act="select-room" data-id="${r.id}"><b>${esc(r.name)}</b><span>${r.w} × ${r.d} m</span></div>`).join(''); box._k = key; }
  [...box.children].forEach((el, i) => { const r = act.rooms[i]; if (!r) return; const p = E.project([r.x + r.w / 2, yOff + (S.cutaway ? 1.4 : act.height + 0.25), r.y + r.d / 2]); if (!p) { el.style.display = 'none'; return; } el.style.display = ''; el.style.transform = `translate(${p[0]}px, ${p[1]}px) translate(-50%,-50%)`; el.classList.toggle('sel', S.sel && S.sel.kind === 'room' && S.sel.id === r.id); el.style.opacity = p[2] > 60 ? 0.4 : 1; });
}
function updateCompass() { const el = document.getElementById('compass-needle'); if (!el || !CTL) return; const c = E.cam; const ang = Math.atan2(c.target[0] - c.pos[0], -(c.target[2] - c.pos[2])) * 180 / Math.PI; el.style.transform = `rotate(${-(ang) - (S.project?.north || 0)}deg)`; }

/* picking & dragging */
function hitItems(px, py) {
  const ray = E.ray(px, py); let best = null;
  E.groups.forEach(g => { if (g.kind !== 'item' || !g.visible || !g.pick) return; const t = Engine.rayOBB(ray, { x: g.x, z: g.z, y0: g.y, h: g.pick.h, w: g.pick.w, d: g.pick.d, rot: g.rot }); if (t != null && (!best || t < best.t)) best = { t, g }; });
  return { best, ray };
}
function floorHit(ray, y) { if (Math.abs(ray.d[1]) < 1e-6) return null; const t = (y - ray.o[1]) / ray.d[1]; if (t < 0) return null; return [ray.o[0] + ray.d[0] * t, ray.o[2] + ray.d[2] * t]; }
function pick3D(px, py) {
  if (S.touring) return;
  const { best, ray } = hitItems(px, py);
  if (best) { select({ kind: 'item', id: best.g.ref }); return; }
  const f = FL(); const p = floorHit(ray, floorY(f) + FLOOR_TOP);
  if (p) { const r = roomAt(p[0], p[1], f); if (r) { select({ kind: 'room', id: r.id }); return; } }
  select(null);
}
let drag = null;
function dragStart3D(px, py) {
  if (S.touring || CTL.mode === 'walk') return false;
  const { best, ray } = hitItems(px, py);
  if (!best) return false;
  const f = FL(); const p = floorHit(ray, floorY(f) + FLOOR_TOP); if (!p) return false;
  const found = findItem(best.g.ref); if (!found) return false;
  drag = { g: best.g, it: found.it, room: found.room, off: [found.it.x - p[0], found.it.y - p[1]], start: [found.it.x, found.it.y], committed: false };
  select({ kind: 'item', id: found.it.id }, true);
  return true;
}
function drag3D(px, py) {
  if (!drag) return; const ray = E.ray(px, py); const p = floorHit(ray, floorY(FL()) + FLOOR_TOP); if (!p) return;
  if (!drag.committed) { commit('Move ' + CATALOG[drag.it.type].label); drag.committed = true; }
  drag.it.x = r2(snap(p[0] + drag.off[0])); drag.it.y = r2(snap(p[1] + drag.off[1]));
  drag.g.x = drag.it.x; drag.g.z = drag.it.y; drag.g.dirtyM = true; E.dirty = true;
  document.getElementById('viewport').classList.add('dragging');
}
function dragEnd3D() {
  if (!drag) return; document.getElementById('viewport').classList.remove('dragging');
  if (drag.committed) {
    const nr = roomAt(drag.it.x, drag.it.y, FL());
    if (nr && nr !== drag.room) { drag.room.furniture.splice(drag.room.furniture.indexOf(drag.it), 1); nr.furniture.push(drag.it); toast(`Moved ${CATALOG[drag.it.type].label} to ${nr.name}`); }
    else if (!nr) { drag.it.x = drag.start[0]; drag.it.y = drag.start[1]; toast('Furniture must stay inside a room'); }
    rebuild(); save();
  }
  drag = null;
}
function selectApply(sel) {
  if (!E) return; E.groups.forEach(g => g.hl = 0);
  if (!sel) return;
  const g = E.groups.get((sel.kind === 'item' ? 'item:' : 'room:') + sel.id); if (g) g.hl = sel.kind === 'item' ? 0.55 : 0.35;
}
function select(sel, silent) {
  S.sel = sel; selectApply(sel); if (E) E.dirty = true;
  if (S.view === '2d') render2D();
  renderInspector();
  if (sel && sel.kind === 'room' && !silent) { const r = findRoom(sel.id); if (r && ['space', 'light', 'transform', 'design'].includes(S.panel)) refreshSidePanel(); }
}

/* camera helpers */
function fitView(animate = true, top = false) {
  if (!CTL) return; const b = homeBounds(FL()); const c = [b.x + b.w / 2, floorY(FL()), b.y + b.d / 2]; const R = Math.max(b.w, b.d);
  const asp = E.canvas.clientWidth / Math.max(1, E.canvas.clientHeight); const half = Math.min(E.cam.fov / 2, Math.atan(Math.tan(E.cam.fov / 2) * asp));
  const rad = Math.hypot(b.w, b.d) / 2 + 0.8; const r = rad / Math.sin(half) * (top ? 0.95 : 1.02); const theta = -0.62, phi = top ? 0.02 : 0.8;
  const pos = [c[0] + r * Math.sin(phi) * Math.sin(theta), c[1] + r * Math.cos(phi), c[2] + r * Math.sin(phi) * Math.cos(theta)];
  CTL.mode = 'orbit';
  if (animate) return CTL.flyTo(pos, c, 1.3, { mode: 'orbit' });
  E.cam.pos = pos; E.cam.target = c; CTL.syncFromCam('orbit'); E.dirty = true; return Promise.resolve();
}
function presetView(v) {
  if (!CTL) return; const b = homeBounds(FL()); const c = [b.x + b.w / 2, floorY(FL()), b.y + b.d / 2]; const R = Math.max(b.w, b.d) * 1.3 + 4;
  const P = { top: [c[0], c[1] + R * 1.25, c[2] + 0.01], front: [c[0], c[1] + R * 0.45, c[2] + R], side: [c[0] + R, c[1] + R * 0.45, c[2]], iso: null }[v];
  if (v === 'iso' || !P) return fitView(true);
  if (CTL.mode === 'walk') setView('3d');
  CTL.flyTo(P, c, 1.1, { mode: 'orbit' });
}
function focusRoom(r) {
  if (!CTL) return; if (S.view === '2d') setView('3d');
  const f = floorOfRoom(r); if (S.project.floors.indexOf(f) !== S.project.activeFloor) { S.project.activeFloor = S.project.floors.indexOf(f); rebuild(); }
  const c = [r.x + r.w / 2, floorY(f) + 0.6, r.y + r.d / 2]; const R = Math.max(r.w, r.d) * 1.25 + 2.5;
  CTL.mode = 'orbit'; CTL.flyTo([c[0] - R * 0.32, c[1] + R * 1.25, c[2] + R * 0.5], c, 1.2, { mode: 'orbit' });
  select({ kind: 'room', id: r.id });
}
function roomShot(r, from) {
  const f = floorOfRoom(r), y = floorY(f) + 1.6; const c = [r.x + r.w / 2, floorY(f) + 1.0, r.y + r.d / 2];
  const ops = roomOpenings(r, f).filter(o => o.kind === 'door');
  let entry = null;
  if (from) entry = ops.find(o => roomSideOf(from, o.ref.o, o.ref.x, o.ref.y)) || null;
  if (!entry) entry = ops.find(o => o.ref.main) || ops[0] || null;
  const doorPt = entry ? (entry.side === 'N' || entry.side === 'S' ? [entry.t, y, entry.side === 'N' ? r.y : r.y + r.d] : [entry.side === 'W' ? r.x : r.x + r.w, y, entry.t]) : [r.x, y, r.y];
  // stand in a corner near the entry (away from the door leaf and tall furniture), looking across the room
  const small = area(r) < 6.5; const camY = small ? floorY(f) + 2.3 : y;
  const hinges = f.doors.map(d => d.o === 'h' ? [d.x - d.w / 2, d.y] : [d.x, d.y - d.w / 2]);
  const ins = small ? 0.28 : Math.min(0.55, Math.min(r.w, r.d) * 0.22);
  const cand = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.d], [r.x + r.w, r.y + r.d]].map(k => {
    const p = [k[0] + (k[0] === r.x ? ins : -ins), k[1] + (k[1] === r.y ? ins : -ins)];
    let pen = Math.hypot(k[0] - doorPt[0], k[1] - doorPt[2]);
    if (hinges.some(h => Math.hypot(h[0] - k[0], h[1] - k[1]) < 1.25)) pen += 50;
    if (!small && r.furniture.some(it => { if (CATALOG[it.type].flat || it.h < 1.1) return false; const fp = itemFootprint(it); return p[0] > fp.x - 0.35 && p[0] < fp.x + fp.w + 0.35 && p[1] > fp.y - 0.35 && p[1] < fp.y + fp.d + 0.35; })) pen += 20;
    return { k, p, pen };
  }).sort((a, b) => a.pen - b.pen);
  const k = cand[0].k; const pos = [cand[0].p[0], camY, cand[0].p[1]];
  const far = [r.x + r.w - (k[0] - r.x), floorY(f) + (small ? 0.4 : 0.9), r.y + r.d - (k[1] - r.y)];
  const target = V3.lerp([c[0], small ? floorY(f) + 0.5 : c[1], c[2]], far, 0.35);
  return { pos, target, door: entry ? doorPt : null };
}
function walkCollide(p, np) {
  if (S.touring) return true; const f = FL(); const yOff = floorY(f);
  if (!f.rooms.some(r => inRoom(r, np[0], np[2], 0.6))) return false;
  const m = 0.22;
  for (const pc of wallPieces(f)) {
    if (pc.kind === 'lintel' || pc.kind === 'head') continue;
    if (pc.o === 'h') { if (Math.abs(np[2] - pc.c) < WALL_T / 2 + m && np[0] > pc.a - 0.02 && np[0] < pc.b + 0.02) return false; }
    else { if (Math.abs(np[0] - pc.c) < WALL_T / 2 + m && np[2] > pc.a - 0.02 && np[2] < pc.b + 0.02) return false; }
  }
  return true;
}
function startBuildAnim() { buildAnim = { t0: performance.now() }; }
function stepBuildAnim(t) {
  const k = clamp((t - buildAnim.t0) / 1800, 0, 1); const e = 1 - Math.pow(1 - k, 3);
  E.groups.forEach(g => {
    if (g.kind === 'wall') { g.sy = Math.max(0.001, e); g.dirtyM = true; }
    if (g.kind === 'door' || g.id.startsWith('doorframe')) g.visible = k > 0.7;
    if (g.kind === 'item') { if (g.baseY == null) g.baseY = g.y; const kk = clamp((k - 0.45 - (g.x * 0.013 % 0.2)) / 0.4, 0, 1); g.y = g.baseY + (1 - (1 - Math.pow(1 - kk, 3))) * 2.5; g.visible = kk > 0; g.dirtyM = true; }
  });
  E.dirty = true;
  if (k >= 1) { E.groups.forEach(g => { if (g.baseY != null) { g.y = g.baseY; delete g.baseY; } g.visible = true; g.sy = 1; g.dirtyM = true; }); buildAnim = null; }
}
