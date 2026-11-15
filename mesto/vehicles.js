'use strict';
// Podrobné modely vozidel a lidí: auta pěti typů, autobus, tramvaj, hasiči, policie, armáda, vrtulník,
// vlaky (jednotky, lokomotivy, vozy, nákladní vagony), lodě a dopravní letadla.
// Všechno je natočené přídí do +x, kola stojí na y = 0.

// ---------- stavební pomůcky ----------
function shapeOf(pts) { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); return s; }
// boční profil (x, y) vytažený do šířky w, zaoblené hrany
function sideBody(b, pts, w, col, bev, x, y) {
  const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth: w - 2 * (bev || 0), bevelEnabled: !!bev, bevelThickness: bev || 0, bevelSize: bev || 0, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -(w - 2 * (bev || 0)) / 2); return b.add(g, col, x || 0, y || 0, 0);
}
// příčný průřez (z, y) se zaobleným střechou, vytažený podél x
function xsecBody(b, len, w, h, r, col, x, y, taper) {
  const s = new THREE.Shape(), hw = w / 2, t = taper || 0;
  s.moveTo(-hw + t, 0); s.lineTo(hw - t, 0); s.lineTo(hw, h * 0.35); s.lineTo(hw, h - r); s.quadraticCurveTo(hw, h, hw - r, h); s.lineTo(-hw + r, h); s.quadraticCurveTo(-hw, h, -hw, h - r); s.lineTo(-hw, h * 0.35); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, curveSegments: 5 }); g.translate(0, 0, -len / 2); g.rotateY(Math.PI / 2);
  return b.add(g, col, x || 0, y || 0, 0);
}
// kola: pneumatika, disk a náboj na obou stranách
function wheels(b, xs, hw, r, tw, rimCol) {
  const pm = b.m;
  for (const x of xs) for (const s of [-1, 1]) {
    // pneumatika + disk a náboj jen jako kruhy z vnější strany (málo trojúhelníků, auta jich jsou stovky)
    b.use('plain').add(new THREE.CylinderGeometry(r, r, tw, 10), 0x1b1c1f, x, r, s * hw, Math.PI / 2, 0, 0);
    b.use('metal').add(new THREE.CircleGeometry(r * 0.62, 8), rimCol || 0xb8bec4, x, r, s * (hw + tw / 2 + 0.006), 0, s < 0 ? Math.PI : 0, 0);
    b.use('plain').add(new THREE.CircleGeometry(r * 0.2, 6), 0x4a4d52, x, r, s * (hw + tw / 2 + 0.012), 0, s < 0 ? Math.PI : 0, 0);
  }
  b.m = pm;
}
// tenký panel (okno, světlo) na boku: x od–do, y od–do, strana z
function sidePanel(b, mat, col, x0, x1, y0, y1, z, t) { const pm = b.m; b.use(mat).box(x1 - x0, y1 - y0, t || 0.02, col, (x0 + x1) / 2, y0, z); b.m = pm; }
function slantGlass(b, x, y, w, h, z0, ang, col) { const pm = b.m; b.use('glass').add(new THREE.BoxGeometry(0.02, h, w), col || 0x1d2731, x, y, z0 || 0, 0, 0, ang); b.m = pm; }

// vloží díly jiného stavebnice (už s barvami a materiály) s posunem a natočením
function mergeGB(dst, src, x, y, z, ry) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x || 0, y || 0, z || 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry || 0), new THREE.Vector3(1, 1, 1));
  for (const p of src.parts) { const g = p.g.clone(); g.applyMatrix4(m); dst.parts.push({ g, col: p.col, m: p.m, uvo: p.uvo }); }
  return dst;
}

// ---------- osobní auta ----------
// profily (x, y), délka ~1,75; šířka 0,78
const CAR_TYPES = {
  sedan: { p: [[-0.88, 0.16], [0.88, 0.16], [0.9, 0.36], [0.84, 0.45], [0.36, 0.5], [0.12, 0.74], [-0.4, 0.75], [-0.66, 0.53], [-0.86, 0.5], [-0.9, 0.36]], wf: [0.35, 0.5, 0.12, 0.73], wr: [-0.65, 0.52, -0.42, 0.74], side: [[-0.6, 0.53], [-0.4, 0.72], [0.1, 0.72], [0.32, 0.52]], w: 0.78 },
  hatch: { p: [[-0.78, 0.16], [0.8, 0.16], [0.82, 0.36], [0.76, 0.46], [0.32, 0.51], [0.08, 0.76], [-0.62, 0.77], [-0.76, 0.6], [-0.8, 0.36]], wf: [0.31, 0.51, 0.08, 0.75], wr: [-0.77, 0.58, -0.64, 0.76], side: [[-0.7, 0.56], [-0.6, 0.74], [0.06, 0.74], [0.28, 0.53]], w: 0.76 },
  kombi: { p: [[-0.92, 0.16], [0.9, 0.16], [0.92, 0.36], [0.86, 0.45], [0.38, 0.5], [0.15, 0.74], [-0.82, 0.75], [-0.9, 0.58], [-0.93, 0.36]], wf: [0.37, 0.5, 0.14, 0.73], wr: [-0.92, 0.57, -0.84, 0.74], side: [[-0.85, 0.55], [-0.8, 0.72], [0.13, 0.72], [0.34, 0.52]], w: 0.8 },
  suv: { p: [[-0.88, 0.22], [0.88, 0.22], [0.9, 0.45], [0.84, 0.56], [0.4, 0.6], [0.18, 0.88], [-0.76, 0.9], [-0.88, 0.7], [-0.9, 0.45]], wf: [0.39, 0.6, 0.17, 0.87], wr: [-0.88, 0.68, -0.78, 0.88], side: [[-0.8, 0.65], [-0.74, 0.86], [0.15, 0.86], [0.36, 0.62]], w: 0.84, r: 0.21 },
  van: { p: [[-0.98, 0.18], [0.98, 0.18], [1.0, 0.4], [0.94, 0.55], [0.7, 0.62], [0.52, 1.02], [-0.96, 1.04], [-1.0, 0.4]], wf: [0.69, 0.63, 0.53, 1.0], wr: null, side: [[0.2, 0.66], [0.2, 0.98], [0.5, 0.98], [0.66, 0.66]], w: 0.84, r: 0.19 },
};
function mPassengerCar(type) { const b = new GB(); buildCar(b, type, 0xffffff); return b.geo(); }
function buildCar(b, type, paint) {
  const T0 = CAR_TYPES[type], w = T0.w, hw = w / 2, r = T0.r || 0.17;
  b.use('paint'); sideBody(b, T0.p, w, paint, 0.035);
  b.use('plain').box(1.5, 0.08, w - 0.08, 0x1e1f22, 0, 0.12, 0);   // podvozek
  // okna: čelní a zadní sklo, boční okna se sloupky
  const [fx0, fy0, fx1, fy1] = T0.wf, fa = Math.atan2(fy1 - fy0, fx1 - fx0);
  b.use('glass').add(new THREE.BoxGeometry(Math.hypot(fx1 - fx0, fy1 - fy0), 0.02, w - 0.1), 0x1d2731, (fx0 + fx1) / 2 + 0.012, (fy0 + fy1) / 2 + 0.012, 0, 0, 0, fa);
  if (T0.wr) { const [rx0, ry0, rx1, ry1] = T0.wr; b.add(new THREE.BoxGeometry(Math.hypot(rx1 - rx0, ry1 - ry0), 0.02, w - 0.12), 0x1d2731, (rx0 + rx1) / 2 - 0.012, (ry0 + ry1) / 2 + 0.012, 0, 0, 0, Math.atan2(ry1 - ry0, rx1 - rx0)); }
  const sw = shapeOf(T0.side), sg = new THREE.ExtrudeGeometry(sw, { depth: w + 0.012, bevelEnabled: false }); sg.translate(0, 0, -(w + 0.012) / 2); b.use('glass').add(sg, 0x1d2731, 0, 0, 0);
  if (type !== 'van') { const mid = (T0.side[1][0] + T0.side[2][0]) / 2 - 0.05; b.use('paint').box(0.05, T0.side[1][1] - T0.side[0][1] + 0.02, w + 0.02, paint, mid, T0.side[0][1], 0); }
  // světla, nárazníky, SPZ, zrcátka, kliky
  const front = T0.p[1][0], back = T0.p[0][0], ly = type === 'suv' ? 0.42 : 0.33;
  b.use('plain').box(0.05, 0.1, w - 0.04, 0x2a2c30, front + 0.025, 0.16, 0).box(0.05, 0.1, w - 0.04, 0x2a2c30, back - 0.025, 0.16, 0);
  for (const s of [-1, 1]) { b.box(0.03, 0.06, 0.16, 0xfff6e0, front + 0.03, ly, s * (hw - 0.12)).box(0.03, 0.07, 0.14, 0xb01818, back - 0.025, ly + 0.04, s * (hw - 0.11));
    b.use('paint').box(0.06, 0.05, 0.08, paint, T0.wf[0] - 0.04, T0.wf[1] + 0.01, s * (hw + 0.03)).use('plain'); }
  b.box(0.012, 0.05, 0.18, 0xf2f2ee, front + 0.05, 0.2, 0).box(0.012, 0.05, 0.18, 0xf2f2ee, back - 0.05, 0.22, 0);
  if (type === 'van') b.use('plain').box(0.02, 0.32, 0.01, 0x2a2c30, -0.2, 0.3, hw + 0.006).box(1.2, 0.012, 0.01, 0x2a2c30, -0.35, 0.62, hw + 0.006);
  wheels(b, [front - 0.3, back + 0.3], hw - 0.02, r, 0.12);
  return b;
}
// zaparkované auto v modelech staveb (díly se pak posouvají)
function sedan(b, col) { const t = new GB(); buildCar(t, 'kombi', col); return mergeGB(b, t, 0, 0, 0, 0); }

// ---------- autobus, tramvaj ----------
function mBus() {
  const b = new GB(), L = 3.7, w = 0.98, hw = w / 2;
  b.use('paint'); sideBody(b, [[-L / 2, 0.14], [L / 2, 0.14], [L / 2 + 0.04, 0.5], [L / 2, 1.22], [L / 2 - 0.12, 1.3], [-L / 2 + 0.06, 1.3], [-L / 2, 1.2]], w, 0xe8e8e4, 0.04);
  b.use('paint').box(L + 0.02, 0.22, w + 0.02, 0xc8372d, 0, 0.2, 0);
  b.use('glass'); for (const s of [-1, 1]) sidePanel(b, 'glass', 0x1d2731, -L / 2 + 0.25, L / 2 - 0.35, 0.62, 1.14, s * (hw + 0.012));
  b.add(new THREE.BoxGeometry(0.03, 0.8, w - 0.08), 0x1d2731, L / 2 + 0.03, 0.83, 0, 0, 0, -0.05).box(0.02, 0.3, w - 0.2, 0x1d2731, -L / 2 - 0.01, 0.85, 0);
  b.use('plain').box(0.025, 0.12, w - 0.3, 0x111214, L / 2 + 0.05, 1.12, 0).box(0.026, 0.06, w - 0.4, 0xffa21a, L / 2 + 0.055, 1.15, 0);
  for (const x of [L / 2 - 0.45, 0.1, -L / 2 + 0.7]) { sidePanel(b, 'glass', 0x26303a, x - 0.22, x + 0.22, 0.2, 1.14, hw + 0.016); b.box(0.02, 0.92, 0.01, 0x2a2c30, x, 0.2, hw + 0.022); }
  for (let i = 0; i < 6; i++) b.box(0.03, 0.52, 0.015, 0xe8e8e4, -L / 2 + 0.6 + i * 0.5, 0.62, hw + 0.02).box(0.03, 0.52, 0.015, 0xe8e8e4, -L / 2 + 0.6 + i * 0.5, 0.62, -hw - 0.02);
  b.use('metal').box(1.1, 0.18, 0.7, 0xc9ccd0, -0.6, 1.3, 0);
  b.use('plain'); for (const s of [-1, 1]) b.box(0.04, 0.07, 0.16, 0xfff6e0, L / 2 + 0.04, 0.38, s * 0.34).box(0.03, 0.1, 0.1, 0xb01818, -L / 2 - 0.02, 0.4, s * 0.38);
  wheels(b, [L / 2 - 0.62, -L / 2 + 0.85], hw - 0.04, 0.2, 0.15, 0x8a9097);
  return b.geo();
}
function mTramV() {
  const b = new GB(), w = 0.96, hw = w / 2, red = 0xc8372d, cream = 0xf0e8d8;
  const sec = [[-1.75, 1.6], [0, 1.7], [1.75, 1.6]];   // tři články
  for (const [cx, len] of sec) { b.use('paint'); xsecBody(b, len, w, 1.28, 0.22, cream, cx, 0.12); b.box(len + 0.01, 0.3, w + 0.01, red, cx, 0.12, 0); b.box(len + 0.01, 0.08, w + 0.01, red, cx, 1.06, 0);
    for (const s of [-1, 1]) sidePanel(b, 'glass', 0x1d2731, cx - len / 2 + 0.12, cx + len / 2 - 0.12, 0.5, 1.02, s * (hw + 0.008));
    b.use('plain'); for (const s of [-1, 1]) b.box(0.03, 0.52, 0.02, cream, cx, 0.5, s * (hw + 0.014)); }
  // čela s velkým sklem
  for (const s of [-1, 1]) { b.use('paint'); sideBody(b, [[0, 0.12], [0.32, 0.12], [0.38, 0.5], [0.28, 1.25], [0, 1.4]].map(p => [s * p[0], p[1]]), w, red, 0.03, s * 2.55, 0); }
  for (const s of [-1, 1]) { const x = s * 2.88; b.use('glass').add(new THREE.BoxGeometry(0.03, 0.62, w - 0.14), 0x1d2731, x, 0.9, 0, 0, 0, s * -0.12); b.use('plain').box(0.03, 0.12, w - 0.3, 0x111214, s * 2.83, 1.28, 0).box(0.03, 0.06, w - 0.44, 0xffa21a, s * 2.84, 1.31, 0);
    for (const z of [-0.3, 0.3]) b.box(0.03, 0.06, 0.12, 0xfff6e0, s * 2.94, 0.38, z); }
  // mechy mezi články, dveře, střecha, sběrač
  b.use('plain'); for (const x of [-0.9, 0.9]) b.box(0.12, 1.1, w - 0.1, 0x2a2c30, x, 0.2, 0);
  for (const x of [-1.9, -0.3, 1.3]) for (const s of [-1, 1]) { sidePanel(b, 'glass', 0x26303a, x - 0.2, x + 0.2, 0.18, 1.04, s * (hw + 0.016)); b.box(0.02, 0.86, 0.01, 0x2a2c30, x, 0.18, s * (hw + 0.022)); }
  b.use('metal').box(1.0, 0.16, 0.6, 0x8a9097, -1.75, 1.4, 0).box(0.8, 0.16, 0.6, 0x8a9097, 1.75, 1.4, 0);
  b.use('plain').box(0.5, 0.04, 0.4, 0x2a2c30, 0, 1.42, 0).add(new THREE.BoxGeometry(0.03, 0.55, 0.03), 0x2a2c30, -0.12, 1.66, 0, 0, 0, 0.55).add(new THREE.BoxGeometry(0.03, 0.55, 0.03), 0x2a2c30, 0.12, 1.66, 0, 0, 0, -0.55).box(0.06, 0.03, 0.55, 0x2a2c30, 0, 1.9, 0);
  b.use('plain'); for (const x of [-2.1, 0, 2.1]) b.box(0.55, 0.14, w - 0.12, 0x1e1f22, x, 0.02, 0);
  return b.geo();
}

// ---------- zásahová a vojenská vozidla ----------
function mFireTruck(ladder) { const b = new GB(); buildFireTruck(b, ladder); return b.geo(); }
function buildFireTruck(b, ladder) {
  const w = 0.98, hw = w / 2, red = 0xc41e1e;
  b.use('paint'); sideBody(b, [[0.55, 0.22], [1.32, 0.22], [1.36, 0.5], [1.3, 1.08], [1.16, 1.18], [0.55, 1.18]], w, red, 0.03);
  xsecBody(b, 1.85, w, 1.0, 0.06, red, -0.42, 0.22);
  b.use('plain').box(2.7, 0.07, w + 0.02, 0xf2f2ee, 0, 0.62, 0).box(2.7, 0.04, w + 0.02, 0xf0c020, 0, 0.56, 0);
  b.use('glass').add(new THREE.BoxGeometry(0.03, 0.42, w - 0.12), 0x1d2731, 1.33, 0.86, 0, 0, 0, -0.08); for (const s of [-1, 1]) sidePanel(b, 'glass', 0x1d2731, 0.75, 1.2, 0.72, 1.06, s * (hw + 0.008));
  b.use('metal'); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) sidePanel(b, 'metal', 0xc9ccd0, -1.25 + i * 0.58, -0.75 + i * 0.58, 0.3, 1.08, s * (hw + 0.006));
  b.use('plain').box(0.55, 0.08, 0.7, 0x2a2c30, 1.0, 1.18, 0).box(0.2, 0.08, 0.2, 0x2f6fff, 1.0, 1.26, 0.22).box(0.2, 0.08, 0.2, 0x2f6fff, 1.0, 1.26, -0.22);
  if (ladder) { b.use('metal'); for (const z of [-0.18, 0.18]) b.box(2.3, 0.06, 0.05, 0xd8dde2, -0.35, 1.3, z); for (let i = 0; i < 9; i++) b.box(0.04, 0.04, 0.36, 0xd8dde2, -1.4 + i * 0.26, 1.31, 0); b.box(0.3, 0.2, 0.3, 0x8a9097, 0.4, 1.22, 0); }
  else b.use('plain').box(1.7, 0.12, 0.7, 0x8a9097, -0.42, 1.22, 0);
  b.use('plain'); for (const s of [-1, 1]) b.box(0.03, 0.07, 0.14, 0xfff6e0, 1.37, 0.4, s * 0.34);
  wheels(b, [1.0, -0.6, -1.1], hw - 0.06, 0.21, 0.15, 0xd8dde2);
  return b;
}
function mPolice() {
  const b = new GB();
  const T0 = CAR_TYPES.kombi, w = T0.w, hw = w / 2;
  b.use('paint'); sideBody(b, T0.p, w, 0xe8eaec, 0.035);
  b.use('plain').box(1.5, 0.08, w - 0.08, 0x1e1f22, 0, 0.12, 0);
  const [fx0, fy0, fx1, fy1] = T0.wf; b.use('glass').add(new THREE.BoxGeometry(Math.hypot(fx1 - fx0, fy1 - fy0), 0.02, w - 0.1), 0x1d2731, (fx0 + fx1) / 2 + 0.012, (fy0 + fy1) / 2 + 0.012, 0, 0, 0, Math.atan2(fy1 - fy0, fx1 - fx0));
  const sg = new THREE.ExtrudeGeometry(shapeOf(T0.side), { depth: w + 0.012, bevelEnabled: false }); sg.translate(0, 0, -(w + 0.012) / 2); b.add(sg, 0x1d2731, 0, 0, 0);
  for (const s of [-1, 1]) { sidePanel(b, 'paint', 0x1f4fa0, -0.9, 0.9, 0.3, 0.42, s * (hw + 0.012)); sidePanel(b, 'plain', 0xd8e83a, -0.9, 0.9, 0.24, 0.3, s * (hw + 0.012)); }
  b.use('plain').box(0.18, 0.08, 0.6, 0x2a2c30, -0.2, 0.76, 0).box(0.16, 0.06, 0.22, 0x2f6fff, -0.2, 0.84, 0.17).box(0.16, 0.06, 0.22, 0x2f6fff, -0.2, 0.84, -0.17);
  for (const s of [-1, 1]) b.box(0.03, 0.06, 0.16, 0xfff6e0, 0.92, 0.33, s * 0.28).box(0.03, 0.07, 0.14, 0xb01818, -0.95, 0.37, s * 0.29);
  wheels(b, [0.6, -0.62], hw - 0.02, 0.17, 0.12);
  return b.geo();
}
function mArmyTruck() {
  const b = new GB(), w = 1.0, hw = w / 2, ol = 0x4f5a34;
  b.use('paint'); sideBody(b, [[0.7, 0.3], [1.3, 0.3], [1.34, 0.62], [1.2, 1.12], [0.7, 1.12]], w, ol, 0.03);
  b.use('glass').add(new THREE.BoxGeometry(0.03, 0.3, w - 0.15), 0x1d2731, 1.24, 0.92, 0, 0, 0, -0.25);
  b.use('plain').box(1.9, 0.12, w, 0x3a3f2a, -0.35, 0.36, 0); xsecBody(b, 1.8, w, 0.8, 0.3, 0x5d6a40, -0.35, 0.48);
  wheels(b, [1.0, -0.4, -0.95], hw - 0.04, 0.24, 0.17, 0x3a3f2a);
  return b.geo();
}
function mTank(enemy) {
  const b = new GB(), c = enemy ? 0x6e5a42 : 0x4f5a34, w = 1.35, hw = w / 2;
  b.use('paint'); sideBody(b, [[-1.25, 0.22], [1.1, 0.22], [1.3, 0.48], [1.05, 0.68], [-1.2, 0.68], [-1.3, 0.5]], w, c, 0.04);
  b.use('plain'); for (const s of [-1, 1]) { b.box(2.5, 0.42, 0.26, 0x2a2c26, 0, 0.04, s * (hw + 0.05)); for (let i = 0; i < 6; i++) b.add(new THREE.CylinderGeometry(0.15, 0.15, 0.27, 10), 0x3a3d34, -1.0 + i * 0.4, 0.2, s * (hw + 0.05), Math.PI / 2, 0, 0); }
  b.use('paint').add(new THREE.CylinderGeometry(0.48, 0.58, 0.32, 10), c, -0.15, 0.84, 0).sph(0.36, c, -0.15, 1.0, 0, 1.25, 0.5, 1.05).add(new THREE.CylinderGeometry(0.06, 0.07, 1.7, 8), 0x2a2c26, 0.9, 0.93, 0, 0, 0, Math.PI / 2);
  b.use('plain').cyl(0.09, 0.09, 0.12, 0x2a2c26, -0.35, 1.08, 0.2, 8);
  return b.geo();
}
function mHeli() { const b = new GB(); buildHeli(b); return b.geo(); }
function buildHeli(b) {
  const red = 0xc8372d;
  b.use('paint').sph(0.62, red, 0.15, 0.82, 0, 1.6, 0.9, 0.85).add(new THREE.CylinderGeometry(0.1, 0.3, 2.1, 10), red, -1.45, 0.98, 0, 0, 0, Math.PI / 2 - 0.05).box(0.12, 0.62, 0.06, red, -2.45, 1.15, 0).box(0.3, 0.05, 0.62, red, -2.3, 1.0, 0);
  b.use('plain').box(1.9, 0.1, 0.08, 0xf2f2ee, 0.1, 0.55, 0.52).box(1.9, 0.1, 0.08, 0xf2f2ee, 0.1, 0.55, -0.52);
  b.use('glass').sph(0.48, 0x1d2731, 0.62, 0.92, 0, 1.0, 0.72, 0.82);
  b.use('metal'); for (const z of [-0.36, 0.36]) { b.box(1.7, 0.04, 0.05, 0x55595e, 0.1, 0.04, z); b.box(0.04, 0.32, 0.04, 0x55595e, 0.5, 0.05, z).box(0.04, 0.32, 0.04, 0x55595e, -0.3, 0.05, z); }
  b.use('plain').cyl(0.12, 0.16, 0.22, 0x2a2c30, 0.1, 1.38, 0, 8);
  for (let i = 0; i < 4; i++) b.add(new THREE.BoxGeometry(2.0, 0.025, 0.13), 0x22252a, 0.1 + Math.cos(i * Math.PI / 2 + 0.4) * 1.0, 1.62, Math.sin(i * Math.PI / 2 + 0.4) * 1.0, 0, -(i * Math.PI / 2 + 0.4), 0);
  b.box(0.04, 0.5, 0.06, 0x22252a, -2.48, 1.15, 0.08);
  return b;
}

// ---------- jednotné rozhraní pro silniční vozidla ----------
function mCar(kind) {
  if (kind === 'bus') return mBus();
  if (kind === 'tram') return mTramV();
  if (kind === 'fire') return mFireTruck(true);
  if (kind === 'police') return mPolice();
  if (kind === 'army') return mArmyTruck();
  if (kind === 'tank' || kind === 'etank') return mTank(kind === 'etank');
  if (kind === 'heli') return mHeli();
  if (CAR_TYPES[kind]) return mPassengerCar(kind);
  return mPassengerCar('sedan');
}
function mTram() { return mTramV(); }
const CAR_KINDS = ['sedan', 'sedan', 'hatch', 'hatch', 'kombi', 'kombi', 'suv', 'van'];
// realistické barvy laku: hodně bílé, stříbrné, šedé a černé
const REAL_COLS = [0xf4f4f2, 0xf4f4f2, 0xf4f4f2, 0xc5c9ce, 0xc5c9ce, 0x8a9097, 0x8a9097, 0x2a2d33, 0x2a2d33, 0x1d3866, 0x7a1c1c, 0xb8302a, 0x2f6aa8, 0xd6cfbf, 0x3a5236, 0x5a4a3c];

// ---------- lidé: nohy, trup, ruce, hlava, oblečení ----------
const SHIRTS = [0x2f5f9f, 0xc8372d, 0xe8e6e0, 0x3f7f4f, 0xd9a933, 0x7a66a8, 0x2a2d33, 0xe08a5a];
function mPersonV(kind, v) {
  const b = new GB(), shirt = kind === 'police' ? 0x1f2f55 : kind === 'army' ? 0x4f5a34 : kind === 'enemy' ? 0x6a3a30 : SHIRTS[v % SHIRTS.length];
  const pants = kind === 'police' ? 0x1a2238 : kind === 'army' || kind === 'enemy' ? 0x3f4628 : [0x2a3550, 0x3a3d42, 0x5a4a3c, 0x22252a][v % 4], skin = [0xe0b48f, 0xc99a74, 0x8a5e40, 0xf0c8a8][v % 4];
  b.use('plain');
  for (const z of [-0.08, 0.08]) b.box(0.11, 0.45, 0.11, pants, 0, 0, z).box(0.16, 0.06, 0.11, 0x22252a, 0.03, 0, z);
  b.box(0.2, 0.36, 0.3, shirt, 0, 0.45, 0);
  for (const z of [-0.19, 0.19]) b.box(0.08, 0.34, 0.07, shirt, 0, 0.47, z).box(0.07, 0.07, 0.07, skin, 0, 0.42, z);
  b.box(0.08, 0.06, 0.08, skin, 0, 0.81, 0).sph(0.11, skin, 0, 0.94, 0, 1, 1.1, 1, 1);
  if (kind === 'police' || kind === 'army' || kind === 'enemy') b.cyl(0.12, 0.12, 0.07, kind === 'police' ? 0x1a2238 : 0x3f4628, 0, 1.0, 0, 8);
  else b.sph(0.11, [0x2a1d14, 0x5a3a20, 0xc8a060, 0x1a1a1a][v % 4], -0.02, 0.99, 0, 1, 0.7, 1, 1);
  if (kind === 'police') b.use('glass').box(0.04, 0.55, 0.42, 0x9fb7c9, 0.22, 0.25, 0);
  if (kind === 'protest') b.use('plain').cyl(0.015, 0.015, 0.9, PAL.wood, 0.2, 0.4, 0.2, 4).box(0.03, 0.32, 0.5, PAL.white, 0.2, 1.15, 0.2);
  return b.geo();
}
function mPerson(kind) { return mPersonV(kind, 0); }
// barevné varianty postav: barva instance se ignoruje, oblečení je pečené v modelu
function person(kind) {
  const multi = !['police', 'army', 'enemy'].includes(kind);
  return { add: (h, m) => { const v = multi ? (Math.random() * 8) | 0 : 0; return batch('P' + kind + v, () => mPersonV(kind, v), MATS, { shadow: true, cap: 32 }).add(h, m, WHITE); } };
}

// ---------- hasičské vozy v modelech stanic ----------
function truck(b, x, z, ry, ladder) { const t = new GB(); buildFireTruck(t, ladder); mergeGB(b, t, x, 0.06, z, ry + Math.PI / 2); }
function heli(b, x, z, ry) { const t = new GB(); buildHeli(t); mergeGB(b, t, x, 0, z, ry); }

// ---------- železniční vozidla ----------
function bogie(b, x) {
  const pm = b.m; b.use('plain');
  b.box(1.0, 0.16, 0.78, 0x2a2c30, x, 0.1, 0);
  for (const ax of [-0.32, 0.32]) for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 12), 0x3a3d42, x + ax, 0.17, s * 0.37, Math.PI / 2, 0, 0);
  for (const s of [-1, 1]) b.box(0.9, 0.1, 0.05, 0x1e1f22, x, 0.14, s * 0.42);
  b.m = pm;
}
function bogies(b) { bogie(b, -1.15); bogie(b, 1.15); }
// skříň vozu: průřez se zaoblenou střechou, pás oken, dveře, střecha
function railBody(b, o) {
  const L = o.len || CAR_L, ox = o.ox || 0, w = 1.1, hw = w / 2;
  b.use('paint'); xsecBody(b, L, w, 1.18, 0.24, o.col, ox, 0.3, 0.06);
  if (o.band) b.box(L + 0.004, 0.16, w + 0.004, o.band, ox, 0.4, 0);
  if (o.band2) b.box(L + 0.004, 0.05, w + 0.004, o.band2, ox, 0.62, 0);
  const n = o.win || 6, x0 = ox - L / 2 + (o.cabF ? 0.15 : 0.35), x1 = ox + L / 2 - (o.cabF ? 0.75 : 0.35), wl = (x1 - x0) / n;
  for (const s of [-1, 1]) for (let i = 0; i < n; i++) sidePanel(b, 'glass', 0x1d2731, x0 + i * wl + 0.05, x0 + (i + 1) * wl - 0.05, 0.86, 1.2, s * (hw + 0.006));
  if (o.doors) for (const dx of o.doors) for (const s of [-1, 1]) { sidePanel(b, 'paint', o.doorCol || o.col, ox + dx - 0.2, ox + dx + 0.2, 0.32, 1.26, s * (hw + 0.01)); sidePanel(b, 'glass', 0x26303a, ox + dx - 0.14, ox + dx + 0.14, 0.86, 1.2, s * (hw + 0.016)); }
  b.use('metal').box(L - 0.3, 0.06, 0.6, o.roof || 0x8a9097, ox, 1.48, 0);
}
// čelo kabiny se šikmým sklem a světly
function railCab(b, x, col, s, nose) {
  const w = 1.1, d = s || 1, len = nose || 0.55;
  b.use('paint'); sideBody(b, [[0, 0.3], [len, 0.3], [len + 0.06, 0.55], [len - 0.02, 1.2], [len - 0.22, 1.46], [0, 1.48]], w - 0.02, col, 0.05, x - (d < 0 ? 0 : 0), 0);
  b.use('glass').add(new THREE.BoxGeometry(0.03, 0.5, w - 0.22), 0x1d2731, x + d * (len - 0.07), 1.17, 0, 0, 0, d * -0.38);
  b.use('plain'); for (const z of [-0.33, 0.33]) b.box(0.04, 0.07, 0.15, 0xfff6e0, x + d * (len + 0.04), 0.62, z).box(0.03, 0.05, 0.08, 0xb01818, x + d * (len + 0.04), 0.5, z);
  b.box(0.06, 0.12, 0.3, 0x2a2c30, x + d * (len + 0.07), 0.32, 0);
}
function cabNoseMirror(b, x, col, nose) {   // čelo směrem dozadu (−x)
  const w = 1.1, len = nose || 0.55;
  b.use('paint'); sideBody(b, [[0, 0.3], [-len, 0.3], [-len - 0.06, 0.55], [-len + 0.02, 1.2], [-len + 0.22, 1.46], [0, 1.48]], w - 0.02, col, 0.05, x, 0);
  b.use('glass').add(new THREE.BoxGeometry(0.03, 0.5, w - 0.22), 0x1d2731, x - (len - 0.07), 1.17, 0, 0, 0, 0.38);
  b.use('plain'); for (const z of [-0.33, 0.33]) b.box(0.04, 0.07, 0.15, 0xfff6e0, x - (len + 0.04), 0.62, z);
}
function panto(b, x) {
  const pm = b.m; b.use('plain');
  b.box(0.5, 0.05, 0.45, 0x2a2c30, x, 1.5, 0).add(new THREE.BoxGeometry(0.03, 0.42, 0.03), 0x2a2c30, x - 0.1, 1.68, 0, 0, 0, 0.6).add(new THREE.BoxGeometry(0.03, 0.42, 0.03), 0x2a2c30, x + 0.1, 1.68, 0, 0, 0, -0.6).box(0.05, 0.03, 0.6, 0x2a2c30, x, 1.86, 0);
  b.m = pm;
}
function buffers(b, L) { const pm = b.m; b.use('metal'); for (const s of [-1, 1]) for (const z of [-0.3, 0.3]) b.add(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 8), 0x55595e, s * (L / 2 + 0.05), 0.42, z, 0, 0, Math.PI / 2); b.use('plain').box(0.08, 0.1, 0.12, 0x2a2c30, 0, 0.42, 0); b.m = pm; }
function gangway(b, L) { const pm = b.m; b.use('plain'); for (const s of [-1, 1]) b.box(0.12, 0.95, 0.8, 0x1e1f22, s * (L / 2 + 0.04), 0.4, 0); b.m = pm; }
function container(b, x, len, col) { const pm = b.m; b.use('metal').box(len, 0.88, 0.98, col, x, 0.46, 0); b.use('plain').box(0.02, 0.84, 0.94, 0x2a2c30, x + len / 2, 0.48, 0); b.m = pm; }
const WAG_COL = [0xa83a30, 0x2f5f9f, 0x3f7f4f, 0xc77a2e, 0x8a8f96];
function mTrainCar(kind) {
  const b = new GB(), L = CAR_L; bogies(b);
  switch (kind) {
    case 'emuC': railBody(b, { len: L - 0.55, ox: -0.27, col: 0xeceee9, band: 0xc8372d, band2: 0xc8372d, win: 5, doors: [-0.9], doorCol: 0xc8372d }); railCab(b, L / 2 - 0.55, 0xeceee9); gangway(b, L); break;
    case 'emuM': railBody(b, { col: 0xeceee9, band: 0xc8372d, band2: 0xc8372d, win: 6, doors: [-1.1, 1.1], doorCol: 0xc8372d }); panto(b, 0.4); b.use('metal').box(0.9, 0.16, 0.5, 0x6f777f, -0.8, 1.48, 0); gangway(b, L); break;
    case 'dmu': railBody(b, { len: L - 1.1, col: 0xb8251f, band: 0xefe2c4, win: 4, doors: [0.0], doorCol: 0x9a1f1a }); railCab(b, L / 2 - 0.55, 0xb8251f); cabNoseMirror(b, -L / 2 + 0.55, 0xb8251f); b.use('metal').box(0.5, 0.2, 0.35, 0x2a2c30, -0.6, 1.48, 0).cyl(0.05, 0.05, 0.3, 0x2a2c30, -0.6, 1.66, 0.1, 6); break;
    case 'locoE': case 'locoF': { const c = kind === 'locoE' ? 0x2f5f9f : 0xd0662a, s2 = kind === 'locoE' ? 0xf2f2ee : 0x55595e;
      b.use('paint'); xsecBody(b, L - 1.1, 1.1, 1.18, 0.12, c, 0, 0.3, 0.04); railCab(b, L / 2 - 0.55, c, 1, 0.5); cabNoseMirror(b, -L / 2 + 0.55, c, 0.5);
      b.use('paint').box(L + 0.04, 0.1, 1.12, s2, 0, 0.55, 0);
      b.use('metal'); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) sidePanel(b, 'metal', 0x6f777f, -0.9 + i * 0.6, -0.5 + i * 0.6, 0.85, 1.25, s * 0.561);
      b.use('metal').box(1.4, 0.16, 0.6, 0x8a9097, 0, 1.48, 0); panto(b, 0.85); if (kind === 'locoE') panto(b, -0.85); buffers(b, L); break; }
    case 'locoD': { const c = 0x3f5f4a;
      b.use('paint').box(L - 0.1, 0.18, 1.1, c, 0, 0.3, 0); xsecBody(b, 2.1, 0.82, 0.95, 0.12, c, -0.5, 0.48);
      sideBody(b, [[0.6, 0.48], [1.65, 0.48], [1.68, 1.15], [1.55, 1.45], [0.6, 1.45]], 1.08, c, 0.04);
      b.use('glass'); for (const s of [-1, 1]) sidePanel(b, 'glass', 0x1d2731, 0.75, 1.5, 1.0, 1.32, s * 0.55); b.add(new THREE.BoxGeometry(0.03, 0.3, 0.9), 0x1d2731, 1.67, 1.18, 0, 0, 0, -0.1);
      b.use('paint').box(L - 0.08, 0.08, 1.12, 0xd9a933, 0, 0.44, 0); b.use('metal'); for (let i = 0; i < 5; i++) b.box(0.3, 0.6, 0.84, 0x55595e, -1.4 + i * 0.4, 0.62, 0);
      b.use('plain').cyl(0.06, 0.06, 0.3, 0x2a2c30, -0.9, 1.43, 0, 8); buffers(b, L); break; }
    case 'coach': railBody(b, { col: 0x2c4f8f, band: 0xf2f0ea, band2: 0xf2f0ea, win: 8, doors: [-1.45, 1.45], roof: 0x6f777f }); gangway(b, L); break;
    case 'hsC': { const c = 0xf2f2ee;
      railBody(b, { len: L - 1.0, ox: -0.5, col: c, band: 0x8f2a22, win: 4, roof: 0xd8dade });
      b.use('paint').sph(0.6, c, 0.65, 0.78, 0, 2.0, 0.78, 0.92).box(0.5, 1.1, 1.06, c, 0.15, 0.3, 0);
      b.use('glass').sph(0.45, 0x1d2731, 0.95, 1.0, 0, 1.25, 0.42, 0.78);
      b.use('paint').box(1.4, 0.12, 1.08, 0x8f2a22, 0.6, 0.42, 0); b.use('plain').box(0.12, 0.95, 0.8, 0x1e1f22, -L / 2 - 0.04, 0.4, 0); break; }
    case 'hsM': railBody(b, { col: 0xf2f2ee, band: 0x8f2a22, win: 7, doors: [1.4], roof: 0xd8dade }); panto(b, 0); gangway(b, L); break;
    case 'wCont0': case 'wCont1': case 'wCont2': { const v = +kind[5]; b.use('plain').box(L, 0.16, 1.0, 0x3a3d42, 0, 0.26, 0); container(b, -0.86, 1.65, WAG_COL[v]); container(b, 0.86, 1.65, WAG_COL[(v + 2) % 5]); buffers(b, L); break; }
    case 'wTank0': case 'wTank1': { const c = kind === 'wTank0' ? 0x2a2c30 : 0xd8d6d0; b.use('plain').box(L, 0.16, 1.0, 0x3a3d42, 0, 0.26, 0);
      b.use('paint').add(new THREE.CylinderGeometry(0.52, 0.52, 2.9, 18), c, 0, 0.95, 0, 0, 0, Math.PI / 2).sph(0.52, c, -1.45, 0.95, 0, 0.35, 1, 1).sph(0.52, c, 1.45, 0.95, 0, 0.35, 1, 1);
      b.use('metal').cyl(0.16, 0.16, 0.14, 0x6f777f, 0, 1.44, 0, 10).box(2.6, 0.03, 0.12, 0x55595e, 0, 1.47, 0.0); buffers(b, L); break; }
    case 'wHop': b.use('paint'); sideBody(b, [[-1.7, 0.42], [1.7, 0.42], [1.75, 1.3], [-1.75, 1.3]], 1.06, 0x6a4a3a, 0.02); b.add(new THREE.BoxGeometry(1.0, 0.4, 0.9), 0x5a3e30, -0.8, 0.32, 0, 0, 0, 0.5).add(new THREE.BoxGeometry(1.0, 0.4, 0.9), 0x5a3e30, 0.8, 0.32, 0, 0, 0, -0.5);
      b.use('plain').box(3.3, 0.06, 0.96, 0x1e1f22, 0, 1.24, 0).sph(0.5, 0x1e1f22, -0.8, 1.22, 0, 1.4, 0.3, 0.85).sph(0.5, 0x1e1f22, 0.8, 1.22, 0, 1.4, 0.3, 0.85); buffers(b, L); break;
    case 'wBox': b.use('plain').box(L, 0.16, 1.0, 0x3a3d42, 0, 0.26, 0); b.use('metal').box(L - 0.1, 1.05, 1.06, 0x7a3a2a, 0, 0.42, 0).add(new THREE.CylinderGeometry(0.62, 0.62, L - 0.1, 12, 1, false, 0, Math.PI), 0x8a9097, 0, 1.4, 0, 0, 0, Math.PI / 2);
      b.use('plain'); for (const s of [-1, 1]) b.box(1.0, 0.9, 0.02, 0x5a2a1e, 0, 0.5, s * 0.54).box(0.04, 0.9, 0.03, 0x2a2c30, 0.5, 0.5, s * 0.55); buffers(b, L); break;
  }
  return b.geo();
}

// ---------- lodě: trup se špičatou přídí ----------
function hull(b, L, w, h, y, col, bowLen) {
  const hl = L / 2, hw = w / 2, bl = bowLen || w * 0.9;
  const s = shapeOf([[-hl, -hw], [hl - bl, -hw], [hl - bl * 0.35, -hw * 0.55], [hl, 0], [hl - bl * 0.35, hw * 0.55], [hl - bl, hw], [-hl, hw], [-hl - 0.05, 0]]);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 }); g.rotateX(-Math.PI / 2);
  return b.add(g, col, 0, y, 0);
}
function railing(b, L, w, y, x0) { const pm = b.m; b.use('metal'); for (const s of [-1, 1]) b.box(L, 0.03, 0.03, 0xd8dde2, x0 || 0, y, s * (w / 2 - 0.04)); for (let i = 0; i <= Math.round(L / 0.4); i++) for (const s of [-1, 1]) b.box(0.025, 0.22, 0.025, 0xd8dde2, (x0 || 0) - L / 2 + i * 0.4, y - 0.22, s * (w / 2 - 0.04)); b.m = pm; }
function mBoat(kind) {
  const b = new GB();
  if (kind === 'barge') {
    b.use('paint'); hull(b, 5.6, 1.35, 0.25, -0.45, 0x7a1c1c, 0.9); hull(b, 5.6, 1.36, 0.45, -0.22, 0x22252a, 0.9);
    b.use('plain').box(4.0, 0.08, 1.2, 0x3a3d42, -0.15, 0.2, 0);
    container(b, -1.2, 1.15, 0xa83a30); container(b, 0.0, 1.15, 0x2f5f9f); container(b, 1.2, 1.15, 0x3f7f4f);
    b.use('paint').box(0.9, 0.7, 1.15, 0xf2f2ee, -2.3, 0.22, 0).box(0.7, 0.45, 0.9, 0xf2f2ee, -2.35, 0.92, 0); b.use('glass').box(0.72, 0.18, 0.92, 0x1d2731, -2.35, 1.12, 0);
    b.use('metal').cyl(0.03, 0.03, 0.9, 0xd8dde2, -2.0, 1.37, 0, 6); railing(b, 1.0, 1.3, 0.62, -2.3);
  } else if (kind === 'tour') {
    b.use('paint'); hull(b, 4.4, 1.45, 0.3, -0.45, 0x2f5f9f, 0.8); hull(b, 4.4, 1.46, 0.4, -0.17, 0xf2f2ee, 0.8);
    b.use('paint').box(2.9, 0.6, 1.25, 0xf2f2ee, -0.35, 0.23, 0); b.use('glass'); for (const s of [-1, 1]) sidePanel(b, 'glass', 0x1d2731, -1.7, 1.0, 0.33, 0.73, s * 0.635);
    b.add(new THREE.BoxGeometry(0.03, 0.42, 1.1), 0x1d2731, 1.12, 0.55, 0, 0, 0, -0.35);
    b.use('plain').box(3.0, 0.06, 1.3, 0xe8e6e0, -0.35, 0.83, 0); railing(b, 2.8, 1.3, 1.11, -0.35);
    for (let i = 0; i < 4; i++) b.box(0.32, 0.18, 0.5, 0x2f5f9f, -1.4 + i * 0.7, 0.89, 0);
    b.use('metal').cyl(0.02, 0.02, 0.6, 0xd8dde2, -1.9, 0.89, 0, 5); b.use('paint').box(0.25, 0.15, 0.02, 0xc8372d, -1.78, 1.32, 0);
  } else {
    b.use('paint'); hull(b, 1.8, 0.72, 0.18, -0.38, 0x2f5f9f, 0.7); hull(b, 1.8, 0.73, 0.22, -0.2, 0xf2f2ee, 0.7);
    b.use('glass').add(new THREE.BoxGeometry(0.03, 0.24, 0.6), 0x2b3642, 0.2, 0.12, 0, 0, 0, -0.6);
    b.use('plain').box(0.5, 0.12, 0.55, 0xe8e6e0, -0.25, 0.02, 0).box(0.18, 0.4, 0.14, 0x2a2c30, -0.95, -0.25, 0);
  }
  return b.geo();
}

// ---------- dopravní letadlo ----------
function mPlane() {
  const b = new GB(), white = 0xf2f2ee, blue = 0x1d3f7a;
  // trup: zúžená špička i ocas (rotační těleso podél x)
  const prof = [[0, -2.75], [0.14, -2.7], [0.3, -2.5], [0.42, -2.1], [0.46, -1.5], [0.46, 1.6], [0.4, 2.1], [0.26, 2.55], [0.1, 2.8], [0, 2.85]].map(p => new THREE.Vector2(p[0], p[1]));
  const fg = new THREE.LatheGeometry(prof, 14); fg.rotateZ(-Math.PI / 2);
  b.use('paint').add(fg, white, 0, 0, 0);
  // křídla a ocasní plochy (šípové)
  const WP = [[0.55, 0], [-0.25, 0], [-0.95, 3.1], [-0.6, 3.15]], mk = (pts, d) => { const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth: d, bevelEnabled: false }); g.rotateX(Math.PI / 2); return g; };
  const wg = mk(WP, 0.07), wg2 = mk(WP.map(p => [p[0], -p[1]]), 0.07);
  b.add(wg, 0xe6e8ea, 0.15, -0.12, 0, 0.06, 0, 0).add(wg2, 0xe6e8ea, 0.15, -0.12, 0, -0.06, 0, 0);
  const SP = [[0.15, 0], [-0.35, 0], [-0.7, 1.15], [-0.5, 1.18]], sg = mk(SP, 0.05), sg2 = mk(SP.map(p => [p[0], -p[1]]), 0.05);
  b.add(sg, 0xe6e8ea, -2.25, 0.12, 0).add(sg2, 0xe6e8ea, -2.25, 0.12, 0);
  const fin = shapeOf([[0.2, 0], [-0.6, 0], [-1.05, 1.35], [-0.72, 1.38]]), fing = new THREE.ExtrudeGeometry(fin, { depth: 0.06, bevelEnabled: false }); fing.translate(0, 0, -0.03);
  b.add(fing, blue, -1.95, 0.25, 0);
  // motory pod křídly
  for (const s of [-1, 1]) { b.use('paint').add(new THREE.CylinderGeometry(0.2, 0.17, 0.75, 12), 0xd8dade, 0.35, -0.42, s * 1.15, 0, 0, Math.PI / 2); b.use('plain').add(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 12), 0x22252a, 0.73, -0.42, s * 1.15, 0, 0, Math.PI / 2).box(0.4, 0.2, 0.05, 0xd8dade, 0.25, -0.3, s * 1.15); }
  // okna, kokpit, pruh, podvozek
  b.use('glass'); for (const s of [-1, 1]) sidePanel(b, 'glass', 0x1d2731, -1.7, 1.9, 0.08, 0.16, s * 0.462, 0.01);
  b.add(new THREE.BoxGeometry(0.2, 0.08, 0.5), 0x1d2731, 2.42, 0.18, 0, 0, 0, -0.4);
  b.use('paint'); for (const s of [-1, 1]) sidePanel(b, 'paint', blue, -2.0, 2.3, -0.18, -0.08, s * 0.463, 0.01);
  b.use('plain'); for (const [x, z] of [[1.9, 0], [-0.1, 0.35], [-0.1, -0.35]]) b.cyl(0.03, 0.03, 0.3, 0x55595e, x, -0.72, z, 5).add(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 10), 0x1b1c1f, x, -0.72, z, Math.PI / 2, 0, 0);
  return b.geo();
}
