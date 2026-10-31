/* ===================== ARIA'S ANIMATED HOME TOUR ===================== */
const TOUR = { order: [], i: -1, token: 0, paused: false, voice: true, narr: {}, gemma: null, speaking: false };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function pickVoice() { try { const vs = speechSynthesis.getVoices(); return vs.find(v => /en-IN/i.test(v.lang) && /female|veena|heera|neerja/i.test(v.name)) || vs.find(v => /en-IN/i.test(v.lang)) || vs.find(v => /en-GB/i.test(v.lang) && /female/i.test(v.name)) || vs.find(v => /^en/i.test(v.lang)); } catch (e) { return null; } }
function speak(text, tok) {
  setCaption(text); setTalking(true);
  const words = text.split(/\s+/).length; const est = Math.max(3500, words / 2.6 * 1000);
  return new Promise(res => {
    let finished = false; const done = () => { if (finished) return; finished = true; setTalking(false); res(); };
    if (TOUR.voice && 'speechSynthesis' in window) {
      try {
        speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); const v = pickVoice(); if (v) u.voice = v; u.rate = 1.0; u.pitch = 1.05;
        u.onend = done; u.onerror = () => setTimeout(done, est); speechSynthesis.speak(u);
        setTimeout(() => { if (!finished && !speechSynthesis.speaking && !speechSynthesis.pending && !TOUR.paused) { (async () => { let t = 1200; while (t < est && !finished) { await sleep(200); if (tok !== TOUR.token) break; if (!TOUR.paused) t += 200; } done(); })(); } }, 1200);
        // safety: some browsers never fire onend
        const guard = async () => { const t0 = Date.now(); while (!finished) { await sleep(250); if (tok !== TOUR.token) return done(); if (TOUR.paused) continue; if (Date.now() - t0 > est * 1.6 + 3000) return done(); } }; guard();
        return;
      } catch (e) { }
    }
    (async () => { let t = 0; while (t < est) { await sleep(200); if (tok !== TOUR.token) break; if (!TOUR.paused) t += 200; } done(); })();
  });
}
function setCaption(t) { const el = document.getElementById('tour-caption'); if (el) { el.classList.remove('in'); void el.offsetWidth; el.textContent = t; el.classList.add('in'); } }
function setTalking(on) { TOUR.speaking = on; document.querySelectorAll('.aria-avatar').forEach(a => a.classList.toggle('talking', on)); }
async function waitPaused(tok) { while (TOUR.paused && tok === TOUR.token) await sleep(150); return tok === TOUR.token; }
function tourOrder() {
  const f = FL(); const con = connectivity(f);
  let ids = con.order.slice(); con.unreachable.forEach(r => ids.push(r.id));
  return ids.map(findRoom).filter(r => r && !(r.type === 'hall' && area(r) < 3));
}
async function startTour(fromIndex = 0) {
  if (!S.project || !E) return;
  if (S.view === '2d') setView('3d');
  if (CTL.mode === 'walk') { CTL.mode = 'orbit'; }
  stopSpeech();
  const tok = ++TOUR.token; TOUR.paused = false; S.touring = true; select(null);
  TOUR.order = tourOrder(); TOUR.i = fromIndex - 1;
  TOUR.narr = {}; TOUR.order.forEach(r => TOUR.narr[r.id] = templateNarration(r));
  TOUR.intro = `Hi, I'm Aria, your DIMORA guide! Welcome to ${P().name}: ${allRooms().length} rooms and about ${Math.round(allRooms().reduce((s, r) => s + area(r), 0) * SQFT)} square feet, styled ${P().theme}. Let's walk through it together — you can pause anytime and ask me to change things.`;
  TOUR.outro = `That's the tour! The complete interior is estimated at ${inr(homeCost().total)}. Ask me to tweak anything, or open the Home Decision Report for the full breakdown.`;
  document.getElementById('app').classList.add('touring'); CTL.enabled = false;
  renderTourUI(); rebuild();
  if (S.apiKey) { setTourStatus(`${S.model} is writing your personalised narration…`); gemmaNarrations(TOUR.order).then(j => { if (tok !== TOUR.token) return; if (j.intro) TOUR.intro = j.intro; if (j.outro) TOUR.outro = j.outro; Object.entries(j.rooms || {}).forEach(([k, v]) => { if (TOUR.narr[k] && v) TOUR.narr[k] = v; }); setTourStatus('Narration by Gemma 4'); }).catch(e => setTourStatus('Narration: on-device (Gemma 4 unavailable)')); }
  else setTourStatus('Narration: on-device · add a Gemma 4 key for AI-written narration');
  const b = homeBounds(FL()), c = [b.x + b.w / 2, floorY(FL()), b.y + b.d / 2], R = Math.max(b.w, b.d);
  if (fromIndex === 0) {
    const ring = [0, 1, 2].map(i => { const a = -0.6 + i * 0.75; return [c[0] + Math.sin(a) * R * 1.15, c[1] + R * 0.75, c[2] + Math.cos(a) * R * 1.15]; });
    const sp = speak(TOUR.intro, tok);
    await CTL.flyPath(ring, ring.map(() => c), 7.5);
    await sp; if (!(await waitPaused(tok))) return;
  }
  await tourLoop(tok);
}
async function tourLoop(tok) {
  while (tok === TOUR.token) {
    TOUR.i++;
    if (TOUR.i >= TOUR.order.length) break;
    const r = TOUR.order[TOUR.i], prev = TOUR.order[TOUR.i - 1];
    renderTourUI();
    const shot = roomShot(r, prev);
    const via = [];
    if (shot.door) { const tc = [shot.target[0], shot.door[1], shot.target[2]]; const out = V3.add(shot.door, V3.scale(V3.norm(V3.sub(shot.door, tc)), 0.9)); const inn = V3.add(shot.door, V3.scale(V3.norm(V3.sub(tc, shot.door)), 0.5)); if (!prev) via.push([out[0], out[1] + 2.5, out[2]]); via.push(out, shot.door, inn); }
    const targets = via.map(() => shot.target);
    await CTL.flyPath([...via, shot.pos], [...targets, shot.target], prev ? 2.6 : 3.4);
    if (tok !== TOUR.token) return;
    // slow cinematic drift while narrating
    const drift = V3.lerp(shot.pos, [shot.target[0], shot.pos[1], shot.target[2]], 0.12); const side = [shot.target[0] + (shot.target[2] - shot.pos[2]) * 0.3, shot.target[1], shot.target[2] - (shot.target[0] - shot.pos[0]) * 0.3];
    const narr = TOUR.narr[r.id] || templateNarration(r);
    CTL.flyTo(drift, side, Math.max(6, narr.split(/\s+/).length / 2.6), { locked: true, ease: t => t });
    await speak(narr, tok);
    if (!(await waitPaused(tok))) return;
    await sleep(350);
  }
  if (tok !== TOUR.token) return;
  TOUR.i = TOUR.order.length; renderTourUI();
  const b = homeBounds(FL()), c = [b.x + b.w / 2, floorY(FL()), b.y + b.d / 2], R = Math.max(b.w, b.d);
  CTL.flyTo([c[0] - R * 0.6, c[1] + R * 1.1, c[2] + R * 0.9], c, 3, { locked: true });
  await speak(TOUR.outro, tok);
  if (tok === TOUR.token) { setTourStatus('Tour complete — ask Aria for changes or replay.'); document.getElementById('tour-play').innerHTML = '↻'; TOUR.ended = true; }
}
function stopSpeech() { try { speechSynthesis.cancel(); } catch (e) { } setTalking(false); }
function stopTour() {
  TOUR.token++; stopSpeech(); S.touring = false; TOUR.ended = false;
  document.getElementById('app').classList.remove('touring'); if (CTL) { CTL.enabled = true; CTL.anim = null; CTL.syncFromCam('orbit'); }
  rebuild(); fitView(true);
}
function tourJump(delta) {
  if (!S.touring) return; const tok = ++TOUR.token; stopSpeech(); TOUR.paused = false; TOUR.ended = false;
  TOUR.i = clamp(TOUR.i + delta, 0, TOUR.order.length - 1) - 1; if (CTL) CTL.anim = null;
  tourLoop(tok);
}
function tourGo(idx) { if (!S.touring) return; const tok = ++TOUR.token; stopSpeech(); TOUR.paused = false; TOUR.i = idx - 1; if (CTL) CTL.anim = null; tourLoop(tok); }
function tourTogglePause() {
  if (TOUR.ended) { TOUR.ended = false; startTour(0); return; }
  TOUR.paused = !TOUR.paused;
  try { TOUR.paused ? speechSynthesis.pause() : speechSynthesis.resume(); } catch (e) { }
  renderTourUI();
}
function setTourStatus(t) { const el = document.getElementById('tour-status'); if (el) el.textContent = t; }
function tourRoom() { return S.touring && TOUR.order[TOUR.i] ? TOUR.order[TOUR.i] : null; }
function renderTourUI() {
  const el = document.getElementById('tour'); if (!el) return;
  const r = tourRoom();
  document.getElementById('tour-play').innerHTML = TOUR.paused ? '▶' : '❚❚';
  document.getElementById('tour-voice').classList.toggle('off', !TOUR.voice);
  document.getElementById('tour-chips').innerHTML = TOUR.order.map((x, i) => `<button class="chip ${i === TOUR.i ? 'on' : i < TOUR.i ? 'done' : ''}" data-act="tour-go" data-i="${i}">${ROOM_TYPES[x.type].icon} ${esc(x.name)}</button>`).join('');
  document.getElementById('tour-room').innerHTML = r ? `<b>${esc(r.name)}</b><span>${r.w} × ${r.d} m · ${r2(area(r))} m² · ${inr(roomCost(r).total)}</span>` : `<b>${esc(P().name)}</b><span>${P().theme} · ${allRooms().length} rooms</span>`;
  renderTourEdit();
  renderMinimap();
}
function renderTourEdit() {
  const box = document.getElementById('tour-edit'); if (!box) return; const r = tourRoom();
  if (!r) { box.innerHTML = `<p class="muted">Changes apply to the room you're in. Wait for the first room, or type below to change the whole home.</p>`; return; }
  const sug = paintSuggestions(r);
  box.innerHTML = `
    <div class="te-row"><label>Wall colour</label><div class="swatches">${sug.map(s => `<button class="sw" title="${esc(s.name)} — ${esc(s.why)}" style="background:${s.hex}" data-act="tour-wall" data-c="${s.hex}" data-n="${esc(s.name)}"></button>`).join('')}<input type="color" value="${roomWall(r)}" data-act-input="tour-wall-custom"></div></div>
    <div class="te-row"><label>Flooring</label><select data-act-change="tour-floor">${Object.entries(FLOORS).map(([k, v]) => `<option value="${k}" ${roomFloorKey(r) === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
    <div class="te-row"><label>Style</label><div class="mini-chips">${Object.keys(THEMES).map(t => `<button class="chip ${(r.theme || P().theme) === t ? 'on' : ''}" data-act="tour-theme" data-t="${t}">${t}</button>`).join('')}</div></div>
    <div class="te-row"><label>Transform</label><div class="mini-chips">${TRANSFORMS.filter(t => t.to !== r.type).slice(0, 6).map(t => `<button class="chip" data-act="tour-transform" data-t="${t.to}">${ROOM_TYPES[t.to].icon} ${t.label}</button>`).join('')}</div></div>
    <div class="te-row"><button class="btn sm" data-act="tour-refurnish">↻ Re-arrange furniture</button><button class="btn sm" data-act="tour-budget">💸 Make it cheaper</button></div>`;
}
function renderMinimap() {
  const el = document.getElementById('tour-map'); if (!el) return; const f = FL(), b = homeBounds(f); const s = Math.min(170 / b.w, 120 / b.d); const r = tourRoom();
  el.innerHTML = `<svg width="${b.w * s + 10}" height="${b.d * s + 10}"><g transform="translate(5 5)">${f.rooms.map(x => `<rect x="${(x.x - b.x) * s}" y="${(x.y - b.y) * s}" width="${x.w * s}" height="${x.d * s}" fill="${x === r ? '#8b5cf6' : TOUR.order.indexOf(x) < TOUR.i && TOUR.order.includes(x) ? '#0e7490' : '#1e293b'}" stroke="#05050a" stroke-width="1.5"/>`).join('')}${TOUR.order.slice(0, Math.max(0, TOUR.i + 1)).map((x, i, a) => i ? `<line x1="${(a[i - 1].x + a[i - 1].w / 2 - b.x) * s}" y1="${(a[i - 1].y + a[i - 1].d / 2 - b.y) * s}" x2="${(x.x + x.w / 2 - b.x) * s}" y2="${(x.y + x.d / 2 - b.y) * s}" stroke="#fff" stroke-width="1.5" stroke-dasharray="3 2"/>` : '').join('')}${r ? `<circle cx="${(r.x + r.w / 2 - b.x) * s}" cy="${(r.y + r.d / 2 - b.y) * s}" r="5" fill="#fff" class="pulse"/>` : ''}</g></svg>`;
}
async function tourApply(actions, msg) {
  const r = tourRoom(); TOUR.paused = true; try { speechSynthesis.cancel(); } catch (e) { } setTalking(false);
  const res = execActions(actions, r);
  const line = msg || res.done.join(' ') || 'Done.';
  renderTourUI(); if (r) { TOUR.narr[r.id] = templateNarration(r); }
  addChat('aria', line);
  const tok = TOUR.token; TOUR.paused = false; await speak(line, tok); if (tok === TOUR.token) { TOUR.paused = true; renderTourUI(); setTourStatus('Paused after your change — press ▶ to continue the tour.'); }
}
async function tourAsk(text) {
  const r = tourRoom(); TOUR.paused = true; try { speechSynthesis.cancel(); } catch (e) { }
  addChat('user', text); setTourStatus('Aria is thinking…');
  const out = await askAria(text, r);
  addChat('aria', out.reply, out.via);
  renderTourUI(); const tok = TOUR.token; TOUR.paused = false; await speak(out.reply, tok);
  if (tok === TOUR.token && S.touring) { TOUR.paused = true; renderTourUI(); setTourStatus('Paused — press ▶ to continue the tour.'); }
}
