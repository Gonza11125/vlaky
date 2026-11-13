'use strict';
// Den a noc, roční období (sníh, podzimní listí, zamrzlá voda), počasí a pouliční osvětlení.

const ATM = {
  t: 0.38, cycle: 360, mode: 1, L: 1, n: 0, snow: 0, autumn: 0, cloud: 0, weather: 'jasno',
  uni: { uSnow: { value: 0 }, uAutumn: { value: 0 } }, envBase: new Map(), lampsDirty: true, lampT: 0,
  lampB: null, poolB: null, stars: null, snowP: null, rainP: null, ready: false,
};
try { const v = localStorage.getItem('starosta-daynight'); if (v != null) ATM.mode = +v; } catch (_) { }
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
const SKY = { dayTop: 0x3f78b8, dayHor: 0xd2dde3, setTop: 0x52709e, setHor: 0xeeaa72, nightTop: 0x050b17, nightHor: 0x18233a, cloudTop: 0x7f8b97, cloudHor: 0xb7bec4, gnd: 0x8f9a86, nightGnd: 0x1a1e24 };

// ---------- shader: sníh na plochách obrácených vzhůru, podzimní barva listí ----------
function patchSeason(m, kind) {
  if (!m || m.userData.season) return; m.userData.season = kind;
  m.onBeforeCompile = sh => {
    sh.uniforms.uSnow = ATM.uni.uSnow; sh.uniforms.uAutumn = ATM.uni.uAutumn;
    const leaf = kind === 'leaf' ? 'float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.45, 0.16, 0.025) * (0.55 + 3.0 * lum), uAutumn * 0.75); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.09, 0.075, 0.06), uSnow * 0.45);' : '';
    const lo = kind === 'roof' ? '0.3, 0.65' : kind === 'leaf' ? '0.2, 0.75' : '0.55, 0.85', k = kind === 'asph' ? '0.18' : kind === 'leaf' ? '0.8' : '1.0';
    sh.fragmentShader = 'uniform float uSnow; uniform float uAutumn;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n{ vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz); float up = dot(normal, upV); ' + leaf +
      ' float sn = uSnow * smoothstep(' + lo + ', up) * ' + k + '; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.83, 0.86, 0.9), sn); }');
  };
  m.customProgramCacheKey = () => 'season-' + kind;
  m.needsUpdate = true;
}
// mapa rozsvícených oken podle mapy drsnosti (okna jsou v ní tmavá)
function litMap(src, cw, ch, seed, prob, dim) {
  const s = src.width, c = cnv(s), x = c.getContext('2d'), d0 = src.getContext('2d').getImageData(0, 0, s, s).data, img = x.createImageData(s, s), d = img.data;
  const cols = Math.ceil(s / cw), rows = Math.ceil(s / ch), on = [], tint = [];
  for (let i = 0; i < cols * rows; i++) { on.push(hash2(i, seed, 7) < prob); const t = hash2(i, seed, 9), b = dim * (0.55 + 0.45 * hash2(i, seed, 11)); const c = t < 0.7 ? [255, 196, 120] : t < 0.88 ? [255, 226, 175] : [150, 180, 255]; tint.push(c.map(v => v * b)); }
  for (let y = 0; y < s; y++) for (let xx = 0; xx < s; xx++) { const i = (y * s + xx) * 4, cell = ((y / ch) | 0) * cols + ((xx / cw) | 0);
    if (d0[i] < 90 && on[cell]) { const T = tint[cell]; d[i] = T[0]; d[i + 1] = T[1]; d[i + 2] = T[2]; } d[i + 3] = 255; }
  x.putImageData(img, 0, 0); return tex(c, true);
}
function initAtmo() {
  const T = RS.tex;
  // svítící okna v noci
  const win = [[MK.res, T.res.roughnessMap, 256, 256, 0.5, 0.8], [MK.stone, T.stone.roughnessMap, 256, 256, 0.45, 0.8], [MK.panel, T.panel.roughnessMap, 256, 256, 0.5, 0.75], [MK.office, T.office.roughnessMap, 64, 128, 0.3, 0.5], [MK.shop, T.shop.roughnessMap, 128, 256, 0.85, 0.9]];
  for (const [mk, rm, cw, ch, pr, dm] of win) { if (!rm || !rm.image || !rm.image.getContext) continue; const m = MATS[mk]; m.emissiveMap = litMap(rm.image, cw, ch, mk * 13, pr, dm); m.emissive = new THREE.Color(1, 1, 1); m.emissiveIntensity = 0; m.needsUpdate = true; }
  // roční období
  const kinds = { lawn: 'ground', field: 'ground', soil: 'ground', pave: 'ground', plain: 'hard', stone: 'hard', brick: 'hard', res: 'hard', panel: 'hard', office: 'hard', shop: 'hard', metal: 'roof', roof: 'roof', tile: 'roof', wood: 'roof', leaf: 'leaf', asphalt: 'asph' };
  for (const k in kinds) patchSeason(MATS[MK[k]], kinds[k]);
  patchSeason(terrMat, 'ground'); if (RS.outerMat) patchSeason(RS.outerMat, 'ground');
  for (const m of MATS) if (m) ATM.envBase.set(m, m.envMapIntensity);
  ATM.envBase.set(terrMat, terrMat.envMapIntensity);
  // lampy: žárovka a světelný kruh na zemi
  const g = cnv(128), gx = g.getContext('2d'), rg = gx.createRadialGradient(64, 64, 2, 64, 64, 64); rg.addColorStop(0, 'rgba(255,214,150,1)'); rg.addColorStop(0.35, 'rgba(255,190,110,0.45)'); rg.addColorStop(1, 'rgba(255,170,90,0)'); gx.fillStyle = rg; gx.fillRect(0, 0, 128, 128);
  const pg = new THREE.PlaneGeometry(6, 6); pg.rotateX(-Math.PI / 2);
  ATM.poolB = new Batch(pg, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(g), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 }), { cap: 256, shadow: false, layer: 1 });
  ATM.lampB = new Batch(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe2a8, toneMapped: false, transparent: true, opacity: 0 }), { cap: 256, shadow: false, layer: 1 });
  ATM.poolB.mesh.renderOrder = 2;
  // hvězdy
  { const n = 900, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, z = 0.08 + Math.random() * 0.92, r = Math.sqrt(1 - z * z); p[i * 3] = Math.cos(a) * r * 900; p[i * 3 + 1] = z * 900; p[i * 3 + 2] = Math.sin(a) * r * 900; }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(p, 3));
    ATM.stars = new THREE.Points(gg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    ATM.stars.frustumCulled = false; ATM.stars.layers.set(1); ATM.stars.renderOrder = -1; scene.add(ATM.stars); }
  // sníh a déšť kolem kamery
  { const n = RS.coarse ? 1400 : 3000, p = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) p[i] = Math.random();
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); gg.userData.seed = p;
    ATM.snowP = new THREE.Points(gg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false }));
    ATM.snowP.frustumCulled = false; ATM.snowP.layers.set(1); ATM.snowP.visible = false; scene.add(ATM.snowP); }
  { const n = RS.coarse ? 900 : 2000, p = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) p[i] = Math.random();
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3)); gg.userData.seed = p;
    ATM.rainP = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0xaebfcc, transparent: true, opacity: 0.45, depthWrite: false }));
    ATM.rainP.frustumCulled = false; ATM.rainP.layers.set(1); ATM.rainP.visible = false; scene.add(ATM.rainP); }
  ATM.ready = true;
}
function setDayMode(m) { ATM.mode = m; try { localStorage.setItem('starosta-daynight', String(m)); } catch (_) { } }
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// roční období z data ve hře (plynule)
function seasonNow() {
  if (!S || S.day == null) return { snow: 0, autumn: 0, mc: 6 };
  const mc = (S.day % 360) / 30;
  const snow = clamp(Math.cos((mc - 0.5) / 12 * Math.PI * 2) * 1.6 - 0.55, 0, 1), autumn = clamp(1 - Math.abs(mc - 9.8) / 1.6, 0, 1);
  return { snow, autumn, mc };
}
function weatherNow() {
  if (!S || S.day == null) return 'jasno';
  const s = seasonNow(), h = hash2(S.day, W.seed || 1, 33), h2 = hash2(S.day - 1, W.seed || 1, 33);
  if (S.storm > 0) return 'bouřka';
  if (s.snow > 0.3) return h < 0.4 ? 'sněží' : h < 0.65 ? 'zataženo' : 'jasno';
  const wet = s.mc >= 2 && s.mc < 5 || s.mc >= 8.5 ? 0.26 : 0.14;
  return h < wet ? (h2 < wet && h < wet * 0.35 ? 'bouřka' : 'prší') : h < wet + 0.2 ? 'zataženo' : 'jasno';
}
function lampSpots() {
  const out = [];
  for (let k = 0; k < NN; k++) {
    const rt = road[k]; if (!rt || ter[k] === 1 || rail[k]) continue; const x = k % N, y = (k / N) | 0, m = roadMask(x, y), wx = tileX(x), wz = tileZ(y); if (m !== 5 && m !== 10) continue; const v = m === 5;
    if (rt === 1) out.push(v ? [wx - 1.5, 2.3, wz + 0.5] : [wx + 0.5, 2.3, wz - 1.5]);
    else if (rt === 3) { out.push(v ? [wx - 1.4, 2.5, wz + 0.6] : [wx + 0.6, 2.5, wz - 2.0]); out.push(v ? [wx + 1.4, 2.5, wz - 0.6] : [wx - 0.6, 2.5, wz + 2.0]); }
    else if (rt === 6) out.push(v ? [wx + 1.2, 2.5, wz + 0.8] : [wx + 0.8, 2.5, wz + 1.8]);
    else if (rt === 4 && (x + y) % 2) out.push(v ? [wx - 1.7, 2.9, wz] : [wx, 2.9, wz - 1.7]);
  }
  return out;
}
function rebuildLamps() {
  ATM.lampB.clear(); ATM.poolB.clear();
  for (const p of lampSpots()) { ATM.lampB.add({}, mtx(p[0], p[1], p[2])); ATM.poolB.add({}, mtx(p[0], 0.06, p[2])); }
  ATM.lampsDirty = false;
}
function updateAtmo(dt, t) {
  if (!ATM.ready) return;
  if (G.playing && G.speed) ATM.t = (ATM.t + dt / ATM.cycle) % 1;
  const tt = ATM.mode === 0 ? 0.42 : ATM.mode === 2 ? 0.02 : (G.playing ? ATM.t : 0.42);
  // slunce: den od 0,2 do 0,8 cyklu
  const day = tt >= 0.2 && tt < 0.8, el = day ? Math.sin(Math.PI * (tt - 0.2) / 0.6) : -Math.sin(Math.PI * (((tt - 0.8) + 1) % 1) / 0.4);
  const L = sstep(-0.12, 0.22, el), n = 1 - L, warm = day ? clamp(1 - el / 0.35, 0, 1) * L : 0;
  ATM.L = L; ATM.n = n;
  const az = day ? Math.PI * (tt - 0.2) / 0.6 : 1.2, a = day ? 0.2 + 0.85 * Math.max(0, el) : 0.95;
  RS.sunDir.set(Math.cos(az) * Math.cos(a), Math.sin(a), 0.35 + Math.sin(az) * Math.cos(a) * 0.6).normalize();
  // počasí a období
  const ss = seasonNow(); ATM.snow = ss.snow; ATM.autumn = ss.autumn; ATM.weather = weatherNow();
  const cloudT = ATM.weather === 'bouřka' ? 0.85 : ATM.weather === 'prší' || ATM.weather === 'sněží' ? 0.65 : ATM.weather === 'zataženo' ? 0.45 : 0;
  ATM.cloud += (cloudT - ATM.cloud) * Math.min(1, dt * 0.5);
  const cl = ATM.cloud;
  ATM.uni.uSnow.value = ss.snow; ATM.uni.uAutumn.value = ss.autumn;
  // světla
  sun.color.setHex(0xfff0dc).lerp(_c1.setHex(0xffa860), warm * 0.8).lerp(_c2.setHex(0x9fb4ff), n);
  sun.intensity = (1.9 * L + 0.16 * n) * (1 - cl * 0.55);
  hemi.intensity = (RS.env ? 0.25 : 0.55) * (0.22 + 0.78 * L) * (1 + cl * 0.6);
  hemi.color.setHex(0xdfe9f2).lerp(_c1.setHex(0x5a6c94), n);
  renderer.toneMappingExposure = 0.82 + 0.1 * n;
  const u = skyMesh.material.uniforms;
  u.top.value.setHex(SKY.dayTop).lerp(_c1.setHex(SKY.setTop), warm).lerp(_c2.setHex(SKY.cloudTop), cl * L).lerp(_c1.setHex(SKY.nightTop), n);
  u.hor.value.setHex(SKY.dayHor).lerp(_c1.setHex(SKY.setHor), warm).lerp(_c2.setHex(SKY.cloudHor), cl * L).lerp(_c1.setHex(SKY.nightHor), n);
  u.gnd.value.setHex(SKY.gnd).lerp(_c1.setHex(SKY.nightGnd), n);
  if (scene.fog) scene.fog.color.copy(u.hor.value);
  const ef = 0.12 + 0.88 * L;
  for (const [m, b] of ATM.envBase) m.envMapIntensity = b * ef;
  // okna, lampy, hvězdy
  const wi = sstep(0.15, 0.7, n) * 0.95;
  for (const mk of [MK.res, MK.stone, MK.panel, MK.office, MK.shop]) if (MATS[mk].emissiveMap) MATS[mk].emissiveIntensity = wi * (mk === MK.office ? 0.8 : 1);
  ATM.lampT -= dt; if (ATM.lampsDirty && ATM.lampT <= 0) { ATM.lampT = 2; rebuildLamps(); }
  const lo = sstep(0.25, 0.65, n);
  ATM.lampB.mesh.material.opacity = lo; ATM.poolB.mesh.material.opacity = lo * 0.7;
  ATM.lampB.mesh.visible = ATM.poolB.mesh.visible = lo > 0.02 && ATM.lampB.n > 0;
  ATM.stars.material.opacity = sstep(0.55, 0.95, n) * (1 - cl); ATM.stars.visible = ATM.stars.material.opacity > 0.02; ATM.stars.position.copy(camera.position);
  // zamrzlá voda
  waterMesh.material.color.setHex(0x2f5566).lerp(_c1.setHex(0xaab8c0), ss.snow > 0.75 ? (ss.snow - 0.75) * 2.4 : 0).convertSRGBToLinear();
  waterMesh.material.roughness = 0.05 + (ss.snow > 0.75 ? (ss.snow - 0.75) * 2 : 0);
  // srážky
  const span = clamp(cam.dist * 1.6, 60, 320), cx = cam.x, cz = cam.z;
  const snowing = G.playing && ATM.weather === 'sněží', raining = G.playing && (ATM.weather === 'prší' || ATM.weather === 'bouřka');
  ATM.snowP.visible = snowing; ATM.rainP.visible = raining;
  if (snowing) { const pa = ATM.snowP.geometry.attributes.position, sd = ATM.snowP.geometry.userData.seed, H = span * 0.6;
    for (let i = 0; i < pa.count; i++) { const fy = ((sd[i * 3 + 1] - t * (0.04 + sd[i * 3 + 2] * 0.03) * 60 / H) % 1 + 1) % 1;
      pa.array[i * 3] = cx + (sd[i * 3] - 0.5) * span + Math.sin(t * 0.8 + i) * 1.2; pa.array[i * 3 + 1] = fy * H; pa.array[i * 3 + 2] = cz + (sd[i * 3 + 2] - 0.5) * span; }
    pa.needsUpdate = true; }
  if (raining) { const pa = ATM.rainP.geometry.attributes.position, sd = ATM.rainP.geometry.userData.seed, H = span * 0.6, n2 = sd.length / 3;
    for (let i = 0; i < n2; i++) { const fy = ((sd[i * 3 + 1] - t * (1.6 + sd[i * 3 + 2]) * 60 / H) % 1 + 1) % 1, x = cx + (sd[i * 3] - 0.5) * span, z = cz + (sd[i * 3 + 2] - 0.5) * span, y = fy * H;
      pa.array[i * 6] = x; pa.array[i * 6 + 1] = y; pa.array[i * 6 + 2] = z; pa.array[i * 6 + 3] = x - 0.3; pa.array[i * 6 + 4] = y - 2.2; pa.array[i * 6 + 5] = z; }
    pa.needsUpdate = true; ATM.rainP.material.opacity = ATM.weather === 'bouřka' ? 0.6 : 0.42; }
  // silvestrovský ohňostroj nad městem
  const md = S && S.day != null ? S.day % 360 : 100;
  if (G.playing && G.speed && n > 0.5 && (md >= 357 || md <= 1) && T.pop > 300 && Math.random() < dt * 1.6) firework();
  updateFireworks(dt);
  // blesk při bouřce
  if (ATM.weather === 'bouřka' && G.playing && Math.random() < dt * 0.12) { ATM.flash = 0.25; if (typeof sfx === 'function') sfx('thunder'); }
  if (ATM.flash > 0) { ATM.flash -= dt; hemi.intensity += 2.5 * Math.max(0, ATM.flash) * 4; }
}
const TIME_NAMES = ['noc', 'svítání', 'ráno', 'poledne', 'odpoledne', 'večer', 'noc'];
function timeName() { const t = ATM.mode === 0 ? 0.42 : ATM.mode === 2 ? 0.02 : ATM.t; return t < 0.17 ? 'noc' : t < 0.25 ? 'svítání' : t < 0.42 ? 'ráno' : t < 0.58 ? 'poledne' : t < 0.75 ? 'odpoledne' : t < 0.85 ? 'večer' : 'noc'; }

// ---------- ohňostroj ----------
const FW = { b: null, p: [] };
function firework() {
  if (!FW.b) FW.b = new Batch(new THREE.SphereGeometry(0.28, 6, 4), new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), { cap: 512, shadow: false, layer: 1 });
  if (FW.p.length > 420) return;
  const x = cam.x + (Math.random() - 0.5) * cam.dist * 0.7, z = cam.z + (Math.random() - 0.5) * cam.dist * 0.7, y = 26 + Math.random() * 22;
  const cols = [[3, 0.6, 0.4], [0.5, 1.6, 3], [3, 2.4, 0.5], [0.8, 3, 0.8], [3, 0.8, 2.6], [3, 3, 3]], c = cols[(Math.random() * cols.length) | 0];
  for (let i = 0; i < 34; i++) { const a = Math.random() * 6.283, e = Math.acos(2 * Math.random() - 1), sp = 7 + Math.random() * 4;
    const h = FW.b.add({}, mtx(x, y, z), _col2.setRGB(c[0], c[1], c[2])); FW.p.push({ h, x, y, z, vx: Math.cos(a) * Math.sin(e) * sp, vy: Math.cos(e) * sp, vz: Math.sin(a) * Math.sin(e) * sp, life: 1.6 + Math.random() * 0.6, max: 2.2 }); }
  sfx('firework', x, z);
}
function updateFireworks(dt) {
  if (!FW.b) return;
  for (let i = FW.p.length - 1; i >= 0; i--) { const q = FW.p[i]; q.life -= dt; if (q.life <= 0) { FW.b.remove(q.h); FW.p.splice(i, 1); continue; }
    q.vy -= 6 * dt; q.vx *= 0.985; q.vz *= 0.985; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; FW.b.set(q.h, mtx(q.x, q.y, q.z, 0, Math.max(0.05, q.life / q.max))); }
}
