'use strict';
// Mapa: dlaždice, řeka, lesy, silniční síť a generátor hotového města.

const NN = N * N;
const ter = new Uint8Array(NN);      // 0 tráva, 1 voda, 2 písek, 3 les, 4 pole, 5 zahrada
const road = new Uint8Array(NN);
const zone = new Uint8Array(NN);     // 0–4
const dens = new Uint8Array(NN);     // 0 nízká, 1 vysoká
const lvl = new Uint8Array(NN);      // 0 = prázdná parcela
const vari = new Uint8Array(NN);
const spec = new Uint8Array(NN);     // průmysl: 0 zboží, 1 potraviny, 2 technologie
const sty = new Uint8Array(NN);      // ráz zástavby: 0 vesnice, 1 městečko a předměstí, 2 velkoměsto
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
const TILE_ARRAYS = { ter, road, zone, dens, lvl, vari, spec, sty, ruin, fire, flood, fpl, aband, bad };
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

function clearTile(k) { zone[k] = 0; dens[k] = 0; lvl[k] = 0; aband[k] = 0; occ[k] = 0; bad[k] = 0; ruin[k] = 0; fire[k] = 0; if (ter[k] >= 3) ter[k] = 0; }
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
  for (let k = 0; k < NN; k++) if (conn[k] && !(ROADS[road[k]] && ROADS[road[k]].noAccess)) {
    const x = k % N, y = (k / N) | 0;
    for (let j = y - 2; j <= y + 2; j++) for (let i = x - 2; i <= x + 2; i++) if (inb(i, j)) acc[idx(i, j)] = 1;
  }
}

// ---------- terén ----------
function genTerrain(seed) {
  srand(seed); ter.fill(0); fpl.fill(0); road.fill(0); zone.fill(0); dens.fill(0); lvl.fill(0); bld.fill(0); sty.fill(0);
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
  // pole: obdélníkové lány s různými plodinami
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = idx(x, y); if (ter[k]) continue;
    const p = parcel(x, y);
    if (hash2(p[0], p[1], seed + 31) < 0.55 && Math.hypot(x - W.cx, y - W.cy) > 5) ter[k] = 4;
  }
}
// lán pole: [sloupec, řádek]; plodina a směr řádků se odvozují z lánu
function parcel(x, y) { const row = Math.floor(y / 5); return [Math.floor((x + (row % 3) * 2) / 6), row]; }
function fieldCrop(x, y) { const p = parcel(x, y); return Math.floor(hash2(p[0], p[1], W.seed + 7) * 5); }
function layRoad(x, y, rt) { const k = idx(x, y); if (bld[k]) return; clearTile(k); road[k] = rt || 1; }

// ---------- vesnice podél hlavní silnice ----------
function genVillage(techs) {
  const cx = W.cx, cy = W.cy, L = 12, lane = cx + 4;
  for (let y = cy - 8; y < cy; y++) if (ter[idx(lane, y)] !== 1) layRoad(lane, y, 2);
  // hasičská zbrojnice dobrovolných hasičů na rohu návsi
  if (canBuildAt(cx + 3, cy - 1, 1, false)) addBuilding('firevol', cx + 3, cy - 1);
  const free = (x, y) => inb(x, y) && ter[idx(x, y)] !== 1 && !road[idx(x, y)] && !bld[idx(x, y)] && !zone[idx(x, y)];
  // náves: kostel, obecní úřad a rybník
  if (canBuildAt(cx - 3, cy - 3, 2, false)) addBuilding('church', cx - 3, cy - 3);
  if (canBuildAt(cx + 1, cy - 3, 2, false)) addBuilding('townhall', cx + 1, cy - 3);
  for (const [x, y] of [[cx - 1, cy + 2], [cx, cy + 2], [cx - 1, cy + 3], [cx, cy + 3]]) if (free(x, y)) { clearTile(idx(x, y)); ter[idx(x, y)] = 1; }
  if (canBuildAt(cx + 5, cy + 1, 1, false)) addBuilding('school', cx + 5, cy + 1);
  const house = (x, y, z) => { if (!free(x, y)) return false; const k = idx(x, y); clearTile(k); zone[k] = z || 1; dens[k] = 0; lvl[k] = 1 + (hash2(x, y, 5) < 0.45 ? 1 : 0); sty[k] = 0; return true; };
  const garden = (x, y) => { if (!free(x, y)) return; const k = idx(x, y); ter[k] = 5; };
  // domy po obou stranách hlavní silnice, za nimi zahrady
  for (let x = cx - L; x <= cx + L; x++) for (const s of [-1, 1]) {
    const y = cy + s; if (hash2(x, y, 11) < 0.12 || (x >= cx - 3 && x <= cx + 2 && s < 0)) continue;
    if (house(x, y)) { garden(x, y + s); if (hash2(x, y, 13) < 0.55) garden(x, y + 2 * s); }
  }
  // boční ulička na sever
  for (let y = cy - 7; y <= cy - 2; y++) for (const s of [-1, 1]) { const x = lane + s; if (house(x, y)) garden(x + s, y); }
  // hospoda a obchod na návsi, statek na kraji vesnice
  for (const [x, y] of [[cx - 2, cy + 1], [cx + 1, cy + 1]]) { const k = idx(x, y); if (zone[k] === 1) zone[k] = 2; }
  for (let x = cx + L - 2; x <= cx + L; x++) for (const y of [cy + 1, cy + 2]) { const k = idx(x, y); if (!inb(x, y) || ter[k] === 1 || road[k] || bld[k]) continue; clearTile(k); zone[k] = 3; dens[k] = 0; lvl[k] = 1 + (hash2(x, y, 4) < 0.5 ? 1 : 0); spec[k] = 1; sty[k] = 0; }
  // kolem vesnice louky a pole
  for (let y = cy - 10; y <= cy + 10; y++) for (let x = cx - L - 4; x <= cx + L + 4; x++) { if (!inb(x, y)) continue; const k = idx(x, y); if (ter[k] === 0 && !road[k] && !zone[k] && !bld[k] && Math.abs(y - cy) > 2 && hash2(x >> 2, y >> 2, 3) < 0.7) ter[k] = 4; }
}

// ---------- generátor hotového města ----------
function genCity(size, techs) {
  const st = STARTS[size], cx = W.cx, cy = W.cy;
  // dálnice ze západního okraje
  const village = size === 1, hwEnd = village ? cx + 13 : st.r ? cx : 12;
  for (let x = 0; x <= hwEnd; x++) { if (ter[idx(x, cy)] === 1 && village) break; layRoad(x, cy, village || !st.r ? 2 : 1); }
  for (let x = 0; x <= hwEnd + 2; x++) for (const y of [cy - 1, cy + 1]) if (ter[idx(x, y)] === 3) ter[idx(x, y)] = 0;
  if (!st.r) { for (const [x, y] of [[8, cy + 1], [8, cy - 2], [5, cy + 1], [5, cy - 2]]) if (canBuildAt(x, y, 2, false)) { addBuilding('townhall', x, y); break; } return; }
  const R = st.r, sp = 5;
  const blocks = [];
  const B = village ? 0 : Math.ceil(R / sp) + 1;
  if (village) genVillage(techs);
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
  // odříznuté čtvrti (třeba za řekou) napojit po hlavních ulicích, přes vodu mostem
  computeConn();
  for (const b of blocks) {
    if (conn[idx(b.x0, b.y0)]) continue;
    let x = b.x0, y = b.y0;
    while (y !== cy) { y += Math.sign(cy - y); layRoad(x, y); }
    while (x !== cx) { x += Math.sign(cx - x); layRoad(x, y); }
    computeConn();
  }
  // služby
  const has = (t, x, y, dist) => { for (const b of blds.values()) if (b.type === t && Math.hypot(b.x - x, b.y - y) < dist) return true; return false; };
  const put = (t, b, ox, oy) => { const s = SERV[t].size, x = b.x0 + 1 + (ox || 0), y = b.y0 + 1 + (oy || 0); if (!canBuildAt(x, y, s, true)) return null; b.used = (b.used || 0) + s * s; return addBuilding(t, x, y); };
  const byDist = blocks.slice().sort((a, b) => a.d - b.d);
  if (!village) { put('townhall', byDist[0], 1, 1); byDist[0].core = true; if (size >= 2) { const cb = byDist.find(b => !b.core && (b.used || 0) === 0); if (cb) { put('church', cb, 0, 0); } } }
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
  const placeBig = (t, list, filter) => { for (;;) { const b = pick(list, SERV[t].size, bb => !bb.noBig && (!filter || filter(bb))); if (!b) return ['coal', 'gas', 'wind', 'pump', 'dump'].includes(t) ? placeAlong(t) : null; const r = put(t, b, 0, 0); if (r) { b.used = 16; return r; } b.noBig = true; } };
  if (size >= 3) { placeBig('hospital', [], b => b.d < 0.6); placeBig('highschool', [], b => b.d < 0.6); placeBig('station', indBlocks); placeBig('policehq', [], b => b.d < 0.5); placeBig('bigpark', [], b => b.d < 0.5); placeBig('bus', [], b => b.d < 0.4); placeBig('warehouse', indBlocks); }
  if (size >= 4) {
    placeBig('university', [], b => b.d > 0.3 && b.d < 0.7); placeBig('barracks', anyOuter); placeBig('stadium', [], b => b.d > 0.5);
    for (let i = 0; i < 3; i++) placeBig('bus', [], b => b.d < 0.8);
    if (techs.includes('hygiene')) placeBig('sewage', indBlocks);
    placeBig('hospital', [], b => b.d > 0.5); placeBig('highschool', [], b => b.d > 0.5);
  }
  if (techs.includes('hygiene') && size >= 3) placeBig('sewage', indBlocks);
  if (size >= 3 && techs.includes('ems')) placeBig('firehq', [], b => b.d < 0.55);
  // druhy silnic: příjezd z dálnice, hlavní třídy, tramvaje a pěší zóna
  if (!village) {
    const bx0 = Math.min(...blocks.map(b => b.x0));
    for (let x = 0; x < bx0; x++) { const k = idx(x, cy); if (road[k]) road[k] = size >= 3 ? 5 : 2; }
    if (size >= 3) for (let k = 0; k < NN; k++) { if (!road[k]) continue; const x = k % N, y = (k / N) | 0; if (x < bx0) continue;
      const axis = y === cy || x === cx, dd = Math.hypot(x - cx, y - cy) / R;
      if (axis && dd < (size >= 4 ? 0.95 : 0.7)) road[k] = size >= 4 && dd < 0.75 ? 4 : 3; }
    if (size >= 4) { const px = cx + sp; for (let y = cy - sp + 1; y < cy; y++) { const k = idx(px, y); if (road[k] && ter[k] !== 1) road[k] = 6; } }
  }
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
  const dc = k => Math.hypot(k % N - cx, ((k / N) | 0) - cy) + hash2(k, 2, 9) * 3;
  resT.sort((a, b) => dc(a) - dc(b));
  const deficit = Math.max(0, capR * 0.5 - capJ), share = village ? { 3: 0.85, 2: 0.1, 4: 0 } : size >= 3 ? { 3: 0.5, 2: 0.3, 4: 0.2 } : { 3: 0.55, 2: 0.45, 4: 0 };
  const conv = (z, list) => { let got = 0; for (const k of list) { if (got >= deficit * share[z] || zone[k] !== 1) { if (got >= deficit * share[z]) break; continue; } const before = capK(k); zone[k] = z; dens[k] = z === 3 ? dens[k] && size >= 4 ? 1 : 0 : dens[k]; if (lvl[k] > (dens[k] ? 5 : 3)) lvl[k] = 3; const c = capK(k); capR -= before; capJ += c; got += c; } };
  conv(3, resT.slice().reverse()); conv(2, resT); conv(4, resT);
  for (let pass = 0; pass < 5 && capJ > capR * 0.62; pass++) {
    const f = 1 - capR * 0.55 / capJ;
    for (let k = 0; k < NN; k++) if (lvl[k] > 1 && zone[k] > 1 && hash2(k, pass, 3) < f) { capJ -= capK(k); lvl[k]--; capJ += capK(k); }
  }
  for (let k = 0; k < NN; k++) if (zone[k] === 3 && lvl[k]) spec[k] = village ? 1 : hash2(k % N, (k / N) | 0, 6) < 0.35 ? 1 : (techs.includes('hightech') && hash2(k, 0, 7) < 0.2 ? 2 : 0);
  // zbytky polí a lesa uvnitř městských bloků se změní na trávník
  for (const b of blocks) for (let j = 1; j < sp; j++) for (let i = 1; i < sp; i++) { const k = idx(b.x0 + i, b.y0 + j); if (inb(b.x0 + i, b.y0 + j) && (ter[k] === 4 || ter[k] === 3) && !zone[k] && !bld[k] && !road[k]) ter[k] = 0; }
  // ráz zástavby: historické jádro, předměstí, sídliště a vesnické okraje
  for (let k = 0; k < NN; k++) {
    if (!zone[k]) continue;
    const d = Math.hypot(k % N - cx, ((k / N) | 0) - cy) / Math.max(1, R);
    if (village) sty[k] = 0;
    else if (size === 2) sty[k] = !dens[k] && zone[k] === 1 && d > 0.85 ? 0 : 1;
    else sty[k] = d < 0.16 ? 1 : (!dens[k] && zone[k] !== 4 ? (d > 1.0 ? 0 : 1) : 2);
    if (!village && !dens[k] && zone[k] === 1 && d > 0.6 && hash2(k, 4, 2) < 0.12) { zone[k] = 0; lvl[k] = 0; ter[k] = 5; }
  }
  // elektřina, voda a odpad podle velikosti
  let res = 0, jobs = 0;
  for (let k = 0; k < NN; k++) if (lvl[k]) { const c = ZONES[zone[k]].cap[dens[k]][lvl[k]]; if (zone[k] === 1) res += c; else jobs += c; }
  const needP = res * PW_RES + jobs * PW_JOB, needW = res * WT_RES + jobs * WT_JOB;
  let haveP = 0, haveW = 0, haveG = 0;
  const pType = needP < 300 && techs.includes('wind') ? 'wind' : size >= 4 && techs.includes('gasturb') ? 'gas' : 'coal';
  while (haveP < needP * 1.45) { const b = pType === 'wind' ? placeAlong('wind') : placeBig(pType, indBlocks.length ? indBlocks : anyOuter); if (!b) break; haveP += SERV[pType].power * (pType === 'wind' ? 0.6 : 1); }
  const riverBlocks = anyOuter.filter(b => nearWater(b.x0 + 1, b.y0 + 1, 4, 2));
  const pumpBlocks = riverBlocks.concat(anyOuter.filter(b => !riverBlocks.includes(b)));
  for (const b of pumpBlocks) {
    if (haveW >= needW * 1.45) break; if ((b.used || 0) >= 12) continue;
    for (let n = 0; n < 4 && haveW < needW * 1.45; n++) { const p = put('pump', b, n, 3); if (p) haveW += SERV.pump.water * (nearWater(p.x, p.y, 1, 2) ? 1.5 : 1); }
  }
  while (haveW < needW * 1.45) { const p = placeAlong('pump'); if (!p) break; haveW += SERV.pump.water * (nearWater(p.x, p.y, 1, 2) ? 1.5 : 1); }
  while (haveG < (res + jobs * 0.5) * 1.1) { const b = placeBig('dump', anyOuter); if (!b) break; haveG += SERV.dump.garbage; }
  if (size >= 4) { const pb = riverBlocks.find(b => !b.used && nearWater(b.x0 + 1, b.y0 + 1, 3, 1)); if (pb) { pb.used = 16; put('port', pb, 0, 0); } }
  // zbylé parcely v nepoužitých blocích dostanou zónu bydlení
  for (let k = 0; k < NN; k++) if (zone[k] && lvl[k]) occ[k] = ZONES[zone[k]].cap[dens[k]][lvl[k]] * (zone[k] === 1 ? 0.92 : 0.8);
}
