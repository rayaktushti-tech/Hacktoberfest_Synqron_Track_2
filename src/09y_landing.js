/* ===================== MARKETING SITE: live 3D hero, rendered showcase & before/after ===================== */
const SITE_CONFIG = {
  contactEmail: 'hello@dimora.app', // ← replace with your real contact address before launch
};
const HERO = { E: null, proj: null, mode: 'furnished', ready: false, inView: true, drag: null, theta: -0.7, phi: 0.92, r: 20, c: [0, 0, 0], last: 0, imgs: {}, gen: false };
function withHero(fn, o = {}) {
  const keep = { E, P: S.project, cut: S.cutaway, hour: S.hour, sel: S.sel, view: S.view, ds: S.daylightSim, tour: S.touring, labels: S.labels };
  E = HERO.E; S.project = HERO.proj; S.cutaway = o.cut ?? HERO.mode === 'cutaway'; S.hour = o.hour ?? (HERO.mode === 'night' ? 20.6 : 10.5); S.sel = null; S.view = '3d'; S.daylightSim = !!o.sun; S.touring = !!o.tour;
  try { return fn(); } finally { E = keep.E; S.project = keep.P; S.cutaway = keep.cut; S.hour = keep.hour; S.sel = keep.sel; S.view = keep.view; S.daylightSim = keep.ds; S.touring = keep.tour; S.labels = keep.labels; }
}
function heroBuild(o) { withHero(() => rebuild(), o); HERO.E.dirty = true; }
function heroCam() {
  const cv = HERO.E.canvas, a = cv.clientWidth / Math.max(1, cv.clientHeight), b = homeBounds(HERO.proj.floors[0]);
  HERO.c = [b.x + b.w / 2, 0.4, b.y + b.d / 2];
  const half = Math.min(HERO.E.cam.fov / 2, Math.atan(Math.tan(HERO.E.cam.fov / 2) * a)); HERO.r = (Math.hypot(b.w, b.d) / 2 + 0.6) / Math.sin(half) * 0.92;
}
function heroApplyCam() { const e = HERO.E, h = HERO; e.cam.pos = [h.c[0] + h.r * Math.sin(h.phi) * Math.sin(h.theta), h.c[1] + h.r * Math.cos(h.phi), h.c[2] + h.r * Math.sin(h.phi) * Math.cos(h.theta)]; e.cam.target = h.c.slice(); e.dirty = true; }
function initHero() {
  if (HERO.E || HERO.failed) return; const cv = document.getElementById('hero-gl'); if (!cv) return;
  try { HERO.E = new Engine(cv); } catch (e) { HERO.failed = true; document.getElementById('hero-fallback').style.display = 'flex'; genLandingImages(); return; }
  const keepP = S.project; HERO.proj = sampleHome(); S.project = HERO.proj; HERO.proj.theme = 'Japandi'; furnishAll(); S.project = keepP;
  heroBuild(); heroCam(); heroApplyCam();
  withHero(() => { const c = homeCost(); const el = document.getElementById('hero-cost'); if (el) el.innerHTML = `<b class="c-violet">${inr(c.total)}</b> est. interior`; });
  cv.addEventListener('pointerdown', e => { HERO.drag = { x: e.clientX, y: e.clientY, t: HERO.theta, p: HERO.phi }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (!HERO.drag) return; HERO.theta = HERO.drag.t - (e.clientX - HERO.drag.x) * 0.006; HERO.phi = clamp(HERO.drag.p - (e.clientY - HERO.drag.y) * 0.004, 0.35, 1.35); heroApplyCam(); });
  const up = () => { HERO.drag = null; HERO.idleAt = performance.now(); }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  try { new IntersectionObserver(es => es.forEach(x => HERO.inView = x.isIntersecting)).observe(cv); } catch (e) { }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loop = t => {
    const dt = Math.min(0.05, (t - HERO.last) / 1000 || 0.016); HERO.last = t;
    if ($('#app').dataset.screen === 'landing' && HERO.inView && !HERO.busy) {
      if (!reduce && !HERO.drag && (!HERO.idleAt || t - HERO.idleAt > 2500)) { HERO.theta += dt * 0.12; heroApplyCam(); }
      if (HERO.E.dirty) { HERO.E.render(); }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.addEventListener('resize', () => { if (HERO.E) { heroCam(); heroApplyCam(); } });
  HERO.ready = true;
  setTimeout(genLandingImages, 900);
}
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
// renders happen on a separate off-screen engine so the live hero never flickers
function genEngine(w, h) { if (!HERO.G) { const c = document.createElement('canvas'); c.width = w; c.height = h; HERO.G = new Engine(c, { fixed: true }); } HERO.G.canvas.width = w; HERO.G.canvas.height = h; return HERO.G; }
function genBuild(o) { const keep = HERO.E; HERO.E = HERO.G; try { withHero(() => rebuild(), o); } finally { HERO.E = keep; } }
async function shotFrom(pos, target, fov, w, h) { const g = genEngine(w, h); g.cam.pos = pos; g.cam.target = target; g.cam.fov = fov; const url = g.snapshot(w, h); await nextFrame(); return url; }
async function genLandingImages() {
  if (HERO.gen) return; HERO.gen = true;
  const proj = HERO.proj || (() => { const k = S.project; const p = sampleHome(); S.project = p; furnishAll(); S.project = k; HERO.proj = p; return p; })();
  // BEFORE: the raw floor plan drawing
  const plan = drawPlanImage(proj); const pimg = await loadImage(plan.url);
  const ba = document.getElementById('ba'); if (ba) ba.style.setProperty('--ba-ar', (pimg.width / pimg.height).toFixed(3));
  document.getElementById('ba-before').src = plan.url;
  const room = proj.floors[0].rooms.find(r => r.type === 'living'), room2 = proj.floors[0].rooms.find(r => r.type === 'master');
  withHero(() => { const c = roomCost(room); $('#sc-room').textContent = `${room.name} · ${room.w} × ${room.d} m`; $('#sc-cap').textContent = templateNarration(room).split(/(?<=[.!?])\s+/).slice(0, 2).join(' '); $('#sc-badge2').innerHTML = `<b class="c-cyan">${r2(area(room))} m²</b> · ${inr(c.total)}`; });
  if (!HERO.E && HERO.failed) { document.getElementById('ba-after').src = plan.url; $('#sc-loading').textContent = '3D preview needs WebGL2'; return; }
  try {
    // AFTER: near-orthographic top view framed exactly like the plan image
    const W = Math.round(pimg.width * 1.5), H = Math.round(pimg.height * 1.5); genEngine(W, H);
    const a = W / H, Wm = pimg.width / 48, Hm = pimg.height / 48, b = homeBounds(proj.floors[0]);
    const fov = 10 * Math.PI / 180, t = Math.tan(fov / 2); const A = Wm / Hm;
    const dist = a >= A ? (Hm / 2) / t : (Wm / 2) / (t * a);
    const cx = b.x + b.w / 2, cz = b.y + b.d / 2;
    genBuild({ hour: 11.2, cut: false });
    document.getElementById('ba-after').src = await shotFrom([cx, dist, cz + dist * 0.0005], [cx, 0, cz], fov, W, H);
    // SHOWCASE: interior renders from Aria's tour cameras
    const shots = {};
    for (const [k, rm, hour] of [['tour', room, 10.5], ['walk', room2, 9.2], ['night', room, 20.6]]) {
      genEngine(1280, 720); genBuild({ hour, tour: true, cut: false });
      const sh = withHero(() => roomShot(rm)); shots[k] = await shotFrom(sh.pos, sh.target, 68 * Math.PI / 180, 1280, 720);
    }
    HERO.imgs = shots; scShow('tour');
  } catch (e) { console.warn('landing renders failed', e); }
}
function scShow(k) {
  const img = $('#sc-img'); if (!HERO.imgs[k]) return; img.hidden = false; img.src = HERO.imgs[k]; $('#sc-loading').style.display = 'none';
  const proj = HERO.proj; const rm = proj.floors[0].rooms.find(r => r.type === (k === 'walk' ? 'master' : 'living'));
  withHero(() => { $('#sc-room').textContent = `${rm.name} · ${rm.w} × ${rm.d} m${k === 'night' ? ' · 8:36 PM' : ''}`; const n = templateNarration(rm).split(/(?<=[.!?])\s+/); $('#sc-cap').textContent = k === 'night' ? `Evening in the ${rm.name}: warm 2700K ambient light from the ${CEILINGS[roomCeiling(rm)].label.toLowerCase()} plus a reading lamp beside the sofa. Want brighter task lighting here?` : n.slice(0, 2).join(' '); $('#sc-badge2').innerHTML = `<b class="c-cyan">${r2(area(rm))} m²</b> · ${inr(roomCost(rm).total)}`; });
  $$('[data-sc]').forEach(b => { const on = b.dataset.sc === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
}
document.addEventListener('click', e => {
  const h = e.target.closest('[data-hero]'); if (h && HERO.E && !HERO.busy) { HERO.mode = h.dataset.hero; $$('[data-hero]').forEach(b => { const on = b === h; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); heroBuild(); }
  const s = e.target.closest('[data-sc]'); if (s) scShow(s.dataset.sc);
});
function siteModal(html) { $('#modal-card').innerHTML = `<button class="x" data-act="modal-close" aria-label="Close">✕</button>${html}`; $('#modal').classList.add('on'); }
function goApp(intent) {
  const u = currentUser();
  if (!u) { S.afterLogin = intent || null; show('login'); renderAuth(); return; }
  if (!u.answers?.done) { S.afterLogin = intent || null; show('intro'); renderIntro(); return; }
  if (intent === 'sample') return startSample(); show('dash');
}
function runAfterLogin() { const i = S.afterLogin; S.afterLogin = null; if (i === 'sample') startSample(); else show('dash'); }
function startSample() { sampleHome(); P().theme = S.prefs.style; S.history = []; S.future = []; S.variants = []; S.structuralLog = []; furnishAll(); S.original = deep(S.project); openWorkspace(true); }
Object.assign(ACT, {
  start: () => goApp(), 'go-login': () => goApp(), sample: () => goApp('sample'),
  'go-landing': () => { show('landing'); setTimeout(initHero, 50); },
  contact: (el, e) => { e && e.preventDefault(); siteModal(`<p class="eyebrow">Talk to us</p><h2>Enterprise &amp; partnerships</h2><p class="muted">Builders, architects and agencies: we'd love to set up branded showcases, team workspaces and on-premise Gemma deployments for you.</p><p>Write to <a href="mailto:${SITE_CONFIG.contactEmail}" style="color:#22d3ee">${SITE_CONFIG.contactEmail}</a> with your team size and use case.</p><div class="row end"><button class="btn primary" data-act="modal-close">Got it</button></div>`); },
  legal: (el, e) => { e && e.preventDefault(); siteModal(el.dataset.k === 'terms' ? `<p class="eyebrow">Terms</p><h2>Terms of use</h2><p class="muted">DIMORA is a design-visualisation tool. Cost figures are illustrative estimates for Indian metro markets, not quotations. Structural and bye-law observations are indicative only. Consult a licensed architect or structural engineer before construction. AI output can be wrong; review it before acting on it.</p>` : `<p class="eyebrow">Privacy</p><h2>Your data stays with you</h2><p class="muted">Projects, preferences, your profile and your intro answers are stored in this browser's local storage. Floor plans and prompts are sent to Google's Gemini API only when you add your own Gemma 4 key. With Firebase sign-in enabled, Google and Firebase process your Google account email to verify it. DIMORA has no ads and no tracking.</p>`); },
});
