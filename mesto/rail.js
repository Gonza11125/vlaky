'use strict';
// Železnice: síť tratí, nádraží, vlakové spoje, jízdné, dojížďka, nákladní doprava, nehody a stávky.

let railDirty = true;
const railComp = new Int32Array(NN).fill(-1);
let railComps = [];
const RAIL_DEF = () => ({ reg: 0, ic: 0, fr: 0, hs: 0, fare: 30, strike: 0, acc: 0, accY: 0, pax: 0, tons: 0, stats: null });

function maskOf(arr, x, y) { let m = 0; if (y > 0 && arr[idx(x, y - 1)]) m |= 1; if (x < N - 1 && arr[idx(x + 1, y)]) m |= 2; if (y < N - 1 && arr[idx(x, y + 1)]) m |= 4; if (x > 0 && arr[idx(x - 1, y)]) m |= 8; return m; }
function railAround(x, y, s) {
  const out = [];
  for (let i = x; i < x + s; i++) for (const j of [y - 1, y + s]) if (inb(i, j) && rail[idx(i, j)]) out.push(idx(i, j));
  for (let j = y; j < y + s; j++) for (const i of [x - 1, x + s]) if (inb(i, j) && rail[idx(i, j)]) out.push(idx(i, j));
  return out;
}
const isCrossing = k => rail[k] && road[k];

// ---------- síť: souvislé úseky, napojení na okraj mapy, stanice ----------
function computeRailNet() {
  railComp.fill(-1); railComps = [];
  for (let s = 0; s < NN; s++) {
    if (!rail[s] || railDmg[s] || railComp[s] >= 0) continue;
    const c = { id: railComps.length, tiles: 0, edge: false, elec: 0, hs: 0, edges: [], pass: [], main: [], freight: [], depots: [] };
    const q = [s]; railComp[s] = c.id;
    while (q.length) {
      const k = q.pop(), x = k % N, y = (k / N) | 0; c.tiles++;
      if (RAILS[rail[k]].elec) c.elec++; if (rail[k] === 3) c.hs++;
      if (x === 0 || y === 0 || x === N - 1 || y === N - 1) { c.edge = true; c.edges.push(k); }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const n = idx(nx, ny); if (rail[n] && !railDmg[n] && railComp[n] < 0) { railComp[n] = c.id; q.push(n); } }
    }
    railComps.push(c);
  }
  for (const b of blds.values()) {
    const d = SERV[b.type]; if (!d.rail) continue;
    const t = railAround(b.x, b.y, b.size).filter(k => railComp[k] >= 0);
    b.rc = t.length ? railComp[t[0]] : -1; b.rt = t;
    if (b.rc < 0) continue; const c = railComps[b.rc];
    if (d.rail === 'pass') { c.pass.push(b); if (d.main) c.main.push(b); } else if (d.rail === 'freight') c.freight.push(b); else if (d.rail === 'depot') c.depots.push(b);
  }
}
// stanice funguje, když je u trati a trať někam vede (na okraj mapy nebo k jiné stanici)
function railBuildingOk(b) {
  const d = SERV[b.type]; if (!d.rail) return true;
  if (S.legacyRail && b.type === 'station') return true;
  if (b.rc == null || b.rc < 0) return false;
  const c = railComps[b.rc]; if (!c) return false;
  if (d.rail === 'pass') return c.edge || c.pass.length >= 2;
  if (d.rail === 'freight') return c.edge;
  return true;
}

// ---------- spoje: kolik vlaků opravdu jezdí ----------
function railService() {
  const R = S.rail || RAIL_DEF(), ok = b => b.ok;
  const any = (f) => railComps.some(f);
  const passNet = any(c => c.pass.some(ok) && (c.edge || c.pass.filter(ok).length >= 2));
  const mainNet = any(c => c.edge && c.main.some(ok));
  const frNet = any(c => c.edge && c.freight.some(ok)) || (S.legacyRail && [...blds.values()].some(b => b.type === 'station' && b.ok));
  const hsNet = any(c => c.edge && c.main.some(ok) && c.hs >= 8);
  const avail = { reg: passNet, ic: mainNet && !!S.techs.intercity, fr: frNet, hs: hsNet && !!S.techs.hsr };
  const depots = [...blds.values()].filter(b => b.type === 'depot' && b.ok).length, cap = RAIL_BASE_CAP + depots * SERV.depot.trains;
  const want = {}; let tot = 0; for (const t in TRAINS) { want[t] = avail[t] ? Math.max(0, R[t] || 0) : 0; tot += want[t]; }
  const f = tot > cap ? cap / tot : 1, eff = {};
  for (const t in TRAINS) eff[t] = R.strike > 0 ? 0 : Math.floor(want[t] * f + 1e-6);
  // elektrizace: podíl elektrizovaných kolejí v síti se stanicemi
  let el = 0, all = 0; for (const c of railComps) if (c.pass.length || c.freight.length) { el += c.elec; all += c.tiles; }
  const elec = all ? el / all : 0;
  return { avail, eff, cap, depots, total: tot, elec, electric: elec >= 0.7 };
}
const fareF = () => clamp(1.4 - (S.rail ? S.rail.fare : 30) / 50, 0.25, 1.3);
function serviceF(nTrains) { return 1 - Math.exp(-nTrains / 2.5); }

// příspěvek železnice k pokrytí MHD (volá computeCoverage)
function railCoverage() {
  const sv = railService(); T.railSv = sv;
  const rk = (1 + tfx('railRange')) * Math.sqrt(budF('rail'));
  for (const b of blds.values()) {
    const d = SERV[b.type]; if (d.rail !== 'pass' || !b.ok) continue;
    const c = railComps[b.rc], sf = c && (c.edge || c.pass.length >= 2) ? Math.min(1, serviceF(sv.eff.reg) + (d.main ? (sv.eff.ic * 0.08 + sv.eff.hs * 0.12) : 0)) : 0;
    b.sf = sf;
    if (sf <= 0.01) continue;
    const r = d.r * rk, str = Math.min(1.2, d.pax * 0.75 * sf * (0.6 + 0.4 * fareF()) * (1 + tfx('railRide') * 0.5));
    const cx = b.x + b.size / 2 - 0.5, cy = b.y + b.size / 2 - 0.5, RR = Math.ceil(r + b.size);
    for (let y = Math.max(0, Math.floor(cy - RR)); y <= Math.min(N - 1, Math.ceil(cy + RR)); y++) for (let x = Math.max(0, Math.floor(cx - RR)); x <= Math.min(N - 1, Math.ceil(cx + RR)); x++) {
      const dd = Math.max(0, Math.hypot(x - cx, y - cy) - b.size / 2); if (dd > r) continue;
      const v = str * Math.pow(1 - dd / r, 0.6), k = idx(x, y); if (v > cov.transit[k]) cov.transit[k] = v;
    }
  }
}

// rozbor každých 5 dní: cestující, dojížďka, náklad, vliv na poptávku, hluk a znečištění
function railAnalysis() {
  const sv = T.railSv || railService(); T.railSv = sv;
  const rr = 1 + tfx('railRide'), ff = fareF(), winter = monthOf(S.day) === 11 || monthOf(S.day) <= 1;
  let pax = 0, ext = 0; const st = [];
  for (const b of blds.values()) {
    const d = SERV[b.type]; if (d.rail !== 'pass') continue;
    if (!b.ok || !b.sf) { b.pax = 0; st.push(b); continue; }
    const r = d.r * (1 + tfx('railRange')), cx = b.x + b.size / 2 - 0.5, cy = b.y + b.size / 2 - 0.5; let res = 0, job = 0;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(N - 1, Math.ceil(cy + r)); y++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(N - 1, Math.ceil(cx + r)); x++) {
      const k = idx(x, y); if (!lvl[k] || aband[k]) continue; const dd = Math.hypot(x - cx, y - cy); if (dd > r) continue; const w = 1 - dd / r;
      if (zone[k] === 1) res += occ[k] * w; else job += occ[k] * w;
    }
    const c = railComps[b.rc], toWorld = c && c.edge;
    b.catch = Math.round(res);
    b.pax = Math.round((res + job * 0.5) * 0.06 * d.pax * b.sf * ff * rr * (winter ? 0.9 : 1) * 30);
    pax += b.pax;
    if (toWorld) ext += res * 0.14 * b.sf * Math.min(1.2, ff + 0.2) * rr;
    st.push(b);
  }
  // kapacita vlaků: přeplněné spoje odradí část cestujících
  const capP = sv.eff.reg * 7000 + sv.eff.ic * 3000 + sv.eff.hs * 5000;
  T.railCrowd = capP ? pax / capP : 0;
  if (pax > capP) { const f = capP / pax; for (const b of st) b.pax = Math.round((b.pax || 0) * f); ext *= 0.5 + 0.5 * f; pax = capP; }
  T.railPax = pax; T.railStations = st;
  T.extJobs = Math.min(ext, T.pop * 0.25) * (sv.eff.reg > 0 ? 1 : 0);
  // dálkové spoje a náklad
  T.railTour = (sv.eff.ic ? 1.5 + sv.eff.ic * 0.5 : 0) + (sv.eff.hs ? 3 + sv.eff.hs : 0);
  T.railDem = { 2: (sv.eff.ic ? 0.04 : 0) + (sv.eff.hs ? 0.05 : 0), 3: Math.min(0.15, sv.eff.fr * 0.03), 4: (sv.eff.ic ? 0.06 : 0) + (sv.eff.hs ? 0.12 : 0) };
  let fcap = 0; for (const b of blds.values()) if (SERV[b.type].rail === 'freight' && b.ok) fcap += SERV[b.type].freight;
  T.railTrade = Math.min(fcap, sv.eff.fr * 1500);
  T.railDiesel = sv.electric ? 0 : sv.eff.reg + sv.eff.fr;
  // obsazenost vlaků pro grafiku (0–1)
  T.railLoad = clamp(pax / Math.max(1, sv.eff.reg * 9000), 0.05, 1);
}
// vliv tratí na cenu pozemků (hluk) a nádraží (dostupnost); volá výpočet ceny pozemků
function railLand(out) {
  const sv = T.railSv; const busy = sv ? sv.eff.reg + sv.eff.fr + sv.eff.ic + sv.eff.hs : 0;
  for (let k = 0; k < NN; k++) { if (!rail[k]) continue; const x = k % N, y = (k / N) | 0, hs = rail[k] === 3, r = hs ? 2 : 1, pen = (hs ? 6 : RAILS[rail[k]].elec ? 2 : 3) * (busy ? 1 : 0.4);
    for (let j = y - r; j <= y + r; j++) for (let i = x - r; i <= x + r; i++) if (inb(i, j)) { const t = idx(i, j); out[t] = Math.min(out[t], -pen); } }
  for (const b of blds.values()) { const d = SERV[b.type]; if (d.rail !== 'pass' || !b.ok || !b.sf) continue; const cx = b.x + b.size / 2 - 0.5, cy = b.y + b.size / 2 - 0.5, r = d.r * 0.5;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(N - 1, Math.ceil(cy + r)); y++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(N - 1, Math.ceil(cx + r)); x++) { const t = idx(x, y), dd = Math.hypot(x - cx, y - cy); if (dd <= r) out[t] += 8 * b.sf * (1 - dd / r) * (d.main ? 1.4 : 1); } }
}

// ---------- měsíční účet železnice ----------
function railMonth() {
  const sv = T.railSv || railService(), R = S.rail, rc = 1 + tfx('railCost');
  // státní trať platí Správa železnic, město jen tratě, které samo postavilo
  let track = 0; for (let k = 0; k < NN; k++) if (rail[k] && !railSt[k]) track += RAILS[rail[k]].up * (ter[k] === 1 ? 3 : 1);
  const ops = {}; let opsT = 0;
  for (const t in TRAINS) { ops[t] = sv.eff[t] * (sv.electric ? TRAINS[t].costE : TRAINS[t].cost) * rc * (0.8 + 0.2 * budF('rail')); opsT += ops[t]; }
  const fares = (T.railPax || 0) * R.fare * 0.5;   // polovina jízdného připadá dopravci
  const longFares = sv.eff.ic * 55000 * fareF() * (1 + tfx('railRide')) + sv.eff.hs * 160000 * fareF() * (1 + tfx('railRide'));
  const freightFees = sv.eff.fr * 38000;
  const sub = ops.reg * (T.pop < 3000 ? 0.85 : 0.6);   // osobní vlaky objednává kraj
  R.pax = Math.round(T.railPax || 0); R.tons = Math.round(T.railTrade || 0);
  R.stats = { track: Math.round(track), ops: Math.round(opsT), opsBy: ops, fares: Math.round(fares + longFares), freight: Math.round(freightFees), sub: Math.round(sub) };
  return { cost: track + opsT, inc: fares + longFares + freightFees, sub };
}

// ---------- denní provoz: opravy, nehody, povodně, sabotáže ----------
function railDay() {
  const R = S.rail; if (!R) return;
  const bf = budF('rail');
  let fixed = false;
  for (let k = 0; k < NN; k++) {
    if (!rail[k]) continue;
    if (railDmg[k] && chance(0.55 + 0.45 * bf)) { if (--railDmg[k] === 0) { fixed = true; markDirty(k); } }
    if (flood[k] && !railDmg[k] && chance(0.08)) { railDmg[k] = 20 + ((k * 7) % 15); railDirty = true; markDirty(k); }
  }
  if (fixed) { railDirty = true; note('Trať je opravená, vlaky jezdí.', 'good'); }
  if (R.strike > 0 && --R.strike === 0) { covDirty = true; note('Stávka železničářů skončila, vlaky zase jezdí.', 'good'); const i = S.inc.find(i => i.type === 'railstrike'); if (i) endInc(i); }
  for (const i of S.inc.slice()) if (i.type === 'derail' && S.day - i.day > 40) endInc(i);
  const sv = T.railSv; if (!sv) return;
  const trains = sv.eff.reg + sv.eff.ic + sv.eff.fr + sv.eff.hs; if (!trains) return;
  // vykolejení
  const pd = trains * 0.00017 * Math.pow(2 - bf, 2) * Math.max(0.15, 1 + tfx('railSafe')) * CRK();
  if (chance(pd)) derail(sv, false);
  else if (S.radical > 45 && chance(0.0004 * CRK())) derail(sv, true);
  // přejezdy
  const crossK = 0.00008 * (sv.eff.reg + sv.eff.fr + sv.eff.ic) / 4 * Math.max(0.1, 1 + tfx('crossSafe')) * CRK();
  for (let k = 0; k < NN; k++) if (isCrossing(k) && chance(crossK * (traf[k] + 0.3))) {
    R.acc++; R.accY++; S.mood -= 1.5; FX.push({ t: 'boom', k, small: true }); FX.push({ t: 'crash', k });
    note('Na přejezdu se srazil vlak s autem. ' + (S.techs.crossings ? 'Řidič přejel závory.' : 'Přejezd nemá závory, lidé chtějí zabezpečení.'), 'bad', k);
    break;
  }
}
function derail(sv, sabotage) {
  const cand = []; for (let k = 0; k < NN; k++) if (rail[k] && !railDmg[k] && railComp[k] >= 0 && !road[k]) cand.push(k);
  if (!cand.length) return;
  const k = pickOne(cand), x = k % N, y = (k / N) | 0, horiz = (maskOf(rail, x, y) & 10) !== 0;
  const n = 3 + ((Math.random() * 4) | 0);
  for (let i = -1; i < n - 1; i++) { const xx = horiz ? x + i : x, yy = horiz ? y : y + i; if (inb(xx, yy) && rail[idx(xx, yy)]) { railDmg[idx(xx, yy)] = 25 + ((Math.random() * 20) | 0); markDirty(idx(xx, yy)); } }
  railDirty = true; covDirty = true;
  const freight = sv.eff.fr > 0 && Math.random() < sv.eff.fr / Math.max(1, sv.eff.fr + sv.eff.reg + sv.eff.ic);
  S.rail.acc++; S.rail.accY++;
  FX.push({ t: 'boom', k, small: !freight }); FX.push({ t: 'derail', k, horiz });
  if (freight && Math.random() < 0.4) { S.spills.push({ x, y, until: S.day + 120 }); addInc({ type: 'spill', x, y }); }
  S.mood -= freight ? 2 : 5;
  addInc({ type: 'derail', x, y, freight, sabotage });
  note(sabotage ? 'Sabotáž! Extremisté poškodili trať a vlak vykolejil.' : freight ? 'Vykolejil nákladní vlak. Trať je zavřená.' : 'Vykolejil osobní vlak! Jsou zranění, trať je zavřená.', 'bad', k);
}
function railMonthlyEvents() {
  const R = S.rail; if (!R) return;
  if (monthOf(S.day) === 0) R.accY = 0;
  const sv = T.railSv; if (!sv || !(sv.eff.reg + sv.eff.fr + sv.eff.ic) || R.strike > 0) return;
  const p = 0.015 + Math.max(0, 100 - S.bud.rail) * 0.0012 + Math.max(0, 45 - S.happy) * 0.002 + (S.pol.minwage ? -0.01 : 0);
  if (chance(p * CRK())) { R.strike = 8 + ((Math.random() * 10) | 0); covDirty = true; const st = [...blds.values()].find(b => SERV[b.type].rail === 'pass') || [...blds.values()][0];
    addInc({ type: 'railstrike', x: st ? st.x : W.cx, y: st ? st.y : W.cy, len: R.strike }); note('Železničáři stávkují kvůli mzdám. Vlaky nejezdí.', 'bad'); }
}
function railIncActions(i) {
  if (i.type === 'derail') {
    const a = [];
    if (anyRailDmg()) a.push({ id: 'repair', label: 'Nonstop oprava trati', cost: 450000, hint: 'Opravné čety pracují ve dne i v noci. Trať bude za pár dní průjezdná.' });
    a.push({ id: 'probe', label: 'Vyšetřovací komise', cost: 150000, hint: 'Zjistí příčinu. Lidé ocení, že se věc řeší.' });
    return a;
  }
  if (i.type === 'railstrike') return [
    { id: 'pay', label: 'Přidat železničářům', cost: 250000 + ((T.railSv && T.railSv.total) || 0) * 25000, hint: 'Stávka hned skončí, rozpočet železnice se zvedne na 110 %.' },
    { id: 'buses', label: 'Náhradní autobusy', cost: 120000, hint: 'Lidé se dostanou do práce, stávka ale pokračuje.' },
  ];
  return [];
}
function anyRailDmg() { for (let k = 0; k < NN; k++) if (railDmg[k]) return true; return false; }
function railIncAction(i, act) {
  if (i.type === 'derail' && act === 'repair') { for (let k = 0; k < NN; k++) if (railDmg[k] > 3) { railDmg[k] = 3; markDirty(k); } note('Opravné čety jsou na místě.', 'good'); }
  else if (i.type === 'derail' && act === 'probe') { S.mood += 3; endInc(i); note('Komise našla příčinu a navrhla opatření. Lidé se uklidnili.', 'good'); }
  else if (i.type === 'railstrike' && act === 'pay') { S.rail.strike = 0; S.bud.rail = Math.max(S.bud.rail, 110); covDirty = true; endInc(i); note('Dohoda se železničáři. Vlaky vyjíždějí.', 'good'); }
  else if (i.type === 'railstrike' && act === 'buses') { S.mood += 2; i.buses = true; note('Náhradní autobusy vozí lidi místo vlaků.', 'good'); }
}

// ---------- stavba a bourání tratí ----------
function railCost(k, rt) { return RAILS[rt].cost * (ter[k] === 1 ? 4 : 1) + (lvl[k] ? DEMOLISH_COST : 0); }
// dir: 'h' (vodorovně) / 'v' (svisle) / undefined
function railProblem(x, y, rt, dir) {
  const k = idx(x, y), R = RAILS[rt];
  if (bld[k]) return 'Místo není volné.';
  if (R.req && !S.techs[R.req]) return 'Nejdřív vyzkoumej: ' + TECHS[R.req].name + '.';
  if (road[k]) {
    if (R.hs) return 'Vysokorychlostní trať nesmí mít přejezdy.';
    if (road[k] === 5) return 'Rychlostní silnici trať nepřekříží.';
    const rm = maskOf(road, x, y), roadV = (rm & 10) === 0, roadH = (rm & 5) === 0;
    if (!roadV && !roadH) return 'Přejezd jde jen přes rovnou silnici.';
    if (dir === 'h' && !roadV || dir === 'v' && !roadH) return 'Trať může silnici křížit jen kolmo.';
  }
  return null;
}
function buildRail(x, y, rt, dir) {
  rt = rt || 1; const k = idx(x, y); if (rail[k] === rt) return 0;
  const err = railProblem(x, y, rt, dir); if (err) return err;
  const c = railCost(k, rt) * (rail[k] ? 0.7 : 1); if (!canAfford(c)) return -1;
  spend(c); if (!road[k]) clearTile(k); if (!rail[k]) railSt[k] = 0; rail[k] = rt; railDmg[k] = 0; railDirty = true; markDirty(k);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inb(x + dx, y + dy)) markDirty(idx(x + dx, y + dy));
  return c;
}
function removeRail(x, y) {
  const k = idx(x, y); if (!rail[k]) return 'Tady není trať.';
  if (!canAfford(DEMOLISH_COST)) return 'Nemáš dost peněz.';
  spend(DEMOLISH_COST); rail[k] = 0; railDmg[k] = 0; railSt[k] = 0; railDirty = true; markDirty(k);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inb(x + dx, y + dy)) markDirty(idx(x + dx, y + dy));
  return null;
}
// silnice přes trať: jen kolmo přes rovnou trať, ne přes vysokorychlostní
function roadOverRail(x, y, rt, dir) {
  const k = idx(x, y); if (!rail[k]) return null;
  if (RAILS[rail[k]].hs) return 'Přes vysokorychlostní trať nevede přejezd.';
  if (rt === 5) return 'Rychlostní silnice nemůže mít přejezd.';
  const rm = maskOf(rail, x, y), railV = (rm & 10) === 0, railH = (rm & 5) === 0;
  if (!railV && !railH) return 'Přejezd jde jen přes rovnou trať.';
  if (dir === 'h' && !railV || dir === 'v' && !railH) return 'Silnice může trať křížit jen kolmo.';
  return null;
}
function setRailService(t, n) {
  if (!S.rail) S.rail = RAIL_DEF();
  if (TRAINS[t].req && !S.techs[TRAINS[t].req]) return 'Nejdřív vyzkoumej: ' + TECHS[TRAINS[t].req].name + '.';
  S.rail[t] = clamp(n, 0, 40); covDirty = true; return null;
}
