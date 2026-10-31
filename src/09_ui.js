/* ===================== APP SHELL, PANELS & INTERACTIONS ===================== */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
function toast(msg, ms = 2600) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), ms); }
function show(screen) { if (!['login', 'intro', 'landing'].includes(screen) && !currentUser()) { screen = 'login'; renderAuth(); } else if (!['login', 'intro', 'landing'].includes(screen) && !currentUser().answers?.done) { screen = 'intro'; renderIntro(); } $('#app').dataset.screen = screen; window.scrollTo(0, 0); if (screen === 'dash') renderDash(); try { updateUserChips(); } catch (e) { } }
function commit(label) { if (!S.project) return; S.history.push(JSON.stringify(S.project)); if (S.history.length > 40) S.history.shift(); S.future = []; }
function undo() { if (!S.history.length) return toast('Nothing to undo'); S.future.push(JSON.stringify(S.project)); S.project = JSON.parse(S.history.pop()); S.sel = null; rebuild(); renderInspector(); save(); toast('Undone'); }
function redo() { if (!S.future.length) return toast('Nothing to redo'); S.history.push(JSON.stringify(S.project)); S.project = JSON.parse(S.future.pop()); S.sel = null; rebuild(); renderInspector(); save(); }
let saveT = null;
function save(withThumb) {
  if (!S.project) return; S.project.updated = Date.now();
  clearTimeout(saveT); saveT = setTimeout(() => {
    const pj = Object.assign({}, S.project, { planImage: null });
    store.set('proj_' + pj.id, pj);
    const list = store.get('projects', []).filter(p => p.id !== pj.id);
    let thumb = (store.get('projects', []).find(p => p.id === pj.id) || {}).thumb;
    if ((withThumb || !thumb) && E && S.view !== '2d' && !S.touring) { try { thumb = E.snapshot(360, 220); } catch (e) { } }
    list.unshift({ id: pj.id, name: pj.name, updated: pj.updated, thumb, rooms: allRooms().length, cost: homeCost().total, theme: pj.theme });
    store.set('projects', list.slice(0, 24));
  }, 500);
}
function updateGemmaBadge() {
  const nm = !S.apiKey ? 'Gemma 4' : /gemma-?4/i.test(S.model) ? 'Gemma 4' : S.provider === 'groq' ? 'Groq · ' + (S.model || '').split('/').pop().slice(0, 18) : S.model;
  const st = !S.apiKey ? ['', 'Gemma 4 · add key'] : S.gemmaOK === false ? ['err', nm + ' · offline'] : S.gemmaOK ? ['ok', nm + ' · live'] : ['key', nm + ' · ready'];
  $$('.gbadge').forEach(b => { b.className = 'gbadge ' + st[0]; b.textContent = st[1]; });
  const ce = $('#chat-engine'); if (ce) ce.textContent = S.apiKey ? `${GEMMA_MODELS[S.model] || S.model}${S.provider === 'groq' ? ' · via Groq' : ''}` : 'On-device engine · add an AI key in ⚙';
}
function updateTopStats() {
  const el = $('#top-stats'); if (!el || !S.project) return; const c = homeCost(); const A = allRooms().reduce((s, r) => s + area(r), 0);
  el.innerHTML = `<span><b>${allRooms().length}</b> rooms</span><span><b>${Math.round(A * SQFT).toLocaleString('en-IN')}</b> sq ft</span><span><b>${inr(c.total)}</b> est.</span><span>${P().theme}</span>`;
}

/* ---------- views ---------- */
function setView(v) {
  if (S.touring && v !== '3d') stopTour();
  const prev = S.view; S.view = v; $('#app').dataset.view = v;
  $$('#view-seg button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  if (v === '2d') { V2.init = false; render2D(); setTool('select'); renderInspector(); return; }
  if (!E) return;
  if (v === 'walk') {
    const f = FL(); const con = connectivity(f); const r = con.start || f.rooms[0]; const sh = roomShot(r);
    CTL.mode = 'walk'; rebuild();
    CTL.flyTo(sh.pos, sh.target, prev === '2d' ? 0.01 : 1.4, { mode: 'walk' }).then(() => toast('Walk mode: W A S D / arrow keys, drag to look'));
  } else {
    const wasWalk = CTL.mode === 'walk'; CTL.mode = 'orbit'; rebuild();
    if (prev === '2d') { fitView(false, true); setTimeout(() => fitView(true), 60); }
    else if (wasWalk) fitView(true);
  }
  E.dirty = true; renderInspector();
}

/* ---------- side panels ---------- */
function openPanel(p) {
  S.panel = p; $$('#rail button').forEach(b => b.classList.toggle('on', b.dataset.p === p));
  $('#app').classList.add('side-open'); refreshSidePanel();
  if (p === 'light' && !S.daylightSim) { /* keep user choice */ }
}
function selRoom() { if (S.sel && S.sel.kind === 'room') return findRoom(S.sel.id); if (S.sel && S.sel.kind === 'item') { const f = findItem(S.sel.id); return f && f.room; } return null; }
function roomPicker(label = 'Pick a room') { return `<div class="card"><p class="muted" style="margin:0 0 8px">${label} — click it in the 3D/2D view, or:</p><div class="mini-chips">${FL().rooms.map(r => `<button class="chip" data-act="select-room" data-id="${r.id}">${ROOM_TYPES[r.type].icon} ${esc(r.name)}</button>`).join('')}</div></div>`; }
function scoreRing(v) { const c = v >= 75 ? '#10b981' : v >= 50 ? '#f59e0b' : '#ec4899'; return `<div class="score" style="background:conic-gradient(${c} ${v * 3.6}deg, #1e293b 0);box-shadow:0 0 18px ${c}33"><div style="width:46px;height:46px;border-radius:50%;background:var(--panel2);display:grid;place-items:center">${v}</div></div>`; }
function refreshSidePanel() {
  const el = $('#side-body'); if (!el || !S.project) return;
  const fn = { design: panelDesign, furniture: panelFurniture, space: panelSpace, budget: panelBudget, light: panelLight, transform: panelTransform, arch: panelArch, compare: panelCompare, report: panelReport }[S.panel] || panelDesign;
  const st = el.parentElement.scrollTop; el.innerHTML = fn(); el.parentElement.scrollTop = st;
}
function panelDesign() {
  const r = selRoom(); const th = P().theme;
  let h = `<h2>AI Interior Designer</h2><p class="muted">Themes, paint, materials, ceilings, lighting &amp; decor — applied live to your 3D home.</p>
  <h3>Theme for the whole home</h3><div class="theme-grid">${Object.entries(THEMES).map(([n, t]) => `<button class="theme ${th === n ? 'on' : ''}" data-act="theme" data-t="${n}"><b>${n}</b><div class="dots">${[t.walls[0], t.wood, t.fabric, t.accent].map(c => `<i style="background:${c}"></i>`).join('')}</div></button>`).join('')}</div>
  <div class="row" style="margin-top:10px"><button class="btn sm" data-act="furnish-all">🪄 Auto-furnish every room</button><button class="btn sm ghost" data-act="furnish-all" data-v="1">↻ Alternative layouts</button></div>`;
  if (!r) h += `<h3>Room design</h3>` + roomPicker('Select a room to get paint, material, ceiling & lighting suggestions');
  else {
    const sug = paintSuggestions(r), la = lightingAdvice(r), ca = ceilingAdvice(r), da = decorAdvice(r); const fk = roomFloorKey(r), ck = roomCeiling(r);
    h += `<h3>${ROOM_TYPES[r.type].icon} ${esc(r.name)} — AI paint suggestions</h3><div class="card">${sug.map(s => `<div class="sugg"><button class="sw" style="background:${s.hex}" data-act="wall" data-c="${s.hex}"></button><div><b>${esc(s.name)}</b><small>${esc(s.why)}</small></div><button class="btn sm ghost" data-act="wall" data-c="${s.hex}">Apply</button></div>`).join('')}
      <div class="row" style="margin-top:8px"><span class="muted">Custom</span><input type="color" value="${roomWall(r)}" data-act-input="wall-custom"><label class="row muted"><input type="checkbox" ${r.wallpaper ? 'checked' : ''} data-act-change="wallpaper"> Striped wallpaper</label></div></div>
    <h3>Flooring material</h3><div class="mini-chips">${Object.entries(FLOORS).map(([k, v]) => `<button class="chip ${fk === k ? 'on' : ''}" data-act="floor" data-k="${k}"><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${v.color};vertical-align:middle"></i> ${v.label}</button>`).join('')}</div>
    <h3>Ceiling designer</h3><div class="card"><p style="margin-top:0">${esc(ca.why)}</p><div class="seg sm">${Object.entries(CEILINGS).map(([k, v]) => `<button class="${ck === k ? 'on' : ''}" data-act="ceiling" data-k="${k}">${v.label.split(' ')[0]}</button>`).join('')}</div>${ca.type !== ck ? `<button class="btn sm" style="margin-top:8px" data-act="ceiling" data-k="${ca.type}">Use AI pick: ${CEILINGS[ca.type].label}</button>` : ''}</div>
    <h3>Lighting designer</h3><div class="card"><div class="kv"><span>Ambient</span><b style="font-weight:600">${la.ambient}</b><span>Task</span><b style="font-weight:600">${la.task}</b><span>Accent</span><b style="font-weight:600">${la.accent}</b><span>Colour temp.</span><b style="font-weight:600">${la.temp}</b></div>
      <div class="row" style="margin-top:8px">${['ambient', 'task', 'accent'].map(k => `<label class="row muted"><input type="checkbox" ${r.lights?.[k] ? 'checked' : ''} data-act-change="light-tog" data-k="${k}"> ${k}</label>`).join('')}</div><button class="btn sm ghost" data-act="time-eve">See it at 8 PM →</button></div>
    <h3>Curtains &amp; decor</h3><div class="card"><div class="kv"><span>Curtains</span><b style="font-weight:600">${da.curtains}</b><span>Rug</span><b style="font-weight:600">${da.rug}</b><span>Decor</span><b style="font-weight:600">${da.decor}</b></div><label class="row muted" style="margin-top:8px"><input type="checkbox" ${r.curtains ? 'checked' : ''} data-act-change="curtains"> Show curtains in 3D</label></div>
    <h3>Furniture style</h3><div class="two"><label class="field">Wood finish<select data-act-change="finish"><option value="">Theme default</option>${Object.keys(WOOD_FINISHES).map(k => `<option ${r.furniture[0]?.finish === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label><label class="field">Quality tier<select data-act-change="tier">${TIERS.map(t => `<option ${r.tier === t ? 'selected' : ''} value="${t}">${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select></label></div>
    <label class="field">Room-only theme<select data-act-change="room-theme"><option value="">Same as home (${th})</option>${Object.keys(THEMES).map(k => `<option ${r.theme === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>`;
  }
  h += `<h3>Recreate an inspiration photo</h3><div class="card"><p style="margin-top:0" class="muted">Upload a Pinterest / Instagram interior and Aria recreates the style in ${r ? esc(r.name) : 'your home'}.</p><input type="file" id="insp-in" accept="image/*" hidden><button class="btn sm" data-act="pick-insp">📌 Upload inspiration</button><div id="insp-out">${S.insp ? inspHTML(S.insp) : ''}</div></div>`;
  return h;
}
function inspHTML(x) { return `<div style="margin-top:10px"><div class="row">${x.url ? `<img src="${x.url}" style="width:70px;height:70px;object-fit:cover;border-radius:10px">` : ''}<div><b>${x.style}</b><div class="dots" style="margin:5px 0">${x.palette.slice(0, 5).map(c => `<i style="background:${c}"></i>`).join('')}</div><small class="muted">via ${esc(x.via)}</small></div></div>${x.description ? `<p>${esc(x.description)}</p>` : ''}<button class="btn sm primary" data-act="apply-insp">Apply this look</button></div>`; }
function panelFurniture() {
  const r = selRoom(); S.cat = S.cat || 'Bedroom';
  const cats = CAT_ORDER.filter(c => Object.values(CATALOG).some(i => i.cat === c));
  let h = `<h2>Furniture</h2><p class="muted">${r ? `Click to add to <b>${esc(r.name)}</b> — DIMORA finds a spot that keeps walkways and doors clear.` : 'Select a room first, or use 2D view to click-place anywhere.'}</p>
  <div class="cat-tabs">${cats.map(c => `<button class="${S.cat === c ? 'on' : ''}" data-act="cat" data-c="${c}">${c}</button>`).join('')}</div>
  <div class="fgrid">${Object.entries(CATALOG).filter(([, v]) => v.cat === S.cat).map(([k, v]) => `<button class="fitem" data-act="add-item" data-t="${k}"><i>${v.icon}</i><b>${v.label}</b><small>${v.w}×${v.d} m · from ${inr(v.price[0])}</small></button>`).join('')}</div>`;
  if (r) h += `<h3>In ${esc(r.name)} (${r.furniture.length})</h3>${r.furniture.map(it => `<div class="sugg"><span style="font-size:18px">${CATALOG[it.type].icon}</span><div><b>${CATALOG[it.type].label}</b><small>${it.w}×${it.d} m · ${it.tier} · ${inr(CATALOG[it.type].price[TIER_IX[it.tier]])}</small></div><div class="row"><button class="btn sm ghost" data-act="select-item" data-id="${it.id}">Edit</button><button class="btn sm ghost" data-act="del-item" data-id="${it.id}">✕</button></div></div>`).join('') || '<p class="muted">Empty.</p>'}<div class="row" style="margin-top:8px"><button class="btn sm" data-act="furnish-room">🪄 Auto-furnish</button><button class="btn sm ghost" data-act="furnish-room" data-v="1">↻ Another layout</button><button class="btn sm ghost" data-act="clear-room">Clear</button></div>`;
  return h;
}
function panelSpace() {
  const r = selRoom(); const f = FL();
  const all = f.rooms.map(x => ({ x, a: analyzeSpace(x, f) }));
  let h = `<h2>Intelligent Space Analyzer</h2><p class="muted">Dimensions, utilisation, walking clearance, door swings and wasted space.</p>
  <button class="btn sm ghost" data-act="overlay-plan" data-o="space">Show unused space on plan</button>
  <table class="t" style="margin-top:10px"><tr><th>Room</th><th class="r">m²</th><th>Status</th><th class="r">Score</th></tr>${all.map(({ x, a }) => `<tr class="click" data-act="select-room" data-id="${x.id}"><td>${esc(x.name)}</td><td class="r">${r2(area(x))}</td><td><span class="tag ${a.status === 'Balanced' ? 'ok' : a.status === 'Overcrowded' ? 'warn' : 'mid'}">${a.status}</span></td><td class="r">${a.score}</td></tr>`).join('')}</table>`;
  const st = storageReport();
  if (r) {
    const a = analyzeSpace(r, floorOfRoom(r));
    h += `<h3>${esc(r.name)}</h3><div class="card"><div class="row">${scoreRing(a.score)}<div class="kv" style="flex:1"><span>Size</span><b>${r.w} × ${r.d} m</b><span>Area</span><b>${r2(area(r))} m² · ${Math.round(area(r) * SQFT)} sq ft</b><span>Furniture cover</span><b>${Math.round(a.coverage * 100)}%</b><span>Walkable floor</span><b>${Math.round(a.walkable * 100)}%</b></div></div><p class="muted">${a.sizeNote}</p></div>
    ${a.issues.length ? a.issues.map(i => `<div class="issue">${esc(i)}</div>`).join('') : '<div class="issue ok">Walking clearances and door swings are comfortable.</div>'}
    ${a.clear.length ? `<h3>Clearance in front of furniture</h3><table class="t"><tr><th>Item</th><th class="r">Has</th><th class="r">Needs</th></tr>${a.clear.map(c => `<tr><td>${CATALOG[c.it.type].label}</td><td class="r" style="color:${c.ok ? '#7fd9a4' : '#ff9a8a'}">${c.dist} m</td><td class="r">${c.req} m</td></tr>`).join('')}</table>` : ''}
    ${a.corner ? `<h3>Unused space found</h3><div class="card"><p style="margin-top:0">A <b>${r2(a.corner.w)} × ${r2(a.corner.d)} m</b> corner (${r2(a.corner.area)} m²) isn't doing anything. Convert it into:</p><div class="row"><button class="btn sm" data-act="corner" data-k="study">💻 Study corner</button><button class="btn sm" data-act="corner" data-k="reading">📖 Reading nook</button><button class="btn sm" data-act="corner" data-k="storage">🗄️ Storage</button></div></div>` : ''}
    <h3>Layout improvement</h3><div class="row"><button class="btn sm" data-act="furnish-room" data-v="1">↻ Try an alternative arrangement</button><button class="btn sm ghost" data-act="furnish-room">Reset to AI layout</button></div>
    <h3>Room purpose ideas</h3><div class="mini-chips">${a.purpose.map(p => `<button class="chip" data-act="transform" data-t="${p}">${ROOM_TYPES[p].icon} ${ROOM_TYPES[p].label}</button>`).join('')}</div>
    <h3>Furniture fit checker</h3><div class="card"><div class="two"><label class="field">Item<select id="fit-type">${Object.entries(CATALOG).map(([k, v]) => `<option value="${k}" ${S.fitType === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label><div class="two"><label class="field">W m<input id="fit-w" type="number" step="0.05" placeholder="auto"></label><label class="field">D m<input id="fit-d" type="number" step="0.05" placeholder="auto"></label></div></div><button class="btn sm" data-act="fit-check">Check fit</button><div id="fit-out">${S.fitOut || ''}</div></div>`;
  } else h += `<h3>Room detail</h3>` + roomPicker('Pick a room for clearance, wasted space and fit checks');
  h += `<h3>Storage optimisation</h3><div class="card"><div class="kv"><span>Storage you have</span><b>${st.have} m³</b><span>Recommended for ${S.prefs.family} people</span><b>${st.need} m³</b></div><div class="bar" style="margin:8px 0"><i style="width:${Math.min(100, st.have / st.need * 100)}%;background:${st.have >= st.need ? 'var(--sage)' : 'var(--acc)'}"></i></div>${st.tips.map(t => `<p class="muted">${t}</p>`).join('')}</div>`;
  return h;
}
function costIfTier(tier) { const saved = S.project; S.project = deep(saved); allRooms().forEach(r => { r.tier = tier; r.furniture.forEach(i => i.tier = tier); if (tier === 'premium') { if (FLOORS[roomFloorKey(r)].rate < 150 && !['bathroom', 'utility', 'balcony'].includes(r.type)) r.floor = 'marble'; r.lights.accent = true; } if (tier === 'budget') { const fk = roomFloorKey(r); if (FLOOR_CHEAPER[fk]) r.floor = FLOOR_CHEAPER[fk]; r.ceiling = 'flat'; r.lights.accent = false; } }); const c = homeCost(); S.project = saved; return c; }
function panelBudget() {
  const c = homeCost(), B = S.prefs.budget, over = c.total > B; const r = selRoom();
  const cats = [['Furniture', c.furniture], ['Flooring', c.flooring], ['Wall painting', c.paint], ['Lighting', c.lighting], ['False ceiling', c.ceiling], ['Decor & curtains', c.decor]];
  const mx = Math.max(...cats.map(x => x[1]), 1);
  const tb = ['budget', 'standard', 'premium'].map(t => [t, costIfTier(t).total]);
  let h = `<h2>Budget &amp; Cost Estimator</h2><p class="muted">India-focused, room-wise and explainable. Illustrative figures only, not market quotations.</p>
  <div class="card"><label class="field">Your total budget<div class="inline"><span>₹</span><input type="number" step="10000" value="${B}" data-act-change="budget" style="flex:1"></div></label>
  <div class="row" style="justify-content:space-between"><div><small class="muted">Current design</small><div style="font-family:var(--disp);font-size:28px">${inr(c.total)}</div></div><span class="tag ${over ? 'warn' : 'ok'}">${over ? inr(c.total - B) + ' over' : inr(B - c.total) + ' to spare'}</span></div>
  <div class="bar" style="margin-top:8px"><i style="width:${Math.min(100, c.total / B * 100)}%;background:${over ? 'var(--red)' : 'var(--sage)'}"></i></div>${over ? `<button class="btn sm primary" style="margin-top:10px;width:100%" data-act="optimize-all">💸 Fit the whole home into ${inr(B)}</button>` : ''}</div>
  <h3>Where the money goes</h3>${cats.map(([n, v]) => `<div style="margin:7px 0"><div class="row" style="justify-content:space-between"><span>${n}</span><b>${inr(v)}</b></div><div class="bar"><i style="width:${v / mx * 100}%"></i></div></div>`).join('')}
  <h3>Room-wise costs</h3><table class="t"><tr><th>Room</th><th class="r">Furniture</th><th class="r">Total</th></tr>${c.rooms.map(({ r: x, c: cc }) => `<tr class="click" data-act="select-room" data-id="${x.id}"><td>${esc(x.name)}</td><td class="r">${inr(cc.furniture)}</td><td class="r"><b>${inr(cc.total)}</b></td></tr>`).join('')}</table>
  <h3>Budget vs Premium design</h3><div class="two" style="grid-template-columns:1fr 1fr 1fr">${tb.map(([t, v]) => `<div class="card" style="text-align:center;margin:0"><small class="muted">${t[0].toUpperCase() + t.slice(1)}</small><div style="font-weight:800">${inr(v)}</div><button class="btn sm ghost" style="margin-top:6px" data-act="set-tier-all" data-t="${t}">Use</button></div>`).join('')}</div>
  <h3>Budget optimiser</h3><div class="card"><p style="margin-top:0" class="muted">e.g. “Design my bedroom under ₹30,000.”</p><div class="two"><label class="field">Room<select id="opt-room"><option value="all">Whole home</option>${allRooms().map(x => `<option value="${x.id}" ${r === x ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label><label class="field">Max ₹<input id="opt-amt" type="number" step="1000" value="${r ? Math.round(roomCost(r).total * 0.7 / 1000) * 1000 : Math.round(B / 1000) * 1000}"></label></div><button class="btn sm primary" data-act="optimize">Optimise</button>
  ${S.lastOptimize ? `<div style="margin-top:10px"><b>${S.lastOptimize.ok ? '✓ Within budget' : '⚠ Closest possible'}:</b> ${inr(S.lastOptimize.start)} → ${inr(S.lastOptimize.end)}<ul style="padding-left:18px;margin:6px 0;color:var(--muted);font-size:12.5px">${S.lastOptimize.steps.slice(0, 10).map(s => `<li>${esc(s)}</li>`).join('')}${S.lastOptimize.steps.length > 10 ? `<li>…and ${S.lastOptimize.steps.length - 10} more</li>` : ''}</ul></div>` : ''}</div>`;
  if (r) { const rc = roomCost(r); const alts = cheaperAlternatives(r);
    h += `<h3>Why ${esc(r.name)} costs ${inr(rc.total)}</h3><div class="card">${[['Painting', 'paint'], ['Flooring', 'flooring'], ['Furniture', 'furniture'], ['Decor', 'decor'], ['Lighting', 'lighting'], ['Ceiling', 'ceiling']].map(([n, k]) => `<div style="margin:6px 0"><div class="row" style="justify-content:space-between"><b>${n}</b><b>${inr(rc[k])}</b></div><small class="muted">${esc(rc.explain[k])}</small></div>`).join('')}</div>
    <h3>Cheaper alternatives</h3>${alts.length ? alts.slice(0, 6).map((a, i) => `<div class="sugg"><span>💡</span><div><b style="font-weight:600">${esc(a.what)}</b><small>saves ${inr(a.save)}</small></div><button class="btn sm ghost" data-act="alt" data-i="${i}">Apply</button></div>`).join('') : '<p class="muted">Already the leanest choices.</p>'}`; }
  else h += `<h3>Explain a room's estimate</h3>` + roomPicker('Pick a room to see the line-by-line explanation');
  return h;
}
function panelLight() {
  const f = FL(); const r = selRoom(); const all = f.rooms.map(x => ({ x, L: analyzeLight(x, f) }));
  let h = `<h2>Natural Light &amp; Ventilation</h2><p class="muted">Window-to-floor ratio, orientation, sun path and airflow.</p>
  <div class="card"><label class="row"><input type="checkbox" ${S.daylightSim ? 'checked' : ''} data-act-change="daylight"> <b>Daylight simulation</b> — sun enters only through windows</label>
  <label class="field">Time of day: <b id="lt-h">${fmtHour(S.hour)}</b><input type="range" min="5" max="21" step="0.1" value="${S.hour}" data-act-input="hour"></label>
  <label class="field">Plan orientation — where is North? (${P().north || 0}° from plan-up)<input type="range" min="0" max="359" step="1" value="${P().north || 0}" data-act-input="north"></label>
  <div class="row"><button class="btn sm" data-act="play-day">▶ Simulate a full day</button><button class="btn sm ghost" data-act="overlay-plan" data-o="heat">Light heatmap</button><button class="btn sm ghost" data-act="overlay-plan" data-o="air">Airflow paths</button></div></div>
  <table class="t"><tr><th>Room</th><th>Daylight</th><th>Faces</th><th class="r">Score</th></tr>${all.map(({ x, L }) => `<tr class="click" data-act="select-room" data-id="${x.id}"><td>${esc(x.name)}</td><td><span class="tag ${L.rating === 'Excellent' || L.rating === 'Good' ? 'ok' : L.rating === 'Limited' ? 'mid' : 'warn'}">${L.rating}</span></td><td>${L.dirs.join(', ') || '—'}</td><td class="r">${L.score}</td></tr>`).join('')}</table>
  <h3>Rooms with limited windows</h3>${all.filter(a => ['Limited', 'Poor', 'No daylight'].includes(a.L.rating) && !['hall', 'closet', 'utility'].includes(a.x.type)).map(a => `<div class="issue">${esc(a.x.name)}: ${a.L.rating.toLowerCase()} (window/floor ratio ${Math.round(a.L.wfr * 100)}%).</div>`).join('') || '<div class="issue ok">Every habitable room gets reasonable daylight.</div>'}`;
  if (r) { const L = analyzeLight(r, floorOfRoom(r));
    h += `<h3>${esc(r.name)}</h3><div class="card"><div class="row">${scoreRing(L.score)}<div class="kv" style="flex:1"><span>Window area</span><b>${L.winA} m²</b><span>Window : floor</span><b>${Math.round(L.wfr * 100)}% <small class="muted">(aim ≥ 10%)</small></b><span>Ventilation</span><b>${L.vent}</b></div></div></div>
    ${L.notes.map(n => `<div class="issue info">${esc(n)}</div>`).join('')}${L.sugg.map(n => `<div class="issue">${esc(n)}</div>`).join('')}
    ${L.suggestWindow ? `<button class="btn sm primary" data-act="add-window-sugg">＋ Add the suggested ${L.suggestWindow.compass} window</button>` : ''}`; }
  else h += `<h3>Room detail</h3>` + roomPicker('Pick a room for orientation and airflow advice');
  return h;
}
function panelTransform() {
  const r = selRoom();
  let h = `<h2>Smart Room Transformation</h2><p class="muted">Change what a room is for. DIMORA re-plans furniture, paint and cost.</p>`;
  if (!r) return h + roomPicker('Pick a room to transform');
  h += `<div class="card"><b>${ROOM_TYPES[r.type].icon} ${esc(r.name)}</b> <span class="muted">· ${r.w} × ${r.d} m · ${ROOM_TYPES[r.type].label}</span></div><div class="tgrid">${TRANSFORMS.filter(t => t.to !== r.type).map(t => { const ok = area(r) >= ROOM_TYPES[t.to].min * 0.8; return `<button class="tcard" data-act="transform" data-t="${t.to}" ${ok ? '' : 'title="Room is smaller than ideal"'}><i>${ROOM_TYPES[t.to].icon}</i><b>${esc(r.type === 'balcony' && t.to === 'reading' ? 'Balcony reading corner' : t.label)}</b><br><small class="muted">${ok ? 'Good fit' : 'Tight fit'} · min ${ROOM_TYPES[t.to].min} m²</small></button>`; }).join('')}</div>`;
  if (S.lastTransform && S.lastTransform.room === r.id) { const t = S.lastTransform; h += `<h3>Before → After</h3><div class="ba"><figure><img src="${t.before}"><figcaption>${esc(ROOM_TYPES[t.from].label)} · ${inr(t.c0)}</figcaption></figure><figure><img src="${t.after}"><figcaption>${esc(ROOM_TYPES[t.to].label)} · ${inr(t.c1)}</figcaption></figure></div><button class="btn sm ghost" style="margin-top:8px" data-act="undo">↶ Undo transformation</button>`; }
  return h;
}
function panelArch() {
  const checks = archChecks(FL()); const pj = P();
  let h = `<h2>Architectural Intelligence</h2><p class="muted">Plan validation, circulation, clearances, structure and floors.</p>
  ${checks.map(c => `<div class="issue ${c.lv === 'ok' ? 'ok' : c.lv === 'info' ? 'info' : ''}"><div><b>${esc(c.t)}</b><br><span class="muted">${esc(c.d)}</span>${c.fix ? `<br><button class="btn sm ghost" style="margin-top:5px" data-act="fix" data-k="${c.fix}">${c.fix === 'snap' ? 'Auto-align walls' : 'Add missing doors'}</button>` : ''}</div></div>`).join('')}
  <div class="row" style="margin-top:10px"><button class="btn sm ghost" data-act="overlay-plan" data-o="graph">Show room connectivity</button><button class="btn sm ghost" data-act="view" data-v="2d">Edit walls, doors &amp; windows</button></div>
  <h3>Floors</h3>${pj.floors.map((f, i) => `<div class="sugg"><span>${i === pj.activeFloor ? '●' : '○'}</span><div><b>${esc(f.name)}</b><small>${f.rooms.length} rooms · ceiling ${f.height} m${f.stairs?.length ? ' · staircase' : ''}</small></div><button class="btn sm ghost" data-act="floor-switch" data-i="${i}">${i === pj.activeFloor ? 'Active' : 'View'}</button></div>`).join('')}
  <div class="row" style="margin-top:8px"><button class="btn sm" data-act="add-floor">＋ Add floor above</button><label class="row muted"><input type="checkbox" ${S.showAllFloors ? 'checked' : ''} data-act-change="all-floors"> Show all floors stacked</label></div>
  <label class="field">Ceiling height of ${esc(FL().name)} (m)<input type="number" step="0.05" min="2.4" max="4.5" value="${FL().height}" data-act-change="floor-h"></label>
  <h3>Doors</h3><table class="t"><tr><th>Door</th><th class="r">Width</th><th></th></tr>${FL().doors.map(d => { const rs = FL().rooms.filter(r => roomSideOf(r, d.o, d.x, d.y)).map(r => r.name); return `<tr><td>${d.main ? '<b>Main entry</b> · ' : ''}${esc(rs.join(' ↔ ') || 'exterior')}</td><td class="r">${d.w} m</td><td class="r"><button class="btn sm ghost" data-act="select-door" data-id="${d.id}">Edit</button></td></tr>`; }).join('')}</table>`;
  return h;
}
function panelCompare() {
  const r = selRoom();
  let h = `<h2>Smart Design Comparison</h2><p class="muted">Save variants, compare them side by side, and see before vs after.</p>
  <div class="row"><input id="var-name" placeholder="Variant name" value="Design ${S.variants.length + 1}" style="flex:1"><button class="btn sm primary" data-act="save-variant">Save current</button></div>`;
  if (S.variants.length) {
    h += `<h3>Saved variants</h3>${S.variants.map((v, i) => `<div class="card var"><img src="${v.thumb}"><div><b>${esc(v.name)}</b><br><small class="muted">${v.theme} · ${inr(v.cost)}</small></div><div class="row" style="flex-direction:column;gap:4px"><label class="muted"><input type="checkbox" ${v.cmp ? 'checked' : ''} data-act-change="var-cmp" data-i="${i}"> compare</label><button class="btn sm ghost" data-act="var-restore" data-i="${i}">Restore</button></div></div>`).join('')}`;
    const sel = S.variants.filter(v => v.cmp).slice(0, 3);
    if (sel.length >= 2) h += `<h3>Side by side</h3><div style="overflow:auto"><table class="t"><tr><th></th>${sel.map(v => `<th>${esc(v.name)}</th>`).join('')}</tr>${[['Theme', v => v.theme], ['Total cost', v => inr(v.cost)], ['Furniture', v => inr(v.furniture)], ['Pieces', v => v.pieces], ['Space score', v => v.space], ['Light score', v => v.light], ['Within budget', v => v.cost <= S.prefs.budget ? '✓' : '✗']].map(([n, f]) => `<tr><td class="muted">${n}</td>${sel.map(v => `<td>${f(v)}</td>`).join('')}</tr>`).join('')}</table></div>`;
    else h += `<p class="muted">Tick two or three variants to compare.</p>`;
  } else h += `<div class="card muted">No variants yet. Save one, change the theme or layout, then save another.</div>`;
  h += `<h3>Before / After</h3><button class="btn sm" data-act="before-after">Compare original vs current</button><div id="ba-out">${S.baHTML || ''}</div>
  <h3>Multi-theme comparison</h3>${r ? `<p class="muted">The same ${esc(r.name)} in three styles.</p><button class="btn sm" data-act="multi-theme">Render ${esc(r.name)} in 3 themes</button><div id="mt-out">${S.mtHTML || ''}</div>` : roomPicker('Pick a room to preview in multiple themes')}`;
  return h;
}
function panelReport() {
  const c = homeCost();
  return `<h2>Home Decision Report</h2><p class="muted">One document with dimensions, furniture fit, space utilisation, materials, light and the estimated budget.</p>
  <div class="card"><div class="kv"><span>Rooms</span><b>${allRooms().length}</b><span>Carpet area</span><b>${r2(allRooms().reduce((s, r) => s + area(r), 0))} m²</b><span>Estimated interior</span><b>${inr(c.total)}</b><span>Your budget</span><b>${inr(S.prefs.budget)}</b></div></div>
  <button class="btn primary" data-act="report">📄 Generate report</button>`;
}

/* ---------- inspector ---------- */
function renderInspector() {
  const el = $('#inspector'); if (!el) return; const s = S.sel;
  if (!s || S.touring || (S.view === 'walk' && s.kind !== 'item')) { el.classList.remove('on'); return; }
  let h = '<button class="x" data-act="deselect">✕</button>';
  if (s.kind === 'item') { const f = findItem(s.id); if (!f) { el.classList.remove('on'); return; } const it = f.it, c = CATALOG[it.type];
    h += `<h4>${c.icon} ${c.label}</h4><small class="muted">in ${esc(f.room.name)} · ${inr(c.price[TIER_IX[it.tier]])}</small>
    <div class="two"><label class="field">Width (m)<input type="number" step="0.05" min="0.2" value="${it.w}" data-act-change="it-dim" data-k="w"></label><label class="field">Depth (m)<input type="number" step="0.05" min="0.2" value="${it.d}" data-act-change="it-dim" data-k="d"></label></div>
    <div class="two"><label class="field">Tier<select data-act-change="it-tier">${TIERS.map(t => `<option ${it.tier === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label class="field">Wood finish<select data-act-change="it-finish"><option value="">Theme</option>${Object.keys(WOOD_FINISHES).map(k => `<option ${it.finish === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label></div>
    <label class="field">Upholstery / colour<div class="row"><input type="color" value="${it.color || palette(f.room, it).fabric}" data-act-input="it-color"><button class="btn sm ghost" data-act="it-color-reset">Theme colour</button></div></label>
    <div class="row"><button class="btn sm" data-act="rot" data-d="-90">⟲ 90°</button><button class="btn sm" data-act="rot" data-d="90">⟳ 90°</button><button class="btn sm ghost" data-act="dup">Duplicate</button><button class="btn sm ghost" data-act="del">Delete</button></div><p class="muted" style="font-size:11.5px">Drag it in 3D or 2D to move. R rotates.</p>`; }
  else if (s.kind === 'room') { const r = findRoom(s.id); if (!r) { el.classList.remove('on'); return; } const c = roomCost(r);
    h += `<h4>${ROOM_TYPES[r.type].icon} <input value="${esc(r.name)}" data-act-change="r-name" style="width:180px"></h4>
    <div class="two"><label class="field">Type<select data-act-change="r-type">${Object.entries(ROOM_TYPES).map(([k, v]) => `<option value="${k}" ${r.type === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label><label class="field">Wall<input type="color" value="${roomWall(r)}" data-act-input="wall-custom"></label></div>
    <div class="two"><label class="field">Width (m)<input type="number" step="0.05" value="${r.w}" data-act-change="r-dim" data-k="w"></label><label class="field">Depth (m)<input type="number" step="0.05" value="${r.d}" data-act-change="r-dim" data-k="d"></label></div>
    <label class="field">Floor<select data-act-change="r-floor">${Object.entries(FLOORS).map(([k, v]) => `<option value="${k}" ${roomFloorKey(r) === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
    <div class="kv" style="margin:6px 0"><span>Area</span><b>${r2(area(r))} m² · ${Math.round(area(r) * SQFT)} sq ft</b><span>Estimate</span><b>${inr(c.total)}</b></div>
    <div class="row"><button class="btn sm" data-act="furnish-room">🪄 Furnish</button><button class="btn sm ghost" data-act="focus-room">Focus</button><button class="btn sm ghost" data-act="ask-room">Ask Aria</button><button class="btn sm ghost" data-act="del">Delete</button></div>`; }
  else if (s.kind === 'door' || s.kind === 'window') { const f = FL(); const o = (s.kind === 'door' ? f.doors : f.windows).find(x => x.id === s.id); if (!o) { el.classList.remove('on'); return; }
    h += `<h4>${s.kind === 'door' ? '🚪 Door' : '🪟 Window'}</h4><label class="field">Width (m)<input type="number" step="0.05" min="0.5" max="4" value="${o.w}" data-act-change="op-w"></label>
    ${s.kind === 'window' ? `<div class="two"><label class="field">Sill (m)<input type="number" step="0.05" value="${o.sill}" data-act-change="op-k" data-k="sill"></label><label class="field">Height (m)<input type="number" step="0.05" value="${o.h}" data-act-change="op-k" data-k="h"></label></div>` : `<label class="row muted"><input type="checkbox" ${o.main ? 'checked' : ''} data-act-change="op-main"> Main entrance</label>`}
    <div class="row" style="margin-top:8px"><button class="btn sm ghost" data-act="del">Delete</button></div><p class="muted" style="font-size:11.5px">Drag it along walls in 2D view.</p>`; }
  el.innerHTML = h; el.classList.add('on');
}

/* ---------- chat ---------- */
function addChat(role, text, via) {
  const log = $('#chat-log'); if (!log) return; const m = document.createElement('div'); m.className = 'msg ' + role; m.textContent = text;
  if (role === 'aria' && via) { const s = document.createElement('small'); s.textContent = via === 'on-device' ? 'on-device engine' : 'via ' + via; m.appendChild(s); }
  if (role === 'aria' && S.paintChips) { const w = document.createElement('div'); w.className = 'swatches'; w.innerHTML = S.paintChips.list.map(s => `<button class="sw" title="${esc(s.name)}: ${esc(s.why)}" style="background:${s.hex}" data-act="chat-paint" data-r="${S.paintChips.room}" data-c="${s.hex}" data-n="${esc(s.name)}"></button>`).join(''); m.appendChild(w); S.paintChips = null; }
  log.appendChild(m); log.scrollTop = log.scrollHeight;
}
function chatSuggestions() {
  const r = selRoom(); const rs = allRooms(); const bed = rs.find(x => ['master', 'bedroom'].includes(x.type)), study = rs.find(x => ['study', 'empty', 'guest'].includes(x.type)) || rs.find(x => x.type === 'bedroom');
  const list = [r ? `Paint ${r.name} sage green` : 'Give me a tour', bed ? `Design ${bed.name} under ₹30,000` : null, study ? `Convert ${study.name} into a home office` : null, 'Make the whole home Japandi', 'Italian marble in the living room', 'Show me sunset light', r ? `Suggest colours for ${r.name}` : 'Which room has the least daylight?'].filter(Boolean);
  $('#chat-sugg').innerHTML = list.slice(0, 5).map(t => `<button data-act="chat-sugg" data-t="${esc(t)}">${esc(t)}</button>`).join('');
}
async function sendChat(text) {
  if (!text.trim()) return; addChat('user', text); chatSuggestions();
  const log = $('#chat-log'); const ty = document.createElement('div'); ty.className = 'msg aria'; ty.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>'; log.appendChild(ty); log.scrollTop = log.scrollHeight;
  const out = await askAria(text, tourRoom() || selRoom());
  ty.remove(); addChat('aria', out.reply, out.via); refreshSidePanel(); renderInspector();
  if (out.via === 'on-device' && S.apiKey && S.lastGemmaError) { toast(modelLabel() + ': ' + S.lastGemmaError.slice(0, 110), 4500); S.lastGemmaError = null; }
}

/* ---------- dashboard / onboarding / settings ---------- */
function renderDash() {
  const pf = S.prefs; const cu = currentUser(); $('#dash-hello').textContent = cu ? `Welcome, ${firstName(cu)}` : 'Welcome to DIMORA'; updateUserChips();
  $('#dash-prefs').innerHTML = `<span>Style <b>${pf.style}</b></span><span>Budget <b>${inr(pf.budget)}</b></span><span>Family <b>${pf.family}</b></span>${pf.kids ? '<span><b>Kids</b></span>' : ''}${pf.pets ? '<span><b>Pets</b></span>' : ''}${pf.wfh ? '<span><b>Works from home</b></span>' : ''}<span>Storage <b>${pf.storage}</b></span><span>Furniture <b>${pf.furniture}</b></span>`;
  const list = store.get('projects', []);
  if (!S.apiKey) $('#dash-prefs').innerHTML += `<div class="card" style="width:100%;display:flex;gap:14px;align-items:center;margin-top:10px"><span style="font-size:24px">✦</span><div style="flex:1"><b>Connect an AI model</b><div class="muted" style="font-size:13px">Add a Google AI Studio key (Gemma 4) or a Groq key so AI can read room labels and dimensions from your plans, power Aria's free-form conversation, and write your tour narration. DIMORA still works fully on-device without one.</div></div><button class="btn primary sm" data-act="settings">Add key</button></div>`;
  $('#proj-grid').innerHTML = `<div class="pcard new" data-act="new-upload"><div><div>＋</div><b>New from floor plan</b><small>JPG · PNG · PDF</small></div></div>` + list.map(p => `<div class="pcard" data-act="open-proj" data-id="${p.id}"><div class="th" style="${p.thumb ? `background-image:url(${p.thumb})` : ''}">${p.thumb ? '' : '◇'}</div><div class="pb"><b>${esc(p.name)}</b><small>${p.rooms} rooms · ${esc(p.theme || '')} · ${inr(p.cost || 0)} · ${new Date(p.updated).toLocaleDateString('en-IN')}</small></div><button class="del" data-act="del-proj" data-id="${p.id}">🗑</button></div>`).join('');
  updateGemmaBadge();
}
let ob = null;
function openOnboarding() {
  ob = { step: 0, p: deep(S.prefs) }; renderOnboarding(); $('#modal').classList.add('on');
}
function renderOnboarding() {
  const p = ob.p; const sw = ['#b5c4a8', '#c5d6e3', '#e3d4b8', '#efc2c8', '#cfc3e3', '#f1dc8f', '#c56c4b', '#4f8a8b', '#2e3f5c', '#f4f3ef', '#8a8f5c', '#d4a73a'];
  let body = '';
  if (ob.step === 0) body = `<h3 style="margin:0 0 10px">Preferred interior style</h3><div class="style-grid">${Object.entries(THEMES).map(([n, t]) => `<button class="opt ${p.style === n ? 'on' : ''}" data-act="ob-set" data-k="style" data-v="${n}"><b>${n}</b><div class="dots" style="margin-top:6px">${[t.walls[0], t.wood, t.fabric, t.accent].map(c => `<i style="background:${c}"></i>`).join('')}</div></button>`).join('')}</div>`;
  if (ob.step === 1) body = `<label class="field">Total interior budget: <b style="color:var(--text)">${inr(p.budget)}</b><input type="range" min="100000" max="5000000" step="50000" value="${p.budget}" data-act-input="ob-budget"></label>
    <h3 style="margin:14px 0 8px">Favourite colours <small class="muted">(pick up to 3)</small></h3><div class="swatches">${sw.map(c => `<button class="sw" style="background:${c};${p.colors.includes(c) ? 'outline:3px solid var(--acc);outline-offset:2px' : ''}" data-act="ob-color" data-c="${c}"></button>`).join('')}</div>
    <label class="field" style="margin-top:14px">Furniture preference<div class="seg">${TIERS.map(t => `<button class="${p.furniture === t ? 'on' : ''}" data-act="ob-set" data-k="furniture" data-v="${t}">${{ budget: 'Budget-friendly', standard: 'Mid-range', premium: 'Premium' }[t]}</button>`).join('')}</div></label>`;
  if (ob.step === 2) body = `<div class="two"><label class="field">Family members<input type="number" min="1" max="15" value="${p.family}" data-act-change="ob-num" data-k="family"></label><label class="field">Storage needs<select data-act-change="ob-sel" data-k="storage">${['low', 'medium', 'high'].map(s => `<option ${p.storage === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div>
    ${[['kids', '👶 Children at home'], ['pets', '🐾 Pets'], ['wfh', '💻 Work from home — needs a desk setup']].map(([k, l]) => `<label class="row" style="margin:10px 0"><input type="checkbox" ${p[k] ? 'checked' : ''} data-act-change="ob-chk" data-k="${k}"> ${l}</label>`).join('')}`;
  $('#modal-card').innerHTML = `<button class="x" data-act="modal-close">✕</button><p class="eyebrow">Personalise DIMORA</p><h2>${['How should your home feel?', 'Budget & colours', 'Who lives here?'][ob.step]}</h2><div class="ob-steps">${[0, 1, 2].map(i => `<i class="${i <= ob.step ? 'on' : ''}"></i>`).join('')}</div>${body}
  <div class="row end" style="margin-top:20px">${ob.step ? '<button class="btn ghost" data-act="ob-back">Back</button>' : ''}<button class="btn primary" data-act="ob-next">${ob.step < 2 ? 'Next' : 'Save preferences'}</button></div>`;
}
function modelOptions(prov, ids) {
  if (prov === 'groq') { const list = ids && ids.length ? ids : (S.groqModels || []); if (!list.length) return `<option value="${esc(S.model)}">${esc(S.model || 'Test the connection to load your Groq models')}</option>`; return rankGroq(list).map(id => `<option value="${esc(id)}" ${S.model === id ? 'selected' : ''}>${esc(id)}${/gemma-?4/i.test(id) ? '  ★ Gemma 4' : isVisionId(id) ? '  · vision' : ''}</option>`).join(''); }
  return Object.entries(GEMMA_MODELS).map(([k, v]) => `<option value="${k}" ${S.model === k ? 'selected' : ''}>${v} — ${k}</option>`).join('');
}
function openSettings() {
  const prov = S.provider || providerOf(S.apiKey);
  $('#modal-card').innerHTML = `<button class="x" data-act="modal-close">✕</button><p class="eyebrow">Settings</p><h2>AI connection</h2>
  <p class="muted">DIMORA uses an AI model for floor-plan vision, the Aria assistant, tour narration, style matching and report summaries. Paste either key:</p>
  <ul class="muted" style="font-size:13px;line-height:1.6;padding-left:18px;margin:6px 0 12px"><li><b>Google AI Studio</b> key (<code>AIza…</code>) → Google's open <b>Gemma 4</b> models. Get one at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style="color:#22d3ee">aistudio.google.com/apikey</a></li><li><b>Groq</b> key (<code>gsk_…</code>) → fast models on Groq. DIMORA picks Gemma if your account offers it, otherwise the best available model, plus a vision model for plans</li></ul>
  <label class="field">API key <span id="set-prov" class="tag ${prov === 'groq' ? 'info' : 'ok'}" style="align-self:flex-start">${prov === 'groq' ? 'Groq detected' : 'Google AI Studio'}</span><input type="password" id="set-key" value="${esc(S.apiKey)}" placeholder="AIza… or gsk_…" autocomplete="off"></label>
  <label class="field">Model<select id="set-model">${modelOptions(prov)}</select></label>
  <div class="row"><button class="btn primary" data-act="set-save">Save</button><button class="btn ghost" data-act="set-test">Test connection</button><span id="set-msg" class="muted"></span></div>
  <p class="muted" style="font-size:12px;margin-top:16px">Your key is stored only in this browser's local storage and sent only to ${prov === 'groq' ? 'api.groq.com' : 'generativelanguage.googleapis.com'}. Never put a key in a page you publish. Anyone who opens the page can read it. If DIMORA runs inside a sandboxed preview that blocks outside network calls, open the downloaded file in Chrome/Edge.</p>
  <h3 style="margin-top:20px">Data</h3><button class="btn sm ghost" data-act="clear-data">Clear all saved projects &amp; settings</button>`;
  $('#modal').classList.add('on');
  $('#set-key').addEventListener('input', e => { const p = providerOf(e.target.value.trim()); const t = $('#set-prov'); t.textContent = p === 'groq' ? 'Groq detected' : 'Google AI Studio'; t.className = 'tag ' + (p === 'groq' ? 'info' : 'ok'); $('#set-model').innerHTML = modelOptions(p); });
}
async function applyKey(key, model, test) {
  S.apiKey = key; S.provider = providerOf(key); S.gemmaOK = null;
  if (S.provider === 'groq' && key) {
    const ids = await groqModels(key); S.groqModels = ids; const ranked = rankGroq(ids);
    if (!ranked.length) throw new Error('No chat models on this Groq key');
    S.model = ranked.includes(model) ? model : ranked[0]; S.groqVision = pickGroqVision(ids, S.model);
    $('#set-model') && ($('#set-model').innerHTML = modelOptions('groq', ids));
  } else { S.model = GEMMA_MODELS[model] ? model : 'gemma-4-31b-it'; S.groqVision = null; }
  if (test) return gemma([{ text: 'Reply with exactly: DIMORA OK' }], { maxTokens: 30, timeout: 30000 });
}
/* ---------- upload & detection flow ---------- */
let detectRes = null;
function resetUpload() { $('#up-drop').hidden = false; $('#up-result').hidden = true; $('#file-in').value = ''; $('#use-ai').checked = !!S.apiKey; $('#use-ai').disabled = !S.apiKey; $('#st-detect').className = ''; const n = $('#ai-note'); if (n) n.innerHTML = S.apiKey ? `Using <b>${esc(S.model)}</b>` : `No Gemma 4 key yet — <a data-act="settings" style="color:var(--acc);cursor:pointer">add one</a> so AI can read labels &amp; dimensions. On-device vision still detects walls and rooms.`; }
async function runDetection(url, opts = {}) {
  $('#up-drop').hidden = true; $('#up-result').hidden = false; $('#btn-gen').disabled = true;
  $('#up-img').src = url; $('#up-ov').innerHTML = ''; $$('#up-stage .ovl').forEach(x => x.remove()); $('#det-log').innerHTML = ''; $('#det-rooms').innerHTML = ''; $('#det-counts').innerHTML = '';
  $('#up-stage').classList.add('scanning'); $('#st-detect').className = 'on';
  const log = m => { const li = document.createElement('li'); li.textContent = m; $('#det-log').appendChild(li); $('#det-log').scrollTop = 1e6; };
  S.project = newProject(opts.name || 'My Home'); S.project.planImage = url; S.history = []; S.future = []; S.variants = []; S.structuralLog = []; S.sel = null;
  try {
    await sleep(450);
    detectRes = await detectPlan(url, { log, widthM: opts.widthM ?? $('#plan-width').value, useAI: $('#use-ai').checked, defaultWidth: opts.defaultWidth });
    log(`Built ${FL().rooms.length} rooms, ${FL().doors.length} doors and ${FL().windows.length} windows · ${P().scaleNote}`);
    renderDetection();
    $('#btn-gen').disabled = false;
  } catch (e) { console.error(e); log('⚠ ' + e.message); toast(e.message, 5000); }
  $('#up-stage').classList.remove('scanning');
}
function renderDetection() {
  const res = detectRes; if (!res) return; const f = FL(); const cv = res.cv;
  const toPct = (mx, my) => [((mx / res.mpp) + res.bx0) / cv.W * 100, ((my / res.mpp) + res.by0) / cv.H * 100];
  const ov = []; $$('#up-stage .ovl').forEach(x => x.remove());
  f.rooms.forEach((r, i) => { const [x0, y0] = toPct(r.x, r.y), [x1, y1] = toPct(r.x + r.w, r.y + r.d); ov.push(`<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${ROOM_TYPES[r.type].tint}" fill-opacity=".45" stroke="#7c3aed" stroke-width=".35" vector-effect="non-scaling-stroke" style="animation:pop .4s ease ${i * 0.08}s both"/>`);
    const lb = document.createElement('div'); lb.className = 'ovl'; lb.style.cssText = `position:absolute;left:${(x0 + x1) / 2}%;top:${(y0 + y1) / 2}%;transform:translate(-50%,-50%);background:rgba(11,15,25,.85);color:#fff;border-radius:6px;padding:2px 6px;font-size:11px;font-weight:700;white-space:nowrap;pointer-events:none`; lb.textContent = `${r.name} · ${r.w}×${r.d}`; $('#up-stage').appendChild(lb); });
  f.doors.forEach(d => { const [x, y] = toPct(d.x, d.y); ov.push(`<circle cx="${x}" cy="${y}" r=".9" fill="#ec4899"/>`); });
  f.windows.forEach(w => { const a = w.o === 'h' ? toPct(w.x - w.w / 2, w.y) : toPct(w.x, w.y - w.w / 2), b = w.o === 'h' ? toPct(w.x + w.w / 2, w.y) : toPct(w.x, w.y + w.w / 2); ov.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#2f8fd0" stroke-width="3" vector-effect="non-scaling-stroke"/>`); });
  $('#up-ov').setAttribute('viewBox', '0 0 100 100'); $('#up-ov').setAttribute('preserveAspectRatio', 'none'); $('#up-ov').innerHTML = ov.join('');
  const walls = wallLines(f).length;
  $('#det-counts').innerHTML = [['Walls', walls], ['Rooms', f.rooms.length], ['Doors', f.doors.length], ['Windows', f.windows.length]].map(([n, v]) => `<div><b>${v}</b><span>${n}</span></div>`).join('');
  $('#det-rooms').innerHTML = `<small class="muted">${esc(res.source)} · check names &amp; types before generating</small>` + f.rooms.map(r => `<div class="det-room"><i style="background:${ROOM_TYPES[r.type].tint}"></i><input value="${esc(r.name)}" data-act-change="det-name" data-id="${r.id}"><select data-act-change="det-type" data-id="${r.id}">${Object.entries(ROOM_TYPES).map(([k, v]) => `<option value="${k}" ${k === r.type ? 'selected' : ''}>${v.label}</option>`).join('')}</select><small>${r.w}×${r.d} m</small></div>`).join('');
}
async function generate3D() {
  const f = FL(); if (!f.rooms.length) return;
  P().name = P().name === 'My Home' ? `${f.rooms.filter(r => ['bedroom', 'master', 'guest'].includes(r.type)).length || 1}BHK Home` : P().name;
  P().theme = S.prefs.style; furnishAll();
  S.original = deep(S.project);
  openWorkspace(true);
}
function openWorkspace(fresh) {
  show('work');
  if (!E) { init3D(); init2D(); }
  $('#proj-name').value = P().name;
  S.sel = null; S.view = '3d'; $('#app').dataset.view = '3d'; $$('#view-seg button').forEach(b => b.classList.toggle('on', b.dataset.v === '3d'));
  if (!S.original) S.original = deep(S.project);
  rebuild(); renderFloorSeg();
  fitView(false); if (fresh) { CTL.orbit.r *= 1.25; CTL.apply(); fitView(true); startBuildAnim(); }
  openPanel(S.panel || 'design'); renderInspector(); updateGemmaBadge(); chatSuggestions();
  if (!$('#chat-log').children.length) addChat('aria', `Hi${currentUser() ? ' ' + firstName(currentUser()) : ''}! I'm Aria. ${ariaGoalLine()}Your ${P().name} is ready in 3D with ${allRooms().length} rooms, furnished in ${P().theme} style. Ask me to change anything — or press “AI Home Tour” and I'll walk you through it.`);
  if (fresh && window.innerWidth > 1480) $('#app').classList.add('chat-open');
  setTimeout(() => save(true), 2600);
}
function renderFloorSeg() { const el = $('#floor-seg'); if (!el) return; const pj = P(); el.style.display = pj.floors.length > 1 ? '' : 'none'; el.innerHTML = pj.floors.map((f, i) => `<button class="${i === pj.activeFloor ? 'on' : ''}" data-act="floor-switch" data-i="${i}">${esc(f.name.replace(' Floor', ''))}</button>`).join(''); }

/* ---------- compare helpers ---------- */
function renderWith(project, pos, target, w = 420, h = 270) {
  const saved = S.project, cam = { p: E.cam.pos.slice(), t: E.cam.target.slice() };
  S.project = project; rebuild(); E.cam.pos = pos; E.cam.target = target; const img = E.snapshot(w, h);
  S.project = saved; rebuild(); E.cam.pos = cam.p; E.cam.target = cam.t; E.dirty = true; return img;
}
function roomCam(r) { const f = floorOfRoom(r); const c = [r.x + r.w / 2, floorY(f) + 0.5, r.y + r.d / 2]; const R = Math.max(r.w, r.d) * 1.1 + 2; return { pos: [c[0] - R * 0.5, c[1] + R * 0.95, c[2] + R * 0.75], target: c }; }
function homeCam() { const b = homeBounds(FL()); const c = [b.x + b.w / 2, floorY(FL()), b.y + b.d / 2]; const R = Math.max(b.w, b.d) * 1.25 + 4; return { pos: [c[0] - R * 0.5, c[1] + R * 0.85, c[2] + R * 0.7], target: c }; }

/* ---------- report ---------- */
function planSVGStatic(f, W = 760) {
  const b = homeBounds(f), s = (W - 40) / b.w, H = b.d * s + 40; const X = x => 20 + (x - b.x) * s, Y = y => 20 + (y - b.y) * s; const o = [];
  f.rooms.forEach(r => o.push(`<rect x="${X(r.x)}" y="${Y(r.y)}" width="${r.w * s}" height="${r.d * s}" fill="${ROOM_TYPES[r.type].tint}"/>`));
  f.rooms.forEach(r => r.furniture.forEach(it => o.push(`<g transform="translate(${X(it.x)} ${Y(it.y)}) rotate(${-it.rot})"><rect x="${-it.w * s / 2}" y="${-it.d * s / 2}" width="${it.w * s}" height="${it.d * s}" fill="#fff" fill-opacity=".7" stroke="#8a7f70" stroke-width=".8"/></g>`)));
  wallPieces(f).forEach(p => { const t = (p.ext ? 0.2 : 0.12) * s; if (p.kind === 'solid') o.push(p.o === 'h' ? `<rect x="${X(p.a) - t / 2}" y="${Y(p.c) - t / 2}" width="${(p.b - p.a) * s + t}" height="${t}" fill="#2c2924"/>` : `<rect x="${X(p.c) - t / 2}" y="${Y(p.a) - t / 2}" width="${t}" height="${(p.b - p.a) * s + t}" fill="#2c2924"/>`); else if (p.kind === 'sill') o.push(p.o === 'h' ? `<line x1="${X(p.a)}" y1="${Y(p.c)}" x2="${X(p.b)}" y2="${Y(p.c)}" stroke="#2f8fd0" stroke-width="${t * 0.6}"/>` : `<line x1="${X(p.c)}" y1="${Y(p.a)}" x2="${X(p.c)}" y2="${Y(p.b)}" stroke="#2f8fd0" stroke-width="${t * 0.6}"/>`); });
  f.rooms.forEach(r => o.push(`<text x="${X(r.x + r.w / 2)}" y="${Y(r.y + r.d / 2)}" text-anchor="middle" font-size="11" font-weight="700" font-family="Manrope,Arial">${esc(r.name)}</text><text x="${X(r.x + r.w / 2)}" y="${Y(r.y + r.d / 2) + 13}" text-anchor="middle" font-size="9.5" fill="#5f5649" font-family="Manrope,Arial">${r.w} × ${r.d} m</text>`));
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg">${o.join('')}</svg>`;
}
async function openReport() {
  const pj = P(), c = homeCost(), f = FL(); const rooms = allRooms(); const A = rooms.reduce((s, r) => s + area(r), 0);
  let img = ''; try { const hc = homeCam(); img = renderWith(S.project, hc.pos, hc.target, 900, 520); } catch (e) { }
  const sp = rooms.map(r => ({ r, a: analyzeSpace(r), L: analyzeLight(r), c: roomCost(r) }));
  const avgS = Math.round(sp.reduce((s, x) => s + x.a.score, 0) / sp.length), avgL = Math.round(sp.reduce((s, x) => s + x.L.score, 0) / sp.length);
  const checks = archChecks(f); const saves = rooms.flatMap(r => cheaperAlternatives(r).slice(0, 2).map(a => ({ r, a }))).sort((x, y) => y.a.save - x.a.save).slice(0, 6);
  const recs = [...sp.filter(x => x.a.corner).map(x => `${x.r.name}: convert the unused ${r2(x.a.corner.w)}×${r2(x.a.corner.d)} m corner into a study/reading corner or storage.`), ...sp.filter(x => x.L.suggestWindow).map(x => `${x.r.name}: add a ${x.L.suggestWindow.compass}-facing window for ${['Limited', 'Poor', 'No daylight'].includes(x.L.rating) ? 'daylight' : 'cross-ventilation'}.`), ...sp.flatMap(x => x.a.issues.slice(0, 1).map(i => `${x.r.name}: ${i}`))].slice(0, 10);
  const summaryId = 'rep-sum';
  const localSum = `${pj.name} offers ${r2(A)} m² (${Math.round(A * SQFT)} sq ft) across ${rooms.length} rooms in a ${pj.theme} scheme. The full interior is estimated at ${inr(c.total)} against a budget of ${inr(S.prefs.budget)} (${c.total <= S.prefs.budget ? 'within budget' : inr(c.total - S.prefs.budget) + ' over'}). Average space-utilisation score is ${avgS}/100 and daylight score ${avgL}/100. ${recs[0] ? 'Top opportunity — ' + recs[0] : ''}`;
  const html = `<div class="rep-bar"><b>Home Decision Report</b><button class="btn sm" data-act="rep-print">🖨 Print / PDF</button><button class="btn sm" data-act="rep-download">⬇ Download HTML</button><button class="btn sm" data-act="rep-copy">Copy summary</button><button class="btn sm primary" data-act="rep-close">Close</button></div>
  <div class="rep" id="rep-doc"><p style="letter-spacing:.2em;font-size:11px;font-weight:800;color:#9a4d12;margin:0">DIMORA · HOME DECISION REPORT</p><h1>${esc(pj.name)}</h1><p class="note">${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · Theme: ${esc(pj.theme)} · Household of ${S.prefs.family}${S.prefs.kids ? ' with children' : ''}${S.prefs.pets ? ' and pets' : ''}${S.prefs.wfh ? ', works from home' : ''} · ${esc(pj.scaleNote || '')}</p>
  <div class="kpis"><div><b>${r2(A)} m²</b><span>carpet area · ${Math.round(A * SQFT)} sq ft</span></div><div><b>${inr(c.total)}</b><span>estimated interior</span></div><div><b>${avgS}/100</b><span>space utilisation</span></div><div><b>${avgL}/100</b><span>daylight &amp; airflow</span></div></div>
  <h2>Executive summary</h2><p id="${summaryId}">${esc(localSum)}</p>
  ${img ? `<img src="${img}" alt="3D view">` : ''}<h2>Floor plan — ${esc(f.name)}</h2>${planSVGStatic(f)}
  <h2>Room schedule</h2><table><tr><th>Room</th><th>Size</th><th class="r">Area</th><th>Walls</th><th>Floor</th><th>Space</th><th>Daylight</th><th class="r">Estimate</th></tr>${sp.map(x => `<tr><td><b>${esc(x.r.name)}</b><br><span class="note">${ROOM_TYPES[x.r.type].label}</span></td><td>${x.r.w} × ${x.r.d} m</td><td class="r">${r2(area(x.r))} m²</td><td><span class="sw" style="background:${roomWall(x.r)}"></span> ${roomWall(x.r)}</td><td>${FLOORS[roomFloorKey(x.r)].label}</td><td>${x.a.status} (${x.a.score})</td><td>${x.L.rating}${x.L.dirs.length ? ' · ' + x.L.dirs.join('/') : ''}</td><td class="r">${inr(x.c.total)}</td></tr>`).join('')}</table>
  <h2>Budget breakdown</h2><table><tr><th>Category</th><th class="r">Estimate</th><th class="r">Share</th></tr>${[['Furniture', c.furniture], ['Flooring', c.flooring], ['Wall painting', c.paint], ['Lighting', c.lighting], ['False ceiling', c.ceiling], ['Decor & curtains', c.decor]].map(([n, v]) => `<tr><td>${n}</td><td class="r">${inr(v)}</td><td class="r">${Math.round(v / c.total * 100)}%</td></tr>`).join('')}<tr><td><b>Total</b></td><td class="r"><b>${inr(c.total)}</b></td><td class="r">Budget ${inr(S.prefs.budget)}</td></tr></table>
  ${saves.length ? `<h3>Ways to save</h3><ul>${saves.map(x => `<li>${esc(x.r.name)} — ${esc(x.a.what)}: save ${inr(x.a.save)}</li>`).join('')}</ul>` : ''}
  <h2>Furniture fit &amp; space utilisation</h2><table><tr><th>Room</th><th>Furniture</th><th class="r">Cover</th><th>Findings</th></tr>${sp.map(x => `<tr><td>${esc(x.r.name)}</td><td>${x.r.furniture.map(i => CATALOG[i.type].label).join(', ') || '—'}</td><td class="r">${Math.round(x.a.coverage * 100)}%</td><td>${esc(x.a.issues[0] || (x.a.corner ? `Unused ${r2(x.a.corner.area)} m² corner` : 'Comfortable clearances'))}</td></tr>`).join('')}</table>
  <h2>Selected materials &amp; finishes</h2><table><tr><th>Room</th><th>Flooring</th><th>Paint tier</th><th>Ceiling</th><th>Lighting</th></tr>${rooms.map(r => `<tr><td>${esc(r.name)}</td><td>${FLOORS[roomFloorKey(r)].label}</td><td>${PAINT[r.tier].label}</td><td>${CEILINGS[roomCeiling(r)].label}</td><td>${['ambient', 'task', 'accent'].filter(k => r.lights?.[k]).join(', ') || '—'}</td></tr>`).join('')}</table>
  <h2>Light &amp; ventilation</h2><ul>${sp.map(x => `<li><b>${esc(x.r.name)}</b>: ${x.L.rating} daylight (window/floor ${Math.round(x.L.wfr * 100)}%), ${x.L.vent.toLowerCase()}.${x.L.sugg[0] ? ' ' + esc(x.L.sugg[0]) : ''}</li>`).join('')}</ul>
  <h2>Architectural checks</h2><ul>${checks.map(ch => `<li><b>${esc(ch.t)}</b> — ${esc(ch.d)}</li>`).join('')}</ul>
  <h2>Recommendations</h2><ul>${recs.map(r => `<li>${esc(r)}</li>`).join('') || '<li>The layout is well balanced.</li>'}</ul>
  <p class="note" style="margin-top:30px">Cost figures are illustrative estimates for Indian metro markets, not market quotations. Structural observations are indicative only — consult a licensed architect or structural engineer before construction.</p></div>`;
  $('#report').innerHTML = html; $('#report').classList.add('on'); $('#report').scrollTop = 0;
  if (S.apiKey) { const el = document.getElementById(summaryId); el.innerHTML = esc(localSum) + ' <span class="note">(${esc(modelLabel())} is writing a sharper summary…)</span>';
    try { const out = await gemma([{ text: `Write a crisp 4-sentence executive summary for a homeowner's decision report. Facts: ${localSum} Room facts: ${rooms.map(r => roomFacts(r).line).join(' | ')}. Recommendations: ${recs.join(' ')}. Plain text, no markdown.` }], { temperature: 0.5, maxTokens: 600 }); el.textContent = out.trim(); } catch (e) { el.textContent = localSum; } }
}

/* ---------- action dispatcher ---------- */
const ACT = {
  'go-landing': () => show('landing'), 'go-dash': () => { if (S.touring) stopTour(); show('dash'); }, scroll: el => document.getElementById(el.dataset.to)?.scrollIntoView({ behavior: 'smooth' }),
  start: () => { if (!S.prefs.onboarded) { show('dash'); openOnboarding(); } else show('dash'); },
  onboard: () => openOnboarding(), settings: () => openSettings(), 'modal-close': () => $('#modal').classList.remove('on'),
  sample: () => { sampleHome(); P().theme = S.prefs.style; S.history = []; S.future = []; S.variants = []; S.structuralLog = []; furnishAll(); S.original = deep(S.project); openWorkspace(true); },
  'new-upload': () => { show('upload'); resetUpload(); }, 'pick-file': () => $('#file-in').click(),
  'sample-plan': () => { const keep = S.project; sampleHome(); const { url, widthM } = drawPlanImage(S.project); S.project = keep; runDetection(url, { widthM, name: 'Sample Plan — 2BHK' }); },
  generate: () => generate3D(),
  'open-proj': el => { const p = store.get('proj_' + el.dataset.id); if (!p) return toast('Project not found'); S.project = p; S.history = []; S.future = []; S.variants = []; S.original = deep(p); S.structuralLog = []; openWorkspace(false); },
  'del-proj': (el, e) => { e.stopPropagation(); try { localStorage.removeItem('dimora_proj_' + el.dataset.id); } catch (x) { } store.set('projects', store.get('projects', []).filter(p => p.id !== el.dataset.id)); renderDash(); },
  'ob-set': el => { ob.p[el.dataset.k] = el.dataset.v; renderOnboarding(); }, 'ob-color': el => { const c = el.dataset.c, a = ob.p.colors; const i = a.indexOf(c); if (i >= 0) a.splice(i, 1); else { a.push(c); if (a.length > 3) a.shift(); } renderOnboarding(); },
  'ob-back': () => { ob.step--; renderOnboarding(); }, 'ob-next': () => { if (ob.step < 2) { ob.step++; renderOnboarding(); } else { ob.p.onboarded = true; S.prefs = ob.p; store.set('prefs', S.prefs); $('#modal').classList.remove('on'); toast('Preferences saved — DIMORA will design around them'); renderDash(); if (S.project) { refreshSidePanel(); } } },
  'set-save': async () => { const key = $('#set-key').value.trim(), model = $('#set-model').value; const m = $('#set-msg'); m.textContent = 'Saving…';
    try { await applyKey(key, model, false); } catch (e) { m.textContent = '✗ ' + e.message.slice(0, 140); m.style.color = '#f9a8d4'; S.model = model || S.model; }
    store.set('key', S.apiKey); store.set('model', S.model); store.set('groq', { models: S.groqModels || [], vision: S.groqVision || null }); updateGemmaBadge(); $('#modal').classList.remove('on');
    toast(!S.apiKey ? 'Running on the on-device engine' : S.provider === 'groq' ? `Groq connected · ${S.model}${S.groqVision && S.groqVision !== S.model ? ' + ' + S.groqVision + ' for vision' : ''}${/gemma/i.test(S.model) ? '' : ' (no Gemma 4 on this Groq key)'}` : 'Gemma 4 key saved', 5000); },
  'set-test': async () => { const m = $('#set-msg'); m.textContent = 'Testing…'; m.style.color = ''; try { const t = await applyKey($('#set-key').value.trim(), $('#set-model').value, true); m.textContent = `✓ ${S.model}: ${t.slice(0, 30)}`; m.style.color = '#34d399'; } catch (e) { m.textContent = '✗ ' + e.message.slice(0, 140); m.style.color = '#f9a8d4'; } },
  'clear-data': () => { try { Object.keys(localStorage).filter(k => k.startsWith('dimora_')).forEach(k => localStorage.removeItem(k)); } catch (e) { } location.reload(); },
  view: el => setView(el.dataset.v), preset: el => presetView(el.dataset.v),
  panel: el => { if (S.panel === el.dataset.p && $('#app').classList.contains('side-open') && window.innerWidth < 820) { $('#app').classList.remove('side-open'); return; } openPanel(el.dataset.p); },
  'toggle-chat': () => { $('#app').classList.toggle('chat-open'); if (E) E.dirty = true; if (S.view === '2d') { V2.init = false; render2D(); } },
  undo: () => undo(), redo: () => redo(),
  'toggle-cut': () => { S.cutaway = !S.cutaway; $('#t-cut').classList.toggle('on', S.cutaway); rebuild(); },
  'toggle-labels': () => { S.labels = !S.labels; $('#t-lab').classList.toggle('on', S.labels); E.dirty = true; },
  'toggle-sun': () => { S.daylightSim = !S.daylightSim; $('#t-sun').classList.toggle('on', S.daylightSim); rebuild(); if (S.daylightSim) toast('Sunlight now enters only through windows & doors — move the time slider'); },
  'play-day': () => { if (S.dayTimer) { clearInterval(S.dayTimer); S.dayTimer = null; return; } if (!S.daylightSim) { S.daylightSim = true; $('#t-sun').classList.add('on'); rebuild(); } let h = 6; S.dayTimer = setInterval(() => { h += 0.08; setHour(h); const lh = $('#lt-h'); if (lh) lh.textContent = fmtHour(h); if (h >= 19.2) { clearInterval(S.dayTimer); S.dayTimer = null; } }, 50); },
  tool: el => setTool(el.dataset.t), overlay: el => { S.overlay = el.dataset.o; $$('[data-act=overlay]').forEach(b => b.classList.toggle('on', b.dataset.o === S.overlay)); render2D(); },
  'overlay-plan': el => { setView('2d'); S.overlay = el.dataset.o; $$('[data-act=overlay]').forEach(b => b.classList.toggle('on', b.dataset.o === S.overlay)); render2D(); },
  'select-room': el => { const r = findRoom(el.dataset.id); if (!r) return; select({ kind: 'room', id: r.id }); if (S.view !== '2d') focusRoom(r); refreshSidePanel(); },
  'select-item': el => { select({ kind: 'item', id: el.dataset.id }); }, 'select-door': el => { setView('2d'); select({ kind: 'door', id: el.dataset.id }); },
  deselect: () => select(null), 'focus-room': () => { const r = selRoom(); if (r) focusRoom(r); },
  'ask-room': () => { const r = selRoom(); $('#app').classList.add('chat-open'); $('#chat-input').value = r ? `Make ${r.name} ` : ''; $('#chat-input').focus(); },
  theme: el => { commit('Theme'); applyTheme(el.dataset.t); rebuild(); save(true); toast(`${el.dataset.t}: ${THEMES[el.dataset.t].desc}`); },
  'furnish-all': el => { commit('Furnish all'); S.project.floors.forEach(f => f.rooms.forEach(r => autoFurnish(r, f, el.dataset.v ? 1 + Math.floor(Math.random() * 3) : 0))); rebuild(); save(); toast('Furnished every room with clearances respected'); },
  'furnish-room': el => { const r = selRoom(); if (!r) return; commit('Furnish'); autoFurnish(r, floorOfRoom(r), el.dataset.v ? 1 + Math.floor(Math.random() * 3) : 0); rebuild(); save(); toast(`${el.dataset.v ? 'New arrangement for' : 'Furnished'} ${r.name}`); },
  'clear-room': () => { const r = selRoom(); if (!r) return; commit('Clear'); r.furniture = []; rebuild(); save(); },
  wall: el => { const r = selRoom(); if (!r) return; commit('Paint'); r.wall = el.dataset.c; rebuild(); save(); },
  floor: el => { const r = selRoom(); if (!r) return; commit('Floor'); r.floor = el.dataset.k; rebuild(); save(); },
  ceiling: el => { const r = selRoom(); if (!r) return; commit('Ceiling'); r.ceiling = el.dataset.k; rebuild(); save(); toast('Ceilings are visible from inside — try Walk mode'); },
  'time-eve': () => setHour(20),
  cat: el => { S.cat = el.dataset.c; refreshSidePanel(); },
  'add-item': el => { const r = selRoom(); const t = el.dataset.t; if (!r) { if (S.view !== '2d') setView('2d'); setTool('place', t); return; } const res = execActions([{ do: 'add', room: r.id, item: t }], r); toast(res.done[0] || res.fail[0] || 'Could not place'); refreshSidePanel(); },
  'del-item': el => { const f = findItem(el.dataset.id); if (!f) return; commit('Delete'); f.room.furniture.splice(f.room.furniture.indexOf(f.it), 1); rebuild(); save(); },
  rot: el => rotateSelected(+el.dataset.d), del: () => deleteSelected(),
  dup: () => { const f = S.sel && findItem(S.sel.id); if (!f) return; commit('Duplicate'); const it = deep(f.it); it.id = uid('i'); it.x = r2(it.x + 0.3); it.y = r2(it.y + 0.3); f.room.furniture.push(it); S.sel = { kind: 'item', id: it.id }; rebuild(); renderInspector(); save(); },
  'it-color-reset': () => { const f = S.sel && findItem(S.sel.id); if (!f) return; commit('Colour'); f.it.color = null; rebuild(); renderInspector(); },
  corner: el => { const r = selRoom(); if (!r) return; const a = analyzeSpace(r); if (!a.corner) return; commit('Use corner'); const k = el.dataset.k; const f = floorOfRoom(r); const cc = [a.corner.x + a.corner.w / 2, a.corner.y + a.corner.d / 2];
    const sides = [a.corner.cy ? 'S' : 'N', a.corner.cx ? 'E' : 'W']; const tAlong = s => s === 'N' || s === 'S' ? cc[0] : cc[1];
    const wallPlace = (type) => { for (const s of sides) { const it = placeOnWall(r, f, type, s, { align: 'near', t0: tAlong(s) }); if (it && rectOverlap(itemFootprint(it), { x: a.corner.x - 0.3, y: a.corner.y - 0.3, w: a.corner.w + 0.6, d: a.corner.d + 0.6 }) > 0.05) { r.furniture.push(it); return it; } } const it = placeFree(r, f, type, { near: cc }); if (it) r.furniture.push(it); return it; };
    if (k === 'study') { const d = wallPlace('desk'); if (d) addChairFor(r, f, d); } else if (k === 'reading') { const ac = placeFree(r, f, 'armchair', { near: cc }); if (ac) { r.furniture.push(ac); const l = placeFree(r, f, 'floor_lamp', { near: cc }); if (l) r.furniture.push(l); } wallPlace('bookshelf'); } else { wallPlace('storage_cabinet'); wallPlace('bookshelf'); }
    rebuild(); save(); toast(`Converted the unused corner into a ${k === 'study' ? 'study corner' : k === 'reading' ? 'reading nook' : 'storage zone'}`); },
  transform: async el => { const r = selRoom(); if (!r) return; const cam = roomCam(r); let before = ''; try { before = renderWith(S.project, cam.pos, cam.target); } catch (e) { } const c0 = roomCost(r).total, from = r.type; commit('Transform'); const res = transformRoom(r, el.dataset.t); rebuild(); let after = ''; try { after = renderWith(S.project, cam.pos, cam.target); } catch (e) { } S.lastTransform = { room: r.id, before, after, from, to: el.dataset.t, c0, c1: res.after }; if (S.panel !== 'transform') openPanel('transform'); else refreshSidePanel(); save(); toast(`${ROOM_TYPES[from].label} → ${ROOM_TYPES[el.dataset.t].label}`); focusRoom(r); },
  'fit-check': () => { const r = selRoom(); if (!r) return; const t = $('#fit-type').value; S.fitType = t; const w = +$('#fit-w').value || null, d = +$('#fit-d').value || null; const res = fitCheck(t, r, floorOfRoom(r), w || d ? { w: w || CATALOG[t].w, d: d || CATALOG[t].d } : null); S.fitRes = res; S.fitOut = `<div class="issue ${res.ok ? 'ok' : ''}" style="margin-top:8px">${esc(res.msg)}</div>${res.ok ? '<button class="btn sm primary" data-act="fit-place">Place it there</button>' : ''}`; refreshSidePanel(); },
  'fit-place': () => { const r = selRoom(); if (!r || !S.fitRes?.item) return; commit('Place'); r.furniture.push(S.fitRes.item); S.fitOut = ''; S.fitRes = null; rebuild(); save(); },
  'optimize-all': () => { commit('Optimise'); S.lastOptimize = optimizeBudget(allRooms(), S.prefs.budget); rebuild(); save(); toast(S.lastOptimize.ok ? 'Design now fits your budget' : 'Got as close as possible'); },
  optimize: () => { const id = $('#opt-room').value, amt = +$('#opt-amt').value; if (!amt) return; commit('Optimise'); const rs = id === 'all' ? allRooms() : [findRoom(id)]; S.lastOptimize = optimizeBudget(rs, amt); rebuild(); save(); toast(S.lastOptimize.ok ? `Done — ${inr(S.lastOptimize.end)}` : `Closest possible: ${inr(S.lastOptimize.end)}`); },
  alt: el => { const r = selRoom(); if (!r) return; const a = cheaperAlternatives(r)[+el.dataset.i]; if (!a) return; commit('Cheaper'); a.apply(); rebuild(); save(); toast(`Saved ${inr(a.save)}`); },
  'set-tier-all': el => { commit('Tier'); const t = el.dataset.t; allRooms().forEach(r => { r.tier = t; r.furniture.forEach(i => i.tier = t); }); rebuild(); save(); },
  'add-window-sugg': () => { const r = selRoom(); if (!r) return; const L = analyzeLight(r); if (!L.suggestWindow) return; commit('Window'); floorOfRoom(r).windows.push(Object.assign({ id: uid('w') }, L.suggestWindow.w)); rebuild(); save(); toast(`Added a ${L.suggestWindow.compass}-facing window to ${r.name}`); },
  fix: el => { commit('Fix'); if (el.dataset.k === 'snap') snapRooms(FL(), 0.3); else autoOpenings(FL(), { windows: false }); rebuild(); save(); toast('Plan corrected'); },
  'floor-switch': el => { P().activeFloor = +el.dataset.i; S.sel = null; rebuild(); renderFloorSeg(); fitView(true); },
  'add-floor': () => { commit('Add floor'); const pj = P(); const top = pj.floors[pj.floors.length - 1]; const nf = newFloor(['Ground', 'First', 'Second', 'Third', 'Fourth'][pj.floors.length] + ' Floor', top.level + 1); nf.height = top.height;
    const map = {}; top.rooms.forEach(r => { const nr = makeRoom({ name: r.name.replace(/\d+$/, '') + (r.type === 'living' ? ' (Upper)' : ''), type: r.type === 'living' ? 'living' : r.type, x: r.x, y: r.y, w: r.w, d: r.d }); map[r.id] = nr; nf.rooms.push(nr); });
    nf.doors = top.doors.filter(d => !d.main).map(d => Object.assign({}, d, { id: uid('d') })); nf.windows = top.windows.map(w => Object.assign({}, w, { id: uid('w') }));
    const hub = top.rooms.find(r => r.type === 'hall' && Math.max(r.w, r.d) >= 3) || top.rooms.find(r => r.type === 'living') || top.rooms[0];
    if (hub) { const vert = hub.d >= hub.w; const st = { id: uid('s'), w: vert ? 1.0 : 3.0, d: vert ? 3.0 : 1.0, x: hub.x + hub.w - (vert ? 0.6 : 1.7), y: hub.y + hub.d - (vert ? 1.7 : 0.6) }; if (!vert) { st.w = 1.0; st.d = 3.0; st.x = hub.x + 0.6; st.y = clamp(hub.y + hub.d / 2, hub.y + 1.5, hub.y + hub.d - 1.5); } top.stairs = [st]; }
    nf.rooms.forEach(r => autoFurnish(r, nf)); pj.floors.push(nf); pj.activeFloor = pj.floors.length - 1; rebuild(); renderFloorSeg(); refreshSidePanel(); fitView(true); save(); toast(`${nf.name} added with a staircase`); },
  'save-variant': () => { if (!E) return; const name = ($('#var-name') && $('#var-name').value) || `Design ${S.variants.length + 1}`; const hc = homeCam(); const thumb = renderWith(S.project, hc.pos, hc.target, 300, 190); const c = homeCost(); const rooms = allRooms(); S.variants.push({ name, thumb, project: deep(S.project), cost: c.total, furniture: c.furniture, theme: P().theme, pieces: rooms.reduce((s, r) => s + r.furniture.length, 0), space: Math.round(rooms.reduce((s, r) => s + analyzeSpace(r).score, 0) / rooms.length), light: Math.round(rooms.reduce((s, r) => s + analyzeLight(r).score, 0) / rooms.length), cmp: S.variants.filter(v => v.cmp).length < 3 }); toast(`Saved “${name}”`); openPanel('compare'); },
  'var-restore': el => { commit('Restore'); S.project = deep(S.variants[+el.dataset.i].project); S.sel = null; rebuild(); save(); toast('Variant restored'); },
  'before-after': () => { if (!S.original) return; const hc = homeCam(); const a = renderWith(S.original, hc.pos, hc.target, 640, 400), b = renderWith(S.project, hc.pos, hc.target, 640, 400); const c0 = (() => { const sv = S.project; S.project = S.original; const v = homeCost().total; S.project = sv; return v; })(); S.baHTML = `<div class="cmp" style="margin-top:8px"><img src="${b}"><div class="after" id="ba-after"><img src="${a}" style="width:${$('#side').clientWidth - 32}px"></div><span class="lb" style="left:8px">Original · ${inr(c0)}</span><span class="lb" style="right:8px">Current · ${inr(homeCost().total)}</span><input type="range" min="0" max="100" value="50" data-act-input="ba-slide"></div>`; refreshSidePanel(); },
  'multi-theme': () => { const r = selRoom(); if (!r) return; const cam = roomCam(r); const cur = r.theme || P().theme; const picks = [cur, ...Object.keys(THEMES).filter(t => t !== cur).sort(() => Math.random() - 0.5).slice(0, 2)]; const out = picks.map(t => { const pj = deep(S.project); const saved = S.project; S.project = pj; const rr = findRoom(r.id); applyTheme(t, [rr]); const cost = roomCost(rr).total; S.project = saved; return { t, img: renderWith(pj, cam.pos, cam.target, 300, 200), cost }; }); S.mtHTML = out.map(o => `<div class="card"><img src="${o.img}" style="width:100%;border-radius:8px"><div class="row" style="justify-content:space-between;margin-top:6px"><b>${o.t}</b><span class="muted">${inr(o.cost)}</span><button class="btn sm ghost" data-act="room-theme-apply" data-t="${o.t}">Apply</button></div></div>`).join(''); refreshSidePanel(); },
  'room-theme-apply': el => { const r = selRoom(); if (!r) return; commit('Room theme'); applyTheme(el.dataset.t, [r]); rebuild(); save(); },
  'pick-insp': () => $('#insp-in').click(), 'apply-insp': () => { const x = S.insp; if (!x) return; commit('Inspiration'); const r = selRoom(); const rooms = r ? [r] : allRooms(); if (r) applyTheme(x.style, [r]); else applyTheme(x.style); rooms.forEach(rr => { if (!['bathroom', 'utility'].includes(rr.type)) rr.wall = x.wall; if (x.floor && !['bathroom', 'utility', 'balcony'].includes(rr.type)) rr.floor = x.floor; if (x.finish) rr.furniture.forEach(i => i.finish = x.finish); }); rebuild(); save(); toast(`Recreated the ${x.style} look`); },
  report: () => openReport(), 'rep-close': () => $('#report').classList.remove('on'),
  'rep-print': () => { try { window.print(); } catch (e) { toast('Printing is blocked here — use Download HTML'); } },
  'rep-download': () => { const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(P().name)} — DIMORA report</title><style>body{font-family:Manrope,Arial,sans-serif;background:#eee;margin:0}.rep{max-width:900px;margin:20px auto;background:#fff;padding:48px;line-height:1.55;color:#2c2924}h1,h2{font-family:Georgia,serif}table{width:100%;border-collapse:collapse;font-size:12.5px}th{text-align:left;background:#f3eee5;padding:7px}td{padding:7px;border-bottom:1px solid #ece6db}.r{text-align:right}img{max-width:100%}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.kpis div{background:#f6f1e8;padding:12px;border-radius:8px}.kpis b{display:block;font-size:20px}.sw{display:inline-block;width:14px;height:14px;border-radius:4px}.note{font-size:11.5px;color:#6b6356}</style></head><body>${$('#rep-doc').outerHTML}</body></html>`; try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([doc], { type: 'text/html' })); a.download = P().name.replace(/\W+/g, '_') + '_DIMORA_report.html'; document.body.appendChild(a); a.click(); a.remove(); toast('Report downloaded'); } catch (e) { toast('Download blocked here — use Copy summary'); } },
  'rep-copy': () => { const t = $('#rep-doc').innerText; navigator.clipboard?.writeText(t).then(() => toast('Report text copied'), () => toast('Clipboard blocked')); },
  tour: () => { if (S.touring) stopTour(); else startTour(); }, 'tour-stop': () => stopTour(), 'tour-play': () => tourTogglePause(), 'tour-next': () => tourJump(1), 'tour-prev': () => tourJump(-1), 'tour-go': el => tourGo(+el.dataset.i),
  'tour-voice': () => { TOUR.voice = !TOUR.voice; if (!TOUR.voice) stopSpeech(); renderTourUI(); },
  'tour-wall': el => tourApply([{ do: 'wall_color', room: tourRoom()?.id, color: el.dataset.c, name: el.dataset.n }], `Done — ${tourRoom()?.name} is now ${el.dataset.n}. ${['Lovely choice', 'That really opens it up', 'Much calmer'][Math.floor(Math.random() * 3)]}!`),
  'tour-theme': el => tourApply([{ do: 'theme', name: el.dataset.t, room: tourRoom()?.id }]),
  'tour-transform': el => tourApply([{ do: 'transform', room: tourRoom()?.id, to: el.dataset.t }]),
  'tour-refurnish': () => tourApply([{ do: 'furnish', room: tourRoom()?.id, variant: 1 + Math.floor(Math.random() * 3) }]),
  'tour-budget': () => { const r = tourRoom(); if (!r) return; tourApply([{ do: 'budget', room: r.id, amount: Math.round(roomCost(r).total * 0.7) }]); },
  'chat-sugg': el => sendChat(el.dataset.t),
  'chat-paint': el => { const r = findRoom(el.dataset.r); if (!r) return; commit('Paint'); r.wall = el.dataset.c; rebuild(); save(); addChat('aria', `Painted ${r.name} ${el.dataset.n}.`); },
  'det-noop': () => { },
};
const CHANGE = {
  'rename-project': el => { P().name = el.value || 'My Home'; save(); },
  'det-name': el => { const r = findRoom(el.dataset.id); if (r) { r.name = el.value; renderDetection(); } }, 'det-type': el => { const r = findRoom(el.dataset.id); if (r) { r.type = el.value; renderDetection(); } },
  'ob-num': el => { ob.p[el.dataset.k] = clamp(+el.value || 1, 1, 15); }, 'ob-sel': el => { ob.p[el.dataset.k] = el.value; }, 'ob-chk': el => { ob.p[el.dataset.k] = el.checked; },
  wallpaper: el => { const r = selRoom(); if (!r) return; commit('Wallpaper'); r.wallpaper = el.checked; rebuild(); },
  'light-tog': el => { const r = selRoom(); if (!r) return; commit('Lights'); r.lights[el.dataset.k] = el.checked; rebuild(); save(); },
  curtains: el => { const r = selRoom(); if (!r) return; commit('Curtains'); r.curtains = el.checked; rebuild(); save(); },
  finish: el => { const r = selRoom(); if (!r) return; commit('Finish'); r.furniture.forEach(i => i.finish = el.value || null); rebuild(); save(); },
  tier: el => { const r = selRoom(); if (!r) return; commit('Tier'); r.tier = el.value; r.furniture.forEach(i => i.tier = el.value); rebuild(); save(); },
  'room-theme': el => { const r = selRoom(); if (!r) return; commit('Room theme'); applyTheme(el.value || P().theme, [r]); if (!el.value) r.theme = null; rebuild(); save(); },
  budget: el => { S.prefs.budget = Math.max(10000, +el.value || S.prefs.budget); store.set('prefs', S.prefs); refreshSidePanel(); },
  daylight: el => { S.daylightSim = el.checked; $('#t-sun').classList.toggle('on', S.daylightSim); rebuild(); },
  'all-floors': el => { S.showAllFloors = el.checked; rebuild(); },
  'floor-h': el => { commit('Height'); FL().height = clamp(+el.value || 2.9, 2.4, 4.5); rebuild(); save(); },
  'var-cmp': el => { S.variants[+el.dataset.i].cmp = el.checked; refreshSidePanel(); },
  'it-dim': el => { const f = S.sel && findItem(S.sel.id); if (!f) return; commit('Resize'); f.it[el.dataset.k] = clamp(+el.value || 0.3, 0.2, 6); rebuild(); save(); },
  'it-tier': el => { const f = S.sel && findItem(S.sel.id); if (!f) return; commit('Tier'); f.it.tier = el.value; rebuild(); renderInspector(); save(); },
  'it-finish': el => { const f = S.sel && findItem(S.sel.id); if (!f) return; commit('Finish'); f.it.finish = el.value || null; rebuild(); save(); },
  'r-name': el => { const r = selRoom(); if (!r) return; commit('Rename'); r.name = el.value; rebuild(); save(); },
  'r-type': el => { const r = selRoom(); if (!r) return; commit('Type'); r.type = el.value; rebuild(); renderInspector(); save(); toast('Type changed — press Furnish to re-plan furniture'); },
  'r-dim': el => { const r = selRoom(); if (!r) return; const v = clamp(snap(+el.value || 1), 0.8, 30); const ext = el.dataset.k === 'w' ? isExteriorPoint(floorOfRoom(r), 'v', r.x + r.w, r.y + r.d / 2) : isExteriorPoint(floorOfRoom(r), 'h', r.y + r.d, r.x + r.w / 2); commit('Resize'); r[el.dataset.k] = r2(v); if (ext) { S.structuralLog.push(`${r.name}: outer wall moved via dimension edit — external walls are usually load-bearing; get a structural review.`); toast('⚠️ Outer wall moved — flagged for structural review', 3800); } rebuild(); renderInspector(); save(); },
  'r-floor': el => { const r = selRoom(); if (!r) return; commit('Floor'); r.floor = el.value; rebuild(); save(); },
  'op-w': el => { const f = FL(); const o = [...f.doors, ...f.windows].find(x => x.id === S.sel?.id); if (!o) return; commit('Opening'); o.w = clamp(+el.value || 0.9, 0.5, 4); rebuild(); save(); },
  'op-k': el => { const o = FL().windows.find(x => x.id === S.sel?.id); if (!o) return; commit('Window'); o[el.dataset.k] = clamp(+el.value || 0.5, 0, 2.6); rebuild(); save(); },
  'op-main': el => { const o = FL().doors.find(x => x.id === S.sel?.id); if (!o) return; commit('Main'); FL().doors.forEach(d => d.main = false); o.main = el.checked; rebuild(); save(); },
  'tour-floor': el => tourApply([{ do: 'floor', room: tourRoom()?.id, material: el.value }]),
};
const INPUT = {
  'wall-custom': el => { const r = selRoom(); if (!r) return; if (!S._painting) { commit('Paint'); S._painting = true; setTimeout(() => S._painting = false, 1200); } r.wall = el.value; rebuild(); save(); },
  'it-color': el => { const f = S.sel && findItem(S.sel.id); if (!f) return; if (!S._painting) { commit('Colour'); S._painting = true; setTimeout(() => S._painting = false, 1200); } f.it.color = el.value; rebuild(); save(); },
  hour: el => { setHour(+el.value); const l = $('#lt-h'); if (l) l.textContent = fmtHour(+el.value); },
  north: el => { P().north = +el.value; applyEnv(); if (S.view === '2d') render2D(); const lbl = el.closest('label'); if (lbl) lbl.firstChild.textContent = `Plan orientation — where is North? (${el.value}° from plan-up)`; },
  'ob-budget': el => { ob.p.budget = +el.value; const b = el.closest('label').querySelector('b'); if (b) b.textContent = inr(ob.p.budget); },
  'ba-slide': el => { const a = $('#ba-after'); if (a) a.style.width = el.value + '%'; },
  'tour-wall-custom': el => { clearTimeout(S._tw); S._tw = setTimeout(() => tourApply([{ do: 'wall_color', room: tourRoom()?.id, color: el.value, name: 'your custom colour' }]), 400); },
};

function boot() {
  S.prefs = Object.assign(S.prefs, store.get('prefs', {})); S.apiKey = store.get('key', ''); S.provider = providerOf(S.apiKey); S.model = store.get('model', 'gemma-4-31b-it'); { const g = store.get('groq', {}); S.groqModels = g.models || []; S.groqVision = g.vision || null; } if (S.provider === 'google' && !GEMMA_MODELS[S.model]) S.model = 'gemma-4-31b-it';
  document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (!el) return; if (el.tagName === 'A' && !el.getAttribute('href')?.startsWith('http')) e.preventDefault(); const f = ACT[el.dataset.act]; if (f) { f(el, e); } });
  document.addEventListener('change', e => { const el = e.target.closest('[data-act-change]'); if (el && CHANGE[el.dataset.actChange]) CHANGE[el.dataset.actChange](el, e); });
  document.addEventListener('input', e => { const el = e.target.closest('[data-act-input]'); if (el && INPUT[el.dataset.actInput]) INPUT[el.dataset.actInput](el, e); });
  document.addEventListener('submit', e => { const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault(); if (f.dataset.form === 'chat') { const i = $('#chat-input'); const t = i.value; i.value = ''; sendChat(t); } if (f.dataset.form === 'tour-ask') { const i = $('#tour-ask-in'); const t = i.value; i.value = ''; if (t.trim()) tourAsk(t); } });
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') $('#modal').classList.remove('on'); });
  $('#time-slider').addEventListener('input', e => setHour(+e.target.value));
  $('#file-in').addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; try { const url = await fileToImageURL(f); runDetection(url, { name: f.name.replace(/\.\w+$/, '').replace(/[_-]+/g, ' ').slice(0, 30) || 'My Home' }); } catch (err) { toast('Could not read file: ' + err.message, 4500); } });
  const dz = $('.drop-in'); ['dragenter', 'dragover'].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.add('over'); })); ['dragleave', 'drop'].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.remove('over'); }));
  dz.addEventListener('drop', async e => { const f = e.dataTransfer.files[0]; if (!f) return; try { const url = await fileToImageURL(f); runDetection(url, { name: f.name.replace(/\.\w+$/, '').slice(0, 30) }); } catch (err) { toast('Could not read file: ' + err.message, 4500); } });
  document.addEventListener('change', async e => { if (e.target.id !== 'insp-in') return; const f = e.target.files[0]; if (!f) return; const url = await fileToImageURL(f); $('#insp-out').innerHTML = '<p class="muted">Analysing style…</p>'; try { const x = await analyzeInspiration(url); x.url = await shrinkImage(url, 200); S.insp = x; $('#insp-out').innerHTML = inspHTML(x); } catch (err) { $('#insp-out').innerHTML = `<p class="muted">${esc(err.message)}</p>`; } });
  try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => { }; } catch (e) { }
  updateGemmaBadge();
  window.DIMORA = { S, E: () => E, CTL: () => CTL, rebuild, askAria, localParse, analyzeSpace, analyzeLight, homeCost, archChecks, sampleHome, startTour, stopTour, setView, TOUR };
}
