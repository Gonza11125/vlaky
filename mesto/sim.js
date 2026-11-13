'use strict';
// Simulace města: růst, rozpočet, obchod, společnost, krize, katastrofy, sousedé.

const S = {};                 // stav hry (ukládá se)
const T = {};                 // průběžné souhrny (počítají se)
const FX = [];                // vizuální události pro vykreslování
const dirty = new Set();      // dlaždice ke překreslení
const wdist = new Uint8Array(NN);
let covDirty = true, connDirty = true, cursor = 0;
const UIH = { note: null, ask: null, over: null };

const yearOf = d => 2026 + Math.floor(d / 360);
const monthOf = d => Math.floor(d / MONTH) % 12;
const dateStr = d => (d % MONTH + 1) + '. ' + MONTHS[monthOf(d)] + ' ' + yearOf(d);
const money = v => { const a = Math.abs(v), s = v < 0 ? '−' : ''; return a >= 1e6 ? s + (a / 1e6).toFixed(a >= 1e8 ? 0 : 1).replace('.', ',') + ' mil. Kč' : a >= 1e4 ? s + Math.round(a / 1000) + ' tis. Kč' : s + Math.round(a) + ' Kč'; };
const fmt = v => Math.round(v).toLocaleString('cs-CZ');
const chance = p => Math.random() < p;
const pickOne = a => a[Math.floor(Math.random() * a.length)];
const capOf = k => ZONES[zone[k]].cap[dens[k]][lvl[k]];
const isBuilt = k => zone[k] && lvl[k] && !aband[k] && !ruin[k];

function note(text, cls, k) { const m = { day: S.day, text, cls: cls || '', k: k == null ? -1 : k }; S.log.push(m); if (S.log.length > 80) S.log.shift(); if (UIH.note) UIH.note(m); }
function ask(a) { S.asks.push(a); if (UIH.ask) UIH.ask(); }
function markDirty(k) { dirty.add(k); }

// ---------- nová hra ----------
function newGame(o) {
  const seed = (Math.random() * 1e9) | 0;
  genTerrain(seed);
  const techs = TECH_LEVELS[o.tech].techs;
  genCity(o.size, techs);
  computeWaterDist();
  for (const k in S) delete S[k];
  Object.assign(S, {
    v: 1, name: o.name || 'Nové Město', day: 90, startDay: 90, money: STARTS[o.size].money, loan: 0,
    opts: { size: o.size, tech: o.tech, crisis: o.crisis, wars: o.wars, elections: o.elections },
    tax: { R: 9, C: 9, I: 9, O: 9 }, lastTax: 36,
    bud: { police: 100, fire: 100, health: 100, edu: 100, transit: 100, rail: 100, army: 100, parks: 100 },
    rail: Object.assign(RAIL_DEF(), W.railInit || {}),
    techs: {}, research: null, rq: [], rp: 0, resFund: 0, pol: {},
    stock: { food: 600, goods: 400, tech: 50, fuel: 500 }, price: {}, auto: { food: 'sell', goods: 'sell', tech: 'sell', fuel: 'keep' },
    reserve: { food: 300, goods: 200, tech: 50, fuel: 600 }, tradeUsed: 0, short: {},
    happy: 62, approval: 62, crime: 8, radical: 8, armyLoy: 62, freedom: 85, health: 80,
    mood: 0, repress: 0, armyGrudge: 0, glory: 0, martial: 0, soldiers: 0,
    nb: NEIGHBORS.map(n => ({ name: n.name, rel: n.rel, war: null, contract: null, gift: -999, visit: -999, strength: Math.round(n.pop / 300), wear: 0 })),
    inc: [], incN: 1, asks: [], log: [], hist: [], last: null,
    heat: 0, recession: 0, floodEv: null, epi: null, spills: [], bankrupt: 0, over: null, tips: {},
  });
  techs.forEach(t => { S.techs[t] = true; }); fxReset();
  for (const g of GOOD_KEYS) S.price[g] = GOODS[g].price;
  for (const b of blds.values()) b.built = 1;
  connDirty = true; covDirty = true; railDirty = true;
  analysis();
  for (let k = 0; k < NN; k++) if (isBuilt(k) && zone[k] !== 1) occ[k] = capOf(k) * T.jobFill;
  analysis();
  S.happy = S.approval = clamp(T.happyT, 45, 70);
  S.soldiers = T.army;
  note('Vítej ve funkci starosty města ' + S.name + '.', 'good');
  if (!o.size) note('Začni silnicí od dálnice, vyznač zóny a postav elektrárnu a vodárnu. Bez nich se nikdo nenastěhuje.');
}
function computeWaterDist() {
  wdist.fill(9); const q = [];
  for (let k = 0; k < NN; k++) if (ter[k] === 1) { wdist[k] = 0; q.push(k); }
  for (let h = 0; h < q.length; h++) { const k = q[h], x = k % N, y = (k / N) | 0; if (wdist[k] >= 8) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const n = idx(nx, ny); if (wdist[n] > wdist[k] + 1) { wdist[n] = wdist[k] + 1; q.push(n); } } }
}

// ---------- stavění (volá rozhraní) ----------
function canAfford(c) { return S.money >= c; }
function spend(c) { S.money -= c; }
function roadCost(k, rt) { const R = ROADS[rt]; return ter[k] === 1 ? BRIDGE_COST * Math.max(1, R.cost / 3000) : R.cost + (lvl[k] ? DEMOLISH_COST : 0); }
let lastRoadErr = '';
function buildRoad(x, y, rt, dir) {
  rt = rt || 1; const k = idx(x, y); if (road[k] === rt || bld[k]) return 0;
  if (ROADS[rt].req && !S.techs[ROADS[rt].req]) return -2;
  const re = roadOverRail(x, y, rt, dir); if (re) { lastRoadErr = re; return -3; }
  const c = roadCost(k, rt) * (road[k] ? 0.7 : 1);
  if (!canAfford(c)) return -1;
  spend(c); clearTile(k); road[k] = rt; markDirty(k); connDirty = true; if (rail[k]) railDirty = true;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inb(x + dx, y + dy)) markDirty(idx(x + dx, y + dy));
  return c;
}
function setZone(x, y, z, d) {
  const k = idx(x, y); if (ter[k] === 1 || road[k] || rail[k] || bld[k]) return 0;
  if (zone[k] === z && dens[k] === d) return 0;
  if (lvl[k] && zone[k] !== z) { if (!canAfford(DEMOLISH_COST)) return -1; spend(DEMOLISH_COST); }
  if (zone[k] !== z) { lvl[k] = 0; occ[k] = 0; aband[k] = 0; }
  if (dens[k] !== d && lvl[k] > (d ? 5 : 3)) lvl[k] = 3;
  if (ter[k] >= 3) ter[k] = 0;
  zone[k] = z; dens[k] = d; markDirty(k); return 1;
}
function servProblem(type, x, y) {
  const d = SERV[type];
  if (d.req && !S.techs[d.req]) return 'Nejdřív musíš vyzkoumat: ' + TECHS[d.req].name + '.';
  if (d.unique) for (const b of blds.values()) if (b.type === type) return 'Tahle stavba může stát jen jednou.';
  if (d.needs && ![...blds.values()].some(b => b.type === d.needs)) return 'Potřebuje ve městě stavbu: ' + SERV[d.needs].name + '.';
  for (let j = y; j < y + d.size; j++) for (let i = x; i < x + d.size; i++) { if (!inb(i, j)) return 'Mimo mapu.'; const k = idx(i, j); if (ter[k] === 1 || road[k] || rail[k] || bld[k]) return 'Místo není volné.'; }
  if (d.coast && !nearWater(x, y, d.size, 1)) return d.name + ' musí stát hned u vody.';
  if (d.rail && !railAround(x, y, d.size).length) return d.name + ' musí stát hned u železniční trati.';
  if (type === 'dike' && !fpl[idx(x, y)] && !nearWater(x, y, 1, 1)) return 'Hráz má smysl jen u řeky.';
  let demo = 0; for (let j = y; j < y + d.size; j++) for (let i = x; i < x + d.size; i++) if (lvl[idx(i, j)]) demo += DEMOLISH_COST;
  if (!canAfford(d.cost + demo)) return 'Nemáš dost peněz (' + money(d.cost + demo) + ').';
  return null;
}
function placeServ(type, x, y) {
  const d = SERV[type];
  if (d.req && !S.techs[d.req]) return 'Nejdřív musíš vyzkoumat: ' + TECHS[d.req].name + '.';
  if (d.unique) for (const b of blds.values()) if (b.type === type) return 'Tahle stavba může stát jen jednou.';
  if (d.needs && ![...blds.values()].some(b => b.type === d.needs)) return 'Potřebuje ve městě stavbu: ' + SERV[d.needs].name + '.';
  for (let j = y; j < y + d.size; j++) for (let i = x; i < x + d.size; i++) { if (!inb(i, j)) return 'Mimo mapu.'; const k = idx(i, j); if (ter[k] === 1 || road[k] || rail[k] || bld[k]) return 'Místo není volné.'; }
  if (d.coast && !nearWater(x, y, d.size, 1)) return d.name + ' musí stát hned u vody.';
  if (d.rail && !railAround(x, y, d.size).length) return d.name + ' musí stát hned u železniční trati.';
  if (type === 'dike' && !fpl[idx(x, y)] && !nearWater(x, y, 1, 1)) return 'Hráz má smysl jen u řeky.';
  let demo = 0; for (let j = y; j < y + d.size; j++) for (let i = x; i < x + d.size; i++) if (lvl[idx(i, j)]) demo += DEMOLISH_COST;
  if (!canAfford(d.cost + demo)) return 'Nemáš dost peněz (' + money(d.cost + demo) + ').';
  spend(d.cost + demo);
  const b = addBuilding(type, x, y); b.built = 0;
  for (let j = y; j < y + d.size; j++) for (let i = x; i < x + d.size; i++) markDirty(idx(i, j));
  covDirty = true; FX.push({ t: 'build', b: b.id });
  return b;
}
function demolish(x, y) {
  const k = idx(x, y);
  if (bld[k]) { const b = blds.get(bld[k]); if (b.type === 'townhall') return 'Radnici zbořit nejde.'; if (!canAfford(DEMOLISH_COST * b.size)) return 'Nemáš dost peněz.'; spend(DEMOLISH_COST * b.size); for (let j = b.y; j < b.y + b.size; j++) for (let i = b.x; i < b.x + b.size; i++) markDirty(idx(i, j)); removeBuilding(b); covDirty = true; return null; }
  if (road[k]) { if (!canAfford(DEMOLISH_COST)) return 'Nemáš dost peněz.'; spend(DEMOLISH_COST); road[k] = 0; connDirty = true; markDirty(k); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inb(x + dx, y + dy)) markDirty(idx(x + dx, y + dy)); return null; }
  if (rail[k]) return removeRail(x, y);
  if (zone[k] || ruin[k]) { if (lvl[k] || ruin[k]) { if (!canAfford(DEMOLISH_COST)) return 'Nemáš dost peněz.'; spend(DEMOLISH_COST); } clearTile(k); markDirty(k); return null; }
  if (ter[k] === 3) { ter[k] = 0; markDirty(k); return null; }
  return 'Tady není co bourat.';
}

// ---------- rozbor města (každých 5 dní) ----------
const tmpA = new Float32Array(NN), tmpB = new Float32Array(NN), roadLv = new Float32Array(NN);
function blur(src, dst, r, passes) {
  let a = src, b = tmpB;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < N; y++) { let s = 0, c = 0; for (let x = -r; x <= r; x++) if (x >= 0 && x < N) { s += a[y * N + x]; c++; }
      for (let x = 0; x < N; x++) { b[y * N + x] = s / c; const o = x - r, n = x + r + 1; if (o >= 0) { s -= a[y * N + o]; c--; } if (n < N) { s += a[y * N + n]; c++; } } }
    for (let x = 0; x < N; x++) { let s = 0, c = 0; for (let y = -r; y <= r; y++) if (y >= 0 && y < N) { s += b[y * N + x]; c++; }
      for (let y = 0; y < N; y++) { dst[y * N + x] = s / c; const o = y - r, n = y + r + 1; if (o >= 0) { s -= b[o * N + x]; c--; } if (n < N) { s += b[n * N + x]; c++; } } }
    a = dst;
  }
}
const BUD_OF = { police: 'police', policehq: 'police', intel: 'police', fire: 'fire', firevol: 'fire', firehq: 'fire', fireair: 'fire', techpark: 'edu', clinic: 'health', hospital: 'health', school: 'edu', highschool: 'edu', university: 'edu', institute: 'edu', bus: 'transit', metro: 'transit', railhalt: 'rail', railst: 'rail', mainst: 'rail', station: 'rail', container: 'rail', depot: 'rail', barracks: 'army', castle: 'parks', cathedral: 'parks', museum: 'edu', zoo: 'parks', aquapark: 'parks', lookout: 'parks', tvtower: 'parks', park: 'parks', bigpark: 'parks', plaza: 'parks', stadium: 'parks' };
const budF = cat => cat ? 0.35 + 0.65 * S.bud[cat] / 100 : 1;
function computeCoverage() {
  for (const c of Object.values(cov)) c.fill(0);
  for (const b of blds.values()) {
    const d = SERV[b.type]; b.ok = b.built >= 1 && hasRoadAccess(b) && !(b.off > 0) && railBuildingOk(b);
    if (!b.ok || !d.r) continue;
    const key = d.police ? 'police' : d.fireStr ? 'fire' : d.cat === 'health' ? 'health' : d.edu ? 'edu' : d.park ? 'park' : d.transit ? 'transit' : null;
    if (!key) continue;
    const r = d.r * (b.type === 'bus' && S.techs.bus ? 1.3 : 1) * (key === 'fire' ? 1 + tfx('fireRange') : key === 'health' ? 1 + tfx('healthRange') : 1), str = (d.fireStr || d.edu || d.park * (1 + tfx('parkEff')) || d.transit * (1 + tfx('transitEff')) || 1) * budF(BUD_OF[b.type]);
    const cx = b.x + b.size / 2 - 0.5, cy = b.y + b.size / 2 - 0.5, R = Math.ceil(r + b.size);
    for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(N - 1, Math.ceil(cy + R)); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(N - 1, Math.ceil(cx + R)); x++) {
      const dd = Math.max(0, Math.hypot(x - cx, y - cy) - b.size / 2); if (dd > r) continue;
      const v = str * Math.pow(1 - dd / r, 0.55), k = idx(x, y), m = cov[key];
      m[k] = key === 'park' ? Math.min(1.5, m[k] + v) : Math.max(m[k], v);
    }
  }
  railCoverage();
  // tramvajové tratě vozí lidi z okolí
  const tb = budF('transit') * (1 + tfx('transitEff'));
  for (let k = 0; k < NN; k++) if (road[k] === 4 && conn[k]) { const x = k % N, y = (k / N) | 0; for (let j = y - 3; j <= y + 3; j++) for (let i = x - 3; i <= x + 3; i++) if (inb(i, j)) { const t = idx(i, j), v = 0.7 * tb * (1 - Math.hypot(i - x, j - y) / 4.5); if (v > cov.transit[t]) cov.transit[t] = v; } }
}
function analysis() {
  if (connDirty) { computeConn(); connDirty = false; covDirty = true; }
  if (railDirty) { computeRailNet(); railDirty = false; covDirty = true; }
  if (covDirty) { computeCoverage(); covDirty = false; }
  let pop = 0, eduS = 0, cap = { 2: 0, 3: 0, 4: 0 }, fil = { 2: 0, 3: 0, 4: 0 }, prodI = [0, 0, 0], bt = 0, ab = 0;
  for (let k = 0; k < NN; k++) {
    if (!zone[k] || !lvl[k] || ruin[k]) continue;
    bt++; if (aband[k]) { ab++; continue; }
    if (zone[k] === 1) { pop += occ[k]; eduS += eduT[k] * occ[k]; }
    else { cap[zone[k]] += capOf(k); fil[zone[k]] += occ[k]; if (zone[k] === 3) prodI[spec[k]] += occ[k]; }
  }
  const jobsCap = cap[2] + cap[3] + cap[4], jobs = fil[2] + fil[3] + fil[4], work = pop * 0.55;
  Object.assign(T, { pop, work, jobsCap, jobs, cap, fil, prodI, eduRate: pop ? eduS / pop : 0, bTiles: bt, abandoned: ab });
  railAnalysis();
  const ext = T.extJobs || 0;
  T.jobFill = jobsCap ? Math.min(1, work / jobsCap) : 1;
  T.unemp = work > 1 ? Math.max(0, work - (jobsCap + ext) * 0.97) / work : 0;
  // služby, energie, voda, odpad
  let pCap = 0, wCap = 0, gCap = 0, sCap = 0, trade = BASE_TRADE, store = BASE_STORE, officers = 0, army = 0, rp = 0, fuelUse = 0, intel = 0, tour = 0, stadium = 0;
  const winter = monthOf(S.day) === 11 || monthOf(S.day) <= 1, wind = 0.6 + 0.5 * Math.abs(Math.sin(S.day * 0.13));
  const fuelOk = S.short && S.short.fuel ? 0.5 : 1; T.rpGov = 0;
  for (const b of blds.values()) {
    const d = SERV[b.type]; if (!b.ok) continue;
    const off = b.flooded || b.fire > 0;
    if (d.power && !off) { let p = d.power * (1 + tfx('powerOut')); if (b.type === 'wind') p *= wind; if (b.type === 'solar') p *= winter ? 0.55 : 1.05; if (b.type === 'wind' || b.type === 'solar' || b.type === 'hydro') p *= 1 + tfx('renewOut'); if (d.fuel) p *= fuelOk; pCap += p; b.out = p; }
    if (d.water && b.type === 'pump' && !off) wCap += d.water * (nearWater(b.x, b.y, 1, 2) ? 1.5 : 1);
    if (d.garbage) gCap += d.garbage; if (d.sewage) sCap += d.sewage; if (d.trade) trade += d.trade; if (d.store) store += d.store;
    if (d.police) officers += d.police * budF('police'); if (d.army) army += d.army; if (d.rp) rp += d.rp * budF('edu');
    if (b.type === 'townhall' && !b.off) T.rpGov = 3; if (b.type === 'intel') intel += budF('police'); if (d.tourism) tour += 3; if (b.type === 'stadium') stadium++;
  }
  trade += T.railTrade || 0; tour += T.railTour || 0;
  // památky: cestovní ruch podle sezóny
  { const mc = monthOf(S.day); let lt = 0, ln = 0; for (const b of blds.values()) { const d = SERV[b.type]; if (!d.land || !b.ok) continue; ln++;
      const summer = mc >= 5 && mc <= 7, winterM = mc === 11 || mc <= 1; lt += d.land * (b.type === 'aquapark' || b.type === 'zoo' ? (summer ? 1.5 : winterM ? 0.5 : 1) : 1); }
    T.landTour = lt; T.landN = ln; }
  if (S.techs.logistics) trade *= 1.3; trade *= 1 + tfx('trade'); intel *= 1 + tfx('intel');
  const k_s = S.techs.smartgrid ? 0.85 : 1;
  const pDem = (pop * PW_RES + jobs * PW_JOB) * k_s * (S.heat > 0 ? 1.2 : 1) * (1 + tfx('powerDemand')), wDem = (pop * WT_RES + jobs * WT_JOB) * k_s * (S.heat > 0 ? 1.35 : 1) * (1 + tfx('waterDemand'));
  // palivo: elektrárny jedou jen na potřebný výkon
  const load = pCap > 0 ? Math.min(1, pDem / pCap) : 0;
  for (const b of blds.values()) if (b.ok && SERV[b.type].fuel && b.out) fuelUse += b.out * load * SERV[b.type].fuel;
  Object.assign(T, { pCap, pDem, wCap, wDem, gCap, gDem: (pop + jobs * 0.5) * (1 + tfx('garbage')), sCap, sDem: pop, trade, store, officers, army, rp, fuelUse, intel, tour, stadium });
  T.pRatio = pDem > 0 ? Math.min(1, pCap / pDem) : (pCap > 0 ? 1 : 0);
  T.wRatio = wDem > 0 ? Math.min(1, wCap / wDem) : (wCap > 0 ? 1 : 0);
  for (let k = 0; k < NN; k++) {
    if (!acc[k]) { pw[k] = 0; wt[k] = 0; continue; }
    const h = hash2(k % N, (k / N) | 0, 77);
    pw[k] = T.pRatio >= 0.999 || h < T.pRatio ? 1 : 0; wt[k] = T.wRatio >= 0.999 || hash2(k % N, (k / N) | 0, 78) < T.wRatio ? 1 : 0;
    if (T.pCap === 0) pw[k] = 0; if (T.wCap === 0) wt[k] = 0;
  }
  // znečištění
  tmpA.fill(0);
  const pa = tfx('polAll'), pk = (S.techs.filters ? 0.65 : 1) * (S.pol.ecolaw ? 0.7 : 1) * (1 + tfx('polInd') + pa), pp = (S.techs.filters ? 0.65 : 1) * (S.pol.ecolaw ? 0.7 : 1) * (1 + tfx('polPower') + pa), pt = 1 + tfx('polTraffic') + pa;
  for (let k = 0; k < NN; k++) {
    if (isBuilt(k) && zone[k] === 3) tmpA[k] += (dens[k] ? 7 : 4) * lvl[k] * (spec[k] === 2 ? 0.25 : 1) * pk;
    if (road[k]) tmpA[k] += (traf[k] * 3 + (ROADS[road[k]].poll || 0)) * pt;
    if (rail[k] && T.railDiesel && !RAILS[rail[k]].elec) tmpA[k] += Math.min(6, T.railDiesel * 0.5) * pt;
  }
  for (const b of blds.values()) { const d = SERV[b.type]; if (!d.poll || !b.ok) continue; const p = d.poll * (d.power ? pp : 1) / (b.size * b.size); for (let j = b.y; j < b.y + b.size; j++) for (let i = b.x; i < b.x + b.size; i++) tmpA[idx(i, j)] += p * 4; }
  if (T.gCap < T.gDem) { const over = (T.gDem - T.gCap) / Math.max(1, T.gDem); for (let k = 0; k < NN; k++) if (isBuilt(k)) tmpA[k] += over * 6; }
  for (const s of S.spills) for (let j = s.y - 4; j <= s.y + 4; j++) for (let i = s.x - 4; i <= s.x + 4; i++) if (inb(i, j)) tmpA[idx(i, j)] += 30;
  blur(tmpA, poll, 2, 2);
  for (let k = 0; k < NN; k++) { if (ter[k] === 3) poll[k] *= 0.8; poll[k] = Math.min(100, poll[k] * 2.2); }
  // doprava
  tmpA.fill(0);
  for (let k = 0; k < NN; k++) if (isBuilt(k)) tmpA[k] = occ[k];
  blur(tmpA, tmpB.length ? lv : lv, 3, 1);         // dočasně do lv, přepíše se níž
  const tr = (S.pol.freebus ? 0.82 : 1);
  let trafSum = 0, roads = 0, roadUp = 0; const capK = 1 + tfx('trafficCap');
  for (let k = 0; k < NN; k++) {
    if (!road[k]) { traf[k] = 0; continue; }
    const R = ROADS[road[k]] || ROADS[1]; roads++; roadUp += R.up * (ter[k] === 1 ? 3 : 1);
    traf[k] = clamp(lv[k] / 26 * (1 - cov.transit[k] * 0.45) * tr / (R.cap * capK), 0, 2); trafSum += traf[k];
  }
  T.roads = roads; T.roadUp = roadUp; T.traffic = roads ? trafSum / roads : 0;
  // vliv druhů silnic na cenu pozemků okolo
  roadLv.fill(0);
  for (let k = 0; k < NN; k++) { if (!road[k]) continue; const R = ROADS[road[k]]; if (!R || !R.lv) continue; const x = k % N, y = (k / N) | 0, rr = R.lv > 8 ? 2 : 1;
    for (let j = y - rr; j <= y + rr; j++) for (let i = x - rr; i <= x + rr; i++) if (inb(i, j)) { const t = idx(i, j); roadLv[t] = R.lv < 0 ? Math.min(roadLv[t], R.lv) : Math.max(roadLv[t], R.lv); } }
  railLand(roadLv);
  // centrum = radnice
  let hx = W.cx, hy = W.cy; for (const b of blds.values()) if (b.type === 'townhall') { hx = b.x + 1; hy = b.y + 1; }
  // cena pozemků, kriminalita, spokojenost
  const polF = (S.techs.forensics ? 1.25 : 1) * (1 + tfx('police')) * Math.min(1.2, T.officers / Math.max(1, pop / 450)) * (S.martial > 0 ? 1.6 : 1);
  const crimeMul = (1 + tfx('crime')) * (S.pol.patrols ? 0.8 : 1) * (S.pol.cameras ? 0.85 : 1) * (S.pol.youth ? 0.9 : 1) * (S.pol.gunlaw ? 0.92 : 1);
  let crS = 0, crW = 0, hpS = 0, hpW = 0, polS = 0;
  for (let k = 0; k < NN; k++) {
    const x = k % N, y = (k / N) | 0;
    let nearTraf = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inb(x + dx, y + dy)) nearTraf = Math.max(nearTraf, traf[idx(x + dx, y + dy)]);
    const center = Math.max(0, 22 - Math.hypot(x - hx, y - hy) * 0.6);
    let v = 22 + tfx('landValue') + roadLv[k] + Math.min(1.2, cov.park[k]) * 30 + (wdist[k] <= 3 ? 12 - wdist[k] * 3 : 0) + center + cov.transit[k] * 10 + (cov.health[k] + cov.edu[k] + cov.police[k]) * 4
      - poll[k] * 0.55 - crime[k] * 0.25 - Math.max(0, nearTraf - 0.7) * 10 - (flood[k] ? 15 : 0);
    lv[k] = clamp(v, 0, 100);
    if (!isBuilt(k) || zone[k] === 3) { crime[k] *= 0.9; continue; }
    const cr = (8 + T.unemp * 90 + (1 - (zone[k] === 1 ? eduT[k] : T.eduRate)) * 12 + (100 - lv[k]) * 0.18 + S.radical * 0.12) * (dens[k] ? 1.2 : 1) * (1 - Math.min(1, cov.police[k] * polF) * 0.75) * crimeMul * Math.min(1, 0.35 + pop / 6000);
    crime[k] = clamp(cr, 0, 100); crS += crime[k] * occ[k]; crW += occ[k];
    if (zone[k] === 1) {
      const h = 52 + cov.health[k] * 10 + cov.edu[k] * 7 + Math.min(1, cov.police[k]) * 6 + Math.min(1, cov.park[k]) * 9 + lv[k] * 0.12 - poll[k] * 0.35 - crime[k] * 0.3 - Math.max(0, nearTraf - 0.8) * 8 - (pw[k] ? 0 : 15) - (wt[k] ? 0 : 15);
      hap[k] = clamp(h, 0, 100); hpS += hap[k] * occ[k]; hpW += occ[k];
      eduT[k] = lerp(eduT[k], Math.min(1, cov.edu[k]), 0.04 * (1 + tfx('eduGain')));
      polS += poll[k] * occ[k];
    }
  }
  T.crimeT = (crW ? crS / crW : 5) + (T.evCrime || 0); T.localHappy = hpW ? hpS / hpW : 60; T.pollR = hpW ? polS / hpW : 0;
  // zdraví
  let hs = 0; for (let k = 0; k < NN; k++) if (zone[k] === 1 && isBuilt(k)) hs += Math.min(1, cov.health[k]) * occ[k];
  const sewOk = pop < 8000 ? 1 : Math.min(1, T.sCap / pop);
  T.healthT = clamp((pop ? hs / pop : 0.8) * 60 + sewOk * 25 + 15 + tfx('health') + (T.evHealth || 0) + Math.max(0, 1 - pop / 4000) * 30 - T.pollR * 0.3 - (S.epi ? S.epi.sick * 300 : 0), 0, 100);
  // svoboda a globální nálada
  let fr = 100; for (const p in S.pol) if (S.pol[p] && POLICY_FREEDOM[p]) fr += POLICY_FREEDOM[p]; if (S.martial > 0) fr -= 30;
  T.freedomT = clamp(fr, 0, 100);
  const mods = happyMods();
  T.mods = mods; T.happyT = clamp(T.localHappy + mods.reduce((a, m) => a + m[1], 0), 0, 100);
  // poptávka
  const tx = z => (S.tax[z] - 9) * 0.045, rec = S.recession > 0 ? 1 : 0;
  const Ct = pop * 0.2, Ot = pop * 0.22 * T.eduRate, It = Math.max(pop * 0.12, work - Ct - Ot), free = (work * 1.03 - jobsCap - ext) / (work + 300), RD = T.railDem || {};
  T.dem = {
    1: clamp(0.7 * ((jobsCap + ext) * 0.97 - work) / (work + 300) + (S.happy - 50) / 110 - tx('R') + (pop < 300 ? 0.4 : 0) - (S.short.food ? 0.3 : 0), -1, 1),
    2: clamp(0.5 * (Ct - cap[2]) / (cap[2] + 150) + 0.6 * free - tx('C') + (S.pol.bizsupport ? 0.15 : 0) + tfx('comDem') + (RD[2] || 0) + (T.evCom || 0) - rec * 0.3 - (S.short.goods ? 0.3 : 0) - (S.pol.curfew || S.pol.quarantine ? 0.2 : 0), -1, 1),
    3: clamp(0.5 * (It - cap[3]) / (cap[3] + 150) + 0.6 * free + (RD[3] || 0) + (pop > 0 && pop < 300 ? 0.3 : 0) - tx('I') - (S.pol.ecolaw ? 0.15 : 0) - (S.pol.minwage ? 0.08 : 0) - rec * 0.25, -1, 1),
    4: clamp(0.5 * (Ot - cap[4]) / (cap[4] + 150) + 0.6 * free - tx('O') + (S.pol.bizsupport ? 0.15 : 0) + (S.techs.banking ? 0.1 : 0) + tfx('officeDem') + (RD[4] || 0) - rec * 0.2 - (S.short.tech ? 0.25 : 0), -1, 1),
  };
  if (pop < 30) { T.dem[2] = Math.min(T.dem[2], 0); T.dem[4] = Math.min(T.dem[4], 0); }
  // pozvolný posun nálad
  S.happy = lerp(S.happy, T.happyT, 0.25);
  S.crime = lerp(S.crime, T.crimeT, 0.25);
  S.freedom = lerp(S.freedom, T.freedomT, 0.3);
  S.health = lerp(S.health, T.healthT, 0.25);
  const apT = clamp(S.happy + S.mood + tfx('approval') + (S.techs.egov ? 3 : 0) - S.repress * 1.5, 0, 100);
  S.approval = lerp(S.approval, apT, 0.08);
  const radT = clamp(6 + T.unemp * 70 + Math.max(0, 55 - S.happy) * 0.45 + Math.max(0, 75 - S.freedom) * 0.35 + S.repress * 2 - (S.pol.integration ? 10 : 0) - (S.pol.youth ? 4 : 0) - T.eduRate * 10 - Math.min(1, T.intel) * 6 + (S.pol.censorship ? 6 : 0), 0, 100);
  S.radical = lerp(S.radical, radT * (1 + tfx('radical')), 0.04);
  if (T.army > 0) { const loyT = clamp(55 + (S.bud.army - 100) * 0.5 + (S.approval - 50) * 0.3 + (S.pol.armypay ? 15 : 0) + tfx('armyLoy') - S.armyGrudge + S.glory, 0, 100); S.armyLoy = lerp(S.armyLoy, loyT, 0.05); }
}
function happyMods() {
  const m = [];
  const tax = (S.tax.R - 9) * 1.6 + (S.tax.C + S.tax.I + S.tax.O - 27) * 0.25; if (Math.abs(tax) > 0.5) m.push(['Daně', -tax]);
  if (T.unemp > 0.04) m.push(['Nezaměstnanost', -T.unemp * 70]);
  if (T.pRatio < 0.98 && T.pDem > 0) m.push(['Výpadky elektřiny', -(1 - T.pRatio) * 25]);
  if (T.wRatio < 0.98 && T.wDem > 0) m.push(['Nedostatek vody', -(1 - T.wRatio) * 25]);
  if (T.gCap < T.gDem && T.pop > 200) m.push(['Hromadí se odpadky', -Math.min(10, (T.gDem - T.gCap) / T.gDem * 20)]);
  if (S.short.food) m.push(['Nedostatek potravin', -15]);
  if (S.short.goods) m.push(['Prázdné obchody', -5]);
  if (T.traffic > 0.9) m.push(['Dopravní zácpy', -(T.traffic - 0.9) * 12]);
  if (S.health < 60) m.push(['Zdravotní péče', -(60 - S.health) * 0.2]);
  if (S.epi) m.push(['Epidemie', -Math.min(15, S.epi.sick * 120)]);
  const p = S.pol;
  const pol = (p.freebus ? 4 : 0) + (p.minwage ? 4 : 0) + (p.youth ? 1 : 0) - (p.curfew ? 8 : 0) - (p.censorship ? 3 : 0) - (p.noprotest ? 4 : 0) - (p.cameras ? 2 : 0) - (p.gunlaw ? 1 : 0) - (p.quarantine ? 5 : 0);
  if (pol) m.push(['Vyhlášky', pol]);
  if (tfx('happy')) m.push(['Výzkum', tfx('happy')]);
  if (T.stadium) m.push(['Stadion', 4]);
  if (T.landN) m.push(['Památky', Math.min(6, T.landN * 1.2)]);
  if (T.evHappy) m.push(['Akce ve městě', T.evHappy]);
  if (S.martial > 0) m.push(['Vojáci v ulicích', -6]);
  if (S.nb.some(n => n.war)) m.push(['Válka', -5]);
  if (S.crime > 30) m.push(['Kriminalita', -(S.crime - 30) * 0.3]);
  if (S.freedom < 70) m.push(['Omezení svobod', -(70 - S.freedom) * 0.15]);
  return m;
}

// ---------- denní krok ----------
function simDay() {
  if (S.over) return;
  S.day++;
  growthStep();
  firesDay(); floodDay(); epiDay(); incidentsDay(); warDay(); railDay();
  if (typeof extrasDay === 'function') extrasDay();
  for (const b of blds.values()) {
    if (b.built < 1) { b.built = Math.min(1, b.built + 1 / Math.max(4, SERV[b.type].size * 5)); if (b.built >= 1) covDirty = true; }
    if (b.off > 0 && --b.off === 0) covDirty = true;
    if (b.fire > 0) { b.fire--; if (b.fire === 0) covDirty = true; }
  }
  if (S.day % 5 === 0) analysis();
  if (S.day % MONTH === 0) monthly();
}
function growthStep() {
  const per = Math.ceil(NN / 6);
  for (let n = 0; n < per; n++) { growTile(cursor); cursor = (cursor + 1) % NN; }
}
function growTile(k) {
  if (ruin[k]) { if (--ruin[k] === 0) { lvl[k] = 0; markDirty(k); } return; }
  if (!zone[k] || fire[k] || bld[k]) return;
  const z = zone[k], D = T.dem ? T.dem[z] : 0, ok = acc[k] && pw[k] && wt[k] && !flood[k];
  if (lvl[k] && !aband[k] && chance(fireRate(k))) igniteTile(k);
  if (!ok) { if (lvl[k] && !aband[k]) { bad[k] = Math.min(250, bad[k] + 6); if (bad[k] >= 96) { aband[k] = 1; occ[k] = 0; markDirty(k); } } return; }
  bad[k] = 0;
  if (aband[k]) { if (D > 0.05 && chance(0.25)) { aband[k] = 0; markDirty(k); } return; }
  const top = dens[k] ? (S.techs.skyscraper ? 5 : 4) : 3;
  const need = lvl[k] < top ? LV_NEED[dens[k]][lvl[k] + 1] : 999;
  const eduOk = z !== 4 || lvl[k] < 1 || T.eduRate > 0.22 + lvl[k] * 0.07;
  if (D > 0 && lvl[k] < top && lv[k] >= need && eduOk && chance((0.1 + D * 0.45) * (1 + tfx('growth')))) {
    lvl[k]++; vari[k] = (vari[k] + 37) & 255; sty[k] = styleFor(k);
    if (lvl[k] === 1 && z === 3) spec[k] = S.techs.hightech && T.eduRate > 0.35 && chance(0.3) ? 2 : chance(0.35) ? 1 : 0;
    markDirty(k); FX.push({ t: 'grow', k });
  } else if (lvl[k] > 1 && (D < -0.45 || lv[k] < LV_NEED[dens[k]][lvl[k]] - 15) && chance(0.06)) { lvl[k]--; occ[k] = Math.min(occ[k], capOf(k)); markDirty(k); }
  else if (lvl[k] === 1 && D < -0.7 && chance(0.04)) { aband[k] = 1; occ[k] = 0; markDirty(k); return; }
  if (!lvl[k]) return;
  const c = capOf(k);
  let target;
  if (z === 1) target = c * clamp(0.86 + D * 0.2 + (hap[k] - 55) / 220, 0.25, 1);
  else { target = c * (T.jobFill || 0); if (strikeOn(z)) target *= 0.5; }
  if (z === 1 && S.epi) target *= 1 - S.epi.sick * 0.2;
  occ[k] = lerp(occ[k], target, 0.35);
}
// ráz nové budovy podle okolí: vesnice, městečko a předměstí, nebo velkoměsto
function styleFor(k) {
  const x = k % N, y = (k / N) | 0; let b = 0, h = 0;
  for (let j = y - 4; j <= y + 4; j++) for (let i = x - 4; i <= x + 4; i++) if (inb(i, j)) { const t = idx(i, j); if (zone[t] && lvl[t]) { b++; if (dens[t]) h++; } else if (bld[t] || road[t]) b += 0.3; }
  const u = (b + h * 2) / 81;
  if (!dens[k] && (T.pop < 2500 || u < 0.32)) return 0;
  if (T.pop < 20000 || u < 0.75) return 1;
  return 2;
}
const strikeOn = z => S.inc.some(i => i.type === 'strike' && i.zone === z);
function fireRate(k) {
  let r = 1.3e-5 * 6 * (zone[k] === 3 ? 2 : 1) * (1 + lvl[k] * 0.15) * (S.techs.firecode ? 0.6 : 1) * (S.pol.firesafety ? 0.75 : 1) * (1 + tfx('fireRisk')) * (S.heat > 0 ? 3 : 1) * CRK();
  return r * (1 - Math.min(1, cov.fire[k]) * 0.5);
}
const CRK = () => CRISIS_LEVELS[S.opts.crisis].k;

// ---------- požáry ----------
function igniteTile(k, quiet) {
  if (fire[k] || !lvl[k] || ruin[k] || road[k]) return false;
  fire[k] = 1; markDirty(k);
  if (!quiet) note('Hoří ' + tileName(k) + '.' + (cov.fire[k] > 0.05 ? ' Hasiči vyjíždějí.' : ' Žádní hasiči nejsou v dosahu!'), 'bad', k);
  FX.push({ t: 'firetruck', k });
  return true;
}
function tileName(k) {
  if (bld[k]) return SERV[blds.get(bld[k]).type].name.toLowerCase();
  const z = zone[k]; return z === 1 ? (dens[k] ? 'bytový dům' : 'rodinný dům') : z === 2 ? 'obchod' : z === 3 ? 'továrna' : z === 4 ? 'kancelářská budova' : 'budova';
}
function firesDay() {
  const burning = []; for (let k = 0; k < NN; k++) if (fire[k]) burning.push(k);
  const fe = (1 + tfx('fireEff')) * (0.45 + 0.55 * (T.wRatio || 0));   // hasiči bez vody nezmůžou nic
  for (const k of burning) {
    const x = k % N, y = (k / N) | 0, c = Math.min(1, cov.fire[k] * fe);
    if (chance(c * 0.55 + (S.techs.firecode ? 0.08 : 0))) { fire[k] = 0; markDirty(k); S.stat = S.stat || {}; S.stat.fires = (S.stat.fires || 0) + 1; if (c > 0.2) note('Hasiči uhasili ' + tileName(k) + '.', 'good', k); continue; }
    fire[k]++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const n = idx(nx, ny); if (chance(0.11 * (1 - c * 0.8) * (S.heat > 0 ? 1.6 : 1))) igniteTile(n, true); }
    if (fire[k] > 5 + (k % 4)) destroyTile(k, 'shořela');
  }
  if (burning.length >= 6 && !S.inc.some(i => i.type === 'bigfire')) { const k = burning[0]; addInc({ type: 'bigfire', x: k % N, y: (k / N) | 0 }); }
}
function destroyTile(k, why) {
  fire[k] = 0;
  if (bld[k]) { const b = blds.get(bld[k]); if (b.type === 'townhall') { b.off = 60; covDirty = true; note('Radnice je těžce poškozená. Úřad dva měsíce nefunguje.', 'bad', k); return; } removeBuilding(b); for (let j = b.y; j < b.y + b.size; j++) for (let i = b.x; i < b.x + b.size; i++) { const t = idx(i, j); ruin[t] = 40; lvl[t] = 0; markDirty(t); } covDirty = true; note('Budova „' + SERV[b.type].name + '“ ' + (why || 'byla zničena') + '.', 'bad', k); return; }
  if (!lvl[k]) return;
  const lost = zone[k] === 1 ? occ[k] : 0;
  lvl[k] = 0; occ[k] = 0; aband[k] = 0; ruin[k] = 35 + ((k * 7) % 20); markDirty(k);
  return lost;
}

// ---------- incidenty ----------
function addInc(o) { o.id = S.incN++; o.day = S.day; S.inc.push(o); FX.push({ t: 'inc', id: o.id }); return o; }
function endInc(i) { S.inc = S.inc.filter(x => x !== i); }
const incById = id => S.inc.find(i => i.id === id);
const CAUSE = { taxes: 'vysoké daně', unemp: 'nezaměstnanost', pollution: 'znečištění', crime: 'kriminalita', power: 'výpadky elektřiny', policy: 'vyhláška', war: 'válka', repression: 'policejní násilí', services: 'špatné služby', food: 'nedostatek potravin' };
function grievance() {
  const g = [['taxes', (S.tax.R - 8) * 3 + (S.tax.C + S.tax.I + S.tax.O - 27)], ['unemp', T.unemp * 150], ['pollution', T.pollR * 0.6], ['crime', S.crime * 0.6], ['power', (1 - T.pRatio) * 60 + (1 - T.wRatio) * 60], ['war', S.nb.some(n => n.war) ? 25 : 0], ['repression', S.repress * 6], ['services', Math.max(0, 70 - S.health) * 0.6], ['food', S.short.food ? 40 : 0]];
  g.sort((a, b) => b[1] - a[1]); return g[0][0];
}
function protestSpot() {
  for (const b of blds.values()) if (b.type === 'townhall') return { x: b.x + (chance(0.5) ? -1 : 2), y: b.y + 1 };
  return { x: W.cx, y: W.cy };
}
function startProtest(cause, policy, size) {
  if (S.inc.some(i => (i.type === 'protest' || i.type === 'riot') && i.cause === cause && i.policy === policy)) return;
  const p = protestSpot();
  const i = addInc({ type: 'protest', x: p.x, y: p.y, size: size || Math.round(200 + T.pop * 0.01 * (1 + Math.random())), cause, policy: policy || null });
  if (S.pol.noprotest) i.size = Math.round(i.size * 1.8);
  note('Demonstrace před radnicí: ' + (policy ? 'proti vyhlášce „' + POLICIES[policy].name + '“' : CAUSE[cause]) + '.', 'bad', idx(i.x, i.y));
}
function policeStrength(x, y) { return T.officers * budF('police') * (0.35 + 0.65 * Math.min(1, cov.police[idx(x, y)] + 0.2)); }
function incidentsDay() {
  for (const i of S.inc.slice()) {
    const age = S.day - i.day;
    if (i.type === 'protest') {
      const grow = 0.035 + (48 - S.approval) / 500;
      i.size = Math.max(0, Math.round(i.size * (1 + grow)));
      if (S.approval > 58) i.size = Math.round(i.size * 0.9);
      if (i.size < 40) { endInc(i); note('Demonstrace se rozešla.', 'good'); continue; }
      S.mood -= 0.02;
      if (i.size > 1200 && S.approval < 36 && chance(0.03 * (S.pol.noprotest ? 2 : 1))) toRiot(i, 'Demonstrace přerostla v nepokoje!');
      if (i.size > 15000) i.size = 15000;
    } else if (i.type === 'riot') {
      S.mood -= 0.08;
      if (S.pol.curfew) i.size = Math.round(i.size * 0.86);
      if (S.martial > 0) i.size = Math.round(i.size * 0.7);
      if (S.approval > 45) i.size = Math.round(i.size * 0.95);
      i.size = Math.round(i.size * (1 + Math.max(0, 40 - S.approval) / 700));
      // policie zasahuje sama, pokud má sílu
      if (policeStrength(i.x, i.y) * 25 > i.size * 1.3) i.size = Math.round(i.size * 0.9);
      if (chance(Math.min(0.8, i.size / 4000))) { const k = randomNear(i.x, i.y, 3, k => lvl[k] && !fire[k]); if (k >= 0) igniteTile(k, true); }
      if (chance(0.15)) { i.x = clamp(i.x + Math.round(Math.random() * 2 - 1), 1, N - 2); i.y = clamp(i.y + Math.round(Math.random() * 2 - 1), 1, N - 2); }
      if (i.size < 60) { endInc(i); note('Nepokoje utichly.', 'good'); }
    } else if (i.type === 'strike') {
      if (age > i.len) { endInc(i); note('Stávka skončila, lidé se vrátili do práce.', 'good'); }
    } else if (i.type === 'bigfire' || i.type === 'aftermath' || i.type === 'quake' || i.type === 'spill') {
      if (i.type === 'bigfire' && !fireCount()) { endInc(i); continue; }
      if (age > 45) endInc(i);
    } else if (i.type === 'coupwarn') { if (age > 60 || S.armyLoy > 35) endInc(i); }
  }
  if (S.martial > 0) { S.martial--; S.armyGrudge += 0.05; if (!S.martial) note('Armáda se stáhla z ulic.'); }
  S.mood *= 0.985; S.repress *= 0.99; S.armyGrudge *= 0.995; S.glory *= 0.995;
  for (const s of S.spills.slice()) if (S.day > s.until) S.spills.splice(S.spills.indexOf(s), 1);
  if (S.heat > 0) S.heat--;
}
const fireCount = () => { let n = 0; for (let k = 0; k < NN; k++) if (fire[k]) n++; return n; };
function randomNear(x, y, r, f) {
  for (let t = 0; t < 30; t++) { const i = x + Math.round((Math.random() * 2 - 1) * r), j = y + Math.round((Math.random() * 2 - 1) * r); if (!inb(i, j)) continue; const k = idx(i, j); if (f(k)) return k; }
  return -1;
}
function toRiot(i, text) { i.type = 'riot'; i.size = Math.max(400, i.size); note(text, 'bad', idx(i.x, i.y)); FX.push({ t: 'inc', id: i.id }); }

// akce u incidentů
function incActions(i) {
  const a = [];
  const neg = Math.round(i.size * 180);
  if (i.type === 'protest') {
    a.push({ id: 'negotiate', label: 'Vyjednat', cost: neg, hint: 'Pošleš zástupce města. Když se dohodnete, většina lidí odejde.' });
    a.push({ id: 'concede', label: concedeLabel(i), hint: 'Vyhovíš jejich požadavku. Důvěra vzroste, ale něco tě to bude stát.' });
    a.push({ id: 'disperse', label: 'Rozehnat policií', hint: 'Účinné, když máš dost policistů. Lidi to naštve a radikálů přibude. Může skončit nepokoji.' });
  } else if (i.type === 'riot') {
    a.push({ id: 'police', label: 'Policejní zásah', hint: 'Policie se pokusí obnovit pořádek. Čím víc policistů, tím větší šance.' });
    if (T.army > 0) a.push({ id: 'army', label: 'Nasadit armádu', hint: 'Skoro jistě uspěje, ale lidi i armáda ti to budou vyčítat.' });
    a.push({ id: 'curfew', label: S.pol.curfew ? 'Zrušit zákaz vycházení' : 'Vyhlásit zákaz vycházení', hint: 'Nepokoje každý den slábnou, obchody ale trpí.' });
    a.push({ id: 'negotiate', label: 'Vyjednat', cost: neg * 2, hint: 'Malá šance, ale bez násilí.' });
  } else if (i.type === 'strike') {
    a.push({ id: 'pay', label: 'Vyplatit příplatky', cost: Math.round(i.size * 900), hint: 'Stávka hned skončí.' });
    a.push({ id: 'minwage', label: 'Zvýšit minimální mzdu', hint: 'Zapne vyhlášku o vyšší mzdě. Stávka skončí a další budou vzácnější.' });
    a.push({ id: 'negotiate', label: 'Vyjednat', cost: 150000, hint: 'Možná se dohodnete na kompromisu.' });
  } else if (i.type === 'bigfire') {
    a.push({ id: 'help', label: 'Povolat hasiče z okolí', cost: 400000, hint: 'Sousední sbory uhasí většinu požárů v okolí.' });
  } else if (i.type === 'aftermath') {
    a.push({ id: 'unity', label: 'Projev k národu', cost: 0, hint: 'Uklidníš lidi. Důvěra mírně vzroste, radikálů ubude.' });
    a.push({ id: 'raids', label: 'Razie v podezřelých čtvrtích', cost: 300000, hint: 'Rychle oslabí extremisty, ale omezí svobody a část lidí naštve.' });
    a.push({ id: 'security', label: 'Posílit hlídky', hint: 'Zapne vyhlášku Posílené hlídky.' });
  } else if (i.type === 'quake') {
    a.push({ id: 'rescue', label: 'Záchranná akce', cost: 1200000, hint: 'Vyprostíš lidi z trosek. Důvěra vzroste.' });
    a.push({ id: 'aid', label: 'Požádat sousedy o pomoc', hint: 'Spřátelená města pošlou peníze.' });
  } else if (i.type === 'spill') {
    a.push({ id: 'cleanup', label: 'Sanace území', cost: 900000, hint: 'Odstraní znečištění.' });
  } else if (i.type === 'coupwarn') {
    a.push({ id: 'armypay', label: 'Zapnout příplatky vojákům', hint: 'Zapne vyhlášku Příplatky vojákům.' });
    a.push({ id: 'meet', label: 'Sejít se s generály', cost: 500000, hint: 'Loajalita armády vzroste.' });
  } else if (i.type === 'epidemic') {
    return epiActions();
  } else if (i.type === 'flood') {
    if (S.floodEv && !S.floodEv.sand) a.push({ id: 'sandbags', label: 'Pytle s pískem', cost: 400000, hint: 'Voda zaplaví jen nejbližší pás u řeky.' });
    a.push({ id: 'evacuate', label: 'Evakuovat ohrožené', cost: 250000, hint: 'Nikdo nezahyne a lidé ocení péči.' });
  } else if (i.type === 'derail' || i.type === 'railstrike') {
    return railIncActions(i);
  } else if (i.type === 'assault') {
    if (T.army > 0 && !i.intercept) a.push({ id: 'intercept', label: 'Vyslat armádu naproti', hint: 'Vojáci se postaví útočníkům dřív, než dorazí do města.' });
  }
  return a;
}
function concedeLabel(i) {
  if (i.policy) return 'Zrušit vyhlášku';
  return { taxes: 'Snížit daně o 2 %', unemp: 'Program veřejných prací', pollution: 'Zavést ekologické normy', crime: 'Posílit hlídky', power: 'Slíbit nápravu', war: 'Slíbit mírová jednání', repression: 'Omluvit se a vyšetřit zásah', services: 'Navýšit rozpočet služeb', food: 'Rozdat potravinovou pomoc' }[i.cause] || 'Vyhovět';
}
function incAction(id, act) {
  const i = incById(id); if (!i) return 'Událost už skončila.';
  const a = incActions(i).find(x => x.id === act); if (!a) return 'To teď nejde.';
  if (a.cost && !canAfford(a.cost)) return 'Na to nemáš peníze (' + money(a.cost) + ').';
  if (a.cost) spend(a.cost);
  const k = idx(i.x, i.y), med = S.techs.mediation ? 0.2 : 0;
  switch (i.type + ':' + act) {
    case 'protest:negotiate': case 'riot:negotiate': {
      const p = (i.type === 'riot' ? 0.25 : 0.55) + med + (S.approval - 40) / 200;
      if (chance(p)) { i.size = Math.round(i.size * 0.25); S.mood += 2; note('Dohoda s demonstranty: většina lidí odchází.', 'good', k); if (i.type === 'riot' && i.size < 300) endInc(i); }
      else { i.size = Math.round(i.size * 1.15); S.mood -= 1; note('Jednání selhalo. Dav se rozrůstá.', 'bad', k); }
      break;
    }
    case 'protest:concede': {
      if (i.policy) { S.pol[i.policy] = false; }
      else if (i.cause === 'taxes') for (const z in S.tax) S.tax[z] = Math.max(0, S.tax[z] - 2);
      else if (i.cause === 'unemp') { if (!canAfford(800000)) return 'Program stojí 800 tis. Kč.'; spend(800000); S.mood += 2; }
      else if (i.cause === 'pollution') S.pol.ecolaw = true;
      else if (i.cause === 'crime') S.pol.patrols = true;
      else if (i.cause === 'repression') { S.repress *= 0.5; }
      else if (i.cause === 'services') { for (const c of ['health', 'edu', 'fire']) S.bud[c] = Math.min(150, S.bud[c] + 10); }
      else if (i.cause === 'food') { if (!canAfford(500000)) return 'Pomoc stojí 500 tis. Kč.'; spend(500000); }
      S.mood += 4; endInc(i); note('Vyhověl jsi demonstrantům. Rozcházejí se spokojeně.', 'good', k); covDirty = true;
      break;
    }
    case 'protest:disperse': case 'riot:police': {
      const p = clamp(policeStrength(i.x, i.y) * 25 / i.size * 0.6, 0.08, 0.95) + (S.techs.riot ? 0.1 : 0) - (i.type === 'riot' ? 0.15 : 0);
      FX.push({ t: 'police', k });
      S.repress += i.type === 'riot' ? 1 : 2; S.mood -= i.type === 'riot' ? 1 : 3;
      if (chance(p)) { endInc(i); note(i.type === 'riot' ? 'Policie obnovila pořádek.' : 'Policie demonstraci rozehnala. Část lidí to pobouřilo.', i.type === 'riot' ? 'good' : '', k); }
      else if (i.type === 'protest' && chance(S.techs.riot ? 0.35 : 0.6)) toRiot(i, 'Zásah se vymkl kontrole. Ve městě vypukly nepokoje!');
      else { i.size = Math.round(i.size * 0.75); note('Zásah jen částečně uspěl.', 'bad', k); }
      break;
    }
    case 'riot:army': {
      FX.push({ t: 'army', k }); S.repress += 3; S.mood -= 6; S.armyGrudge += 8;
      if (chance(0.92)) { endInc(i); note('Armáda potlačila nepokoje. Ulice jsou klidné, ale atmosféra je napjatá.', '', k); } else note('Ani armáda situaci nezvládla.', 'bad', k);
      break;
    }
    case 'riot:curfew': S.pol.curfew = !S.pol.curfew; note(S.pol.curfew ? 'Platí zákaz vycházení.' : 'Zákaz vycházení zrušen.'); break;
    case 'strike:pay': endInc(i); note('Stávka skončila po vyplacení příplatků.', 'good'); break;
    case 'strike:minwage': S.pol.minwage = true; endInc(i); S.mood += 2; note('Minimální mzda se zvyšuje. Odbory ukončily stávku.', 'good'); break;
    case 'strike:negotiate': if (chance(0.5 + med)) { endInc(i); note('Kompromis s odbory: stávka končí.', 'good'); } else { i.len += 10; note('Odbory dohodu odmítly.', 'bad'); } break;
    case 'bigfire:help': for (let t = 0; t < NN; t++) if (fire[t] && Math.hypot(t % N - i.x, ((t / N) | 0) - i.y) < 10 && chance(0.8)) { fire[t] = 0; markDirty(t); } endInc(i); note('Hasiči z okolí pomohli uhasit požár.', 'good'); break;
    case 'aftermath:unity': S.mood += 4; S.radical = Math.max(0, S.radical - 3); endInc(i); note('Tvůj projev lidi uklidnil.', 'good'); break;
    case 'aftermath:raids': S.radical = Math.max(0, S.radical - 10); S.repress += 2; S.mood -= 1; endInc(i); note('Razie zadržely desítky podezřelých.'); break;
    case 'aftermath:security': S.pol.patrols = true; endInc(i); break;
    case 'quake:rescue': S.mood += 6; endInc(i); note('Záchranáři vyprostili desítky lidí.', 'good'); break;
    case 'quake:aid': { let got = 0; for (const n of S.nb) if (n.rel > 20 && !n.war) { const m = Math.round(n.rel * 15000); got += m; n.rel += 2; } S.money += got; endInc(i); note(got ? 'Sousedé poslali pomoc: ' + money(got) + '.' : 'Nikdo z okolí nepomohl. Vztahy nejsou dost dobré.', got ? 'good' : 'bad'); break; }
    case 'spill:cleanup': S.spills = S.spills.filter(s => !(s.x === i.x && s.y === i.y)); endInc(i); note('Kontaminace odstraněna.', 'good'); break;
    case 'coupwarn:armypay': S.pol.armypay = true; endInc(i); break;
    case 'coupwarn:meet': S.armyLoy = Math.min(100, S.armyLoy + 15); S.armyGrudge *= 0.5; endInc(i); note('Generálové odcházejí ze schůzky uklidnění.', 'good'); break;
    case 'epidemic:quarantine': S.pol.quarantine = !S.pol.quarantine; note(S.pol.quarantine ? 'Karanténa vyhlášena.' : 'Karanténa zrušena.'); break;
    case 'epidemic:campaign': if (S.epi) S.epi.campaign = 40; note('Kampaň začala.', 'good'); break;
    case 'flood:sandbags': if (S.floodEv) S.floodEv.sand = true; note('Hasiči a dobrovolníci staví valy z pytlů.', 'good'); break;
    case 'flood:evacuate': S.mood += 3; i.evac = true; note('Lidé ze záplavového území jsou v bezpečí.', 'good'); break;
    case 'assault:intercept': i.intercept = true; FX.push({ t: 'intercept', id: i.id }); note('Armáda vyrazila útočníkům naproti.'); break;
    default: railIncAction(i, act);
  }
  return null;
}

// ---------- povodně, epidemie ----------
function floodDay() {
  const f = S.floodEv; if (!f) return;
  f.day++;
  if (f.day === 1 || f.day === 4) {
    // voda se rozlije do záplavového území, hráze ji zastaví
    const reach = f.day === 1 ? 1 : (f.sand ? 1 : 2), q = [];
    const dist = new Uint8Array(NN).fill(255);
    for (let k = 0; k < NN; k++) if (ter[k] === 1) { dist[k] = 0; q.push(k); }
    for (let h = 0; h < q.length; h++) {
      const k = q[h], x = k % N, y = (k / N) | 0; if (dist[k] >= reach) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const n = idx(nx, ny);
        if (dist[n] !== 255 || !fpl[n]) continue; const b = bAt(n); if (b && b.type === 'dike') continue; dist[n] = dist[k] + 1; flood[n] = 1; markDirty(n); q.push(n); }
    }
    for (const b of blds.values()) { let w = false; for (let j = b.y; j < b.y + b.size; j++) for (let i = b.x; i < b.x + b.size; i++) if (flood[idx(i, j)]) w = true; b.flooded = w; }
    covDirty = true;
  }
  for (let k = 0; k < NN; k++) if (flood[k] && lvl[k] && chance(0.02 * (f.sand ? 0.6 : 1) * (1 + tfx('flood')))) { destroyTile(k); }
  if (f.day >= f.len) {
    for (let k = 0; k < NN; k++) if (flood[k]) { flood[k] = 0; markDirty(k); }
    for (const b of blds.values()) b.flooded = false;
    S.floodEv = null; covDirty = true; note('Voda opadla. Začíná úklid.', 'good');
    endInc(S.inc.find(i => i.type === 'flood') || {});
  }
}
function epiDay() {
  const e = S.epi; if (!e) return;
  const beta = 0.17 * (1.45 - S.health / 100) * (1 + tfx('epidemic')) * (S.techs.vaccines ? 0.6 : 1) * (S.pol.quarantine ? 0.55 : 1) * (e.campaign > 0 ? (S.techs.vaccines ? 0.45 : 0.75) : 1);
  const inf = beta * e.sick * Math.max(0, 1 - e.sick - e.imm), rec = 0.08 * e.sick;
  e.sick = clamp(e.sick + inf - rec, 0, 0.5); e.imm = Math.min(0.95, (e.imm || 0) + rec); if (e.campaign > 0) e.campaign--;
  const dead = T.pop * e.sick * 0.0015 * (1.2 - Math.min(1, S.health / 100));
  e.dead += dead;
  if (dead > 0.5) for (let n = 0; n < 40; n++) { const k = (Math.random() * NN) | 0; if (zone[k] === 1 && occ[k] > 1) occ[k] = Math.max(0, occ[k] - dead / 20); }
  if (e.sick < 0.0015) { S.epi = null; note('Epidemie skončila. Zemřelo ' + fmt(e.dead) + ' lidí.', 'good'); endInc(S.inc.find(i => i.type === 'epidemic') || {}); }
}

// ---------- měsíční krok ----------
function monthly() {
  const m = monthOf(S.day), pop = T.pop;
  // příjmy a výdaje
  const hall = [...blds.values()].some(b => b.type === 'townhall' && b.ok && !(b.off > 0));
  const coll = hall ? 1 : 0.4;
  const inc = {
    R: pop * S.tax.R * TAXK.R * coll, C: T.fil[2] * S.tax.C * TAXK.C * coll, I: T.fil[3] * S.tax.I * TAXK.I * coll, O: T.fil[4] * S.tax.O * TAXK.O * coll * (1 + tfx('officeTax')),
    power: Math.max(0, T.pCap - T.pDem) * 25, tourism: (T.tour * 9000 + ((T.landTour || 0) + (T.evTour || 0)) * 14000) * (S.techs.tourism ? 1.5 : 1) + (S.techs.tourism ? (T.stadium * 2 + sumPark()) * 9000 : 0),
    share: pop > 0 ? 55000 * Math.sqrt(pop / 450) * coll : 0,
  };
  if (blds.size && [...blds.values()].some(b => b.type === 'recycle' && b.ok)) inc.recycle = 40000;
  const RL = railMonth(); inc.rail = RL.inc; inc.railSub = RL.sub;
  const exp = { services: 0, admin: pop * (6 + pop / 15000), roads: T.roadUp, rail: RL.cost, research: S.resFund || 0, policies: 0, loan: S.loan * (S.techs.banking ? 0.005 : 0.008) };
  const byCat = {};
  for (const b of blds.values()) { const d = SERV[b.type], c = BUD_OF[b.type], u = d.up * (c ? S.bud[c] / 100 : 1) * (b.built < 1 ? 0.3 : 1); exp.services += u; byCat[d.cat] = (byCat[d.cat] || 0) + u; }
  if (S.techs.egov) exp.services *= 0.95;
  exp.services *= 1 + tfx('upkeep');
  for (const p in S.pol) if (S.pol[p]) exp.policies += POLICIES[p].cost * pop / 1000;
  const trade = monthlyTrade();
  const tIn = Object.values(inc).reduce((a, b) => a + b, 0), tOut = Object.values(exp).reduce((a, b) => a + b, 0);
  S.money += tIn - tOut + trade.net;
  S.last = { inc, exp, byCat, trade, net: tIn - tOut + trade.net, day: S.day };
  if (!hall && pop > 0) note([...blds.values()].some(b => b.type === 'townhall') ? 'Radnice nefunguje, vybíráš jen 40 % daní.' : 'Ve městě chybí radnice, vybíráš jen 40 % daní. Postav ji v záložce Správa.', 'bad');
  // výzkum
  const rp = researchRate();
  S.rp += rp;
  if (!S.research && S.rq && S.rq.length) S.research = S.rq.shift();
  while (S.research && S.rp >= TECHS[S.research].cost) {
    const t = TECHS[S.research]; S.techs[S.research] = true; fxReset(); S.rp -= t.cost;
    note('Vyzkoumáno: ' + t.name + '. ' + (t.u ? 'Odemyká: ' + t.u + '. ' : '') + [t.desc].concat(fxText(t.fx)).join(' '), 'good');
    S.research = null; covDirty = true;
    while (S.rq && S.rq.length && !S.research) { const n = S.rq.shift(); if (!S.techs[n]) S.research = n; }
  }
  if (!S.research) S.rp = Math.min(S.rp, 600);
  // vojáci se doplňují
  if (S.soldiers < T.army) S.soldiers = Math.min(T.army, S.soldiers + T.army * 0.08); else S.soldiers = T.army;
  // ceny na trhu
  for (const g of GOOD_KEYS) { const base = GOODS[g].price * (S.recession > 0 && g !== 'fuel' ? 0.78 : 1) * (g === 'fuel' && S.nb.some(n => n.war) ? 1.3 : 1) * (S.priceBoost && S.priceBoost.g === g && S.day < S.priceBoost.until ? 1.12 : 1);
    S.price[g] = clamp(S.price[g] * Math.exp((Math.random() - 0.5) * 0.12) + (base - S.price[g]) * 0.15, base * 0.5, base * 2); }
  if (S.recession > 0 && --S.recession === 0) note('Hospodářská krize odeznívá.', 'good');
  S.tradeUsed = 0;
  // bankrot
  if (S.money < 0 && S.resFund) { S.resFund = 0; note('Pokladna je prázdná, grant na výzkum byl zastaven.', 'bad'); }
  if (S.money < -3000000) { S.bankrupt++; note('Město je hluboko v mínusu. Když dluh potrvá, převezme město nucená správa.', 'bad'); if (S.bankrupt >= 4) return gameOver('bankrot'); } else S.bankrupt = 0;
  monthlyEvents(m); railMonthlyEvents();
  neighborsMonthly();
  if (S.opts.elections && m === 9 && (yearOf(S.day) - 2026) % 4 === 2) election();
  advisor();
  S.hist.push({ d: S.day, pop: Math.round(pop), money: Math.round(S.money), happy: Math.round(S.happy), approval: Math.round(S.approval), crime: Math.round(S.crime), radical: Math.round(S.radical),
    net: Math.round(S.last ? S.last.net : 0), unemp: Math.round(T.unemp * 1000) / 10, poll: Math.round(T.pollR || 0), traf: Math.round((T.traffic || 0) * 100), pax: Math.round(S.rail ? S.rail.pax : 0), tour: Math.round(S.last ? S.last.inc.tourism : 0), health: Math.round(S.health), loan: Math.round(S.loan) });
  if (S.hist.length > 240) S.hist.shift();
  if (typeof missionMonthly === 'function') missionMonthly();
  if (typeof extrasMonthly === 'function') extrasMonthly();
}
function sumPark() { let s = 0; for (const b of blds.values()) if (b.ok && SERV[b.type].park) s += SERV[b.type].size; return s; }
function tradeCapLeft() { return Math.max(0, T.trade - S.tradeUsed); }
function monthlyTrade() {
  const pm = 1 + tfx('prod'), prod = { food: T.prodI[1] * 0.2 * pm, goods: T.prodI[0] * 0.12 * pm, tech: T.prodI[2] * 0.05 * pm, fuel: 0 };
  const cons = { food: T.pop * 0.02, goods: T.fil[2] * 0.08, tech: T.fil[4] * 0.03, fuel: T.fuelUse };
  const out = { prod, cons, sold: {}, bought: {}, net: 0, contracts: 0 };
  S.short = {};
  for (const g of GOOD_KEYS) { S.stock[g] += prod[g] - cons[g]; out.sold[g] = 0; out.bought[g] = 0; }
  // smlouvy se sousedy
  for (const n of S.nb) { const c = n.contract; if (!c || n.war) continue;
    const q = Math.min(c.q, tradeCapLeft());
    if (c.sell) { const s = Math.min(q, Math.max(0, S.stock[c.g])); S.stock[c.g] -= s; out.net += s * c.price; out.sold[c.g] += s; S.tradeUsed += s; if (s < c.q * 0.8) { n.rel -= 3; note('Město ' + n.name + ' si stěžuje: nedodal jsi smluvené ' + GOODS[c.g].name.toLowerCase() + '.', 'bad'); } else n.rel += 0.6; }
    else { S.stock[c.g] += q; out.net -= q * c.price; out.bought[c.g] += q; S.tradeUsed += q; n.rel += 0.6; }
    if (--c.months <= 0) { n.contract = null; note('Smlouva s městem ' + n.name + ' vypršela.'); }
  }
  for (const g of GOOD_KEYS) {
    if (S.stock[g] < 0) {
      const need = Math.min(-S.stock[g], tradeCapLeft()); S.stock[g] += need; S.tradeUsed += need;
      const c = need * S.price[g] * 1.15; out.net -= c; out.bought[g] += need;
      if (S.stock[g] < -1) { S.short[g] = -S.stock[g]; S.stock[g] = 0; note('Chybí ' + GOODS[g].name.toLowerCase() + ' a dovoz nestačí. Postav nádraží nebo přístav.', 'bad'); }
    }
    if (S.auto[g] === 'sell' && S.stock[g] > S.reserve[g]) { const s = Math.min(S.stock[g] - S.reserve[g], tradeCapLeft()); S.stock[g] -= s; S.tradeUsed += s; out.net += s * S.price[g] * 0.97; out.sold[g] += s; }
    if (S.stock[g] > T.store) { S.stock[g] = T.store; }
  }
  return out;
}
function tradeNow(g, q, buy) {
  q = Math.min(q, tradeCapLeft()); if (q <= 0) return 'Obchodní kapacita na tento měsíc je vyčerpaná.';
  if (buy) { const c = q * S.price[g] * 1.05; if (!canAfford(c)) return 'Nemáš dost peněz.'; spend(c); S.stock[g] = Math.min(T.store, S.stock[g] + q); S.price[g] *= 1 + q / 40000; }
  else { q = Math.min(q, Math.floor(S.stock[g])); if (q <= 0) return 'Ve skladu nic není.'; S.stock[g] -= q; S.money += q * S.price[g] * 0.97; S.price[g] *= 1 - q / 40000; }
  S.tradeUsed += q; return null;
}

// ---------- náhodné události ----------
function monthlyEvents(m) {
  const k = CRK(), pop = T.pop, big = pop > 1500;
  if (!big) return;
  // příroda
  if (m >= 2 && m <= 4 && !S.floodEv && chance(0.12 * k * (S.mission && S.mission.floodK || 1))) startFlood();
  if (chance(0.007 * k)) quake();
  if (m >= 5 && m <= 9 && chance(0.025 * k)) storm();
  if (m >= 5 && m <= 7 && !S.heat && chance(0.09 * k)) { S.heat = 45; note('Vlna veder! Lidé spotřebují víc vody i elektřiny a snadno vzplane požár.', 'bad'); }
  if (!S.epi && chance((0.012 + Math.max(0, 70 - S.health) * 0.001 + (pop > 8000 && T.sCap < pop ? 0.015 : 0)) * k * (S.techs.vaccines ? 0.5 : 1))) startEpidemic();
  if (!S.recession && chance(0.012 * k)) { S.recession = 6; note('Hospodářská krize! Ceny zboží padají a firmy propouštějí.', 'bad'); }
  if (T.cap[3] > 600 && chance(0.02 * k * (S.techs.filters ? 0.6 : 1))) chemical();
  for (const b of blds.values()) if (b.type === 'nuclear' && b.ok && chance(0.0015 * k)) nuclearAccident(b);
  // společnost
  if (chance(0.01 * k * (1 + tfx('scandal')))) scandal();
  const pPr = (1 + tfx('protest')) * Math.max(0, (50 - S.approval) / 55) * (S.pol.noprotest ? 0.25 : 1) * (S.pol.censorship ? 0.6 : 1) * Math.min(1.5, k);
  if (chance(pPr)) startProtest(grievance());
  const taxNow = S.tax.R + S.tax.C + S.tax.I + S.tax.O;
  if (taxNow - S.lastTax >= 3 && chance(0.4)) startProtest('taxes');
  S.lastTax = taxNow;
  if (pop > 2500 && !S.inc.some(i => i.type === 'strike') && chance((0.025 + (S.approval < 45 ? 0.04 : 0) - (S.pol.minwage ? 0.02 : 0)) * k)) {
    const z = chance(0.6) ? 3 : 2; addInc({ type: 'strike', zone: z, x: W.cx, y: W.cy, size: Math.round(T.fil[z] * 0.6), len: 20 + Math.round(Math.random() * 25) });
    note('Stávka! ' + (z === 3 ? 'Továrny' : 'Obchody') + ' stojí, výroba i daně klesají.', 'bad');
  }
  // extremisté
  const pAtt = S.radical / 100 * 0.07 * k * (S.pol.gunlaw ? 0.7 : 1) * (pop > 4000 ? 1 : 0.3);
  if (chance(pAtt)) extremistAttack();
  // armáda
  if (T.army > 0) {
    if (S.armyLoy < 35 && !S.inc.some(i => i.type === 'coupwarn')) { addInc({ type: 'coupwarn', x: W.cx, y: W.cy }); note('V armádě to vře. Důstojníci si stěžují na plat a na vedení města.', 'bad'); }
    if (S.opts.wars && S.armyLoy < 24 && (S.approval < 40 || S.inc.some(i => i.type === 'riot')) && chance(0.2 * Math.min(1.5, k))) coup();
  }
}
function startFlood() {
  S.floodEv = { day: 0, len: 10 + Math.round(Math.random() * 8), sand: false };
  addInc({ type: 'flood', x: W.cx, y: W.cy });
  note('Povodeň! Řeka se vylévá z břehů. Ohrožené je záplavové území.', 'bad');
}
function quake() {
  const mag = 0.6 + Math.random() * 0.8; let lost = 0, n = 0;
  for (let k = 0; k < NN; k++) {
    if (isBuilt(k) && chance(0.035 * mag * (0.5 + lvl[k] * 0.25) * (S.techs.seismic ? 0.4 : 1) * (1 + tfx('quake')))) { lost += destroyTile(k) || 0; n++; if (chance(0.2)) { const j = k + 1; if (j < NN) igniteTile(j, true); } }
  }
  for (const b of blds.values()) if (chance(0.06 * mag * (S.techs.seismic ? 0.4 : 1))) b.off = 30;
  covDirty = true; S.mood -= 3;
  FX.push({ t: 'shake', s: mag });
  addInc({ type: 'quake', x: W.cx, y: W.cy, size: n });
  note('Zemětřesení o síle ' + (4 + mag * 2).toFixed(1).replace('.', ',') + '! Zřícených budov: ' + n + '.', 'bad');
}
function storm() {
  const y0 = Math.random() * N, ang = (Math.random() - 0.5) * 1.2; let n = 0;
  for (let x = 0; x < N; x++) { const yc = Math.round(y0 + Math.tan(ang) * x); for (let y = yc - 1; y <= yc + 1; y++) { if (!inb(x, y)) continue; const k = idx(x, y);
    if (ter[k] === 3 && chance(0.4)) { ter[k] = 0; markDirty(k); }
    if (isBuilt(k) && !dens[k] && chance(0.25 * (1 + tfx('storm')))) { destroyTile(k); n++; } } }
  FX.push({ t: 'storm', y0, ang });
  note('Vichřice prošla městem. Zničených budov: ' + n + '.', 'bad');
}
function startEpidemic() {
  S.epi = { sick: 0.008, imm: 0, dead: 0, campaign: 0 };
  addInc({ type: 'epidemic', x: W.cx, y: W.cy });
  note('Ve městě se šíří nakažlivá nemoc.', 'bad');
}
function epiActions() {
  return [
    { id: 'quarantine', label: S.pol.quarantine ? 'Zrušit karanténu' : 'Vyhlásit karanténu', hint: 'Nemoc se šíří pomaleji, obchody trpí.' },
    { id: 'campaign', label: S.techs.vaccines ? 'Očkovací kampaň' : 'Osvětová kampaň', cost: Math.round(T.pop * 40 + 100000), hint: S.techs.vaccines ? 'Výrazně zbrzdí šíření.' : 'Trochu zbrzdí šíření. S očkováním by to šlo líp.' },
  ];
}
function chemical() {
  const c = []; for (let k = 0; k < NN; k++) if (isBuilt(k) && zone[k] === 3 && lvl[k] >= 2) c.push(k);
  if (!c.length) return; const k = pickOne(c), x = k % N, y = (k / N) | 0;
  S.spills.push({ x, y, until: S.day + 120 }); S.mood -= 3;
  addInc({ type: 'spill', x, y }); FX.push({ t: 'boom', k, small: true });
  note('Havárie v chemičce! Okolí je zamořené.', 'bad', k);
}
function nuclearAccident(b) {
  const cx = b.x + 1, cy = b.y + 1;
  for (let j = cy - 8; j <= cy + 8; j++) for (let i = cx - 8; i <= cx + 8; i++) if (inb(i, j) && Math.hypot(i - cx, j - cy) <= 8) { const k = idx(i, j); if (lvl[k]) { aband[k] = 1; occ[k] = 0; bad[k] = 250; markDirty(k); } }
  b.off = 360; S.mood -= 20; S.spills.push({ x: cx, y: cy, until: S.day + 720 });
  FX.push({ t: 'boom', k: idx(cx, cy) });
  note('Havárie jaderné elektrárny! Okolí bylo evakuováno.', 'bad', idx(cx, cy));
}
function scandal() {
  S.mood -= 6; note('Korupční aféra na radnici! Média píšou o předražených zakázkách.', 'bad');
  ask({ kind: 'scandal', title: 'Korupční aféra', text: 'Novináři zjistili, že úředník stavebního odboru bral úplatky. Jak zareaguješ?',
    opts: [{ id: 'fire', label: 'Odvolat úředníka a zveřejnit smlouvy', hint: 'Důvěra se částečně vrátí.' }, { id: 'deny', label: 'Všechno popřít', hint: 'Může to vyjít, nebo se to provalí ještě víc.' }] });
}
function extremistAttack() {
  if (T.intel > 0 && chance(0.35 + 0.35 * Math.min(1.3, T.intel))) { note('Tajná služba zadržela skupinu extremistů, kteří chystali útok.', 'good'); S.radical = Math.max(0, S.radical - 3); return; }
  const c = []; for (let k = 0; k < NN; k++) if ((isBuilt(k) && (zone[k] === 2 || (zone[k] === 1 && dens[k]))) || (bld[k] && blds.get(bld[k]).type !== 'dike')) c.push(k);
  if (!c.length) return;
  const k = pickOne(c), name = tileName(k), lost = Math.round(10 + Math.random() * 40);
  destroyTile(k, 'byla zničena výbuchem'); igniteTile(k + 1 < NN ? k + 1 : k, true);
  FX.push({ t: 'boom', k });
  S.mood -= 5; S.radical += 3;
  for (let n = 0; n < 20; n++) { const r = (Math.random() * NN) | 0; if (zone[r] === 1 && occ[r] > 2) occ[r] -= lost / 20; }
  addInc({ type: 'aftermath', x: k % N, y: (k / N) | 0 });
  note('Útok extremistů! Výbuch zničil ' + name + ', zahynulo ' + lost + ' lidí.', 'bad', k);
}
function coup() {
  S.pausedFor = 'coup';
  ask({ kind: 'coup', title: 'Pokus o převrat', text: 'Část armády obsadila nádraží a vysílač. Generálové žádají tvé odstoupení a „obnovení pořádku“. Loajalita armády je ' + Math.round(S.armyLoy) + ' %. Policie má ' + fmt(T.officers) + ' lidí.',
    opts: [{ id: 'negotiate', label: 'Vyjednávat s generály', cost: 3000000, hint: 'Vyplatíš je a zvýšíš rozpočet armády. Převrat skončí, svoboda ale utrpí.' },
      { id: 'police', label: 'Postavit se jim s policií', hint: 'Riskantní. Když policie nevydrží, převrat uspěje.' },
      { id: 'people', label: 'Vyzvat lidi do ulic', hint: 'Funguje, když tě lidé podporují. Důvěra je teď ' + Math.round(S.approval) + ' %.' }] });
}
function answer(a, opt) {
  S.asks = S.asks.filter(x => x !== a);
  if (a.kind === 'scandal') { if (opt === 'fire') S.mood += 3; else if (chance(0.5)) { S.mood -= 8; note('Další dokumenty unikly. Lidé jsou rozzlobení.', 'bad'); } else note('Aféra pomalu utichá.'); }
  if (a.kind === 'coup') {
    S.pausedFor = null;
    if (opt === 'negotiate') { if (!canAfford(3000000)) { S.money -= 3000000; } else spend(3000000); S.bud.army = Math.min(150, S.bud.army + 30); S.armyLoy = 55; S.armyGrudge = 0; S.repress += 2; note('Generálové stáhli vojáky za příslib peněz. Převrat byl zažehnán.', ''); }
    else if (opt === 'police') { const p = clamp(T.officers / Math.max(1, S.soldiers * (1 - S.armyLoy / 100)) * 0.5, 0.05, 0.85); if (chance(p)) { S.armyLoy = 50; S.armyGrudge = 0; S.glory = 0; S.soldiers *= 0.6; S.mood += 5; note('Policie ubránila radnici. Vzbouřenci se vzdali.', 'good'); } else return gameOver('coup'); }
    else { const p = clamp((S.approval - 30) / 50, 0.05, 0.9); if (chance(p)) { S.armyLoy = 50; S.armyGrudge = 0; S.mood += 10; note('Tisíce lidí zablokovaly tanky. Vojáci se vrátili do kasáren.', 'good'); } else return gameOver('coup'); }
  }
  if (a.kind === 'ultimatum') {
    const n = S.nb[a.nb];
    if (opt === 'pay') { if (!canAfford(a.sum)) return 'Nemáš dost peněz.'; spend(a.sum); n.rel += 25; S.mood -= 3; note('Zaplatil jsi městu ' + n.name + '. Napětí opadlo.'); }
    else if (opt === 'apologize') { n.rel += 15; S.mood -= 5; note('Veřejná omluva. Doma to někteří berou jako slabost.'); }
    else startWar(a.nb, false);
  }
  if (a.kind === 'peace') { const n = S.nb[a.nb]; if (opt === 'accept') { if (a.sum < 0 && !canAfford(-a.sum)) S.money += a.sum; else S.money += a.sum; endWar(a.nb, a.sum >= 0 ? 'win' : 'loss'); } else note('Odmítl jsi mírovou nabídku. Válka pokračuje.'); }
  if (a.kind === 'election') { if (opt === 'continue') { S.approval = 50; S.mood = 0; S.over = null; } }
  return null;
}
function election() {
  const v = clamp(S.approval + (Math.random() - 0.5) * 8, 0, 100);
  if (v >= 50) { S.stat = S.stat || {}; S.stat.elections = (S.stat.elections || 0) + 1; S.mood += 4; note('Volby: obhájil jsi mandát se ziskem ' + Math.round(v) + ' % hlasů!', 'good'); }
  else gameOver('election', Math.round(v));
}
function gameOver(why, v) {
  S.over = why; if (UIH.over) UIH.over(why, v);
}

// ---------- sousedé a válka ----------
function neighborsMonthly() {
  const k = CRK(), dip = S.techs.diplomacy;
  S.nb.forEach((n, i) => {
    const N0 = NEIGHBORS[i];
    n.rel += (N0.rel - n.rel) * (dip ? 0.05 : 0.025);
    if (n.contract) n.rel += 0.5;
    if (T.army > N0.pop / 200 && N0.aggr > 0.5) n.rel -= 0.4;
    n.rel = clamp(n.rel, -100, 100);
    if (n.war) return;
    if (!S.opts.wars) return;
    if (n.rel < -40 && chance(0.06 * N0.aggr * k)) neighborSabotage(i);
    if (n.rel < -75 && N0.aggr > 0.3 && !S.asks.some(a => a.kind === 'ultimatum') && chance(0.18 * N0.aggr * k)) {
      const sum = Math.round(Math.max(1000000, T.pop * 60) / 100000) * 100000;
      ask({ kind: 'ultimatum', nb: i, sum, title: 'Ultimátum: ' + n.name, text: 'Město ' + n.name + ' obviňuje tvé město z nepřátelství a žádá odškodné ' + money(sum) + '. Jinak hrozí válkou. Jejich armáda má asi ' + fmt(n.strength) + ' vojáků, tvoje ' + fmt(S.soldiers) + '.',
        opts: [{ id: 'pay', label: 'Zaplatit ' + money(sum), hint: 'Napětí opadne.' }, { id: 'apologize', label: 'Veřejně se omluvit', hint: 'Vztahy se zlepší, doma to někoho naštve.' }, { id: 'refuse', label: 'Odmítnout', hint: 'Válka.' }] });
    }
  });
}
function neighborSabotage(i) {
  const n = S.nb[i], found = T.intel > 0 && chance(0.5 + 0.3 * Math.min(1, T.intel));
  const plants = [...blds.values()].filter(b => SERV[b.type].power && b.ok);
  if (plants.length && chance(0.5)) { const b = pickOne(plants); b.off = 20; covDirty = true; FX.push({ t: 'boom', k: idx(b.x, b.y), small: true }); note('Sabotáž! ' + SERV[b.type].name + ' je mimo provoz.' + (found ? ' Tajná služba ukazuje na město ' + n.name + '.' : ''), 'bad', idx(b.x, b.y)); }
  else { S.radical += 4; note('Ve městě se šíří štvavé letáky a falešné zprávy.' + (found ? ' Stojí za tím město ' + n.name + '.' : ''), 'bad'); }
  if (found) n.rel -= 5;
}
function nbAction(i, act) {
  const n = S.nb[i], N0 = NEIGHBORS[i], dip = S.techs.diplomacy ? 1.3 : 1;
  const disc = p => chance(p * (1 - 0.4 * Math.min(1, T.intel)));
  switch (act) {
    case 'gift': if (S.day - n.gift < 180) return 'Dar jsi posílal nedávno.'; if (!canAfford(300000)) return 'Nemáš dost peněz.'; spend(300000); n.rel += 8 * dip; n.gift = S.day; note('Dar městu ' + n.name + ' potěšil.', 'good'); break;
    case 'visit': if (S.day - n.visit < 90) return 'Návštěva byla nedávno.'; if (!canAfford(60000)) return 'Nemáš dost peněz.'; spend(60000); n.rel += 3 * dip; n.visit = S.day; note('Přátelská návštěva ve městě ' + n.name + '.', 'good'); break;
    case 'insult': n.rel -= 15; S.mood += 1; note('Ostrá diplomatická nóta městu ' + n.name + '. Doma potlesk, u sousedů pobouření.'); break;
    case 'propaganda': if (!T.intel) return 'Potřebuješ tajnou službu.'; if (!canAfford(200000)) return 'Nemáš dost peněz.'; spend(200000); if (n.war) n.strength *= 0.92; if (disc(0.3)) { n.rel -= 25; note('Město ' + n.name + ' odhalilo tvou propagandu!', 'bad'); } else note('Propaganda ve městě ' + n.name + ' běží nenápadně.'); break;
    case 'sabotage': if (!T.intel) return 'Potřebuješ tajnou službu.'; if (!canAfford(600000)) return 'Nemáš dost peněz.'; spend(600000);
      if (n.war) n.strength *= 0.8; else S.priceBoost = { g: 'goods', until: S.day + 120 };
      if (disc(0.4)) { n.rel -= 35; note('Sabotáž ve městě ' + n.name + ' byla odhalena!', 'bad'); } else note('Sabotáž ve městě ' + n.name + ' se povedla. ' + (n.war ? 'Jejich armáda je oslabená.' : 'Jejich továrny stojí a ceny zboží porostou.'), 'good'); break;
    case 'burn': if (!T.intel) return 'Potřebuješ tajnou službu.'; if (!canAfford(1200000)) return 'Nemáš dost peněz.'; spend(1200000);
      n.strength *= 0.85;
      if (disc(0.45)) { n.rel -= 70; note('Agenti byli dopadeni při zapalování radnice ve městě ' + n.name + '! Sousedé zuří.', 'bad'); if (S.opts.wars && N0.aggr > 0.3 && n.rel < -60 && chance(0.6)) startWar(i, true); }
      else { n.rel -= 5; note('Radnice ve městě ' + n.name + ' lehla popelem. Viní z toho místní radikály, ale něco tuší.'); } break;
    case 'war': if (!S.opts.wars) return 'Války jsou v nastavení vypnuté.'; if (n.rel > -30) return 'Vztahy nejsou tak špatné, aby lidé válku pochopili.'; startWar(i, false); S.mood -= 4; break;
    case 'peace': { if (!n.war) return null; const w = n.war; const sum = Math.round(w.score * 40000);
      if (w.score > 15 || chance(0.25 + n.wear * 0.4)) { endWar(i, w.score >= 0 ? 'win' : 'draw'); if (sum > 0) S.money += sum; }
      else { const pay = Math.round(Math.max(500000, -sum) / 100000) * 100000; ask({ kind: 'peace', nb: i, sum: -pay, title: 'Mírové podmínky', text: 'Město ' + n.name + ' přijme mír, když zaplatíš ' + money(pay) + '.', opts: [{ id: 'accept', label: 'Přijmout a zaplatit' }, { id: 'reject', label: 'Odmítnout' }] }); }
      break; }
    case 'counter': { if (!n.war) return null; const ours = S.soldiers * 0.4 * budF('army') * (0.5 + S.armyLoy / 200);
      if (ours < 20) return 'Na protiútok nemáš dost vojáků.';
      const win = chance(clamp(ours / (n.strength * 0.5 + 1), 0.1, 0.85));
      if (win) { n.strength *= 0.7; n.war.score += 15; S.soldiers -= ours * 0.15; S.glory += 4; n.wear += 0.2; note('Protiútok na město ' + n.name + ' uspěl! Jejich armáda ustupuje.', 'good'); }
      else { S.soldiers -= ours * 0.4; n.war.score -= 10; S.mood -= 3; note('Protiútok selhal a stál mnoho životů.', 'bad'); }
      break; }
    case 'contract': return 'Použij formulář smlouvy.';
  }
  n.rel = clamp(n.rel, -100, 100);
  return null;
}
function signContract(i, g, sell, q) {
  const n = S.nb[i]; if (n.war) return 'S nepřítelem obchodovat nejde.'; if (n.rel < -20) return 'Město ' + n.name + ' s tebou nechce obchodovat.';
  n.contract = { g, sell, q, price: Math.round(S.price[g] * (sell ? 1.06 : 0.94)), months: 12 };
  n.rel += 6; note('Smlouva s městem ' + n.name + ': ' + (sell ? 'prodej' : 'nákup') + ' ' + q + ' ' + GOODS[g].unit + ' ' + GOODS[g].name.toLowerCase() + ' měsíčně za ' + money(n.contract.price) + '/' + GOODS[g].unit + '.', 'good');
  return null;
}
function startWar(i, theyStarted) {
  const n = S.nb[i]; if (n.war) return;
  n.war = { day: S.day, score: 0, next: S.day + 12 + Math.round(Math.random() * 10), start: n.strength }; n.contract = null; n.wear = 0; S.mood += 3;
  note((theyStarted ? 'Město ' + n.name + ' vyhlásilo tvému městu válku!' : 'Vyhlásil jsi válku městu ' + n.name + '.') + ' Hlídej si armádu.', 'bad');
}
function endWar(i, res) {
  const n = S.nb[i]; n.war = null; n.rel = -20; n.strength = Math.round(NEIGHBORS[i].pop / 300 * 0.8);
  S.inc = S.inc.filter(x => !(x.type === 'assault' && x.nb === i));
  if (res === 'win') { S.glory += 8; S.mood += 6; note('Mír s městem ' + n.name + '. Válku jsi vyhrál.', 'good'); }
  else if (res === 'loss') { S.mood -= 4; note('Mír s městem ' + n.name + ' za vysokou cenu.', 'bad'); }
  else note('Mír s městem ' + n.name + '.', 'good');
}
function warDay() {
  S.nb.forEach((n, i) => {
    const w = n.war; if (!w) return;
    if (S.day >= w.next && !S.inc.some(x => x.type === 'assault' && x.nb === i)) {
      const men = Math.round(n.strength * (0.15 + Math.random() * 0.15));
      const t = warTarget();
      const side = NEIGHBORS[i].side;
      addInc({ type: 'assault', nb: i, x: t.x, y: t.y, size: men, side, eta: S.day + 5 });
      note('Město ' + n.name + ' posílá na tebe ' + fmt(men) + ' vojáků. Dorazí za 5 dní.', 'bad', idx(t.x, t.y));
      w.next = S.day + 18 + Math.round(Math.random() * 20);
    }
    for (const a of S.inc.filter(x => x.type === 'assault' && x.nb === i && S.day >= x.eta)) battle(a, n);
    n.wear += 0.004;
    if ((n.strength < w.start * 0.35 || n.wear > 1.2) && !S.asks.some(a => a.kind === 'peace')) {
      const sum = Math.round(Math.max(0, w.score) * 40000 / 100000) * 100000;
      ask({ kind: 'peace', nb: i, sum, title: 'Nabídka míru', text: 'Město ' + n.name + ' nabízí mír' + (sum > 0 ? ' a odškodné ' + money(sum) : '') + '.', opts: [{ id: 'accept', label: 'Přijmout mír' }, { id: 'reject', label: 'Bojovat dál' }] });
      n.wear = 0.6;
    }
  });
}
function warTarget() {
  const c = [...blds.values()].filter(b => b.type !== 'dike');
  if (c.length && chance(0.6)) { const b = pickOne(c); return { x: b.x, y: b.y }; }
  return { x: W.cx + Math.round((Math.random() - 0.5) * 16), y: W.cy + Math.round((Math.random() - 0.5) * 16) };
}
function battle(a, n) {
  endInc(a);
  const def = S.soldiers * budF('army') * (1 + tfx('army')) * (0.4 + S.armyLoy / 160) * (a.intercept ? 1.25 : 0.9) + T.officers * 0.25;
  const k = idx(a.x, a.y);
  FX.push({ t: 'battle', k });
  if (def * (0.7 + Math.random() * 0.6) > a.size) {
    n.strength -= a.size * 0.6; S.soldiers = Math.max(0, S.soldiers - a.size * 0.2); n.war.score += 8; S.glory += 2; n.wear += 0.12;
    note('Útok odražen! Nepřítel ztratil ' + fmt(a.size * 0.6) + ' vojáků.', 'good', k);
  } else {
    let d = 0; for (let t = 0; t < 6; t++) { const kk = randomNear(a.x, a.y, 3, kk => lvl[kk] || bld[kk]); if (kk >= 0) { destroyTile(kk, 'byla zničena při útoku'); d++; } }
    S.soldiers = Math.max(0, S.soldiers - a.size * 0.3); n.strength -= a.size * 0.25; n.war.score -= 12; S.mood -= 4;
    for (let t = 0; t < 2; t++) { const kk = randomNear(a.x, a.y, 3, kk => lvl[kk]); if (kk >= 0) igniteTile(kk, true); }
    note('Nepřítel prorazil obranu. Zničených budov: ' + d + '.', 'bad', k);
  }
  n.strength = Math.max(10, n.strength);
}

// ---------- rádce ----------
function advisor() {
  const tip = (key, text, every) => { if (S.day - (S.tips[key] || -9999) < (every || 180)) return; S.tips[key] = S.day; note(text, 'tip'); };
  let zt = 0, zNoAcc = 0; for (let k = 0; k < NN; k++) if (zone[k]) { zt++; if (!acc[k]) zNoAcc++; }
  if (zt && !T.pCap) tip('nopower', 'Zóny čekají na elektřinu. Postav elektrárnu u silnice (záložka Energie).', 45);
  if (zt && !T.wCap) tip('nowater', 'Zóny čekají na vodu. Postav vodárnu u silnice (záložka Voda a odpad).', 45);
  if (zNoAcc > zt * 0.3 && zt > 8) tip('noroad', 'Část zón je daleko od silnice napojené na dálnici. Parcela musí mít silnici nejvýš dvě políčka daleko.', 60);
  if (T.pDem > T.pCap * 0.95 && T.pDem > 0) tip('power', 'Elektřiny je málo. Postav další elektrárnu, než začnou výpadky.', 90);
  if (T.wDem > T.wCap * 0.95 && T.wDem > 0) tip('water', 'Vody je málo. Postav další vodárnu.', 90);
  const rsv = T.railSv;
  if (rsv && rsv.avail.reg && !(S.rail.reg > 0)) tip('rail0', 'Nádraží stojí u trati, ale nejezdí sem vlaky. Nastav osobní vlaky v záložce Železnice.', 120);
  if (rsv && rsv.avail.fr && !(S.rail.fr > 0) && T.trade < 3000) tip('railfr', 'Máš nákladové nádraží bez vlaků. Nákladní vlaky zvednou obchodní kapacitu (záložka Železnice).', 150);
  if (T.railCrowd > 1.2) tip('railcrowd', 'Vlaky jsou přeplněné. Přidej osobní vlaky v záložce Železnice.', 120);
  if (rsv && rsv.total > rsv.cap) tip('depot', 'Na všechny vlaky nestačí depa. Postav železniční depo, jinak část spojů nevyjede.', 120);
  if (T.gDem > T.gCap && T.pop > 300) tip('garbage', 'Odpadky se hromadí. Město potřebuje skládku.');
  if (T.unemp > 0.12) tip('unemp', 'Hodně lidí je bez práce. Vyznač průmysl, obchody nebo kanceláře.');
  if (T.dem[1] > 0.5 && T.pop > 100) tip('housing', 'Lidé chtějí bydlet ve tvém městě. Vyznač další zóny bydlení.');
  if (S.crime > 35) tip('crime', 'Kriminalita roste. Postav služebny nebo zvyš rozpočet policie.');
  if (T.traffic > 1.1) tip('traffic', 'Silnice jsou ucpané. Pomůže MHD, metro nebo víc souběžných ulic.');
  if (S.radical > 40) tip('radical', 'Radikálů přibývá. Pomáhá práce, vzdělání, integrační programy a tajná služba.');
  if (S.money < 0) tip('money', 'Pokladna je v mínusu. Zvyš daně, uber výdaje nebo si vezmi úvěr.', 60);
  if (!S.research && Object.keys(S.techs).length < Object.keys(TECHS).length) tip('research', 'Výzkum stojí. V záložce Rozvoj vyber, co se má zkoumat, nebo otevři strom výzkumu.', 120);
}

// ---------- výzkum ----------
function researchRate() { return (T.rp + (T.rpGov || 0) + (T.pop || 0) / 2500 + T.fil[4] * 0.003 + (S.resFund || 0) / 40000) * (1 + tfx('research')); }
function techState(id) { if (S.techs[id]) return 'done'; if (S.research === id) return 'cur'; if ((S.rq || []).includes(id)) return 'queued'; return TECHS[id].req.every(r => S.techs[r]) ? 'open' : 'locked'; }
// zařadí výzkum do fronty i s chybějícími předpoklady ve správném pořadí
function queueTech(id, first) {
  S.rq = S.rq || [];
  const order = [], seen = new Set();
  const visit = t => { if (seen.has(t) || S.techs[t]) return; seen.add(t); for (const r of TECHS[t].req) visit(r); order.push(t); };
  visit(id);
  const add = order.filter(t => t !== S.research);
  S.rq = S.rq.filter(t => !add.includes(t));
  if (first) { if (S.research && !add.includes(S.research)) S.rq.unshift(S.research); S.research = null; S.rq = add.concat(S.rq); }
  else S.rq = S.rq.concat(add);
  if (!S.research && S.rq.length) S.research = S.rq.shift();
  return null;
}
function unqueueTech(id) { S.rq = (S.rq || []).filter(t => t !== id); if (S.research === id) S.research = S.rq.shift() || null; }

// ---------- rozhodnutí vedení ----------
function setResearch(id) { if (S.techs[id]) return 'Už vyzkoumáno.'; return queueTech(id, true); }
const UNPOPULAR = { curfew: 0.5, censorship: 0.45, noprotest: 0.45, cameras: 0.25, gunlaw: 0.15, quarantine: 0.2 };
function togglePolicy(id) {
  const p = POLICIES[id]; if (p.req && !S.techs[p.req]) return 'Nejdřív vyzkoumej: ' + TECHS[p.req].name + '.';
  S.pol[id] = !S.pol[id];
  if (S.pol[id] && UNPOPULAR[id] && T.pop > 1500 && chance(UNPOPULAR[id] * (S.pol.noprotest && id !== 'noprotest' ? 0.3 : 1))) startProtest('policy', id);
  if (!S.pol[id] && UNPOPULAR[id]) S.mood += 1;
  return null;
}
function takeLoan(sum) { if (S.loan + sum > 60000000) return 'Banka ti už víc nepůjčí.'; S.loan += sum; S.money += sum; note('Úvěr ' + money(sum) + ' připsán. Úrok ' + (S.techs.banking ? '0,5' : '0,8') + ' % měsíčně.'); return null; }
function repayLoan(sum) { sum = Math.min(sum, S.loan); if (!canAfford(sum)) return 'Nemáš dost peněz.'; S.loan -= sum; S.money -= sum; return null; }
function martialLaw() {
  if (!T.army) return 'Ve městě není vojenská základna.';
  if (S.martial > 0) { S.martial = 0; note('Armáda se stahuje z ulic.'); return null; }
  S.martial = 30; S.repress += 2; S.armyGrudge += 3; S.mood -= 2;
  FX.push({ t: 'army', k: idx(W.cx, W.cy) });
  note('Vojáci hlídkují v ulicích. Kriminalita a nepokoje rychle slábnou, svoboda trpí.');
  if (T.pop > 1500 && chance(0.35)) startProtest('repression');
  return null;
}

// ---------- uložení ----------
const b64 = a => { let s = ''; const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); };
const unb64 = (s, A) => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new A(u.buffer); };
// úsporné uložení: řídká pole se komprimují (RLE), plovoucí čísla se zaokrouhlí
function rle(a) { const out = []; for (let i = 0; i < a.length;) { const v = a[i]; let n = 1; while (i + n < a.length && a[i + n] === v && n < 255) n++; out.push(v, n); i += n; } return Uint8Array.from(out); }
function unrle(r, len) { const a = new Uint8Array(len); let o = 0; for (let i = 0; i + 1 < r.length; i += 2) { a.fill(r[i], o, o + r[i + 1]); o += r[i + 1]; } return a; }
function packU8(a) { const r = rle(a); return r.length < a.length ? { r: b64(r) } : b64(a); }
function unpackU8(v, len) { return typeof v === 'string' ? unb64(v, Uint8Array) : unrle(unb64(v.r, Uint8Array), len); }
const QSCALE = { eduT: 250, lv: 2, poll: 2, crime: 2, hap: 2 };
function saveGame() {
  const t = {}; for (const k in TILE_ARRAYS) t[k] = packU8(TILE_ARRAYS[k]);
  const q = {};
  const o16 = new Uint16Array(NN); for (let k = 0; k < NN; k++) o16[k] = clamp(Math.round(occ[k]), 0, 65535); q.occ = packU8(new Uint8Array(o16.buffer));
  for (const k in QSCALE) { const src = FLOAT_ARRAYS[k], u = new Uint8Array(NN); for (let i = 0; i < NN; i++) u[i] = clamp(Math.round(src[i] * QSCALE[k]), 0, 255); q[k] = packU8(u); }
  const bl = [...blds.values()].map(b => { const c = Object.assign({}, b); delete c.rt; delete c.pax; delete c.catch; delete c.sf; return c; });
  return { fmt: 2, S: JSON.parse(JSON.stringify(S)), t, q, blds: bl, nextBid, W: Object.assign({}, W), saved: Date.now(), pop: Math.round(T.pop || 0) };
}
function loadGame(sv) {
  if (!sv || !sv.S || !sv.t || !sv.blds) throw new Error('Neplatná uložená hra');
  for (const k in TILE_ARRAYS) { if (sv.t[k]) TILE_ARRAYS[k].set(unpackU8(sv.t[k], NN)); else TILE_ARRAYS[k].fill(k === 'sty' ? 1 : 0); }
  if (sv.q) {
    const ob = unpackU8(sv.q.occ, NN * 2), o16 = new Uint16Array(ob.buffer, 0, NN); for (let k = 0; k < NN; k++) occ[k] = o16[k];
    for (const k in QSCALE) { const u = sv.q[k] ? unpackU8(sv.q[k], NN) : new Uint8Array(NN); for (let i = 0; i < NN; i++) FLOAT_ARRAYS[k][i] = u[i] / QSCALE[k]; }
  } else for (const k in FLOAT_ARRAYS) FLOAT_ARRAYS[k].set(unb64(sv.f[k], Float32Array));
  blds.clear(); bld.fill(0);
  for (const b of sv.blds) { blds.set(b.id, b); for (let j = b.y; j < b.y + b.size; j++) for (let i = b.x; i < b.x + b.size; i++) bld[idx(i, j)] = b.id; }
  nextBid = sv.nextBid; Object.assign(W, sv.W);
  for (const k in S) delete S[k]; Object.assign(S, sv.S); S.rq = S.rq || []; S.resFund = S.resFund || 0; for (const t in S.techs) if (!TECHS[t]) delete S.techs[t]; if (S.research && !TECHS[S.research]) S.research = null; fxReset();
  S.rail = Object.assign(RAIL_DEF(), S.rail || {}); if (S.bud.rail == null) S.bud.rail = 100;
  if (!sv.t.rail) { S.legacyRail = true; if ([...blds.values()].some(b => b.type === 'station')) S.rail.fr = Math.max(S.rail.fr, 3); }
  railDirty = true;
  computeWaterDist(); connDirty = true; covDirty = true; analysis();
}
