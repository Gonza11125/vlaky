'use strict';
// Modely: domy, paneláky, mrakodrapy, obchody, továrny, kanceláře, služby, silnice, auta, lidé, stromy.
// Každý díl má materiál (fasáda, střecha, sklo …); geometrie se skládá do skupin podle materiálu.

const PAL = {
  walls: [[0xefe6d6, 0xa2513a], [0xe8e4dc, 0x4a4f57], [0xdcc9a8, 0x7a4a36], [0xd3d9dc, 0x8f3f2e], [0xe9dcc4, 0x5c6168]],
  hi: [0xe6e2da, 0xd8d5cf, 0xd2c7b6, 0xdedad1, 0xcdd0d3],
  off: [0xdfe7ee, 0xcbd6de, 0xd9dcdc], glass: 0x9fb4c4, conc: 0xc9c6bf, conc2: 0xa8a49b, dark: 0x34383f, wood: 0x7a5a3e, grass: 0x5c7a43,
  leaf: [0x4f7a36, 0x62873f, 0x3f6a35, 0x748f42], trunk: 0x5a4532, red: 0xb8382d, white: 0xf2f0ea, yellow: 0xd9a933, blue: 0x2f5f9f, olive: 0x5a6a3a,
  asphalt: 0x4a4d52, walk: 0xb3b0a8, line: 0xeeeeea, brick: 0xa4563d, steel: 0x8d949b, sand: 0xd9c9a0, water: 0x35606f,
};
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

class GB {
  constructor() { this.parts = []; this.m = MK.plain; this.uvo = null; }
  use(k) { this.m = MK[k]; return this; }
  add(geo, col, x, y, z, rx, ry, rz, sx, sy, sz) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); geo.dispose();
    _m4.compose(_v.set(x || 0, y || 0, z || 0), _q.setFromEuler(_e.set(rx || 0, ry || 0, rz || 0)), _s.set(sx || 1, sy || 1, sz || 1));
    g.applyMatrix4(_m4); this.parts.push({ g, col, m: this.m, uvo: this.uvo }); return this;
  }
  box(w, h, d, col, x, y, z, ry) { return this.add(new THREE.BoxGeometry(w, h, d), col, x, (y || 0) + h / 2, z, 0, ry); }
  cyl(rt, rb, h, col, x, y, z, seg) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg || 12), col, x, (y || 0) + h / 2, z); }
  hcyl(r, len, col, x, y, z, ry, seg) { return this.add(new THREE.CylinderGeometry(r, r, len, seg || 10), col, x, y, z, Math.PI / 2, ry || 0, 0); }
  sph(r, col, x, y, z, sx, sy, sz, det) { return this.add(new THREE.IcosahedronGeometry(r, det == null ? 1 : det), col, x, y, z, 0, 0, 0, sx, sy, sz); }
  cone(r, h, col, x, y, z, seg) { return this.add(new THREE.ConeGeometry(r, h, seg || 10), col, x, (y || 0) + h / 2, z); }
  pyr(w, h, col, x, y, z, d) { return this.add(new THREE.ConeGeometry(0.7072, 1, 4), col, x, (y || 0) + h / 2, z, 0, Math.PI / 4, 0, w, h, d || w); }
  gable(w, h, d, col, x, y, z, ry) { const g = new THREE.CylinderGeometry(1, 1, 1, 3); g.rotateX(-Math.PI / 2); g.translate(0, 0.5, 0); g.scale(w / 1.732, h / 1.5, d); return this.add(g, col, x, y || 0, z, 0, ry || 0, 0); }
  // budova s fasádou: okna sedí na patra
  facade(m, n, fh, w, d, col, x, y, z) { const pm = this.m, po = this.uvo, rp = TREP[m] || [1, 1]; this.m = MK[m]; this.uvo = [MUV[m][0] * rp[0], fh * rp[1]]; this.box(w, n * fh, d, col, x, y, z); this.m = pm; this.uvo = po; return this; }
  parapet(w, d, y, col, x, z) { const t = 0.12, h = 0.35; this.use('plain'); this.box(w, h, t, col, x || 0, y, (z || 0) - d / 2 + t / 2).box(w, h, t, col, x || 0, y, (z || 0) + d / 2 - t / 2).box(t, h, d, col, (x || 0) - w / 2 + t / 2, y, z || 0).box(t, h, d, col, (x || 0) + w / 2 - t / 2, y, z || 0); return this; }
  tree(x, z, s, col) { const pm = this.m; this.use('plain').cyl(0.1 * s, 0.15 * s, 1.1 * s, PAL.trunk, x, 0, z, 6); this.use('leaf'); const c = col || PAL.leaf[0];
    this.sph(0.75 * s, c, x, 1.55 * s, z, 1, 0.85, 1).sph(0.5 * s, c, x + 0.35 * s, 1.85 * s, z + 0.15 * s, 1, 0.9, 1).sph(0.5 * s, c, x - 0.3 * s, 1.75 * s, z - 0.25 * s, 1, 0.9, 1); this.m = pm; return this; }
  pine(x, z, s) { const pm = this.m; this.use('plain').cyl(0.08 * s, 0.12 * s, 0.6 * s, PAL.trunk, x, 0, z, 6); this.use('leaf').cone(0.75 * s, 1.5 * s, 0x35593a, x, 0.45 * s, z, 9).cone(0.55 * s, 1.2 * s, 0x3b6240, x, 1.2 * s, z, 9).cone(0.35 * s, 0.9 * s, 0x426b45, x, 1.85 * s, z, 9); this.m = pm; return this; }
  geo() {
    const B = new Map();
    for (const p of this.parts) {
      const pos = p.g.attributes.position.array, nor = p.g.attributes.normal.array, n = pos.length / 9;
      _c.setHex(p.col).convertSRGBToLinear();
      for (let t = 0; t < n; t++) {
        const o = t * 9; let nx = 0, ny = 0, nz = 0; for (let v = 0; v < 3; v++) { nx += nor[o + v * 3]; ny += nor[o + v * 3 + 1]; nz += nor[o + v * 3 + 2]; }
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        let m = p.m, cr = _c.r, cg = _c.g, cb = _c.b; if (FACADE.has(m) && Math.abs(ny) > 0.7) { m = ny > 0 ? MK.roof : MK.plain; cr = lerp(cr, 0.2, 0.62); cg = lerp(cg, 0.2, 0.62); cb = lerp(cb, 0.19, 0.62); }
        const sc = (p.uvo && m === p.m) ? p.uvo : MUV[MKN[m]];
        let b = B.get(m); if (!b) { b = { pos: [], nor: [], col: [], uv: [] }; B.set(m, b); }
        for (let v = 0; v < 3; v++) {
          const x = pos[o + v * 3], y = pos[o + v * 3 + 1], z = pos[o + v * 3 + 2];
          const ao = Math.abs(ny) < 0.7 && m !== MK.leaf ? 0.6 + 0.4 * Math.min(1, Math.max(0, y) / 1.1) : 1;
          b.pos.push(x, y, z); b.nor.push(nor[o + v * 3], nor[o + v * 3 + 1], nor[o + v * 3 + 2]); b.col.push(cr * ao, cg * ao, cb * ao);
          if (m === MK.tile) b.uv.push((Math.abs(nx) >= Math.abs(nz) ? z : x) / sc[0], y / sc[1]);
          else if (Math.abs(ny) > 0.7) b.uv.push(x / sc[0], z / sc[1]);
          else b.uv.push((Math.abs(nx) > Math.abs(nz) ? -z * Math.sign(nx) : x * Math.sign(nz || 1)) / sc[0], y / sc[1]);
        }
      }
      p.g.dispose();
    }
    const keys = [...B.keys()].sort((a, b) => a - b); let total = 0; for (const k of keys) total += B.get(k).pos.length / 3;
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3), uv = new Float32Array(total * 2);
    const g = new THREE.BufferGeometry(); let o = 0;
    for (const k of keys) { const b = B.get(k), c = b.pos.length / 3; pos.set(b.pos, o * 3); nor.set(b.nor, o * 3); col.set(b.col, o * 3); uv.set(b.uv, o * 2); g.addGroup(o, c, k); o += c; }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeBoundingSphere(); return g;
  }
}
const H = TS / 2;
const SMOKE = {};
function lot(b, W, col, m) { const pm = b.m; b.use(m || 'plain').box(W, 0.06, W, col || PAL.conc, 0, 0, 0); b.m = pm; return b; }
function acUnits(b, w, d, y, n) { b.use('metal'); for (let i = 0; i < n; i++) b.box(0.5, 0.35, 0.5, PAL.steel, -w / 2 + 0.5 + (i * 1.1) % (w - 0.8), y, -d / 2 + 0.5 + Math.floor(i * 1.1 / (w - 0.8)) * 0.8); return b; }

// ---------- bydlení ----------
function mRes(d, l, v, st) {
  if (!d && st === 0) return mResVillage(l, v);
  if (!d && st === 2) return mResRow(l, v);
  if (d && st === 1 && l <= 3) return mResHist(l, v, false);
  const b = new GB(), [wall, roof] = PAL.walls[v], hi = PAL.hi[v];
  if (!d) {
    lot(b, 3.8, PAL.grass, 'lawn');
    hedge(b, 3.6, v);
    if (l === 1) { b.facade('res', 1, 1.5, 2.8, 2.2, wall, -0.2, 0, 0.1).use('tile').pyr(3.2, 1.1, roof, -0.2, 1.5, 0.1, 2.6).use('plain').box(0.5, 0.95, 0.06, PAL.wood, 0.55, 0, 1.22).use('pave').box(0.9, 0.04, 1.0, PAL.walk, 0.55, 0.06, 1.8); b.tree(-1.3, -1.3, 0.75, PAL.leaf[v % 4]); }
    else if (l === 0) { b.facade('res', 1, 1.5, 2.4, 2.0, wall, 0, 0, 0.1).use('tile').gable(2.7, 1.25, 2.3, roof, 0, 1.5, 0.1, Math.PI / 2).use('brick').box(0.3, 0.8, 0.3, PAL.brick, -0.6, 1.9, -0.1).use('plain').box(0.5, 0.95, 0.06, PAL.wood, 0.55, 0, 1.12).box(1.0, 0.04, 1.2, PAL.conc2, 0.55, 0.06, 1.8); b.tree(-1.3, -1.3, 0.75, PAL.leaf[v % 4]); }
    else if (l === 2) { b.facade('res', 2, 1.3, 2.7, 2.6, wall, -0.4, 0, -0.1).use('tile').pyr(3.1, 0.9, roof, -0.4, 2.6, -0.1, 3.0).use('plain').box(1.1, 1.0, 1.9, hi, 1.3, 0, 0.3).box(0.95, 0.85, 0.06, PAL.white, 1.3, 0, 1.26).box(0.5, 1.0, 0.06, PAL.wood, -0.3, 0, 1.2).use('pave').box(1.0, 0.04, 1.4, PAL.walk, 1.3, 0.06, 1.95); b.tree(-1.5, -1.5, 0.7, PAL.leaf[(v + 1) % 4]); }
    else if (l === 0) { b.facade('res', 1, 1.6, 2.8, 2.2, wall, -0.35, 0, 0).use('tile').gable(3.1, 1.3, 2.5, roof, -0.35, 1.6, 0, Math.PI / 2).use('plain').box(1.2, 1.2, 1.9, hi, 1.25, 0, 0.3).box(0.95, 0.9, 0.06, PAL.white, 1.25, 0, 1.26).box(0.5, 1.0, 0.06, PAL.wood, -0.3, 0, 1.12).box(1.0, 0.04, 1.4, PAL.conc2, 1.25, 0.06, 1.95); b.tree(-1.5, -1.4, 0.7, PAL.leaf[(v + 1) % 4]); }
    else { b.facade('res', 2, 1.4, 3.0, 2.6, wall, 0, 0, -0.2).use('tile').pyr(3.4, 1.3, roof, 0, 2.8, -0.2, 3.0).use('plain').box(1.4, 0.1, 0.8, PAL.white, 0.6, 1.4, 1.5).box(0.55, 1.05, 0.06, PAL.wood, -0.6, 0, 1.11).use('water').cyl(0.7, 0.7, 0.08, 0x4f9fc4, -1.2, 0.03, 1.4, 16); b.tree(1.45, -1.5, 0.8, PAL.leaf[v % 4]); }
    return b.geo();
  }
  lot(b, 3.8, PAL.walk);
  if (l === 1) { b.facade('res', 3, 1.2, 3.3, 2.8, wall, 0, 0, 0).use('tile').gable(3.5, 1.2, 3.0, roof, 0, 3.6, 0, Math.PI / 2).use('plain').box(0.8, 1.0, 0.08, PAL.wood, 0, 0, 1.42); }
  else if (l === 2) { b.facade('res', 5, 1.2, 3.4, 3.0, hi, 0, 0, 0).parapet(3.4, 3.0, 6, hi).use('plain').box(0.9, 0.7, 0.9, PAL.conc2, 0.8, 6, -0.6); acUnits(b, 3.4, 3, 6, 2); }
  else if (l === 3) { b.facade('panel', 8, 1.15, 3.6, 2.6, hi, 0, 0, 0).parapet(3.6, 2.6, 9.2, PAL.conc).use('plain'); for (let i = 1; i < 8; i++) b.box(1.2, 0.08, 0.5, PAL.conc, -0.9, i * 1.15, 1.55).box(1.2, 0.45, 0.04, i % 2 ? 0xc7b79a : 0xb5c1c6, -0.9, i * 1.15 + 0.08, 1.78); b.box(0.9, 0.9, 0.9, PAL.conc2, 1, 9.2, 0); }
  else if (l === 4) { b.facade('panel', 12, 1.15, 3.2, 3.0, hi, 0, 0, 0).facade('panel', 2, 1.15, 2.4, 2.4, hi, 0, 13.8, 0).parapet(2.4, 2.4, 16.1, PAL.conc); acUnits(b, 2.4, 2.4, 16.1, 2); }
  else { b.use('stone').box(3.3, 1.6, 3.3, 0xd8d4cc, 0, 0, 0).facade('office', 20, 1.1, 2.9, 2.9, 0xe1e8ee, 0, 1.6, 0).facade('office', 3, 1.0, 2.0, 2.0, 0xe1e8ee, 0, 23.6, 0).parapet(2.0, 2.0, 26.6, PAL.conc).use('plain').cyl(0.05, 0.05, 2.4, PAL.steel, 0, 26.6, 0, 6); }
  return b.geo();
}
// ---------- obchody ----------
function awning(b, w, x, y, z, c) { const pm = b.m; b.use('plain').add(new THREE.BoxGeometry(w, 0.05, 0.8), c, x, y, z + 0.3, 0.35, 0, 0); b.m = pm; }
function sign(b, w, x, y, z, c) { const pm = b.m; b.use('plain').box(w, 0.4, 0.08, c, x, y, z); b.box(w * 0.7, 0.14, 0.09, PAL.white, x, y + 0.13, z); b.m = pm; }
function mCom(d, l, v, st) {
  if (!d && st === 0) return mComVillage(l, v);
  if (d && st === 1 && l <= 3) return mResHist(l, v, true);
  const b = new GB(), [wall] = PAL.walls[v], c1 = [0xa83a30, 0x2f5f9f, 0x3f7f4f, 0xc77a2e, 0x6a4f8f][v];
  lot(b, 3.8, PAL.walk);
  if (!d) {
    if (l === 1) { b.facade('shop', 1, 1.6, 2.8, 2.4, wall, 0, 0, 0).parapet(2.8, 2.4, 1.6, wall); awning(b, 2.6, 0, 1.3, 1.2, c1); sign(b, 1.6, 0, 1.75, 1.22, c1); }
    else if (l === 2) { b.facade('shop', 1, 1.6, 3.2, 2.6, wall, 0, 0, 0).facade('res', 1, 1.3, 3.2, 2.6, wall, 0, 1.6, 0).use('tile').gable(3.4, 1.0, 2.8, PAL.walls[v][1], 0, 2.9, 0, Math.PI / 2); awning(b, 3, 0, 1.35, 1.3, c1); }
    else { b.facade('shop', 1, 1.9, 3.5, 2.4, PAL.white, 0, 0, -0.6).parapet(3.5, 2.4, 1.9, c1); sign(b, 2.2, 0, 2.0, 0.62, c1); b.use('asphalt').box(3.5, 0.02, 1.4, PAL.asphalt, 0, 0.06, 1.2).use('plain'); for (let i = -1; i <= 1; i++) b.box(0.05, 0.03, 1.0, PAL.line, i * 0.9, 0.08, 1.25); b.use('paint').box(0.9, 0.4, 0.45, 0x9a2a2a, -0.5, 0.08, 1.3).box(0.9, 0.4, 0.45, 0x2a4a7a, 0.9, 0.08, 1.3); }
    return b.geo();
  }
  if (l === 1) { b.facade('shop', 1, 1.5, 3.3, 3.0, wall, 0, 0, 0).facade('res', 2, 1.25, 3.3, 3.0, wall, 0, 1.5, 0).parapet(3.3, 3, 4, wall); awning(b, 3, 0, 1.2, 1.5, c1); }
  else if (l === 2) { b.facade('shop', 1, 1.6, 3.5, 3.4, wall, 0, 0, 0).facade('stone', 3, 1.3, 3.5, 3.4, wall, 0, 1.6, 0).parapet(3.5, 3.4, 5.5, wall); sign(b, 2.6, 0, 4.6, 1.75, c1); acUnits(b, 3.5, 3.4, 5.5, 3); }
  else if (l === 3) { b.facade('shop', 1, 1.8, 3.7, 3.7, PAL.white, 0, 0, 0).facade('office', 2, 1.6, 3.7, 3.7, 0xe6e9ea, 0, 1.8, 0).parapet(3.7, 3.7, 5, PAL.conc).use('glass').box(1.8, 1.7, 0.6, 0x7f98aa, 0, 0, 2.05).use('plain').box(2.0, 0.12, 0.8, PAL.conc, 0, 1.7, 2.05); sign(b, 2.4, 0, 4.2, 1.9, c1); }
  else if (l === 4) { b.facade('shop', 1, 1.8, 3.6, 3.6, PAL.white, 0, 0, 0).facade('stone', 11, 1.15, 3.0, 2.6, wall, 0, 1.8, 0).parapet(3.0, 2.6, 14.45, PAL.conc); sign(b, 2.0, 0, 14.0, 1.32, c1); }
  else { b.facade('shop', 1, 2, 3.6, 3.6, 0xe8ecef, 0, 0, 0).facade('office', 22, 1.1, 2.8, 2.8, 0xd5e0e8, 0, 2, 0).facade('office', 4, 1.1, 1.9, 1.9, 0xd5e0e8, 0, 26.2, 0).parapet(1.9, 1.9, 30.6, PAL.conc).use('metal').cone(0.35, 4, PAL.steel, 0, 30.6, 0, 8); }
  return b.geo();
}
// ---------- průmysl ----------
function chimney(b, key, x, z, h, r) { const pm = b.m; b.use('brick').cyl(r * 0.8, r, h, PAL.brick, x, 0, z, 12).use('plain').cyl(r * 0.84, r * 0.84, 0.35, PAL.white, x, h * 0.82, z, 12); b.m = pm; (SMOKE[key] = SMOKE[key] || []).push([x, h + 0.2, z]); }
function mInd(d, l, s, v, key, st) {
  if (!d && st === 0 && s !== 2) return s === 1 ? mFarm(l, v, key) : mSawmill(l, v);
  const b = new GB(), wall = [0xd5d0c5, 0xc4ccd2, 0xd8c9b0][v];
  lot(b, 3.8, 0xa9a59c);
  if (s === 2) {
    b.facade('office', 1 + Math.ceil(l / 2), 1.3, 3.4, 3.0, 0xf0f2f2, 0, 0, -0.2).use('glass');
    for (let i = 0; i < 3; i++) b.add(new THREE.BoxGeometry(1, 0.05, 0.8), 0x1f2f45, -1.05 + i * 1.05, 1.5 + Math.ceil(l / 2) * 1.3, -0.4, -0.35, 0, 0);
    if (d) b.facade('office', 3 + l, 1.2, 1.4, 1.4, 0xe8eef2, 1, 0, -0.6).use('plain').sph(0.55, PAL.white, -1.1, 2.0 + l * 0.4, 1.0, 1, 1, 1);
    return b.geo();
  }
  if (!d) {
    if (l === 1) { b.use('metal').box(3, 1.7, 2.4, wall, 0, 0, 0); for (let i = 0; i < 3; i++) b.add(new THREE.BoxGeometry(1, 0.7, 2.4), PAL.conc2, -1 + i, 2.0, 0, 0, 0, 0.6); b.use('plain').box(1, 1.1, 0.06, PAL.steel, 0.6, 0, 1.21).use('plain').box(0.5, 0.5, 0.5, PAL.wood, -1.2, 0, 1.6); }
    else if (l === 2) { b.use('metal').box(3.4, 2.2, 2.4, wall, 0, 0, -0.4).gable(3.6, 0.6, 2.6, PAL.conc2, 0, 2.2, -0.4, Math.PI / 2).use('plain').box(1.2, 1.4, 0.06, PAL.steel, -0.8, 0, 0.81).box(1.2, 1.4, 0.06, PAL.steel, 0.8, 0, 0.81); if (s === 1) b.use('metal').cyl(0.6, 0.6, 3.2, 0xdedede, 1.3, 0, 1.3).cone(0.62, 0.6, 0xdedede, 1.3, 3.2, 1.3); else b.use('plain').box(0.8, 0.6, 0.6, PAL.wood, 1.3, 0, 1.3).box(0.6, 0.5, 0.6, 0x4a6a8a, 0.4, 0, 1.45); }
    else { b.use('brick').box(3.0, 2.6, 2.8, PAL.brick, -0.3, 0, -0.2).parapet(3.0, 2.8, 2.6, 0x8a4a35, -0.3, -0.2); chimney(b, key, 1.25, 1.1, 5.5, 0.32); if (s === 1) b.use('metal').cyl(0.5, 0.5, 3, 0xdedede, -1.3, 0, 1.3).cyl(0.5, 0.5, 3, 0xdedede, -0.2, 0, 1.4); }
    return b.geo();
  }
  const big = l >= 3;
  b.use(big ? 'brick' : 'metal').box(3.6, 2.6 + l * 0.4, 2.6, big ? PAL.brick : wall, 0, 0, -0.5);
  b.use('metal'); for (let i = 0; i < 3; i++) b.add(new THREE.BoxGeometry(1.2, 0.8, 2.6), PAL.conc2, -1.2 + i * 1.2, 3.2 + l * 0.4, -0.5, 0, 0, 0.6);
  chimney(b, key, -1.3, 1.2, 6 + l * 1.4, 0.4); if (big) chimney(b, key, -0.3, 1.3, 7 + l * 1.2, 0.36);
  if (s === 1) { b.use('metal'); for (let i = 0; i < 2; i++) b.cyl(0.55, 0.55, 3.6, 0xdedede, 0.6 + i * 1.1, 0, 1.3).cone(0.57, 0.5, 0xdedede, 0.6 + i * 1.1, 3.6, 1.3); }
  else b.use('metal').sph(0.8, 0xd8d8d8, 1.1, 0.9, 1.2, 1, 1, 1).hcyl(0.12, 2.4, 0xc9a34a, 0.2, 1.8, 1.2, Math.PI / 2, 8);
  return b.geo();
}
// ---------- kanceláře ----------
function mOff(d, l, v) {
  const b = new GB(), body = PAL.off[v];
  lot(b, 3.8, PAL.walk);
  if (!d) { const n = l + 1; b.use('pave').box(3.1, 0.3, 2.7, 0xcfcac0, 0, 0, 0).facade('office', n, 1.25, 3.0, 2.6, body, 0, 0.3, 0).parapet(3.0, 2.6, 0.3 + n * 1.25, PAL.conc); if (l === 3) b.use('lawn').box(2.2, 0.15, 1.6, PAL.grass, 0, 0.3 + n * 1.25, 0).tree(0.6, -0.3, 0.45); else acUnits(b, 3, 2.6, 0.3 + n * 1.25, 2); return b.geo(); }
  const fl = [0, 6, 10, 14, 20, 28][l];
  b.use('stone').box(3.2, 1.4, 3.2, 0xcfcac0, 0, 0, 0).facade('office', fl, 1.1, 3.0, 3.0, body, 0, 1.4, 0);
  let top = 1.4 + fl * 1.1;
  if (l >= 3) { b.facade('office', 3, 1.1, 2.2, 2.2, body, 0, top, 0); b.parapet(3.0, 3.0, top, PAL.conc); top += 3.3; }
  b.parapet(l >= 3 ? 2.2 : 3.0, l >= 3 ? 2.2 : 3.0, top, PAL.conc); acUnits(b, l >= 3 ? 2.2 : 3, l >= 3 ? 2.2 : 3, top, 2);
  if (l >= 4) b.use('metal').cyl(0.06, 0.06, 3.5, PAL.steel, 0.5, top, 0.5, 6).use('plain').sph(0.1, 0xd23a2a, 0.5, top + 3.6, 0.5, 1, 1, 1, 0);
  return b.geo();
}
// ---------- služby ----------
function mServ(t) {
  const s = SERV[t].size, W = s * TS - 0.6, b = new GB(), key = 'S:' + t;
  if (t === 'church') return mChurch();
  switch (t) {
    case 'townhall': lot(b, W, 0xcfc8ba, 'pave'); b.facade('stone', 2, 1.7, 6, 3.6, 0xeee6d5, 0, 0, -0.8).use('tile').gable(6.2, 1.4, 3.8, 0x7a4a36, 0, 3.4, -0.8, Math.PI / 2).use('plain');
      for (let i = 0; i < 6; i++) b.cyl(0.17, 0.19, 2.7, PAL.white, -2.3 + i * 0.92, 0, 1.3, 12); b.box(5.6, 0.45, 0.7, PAL.white, 0, 2.7, 1.3).box(5.8, 0.2, 1.2, 0xd8d2c4, 0, 0, 1.4);
      b.facade('stone', 4, 1.6, 1.4, 1.4, 0xeee6d5, 0, 0, -0.8).use('metal').pyr(1.8, 1.6, 0x3f6b5c, 0, 6.4, -0.8).use('plain').cyl(0.4, 0.4, 0.08, PAL.white, 0, 5.2, -0.06, 16).cyl(0.03, 0.03, 2.2, PAL.steel, 0, 8.0, -0.8, 6).box(0.9, 0.55, 0.03, 0xc8372d, 0.45, 9.6, -0.8);
      b.use('pave').cyl(0.9, 1.0, 0.35, 0xc9c3b5, 0, 0, 3.0, 20).use('water').cyl(0.78, 0.78, 0.06, PAL.water, 0, 0.32, 3.0, 20); break;
    case 'coal': lot(b, W, 0x8a867e); b.use('brick').box(4.2, 4.6, 3.4, PAL.brick, -1.2, 0, 0).parapet(4.2, 3.4, 4.6, 0x8a4a35, -1.2, 0).use('metal').box(2.4, 2.8, 2.4, PAL.conc2, 2.0, 0, -1.6);
      chimney(b, key, 1.8, 1.8, 13, 0.6); chimney(b, key, 2.9, 0.6, 11, 0.5); b.use('plain').cone(1.3, 1.0, 0x252322, -1.6, 0, 2.6, 9).cone(1.0, 0.8, 0x2c2a28, 0.2, 0, 2.9, 9); break;
    case 'gas': lot(b, W, 0x9da3a6); b.use('metal').box(4.6, 3.8, 3, 0xc9d0d5, -1, 0, -1.2).parapet(4.6, 3, 3.8, PAL.conc, -1, -1.2); chimney(b, key, 2.4, -1.6, 9, 0.38); chimney(b, key, 2.4, -0.4, 9, 0.38);
      b.use('metal').sph(1.15, 0xe2e2e0, -1.8, 1.15, 2.2, 1, 1, 1, 2).sph(1.15, 0xe2e2e0, 0.8, 1.15, 2.2, 1, 1, 1, 2).hcyl(0.15, 4, 0xc9a34a, -0.5, 0.5, 1.0, Math.PI / 2, 8); break;
    case 'wind': b.use('plain').box(1.6, 0.1, 1.6, PAL.conc, 0, 0, 0).cyl(0.16, 0.3, 10, 0xf2f2f0, 0, 0, 0, 14).box(0.55, 0.55, 1.4, 0xf2f2f0, 0, 10, 0); break;
    case 'solar': lot(b, W, PAL.grass, 'lawn'); b.use('glass'); for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) b.add(new THREE.BoxGeometry(2.0, 0.06, 1.2), 0x1b2a40, -2.4 + c * 2.4, 0.8, -2.6 + r * 1.75, -0.5, 0, 0); b.use('metal'); for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) b.box(0.08, 0.7, 0.08, PAL.steel, -2.4 + c * 2.4, 0, -2.6 + r * 1.75); break;
    case 'nuclear': lot(b, W, 0xaaa79f);
      b.use('plain'); for (const x of [-3, 2.4]) { const pts = []; for (let i = 0; i <= 10; i++) pts.push(new THREE.Vector2(2.1 - Math.sin(i / 10 * Math.PI) * 0.7 + i / 100, i / 10 * 9)); b.add(new THREE.LatheGeometry(pts, 24), 0xd9d6cf, x, 0, -2.6); (SMOKE[key] = SMOKE[key] || []).push([x, 9.5, -2.6]); }
      b.cyl(1.8, 1.8, 2.6, 0xe6e6e2, -1.5, 0, 2.6, 20).sph(1.8, 0xe6e6e2, -1.5, 2.6, 2.6, 1, 0.8, 1, 2).use('metal').box(3.6, 3, 2.6, 0xbcc4cb, 2.8, 0, 2.6); break;
    case 'pump': lot(b, W); b.use('metal'); for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) b.cyl(0.07, 0.07, 2.6, PAL.steel, x, 0, z, 6);
      b.cyl(1.0, 1.0, 1.6, 0x8fa4b4, 0, 2.6, 0, 18).cone(1.05, 0.45, 0x6f8494, 0, 4.2, 0, 18).use('res').box(1.4, 1.3, 1, 0xe2ddd2, 0.8, 0, 1.1); break;
    case 'sewage': lot(b, W, 0xa9aba2); for (const [x, z] of [[-2, -2], [2, -2], [-2, 2]]) b.use('plain').cyl(1.5, 1.5, 0.7, PAL.conc, x, 0, z, 24).use('water').cyl(1.32, 1.32, 0.05, 0x5f6e4a, x, 0.63, z, 24); b.use('res').box(2.4, 1.7, 2, 0xe2ddd2, 2, 0, 2); break;
    case 'dump': lot(b, W, 0x7f7461); b.use('plain'); for (let i = 0; i < 9; i++) b.sph(1.0 + (i % 3) * 0.35, [0x6d604c, 0x7d7c76, 0x5e5240][i % 3], -2.4 + (i % 3) * 2.2, 0.3, -2.4 + Math.floor(i / 3) * 2.2, 1, 0.5, 1, 1);
      b.use('paint').box(1.2, 0.7, 0.8, 0xd1a02e, 2.6, 0, 2.6).box(0.5, 0.5, 0.6, PAL.dark, 2.8, 0.7, 2.6); break;
    case 'incin': lot(b, W, 0x9e9a91); b.use('metal').box(5, 3.6, 3.6, 0xb4bec6, -0.6, 0, 0.6).parapet(5, 3.6, 3.6, PAL.conc, -0.6, 0.6); chimney(b, key, 2.6, -2.4, 12, 0.5); break;
    case 'recycle': lot(b, W); b.use('metal').box(5, 2.8, 3.2, 0x7f9c78, -0.6, 0, -1.4).gable(5.2, 0.8, 3.4, 0xd8d8d6, -0.6, 2.8, -1.4, Math.PI / 2).use('paint'); for (let i = 0; i < 5; i++) b.box(0.9, 0.9, 1.3, [0x2f5f9f, 0xd1a02e, 0x3f7f4f, 0xa83a30, 0x6a4f8f][i], -2.6 + i * 1.3, 0, 2.2); break;
    case 'police': lot(b, W); b.facade('res', 2, 1.15, 3.0, 2.2, 0xeceeee, 0, 0, -0.5).parapet(3, 2.2, 2.3, 0x2c4f8f, 0, -0.5).use('plain').box(3.02, 0.25, 2.22, 0x2c4f8f, 0, 1.02, -0.5).box(1.4, 0.35, 0.06, 0x2c4f8f, 0, 1.6, 0.62).use('metal').cyl(0.04, 0.04, 1.8, PAL.steel, 1.2, 2.3, -1.2, 6);
      b.use('paint').box(1.3, 0.42, 0.6, 0xf2f2f0, -0.7, 0.06, 1.35).box(1.32, 0.1, 0.62, 0x2c4f8f, -0.7, 0.24, 1.35).use('glass').box(0.7, 0.3, 0.56, 0x30404f, -0.75, 0.46, 1.35); break;
    case 'policehq': lot(b, W); b.facade('stone', 4, 1.3, 6, 3.4, 0xebebe8, 0, 0, -1.2).parapet(6, 3.4, 5.2, 0x2c4f8f, 0, -1.2).use('plain').cyl(1.1, 1.1, 0.05, 0x9a9890, 1.4, 5.2, -1.2, 18).box(1.0, 0.06, 0.2, PAL.white, 1.4, 5.25, -1.2);
      b.use('paint'); for (let i = 0; i < 3; i++) b.box(1.3, 0.42, 0.6, 0xf2f2f0, -2.4 + i * 1.6, 0.06, 2.2).box(1.32, 0.1, 0.62, 0x2c4f8f, -2.4 + i * 1.6, 0.24, 2.2); break;
    case 'fire': lot(b, W); b.use('brick').box(3.2, 2.5, 2.4, PAL.brick, -0.2, 0, -0.5).parapet(3.2, 2.4, 2.5, 0x8a4a35, -0.2, -0.5).use('metal').box(1.0, 1.6, 0.06, 0xe4e4e2, -0.9, 0, 0.72).box(1.0, 1.6, 0.06, 0xe4e4e2, 0.4, 0, 0.72).use('brick').box(0.8, 4.4, 0.8, PAL.brick, 1.3, 0, -1.2)
      .use('paint').box(1.7, 0.7, 0.7, 0xb8251f, -0.6, 0.06, 1.45).use('metal').box(1.4, 0.08, 0.2, PAL.steel, -0.6, 0.8, 1.45); break;
    case 'barracks': lot(b, W, 0x8f8e74); b.use('plain'); for (const [x, z, w, d] of [[0, -5.6, 11.4, 0.3], [0, 5.6, 11.4, 0.3], [-5.6, 0, 0.3, 11.4], [5.6, 0, 0.3, 11.4]]) b.box(w, 1.1, d, 0xb3ad98, x, 0, z);
      b.facade('res', 2, 1.2, 4.5, 2.4, 0x7d8460, -2.5, 0, -3.5).parapet(4.5, 2.4, 2.4, 0x5a6040, -2.5, -3.5).facade('res', 2, 1.2, 3, 2.4, 0x7d8460, 3, 0, -3.5).parapet(3, 2.4, 2.4, 0x5a6040, 3, -3.5);
      b.use('plain'); for (let i = 0; i < 3; i++) b.pyr(1.6, 1.2, 0x6d7650, -3.5 + i * 2.2, 0, 1);
      b.use('paint'); for (let i = 0; i < 2; i++) b.box(1.6, 0.6, 1, 0x4f5a34, 1.8 + i * 2.2, 0.05, 2.8).box(0.8, 0.4, 0.7, 0x4f5a34, 1.8 + i * 2.2, 0.65, 2.8).hcyl(0.07, 1.2, 0x3a4226, 1.8 + i * 2.2 + 0.8, 0.9, 2.8, Math.PI / 2, 6);
      b.use('plain').cyl(0.04, 0.04, 4, PAL.steel, 0, 0, 0, 6).box(1.1, 0.6, 0.03, 0x2f5f9f, 0.55, 3.4, 0); break;
    case 'intel': lot(b, W); b.use('office').box(3, 3.8, 2.6, 0x8d929a, 0, 0, -0.3).use('metal').cyl(0.04, 0.04, 2.4, PAL.steel, 1, 3.8, -1, 6).use('plain').sph(0.55, PAL.white, -0.8, 4.2, -0.6, 1, 0.5, 1).cyl(0.06, 0.06, 0.4, PAL.steel, -0.8, 3.8, -0.6, 6); break;
    case 'clinic': lot(b, W); b.facade('res', 2, 1.3, 3, 2.4, 0xf2f2ef, 0, 0, -0.4).parapet(3, 2.4, 2.6, PAL.conc, 0, -0.4).use('plain').box(1.0, 0.3, 0.05, 0xc8372d, 0, 1.95, 0.82).box(0.3, 1.0, 0.05, 0xc8372d, 0, 1.6, 0.82).use('paint').box(1.3, 0.6, 0.65, 0xf2f2f0, 0.6, 0.06, 1.45).box(1.32, 0.12, 0.66, 0xc8372d, 0.6, 0.35, 1.45); break;
    case 'hospital': lot(b, W); b.facade('res', 5, 1.3, 6.2, 3.2, 0xf2f2ef, 0, 0, -1.6).parapet(6.2, 3.2, 6.5, PAL.conc, 0, -1.6).facade('res', 3, 1.3, 2.8, 3.4, 0xf2f2ef, -1.8, 0, 1.6).parapet(2.8, 3.4, 3.9, PAL.conc, -1.8, 1.6).use('plain').cyl(1.1, 1.1, 0.05, 0x3f6f4a, 1.2, 6.5, -1.6, 18);
      b.box(1.6, 0.4, 0.06, 0xc8372d, 1.6, 4.4, 0.01).box(0.45, 1.5, 0.06, 0xc8372d, 1.6, 3.85, 0.01).use('paint').box(1.3, 0.6, 0.65, 0xf2f2f0, 2.2, 0.06, 2.6).box(1.32, 0.12, 0.66, 0xc8372d, 2.2, 0.35, 2.6); break;
    case 'school': lot(b, W, 0xc9bfa8); b.facade('res', 2, 1.4, 3.2, 2, 0xe8c98f, 0, 0, -0.8).parapet(3.2, 2, 2.8, PAL.brick, 0, -0.8).use('asphalt').box(2.8, 0.03, 1.3, 0x4a6f9a, 0, 0.06, 1.1).use('plain').cyl(0.04, 0.04, 2.6, PAL.steel, -1.4, 0, 1.4, 6).box(0.6, 0.4, 0.03, 0xc8372d, -1.1, 2.2, 1.4); break;
    case 'highschool': lot(b, W, 0xc9bfa8); b.use('brick').facade('brick', 3, 1.4, 6.4, 2.6, 0xc98c6a, 0, 0, -2.4).parapet(6.4, 2.6, 4.2, 0x8a4a35, 0, -2.4).use('lawn').box(6.6, 0.05, 3.4, PAL.grass, 0, 0.06, 1.7).use('plain');
      for (const z of [0.6, 2.8]) b.box(6.2, 0.03, 0.06, PAL.white, 0, 0.11, z); break;
    case 'university': lot(b, W, PAL.grass, 'lawn'); b.facade('stone', 3, 1.6, 6, 3.6, 0xefe7d5, 0, 0, -3).use('plain').cyl(1.6, 1.6, 1.4, 0xefe7d5, 0, 4.8, -3, 20).use('metal').sph(1.6, 0x5f8a7a, 0, 6.2, -3, 1, 0.9, 1, 2).use('plain');
      for (let i = 0; i < 6; i++) b.cyl(0.18, 0.2, 3.2, PAL.white, -2.4 + i * 0.96, 0, -1, 12); b.facade('stone', 2, 1.5, 3, 5.6, 0xe4d6bc, -4, 0, 2.4).use('tile').gable(3.2, 1.0, 5.8, 0x7a4a36, -4, 3, 2.4, 0).facade('stone', 2, 1.5, 3, 5.6, 0xe4d6bc, 4, 0, 2.4).use('tile').gable(3.2, 1.0, 5.8, 0x7a4a36, 4, 3, 2.4, 0);
      b.tree(0, 2.5, 1).tree(-1.5, 4.3, 0.8).tree(1.6, 4.4, 0.9); break;
    case 'institute': lot(b, W); b.facade('office', 4, 1.3, 5.5, 3.2, 0xe8eef2, -0.5, 0, -1.6).parapet(5.5, 3.2, 5.2, PAL.conc, -0.5, -1.6).use('plain').sph(1.4, PAL.white, 2.2, 0.8, 2.0, 1, 1, 1, 2).box(1.2, 0.8, 1.2, PAL.conc2, 2.2, 0, 2.0); break;
    case 'park': lot(b, W, PAL.grass, 'lawn'); b.use('pave').box(W, 0.08, 0.7, 0xc9bda0, 0, 0.06, 0).tree(-1, -1, 0.9).tree(1.1, 1.2, 1, PAL.leaf[1]).pine(1.2, -1.1, 1).use('plain').box(0.9, 0.3, 0.3, PAL.wood, -1, 0.06, 1.2); break;
    case 'bigpark': lot(b, W, PAL.grass, 'lawn'); b.use('water').cyl(2.0, 2.0, 0.08, PAL.water, 1.2, 0.04, 1.2, 28).use('pave').box(0.8, 0.08, W, 0xc9bda0, -1.5, 0.06, 0).box(W, 0.08, 0.8, 0xc9bda0, 0, 0.06, -1.5);
      for (const [x, z, c] of [[-3, -3, 0], [-0.2, -3.2, 1], [2.8, -3, 2], [-3, 0.6, 1], [-3.1, 3, 3], [3.2, -0.5, 0]]) b.tree(x, z, 1, PAL.leaf[c]); b.use('plain').cyl(0.7, 0.8, 1.2, PAL.white, -1.5, 0, -1.5, 12).use('tile').cone(0.95, 0.7, 0x7a4a36, -1.5, 1.2, -1.5, 12); break;
    case 'plaza': lot(b, W, 0xcfc6b2, 'pave'); b.use('pave').cyl(0.8, 0.9, 0.4, PAL.conc2, 0, 0, 0, 16).use('water').cyl(0.66, 0.66, 0.06, PAL.water, 0, 0.36, 0, 16).use('pave').cyl(0.12, 0.15, 1.1, PAL.conc2, 0, 0.4, 0, 8).tree(1.3, 1.3, 0.6); break;
    case 'stadium': lot(b, W, 0xa9a394); { const pts = [new THREE.Vector2(4.2, 0), new THREE.Vector2(5.6, 0), new THREE.Vector2(5.6, 3.2), new THREE.Vector2(5.2, 3.2), new THREE.Vector2(4.0, 0.6)];
      b.use('plain').add(new THREE.LatheGeometry(pts, 32), 0xd2cfc6, 0, 0, 0, 0, 0, 0, 1, 1, 0.75).use('lawn').add(new THREE.CylinderGeometry(4.15, 4.15, 0.1, 32), 0x4f8a3a, 0, 0.05, 0, 0, 0, 0, 1, 1, 0.75).use('metal');
      for (const [x, z] of [[-4.6, -3.6], [4.6, -3.6], [-4.6, 3.6], [4.6, 3.6]]) b.cyl(0.08, 0.08, 6, PAL.steel, x, 0, z, 6).box(0.8, 0.5, 0.2, 0xe8e8e0, x, 6, z); } break;
    case 'bus': lot(b, W); b.use('metal').box(3.2, 2, 2, 0xc9ced3, 0, 0, -0.9).gable(3.4, 0.6, 2.2, 0x3f6f5a, 0, 2, -0.9, Math.PI / 2).use('paint').box(2.4, 0.8, 0.7, 0xd9a933, 0, 0.06, 1.1).use('glass').box(2.42, 0.3, 0.72, 0x30404f, 0, 0.5, 1.1); break;
    case 'metro': lot(b, W, 0xcfc6b2, 'pave'); b.use('glass').box(2.4, 1.4, 1.6, 0x9fb4c4, 0, 0, 0).use('metal').box(2.6, 0.15, 1.8, PAL.steel, 0, 1.4, 0).cyl(0.06, 0.06, 2.4, PAL.steel, 1.4, 0, 1.2, 6).use('plain').box(0.8, 0.8, 0.1, 0xb8251f, 1.4, 2.2, 1.2).box(0.5, 0.5, 0.11, PAL.white, 1.4, 2.35, 1.2); break;
    case 'station': lot(b, W, 0x9a968d); b.use('metal'); for (const z of [-1.6, 1.4]) b.box(W, 0.06, 0.1, PAL.steel, 0, 0.08, z - 0.4).box(W, 0.06, 0.1, PAL.steel, 0, 0.08, z + 0.4);
      b.use('paint'); for (let i = 0; i < 3; i++) b.box(2.2, 1.2, 1.0, [0x2f5f9f, 0xa83a30, 0x3f7f4f][i], -2.4 + i * 2.4, 0.15, -1.6); b.facade('stone', 1, 2, 5, 1.6, 0xdcd2bc, 0, 0, 3.1).use('tile').gable(5.2, 0.8, 1.8, 0x7a4a36, 0, 2, 3.1, Math.PI / 2); break;
    case 'port': lot(b, W, 0xa8a398); b.use('metal'); for (let i = 0; i < 12; i++) b.box(1.8, 0.8, 0.8, [0xa83a30, 0x2f5f9f, 0xd1a02e, 0x3f7f4f, 0xc77a2e][i % 5], -3.8 + (i % 4) * 2.0, Math.floor(i / 8) * 0.8, -3.6 + (Math.floor(i / 4) % 2) * 0.9);
      for (const x of [-2, 3]) b.box(0.3, 7, 0.3, 0xd1a02e, x - 1, 0, 2.6).box(0.3, 7, 0.3, 0xd1a02e, x + 1, 0, 2.6).box(2.6, 0.4, 0.4, 0xd1a02e, x, 7, 2.6).box(0.4, 0.4, 5.5, 0xd1a02e, x, 7.4, 3.2);
      b.box(4, 2.6, 2.6, 0xd8d8d6, 2.8, 0, -3.2); break;
    case 'airport': lot(b, W, PAL.grass, 'lawn'); b.use('asphalt').box(W, 0.04, 3.6, PAL.asphalt, 0, 0.06, 4.4).use('plain'); for (let i = 0; i < 8; i++) b.box(1.0, 0.03, 0.16, PAL.line, -6.5 + i * 1.9, 0.1, 4.4);
      b.facade('office', 2, 1.4, 8, 3.4, 0xe6ecf0, -2, 0, -3.6).parapet(8, 3.4, 2.8, PAL.conc, -2, -3.6).use('plain').cyl(0.5, 0.6, 6, PAL.white, 5, 0, -4, 12).use('glass').cyl(1, 0.9, 1, 0x30404f, 5, 6, -4, 12);
      b.use('paint').add(new THREE.CylinderGeometry(0.35, 0.3, 4.2, 12), PAL.white, 1.5, 0.9, 0.6, 0, 0, Math.PI / 2).box(1.0, 0.08, 4.4, PAL.white, 1.5, 0.85, 0.6).box(0.5, 0.9, 0.08, 0xa83a30, -0.4, 0.9, 0.6); break;
    case 'warehouse': lot(b, W); b.use('metal'); for (const z of [-2, 2]) { b.box(6.4, 2.4, 2.8, 0xc4c9ce, 0, 0, z); b.add(new THREE.CylinderGeometry(1.4, 1.4, 6.4, 16, 1, false, 0, Math.PI), 0x8a939c, 0, 2.4, z, 0, 0, Math.PI / 2); }
      b.use('paint').box(1.6, 0.9, 0.8, 0xa83a30, 2.4, 0.06, 0.1); break;
    case 'dike': b.use('plain').box(TS - 0.1, 1.4, TS - 0.1, 0x9a978c, 0, 0, 0).use('lawn').box(TS - 0.6, 0.12, TS - 0.6, PAL.grass, 0, 1.4, 0); break;
  }
  return b.geo();
}
function mRubble() { const b = new GB(); b.use('plain').box(3.4, 0.08, 3.4, 0x8c8478, 0, 0, 0); for (let i = 0; i < 9; i++) b.sph(0.4 + (i % 3) * 0.2, [0x7c756c, 0x5f5952, 0x968b7c][i % 3], -1.2 + (i % 3) * 1.1, 0.15, -1.1 + Math.floor(i / 3) * 1, 1, 0.55, 1, 0); b.use('brick').box(1.4, 0.5, 0.3, PAL.brick, 0.6, 0, -0.9, 0.4).use('plain').box(1.6, 0.1, 0.2, PAL.wood, 0.4, 0.5, 0.3, 0.6); return b.geo(); }
function mTree(v) { const b = new GB(); if (v < 2) b.tree(0, 0, 1, PAL.leaf[v * 2]); else b.pine(0, 0, 1.1); return b.geo(); }
function mRoad(mask, bridge, rural) {   // N=1 E=2 S=4 W=8
  if (rural && !bridge) return mRoadRural(mask);
  const b = new GB(), h = H;
  if (bridge) { b.use('plain').box(TS, 0.5, TS, 0xa8a49b, 0, -0.45, 0); if (!(mask & 1) || !(mask & 4)) b.box(0.5, 1.6, 0.5, 0xa8a49b, 0, -1.6, 0); }
  b.use('asphalt').box(TS, 0.06, TS, PAL.asphalt, 0, 0, 0);
  const curb = bridge ? 0x9aa0a6 : PAL.walk, ch = bridge ? 0.55 : 0.12;
  b.use('pave');
  if (!(mask & 1)) b.box(TS, ch, 0.55, curb, 0, 0, -h + 0.275);
  if (!(mask & 4)) b.box(TS, ch, 0.55, curb, 0, 0, h - 0.275);
  if (!(mask & 8)) b.box(0.55, ch, TS, curb, -h + 0.275, 0, 0);
  if (!(mask & 2)) b.box(0.55, ch, TS, curb, h - 0.275, 0, 0);
  const n = ((mask & 1) ? 1 : 0) + ((mask & 2) ? 1 : 0) + ((mask & 4) ? 1 : 0) + ((mask & 8) ? 1 : 0);
  b.use('plain');
  if (mask === 5) { for (const z of [-1.2, 0.8]) b.box(0.1, 0.07, 0.8, PAL.line, 0, 0, z); if (!bridge) b.use('metal').cyl(0.04, 0.05, 2.2, 0x55595e, -h + 0.25, ch, 0.5, 6).box(0.5, 0.05, 0.12, 0x55595e, -h + 0.5, ch + 2.2, 0.5).use('plain'); }
  else if (mask === 10) { for (const x of [-1.2, 0.8]) b.box(0.8, 0.07, 0.1, PAL.line, x, 0, 0); if (!bridge) b.use('metal').cyl(0.04, 0.05, 2.2, 0x55595e, 0.5, ch, -h + 0.25, 6).box(0.12, 0.05, 0.5, 0x55595e, 0.5, ch + 2.2, -h + 0.5).use('plain'); }
  else if (n >= 3 && !bridge) { for (const [m, x, z, ry] of [[1, 0, -1.6, 0], [4, 0, 1.6, 0], [2, 1.6, 0, 1], [8, -1.6, 0, 1]]) if (mask & m) for (let i = -2; i <= 2; i++) b.box(ry ? 0.6 : 0.26, 0.07, ry ? 0.26 : 0.6, PAL.line, x + (ry ? 0 : i * 0.55), 0, z + (ry ? i * 0.55 : 0)); }
  return b.geo();
}
// ---------- vozidla a lidé ----------
// osobní auto z bočního profilu: kapota, čelní sklo, střecha, záď
function sedan(b, col) {
  const sh = new THREE.Shape(), P = [[-0.85, 0.14], [0.85, 0.14], [0.87, 0.33], [0.8, 0.43], [0.35, 0.48], [0.12, 0.72], [-0.42, 0.73], [-0.68, 0.5], [-0.86, 0.46]];
  sh.moveTo(P[0][0], P[0][1]); for (const p of P.slice(1)) sh.lineTo(p[0], p[1]); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.74, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 1 }); g.translate(0, 0, -0.37);
  b.use('paint').add(g, col, 0, 0.04, 0);
  const gs = new THREE.Shape(), Q = [[0.33, 0.49], [0.12, 0.7], [-0.41, 0.71], [-0.65, 0.5]]; gs.moveTo(Q[0][0], Q[0][1]); for (const q of Q.slice(1)) gs.lineTo(q[0], q[1]); gs.closePath();
  const gg = new THREE.ExtrudeGeometry(gs, { depth: 0.84, bevelEnabled: false }); gg.translate(0, 0, -0.42);
  b.use('glass').add(gg, 0x22303c, 0, 0.04, 0);
  b.use('plain').box(0.04, 0.08, 0.16, 0xfff4d8, 0.88, 0.3, 0.26).box(0.04, 0.08, 0.16, 0xfff4d8, 0.88, 0.3, -0.26).box(0.04, 0.07, 0.16, 0xb8251f, -0.88, 0.36, 0.26).box(0.04, 0.07, 0.16, 0xb8251f, -0.88, 0.36, -0.26);
}
function mCar(kind) {
  const b = new GB();
  const body = (l, w, h, col, cabL, cabX) => { b.use('paint').box(l, h, w, col, 0, 0.18, 0).add(new THREE.BoxGeometry(cabL, h * 0.75, w * 0.86), col, cabX, 0.18 + h + h * 0.37, 0, 0, 0, 0); b.use('glass').box(cabL + 0.04, h * 0.5, w * 0.88, 0x2b3642, cabX, 0.18 + h + 0.05, 0); };
  if (kind === 'bus') { b.use('paint').box(3.2, 1.0, 1.0, 0xe8e8e4, 0, 0.18, 0).use('glass').box(3.22, 0.36, 1.02, 0x2b3642, 0, 0.7, 0).use('paint').box(3.22, 0.12, 1.02, 0xb8251f, 0, 0.3, 0); }
  else if (kind === 'fire') { b.use('paint').box(2.6, 0.9, 1.0, 0xb8251f, 0, 0.18, 0).use('glass').box(0.6, 0.4, 0.96, 0x2b3642, 1.0, 0.75, 0).use('metal').box(1.6, 0.08, 0.25, PAL.steel, -0.3, 1.1, 0); }
  else if (kind === 'police') { sedan(b, 0xf2f2f0); b.use('paint').box(1.74, 0.1, 0.8, 0x2c4f8f, 0, 0.36, 0).use('plain').box(0.25, 0.08, 0.5, 0x3a6fe0, -0.15, 0.77, 0); }
  else if (kind === 'army') { b.use('paint').box(2.4, 0.9, 1.0, 0x4f5a34, 0, 0.25, 0).use('plain').box(1.4, 0.7, 1.02, 0x5d6a40, -0.4, 1.15, 0); }
  else if (kind === 'tank' || kind === 'etank') { const c = kind === 'tank' ? 0x4f5a34 : 0x6e4a3a; b.use('paint').box(2.4, 0.6, 1.4, c, 0, 0.2, 0).box(1.1, 0.45, 0.9, c, -0.1, 0.8, 0).hcyl(0.08, 1.6, 0x2f2f2a, 1.2, 1.0, 0, Math.PI / 2, 8); }
  else sedan(b, 0xffffff);
  b.use('plain'); for (const x of [-0.55, 0.55]) for (const z of [-0.42, 0.42]) b.hcyl(0.19, 0.12, 0x1e1f22, x * (kind === 'bus' ? 2 : 1), 0.19, z, 0, 10);
  return b.geo();
}
function mPerson(kind) {
  const b = new GB(), body = kind === 'police' ? 0x1f2f55 : kind === 'army' ? 0x4f5a34 : kind === 'enemy' ? 0x6a3a30 : 0xffffff;
  b.use('plain').cyl(0.17, 0.2, 0.85, body, 0, 0, 0, 8).sph(0.15, kind === 'police' || kind === 'army' || kind === 'enemy' ? 0x24262b : 0xd9ad88, 0, 1.0, 0, 1, 1.1, 1, 1);
  if (kind === 'police') b.use('glass').box(0.06, 0.7, 0.48, 0x9fb7c9, 0.26, 0.15, 0);
  if (kind === 'protest') b.use('plain').cyl(0.02, 0.02, 1.0, PAL.wood, 0.26, 0.4, 0, 4).box(0.04, 0.38, 0.58, PAL.white, 0.26, 1.25, 0);
  return b.geo();
}

// ---------- ráz zástavby: vesnice, předměstí, historické město ----------
const VWALL = [0xf1ede4, 0xe9d9a8, 0xd9e2e6, 0xf0e6cf, 0xe6d0c0], VROOF = [0x9a4a35, 0x4a4f57, 0x7a4a36, 0x8f3f2e, 0x6a4a3a];
function hedge(b, w, v) { const pm = b.m; b.use('leaf'); const c = 0x3f6a35; b.box(w, 0.55, 0.3, c, 0, 0, w / 2 - 0.15).box(0.3, 0.55, w, c, -w / 2 + 0.15, 0, 0).box(0.3, 0.55, w, c, w / 2 - 0.15, 0, 0).box(w, 0.55, 0.3, c, 0, 0, -w / 2 + 0.15); b.m = pm; }
function fence(b, x0, x1, z, along) { const pm = b.m; b.use('wood'); const L = Math.abs(x1 - x0), cx = (x0 + x1) / 2;
  if (along === 'x') b.box(L, 0.08, 0.05, PAL.wood, cx, 0.35, z).box(L, 0.08, 0.05, PAL.wood, cx, 0.65, z); else b.box(0.05, 0.08, L, PAL.wood, z, 0.35, cx).box(0.05, 0.08, L, PAL.wood, z, 0.65, cx);
  for (let t = 0; t <= L; t += 0.5) along === 'x' ? b.box(0.06, 0.8, 0.06, PAL.wood, x0 + t * Math.sign(x1 - x0), 0, z) : b.box(0.06, 0.8, 0.06, PAL.wood, z, 0, x0 + t * Math.sign(x1 - x0));
  b.m = pm; }
function beds(b, x, z, w, d, n) { const pm = b.m; b.use('soil').box(w, 0.1, d, 0x6e5a42, x, 0.04, z).use('leaf'); for (let i = 0; i < n; i++) b.box(w - 0.15, 0.14, 0.12, [0x4f7a36, 0x6a8f3f, 0x5f7f35][i % 3], x, 0.12, z - d / 2 + (i + 0.5) * d / n); b.m = pm; }
// vesnické stavení: štítem do ulice, dvůr, stodola, zahrádka
function mResVillage(l, v) {
  const b = new GB(), wall = VWALL[v], roof = VROOF[v];
  lot(b, 3.9, PAL.grass, 'lawn'); b.use('soil').box(1.7, 0.03, 2.6, 0xb8a98f, 1.0, 0.05, 0.3);
  const dep = l >= 3 ? 3.4 : 3.0;
  b.facade('res', 1, 1.45, 2.0, dep, wall, -0.85, 0, 1.75 - dep / 2 - 0.2).use('tile').gable(2.35, 1.75, dep + 0.3, roof, -0.85, 1.45, 1.75 - dep / 2 - 0.2, 0);
  b.use('brick').box(0.28, 0.7, 0.28, PAL.brick, -0.85, 2.6, 0.1).use('plain').box(1.7, 1.0, 0.16, wall, 1.0, 0, 1.78).use('wood').box(1.0, 0.95, 0.06, 0x6a4a30, 1.05, 0, 1.87);
  if (l >= 2) b.use('wood').box(3.5, 1.5, 1.05, 0x8a6a48, 0.15, 0, -1.4).use('tile').gable(3.7, 1.0, 1.25, roof, 0.15, 1.5, -1.4, Math.PI / 2);
  else b.use('wood').box(1.0, 1.0, 0.9, 0x8a6a48, 1.25, 0, -1.3).use('tile').gable(1.15, 0.6, 1.05, roof, 1.25, 1.0, -1.3, Math.PI / 2);
  b.use('wood'); for (let i = 0; i < 3; i++) b.hcyl(0.12, 0.8, 0x9a7a52, 1.55, 0.13 + i * 0.22, 0.6 - i * 0.05, 0, 8);
  if (l >= 3) { b.use('glass'); for (let i = 0; i < 3; i++) b.add(new THREE.BoxGeometry(0.55, 0.04, 0.8), 0x1b2a40, -0.4, 2.35, 0.9 - i * 0.9, 0, 0, -0.76); b.facade('res', 1, 1.2, 1.2, 1.2, wall, 0.4, 0, 0.1).use('tile').gable(1.4, 0.7, 1.3, roof, 0.4, 1.2, 0.1, Math.PI / 2); }
  b.tree(1.3, 1.0, 0.55, 0x6a8f3f);
  return b.geo();
}
// řadové domy ve městě
function mResRow(l, v) {
  const b = new GB(), n = l + 1;
  lot(b, 3.9, PAL.walk, 'pave');
  for (let i = 0; i < 3; i++) { const c = PAL.walls[(v + i * 2) % 5], x = -1.27 + i * 1.27;
    b.facade('res', n, 1.25, 1.24, 2.6, c[0], x, 0, -0.3).use('tile').gable(1.3, 1.0, 2.8, c[1], x, n * 1.25, -0.3, 0).use('plain').box(0.45, 0.9, 0.06, PAL.wood, x + 0.25, 0, 1.01).use('lawn').box(1.15, 0.06, 0.65, PAL.grass, x, 0.06, 1.5); }
  return b.geo();
}
// historické měšťanské domy (a obchody v přízemí)
function mResHist(l, v, shop) {
  const b = new GB(), n = l + 2, PAST = [0xead9a6, 0xe6c2b4, 0xc9d8c0, 0xe8e2d4, 0xd8c2d6];
  lot(b, 3.9, 0xbfb8a8, 'pave');
  for (let i = 0; i < 2; i++) { const c = PAST[(v + i * 3) % 5], x = -0.95 + i * 1.9, h = (n - (i && l < 3 ? 1 : 0));
    if (shop) b.facade('shop', 1, 1.6, 1.86, 3.4, c, x, 0, 0).facade('stone', h - 1, 1.35, 1.86, 3.4, c, x, 1.6, 0);
    else b.use('plain').box(1.86, 0.5, 3.4, 0xb8b0a0, x, 0, 0).facade('stone', h, 1.35, 1.86, 3.4, c, x, 0.5, 0);
    const top = (shop ? 1.6 + (h - 1) * 1.35 : 0.5 + h * 1.35);
    b.use('plain').box(1.95, 0.18, 3.5, 0xf0ece2, x, top - 0.18, 0).use('tile').gable(1.95, 1.9, 3.5, VROOF[(v + i) % 5], x, top, 0, Math.PI / 2);
    b.use('res').facade('res', 1, 0.75, 0.6, 0.6, c, x, top + 0.2, 1.05).use('tile').gable(0.75, 0.5, 0.75, VROOF[(v + i) % 5], x, top + 0.95, 1.05, 0); }
  if (shop) { b.use('plain'); for (let i = 0; i < 4; i++) b.cyl(0.1, 0.12, 1.5, 0xe8e2d4, -1.6 + i * 1.07, 0, 1.9, 8); }
  return b.geo();
}
// hospoda nebo smíšené zboží na návsi
function mComVillage(l, v) {
  const b = new GB(), wall = VWALL[(v + 1) % 5], roof = VROOF[v], sc = [0xa83a30, 0x2f5f9f, 0x3f7f4f, 0xc77a2e, 0x6a4f8f][v];
  lot(b, 3.9, PAL.walk, 'pave');
  b.facade('shop', 1, 1.6, 3.2, 2.2, wall, 0, 0, -0.6).use('tile').gable(3.5, 1.4, 2.5, roof, 0, 1.6, -0.6, Math.PI / 2);
  b.use('plain').box(1.8, 0.42, 0.08, sc, 0, 1.15, 0.54).box(1.3, 0.14, 0.09, PAL.white, 0, 1.28, 0.55);
  b.use('wood'); for (let i = 0; i < (l >= 2 ? 3 : 2); i++) { const x = -1.2 + i * 1.2; b.box(0.7, 0.06, 0.5, 0x8a6a48, x, 0.55, 1.35).box(0.7, 0.05, 0.16, 0x8a6a48, x, 0.32, 1.0).box(0.7, 0.05, 0.16, 0x8a6a48, x, 0.32, 1.7).use('metal').cyl(0.03, 0.03, 1.4, PAL.steel, x, 0, 1.35, 6).use('plain').cone(0.6, 0.3, [0xd8d0b8, sc][i % 2], x, 1.3, 1.35, 10).use('wood'); }
  b.tree(1.6, -1.6, 0.8, PAL.leaf[1]);
  return b.geo();
}
// statek: stodola, kravín, sila, seno, traktor
function mFarm(l, v, key) {
  const b = new GB();
  lot(b, 3.9, 0x9c9070, 'soil');
  b.use('wood').box(2.4, 1.8, 1.6, 0x8a5a3a, -0.6, 0, -1.0).use('tile').gable(2.6, 1.3, 1.8, 0x8f3f2e, -0.6, 1.8, -1.0, Math.PI / 2);
  if (l >= 2) b.facade('res', 1, 1.3, 1.4, 3.2, 0xf0ece2, 1.15, 0, 0.2).use('tile').gable(1.6, 0.9, 3.4, 0x7a4a36, 1.15, 1.3, 0.2, 0);
  if (l >= 2) { b.use('metal').cyl(0.5, 0.5, 3.2 + l * 0.4, 0xc9cdd0, -1.4, 0, 1.2, 14).cone(0.52, 0.5, 0xb0b5b8, -1.4, 3.2 + l * 0.4, 1.2, 14); }
  if (l >= 3) b.use('metal').cyl(0.45, 0.45, 3.4, 0xc9cdd0, -0.4, 0, 1.4, 14).cone(0.47, 0.45, 0xb0b5b8, -0.4, 3.4, 1.4, 14);
  b.use('plain'); for (let i = 0; i < 3; i++) b.hcyl(0.3, 0.5, 0xd9c27a, 0.2 + i * 0.65, 0.3, 1.5, Math.PI / 2, 12);
  b.use('paint').box(0.7, 0.4, 0.45, 0x2f7f3f, -0.3, 0.25, 0.5).box(0.32, 0.35, 0.42, 0x2f7f3f, -0.45, 0.65, 0.5).use('plain').hcyl(0.22, 0.12, 0x1e1f22, -0.55, 0.22, 0.75, 0, 10).hcyl(0.22, 0.12, 0x1e1f22, -0.55, 0.22, 0.25, 0, 10).hcyl(0.13, 0.1, 0x1e1f22, 0.0, 0.13, 0.75, 0, 8).hcyl(0.13, 0.1, 0x1e1f22, 0.0, 0.13, 0.25, 0, 8);
  return b.geo();
}
function mSawmill(l, v) {
  const b = new GB();
  lot(b, 3.9, 0x9c9070, 'soil');
  b.use('metal').box(2.6, 1.8, 1.8, 0xb8b4aa, -0.4, 0, -0.9).gable(2.8, 0.6, 2.0, 0x8a939c, -0.4, 1.8, -0.9, Math.PI / 2);
  b.use('wood'); for (let r = 0; r < 2 + l; r++) for (let i = 0; i < 4 - (r % 2); i++) b.hcyl(0.16, 2.2, 0x8a6a48, 0.6, 0.16 + r * 0.28, 0.7 + i * 0.33 + (r % 2) * 0.16, 0, 8);
  b.use('wood'); for (let i = 0; i < 3; i++) b.box(1.2, 0.3, 0.5, 0xb89a6a, -1.2, i * 0.3, 1.3);
  return b.geo();
}
// zahrada: záhony, ovocné stromy, kůlna, skleník, plot
function mGarden(v) {
  const b = new GB();
  lot(b, 3.95, PAL.grass, 'lawn');
  if (v === 0) { beds(b, -0.8, 0.2, 1.6, 2.6, 6); beds(b, 0.9, 0.9, 1.2, 1.4, 4); b.use('wood').box(0.9, 0.9, 0.8, 0x8a6a48, 1.1, 0, -1.2).use('tile').gable(1.0, 0.45, 0.9, 0x7a4a36, 1.1, 0.9, -1.2, Math.PI / 2); }
  else if (v === 1) { for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.tree(x, z, 0.6, [0x5d8a3a, 0x6a8f3f][(x + z + 4) % 2]); }
  else { b.tree(-1.1, -1.0, 0.65, 0x5d8a3a).tree(1.2, 1.1, 0.55, 0x6a8f3f); beds(b, 0.6, -0.7, 1.4, 1.4, 4); b.use('glass').box(1.0, 0.75, 1.4, 0x7f9a95, -0.8, 0, 1.0).use('wood').box(0.5, 0.7, 0.5, 0x5a4532, 1.4, 0, -1.5); }
  fence(b, -1.95, 1.95, -1.95, 'x'); fence(b, -1.95, 1.95, 1.95, 'z');
  return b.geo();
}
function mField() { const b = new GB(); b.use('field').box(TS, 0.06, TS, 0xffffff, 0, 0, 0); return b.geo(); }
function mChurch() {
  const b = new GB(), W = 2 * TS - 0.6;
  lot(b, W, PAL.grass, 'lawn'); b.use('pave').box(1.2, 0.05, W, 0xbfb8a8, 0, 0.06, 0);
  b.facade('stone', 1, 2.8, 2.7, 4.4, 0xefe8d8, 0, 0, -1.0).use('tile').gable(3.0, 2.3, 4.6, 0x8f3f2e, 0, 2.8, -1.0, 0).use('plain').cyl(1.3, 1.3, 2.8, 0xefe8d8, 0, 0, -3.1, 16).use('tile').cone(1.4, 1.6, 0x8f3f2e, 0, 2.8, -3.1, 16);
  b.facade('stone', 4, 1.5, 1.6, 1.6, 0xefe8d8, 0, 0, 1.9).use('metal').pyr(1.75, 3.4, 0x4f7f6a, 0, 6, 1.9).use('plain').cyl(0.35, 0.35, 0.06, PAL.white, 0, 5.1, 2.72, 16).box(0.06, 0.8, 0.06, 0xd9b84a, 0, 9.4, 1.9).box(0.4, 0.06, 0.06, 0xd9b84a, 0, 9.9, 1.9);
  b.tree(-2.6, 2.4, 0.9, PAL.leaf[0]).tree(2.6, 2.6, 0.8, PAL.leaf[2]).tree(2.6, -2.8, 0.9, PAL.leaf[1]);
  return b.geo();
}

// venkovská silnice: užší asfalt, travnatá krajnice, bez chodníků a lamp
function mRoadRural(mask) {
  const b = new GB(), w = 2.5, h = H;
  b.use('lawn').box(TS, 0.03, TS, 0x6a7f4a, 0, 0, 0).use('asphalt').box(w, 0.07, w, 0x505357, 0, 0, 0);
  const arms = [[1, 0, -(h + w / 2) / 2, w, h - w / 2], [4, 0, (h + w / 2) / 2, w, h - w / 2], [2, (h + w / 2) / 2, 0, h - w / 2, w], [8, -(h + w / 2) / 2, 0, h - w / 2, w]];
  for (const [m, x, z, aw, ad] of arms) if (mask & m) b.box(m === 2 || m === 8 ? ad : aw, 0.07, m === 2 || m === 8 ? aw : ad, 0x505357, x, 0, z);
  b.use('plain');
  if (mask === 5) for (const z of [-1.2, 0.8]) b.box(0.08, 0.075, 0.8, 0xe8e6de, 0, 0, z);
  else if (mask === 10) for (const x of [-1.2, 0.8]) b.box(0.8, 0.075, 0.08, 0xe8e6de, x, 0, 0);
  if (mask === 5) b.box(0.06, 0.08, TS, 0xd8d6ce, w / 2 - 0.12, 0, 0).box(0.06, 0.08, TS, 0xd8d6ce, -w / 2 + 0.12, 0, 0);
  if (mask === 10) b.box(TS, 0.08, 0.06, 0xd8d6ce, 0, 0, w / 2 - 0.12).box(TS, 0.08, 0.06, 0xd8d6ce, 0, 0, -w / 2 + 0.12);
  return b.geo();
}
