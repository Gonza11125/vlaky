'use strict';
// Železnice ve 3D: dvoukolejné tratě, mosty, přejezdy se závorami, nádraží, vlaky a lidé na nástupištích.

const TRK = 0.9, RAIL_Y = 0.2, CAR_L = 3.5, CAR_G = 0.25;
const ARM = { 1: [0, -1], 2: [1, 0], 4: [0, 1], 8: [-1, 0] }, OPP = { 1: 4, 4: 1, 2: 8, 8: 2 };
const BALLAST = 0x847d72;

// ---------- geometrie kolejí ----------
function armPath(a, b, n) {   // střed trati mezi dvěma okraji dlaždice (přes střed = oblouk)
  const A = ARM[a], P = [];
  if (b === 'end') { for (let i = 0; i <= n; i++) { const t = i / n; P.push([A[0] * H * (1 - t), A[1] * H * (1 - t)]); } return P; }
  const B = ARM[b];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; P.push([u * u * A[0] * H + t * t * B[0] * H, u * u * A[1] * H + t * t * B[1] * H]); }
  return P;
}
function offsetPath(P, off) {
  return P.map((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; return [p[0] - dz * off, p[1] + dx * off]; });
}
function trackPairs(mask) {
  const arms = [1, 2, 4, 8].filter(a => mask & a), out = [], seen = new Set(), add = (a, b) => { const key = b === 'end' ? a + 'e' : Math.min(a, b) + '-' + Math.max(a, b); if (!seen.has(key)) { seen.add(key); out.push([a, b]); } };
  if (!arms.length) return [[2, 8]];
  for (const a of arms) if (mask & OPP[a]) add(a, OPP[a]);
  for (const a of arms) if (!(mask & OPP[a])) { const perp = arms.filter(b => b !== a && b !== OPP[a]); if (perp.length) for (const b of perp) add(a, b); else add(a, 'end'); }
  return out;
}
// jedna kolej: štěrk, pražce, kolejnice
function layTrack(b, Q, rt) {
  const conc = rt >= 2, hs = rt === 3;
  for (let i = 1; i < Q.length; i++) { const p = Q[i - 1], q = Q[i], dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx);
    b.use(hs ? 'plain' : 'soil').box(l + 0.08, 0.1, hs ? 1.5 : 1.75, hs ? 0xa9a59c : BALLAST, (p[0] + q[0]) / 2, 0, (p[1] + q[1]) / 2, ry); }
  // pražce po 0,5 délky
  let acc = 0.25;
  for (let i = 1; i < Q.length; i++) { const p = Q[i - 1], q = Q[i], dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx);
    while (acc < l) { const t = acc / l; b.use(conc ? 'plain' : 'wood').box(0.2, 0.06, 1.3, conc ? 0xb3afa6 : 0x5e4a3a, p[0] + dx * t, 0.1, p[1] + dz * t, ry); acc += 0.5; }
    acc -= l; }
  for (const o of [-0.3, 0.3]) { const R = offsetPath(Q, o);
    for (let i = 1; i < R.length; i++) { const p = R[i - 1], q = R[i], dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz); b.use('metal').box(l + 0.03, 0.07, 0.07, 0xa9aeb3, (p[0] + q[0]) / 2, 0.15, (p[1] + q[1]) / 2, Math.atan2(-dz, dx)); } }
}
function wireAlong(b, Q, y) { for (let i = 1; i < Q.length; i++) { const p = Q[i - 1], q = Q[i], dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz); b.box(l + 0.02, 0.025, 0.025, 0x2a2c30, (p[0] + q[0]) / 2, y, (p[1] + q[1]) / 2, Math.atan2(-dz, dx)); } }
function mRail(rt, mask, bridge) {
  const b = new GB(), elec = rt >= 2, hs = rt === 3, pairs = trackPairs(mask), straight = mask === 5 || mask === 10, v = mask === 5;
  if (bridge) {
    b.use('plain').box(TS, 0.45, TS, 0x9a968c, 0, -0.45, 0);
    if (straight) {   // ocelový příhradový most
      b.use('metal'); for (const s of [-1, 1]) { const ox = v ? s * 1.95 : 0, oz = v ? 0 : s * 1.95, L = TS;
        b.box(v ? 0.12 : L, 0.14, v ? L : 0.12, 0x5a6470, ox, 2.4, oz).box(v ? 0.12 : L, 0.14, v ? L : 0.12, 0x5a6470, ox, 0, oz);
        for (const t of [-1.4, 0, 1.4]) b.box(0.12, 2.4, 0.12, 0x5a6470, v ? ox : t, 0, v ? t : oz);
        for (const t of [-0.7, 0.7]) b.add(new THREE.BoxGeometry(0.1, 2.75, 0.1), 0x5a6470, v ? ox : t, 1.2, v ? t : oz, v ? (t > 0 ? 0.53 : -0.53) : 0, 0, v ? 0 : (t > 0 ? -0.53 : 0.53)); }
      b.use('plain').box(v ? 0.7 : 0.7, 1.4, v ? 0.7 : 0.7, 0x9a968c, 0, -1.85, 0);
    }
  }
  for (const [a, c] of pairs) { const P = armPath(a, c, c === 'end' || a === OPP[c] ? 4 : 8);
    for (const o of [-TRK, TRK]) { const Q = offsetPath(P, o); layTrack(b, Q, rt); if (elec) { b.use('metal'); wireAlong(b, Q, 3.05); } }
    if (c === 'end') { const A = ARM[a]; b.use('paint'); for (const o of [-TRK, TRK]) { const ox = A[1] ? o : 0, oz = A[0] ? o : 0; b.box(A[0] ? 0.3 : 1.3, 0.55, A[0] ? 1.3 : 0.3, 0xc8372d, ox - A[0] * 0.1, 0.1, oz - A[1] * 0.1); } } }
  if (elec && straight) { b.use('metal');   // stožáry trolejového vedení
    for (const s of [-1, 1]) { const x = v ? s * 1.9 : 0, z = v ? 0 : s * 1.9; b.cyl(0.06, 0.08, 3.5, 0x6f777f, x, 0, z, 6); }
    b.box(v ? 3.9 : 0.06, 0.08, v ? 0.06 : 3.9, 0x6f777f, 0, 3.35, 0); }
  if (hs && straight && !bridge) { b.use('glass'); for (const s of [-1, 1]) b.box(v ? 0.06 : TS, 1.1, v ? TS : 0.06, 0x9fb7c4, v ? s * 1.97 : 0, 0, v ? 0 : s * 1.97); }
  return b.geo();
}
// prodloužení trati za okraj mapy (vlaky přijíždějí z dálky)
function mRailExt() { const b = new GB(); for (const o of [-TRK, TRK]) layTrack(b, [[0, o], [70, o]], 1); return b.geo(); }
// poškozená trať: vytrhané pražce, převrácený vagon, zábrany
function mRailDmg() {
  const b = new GB();
  b.use('soil').box(TS, 0.14, 3.2, 0x6e665a, 0, 0, 0);
  b.use('wood'); for (let i = 0; i < 6; i++) b.box(0.2, 0.06, 1.3, 0x5e4a3a, -1.6 + i * 0.6, 0.14, (i % 2 ? 0.5 : -0.4), 0.5 + i * 0.4);
  b.use('paint').add(new THREE.BoxGeometry(3.3, 1.1, 1.05), 0x6a4a3a, 0.2, 0.6, 1.2, 1.35, 0.25, 0);
  b.use('plain'); for (const [x, z] of [[-1.9, -1.9], [1.9, 1.9]]) { b.box(0.08, 0.8, 0.08, 0xd8d6d0, x, 0, z); b.box(1.4, 0.18, 0.06, 0xc8372d, x + (x > 0 ? -0.7 : 0.7), 0.55, z); }
  return b.geo();
}
// přejezd: kolejnice zapuštěné do silnice, gumové panely, výstražné kříže
function mCrossing(horiz) {
  const b = new GB(), r = (x, z) => horiz ? [x, z] : [z, -x];
  for (const o of [-TRK, TRK]) { b.use('asphalt'); let p = r(0, o); b.box(horiz ? TS : 1.2, 0.075, horiz ? 1.2 : TS, 0x2e3033, p[0], 0, p[1]);
    b.use('metal'); for (const g of [-0.3, 0.3]) { p = r(0, o + g); b.box(horiz ? TS : 0.07, 0.08, horiz ? 0.07 : TS, 0xb0b4b8, p[0], 0.005, p[1]); } }
  for (const [x, z] of [[-1.8, -1.95], [1.8, 1.95]]) { const p = r(x, z);
    b.use('metal').cyl(0.05, 0.05, 2.3, 0x9aa0a6, p[0], 0, p[1], 6);
    b.use('plain'); for (const a of [0.6, -0.6]) b.add(new THREE.BoxGeometry(0.7, 0.1, 0.03), 0xf2f0ea, p[0], 2.05, p[1], 0, horiz ? 0 : Math.PI / 2, a);
    for (const a of [0.6, -0.6]) b.add(new THREE.BoxGeometry(0.22, 0.104, 0.035), 0xc8372d, p[0], 2.05, p[1], 0, horiz ? 0 : Math.PI / 2, a);
    b.box(horiz ? 0.55 : 0.12, 0.28, horiz ? 0.12 : 0.55, 0x22252a, p[0], 1.35, p[1]); }
  return b.geo();
}
function mBarrierArm() { const b = new GB(); b.use('plain'); for (let i = 0; i < 6; i++) b.box(0.3, 0.09, 0.07, i % 2 ? 0xc8372d : 0xf2f0ea, 0.15 + i * 0.3, -0.045, 0); b.box(0.18, 0.18, 0.18, 0x55595e, 0, -0.09, 0); return b.geo(); }

// ---------- nádraží a další stavby u trati (přední strana = k trati) ----------
function platform(b, W, d, y) { b.use('pave').box(W, y || 0.55, d, 0xb9b2a4, 0, 0, W / 2 - d / 2 + 0.28); b.use('plain').box(W, 0.012, 0.16, 0xe8c840, 0, (y || 0.55), W / 2 - 0.12); }
function siding(b, W, z, n) { layTrack(b, [[-W / 2, z], [W / 2, z]], 1); }
function mRailBld(t) {
  const s = SERV[t].size, W = s * TS - 0.6, b = new GB();
  switch (t) {
    case 'railhalt': lot(b, W, PAL.grass, 'lawn'); platform(b, W, 1.4);
      b.use('glass').box(1.5, 1.15, 0.05, 0x9fb7c4, -0.5, 0.55, 0.85).box(0.05, 1.15, 0.6, 0x9fb7c4, -1.25, 0.55, 1.15).use('metal').box(1.7, 0.06, 0.8, 0x55595e, -0.5, 1.7, 1.15);
      b.use('wood').box(1.0, 0.25, 0.3, PAL.wood, -0.5, 0.75, 1.0).use('paint').box(0.3, 0.75, 0.25, 0xc8372d, 0.9, 0.55, 0.95);
      b.use('metal').cyl(0.04, 0.04, 2.0, 0x55595e, 1.4, 0.55, 1.25, 6).use('paint').box(0.9, 0.32, 0.05, 0x2f5f9f, 1.4, 2.35, 1.25).use('plain').box(0.7, 0.1, 0.06, PAL.white, 1.4, 2.46, 1.25);
      b.use('pave').box(0.8, 0.06, W - 1.4, 0xb9b2a4, 1.0, 0.06, -0.7); break;
    case 'railst': lot(b, W, 0xb8b0a0, 'pave'); platform(b, W, 1.6);
      b.use('metal'); for (let i = 0; i < 5; i++) b.cyl(0.05, 0.05, 1.7, 0x55595e, -3 + i * 1.5, 0.55, 3.0, 6);
      b.box(W - 0.2, 0.08, 1.5, 0x6f777f, 0, 2.25, 2.9);
      b.facade('stone', 2, 1.5, 5.6, 2.4, 0xe3cf9f, -0.4, 0, 0.4).use('tile').gable(5.9, 1.3, 2.7, 0x8f3f2e, -0.4, 3.0, 0.4, Math.PI / 2);
      b.facade('stone', 2, 1.7, 1.8, 2.6, 0xeadcb2, 1.6, 0, 0.4).use('tile').pyr(2.0, 1.4, 0x7a4a36, 1.6, 3.4, 0.4, 2.8);
      b.use('plain').cyl(0.32, 0.32, 0.05, PAL.white, 1.6, 2.8, 1.72, 16).box(0.04, 0.22, 0.02, 0x22252a, 1.6, 2.82, 1.76);
      b.use('paint').box(2.4, 0.35, 0.05, 0x2f5f9f, -0.8, 2.3, 1.62).use('plain').box(2.0, 0.1, 0.06, PAL.white, -0.8, 2.42, 1.62);
      b.use('asphalt').box(W, 0.05, 1.8, 0x4a4d52, 0, 0.06, -2.7); { const n0 = b.parts.length; sedan(b, 0xd9a933); for (let i = n0; i < b.parts.length; i++) b.parts[i].g.translate(1.6, 0.06, -2.7); }
      b.use('metal'); for (let i = 0; i < 4; i++) b.box(0.05, 0.5, 0.5, 0x55595e, -3.2 + i * 0.35, 0.06, -1.3);
      break;
    case 'mainst': lot(b, W, 0xb8b0a0, 'pave');
      b.use('pave').box(W, 0.55, 2.4, 0xb9b2a4, 0, 0, W / 2 - 1.2 + 0.28); b.use('plain').box(W, 0.012, 0.16, 0xe8c840, 0, 0.55, W / 2 - 0.12);
      b.use('glass').add(new THREE.CylinderGeometry(2.9, 2.9, W - 0.4, 20, 1, true, 0, Math.PI), 0xa9c0cc, 0, 2.6, 3.4, 0, 0, Math.PI / 2);
      b.use('metal'); for (let i = 0; i < 6; i++) { const x = -W / 2 + 0.5 + i * (W - 1) / 5; b.add(new THREE.TorusGeometry(2.9, 0.06, 4, 16, Math.PI), 0x55595e, x, 2.6, 3.4, 0, Math.PI / 2, 0); for (const z of [0.6, W / 2 - 0.25]) b.box(0.12, 2.6, 0.12, 0x55595e, x, 0, z); }
      b.facade('stone', 3, 1.6, W - 0.6, 2.8, 0xe6dcc6, 0, 0, -3.6).parapet(W - 0.6, 2.8, 4.8, 0xcfc4ac, 0, -3.6);
      b.facade('stone', 4, 1.6, 3.2, 3.0, 0xece2cc, 0, 0, -3.5).parapet(3.2, 3.0, 6.4, 0xcfc4ac, 0, -3.5);
      b.use('glass').add(new THREE.CircleGeometry(1.2, 16, 0, Math.PI), 0x9fb7c4, 0, 4.0, -1.98).add(new THREE.CircleGeometry(1.2, 16, 0, Math.PI), 0x9fb7c4, 0, 4.0, -5.02, 0, Math.PI, 0);
      b.use('stone').box(1.4, 7.2, 1.4, 0xece2cc, 4.3, 0, -3.8).use('tile').pyr(1.7, 1.8, 0x4f7f6a, 4.3, 7.2, -3.8);
      b.use('plain').cyl(0.5, 0.5, 0.05, PAL.white, 4.3, 5.9, -3.08, 16).cyl(0.5, 0.5, 0.05, PAL.white, 4.3, 5.9, -4.52, 16);
      b.use('paint').box(4.0, 0.45, 0.06, 0x2f5f9f, -2.5, 3.9, -2.18).use('plain').box(3.4, 0.12, 0.07, PAL.white, -2.5, 4.05, -2.18);
      break;
    case 'station': lot(b, W, 0x9e9a90); siding(b, W, 2.3);
      b.use('metal').box(W - 0.8, 2.4, 2.6, 0xb0a48c, 0, 0, -1.6).gable(W - 0.6, 0.9, 2.8, 0x8a7a64, 0, 2.4, -1.6, Math.PI / 2);
      b.use('plain').box(W - 0.8, 0.9, 0.9, 0x9a968c, 0, 0, 0.2); for (let i = 0; i < 4; i++) b.use('paint').box(1.0, 1.5, 0.05, 0x6a5a48, -2.6 + i * 1.75, 0.9, -0.28);
      for (let i = 0; i < 2; i++) { b.use('paint').box(3.2, 1.2, 1.0, i ? 0x7a3a2a : 0x6a4a3a, -1.7 + i * 3.4, 0.3, 2.3).use('plain').box(3.2, 0.25, 0.9, 0x22252a, -1.7 + i * 3.4, 0.05, 2.3); }
      b.use('wood'); for (let i = 0; i < 5; i++) b.box(0.6, 0.45, 0.6, 0x9a7a4a, -3 + i * 0.7, 0.9, 0.3);
      break;
    case 'container': lot(b, W, 0x9e9a90); siding(b, W, 2.8); siding(b, W, 0.6);
      b.use('paint'); for (const s2 of [-1, 1]) { b.box(0.4, 5.2, 0.4, 0xd9a933, s2 * 4.8, 0, 4.4).box(0.4, 5.2, 0.4, 0xd9a933, s2 * 4.8, 0, -1.0); }
      b.box(0.5, 0.6, 5.8, 0xd9a933, -4.8, 5.0, 1.7).box(0.5, 0.6, 5.8, 0xd9a933, 4.8, 5.0, 1.7).box(10.2, 0.5, 0.6, 0xd9a933, 0, 5.2, 1.7).box(1.2, 0.8, 1.0, 0x55595e, 1.0, 4.4, 1.7);
      { const C = [0xa83a30, 0x2f5f9f, 0x3f7f4f, 0xc77a2e, 0x8a8f96, 0xd8d6d0]; let n = 0;
        for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) for (let h = 0; h < 1 + ((r + c) % 3); h++) b.box(2.2, 0.95, 1.0, C[(n++ * 7) % 6], -3.6 + c * 2.4, h * 0.97, -2.4 - r * 1.1);
        for (let c = 0; c < 4; c++) b.box(2.2, 0.95, 1.0, C[(c * 5) % 6], -3.6 + c * 2.4, 0.45, 2.8); }
      break;
    case 'depot': lot(b, W, 0x9e9a90);
      for (const x of [-2.0, 0.8]) layTrack(b, [[x, W / 2], [x, -2.6]], 1);
      b.use('brick').box(5.2, 2.8, 3.2, PAL.brick, -0.6, 0, -1.8).use('tile').gable(5.4, 1.1, 3.4, 0x6a6f74, -0.6, 2.8, -1.8, Math.PI / 2);
      for (const x of [-2.0, 0.8]) b.use('paint').box(1.3, 2.0, 0.06, 0x2b2f33, x, 0, -0.18);
      b.use('metal').cyl(0.7, 0.7, 2.6, 0x7f8790, 2.9, 0, -2.4, 14).cyl(0.75, 0.75, 0.15, 0x55595e, 2.9, 2.6, -2.4, 14);
      b.use('paint').box(1.05, 1.2, 3.2, 0xd0662a, 0.8, 0.3, 1.8).box(1.07, 0.3, 3.2, 0x55595e, 0.8, 0.55, 1.8).use('glass').box(0.9, 0.45, 0.06, 0x2b3642, 0.8, 0.95, 3.42);
      b.use('paint').box(1.05, 1.2, 3.2, 0x2f5f9f, -2.0, 0.3, 1.2).use('plain').box(1.06, 0.2, 3.21, PAL.white, -2.0, 0.85, 1.2);
      break;
  }
  return b.geo();
}

// ---------- vozidla ----------
function bogies(b) { b.use('plain'); for (const x of [-1.15, 1.15]) b.box(0.95, 0.24, 0.8, 0x2a2c30, x, 0, 0); }
function carBody(b, col, band, win, roof, len, ox) { len = len || CAR_L; ox = ox || 0;
  b.use('paint').box(len, 1.15, 1.08, col, ox, 0.24, 0); if (band) b.box(len + 0.02, 0.2, 1.1, band, ox, 0.36, 0);
  b.use('glass').box(len - 0.4, 0.36, 1.1, win || 0x2b3642, ox, 0.86, 0); b.use('metal').box(len - 0.1, 0.12, 0.9, roof || 0x8a9097, ox, 1.39, 0); }
function cab(b, col, x) { b.use('glass').add(new THREE.BoxGeometry(0.06, 0.5, 0.95), 0x22303c, x, 1.0, 0, 0, 0, x > 0 ? -0.35 : 0.35); b.use('plain').box(0.04, 0.08, 0.3, 0xfff4d8, x + Math.sign(x) * 0.02, 0.45, 0.32).box(0.04, 0.08, 0.3, 0xfff4d8, x + Math.sign(x) * 0.02, 0.45, -0.32); }
function panto(b, x) { b.use('metal').box(0.6, 0.04, 0.5, 0x2a2c30, x, 1.62, 0).add(new THREE.BoxGeometry(0.04, 0.5, 0.04), 0x2a2c30, x, 1.75, 0, 0, 0, 0.6); }
const WAG_COL = [0xa83a30, 0x2f5f9f, 0x3f7f4f, 0xc77a2e, 0x8a8f96];
function mTrainCar(kind) {
  const b = new GB(); bogies(b);
  switch (kind) {
    case 'emuC': carBody(b, 0xeceee9, 0xc8372d, 0x2b3642, 0x8a9097); cab(b, 0, CAR_L / 2); b.use('paint').box(0.35, 0.85, 1.11, 0xc8372d, -0.4, 0.3, 0); break;
    case 'emuM': carBody(b, 0xeceee9, 0xc8372d); b.use('paint').box(0.35, 0.85, 1.11, 0xc8372d, 0, 0.3, 0); panto(b, 0.6); break;
    case 'dmu': carBody(b, 0xb8251f, 0xefe2c4, 0x2b3642, 0x6f777f); cab(b, 0, CAR_L / 2); cab(b, 0, -CAR_L / 2); b.use('paint').box(CAR_L + 0.02, 0.1, 1.1, 0xefe2c4, 0, 0.7, 0); b.use('metal').box(0.4, 0.18, 0.3, 0x2a2c30, -0.8, 1.45, 0); break;
    case 'locoE': b.use('paint').box(CAR_L - 0.2, 1.25, 1.08, 0x2f5f9f, 0, 0.24, 0).box(CAR_L - 0.18, 0.18, 1.1, PAL.white, 0, 0.6, 0); cab(b, 0, CAR_L / 2 - 0.1); cab(b, 0, -CAR_L / 2 + 0.1);
      b.use('metal').box(CAR_L - 0.5, 0.12, 0.85, 0x8a9097, 0, 1.49, 0); panto(b, 0.9); panto(b, -0.9); break;
    case 'locoF': b.use('paint').box(CAR_L - 0.2, 1.25, 1.08, 0xd0662a, 0, 0.24, 0).box(CAR_L - 0.18, 0.3, 1.1, 0x55595e, 0, 0.3, 0); cab(b, 0, CAR_L / 2 - 0.1); cab(b, 0, -CAR_L / 2 + 0.1);
      b.use('metal').box(CAR_L - 0.5, 0.12, 0.85, 0x8a9097, 0, 1.49, 0); panto(b, 0.9); break;
    case 'locoD': b.use('paint').box(CAR_L - 0.2, 0.25, 1.1, 0x3f5f4a, 0, 0.24, 0).box(2.2, 0.95, 0.8, 0x3f5f4a, -0.55, 0.49, 0).box(1.0, 1.25, 1.08, 0x3f5f4a, 1.05, 0.49, 0).box(CAR_L - 0.18, 0.1, 1.12, 0xd9a933, 0, 0.42, 0);
      b.use('glass').box(1.02, 0.4, 1.1, 0x2b3642, 1.05, 1.15, 0); b.use('metal').box(0.4, 0.2, 0.35, 0x2a2c30, -1.0, 1.44, 0); break;
    case 'coach': carBody(b, 0x2c4f8f, 0xf2f0ea, 0x22303c, 0x6f777f); break;
    case 'hsC': carBody(b, 0xf2f2ee, 0x8f2a22, 0x22303c, 0xd8dade, CAR_L - 0.5, -0.25);
      b.use('paint').sph(0.62, 0xf2f2ee, 1.25, 0.72, 0, 1.25, 0.82, 0.88).use('glass').sph(0.42, 0x22303c, 1.3, 1.0, 0, 1.0, 0.45, 0.85); break;
    case 'hsM': carBody(b, 0xf2f2ee, 0x8f2a22, 0x22303c, 0xd8dade); panto(b, 0); break;
    case 'wCont0': case 'wCont1': case 'wCont2': { const v = +kind[5]; b.use('plain').box(CAR_L, 0.2, 1.0, 0x3a3d42, 0, 0.24, 0); b.use('paint').box(1.65, 0.95, 1.0, WAG_COL[v], -0.85, 0.44, 0).box(1.65, 0.95, 1.0, WAG_COL[(v + 2) % 5], 0.85, 0.44, 0); break; }
    case 'wTank0': case 'wTank1': { b.use('plain').box(CAR_L, 0.2, 1.0, 0x3a3d42, 0, 0.24, 0); b.use('paint').hcyl(0.55, 3.2, kind === 'wTank0' ? 0x2a2c30 : 0xd8d6d0, 0, 1.0, 0, Math.PI / 2, 14); b.use('metal').box(0.4, 0.12, 0.4, 0x6f777f, 0, 1.55, 0); break; }
    case 'wHop': b.use('paint').box(CAR_L, 1.05, 1.08, 0x6a4a3a, 0, 0.24, 0).use('plain').box(CAR_L - 0.2, 0.08, 0.94, 0x1e1f22, 0, 1.26, 0).sph(0.5, 0x1e1f22, -0.8, 1.2, 0, 1.4, 0.35, 0.8).sph(0.5, 0x1e1f22, 0.8, 1.2, 0, 1.4, 0.35, 0.8); break;
    case 'wBox': b.use('paint').box(CAR_L, 1.2, 1.08, 0x7a3a2a, 0, 0.24, 0).use('metal').add(new THREE.CylinderGeometry(0.6, 0.6, CAR_L, 10, 1, false, 0, Math.PI), 0x8a9097, 0, 1.44, 0, 0, 0, Math.PI / 2); b.use('paint').box(1.0, 0.9, 1.1, 0x6a3020, 0, 0.35, 0); break;
  }
  return b.geo();
}

// ---------- trasy vlaků ----------
function railRoute(tiles, extS, extE) {
  const C = tiles.map(k => [tileX(k % N), tileZ((k / N) | 0)]), pts = [], tileAt = [];
  const out = k => { const x = k % N, y = (k / N) | 0; return x === 0 ? [-1, 0] : x === N - 1 ? [1, 0] : y === 0 ? [0, -1] : [0, 1]; };
  if (extS) { const o = out(tiles[0]); pts.push([C[0][0] + o[0] * 90, C[0][1] + o[1] * 90]); }
  for (let i = 0; i < C.length; i++) {
    const c = C[i];
    if (i === 0 || i === C.length - 1) { tileAt.push(pts.length); pts.push(c); continue; }
    const p = C[i - 1], n = C[i + 1], d1 = [Math.sign(c[0] - p[0]), Math.sign(c[1] - p[1])], d2 = [Math.sign(n[0] - c[0]), Math.sign(n[1] - c[1])];
    if (d1[0] === d2[0] && d1[1] === d2[1]) { tileAt.push(pts.length); pts.push(c); continue; }
    const a = [(p[0] + c[0]) / 2, (p[1] + c[1]) / 2], e = [(n[0] + c[0]) / 2, (n[1] + c[1]) / 2];
    for (let j = 0; j <= 6; j++) { const t = j / 6, u = 1 - t; if (j === 3) tileAt.push(pts.length); pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * e[0], u * u * a[1] + 2 * u * t * c[1] + t * t * e[1]]); }
  }
  if (extE) { const o = out(tiles[tiles.length - 1]), c = C[C.length - 1]; pts.push([c[0] + o[0] * 90, c[1] + o[1] * 90]); }
  const P = offsetPath(pts, TRK), cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  return { tiles, P, cum, len: cum[cum.length - 1], tileS: tileAt.map(i => cum[i]) };
}
function routeAt(R, s) {
  const P = R.P, c = R.cum;
  if (s <= 0) { const dx = P[1][0] - P[0][0], dz = P[1][1] - P[0][1], l = Math.hypot(dx, dz) || 1; return [P[0][0] + dx / l * s, P[0][1] + dz / l * s]; }
  if (s >= R.len) { const n = P.length - 1, dx = P[n][0] - P[n - 1][0], dz = P[n][1] - P[n - 1][1], l = Math.hypot(dx, dz) || 1, e = s - R.len; return [P[n][0] + dx / l * e, P[n][1] + dz / l * e]; }
  let lo = 0, hi = c.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= s) lo = m; else hi = m; }
  const t = (s - c[lo]) / ((c[hi] - c[lo]) || 1); return [P[lo][0] + (P[hi][0] - P[lo][0]) * t, P[lo][1] + (P[hi][1] - P[lo][1]) * t];
}
function railBFS(a, b) {
  if (a < 0 || b < 0 || railComp[a] < 0 || railComp[a] !== railComp[b]) return null;
  const prev = new Int32Array(NN).fill(-2), q = [a]; prev[a] = -1;
  for (let h = 0; h < q.length; h++) { const k = q[h]; if (k === b) break; const x = k % N, y = (k / N) | 0;
    for (const [dx, dy] of NB4) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const n = idx(nx, ny); if (rail[n] && !railDmg[n] && prev[n] === -2) { prev[n] = k; q.push(n); } } }
  if (prev[b] === -2) return null; const p = []; for (let k = b; k !== -1; k = prev[k]) p.push(k); return p.reverse();
}
const stopTile = b => { const t = (b.rt || []).filter(k => railComp[k] >= 0); return t.length ? t[(t.length / 2) | 0] : -1; };

// ---------- vlaky ----------
const TR_KIND = {
  reg: { v: 7, dwell: 4, cap: 10, cars: el => el ? ['emuC', 'emuM', 'emuC*'] : ['dmu', 'dmu*'] },
  ic: { v: 10, dwell: 5, cap: 4, cars: el => [el ? 'locoE' : 'locoD', 'coach', 'coach', 'coach', 'coach', 'coach'] },
  fr: { v: 6, dwell: 9, cap: 6, cars: el => { const c = [el ? 'locoF' : 'locoD']; for (let i = 0; i < 6 + ((Math.random() * 4) | 0); i++) c.push(['wCont0', 'wCont1', 'wCont2', 'wTank0', 'wTank1', 'wHop', 'wBox'][(Math.random() * 7) | 0]); return c; } },
  hs: { v: 15, dwell: 4, cap: 3, cars: () => ['hsC', 'hsM', 'hsM', 'hsM', 'hsC*'] },
};
const trains = [], RL = { warm: true, spawnT: 1, checkT: 0, cross: [], crossDirty: true, plat: new Map(), lightB: null, armB: null };
function resetRail() { for (const t of trains) for (const c of t.cars) if (c.h.b) c.h.b.remove(c.h); trains.length = 0; RL.warm = true; RL.cross = []; RL.crossDirty = true; RL.plat.clear(); if (RL.lightB) RL.lightB.clear(); }
function trainCarHandle(key) { const rev = key.endsWith('*'), k = rev ? key.slice(0, -1) : key; return { rev, h: batch('TR' + k, () => mTrainCar(k), MATS, { shadow: true, cap: 32 }).add({}, mtx(0, -50, 0)) }; }
function pickRoute(type) {
  const ok = b => b.ok, comps = railComps;
  const cand = comps.filter(c => type === 'reg' ? c.pass.some(ok) && (c.edge || c.pass.filter(ok).length >= 2) : type === 'fr' ? c.edge && c.freight.some(ok) : c.edge && c.main.some(ok));
  if (!cand.length) return null;
  const c = cand[(Math.random() * cand.length) | 0], edges = c.edges.filter(k => !railDmg[k]);
  const rndOf = a => a[(Math.random() * a.length) | 0];
  let parts = [], stops = [], extS = false, extE = false, startSt = null;
  if (type === 'reg') {
    const sts = c.pass.filter(ok), ends = edges.map(k => ({ k })).concat(sts.map(b => ({ k: stopTile(b), b })));
    if (ends.length < 2) return null;
    const a = Math.random() < 0.7 && edges.length ? { k: rndOf(edges) } : rndOf(ends);
    let best = null; for (let i = 0; i < 4; i++) { const e = rndOf(ends); if (e.k === a.k) continue; const p = railBFS(a.k, e.k); if (p && (!best || p.length > best.p.length)) best = { e, p }; }
    if (!best) return null;
    parts = best.p; extS = !a.b; extE = !best.e.b; startSt = a.b || null;
    stops = sts;
  } else if (type === 'fr') {
    if (!edges.length) return null; const f = rndOf(c.freight.filter(ok)), e = rndOf(edges), p = railBFS(e, stopTile(f)); if (!p) return null;
    parts = p; extS = true; stops = [f];
  } else {
    if (!edges.length) return null; const m = rndOf(c.main.filter(ok)), e1 = rndOf(edges), others = edges.filter(k => Math.abs(k % N - e1 % N) + Math.abs(((k / N) | 0) - ((e1 / N) | 0)) > N / 2);
    const p1 = railBFS(e1, stopTile(m)); if (!p1) return null;
    if (others.length) { const e2 = rndOf(others), p2 = railBFS(stopTile(m), e2); if (p2) { parts = p1.concat(p2.slice(1)); extE = true; } else parts = p1; } else parts = p1;
    extS = true; stops = [m];
  }
  if (parts.length < 2) return null;
  const R = railRoute(parts, extS, extE), set = new Map(); parts.forEach((k, i) => set.set(k, i));
  const st = []; for (const b of stops) { const k = stopTile(b), i = set.get(k); if (i != null && !(startSt === b && i === 0)) st.push({ s: R.tileS[i], b, done: false }); }
  st.sort((a, b) => a.s - b.s);
  return { R, stops: st, startSt, edgeEnd: extE, comp: c.id };
}
function spawnTrain(type, warm) {
  const r = pickRoute(type); if (!r) return false;
  const sv = T.railSv, el = sv && sv.electric, K = TR_KIND[type], keys = K.cars(el);
  const t = { type, R: r.R, stops: r.stops, edgeEnd: r.edgeEnd, v: 0, vmax: K.v, dwell: 0, cars: keys.map(trainCarHandle) };
  t.len = keys.length * (CAR_L + CAR_G);
  if (r.startSt) { t.s = t.len / 2 + 0.01; t.dwell = 2 + Math.random() * 2; t.at = r.startSt; } else { t.s = 0; t.v = K.v * 0.8; }
  if (warm) { t.s = 20 + Math.random() * Math.max(1, r.R.len * 0.7); t.dwell = 0; t.at = null; t.v = K.v * 0.6; for (const st of t.stops) if (st.s + t.len / 2 < t.s) st.done = true;
    if (trains.some(o => o.pos && o.pos.some(c => { const p = routeAt(t.R, t.s); return Math.hypot(c[0] - p[0], c[1] - p[1]) < t.len + 6; }))) { for (const c of t.cars) if (c.h.b) c.h.b.remove(c.h); return false; } }
  trains.push(t); placeTrain(t); return true;
}
function removeTrain(t) { for (const c of t.cars) if (c.h.b) c.h.b.remove(c.h); trains.splice(trains.indexOf(t), 1); }
function trainBroken(t) { for (const k of t.R.tiles) if (!rail[k] || railDmg[k]) return true; return false; }
// konec trasy ve stanici: vlak se obrátí a jede jinam
function turnTrain(t) {
  const last = t.R.tiles[t.R.tiles.length - 1], type = t.type, c = railComps[railComp[last]];
  if (!c) return removeTrain(t);
  const edges = c.edges.filter(k => !railDmg[k]), sts = c.pass.filter(b => b.ok);
  let end = null; if (type === 'reg') { const ends = edges.concat(sts.map(stopTile)).filter(k => k !== last); end = ends[(Math.random() * ends.length) | 0]; } else end = edges[(Math.random() * edges.length) | 0];
  const p = end != null ? railBFS(last, end) : null; if (!p || p.length < 2) return removeTrain(t);
  const R = railRoute(p, false, edges.includes(end)), set = new Map(); p.forEach((k, i) => set.set(k, i));
  t.R = R; t.edgeEnd = edges.includes(end); t.s = t.len / 2; t.v = 0;
  t.stops = []; if (type === 'reg') for (const b of sts) { const i = set.get(stopTile(b)); if (i != null && i > 0) t.stops.push({ s: R.tileS[i], b, done: false }); }
  t.stops.sort((a, b) => a.s - b.s);
  t.cars.reverse(); for (const c2 of t.cars) c2.rev = !c2.rev;
}
const _tm = new THREE.Matrix4(), _tq = new THREE.Quaternion(), _te = new THREE.Euler(), _tv = new THREE.Vector3(), _ts = new THREE.Vector3(1, 1, 1);
function updateTrains(dt) {
  const sv = T.railSv; if (!sv || !G.playing) { if (trains.length && !G.playing) resetRail(); return; }
  RL.checkT -= dt; if (RL.checkT <= 0) { RL.checkT = 1; for (const t of trains.slice()) if (trainBroken(t)) removeTrain(t); }
  // kolik vlaků má jezdit
  const lim = RS.coarse ? 0.5 : 1;
  if (RL.warm) { RL.warm = false; for (const type in TR_KIND) { const want = Math.ceil(Math.min(TR_KIND[type].cap, sv.eff[type]) * lim); for (let i = 0; i < want * 2 && trains.filter(t => t.type === type).length < Math.ceil(want * 0.7); i++) spawnTrain(type, true); } }
  RL.spawnT -= dt;
  if (RL.spawnT <= 0) { RL.spawnT = 1.5 + Math.random() * 2.5;
    for (const type in TR_KIND) { const want = Math.ceil(Math.min(TR_KIND[type].cap, sv.eff[type]) * lim), have = trains.filter(t => t.type === type).length;
      if (have < want && spawnTrain(type)) break; if (have > want) { const t = trains.find(t => t.type === type); if (t) removeTrain(t); break; } } }
  // pohyb
  for (const t of trains.slice()) {
    const R = t.R, rk = RAILS[rail[R.tiles[Math.min(R.tiles.length - 1, Math.max(0, tileIndexAt(t)))]] || 1] || RAILS[1];
    const vmax = t.vmax * (t.type === 'hs' ? (rk.hs ? 1.6 : 0.9) : rk.speed > 1 ? 1.1 : 1) * (S.bud.rail < 80 ? 0.85 : 1);
    if (t.dwell > 0) { t.dwell -= dt; if (t.dwell <= 0) { t.at = null; if (t.turn) { t.turn = false; turnTrain(t); } } }
    else {
      const st = t.stops.find(s => !s.done), target = st ? st.s + t.len / 2 : (t.edgeEnd ? Infinity : R.len - 0.2);
      const dist = target - t.s, allow = Math.sqrt(Math.max(0, 2 * 2.2 * dist));
      let v = Math.min(vmax, t.v + 2.5 * dt, allow);
      if ((t.stuck || 0) < 12 && blockedAhead(t)) { v = Math.max(0, Math.min(v, t.v - 6 * dt)); t.stuck = (t.stuck || 0) + (v < 0.1 ? dt : 0); } else if (t.stuck >= 12) { t.stuck += dt; if (t.stuck > 18) t.stuck = 0; }
      t.v = Math.max(0, v); t.s += t.v * dt;
      if (dist < 0.08 && t.v < 0.5) {
        t.v = 0; if (st) { st.done = true; t.dwell = TR_KIND[t.type].dwell; t.at = st.b; if (!t.stops.some(s => !s.done) && !t.edgeEnd) t.turn = true; }
        else if (!t.edgeEnd) { t.dwell = 3; t.turn = true; }
      }
      if (t.edgeEnd && t.s - t.len > R.len) { removeTrain(t); continue; }
    }
    placeTrain(t);
  }
}
function tileIndexAt(t) { const ts = t.R.tileS; let i = 0; while (i < ts.length - 1 && ts[i + 1] <= t.s) i++; return i; }
function blockedAhead(t) {
  const p = routeAt(t.R, t.s), q = routeAt(t.R, t.s - 1), hx = p[0] - q[0], hz = p[1] - q[1];
  for (const o of trains) { if (o === t || !o.pos) continue;
    for (const c of o.pos) { const rx = c[0] - p[0], rz = c[1] - p[1], along = rx * hx + rz * hz, lat = Math.abs(rx * hz - rz * hx);
      if (along > 0 && along < 6.5 && lat < 0.8 && (c[2] * hx + c[3] * hz) > 0.5) return true; } }
  return false;
}
function placeTrain(t) {
  t.pos = [];
  t.cars.forEach((c, j) => {
    const sf = t.s - j * (CAR_L + CAR_G), f = routeAt(t.R, sf), r = routeAt(t.R, sf - CAR_L), x = (f[0] + r[0]) / 2, z = (f[1] + r[1]) / 2;
    let dx = f[0] - r[0], dz = f[1] - r[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const out = Math.abs(x) > HALF + 55 || Math.abs(z) > HALF + 55;
    const ry = Math.atan2(-dz, dx) + (c.rev ? Math.PI : 0);
    c.h.b && c.h.b.set(c.h, mtx(x, out ? -50 : RAIL_Y, z, ry));
    t.pos.push([x, z, dx, dz]);
  });
}

// ---------- přejezdy: závory a světla ----------
function rebuildCrossings() {
  for (const c of RL.cross) for (const a of c.arms) if (a.b) a.b.remove(a);
  RL.cross = [];
  if (!RL.lightB) RL.lightB = new Batch(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), { cap: 64, shadow: false });
  RL.lightB.clear();
  for (let k = 0; k < NN; k++) {
    if (!rail[k] || !road[k]) continue; const x = k % N, y = (k / N) | 0, horiz = (maskOf(rail, x, y) & 5) === 0, cx = tileX(x), cz = tileZ(y);
    const rot = (px, pz) => horiz ? [px, pz] : [pz, -px], c = { k, x: cx, z: cz, horiz, arms: [], lights: [], ang: 1.45, active: false };
    for (const [px, pz, ry] of [[-1.8, -1.95, 0], [1.8, 1.95, Math.PI]]) { const p = rot(px, pz);
      if (S.techs.crossings) { const a = batch('XARM', mBarrierArm, MATS, { shadow: true, cap: 32 }).add({ p: [cx + p[0], cz + p[1], ry + (horiz ? 0 : Math.PI / 2)] }, mtx(0, -50, 0)); c.arms.push(a); }
      for (const o of [-0.17, 0.17]) { const q = rot(px + o, pz), h = RL.lightB.add({}, mtx(cx + q[0], 1.35, cz + q[1]), _col2.setRGB(0.15, 0.03, 0.03)); c.lights.push(h); } }
    RL.cross.push(c);
  }
  RL.crossDirty = false;
}
function updateCrossings(dt, t) {
  if (RL.crossDirty) rebuildCrossings();
  RS.crossActive = RS.crossActive || new Set(); RS.crossActive.clear();
  for (const c of RL.cross) {
    let near = false; for (const tr of trains) { if (!tr.pos) continue; for (const p of tr.pos) if (Math.abs(p[0] - c.x) + Math.abs(p[1] - c.z) < 13) { near = true; break; } if (near) break; }
    c.active = near; if (near) RS.crossActive.add(c.k);
    const target = near ? 0 : 1.45; c.ang += clamp(target - c.ang, -1.3 * dt, 1.3 * dt);
    for (const a of c.arms) { if (!a.b) continue; const p = a.p; _te.set(0, p[2], c.ang, 'YXZ'); _tq.setFromEuler(_te); _tm.compose(_tv.set(p[0], 0.95, p[1]), _tq, _ts); a.b.set(a, _tm); }
    const on = near && Math.floor(t * 2.5) % 2;
    c.lights.forEach((h, i) => { if (h.b) h.b.col(h, near && (i % 2 === on ? 1 : 0) ? _col2.setRGB(4, 0.3, 0.2) : _col2.setRGB(0.15, 0.03, 0.03)); });
  }
}

// ---------- lidé na nástupištích ----------
function updatePlatforms(dt, t) {
  const live = new Set();
  for (const b of blds.values()) {
    const d = SERV[b.type]; if (d.rail !== 'pass' || !b.ok) continue; live.add(b.id);
    let P = RL.plat.get(b.id); if (!P) { P = { ppl: [], ry: faceRail(b) }; RL.plat.set(b.id, P); }
    const train = trains.some(tr => tr.at === b), want = Math.round(clamp((b.pax || 0) / 600, b.sf ? 2 : 0, d.main ? 16 : 8) * (train ? 0.25 : 1) * (S.rail && S.rail.strike ? 0.2 : 1));
    while (P.ppl.length < want) { const W2 = b.size * TS - 1.2, lx = (Math.random() - 0.5) * W2, lz = b.size * TS / 2 - 0.85 + (Math.random() - 0.5) * 0.5;
      P.ppl.push({ lx, lz, ph: Math.random() * 6, h: person('wait').add({}, mtx(0, -50, 0), lin(CAR_COLS[(Math.random() * CAR_COLS.length) | 0])) }); }
    while (P.ppl.length > want) { const p = P.ppl.pop(); if (p.h.b) p.h.b.remove(p.h); }
    const cx = tileX(b.x) + (b.size - 1) * TS / 2, cz = tileZ(b.y) + (b.size - 1) * TS / 2, cs = Math.cos(P.ry), sn = Math.sin(P.ry);
    for (const p of P.ppl) { const x = cx + p.lx * cs + p.lz * sn, z = cz - p.lx * sn + p.lz * cs; if (p.h.b) p.h.b.set(p.h, mtx(x, 0.55 + Math.abs(Math.sin(t * 1.5 + p.ph)) * 0.02, z, P.ry + Math.PI / 2 + Math.sin(p.ph) * 0.6)); }
  }
  for (const [id, P] of RL.plat) if (!live.has(id)) { for (const p of P.ppl) if (p.h.b) p.h.b.remove(p.h); RL.plat.delete(id); }
}
function faceRail(b) {
  const s = b.size, has = (x, y) => inb(x, y) && rail[idx(x, y)];
  let best = -1, br = 0;
  for (const [side, r] of [[2, 0], [1, Math.PI / 2], [0, Math.PI], [3, -Math.PI / 2]]) {
    let n = 0; for (let t = 0; t < s; t++) { const p = side === 2 ? [b.x + t, b.y + s] : side === 0 ? [b.x + t, b.y - 1] : side === 1 ? [b.x + s, b.y + t] : [b.x - 1, b.y + t]; if (has(p[0], p[1])) n++; }
    if (n > best) { best = n; br = r; }
  }
  return br;
}
function updateRail(dt, t) { if (!G.playing) return; updateTrains(dt); updateCrossings(dt, t); updatePlatforms(dt, t); }

// ---------- dlaždice s tratí ----------
function refreshRailTile(k, x, y, wx, wz) {
  const ex = treeH[k] = treeH[k] || [], m = maskOf(rail, x, y), br = ter[k] === 1, rt = rail[k];
  if (!road[k]) ex.push(batch('RL' + rt + (br ? 'b' : '') + m, () => mRail(rt, m, br), MATS, { shadow: true }).add({ k }, mtx(wx, 0.005, wz, 0)));
  else ex.push(batch('RX' + ((m & 5) === 0 ? 'h' : 'v'), () => mCrossing((m & 5) === 0), MATS, { shadow: true }).add({ k }, mtx(wx, 0.012, wz, 0)));
  if (railDmg[k]) ex.push(batch('RDMG', mRailDmg, MATS, { shadow: true }).add({ k }, mtx(wx, 0.02, wz, (m & 5) === 0 ? 0 : Math.PI / 2)));
  const out = x === 0 ? Math.PI : x === N - 1 ? 0 : y === 0 ? Math.PI / 2 : y === N - 1 ? -Math.PI / 2 : null;
  if (out != null) ex.push(batch('RLEXT', mRailExt, MATS, { shadow: false }).add({ k }, mtx(wx + Math.cos(out) * H, 0.005, wz - Math.sin(out) * H, out)));
  RL.crossDirty = true;
}
