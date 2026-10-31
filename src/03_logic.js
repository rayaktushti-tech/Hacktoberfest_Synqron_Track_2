/* ===================== FURNISHING, COSTS & ANALYZERS ===================== */
const SIDES = ['N', 'E', 'S', 'W'];
const SIDE_ROT = { N: 0, S: 180, W: 90, E: 270 };
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const frontVec = rot => { const a = rot * Math.PI / 180; return [Math.sin(a), Math.cos(a)]; };
const rightVec = rot => { const a = rot * Math.PI / 180; return [Math.cos(a), -Math.sin(a)]; };

function occupancy(room, floor, except = []) {
  const occ = [];
  room.furniture.forEach(it => { if (except.includes(it) || CATALOG[it.type]?.flat) return; occ.push(itemFootprint(it)); });
  roomOpenings(room, floor).filter(o => o.kind === 'door').forEach(o => occ.push(Object.assign(doorSwingRect(room, o), { door: true })));
  return occ;
}
function rectInRoom(rc, room, tol = 0.02) { return rc.x >= room.x - tol && rc.y >= room.y - tol && rc.x + rc.w <= room.x + room.w + tol && rc.y + rc.d <= room.y + room.d + tol; }
function rectFree(rc, occ) { return !occ.some(o => rectOverlap(rc, o) > 0.0015); }
function sideSpan(room, side) { return side === 'N' || side === 'S' ? [room.x, room.x + room.w] : [room.y, room.y + room.d]; }
function sideOpenings(room, floor, side) { return roomOpenings(room, floor).filter(o => o.side === side); }

function placeOnWall(room, floor, type, side, opt = {}) {
  const c = CATALOG[type]; const W = opt.w || c.w, D = opt.d || c.d, gap = opt.gap ?? 0.02;
  const occ = opt.occ || occupancy(room, floor);
  const [lo, hi] = sideSpan(room, side); const mid = (lo + hi) / 2;
  if (hi - lo < W + 0.02) return null;
  const tall = (opt.h || c.h) > 0.85 && !c.flat;
  const wins = sideOpenings(room, floor, side).filter(o => o.kind === 'window');
  const doorsHere = sideOpenings(room, floor, side).filter(o => o.kind === 'door');
  const cands = [];
  for (let t = lo + W / 2 + 0.01; t <= hi - W / 2 - 0.01 + 1e-9; t += 0.05) cands.push(r2(t));
  const al = opt.align || 'center';
  cands.sort((a, b) => al === 'start' ? a - b : al === 'end' ? b - a : al === 'near' ? Math.abs(a - opt.t0) - Math.abs(b - opt.t0) : Math.abs(a - mid) - Math.abs(b - mid));
  for (const t of cands) {
    let rc;
    if (side === 'N') rc = { x: t - W / 2, y: room.y + gap, w: W, d: D };
    else if (side === 'S') rc = { x: t - W / 2, y: room.y + room.d - gap - D, w: W, d: D };
    else if (side === 'W') rc = { x: room.x + gap, y: t - W / 2, w: D, d: W };
    else rc = { x: room.x + room.w - gap - D, y: t - W / 2, w: D, d: W };
    if (!rectInRoom(rc, room) || !rectFree(rc, occ)) continue;
    if (tall && wins.some(o => Math.abs(o.t - t) < (o.w / 2 + W / 2) && o.ref.sill < (opt.h || c.h))) continue;
    if (doorsHere.some(o => Math.abs(o.t - t) < (o.w / 2 + W / 2 + 0.05))) continue;
    return makeItem(type, room, { x: r2(rc.x + rc.w / 2), y: r2(rc.y + rc.d / 2), rot: SIDE_ROT[side], w: W, d: D, h: opt.h || c.h });
  }
  return null;
}
function placeFree(room, floor, type, opt = {}) {
  const c = CATALOG[type]; const occ = opt.occ || occupancy(room, floor);
  const near = opt.near || [room.x + room.w / 2, room.y + room.d / 2];
  let best = null;
  const rots = opt.rots || [0, 90];
  rots.forEach(rot => {
    const sw = rot % 180 !== 0; const fw = sw ? c.d : c.w, fd = sw ? c.w : c.d;
    for (let x = room.x + fw / 2 + 0.05; x <= room.x + room.w - fw / 2 - 0.05 + 1e-9; x += 0.1) for (let y = room.y + fd / 2 + 0.05; y <= room.y + room.d - fd / 2 - 0.05 + 1e-9; y += 0.1) {
      const rc = { x: x - fw / 2, y: y - fd / 2, w: fw, d: fd };
      if (!rectFree(rc, occ)) continue;
      const dist = Math.hypot(x - near[0], y - near[1]);
      if (!best || dist < best.dist) best = { dist, x, y, rot };
    }
  });
  return best ? makeItem(type, room, { x: r2(best.x), y: r2(best.y), rot: best.rot }) : null;
}
function addItem(room, it) { if (it) room.furniture.push(it); return it; }
function sideScores(room, floor, prefer = {}) {
  return SIDES.map(s => {
    const ops = sideOpenings(room, floor, s); const [lo, hi] = sideSpan(room, s);
    let sc = (hi - lo); if (ops.some(o => o.kind === 'door')) sc -= 3; if (ops.some(o => o.kind === 'window')) sc += prefer.window ? 2 : -0.8;
    const doorSides = roomOpenings(room, floor).filter(o => o.kind === 'door').map(o => o.side);
    if (doorSides.includes(OPP[s])) sc += prefer.faceDoor ? 1.5 : 0.6;
    return { s, sc };
  }).sort((a, b) => b.sc - a.sc).map(o => o.s);
}
function tryWalls(room, floor, type, sides, opt = {}) { for (const s of sides) { const it = placeOnWall(room, floor, type, s, opt); if (it) return addItem(room, it); } return null; }
function placeRel(room, floor, type, cx, cy, rot, skipOcc = []) {
  const it = makeItem(type, room, { x: r2(cx), y: r2(cy), rot }); const fp = itemFootprint(it);
  if (!rectInRoom(fp, room)) return null; const occ = occupancy(room, floor).filter(o => !skipOcc.some(s => s && rectOverlap(o, itemFootprint(s)) > 0 && !o.door));
  if (!rectFree(fp, occ)) return null; return addItem(room, it);
}
function addChairFor(room, floor, desk, type = 'office_chair') {
  const f = frontVec(desk.rot); const c = CATALOG[type];
  const it = makeItem(type, room, { x: r2(desk.x + f[0] * (desk.d / 2 + c.d / 2 - 0.12)), y: r2(desk.y + f[1] * (desk.d / 2 + c.d / 2 - 0.12)), rot: (desk.rot + 180) % 360 });
  if (rectInRoom(itemFootprint(it), room, 0.05)) room.furniture.push(it);
}
function cornerPlant(room, floor) {
  const c = CATALOG.plant; const occ = occupancy(room, floor);
  const corners = [[room.x + 0.3, room.y + 0.3], [room.x + room.w - 0.3, room.y + 0.3], [room.x + 0.3, room.y + room.d - 0.3], [room.x + room.w - 0.3, room.y + room.d - 0.3]];
  for (const [x, y] of corners) { const rc = { x: x - c.w / 2, y: y - c.d / 2, w: c.w, d: c.d }; if (rectFree(rc, occ)) return addItem(room, makeItem('plant', room, { x: r2(x), y: r2(y) })); }
  return null;
}
function rugUnder(room, floor, anchor, w = 2.0, d = 1.4, off = 0) {
  const f = frontVec(anchor.rot); const sw = anchor.rot % 180 !== 0;
  let cx = anchor.x + f[0] * off, cy = anchor.y + f[1] * off;
  let rw = Math.min(w, (sw ? room.d : room.w) - 0.6), rd = Math.min(d, (sw ? room.w : room.d) - 0.6);
  if (rw < 1 || rd < 0.8) return null;
  const it = makeItem('rug', room, { x: r2(cx), y: r2(cy), rot: anchor.rot, w: r2(rw), d: r2(rd) });
  const fp = itemFootprint(it); it.x = r2(clamp(it.x, room.x + fp.w / 2 + 0.1, room.x + room.w - fp.w / 2 - 0.1)); it.y = r2(clamp(it.y, room.y + fp.d / 2 + 0.1, room.y + room.d - fp.d / 2 - 0.1));
  return addItem(room, it);
}

function autoFurnish(room, floor = floorOfRoom(room), variant = 0) {
  room.furniture = [];
  const t = room.type, pf = S.prefs, A = area(room);
  const rot = arr => arr.slice(variant % arr.length).concat(arr.slice(0, variant % arr.length));
  const sides = rot(sideScores(room, floor));
  if (t === 'bedroom' || t === 'master' || t === 'guest') {
    const kidsRoom = pf.kids && t === 'bedroom' && !allRooms().some(r => r !== room && r.furniture.some(i => i.type === 'bunk_bed'));
    const bedType = kidsRoom ? 'bunk_bed' : (Math.min(room.w, room.d) < 2.9 ? 'bed_single' : 'bed_double');
    const bed = tryWalls(room, floor, bedType, sides);
    if (bed) {
      const st = CATALOG.side_table, r = rightVec(bed.rot), b = frontVec(bed.rot);
      [-1, 1].forEach(s => placeRel(room, floor, 'side_table', bed.x + r[0] * s * (bed.w / 2 + st.w / 2 + 0.04) - b[0] * (bed.d / 2 - st.d / 2 - 0.02), bed.y + r[1] * s * (bed.w / 2 + st.w / 2 + 0.04) - b[1] * (bed.d / 2 - st.d / 2 - 0.02), bed.rot));
      if (bedType !== 'bunk_bed' && A > 10) rugUnder(room, floor, bed, Math.min(bed.w + 0.9, 2.4), 1.2, bed.d / 2 - 0.2);
    }
    const wardW = A > 14 ? 2.1 : A > 10 ? 1.8 : 1.2;
    const wSides = sides.filter(s => !bed || s !== Object.keys(SIDE_ROT).find(k => SIDE_ROT[k] === bed.rot)).concat(sides);
    for (const s of wSides) { const it = placeOnWall(room, floor, 'wardrobe', s, { w: wardW, align: 'end' }) || placeOnWall(room, floor, 'wardrobe', s, { w: 1.2, align: 'start' }); if (it) { addItem(room, it); break; } }
    if (pf.storage === 'high') tryWalls(room, floor, 'storage_cabinet', sides.slice().reverse());
    if ((pf.wfh && (t === 'master' || (t === 'bedroom' && !allRooms().some(r => ['office', 'study'].includes(r.type))))) || kidsRoom) {
      const ws = rot(sideScores(room, floor, { window: true }));
      const d = tryWalls(room, floor, 'desk', ws, { align: 'start' }); if (d) addChairFor(room, floor, d);
    }
    if (A > 13) tryWalls(room, floor, 'dresser', sides.slice().reverse());
    if (pf.kids && t === 'master' && A > 14 && !allRooms().some(r => r.type === 'nursery')) tryWalls(room, floor, 'crib', sides.slice().reverse());
    cornerPlant(room, floor);
  } else if (t === 'living') {
    const sofaType = A > 18 ? 'sofa_l' : 'sofa_3';
    const ls = rot(sideScores(room, floor, { faceDoor: false }));
    const sofa = tryWalls(room, floor, sofaType, ls) || tryWalls(room, floor, 'sofa_3', ls);
    if (sofa) {
      const f = frontVec(sofa.rot), ct = CATALOG.coffee_table; const off = (sofaType === 'sofa_l' && sofa.type === 'sofa_l' ? 0.92 : sofa.d) / 2 + 0.45 + ct.d / 2;
      const by = sofa.type === 'sofa_l' ? -sofa.d / 2 + 0.46 : 0;
      const cx = sofa.x + f[0] * (off + by) - (sofa.type === 'sofa_l' ? rightVec(sofa.rot)[0] * 0.3 : 0), cy = sofa.y + f[1] * (off + by) - (sofa.type === 'sofa_l' ? rightVec(sofa.rot)[1] * 0.3 : 0);
      const table = placeRel(room, floor, 'coffee_table', cx, cy, sofa.rot);
      const sSide = Object.keys(SIDE_ROT).find(k => SIDE_ROT[k] === sofa.rot);
      const tvSide = OPP[sSide]; const t0 = sSide === 'N' || sSide === 'S' ? sofa.x : sofa.y;
      const tv = addItem(room, placeOnWall(room, floor, 'tv_unit', tvSide, { align: 'near', t0 })) || tryWalls(room, floor, 'tv_unit', sides.filter(s => s !== sSide));
      if (table) {
        rugUnder(room, floor, table, 2.2, 1.6, 0);
        const r = rightVec(sofa.rot);
        for (const s of [1, -1]) { const a = placeRel(room, floor, 'armchair', table.x + r[0] * s * (table.w / 2 + 0.75), table.y + r[1] * s * (table.w / 2 + 0.75), (sofa.rot + (s > 0 ? 270 : 90)) % 360); if (a) break; }
      }
    }
    const pooja = S.prefs.style === 'Indian Contemporary' || /indian/i.test(P().theme);
    if (pooja && !allRooms().some(r => r.type === 'pooja')) tryWalls(room, floor, 'pooja_unit', sides.slice().reverse(), { align: 'end' });
    tryWalls(room, floor, 'bookshelf', sides.slice().reverse(), { align: 'start' });
    const main = roomOpenings(room, floor).find(o => o.kind === 'door' && o.ref.main);
    if (main) { const it = placeOnWall(room, floor, 'shoe_rack', main.side, { align: 'near', t0: main.t + 1.0 }) || tryWalls(room, floor, 'shoe_rack', sides); if (it && !room.furniture.includes(it)) addItem(room, it); }
    if (S.prefs.pets) { const pb = placeFree(room, floor, 'pet_bed', { near: [room.x + 0.5, room.y + room.d - 0.5] }); addItem(room, pb); }
    if (A > 14) { const fl = placeFree(room, floor, 'floor_lamp', { near: [room.x + 0.3, room.y + 0.3] }); addItem(room, fl); }
    cornerPlant(room, floor); cornerPlant(room, floor);
  } else if (t === 'kitchen') {
    const ks = rot(sideScores(room, floor, { window: true }));
    let placed = null;
    for (const s of ks) { const [lo, hi] = sideSpan(room, s); const w = Math.min(3.2, r2(hi - lo - 0.1)); if (w < 1.2) continue; placed = placeOnWall(room, floor, 'kitchen_counter', s, { w, align: 'start', h: 2.2 }) || placeOnWall(room, floor, 'kitchen_counter', s, { w: Math.max(1.2, w - 0.8), align: 'start', h: 2.2 }); if (placed) { addItem(room, placed); break; } }
    if (placed && A > 7) { const ps = Object.keys(SIDE_ROT).find(k => SIDE_ROT[k] === placed.rot); const adj = ['N', 'S'].includes(ps) ? ['E', 'W'] : ['N', 'S']; for (const s of adj) { const [lo, hi] = sideSpan(room, s); const it = placeOnWall(room, floor, 'kitchen_counter', s, { w: Math.min(2.0, r2(hi - lo - 0.8)), align: 'start', h: 2.2 }); if (it) { addItem(room, it); break; } } }
    tryWalls(room, floor, 'fridge', ks.slice().reverse(), { align: 'end' });
  } else if (t === 'dining') {
    const big = A > 9.5 && Math.min(room.w, room.d) > 2.9;
    const type = big ? 'dining_set' : 'dining_4';
    const r0 = room.w > room.d ? 90 : 0;
    const it = placeFree(room, floor, type, { rots: [r0, (r0 + 90) % 180] }); addItem(room, it);
    tryWalls(room, floor, 'storage_cabinet', sides);
    cornerPlant(room, floor);
  } else if (t === 'bathroom') {
    const ds = roomOpenings(room, floor).find(o => o.kind === 'door');
    const corners = [[room.x, room.y], [room.x + room.w, room.y], [room.x, room.y + room.d], [room.x + room.w, room.y + room.d]];
    const dp = ds ? (ds.side === 'N' || ds.side === 'S' ? [ds.t, ds.side === 'N' ? room.y : room.y + room.d] : [ds.side === 'W' ? room.x : room.x + room.w, ds.t]) : [room.x, room.y];
    corners.sort((a, b) => Math.hypot(b[0] - dp[0], b[1] - dp[1]) - Math.hypot(a[0] - dp[0], a[1] - dp[1]));
    const sh = CATALOG.shower; const occ = occupancy(room, floor);
    if (A > 3.2) for (const [cx, cy] of corners) { const x = cx === room.x ? cx + sh.w / 2 : cx - sh.w / 2, y = cy === room.y ? cy + sh.d / 2 : cy - sh.d / 2; const rc = { x: x - sh.w / 2, y: y - sh.d / 2, w: sh.w, d: sh.d }; if (rectFree(rc, occ)) { const it = makeItem('shower', room, { x: r2(x), y: r2(y), rot: cy === room.y ? (cx === room.x ? 0 : 270) : (cx === room.x ? 90 : 180) }); addItem(room, it); break; } }
    tryWalls(room, floor, 'toilet', sides, { align: 'end' });
    tryWalls(room, floor, 'wash_basin', sides.slice().reverse(), { align: 'start' });
  } else if (t === 'balcony') {
    const s = sides[0]; const a = placeOnWall(room, floor, 'outdoor_chair', s, { align: 'start' }); addItem(room, a);
    if (a) { const r = rightVec(a.rot); placeRel(room, floor, 'side_table_round', a.x + r[0] * 0.65, a.y + r[1] * 0.65, a.rot); placeRel(room, floor, 'outdoor_chair', a.x + r[0] * 1.3, a.y + r[1] * 1.3, a.rot); }
    cornerPlant(room, floor); cornerPlant(room, floor);
    if (!allRooms().some(r => r.furniture.some(i => i.type === 'washing_machine'))) tryWalls(room, floor, 'washing_machine', sides.slice().reverse(), { align: 'end' });
  } else if (t === 'study' || t === 'office') {
    const ws = rot(sideScores(room, floor, { window: true }));
    const d = tryWalls(room, floor, 'desk', ws, { w: t === 'office' && A > 7 ? 1.5 : 1.2 }); if (d) addChairFor(room, floor, d);
    tryWalls(room, floor, 'bookshelf', ws.slice().reverse()); if (A > 8) tryWalls(room, floor, 'storage_cabinet', ws.slice().reverse());
    if (A > 7) { const a = placeFree(room, floor, 'armchair', { near: [room.x + room.w - 0.6, room.y + room.d - 0.6] }); addItem(room, a); }
    cornerPlant(room, floor);
  } else if (t === 'gaming') {
    const ws = rot(sideScores(room, floor, { window: false }));
    const d = tryWalls(room, floor, 'gaming_desk', ws); if (d) addChairFor(room, floor, d, 'gaming_chair');
    const bb = placeFree(room, floor, 'beanbag', { near: [room.x + room.w - 0.6, room.y + room.d - 0.6] }); addItem(room, bb);
    if (A > 10) { tryWalls(room, floor, 'tv_unit', ws.slice(1)); }
    tryWalls(room, floor, 'bookshelf', ws.slice().reverse());
    if (A > 8) { const r = placeFree(room, floor, 'rug'); if (r) { r.w = 1.6; r.d = 1.2; addItem(room, r); } }
  } else if (t === 'reading') {
    const ws = rot(sideScores(room, floor, { window: true }));
    const a = placeOnWall(room, floor, 'armchair', ws[0], { align: 'start', gap: 0.15 }) || placeFree(room, floor, 'armchair'); addItem(room, a);
    if (a) { const r = rightVec(a.rot); placeRel(room, floor, 'floor_lamp', a.x + r[0] * 0.65, a.y + r[1] * 0.65, a.rot); placeRel(room, floor, 'side_table', a.x - r[0] * 0.65, a.y - r[1] * 0.65, a.rot); }
    tryWalls(room, floor, 'bookshelf', ws.slice(1)); tryWalls(room, floor, 'bookshelf', ws.slice(1));
    if (A > 6) rugUnder(room, floor, a || { x: room.x + room.w / 2, y: room.y + room.d / 2, rot: 0 }, 1.6, 1.2, 0.5);
    cornerPlant(room, floor);
  } else if (t === 'closet') {
    sides.forEach(s => { const [lo, hi] = sideSpan(room, s); const w = Math.min(2.4, r2(hi - lo - 0.2)); if (w >= 0.9) addItem(room, placeOnWall(room, floor, 'closet_rack', s, { w, align: 'center' })); });
    if (room.furniture.length < 2) tryWalls(room, floor, 'storage_cabinet', sides);
    if (A > 5) tryWalls(room, floor, 'dresser', sides);
  } else if (t === 'nursery') {
    tryWalls(room, floor, 'crib', sides); tryWalls(room, floor, 'dresser', sides.slice().reverse()); tryWalls(room, floor, 'armchair', sides.slice(1));
    const r = placeFree(room, floor, 'rug'); if (r) { r.w = 1.6; r.d = 1.2; addItem(room, r); } cornerPlant(room, floor);
  } else if (t === 'gym') {
    tryWalls(room, floor, 'treadmill', sides); const r = placeFree(room, floor, 'rug'); if (r) { r.w = 1.8; r.d = 0.9; r.color = '#3a3a3a'; addItem(room, r); }
    tryWalls(room, floor, 'storage_cabinet', sides.slice().reverse()); cornerPlant(room, floor);
  } else if (t === 'pooja') {
    tryWalls(room, floor, 'pooja_unit', sides); cornerPlant(room, floor);
  } else if (t === 'utility') {
    tryWalls(room, floor, 'washing_machine', sides, { align: 'start' }); tryWalls(room, floor, 'storage_cabinet', sides.slice(1));
  } else if (t === 'hall') {
    if (Math.min(room.w, room.d) > 1.3) tryWalls(room, floor, 'shoe_rack', sides); cornerPlant(room, floor);
  }
  room.furniture.forEach(i => { i.tier = room.tier || i.tier; });
  return room.furniture;
}
function furnishAll() { S.project.floors.forEach(f => f.rooms.forEach(r => autoFurnish(r, f))); }

/* ---------- cost model ---------- */
function roomCost(room, floor = floorOfRoom(room)) {
  const H = floor.height, ops = roomOpenings(room, floor), tier = room.tier || 'standard', ti = TIER_IX[tier];
  const openA = ops.reduce((s, o) => s + (o.kind === 'door' ? o.w * DOOR_H : o.w * o.ref.h), 0);
  const wallA = Math.max(0, 2 * (room.w + room.d) * H - openA);
  const paint = wallA * SQFT * PAINT[tier].rate;
  const fk = roomFloorKey(room), flooring = room.floorKeep ? 0 : area(room) * SQFT * FLOORS[fk].rate;
  let furniture = 0, decor = 0; const items = [];
  room.furniture.forEach(it => { const c = CATALOG[it.type]; const p = c.price[TIER_IX[it.tier || tier]] * (c.perW ? it.w / c.w : 1); items.push({ it, p }); if (c.decor) decor += p; else furniture += p; });
  const nWin = ops.filter(o => o.kind === 'window').length;
  const curtains = room.curtains && !['bathroom', 'kitchen', 'utility'].includes(room.type) ? nWin * [3500, 7500, 16000][ti] : 0;
  decor += curtains;
  const L = room.lights || {}; const mult = [0.8, 1, 1.7][ti];
  const lighting = ((L.ambient ? area(room) * LIGHT_COST.ambient : 0) + (L.task ? LIGHT_COST.task : 0) + (L.accent ? LIGHT_COST.accent : 0)) * mult;
  const ck = roomCeiling(room), ceiling = area(room) * SQFT * CEILINGS[ck].rate;
  const total = paint + flooring + furniture + decor + lighting + ceiling;
  return { paint, flooring, furniture, decor, lighting, ceiling, total, items, curtains,
    explain: {
      paint: `${r2(wallA)} m² wall (${Math.round(wallA * SQFT)} sq ft, openings deducted) × ₹${PAINT[tier].rate}/sq ft · ${PAINT[tier].label}`,
      flooring: room.floorKeep ? 'Keeping the existing flooring (no new flooring cost)' : `${r2(area(room))} m² (${Math.round(area(room) * SQFT)} sq ft) × ₹${FLOORS[fk].rate}/sq ft · ${FLOORS[fk].label}`,
      furniture: items.filter(x => !CATALOG[x.it.type].decor).map(x => `${CATALOG[x.it.type].label} (${x.it.tier || tier}) ${inr(x.p)}`).join(' · ') || 'No furniture',
      decor: (items.filter(x => CATALOG[x.it.type].decor).map(x => `${CATALOG[x.it.type].label} ${inr(x.p)}`).concat(curtains ? [`Curtains ×${nWin} ${inr(curtains)}`] : [])).join(' · ') || '—',
      lighting: [L.ambient ? `Ambient LED ${inr(area(room) * LIGHT_COST.ambient * mult)}` : null, L.task ? `Task lights ${inr(LIGHT_COST.task * mult)}` : null, L.accent ? `Accent lights ${inr(LIGHT_COST.accent * mult)}` : null].filter(Boolean).join(' · ') || 'None',
      ceiling: CEILINGS[ck].rate ? `${Math.round(area(room) * SQFT)} sq ft × ₹${CEILINGS[ck].rate} · ${CEILINGS[ck].label}` : 'Plain ceiling (no false ceiling)',
    } };
}
function homeCost() { const rooms = allRooms().map(r => ({ r, c: roomCost(r) })); const sum = k => rooms.reduce((s, x) => s + x.c[k], 0); return { rooms, paint: sum('paint'), flooring: sum('flooring'), furniture: sum('furniture'), decor: sum('decor'), lighting: sum('lighting'), ceiling: sum('ceiling'), total: sum('total') }; }
function cheaperAlternatives(room) {
  const out = [], c = roomCost(room), tier = room.tier || 'standard';
  const fk = roomFloorKey(room), alt = FLOOR_CHEAPER[fk];
  if (alt && !room.floorKeep) out.push({ what: `Flooring: ${FLOORS[fk].label} → ${FLOORS[alt].label}`, save: area(room) * SQFT * (FLOORS[fk].rate - FLOORS[alt].rate), apply: () => { room.floor = alt; } });
  if (tier !== 'budget') { const lower = TIERS[TIER_IX[tier] - 1]; out.push({ what: `Paint: ${PAINT[tier].label} → ${PAINT[lower].label}`, save: c.paint * (1 - PAINT[lower].rate / PAINT[tier].rate), apply: () => { room.tier = lower; } }); }
  c.items.filter(x => (x.it.tier || tier) !== 'budget').sort((a, b) => b.p - a.p).slice(0, 4).forEach(x => { const lower = TIERS[TIER_IX[x.it.tier || tier] - 1]; const cc = CATALOG[x.it.type]; const np = cc.price[TIER_IX[lower]] * (cc.perW ? x.it.w / cc.w : 1); out.push({ what: `${CATALOG[x.it.type].label}: ${x.it.tier || tier} → ${lower}`, save: x.p - np, apply: () => { x.it.tier = lower; } }); });
  const ck = roomCeiling(room); if (CEILINGS[ck].rate > 95) out.push({ what: `Ceiling: ${CEILINGS[ck].label} → Peripheral false ceiling`, save: c.ceiling - area(room) * SQFT * 95, apply: () => { room.ceiling = 'peripheral'; } });
  if (room.lights?.accent) out.push({ what: 'Skip accent lighting', save: LIGHT_COST.accent * [0.8, 1, 1.7][TIER_IX[tier]], apply: () => { room.lights.accent = false; } });
  return out.filter(o => o.save > 50).sort((a, b) => b.save - a.save);
}
const ESSENTIAL = new Set(['bed_double', 'bed_single', 'bunk_bed', 'wardrobe', 'sofa_3', 'sofa_l', 'kitchen_counter', 'fridge', 'dining_set', 'dining_4', 'toilet', 'wash_basin', 'shower', 'desk', 'office_chair', 'gaming_desk', 'gaming_chair', 'crib', 'treadmill', 'pooja_unit', 'closet_rack', 'washing_machine', 'tv_unit']);
function deeperCuts(room) {
  const out = [], c = roomCost(room);
  c.items.filter(x => !ESSENTIAL.has(x.it.type)).forEach(x => out.push({ what: `Skip ${CATALOG[x.it.type].label.toLowerCase()} for now`, save: x.p, apply: () => { room.furniture.splice(room.furniture.indexOf(x.it), 1); } }));
  if (!room.floorKeep && c.flooring > 0) out.push({ what: 'Keep the existing flooring', save: c.flooring, apply: () => { room.floorKeep = true; } });
  room.furniture.filter(i => CATALOG[i.type].perW && i.w > 1.25).forEach(i => { const cc = CATALOG[i.type]; const p = cc.price[TIER_IX[i.tier]]; out.push({ what: `Smaller ${cc.label.toLowerCase()} (${i.w} → 1.2 m)`, save: p * (i.w - 1.2) / cc.w, apply: () => { i.w = 1.2; } }); });
  if (c.curtains) out.push({ what: 'Postpone curtains', save: c.curtains, apply: () => { room.curtains = false; } });
  if (room.lights?.task) out.push({ what: 'Skip task lighting', save: LIGHT_COST.task * [0.8, 1, 1.7][TIER_IX[room.tier || 'standard']], apply: () => { room.lights.task = false; } });
  if (roomCeiling(room) !== 'flat') out.push({ what: 'No false ceiling', save: c.ceiling, apply: () => { room.ceiling = 'flat'; } });
  return out.filter(o => o.save > 50);
}
function optimizeBudget(rooms, amount) {
  const steps = []; const cost = () => rooms.reduce((s, r) => s + roomCost(r).total, 0);
  const start = cost(); let guard = 0;
  while (cost() > amount && guard++ < 120) {
    const gap = cost() - amount;
    let alts = rooms.flatMap(r => cheaperAlternatives(r).map(a => Object.assign(a, { room: r })));
    if (!alts.length) alts = rooms.flatMap(r => deeperCuts(r).map(a => Object.assign(a, { room: r })));
    if (!alts.length) break;
    // prefer the smallest single change that closes the gap, else the biggest saving
    const closing = alts.filter(a => a.save >= gap).sort((a, b) => a.save - b.save);
    const a = closing[0] || alts.sort((x, y) => y.save - x.save)[0];
    a.apply(); steps.push(`${a.room.name}: ${a.what} (saves ${inr(a.save)})`);
  }
  return { start, end: cost(), steps, ok: cost() <= amount };
}

/* ---------- space analyzer ---------- */
const CLEAR_REQ = { bed_double: 0.6, bed_single: 0.6, bunk_bed: 0.6, wardrobe: 0.75, desk: 0.75, dresser: 0.7, kitchen_counter: 1.0, fridge: 0.9, toilet: 0.55, wash_basin: 0.7, bookshelf: 0.6, storage_cabinet: 0.7, closet_rack: 0.75, tv_unit: 1.5, sofa_3: 0.35, sofa_l: 0.35, gaming_desk: 0.75, shoe_rack: 0.6, washing_machine: 0.7, treadmill: 0.6 };
function analyzeSpace(room, floor = floorOfRoom(room)) {
  const cs = 0.1, nx = Math.max(1, Math.round(room.w / cs)), ny = Math.max(1, Math.round(room.d / cs));
  const g = new Uint8Array(nx * ny); const cellRect = (i, j) => ({ x: room.x + i * cs, y: room.y + j * cs, w: cs, d: cs });
  const mark = (rc, v) => { const i0 = Math.max(0, Math.floor((rc.x - room.x) / cs)), i1 = Math.min(nx, Math.ceil((rc.x + rc.w - room.x) / cs)), j0 = Math.max(0, Math.floor((rc.y - room.y) / cs)), j1 = Math.min(ny, Math.ceil((rc.y + rc.d - room.y) / cs)); for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) if (!g[j * nx + i] || v === 1) g[j * nx + i] = v; };
  const solid = room.furniture.filter(it => !CATALOG[it.type]?.flat);
  solid.forEach(it => mark(itemFootprint(it), 1));
  const doors = roomOpenings(room, floor).filter(o => o.kind === 'door');
  doors.forEach(o => mark(doorSwingRect(room, o), 2));
  const fpArea = solid.reduce((s, it) => s + Math.min(area(room), it.w * it.d), 0);
  const coverage = fpArea / area(room);
  // clearance per item
  const issues = [], clear = [];
  solid.forEach(it => {
    const req = CLEAR_REQ[it.type]; if (!req) return;
    const f = frontVec(it.rot); const r = rightVec(it.rot); let dist = 0, blocked = null;
    for (let s = 0.05; s < 3; s += 0.05) {
      const pts = [-0.35, 0, 0.35].map(k => [it.x + f[0] * (it.d / 2 + s) + r[0] * k * it.w, it.y + f[1] * (it.d / 2 + s) + r[1] * k * it.w]);
      if (pts.some(p => !inRoom(room, p[0], p[1], -0.01))) { blocked = 'wall'; break; }
      const hit = solid.find(o => o !== it && !(it.type.includes('desk') && /chair/.test(o.type)) && pts.some(p => { const fp = itemFootprint(o); return p[0] > fp.x && p[0] < fp.x + fp.w && p[1] > fp.y && p[1] < fp.y + fp.d; }));
      if (hit) { blocked = CATALOG[hit.type].label; break; }
      dist = s;
    }
    clear.push({ it, dist: r2(dist), req, ok: dist + 0.001 >= req, blocked });
    if (dist + 0.001 < req) issues.push(`${CATALOG[it.type].label} has only ${dist.toFixed(2)} m in front (needs ${req} m${blocked ? ', blocked by ' + blocked.toLowerCase() : ''}).`);
  });
  // door swing conflicts
  doors.forEach(o => { const sw = doorSwingRect(room, o); solid.forEach(it => { if (rectOverlap(sw, itemFootprint(it)) > 0.02) issues.push(`${CATALOG[it.type].label} blocks the door swing.`); }); });
  // overlapping furniture
  for (let a = 0; a < solid.length; a++) for (let b = a + 1; b < solid.length; b++) { const A = solid[a], Bq = solid[b]; if (/chair/.test(A.type + Bq.type) && /desk|dining/.test(A.type + Bq.type)) continue; if (rectOverlap(itemFootprint(A), itemFootprint(Bq)) > 0.03) issues.push(`${CATALOG[A.type].label} overlaps ${CATALOG[Bq.type].label}.`); }
  solid.forEach(it => { if (!rectInRoom(itemFootprint(it), room, 0.05)) issues.push(`${CATALOG[it.type].label} sticks out of the room.`); });
  // walkable area: free cells with distance >= 0.3 from obstacles/walls
  const dist = new Float32Array(nx * ny).fill(1e9); const q = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; if (g[k] === 1) { dist[k] = 0; q.push(k); } else if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) { dist[k] = 1; q.push(k); } }
  for (let h = 0; h < q.length; h++) { const k = q[h], i = k % nx, j = (k / nx) | 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) return; const kk = jj * nx + ii; if (dist[kk] > dist[k] + 1) { dist[kk] = dist[k] + 1; q.push(kk); } }); }
  let free = 0, walk = 0; for (let k = 0; k < g.length; k++) if (g[k] !== 1) { free++; if (dist[k] * cs >= 0.3) walk++; }
  const walkable = free ? walk / g.length : 0;
  // unused corner detection
  const zone = new Uint8Array(nx * ny); for (let k = 0; k < g.length; k++) zone[k] = g[k] ? 1 : 0;
  solid.forEach(it => { const req = Math.min(0.7, CLEAR_REQ[it.type] || 0.5); const f = frontVec(it.rot), fp = itemFootprint(it); const ex = { x: fp.x + Math.min(0, f[0]) * req, y: fp.y + Math.min(0, f[1]) * req, w: fp.w + Math.abs(f[0]) * req, d: fp.d + Math.abs(f[1]) * req }; const i0 = Math.max(0, Math.floor((ex.x - room.x) / cs)), i1 = Math.min(nx, Math.ceil((ex.x + ex.w - room.x) / cs)), j0 = Math.max(0, Math.floor((ex.y - room.y) / cs)), j1 = Math.min(ny, Math.ceil((ex.y + ex.d - room.y) / cs)); for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) zone[j * nx + i] = 1; });
  const freeRect = (i0, j0, w, h) => { if (i0 < 0 || j0 < 0 || i0 + w > nx || j0 + h > ny) return false; for (let j = j0; j < j0 + h; j++) for (let i = i0; i < i0 + w; i++) if (zone[j * nx + i]) return false; return true; };
  let corner = null;
  if (!['bathroom', 'hall', 'utility', 'kitchen'].includes(room.type) && area(room) > 5) {
    [[0, 0, 1, 1], [1, 0, -1, 1], [0, 1, 1, -1], [1, 1, -1, -1]].forEach(([cx, cy, sx, sy]) => {
      for (let w = 8; w <= Math.min(22, nx); w++) for (let h = 8; h <= Math.min(22, ny); h++) {
        const i0 = cx ? nx - w : 0, j0 = cy ? ny - h : 0;
        if (freeRect(i0, j0, w, h)) { const a = w * h * cs * cs; if (!corner || a > corner.area) corner = { x: room.x + i0 * cs, y: room.y + j0 * cs, w: w * cs, d: h * cs, area: a, cx, cy }; }
      }
    });
    if (corner && corner.area < 1.0) corner = null;
  }
  const type = ROOM_TYPES[room.type]; const minA = type.min;
  const status = room.type === 'bathroom' || room.type === 'kitchen' || room.type === 'closet' ? (coverage > 0.7 ? 'Overcrowded' : 'Balanced') : coverage < 0.16 ? 'Underused' : coverage > 0.52 ? 'Overcrowded' : 'Balanced';
  let score = 100 - issues.length * 10 - (status === 'Overcrowded' ? 15 : status === 'Underused' ? 8 : 0) - (area(room) < minA ? 10 : 0) - (corner ? 5 : 0) - (walkable < 0.25 && room.type !== 'bathroom' ? 8 : 0);
  score = clamp(Math.round(score), 5, 100);
  const sizeNote = area(room) < minA ? `Below the recommended ${minA} m² for a ${type.label.toLowerCase()} — keep furniture compact.` : `Meets the recommended minimum of ${minA} m² for a ${type.label.toLowerCase()}.`;
  const purpose = suggestPurposes(room);
  return { coverage, walkable, issues: [...new Set(issues)], clear, corner, status, score, sizeNote, purpose, grid: { nx, ny, cs, g, zone } };
}
function suggestPurposes(room) {
  const A = area(room);
  if (A < 3) return ['pooja', 'closet', 'utility'];
  if (A < 6.5) return ['closet', 'reading', 'study', 'pooja'];
  if (A < 9.5) return ['study', 'office', 'nursery', 'reading'];
  return ['guest', 'office', 'gaming', 'gym'];
}
function storageReport() {
  const have = allRooms().reduce((s, r) => s + r.furniture.reduce((a, it) => a + (CATALOG[it.type].storage || 0) * (it.w / CATALOG[it.type].w), 0), 0);
  const need = S.prefs.family * 0.9 + ({ low: 0, medium: 0.8, high: 2 }[S.prefs.storage] || 0.8) + (S.prefs.kids ? 1 : 0);
  const tips = [];
  if (have < need) tips.push(`Add about ${r2(need - have)} m³ of storage: loft cabinets above wardrobes, hydraulic storage beds, or a ceiling-high shoe cabinet near the entrance.`);
  else tips.push('Storage capacity matches your household. Use loft space for seasonal items.');
  if (S.prefs.kids) tips.push('Use low open shelves in kids’ rooms so toys are reachable.');
  return { have: r2(have), need: r2(need), tips };
}
function fitCheck(type, room, floor = floorOfRoom(room), dims) {
  const c = CATALOG[type]; const w = dims?.w || c.w, d = dims?.d || c.d;
  const save = room.furniture.slice();
  let it = null;
  for (const s of SIDES) { it = placeOnWall(room, floor, type, s, { w, d }); if (it) break; }
  if (!it) { it = placeFree(room, floor, type); if (it) { it.w = w; it.d = d; } }
  room.furniture = save;
  if (!it) return { ok: false, msg: `${c.label} (${w}×${d} m) does not fit in ${room.name} with current furniture and door clearances.` };
  const longest = Math.max(room.w, room.d);
  return { ok: true, item: it, msg: `${c.label} (${w}×${d} m) fits in ${room.name}. Best spot: against the ${['north', 'east', 'south', 'west'][[0, 270, 180, 90].indexOf(it.rot)] || 'centre'} wall, keeping ${CLEAR_REQ[type] || 0.6} m clearance.${w > longest ? ' (diagonal fit only)' : ''}` };
}

/* ---------- light & ventilation ---------- */
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function sideCompass(side) { const ang = { N: 0, E: 90, S: 180, W: 270 }[side]; const a = ((ang + (S.project.north || 0)) % 360 + 360) % 360; return { deg: a, label: COMPASS[Math.round(a / 45) % 8] }; }
function sunAz(hour) { return 90 + (hour - 6) * 15; } // 6h → E(90) 12h → S(180) 18h → W(270)
function analyzeLight(room, floor = floorOfRoom(room)) {
  const ops = roomOpenings(room, floor); const wins = ops.filter(o => o.kind === 'window' && o.ext);
  const winA = wins.reduce((s, o) => s + o.w * o.ref.h, 0); const wfr = winA / area(room);
  const rating = wfr >= 0.15 ? 'Excellent' : wfr >= 0.1 ? 'Good' : wfr >= 0.05 ? 'Limited' : wfr > 0 ? 'Poor' : 'No daylight';
  const dirs = [...new Set(wins.map(o => sideCompass(o.side).label))];
  const notes = [];
  dirs.forEach(d => {
    if (d.includes('E')) notes.push(`${d}-facing window: soft morning sun — good for waking up and breakfast spaces.`);
    if (d.includes('W')) notes.push(`${d}-facing window: harsh afternoon sun and heat — use blackout or thermal curtains and cooler wall colours.`);
    if (d === 'S' || d === 'SE' || d === 'SW') notes.push(`${d}-facing: bright, strong light for most of the day (India); add a chajja/overhang or sheers to cut glare.`);
    if (d === 'N' || d === 'NE' || d === 'NW') notes.push(`${d}-facing: steady, diffused daylight — ideal for a study or studio, little heat gain.`);
  });
  const sides = [...new Set(wins.map(o => o.side))];
  const opposite = sides.some(s => sides.includes(OPP[s]));
  const ventDoorExt = ops.some(o => o.kind === 'door' && isExteriorPoint(floor, o.ref.o, o.ref.o === 'h' ? o.ref.y : o.ref.x, o.ref.o === 'h' ? o.ref.x : o.ref.y));
  const vent = opposite ? 'Excellent cross-ventilation' : sides.length >= 2 ? 'Good (adjacent walls)' : (sides.length === 1 && (ops.some(o => o.kind === 'door') || ventDoorExt)) ? 'Fair (single-sided)' : 'Poor';
  const sugg = [];
  if (['bathroom', 'kitchen', 'utility'].includes(room.type) && !wins.length) sugg.push('No exterior window — install an exhaust fan or duct to vent moisture and cooking fumes.');
  if (room.type === 'kitchen' && wins.length) sugg.push('Place the hob near the window and add a chimney for smoke extraction.');
  if (vent === 'Poor' || vent.startsWith('Fair')) sugg.push('Keep internal doors open or add a ventilator above the door to improve airflow.');
  if (rating === 'Limited' || rating === 'Poor' || rating === 'No daylight') sugg.push('Use light, reflective wall colours and mirrors opposite windows to bounce daylight deeper.');
  // window suggestion
  let suggestWindow = null;
  if (['Limited', 'Poor', 'No daylight'].includes(rating) || (!opposite && sides.length < 2 && !['bathroom', 'hall', 'closet', 'utility'].includes(room.type))) {
    const cand = [['h', room.y, room.x, room.x + room.w, 'N'], ['h', room.y + room.d, room.x, room.x + room.w, 'S'], ['v', room.x, room.y, room.y + room.d, 'W'], ['v', room.x + room.w, room.y, room.y + room.d, 'E']]
      .filter(([o, c, a, b, s]) => b - a >= 1.3 && !sides.includes(s) && isExteriorPoint(floor, o, c, (a + b) / 2) && !ops.some(op => op.side === s && op.kind === 'door' && Math.abs(op.t - (a + b) / 2) < 1))
      .sort((p, q) => (sides.includes(OPP[q[4]]) ? 1 : 0) - (sides.includes(OPP[p[4]]) ? 1 : 0));
    if (cand.length) { const [o, c, a, b, s] = cand[0]; const t = (a + b) / 2; suggestWindow = { side: s, compass: sideCompass(s).label, w: { o, x: o === 'h' ? t : c, y: o === 'h' ? c : t, w: r2(Math.min(1.5, b - a - 0.6)), sill: room.type === 'bathroom' ? 1.5 : 0.9, h: room.type === 'bathroom' ? 0.6 : 1.25 } }; sugg.push(`Add a window on the ${suggestWindow.compass} wall for ${sides.includes(OPP[s]) ? 'cross-ventilation' : 'more daylight'}.`); }
  }
  const score = clamp(Math.round((Math.min(wfr, 0.2) / 0.2) * 70 + (opposite ? 30 : sides.length >= 2 ? 22 : sides.length ? 10 : 0)), 0, 100);
  return { wins, winA: r2(winA), wfr, rating, dirs, notes, vent, sugg, suggestWindow, score };
}
function lightAt(floor, x, y, hour) {
  const room = roomAt(x, y, floor); if (!room) return 0;
  const az = sunAz(hour); const up = hour > 6 && hour < 18.5;
  let I = 0.05;
  roomOpenings(room, floor).filter(o => o.kind === 'window' && o.ext).forEach(o => {
    const wp = o.side === 'N' || o.side === 'S' ? [o.t, o.side === 'N' ? room.y : room.y + room.d] : [o.side === 'W' ? room.x : room.x + room.w, o.t];
    const d = Math.hypot(x - wp[0], y - wp[1]);
    const sd = sideCompass(o.side).deg; let diff = Math.abs(((az - sd) % 360 + 540) % 360 - 180);
    const sunF = up ? (diff < 90 ? 0.6 + 0.9 * Math.cos(diff * Math.PI / 180) : 0.55) : 0.1;
    I += (o.w * o.ref.h) * sunF / (1 + d * d * 0.55);
  });
  return Math.min(1, I / 1.6);
}

/* ---------- architecture checks ---------- */
function archChecks(floor = FL()) {
  const out = [], R = floor.rooms;
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) { const o = rectOverlap(R[i], R[j]); if (o > 0.05) out.push({ lv: 'warn', t: 'Overlapping rooms', d: `${R[i].name} and ${R[j].name} overlap by ${r2(o)} m².`, fix: 'snap' }); }
  let mis = 0; for (let i = 0; i < R.length; i++) for (let j = 0; j < R.length; j++) { if (i === j) continue; const a = R[i], b = R[j]; const gx = b.x - (a.x + a.w), gy = b.y - (a.y + a.d); const oy = Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y), ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x); if ((gx > 0.03 && gx < 0.3 && oy > 0.5) || (gy > 0.03 && gy < 0.3 && ox > 0.5)) mis++; }
  if (mis) out.push({ lv: 'warn', t: 'Misaligned walls', d: `${mis} wall pair(s) have small gaps (3–30 cm) — likely detection noise or drafting errors.`, fix: 'snap' });
  const con = connectivity(floor);
  con.unreachable.forEach(r => out.push({ lv: 'warn', t: 'Unreachable room', d: `${r.name} has no door connecting it to the rest of the home.`, fix: 'doors' }));
  const bedT = ['bedroom', 'master', 'guest'];
  if (con.start) R.forEach(r => {
    if (bedT.includes(r.type) || ['bathroom', 'balcony', 'closet', 'study'].includes(r.type) || con.unreachable.includes(r)) return;
    const seen = new Set([con.start.id]), q = [con.start.id]; while (q.length) { const id = q.shift(); const rr = findRoom(id); if (rr !== con.start && bedT.includes(rr.type)) continue; (con.adj.get(id) || []).forEach(n => { if (!seen.has(n)) { seen.add(n); q.push(n); } }); }
    if (!seen.has(r.id)) out.push({ lv: 'warn', t: 'Circulation through a bedroom', d: `${r.name} can only be reached by walking through a bedroom — consider a passage door.` });
  });
  R.forEach(r => roomOpenings(r, floor).filter(o => o.kind === 'door').forEach(o => { const sw = doorSwingRect(r, o); r.furniture.filter(it => !CATALOG[it.type].flat).forEach(it => { if (rectOverlap(sw, itemFootprint(it)) > 0.02) out.push({ lv: 'warn', t: 'Door clearance', d: `In ${r.name}, the ${CATALOG[it.type].label.toLowerCase()} blocks the ${o.w} m door swing.` }); }); }));
  floor.doors.forEach(d => { if (d.main && d.w < 0.95) out.push({ lv: 'info', t: 'Narrow main door', d: `Main door is ${d.w} m; 1.0 m+ is recommended for moving furniture.` }); });
  R.forEach(r => { const m = Math.min(r.w, r.d); if (['bedroom', 'master', 'living', 'guest'].includes(r.type) && (area(r) < 9.5 || m < 2.4)) out.push({ lv: 'info', t: 'Habitable room size', d: `${r.name} is ${r2(area(r))} m² (min side ${r2(m)} m). Many Indian building bye-laws expect ≥ 9.5 m² with a 2.4 m minimum width for habitable rooms.` }); });
  R.forEach(r => { if (r.type === 'kitchen' && area(r) < 5) out.push({ lv: 'info', t: 'Kitchen size', d: `${r.name} is under the commonly required 5 m².` }); if (r.type === 'bathroom' && area(r) < 1.8) out.push({ lv: 'info', t: 'Bathroom size', d: `${r.name} is under 1.8 m².` }); });
  const wt = S.project.wallThickness; out.push({ lv: 'info', t: 'Wall thickness estimate', d: wt ? `Detected ≈ ${wt.ext} m on outer walls (${wt.ext >= 0.2 ? '9-inch brick, likely load-bearing' : '4.5-inch / block'}) and ≈ ${wt.int} m on partitions, from the plan's scale.` : 'No scale data from the plan; DIMORA assumes 230 mm external and 115 mm internal walls.' });
  S.structuralLog.slice(-4).forEach(s => out.push({ lv: 'warn', t: 'Structural review', d: s }));
  if (S.project.floors.length > 1) { const hasStairs = S.project.floors.some(f => f.stairs && f.stairs.length); out.push({ lv: hasStairs ? 'ok' : 'warn', t: 'Multi-storey', d: `${S.project.floors.length} floors. ${hasStairs ? 'Staircase connects the levels.' : 'No staircase placed yet.'}` }); }
  if (!out.some(o => o.lv === 'warn')) out.unshift({ lv: 'ok', t: 'Layout validated', d: 'No overlapping rooms, unreachable spaces or blocked doors found.' });
  return out;
}

/* ---------- AI interior designer helpers ---------- */
function mixHex(a, b, t) { const A = hexToRgb(a), Bc = hexToRgb(b); return rgbToHex(A[0] + (Bc[0] - A[0]) * t, A[1] + (Bc[1] - A[1]) * t, A[2] + (Bc[2] - A[2]) * t); }
function paintSuggestions(room) {
  const L = analyzeLight(room); const hot = L.dirs.some(d => d.includes('W') || d === 'S' || d === 'SW'); const dim = ['Limited', 'Poor', 'No daylight'].includes(L.rating);
  const base = {
    bedroom: [['Sage Mist', '#b9c7ae', 'Calming green lowers visual noise before sleep'], ['Powder Blue', '#c5d6e3', 'Cool and restful'], ['Greige', '#d2c9bb', 'Warm neutral that suits any bedding'], ['Lavender Haze', '#d4cbe2', 'Soft and relaxing']],
    living: [['Warm Linen', '#e9dfcc', 'Versatile neutral that flatters wood and fabrics'], ['Terracotta Blush', '#e2b9a2', 'Earthy warmth for gatherings'], ['Stone Grey', '#cfccc5', 'Modern backdrop for art'], ['Olive Accent', '#a9ad86', 'Great as a single feature wall']],
    kitchen: [['Butter Cream', '#f1e3bd', 'Cheerful and hides stains'], ['Mint Fresh', '#cfe5d6', 'Clean, hygienic feel'], ['Soft White', '#f2efe8', 'Maximises brightness'], ['Mustard Pop', '#e1bf6a', 'Energetic accent for a backsplash wall']],
    bathroom: [['Aqua Spa', '#cfe6e6', 'Spa-like and fresh'], ['Bright White', '#f5f5f2', 'Crisp and clean'], ['Pebble Grey', '#d3d3cf', 'Hides water marks'], ['Sea Glass', '#b9d6cf', 'Calm, watery tone']],
  };
  const fam = { master: 'bedroom', guest: 'bedroom', nursery: 'bedroom', dining: 'living', hall: 'living', study: 'study', office: 'study', reading: 'study', utility: 'bathroom', balcony: 'living', closet: 'bedroom', gym: 'study', pooja: 'living' };
  base.study = [['Focus Blue', '#b8c9da', 'Blue tones support concentration'], ['Sage Study', '#c3cfb5', 'Easy on the eyes for long hours'], ['Chalk White', '#f1efea', 'Maximum brightness on screens'], ['Deep Teal', '#4f7f80', 'Bold feature wall behind the desk']];
  base.gaming = [['Midnight Navy', '#2f3d5a', 'Reduces screen glare and makes RGB pop'], ['Charcoal', '#4a4b4f', 'Immersive, cinema-like'], ['Deep Plum', '#5a3d5c', 'Moody and dramatic'], ['Slate', '#6e7a86', 'Softer dark option']];
  let list = (base[room.type] || base[fam[room.type]] || base.living).map(([n, h, w]) => ({ name: n, hex: h, why: w }));
  if (hot) list.sort((a, b) => coolness(b.hex) - coolness(a.hex)), list[0].why += ' — cool tone offsets hot afternoon/south sun';
  if (dim) list = list.map(s => ({ ...s, hex: mixHex(s.hex, '#ffffff', 0.25) })), list[0].why += ' — lightened because this room gets limited daylight';
  (S.prefs.colors || []).slice(0, 1).forEach(c => list.splice(1, 0, { name: 'Your favourite (wall-ready)', hex: mixHex(c, '#f5f2ec', 0.55), why: 'Your preferred colour softened for full-wall use' }));
  return list.slice(0, 4);
}
function coolness(h) { const [r, g, b] = hexToRgb(h); return b - r; }
function lightingAdvice(room) {
  const t = room.type; const A = area(room);
  const ambient = `${Math.max(2, Math.round(A / 2.5))} × 12W LED panels/downlights (≈${Math.round(A * 150)} lumens for ${r2(A)} m²)`;
  const task = { kitchen: 'Under-cabinet LED strips over the counter', study: 'Adjustable desk lamp (4000K)', office: 'Adjustable desk lamp + bias light behind monitor', bedroom: 'Bedside reading lamps', master: 'Bedside reading lamps + wardrobe sensor lights', living: 'Floor lamp beside the sofa for reading', bathroom: 'Mirror light above the basin', dining: 'Pendant over the dining table', gaming: 'RGB bias lighting behind the setup', reading: 'Floor lamp angled over the armchair' }[t] || 'Wall-mounted task light';
  const accent = { living: 'Cove LEDs + spotlights on art', master: 'Warm cove light in the false ceiling', dining: 'Statement pendant / chandelier', pooja: 'Warm backlight behind the mandir', gaming: 'RGB strips along shelves', bathroom: 'Niche lighting in shower' }[t] || 'Warm 2700K accent strip';
  return { ambient, task, accent, temp: ['kitchen', 'study', 'office', 'bathroom'].includes(t) ? '4000K neutral white' : '2700–3000K warm white' };
}
function ceilingAdvice(room, floor = floorOfRoom(room)) {
  const A = area(room), H = floor.height;
  if (['bathroom', 'utility', 'balcony', 'hall'].includes(room.type)) return { type: 'flat', why: 'Keep plain; use moisture-resistant grid/PVC panels if a false ceiling is needed.' };
  if (H < 2.8) return { type: 'peripheral', why: `Ceiling height ${H} m is low — a slim peripheral band preserves headroom.` };
  if (A > 14) return { type: 'tray', why: 'Large room with good height — a tray ceiling adds depth and hides AC ducts.' };
  return { type: 'cove', why: 'Cove lighting gives soft indirect glow without dropping the whole ceiling.' };
}
function decorAdvice(room) {
  const th = roomTheme(room), name = room.theme || P().theme;
  const m = { Japandi: ['Linen curtains in oat', 'Jute or wool flat-weave rug', 'Ceramic vases, bonsai, paper lantern'], Scandinavian: ['Sheer white curtains', 'Geometric wool rug', 'Pothos, sheepskin throw, line art'], Modern: ['Grey blackout curtains', 'Low-pile solid rug', 'Abstract canvas, sculptural lamp'], Minimalist: ['White roller blinds', 'Single neutral rug', 'One statement plant, no clutter'], Industrial: ['Charcoal canvas curtains', 'Distressed vintage rug', 'Edison bulbs, metal frames'], 'Indian Contemporary': ['Mustard silk-blend curtains', 'Dhurrie or kilim rug', 'Brass urli, Madhubani art, diyas'], Luxury: ['Velvet drapes with sheers', 'Hand-tufted silk rug', 'Gold mirror, crystal decor'], Bohemian: ['Printed cotton curtains', 'Layered kilim rugs', 'Macramé, rattan, trailing plants'] }[name] || ['Linen curtains', 'Neutral rug', 'Plants and art'];
  return { curtains: m[0], rug: m[1], decor: m[2], palette: [th.walls[0], th.wood, th.fabric, th.accent] };
}
function applyTheme(name, rooms) {
  if (!THEMES[name]) return false; const th = THEMES[name];
  if (!rooms) { S.project.theme = name; allRooms().forEach(r => { r.theme = null; r.wall = null; r.floor = null; r.ceiling = null; r.furniture.forEach(i => { i.color = null; i.finish = null; }); }); }
  else rooms.forEach(r => { r.theme = name; r.wall = null; r.floor = null; r.ceiling = null; r.furniture.forEach(i => { i.color = null; i.finish = null; }); });
  return true;
}
function transformRoom(room, to) {
  const before = roomCost(room).total; const oldType = room.type;
  room.type = to; const keepName = /bed ?room|room \d|empty/i.test(room.name) || ROOM_TYPES[oldType]?.label === room.name;
  if (keepName || true) room.name = ROOM_TYPES[to].label + (allRooms().filter(r => r.type === to && r !== room).length ? ' ' + (allRooms().filter(r => r.type === to).length) : '');
  room.wall = paintSuggestions(room)[0].hex; room.floor = null; room.ceiling = null;
  if (to === 'gym') room.floor = 'carpet';
  autoFurnish(room);
  return { before, after: roomCost(room).total, from: oldType };
}
