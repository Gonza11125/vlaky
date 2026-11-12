'use strict';
// Svět: terén, suroviny, hledání cest, 3D modely.

const N = 112, CS = 2, WORLD = N * CS;
const NV = N + 1;
const hgt = new Float32Array(NV * NV);       // výšky v rozích buněk
const walk = new Uint8Array(N * N);           // terén je schůdný
const occ = new Uint8Array(N * N);            // blokováno budovou
const resv = new Uint8Array(N * N);           // nelze stavět (budova, pole)
const bAt = new Int32Array(N * N);            // id budovy na buňce
const nodeAt = new Int32Array(N * N).fill(-1);
const forest = new Uint8Array(N * N);
const nodes = [];
const herds = [];
const STARTS = [{ cx: 24, cy: N - 26 }, { cx: N - 26, cy: 24 }];

let _seed = 1;
function srand(s) { _seed = s >>> 0; }
function rnd() { _seed = (_seed + 0x6D2B79F5) | 0; let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function hash2(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s) { let f = 0, a = 0.5, t = 0; for (let o = 0; o < 4; o++) { f += a * vnoise(x, y, s + o * 17); t += a; x *= 2.03; y *= 2.03; a *= 0.5; } return f / t; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const cidx = (cx, cy) => cy * N + cx;
const inMap = (cx, cy) => cx >= 0 && cy >= 0 && cx < N && cy < N;
const cellOf = v => clamp(Math.floor(v / CS), 0, N - 1);
const cellC = c => (c + 0.5) * CS;

function heightAt(x, z) {
  const fx = clamp(x / CS, 0, N - 0.001), fz = clamp(z / CS, 0, N - 0.001);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const a = hgt[j * NV + i], b = hgt[j * NV + i + 1], c = hgt[(j + 1) * NV + i], d = hgt[(j + 1) * NV + i + 1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function cellH(cx, cy) { return (hgt[cy * NV + cx] + hgt[cy * NV + cx + 1] + hgt[(cy + 1) * NV + cx] + hgt[(cy + 1) * NV + cx + 1]) / 4; }
function calcWalk(cx, cy) {
  const a = hgt[cy * NV + cx], b = hgt[cy * NV + cx + 1], c = hgt[(cy + 1) * NV + cx], d = hgt[(cy + 1) * NV + cx + 1];
  const mn = Math.min(a, b, c, d), mx = Math.max(a, b, c, d);
  walk[cidx(cx, cy)] = ((a + b + c + d) / 4 > 0.3 && mx - mn < 1.7) ? 1 : 0;
}

function genHeights(seed) {
  for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) {
    let h = (fbm(i / N * 4.2, j / N * 4.2, seed) - 0.4) * 15;
    const ridge = fbm(i / N * 9, j / N * 9, seed + 99);
    if (h > 3) h += (ridge - 0.45) * 6 * sstep(3, 5, h);
    for (const s of STARTS) { const d = Math.hypot(i - s.cx - 1.5, j - s.cy - 1.5); h = lerp(h, 1.3, sstep(17, 9, d)); }
    const e = Math.min(i, j, N - i, N - j);
    if (e < 7) h = lerp(-3.5, h, sstep(0, 7, e));
    hgt[j * NV + i] = h;
  }
  let w = 0;
  for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) { calcWalk(cx, cy); w += walk[cidx(cx, cy)]; }
  return w / (N * N);
}

function addNode(type, cx, cy, force) {
  if (!inMap(cx, cy)) return null;
  const i = cidx(cx, cy);
  if ((!walk[i] && !force) || nodeAt[i] >= 0 || resv[i]) return null;
  const n = { id: nodes.length, isNode: true, type, def: NODE_DEF[type], cx, cy, x: cellC(cx) + (rnd() - 0.5) * 0.8, z: cellC(cy) + (rnd() - 0.5) * 0.8, amt: NODE_DEF[type].amt, inst: -1, v: rnd() };
  if (type === 'fish') { n.x = cellC(cx); n.z = cellC(cy); }
  nodes.push(n); nodeAt[i] = n.id; return n;
}
function cluster(type, cx, cy, count, rad) {
  let made = 0;
  for (let t = 0; t < count * 8 && made < count; t++) {
    const x = Math.round(cx + (rnd() - 0.5) * 2 * rad), y = Math.round(cy + (rnd() - 0.5) * 2 * rad);
    if (STARTS.some(s => Math.hypot(x - s.cx - 1, y - s.cy - 1) < 5)) continue;
    if (addNode(type, x, y)) made++;
  }
  return made;
}
function isShore(cx, cy) { return !walk[cidx(cx, cy)] && cellH(cx, cy) < -0.05 && !!(walk[cidx(cx + 1, cy)] || walk[cidx(cx - 1, cy)] || walk[cidx(cx, cy + 1)] || walk[cidx(cx, cy - 1)]); }
function genNodes(seed) {
  nodes.length = 0; herds.length = 0; nodeAt.fill(-1); forest.fill(0);
  for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) {
    if (!walk[cidx(cx, cy)]) continue;
    const dS = Math.min(...STARTS.map(s => Math.hypot(cx - s.cx - 1, cy - s.cy - 1)));
    if (dS < 8) continue;
    const f = fbm(cx / N * 8 + 40, cy / N * 8 + 40, seed + 7);
    if (f > 0.55) { forest[cidx(cx, cy)] = 1; if (rnd() < 0.72) addNode('tree', cx, cy); }
    else if (rnd() < 0.012) addNode('tree', cx, cy);
  }
  // spravedlivé zásoby u obou startů (zrcadlově)
  STARTS.forEach((s, k) => {
    const sg = k === 0 ? 1 : -1, x = s.cx + 1, y = s.cy + 1;
    cluster('tree', x - 10 * sg, y - 3 * sg, 22, 3);
    cluster('tree', x + 4 * sg, y + 10 * sg, 18, 3);
    cluster('bush', x + 7 * sg, y + 3 * sg, 7, 2);
    cluster('bush', x - 4 * sg, y - 8 * sg, 5, 2);
    cluster('stone', x + 9 * sg, y - 7 * sg, 4, 1.5);
    cluster('ore', x + 12 * sg, y - 12 * sg, 4, 1.5);
    cluster('gold', x - 12 * sg, y + 9 * sg, 3, 1.5);
    herds.push({ cx: x + 12 * sg, cy: y + 6 * sg, n: 5 }, { cx: x - 6 * sg, cy: y - 14 * sg, n: 4 });
  });
  for (let k = 0; k < 9; k++) {
    const x = 10 + Math.floor(rnd() * (N - 20)), y = 10 + Math.floor(rnd() * (N - 20));
    cluster('stone', x, y, 4, 2); cluster('stone', N - x, N - y, 4, 2);
    const x2 = 10 + Math.floor(rnd() * (N - 20)), y2 = 10 + Math.floor(rnd() * (N - 20));
    cluster('ore', x2, y2, 4, 2); cluster('ore', N - x2, N - y2, 4, 2);
    const x3 = 10 + Math.floor(rnd() * (N - 20)), y3 = 10 + Math.floor(rnd() * (N - 20));
    cluster('bush', x3, y3, 5, 2); cluster('bush', N - x3, N - y3, 5, 2);
    const x4 = 10 + Math.floor(rnd() * (N - 20)), y4 = 10 + Math.floor(rnd() * (N - 20));
    cluster('gold', x4, y4, 3, 2); cluster('gold', N - x4, N - y4, 3, 2);
    const x5 = 12 + Math.floor(rnd() * (N - 24)), y5 = 12 + Math.floor(rnd() * (N - 24));
    herds.push({ cx: x5, cy: y5, n: 4 }, { cx: N - x5, cy: N - y5, n: 4 });
  }
  // ryby: mělčina hned u břehu
  for (let cy = 2; cy < N - 2; cy++) for (let cx = 2; cx < N - 2; cx++) {
    if (!isShore(cx, cy) || hash2(cx, cy, seed) > 0.3) continue;
    let near = false; for (const n of nodes) if (n.type === 'fish' && Math.abs(n.cx - cx) < 4 && Math.abs(n.cy - cy) < 4) { near = true; break; }
    if (!near) addNode('fish', cx, cy, true);
  }
  // každý start má aspoň dvě hejna v dosahu nejbližšího břehu
  for (const s of STARTS) {
    const sh = [];
    for (let cy = 2; cy < N - 2; cy++) for (let cx = 2; cx < N - 2; cx++) if (isShore(cx, cy) && nodeAt[cidx(cx, cy)] < 0) sh.push({ cx, cy, d: Math.hypot(cx - s.cx, cy - s.cy) });
    sh.sort((a, b) => a.d - b.d);
    let made = 0; for (const c of sh) { if (made >= 2) break; if (nodes.some(n => n.type === 'fish' && Math.abs(n.cx - c.cx) < 3 && Math.abs(n.cy - c.cy) < 3)) { if (c.d < 30) made++; continue; } if (addNode('fish', c.cx, c.cy, true)) made++; }
  }
}

// ---------- hledání cest (A*) ----------
const _g = new Float32Array(N * N), _from = new Int32Array(N * N), _stamp = new Uint32Array(N * N), _closed = new Uint32Array(N * N);
let _stampN = 0;
const _heap = [], _hf = [];
function hpush(i, f) { let k = _heap.length; _heap.push(i); _hf.push(f); while (k > 0) { const p = (k - 1) >> 1; if (_hf[p] <= f) break; _heap[k] = _heap[p]; _hf[k] = _hf[p]; k = p; } _heap[k] = i; _hf[k] = f; }
function hpop() {
  const top = _heap[0], li = _heap.pop(), lf = _hf.pop(), n = _heap.length;
  if (n) { let k = 0; for (;;) { let c = 2 * k + 1; if (c >= n) break; if (c + 1 < n && _hf[c + 1] < _hf[c]) c++; if (_hf[c] >= lf) break; _heap[k] = _heap[c]; _hf[k] = _hf[c]; k = c; } _heap[k] = li; _hf[k] = lf; }
  return top;
}
const gateT = new Int8Array(N * N);        // brána: tým + 1
let PT = -1;                                // tým, pro který se právě hledá cesta
const blocked = i => !walk[i] || (occ[i] && gateT[i] !== PT + 1);
// cíl = obdélník buněk [x0..x1]×[y0..y1]; adj = jak blízko stačí dojít (0 = dovnitř, 1 = sousedit)
function findPath(sx, sy, x0, y0, x1, y1, adj) {
  _stampN++; _heap.length = 0; _hf.length = 0;
  const hd = (x, y) => { const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0, dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0; return dx > dy ? dx + 0.414 * dy : dy + 0.414 * dx; };
  const cheb = (x, y) => Math.max(x < x0 ? x0 - x : x > x1 ? x - x1 : 0, y < y0 ? y0 - y : y > y1 ? y - y1 : 0);
  const s = cidx(sx, sy);
  _g[s] = 0; _from[s] = -1; _stamp[s] = _stampN; hpush(s, hd(sx, sy));
  let best = s, bestH = hd(sx, sy), found = -1, iter = 0;
  while (_heap.length && iter++ < 9000) {
    const c = hpop();
    if (_closed[c] === _stampN) continue;
    _closed[c] = _stampN;
    const x = c % N, y = (c / N) | 0;
    if (cheb(x, y) <= adj && (c === s || !blocked(c))) { found = c; break; }
    const h = hd(x, y); if (h < bestH) { bestH = h; best = c; }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const ni = ny * N + nx;
      if (blocked(ni) || _closed[ni] === _stampN) continue;
      if (dx && dy && (blocked(y * N + nx) || blocked(ny * N + x))) continue;
      const g = _g[c] + (dx && dy ? 1.414 : 1);
      if (_stamp[ni] !== _stampN || g < _g[ni]) { _g[ni] = g; _from[ni] = c; _stamp[ni] = _stampN; hpush(ni, g + hd(nx, ny)); }
    }
  }
  let end = found >= 0 ? found : best;
  const out = [];
  while (end !== s && end >= 0) { out.push(end); end = _from[end]; }
  out.reverse();
  return { cells: out, ok: found >= 0 };
}
function nearestFree(cx, cy, maxR) {
  if (inMap(cx, cy) && !blocked(cidx(cx, cy))) return { cx, cy };
  for (let r = 1; r <= (maxR || 12); r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = cx + dx, y = cy + dy;
    if (inMap(x, y) && !blocked(cidx(x, y))) return { cx: x, cy: y };
  }
  return null;
}

function makeWorld(fixed) {
  let seed = fixed != null ? fixed : (Math.random() * 1e9) | 0;
  for (let tries = 0; tries < 40; tries++, seed += 101) {
    srand(seed);
    const land = genHeights(seed);
    if (land < 0.55) continue;
    occ.fill(0); resv.fill(0); bAt.fill(0); gateT.fill(0); PT = -1;
    const a = STARTS[0], b = STARTS[1];
    if (findPath(a.cx - 1, a.cy + 1, b.cx - 1, b.cy + 1, b.cx - 1, b.cy + 1, 0).ok) break;
  }
  genNodes(seed);
  return seed;
}

// ---------- geometrie ----------
const _col = new THREE.Color();
function P(geo, color, x, y, z, rx, ry, rz, sx, sy, sz) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x || 0, y || 0, z || 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
    new THREE.Vector3(sx || 1, sy || 1, sz || 1));
  g.applyMatrix4(m);
  return { g, color };
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s) => new THREE.CylinderGeometry(rt, rb, h, s || 8);
const sph = r => new THREE.SphereGeometry(r, 8, 6);
function merge(parts, team) {
  let n = 0; for (const p of parts) n += p.g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) {
    const c = p.g.attributes.position.count;
    pos.set(p.g.attributes.position.array, o * 3); nor.set(p.g.attributes.normal.array, o * 3);
    _col.setHex(p.color === 'T' ? team : p.color === 'TD' ? team : p.color);
    if (p.color === 'TD') _col.multiplyScalar(0.6);
    for (let k = 0; k < c; k++) { col[(o + k) * 3] = _col.r; col[(o + k) * 3 + 1] = _col.g; col[(o + k) * 3 + 2] = _col.b; }
    o += c; p.g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

const C = { stone: 0xb7b0a2, stoneD: 0x8d877b, wood: 0x8f6b43, woodD: 0x5c4530, thatch: 0xcaa85a, plaster: 0xe4dac2, tile: 0x9c4a32, iron: 0x4a4f55, steel: 0xa9b0b6, skin: 0xe0b48c, leg: 0x3d322b, horse: 0x6e4a2e, soil: 0x7a5a3a, crop: 0xd9d27a, grass: 0x6f9a4a, white: 0xf0ede4, straw: 0xd8c27a };
const gable = (w, len, hgtR, color, y, rotY) => P(cyl(w / 1.732, w / 1.732, len, 3), color, 0, y + (hgtR * w / 1.732) / 2, 0, -Math.PI / 2, 0, rotY || 0, 1, 1, hgtR);
const flag = (x, z, h) => [P(cyl(0.05, 0.05, h, 5), C.woodD, x, h / 2, z), P(box(0.9, 0.5, 0.06), 'T', x + 0.48, h - 0.3, z)];

function humanParts(kind) {
  const p = [
    P(box(0.5, 0.7, 0.36), C.leg, 0, 0.35, 0),
    P(box(0.64, 0.78, 0.44), 'T', 0, 1.08, 0),
    P(sph(0.25), C.skin, 0, 1.7, 0),
  ];
  if (kind === 'vil') { p.push(P(cyl(0.05, 0.42, 0.22, 8), C.straw, 0, 1.92, 0)); p.push(P(box(0.66, 0.2, 0.46), C.plaster, 0, 0.8, 0)); }
  if (kind === 'spear') { p.push(P(cyl(0.04, 0.04, 2.5, 5), C.wood, 0.42, 1.35, 0.1)); p.push(P(cyl(0, 0.08, 0.3, 5), C.steel, 0.42, 2.75, 0.1)); p.push(P(cyl(0.36, 0.36, 0.07, 10), 'TD', -0.36, 1.1, 0.2, Math.PI / 2, 0, 0)); }
  if (kind === 'sword') { p.push(P(box(0.08, 0.95, 0.05), C.steel, 0.44, 1.5, 0.3, 0.5, 0, 0)); p.push(P(box(0.08, 0.7, 0.55), C.steel, -0.4, 1.1, 0.15)); p.push(P(cyl(0.27, 0.29, 0.22, 8), C.steel, 0, 1.86, 0)); }
  if (kind === 'archer') { p.push(P(new THREE.TorusGeometry(0.5, 0.035, 4, 8, Math.PI), C.wood, -0.4, 1.2, 0.2, 0, Math.PI / 2, Math.PI / 2)); p.push(P(cyl(0.2, 0.27, 0.2, 8), 0x4d6b3a, 0, 1.9, 0)); p.push(P(box(0.16, 0.6, 0.16), C.wood, 0.15, 1.3, -0.28, 0, 0, 0.3)); }
  if (kind === 'xbow') { p.push(P(box(0.8, 0.07, 0.07), C.steel, 0, 1.15, 0.55)); p.push(P(box(0.08, 0.08, 0.7), C.wood, 0, 1.15, 0.35)); p.push(P(cyl(0.27, 0.3, 0.2, 8), C.steel, 0, 1.88, 0)); }
  if (kind === 'musket') { p.push(P(cyl(0.04, 0.05, 1.7, 6), C.iron, 0.3, 1.5, 0.3, 0.9, 0, 0)); p.push(P(cyl(0.48, 0.48, 0.05, 10), 0x2a2622, 0, 1.9, 0)); p.push(P(cyl(0.22, 0.26, 0.22, 8), 0x2a2622, 0, 2.0, 0)); p.push(P(box(0.66, 0.12, 0.46), C.white, 0, 1.2, 0, 0, 0, 0.5)); }
  return p;
}
function horseParts(knight) {
  const p = [
    P(box(0.62, 0.7, 1.8), knight ? 'TD' : C.horse, 0, 1.05, 0),
    P(box(0.3, 0.8, 0.36), C.horse, 0, 1.6, 0.95, 0.5, 0, 0),
    P(box(0.26, 0.3, 0.55), C.horse, 0, 1.95, 1.25),
    P(box(0.64, 0.74, 0.5), 'T', 0, 1.95, -0.1),
    P(sph(0.25), knight ? C.steel : C.skin, 0, 2.55, -0.1),
    P(box(0.1, 0.6, 0.1), 0x2a2622, 0, 0.95, -0.95, -0.4, 0, 0),
  ];
  for (const [x, z] of [[-0.22, 0.7], [0.22, 0.7], [-0.22, -0.7], [0.22, -0.7]]) p.push(P(box(0.17, 0.75, 0.17), 0x4a3220, x, 0.37, z));
  if (knight) { p.push(P(cyl(0.05, 0.05, 3, 5), C.wood, 0.45, 2.1, 0.5, 1.2, 0, 0)); p.push(P(box(0.08, 0.6, 0.5), 'T', -0.42, 1.95, 0)); }
  else p.push(P(box(0.07, 0.9, 0.05), C.steel, 0.44, 2.3, 0.2, 0.6, 0, 0));
  return p;
}
function unitGeo(type, team) {
  let p;
  if (type === 'rider') p = horseParts(false);
  else if (type === 'knight') p = horseParts(true);
  else if (type === 'catapult') {
    p = [P(box(1.3, 0.3, 2.2), C.wood, 0, 0.6, 0), P(box(0.16, 0.16, 2.4), C.woodD, 0, 1.3, -0.2, 0.7, 0, 0), P(box(0.5, 0.2, 0.5), C.woodD, 0, 2.05, -1.05),
      P(box(0.14, 1.2, 0.14), C.woodD, 0.5, 1.2, 0.4), P(box(0.14, 1.2, 0.14), C.woodD, -0.5, 1.2, 0.4), P(box(1.2, 0.14, 0.14), C.woodD, 0, 1.8, 0.4), P(box(0.5, 0.3, 0.06), 'T', 0, 0.95, 1.1)];
    for (const [x, z] of [[-0.72, 0.7], [0.72, 0.7], [-0.72, -0.7], [0.72, -0.7]]) p.push(P(cyl(0.45, 0.45, 0.14, 10), C.woodD, x, 0.45, z, 0, 0, Math.PI / 2));
  } else if (type === 'cannon') {
    p = [P(box(0.8, 0.26, 1.8), C.wood, 0, 0.65, -0.2), P(cyl(0.2, 0.28, 2.1, 10), C.iron, 0, 1.0, 0.25, Math.PI / 2 - 0.12, 0, 0), P(cyl(0.3, 0.3, 0.14, 10), 'T', 0, 0.98, -0.55, Math.PI / 2 - 0.12, 0, 0)];
    for (const x of [-0.6, 0.6]) p.push(P(cyl(0.62, 0.62, 0.14, 12), C.woodD, x, 0.62, 0, 0, 0, Math.PI / 2));
  } else p = humanParts(type);
  return merge(p, team);
}

function buildingGeo(type, team) {
  const s = BUILDINGS[type].size, w = s * CS;
  let p = [];
  switch (type) {
    case 'tc':
      p = [P(box(w - 0.6, 0.4, w - 0.6), C.stoneD, 0, 0.2, 0), P(box(w - 1.2, 2.6, w - 1.2), C.plaster, 0, 1.7, 0),
        P(cyl(0, (w - 0.6) * 0.72, 1.9, 4), C.tile, 0, 3.95, 0, 0, Math.PI / 4, 0),
        P(box(1.5, 4.6, 1.5), C.stone, w / 2 - 1.3, 2.3, w / 2 - 1.3), P(cyl(0, 1.25, 1.3, 4), 'T', w / 2 - 1.3, 5.25, w / 2 - 1.3, 0, Math.PI / 4, 0),
        P(box(1, 1.5, 0.1), C.woodD, -0.6, 1.15, w / 2 - 0.58), ...flag(-w / 2 + 0.8, w / 2 - 0.8, 4.6)];
      break;
    case 'house':
      p = [P(box(3, 1.6, 2.6), C.plaster, 0, 0.8, 0), gable(3.1, 3.3, 0.75, C.thatch, 1.6, Math.PI / 2), P(box(0.6, 1.0, 0.1), C.woodD, 0.4, 0.5, 1.31), P(box(0.5, 0.4, 0.1), 'T', -0.8, 1.0, 1.31), P(box(0.35, 0.9, 0.35), C.stoneD, -0.9, 2.5, -0.4)];
      break;
    case 'store':
      p = [P(box(3.2, 1.7, 3), C.wood, 0, 0.85, 0), gable(3.4, 3.4, 0.5, C.woodD, 1.7, 0), P(box(1.2, 1.2, 0.1), C.woodD, 0, 0.6, 1.51), P(box(0.7, 0.7, 0.7), C.thatch, 1.2, 0.35, 1.9), P(box(0.6, 0.6, 0.6), C.wood, -1.3, 0.3, 1.85), ...flag(-1.5, -1.4, 3.4)];
      break;
    case 'farm':
      p = [P(box(w - 0.3, 0.12, w - 0.3), C.soil, 0, 0.06, 0)];
      for (let i = 0; i < 7; i++) p.push(P(box(w - 0.7, 0.26, 0.36), C.white, 0, 0.2, -w / 2 + 0.75 + i * 0.75));
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.push(P(box(0.14, 0.7, 0.14), C.woodD, x * (w / 2 - 0.15), 0.35, z * (w / 2 - 0.15)));
      p.push(P(box(0.4, 0.3, 0.06), 'T', w / 2 - 0.4, 0.75, w / 2 - 0.15));
      break;
    case 'pasture':
      p = [P(box(w - 0.3, 0.1, w - 0.3), 0x86ad58, 0, 0.05, 0), P(box(1.8, 1.2, 1.4), C.wood, -w / 2 + 1.3, 0.6, -w / 2 + 1.1), gable(1.9, 1.6, 0.6, C.thatch, 1.2, 0)];
      p[p.length - 1] = P(cyl(1.9 / 1.732, 1.9 / 1.732, 1.6, 3), C.thatch, -w / 2 + 1.3, 1.2 + 0.33, -w / 2 + 1.1, -Math.PI / 2, 0, 0, 1, 1, 0.6);
      for (let i = 0; i < 4; i++) { const a = -w / 2 + 0.2 + i * (w - 0.4) / 3; for (const q of [[a, -w / 2 + 0.15], [a, w / 2 - 0.15], [-w / 2 + 0.15, a], [w / 2 - 0.15, a]]) p.push(P(box(0.14, 0.8, 0.14), C.woodD, q[0], 0.4, q[1])); }
      p.push(P(box(w - 0.3, 0.08, 0.08), C.woodD, 0, 0.6, w / 2 - 0.15), P(box(w - 0.3, 0.08, 0.08), C.woodD, 0, 0.6, -w / 2 + 0.15), P(box(0.08, 0.08, w - 0.3), C.woodD, w / 2 - 0.15, 0.6, 0), P(box(0.08, 0.08, w - 0.3), C.woodD, -w / 2 + 0.15, 0.6, 0));
      for (const [x, z] of [[0.8, 0.9], [1.6, -0.3], [-0.5, 1.5], [0.2, -0.2], [1.7, 1.6]]) { p.push(P(box(0.5, 0.4, 0.75), C.white, x, 0.5, z)); p.push(P(box(0.24, 0.24, 0.3), 0x3a3430, x, 0.62, z + 0.48)); }
      p.push(P(box(0.4, 0.3, 0.06), 'T', w / 2 - 0.4, 0.95, w / 2 - 0.15));
      break;
    case 'library':
      p = [P(box(3.4, 0.4, 3.4), C.stone, 0, 0.2, 0), P(box(2.6, 2.2, 2.4), C.white, 0, 1.5, -0.2), gable(3.3, 3.4, 0.5, 0x5e6f86, 2.6, 0)];
      for (const x of [-1.2, -0.4, 0.4, 1.2]) p.push(P(cyl(0.16, 0.18, 2.2, 8), C.white, x, 1.5, 1.35));
      p.push(P(box(0.9, 0.5, 0.06), 'T', 0, 2.2, 1.02));
      break;
    case 'smelter':
      p = [P(box(3, 1.4, 2.8), C.stoneD, 0, 0.7, 0), P(cyl(0.7, 1.1, 2.6, 8), C.stone, 0.5, 2.5, -0.3), P(cyl(0.5, 0.5, 0.2, 8), 0x2a2622, 0.5, 3.85, -0.3), P(box(0.9, 0.7, 0.1), 0xe2702a, 0.5, 0.55, 1.41), P(box(0.8, 0.5, 0.8), 0x5a4a44, -1.1, 1.65, 0.8), ...flag(-1.3, -1.2, 3.2)];
      break;
    case 'smithy':
      p = [P(box(3.2, 1.6, 2.4), C.woodD, 0, 0.8, -0.4), gable(3.4, 2.8, 0.55, C.tile, 1.6, 0), P(box(3.2, 0.12, 1.2), C.wood, 0, 1.55, 1.3), P(box(0.14, 1.5, 0.14), C.wood, -1.4, 0.75, 1.75), P(box(0.14, 1.5, 0.14), C.wood, 1.4, 0.75, 1.75),
        P(box(0.6, 0.5, 0.35), C.iron, 0, 0.5, 1.3), P(box(0.3, 0.5, 0.3), C.woodD, 0, 0.25, 1.3), P(box(0.5, 0.4, 0.06), 'T', -1.0, 1.1, 0.82)];
      p[1] = P(cyl(3.4 / 1.732, 3.4 / 1.732, 2.8, 3), C.tile, 0, 1.6 + 0.55, -0.4, -Math.PI / 2, 0, 0, 1, 1, 0.55);
      break;
    case 'barracks':
      p = [P(box(w - 0.8, 2, w - 2), C.stone, 0, 1, -0.5), P(cyl((w - 0.6) / 1.732, (w - 0.6) / 1.732, w - 1.6, 3), 'T', 0, 2 + 0.75, -0.5, -Math.PI / 2, 0, Math.PI / 2, 1, 1, 0.5),
        P(box(1.1, 1.5, 0.1), C.woodD, 0, 0.75, w / 2 - 1.48), P(box(0.12, 1.6, 0.12), C.wood, -1.8, 0.8, 2.3), P(box(1, 0.12, 0.12), C.wood, -1.8, 1.4, 2.3), P(box(0.5, 0.9, 0.3), C.straw, -1.8, 0.75, 2.3), ...flag(2.2, 2.2, 4)];
      break;
    case 'range':
      p = [P(box(w - 1, 0.2, 2), C.wood, 0, 0.1, -1.6), P(box(w - 1, 0.14, 2.4), C.woodD, 0, 2.2, -1.6, 0.18, 0, 0)];
      for (const x of [-2.3, 0, 2.3]) { p.push(P(box(0.16, 2.2, 0.16), C.wood, x, 1.1, -0.6)); p.push(P(box(0.16, 1.8, 0.16), C.wood, x, 0.9, -2.6)); }
      for (const x of [-1.6, 0, 1.6]) { p.push(P(cyl(0.55, 0.55, 0.14, 12), C.straw, x, 1.0, 2.2, Math.PI / 2, 0, 0)); p.push(P(cyl(0.22, 0.22, 0.16, 10), 'T', x, 1.0, 2.2, Math.PI / 2, 0, 0)); p.push(P(box(0.1, 1, 0.1), C.woodD, x, 0.5, 2.3)); }
      p.push(P(box(w - 1, 1.2, 0.14), C.woodD, 0, 0.6, -2.6), ...flag(-2.4, 2.4, 3.6));
      break;
    case 'stable':
      p = [P(box(w - 0.8, 1.7, 2.8), C.wood, 0, 0.85, -1.2), P(cyl(3.2 / 1.732, 3.2 / 1.732, w - 0.6, 3), C.thatch, 0, 1.7 + 0.5, -1.2, -Math.PI / 2, 0, Math.PI / 2, 1, 1, 0.55)];
      for (const x of [-1.6, 0, 1.6]) p.push(P(box(1, 1.2, 0.1), 0x2a2622, x, 0.6, 0.22));
      p.push(P(box(w - 0.6, 0.1, 0.1), C.woodD, 0, 0.7, 2.5), P(box(0.1, 0.1, 2.4), C.woodD, -w / 2 + 0.35, 0.7, 1.3), P(box(0.1, 0.1, 2.4), C.woodD, w / 2 - 0.35, 0.7, 1.3));
      for (const x of [-2.6, -0.9, 0.9, 2.6]) p.push(P(box(0.14, 0.9, 0.14), C.woodD, x, 0.45, 2.5));
      p.push(P(box(0.6, 0.7, 1.5), C.horse, 1.2, 1.0, 1.4), P(box(0.3, 0.7, 0.3), C.horse, 1.2, 1.5, 2.1), P(box(1.2, 0.5, 0.06), 'T', 0, 1.45, 0.25), P(box(1, 0.5, 1), C.straw, -1.6, 0.25, 1.5));
      break;
    case 'workshop':
      p = [P(box(w - 1.2, 2.2, w - 2.2), C.wood, -0.3, 1.1, -0.6), P(cyl((w - 1.8) / 1.732, (w - 1.8) / 1.732, w - 1, 3), C.woodD, -0.3, 2.2 + 0.6, -0.6, -Math.PI / 2, 0, Math.PI / 2, 1, 1, 0.55),
        P(new THREE.TorusGeometry(1.1, 0.12, 5, 12), C.woodD, w / 2 - 0.5, 1.3, -0.6, 0, Math.PI / 2, 0), P(box(0.1, 2.2, 0.1), C.woodD, w / 2 - 0.5, 1.3, -0.6), P(box(0.1, 0.1, 2.2), C.woodD, w / 2 - 0.5, 1.3, -0.6),
        P(box(1.6, 1.8, 0.1), 0x2a2622, -0.3, 0.9, 1.31), P(box(1.4, 0.3, 0.3), C.wood, 1.2, 0.15, 2.2), P(box(1.4, 0.3, 0.3), C.wood, 1.3, 0.4, 2.3, 0, 0.3, 0), ...flag(-2.3, 2.3, 4)];
      break;
    case 'mill':
      p = [P(cyl(1.2, 1.5, 3.2, 8), C.stone, 0, 1.6, 0), P(cyl(0, 1.45, 1.3, 8), C.thatch, 0, 3.85, 0), P(box(0.7, 1.1, 0.1), C.woodD, 0, 0.55, 1.46), P(cyl(0.12, 0.12, 0.9, 6), C.woodD, 0, 3.0, 1.5, Math.PI / 2, 0, 0)];
      for (let i = 0; i < 4; i++) p.push(P(box(0.5, 2.6, 0.06), C.white, Math.sin(i * Math.PI / 2 + 0.4) * 1.3, 3.0 + Math.cos(i * Math.PI / 2 + 0.4) * 1.3, 1.9, 0, 0, -(i * Math.PI / 2 + 0.4)));
      p.push(P(box(0.5, 0.4, 0.06), 'T', -0.9, 1.6, 1.25));
      break;
    case 'market':
      p = [P(box(w - 0.4, 0.16, w - 0.4), C.stone, 0, 0.08, 0)];
      for (const [x, z, c] of [[-1.5, -1.3, 'T'], [1.5, -1.3, 0xd9c98a], [-1.5, 1.4, 0xd9c98a], [1.5, 1.4, 'T']]) {
        p.push(P(box(1.9, 0.8, 1.3), C.wood, x, 0.55, z), P(box(2.2, 0.1, 1.7), c, x, 2.0, z, 0.22, 0, 0));
        for (const [a, b] of [[-0.95, -0.6], [0.95, -0.6], [-0.95, 0.6], [0.95, 0.6]]) p.push(P(box(0.1, 2, 0.1), C.woodD, x + a, 1, z + b));
        p.push(P(box(0.4, 0.3, 0.4), 0xb3242e, x - 0.5, 1.1, z), P(box(0.4, 0.3, 0.4), 0xd8c27a, x + 0.1, 1.1, z), P(box(0.4, 0.3, 0.4), 0x629c45, x + 0.6, 1.1, z + 0.2));
      }
      p.push(P(cyl(0.5, 0.6, 0.7, 10), C.stoneD, 0, 0.5, 0), ...flag(0, 0, 4.2));
      break;
    case 'palisade':
      for (const [x, z] of [[-0.62, -0.62], [0, -0.62], [0.62, -0.62], [-0.62, 0], [0, 0], [0.62, 0], [-0.62, 0.62], [0, 0.62], [0.62, 0.62]]) { const hh = 2.0 + ((x * 7 + z * 3 + 3) % 1) * 0.3; p.push(P(cyl(0.3, 0.33, hh, 6), (x + z) % 1.2 ? C.wood : C.woodD, x, hh / 2, z), P(cyl(0, 0.3, 0.4, 6), C.woodD, x, hh + 0.2, z)); }
      break;
    case 'wall':
      p = [P(box(2, 2.3, 2), C.stone, 0, 1.15, 0), P(box(2.02, 0.3, 2.02), C.stoneD, 0, 0.15, 0)];
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.push(P(box(0.6, 0.5, 0.6), C.stoneD, x * 0.7, 2.55, z * 0.7));
      break;
    case 'gate':
      p = [P(box(0.5, 3, 2), C.stoneD, -0.75, 1.5, 0), P(box(0.5, 3, 2), C.stoneD, 0.75, 1.5, 0), P(box(2, 0.6, 2), C.stoneD, 0, 3.0, 0), P(box(1.0, 2.5, 0.3), C.woodD, 0, 1.25, 0.6), P(box(1.0, 2.5, 0.3), C.woodD, 0, 1.25, -0.6),
        P(box(0.3, 2.5, 1.0), C.woodD, 0, 1.25, 0), P(box(0.7, 0.8, 2.06), 'T', 0, 3.0, 0), P(box(2.06, 0.8, 0.7), 'T', 0, 3.0, 0)];
      break;
    case 'tower':
      p = [P(box(1.6, 4.4, 1.6), C.stone, 0, 2.2, 0), P(box(1.95, 0.5, 1.95), C.stoneD, 0, 4.5, 0)];
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.push(P(box(0.5, 0.5, 0.5), C.stoneD, x * 0.72, 5.0, z * 0.72));
      p.push(P(box(0.3, 0.7, 0.1), 0x2a2622, 0, 3.2, 0.81), ...flag(0, 0, 6.4));
      break;
  }
  return merge(p, team);
}

function treeGeo(pine) {
  if (pine) return merge([P(cyl(0.12, 0.16, 0.9, 5), 0x5c4530, 0, 0.45, 0), P(cyl(0, 0.95, 1.5, 6), 0x2f5d38, 0, 1.5, 0), P(cyl(0, 0.75, 1.3, 6), 0x386b40, 0, 2.3, 0), P(cyl(0, 0.5, 1.1, 6), 0x43794a, 0, 3.0, 0)]);
  return merge([P(cyl(0.14, 0.2, 1.3, 5), 0x6b4f35, 0, 0.65, 0), P(new THREE.IcosahedronGeometry(1.05, 0), 0x4f8a3c, 0, 2.1, 0), P(new THREE.IcosahedronGeometry(0.7, 0), 0x629c45, 0.5, 2.7, 0.2)]);
}
function bushGeo() { const p = [P(new THREE.IcosahedronGeometry(0.6, 0), 0x3f7a35, 0, 0.45, 0), P(new THREE.IcosahedronGeometry(0.45, 0), 0x4c8a3d, 0.45, 0.35, 0.2)]; for (const [x, y, z] of [[0.2, 0.9, 0.3], [-0.3, 0.7, 0.4], [0.5, 0.65, -0.2], [-0.1, 0.8, -0.4], [0.7, 0.5, 0.4]]) p.push(P(sph(0.11), 0xb3242e, x, y, z)); return merge(p); }
function rockGeo(ore, gold) {
  const a = gold ? 0x7d7468 : ore ? 0x5d5148 : 0x9a968c, b = gold ? 0x8f8676 : ore ? 0x6b5d50 : 0xb3aea2;
  const p = [P(new THREE.DodecahedronGeometry(0.75, 0), a, 0, 0.4, 0, 0.3, 0.2, 0), P(new THREE.DodecahedronGeometry(0.5, 0), b, 0.6, 0.3, 0.3, 0, 0.5, 0.4), P(new THREE.DodecahedronGeometry(0.4, 0), a, -0.5, 0.25, 0.4)];
  if (ore) for (const [x, y, z] of [[0.2, 0.95, 0.2], [-0.35, 0.7, 0.1], [0.7, 0.6, 0.4], [0.1, 0.6, 0.65]]) p.push(P(new THREE.OctahedronGeometry(gold ? 0.2 : 0.16, 0), gold ? 0xf2c230 : 0xc9792e, x, y, z));
  return merge(p);
}
function fishGeo() {
  const p = [P(new THREE.TorusGeometry(0.8, 0.05, 4, 16), 0xcfe6f0, 0, 0.04, 0, Math.PI / 2, 0, 0), P(new THREE.TorusGeometry(0.45, 0.04, 4, 12), 0xcfe6f0, 0.2, 0.04, 0.1, Math.PI / 2, 0, 0)];
  for (const [x, z, r] of [[0.3, 0.2, 0.4], [-0.35, -0.1, 2.2], [0.05, -0.45, 4]]) { p.push(P(sph(0.16), 0xb9c4cc, x, 0.08, z, 0, r, 0, 2.2, 0.7, 0.8)); p.push(P(cyl(0, 0.14, 0.2, 4), 0x8f9aa3, x - Math.cos(r) * 0.42, 0.08, z + Math.sin(r) * 0.42, 0, r, Math.PI / 2)); }
  return merge(p);
}
function deerGeo() {
  const p = [P(box(0.42, 0.5, 1.15), 0x9a6b3f, 0, 0.95, 0), P(box(0.2, 0.6, 0.24), 0x9a6b3f, 0, 1.4, 0.6, 0.5, 0, 0), P(box(0.2, 0.22, 0.42), 0xa97a4c, 0, 1.68, 0.86), P(box(0.3, 0.2, 0.1), 0xf0ede4, 0, 1.05, -0.6)];
  for (const [x, z] of [[-0.14, 0.42], [0.14, 0.42], [-0.14, -0.42], [0.14, -0.42]]) p.push(P(box(0.11, 0.72, 0.11), 0x6e4a2e, x, 0.36, z));
  for (const x of [-0.12, 0.12]) p.push(P(box(0.05, 0.4, 0.05), 0xd8ccb0, x, 1.98, 0.74, 0, 0, x * 3));
  return merge(p);
}
function meatGeo() { return merge([P(box(0.5, 0.36, 1.15), 0x8a5a3a, 0, 0.2, 0, 0, 0.4, 0), P(box(0.42, 0.1, 0.6), 0xb5463a, 0, 0.42, 0, 0, 0.4, 0), P(box(0.2, 0.2, 0.4), 0x9a6b3f, 0.35, 0.14, 0.7, 0, 0.4, 0)]); }
