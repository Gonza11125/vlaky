'use strict';
// Kreslené modely: obytné domy, obchody, továrny, kanceláře, služby, silnice, auta, lidé, stromy.

const PAL = {
  walls: [[0xf3e2c0, 0xd2593f], [0xcfe3ef, 0x5f6b7a], [0xf2c9c0, 0x9a5b3c], [0xe4efd0, 0xc0563f], [0xf6efe0, 0x4f5e70]],
  hi: [0xe9dfcf, 0xd6e4ec, 0xf0d9c4, 0xdfe7d2, 0xe2d6ec],
  glass: 0x7fb0d6, glassD: 0x4e7fa8, conc: 0xd3d0c8, conc2: 0xa8a49b, dark: 0x3b4150, wood: 0x9b6b43, grass: 0x7cc463, leaf: [0x5aa848, 0x7cc35a, 0x3f8f45, 0x96c94f],
  trunk: 0x7a5236, red: 0xe0483a, white: 0xf7f5ee, yellow: 0xf4c447, blue: 0x3f82dd, olive: 0x6b7a3f, asphalt: 0x5a5f69, walk: 0xcfccc4, line: 0xf6f2e4, brick: 0xb8573f, steel: 0x9aa3ad,
};
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

// ---------- skládání geometrie ----------
class GB {
  constructor() { this.parts = []; }
  add(geo, col, x, y, z, rx, ry, rz, sx, sy, sz) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); geo.dispose();
    _m4.compose(_v.set(x || 0, y || 0, z || 0), _q.setFromEuler(_e.set(rx || 0, ry || 0, rz || 0)), _s.set(sx || 1, sy || 1, sz || 1));
    g.applyMatrix4(_m4); this.parts.push({ g, col }); return this;
  }
  box(w, h, d, col, x, y, z, ry) { return this.add(new THREE.BoxGeometry(w, h, d), col, x, (y || 0) + h / 2, z, 0, ry); }
  cyl(rt, rb, h, col, x, y, z, seg) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg || 10), col, x, (y || 0) + h / 2, z); }
  hcyl(r, len, col, x, y, z, ry, seg) { return this.add(new THREE.CylinderGeometry(r, r, len, seg || 10), col, x, y, z, Math.PI / 2, ry || 0, 0); }
  sph(r, col, x, y, z, sx, sy, sz, det) { return this.add(new THREE.IcosahedronGeometry(r, det == null ? 1 : det), col, x, y, z, 0, 0, 0, sx, sy, sz); }
  cone(r, h, col, x, y, z, seg) { return this.add(new THREE.ConeGeometry(r, h, seg || 8), col, x, (y || 0) + h / 2, z); }
  pyr(w, h, col, x, y, z) { return this.add(new THREE.ConeGeometry(w * 0.7072, h, 4), col, x, (y || 0) + h / 2, z, 0, Math.PI / 4, 0); }
  gable(w, h, d, col, x, y, z, ry) {   // sedlová střecha, hřeben ve směru d
    const g = new THREE.CylinderGeometry(1, 1, 1, 3); g.rotateX(-Math.PI / 2); g.translate(0, 0.5, 0); g.scale(w / 1.732, h / 1.5, d);
    return this.add(g, col, x, y || 0, z, 0, ry || 0, 0);
  }
  floors(n, fh, w, d, body, glass, x, y, z) {   // budova s pásy oken
    this.box(w, n * fh, d, body, x, y, z);
    for (let i = 0; i < n; i++) this.box(w + 0.06, fh * 0.42, d + 0.06, glass, x, (y || 0) + i * fh + fh * 0.32, z);
    return this;
  }
  tree(x, z, s, col) { this.cyl(0.12 * s, 0.16 * s, 0.9 * s, PAL.trunk, x, 0, z, 6); this.sph(0.75 * s, col || PAL.leaf[0], x, 1.25 * s, z, 1, 0.9, 1, 0); return this; }
  pine(x, z, s) { this.cyl(0.1 * s, 0.14 * s, 0.5 * s, PAL.trunk, x, 0, z, 6); this.cone(0.7 * s, 1.2 * s, 0x3f8f45, x, 0.4 * s, z, 7); this.cone(0.5 * s, 1 * s, 0x4c9e4c, x, 1.1 * s, z, 7); return this; }
  geo() {
    let n = 0; for (const p of this.parts) n += p.g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
    for (const p of this.parts) { const c = p.g.attributes.position.count; pos.set(p.g.attributes.position.array, o * 3); nor.set(p.g.attributes.normal.array, o * 3); _c.setHex(p.col);
      for (let i = 0; i < c; i++) { col[(o + i) * 3] = _c.r; col[(o + i) * 3 + 1] = _c.g; col[(o + i) * 3 + 2] = _c.b; } o += c; p.g.dispose(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeBoundingSphere(); return g;
  }
}
const H = TS / 2;   // polovina dlaždice
const SMOKE = {};   // klíč modelu -> komíny [x, y, z]

// ---------- obytné ----------
function mRes(d, l, v) {
  const b = new GB(), [wall, roof] = PAL.walls[v], hi = PAL.hi[v];
  if (!d) {
    if (l === 1) { b.box(2.2, 1.5, 1.9, wall, 0, 0, 0.2).gable(2.4, 1.1, 2.1, roof, 0, 1.5, 0.2, Math.PI / 2).box(0.45, 0.85, 0.08, PAL.wood, 0.3, 0, 1.18).box(0.45, 0.4, 0.06, PAL.glass, -0.55, 0.65, 1.17).box(0.25, 0.7, 0.25, PAL.brick, -0.6, 1.9, 0); b.tree(1.3, -1.2, 0.8, PAL.leaf[v % 4]); }
    else if (l === 2) { b.box(2.6, 1.7, 2.1, wall, -0.3, 0, 0.1).gable(2.8, 1.2, 2.3, roof, -0.3, 1.7, 0.1, Math.PI / 2).box(1.1, 1.1, 1.6, hi, 1.35, 0, 0.35).box(0.9, 0.75, 0.06, PAL.white, 1.35, 0, 1.16).box(0.5, 0.95, 0.08, PAL.wood, -0.2, 0, 1.16).box(0.6, 0.45, 0.06, PAL.glass, -1.0, 0.75, 1.16).tree(-1.4, -1.3, 0.7, PAL.leaf[(v + 1) % 4]); }
    else { b.floors(2, 1.3, 2.8, 2.6, wall, PAL.glass, 0, 0, 0).pyr(3.4, 1.3, roof, 0, 2.6, 0).box(1.2, 0.12, 0.6, PAL.white, 0.6, 1.3, 1.55).box(0.55, 1.0, 0.08, PAL.wood, -0.6, 0, 1.31).add(new THREE.CylinderGeometry(0.75, 0.75, 0.1, 14), 0x5fb4e0, -1.0, 0.05, -1.3).tree(1.4, -1.4, 0.75, PAL.leaf[v % 4]); }
    return b.geo();
  }
  const bal = [0xf08a5d, 0x6bbbd9, 0xf2c14e, 0x8fcf6b, 0xd98ad6][v];
  if (l === 1) { b.floors(3, 1.2, 3.2, 2.8, wall, PAL.glass, 0, 0, 0).gable(3.4, 1.2, 3.0, roof, 0, 3.6, 0, Math.PI / 2).box(0.7, 1.0, 0.1, PAL.wood, 0, 0, 1.45); }
  else if (l === 2) { b.floors(5, 1.2, 3.3, 3.0, hi, PAL.glass, 0, 0, 0).box(3.4, 0.25, 3.1, PAL.conc2, 0, 6, 0).box(0.9, 0.7, 0.9, PAL.conc2, 0.8, 6.2, -0.6); for (let i = 1; i < 5; i++) b.box(1.0, 0.12, 0.45, bal, -0.8, i * 1.2, 1.7); }
  else if (l === 3) { b.floors(8, 1.15, 3.5, 2.6, PAL.conc, 0x7f99ad, 0, 0, 0); for (let i = 1; i < 8; i++) { b.box(3.3, 0.5, 0.35, i % 2 ? bal : PAL.white, 0, i * 1.15 - 0.1, 1.45); } b.box(3.6, 0.2, 2.7, PAL.conc2, 0, 9.2, 0).box(0.8, 0.9, 0.8, PAL.conc2, -1, 9.4, 0); }
  else if (l === 4) { b.floors(12, 1.15, 3.0, 3.0, hi, PAL.glass, 0, 0, 0).floors(2, 1.15, 2.2, 2.2, hi, PAL.glass, 0, 13.8, 0).box(2.4, 0.25, 2.4, PAL.conc2, 0, 16.1, 0); for (let i = 2; i < 12; i += 2) b.box(0.9, 0.1, 0.4, bal, 0.9, i * 1.15, 1.7); }
  else { b.floors(20, 1.1, 2.8, 2.8, 0xdfe9f0, PAL.glassD, 0, 0, 0).box(3.0, 0.4, 3.0, PAL.white, 0, 22, 0).floors(3, 1.0, 1.9, 1.9, 0xdfe9f0, PAL.glassD, 0, 22.4, 0).cyl(0.06, 0.06, 2.4, PAL.steel, 0, 25.4, 0, 6); }
  return b.geo();
}
// ---------- obchody ----------
function awning(b, w, x, y, z, c1, c2) { const n = Math.round(w / 0.4); for (let i = 0; i < n; i++) b.add(new THREE.BoxGeometry(w / n, 0.06, 0.8), i % 2 ? c1 : c2, x - w / 2 + (i + 0.5) * w / n, y, z + 0.3, 0.4, 0, 0); }
function mCom(d, l, v) {
  const b = new GB(), [wall] = PAL.walls[v], c1 = [0xe0483a, 0x3f82dd, 0x47a85b, 0xf08a5d, 0x8a5bd6][v];
  if (!d) {
    if (l === 1) { b.box(2.8, 1.6, 2.4, wall, 0, 0, 0).box(2.9, 0.2, 2.5, PAL.conc2, 0, 1.6, 0).box(2.2, 0.9, 0.06, PAL.glass, 0, 0.1, 1.21); awning(b, 2.6, 0, 1.25, 1.2, c1, PAL.white); b.box(1.6, 0.5, 0.12, c1, 0, 1.8, 0.9); }
    else if (l === 2) { b.box(3.3, 2.4, 2.6, wall, 0, 0, 0).box(1.4, 1.0, 0.06, PAL.glass, -0.8, 0.1, 1.31).box(1.4, 1.0, 0.06, PAL.glass, 0.8, 0.1, 1.31); awning(b, 1.5, -0.8, 1.35, 1.3, c1, PAL.white); awning(b, 1.5, 0.8, 1.35, 1.3, 0x47a85b, PAL.yellow); b.box(3.3, 0.35, 0.06, PAL.glass, 0, 1.75, 1.31); }
    else { b.box(3.5, 1.9, 2.4, PAL.white, 0, 0, -0.6).box(3.6, 0.4, 2.5, c1, 0, 1.9, -0.6).box(2.4, 0.9, 0.06, PAL.glass, 0, 0.1, 0.61).box(3.5, 0.03, 1.4, PAL.asphalt, 0, 0, 1.2); for (let i = -1; i <= 1; i++) b.box(0.05, 0.04, 1.0, PAL.line, i * 0.9, 0.02, 1.25); b.box(0.9, 0.45, 0.5, 0xd94a4a, -0.5, 0.04, 1.3).box(0.9, 0.45, 0.5, 0x4a7fd9, 0.9, 0.04, 1.3); }
    return b.geo();
  }
  if (l === 1) { b.box(3.3, 1.3, 3.0, PAL.glass, 0, 0, 0).floors(2, 1.3, 3.3, 3.0, wall, PAL.glass, 0, 1.3, 0).box(3.4, 0.25, 3.1, PAL.conc2, 0, 3.9, 0); awning(b, 3.0, 0, 1.2, 1.5, c1, PAL.white); }
  else if (l === 2) { b.floors(4, 1.3, 3.5, 3.4, wall, PAL.glass, 0, 0, 0).box(3.6, 0.3, 3.5, PAL.conc2, 0, 5.2, 0).box(2.6, 0.9, 0.14, c1, 0, 4.2, 1.75).box(0.6, 0.6, 0.6, PAL.steel, 1, 5.5, -1); }
  else if (l === 3) { b.floors(3, 1.6, 3.7, 3.7, PAL.white, PAL.glassD, 0, 0, 0).cyl(1.0, 1.0, 5.6, PAL.glass, 0, 0, 1.0, 14).sph(1.0, PAL.glass, 0, 5.6, 1.0, 1, 0.6, 1).box(2.8, 0.7, 0.14, c1, 0, 3.8, 1.88); }
  else if (l === 4) { b.box(3.6, 1.6, 3.6, PAL.glass, 0, 0, 0).floors(11, 1.15, 3.0, 2.6, wall, PAL.glassD, 0, 1.6, 0).box(3.1, 0.3, 2.7, PAL.conc2, 0, 14.25, 0).box(2.0, 0.8, 0.14, c1, 0, 14.6, 0); }
  else { b.box(3.6, 2, 3.6, PAL.glassD, 0, 0, 0).floors(22, 1.1, 2.7, 2.7, 0x9fc3df, PAL.glassD, 0, 2, 0).floors(4, 1.1, 1.8, 1.8, 0x9fc3df, PAL.glassD, 0, 26.2, 0).cone(0.5, 4, PAL.steel, 0, 30.6, 0, 6); }
  return b.geo();
}
// ---------- průmysl ----------
function chimney(b, key, x, z, h, r) { b.cyl(r * 0.8, r, h, PAL.brick, x, 0, z, 8).cyl(r * 0.85, r * 0.85, 0.4, PAL.white, x, h * 0.75, z, 8); (SMOKE[key] = SMOKE[key] || []).push([x, h + 0.2, z]); }
function mInd(d, l, s, v, key) {
  const b = new GB(), wall = [0xd8d2c4, 0xc9d3d9, 0xe0d0b8][v];
  if (s === 2) {   // technologie: čisté bílé haly se solárními panely
    b.box(3.4, 1.6 + l * 0.6, 3.0, PAL.white, 0, 0, -0.2).box(3.5, 0.4, 0.1, 0x47a8d9, 0, 0.6 + l * 0.6, 1.31);
    for (let i = 0; i < 3; i++) b.add(new THREE.BoxGeometry(1, 0.06, 0.8), 0x2d4f7f, -1.05 + i * 1.05, 1.75 + l * 0.6, -0.4, -0.35, 0, 0);
    if (d) b.box(1.4, 3 + l, 1.4, PAL.glass, 1, 0, -0.6).sph(0.6, PAL.white, -1.1, 2.4 + l * 0.6, 0.8, 1, 1, 1);
    return b.geo();
  }
  if (!d) {
    if (l === 1) { b.box(3, 1.6, 2.4, wall, 0, 0, 0); for (let i = 0; i < 3; i++) b.add(new THREE.BoxGeometry(1, 0.7, 2.4), PAL.conc2, -1 + i, 1.9, 0, 0, 0, 0.6); b.box(1, 1, 0.06, PAL.steel, 0.6, 0, 1.21).box(0.5, 0.5, 0.5, PAL.wood, -1.2, 0, 1.5); }
    else if (l === 2) { b.box(3.4, 2.1, 2.4, wall, 0, 0, -0.4).gable(3.6, 0.6, 2.6, PAL.conc2, 0, 2.1, -0.4, Math.PI / 2).box(1.2, 1.3, 0.06, PAL.steel, -0.8, 0, 0.81).box(1.2, 1.3, 0.06, PAL.steel, 0.8, 0, 0.81); if (s === 1) b.cyl(0.6, 0.6, 3.2, PAL.white, 1.3, 0, 1.3).cone(0.62, 0.6, PAL.white, 1.3, 3.2, 1.3); else b.box(0.8, 0.6, 0.6, PAL.wood, 1.3, 0, 1.3).box(0.6, 0.5, 0.6, 0x4a7fd9, 0.4, 0, 1.4); }
    else { b.box(3.0, 2.4, 2.8, wall, -0.3, 0, -0.2).box(3.1, 0.25, 2.9, PAL.conc2, -0.3, 2.4, -0.2); chimney(b, key, 1.25, 1.1, 5.5, 0.32); if (s === 1) { b.cyl(0.5, 0.5, 3, PAL.white, -1.3, 0, 1.3).cyl(0.5, 0.5, 3, PAL.white, -0.2, 0, 1.4); } }
    return b.geo();
  }
  const big = l >= 3;
  b.box(3.6, 2.4 + l * 0.4, 2.6, wall, 0, 0, -0.5).box(3.7, 0.3, 2.7, PAL.conc2, 0, 2.4 + l * 0.4, -0.5);
  for (let i = 0; i < 3; i++) b.add(new THREE.BoxGeometry(1.2, 0.8, 2.6), PAL.conc2, -1.2 + i * 1.2, 3.0 + l * 0.4, -0.5, 0, 0, 0.6);
  chimney(b, key, -1.3, 1.2, 6 + l * 1.4, 0.4); if (big) chimney(b, key, -0.3, 1.3, 7 + l * 1.2, 0.36);
  if (s === 1) for (let i = 0; i < 2; i++) b.cyl(0.55, 0.55, 3.6, PAL.white, 0.6 + i * 1.1, 0, 1.3).cone(0.57, 0.5, PAL.white, 0.6 + i * 1.1, 3.6, 1.3);
  else { b.sph(0.8, PAL.steel, 1.1, 0.9, 1.2, 1, 1, 1).hcyl(0.12, 2.4, PAL.yellow, 0.2, 1.8, 1.2, Math.PI / 2, 6); }
  return b.geo();
}
// ---------- kanceláře ----------
function mOff(d, l, v) {
  const b = new GB(), body = [0xe6edf2, 0xdfe6dc, 0xece4da][v], gl = [PAL.glassD, 0x5d9aa8, 0x6b84b8][v];
  if (!d) {
    const n = l + 1; b.floors(n, 1.25, 3.0, 2.6, body, gl, 0, 0, 0).box(3.1, 0.25, 2.7, PAL.conc2, 0, n * 1.25, 0);
    if (l === 3) b.box(2.2, 0.3, 1.6, PAL.grass, 0, n * 1.25 + 0.25, 0).tree(0.6, -0.3, 0.45);
    return b.geo();
  }
  const fl = [0, 6, 10, 14, 20, 28][l];
  b.floors(fl, 1.1, 3.0, 3.0, body, gl, 0, 0, 0);
  if (l >= 3) b.floors(3, 1.1, 2.2, 2.2, body, gl, 0, fl * 1.1, 0);
  const top = fl * 1.1 + (l >= 3 ? 3.3 : 0);
  b.box(l >= 3 ? 2.3 : 3.1, 0.35, l >= 3 ? 2.3 : 3.1, PAL.conc2, 0, top, 0);
  if (l >= 4) b.cyl(0.07, 0.07, 3.5, PAL.steel, 0.5, top + 0.35, 0.5, 6).sph(0.12, PAL.red, 0.5, top + 3.9, 0.5, 1, 1, 1, 0);
  return b.geo();
}
// ---------- služby ----------
function mServ(t) {
  const s = SERV[t].size, W = s * TS - 0.6, b = new GB(), key = 'S:' + t;
  const lot = (c) => b.box(W, 0.08, W, c || PAL.conc, 0, 0, 0);
  switch (t) {
    case 'townhall': lot(0xe7dcc7); b.box(6, 3.4, 3.6, 0xf3e8cf, 0, 0, -0.8).gable(6.2, 1.5, 3.8, 0x8a5b45, 0, 3.4, -0.8, Math.PI / 2);
      for (let i = 0; i < 6; i++) b.cyl(0.18, 0.18, 2.6, PAL.white, -2.3 + i * 0.92, 0, 1.3, 8); b.box(5.6, 0.5, 0.7, PAL.white, 0, 2.6, 1.3).box(1.4, 6.5, 1.4, 0xf3e8cf, 0, 0, -0.8).pyr(1.9, 1.6, 0x4f7f6b, 0, 6.5, -0.8).cyl(0.42, 0.42, 0.1, PAL.white, 0, 5.3, -0.07, 14);
      b.cyl(0.04, 0.04, 2.2, PAL.steel, 0, 8.1, -0.8, 6).box(0.9, 0.5, 0.04, 0xe0483a, 0.45, 9.7, -0.8).cyl(0.9, 1.0, 0.35, PAL.conc2, 0, 0, 3.0, 14).cyl(0.75, 0.75, 0.1, 0x6fbde8, 0, 0.3, 3.0, 14); break;
    case 'coal': lot(0x9a968e); b.box(4.2, 4.4, 3.4, PAL.brick, -1.2, 0, 0).box(4.3, 0.4, 3.5, PAL.conc2, -1.2, 4.4, 0).box(2.4, 2.6, 2.4, PAL.conc2, 2.0, 0, -1.6);
      chimney(b, key, 1.8, 1.8, 13, 0.6); chimney(b, key, 2.9, 0.6, 11, 0.5); b.cone(1.3, 1.1, 0x2d2b2a, -1.6, 0, 2.6, 7).cone(1.0, 0.9, 0x3a3735, 0.2, 0, 2.9, 7); break;
    case 'gas': lot(0xa8b0b4); b.box(4.6, 3.6, 3, 0xc7d3dc, -1, 0, -1.2).box(4.7, 0.3, 3.1, PAL.steel, -1, 3.6, -1.2); chimney(b, key, 2.4, -1.6, 9, 0.38); chimney(b, key, 2.4, -0.4, 9, 0.38);
      b.sph(1.15, PAL.white, -1.8, 1.15, 2.2, 1, 1, 1).sph(1.15, PAL.white, 0.8, 1.15, 2.2, 1, 1, 1).hcyl(0.15, 4, PAL.yellow, -0.5, 0.5, 1.0, Math.PI / 2, 6); break;
    case 'wind': b.cyl(0.18, 0.32, 10, PAL.white, 0, 0, 0, 10).box(0.6, 0.6, 1.4, PAL.white, 0, 10, 0); break;
    case 'solar': lot(0x9cc77d); for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) b.add(new THREE.BoxGeometry(2.0, 0.08, 1.2), 0x2d4f7f, -2.4 + c * 2.4, 0.8, -2.6 + r * 1.75, -0.5, 0, 0).box(0.1, 0.7, 0.1, PAL.steel, -2.4 + c * 2.4, 0, -2.6 + r * 1.75); break;
    case 'nuclear': lot(0xb9b7b0);
      for (const x of [-3, 2.4]) { const pts = []; for (let i = 0; i <= 8; i++) { const yy = i / 8 * 9; pts.push(new THREE.Vector2(2.1 - Math.sin(i / 8 * Math.PI) * 0.7 + (i / 8) * 0.1, yy)); } b.add(new THREE.LatheGeometry(pts, 16), 0xe2e0da, x, 0, -2.6); (SMOKE[key] = SMOKE[key] || []).push([x, 9.5, -2.6]); }
      b.cyl(1.8, 1.8, 2.6, PAL.white, -1.5, 0, 2.6, 16).sph(1.8, PAL.white, -1.5, 2.6, 2.6, 1, 0.8, 1).box(3.6, 3, 2.6, 0xc4ccd4, 2.8, 0, 2.6); break;
    case 'pump': lot(); b.cyl(0.08, 0.08, 2.6, PAL.steel, -0.6, 0, -0.6, 6).cyl(0.08, 0.08, 2.6, PAL.steel, 0.6, 0, -0.6, 6).cyl(0.08, 0.08, 2.6, PAL.steel, -0.6, 0, 0.6, 6).cyl(0.08, 0.08, 2.6, PAL.steel, 0.6, 0, 0.6, 6)
      .cyl(1.0, 1.0, 1.6, 0x5fa8e0, 0, 2.6, 0, 14).cone(1.05, 0.5, 0x3f7fb8, 0, 4.2, 0, 14).box(1.4, 1.2, 1, PAL.white, 0.8, 0, 1.0); break;
    case 'sewage': lot(0xb7b9b0); for (const [x, z] of [[-2, -2], [2, -2], [-2, 2]]) b.cyl(1.5, 1.5, 0.7, PAL.conc2, x, 0, z, 16).cyl(1.3, 1.3, 0.1, 0x7f9a6a, x, 0.65, z, 16); b.box(2.4, 1.6, 2, PAL.white, 2, 0, 2); break;
    case 'dump': lot(0x8f8466); for (let i = 0; i < 9; i++) b.sph(1.0 + (i % 3) * 0.35, [0x7a6b52, 0x8c8c86, 0x6d5f48][i % 3], -2.4 + (i % 3) * 2.2, 0.3, -2.4 + Math.floor(i / 3) * 2.2, 1, 0.55, 1, 0);
      b.box(1.2, 0.7, 0.8, PAL.yellow, 2.6, 0, 2.6).box(0.5, 0.5, 0.6, PAL.dark, 2.8, 0.7, 2.6); break;
    case 'incin': lot(0xa8a49b); b.box(5, 3.4, 3.6, 0xb6c0c8, -0.6, 0, 0.6).box(5.1, 0.3, 3.7, PAL.steel, -0.6, 3.4, 0.6); chimney(b, key, 2.6, -2.4, 12, 0.5); break;
    case 'recycle': lot(); b.box(5, 2.6, 3.2, 0x7fbf6a, -0.6, 0, -1.4).gable(5.2, 0.8, 3.4, PAL.white, -0.6, 2.6, -1.4, Math.PI / 2); for (let i = 0; i < 5; i++) b.box(0.9, 0.9, 1.3, [0x3f82dd, PAL.yellow, 0x47a85b, PAL.red, 0x8a5bd6][i], -2.6 + i * 1.3, 0, 2.2); break;
    case 'police': lot(); b.box(3.0, 2.2, 2.2, PAL.white, 0, 0, -0.5).box(3.1, 0.3, 2.3, 0x2f5fbf, 0, 2.2, -0.5).box(3.02, 0.35, 2.22, 0x2f5fbf, 0, 1.0, -0.5).box(1.6, 0.4, 0.1, 0x2f5fbf, 0, 1.6, 0.66).cyl(0.04, 0.04, 1.8, PAL.steel, 1.2, 2.5, -1.2, 6);
      b.box(1.2, 0.45, 0.6, PAL.white, -0.7, 0, 1.3).box(1.2, 0.12, 0.62, 0x2f5fbf, -0.7, 0.22, 1.3).box(0.3, 0.1, 0.2, 0xe0483a, -0.7, 0.45, 1.3); break;
    case 'policehq': lot(); b.floors(4, 1.3, 6, 3.4, PAL.white, 0x2f5fbf, 0, 0, -1.2).box(6.1, 0.3, 3.5, 0x2f5fbf, 0, 5.2, -1.2).cyl(1.1, 1.1, 0.05, 0xe8e4d8, 1.4, 5.5, -1.2, 14).box(1.2, 0.06, 0.25, PAL.yellow, 1.4, 5.56, -1.2);
      for (let i = 0; i < 3; i++) b.box(1.2, 0.45, 0.6, PAL.white, -2.4 + i * 1.6, 0, 2.2).box(1.2, 0.12, 0.62, 0x2f5fbf, -2.4 + i * 1.6, 0.22, 2.2); break;
    case 'fire': lot(); b.box(3.2, 2.4, 2.4, PAL.brick, -0.2, 0, -0.5).box(3.3, 0.3, 2.5, PAL.conc2, -0.2, 2.4, -0.5).box(1.0, 1.5, 0.06, PAL.white, -0.9, 0, 0.72).box(1.0, 1.5, 0.06, PAL.white, 0.4, 0, 0.72).box(0.8, 4.2, 0.8, PAL.brick, 1.3, 0, -1.2)
      .box(1.6, 0.7, 0.7, 0xd9332b, -0.6, 0, 1.4).box(1.4, 0.1, 0.2, PAL.steel, -0.6, 0.75, 1.4); break;
    case 'barracks': lot(0x9a9a7a); for (const [x, z, w, d] of [[0, -5.6, 11.4, 0.3], [0, 5.6, 11.4, 0.3], [-5.6, 0, 0.3, 11.4], [5.6, 0, 0.3, 11.4]]) b.box(w, 1, d, 0xb9b39c, x, 0, z);
      b.box(4.5, 2.4, 2.4, PAL.olive, -2.5, 0, -3.5).box(4.6, 0.3, 2.5, 0x55613a, -2.5, 2.4, -3.5).box(3, 2.4, 2.4, PAL.olive, 3, 0, -3.5);
      for (let i = 0; i < 3; i++) b.pyr(1.6, 1.2, 0x7e8a52, -3.5 + i * 2.2, 0, 1);
      for (let i = 0; i < 2; i++) b.box(1.6, 0.6, 1, 0x5a6a35, 1.8 + i * 2.2, 0, 2.8).box(0.8, 0.4, 0.7, 0x5a6a35, 1.8 + i * 2.2, 0.6, 2.8).hcyl(0.07, 1.2, 0x3d4a25, 1.8 + i * 2.2 + 0.8, 0.85, 2.8, Math.PI / 2, 6);
      b.cyl(0.05, 0.05, 4, PAL.steel, 0, 0, 0, 6).box(1.1, 0.6, 0.05, 0x3f82dd, 0.55, 3.4, 0); break;
    case 'intel': lot(); b.box(3, 3.6, 2.6, 0x8d929a, 0, 0, -0.3).box(3.06, 0.2, 2.66, 0x3b4150, 0, 2.6, -0.3).cyl(0.04, 0.04, 2.4, PAL.steel, 1, 3.6, -1, 6).sph(0.55, PAL.white, -0.8, 4.0, -0.6, 1, 0.5, 1).cyl(0.06, 0.06, 0.4, PAL.steel, -0.8, 3.6, -0.6, 6); break;
    case 'clinic': lot(); b.floors(2, 1.3, 3, 2.4, PAL.white, 0x8fc7e8, 0, 0, -0.4).box(1.0, 0.3, 0.06, PAL.red, 0, 1.9, 0.82).box(0.3, 1.0, 0.06, PAL.red, 0, 1.55, 0.82).box(1.3, 0.6, 0.65, PAL.white, 0.6, 0, 1.4).box(1.3, 0.12, 0.66, PAL.red, 0.6, 0.3, 1.4); break;
    case 'hospital': lot(); b.floors(5, 1.3, 6.2, 3.2, PAL.white, 0x8fc7e8, 0, 0, -1.6).floors(3, 1.3, 2.8, 3.4, PAL.white, 0x8fc7e8, -1.8, 0, 1.6).cyl(1.1, 1.1, 0.06, 0x56a34f, 1.2, 6.5, -1.6, 14);
      b.box(1.6, 0.4, 0.08, PAL.red, 1.6, 4.4, 0).box(0.45, 1.5, 0.08, PAL.red, 1.6, 3.85, 0).box(1.3, 0.6, 0.65, PAL.white, 2.2, 0, 2.6).box(1.3, 0.12, 0.66, PAL.red, 2.2, 0.3, 2.6); break;
    case 'school': lot(0xd8cdb8); b.floors(2, 1.4, 3.2, 2, 0xf2b25c, PAL.glass, 0, 0, -0.8).box(3.3, 0.25, 2.1, PAL.brick, 0, 2.8, -0.8).box(2.8, 0.05, 1.3, 0x4fa0d9, 0, 0, 1.1).box(0.7, 0.7, 0.7, PAL.red, 0.8, 0, 1.2).cyl(0.04, 0.04, 2.6, PAL.steel, -1.4, 0, 1.4, 6).box(0.6, 0.4, 0.04, 0xe0483a, -1.1, 2.2, 1.4); break;
    case 'highschool': lot(0xd8cdb8); b.floors(3, 1.4, 6.4, 2.6, 0xd98b5a, PAL.glass, 0, 0, -2.4).box(6.5, 0.3, 2.7, PAL.brick, 0, 4.2, -2.4).box(6.6, 0.05, 3.4, 0x5fb84f, 0, 0, 1.7);
      for (const z of [0.6, 2.8]) b.box(6.2, 0.06, 0.06, PAL.white, 0, 0.05, z); break;
    case 'university': lot(0xcfe0b5); b.floors(3, 1.6, 6, 3.6, 0xf1e6cf, PAL.glass, 0, 0, -3).cyl(1.6, 1.6, 1.4, 0xf1e6cf, 0, 4.8, -3, 16).sph(1.6, 0x5f9f8a, 0, 6.2, -3, 1, 0.9, 1);
      for (let i = 0; i < 6; i++) b.cyl(0.18, 0.18, 3.2, PAL.white, -2.4 + i * 0.96, 0, -1, 8); b.floors(2, 1.5, 3, 5.6, 0xe6d6b8, PAL.glass, -4, 0, 2.4).floors(2, 1.5, 3, 5.6, 0xe6d6b8, PAL.glass, 4, 0, 2.4);
      b.tree(0, 2.5, 1).tree(-1.5, 4.3, 0.8).tree(1.6, 4.4, 0.9); break;
    case 'institute': lot(); b.floors(4, 1.3, 5.5, 3.2, PAL.white, 0x5d9aa8, -0.5, 0, -1.6).sph(1.4, PAL.white, 2.2, 0.8, 2.0, 1, 1, 1).box(1.2, 0.8, 1.2, PAL.conc2, 2.2, 0, 2.0); break;
    case 'park': b.box(W, 0.1, W, 0x8fd06a, 0, 0, 0).box(W, 0.11, 0.7, 0xe2d4b0, 0, 0, 0).tree(-1, -1, 0.9).tree(1.1, 1.2, 1, PAL.leaf[1]).pine(1.2, -1.1, 1).box(0.9, 0.3, 0.3, PAL.wood, -1, 0, 1.2); break;
    case 'bigpark': b.box(W, 0.1, W, 0x8fd06a, 0, 0, 0).cyl(2.0, 2.0, 0.12, 0x5fb4e0, 1.2, 0.02, 1.2, 18).box(0.8, 0.12, W, 0xe2d4b0, -1.5, 0, 0).box(W, 0.12, 0.8, 0xe2d4b0, 0, 0, -1.5);
      for (const [x, z, c] of [[-3, -3, 0], [-0.2, -3.2, 1], [2.8, -3, 2], [-3, 0.6, 1], [-3.1, 3, 3], [3.2, -0.5, 0]]) b.tree(x, z, 1, PAL.leaf[c]); b.cyl(0.7, 0.8, 1.2, PAL.white, -1.5, 0, -1.5, 8).cone(0.95, 0.7, PAL.red, -1.5, 1.2, -1.5, 8); break;
    case 'plaza': b.box(W, 0.12, W, 0xdcd3c2, 0, 0, 0); for (let i = 0; i < 4; i++) b.box(0.7, 0.13, 0.7, 0xc5b9a3, -1.05 + i * 0.7, 0, (i % 2) * 0.7 - 1.05); b.cyl(0.8, 0.9, 0.4, PAL.conc2, 0, 0, 0, 12).cyl(0.65, 0.65, 0.1, 0x6fbde8, 0, 0.35, 0, 12).cyl(0.12, 0.15, 1.1, PAL.conc2, 0, 0.4, 0, 8).tree(1.3, 1.3, 0.6); break;
    case 'stadium': lot(0xb9b3a4); { const pts = []; pts.push(new THREE.Vector2(4.2, 0), new THREE.Vector2(5.6, 0), new THREE.Vector2(5.6, 3.2), new THREE.Vector2(5.2, 3.2), new THREE.Vector2(4.0, 0.6));
      b.add(new THREE.LatheGeometry(pts, 24), 0xd9d6cc, 0, 0, 0, 0, 0, 0, 1, 1, 0.75); b.add(new THREE.CylinderGeometry(4.15, 4.15, 0.1, 24), 0x56b04a, 0, 0.05, 0, 0, 0, 0, 1, 1, 0.75);
      for (const [x, z] of [[-4.6, -3.6], [4.6, -3.6], [-4.6, 3.6], [4.6, 3.6]]) b.cyl(0.08, 0.08, 6, PAL.steel, x, 0, z, 6).box(0.8, 0.5, 0.2, PAL.yellow, x, 6, z); } break;
    case 'bus': lot(); b.box(3.2, 2, 2, 0xd9dde2, 0, 0, -0.9).gable(3.4, 0.6, 2.2, 0x2f8f5f, 0, 2, -0.9, Math.PI / 2).box(2.4, 0.8, 0.7, PAL.yellow, 0, 0, 1.1).box(2.4, 0.3, 0.72, PAL.glass, 0, 0.45, 1.1); break;
    case 'metro': b.box(W, 0.12, W, 0xdcd3c2, 0, 0, 0).box(2.4, 1.4, 1.6, PAL.glass, 0, 0, 0).box(2.6, 0.2, 1.8, PAL.white, 0, 1.4, 0).cyl(0.06, 0.06, 2.4, PAL.steel, 1.4, 0, 1.2, 6).box(0.8, 0.8, 0.12, 0xd9332b, 1.4, 2.2, 1.2).box(0.5, 0.5, 0.14, PAL.white, 1.4, 2.35, 1.2); break;
    case 'station': lot(0xa8a49b); for (const z of [-1.6, 1.4]) { b.box(W, 0.06, 0.12, PAL.steel, 0, 0.1, z - 0.4).box(W, 0.06, 0.12, PAL.steel, 0, 0.1, z + 0.4); }
      for (let i = 0; i < 3; i++) b.box(2.2, 1.2, 1.0, [0x3f82dd, 0xd9332b, 0x47a85b][i], -2.4 + i * 2.4, 0.2, -1.6); b.box(5, 2, 1.6, 0xd8cfb8, 0, 0, 3.1).gable(5.2, 0.8, 1.8, PAL.brick, 0, 2, 3.1, Math.PI / 2); break;
    case 'port': lot(0xb3aea2); for (let i = 0; i < 12; i++) b.box(1.8, 0.8, 0.8, [0xd9332b, 0x3f82dd, PAL.yellow, 0x47a85b, 0xf08a5d][i % 5], -3.8 + (i % 4) * 2.0, Math.floor(i / 8) * 0.8, -3.6 + (Math.floor(i / 4) % 2) * 0.9);
      for (const x of [-2, 3]) { b.box(0.3, 7, 0.3, PAL.yellow, x - 1, 0, 2.6).box(0.3, 7, 0.3, PAL.yellow, x + 1, 0, 2.6).box(2.6, 0.4, 0.4, PAL.yellow, x, 7, 2.6).box(0.4, 0.4, 5.5, PAL.yellow, x, 7.4, 3.2); }
      b.box(4, 2.4, 2.6, PAL.white, 2.8, 0, -3.2); break;
    case 'airport': lot(0x8fc86f); b.box(W, 0.1, 3.6, PAL.asphalt, 0, 0.02, 4.4); for (let i = 0; i < 8; i++) b.box(1.0, 0.11, 0.18, PAL.line, -6.5 + i * 1.9, 0.03, 4.4);
      b.box(8, 2.6, 3.4, 0xe8eef2, -2, 0, -3.6).box(8.1, 0.3, 3.5, PAL.glassD, -2, 2.6, -3.6).cyl(0.5, 0.6, 6, PAL.white, 5, 0, -4, 10).cyl(1, 0.9, 1, PAL.glass, 5, 6, -4, 10);
      b.add(new THREE.CylinderGeometry(0.35, 0.3, 4.2, 10), PAL.white, 1.5, 0.9, 0.6, 0, 0, Math.PI / 2).box(1.0, 0.1, 4.4, PAL.white, 1.5, 0.85, 0.6).box(0.5, 0.9, 0.1, PAL.red, -0.4, 0.9, 0.6); break;
    case 'warehouse': lot(); for (const z of [-2, 2]) { b.box(6.4, 2.4, 2.8, 0xc9cdd2, 0, 0, z); b.add(new THREE.CylinderGeometry(1.4, 1.4, 6.4, 12, 1, false, 0, Math.PI), 0x8f99a3, 0, 2.4, z, 0, 0, Math.PI / 2); }
      b.box(1.6, 0.9, 0.8, 0xe0483a, 2.4, 0, 0.1); break;
    case 'dike': b.box(TS - 0.1, 1.4, TS - 0.1, 0x9a9a8e, 0, 0, 0).box(TS - 0.6, 0.15, TS - 0.6, 0x7fbf5a, 0, 1.4, 0); break;
  }
  return b.geo();
}
function mRubble() { const b = new GB(); b.box(3.4, 0.1, 3.4, 0x9a9185, 0, 0, 0); for (let i = 0; i < 7; i++) b.sph(0.45 + (i % 3) * 0.2, [0x8a8279, 0x6e675e, 0xa39787][i % 3], -1.1 + (i % 3) * 1.1, 0.2, -1 + Math.floor(i / 3) * 1, 1, 0.6, 1, 0); b.box(1.6, 0.12, 0.2, PAL.wood, 0.4, 0.5, 0.3, 0.6); return b.geo(); }
function mTree(v) { const b = new GB(); if (v < 2) b.tree(0, 0, 1, PAL.leaf[v * 2]); else b.pine(0, 0, 1.1); return b.geo(); }
function mRoad(mask, bridge) {   // N=1 E=2 S=4 W=8
  const b = new GB(), h = H;
  if (bridge) { b.box(TS, 0.5, TS, PAL.conc2, 0, -0.45, 0); if (!(mask & 1) || !(mask & 4)) b.box(0.4, 1.4, 0.4, PAL.conc2, 0, -1.4, 0); }
  b.box(TS, 0.06, TS, PAL.asphalt, 0, 0, 0);
  const curb = bridge ? 0x8d96a0 : PAL.walk, ch = bridge ? 0.5 : 0.1;
  if (!(mask & 1)) b.box(TS, ch, 0.5, curb, 0, 0, -h + 0.25);
  if (!(mask & 4)) b.box(TS, ch, 0.5, curb, 0, 0, h - 0.25);
  if (!(mask & 8)) b.box(0.5, ch, TS, curb, -h + 0.25, 0, 0);
  if (!(mask & 2)) b.box(0.5, ch, TS, curb, h - 0.25, 0, 0);
  const n = ((mask & 1) ? 1 : 0) + ((mask & 2) ? 1 : 0) + ((mask & 4) ? 1 : 0) + ((mask & 8) ? 1 : 0);
  if (mask === 5) for (const z of [-1.2, 0.8]) b.box(0.12, 0.07, 0.8, PAL.line, 0, 0, z);
  else if (mask === 10) for (const x of [-1.2, 0.8]) b.box(0.8, 0.07, 0.12, PAL.line, x, 0, 0);
  else if (n >= 3 && !bridge) { for (const [m, x, z, ry] of [[1, 0, -1.6, 0], [4, 0, 1.6, 0], [2, 1.6, 0, 1], [8, -1.6, 0, 1]]) if (mask & m) for (let i = -2; i <= 2; i++) b.box(ry ? 0.6 : 0.28, 0.07, ry ? 0.28 : 0.6, PAL.line, x + (ry ? 0 : i * 0.55), 0, z + (ry ? i * 0.55 : 0)); }
  return b.geo();
}
// ---------- vozidla a lidé ----------
function mCar(kind) {
  const b = new GB();
  if (kind === 'bus') { b.box(3.2, 1.1, 1.0, PAL.white, 0, 0.2, 0).box(3.22, 0.35, 1.02, PAL.glass, 0, 0.75, 0); }
  else if (kind === 'fire') { b.box(2.6, 0.9, 1.0, 0xd9332b, 0, 0.2, 0).box(0.8, 0.45, 0.95, PAL.glass, 0.9, 0.85, 0).box(1.6, 0.1, 0.25, PAL.steel, -0.3, 1.15, 0); }
  else if (kind === 'police') { b.box(1.7, 0.45, 0.85, PAL.white, 0, 0.2, 0).box(0.9, 0.38, 0.78, PAL.glass, -0.1, 0.65, 0).box(1.72, 0.12, 0.87, 0x2f5fbf, 0, 0.38, 0).box(0.25, 0.12, 0.6, 0x3a7bff, -0.1, 1.03, 0); }
  else if (kind === 'army') { b.box(2.4, 0.9, 1.0, 0x5c6b35, 0, 0.25, 0).box(1.4, 0.7, 1.02, 0x6f7d44, -0.4, 1.15, 0); }
  else if (kind === 'tank') { b.box(2.4, 0.6, 1.4, 0x5c6b35, 0, 0.2, 0).box(1.1, 0.45, 0.9, 0x55613a, -0.1, 0.8, 0).hcyl(0.09, 1.6, 0x3d4a25, 1.2, 1.0, 0, Math.PI / 2, 6); }
  else if (kind === 'etank') { b.box(2.4, 0.6, 1.4, 0x8a4a3a, 0, 0.2, 0).box(1.1, 0.45, 0.9, 0x6e3b2e, -0.1, 0.8, 0).hcyl(0.09, 1.6, 0x3d2a25, 1.2, 1.0, 0, Math.PI / 2, 6); }
  else { b.box(1.6, 0.45, 0.8, PAL.white, 0, 0.2, 0).box(0.85, 0.38, 0.74, PAL.glass, -0.1, 0.65, 0); }
  for (const x of [-0.55, 0.55]) for (const z of [-0.42, 0.42]) b.hcyl(0.2, 0.12, PAL.dark, x * (kind === 'bus' ? 2 : 1), 0.2, z, 0, 8);
  return b.geo();
}
function mPerson(kind) {
  const b = new GB(), body = kind === 'police' ? 0x26407a : kind === 'army' ? 0x55613a : kind === 'enemy' ? 0x7a3a30 : PAL.white;
  b.cyl(0.2, 0.24, 0.85, body, 0, 0, 0, 7).sph(0.19, kind === 'police' || kind === 'army' || kind === 'enemy' ? 0x2d2f36 : 0xe8bf98, 0, 1.03, 0, 1, 1, 1, 0);
  if (kind === 'police') b.box(0.08, 0.7, 0.5, 0xb9d6ee, 0.28, 0.15, 0);
  if (kind === 'protest') b.cyl(0.025, 0.025, 1.0, PAL.wood, 0.28, 0.4, 0, 4).box(0.05, 0.4, 0.6, PAL.white, 0.28, 1.25, 0);
  return b.geo();
}
