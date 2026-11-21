'use strict';
// Věk pokroku 1.10 – Nový vzhled: animovaná voda, tráva a květiny v krajině.
// Jen grafika: nemění pravidla, průchodnost ani uložení. Úsporná kvalita kreslí méně trávy.
const LOOK = { grass: null, flowers: null, spots: [], acc: 0, waterTex: null, t: 0 };

// Normálová mapa vln z šumu (vygeneruje se jednou, bez stahování souborů).
function lookWaterNormals() {
  if (LOOK.waterTex) return LOOK.waterTex;
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), img = x.createImageData(S, S), h = new Float32Array(S * S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++)
    h[j * S + i] = Math.sin((i / S) * Math.PI * 6 + Math.sin((j / S) * Math.PI * 4) * 1.3) * 0.5 + Math.sin(((i + j) / S) * Math.PI * 10) * 0.25 + (hash2(i, j, 21) - 0.5) * 0.18;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const dx = h[j * S + ((i + 1) % S)] - h[j * S + ((i + S - 1) % S)], dy = h[((j + 1) % S) * S + i] - h[((j + S - 1) % S) * S + i], k = (j * S + i) * 4;
    img.data[k] = 128 + dx * 70; img.data[k + 1] = 128 + dy * 70; img.data[k + 2] = 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 40);
  return LOOK.waterTex = t;
}
function lookWater() {
  if (!waterMesh) return;
  const m = waterMesh.material;
  m.color.setHex(G.real ? 0x1f4f6a : 0x2f6c8c); m.specular.setHex(0xd8eaf2); m.shininess = 110; m.opacity = G.real ? 0.84 : 0.86;
  m.normalMap = lookWaterNormals(); m.normalScale = new THREE.Vector2(0.55, 0.55); m.needsUpdate = true;
}
// Trs trávy: tři úzká stébla. Květina: stonek a kvítek. Obojí v jediné instanci na typ.
function lookTuftGeo() {
  const p = [];
  for (const [x, z, h, r, c] of [[0, 0, 0.55, 0.09, 0x5f8f3e], [0.12, 0.05, 0.42, 0.08, 0x6f9d48], [-0.1, 0.08, 0.48, 0.08, 0x557f37], [0.04, -0.12, 0.38, 0.07, 0x7aa752]])
    p.push(P(cone(r, h, 3), c, x, h / 2, z, (hash2(x * 10, z * 10, 3) - 0.5) * 0.5, 0, (x - z) * 1.6));
  return merge(p);
}
function lookFlowerGeo() {
  return merge([P(cone(0.02, 0.36, 3), 0x5f8f3e, 0, 0.18, 0), P(cone(0.02, 0.3, 3), 0x5f8f3e, 0.1, 0.15, 0.05, 0, 0, -0.3),
    P(blob(0.08), 0xffffff, 0, 0.38, 0), P(blob(0.065), 0xffffff, 0.15, 0.31, 0.05)]);
}
function lookBuild() {
  LOOK.grass = LOOK.flowers = null; LOOK.spots = []; LOOK.acc = 0;
  lookWater();
  const q = typeof cityArtQuality === 'function' ? cityArtQuality() : 'high';
  const want = q === 'low' ? 1200 : 4200, wantF = q === 'low' ? 240 : 1000;
  const cells = [];
  for (let cy = 1; cy < N - 1; cy++) for (let cx = 1; cx < N - 1; cx++) {
    const i = cidx(cx, cy), h = cellH(cx, cy);
    if (!walk[i] || bridgeMask[i] || h < 0.55 || h > 5.8) continue;
    cells.push(i);
  }
  if (!cells.length) return;
  const mk = (geo, count, flowers) => {
    const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), count);
    m.receiveShadow = true; m.castShadow = false; m.frustumCulled = false; m.userData.look = true;
    const c = new THREE.Color(), pal = [0xf6f1e4, 0xf2d04a, 0xb57bd6, 0xe7795b, 0x8fb6f0];
    for (let k = 0; k < count; k++) {
      const cell = cells[Math.floor(hash2(k, flowers ? 77 : 13, G.seed || 1) * cells.length)];
      const x = cellC(cell % N) + (hash2(k, 5, 31) - 0.5) * CS, z = cellC(Math.floor(cell / N)) + (hash2(k, 9, 41) - 0.5) * CS;
      LOOK.spots.push({ m, k, cell, x, z, s: 0.7 + hash2(k, 3, 55) * 0.7, r: hash2(k, 4, 66) * 6.28, on: -1 });
      if (flowers) c.setHex(pal[Math.floor(hash2(k, 8, 17) * pal.length)]); else c.setRGB(0.85 + hash2(k, 1, 2) * 0.3, 0.9 + hash2(k, 2, 3) * 0.2, 0.8 + hash2(k, 3, 4) * 0.2);
      m.setColorAt(k, c);
    }
    m.instanceColor.needsUpdate = true; scene.add(m); return m;
  };
  LOOK.grass = mk(lookTuftGeo(), want, false);
  LOOK.flowers = mk(lookFlowerGeo(), wantF, true);
  lookRefresh(true);
}
// Tráva mizí pod stavbami, poli a v neviditelné části mapy; obnovuje se jednou za chvíli.
function lookRefresh(force) {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let changed = false;
  for (const sp of LOOK.spots) {
    const on = !resv[sp.cell] && !occ[sp.cell] && !!explored[sp.cell] && nodeAt[sp.cell] < 0 ? 1 : 0;
    if (!force && on === sp.on) continue;
    sp.on = on; changed = true;
    q.setFromAxisAngle(up, sp.r); const k = on ? sp.s : 0.0001;
    m4.compose(v.set(sp.x, heightAt(sp.x, sp.z) - 0.03, sp.z), q, s.set(k, k * (0.8 + (sp.s - 0.7)), k));
    sp.m.setMatrixAt(sp.k, m4);
  }
  if (changed) for (const m of [LOOK.grass, LOOK.flowers]) if (m) m.instanceMatrix.needsUpdate = true;
}
function lookFrame(dt) {
  LOOK.t += dt;
  if (LOOK.waterTex) { LOOK.waterTex.offset.x = LOOK.t * 0.012; LOOK.waterTex.offset.y = Math.sin(LOOK.t * 0.21) * 0.03 + LOOK.t * 0.006; }
  LOOK.acc += dt;
  if (LOOK.acc > 1.2 && LOOK.spots.length) { LOOK.acc = 0; lookRefresh(false); }
}
