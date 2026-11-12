'use strict';
// Vykreslování: scéna, instance budov a silnic, auta, davy, vojáci, efekty, přehledové mapy, obrysy.

let renderer, scene, camera, sun, matV, matB, terrain, waterMesh, waveTex, ovMesh, ovTex, ovData, prevB, ghost = null, ghostRing = null, cursorMesh;
let VW = 1, VH = 1, DPR = 1, edgeOn = true, depthRT, depthMat, edgeMat, edgeScene, edgeCam;
const cam = { x: 0, z: 0, dist: 150, yaw: 0.65, pitch: 0.95, shake: 0 };
const RS = { overlay: null, coarse: false };
const WHITE = new THREE.Color(1, 1, 1), _col2 = new THREE.Color(), _mtx = new THREE.Matrix4(), _qq = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _pp = new THREE.Vector3(), _ss = new THREE.Vector3();
const HALF = N * TS / 2;
function mtx(x, y, z, ry, sx, sy, sz) { return _mtx.compose(_pp.set(x, y, z), _qq.setFromAxisAngle(_up, ry || 0), _ss.set(sx || 1, sy == null ? (sx || 1) : sy, sz || sx || 1)); }

// ---------- dávky instancí ----------
class Batch {
  constructor(geo, mat, o) { this.geo = geo; this.mat = mat; this.cap = (o && o.cap) || 16; this.n = 0; this.own = []; this.shadow = !(o && o.shadow === false); this.layer = (o && o.layer) || 0; this.mesh = null; this.make(); }
  make() {
    const m = new THREE.InstancedMesh(this.geo, this.mat, this.cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 3).fill(1), 3);
    m.castShadow = this.shadow; m.receiveShadow = true; m.frustumCulled = false;
    if (this.layer) m.layers.set(this.layer);
    if (this.mesh) { m.instanceMatrix.array.set(this.mesh.instanceMatrix.array.subarray(0, this.n * 16)); m.instanceColor.array.set(this.mesh.instanceColor.array.subarray(0, this.n * 3)); scene.remove(this.mesh); if (this.mesh.dispose) this.mesh.dispose(); }
    m.count = this.n; m.visible = this.n > 0; scene.add(m); this.mesh = m;
  }
  add(h, m4, col) {
    if (this.n >= this.cap) { this.cap *= 2; this.make(); }
    const i = this.n++; h.b = this; h.i = i; this.own[i] = h;
    this.mesh.setMatrixAt(i, m4); this.col(h, col || WHITE);
    this.mesh.count = this.n; this.mesh.visible = true; this.mesh.instanceMatrix.needsUpdate = true; return h;
  }
  col(h, c) { const a = this.mesh.instanceColor.array; a[h.i * 3] = c.r; a[h.i * 3 + 1] = c.g; a[h.i * 3 + 2] = c.b; this.mesh.instanceColor.needsUpdate = true; }
  set(h, m4) { this.mesh.setMatrixAt(h.i, m4); this.mesh.instanceMatrix.needsUpdate = true; }
  remove(h) {
    if (h.b !== this) return;
    const i = h.i, last = --this.n;
    if (i !== last) { this.mesh.instanceMatrix.array.copyWithin(i * 16, last * 16, last * 16 + 16); this.mesh.instanceColor.array.copyWithin(i * 3, last * 3, last * 3 + 3); const o = this.own[last]; this.own[i] = o; o.i = i; }
    this.own[last] = null; h.b = null; this.mesh.count = this.n; this.mesh.visible = this.n > 0;
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
  }
  clear() { for (let i = this.n - 1; i >= 0; i--) if (this.own[i]) this.own[i].b = null; this.n = 0; this.own.length = 0; this.mesh.count = 0; this.mesh.visible = false; }
}
const batches = new Map();
function batch(key, make, mat, o) { let b = batches.get(key); if (!b) { b = new Batch(make(), mat || matV, o); batches.set(key, b); } return b; }

// ---------- scéna ----------
function initRender(canvas) {
  RS.coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa6d8f0); scene.fog = new THREE.Fog(0xbfe4f3, 420, 1100);
  camera = new THREE.PerspectiveCamera(32, 1, 2, 1600); camera.layers.enable(1);
  scene.add(new THREE.HemisphereLight(0xf4f8ff, 0x8fb070, 0.56));
  sun = new THREE.DirectionalLight(0xfff1d8, 0.68); sun.castShadow = true;
  const ms = RS.coarse ? 1024 : 2048; sun.shadow.mapSize.set(ms, ms);
  const sc = sun.shadow.camera; sc.left = -130; sc.right = 130; sc.top = 130; sc.bottom = -130; sc.near = 10; sc.far = 500; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.4;
  scene.add(sun, sun.target);
  const g = new Uint8Array([150, 150, 150, 255, 205, 205, 205, 255, 240, 240, 240, 255, 255, 255, 255, 255]);
  const grad = new THREE.DataTexture(g, 4, 1, THREE.RGBAFormat); grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
  matV = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad });
  matB = new THREE.MeshBasicMaterial({ vertexColors: true });
  buildTerrainMesh();
  // náhled tahu (silnice, zóny)
  prevB = new Batch(new THREE.BoxGeometry(TS - 0.3, 0.2, TS - 0.3), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false }), { cap: 512, shadow: false, layer: 1 });
  cursorMesh = new THREE.Mesh(new THREE.RingGeometry(TS * 0.62, TS * 0.72, 4, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false }));
  cursorMesh.rotation.set(-Math.PI / 2, 0, Math.PI / 4); cursorMesh.renderOrder = 10; cursorMesh.layers.set(1); scene.add(cursorMesh);
  initParticles(); setupEdges();
}
function setupEdges() {
  depthRT = new THREE.WebGLRenderTarget(4, 4); depthRT.depthTexture = new THREE.DepthTexture(4, 4); depthRT.depthTexture.type = THREE.UnsignedIntType;
  depthMat = new THREE.MeshBasicMaterial({ colorWrite: false });
  edgeMat = new THREE.ShaderMaterial({
    uniforms: { tDepth: { value: depthRT.depthTexture }, px: { value: new THREE.Vector2() }, cn: { value: camera.near }, cf: { value: camera.far } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: [
      'uniform sampler2D tDepth; uniform vec2 px; uniform float cn, cf; varying vec2 vUv;',
      'float ld(vec2 uv){ float d = texture2D(tDepth, uv).x; float z = d * 2.0 - 1.0; return 2.0 * cn * cf / (cf + cn - z * (cf - cn)); }',
      'void main(){ float c = ld(vUv), l = ld(vUv - vec2(px.x, 0.0)), r = ld(vUv + vec2(px.x, 0.0)), u = ld(vUv + vec2(0.0, px.y)), d = ld(vUv - vec2(0.0, px.y));',
      ' float e = (abs(l + r - 2.0 * c) + abs(u + d - 2.0 * c)) / c; float a = smoothstep(0.0035, 0.011, e); if (c > cf * 0.95) a = 0.0;',
      ' gl_FragColor = vec4(0.14, 0.13, 0.19, a * 0.78); }'].join('\n'),
    transparent: true, depthTest: false, depthWrite: false,
  });
  edgeScene = new THREE.Scene(); edgeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), edgeMat)); edgeCam = new THREE.Camera();
}
function resizeRender(w, h) {
  VW = w; VH = h; DPR = Math.min(window.devicePixelRatio || 1, RS.coarse ? 1.5 : 2);
  renderer.setPixelRatio(DPR); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  const rw = Math.round(w * DPR), rh = Math.round(h * DPR); depthRT.setSize(rw, rh); edgeMat.uniforms.px.value.set(1 / rw, 1 / rh);
}

// ---------- terén ----------
const TERR = { grass: 0x88c463, forest: 0x77b95a, sand: 0xeadba5, bed: 0x5f9cbc, lot: 0xd9d4c8, ind: 0xc6c1b4, garden: 0x9ad47a, ruin: 0xab9f8c, flood: 0x6aa8cc, road: 0x8f8f8a };
function buildTerrainMesh() {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(NN * 12), col = new Float32Array(NN * 12), nor = new Float32Array(NN * 12), ind = new Uint32Array(NN * 6);
  for (let k = 0; k < NN; k++) { for (let v = 0; v < 4; v++) { nor[k * 12 + v * 3 + 1] = 1; } const o = k * 4; ind.set([o, o + 2, o + 1, o + 1, o + 2, o + 3], k * 6); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setIndex(new THREE.BufferAttribute(ind, 1));
  terrain = new THREE.Mesh(geo, matV); terrain.receiveShadow = true; scene.add(terrain);
  // okolí mapy
  const outer = new THREE.MeshToonMaterial({ color: 0x9cc884, gradientMap: matV.gradientMap });
  for (const [x, z, w, d] of [[0, -HALF - 300, HALF * 2 + 1200, 600], [0, HALF + 300, HALF * 2 + 1200, 600], [-HALF - 300, 0, 600, HALF * 2], [HALF + 300, 0, 600, HALF * 2]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), outer); m.rotation.x = -Math.PI / 2; m.position.set(x, -0.02, z); m.receiveShadow = true; scene.add(m); }
  // voda s kreslenými vlnkami
  waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), new THREE.MeshToonMaterial({ color: 0x3f98d4, gradientMap: matV.gradientMap, transparent: true, opacity: 0.92 }));
  waterMesh.rotation.x = -Math.PI / 2; waterMesh.position.y = -0.3; waterMesh.receiveShadow = true; waterMesh.layers.set(1); scene.add(waterMesh);
  const wc = document.createElement('canvas'); wc.width = wc.height = 128; const x = wc.getContext('2d'); x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 3; x.lineCap = 'round';
  for (let i = 0; i < 9; i++) { const cx = (i * 47) % 128, cy = (i * 71) % 128; x.beginPath(); x.arc(cx, cy, 10, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); }
  waveTex = new THREE.CanvasTexture(wc); waveTex.wrapS = waveTex.wrapT = THREE.RepeatWrapping; waveTex.repeat.set(26, 26);
  const wv = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), new THREE.MeshBasicMaterial({ map: waveTex, transparent: true, depthWrite: false }));
  wv.rotation.x = -Math.PI / 2; wv.position.y = -0.26; wv.layers.set(1); scene.add(wv);
  // přehledová mapa
  ovData = new Uint8Array(NN * 4); ovTex = new THREE.DataTexture(ovData, N, N, THREE.RGBAFormat); ovTex.magFilter = THREE.LinearFilter; ovTex.minFilter = THREE.LinearFilter; ovTex.needsUpdate = true;
  ovMesh = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), new THREE.MeshBasicMaterial({ map: ovTex, transparent: true, depthWrite: false }));
  ovMesh.rotation.x = -Math.PI / 2; ovMesh.position.y = 0.35; ovMesh.layers.set(1); ovMesh.visible = false; ovMesh.renderOrder = 3; scene.add(ovMesh);
}
function paintTile(k) {
  const x = k % N, y = (k / N) | 0, p = terrain.geometry.attributes.position.array, c = terrain.geometry.attributes.color.array;
  const water = ter[k] === 1, h = water ? -0.9 : 0, x0 = x * TS - HALF, z0 = y * TS - HALF;
  const vs = [[x0, z0], [x0 + TS, z0], [x0, z0 + TS], [x0 + TS, z0 + TS]];
  for (let v = 0; v < 4; v++) { p[k * 12 + v * 3] = vs[v][0]; p[k * 12 + v * 3 + 1] = h; p[k * 12 + v * 3 + 2] = vs[v][1]; }
  let hex = TERR.grass;
  if (water) hex = TERR.bed;
  else if (flood[k]) hex = TERR.flood;
  else if (road[k]) hex = TERR.road;
  else if (ruin[k]) hex = TERR.ruin;
  else if (bld[k]) { const t = blds.get(bld[k]).type; hex = ['park', 'bigpark', 'university', 'stadium', 'solar', 'airport', 'dike'].includes(t) ? TERR.garden : TERR.lot; }
  else if (zone[k] && lvl[k]) hex = zone[k] === 1 && !dens[k] ? TERR.garden : zone[k] === 3 ? TERR.ind : TERR.lot;
  else if (zone[k]) { _col2.setHex(TERR.grass).lerp(new THREE.Color(ZONES[zone[k]].hex), 0.45); hex = _col2.getHex(); }
  else if (ter[k] === 3) hex = TERR.forest; else if (ter[k] === 2) hex = TERR.sand;
  _col2.setHex(hex); const f = 0.96 + hash2(x, y, 3) * 0.06;
  for (let v = 0; v < 4; v++) { c[k * 12 + v * 3] = _col2.r * f; c[k * 12 + v * 3 + 1] = _col2.g * f; c[k * 12 + v * 3 + 2] = _col2.b * f; }
  RS.terrDirty = true;
}

// ---------- dlaždice ----------
const tileH = new Array(NN).fill(null), treeH = new Array(NN).fill(null), servH = new Map(), anims = [], smokers = new Map(), rotors = [];
function roadMask(x, y) { let m = 0; if (y > 0 && road[idx(x, y - 1)]) m |= 1; if (x < N - 1 && road[idx(x + 1, y)]) m |= 2; if (y < N - 1 && road[idx(x, y + 1)]) m |= 4; if (x > 0 && road[idx(x - 1, y)]) m |= 8; return m; }
function faceRoad(x, y, s) {
  s = s || 1; let best = -1, br = 0;
  const sides = [[0, s, 0], [s, 0, Math.PI / 2], [0, -1, Math.PI], [-1, 0, -Math.PI / 2]];
  for (const [dx, dy, r] of sides) { let n = 0; for (let t = 0; t < s; t++) for (let d = 0; d < 2; d++) { const xx = dx ? x + dx + (dx > 0 ? d : -d) : x + t, yy = dy ? y + dy + (dy > 0 ? d : -d) : y + t; if (inb(xx, yy) && road[idx(xx, yy)]) n += d ? 1 : 3; } if (n > best) { best = n; br = r; } }
  return br;
}
function zoneKey(k) { const z = zone[k], d = dens[k], l = lvl[k], v = vari[k] % (z === 1 || z === 2 ? 5 : 3), s = z === 3 ? spec[k] : 0; return 'Z' + z + d + l + v + s; }
function zoneGeo(key) { const z = +key[1], d = +key[2], l = +key[3], v = +key[4], s = +key[5]; return z === 1 ? mRes(d, l, v) : z === 2 ? mCom(d, l, v) : z === 3 ? mInd(d, l, s, v, key) : mOff(d, l, v); }
function tint(k) {
  if (aband[k]) return _col2.setRGB(0.58, 0.53, 0.5);
  const f = 0.93 + (vari[k] % 7) * 0.012; return _col2.setRGB(f, f, f);
}
function refreshTile(k) {
  const h = tileH[k]; if (h) { if (h.b) h.b.remove(h); tileH[k] = null; smokers.delete(k); }
  const ts = treeH[k]; if (ts) { for (const t of ts) if (t.b) t.b.remove(t); treeH[k] = null; }
  paintTile(k);
  const x = k % N, y = (k / N) | 0, wx = tileX(x), wz = tileZ(y);
  if (road[k]) { const m = roadMask(x, y), br = ter[k] === 1; tileH[k] = batch((br ? 'BR' : 'RD') + m, () => mRoad(m, br), matV, { shadow: false }).add({ k }, mtx(wx, br ? 0.1 : 0.01, wz, 0)); return; }
  if (bld[k]) return;
  if (ruin[k] && !lvl[k]) { tileH[k] = batch('RUB', mRubble).add({ k }, mtx(wx, 0, wz, (vari[k] % 4) * 1.57)); return; }
  if (zone[k] && lvl[k]) {
    const key = zoneKey(k), ry = faceRoad(x, y);
    const hh = tileH[k] = batch(key, () => zoneGeo(key)).add({ k, p: [wx, 0, wz, ry] }, mtx(wx, 0, wz, ry), tint(k));
    if (SMOKE[key] && !aband[k]) smokers.set(k, { key, x: wx, z: wz, ry });
    return hh;
  }
  if (ter[k] === 3) {
    const n = 1 + (vari[k] % 3), arr = treeH[k] = [];
    for (let i = 0; i < n; i++) { const v = (vari[k] + i * 3) % 3, ox = (hash2(x, y, i) - 0.5) * 2.6, oz = (hash2(y, x, i + 5) - 0.5) * 2.6, s = 0.8 + hash2(x + i, y, 9) * 0.6;
      arr.push(batch('TR' + v, () => mTree(v)).add({ k }, mtx(wx + ox, 0, wz + oz, hash2(x, y, i) * 6, s, s, s))); }
  }
}
function grow(k) { const h = tileH[k]; if (h && h.p) anims.push({ h, t: 0 }); }
function syncBuildings() {
  for (const [id, h] of servH) if (!blds.has(id)) { if (h.b) h.b.remove(h); if (h.r && h.r.b) h.r.b.remove(h.r); servH.delete(id); smokers.delete('b' + id); }
  for (const b of blds.values()) {
    let h = servH.get(b.id); const s = b.size, wx = tileX(b.x) + (s - 1) * TS / 2, wz = tileZ(b.y) + (s - 1) * TS / 2;
    if (!h) {
      const ry = faceRoad(b.x, b.y, s), key = 'S:' + b.type;
      h = batch(key, () => mServ(b.type)).add({ id: b.id, p: [wx, 0, wz, ry], built: -1 }, mtx(wx, 0, wz, ry, 1, 0.1, 1));
      servH.set(b.id, h);
      if (b.type === 'wind') h.r = batch('ROTOR', mRotor).add({ id: b.id }, mtx(wx, 10.3, wz, 0));
      if (SMOKE[key]) smokers.set('b' + b.id, { key, x: wx, z: wz, ry, b });
      for (let j = b.y; j < b.y + s; j++) for (let i = b.x; i < b.x + s; i++) paintTile(idx(i, j));
    }
    const bt = Math.min(1, b.built);
    if (h.built !== bt || h.off !== (b.off > 0)) {
      h.built = bt; h.off = b.off > 0; const p = h.p;
      h.b.set(h, mtx(p[0], 0, p[2], p[3], 1, bt >= 1 ? 1 : 0.12 + 0.88 * bt, 1));
      h.b.col(h, h.off ? _col2.setRGB(0.6, 0.56, 0.52) : bt < 1 ? _col2.setRGB(0.85, 0.8, 0.7) : WHITE);
    }
  }
}
function mRotor() { const b = new GB(); b.sph(0.32, PAL.white, 0, 0, 0.75, 1, 1, 1, 0); for (let i = 0; i < 3; i++) b.add(new THREE.BoxGeometry(0.28, 4.4, 0.08), PAL.white, Math.sin(i * 2.094) * 2.2, Math.cos(i * 2.094) * 2.2, 0.8, 0, 0, -i * 2.094); return b.geo(); }
function rebuildAll() {
  for (const b of batches.values()) b.clear();
  tileH.fill(null); treeH.fill(null); servH.clear(); RS.martial = []; smokers.clear(); anims.length = 0; cars.length = 0; vehicles.length = 0; crowd.clear();
  for (let k = 0; k < NN; k++) refreshTile(k);
  syncBuildings(); RS.roadsDirty = true;
}

// ---------- doprava ----------
const cars = [], vehicles = [];
let roadList = [];
function rebuildRoadList() { roadList = []; for (let k = 0; k < NN; k++) if (road[k] && conn[k]) roadList.push(k); }
const NB4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
function nextRoad(k, prev) {
  const x = k % N, y = (k / N) | 0, opts = [];
  for (const [dx, dy] of NB4) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const n = idx(nx, ny); if (road[n] && n !== prev) opts.push(n); }
  return opts.length ? opts[(Math.random() * opts.length) | 0] : prev;
}
const CAR_COLS = [0xe0483a, 0x3f82dd, 0xf4c447, 0xf7f5ee, 0x47a85b, 0x3b4150, 0xf08a5d, 0x8a5bd6];
function carPos(c) {
  const ax = tileX(c.k % N), az = tileZ((c.k / N) | 0), bx = tileX(c.n % N), bz = tileZ((c.n / N) | 0);
  let dx = bx - ax, dz = bz - az; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
  const x = lerp(ax, bx, c.t) - dz * 0.75, z = lerp(az, bz, c.t) + dx * 0.75, y = (ter[c.k] === 1 || ter[c.n] === 1) ? 0.15 : 0.08;
  return mtx(x, y, z, Math.atan2(-dz, dx), c.s || 1);
}
function updateCars(dt) {
  if (RS.roadsDirty) { rebuildRoadList(); RS.roadsDirty = false; for (const c of cars.slice()) if (!road[c.k] || !road[c.n]) killCar(c); }
  const want = roadList.length < 2 || !T.pop ? 0 : Math.min(RS.coarse ? 160 : 420, Math.round(roadList.length * (0.08 + Math.min(1.6, T.traffic) * 0.45) + T.pop / 900));
  let spawn = 6;
  while (cars.length < want && spawn--) {
    const k = roadList[(Math.random() * roadList.length) | 0], n = nextRoad(k, -1); if (n === -1 || n === k || n == null) continue;
    const bus = Math.random() < 0.06 && T.pop > 3000, kind = bus ? 'CARbus' : 'CAR';
    const c = { k, n, prev: -1, t: Math.random(), sp: (bus ? 5 : 7 + Math.random() * 4) };
    c.h = batch(kind, () => mCar(bus ? 'bus' : 'car'), matV, { shadow: false, cap: 64 }).add({}, carPos(c), bus ? WHITE : _col2.setHex(CAR_COLS[(Math.random() * CAR_COLS.length) | 0]));
    cars.push(c);
  }
  if (cars.length > want + 4) killCar(cars[cars.length - 1]);
  const jam = T.traffic > 1 ? 1 / (0.5 + T.traffic * 0.5) : 1;
  for (const c of cars) {
    c.t += dt * c.sp * jam / TS;
    while (c.t >= 1) { c.t -= 1; const nk = nextRoad(c.n, c.k); c.prev = c.k; c.k = c.n; c.n = nk; if (nk == null || nk < 0) { c.n = c.prev; } }
    c.h.b.set(c.h, carPos(c));
  }
}
function killCar(c) { if (c.h.b) c.h.b.remove(c.h); cars.splice(cars.indexOf(c), 1); }
function nearestRoad(x, y) { for (let r = 0; r < 8; r++) for (let j = y - r; j <= y + r; j++) for (let i = x - r; i <= x + r; i++) { if (Math.max(Math.abs(i - x), Math.abs(j - y)) !== r || !inb(i, j)) continue; const k = idx(i, j); if (road[k]) return k; } return -1; }
function roadPath(a, b) {
  if (a < 0 || b < 0) return null; const prev = new Int32Array(NN).fill(-2), q = [a]; prev[a] = -1;
  for (let h = 0; h < q.length; h++) { const k = q[h]; if (k === b) break; const x = k % N, y = (k / N) | 0; for (const [dx, dy] of NB4) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const n = idx(nx, ny); if (road[n] && prev[n] === -2) { prev[n] = k; q.push(n); } } }
  if (prev[b] === -2) return null; const p = []; for (let k = b; k !== -1; k = prev[k]) p.push(k); return p.reverse();
}
function dispatch(kind, fromType, k, count) {
  const tx = k % N, ty = (k / N) | 0; let src = null, bd = 1e9;
  for (const b of blds.values()) if (fromType.includes(b.type) && b.ok) { const d = Math.hypot(b.x - tx, b.y - ty); if (d < bd) { bd = d; src = b; } }
  if (!src) return;
  const path = roadPath(nearestRoad(src.x, src.y), nearestRoad(tx, ty)); if (!path || path.length < 2) return;
  for (let i = 0; i < (count || 1); i++) {
    const v = { kind, path, i: 0, t: -i * 0.6, sp: 13, wait: 7 + i };
    v.h = batch('V' + kind, () => mCar(kind), matV, { shadow: false }).add({}, mtx(0, -50, 0, 0)); vehicles.push(v);
  }
}
function updateVehicles(dt) {
  for (const v of vehicles.slice()) {
    if (v.i >= v.path.length - 1) { v.wait -= dt; if (v.wait <= 0) { if (v.h.b) v.h.b.remove(v.h); vehicles.splice(vehicles.indexOf(v), 1); } continue; }
    v.t += dt * v.sp / TS; while (v.t >= 1 && v.i < v.path.length - 1) { v.t -= 1; v.i++; }
    if (v.t < 0) continue;
    const c = { k: v.path[v.i], n: v.path[Math.min(v.i + 1, v.path.length - 1)], t: v.i >= v.path.length - 1 ? 0 : v.t };
    if (c.k === c.n) c.n = v.path[v.i - 1] || c.k;
    v.h.b.set(v.h, carPos(c));
  }
}

// ---------- davy, policie, armáda ----------
const crowd = new Map();   // id incidentu -> postavy
function person(kind) { return batch('P' + kind, () => mPerson(kind), matV, { shadow: false, cap: 64 }); }
function updateCrowds(dt, t, dayFrac) {
  const live = new Set();
  for (const i of S.inc) {
    if (i.type !== 'protest' && i.type !== 'riot' && i.type !== 'assault') continue;
    live.add(i.id);
    let c = crowd.get(i.id); if (!c) { c = { people: [], police: [], enemy: [], ours: [] }; crowd.set(i.id, c); }
    const cx = tileX(i.x), cz = tileZ(i.y);
    if (i.type === 'assault') { updateAssault(i, c, t, dayFrac); continue; }
    const n = clamp(Math.round(i.size / 30), 10, RS.coarse ? 70 : 150), riot = i.type === 'riot';
    while (c.people.length < n) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()); c.people.push({ h: person('protest').add({}, mtx(0, -50, 0)), a, r, ph: Math.random() * 6, col: CAR_COLS[(Math.random() * 8) | 0] }); c.people[c.people.length - 1].h.b.col(c.people[c.people.length - 1].h, _col2.setHex(c.people[c.people.length - 1].col)); }
    while (c.people.length > n) { const p = c.people.pop(); if (p.h.b) p.h.b.remove(p.h); }
    const R = 2 + Math.sqrt(n) * 0.55;
    for (const p of c.people) { const jitter = riot ? Math.sin(t * 3 + p.ph) * 0.6 : Math.sin(t * 1.3 + p.ph) * 0.15; const x = cx + Math.cos(p.a + jitter * 0.1) * p.r * R + jitter, z = cz + Math.sin(p.a) * p.r * R;
      p.h.b.set(p.h, mtx(x, Math.abs(Math.sin(t * (riot ? 9 : 5) + p.ph)) * 0.25, z, Math.atan2(cx - x, cz - z) + Math.PI / 2)); }
    const pn = riot || i.police ? Math.min(40, Math.round(T.officers / 5)) : 0;
    while (c.police.length < pn) c.police.push({ h: person('police').add({}, mtx(0, -50, 0)) });
    while (c.police.length > pn) { const p = c.police.pop(); if (p.h.b) p.h.b.remove(p.h); }
    c.police.forEach((p, j) => { const a = -1.2 + (j / Math.max(1, pn - 1)) * 2.4 + 1.57, rr = R + 2.2; const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr; p.h.b.set(p.h, mtx(x, 0, z, Math.atan2(cx - x, cz - z) - Math.PI / 2 + 3.14)); });
  }
  for (const [id, c] of crowd) if (!live.has(id)) { for (const g of [c.people, c.police, c.enemy, c.ours]) for (const p of g) if (p.h.b) p.h.b.remove(p.h); crowd.delete(id); }
  // armáda v ulicích
  const mk = S.martial > 0 ? 8 : 0; RS.martial = RS.martial || [];
  while (RS.martial.length < mk && roadList.length) { const k = roadList[(hash2(RS.martial.length, 3, 1) * roadList.length) | 0]; RS.martial.push(batch('Varmy', () => mCar('army'), matV, { shadow: false }).add({}, mtx(tileX(k % N) + 0.8, 0.08, tileZ((k / N) | 0), RS.martial.length))); }
  while (RS.martial.length > mk) { const h = RS.martial.pop(); if (h.b) h.b.remove(h); }
}
const SIDE = { W: [-1, 0], E: [1, 0], N: [0, -1], S: [0, 1] };
function updateAssault(i, c, t, dayFrac) {
  const n = clamp(Math.round(i.size / 40), 4, 26), s = SIDE[i.side] || [-1, 0];
  const tx = tileX(i.x), tz = tileZ(i.y), sx = s[0] ? s[0] * (HALF + 20) : tx, sz = s[1] ? s[1] * (HALF + 20) : tz;
  const prog = clamp((S.day + dayFrac - i.day) / Math.max(1, i.eta - i.day), 0, 1);
  while (c.enemy.length < n) c.enemy.push({ h: batch('Vetank', () => mCar('etank'), matV, { shadow: true }).add({}, mtx(0, -50, 0)), o: [(Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10] });
  const dx = tx - sx, dz = tz - sz, ry = Math.atan2(-dz, dx);
  for (const e of c.enemy) e.h.b.set(e.h, mtx(lerp(sx, tx, prog) + e.o[0] * (1 - prog * 0.5), 0.05, lerp(sz, tz, prog) + e.o[1] * (1 - prog * 0.5), ry));
  if (i.intercept) {
    const base = [...blds.values()].find(b => b.type === 'barracks'); if (!base) return;
    const bx = tileX(base.x + 1), bz = tileZ(base.y + 1), mx = lerp(sx, tx, 0.72), mz = lerp(sz, tz, 0.72), p2 = clamp(prog * 1.4, 0, 1);
    while (c.ours.length < Math.min(14, n)) c.ours.push({ h: batch('Vtank', () => mCar('tank'), matV, { shadow: true }).add({}, mtx(0, -50, 0)), o: [(Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8] });
    for (const e of c.ours) e.h.b.set(e.h, mtx(lerp(bx, mx, p2) + e.o[0], 0.05, lerp(bz, mz, p2) + e.o[1], Math.atan2(-(mz - bz), mx - bx)));
  }
}

// ---------- částice: kouř, oheň, výbuchy ----------
let pB, fB; const parts = [];
function initParticles() {
  pB = new Batch(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshToonMaterial({ gradientMap: matV.gradientMap }), { cap: 700, shadow: false, layer: 1 });
  fB = new Batch(new THREE.ConeGeometry(0.5, 1.4, 6), new THREE.MeshBasicMaterial({ fog: false }), { cap: 400, shadow: false, layer: 1 });
}
function puff(x, y, z, hex, size, life, vy, vx, vz) {
  if (parts.length >= 680) return;
  const p = { x, y, z, vx: vx || 0, vy, vz: vz || 0, life, max: life, size, h: pB.add({}, mtx(x, y, z, 0, 0.01), _col2.setHex(hex)) }; parts.push(p);
}
function updateParticles(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt;
    if (p.life <= 0) { pB.remove(p.h); parts.splice(i, 1); continue; }
    const k = 1 - p.life / p.max; p.x += (p.vx + 0.6) * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const s = p.size * (k < 0.15 ? k / 0.15 : 1 + k * 1.2) * (k > 0.85 ? (1 - k) / 0.15 : 1);
    pB.set(p.h, mtx(p.x, p.y, p.z, k * 2, Math.max(0.01, s)));
  }
}
function boom(x, z, big) {
  const n = big ? 14 : 7;
  for (let i = 0; i < n; i++) puff(x + (Math.random() - 0.5) * 2, 1 + Math.random() * 2, z + (Math.random() - 0.5) * 2, i % 3 ? 0xff9a2e : 0xffd34d, (big ? 2.2 : 1.2) * (0.6 + Math.random() * 0.6), 0.5 + Math.random() * 0.4, 3, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
  for (let i = 0; i < n; i++) puff(x + (Math.random() - 0.5) * 3, 2 + Math.random() * 3, z + (Math.random() - 0.5) * 3, 0x55504c, (big ? 2.4 : 1.4), 2.5 + Math.random(), 2.5);
}
let smokeT = 0, fireList = [];
function updateEffects(dt, t) {
  smokeT -= dt;
  if (smokeT <= 0) {
    smokeT = 0.12;
    // komíny
    const arr = [...smokers.values()];
    for (let n = 0; n < Math.min(4, arr.length); n++) {
      const s = arr[(Math.random() * arr.length) | 0]; if (s.b && (!s.b.ok || s.b.off > 0)) continue;
      const pts = SMOKE[s.key]; const c = pts[(Math.random() * pts.length) | 0], cs = Math.cos(s.ry), sn = Math.sin(s.ry);
      const x = s.x + c[0] * cs + c[2] * sn, z = s.z - c[0] * sn + c[2] * cs;
      puff(x, c[1], z, S.pol.ecolaw || S.techs.filters ? 0xe9e9e6 : 0xb9b6b0, s.b ? 1.3 : 0.8, 3 + Math.random() * 2, 1.6);
    }
    // požáry
    fireList = []; for (let k = 0; k < NN; k++) if (fire[k]) fireList.push([tileX(k % N), tileZ((k / N) | 0), 1]);
    for (const b of blds.values()) if (b.fire > 0) fireList.push([tileX(b.x) + (b.size - 1) * TS / 2, tileZ(b.y) + (b.size - 1) * TS / 2, b.size]);
    for (const f of fireList.slice(0, 40)) if (Math.random() < 0.7) puff(f[0] + (Math.random() - 0.5) * 2, 3 + Math.random() * 2, f[1] + (Math.random() - 0.5) * 2, 0x46413d, 1.4 * f[2], 3.5, 2.4);
  }
  fB.clear();
  for (const f of fireList.slice(0, 120)) for (let j = 0; j < 3; j++) {
    const ph = t * 9 + f[0] * 0.3 + j * 2, s = (0.9 + Math.sin(ph) * 0.25) * f[2];
    fB.add({}, mtx(f[0] + (j - 1) * 0.9 * f[2], 0.6 + s * 0.6 + j * 0.3, f[1] + ((j * 7) % 3 - 1) * 0.7 * f[2], ph * 0.1, s, s * (1.2 + Math.sin(ph * 1.7) * 0.25), s), _col2.setHex(j === 1 ? 0xffd34d : 0xff7a1e));
  }
}
function handleFX() {
  while (FX.length) {
    const f = FX.shift();
    if (f.t === 'grow') grow(f.k);
    else if (f.t === 'firetruck') dispatch('fire', ['fire'], f.k, 1);
    else if (f.t === 'police') dispatch('police', ['police', 'policehq'], f.k, 3);
    else if (f.t === 'army') dispatch('army', ['barracks'], f.k, 3);
    else if (f.t === 'boom') boom(tileX(f.k % N), tileZ((f.k / N) | 0), !f.small);
    else if (f.t === 'battle') { const x = tileX(f.k % N), z = tileZ((f.k / N) | 0); for (let i = 0; i < 4; i++) setTimeout(() => boom(x + (Math.random() - 0.5) * 14, z + (Math.random() - 0.5) * 14, false), i * 250); }
    else if (f.t === 'shake') cam.shake = 1.4 * (f.s || 1);
    else if (f.t === 'storm') { for (let i = 0; i < 30; i++) { const x = (i / 30) * HALF * 2 - HALF, z = tileZ(f.y0 + Math.tan(f.ang) * (i / 30) * N); puff(x, 2 + Math.random() * 3, z, 0x9a9a9a, 2.5, 3, 1, 8, 0); } }
  }
}

// ---------- přehledové mapy ----------
const OVERLAYS = {
  lv: { name: 'Cena pozemků', f: k => ter[k] === 1 ? null : heat(lv[k] / 100) },
  poll: { name: 'Znečištění', f: k => poll[k] < 3 ? null : badCol(poll[k] / 60) },
  crime: { name: 'Kriminalita', f: k => isBuilt(k) && zone[k] !== 3 ? badCol(crime[k] / 50) : null },
  hap: { name: 'Spokojenost', f: k => isBuilt(k) && zone[k] === 1 ? heat(hap[k] / 100) : null },
  traf: { name: 'Doprava', f: k => road[k] ? badCol(traf[k] / 1.4) : null },
  power: { name: 'Elektřina', f: k => zone[k] ? (pw[k] ? [70, 170, 255, 150] : [235, 70, 60, 200]) : null },
  water: { name: 'Voda', f: k => zone[k] ? (wt[k] ? [80, 200, 230, 150] : [235, 70, 60, 200]) : null },
  police: { name: 'Policie', f: k => cov.police[k] > 0.02 ? [60, 110, 230, Math.min(200, cov.police[k] * 220)] : null },
  fire: { name: 'Hasiči', f: k => cov.fire[k] > 0.02 ? [235, 90, 50, Math.min(200, cov.fire[k] * 220)] : null },
  health: { name: 'Zdravotnictví', f: k => cov.health[k] > 0.02 ? [230, 70, 110, Math.min(200, cov.health[k] * 220)] : null },
  edu: { name: 'Školy', f: k => cov.edu[k] > 0.02 ? [250, 180, 40, Math.min(200, cov.edu[k] * 220)] : null },
  transit: { name: 'MHD', f: k => cov.transit[k] > 0.02 ? [60, 190, 120, Math.min(200, cov.transit[k] * 200)] : null },
  flood: { name: 'Záplavové území', f: k => fpl[k] ? [40, 120, 230, 170] : null },
};
function heat(v) { v = clamp(v, 0, 1); return v < 0.5 ? [230, Math.round(80 + v * 2 * 150), 60, 170] : [Math.round(230 - (v - 0.5) * 2 * 170), 220, 70, 170]; }
function badCol(v) { v = clamp(v, 0, 1); return [Math.round(80 + v * 160), Math.round(200 - v * 150), 70, Math.round(60 + v * 150)]; }
function updateOverlay() {
  const o = OVERLAYS[RS.overlay]; ovMesh.visible = !!o; if (!o) return;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const k = idx(x, y), c = o.f(k), j = ((y) * N + x) * 4;
    if (c) { ovData[j] = c[0]; ovData[j + 1] = c[1]; ovData[j + 2] = c[2]; ovData[j + 3] = c[3]; } else ovData[j + 3] = 0; }
  ovTex.needsUpdate = true;
}

// ---------- náhledy pro nástroje ----------
function showPreview(cells) {
  prevB.clear();
  for (const c of cells.slice(0, 2000)) prevB.add({}, mtx(tileX(c.x), 0.3, tileZ(c.y), 0), _col2.setHex(c.col));
}
function showGhost(type, x, y, ok) {
  if (ghost && ghost.userData.type !== type) { scene.remove(ghost); ghost = null; }
  if (ghostRing) { scene.remove(ghostRing); ghostRing = null; }
  if (!type) { if (ghost) { scene.remove(ghost); ghost = null; } return; }
  const s = SERV[type].size;
  if (!ghost) { ghost = new THREE.Mesh(mServ(type), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.65, depthWrite: false })); ghost.userData.type = type; ghost.layers.set(1); scene.add(ghost); }
  const wx = tileX(x) + (s - 1) * TS / 2, wz = tileZ(y) + (s - 1) * TS / 2;
  ghost.position.set(wx, 0.05, wz); ghost.material.color.setHex(ok ? 0xffffff : 0xff6655);
  const r = SERV[type].r; if (r && r < 30) { ghostRing = new THREE.Mesh(new THREE.RingGeometry(r * TS - 0.5, r * TS, 48), new THREE.MeshBasicMaterial({ color: ok ? 0xffffff : 0xff6655, transparent: true, opacity: 0.6, depthWrite: false })); ghostRing.rotation.x = -Math.PI / 2; ghostRing.position.set(wx, 0.4, wz); ghostRing.layers.set(1); scene.add(ghostRing); }
}
function showCursor(x, y, s, col) {
  if (x < 0) { cursorMesh.visible = false; return; }
  cursorMesh.visible = true; cursorMesh.scale.setScalar(s || 1); cursorMesh.material.color.setHex(col || 0xffffff);
  cursorMesh.position.set(tileX(x) + ((s || 1) - 1) * TS / 2, 0.45, tileZ(y) + ((s || 1) - 1) * TS / 2);
}

// ---------- kamera a výběr ----------
function updateCam() {
  cam.x = clamp(cam.x, -HALF, HALF); cam.z = clamp(cam.z, -HALF, HALF); cam.dist = clamp(cam.dist, 30, 420); cam.pitch = clamp(cam.pitch, 0.45, 1.35);
  const sh = cam.shake > 0 ? cam.shake : 0, ox = (Math.random() - 0.5) * sh, oz = (Math.random() - 0.5) * sh;
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  camera.position.set(cam.x + Math.sin(cam.yaw) * cp * cam.dist + ox, sp * cam.dist, cam.z + Math.cos(cam.yaw) * cp * cam.dist + oz);
  camera.lookAt(cam.x + ox, 0, cam.z + oz);
  sun.target.position.set(cam.x, 0, cam.z); sun.position.set(cam.x + 90, 160, cam.z + 60);
  const sc = sun.shadow.camera, ext = clamp(cam.dist * 0.9, 60, 230); if (Math.abs(sc.right - ext) > 8) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix(); }
}
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _hit = new THREE.Vector3();
function pickGround(sx, sy) {
  _ndc.set(sx / VW * 2 - 1, -(sy / VH) * 2 + 1); _ray.setFromCamera(_ndc, camera);
  if (!_ray.ray.intersectPlane(_plane, _hit)) return null;
  const x = Math.floor((_hit.x + HALF) / TS), y = Math.floor((_hit.z + HALF) / TS);
  return { x, y, wx: _hit.x, wz: _hit.z, ok: inb(x, y) };
}
const _pv = new THREE.Vector3();
function project(x, y, z) { _pv.set(x, y, z).project(camera); return { x: (_pv.x + 1) / 2 * VW, y: (1 - _pv.y) / 2 * VH, ok: _pv.z < 1 && _pv.z > -1 }; }

// ---------- snímek ----------
function renderFrame(dt, t, dayFrac) {
  if (dirty.size) { for (const k of dirty) refreshTile(k); if ([...dirty].some(k => road[k] || !road[k])) RS.roadsDirty = true; dirty.clear(); }
  syncBuildings(); handleFX();
  if (RS.terrDirty) { terrain.geometry.attributes.position.needsUpdate = true; terrain.geometry.attributes.color.needsUpdate = true; terrain.geometry.computeBoundingSphere(); RS.terrDirty = false; }
  for (let i = anims.length - 1; i >= 0; i--) { const a = anims[i]; a.t += dt * 2.2; const h = a.h; if (!h.b) { anims.splice(i, 1); continue; } const p = h.p, k = Math.min(1, a.t); const s = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.18 : 1; h.b.set(h, mtx(p[0], 0, p[2], p[3], 1 / Math.sqrt(s), k * s, 1 / Math.sqrt(s))); if (a.t >= 1) anims.splice(i, 1); }
  for (const h of servH.values()) if (h.r && h.r.b) { const p = h.p; _mtx.makeRotationY(p[3]); const rot = new THREE.Matrix4().makeRotationZ(t * 1.6 + h.id); const m = new THREE.Matrix4().makeTranslation(p[0], 10.3, p[2]).multiply(_mtx).multiply(rot); h.r.b.set(h.r, m); }
  updateCars(dt); updateVehicles(dt); updateCrowds(dt, t, dayFrac); updateEffects(dt, t); updateParticles(dt);
  waveTex.offset.set((t * 0.01) % 1, (t * 0.006) % 1);
  waterMesh.position.y = S.floodEv ? -0.3 + Math.min(1, S.floodEv.day / 3) * 0.2 : -0.3;
  if (cam.shake > 0) cam.shake = Math.max(0, cam.shake - dt * 1.2);
  updateCam();
  renderer.shadowMap.needsUpdate = true;
  if (edgeOn) {
    camera.layers.set(0); scene.overrideMaterial = depthMat; const sm = renderer.shadowMap.needsUpdate; renderer.shadowMap.needsUpdate = false;
    renderer.setRenderTarget(depthRT); renderer.clear(); renderer.render(scene, camera);
    scene.overrideMaterial = null; renderer.setRenderTarget(null); camera.layers.enable(1); renderer.shadowMap.needsUpdate = sm;
  }
  renderer.render(scene, camera);
  if (edgeOn) { renderer.autoClear = false; renderer.render(edgeScene, edgeCam); renderer.autoClear = true; }
}
