'use strict';
// Přání občanů, městské akce, sledovací kamera a fotorežim, lodě na řece, letadla, světla aut a vlaků v noci.

// ---------- čtvrti s vlastními jmény ----------
const DISTRICTS = ['Na Výsluní', 'Za Kostelem', 'U Rybníka', 'Horní Konec', 'Dolní Konec', 'Na Kopečku', 'U Mlýna', 'Zahrádky', 'Nové Domy', 'Na Vyhlídce', 'U Hřiště', 'Sídliště Jih', 'Sídliště Sever', 'Lipová', 'Kaštanová', 'Na Stráni', 'U Lesa', 'Na Pláni', 'Za Humny', 'Pod Skalou', 'Javorová', 'Nad Potokem', 'U Kapličky', 'Ořechovka'];
function districtName(x, y) {
  const dx = x - W.cx, dy = y - W.cy;
  if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return 'Centrum';
  if (W.railY && Math.abs(y - W.railY) <= 3) return y > W.railY ? 'Za Tratí' : 'U Nádraží';
  for (let r = 1; r <= 3; r++) for (const [i, j] of [[r, 0], [-r, 0], [0, r], [0, -r]]) if (inb(x + i, y + j) && ter[idx(x + i, y + j)] === 1) return 'Na Nábřeží';
  return DISTRICTS[Math.floor(hash2(Math.floor(x / 9), Math.floor(y / 9), (W.seed || 1) + 5) * DISTRICTS.length)];
}

// ---------- přání občanů ----------
const REQ = {
  park: { t: 'Park', ask: 'Chceme park, kde si děti můžou hrát.', ok: k => cov.park[k] >= 0.45, spawn: k => cov.park[k] < 0.15 },
  school: { t: 'Škola blíž domovům', ask: 'Děti chodí do školy přes celé město.', ok: k => cov.edu[k] >= 0.45, spawn: k => cov.edu[k] < 0.15 },
  clinic: { t: 'Lékař ve čtvrti', ask: 'K doktorovi jezdíme přes půl města.', ok: k => cov.health[k] >= 0.45, spawn: k => cov.health[k] < 0.15 },
  police: { t: 'Bezpečnější ulice', ask: 'V noci se bojíme vyjít ven.', ok: k => cov.police[k] >= 0.5 && crime[k] < 18, spawn: k => crime[k] > 22 },
  fire: { t: 'Hasiči v dosahu', ask: 'Když začne hořet, hasiči nestihnou dojet.', ok: k => cov.fire[k] >= 0.5, spawn: k => cov.fire[k] < 0.15 && lvl[k] >= 2 },
  transit: { t: 'Spoj MHD nebo vlak', ask: 'Do práce jezdíme autem, chceme autobus, tramvaj nebo vlak.', ok: k => cov.transit[k] >= 0.4, spawn: k => cov.transit[k] < 0.1 && T.pop > 4000 },
  clean: { t: 'Čistý vzduch', ask: 'Smog z okolních komínů nás dusí.', ok: k => poll[k] < 12, spawn: k => poll[k] > 28 },
  quiet: { t: 'Méně aut v ulicích', ask: 'Pod okny stojí kolony aut.', ok: k => nearTraffic(k) < 0.7, spawn: k => nearTraffic(k) > 1.05 },
};
const CITY_REQ = {
  tax: { t: 'Nižší daň z bydlení', ask: 'Daně jsou moc vysoké.', ok: () => S.tax.R <= 8, spawn: () => S.tax.R >= 11 },
  jobs: { t: 'Víc pracovních míst', ask: 'Lidé nemají práci.', ok: () => T.unemp < 0.05, spawn: () => T.unemp > 0.09 },
  power: { t: 'Konec výpadků proudu', ask: 'Pořád nám vypadává elektřina.', ok: () => T.pRatio >= 0.999, spawn: () => T.pRatio < 0.95 && T.pDem > 0 },
};
const lcf = s => s.charAt(0).toLowerCase() + s.slice(1);
function nearTraffic(k) { const x = k % N, y = (k / N) | 0; let m = 0; for (const [dx, dy] of NB4) if (inb(x + dx, y + dy)) m = Math.max(m, traf[idx(x + dx, y + dy)]); return m; }
function reqSpawn() {
  S.reqs = S.reqs || []; if (S.reqs.length >= 3 || T.pop < 300 || !chance(0.45)) return;
  if (chance(0.25)) { const ids = Object.keys(CITY_REQ).filter(id => !S.reqs.some(r => r.type === id) && CITY_REQ[id].spawn()); if (ids.length) { const id = pickOne(ids); S.reqs.push({ type: id, city: true, day: S.day, until: S.day + 180 }); note('Přání občanů: ' + CITY_REQ[id].t + '. „' + CITY_REQ[id].ask + '“', 'tip'); return; } }
  const res = []; for (let k = 0; k < NN; k += 3) if (zone[k] === 1 && lvl[k] && !aband[k] && occ[k] > 5) res.push(k);
  for (let tries = 0; tries < 12 && res.length; tries++) {
    const k = pickOne(res), id = pickOne(Object.keys(REQ)), R = REQ[id]; if (!R.spawn(k) || R.ok(k)) continue;
    const x = k % N, y = (k / N) | 0, name = districtName(x, y); if (S.reqs.some(r => r.type === id && Math.hypot(r.x - x, r.y - y) < 10)) continue;
    S.reqs.push({ type: id, x, y, k, name, day: S.day, until: S.day + 240 });
    note('Přání občanů ze čtvrti ' + name + ': ' + lcf(R.t) + '. „' + R.ask + '“', 'tip', k); return;
  }
}
function reqMonthly() {
  S.reqs = S.reqs || []; S.stat = S.stat || {};
  for (const r of S.reqs.slice()) {
    const D = r.city ? CITY_REQ[r.type] : REQ[r.type]; if (!D) { S.reqs.splice(S.reqs.indexOf(r), 1); continue; }
    if (r.city ? D.ok() : D.ok(r.k)) { S.reqs.splice(S.reqs.indexOf(r), 1); S.mood += 3; S.stat.reqs = (S.stat.reqs || 0) + 1; note('Splnil jsi přání ' + (r.city ? 'občanů' : 'čtvrti ' + r.name) + ': ' + lcf(D.t) + '. Lidé to oceňují.', 'good', r.city ? -1 : r.k); sfx('coin'); }
    else if (S.day > r.until) { S.reqs.splice(S.reqs.indexOf(r), 1); S.mood -= 2; note('Přání ' + (r.city ? 'občanů' : 'čtvrti ' + r.name) + ' (' + lcf(D.t) + ') zůstalo nesplněné. Lidé jsou zklamaní.', 'bad', r.city ? -1 : r.k); }
  }
  reqSpawn();
}

// ---------- městské akce ----------
const EVENTS = {
  pout: { name: 'Pouť', v: ['začíná', 'skončila'], cost: 300000, days: 10, happy: 4, com: 0.08, tour: 3, venues: ['plaza', 'park', 'bigpark', 'church', 'townhall'], desc: 'Kolotoč, stánky s cukrovou vatou, perníkem a střelnicí.' },
  festival: { name: 'Hudební festival', v: ['začíná', 'skončil'], cost: 900000, days: 6, happy: 6, com: 0.05, tour: 8, crime: 3, minPop: 4000, venues: ['bigpark', 'stadium', 'park', 'castle'], desc: 'Pódium, světla a tisíce fanoušků. Hluk ale ruší sousedy a přibude výtržností.' },
  trhy: { name: 'Vánoční trhy', v: ['začínají', 'skončily'], cost: 400000, days: 24, happy: 5, com: 0.15, tour: 4, month: 11, venues: ['plaza', 'townhall', 'church', 'castle'], desc: 'Velký stromeček, svařák a dřevěné stánky. Jen v prosinci.' },
  beh: { name: 'Městský běh', v: ['začíná', 'skončil'], cost: 200000, days: 3, happy: 2, health: 3, tour: 1, venues: ['park', 'bigpark', 'stadium', 'townhall'], desc: 'Tisíce běžců v ulicích. Lidé se hýbou a jsou zdravější.' },
  den: { name: 'Den města s ohňostrojem', v: ['začíná', 'skončil'], cost: 600000, days: 3, happy: 3, mood: 4, tour: 2, venues: ['townhall', 'plaza', 'castle', 'bigpark'], desc: 'Koncert na náměstí a večer velký ohňostroj. Lidé ocení radnici.' },
};
function eventVenues(type) { const v = EVENTS[type].venues; return [...blds.values()].filter(b => v.includes(b.type) && b.ok); }
function eventProblem(type) {
  const E = EVENTS[type]; S.evLast = S.evLast || {};
  if ((S.events || []).some(e => e.type === type)) return 'Tahle akce právě probíhá.';
  if (E.month != null && monthOf(S.day) !== E.month) return 'Jen v prosinci.';
  if (E.minPop && T.pop < E.minPop) return 'Potřebuje aspoň ' + fmt(E.minPop) + ' obyvatel.';
  if (S.evLast[type] && S.day - S.evLast[type] < 150) return 'Znovu až za ' + Math.ceil((150 - (S.day - S.evLast[type])) / 30) + ' měs.';
  if (!eventVenues(type).length) return 'Chybí místo: ' + E.venues.map(v => SERV[v].name.toLowerCase()).join(', ') + '.';
  return null;
}
function startEvent(type, bid) {
  const err = eventProblem(type); if (err) return err;
  const E = EVENTS[type], b = blds.get(bid) || eventVenues(type)[0]; if (!b) return 'Chybí místo konání.';
  if (!canAfford(E.cost)) return 'Na to nemáš peníze (' + money(E.cost) + ').';
  spend(E.cost); S.events = S.events || []; S.evLast[type] = S.day;
  S.events.push({ type, b: b.id, x: b.x, y: b.y, size: b.size, start: S.day, end: S.day + E.days });
  if (E.mood) S.mood += E.mood;
  note(E.name + ' ' + E.v[0] + ' u stavby „' + SERV[b.type].name + '“ (' + districtName(b.x, b.y) + '). Potrvá ' + E.days + ' dní.', 'good', idx(b.x, b.y)); sfx('fanfare');
  eventEffects(); return null;
}
function eventEffects() {
  let h = 0, c = 0, t = 0, cr = 0, he = 0;
  for (const e of S.events || []) { const E = EVENTS[e.type]; h += E.happy || 0; c += E.com || 0; t += E.tour || 0; cr += E.crime || 0; he += E.health || 0; }
  T.evHappy = Math.min(10, h); T.evCom = c; T.evTour = t; T.evCrime = cr; T.evHealth = he;
}
function eventsDay() {
  if (!S.events || !S.events.length) { T.evHappy = 0; T.evCom = 0; T.evTour = 0; T.evCrime = 0; T.evHealth = 0; return; }
  for (const e of S.events.slice()) if (S.day >= e.end) {
    S.events.splice(S.events.indexOf(e), 1); const E = EVENTS[e.type], came = Math.round(Math.min(T.pop * 0.6, 800 + T.pop * (0.15 + Math.random() * 0.2)) * (E.tour ? 1.3 : 1));
    S.stat = S.stat || {}; S.stat.events = (S.stat.events || 0) + 1;
    note(E.name + ' ' + E.v[1] + '. Přišlo asi ' + fmt(came) + ' lidí.', 'good');
  }
  eventEffects();
}

// ---------- napojení na simulaci ----------
function extrasMonthly() { reqMonthly(); }
function extrasDay() { eventsDay(); }

// ---------- kulisy akcí: stánky, kolotoč, pódium, stromeček, cílová brána ----------
function mStall(c) { const b = new GB(); b.use('wood').box(1.3, 0.9, 0.9, 0x8a6a48, 0, 0, 0).box(1.4, 0.08, 1.0, 0x6a4f36, 0, 0.9, 0); b.use('paint').gable(1.5, 0.45, 1.1, c, 0, 1.4, 0, Math.PI / 2); b.use('wood'); for (const x of [-0.65, 0.65]) b.box(0.07, 0.5, 0.07, 0x6a4f36, x, 0.9, 0.45); return b.geo(); }
function mCarousel() { const b = new GB(); b.use('plain').cyl(1.6, 1.6, 0.2, 0xf2e6c8, 0, 0, 0, 20); b.use('metal').cyl(0.1, 0.1, 2.2, 0xd9b84a, 0, 0.2, 0, 8); b.use('paint').cone(1.8, 0.8, 0xc8372d, 0, 2.3, 0, 12);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; b.use('metal').cyl(0.03, 0.03, 1.9, 0xd9b84a, Math.cos(a) * 1.25, 0.3, Math.sin(a) * 1.25, 4); b.use('paint').box(0.45, 0.4, 0.25, [0xf4c447, 0x3f82dd, 0x47a85b, 0xf2f0ea][i % 4], Math.cos(a) * 1.25, 0.75, Math.sin(a) * 1.25, -a); } return b.geo(); }
function mStage() { const b = new GB(); b.use('wood').box(5, 0.9, 3, 0x3a3d42, 0, 0, 0); b.use('metal'); for (const [x, z] of [[-2.4, -1.4], [2.4, -1.4], [-2.4, 1.4], [2.4, 1.4]]) b.box(0.15, 3.6, 0.15, 0x55595e, x, 0.9, z);
  b.box(5, 0.25, 0.25, 0x55595e, 0, 4.4, -1.4).box(5, 0.25, 0.25, 0x55595e, 0, 4.4, 1.4).box(0.25, 0.25, 3, 0x55595e, -2.4, 4.4, 0).box(0.25, 0.25, 3, 0x55595e, 2.4, 4.4, 0);
  b.use('plain').box(4.6, 3.2, 0.1, 0x14161a, 0, 0.9, -1.45).box(0.9, 1.4, 0.8, 0x22252a, -2.9, 0, 0).box(0.9, 1.4, 0.8, 0x22252a, 2.9, 0, 0); return b.geo(); }
function mXmasTree() { const b = new GB(); b.use('plain').cyl(0.2, 0.25, 1, PAL.trunk, 0, 0, 0, 6); b.use('leaf'); for (let i = 0; i < 4; i++) b.cone(2.2 - i * 0.45, 1.8, 0x2f5a35, 0, 0.8 + i * 1.2, 0, 12); b.use('paint').cone(0.25, 0.5, 0xf4c447, 0, 5.8, 0, 5); return b.geo(); }
function mArch() { const b = new GB(); b.use('paint'); b.box(0.3, 3, 0.3, 0xc8372d, -2, 0, 0).box(0.3, 3, 0.3, 0xc8372d, 2, 0, 0).box(4.4, 0.7, 0.3, 0xf2f0ea, 0, 3, 0).use('plain').box(3.4, 0.35, 0.32, 0x2f5f9f, 0, 3.17, 0); return b.geo(); }
const EV_PROPS = new Map(), EV_PPL = new Map();
let evBulbB = null;
function venueCenter(e) { return [tileX(e.x) + (e.size - 1) * TS / 2, tileZ(e.y) + (e.size - 1) * TS / 2]; }
function updateEventVisuals(dt, t) {
  const live = new Set();
  for (const e of S.events || []) {
    const id = e.type + e.b; live.add(id); const [cx, cz] = venueCenter(e), R = e.size * TS / 2 + 2.2;
    if (!EV_PROPS.has(id)) {
      const hs = [], put = (key, fn, x, z, ry) => hs.push(batch(key, fn, MATS, { shadow: true, cap: 32 }).add({ ry }, mtx(cx + x, 0.05, cz + z, ry || 0)));
      const ring = (n, fn, key, r) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + 0.3; put(key, fn, Math.cos(a) * r, Math.sin(a) * r, -a + Math.PI / 2); } };
      if (e.type === 'pout') { put('EVCAR', mCarousel, R + 1.5, 0, 0); for (const [i, c] of [0xc8372d, 0x2f5f9f, 0xf4c447, 0x3f7f4f, 0xe05a8a].entries()) put('EVST' + i, () => mStall(c), Math.cos(i * 1.2 + 2) * R, Math.sin(i * 1.2 + 2) * R, -(i * 1.2 + 2)); }
      if (e.type === 'trhy') { put('EVTREE', mXmasTree, 0, R, 0); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.6; put('EVST' + (i % 2 ? 0 : 4) + 'w', () => mStall(i % 2 ? 0x8f2a22 : 0x3f5f3a), Math.cos(a) * R, Math.sin(a) * R, -a + Math.PI / 2); } }
      if (e.type === 'festival') { put('EVSTAGE', mStage, 0, -R, 0); for (let i = 0; i < 3; i++) put('EVST' + i, () => mStall([0xc8372d, 0x2f5f9f, 0xf4c447][i]), -R + i * 2.2, R, 0); }
      if (e.type === 'beh') put('EVARCH', mArch, R, 0, Math.PI / 2);
      if (e.type === 'den') { put('EVSTAGE', mStage, 0, -R, 0); ring(3, () => mStall(0x2f5f9f), 'EVST1', R); }
      EV_PROPS.set(id, { hs, e });
    }
    // lidé
    let P = EV_PPL.get(id); if (!P) { P = []; EV_PPL.set(id, P); }
    const want = Math.min(RS.coarse ? 24 : 56, 10 + Math.round(T.pop / 800));
    while (P.length < want) { const a = Math.random() * 6.283, r = R * (0.4 + Math.random() * 0.8); P.push({ a, r, ph: Math.random() * 6, sp: (Math.random() - 0.5) * 0.15, h: person('fest').add({}, mtx(0, -50, 0), lin(CAR_COLS[(Math.random() * CAR_COLS.length) | 0])) }); }
    const dance = e.type === 'festival' || e.type === 'den', run = e.type === 'beh';
    for (const p of P) { p.a += (run ? 0.5 : p.sp) * dt; const x = cx + Math.cos(p.a) * p.r, z = cz + Math.sin(p.a) * p.r; if (p.h.b) p.h.b.set(p.h, mtx(x, dance ? Math.abs(Math.sin(t * 6 + p.ph)) * 0.25 : 0, z, run ? -p.a : p.ph)); }
    // kolotoč se točí
    const pr = EV_PROPS.get(id); for (const h of pr.hs) if (h.b && h.b === batches.get('EVCAR')) { const m = new THREE.Matrix4().compose(new THREE.Vector3(cx + R + 1.5, 0.05, cz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t * 0.8), new THREE.Vector3(1, 1, 1)); h.b.set(h, m); }
    // ohňostroj na Dni města
    if (e.type === 'den' && ATM.n > 0.5 && Math.random() < dt * 1.4) firework(cx, cz);
    // zvuky
    if (near(cx, cz) > 0.35) { sfx('crowd', cx, cz); if (dance) festBeat(cx, cz); }
  }
  for (const [id, pr] of EV_PROPS) if (!live.has(id)) { for (const h of pr.hs) if (h.b) h.b.remove(h); EV_PROPS.delete(id); const P = EV_PPL.get(id); if (P) for (const p of P) if (p.h.b) p.h.b.remove(p.h); EV_PPL.delete(id); }
}
function festBeat(x, z) {
  if (!AU.ctx || !AU.on || !rate('beat', 1.9)) return; const t0 = AU.ctx.currentTime + 0.05, v = near(x, z) * 0.6;
  for (let i = 0; i < 4; i++) { tone(110, t0 + i * 0.48, 0.18, 0.18 * v, 'sine', null, 0.004, 45); if (i % 2) noise(t0 + i * 0.48, 0.08, 0.08 * v, 'highpass', 5000); tone([110, 110, 147, 131][i] * 0.5, t0 + i * 0.48, 0.4, 0.07 * v, 'sawtooth'); }
}

// ---------- lodě na řece ----------
const BOATS = { list: [], segs: null, t: 0 };
function riverSegments() {
  // střed řeky v každém řádku; úseky mezi mosty
  const rows = []; let prev = Math.round(N * 0.64);
  for (let y = 0; y < N; y++) { const xs = []; for (let x = 0; x < N; x++) if (ter[idx(x, y)] === 1) xs.push(x); if (!xs.length) { rows.push(null); continue; }
    let best = null; for (let i = 0; i < xs.length;) { let j = i; while (j + 1 < xs.length && xs[j + 1] === xs[j] + 1) j++; const c = (xs[i] + xs[j]) / 2; if (j - i < 10 && (!best || Math.abs(c - prev) < Math.abs(best.c - prev))) best = { c, a: xs[i], b: xs[j] }; i = j + 1; }
    if (best && Math.abs(best.c - prev) < 6) { prev = best.c; let bridge = false; for (let x = best.a; x <= best.b; x++) if (road[idx(x, y)] || rail[idx(x, y)]) bridge = true; rows.push({ c: best.c, w: best.b - best.a + 1, bridge }); } else rows.push(null); }
  const segs = []; let cur = [];
  for (let y = 0; y < N; y++) { const r = rows[y]; if (!r || r.bridge || r.w < 2) { if (cur.length >= 7) segs.push(cur); cur = []; continue; } cur.push([tileX(r.c), tileZ(y)]); }
  if (cur.length >= 7) segs.push(cur);
  return segs;
}
function mBoat(kind) {
  const b = new GB();
  if (kind === 'barge') { b.use('paint').box(5.2, 0.5, 1.3, 0x2f3438, 0, -0.2, 0).box(1.0, 0.8, 1.1, 0xe8e6e0, -2.0, 0.3, 0); b.use('glass').box(0.9, 0.25, 1.12, 0x2b3642, -2.0, 0.85, 0); b.use('paint'); for (let i = 0; i < 3; i++) b.box(1.1, 0.6, 1.05, [0xa83a30, 0x2f5f9f, 0x3f7f4f][i], -0.6 + i * 1.2, 0.3, 0); }
  else if (kind === 'tour') { b.use('paint').box(4.0, 0.5, 1.4, 0xf2f2ee, 0, -0.2, 0).box(4.02, 0.12, 1.42, 0x2f5f9f, 0, 0.05, 0); b.use('glass').box(2.8, 0.55, 1.2, 0x2b3642, -0.2, 0.3, 0); b.use('plain').box(3.0, 0.08, 1.3, 0xf2f2ee, -0.2, 0.85, 0); }
  else { b.use('paint').box(1.6, 0.35, 0.7, 0xe8e6e0, 0, -0.15, 0).box(0.5, 0.35, 0.6, 0xc8372d, -0.2, 0.2, 0); }
  return b.geo();
}
function updateBoats(dt) {
  if (!G.playing) return;
  if (!BOATS.segs || RS.waterDirty) { BOATS.segs = riverSegments(); RS.waterDirty = false; for (const bt of BOATS.list) if (bt.h.b) bt.h.b.remove(bt.h); BOATS.list = []; }
  const frozen = ATM.snow > 0.75, want = frozen ? 0 : Math.min(RS.coarse ? 3 : 6, BOATS.segs.length * 2);
  while (BOATS.list.length < want) { const si = BOATS.list.length % BOATS.segs.length, seg = BOATS.segs[si]; if (!seg) break;
    const kind = bcount('port') && Math.random() < 0.5 ? 'barge' : (T.landN || 0) > 0 || Math.random() < 0.5 ? 'tour' : 'motor';
    BOATS.list.push({ seg: si, kind, s: Math.random() * (seg.length - 1), dir: Math.random() < 0.5 ? 1 : -1, sp: kind === 'motor' ? 2.2 : kind === 'tour' ? 1.2 : 0.8, lane: (Math.random() - 0.5) * 1.2, h: batch('BOAT' + kind, () => mBoat(kind), MATS, { shadow: true, cap: 16 }).add({}, mtx(0, -50, 0)) }); }
  while (BOATS.list.length > want) { const bt = BOATS.list.pop(); if (bt.h.b) bt.h.b.remove(bt.h); }
  const wy = waterMesh.position.y;
  for (const bt of BOATS.list) {
    const seg = BOATS.segs[bt.seg]; if (!seg) continue;
    bt.s += bt.dir * bt.sp * dt / TS; if (bt.s >= seg.length - 1.2) { bt.s = seg.length - 1.2; bt.dir = -1; } if (bt.s <= 0.2) { bt.s = 0.2; bt.dir = 1; }
    const i = Math.floor(bt.s), f = bt.s - i, a = seg[i], c = seg[Math.min(seg.length - 1, i + 1)], x = a[0] + (c[0] - a[0]) * f, z = a[1] + (c[1] - a[1]) * f;
    const dx = (c[0] - a[0]) * bt.dir, dz = (c[1] - a[1]) * bt.dir, ry = Math.atan2(-dz, dx);
    bt.x = x - dz / TS * bt.lane; bt.z = z + dx / TS * bt.lane;
    if (bt.h.b) bt.h.b.set(bt.h, mtx(bt.x, wy + 0.05 + Math.sin(performance.now() / 700 + bt.seg) * 0.03, bt.z, ry));
  }
}

// ---------- letadla: přelety vysoko a provoz na letišti ----------
function mPlane() {
  const b = new GB(); b.use('paint').hcyl(0.42, 5.2, 0xf2f2ee, 0, 0, 0, Math.PI / 2, 12).sph(0.42, 0xf2f2ee, 2.6, 0, 0, 1.2, 1, 1).box(1.4, 0.06, 6.2, 0xe8e6e0, 0.1, -0.1, 0).box(0.9, 0.05, 2.2, 0xe8e6e0, -2.3, 0.1, 0).box(0.9, 1.1, 0.06, 0x2f5f9f, -2.3, 0.1, 0);
  b.use('metal'); for (const z of [-1.5, 1.5]) b.hcyl(0.22, 0.9, 0x8a9097, 0.4, -0.4, z, Math.PI / 2, 10);
  b.use('glass').box(0.3, 0.15, 0.5, 0x22303c, 2.7, 0.18, 0); b.use('paint').box(5.0, 0.1, 0.86, 0x2f5f9f, 0, -0.05, 0);
  return b.geo();
}
const PLANES = { list: [], next: 8 };
function updatePlanes(dt) {
  if (!G.playing) return;
  PLANES.next -= dt;
  if (PLANES.next <= 0) {
    PLANES.next = 40 + Math.random() * 50;
    const port = [...blds.values()].find(b => b.type === 'airport' && b.ok);
    if (port && Math.random() < 0.7) {   // vzlet nebo přistání na letišti
      const s = port.size, cx = tileX(port.x) + (s - 1) * TS / 2, cz = tileZ(port.y) + (s - 1) * TS / 2, ry = faceRoad(port.x, port.y, s), W2 = s * TS - 0.6;
      const lx = (lxx, lzz) => [cx + lxx * Math.cos(ry) + lzz * Math.sin(ry), cz - lxx * Math.sin(ry) + lzz * Math.cos(ry)];
      const a = lx(-W2 / 2, 4.4), b2 = lx(W2 / 2, 4.4), land = Math.random() < 0.5;
      PLANES.list.push({ kind: land ? 'land' : 'take', a, b: b2, t: 0, dur: 16, h: batch('PLANE', mPlane, MATS, { shadow: true, cap: 8 }).add({}, mtx(0, -50, 0)) });
    } else {   // přelet vysoko nad městem
      const ang = Math.random() * Math.PI * 2, r = HALF + 260, ox = Math.cos(ang) * r, oz = Math.sin(ang) * r, off = (Math.random() - 0.5) * HALF;
      PLANES.list.push({ kind: 'over', a: [ox + Math.sin(ang) * off, oz - Math.cos(ang) * off], b: [-ox + Math.sin(ang) * off, -oz - Math.cos(ang) * off], t: 0, dur: 38, h: batch('PLANE', mPlane, MATS, { shadow: false, cap: 8 }).add({}, mtx(0, -50, 0)) });
    }
  }
  for (const p of PLANES.list.slice()) {
    p.t += dt / p.dur; if (p.t >= 1) { if (p.h.b) p.h.b.remove(p.h); PLANES.list.splice(PLANES.list.indexOf(p), 1); continue; }
    let x, y, z; const dx = p.b[0] - p.a[0], dz = p.b[1] - p.a[1], ry = Math.atan2(-dz, dx);
    if (p.kind === 'over') { x = p.a[0] + dx * p.t; z = p.a[1] + dz * p.t; y = 150; }
    else if (p.kind === 'take') { const u = p.t < 0.35 ? (p.t / 0.35) * (p.t / 0.35) * 0.5 : 0.5 + (p.t - 0.35) * 6; x = p.a[0] + dx * u; z = p.a[1] + dz * u; y = 0.7 + Math.max(0, u - 0.8) * 14; }
    else { const u = p.t < 0.6 ? -4 + p.t / 0.6 * 4.6 : 0.6 + (1 - Math.pow(1 - (p.t - 0.6) / 0.4, 2)) * 0.4; x = p.a[0] + dx * u; z = p.a[1] + dz * u; y = 0.7 + Math.max(0, -u + 0.1) * 12; }
    p.x = x; p.z = z;
    if (p.h.b) p.h.b.set(p.h, mtx(x, y, z, ry));
    if (p.kind !== 'over' && near(x, z) > 0.4 && rate('jet', 6)) sfx('jet', x, z);
  }
}

// ---------- světla aut, tramvají a vlaků v noci ----------
let headB = null;
function headGeo() {
  const parts = [], add = (x, y, z, r, c) => { const g = new THREE.SphereGeometry(r, 6, 4); g.translate(x, y, z); const n = g.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(g.index ? g.toNonIndexed() : g); };
  for (const z of [-0.27, 0.27]) { add(0.9, 0.33, z, 0.09, [3, 2.7, 2.1]); add(-0.9, 0.38, z, 0.07, [2.2, 0.1, 0.05]); }
  let total = 0; for (const g of parts) total += g.attributes.position.count; const pos = new Float32Array(total * 3), col = new Float32Array(total * 3); let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); return geo;
}
function updateHeadlights() {
  if (!headB) headB = new Batch(headGeo(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), { cap: 512, shadow: false, layer: 1 });
  headB.clear(); if (!G.playing || ATM.n < 0.35) return;
  for (const c of cars) headB.add({}, carPos(c));
  for (const tr of trams) headB.add({}, carPos(tr), _col2.setRGB(1, 1, 1));
  for (const tr of trains) if (tr.pos && tr.pos[0]) { const p = tr.pos[0], hx = p[2], hz = p[3]; headB.add({}, mtx(p[0] + hx * 0.9, RAIL_Y + 0.1, p[1] + hz * 0.9, Math.atan2(-hz, hx), 1.4)); }
}

// ---------- sledovací kamera a fotorežim ----------
const FOLLOW = { kind: null, ref: null, photo: false };
const FOLLOW_KINDS = { train: 'Vlak', tram: 'Tramvaj', bus: 'Autobus', fire: 'Hasiči', car: 'Auto', boat: 'Loď', plane: 'Letadlo' };
function handlePos(h) { if (!h || !h.b) return null; const a = h.b.mesh.instanceMatrix.array, i = h.i * 16; return [a[i + 12], a[i + 13], a[i + 14]]; }
function followCandidates(kind) {
  if (kind === 'train') return trains.map(t => ({ ref: t, pos: () => t.pos && t.pos[Math.floor(t.cars.length / 2)] ? [t.pos[Math.floor(t.cars.length / 2)][0], 0, t.pos[Math.floor(t.cars.length / 2)][1]] : null }));
  if (kind === 'tram') return trams.map(c => ({ ref: c, pos: () => handlePos(c.h) }));
  if (kind === 'bus') return cars.filter(c => c.bus).map(c => ({ ref: c, pos: () => handlePos(c.h) }));
  if (kind === 'car') return cars.filter(c => !c.bus).map(c => ({ ref: c, pos: () => handlePos(c.h) }));
  if (kind === 'fire') return vehicles.filter(v => v.kind === 'fire' || v.kind === 'heli').map(v => ({ ref: v, pos: () => handlePos(v.h) }));
  if (kind === 'boat') return BOATS.list.map(b => ({ ref: b, pos: () => handlePos(b.h) }));
  if (kind === 'plane') return PLANES.list.map(p => ({ ref: p, pos: () => handlePos(p.h) }));
  return [];
}
function startFollow(kind) {
  const c = followCandidates(kind); if (!c.length) { toast(FOLLOW_KINDS[kind] + ' teď nikde nejede.', 'bad'); return false; }
  const pick = c[(Math.random() * c.length) | 0]; FOLLOW.kind = kind; FOLLOW.ref = pick.ref; FOLLOW.pos = pick.pos; if (cam.dist > 70) cam.dist = 45; drawFollowChip(); return true;
}
function stopFollow() { FOLLOW.kind = null; FOLLOW.ref = null; FOLLOW.pos = null; drawFollowChip(); }
function updateFollow(dt) {
  if (FOLLOW.photo) cam.yaw += dt * 0.04;
  if (!FOLLOW.kind) return;
  const p = FOLLOW.pos && FOLLOW.pos();
  if (!p || p[1] < -40 || Math.abs(p[0]) > HALF + 40 || Math.abs(p[2]) > HALF + 40) { if (!startFollow(FOLLOW.kind)) stopFollow(); return; }
  const k = Math.min(1, dt * 4); cam.x += (p[0] - cam.x) * k; cam.z += (p[2] - cam.z) * k;
}
function drawFollowChip() {
  const el = $('follow'); if (!el) return;
  if (!FOLLOW.kind) { el.hidden = true; return; }
  el.hidden = false; el.innerHTML = '<span>Sleduješ: <b>' + FOLLOW_KINDS[FOLLOW.kind].toLowerCase() + '</b></span><button class="btn" id="fl-next">Jiný</button><button class="btn pri" id="fl-stop">Konec</button>';
  $('fl-next').onclick = () => startFollow(FOLLOW.kind); $('fl-stop').onclick = stopFollow;
}
function setPhoto(on) { FOLLOW.photo = on; document.body.classList.toggle('photo', on); }
function drawCamMenu() {
  const el = $('cammenu'); el.innerHTML = '<b>Kamera</b>' + Object.keys(FOLLOW_KINDS).map(k => '<button class="btn" data-fk="' + k + '">' + FOLLOW_KINDS[k] + '</button>').join('') + '<button class="btn pri" data-photo="1">Fotorežim</button><small>Fotorežim schová ovládání a pomalu krouží kolem města. Zpět klávesou Esc nebo tlačítkem.</small>';
}
$('b-cam').onclick = e => { e.stopPropagation(); const m = $('cammenu'); m.hidden = !m.hidden; if (!m.hidden) drawCamMenu(); };
$('cammenu').onclick = e => { const f = e.target.closest('[data-fk]'), p = e.target.closest('[data-photo]'); if (f) { $('cammenu').hidden = true; startFollow(f.dataset.fk); } if (p) { $('cammenu').hidden = true; setPhoto(true); } };
$('photo-x').onclick = () => setPhoto(false);
addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; if (e.code === 'Escape') { if (FOLLOW.photo) setPhoto(false); else if (FOLLOW.kind) stopFollow(); } if (e.code === 'KeyP' && G.playing) setPhoto(!FOLLOW.photo); });
document.addEventListener('pointerdown', e => { const m = $('cammenu'); if (!m.hidden && !e.target.closest('#cammenu') && !e.target.closest('#b-cam')) m.hidden = true; });

// ---------- značky přání na mapě ----------
const REQ_MK = new Map();
function updateReqMarkers() {
  const live = new Set();
  if (G.playing) for (const r of S.reqs || []) { if (r.city) continue; const id = r.type + r.k; live.add(id);
    let el = REQ_MK.get(id); if (!el) { el = document.createElement('button'); el.className = 'mk req'; el.onclick = () => openPanel('society'); $('markers').appendChild(el); REQ_MK.set(id, el); }
    const p = project(tileX(r.x), 4, tileZ(r.y)); el.style.display = p.ok && cam.dist < 260 ? '' : 'none'; el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; el.textContent = REQ[r.type].t; }
  for (const [id, el] of REQ_MK) if (!live.has(id)) { el.remove(); REQ_MK.delete(id); }
}

// ---------- hlavní smyčka doplňků ----------
let _exT = 0;
function updateExtras(dt, t) {
  if (!ATM.ready) return;
  updateFollow(dt);
  if (!G.playing) return;
  updateEventVisuals(dt, t); updateBoats(dt); updatePlanes(dt); updateHeadlights();
  _exT -= dt; if (_exT <= 0) { _exT = 0.1; updateReqMarkers(); }
}

// ---------- panel Společnost: přání a akce ----------
function societyExtras() {
  let h = '<h4>Přání občanů</h4>';
  const rs = S.reqs || [];
  if (!rs.length) h += '<p class="hint">Teď nikdo nic nežádá. Přání se objevují podle toho, co lidem v jejich čtvrti chybí.</p>';
  for (const r of rs) { const D = r.city ? CITY_REQ[r.type] : REQ[r.type]; if (!D) continue;
    h += '<div class="item"><h5>' + esc(D.t) + '<small>' + (r.city ? 'celé město' : esc(r.name)) + '</small></h5><p>„' + esc(D.ask) + '“ Zbývá ' + Math.max(0, Math.ceil((r.until - S.day) / 30)) + ' měs.</p>' + (r.city ? '' : '<div class="btns"><button class="btn" data-rq="' + r.x + ',' + r.y + '">Ukázat</button></div>') + '</div>'; }
  h += '<h4>Městské akce</h4>';
  for (const id in EVENTS) { const E = EVENTS[id], err = eventProblem(id), run = (S.events || []).find(e => e.type === id), vs = err ? [] : eventVenues(id);
    h += '<div class="item' + (run ? ' crit' : '') + '"><h5>' + E.name + '<small class="num">' + money(E.cost) + '</small></h5><p>' + E.desc + ' Spokojenost +' + E.happy + (E.tour ? ', turisté' : '') + (E.health ? ', zdraví' : '') + '.</p>'
      + (run ? '<p><b>Probíhá</b>, ještě ' + Math.max(0, run.end - S.day) + ' dní.</p>' : err ? '<p class="hint">' + err + '</p>' : '<div class="btns"><select class="sel" data-ev-v="' + id + '">' + vs.map(b => '<option value="' + b.id + '">' + esc(SERV[b.type].name) + ' · ' + esc(districtName(b.x, b.y)) + '</option>').join('') + '</select><button class="btn pri" data-ev="' + id + '">Uspořádat</button></div>') + '</div>'; }
  return h;
}
(function patchSociety() {
  const P = PANELS.society, base = P.html; P.static = true;
  P.html = () => base() + societyExtras();
  P.bind = () => { $('pbody').onclick = e => {
    const q = e.target.closest('[data-rq]'); if (q) { const [x, y] = q.dataset.rq.split(',').map(Number); focusTile(x, y); if (window.innerWidth < 860) closePanel(); }
    const ev = e.target.closest('[data-ev]'); if (ev) { const sel = document.querySelector('[data-ev-v="' + ev.dataset.ev + '"]'), err = startEvent(ev.dataset.ev, sel ? +sel.value : 0); if (err) toast(err, 'bad'); renderPanel(); updateTop(); }
  }; };
})();

function resetExtras() { BOATS.list = []; BOATS.segs = null; PLANES.list = []; EV_PROPS.clear(); for (const P of EV_PPL.values()) for (const p of P) if (p.h.b) p.h.b.remove(p.h); EV_PPL.clear(); stopFollow(); }

// odznaky za přání a akce
ACHS.push({ id: 'reqs10', name: 'Hlas lidu', desc: 'Splň 10 přání občanů.', ok: () => S.stat && S.stat.reqs >= 10 }, { id: 'events5', name: 'Město zábavy', desc: 'Uspořádej 5 městských akcí.', ok: () => S.stat && S.stat.events >= 5 });
if (typeof drawMissionsStart === 'function' && !G.playing) drawMissionsStart();
