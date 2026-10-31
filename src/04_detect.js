/* ===================== FLOOR PLAN INPUT & DETECTION ===================== */
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); }); }
async function fileToImageURL(file) {
  if (/pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)) {
    if (!window.pdfjsLib) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js').catch(() => { });
      try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; } catch (e) { }
    }
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    const page = await pdf.getPage(1); const vp = page.getViewport({ scale: 2 });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return c.toDataURL('image/png');
  }
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
}
function loadImage(url) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Image could not be decoded')); i.src = url; }); }

/* Draw a realistic black-line floor plan image of a model (used for the sample plan) */
function drawPlanImage(project) {
  const f = project.floors[0], b = homeBounds(f), ppm = 48, m = 70;
  const c = document.createElement('canvas'); c.width = Math.round(b.w * ppm + m * 2); c.height = Math.round(b.d * ppm + m * 2);
  const x = c.getContext('2d'); x.fillStyle = '#fbfaf7'; x.fillRect(0, 0, c.width, c.height);
  const X = v => m + (v - b.x) * ppm, Y = v => m + (v - b.y) * ppm;
  x.fillStyle = '#1b1b1b';
  wallPieces(f).forEach(p => {
    const t = (p.ext ? 0.23 : 0.12) * ppm;
    if (p.kind === 'lintel') return;
    if (p.kind === 'head') return;
    if (p.kind === 'sill') { // window symbol: thin double line
      x.strokeStyle = '#1b1b1b'; x.lineWidth = 1.4;
      [-t / 2, 0, t / 2].forEach(o => { x.beginPath(); if (p.o === 'h') { x.moveTo(X(p.a), Y(p.c) + o); x.lineTo(X(p.b), Y(p.c) + o); } else { x.moveTo(X(p.c) + o, Y(p.a)); x.lineTo(X(p.c) + o, Y(p.b)); } x.stroke(); });
      return;
    }
    if (p.o === 'h') x.fillRect(X(p.a) - t / 2, Y(p.c) - t / 2, (p.b - p.a) * ppm + t, t); else x.fillRect(X(p.c) - t / 2, Y(p.a) - t / 2, t, (p.b - p.a) * ppm + t);
  });
  // doors: arcs
  x.strokeStyle = '#333'; x.lineWidth = 1.2;
  f.doors.forEach(d => {
    const w = d.w * ppm; x.beginPath();
    if (d.o === 'h') { const hx = X(d.x - d.w / 2), hy = Y(d.y); x.moveTo(hx, hy); x.lineTo(hx, hy + w); x.arc(hx, hy, w, Math.PI / 2, 0, true); }
    else { const hx = X(d.x), hy = Y(d.y - d.w / 2); x.moveTo(hx, hy); x.lineTo(hx + w, hy); x.arc(hx, hy, w, 0, Math.PI / 2); }
    x.stroke();
  });
  x.fillStyle = '#222'; x.textAlign = 'center';
  f.rooms.forEach(r => {
    const cx = X(r.x + r.w / 2), cy = Y(r.y + r.d / 2);
    x.font = `600 ${Math.max(9, Math.min(14, r.w * 4))}px Arial`; x.fillText(r.name.toUpperCase(), cx, cy - 3);
    x.font = `${Math.max(8, Math.min(12, r.w * 3.4))}px Arial`; x.fillText(`${r.w.toFixed(1)} x ${r.d.toFixed(1)} m`, cx, cy + 13);
  });
  // overall dimension
  x.strokeStyle = '#555'; x.lineWidth = 1; x.beginPath(); x.moveTo(X(b.x), m - 34); x.lineTo(X(b.x + b.w), m - 34); x.stroke();
  [X(b.x), X(b.x + b.w)].forEach(px => { x.beginPath(); x.moveTo(px, m - 42); x.lineTo(px, m - 26); x.stroke(); });
  x.font = '600 13px Arial'; x.fillText(`${b.w.toFixed(2)} m`, (X(b.x) + X(b.x + b.w)) / 2, m - 40);
  x.save(); x.translate(m - 40, (Y(b.y) + Y(b.y + b.d)) / 2); x.rotate(-Math.PI / 2); x.fillText(`${b.d.toFixed(2)} m`, 0, 0); x.restore();
  x.beginPath(); x.moveTo(m - 32, Y(b.y)); x.lineTo(m - 32, Y(b.y + b.d)); x.stroke();
  x.font = '600 12px Arial'; x.textAlign = 'left'; x.fillText('N ↑', c.width - 50, 30);
  return { url: c.toDataURL('image/png'), widthM: b.w };
}

/* -------- classical computer-vision room detection -------- */
function cvDetect(img) {
  const maxD = 760, sc = Math.min(1, maxD / Math.max(img.width, img.height));
  const W = Math.max(8, Math.round(img.width * sc)), H = Math.max(8, Math.round(img.height * sc));
  const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.drawImage(img, 0, 0, W, H);
  const px = ctx.getImageData(0, 0, W, H).data; const N = W * H; const gray = new Uint8Array(N);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < N; i++) { const v = (px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11) | 0; gray[i] = v; hist[v]++; }
  // Otsu
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sB = 0, wB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = N - wB; if (!wF) break; sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF; const v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; thr = t; } }
  thr = clamp(Math.max(thr, 175), 120, 215);
  const wall = new Uint8Array(N); let dark = 0; for (let i = 0; i < N; i++) if (gray[i] < thr) { wall[i] = 1; dark++; }
  // drop small dark blobs (text, dimension numbers, symbols) so they don't split rooms
  { const seen = new Uint8Array(N), st = new Int32Array(N), lim = Math.max(W, H) * 0.035; const tmp = [];
    for (let s0 = 0; s0 < N; s0++) { if (!wall[s0] || seen[s0]) continue; let sp = 0; st[sp++] = s0; seen[s0] = 1; let x0 = W, y0 = H, x1 = 0, y1 = 0; tmp.length = 0;
      while (sp) { const k = st[--sp]; tmp.push(k); const x = k % W, y = (k / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const kk = yy * W + xx; if (wall[kk] && !seen[kk]) { seen[kk] = 1; st[sp++] = kk; } } }
      if (Math.max(x1 - x0, y1 - y0) < lim) tmp.forEach(k => wall[k] = 0); } }
  // thick-stroke mask (opening) for wall thickness estimate
  const runs = [];
  for (let y = 0; y < H; y += 2) { let run = 0; for (let x = 0; x < W; x++) { if (wall[y * W + x]) run++; else { if (run >= 2 && run < 40) runs.push(run); run = 0; } } }
  runs.sort((a, b) => a - b);
  const thick = runs.filter(r => r >= 3);
  const intPx = thick.length ? thick[Math.floor(thick.length * 0.5)] : 3, extPx = thick.length ? thick[Math.floor(thick.length * 0.9)] : 6;
  // dilate to close door gaps
  const r = Math.max(2, Math.round(Math.max(W, H) * (+S.cvGap || 0.012)));
  const dil = (src) => { const t = new Uint8Array(N), o = new Uint8Array(N);
    for (let y = 0; y < H; y++) { let cnt = 0; for (let x = -r; x < W + r; x++) { if (x + r < W && x + r >= 0 && src[y * W + x + r]) cnt++; if (x - r - 1 >= 0 && x - r - 1 < W && src[y * W + x - r - 1]) cnt--; if (x >= 0 && x < W) t[y * W + x] = cnt > 0 ? 1 : 0; } }
    for (let x = 0; x < W; x++) { let cnt = 0; for (let y = -r; y < H + r; y++) { if (y + r < H && y + r >= 0 && t[(y + r) * W + x]) cnt++; if (y - r - 1 >= 0 && y - r - 1 < H && t[(y - r - 1) * W + x]) cnt--; if (y >= 0 && y < H) o[y * W + x] = cnt > 0 ? 1 : 0; } }
    return o; };
  const closed = dil(wall);
  // label free regions
  const lab = new Int32Array(N).fill(-1); const comps = [];
  const stack = new Int32Array(N);
  for (let s = 0; s < N; s++) {
    if (closed[s] || lab[s] !== -1) continue;
    const id = comps.length; let sp = 0; stack[sp++] = s; lab[s] = id;
    let x0 = W, y0 = H, x1 = 0, y1 = 0, cnt = 0, border = false;
    while (sp) { const k = stack[--sp]; const x = k % W, y = (k / W) | 0; cnt++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (x === 0 || y === 0 || x === W - 1 || y === H - 1) border = true;
      if (x > 0 && !closed[k - 1] && lab[k - 1] === -1) { lab[k - 1] = id; stack[sp++] = k - 1; }
      if (x < W - 1 && !closed[k + 1] && lab[k + 1] === -1) { lab[k + 1] = id; stack[sp++] = k + 1; }
      if (y > 0 && !closed[k - W] && lab[k - W] === -1) { lab[k - W] = id; stack[sp++] = k - W; }
      if (y < H - 1 && !closed[k + W] && lab[k + W] === -1) { lab[k + W] = id; stack[sp++] = k + W; } }
    comps.push({ id, x0, y0, x1, y1, cnt, border });
  }
  const minA = N * 0.0025;
  const grow = r + Math.round(intPx / 2);
  let rooms = comps.filter(c => !c.border && c.cnt > minA).map(c => {
    // robust rectangle: rows/columns where the region is dense (ignores door-swing protrusions)
    const cw = c.x1 - c.x0 + 1, ch = c.y1 - c.y0 + 1, colC = new Int32Array(cw), rowC = new Int32Array(ch);
    for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) if (lab[y * W + x] === c.id) { colC[x - c.x0]++; rowC[y - c.y0]++; }
    const mc = Math.max(...colC), mr = Math.max(...rowC); let a = 0, b2 = cw - 1, t = 0, u = ch - 1;
    while (a < b2 && colC[a] < mc * 0.3) a++; while (b2 > a && colC[b2] < mc * 0.3) b2--; while (t < u && rowC[t] < mr * 0.3) t++; while (u > t && rowC[u] < mr * 0.3) u--;
    return { x0: Math.max(0, c.x0 + a - grow), y0: Math.max(0, c.y0 + t - grow), x1: Math.min(W, c.x0 + b2 + grow + 1), y1: Math.min(H, c.y0 + u + grow + 1), fill: c.cnt / (cw * ch) };
  });
  // drop nested components (furniture outlines inside rooms)
  rooms = rooms.filter(a => !rooms.some(b => b !== a && a.x0 >= b.x0 - 2 && a.y0 >= b.y0 - 2 && a.x1 <= b.x1 + 2 && a.y1 <= b.y1 + 2 && (b.x1 - b.x0) * (b.y1 - b.y0) > (a.x1 - a.x0) * (a.y1 - a.y0) * 1.2));
  // snap the dilation-expanded box edges to centre of walls (expansion r ≈ wall centre)
  return { W, H, rooms, intPx, extPx, dark: dark / N };
}
function heuristicTypes(rooms, all = rooms) {
  const count = {}; const nm = t => { count[t] = (count[t] || 0) + 1; return ROOM_TYPES[t].label + (['bedroom', 'bathroom'].includes(t) ? ' ' + count[t] : ''); };
  const bb = { x0: Math.min(...all.map(r => r.x)), y0: Math.min(...all.map(r => r.y)), x1: Math.max(...all.map(r => r.x + r.w)), y1: Math.max(...all.map(r => r.y + r.d)) };
  const onEdge = r => r.x - bb.x0 < 0.3 || r.y - bb.y0 < 0.3 || bb.x1 - (r.x + r.w) < 0.3 || bb.y1 - (r.y + r.d) < 0.3;
  const left = rooms.slice().sort((a, b) => area(b) - area(a)); const set = (r, t) => { r.type = t; left.splice(left.indexOf(r), 1); };
  const living = all.find(r => r.type === 'living' && !rooms.includes(r)) || left.find(r => area(r) > 8); if (living && rooms.includes(living)) set(living, 'living');
  left.slice().forEach(r => { const asp = Math.max(r.w, r.d) / Math.min(r.w, r.d); if (asp > 2.05 && Math.min(r.w, r.d) < 1.9) set(r, onEdge(r) && area(r) < 9 ? 'balcony' : 'hall'); });
  if (living) {
    const biggest = left[0];
    const din = left.filter(r => r !== biggest && area(r) >= 6 && area(r) <= 14 && Math.max(r.w, r.d) / Math.min(r.w, r.d) < 1.7 && sharedEdge(r, living)).sort((a, b) => area(b) - area(a))[0];
    if (din) { set(din, 'dining'); const kit = left.filter(r => area(r) >= 4.4 && area(r) <= 12.5 && sharedEdge(r, din)).sort((a, b) => area(b) - area(a))[0]; if (kit) set(kit, 'kitchen'); }
  }
  let master = false;
  left.slice().forEach(r => { const A = area(r); if (A >= 8.5) { set(r, master ? 'bedroom' : 'master'); master = true; } });
  if (!all.some(r => r.type === 'kitchen')) { const k = left.filter(r => area(r) >= 4.4).sort((a, b) => area(b) - area(a))[0]; if (k) set(k, 'kitchen'); }
  left.slice().forEach(r => { const A = area(r); set(r, A < 2.4 ? 'utility' : A < 4.6 ? 'bathroom' : 'study'); });
  rooms.forEach(r => r.name = nm(r.type));
}
async function detectPlan(url, opts = {}) {
  const log = opts.log || (() => { });
  const img = await loadImage(url);
  log('Analysing line work, walls and enclosed spaces…');
  const cv = cvDetect(img);
  log(`Computer vision found ${cv.rooms.length} enclosed regions.`);
  let widthM = +opts.widthM || 0, gem = null, source = 'Computer vision';
  if (S.apiKey && opts.useAI !== false) {
    const vm = S.provider === 'groq' && !isVisionId(S.model) ? (S.groqVision || S.model) : S.model; const vl = /gemma-?4/i.test(vm) ? 'Gemma 4' : vm;
    log(`Asking ${vm} to read labels, dimensions, doors and windows…`);
    try { gem = await gemmaReadPlan(url, cv); source = cv.rooms.length >= 2 ? 'Computer vision + ' + vl : vl + ' vision'; log(vl + ' returned a structured reading of the plan.'); }
    catch (e) { log(vl + ' unavailable (' + e.message.slice(0, 120) + ') — continuing with on-device detection.'); }
  }
  // rooms in px
  let pxRooms = cv.rooms.map((r, i) => ({ id: 'R' + (i + 1), x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 }));
  if (gem) {
    if (cv.rooms.length < 2 && gem.rooms_full?.length) pxRooms = gem.rooms_full.map((r, i) => ({ id: 'R' + (i + 1), x0: r.bbox[0] / 100 * cv.W, y0: r.bbox[1] / 100 * cv.H, x1: r.bbox[2] / 100 * cv.W, y1: r.bbox[3] / 100 * cv.H, name: r.name, type: r.type }));
    else {
      (gem.rooms || []).forEach(g => { const pr = pxRooms.find(p => p.id === g.id); if (pr) { pr.name = g.name; pr.type = g.type; } });
      (gem.extra_rooms || []).forEach((g, i) => { if (Array.isArray(g.bbox) && g.bbox.length === 4) pxRooms.push({ id: 'X' + i, x0: g.bbox[0] / 100 * cv.W, y0: g.bbox[1] / 100 * cv.H, x1: g.bbox[2] / 100 * cv.W, y1: g.bbox[3] / 100 * cv.H, name: g.name, type: g.type }); });
    }
    if (!widthM && +gem.plan_width_m > 2 && +gem.plan_width_m < 80) widthM = +gem.plan_width_m;
  }
  if (!pxRooms.length) throw new Error('No rooms could be detected. Try a cleaner, high-contrast plan (dark walls on white) or add a Gemma 4 API key in Settings.');
  const bx0 = Math.min(...pxRooms.map(r => r.x0)), by0 = Math.min(...pxRooms.map(r => r.y0)), bx1 = Math.max(...pxRooms.map(r => r.x1)), by1 = Math.max(...pxRooms.map(r => r.y1));
  if (!widthM) widthM = opts.defaultWidth || 12;
  const mpp = widthM / (bx1 - bx0);
  const floor = FL(); floor.rooms = []; floor.doors = []; floor.windows = [];
  pxRooms.forEach(pr => {
    const room = makeRoom({ x: r2((pr.x0 - bx0) * mpp), y: r2((pr.y0 - by0) * mpp), w: r2((pr.x1 - pr.x0) * mpp), d: r2((pr.y1 - pr.y0) * mpp), type: ROOM_TYPES[pr.type] ? pr.type : 'empty' });
    if (pr.name) room.name = String(pr.name).replace(/\b\w/g, c => c.toUpperCase()).slice(0, 28);
    room._typed = !!ROOM_TYPES[pr.type];
    floor.rooms.push(room);
  });
  snapRooms(floor, 0.35);
  if (!floor.rooms.every(r => r._typed)) { const untyped = floor.rooms.filter(r => !r._typed); heuristicTypes(untyped, floor.rooms); }
  floor.rooms.forEach(r => delete r._typed);
  // remove degenerate / heavily overlapping rooms
  floor.rooms = floor.rooms.filter(r => area(r) > 0.8);
  floor.rooms.sort((a, b) => area(b) - area(a));
  for (let i = floor.rooms.length - 1; i >= 0; i--) { const a = floor.rooms[i]; if (floor.rooms.some((b, j) => j < i && rectOverlap(a, b) > area(a) * 0.6)) floor.rooms.splice(i, 1); }
  // doors & windows from Gemma → snap to walls
  if (gem) {
    const lines = wallLines(floor);
    const snapTo = (nx, ny, isDoor) => { const x = (nx / 100 * cv.W - bx0) * mpp, y = (ny / 100 * cv.H - by0) * mpp; let best = null;
      lines.forEach(L => { const t = clamp(L.o === 'h' ? x : y, L.a, L.b); const d = L.o === 'h' ? Math.hypot(x - t, y - L.c) : Math.hypot(x - L.c, y - t); if (d < 0.6 && (!best || d < best.d)) best = { d, L, t }; });
      if (!best) return null; const L = best.L, w = isDoor ? 0.9 : 1.2; const t = clamp(best.t, L.a + w / 2 + 0.05, L.b - w / 2 - 0.05);
      return { o: L.o, x: r2(L.o === 'h' ? t : L.c), y: r2(L.o === 'h' ? L.c : t), w }; };
    (gem.doors || []).slice(0, 30).forEach(p => { const s = Array.isArray(p) && snapTo(p[0], p[1], true); if (s && !floor.doors.some(d => Math.hypot(d.x - s.x, d.y - s.y) < 0.8)) floor.doors.push(Object.assign({ id: uid('d') }, s)); });
    (gem.windows || []).slice(0, 40).forEach(p => { const s = Array.isArray(p) && snapTo(p[0], p[1], false); if (s && isExteriorPoint(floor, s.o, s.o === 'h' ? s.y : s.x, s.o === 'h' ? s.x : s.y) && !floor.windows.some(d => Math.hypot(d.x - s.x, d.y - s.y) < 0.8)) floor.windows.push(Object.assign({ id: uid('w'), sill: 0.9, h: 1.25 }, s)); });
  }
  autoOpenings(floor);
  P().wallThickness = { ext: r2(Math.max(0.15, Math.min(0.35, cv.extPx * mpp))), int: r2(Math.max(0.08, Math.min(0.25, cv.intPx * mpp))) };
  P().scaleNote = `${source} · scale ${r2(mpp * 100)} cm/px · plan width ${r2(widthM)} m`;
  return { cv, gem, source, mpp, bx0, by0, widthM, img };
}
