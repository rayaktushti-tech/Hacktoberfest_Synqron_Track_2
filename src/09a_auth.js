/* ===================== LOGIN PORTAL (Gmail) & INTRO QUESTIONS ===================== */
/*
  REAL GOOGLE SIGN-IN (optional): paste your Firebase web-app config below to switch from Gmail-address
  sign-in to a verified "Continue with Google" button.
  Firebase Console → Authentication → Sign-in method: enable "Google".
  Authentication → Settings → Authorized domains: add the domain you serve DIMORA from (e.g. localhost).
  Serve the file over http(s) (e.g. `npx serve .`) — Google sign-in does not work from file://.
*/
const AUTH_CONFIG = {
  firebase: null, // e.g. { apiKey: 'AIza…', authDomain: 'your-app.firebaseapp.com', projectId: 'your-app', appId: '1:…:web:…' }
};
const AUTH = { email: '', name: '', err: '', fb: null, guser: null, busy: false };
const isGmail = e => /^[a-z0-9._%+-]+@(gmail|googlemail)\.com$/i.test(String(e).trim());
function currentUser() { const u = store.get('user', null); return u && u.loggedIn ? u : null; }
function firstName(u) { const n = (u.name || u.email.split('@')[0].replace(/[._\d]+/g, ' ')).trim().split(/\s+/)[0] || 'there'; return n[0].toUpperCase() + n.slice(1); }
function initials(u) { const n = (u.name || u.email.split('@')[0]).replace(/[._\d]+/g, ' ').trim().split(/\s+/); return ((n[0] || '?')[0] + (n[1] ? n[1][0] : '')).toUpperCase(); }
function updateUserChips() { const u = currentUser(); $$('.uchip').forEach(b => { b.textContent = u ? initials(u) : ''; b.title = u ? `${u.name || u.email} · account` : ''; }); }

/* ---------- optional Firebase ---------- */
async function initFirebase() {
  if (!AUTH_CONFIG.firebase || AUTH.fb) return AUTH.fb;
  try {
    if (location.protocol === 'file:') throw new Error('Google sign-in needs http(s) — serve the folder, e.g. `npx serve .`');
    await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js');
    if (!window.firebase.apps.length) window.firebase.initializeApp(AUTH_CONFIG.firebase);
    AUTH.fb = window.firebase.auth();
  } catch (e) { AUTH.err = 'Google sign-in unavailable (' + e.message + '). Sign in with your Gmail address instead.'; AUTH.fb = null; AUTH_CONFIG.firebase = null; }
  return AUTH.fb;
}
const fbErr = e => ({ 'auth/too-many-requests': 'Too many attempts — please wait a few minutes.', 'auth/popup-closed-by-user': 'Google sign-in was closed before finishing.', 'auth/unauthorized-domain': 'This domain is not authorised in your Firebase project.' }[e.code] || e.message || 'Something went wrong.');

/* ---------- rendering ---------- */
function renderAuth() {
  const el = $('#auth-card'); if (!el) return;
  const real = !!AUTH_CONFIG.firebase; const err = AUTH.err ? `<div class="auth-err">${esc(AUTH.err)}</div>` : '';
  const prev = store.get('user', null);
  el.innerHTML = `<h2>${prev && prev.email ? 'Welcome back' : 'Sign in to DIMORA'}</h2><p>${real ? 'Continue with your Google account.' : 'Use your Gmail address to sign in.'}</p>${err}
    <form data-form="auth-details" novalidate>
      ${real ? `<button type="button" class="gbtn" data-act="auth-google"><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>${AUTH.busy ? 'Signing in…' : 'Continue with Google'}</button>`
      : `<label class="auth-field">Gmail address<div class="inp-ico"><i>✉️</i><input id="au-email" type="email" autocomplete="email" placeholder="you@gmail.com" value="${esc(AUTH.email || prev?.email || '')}"></div></label>
         <label class="auth-field">Full name <small>(optional)</small><input id="au-name" autocomplete="name" placeholder="e.g. Priya Sharma" value="${esc(AUTH.name || prev?.name || '')}"></label>
         <button id="au-send" class="btn primary block">Continue →</button>`}
    </form>
    <div class="auth-foot"><a data-act="go-landing">← Back to home</a><span>By continuing you agree to the <a data-act="legal" data-k="terms">terms</a> &amp; <a data-act="legal" data-k="privacy">privacy</a>.</span></div>`;
  setTimeout(() => (document.getElementById('au-email') || {}).focus?.(), 50);
}
function signIn(email, name, method, uidv) {
  const prev = store.get('user', null); const same = prev && prev.email === email;
  const user = Object.assign({}, same ? prev : {}, { email, name: name || (same ? prev.name : ''), method, uid: uidv || (same && prev.uid) || uid('u'), loggedIn: true, lastLogin: Date.now(), created: same && prev.created ? prev.created : Date.now() });
  delete user.phone; delete user.cc; delete user.phoneVerified;
  store.set('user', user); AUTH.err = ''; AUTH.busy = false;
  toast(`Signed in as ${user.email}`);
  if (user.answers?.done) runAfterLogin(); else { INTRO.i = 0; INTRO.a = {}; show('intro'); renderIntro(); }
}
function submitGmail() {
  AUTH.email = ($('#au-email')?.value || '').trim().toLowerCase(); AUTH.name = ($('#au-name')?.value || '').trim().slice(0, 40);
  if (!isGmail(AUTH.email)) { AUTH.err = 'Please enter a valid Gmail address (ending in @gmail.com).'; return renderAuth(); }
  signIn(AUTH.email, AUTH.name, 'gmail');
}

/* ---------- intro questions ---------- */
const INTRO_QS = [
  { k: 'goal', q: 'What are you looking to do with DIMORA?', sub: 'Pick everything that applies — we\'ll tailor your workspace.', multi: true, opts: [['design', '🏡', 'Design my new home'], ['renovate', '🛠️', 'Renovate or redecorate'], ['visualise', '👀', 'Visualise a property before buying'], ['furniture', '🛋️', 'Plan furniture & layout'], ['budget', '₹', 'Estimate my interior budget'], ['study', '🎓', 'Architecture / design project'], ['showcase', '🏢', 'Showcase homes to clients'], ['explore', '✨', 'Just exploring']] },
  { k: 'passion', q: 'What are you by passion?', sub: 'Tell us what drives you — Aria will speak your language.', multi: false, opts: [['homeowner', '🏠', 'Home lover / homeowner'], ['interior', '🎨', 'Interior designer'], ['architect', '📐', 'Architect'], ['student', '📚', 'Architecture / design student'], ['builder', '🏗️', 'Builder / developer'], ['realestate', '🤝', 'Real estate professional'], ['creative', '🖌️', 'Artist / creative'], ['tech', '💻', 'Engineer / techie']] },
  { k: 'stage', q: 'Where are you in your home journey?', sub: 'Helps Aria give the right advice at the right moment.', multi: false, opts: [['possession', '🔑', 'Getting possession soon'], ['buying', '🔍', 'Planning to buy'], ['renting', '📦', 'Renting & want a refresh'], ['renovating', '🧱', 'Renovating my current home'], ['building', '🏗️', 'Building from scratch'], ['pro', '💼', 'Professional use — not my own home']] },
];
const INTRO = { i: 0, a: {} };
function renderIntro() {
  const el = $('#intro-card'); if (!el) return; const u = currentUser(); if (!u) return;
  if (!Object.keys(INTRO.a).length && u.answers) INTRO.a = deep(u.answers);
  const Q = INTRO_QS[INTRO.i]; const cur = INTRO.a[Q.k] || { v: [], other: '' };
  el.innerHTML = `<div class="intro-top"><div class="logo"><span class="mark">◇</span>DIMORA</div><div class="row"><span class="muted" style="font-size:12.5px">Question ${INTRO.i + 1} of ${INTRO_QS.length}</span><div class="intro-prog">${INTRO_QS.map((_, k) => `<i class="${k <= INTRO.i ? 'on' : ''}"></i>`).join('')}</div></div></div>
    ${INTRO.i === 0 ? `<p class="eyebrow">Hi ${esc(firstName(u))} — three quick questions</p>` : '<p class="eyebrow">&nbsp;</p>'}
    <h1 class="intro-q">${esc(Q.q)}</h1><p class="intro-sub">${esc(Q.sub)}</p>
    <div class="intro-opts">${Q.opts.map(([v, ic, l], k) => `<button class="iopt ${cur.v.includes(v) ? 'on' : ''}" style="animation-delay:${k * 0.035}s" data-act="intro-pick" data-v="${v}"><i>${ic}</i><b>${esc(l)}</b></button>`).join('')}</div>
    <input class="intro-other" id="intro-other" placeholder="Something else? Tell us in your own words (optional)" value="${esc(cur.other || '')}" maxlength="120">
    <div class="intro-nav">${INTRO.i ? '<button class="btn ghost" data-act="intro-back">← Back</button>' : '<button class="btn ghost" data-act="logout">Sign out</button>'}<button class="btn primary lg" data-act="intro-next">${INTRO.i < INTRO_QS.length - 1 ? 'Next →' : 'Enter DIMORA →'}</button></div>`;
}
function introSaveOther() { const Q = INTRO_QS[INTRO.i]; const o = $('#intro-other'); if (!o) return; INTRO.a[Q.k] = INTRO.a[Q.k] || { v: [], other: '' }; INTRO.a[Q.k].other = o.value.trim(); }
function labelOf(k, v) { const Q = INTRO_QS.find(q => q.k === k); return Q.opts.find(o => o[0] === v)?.[2] || v; }
function answerText(k, u = currentUser()) { const a = u?.answers?.[k]; if (!a) return '—'; return [...a.v.map(v => labelOf(k, v)), a.other].filter(Boolean).join(', ') || '—'; }
function ariaGoalLine() {
  const u = currentUser(); const a = u?.answers; if (!a) return '';
  const g = a.goal?.v || [], p = a.passion?.v?.[0], s = a.stage?.v?.[0];
  if (['architect', 'student'].includes(p)) return 'As a fellow design mind, you\'ll love the Structure panel — plan validation, circulation and multi-storey stacking. ';
  if (p === 'builder' || g.includes('showcase')) return 'Tip for showcasing: save variants in Compare and generate a Home Decision Report for your clients. ';
  if (p === 'interior') return 'The Design panel has themes, materials, ceilings and lighting ready for your clients. ';
  if (g.includes('budget')) return 'Since budget matters to you, the ₹ panel explains every estimate and can fit any room into your number. ';
  if (s === 'buying' || g.includes('visualise')) return 'Since you\'re evaluating a property, check daylight and space scores before you decide. ';
  if (s === 'renting') return 'For a rental refresh, try “make it cheaper” — paint, rugs and lighting go a long way. ';
  return '';
}
function personaliseFromAnswers(a) {
  const g = a.goal?.v || [], p = a.passion?.v?.[0];
  S.panel = ['architect', 'student'].includes(p) || g.includes('study') ? 'arch' : g.includes('budget') ? 'budget' : g.includes('furniture') ? 'furniture' : 'design';
}

/* ---------- account ---------- */
function openAccount() {
  const u = currentUser(); if (!u) return;
  $('#modal-card').innerHTML = `<button class="x" data-act="modal-close">✕</button><div class="row" style="gap:14px"><span class="uchip" style="width:54px;height:54px;font-size:20px;display:grid">${esc(initials(u))}</span><div><h2 style="margin:0">${esc(u.name || firstName(u))}</h2><div class="muted">${esc(u.email)} ${u.method === 'google' ? '<span class="tag ok">Google verified</span>' : ''}</div></div></div>
    <div class="acct-ans">${INTRO_QS.map(q => `<div><small>${esc(q.q)}</small>${esc(answerText(q.k, u))}</div>`).join('')}</div>
    <p class="muted" style="font-size:12px">Sign-in: ${u.method === 'google' ? 'Google account' : 'Gmail address'} · member since ${new Date(u.created).toLocaleDateString('en-IN')}</p>
    <div class="row end"><button class="btn ghost" data-act="intro-edit">Edit answers</button><button class="btn primary" data-act="logout">Sign out</button></div>`;
  $('#modal').classList.add('on');
}
Object.assign(ACT, {
  account: () => openAccount(),
  'auth-google': async () => {
    AUTH.err = ''; const fb = await initFirebase(); if (!fb) return renderAuth();
    try { AUTH.busy = true; renderAuth(); const res = await fb.signInWithPopup(new window.firebase.auth.GoogleAuthProvider()); signIn(res.user.email.toLowerCase(), res.user.displayName || '', 'google', res.user.uid); }
    catch (e) { AUTH.busy = false; AUTH.err = fbErr(e); renderAuth(); }
  },
  'intro-pick': el => { const Q = INTRO_QS[INTRO.i]; introSaveOther(); const a = INTRO.a[Q.k] = INTRO.a[Q.k] || { v: [], other: '' }; const v = el.dataset.v; if (Q.multi) { const i = a.v.indexOf(v); i >= 0 ? a.v.splice(i, 1) : a.v.push(v); } else a.v = [v]; renderIntro(); },
  'intro-back': () => { introSaveOther(); INTRO.i = Math.max(0, INTRO.i - 1); renderIntro(); },
  'intro-next': () => {
    introSaveOther(); const Q = INTRO_QS[INTRO.i]; const a = INTRO.a[Q.k];
    if (!a || (!a.v.length && !a.other)) { toast('Pick an option (or type your own) to continue'); return; }
    if (INTRO.i < INTRO_QS.length - 1) { INTRO.i++; renderIntro(); return; }
    const u = store.get('user', null); u.answers = Object.assign(deep(INTRO.a), { done: true, at: Date.now() }); store.set('user', u);
    personaliseFromAnswers(u.answers); store.set('panel', S.panel);
    runAfterLogin(); toast(`Welcome to DIMORA, ${firstName(u)}!`);
  },
  'intro-edit': () => { $('#modal').classList.remove('on'); if (S.touring) stopTour(); const u = store.get('user', null); INTRO.i = 0; INTRO.a = deep(u.answers || {}); delete INTRO.a.done; delete INTRO.a.at; u.answers = Object.assign(u.answers || {}, { done: false }); store.set('user', u); show('intro'); renderIntro(); },
  logout: async () => { $('#modal').classList.remove('on'); if (S.touring) stopTour(); const u = store.get('user', null); if (u) { u.loggedIn = false; store.set('user', u); } try { await AUTH.fb?.signOut(); } catch (e) { } AUTH.err = ''; $('#app').classList.remove('chat-open'); show('landing'); setTimeout(initHero, 50); toast('Signed out'); },
});
document.addEventListener('submit', e => { const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault(); if (f.dataset.form === 'auth-details') submitGmail(); });
