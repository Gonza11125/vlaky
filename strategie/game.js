'use strict';
// Simulace: scéna, jednotky, budovy, boj, ekonomika, protivník.

const G = { time: 0, speed: 1, paused: true, over: false, diff: 1, snow: 0 };
const MAXPOP = 90;
const teams = [], units = [], blds = [], projs = [], puffs = [];
const byId = new Map();
let nextId = 1;
let scene, camera, renderer, sun, terrain, terrainBase, waterMesh;
let unitMat, bldMat, farmMat, ghostMat, nodeMeshes = {};
const geoCache = {};
const season = () => Math.floor(G.time / SEASON_LEN) % 4;
const year = () => Math.floor(G.time / (SEASON_LEN * 4)) + 1;

function mkTeam(id) {
  return { id, color: TEAM_COLORS[id], res: { food: 200, wood: 200, stone: 100, ore: 0, metal: 0, know: 0 }, tech: {}, busy: {}, era: 0, pop: 0, cap: 0, hit: null, hungry: false, starve: 0, smelt: 0, stats: { kills: 0, lost: 0, razed: 0 } };
}
const afford = (T, cost) => !cost || Object.keys(cost).every(k => T.res[k] >= cost[k]);
function pay(T, cost) { for (const k in cost) T.res[k] -= cost[k]; }
function refund(T, cost, f) { for (const k in cost) T.res[k] += cost[k] * (f || 1); }
function missing(T, cost) { return Object.keys(cost).filter(k => T.res[k] < cost[k]).map(k => RES_NAME[k].toLowerCase() + ' ' + Math.ceil(cost[k] - T.res[k])).join(', '); }
const hasReq = (T, def) => !def.req || def.req.every(r => T.tech[r]);
const techAvail = (T, id) => { const d = TECHS[id]; return !T.tech[id] && !T.busy[id] && T.era >= d.era && hasReq(T, d); };

// ---------- scéna ----------
function initScene(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9db7c6);
  scene.fog = new THREE.Fog(0x9db7c6, 170, 460);
  camera = new THREE.PerspectiveCamera(35, 1, 1, 900);
  scene.add(new THREE.HemisphereLight(0xe3ecf5, 0x6d6450, 0.72));
  sun = new THREE.DirectionalLight(0xfff1da, 0.9);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 10; sc.far = 320;
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);
  unitMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  bldMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  farmMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  ghostMat = new THREE.MeshBasicMaterial({ color: 0x66ff88, transparent: true, opacity: 0.55, depthWrite: false });
}

function terrainColor(i, j, out) {
  const h = hgt[j * NV + i], n = hash2(i, j, 5), cx = clamp(i, 0, N - 1), cy = clamp(j, 0, N - 1);
  if (h < -0.6) out.setHex(0x6f8173);
  else if (h < 0.45) out.setHex(0xcdbd8c).lerp(_col.setHex(0x6f8173), sstep(0.2, -0.6, h));
  else if (h > 6) out.setHex(0x8c8576).lerp(_col.setHex(0xa7a196), n);
  else {
    out.setHex(0x71a04c).lerp(_col.setHex(0x5e8a40), fbm(i / 9, j / 9, 3));
    out.lerp(_col.setHex(0xcdbd8c), sstep(1.0, 0.45, h) * 0.8);
    out.lerp(_col.setHex(0x8c8576), sstep(4.6, 6, h));
    if (forest[cidx(cx, cy)]) out.lerp(_col.setHex(0x3f6a34), 0.45);
    out.multiplyScalar(0.94 + n * 0.1);
  }
}
function buildTerrain() {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(NV * NV * 3), col = new Float32Array(NV * NV * 3), idx = new Uint16Array(N * N * 6);
  const c = new THREE.Color();
  for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) {
    const k = (j * NV + i) * 3;
    pos[k] = i * CS; pos[k + 1] = hgt[j * NV + i]; pos[k + 2] = j * CS;
    terrainColor(i, j, c); col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
  }
  let o = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * NV + i, b = a + 1, d = a + NV, e = d + 1; idx[o++] = a; idx[o++] = d; idx[o++] = b; idx[o++] = b; idx[o++] = d; idx[o++] = e; }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  terrainBase = col.slice();
  terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  terrain.receiveShadow = true; scene.add(terrain);
  waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 5, WORLD * 5), new THREE.MeshPhongMaterial({ color: 0x3f7391, transparent: true, opacity: 0.84, shininess: 80, specular: 0x99bbcc }));
  waterMesh.rotation.x = -Math.PI / 2; waterMesh.position.set(WORLD / 2, 0, WORLD / 2); scene.add(waterMesh);
}
function applySnow(s) {
  const col = terrain.geometry.attributes.color.array;
  for (let v = 0; v < NV * NV; v++) {
    const k = v * 3, m = hgt[v] > 0.25 ? s * (0.62 + 0.16 * (terrainBase[k + 1] - 0.4)) : 0;
    col[k] = lerp(terrainBase[k], 0.86, m); col[k + 1] = lerp(terrainBase[k + 1], 0.89, m); col[k + 2] = lerp(terrainBase[k + 2], 0.94, m);
  }
  terrain.geometry.attributes.color.needsUpdate = true;
  const t = _col.setRGB(lerp(1, 1.25, s), lerp(1, 1.3, s), lerp(1, 1.35, s));
  nodeMeshes.oak.material.color.setRGB(lerp(1, 1.3, s), lerp(1, 1.0, s), lerp(1, 1.25, s));
  nodeMeshes.pine.material.color.copy(t); nodeMeshes.bush.material.color.copy(t);
  waterMesh.material.color.setHex(0x3f7391).lerp(_col.setHex(0xa9c6d6), s * 0.6);
}
let terrainDirty = false;
function flatten(cx, cy, s) {
  let sum = 0, n = 0;
  for (let j = cy; j <= cy + s; j++) for (let i = cx; i <= cx + s; i++) { sum += hgt[j * NV + i]; n++; }
  const h = sum / n, pos = terrain.geometry.attributes.position.array;
  for (let j = cy; j <= cy + s; j++) for (let i = cx; i <= cx + s; i++) { hgt[j * NV + i] = h; pos[(j * NV + i) * 3 + 1] = h; }
  terrain.geometry.attributes.position.needsUpdate = true; terrainDirty = true;
  return h;
}

const _mat4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v3 = new THREE.Vector3(), _s3 = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function nodeKind(n) { return n.type === 'tree' ? (n.v < 0.5 ? 'pine' : 'oak') : n.type; }
function setNodeMatrix(n, scale) {
  _q.setFromAxisAngle(_up, n.v * 6.28);
  const s = scale * (n.type === 'tree' ? 0.85 + n.v * 0.5 : 0.9 + n.v * 0.3);
  _mat4.compose(_v3.set(n.x, heightAt(n.x, n.z) - 0.05, n.z), _q, _s3.set(s, s, s));
  const m = nodeMeshes[nodeKind(n)]; m.setMatrixAt(n.inst, _mat4); m.instanceMatrix.needsUpdate = true;
}
function buildNodes() {
  const geos = { pine: treeGeo(true), oak: treeGeo(false), bush: bushGeo(), stone: rockGeo(false), ore: rockGeo(true) };
  const counts = { pine: 0, oak: 0, bush: 0, stone: 0, ore: 0 };
  for (const n of nodes) n.inst = counts[nodeKind(n)]++;
  for (const k in geos) {
    const m = new THREE.InstancedMesh(geos[k], new THREE.MeshLambertMaterial({ vertexColors: true }), Math.max(1, counts[k]));
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; nodeMeshes[k] = m; scene.add(m);
  }
  for (const n of nodes) setNodeMatrix(n, 1);
}
function depleteNode(n) { n.amt = 0; nodeAt[cidx(n.cx, n.cy)] = -1; setNodeMatrix(n, 0.0001); }
function nearestNode(type, x, z, maxD) {
  let best = null, bd = (maxD || 1e9) ** 2;
  for (const n of nodes) { if (n.amt <= 0 || n.type !== type) continue; const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } }
  return best;
}

// ---------- entity ----------
function geoFor(kind, type, team) { const k = kind + type + team; return geoCache[k] || (geoCache[k] = kind === 'u' ? unitGeo(type, TEAM_COLORS[team]) : buildingGeo(type, TEAM_COLORS[team])); }
function addUnit(team, type, x, z) {
  const def = UNITS[type];
  const u = { id: nextId++, isU: true, team, type, def, x, z, hp: def.hp, maxHp: def.hp, order: null, path: null, pi: 0, cd: 0, carry: 0, ctype: null, face: Math.random() * 6, moving: false, working: false, scan: Math.random() * 0.5, dead: false };
  u.mesh = new THREE.Mesh(geoFor('u', type, team), unitMat); u.mesh.castShadow = true;
  u.mesh.position.set(x, heightAt(x, z), z); scene.add(u.mesh);
  units.push(u); byId.set(u.id, u); teams[team].pop++;
  return u;
}
function canPlace(type, cx, cy) {
  const s = BUILDINGS[type].size;
  for (let j = cy; j < cy + s; j++) for (let i = cx; i < cx + s; i++) {
    if (!inMap(i, j)) return false; const k = cidx(i, j);
    if (!walk[k] || resv[k] || nodeAt[k] >= 0) return false;
  }
  return true;
}
function placeBuilding(team, type, cx, cy, instant) {
  const def = BUILDINGS[type], s = def.size, T = teams[team];
  const maxHp = Math.round(def.hp * (T.tech.masonry ? 1.25 : 1));
  const b = { id: nextId++, isB: true, team, type, def, cx, cy, size: s, x: (cx + s / 2) * CS, z: (cy + s / 2) * CS, hp: instant ? maxHp : maxHp * 0.1, maxHp, done: !!instant, prog: instant ? 1 : 0, queue: [], rally: null, cd: 0, worker: null, dead: false };
  b.y = flatten(cx, cy, s);
  for (let j = cy; j < cy + s; j++) for (let i = cx; i < cx + s; i++) { const k = cidx(i, j); resv[k] = 1; bAt[k] = b.id; if (type !== 'farm') occ[k] = 1; walk[k] = 1; }
  b.mesh = new THREE.Mesh(geoFor('b', type, team), type === 'farm' ? farmMat : bldMat);
  b.mesh.castShadow = type !== 'farm'; b.mesh.receiveShadow = true;
  b.mesh.position.set(b.x, b.y, b.z); b.mesh.scale.y = instant ? 1 : 0.12; scene.add(b.mesh);
  blds.push(b); byId.set(b.id, b);
  return b;
}
function finishBuilding(b) {
  b.done = true; b.prog = 1; b.mesh.scale.y = 1;
  if (b.team === 0) msg(b.def.name + ' – stavba dokončena.');
}
function killEnt(e, by) {
  if (e.dead) return; e.dead = true; byId.delete(e.id); scene.remove(e.mesh);
  const T = teams[e.team];
  if (e.isU) { T.pop--; T.stats.lost++; if (by) teams[by.team].stats.kills++; }
  else {
    for (let j = e.cy; j < e.cy + e.size; j++) for (let i = e.cx; i < e.cx + e.size; i++) { const k = cidx(i, j); resv[k] = 0; occ[k] = 0; bAt[k] = 0; }
    for (const q of e.queue) { if (q.kind === 't') delete T.busy[q.id]; }
    if (by) teams[by.team].stats.razed++;
    for (let i = 0; i < 8; i++) puff(e.x + (Math.random() - 0.5) * e.size * 1.6, e.y + 0.5 + Math.random() * 2, e.z + (Math.random() - 0.5) * e.size * 1.6, 0x8a8172, 1.2, 1.6, 1.2);
    if (e.team === 0 && by) msg(e.def.name + ' – budova zničena!', 'bad');
    if (e.type === 'tc') endGame(e.team !== 0);
  }
}
function distEnt(u, t) {
  if (t.isB) { const h = t.size * CS / 2; return Math.hypot(Math.max(Math.abs(u.x - t.x) - h, 0), Math.max(Math.abs(u.z - t.z) - h, 0)); }
  return Math.hypot(u.x - t.x, u.z - t.z);
}

// ---------- pohyb ----------
function los(x0, z0, x1, z1) {
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / (CS * 0.35));
  for (let i = 1; i <= n; i++) { const t = i / n; if (blocked(cidx(cellOf(lerp(x0, x1, t)), cellOf(lerp(z0, z1, t))))) return false; }
  return true;
}
function setPath(u, cells, last) {
  const pts = cells.map(c => ({ x: cellC(c % N), z: cellC((c / N) | 0) }));
  if (last) { if (pts.length) pts[pts.length - 1] = last; else pts.push(last); }
  const out = []; let px = u.x, pz = u.z, i = 0;
  while (i < pts.length) {
    let j = Math.min(pts.length - 1, i + 14);
    while (j > i && !los(px, pz, pts[j].x, pts[j].z)) j--;
    out.push(pts[j]); px = pts[j].x; pz = pts[j].z; i = j + 1;
  }
  u.path = out; u.pi = 0;
}
function pathTo(u, x, z) {
  x = clamp(x, 1, WORLD - 1); z = clamp(z, 1, WORLD - 1);
  let gx = cellOf(x), gy = cellOf(z), exact = true;
  if (blocked(cidx(gx, gy))) { const f = nearestFree(gx, gy); if (!f) { u.path = null; return false; } gx = f.cx; gy = f.cy; exact = false; }
  const r = findPath(cellOf(u.x), cellOf(u.z), gx, gy, gx, gy, 0);
  setPath(u, r.cells, r.ok && exact ? { x, z } : null);
  return r.ok;
}
function pathToB(u, b) {
  const r = findPath(cellOf(u.x), cellOf(u.z), b.cx, b.cy, b.cx + b.size - 1, b.cy + b.size - 1, 1);
  setPath(u, r.cells, null); return r.ok;
}
function speedOf(u) { let s = u.def.speed; if (u.type === 'vil' && teams[u.team].tech.wheel) s *= 1.1; if (teams[u.team].hungry) s *= 0.8; return s; }
function follow(u, dt) {
  if (!u.path || u.pi >= u.path.length) { u.path = null; return true; }
  let step = speedOf(u) * dt;
  while (step > 0 && u.pi < u.path.length) {
    const p = u.path[u.pi], dx = p.x - u.x, dz = p.z - u.z, d = Math.hypot(dx, dz);
    if (d > 0.001) u.face = Math.atan2(dx, dz);
    if (d <= step) { u.x = p.x; u.z = p.z; step -= d; u.pi++; } else { u.x += dx / d * step; u.z += dz / d * step; step = 0; }
  }
  u.moving = true;
  if (u.pi >= u.path.length) { u.path = null; return true; }
  return false;
}
function faceTo(u, t) { u.face = Math.atan2(t.x - u.x, t.z - u.z); }

// ---------- rozkazy ----------
function orderStop(u) { u.order = null; u.path = null; }
function orderMove(u, x, z, amove) { u.order = { type: amove ? 'amove' : 'move', x, z }; pathTo(u, x, z); }
function orderAttack(u, t, auto, resume) { u.order = { type: 'attack', target: t, auto: !!auto, resume: resume || null, ox: u.x, oz: u.z, rt: 0 }; u.path = null; }
function orderGather(u, n) { if (u.type !== 'vil') return orderMove(u, n.x, n.z); if (u.ctype !== n.def.res) u.carry = 0; u.ctype = n.def.res; u.order = { type: 'gather', node: n, phase: 'go', drop: null }; pathTo(u, n.x, n.z); }
function orderBuild(u, b) { if (u.type !== 'vil') return orderMove(u, b.x, b.z); u.order = { type: 'build', b }; pathToB(u, b); }
function orderFarm(u, b) { if (u.type !== 'vil') return; u.order = { type: 'farm', b }; b.worker = u; pathTo(u, b.x + (Math.random() - 0.5) * 2, b.z + (Math.random() - 0.5) * 2); }
const farmFree = b => !b.worker || b.worker.dead || !b.worker.order || b.worker.order.b !== b || b.worker.order.type !== 'farm';
function nearestDrop(u) {
  let best = null, bd = 1e9;
  for (const b of blds) { if (b.team !== u.team || !b.done || !b.def.drop) continue; const d = distEnt(u, b); if (d < bd) { bd = d; best = b; } }
  return best;
}
function formation(list, x, z, fn) {
  const n = list.length, side = Math.ceil(Math.sqrt(n)), sp = 1.5;
  list.forEach((u, i) => { const ox = (i % side - (side - 1) / 2) * sp, oz = (Math.floor(i / side) - (Math.ceil(n / side) - 1) / 2) * sp; fn(u, x + ox, z + oz); });
}

// ---------- boj ----------
function atkOf(u) { let a = u.def.atk; const t = teams[u.team].tech; if (u.def.cls === 'inf' || u.def.cls === 'cav') { if (t.bweap) a += 2; if (t.iron) a += 2; if (t.steel) a += 3; } return a; }
function armorOf(u) { let a = u.def.armor; const t = teams[u.team].tech; if (u.def.cls === 'inf' || u.def.cls === 'cav') { if (t.iron) a += 1; if (t.steel) a += 1; } return a; }
function hurt(t, src, base, cls, pierce, bonus) {
  if (!t || t.dead) return;
  let d = base; const tc = t.isB ? 'bld' : t.def.cls;
  if (bonus && bonus[tc]) d *= bonus[tc];
  if (t.isB) { if (cls !== 'siege') d *= (cls === 'arch' || cls === 'bld') ? 0.25 : 0.5; }
  else d = Math.max(1, d - Math.max(0, armorOf(t) - (pierce || 0)));
  t.hp -= d;
  const T = teams[t.team];
  T.hit = { x: t.x, z: t.z, time: G.time, by: src };
  if (t.team === 0) alertAttack(t);
  if (t.hp <= 0) { killEnt(t, src); return; }
  if (t.isU && src && src.isU && !src.dead && t.type !== 'vil' && (!t.order || (t.order.type === 'attack' && t.order.auto && t.order.target.isB)))
    orderAttack(t, src, true, t.order && t.order.resume);
}
function findEnemy(e, range, wantB) {
  let best = null, bd = range;
  for (const u of units) { if (u.team === e.team || u.dead) continue; const d = Math.hypot(u.x - e.x, u.z - e.z); if (d < bd) { bd = d; best = u; } }
  if (best && !(wantB === 'prefer')) return best;
  if (wantB) { let bb = null; bd = range; for (const b of blds) { if (b.team === e.team || b.dead) continue; const d = distEnt(e, b); if (d < bd) { bd = d; bb = b; } } if (bb) return bb; }
  return best;
}
const PROJ = { arrow: { sp: 28, arc: 0.12 }, shot: { sp: 80, arc: 0 }, rock: { sp: 17, arc: 0.35 }, ball: { sp: 45, arc: 0.05 } };
let projGeo;
function shoot(src, t, kind, dmg, cls, pierce, bonus) {
  if (!projGeo) projGeo = { arrow: box(0.06, 0.06, 1), shot: sph(0.08), rock: new THREE.DodecahedronGeometry(0.32, 0), ball: sph(0.22),
    mats: { arrow: new THREE.MeshBasicMaterial({ color: 0x4a3a28 }), shot: new THREE.MeshBasicMaterial({ color: 0xffe9a0 }), rock: new THREE.MeshLambertMaterial({ color: 0x8d877b }), ball: new THREE.MeshLambertMaterial({ color: 0x2a2a2e }) } };
  const sy = src.isB ? src.y + (src.type === 'tower' ? 5 : 3.6) : heightAt(src.x, src.z) + 1.5;
  const m = new THREE.Mesh(projGeo[kind], projGeo.mats[kind]); scene.add(m);
  const d = Math.hypot(t.x - src.x, t.z - src.z);
  projs.push({ m, sx: src.x, sy, sz: src.z, t, tx: t.x, tz: t.z, ty: 1, time: 0, dur: Math.max(0.08, d / PROJ[kind].sp), arc: PROJ[kind].arc * d, dmg, src, cls, pierce, bonus, kind });
  if (kind === 'shot' || kind === 'ball') { const f = src.face || 0; for (let i = 0; i < (kind === 'ball' ? 5 : 2); i++) puff(src.x + Math.sin(f) * 1.2, sy + 0.1, src.z + Math.cos(f) * 1.2, 0xdddad2, kind === 'ball' ? 0.9 : 0.45, 1.3, 0.8); }
}
function updateProjs(dt) {
  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i]; p.time += dt;
    if (p.t && !p.t.dead) { p.tx = p.t.x; p.tz = p.t.z; p.ty = (p.t.isB ? p.t.y : heightAt(p.t.x, p.t.z)) + 1; }
    const k = Math.min(1, p.time / p.dur);
    const x = lerp(p.sx, p.tx, k), z = lerp(p.sz, p.tz, k), y = lerp(p.sy, p.ty, k) + Math.sin(k * Math.PI) * p.arc;
    p.m.lookAt(x, y, z); p.m.position.set(x, y, z);
    if (k >= 1) {
      scene.remove(p.m); projs.splice(i, 1);
      hurt(p.t, p.src && !p.src.dead ? p.src : null, p.dmg, p.cls, p.pierce, p.bonus);
      if (p.kind === 'rock' || p.kind === 'ball') for (let j = 0; j < 4; j++) puff(x + (Math.random() - 0.5), y, z + (Math.random() - 0.5), 0x9a8f7c, 0.7, 0.9, 1.5);
    }
  }
}
let puffGeo;
function puff(x, y, z, color, size, life, vy) {
  if (puffs.length > 120) return;
  if (!puffGeo) puffGeo = new THREE.IcosahedronGeometry(0.5, 0);
  const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false }));
  m.position.set(x, y, z); m.scale.setScalar(size); scene.add(m);
  puffs.push({ m, life, max: life, vy, size });
}
function updatePuffs(dt) {
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i]; p.life -= dt;
    if (p.life <= 0) { scene.remove(p.m); p.m.material.dispose(); puffs.splice(i, 1); continue; }
    const k = 1 - p.life / p.max; p.m.position.y += p.vy * dt; p.m.scale.setScalar(p.size * (1 + k * 1.6)); p.m.material.opacity = 0.75 * (1 - k);
  }
}

// ---------- jednotky ----------
function gatherRate(u, n) {
  const T = teams[u.team]; let r = n.def.rate;
  if (n.type !== 'bush' && T.tech.btools) r *= 1.2;
  if (n.type === 'bush' && season() === 3) r *= 0.5;
  if (T.hungry) r *= 0.6;
  if (u.team === 1) r *= [0.8, 1, 1.3][G.diff];
  return r;
}
function farmRate(T) { let r = 0.42 * FARM_SEASON[season()]; if (T.tech.plow) r *= 1.3; if (T.tech.threefield) r *= 1.3; if (T.hungry) r *= 0.7; if (T.id === 1) r *= [0.8, 1, 1.3][G.diff]; return r; }
function toDrop(u, o) { o.drop = nearestDrop(u); if (!o.drop) { u.order = null; return; } o.phase = 'drop'; pathToB(u, o.drop); }
function nextNode(u, o) {
  const n = nearestNode(o.node.type, o.node.x, o.node.z, 30);
  if (!n) { u.order = null; u.path = null; if (u.team === 0) msg('Vesničan nemá co sbírat – ' + o.node.def.name.toLowerCase() + ' v okolí došel.'); return false; }
  o.node = n; o.phase = 'go'; pathTo(u, n.x, n.z); return true;
}
function updateUnit(u, dt) {
  u.cd -= dt; u.moving = false; u.working = false;
  const T = teams[u.team], o = u.order;
  if (!T.hungry && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + 0.2 * dt);
  if (!o) {
    if (u.type !== 'vil') { u.scan -= dt; if (u.scan <= 0) { u.scan = 0.5; const e = findEnemy(u, u.def.range ? u.def.range + 3 : 10, u.def.cls === 'siege' ? 'prefer' : true); if (e) orderAttack(u, e, true); } }
    return;
  }
  switch (o.type) {
    case 'move': if (follow(u, dt)) u.order = null; break;
    case 'amove': {
      u.scan -= dt;
      if (u.scan <= 0) { u.scan = 0.5; const e = findEnemy(u, u.def.range ? u.def.range + 3 : 10, u.def.cls === 'siege' ? 'prefer' : true); if (e) { orderAttack(u, e, true, o); break; } }
      if (!u.path) pathTo(u, o.x, o.z);
      if (follow(u, dt)) u.order = null;
      break;
    }
    case 'attack': {
      const t = o.target;
      if (!t || t.dead) { u.order = o.resume; u.path = null; break; }
      const d = distEnt(u, t), R = u.def.range || 1.35;
      if (d <= R) {
        u.path = null; faceTo(u, t); u.working = true;
        if (u.cd <= 0) {
          u.cd = u.def.cd * (T.hungry ? 1.3 : 1);
          if (u.def.proj) shoot(u, t, u.def.proj, atkOf(u), u.def.cls, u.def.pierce, u.def.bonus);
          else hurt(t, u, atkOf(u), u.def.cls, u.def.pierce, u.def.bonus);
        }
      } else {
        if (o.auto && !o.resume && Math.hypot(u.x - o.ox, u.z - o.oz) > 18) { u.order = null; u.path = null; break; }
        o.rt -= dt;
        if (!u.path || o.rt <= 0) { o.rt = 0.7 + Math.random() * 0.4; if (t.isB) pathToB(u, t); else pathTo(u, t.x, t.z); }
        follow(u, dt);
      }
      break;
    }
    case 'gather': {
      const n = o.node, cap = T.tech.wheel ? 15 : 10;
      if (o.phase === 'drop') {
        if (!o.drop || o.drop.dead) { toDrop(u, o); break; }
        const end = follow(u, dt), d = distEnt(u, o.drop);
        if (d <= 1.7 || (end && d <= 3.2)) {
          T.res[u.ctype] += u.carry; u.carry = 0;
          if (n.amt <= 0) { nextNode(u, o); break; }
          o.phase = 'go'; pathTo(u, n.x, n.z);
        } else if (end) pathToB(u, o.drop);
      } else if (o.phase === 'go') {
        if (n.amt <= 0) { if (u.carry > 0) toDrop(u, o); else nextNode(u, o); break; }
        const d = Math.hypot(u.x - n.x, u.z - n.z);
        if (d < 1.5) { o.phase = 'work'; u.path = null; break; }
        if (follow(u, dt)) { if (Math.hypot(u.x - n.x, u.z - n.z) < 3) o.phase = 'work'; else nextNode(u, o); }
      } else {
        if (n.amt <= 0) { if (u.carry >= cap * 0.5) toDrop(u, o); else nextNode(u, o); break; }
        faceTo(u, n); u.working = true;
        const take = Math.min(gatherRate(u, n) * dt, n.amt, cap - u.carry);
        u.carry += take; n.amt -= take;
        if (n.amt <= 0.001) depleteNode(n);
        if (u.carry >= cap - 0.001) toDrop(u, o);
      }
      break;
    }
    case 'build': {
      const b = o.b;
      if (!b || b.dead) { u.order = null; break; }
      if (b.done && b.hp >= b.maxHp) {
        if (b.type === 'farm' && farmFree(b)) { orderFarm(u, b); break; }
        let nb = null, bd = 40;
        for (const x of blds) if (x.team === u.team && !x.done && !x.dead) { const d = distEnt(u, x); if (d < bd) { bd = d; nb = x; } }
        if (nb) orderBuild(u, nb); else { u.order = null; u.path = null; }
        break;
      }
      const end = follow(u, dt), d = distEnt(u, b);
      if (d <= 1.7 || (end && d <= 3.2)) {
        u.path = null; faceTo(u, b); u.working = true;
        if (!b.done) { const k = dt / b.def.time; b.prog += k; b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.9 * k); b.mesh.scale.y = 0.12 + 0.88 * Math.min(1, b.prog); if (b.prog >= 1) finishBuilding(b); }
        else b.hp = Math.min(b.maxHp, b.hp + 10 * dt);
      } else if (end) pathToB(u, b);
      break;
    }
    case 'farm': {
      const b = o.b;
      if (!b || b.dead) { u.order = null; break; }
      if (b.worker !== u) { if (farmFree(b)) b.worker = u; else { u.order = null; break; } }
      if (u.path) { follow(u, dt); break; }
      const r = farmRate(T);
      if (r > 0) { T.res.food += r * dt; u.working = true; o.w = (o.w || 0) - dt; if (o.w <= 0) { o.w = 4 + Math.random() * 4; pathTo(u, b.x + (Math.random() - 0.5) * 3.6, b.z + (Math.random() - 0.5) * 3.6); } }
      break;
    }
  }
}
function separate() {
  const n = units.length;
  for (let i = 0; i < n; i++) {
    const a = units[i];
    for (let j = i + 1; j < n; j++) {
      const b = units[j], dx = b.x - a.x, dz = b.z - a.z;
      if (dx > 0.9 || dx < -0.9 || dz > 0.9 || dz < -0.9) continue;
      let d = Math.hypot(dx, dz); if (d >= 0.9) continue;
      let nx, nz; if (d < 0.01) { const an = (a.id * 2.4) % 6.28; nx = Math.cos(an); nz = Math.sin(an); d = 0.01; } else { nx = dx / d; nz = dz / d; }
      const push = (0.9 - d) * 0.25;
      const wa = a.moving && !b.moving ? 0.3 : 1, wb = b.moving && !a.moving ? 0.3 : 1;
      nudge(a, -nx * push * wa, -nz * push * wa); nudge(b, nx * push * wb, nz * push * wb);
    }
  }
}
function nudge(u, dx, dz) { const x = u.x + dx, z = u.z + dz; if (x < 0 || z < 0 || x >= WORLD || z >= WORLD) return; if (!blocked(cidx(cellOf(x), cellOf(z)))) { u.x = x; u.z = z; } }

// ---------- budovy a ekonomika ----------
function enqueue(b, kind, id) {
  const T = teams[b.team], def = kind === 'u' ? UNITS[id] : TECHS[id];
  if (b.queue.length >= 5) return 'Fronta je plná.';
  if (kind === 't' && !techAvail(T, id)) return 'Tuhle technologii teď zkoumat nejde.';
  if (kind === 'u' && !hasReq(T, def)) return 'Chybí technologie.';
  if (!afford(T, def.cost)) return 'Chybí: ' + missing(T, def.cost) + '.';
  pay(T, def.cost); if (kind === 't') T.busy[id] = true;
  b.queue.push({ kind, id, t: 0, total: def.time });
  return null;
}
function cancelQueue(b, i) { const q = b.queue[i]; if (!q) return; const T = teams[b.team]; refund(T, (q.kind === 'u' ? UNITS : TECHS)[q.id].cost); if (q.kind === 't') delete T.busy[q.id]; b.queue.splice(i, 1); }
function spawnFrom(b, type) {
  let best = null, bd = 1e9; const rx = b.rally ? b.rally.x : b.x, rz = b.rally ? b.rally.z : b.z + b.size * CS;
  for (let j = b.cy - 1; j <= b.cy + b.size; j++) for (let i = b.cx - 1; i <= b.cx + b.size; i++) {
    if (!inMap(i, j) || blocked(cidx(i, j))) continue;
    const d = Math.hypot(cellC(i) - rx, cellC(j) - rz); if (d < bd) { bd = d; best = { x: cellC(i), z: cellC(j) }; }
  }
  if (!best) { const f = nearestFree(b.cx, b.cy, 20); if (!f) return null; best = { x: cellC(f.cx), z: cellC(f.cy) }; }
  const u = addUnit(b.team, type, best.x + (Math.random() - 0.5) * 0.6, best.z + (Math.random() - 0.5) * 0.6);
  if (b.rally) { if (b.rally.node && b.rally.node.amt > 0 && type === 'vil') orderGather(u, b.rally.node); else orderMove(u, b.rally.x + (Math.random() - 0.5) * 2, b.rally.z + (Math.random() - 0.5) * 2); }
  return u;
}
function completeTech(T, id) {
  const d = TECHS[id]; T.tech[id] = true; delete T.busy[id];
  if (d.setsEra) { T.era = d.setsEra; if (T.id === 0) msg('Nová epocha: ' + ERAS[T.era] + '.', 'good'); else msg('Nepřítel vstoupil do epochy ' + ERAS[T.era] + '.', 'bad'); }
  else if (T.id === 0) msg('Vyzkoumáno: ' + d.name + '.', 'good');
  if (id === 'masonry') for (const b of blds) if (b.team === T.id) { const k = b.hp / b.maxHp; b.maxHp = Math.round(b.def.hp * 1.25); b.hp = b.maxHp * k; }
}
let popWarn = 0;
function updateBuilding(b, dt) {
  if (!b.done) return;
  const T = teams[b.team], def = b.def;
  if (def.atk) { b.cd -= dt; if (b.cd <= 0) { const t = findEnemy(b, def.range + b.size, false); if (t) { b.cd = def.cd; shoot(b, t, 'arrow', def.atk + T.era, 'bld', 0, null); } else b.cd = 0.4; } }
  const q = b.queue[0];
  if (q) {
    if (q.t < q.total) q.t += dt;
    if (q.t >= q.total) {
      if (q.kind === 't') { completeTech(T, q.id); b.queue.shift(); }
      else if (T.pop < T.cap) { spawnFrom(b, q.id); b.queue.shift(); }
      else if (b.team === 0 && G.time > popWarn) { popWarn = G.time + 20; msg('Není kde bydlet – postav další domy.', 'bad'); }
    }
  }
  if (b.type === 'smelter' && T.res.ore >= 0.5) {
    let r = 0.3 * dt * (T.tech.iron ? 1.5 : 1) * (T.tech.blast ? 2 : 1);
    r = Math.min(r, T.res.ore / 2, T.res.wood / 0.5);
    if (r > 0) { T.res.ore -= r * 2; T.res.wood -= r * 0.5; T.res.metal += r; if (Math.random() < dt * 1.5) puff(b.x + 0.5, b.y + 4, b.z - 0.3, 0x55504c, 0.6, 2.2, 1.6); }
  }
}
function knowRate(T) {
  let tc = 0, lib = 0;
  for (const b of blds) if (b.team === T.id && b.done) { if (b.type === 'tc') tc++; else if (b.type === 'library') lib++; }
  let r = 0.4 * tc + 0.4 * Math.min(lib, 4);
  if (T.tech.writing) r *= 1.2; if (T.tech.math) r *= 1.25; if (T.tech.university) r *= 1.4; if (T.tech.printing) r *= 1.5;
  return r;
}
function upkeepRate(T) { let s = 0; for (const u of units) if (u.team === T.id) s += u.def.upkeep; return s / 60 * (T.tech.pottery ? 0.85 : 1); }
function econ(T, dt) {
  let cap = 0, past = 0;
  for (const b of blds) if (b.team === T.id && b.done) { cap += b.def.pop || 0; if (b.type === 'pasture') past++; }
  T.cap = Math.min(MAXPOP, cap);
  T.res.know += knowRate(T) * dt;
  T.res.food += past * (season() === 3 ? 0.16 : 0.24) * dt;
  T.res.food -= upkeepRate(T) * dt;
  if (T.res.food <= 0) {
    T.res.food = 0;
    if (!T.hungry) { T.hungry = true; if (T.id === 0) msg('Hladomor! Zásoby jídla došly, lidé slábnou.', 'bad'); }
    T.starve += dt;
    if (T.starve > 4) { T.starve = 0; for (const u of units) if (u.team === T.id) { if (u.type === 'vil') u.hp = Math.max(6, u.hp - 3); else { u.hp -= 4; if (u.hp <= 0) killEnt(u, null); } } }
  } else if (T.hungry && T.res.food > 20) { T.hungry = false; if (T.id === 0) msg('Hlad je zažehnán.', 'good'); }
}

// ---------- protivník ----------
const AI = { acc: 0, attackAt: 0, wave: 0, launch: -999 };
const AI_TECH = ['agri', 'husbandry', 'era1', 'pottery', 'writing', 'bronze', 'wheel', 'btools', 'bweap', 'masonry', 'horses', 'era2', 'iron', 'math', 'plow', 'mechanics', 'era3', 'steel', 'threefield', 'crossbow', 'university', 'stirrups', 'era4', 'gunpowder', 'printing', 'blast', 'artillery'];
function findSpot(type, ax, ay, margin) {
  const s = BUILDINGS[type].size;
  for (let r = 3; r < 22; r++) {
    const st = Math.floor(Math.random() * 8 * r);
    for (let q = 0; q < 8 * r; q++) {
      const k = (q + st) % (8 * r), side = Math.floor(k / (2 * r)), t = k % (2 * r) - r;
      const x = ax + (side === 0 ? t : side === 1 ? r : side === 2 ? -t : -r), y = ay + (side === 0 ? -r : side === 1 ? t : side === 2 ? r : -t);
      let ok = true;
      for (let j = y - margin; j < y + s + margin && ok; j++) for (let i = x - margin; i < x + s + margin; i++) { if (!inMap(i, j)) { ok = false; break; } const c = cidx(i, j); if (!walk[c] || resv[c] || (nodeAt[c] >= 0 && i >= x && j >= y && i < x + s && j < y + s)) { ok = false; break; } }
      if (ok) return { cx: x, cy: y };
    }
  }
  return null;
}
function aiBuild(type, ax, ay) {
  const T = teams[1], def = BUILDINGS[type];
  if (!afford(T, def.cost) || !hasReq(T, def)) return false;
  const sp = findSpot(type, ax, ay, type === 'farm' ? 0 : 1); if (!sp) return false;
  pay(T, def.cost); placeBuilding(1, type, sp.cx, sp.cy, false); return true;
}
function aiTick() {
  const T = teams[1], tc = blds.find(b => b.team === 1 && b.type === 'tc' && !b.dead); if (!tc) return;
  const mine = units.filter(u => u.team === 1), vils = mine.filter(u => u.type === 'vil'), army = mine.filter(u => u.type !== 'vil');
  const my = blds.filter(b => b.team === 1 && !b.dead), cnt = t => my.reduce((a, b) => a + (b.type === t ? 1 : 0), 0);
  const winter = season() === 3, D = G.diff;
  const vilTarget = Math.min([16, 22, 28][D], 9 + T.era * 5 + Math.floor(G.time / 90));
  if (vils.length < vilTarget && !tc.queue.some(q => q.kind === 'u') && T.res.food >= 50 && (vils.length < 12 || !T.saving || T.res.food >= 50 + (T.saving.food || 0))) enqueue(tc, 'u', 'vil');
  const pending = my.some(b => !b.done);
  if (T.cap - T.pop <= 3 && T.cap < MAXPOP && !my.some(b => b.type === 'house' && !b.done)) aiBuild('house', tc.cx + 1, tc.cy + 1);
  for (const b of my) if (!b.done && !vils.some(v => v.order && v.order.type === 'build' && v.order.b === b)) {
    let bv = null, bd = 1e9; for (const v of vils) { if (v.order && v.order.type === 'build') continue; const d = distEnt(v, b); if (d < bd) { bd = d; bv = v; } }
    if (bv) orderBuild(bv, b);
  }
  // práce
  const jobs = { food: 0, wood: 0, stone: 0, ore: 0 }, idle = [];
  for (const v of vils) { const o = v.order; if (!o) idle.push(v); else if (o.type === 'gather') jobs[o.node.def.res]++; else if (o.type === 'farm') { if (winter) { orderStop(v); idle.push(v); } else jobs.food++; } }
  const f = { food: 0.42, wood: 0.36, stone: 0.1, ore: 0.12 };
  if (!T.tech.bronze) { f.ore = 0; f.wood += 0.08; f.food += 0.04; }
  if (T.tech.bronze) { f.ore = 0.2; f.wood = 0.3; f.food = 0.4; }
  const stock = { food: T.res.food, wood: T.res.wood, stone: T.res.stone * 2, ore: T.res.ore + T.res.metal * 2 };
  let fs = 0; for (const k in f) { f[k] *= clamp(350 / (stock[k] + 60), 0.2, 1.6); fs += f[k]; } for (const k in f) f[k] /= fs;
  const nV = vils.length;
  const assign = (v, k) => {
    if (k === 'food') { if (!winter) { const fm = my.find(b => b.type === 'farm' && b.done && farmFree(b)); if (fm) { orderFarm(v, fm); return 'food'; } } const n = nearestNode('bush', tc.x, tc.z, 70); if (n) { orderGather(v, n); return 'food'; } k = 'wood'; }
    const type = k === 'wood' ? 'tree' : k; const n = nearestNode(type, tc.x, tc.z, 110) || nearestNode('tree', tc.x, tc.z);
    if (n) { orderGather(v, n); return n.def.res; } return null;
  };
  const pick = () => { let bk = 'wood', bv = -1e9; for (const k in f) { if (f[k] <= 0) continue; const d = f[k] * nV - jobs[k]; if (d > bv) { bv = d; bk = k; } } return bk; };
  for (const v of idle) { const r = assign(v, pick()); if (r) jobs[r]++; }
  if (!idle.length) { // přeskupení
    let over = null, ov = 1.5; for (const k in f) { const d = jobs[k] - f[k] * nV; if (d > ov) { ov = d; over = k; } }
    const under = pick();
    if (over && under !== over && f[under] * nV - jobs[under] >= 1) { const v = vils.find(v => v.order && ((v.order.type === 'gather' && v.order.node.def.res === over && v.order.phase !== 'drop') || (over === 'food' && v.order.type === 'farm'))); if (v) assign(v, under); }
    if (!winter) { const fm = my.find(b => b.type === 'farm' && b.done && farmFree(b)); if (fm) { const v = vils.find(v => v.order && v.order.type === 'gather' && v.order.node.type === 'bush') || (jobs.food < f.food * nV + 1 && vils.find(v => v.order && v.order.type === 'gather' && v.order.node.type === 'tree')); if (v) orderFarm(v, fm); } }
  }
  // sklady u vzdálených surovin
  if (!pending && T.res.wood >= 50) for (const type of ['tree', 'stone', 'ore']) {
    if (type === 'ore' && !T.tech.bronze) continue;
    const n = nearestNode(type, tc.x, tc.z, 110); if (!n) continue;
    let d = 1e9; for (const b of my) if (b.def.drop) d = Math.min(d, distEnt(n, b));
    if (d > 13 * CS) { aiBuild('store', n.cx, n.cy); break; }
  }
  // stavby
  if (!my.some(b => !b.done && b.type !== 'house')) {
    const farmT = Math.min(10, Math.ceil(nV * 0.4));
    const wish = [['barracks', 1, G.time > 100], ['farm', farmT, T.tech.agri && !winter], ['range', 1, G.time > 240], ['pasture', 2, T.tech.husbandry], ['library', 1, T.tech.writing], ['smelter', 1, T.tech.bronze], ['smithy', 1, T.tech.bronze],
      ['library', 3, T.tech.writing && T.era >= 2], ['stable', 1, T.tech.horses && T.era >= 2], ['tower', 2, T.tech.masonry], ['smelter', 2, T.res.ore > 80], ['workshop', 1, T.tech.mechanics], ['barracks', 2, T.era >= 3]];
    for (const [type, n, cond] of wish) { if (!cond || cnt(type) >= n) continue; aiBuild(type, tc.cx + 1, tc.cy + 1); break; }
  }
  // výzkum
  const saving = T.saving; T.saving = null;
  const canSpend = cost => afford(T, cost) && (!saving || Object.keys(saving).every(k => k === 'know' || T.res[k] - (cost[k] || 0) >= saving[k]));
  for (const id of AI_TECH) {
    if (T.tech[id] || T.busy[id]) { if (T.busy[id]) break; continue; }
    if (!techAvail(T, id)) continue;
    const b = my.find(b => b.type === TECHS[id].at && b.done && b.queue.length < 2); if (!b) continue;
    if (afford(T, TECHS[id].cost)) enqueue(b, 't', id); else T.saving = TECHS[id].cost;
    break;
  }
  // vojsko
  const armyT = Math.min([18, 30, 44][D], 3 + Math.floor(G.time / 60 * [0.8, 1.2, 1.7][D]));
  if (army.length < armyT) {
    const prefs = { barracks: ['sword', 'spear'], range: ['musket', 'xbow', 'archer'], stable: ['knight', 'rider'], workshop: ['cannon', 'catapult'] };
    const siege = army.filter(u => u.def.cls === 'siege').length;
    for (const b of my) { const pl = prefs[b.type]; if (!pl || !b.done || b.queue.length) continue; if (b.type === 'workshop' && siege >= 3) continue;
      for (const id of pl) { const d = UNITS[id]; if (!hasReq(T, d)) continue; if ((army.length < armyT * 0.5 ? afford(T, d.cost) : canSpend(d.cost)) && T.res.food >= (d.cost.food || 0) + 60) { enqueue(b, 'u', id); break; } } }
  }
  // útok a obrana
  const home = { x: tc.x + (teams[0].tcx - tc.x) * 0.12, z: tc.z + (teams[0].tcz - tc.z) * 0.12 };
  const attacking = G.time - AI.launch < 200;
  if (G.time >= AI.attackAt && army.length >= Math.min(armyT * 0.7, 5 + AI.wave * 3)) {
    AI.attackAt = G.time + [260, 210, 170][D]; AI.wave++; AI.launch = G.time;
    const tgt = aiTarget(tc);
    if (tgt) { formation(army, tgt.x, tgt.z, (u, x, z) => orderMove(u, x, z, true)); msg('Zvědové hlásí: nepřátelské vojsko vyrazilo k tvé osadě!', 'bad'); }
  } else {
    const hit = T.hit && G.time - T.hit.time < 5 && Math.hypot(T.hit.x - tc.x, T.hit.z - tc.z) < 60 ? T.hit : null;
    for (const u of army) {
      if (hit && (!u.order || u.order.type !== 'attack')) { if (Math.hypot(u.x - hit.x, u.z - hit.z) > 6) orderMove(u, hit.x + (Math.random() - 0.5) * 4, hit.z + (Math.random() - 0.5) * 4, true); continue; }
      if (u.order) continue;
      if (attacking) { const t = aiTarget(u); if (t) orderMove(u, t.x, t.z, true); }
      else if (Math.hypot(u.x - home.x, u.z - home.z) > 14) orderMove(u, home.x + (Math.random() - 0.5) * 10, home.z + (Math.random() - 0.5) * 10, true);
    }
  }
}
function aiTarget(from) { let best = null, bd = 1e9; for (const b of blds) { if (b.team !== 0 || b.dead) continue; const d = Math.hypot(b.x - from.x, b.z - from.z) * (b.type === 'tc' ? 0.8 : 1); if (d < bd) { bd = d; best = b; } } return best; }

// ---------- hlavní krok ----------
function simStep(dt) {
  G.time += dt;
  for (const u of units) if (!u.dead) updateUnit(u, dt);
  separate();
  for (const b of blds) if (!b.dead) updateBuilding(b, dt);
  updateProjs(dt);
  for (const T of teams) econ(T, dt);
  AI.acc += dt; if (AI.acc >= 1) { AI.acc = 0; aiTick(); }
  for (let i = units.length - 1; i >= 0; i--) if (units[i].dead) units.splice(i, 1);
  for (let i = blds.length - 1; i >= 0; i--) if (blds[i].dead) blds.splice(i, 1);
}
function endGame(win) { if (G.over) return; G.over = true; G.paused = true; showEnd(win); }

function newGame(diff) {
  G.diff = diff; AI.attackAt = [600, 450, 330][diff];
  teams.push(mkTeam(0), mkTeam(1));
  makeWorld(); buildTerrain(); buildNodes();
  STARTS.forEach((s, t) => {
    const b = placeBuilding(t, 'tc', s.cx, s.cy, true);
    teams[t].tcx = b.x; teams[t].tcz = b.z;
    for (let i = 0; i < 5; i++) addUnit(t, 'vil', b.x - 4 + i * 2, b.z + 5 + (i % 2));
  });
  terrain.geometry.computeVertexNormals(); terrainDirty = false;
  for (const T of teams) econ(T, 0);
}
