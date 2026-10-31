/* ===================== GEMMA 4 CLIENT + ARIA ASSISTANT ===================== */
const GEMMA_MODELS = { 'gemma-4-31b-it': 'Gemma 4 31B (best quality)', 'gemma-4-26b-a4b-it': 'Gemma 4 26B A4B MoE (faster)' };
/* Providers: Google AI Studio (Gemini API → Gemma 4) or Groq (OpenAI-compatible). Detected from the key prefix. */
const providerOf = key => /^gsk_/.test(key || '') ? 'groq' : 'google';
const GROQ_URL = 'https://api.groq.com/openai/v1';
const isVisionId = id => /gemma-?[34]|llama-4|vision|scout|maverick|vl\b|-vl-|pixtral|llava/i.test(id);
const isChatId = id => !/whisper|tts|playai|orpheus|guard|prompt-guard|distil|embed|compound-mini/i.test(id);
function rankGroq(ids) {
  const pref = [/gemma-?4/i, /llama-4-maverick/i, /llama-3\.3-70b/i, /gpt-oss-120b/i, /llama-4-scout/i, /kimi/i, /qwen/i, /gemma/i, /llama/i];
  const chat = ids.filter(isChatId); const sc = id => { const i = pref.findIndex(r => r.test(id)); return i < 0 ? 99 : i; };
  return chat.sort((a, b) => sc(a) - sc(b) || a.localeCompare(b));
}
function pickGroqVision(ids, cur) {
  if (isVisionId(cur)) return cur;
  const v = ids.filter(isVisionId); return v.find(i => /gemma-?4/i.test(i)) || v.find(i => /maverick/i.test(i)) || v.find(i => /scout/i.test(i)) || v[0] || null;
}
async function groqModels(key = S.apiKey) {
  const r = await fetch(GROQ_URL + '/models', { headers: { Authorization: 'Bearer ' + key } });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message || 'HTTP ' + r.status);
  return (j.data || []).filter(m => m.active !== false).map(m => m.id);
}
function modelLabel() { if (!S.apiKey) return 'on-device engine'; const m = S.model || ''; return /gemma-?4/i.test(m) ? 'Gemma 4' : (S.provider === 'groq' ? m + ' (Groq)' : m); }
async function groqCall(parts, { temperature, maxTokens, history, timeout }) {
  const hasImg = parts.some(p => p.inline_data);
  let model = S.model;
  if (hasImg && !isVisionId(model)) { model = S.groqVision || pickGroqVision(S.groqModels || [], model); if (!model) throw new Error(`no vision model available on this Groq key for reading plans/photos`); }
  const toContent = ps => { const c = ps.map(p => p.inline_data ? { type: 'image_url', image_url: { url: `data:${p.inline_data.mime_type};base64,${p.inline_data.data}` } } : { type: 'text', text: p.text || '' }); return c.length === 1 && c[0].type === 'text' ? c[0].text : c; };
  const messages = [...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: (h.parts || []).map(p => p.text || '').join('') })), { role: 'user', content: toContent(parts) }];
  const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), timeout); let res;
  try { res = await fetch(GROQ_URL + '/chat/completions', { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S.apiKey }, body: JSON.stringify({ model, messages, temperature, max_completion_tokens: maxTokens }) }); }
  catch (e) { clearTimeout(tm); S.gemmaOK = false; updateGemmaBadge(); throw new Error(e.name === 'AbortError' ? 'Groq timed out' : 'Network blocked or offline (' + e.message + ')'); }
  clearTimeout(tm);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) { S.gemmaOK = false; updateGemmaBadge(); throw new Error((j.error?.message || 'HTTP ' + res.status) + ` [${model}]`); }
  let text = (j.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  if (!text) throw new Error('Empty response from ' + model);
  S.gemmaOK = true; updateGemmaBadge(); return text;
}
async function gemma(parts, { temperature = 0.4, maxTokens = 2048, history = [], timeout = 90000 } = {}) {
  if (!S.apiKey) throw new Error('NO_KEY');
  if (S.provider === 'groq') return groqCall(parts, { temperature, maxTokens, history, timeout });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(S.model)}:generateContent?key=${encodeURIComponent(S.apiKey)}`;
  const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ contents: [...history, { role: 'user', parts }], generationConfig: { temperature, maxOutputTokens: maxTokens } }) });
  } catch (e) { clearTimeout(tm); S.gemmaOK = false; updateGemmaBadge(); throw new Error(e.name === 'AbortError' ? 'Gemma 4 timed out' : 'Network blocked or offline (' + e.message + ')'); }
  clearTimeout(tm);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) { S.gemmaOK = false; updateGemmaBadge(); throw new Error(j.error?.message || ('HTTP ' + res.status)); }
  const text = (j.candidates?.[0]?.content?.parts || []).filter(p => !p.thought && p.text).map(p => p.text).join('').trim();
  if (!text) throw new Error('Empty response from Gemma 4');
  S.gemmaOK = true; updateGemmaBadge();
  return text;
}
function extractJSON(t) {
  t = String(t).replace(/```(?:json)?/gi, '').trim();
  const s = Math.min(...['{', '['].map(c => { const i = t.indexOf(c); return i < 0 ? 1e9 : i; }));
  if (s === 1e9) throw new Error('No JSON in response');
  for (let e = t.length; e > s; e--) { const ch = t[e - 1]; if (ch !== '}' && ch !== ']') continue; try { return JSON.parse(t.slice(s, e)); } catch (err) { } }
  throw new Error('Could not parse JSON from Gemma');
}
const imgPart = url => { const m = /^data:([^;]+);base64,(.*)$/.exec(url); return { inline_data: { mime_type: m[1], data: m[2] } }; };
async function shrinkImage(url, max = 1280) { const img = await loadImage(url); const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.9); }

async function gemmaReadPlan(url, cv) {
  const types = Object.keys(ROOM_TYPES).join(', ');
  const small = await shrinkImage(url);
  let prompt;
  if (cv.rooms.length >= 2) {
    const list = cv.rooms.map((r, i) => `R${i + 1}: [${Math.round(r.x0 / cv.W * 100)}, ${Math.round(r.y0 / cv.H * 100)}, ${Math.round(r.x1 / cv.W * 100)}, ${Math.round(r.y1 / cv.H * 100)}]`).join('\n');
    prompt = `You are an expert architectural floor-plan analyst for an Indian home-design app.
The attached image is a floor plan. Computer vision found these enclosed regions; boxes are [x0, y0, x1, y1] in percent of image width/height:
${list}

Tasks:
1. Read the text labels / dimensions printed on the plan and name every region. Choose "type" from: ${types}.
2. If dimension annotations are visible, give the real-world width in metres of the built area (left-most to right-most outer wall) as plan_width_m, else null. Convert feet to metres (1 ft = 0.3048 m).
3. If CV clearly missed a room, add it to extra_rooms with a percent bbox.
4. Give approximate centre points (percent of image) of every door and every window you can see.
Respond with ONLY valid JSON, no prose:
{"plan_width_m": number|null, "rooms":[{"id":"R1","name":"Living Room","type":"living"}], "extra_rooms":[{"name":"","type":"","bbox":[0,0,0,0]}], "doors":[[x,y]], "windows":[[x,y]], "notes":"one sentence"}`;
  } else {
    prompt = `You are an expert architectural floor-plan analyst. Detect every room in the attached floor plan.
For each room give name, type (one of: ${types}) and bbox [x0, y0, x1, y1] in percent (0-100) of the image width/height, tightly along the wall centre-lines. Rooms should tile the plan without overlapping.
Also give plan_width_m (real width of the built area in metres from dimension labels, else null) and approximate centre points (percent) of doors and windows.
Respond with ONLY valid JSON: {"plan_width_m": number|null, "rooms_full":[{"name":"","type":"","bbox":[0,0,0,0]}], "doors":[[x,y]], "windows":[[x,y]], "notes":""}`;
  }
  const txt = await gemma([{ text: prompt }, imgPart(small)], { temperature: 0.1, maxTokens: 4096 });
  return extractJSON(txt);
}

/* ---------- vocabulary for on-device understanding ---------- */
const FURN_WORDS = [['single bed', 'bed_single'], ['bunk', 'bunk_bed'], ['king bed', 'bed_double'], ['queen bed', 'bed_double'], ['double bed', 'bed_double'], ['bed', 'bed_double'], ['wardrobe', 'wardrobe'], ['almirah', 'wardrobe'], ['nightstand', 'side_table'], ['side table', 'side_table'], ['bedside', 'side_table'], ['dresser', 'dresser'], ['vanity', 'dresser'],
  ['gaming', 'gaming_desk'], ['gaming chair', 'gaming_chair'], ['study table', 'desk'], ['work desk', 'desk'], ['desk', 'desk'], ['office chair', 'office_chair'], ['chair', 'office_chair'], ['l-shaped sofa', 'sofa_l'], ['l shaped sofa', 'sofa_l'], ['sectional', 'sofa_l'], ['sofa', 'sofa_3'], ['couch', 'sofa_3'], ['armchair', 'armchair'], ['accent chair', 'armchair'],
  ['coffee table', 'coffee_table'], ['tv', 'tv_unit'], ['television', 'tv_unit'], ['dining table', 'dining_set'], ['dining set', 'dining_set'], ['fridge', 'fridge'], ['refrigerator', 'fridge'], ['bookshelf', 'bookshelf'], ['bookcase', 'bookshelf'], ['shelf', 'bookshelf'], ['plant', 'plant'], ['rug', 'rug'], ['floor lamp', 'floor_lamp'], ['lamp', 'floor_lamp'],
  ['bean bag', 'beanbag'], ['beanbag', 'beanbag'], ['shoe rack', 'shoe_rack'], ['cabinet', 'storage_cabinet'], ['storage', 'storage_cabinet'], ['mandir', 'pooja_unit'], ['pooja', 'pooja_unit'], ['crib', 'crib'], ['treadmill', 'treadmill'], ['pet bed', 'pet_bed'], ['dog bed', 'pet_bed'], ['washing machine', 'washing_machine'], ['bathtub', 'bathtub'], ['tub', 'bathtub'], ['shower', 'shower'], ['toilet', 'toilet'], ['basin', 'wash_basin'], ['counter', 'kitchen_counter'], ['closet system', 'closet_rack']];
const FLOOR_WORDS = [['italian marble', 'marble'], ['indian marble', 'indian_marble'], ['makrana', 'indian_marble'], ['marble', 'marble'], ['herringbone', 'herringbone'], ['walnut', 'walnut'], ['vinyl', 'vinyl'], ['lvt', 'vinyl'], ['oak', 'oak'], ['wooden', 'oak'], ['wood', 'oak'], ['laminate', 'oak'], ['granite', 'granite'], ['kota', 'kota'], ['anti-skid', 'antiskid'], ['antiskid', 'antiskid'], ['ceramic', 'ceramic'], ['vitrified', 'vitrified'], ['tile', 'vitrified'], ['carpet', 'carpet'], ['concrete', 'concrete'], ['deck', 'deck'], ['wpc', 'deck']];
const TRANSFORM_WORDS = [['home office', 'office'], ['work from home', 'office'], ['wfh', 'office'], ['office', 'office'], ['gaming', 'gaming'], ['reading', 'reading'], ['library', 'reading'], ['study', 'study'], ['walk-in', 'closet'], ['walk in', 'closet'], ['dressing', 'closet'], ['closet', 'closet'], ['nursery', 'nursery'], ['baby', 'nursery'], ['gym', 'gym'], ['workout', 'gym'], ['guest', 'guest'], ['pooja', 'pooja'], ['prayer', 'pooja'], ['mandir', 'pooja'], ['bedroom', 'bedroom']];
const THEME_WORDS = [['japandi', 'Japandi'], ['scandinavian', 'Scandinavian'], ['scandi', 'Scandinavian'], ['nordic', 'Scandinavian'], ['minimalist', 'Minimalist'], ['minimal', 'Minimalist'], ['industrial', 'Industrial'], ['indian', 'Indian Contemporary'], ['traditional', 'Indian Contemporary'], ['luxury', 'Luxury'], ['luxurious', 'Luxury'], ['premium look', 'Luxury'], ['bohemian', 'Bohemian'], ['boho', 'Bohemian'], ['modern', 'Modern'], ['contemporary', 'Modern']];
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const findWord = (t, list) => { let best = null; list.forEach(([w, v]) => { const m = new RegExp('(^|[^a-z])' + reEsc(w) + '(e?s)?(?![a-z])').exec(t); if (m && (!best || w.length > best.w.length)) best = { w, v, i: m.index }; }); return best; };
function findColor(t) {
  const hx = /#([0-9a-f]{6}|[0-9a-f]{3})\b/i.exec(t); if (hx) return { hex: '#' + hx[1], name: '#' + hx[1] };
  let best = null; Object.keys(NAMED_COLORS).forEach(n => { const re = new RegExp('\\b' + n.replace(' ', '\\s*') + '\\b'); if (re.test(t) && (!best || n.length > best.length)) best = n; });
  return best ? { hex: NAMED_COLORS[best], name: best } : null;
}
function parseAmount(t) {
  const re = /(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|l|lakh|lakhs|lac|cr|crore)?(?![a-z])/gi; let m, best = null;
  while ((m = re.exec(t))) { let v = parseFloat(m[1].replace(/,/g, '')); const u = (m[2] || '').toLowerCase(); if (u === 'k' || u === 'thousand') v *= 1e3; else if (/^l/.test(u)) v *= 1e5; else if (/^c/.test(u)) v *= 1e7; if (v >= 1000 && (!best || v > best)) best = v; }
  return best;
}
function resolveRoom(ref, focus) {
  if (!ref && focus) return [focus];
  const t = String(ref || '').toLowerCase().trim();
  if (!t) return focus ? [focus] : [];
  if (['all', 'every', 'whole', 'house', 'home', 'everywhere'].some(w => t === w || t.includes('all room') || t.includes('whole house') || t.includes('every room') || t.includes('entire'))) return allRooms();
  const byId = allRooms().find(r => r.id === ref); if (byId) return [byId];
  const exact = allRooms().find(r => r.name.toLowerCase() === t); if (exact) return [exact];
  const named = allRooms().filter(r => t.includes(r.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length);
  if (named.length) return [named[0]];
  const typeMatch = Object.keys(ROOM_TYPES).find(k => t.includes(k) || t.includes(ROOM_TYPES[k].label.toLowerCase()));
  if (/master/.test(t)) { const m = allRooms().find(r => r.type === 'master'); if (m) return [m]; }
  if (/bed ?room/.test(t)) { const m = allRooms().filter(r => ['master', 'bedroom', 'guest'].includes(r.type)); const n = /(\d)/.exec(t); if (m.length) return [n ? (m.find(r => r.name.includes(n[1])) || m[0]) : m[0]]; }
  if (/bath|toilet|washroom/.test(t)) { const m = allRooms().filter(r => r.type === 'bathroom'); if (m.length) return [m[0]]; }
  if (/lounge|hall\b|drawing/.test(t)) { const m = allRooms().find(r => r.type === 'living'); if (m) return [m]; }
  if (typeMatch) { const m = allRooms().find(r => r.type === typeMatch); if (m) return [m]; }
  if (/\b(this|here|current|it)\b/.test(t) && focus) return [focus];
  return [];
}
function mentionRoom(t, focus) {
  if (/\b(all rooms|every room|whole (house|home)|entire (house|home)|everywhere|all the rooms)\b/.test(t)) return 'all';
  const named = allRooms().filter(r => t.includes(r.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length);
  if (named.length) return named[0].id;
  for (const w of ['master bedroom', 'master', 'bedroom 2', 'second bedroom', 'kids room', 'bedroom', 'living room', 'living', 'lounge', 'hall', 'kitchen', 'dining', 'bathroom', 'washroom', 'toilet', 'balcony', 'study', 'office', 'utility', 'store', 'passage', 'guest room']) {
    if (new RegExp('\\b' + w + '\\b').test(t)) { if (w === 'second bedroom' || w === 'kids room') { const b = allRooms().filter(r => r.type === 'bedroom'); if (b.length) return b[0].id; } const r = resolveRoom(w, null); if (r.length) return r[0].id; }
  }
  return focus ? focus.id : null;
}

const ROOM_ALIASES = ['master bedroom', 'master', 'bedroom 2', 'second bedroom', 'kids room', 'bedroom', 'living room', 'living', 'lounge', 'hall', 'kitchen', 'dining', 'bathroom', 'washroom', 'toilet', 'balcony', 'study', 'office', 'utility', 'store', 'passage', 'guest room'];
function stripRoom(c, roomId) {
  const r = roomId && roomId !== 'all' ? findRoom(roomId) : null; if (!r) return c;
  let out = c.split(r.name.toLowerCase()).join(' ');
  ROOM_ALIASES.forEach(a => { if (new RegExp('\\b' + a + '\\b').test(out)) { const rr = resolveRoom(a, null); if (rr[0] === r) out = out.replace(new RegExp('\\b' + a + '\\b'), ' '); } });
  return out;
}
/* ---------- on-device intent parser ---------- */
function localParse(text, focus) {
  const T = text.toLowerCase().replace(/colour/g, 'color'); const actions = [];
  if (/^\s*(undo|go back|revert)/.test(T)) return { actions: [{ do: 'undo' }] };
  if (/\b(tour|show me around|walk me through|guide me|walkthrough)\b/.test(T)) return { actions: [{ do: 'tour' }] };
  if (/(suggest|recommend|which|what).*(color|paint)|(color|paint).*(suggest|idea|recommend)/.test(T)) { const rid = mentionRoom(T, focus); return { actions: [{ do: 'suggest_paint', room: rid || allRooms()[0]?.id }] }; }
  const clauses = T.split(/\s*(?:,(?!\d)|;|\band then\b|\bthen\b|\balso\b|\band\b(?=\s+(?:add|paint|make|change|put|place|remove|use|set|convert|turn|apply|give|design|furnish)))\s*/).filter(Boolean);
  let ctxRoom = mentionRoom(T, focus);
  clauses.forEach(c => {
    const room = mentionRoom(c, null) || ctxRoom; const a = parseClause(c, room);
    if (a) actions.push(...(Array.isArray(a) ? a : [a]));
  });
  return { actions };
}
function parseClause(c, room) {
  const amt = parseAmount(c);
  if (amt && /(under|below|within|budget|cost|less than|max)/.test(c)) return { do: 'budget', room: room || 'all', amount: amt };
  const tr = findWord(stripRoom(c, room), TRANSFORM_WORDS);
  if (tr && /(convert|turn|transform|repurpose|change|make|into|become|use .* as)/.test(c) && !/(color|paint|floor|light)/.test(c)) return { do: 'transform', room, to: tr.v };
  const th = findWord(c, THEME_WORDS);
  if (th && /(style|theme|look|design|vibe|feel|make|apply|go|switch|change|redesign|turn|interior|decor)/.test(c)) return { do: 'theme', name: th.v, room: room && !/(whole|entire|house|home|everything|all)/.test(c) ? room : 'all' };
  if (/(false ceiling|cove|tray ceiling|peripheral ceiling|ceiling)/.test(c)) { const tp = /cove/.test(c) ? 'cove' : /tray/.test(c) ? 'tray' : /peripheral/.test(c) ? 'peripheral' : /(plain|flat|remove|no )/.test(c) ? 'flat' : 'cove'; return { do: 'ceiling', room: room || 'all', type: tp }; }
  const col = findColor(c);
  if (col && /(paint|color|wall|make|change|turn|want|shade|tone|repaint|give)/.test(c) && !/\bfloor/.test(c) && !findWord(c, FURN_WORDS.filter(f => !['shelf', 'storage'].includes(f[0])))) return { do: 'wall_color', room: room || 'all', color: col.hex, name: col.name };
  const fl = findWord(c, FLOOR_WORDS);
  if (fl && /(floor|flooring|tiles|tile|marble|wood|carpet)/.test(c) && !(/(add|place|put)\b/.test(c) && findWord(c, FURN_WORDS))) return { do: 'floor', room: room || 'all', material: fl.v };
  if (/(remove|delete|get rid|take out|clear|empty)/.test(c)) { const f = findWord(c, FURN_WORDS); if (f) return { do: 'remove', room, item: f.v }; if (/(furniture|everything|all)/.test(c)) return { do: 'remove', room, item: 'all' }; }
  if (/(add|place|put|include|need|want|bring|get me|insert)/.test(c)) { const f = findWord(c, FURN_WORDS); if (f) { const n = /\b(two|2)\b/.test(c) ? 2 : /\b(three|3)\b/.test(c) ? 3 : 1; return { do: 'add', room, item: f.v, count: n, color: col?.hex }; } }
  if (/(rearrange|re-arrange|another layout|different layout|alternative layout|shuffle)/.test(c)) return { do: 'furnish', room: room || 'all', variant: 1 + Math.floor(Math.random() * 3) };
  if (/(furnish|furniture|fill|arrange|auto ?place|set ?up)/.test(c)) return { do: 'furnish', room: room || 'all' };
  const dm = /(\d+(?:\.\d+)?)\s*(?:m\s*)?(?:x|by|×|\*)\s*(\d+(?:\.\d+)?)/.exec(c);
  if (dm && /(resize|size|make|change|dimension|extend|enlarge|shrink)/.test(c)) return { do: 'resize', room, w: +dm[1], d: +dm[2] };
  if (/(bigger|larger|enlarge|extend)/.test(c) && room) return { do: 'resize_rel', room, f: 1.15 };
  if (/(smaller|shrink|reduce)/.test(c) && room) return { do: 'resize_rel', room, f: 0.88 };
  const rn = /rename (?:the )?(.+?) (?:to|as) (.+)/.exec(c); if (rn) { const rr = resolveRoom(rn[1]); if (rr.length) return { do: 'rename', room: rr[0].id, name: rn[2].replace(/\b\w/g, x => x.toUpperCase()) }; }
  const hr = /(\d{1,2})(?::(\d\d))?\s*(am|pm)/.exec(c);
  if (hr || /(sunrise|morning|noon|midday|afternoon|evening|sunset|night|dusk|dawn)/.test(c)) { let h = hr ? (+hr[1] % 12) + (hr[3] === 'pm' ? 12 : 0) + (+hr[2] || 0) / 60 : /sunrise|dawn/.test(c) ? 6.3 : /morning/.test(c) ? 8.5 : /noon|midday/.test(c) ? 12.5 : /afternoon/.test(c) ? 15.5 : /sunset|dusk|evening/.test(c) ? 18 : 21; return { do: 'time', hour: h }; }
  if (/\blight(s|ing)?\b/.test(c)) { const on = !/(off|remove|no )/.test(c); const o = { do: 'lights', room: room || 'all' }; if (/accent|mood/.test(c)) o.accent = on; else if (/task|reading/.test(c)) o.task = on; else { o.ambient = on; if (/(more|brighter|all)/.test(c)) { o.task = on; o.accent = on; } } return o; }
  if (/\b(walk|first.person|walk ?through mode)\b/.test(c)) return { do: 'view', mode: 'walk' };
  if (/\b2d\b|floor ?plan|plan view/.test(c)) return { do: 'view', mode: '2d' };
  if (/\b3d\b|dollhouse|overview/.test(c)) return { do: 'view', mode: '3d' };
  if (/(wasted|unused|clearance|space|crowd|fit|walking)/.test(c)) return [{ do: 'open', panel: 'space' }, ...(room ? [{ do: 'goto', room }] : [])];
  if (/(cost|price|estimate|expens|how much|budget)/.test(c)) return { do: 'open', panel: 'budget' };
  if (/(sun|daylight|ventilat|airflow|breeze|natural light)/.test(c)) return { do: 'open', panel: 'light' };
  if (/(structur|validat|load.bearing|check (my )?plan|connectivity)/.test(c)) return { do: 'open', panel: 'arch' };
  if (/report/.test(c)) return { do: 'open', panel: 'report' };
  if (/compar/.test(c)) return { do: 'open', panel: 'compare' };
  if (/(go to|show|take me|visit|view|look at|zoom)/.test(c) && room) return { do: 'goto', room };
  return null;
}

/* ---------- action executor ---------- */
function execActions(actions, focus) {
  const done = [], fail = []; let needBuild = false, structural = false;
  if (!actions.length) return { done, fail };
  const mutating = actions.some(a => !['tour', 'goto', 'view', 'open', 'time', 'suggest_paint', 'undo'].includes(a.do));
  if (mutating) commit('AI: ' + actions.map(a => a.do).join(', '));
  const roomsOf = a => a.room === 'all' ? allRooms() : resolveRoom(a.room, focus);
  actions.forEach(a => {
    try {
      const rooms = roomsOf(a);
      const rn = rooms.length === allRooms().length && rooms.length > 1 ? 'every room' : rooms.map(r => r.name).join(', ');
      switch (a.do) {
        case 'undo': undo(); done.push('Undid the last change.'); break;
        case 'wall_color': { const hex = /^#/.test(a.color) ? a.color : (NAMED_COLORS[String(a.color).toLowerCase()] || findColor(String(a.color).toLowerCase())?.hex); if (!hex || !rooms.length) { fail.push('wall colour'); break; } rooms.forEach(r => r.wall = hex); done.push(`Painted ${rn} ${a.name || hex}.`); needBuild = true; break; }
        case 'floor': { const k = FLOORS[a.material] ? a.material : findWord(String(a.material).toLowerCase(), FLOOR_WORDS)?.v; if (!k || !rooms.length) { fail.push('flooring'); break; } rooms.forEach(r => r.floor = k); done.push(`Changed flooring in ${rn} to ${FLOORS[k].label}.`); needBuild = true; break; }
        case 'add': { const type = CATALOG[a.item] ? a.item : findWord(String(a.item).toLowerCase(), FURN_WORDS)?.v; const r = rooms[0]; if (!type || !r) { fail.push('add ' + a.item); break; } let n = 0; for (let i = 0; i < (a.count || 1); i++) { const fr = floorOfRoom(r); let it = null; for (const s of sideScores(r, fr)) { it = placeOnWall(r, fr, type, s); if (it) break; } if (!it) it = placeFree(r, fr, type); if (it) { if (a.color) it.color = a.color; r.furniture.push(it); n++; if (/desk/.test(type)) addChairFor(r, fr, it, type === 'gaming_desk' ? 'gaming_chair' : 'office_chair'); } } if (n) { done.push(`Added ${n > 1 ? n + ' × ' : 'a '}${CATALOG[type].label.toLowerCase()} to ${r.name}.`); needBuild = true; } else fail.push(`There is no free spot for a ${CATALOG[type].label.toLowerCase()} in ${r.name} (try the Fit Checker in Space Analyzer)`); break; }
        case 'remove': { const r = rooms[0]; if (!r) { fail.push('remove'); break; } const before = r.furniture.length; if (a.item === 'all') r.furniture = []; else { const type = CATALOG[a.item] ? a.item : findWord(String(a.item).toLowerCase(), FURN_WORDS)?.v; const i = r.furniture.findIndex(f => f.type === type || f.type.startsWith(String(type).split('_')[0])); if (i >= 0) r.furniture.splice(i, 1); } if (r.furniture.length < before) { done.push(`Removed ${a.item === 'all' ? 'all furniture' : CATALOG[a.item]?.label.toLowerCase() || a.item} from ${r.name}.`); needBuild = true; } else fail.push(`no ${a.item} in ${r.name}`); break; }
        case 'furnish': { rooms.forEach(r => autoFurnish(r, floorOfRoom(r), a.variant || 0)); done.push(`${a.variant ? 'Re-arranged' : 'Furnished'} ${rn} with ${rooms.reduce((s, r) => s + r.furniture.length, 0)} pieces, keeping door swings and walkways clear.`); needBuild = true; break; }
        case 'theme': { const nm = THEMES[a.name] ? a.name : findWord(String(a.name).toLowerCase(), THEME_WORDS)?.v; if (!nm) { fail.push('theme'); break; } applyTheme(nm, a.room === 'all' || !rooms.length || rooms.length === allRooms().length ? null : rooms); done.push(`Applied the ${nm} theme to ${a.room === 'all' || rooms.length === allRooms().length ? 'the whole home' : rn} — ${THEMES[nm].desc}`); needBuild = true; break; }
        case 'transform': { const r = rooms[0]; const to = ROOM_TYPES[a.to] ? a.to : findWord(String(a.to).toLowerCase(), TRANSFORM_WORDS)?.v; if (!r || !to) { fail.push('transform'); break; } const oldName = r.name; const res = transformRoom(r, to); done.push(`Transformed ${oldName} into a ${ROOM_TYPES[to].label} (${r.furniture.length} new pieces). Estimated cost ${inr(res.before)} → ${inr(res.after)}.`); needBuild = true; break; }
        case 'rename': { const r = rooms[0]; if (!r || !a.name) { fail.push('rename'); break; } r.name = String(a.name).slice(0, 30); done.push(`Renamed to ${r.name}.`); needBuild = true; break; }
        case 'resize': case 'resize_rel': { const r = rooms[0]; if (!r) { fail.push('resize'); break; } const w = a.do === 'resize' ? +a.w : r2(r.w * a.f), d = a.do === 'resize' ? +a.d : r2(r.d * a.f); if (!(w > 0.8 && d > 0.8 && w < 30 && d < 30)) { fail.push('resize'); break; } const ext = isExteriorPoint(floorOfRoom(r), 'v', r.x + r.w, r.y + r.d / 2) || isExteriorPoint(floorOfRoom(r), 'h', r.y + r.d, r.x + r.w / 2); r.w = snap(w); r.d = snap(d); r.furniture.forEach(it => { it.x = clamp(it.x, r.x + 0.3, r.x + r.w - 0.3); it.y = clamp(it.y, r.y + 0.3, r.y + r.d - 0.3); }); done.push(`Resized ${r.name} to ${r.w} × ${r.d} m.`); if (ext) { structural = true; S.structuralLog.push(`${r.name} was resized through an outer wall — external walls are usually load-bearing; get a structural engineer to review before construction.`); } needBuild = true; break; }
        case 'budget': { const rs = rooms.length ? rooms : allRooms(); const res = optimizeBudget(rs, +a.amount); done.push(res.ok ? `Optimised ${rs.length === allRooms().length ? 'the home' : rn} to ${inr(res.end)} (from ${inr(res.start)}), within your ${inr(a.amount)} budget. ${res.steps.length} swaps made — see Budget panel.` : `Brought ${rn} down from ${inr(res.start)} to ${inr(res.end)} — the leanest version still exceeds ${inr(a.amount)}.`); S.lastOptimize = res; needBuild = true; break; }
        case 'ceiling': { const tp = CEILINGS[a.type] ? a.type : 'cove'; rooms.forEach(r => r.ceiling = tp); done.push(`Set ${CEILINGS[tp].label.toLowerCase()} in ${rn}.`); needBuild = true; break; }
        case 'lights': { rooms.forEach(r => { r.lights = r.lights || {}; ['ambient', 'task', 'accent'].forEach(k => { if (typeof a[k] === 'boolean') r.lights[k] = a[k]; }); }); done.push(`Updated lighting in ${rn}. Slide the time to evening to see it.`); needBuild = true; break; }
        case 'time': setHour(+a.hour); done.push(`Simulating sunlight at ${fmtHour(+a.hour)}.`); break;
        case 'tour': setTimeout(() => startTour(), 300); done.push('Starting your animated home tour…'); break;
        case 'goto': { const r = rooms[0]; if (r) { setTimeout(() => focusRoom(r), 100); done.push(`Taking you to ${r.name}.`); } break; }
        case 'view': setView(a.mode); done.push(`Switched to ${a.mode === 'walk' ? 'walk-through' : a.mode.toUpperCase()} view.`); break;
        case 'open': openPanel(a.panel); done.push(`Opened ${({ space: 'Space Analyzer', budget: 'Budget Estimator', light: 'Light & Ventilation', arch: 'Architectural checks', report: 'Home Decision Report', compare: 'Design Comparison', design: 'Interior Designer' })[a.panel] || a.panel}.`); break;
        case 'suggest_paint': { const r = rooms[0] || allRooms()[0]; S.paintChips = { room: r.id, list: paintSuggestions(r) }; done.push(`Here are paint ideas for ${r.name} — tap one to apply:`); break; }
        default: fail.push(a.do);
      }
    } catch (e) { console.error(e); fail.push(a.do); }
  });
  if (needBuild) { rebuild(); save(); }
  return { done, fail, structural };
}

function homeSummaryForAI(focus) {
  const rooms = allRooms().map(r => ({ id: r.id, name: r.name, type: r.type, size: `${r.w}x${r.d}m`, wall: roomWall(r), floor: roomFloorKey(r), items: r.furniture.map(i => i.type).join(',') }));
  return JSON.stringify({ theme: P().theme, budget: S.prefs.budget, prefs: { family: S.prefs.family, pets: S.prefs.pets, kids: S.prefs.kids, wfh: S.prefs.wfh, colors: S.prefs.colors }, focus_room: focus ? focus.id : null, rooms });
}
const ACTION_DOC = `Actions you can return (use exact keys; "room" is a room id from the state, or "all"):
{"do":"wall_color","room":"..","color":"#hex","name":"colour name"}
{"do":"floor","room":"..","material":"${Object.keys(FLOORS).join('|')}"}
{"do":"add","room":"..","item":"${Object.keys(CATALOG).join('|')}","count":1}
{"do":"remove","room":"..","item":"<catalog item>|all"}
{"do":"furnish","room":"..","variant":0}
{"do":"theme","name":"${Object.keys(THEMES).join('|')}","room":"..|all"}
{"do":"transform","room":"..","to":"${Object.keys(ROOM_TYPES).join('|')}"}
{"do":"rename","room":"..","name":".."}
{"do":"resize","room":"..","w":metres,"d":metres}
{"do":"budget","room":"..|all","amount":rupees}
{"do":"ceiling","room":"..|all","type":"flat|peripheral|cove|tray"}
{"do":"lights","room":"..|all","ambient":true,"task":true,"accent":true}
{"do":"time","hour":0-24}
{"do":"tour"} {"do":"goto","room":".."} {"do":"view","mode":"3d|2d|walk"}
{"do":"open","panel":"design|space|budget|light|transform|arch|compare|report"}
{"do":"suggest_paint","room":".."}`;
const chatHistory = [];
async function askAria(text, focus) {
  let parsed = null, via = 'on-device';
  if (S.apiKey) {
    try {
      const prompt = `You are Aria, the AI home assistant inside DIMORA, an Indian home-design app. You don't just answer — you take actions on the user's 3D home.
Current home state (JSON): ${homeSummaryForAI(focus)}
${ACTION_DOC}
Rules: Map the request to actions. If the user says "this room"/"here", use focus_room. Prices are in Indian Rupees. If the user only asks a question, answer it helpfully with actions []. Keep "reply" to 1–3 warm, specific sentences (mention concrete sizes, colours, costs when relevant).
User: ${text}
Respond with ONLY JSON: {"reply":"...","actions":[...]}`;
      const out = await gemma([{ text: prompt }], { temperature: 0.3, maxTokens: 1500, history: chatHistory.slice(-6) });
      parsed = extractJSON(out); via = S.model;
      chatHistory.push({ role: 'user', parts: [{ text }] }, { role: 'model', parts: [{ text: JSON.stringify({ reply: parsed.reply }) }] });
    } catch (e) { console.warn('Gemma failed', e); parsed = null; S.lastGemmaError = e.message; }
  }
  if (!parsed) parsed = localParse(text, focus);
  const actions = Array.isArray(parsed.actions) ? parsed.actions.filter(a => a && a.do) : [];
  const res = execActions(actions, focus);
  let reply = parsed.reply || '';
  if (!reply) {
    if (res.done.length) reply = res.done.join(' ');
    else reply = helpReply(text);
  } else if (res.done.length && via === 'on-device') reply += ' ' + res.done.join(' ');
  if (res.fail.length && !res.done.length && actions.length) reply += ` (I couldn't do: ${res.fail.join('; ')}.)`;
  if (res.structural) reply += ' ⚠️ That change touches an outer wall — flagged for structural review.';
  return { reply, via, actions, res };
}
function helpReply(text) {
  if (/(hi|hello|hey|namaste)\b/i.test(text)) return `Namaste! I'm Aria. I can redesign your home for you — try “paint the master bedroom sage green”, “convert the study into a gaming room”, “design my bedroom under ₹30,000” or “give me a tour”.`;
  if (/how much|cost|price/i.test(text)) { const c = homeCost(); return `Your current design is estimated at ${inr(c.total)} (illustrative): furniture ${inr(c.furniture)}, flooring ${inr(c.flooring)}, painting ${inr(c.paint)}, lighting ${inr(c.lighting)}, false ceiling ${inr(c.ceiling)}, decor ${inr(c.decor)}.`; }
  if (/(biggest|largest|area|size)/i.test(text)) { const rs = allRooms().slice().sort((a, b) => area(b) - area(a)); return `Total carpet area is ${r2(rs.reduce((s, r) => s + area(r), 0))} m². Largest: ${rs[0].name} (${rs[0].w} × ${rs[0].d} m, ${r2(area(rs[0]))} m²).`; }
  return `I can change colours, flooring, furniture, themes, room purposes, lighting, ceilings and budgets — or take you on a tour. Try: “make the living room Japandi”, “add a bookshelf to the study”, “Italian marble floor in the living room”, or “show me sunset light”.${S.apiKey ? '' : ' Add your Gemma 4 API key in Settings for free-form conversation.'}`;
}

/* ---------- tour narration ---------- */
function roomFacts(r) {
  const L = analyzeLight(r), Sx = analyzeSpace(r), c = roomCost(r);
  return { L, Sx, c, line: `${r.name}: ${r.w}×${r.d} m (${r2(area(r))} m²), ${ROOM_TYPES[r.type].label}; walls ${roomWall(r)}, floor ${FLOORS[roomFloorKey(r)].label}; furniture: ${r.furniture.map(i => CATALOG[i.type].label).join(', ') || 'none'}; daylight ${L.rating}${L.dirs.length ? ' (' + L.dirs.join('/') + '-facing)' : ''}, ventilation ${L.vent}; space ${Sx.status}, ${Sx.issues[0] || 'no clearance issues'}${Sx.corner ? `; unused corner ${r2(Sx.corner.w)}×${r2(Sx.corner.d)} m` : ''}; est. cost ${inr(c.total)}` };
}
function templateNarration(r) {
  const { L, Sx, c } = roomFacts(r); const t = ROOM_TYPES[r.type].label.toLowerCase();
  const open = { living: `Welcome to the ${r.name} — the social heart of your home.`, master: `This is the ${r.name}, your private retreat.`, bedroom: `Here's ${r.name}.`, kitchen: `Now the ${r.name}, where the action happens.`, dining: `This is the ${r.name}.`, bathroom: `The ${r.name}.`, balcony: `Step out to the ${r.name} for some fresh air.`, study: `This is the ${r.name}, set up for focus.`, office: `Your ${r.name}, built for productive work-from-home days.`, gaming: `Welcome to the ${r.name}!` }[r.type] || `This is the ${r.name}.`;
  const size = `It measures ${r.w} by ${r.d} metres — about ${Math.round(area(r) * SQFT)} square feet.`;
  const light = L.wins.length ? `It gets ${L.rating.toLowerCase()} daylight from the ${L.dirs.join(' and ')}${L.dirs.some(d => d.includes('E')) ? ', lovely in the mornings' : L.dirs.some(d => d.includes('W')) ? ', so afternoons run warm' : ''}.` : `There's no outside window here, so good artificial lighting and an exhaust matter.`;
  const furn = r.furniture.length ? `I've placed ${r.furniture.slice(0, 3).map(i => 'a ' + CATALOG[i.type].label.toLowerCase()).join(', ')}${r.furniture.length > 3 ? ` and ${r.furniture.length - 3} more pieces` : ''}, on ${FLOORS[roomFloorKey(r)].label.toLowerCase()}.` : `It's empty right now — ask me to furnish it.`;
  const tip = Sx.corner ? `Tip: the ${r2(Sx.corner.w)} by ${r2(Sx.corner.d)} metre corner is unused — it would make a great reading nook or study corner.` : Sx.issues[0] ? `One thing to watch: ${Sx.issues[0]}` : L.sugg[0] ? L.sugg[0] : `Walking clearance looks comfortable.`;
  return `${open} ${size} ${light} ${furn} ${tip} Estimated interior cost: ${inr(c.total)}.`;
}
async function gemmaNarrations(order) {
  const facts = order.map(r => `[${r.id}] ` + roomFacts(r).line).join('\n');
  const prompt = `You are Aria, a warm, witty Indian interior-design guide giving a spoken, animated home tour in DIMORA.
Home theme: ${P().theme}. Household: ${S.prefs.family} people${S.prefs.kids ? ', kids' : ''}${S.prefs.pets ? ', pets' : ''}${S.prefs.wfh ? ', works from home' : ''}.
Rooms in tour order with facts:
${facts}
Write narration to be read aloud. For each room 2–3 short sentences (max 55 words): describe the space using the real facts, then one practical, specific suggestion. Mention cost in ₹ only for 2–3 rooms. Plain text, no emojis or markdown.
Respond ONLY with JSON: {"intro":"...","rooms":{"<id>":"..."},"outro":"..."}`;
  const out = await gemma([{ text: prompt }], { temperature: 0.7, maxTokens: 3000 });
  return extractJSON(out);
}

/* ---------- inspiration image → style ---------- */
function extractPalette(img, k = 5) {
  const c = document.createElement('canvas'); const s = 64 / Math.max(img.width, img.height); c.width = Math.max(1, img.width * s | 0); c.height = Math.max(1, img.height * s | 0);
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height); const d = x.getImageData(0, 0, c.width, c.height).data; const px = [];
  for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
  let cents = px.filter((_, i) => i % Math.floor(px.length / k) === 0).slice(0, k).map(p => p.slice());
  for (let it = 0; it < 8; it++) { const acc = cents.map(() => [0, 0, 0, 0]); px.forEach(p => { let bi = 0, bd = 1e9; cents.forEach((c, i) => { const dd = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2; if (dd < bd) { bd = dd; bi = i; } }); const a = acc[bi]; a[0] += p[0]; a[1] += p[1]; a[2] += p[2]; a[3]++; }); cents = acc.map((a, i) => a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3], a[3]] : cents[i]); }
  return cents.sort((a, b) => (b[3] || 0) - (a[3] || 0)).map(c => rgbToHex(c[0] / 255, c[1] / 255, c[2] / 255));
}
function closestTheme(pal) {
  let best = null; Object.entries(THEMES).forEach(([n, t]) => { const tp = [t.walls[0], t.wood, t.fabric, t.accent].map(hexToRgb); let d = 0; pal.slice(0, 4).map(hexToRgb).forEach(p => { d += Math.min(...tp.map(q => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2)); }); if (!best || d < best.d) best = { n, d }; });
  return best.n;
}
async function analyzeInspiration(url) {
  const img = await loadImage(url); const pal = extractPalette(img);
  let res = { style: closestTheme(pal), palette: pal, via: 'on-device colour analysis' };
  const light = pal.slice().sort((a, b) => hexToRgb(b).reduce((s, v) => s + v, 0) - hexToRgb(a).reduce((s, v) => s + v, 0));
  res.wall = mixHex(light[0], '#f4f1ea', 0.35); res.accent = pal.find(h => { const [r, g, b] = hexToRgb(h); return Math.max(r, g, b) - Math.min(r, g, b) > 0.18; }) || pal[1];
  if (S.apiKey) {
    try {
      const out = await gemma([{ text: `Analyse this interior inspiration photo. Respond ONLY JSON: {"style":"one of ${Object.keys(THEMES).join(', ')}","wall":"#hex wall paint colour seen or implied","accent":"#hex","floor":"one of ${Object.keys(FLOORS).join(', ')}","furniture_finish":"one of ${Object.keys(WOOD_FINISHES).join(', ')}","description":"1-2 sentences on what defines this look"}` }, imgPart(await shrinkImage(url, 900))], { temperature: 0.2, maxTokens: 800 });
      const j = extractJSON(out); if (THEMES[j.style]) res.style = j.style; if (/^#/.test(j.wall || '')) res.wall = j.wall; if (/^#/.test(j.accent || '')) res.accent = j.accent; if (FLOORS[j.floor]) res.floor = j.floor; if (WOOD_FINISHES[j.furniture_finish]) res.finish = j.furniture_finish; res.description = j.description; res.via = S.model;
    } catch (e) { res.via += ` (${modelLabel()} unavailable)`; }
  }
  return res;
}
