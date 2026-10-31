/* ===================== 2D PLAN EDITOR (SVG) ===================== */
const V2 = { x: -1, y: -1, s: 50, w: 800, h: 600, init: false };
let tool2d = 'select', pendingType = null, drag2 = null;
function fit2D() {
  const el = document.getElementById('plan2d'); if (!el) return; const b = homeBounds(FL());
  V2.w = el.clientWidth || 800; V2.h = el.clientHeight || 600;
  V2.s = Math.min((V2.w - 80) / (b.w + 1), (V2.h - 80) / (b.d + 1)); V2.x = b.x + b.w / 2 - V2.w / 2 / V2.s; V2.y = b.y + b.d / 2 - V2.h / 2 / V2.s; V2.init = true;
}
const toPlan = (px, py) => [V2.x + px / V2.s, V2.y + py / V2.s];
function setTool(t, type) { tool2d = t; pendingType = type || null; document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); const el = document.getElementById('plan2d'); if (el) el.dataset.tool = t; const hint = { select: 'Drag rooms, edges and furniture. Del deletes · R rotates.', room: 'Drag to draw a new room.', door: 'Click on a wall to add a door.', window: 'Click on an outside wall to add a window.', place: `Click inside a room to place: ${pendingType ? CATALOG[pendingType].label : ''}` }[t]; const h = document.getElementById('tool-hint'); if (h) h.textContent = hint || ''; }
function render2D() {
  const el = document.getElementById('plan2d'); if (!el || !S.project) return;
  if (!V2.init || el.clientWidth !== V2.w) { const keep = V2.init; const ow = V2.w, oh = V2.h; if (!keep) fit2D(); else { V2.w = el.clientWidth; V2.h = el.clientHeight; } }
  const f = FL(), s = V2.s; const X = x => (x - V2.x) * s, Y = y => (y - V2.y) * s;
  const out = [];
  const gs = 0.5 * s; const ox = -V2.x * s % gs, oy = -V2.y * s % gs;
  out.push(`<defs><pattern id="g" width="${gs}" height="${gs}" patternUnits="userSpaceOnUse" x="${ox}" y="${oy}"><path d="M ${gs} 0 L 0 0 0 ${gs}" fill="none" stroke="rgba(148,163,184,.07)" stroke-width="1"/></pattern>
  <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#ec4899" stroke-width="3" opacity=".5"/></pattern>
  <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#22d3ee"/></marker></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>`);
  // rooms
  f.rooms.forEach(r => {
    const sel = S.sel && S.sel.kind === 'room' && S.sel.id === r.id;
    out.push(`<rect x="${X(r.x)}" y="${Y(r.y)}" width="${r.w * s}" height="${r.d * s}" fill="${ROOM_TYPES[r.type].tint}" fill-opacity="${sel ? 0.3 : 0.13}" ${sel ? 'stroke="#a78bfa" stroke-width="2" stroke-dasharray="6 4"' : ''}/>`);
  });
  // heat overlay
  if (S.overlay === 'heat') { const cs = 0.25; f.rooms.forEach(r => { for (let x = r.x; x < r.x + r.w - 0.01; x += cs) for (let y = r.y; y < r.y + r.d - 0.01; y += cs) { const I = lightAt(f, x + cs / 2, y + cs / 2, S.hour); out.push(`<rect x="${X(x)}" y="${Y(y)}" width="${cs * s + 0.5}" height="${cs * s + 0.5}" fill="${I > 0.5 ? '#ffb300' : I > 0.25 ? '#ffd166' : '#5b6a8a'}" fill-opacity="${0.15 + I * 0.55}"/>`); } }); }
  // space overlay: unused corners & walkable
  if (S.overlay === 'space') f.rooms.forEach(r => { const a = analyzeSpace(r, f); if (a.corner) out.push(`<rect x="${X(a.corner.x)}" y="${Y(a.corner.y)}" width="${a.corner.w * s}" height="${a.corner.d * s}" fill="url(#hatch)" stroke="#ec4899" stroke-width="1.5"/><text x="${X(a.corner.x + a.corner.w / 2)}" y="${Y(a.corner.y + a.corner.d / 2)}" class="t-s" text-anchor="middle" fill="#f9a8d4">unused ${r2(a.corner.area)} m²</text>`); a.clear.filter(c => !c.ok).forEach(c => { const fp = itemFootprint(c.it); out.push(`<rect x="${X(fp.x)}" y="${Y(fp.y)}" width="${fp.w * s}" height="${fp.d * s}" fill="none" stroke="#ec4899" stroke-width="2.5"/>`); }); });
  // walls
  wallPieces(f).forEach(p => {
    const t = (p.ext ? 0.2 : 0.12) * s;
    if (p.kind === 'solid') { out.push(p.o === 'h' ? `<rect x="${X(p.a) - t / 2}" y="${Y(p.c) - t / 2}" width="${(p.b - p.a) * s + t}" height="${t}" fill="#cbd5e1"/>` : `<rect x="${X(p.c) - t / 2}" y="${Y(p.a) - t / 2}" width="${t}" height="${(p.b - p.a) * s + t}" fill="#cbd5e1"/>`); }
    else if (p.kind === 'sill') { const sel = S.sel && S.sel.kind === 'window' && S.sel.id === p.ref.id; const c = sel ? '#a78bfa' : '#22d3ee'; out.push(p.o === 'h' ? `<rect x="${X(p.a)}" y="${Y(p.c) - t / 2}" width="${(p.b - p.a) * s}" height="${t}" fill="rgba(6,182,212,.18)" stroke="${c}" stroke-width="1.5" data-win="${p.ref.id}"/><line x1="${X(p.a)}" y1="${Y(p.c)}" x2="${X(p.b)}" y2="${Y(p.c)}" stroke="${c}" stroke-width="1.5"/>` : `<rect x="${X(p.c) - t / 2}" y="${Y(p.a)}" width="${t}" height="${(p.b - p.a) * s}" fill="rgba(6,182,212,.18)" stroke="${c}" stroke-width="1.5"/><line x1="${X(p.c)}" y1="${Y(p.a)}" x2="${X(p.c)}" y2="${Y(p.b)}" stroke="${c}" stroke-width="1.5"/>`); }
  });
  f.doors.forEach(d => {
    const w = d.w * s, sel = S.sel && S.sel.kind === 'door' && S.sel.id === d.id; const c = sel ? '#a78bfa' : d.main ? '#f472b6' : '#94a3b8';
    if (d.o === 'h') { const hx = X(d.x - d.w / 2), hy = Y(d.y); out.push(`<path d="M ${hx} ${hy} L ${hx} ${hy + w} A ${w} ${w} 0 0 0 ${hx + w} ${hy}" fill="${sel ? 'rgba(124,58,237,.15)' : 'rgba(255,255,255,.03)'}" stroke="${c}" stroke-width="${d.main ? 2.2 : 1.4}"/>`); }
    else { const hx = X(d.x), hy = Y(d.y - d.w / 2); out.push(`<path d="M ${hx} ${hy} L ${hx + w} ${hy} A ${w} ${w} 0 0 1 ${hx} ${hy + w}" fill="${sel ? 'rgba(124,58,237,.15)' : 'rgba(255,255,255,.03)'}" stroke="${c}" stroke-width="${d.main ? 2.2 : 1.4}"/>`); }
    if (d.main) out.push(`<text x="${X(d.x)}" y="${Y(d.y) - (d.o === 'h' ? 8 : 0)}" class="t-s" text-anchor="middle" fill="#f472b6">ENTRY</text>`);
  });
  // furniture
  f.rooms.forEach(r => r.furniture.forEach(it => {
    const c = CATALOG[it.type]; const pal = palette(r, it); const sel = S.sel && S.sel.kind === 'item' && S.sel.id === it.id;
    const fill = c.flat ? pal.rug : '#1e293b';
    const W = it.w * s, D = it.d * s;
    out.push(`<g transform="translate(${X(it.x)} ${Y(it.y)}) rotate(${-it.rot})" class="furn${sel ? ' sel' : ''}">
      <rect x="${-W / 2}" y="${-D / 2}" width="${W}" height="${D}" rx="${Math.min(4, W / 6)}" fill="${fill}" fill-opacity="${c.flat ? 0.35 : 0.92}" stroke="${sel ? '#a78bfa' : '#64748b'}" stroke-width="${sel ? 2.2 : 1}"/>
      ${c.flat ? '' : `<rect x="${-W / 2}" y="${-D / 2}" width="${W}" height="${Math.max(2, D * 0.12)}" fill="${pal.wood}" opacity=".6"/>`}
      ${Math.min(W, D) > 16 ? `<text x="0" y="${Math.min(W, D) * 0.16}" text-anchor="middle" font-size="${Math.min(W, D) * 0.42}" transform="rotate(${it.rot})">${c.icon}</text>` : ''}</g>`);
  }));
  // stairs
  (f.stairs || []).forEach(st => { out.push(`<g transform="translate(${X(st.x)} ${Y(st.y)})"><rect x="${-st.w * s / 2}" y="${-st.d * s / 2}" width="${st.w * s}" height="${st.d * s}" fill="#1e293b" stroke="#64748b"/>${Array.from({ length: 12 }, (_, i) => `<line x1="${-st.w * s / 2}" x2="${st.w * s / 2}" y1="${-st.d * s / 2 + st.d * s * i / 12}" y2="${-st.d * s / 2 + st.d * s * i / 12}" stroke="#64748b" stroke-width=".7"/>`).join('')}<text y="4" text-anchor="middle" class="t-s">UP</text></g>`); });
  // airflow overlay
  if (S.overlay === 'air') f.rooms.forEach(r => { const ops = roomOpenings(r, f).filter(o => (o.kind === 'window' && o.ext) || o.kind === 'door'); const pt = o => o.side === 'N' || o.side === 'S' ? [o.t, o.side === 'N' ? r.y : r.y + r.d] : [o.side === 'W' ? r.x : r.x + r.w, o.t]; const wins = ops.filter(o => o.kind === 'window'); wins.forEach(w => { const targets = ops.filter(o => o !== w && o.side !== w.side); targets.slice(0, 2).forEach(o => { const a = pt(w), b = pt(o); const mx = (a[0] + b[0]) / 2 + (r.x + r.w / 2 - (a[0] + b[0]) / 2) * 0.5, my = (a[1] + b[1]) / 2 + (r.y + r.d / 2 - (a[1] + b[1]) / 2) * 0.5; out.push(`<path class="flow" d="M ${X(a[0])} ${Y(a[1])} Q ${X(mx)} ${Y(my)} ${X(b[0])} ${Y(b[1])}" fill="none" stroke="#22d3ee" stroke-width="${o.kind === 'window' ? 3 : 1.8}" stroke-dasharray="8 6" marker-end="url(#arr)" opacity=".85"/>`); }); if (!targets.length) out.push(`<circle cx="${X(pt(w)[0])}" cy="${Y(pt(w)[1])}" r="10" fill="none" stroke="#ec4899" stroke-width="2" stroke-dasharray="3 3"/>`); }); });
  // connectivity overlay
  if (S.overlay === 'graph') { const con = connectivity(f); f.rooms.forEach(a => (con.adj.get(a.id) || []).forEach(bid => { const b = findRoom(bid); if (a.id < bid) out.push(`<line x1="${X(a.x + a.w / 2)}" y1="${Y(a.y + a.d / 2)}" x2="${X(b.x + b.w / 2)}" y2="${Y(b.y + b.d / 2)}" stroke="#10b981" stroke-width="3" opacity=".7"/>`); })); f.rooms.forEach(a => out.push(`<circle cx="${X(a.x + a.w / 2)}" cy="${Y(a.y + a.d / 2)}" r="9" fill="${con.unreachable.includes(a) ? '#ec4899' : a === con.start ? '#8b5cf6' : '#10b981'}" stroke="#0b0f19" stroke-width="2"/>`)); }
  // labels
  f.rooms.forEach(r => { const fs = clamp(Math.min(r.w, r.d) * s * 0.14, 9, 15); out.push(`<g class="rlabel" transform="translate(${X(r.x + r.w / 2)} ${Y(r.y + r.d / 2)})"><text text-anchor="middle" font-size="${fs}" font-weight="700" fill="#f8fafc" y="${-fs * 0.2}">${esc(r.name)}</text><text text-anchor="middle" font-size="${fs * 0.78}" fill="#94a3b8" y="${fs}">${r.w} × ${r.d} m · ${r2(area(r))} m²</text></g>`); });
  // selection extras
  if (S.sel && S.sel.kind === 'room') { const r = findRoom(S.sel.id); if (r && f.rooms.includes(r)) {
    const hs = 7; [['n', r.x + r.w / 2, r.y], ['s', r.x + r.w / 2, r.y + r.d], ['w', r.x, r.y + r.d / 2], ['e', r.x + r.w, r.y + r.d / 2]].forEach(([k, x, y]) => out.push(`<rect class="handle" data-h="${k}" x="${X(x) - hs}" y="${Y(y) - hs}" width="${hs * 2}" height="${hs * 2}" rx="3"/>`));
    out.push(`<g class="dim"><line x1="${X(r.x)}" y1="${Y(r.y) - 18}" x2="${X(r.x + r.w)}" y2="${Y(r.y) - 18}"/><text x="${X(r.x + r.w / 2)}" y="${Y(r.y) - 23}" text-anchor="middle">${r.w} m</text><line x1="${X(r.x) - 18}" y1="${Y(r.y)}" x2="${X(r.x) - 18}" y2="${Y(r.y + r.d)}"/><text transform="translate(${X(r.x) - 23} ${Y(r.y + r.d / 2)}) rotate(-90)" text-anchor="middle">${r.d} m</text></g>`);
  } }
  if (drag2 && drag2.kind === 'draw') { const a = drag2.a, b = drag2.b; out.push(`<rect x="${X(Math.min(a[0], b[0]))}" y="${Y(Math.min(a[1], b[1]))}" width="${Math.abs(b[0] - a[0]) * s}" height="${Math.abs(b[1] - a[1]) * s}" fill="rgba(124,58,237,.15)" stroke="#a78bfa" stroke-width="2" stroke-dasharray="6 4"/><text x="${X((a[0] + b[0]) / 2)}" y="${Y((a[1] + b[1]) / 2)}" text-anchor="middle" class="t-s">${r2(Math.abs(b[0] - a[0]))} × ${r2(Math.abs(b[1] - a[1]))} m</text>`); }
  // north arrow & scale bar
  out.push(`<g transform="translate(${V2.w - 46} 46) rotate(${S.project.north || 0})"><circle r="20" fill="#111827" stroke="rgba(255,255,255,.15)"/><path d="M0,-15 L6,6 L0,2 L-6,6 z" fill="#a78bfa"/><text y="-22" text-anchor="middle" class="t-s" font-weight="700">N</text></g>`);
  out.push(`<g transform="translate(20 ${V2.h - 22})"><rect width="${s}" height="5" fill="#cbd5e1"/><rect x="${s}" width="${s}" height="5" fill="#0b0f19" stroke="#cbd5e1"/><text y="-5" class="t-s">0</text><text x="${s * 2}" y="-5" class="t-s" text-anchor="end">2 m</text></g>`);
  el.innerHTML = `<svg width="${V2.w}" height="${V2.h}" xmlns="http://www.w3.org/2000/svg">${out.join('')}</svg>`;
}
function hit2D(p) {
  const f = FL();
  if (S.sel && S.sel.kind === 'room') { const r = findRoom(S.sel.id); if (r) { const hs = 10 / V2.s; for (const [k, x, y] of [['n', r.x + r.w / 2, r.y], ['s', r.x + r.w / 2, r.y + r.d], ['w', r.x, r.y + r.d / 2], ['e', r.x + r.w, r.y + r.d / 2]]) if (Math.abs(p[0] - x) < hs && Math.abs(p[1] - y) < hs) return { kind: 'handle', h: k, room: r }; } }
  let items = []; f.rooms.forEach(r => r.furniture.forEach(it => { const fp = itemFootprint(it); if (p[0] >= fp.x && p[0] <= fp.x + fp.w && p[1] >= fp.y && p[1] <= fp.y + fp.d) items.push({ it, r, a: fp.w * fp.d, flat: CATALOG[it.type].flat }); }));
  items.sort((a, b) => (a.flat - b.flat) || a.a - b.a); if (items.length) return { kind: 'item', it: items[0].it, room: items[0].r };
  const tol = 0.25;
  for (const d of f.doors) { if ((d.o === 'h' && Math.abs(p[1] - d.y) < tol && Math.abs(p[0] - d.x) < d.w / 2) || (d.o === 'v' && Math.abs(p[0] - d.x) < tol && Math.abs(p[1] - d.y) < d.w / 2)) return { kind: 'door', d }; }
  for (const w of f.windows) { if ((w.o === 'h' && Math.abs(p[1] - w.y) < tol && Math.abs(p[0] - w.x) < w.w / 2) || (w.o === 'v' && Math.abs(p[0] - w.x) < tol && Math.abs(p[1] - w.y) < w.w / 2)) return { kind: 'window', w }; }
  const r = roomAt(p[0], p[1], f); if (r) return { kind: 'room', room: r };
  return null;
}
function nearestWall(p, f = FL()) { let best = null; wallLines(f).forEach(L => { const t = clamp(L.o === 'h' ? p[0] : p[1], L.a, L.b); const d = L.o === 'h' ? Math.hypot(p[0] - t, p[1] - L.c) : Math.hypot(p[0] - L.c, p[1] - t); if (d < 0.45 && (!best || d < best.d)) best = { d, L, t }; }); return best; }
function edgeSnap(v, axis, except) { let best = null; FL().rooms.forEach(r => { if (r === except) return; (axis === 'x' ? [r.x, r.x + r.w] : [r.y, r.y + r.d]).forEach(e => { if (Math.abs(e - v) < 0.2 && (!best || Math.abs(e - v) < Math.abs(best - v))) best = e; }); }); return best != null ? best : snap(v); }
function init2D() {
  const el = document.getElementById('plan2d');
  el.addEventListener('pointerdown', e => {
    if (S.view !== '2d') return; el.setPointerCapture(e.pointerId);
    const rc = el.getBoundingClientRect(); const px = e.clientX - rc.left, py = e.clientY - rc.top; const p = toPlan(px, py);
    if (tool2d === 'room') { drag2 = { kind: 'draw', a: [snap(p[0]), snap(p[1])], b: [snap(p[0]), snap(p[1])] }; return; }
    if (tool2d === 'door' || tool2d === 'window') {
      const nw = nearestWall(p); if (!nw) { toast('Click closer to a wall'); return; }
      const L = nw.L; const w = tool2d === 'door' ? 0.9 : 1.2; if (L.b - L.a < w + 0.1) { toast('That wall segment is too short'); return; }
      const t = clamp(snap(nw.t), L.a + w / 2 + 0.05, L.b - w / 2 - 0.05);
      if (tool2d === 'window' && !isExteriorPoint(FL(), L.o, L.c, t)) { toast('Windows go on outside walls'); return; }
      commit('Add ' + tool2d);
      const o = { id: uid(tool2d[0]), o: L.o, x: L.o === 'h' ? t : L.c, y: L.o === 'h' ? L.c : t, w };
      if (tool2d === 'door') FL().doors.push(o); else FL().windows.push(Object.assign(o, { sill: 0.9, h: 1.25 }));
      S.sel = { kind: tool2d, id: o.id }; setTool('select'); rebuild(); renderInspector(); save(); return;
    }
    if (tool2d === 'place' && pendingType) {
      const r = roomAt(p[0], p[1]); if (!r) { toast('Click inside a room'); return; }
      commit('Place ' + CATALOG[pendingType].label); const it = makeItem(pendingType, r, { x: r2(snap(p[0])), y: r2(snap(p[1])) }); r.furniture.push(it);
      S.sel = { kind: 'item', id: it.id }; setTool('select'); rebuild(); renderInspector(); save(); return;
    }
    const h = hit2D(p);
    if (h && h.kind === 'handle') drag2 = { kind: 'resize', h: h.h, room: h.room, p0: p, r0: { ...h.room }, committed: false };
    else if (h && h.kind === 'item') { S.sel = { kind: 'item', id: h.it.id }; drag2 = { kind: 'item', it: h.it, room: h.room, off: [h.it.x - p[0], h.it.y - p[1]], committed: false, start: [h.it.x, h.it.y] }; }
    else if (h && h.kind === 'door') { S.sel = { kind: 'door', id: h.d.id }; drag2 = { kind: 'opening', o: h.d, committed: false }; }
    else if (h && h.kind === 'window') { S.sel = { kind: 'window', id: h.w.id }; drag2 = { kind: 'opening', o: h.w, committed: false }; }
    else if (h && h.kind === 'room') { S.sel = { kind: 'room', id: h.room.id }; drag2 = { kind: 'moveroom', room: h.room, p0: p, r0: { x: h.room.x, y: h.room.y }, committed: false }; }
    else { S.sel = null; drag2 = { kind: 'pan', px, py, x: V2.x, y: V2.y }; }
    selectApply(S.sel); renderInspector(); render2D();
  });
  el.addEventListener('pointermove', e => {
    if (!drag2) return; const rc = el.getBoundingClientRect(); const px = e.clientX - rc.left, py = e.clientY - rc.top; const p = toPlan(px, py);
    const once = label => { if (!drag2.committed) { commit(label); drag2.committed = true; } };
    if (drag2.kind === 'pan') { V2.x = drag2.x - (px - drag2.px) / V2.s; V2.y = drag2.y - (py - drag2.py) / V2.s; render2D(); return; }
    if (drag2.kind === 'draw') { drag2.b = [snap(p[0]), snap(p[1])]; render2D(); return; }
    if (drag2.kind === 'item') { once('Move furniture'); drag2.it.x = r2(snap(p[0] + drag2.off[0])); drag2.it.y = r2(snap(p[1] + drag2.off[1])); render2D(); return; }
    if (drag2.kind === 'opening') { const o = drag2.o; const nw = nearestWall(p); if (!nw) return; once('Move opening'); const L = nw.L; const t = clamp(snap(nw.t), L.a + o.w / 2 + 0.05, L.b - o.w / 2 - 0.05); o.o = L.o; o.x = L.o === 'h' ? t : L.c; o.y = L.o === 'h' ? L.c : t; render2D(); return; }
    if (drag2.kind === 'moveroom') {
      const r = drag2.room; const dx = snap(p[0] - drag2.p0[0]), dy = snap(p[1] - drag2.p0[1]); if (!drag2.committed && Math.abs(dx) + Math.abs(dy) < 0.05) return; once('Move room');
      const nx = edgeSnap(drag2.r0.x + dx, 'x', r), ny = edgeSnap(drag2.r0.y + dy, 'y', r); const mx = nx - r.x, my = ny - r.y;
      if (!drag2.ops) { const f = FL(); drag2.ops = [...f.doors, ...f.windows].filter(o => roomSideOf(r, o.o, o.x, o.y) && isExteriorPoint(f, o.o, o.o === 'h' ? o.y : o.x, o.o === 'h' ? o.x : o.y)); }
      r.x = r2(nx); r.y = r2(ny); r.furniture.forEach(it => { it.x = r2(it.x + mx); it.y = r2(it.y + my); }); drag2.ops.forEach(o => { o.x = r2(o.x + mx); o.y = r2(o.y + my); }); render2D(); return;
    }
    if (drag2.kind === 'resize') {
      const r = drag2.room, r0 = drag2.r0; once('Resize ' + r.name);
      if (!drag2.warned) { const f = FL(); const mid = drag2.h === 'n' ? ['h', r0.y, r0.x + r0.w / 2] : drag2.h === 's' ? ['h', r0.y + r0.d, r0.x + r0.w / 2] : drag2.h === 'w' ? ['v', r0.x, r0.y + r0.d / 2] : ['v', r0.x + r0.w, r0.y + r0.d / 2]; drag2.ext = isExteriorPoint(f, mid[0], mid[1], mid[2]); drag2.warned = true; }
      if (drag2.h === 'e') r.w = r2(Math.max(0.8, edgeSnap(p[0], 'x', r) - r.x));
      if (drag2.h === 's') r.d = r2(Math.max(0.8, edgeSnap(p[1], 'y', r) - r.y));
      if (drag2.h === 'w') { const nx = Math.min(edgeSnap(p[0], 'x', r), r0.x + r0.w - 0.8); r.w = r2(r0.x + r0.w - nx); r.x = r2(nx); }
      if (drag2.h === 'n') { const ny = Math.min(edgeSnap(p[1], 'y', r), r0.y + r0.d - 0.8); r.d = r2(r0.y + r0.d - ny); r.y = r2(ny); }
      render2D(); renderInspector(); return;
    }
  });
  el.addEventListener('pointerup', () => {
    if (!drag2) return; const d = drag2; drag2 = null;
    if (d.kind === 'draw') { const a = d.a, b = d.b; const w = r2(Math.abs(b[0] - a[0])), dd = r2(Math.abs(b[1] - a[1])); if (w >= 0.8 && dd >= 0.8) { commit('Add room'); const r = makeRoom({ name: 'New Room', type: 'empty', x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w, d: dd }); FL().rooms.push(r); S.sel = { kind: 'room', id: r.id }; setTool('select'); rebuild(); renderInspector(); save(); toast('Room added — set its type in the inspector'); } else render2D(); return; }
    if (d.kind === 'item' && d.committed) { const nr = roomAt(d.it.x, d.it.y); if (nr && nr !== d.room) { d.room.furniture.splice(d.room.furniture.indexOf(d.it), 1); nr.furniture.push(d.it); } else if (!nr) { d.it.x = d.start[0]; d.it.y = d.start[1]; } }
    if (d.kind === 'resize' && d.committed && d.ext) { const msg = `${d.room.name}: an outer wall was moved. External walls are typically load-bearing — have a structural engineer review this change.`; S.structuralLog.push(msg); toast('⚠️ Structural warning: outer wall moved — flagged for professional review', 4200); }
    if (d.kind === 'resize' && d.committed && !d.ext) toast('Partition wall moved. Check adjoining room sizes.');
    if (d.committed) { rebuild(); save(); }
  });
  el.addEventListener('wheel', e => { if (S.view !== '2d') return; e.preventDefault(); const rc = el.getBoundingClientRect(); const px = e.clientX - rc.left, py = e.clientY - rc.top; const p = toPlan(px, py); V2.s = clamp(V2.s * (e.deltaY > 0 ? 0.9 : 1.1), 8, 300); V2.x = p[0] - px / V2.s; V2.y = p[1] - py / V2.s; render2D(); }, { passive: false });
  window.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input,textarea,select')) return; if (!S.project || document.getElementById('app').dataset.screen !== 'work') return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) { e.preventDefault(); deleteSelected(); }
    if (e.key.toLowerCase() === 'r' && S.sel && S.sel.kind === 'item' && CTL?.mode !== 'walk') rotateSelected();
    if (e.key === 'Escape') { setTool('select'); if (S.touring) stopTour(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  });
}
function deleteSelected() {
  const s = S.sel; if (!s) return; commit('Delete');
  if (s.kind === 'item') { const f = findItem(s.id); if (f) f.room.furniture.splice(f.room.furniture.indexOf(f.it), 1); }
  else if (s.kind === 'room') { const r = findRoom(s.id); const f = floorOfRoom(r); f.rooms.splice(f.rooms.indexOf(r), 1); }
  else if (s.kind === 'door') { const f = FL(); f.doors = f.doors.filter(d => d.id !== s.id); }
  else if (s.kind === 'window') { const f = FL(); f.windows = f.windows.filter(d => d.id !== s.id); }
  S.sel = null; rebuild(); renderInspector(); save();
}
function rotateSelected(deg = 90) { const f = S.sel && findItem(S.sel.id); if (!f) return; commit('Rotate'); f.it.rot = (f.it.rot + deg + 360) % 360; rebuild(); renderInspector(); save(); }
