'use strict';
// Mapa: dlaždice, řeka, lesy, silniční síť a generátor hotového města.

const NN = N * N;
const ter = new Uint8Array(NN);      // 0 tráva, 1 voda, 2 písek, 3 les
const road = new Uint8Array(NN);
const zone = new Uint8Array(NN);     // 0–4
const dens = new Uint8Array(NN);     // 0 nízká, 1 vysoká
const lvl = new Uint8Array(NN);      // 0 = prázdná parcela
const vari = new Uint8Array(NN);
const spec = new Uint8Array(NN);     // průmysl: 0 zboží, 1 potraviny, 2 technologie
const bld = new Int32Array(NN);      // id služby
const ruin = new Uint8Array(NN);     // dny do odklizení trosek
const fire = new Uint8Array(NN);     // dny hoření
const flood = new Uint8Array(NN);
const fpl = new Uint8Array(NN);      // záplavové území
const aband = new Uint8Array(NN);
const bad = new Uint8Array(NN);      // dny bez elektřiny, vody nebo silnice
const occ = new Float32Array(NN);    // obyvatelé nebo obsazená místa
const eduT = new Float32Array(NN);   // vzdělanost obyvatel dlaždice
const conn = new Uint8Array(NN), acc = new Uint8Array(NN), pw = new Uint8Array(NN), wt = new Uint8Array(NN);
const lv = new Float32Array(NN), poll = new Float32Array(NN), crime = new Float32Array(NN), traf = new Float32Array(NN), hap = new Float32Array(NN);
const cov = { police: new Float32Array(NN), fire: new Float32Array(NN), health: new Float32Array(NN), edu: new Float32Array(NN), park: new Float32Array(NN), transit: new Float32Array(NN) };
const TILE_ARRAYS = { ter, road, zone, dens, lvl, vari, spec, ruin, fire, flood, fpl, aband, bad };
const FLOAT_ARRAYS = { occ, eduT, lv, poll, crime, hap };

const idx = (x, y) => y * N + x;
const inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const tileX = x => (x + 0.5) * TS - N * TS / 2;   // střed dlaždice ve světě
const tileZ = y => (y + 0.5) * TS - N * TS / 2;

let _seed = 1;
function srand(s) { _seed = s >>> 0; }
function rnd() { _seed = (_seed + 0x6D2B79F5) | 0; let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function hash2(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s) { let f = 0, a = 0.5, t = 0; for (let o = 0; o < 4; o++) { f += a * vnoise(x, y, s + o * 17); t += a; x *= 2.03; y *= 2.03; a *= 0.5; } return f / t; }

// ---------- budovy služeb ----------
const blds = new Map();   // id -> { id, type, x, y, size, ... }
let nextBid = 1;
const W = { seed: 0, hwY: 0, cx: 0, cy: 0 };

function clearTile(k) { zone[k] = 0; dens[k] = 0; lvl[k] = 0; aband[k] = 0; occ[k] = 0; bad[k] = 0; ruin[k] = 0; fire[k] = 0; if (ter[k] === 3) ter[k] = 0; }
function canBuildAt(x, y, size, allowZone) {
  for (let j = y; j < y + size; j++) for (let i = x; i < x + size; i++) {
    if (!inb(i, j)) return false; const k = idx(i, j);
    if (ter[k] === 1 || road[k] || bld[k] || (!allowZone && zone[k] && lvl[k])) return false;
  }
  return true;
}
function addBuilding(type, x, y) {
  const d = SERV[type], b = { id: nextBid++, type, x, y, size: d.size, hp: 1, built: 0 };
  for (let j = y; j < y + d.size; j++) for (let i = x; i < x + d.size; i++) { const k = idx(i, j); clearTile(k); bld[k] = b.id; }
  blds.set(b.id, b);
  return b;
}
function removeBuilding(b) {
  for (let j = b.y; j < b.y + b.size; j++) for (let i = b.x; i < b.x + b.size; i++) bld[idx(i, j)] = 0;
  blds.delete(b.id);
}
const bAt = k => bld[k] ? blds.get(bld[k]) : null;
function nearWater(x, y, size, d) {
  for (let j = y - d; j < y + size + d; j++) for (let i = x - d; i < x + size + d; i++) if (inb(i, j) && ter[idx(i, j)] === 1) return true;
  return false;
}
function hasRoadAccess(b) {
  for (let j = b.y - 2; j <= b.y + b.size + 1; j++) for (let i = b.x - 2; i <= b.x + b.size + 1; i++) if (inb(i, j) && road[idx(i, j)] && conn[idx(i, j)]) return true;
  return false;
}

// ---------- silnice: propojení s dálnicí a přístup k parcelám ----------
function computeConn() {
  conn.fill(0); acc.fill(0);
  const q = [];
  for (let i = 0; i < N; i++) for (const [x, y] of [[i, 0], [i, N - 1], [0, i], [N - 1, i]]) { const k = idx(x, y); if (road[k] && !conn[k]) { conn[k] = 1; q.push(k); } }
  while (q.length) {
    const k = q.pop(), x = k % N, y = (k / N) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const n = idx(nx, ny); if (road[n] && !conn[n]) { conn[n] = 1; q.push(n); } }
  }
  for (let k = 0; k < NN; k++) if (conn[k]) {
    const x = k % N, y = (k / N) | 0;
    for (let j = y - 2; j <= y + 2; j++) for (let i = x - 2; i <= x + 2; i++) if (inb(i, j)) acc[idx(i, j)] = 1;
  }
}

// ---------- terén ----------
function genTerrain(seed) {
  srand(seed); ter.fill(0); fpl.fill(0); road.fill(0); zone.fill(0); dens.fill(0); lvl.fill(0); bld.fill(0);
  ruin.fill(0); fire.fill(0); flood.fill(0); aband.fill(0); bad.fill(0); occ.fill(0); eduT.fill(0);
  for (let k = 0; k < NN; k++) vari[k] = (rnd() * 256) | 0;
  blds.clear(); nextBid = 1;
  // řeka ze severu na jih, východně od středu
  const rx0 = N * (0.6 + rnd() * 0.08), ph = rnd() * 6;
  const riverX = y => rx0 + Math.sin(y * 0.075 + ph) * 6 + (fbm(y * 0.05, 3, seed) - 0.5) * 8;
  for (let y = 0; y < N; y++) { const c = riverX(y), w = 1.6 + fbm(y * 0.1, 9, seed) * 0.9; for (let x = 0; x < N; x++) if (Math.abs(x - c) <= w) ter[idx(x, y)] = 1; }
  // jezero na jihovýchodě
  const lx = N * 0.82, ly = N * 0.8, lr = 6 + rnd() * 3;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (Math.hypot(x - lx, (y - ly) * 1.2) + (fbm(x * 0.15, y * 0.15, seed + 4) - 0.5) * 5 < lr) ter[idx(x, y)] = 1;
  // písek a záplavové území
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = idx(x, y); if (ter[k] === 1) continue;
    let d = 9;
    for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (inb(x + i, y + j) && ter[idx(x + i, y + j)] === 1) d = Math.min(d, Math.max(Math.abs(i), Math.abs(j)));
    if (d === 1 && hash2(x, y, seed) < 0.35) ter[k] = 2;
    if (d <= 2 && fbm(x * 0.08, y * 0.08, seed + 21) < 0.62) fpl[k] = 1;
  }
  W.cx = Math.round(N * 0.4); W.cy = Math.round(N * 0.5); W.hwY = W.cy; W.seed = seed;
  // lesy
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = idx(x, y); if (ter[k]) continue;
    const f = fbm(x * 0.07 + 30, y * 0.07 + 30, seed + 7);
    if (f > 0.58 || (f > 0.5 && hash2(x, y, seed + 2) < 0.25)) ter[k] = 3;
  }
}
function layRoad(x, y) { const k = idx(x, y); if (bld[k]) return; clearTile(k); road[k] = 1; }

// ---------- generátor hotového města ----------
function genCity(size, techs) {
  const st = STARTS[size], cx = W.cx, cy = W.cy;
  // dálnice ze západního okraje
  const hwEnd = st.r ? cx : 12;
  for (let x = 0; x <= hwEnd; x++) layRoad(x, cy);
  for (let x = 0; x <= hwEnd + 2; x++) for (const y of [cy - 1, cy + 1]) if (ter[idx(x, y)] === 3) ter[idx(x, y)] = 0;
  if (!st.r) return;
  const R = st.r, sp = 5;
  const blocks = [];
  const B = Math.ceil(R / sp) + 1;
  for (let by = -B; by < B; by++) for (let bx = -B; bx < B; bx++) {
    const x0 = cx + bx * sp, y0 = cy + by * sp, mx = x0 + 2.5, my = y0 + 2.5;
    const d = Math.hypot(mx - cx, my - cy), lim = R * (0.82 + 0.36 * fbm(bx * 0.4 + 5, by * 0.4 + 5, W.seed + 11));
    if (d > lim || x0 < 2 || y0 < 2 || x0 + sp >= N - 2 || y0 + sp >= N - 2) continue;
    let water = 0; for (let j = 1; j < sp; j++) for (let i = 1; i < sp; i++) if (ter[idx(x0 + i, y0 + j)] === 1) water++;
    if (water > 4) continue;
    blocks.push({ x0, y0, d: d / R, ang: Math.atan2(my - cy, mx - cx) });
  }
  for (const b of blocks) {
    for (let i = 0; i <= sp; i++) for (const [x, y] of [[b.x0 + i, b.y0], [b.x0 + i, b.y0 + sp], [b.x0, b.y0 + i], [b.x0 + sp, b.y0 + i]]) if (inb(x, y)) layRoad(x, y);
  }
  // služby
  const has = (t, x, y, dist) => { for (const b of blds.values()) if (b.type === t && Math.hypot(b.x - x, b.y - y) < dist) return true; return false; };
  const put = (t, b, ox, oy) => { const s = SERV[t].size, x = b.x0 + 1 + (ox || 0), y = b.y0 + 1 + (oy || 0); if (!canBuildAt(x, y, s, true)) return null; b.used = (b.used || 0) + s * s; return addBuilding(t, x, y); };
  const byDist = blocks.slice().sort((a, b) => a.d - b.d);
  put('townhall', byDist[0], 1, 1); byDist[0].core = true;
  const indAng = Math.PI * 0.8;  // průmysl na jihozápadě
  const isInd = b => b.d > 0.4 && Math.abs(Math.atan2(Math.sin(b.ang - indAng), Math.cos(b.ang - indAng))) < 0.75;
  for (const b of byDist) {
    if (b.core) continue;
    const free = () => 16 - (b.used || 0);
    if (size >= 2 && free() >= 1 && !has('police', b.x0, b.y0, 14)) put('police', b, 0, 0);
    if (size >= 2 && free() >= 1 && !has('fire', b.x0, b.y0, 16)) put('fire', b, 3, 0);
    if (size >= 2 && free() >= 1 && !isInd(b) && !has('clinic', b.x0, b.y0, 14)) put('clinic', b, 0, 3);
    if (size >= 2 && free() >= 1 && !isInd(b) && !has('school', b.x0, b.y0, 15)) put('school', b, 3, 3);
    if (!isInd(b) && free() >= 1 && hash2(b.x0, b.y0, 5) < 0.18) put('park', b, 1, 1);
  }
  if (size === 1) { put('clinic', byDist[1] || byDist[0], 3, 0); put('police', byDist[1] || byDist[0], 0, 0); put('school', byDist[2] || byDist[0], 3, 3); put('park', byDist[0], 0, 0); }
  const outer = byDist.filter(b => !b.used).reverse(), indBlocks = outer.filter(isInd), anyOuter = outer.slice();
  const pick = (want, size_, filter) => { const ok = b => !b.used && (!filter || filter(b)); return want.find(ok) || anyOuter.find(ok) || null; };
  // náhradní místo podél silnice za okrajem zástavby (pro vesnice a malá města)
  const placeAlong = t => {
    const sz = SERV[t].size, cand = [];
    for (let k = 0; k < NN; k++) if (road[k]) cand.push(k);
    cand.sort((p, q) => Math.abs(Math.hypot(p % N - cx, ((p / N) | 0) - cy) - R - 4) - Math.abs(Math.hypot(q % N - cx, ((q / N) | 0) - cy) - R - 4));
    for (const k of cand) { const x = k % N, y = (k / N) | 0;
      for (const [dx, dy] of [[0, 1], [0, -sz], [1, 0], [-sz, 0], [-1, 1], [-1, -sz]]) { const bx = x + dx, by = y + dy; if (canBuildAt(bx, by, sz, false) && !(by <= cy && by + sz > cy)) return addBuilding(t, bx, by); } }
    return null;
  };
  const placeBig = (t, list, filter) => { for (;;) { const b = pick(list, SERV[t].size, bb => !bb.noBig && (!filter || filter(bb))); if (!b) return ['coal', 'gas', 'pump', 'dump'].includes(t) ? placeAlong(t) : null; const r = put(t, b, 0, 0); if (r) { b.used = 16; return r; } b.noBig = true; } };
  if (size >= 3) { placeBig('hospital', [], b => b.d < 0.6); placeBig('highschool', [], b => b.d < 0.6); placeBig('station', indBlocks); placeBig('policehq', [], b => b.d < 0.5); placeBig('bigpark', [], b => b.d < 0.5); placeBig('bus', [], b => b.d < 0.4); placeBig('warehouse', indBlocks); }
  if (size >= 4) {
    placeBig('university', [], b => b.d > 0.3 && b.d < 0.7); placeBig('barracks', anyOuter); placeBig('stadium', [], b => b.d > 0.5);
    for (let i = 0; i < 3; i++) placeBig('bus', [], b => b.d < 0.8);
    if (techs.includes('hygiene')) placeBig('sewage', indBlocks);
    placeBig('hospital', [], b => b.d > 0.5); placeBig('highschool', [], b => b.d > 0.5);
  }
  if (techs.includes('hygiene') && size >= 3) placeBig('sewage', indBlocks);
  // zóny: nejdřív bydlení, pak průmysl, centrum a obchody na hlavních třídách
  const maxL = [0, 2, 3, 4, 5][size];
  const hiR = [0, 0, 0.5, 0.8, 0.66][size];
  for (const b of blocks) {
    if (b.used >= 16) continue;
    const ind = isInd(b), core = b.d < (size >= 4 ? 0.24 : 0.2) && size >= 2;
    for (let j = 1; j < sp; j++) for (let i = 1; i < sp; i++) {
      const x = b.x0 + i, y = b.y0 + j, k = idx(x, y);
      if (ter[k] === 1 || road[k] || bld[k]) continue;
      clearTile(k);
      let z = 1, d = b.d < hiR ? 1 : 0;
      if (ind) { z = 3; d = size >= 4 ? 1 : 0; }
      else if (core) { z = hash2(x, y, 3) < (size >= 3 ? 0.45 : 0.1) ? 4 : 2; d = 1; }
      else if ((Math.abs(x - cx) <= 1 || Math.abs(y - cy) <= 1) && (size >= 2 || hash2(x, y, 12) < 0.5)) { z = 2; }
      zone[k] = z; dens[k] = d;
      const top = d ? maxL : Math.min(3, maxL), want = Math.round(top * (1.05 - b.d * 0.55) * (0.75 + hash2(x, y, 8) * 0.4));
      lvl[k] = clamp(want, 1, top);
      eduT[k] = size >= 3 ? 0.55 : 0.3;
    }
  }
  // vyvážení: pracovních míst zhruba tolik, kolik je pracujících
  let capR = 0, capJ = 0;
  const capK = k => ZONES[zone[k]].cap[dens[k]][lvl[k]];
  for (let k = 0; k < NN; k++) if (lvl[k]) { if (zone[k] === 1) capR += capK(k); else capJ += capK(k); }
  const resT = []; for (let k = 0; k < NN; k++) if (lvl[k] && zone[k] === 1) resT.push(k);
  resT.sort((a, b) => hash2(a, 2, 9) - hash2(b, 2, 9));
  for (const k of resT) {
    if (capJ >= capR * 0.5) break;
    const before = capK(k); const r = hash2(k, 5, 5);
    zone[k] = r < 0.55 ? 2 : r < (size >= 3 ? 0.8 : 0.6) ? 4 : 3; if (zone[k] === 4 && size < 3) zone[k] = 2;
    capR -= before; capJ += capK(k);
  }
  for (let pass = 0; pass < 5 && capJ > capR * 0.62; pass++) {
    const f = 1 - capR * 0.55 / capJ;
    for (let k = 0; k < NN; k++) if (lvl[k] > 1 && zone[k] > 1 && hash2(k, pass, 3) < f) { capJ -= capK(k); lvl[k]--; capJ += capK(k); }
  }
  for (let k = 0; k < NN; k++) if (zone[k] === 3 && lvl[k]) spec[k] = hash2(k % N, (k / N) | 0, 6) < 0.35 ? 1 : (techs.includes('hightech') && hash2(k, 0, 7) < 0.2 ? 2 : 0);
  // elektřina, voda a odpad podle velikosti
  let res = 0, jobs = 0;
  for (let k = 0; k < NN; k++) if (lvl[k]) { const c = ZONES[zone[k]].cap[dens[k]][lvl[k]]; if (zone[k] === 1) res += c; else jobs += c; }
  const needP = res * PW_RES + jobs * PW_JOB, needW = res * WT_RES + jobs * WT_JOB;
  let haveP = 0, haveW = 0, haveG = 0;
  const pType = size >= 4 && techs.includes('gasturb') ? 'gas' : 'coal';
  while (haveP < needP * 1.45) { const b = placeBig(pType, indBlocks.length ? indBlocks : anyOuter); if (!b) break; haveP += SERV[pType].power; }
  const riverBlocks = anyOuter.filter(b => nearWater(b.x0 + 1, b.y0 + 1, 4, 2));
  const pumpBlocks = riverBlocks.concat(anyOuter.filter(b => !riverBlocks.includes(b)));
  for (const b of pumpBlocks) {
    if (haveW >= needW * 1.45) break; if ((b.used || 0) >= 12) continue;
    for (let n = 0; n < 4 && haveW < needW * 1.45; n++) { const p = put('pump', b, n, 3); if (p) haveW += SERV.pump.water * (nearWater(p.x, p.y, 1, 2) ? 1.5 : 1); }
  }
  while (haveW < needW * 1.45) { const p = placeAlong('pump'); if (!p) break; haveW += SERV.pump.water * (nearWater(p.x, p.y, 1, 2) ? 1.5 : 1); }
  while (haveG < (res + jobs * 0.5) * 1.1) { const b = placeBig('dump', anyOuter.slice().reverse()); if (!b) break; haveG += SERV.dump.garbage; }
  if (size >= 4) { const pb = riverBlocks.find(b => !b.used && nearWater(b.x0 + 1, b.y0 + 1, 3, 1)); if (pb) { pb.used = 16; put('port', pb, 0, 0); } }
  // zbylé parcely v nepoužitých blocích dostanou zónu bydlení
  for (let k = 0; k < NN; k++) if (zone[k] && lvl[k]) occ[k] = ZONES[zone[k]].cap[dens[k]][lvl[k]] * (zone[k] === 1 ? 0.92 : 0.8);
}
