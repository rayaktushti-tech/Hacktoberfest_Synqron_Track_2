/* ===================== START ===================== */
boot(); window.DIMORA.HERO = HERO;
(function authStart() {
  S.panel = store.get('panel', 'design');
  const u = currentUser();
  if (!u) { show('landing'); setTimeout(initHero, 30); }
  else if (!u.answers?.done) { show('intro'); renderIntro(); }
  else show('dash');
  updateUserChips();
  if (AUTH_CONFIG.firebase) initFirebase().then(() => { if (AUTH.err) renderAuth(); });
})();
