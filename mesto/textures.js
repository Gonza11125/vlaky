'use strict';
// Realistické materiály: textury fasád, střech, asfaltu, trávy a vody kreslené v prohlížeči.

const MK = { plain: 0, res: 1, office: 2, panel: 3, brick: 4, tile: 5, metal: 6, shop: 7, roof: 8, asphalt: 9, leaf: 10, glass: 11, paint: 12, lawn: 13, water: 14, stone: 15 };
// měřítko UV: [šířka jednoho opakování, výška] ve světových jednotkách
const MUV = { plain: [6, 6], res: [1.6, 1.25], office: [1.5, 1.1], panel: [1.75, 1.15], brick: [2.4, 2.4], tile: [1.4, 0.9], metal: [1.2, 3], shop: [2.2, 1.6], roof: [3, 3], asphalt: [4, 4], leaf: [1.2, 1.2], glass: [4, 4], paint: [4, 4], lawn: [4, 4], water: [3, 3], stone: [1.6, 1.25] };
const MKN = Object.keys(MK);
const FACADE = new Set([MK.res, MK.office, MK.panel, MK.brick, MK.shop, MK.stone]);

function cnv(s) { const c = document.createElement('canvas'); c.width = c.height = s; return c; }
let _rs = 7; const rr = () => { _rs = (_rs * 16807) % 2147483647; return (_rs - 1) / 2147483646; };
function noiseFill(x, s, base, amp, cell) {
  const img = x.getImageData(0, 0, s, s), d = img.data;
  for (let i = 0; i < s * s; i++) { const px = i % s, py = (i / s) | 0, n = (rr() - 0.5) * amp + (cell ? (hash2((px / cell) | 0, (py / cell) | 0, 3) - 0.5) * amp * 0.8 : 0); for (let c = 0; c < 3; c++) d[i * 4 + c] = clamp(d[i * 4 + c] + n, 0, 255); }
  x.putImageData(img, 0, 0);
}
// výšková mapa -> normálová mapa
function normalOf(src, str) {
  const s = src.width, x = src.getContext('2d'), h = x.getImageData(0, 0, s, s).data, out = cnv(s), ox = out.getContext('2d'), img = ox.createImageData(s, s), d = img.data;
  const H = (px, py) => h[(((py + s) % s) * s + ((px + s) % s)) * 4] / 255;
  for (let py = 0; py < s; py++) for (let px = 0; px < s; px++) {
    const dx = (H(px + 1, py) - H(px - 1, py)) * str, dy = (H(px, py + 1) - H(px, py - 1)) * str, l = Math.hypot(dx, dy, 1), i = (py * s + px) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ox.putImageData(img, 0, 0); return out;
}
function tex(c, srgb) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.encoding = THREE.sRGBEncoding; return t; }
function grad(x, x0, y0, x1, y1, stops) { const g = x.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }

// okno: rám, sklo s odleskem, parapet; zároveň kreslí do mapy drsnosti
function windowAt(x, rx, X, Y, W, H, glassTop, glassBot) {
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(X - 3, Y - 3, W + 6, H + 8);
  x.fillStyle = '#f4f3ef'; x.fillRect(X - 5, Y - 5, W + 10, H + 10);
  x.fillStyle = grad(x, X, Y, X + W * 0.4, Y + H, [[0, glassTop], [0.55, glassBot], [1, glassBot]]); x.fillRect(X, Y, W, H);
  x.fillStyle = 'rgba(255,255,255,0.18)'; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + W * 0.55, Y); x.lineTo(X, Y + H * 0.6); x.closePath(); x.fill();
  x.fillStyle = '#eceae4'; x.fillRect(X + W / 2 - 3, Y, 6, H); x.fillRect(X, Y + H * 0.38 - 3, W, 6);
  x.fillStyle = '#d9d6cf'; x.fillRect(X - 9, Y + H + 4, W + 18, 8);
  if (rx) { rx.fillStyle = '#2a2a2a'; rx.fillRect(X, Y, W, H); }
}
function makeTextures() {
  const T = {};
  // omítka s okny (bydlení)
  { const s = 256, c = cnv(s), x = c.getContext('2d'), r = cnv(s), rx = r.getContext('2d');
    x.fillStyle = '#ecebe6'; x.fillRect(0, 0, s, s); noiseFill(x, s, 0, 10, 0); rx.fillStyle = '#e6e6e6'; rx.fillRect(0, 0, s, s);
    windowAt(x, rx, 70, 58, 116, 128, '#7d93a6', '#2b3846');
    T.res = { map: tex(c, true), roughnessMap: tex(r) }; }
  // kámen a světlá omítka veřejných budov
  { const s = 256, c = cnv(s), x = c.getContext('2d'), r = cnv(s), rx = r.getContext('2d');
    x.fillStyle = '#efeadf'; x.fillRect(0, 0, s, s); noiseFill(x, s, 0, 12, 4); x.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 0; y < s; y += 32) x.fillRect(0, y, s, 2);
    rx.fillStyle = '#e0e0e0'; rx.fillRect(0, 0, s, s); windowAt(x, rx, 78, 40, 100, 160, '#8a9eb0', '#2a3644');
    T.stone = { map: tex(c, true), roughnessMap: tex(r) }; }
  // prosklená fasáda kanceláří
  { const s = 256, c = cnv(s), x = c.getContext('2d'), r = cnv(s), rx = r.getContext('2d');
    x.fillStyle = grad(x, 0, 0, 0, s, [[0, '#a9bfd0'], [0.5, '#6f8ca5'], [1, '#4b6680']]); x.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(255,255,255,' + (rr() * 0.08) + ')'; x.fillRect(rr() * s, rr() * s * 0.8, 20 + rr() * 80, 6 + rr() * 20); }
    x.fillStyle = '#39424d'; x.fillRect(0, s - 46, s, 46); x.fillStyle = '#2b3138'; x.fillRect(0, 0, 6, s); x.fillRect(s / 2 - 3, 0, 6, s - 46); x.fillRect(0, s - 48, s, 4);
    rx.fillStyle = '#141414'; rx.fillRect(0, 0, s, s); rx.fillStyle = '#909090'; rx.fillRect(0, s - 46, s, 46);
    T.office = { map: tex(c, true), roughnessMap: tex(r) }; }
  // panelový dům
  { const s = 256, c = cnv(s), x = c.getContext('2d'), r = cnv(s), rx = r.getContext('2d'), h = cnv(s), hx = h.getContext('2d');
    x.fillStyle = '#e4e2dc'; x.fillRect(0, 0, s, s); noiseFill(x, s, 0, 14, 0); rx.fillStyle = '#ececec'; rx.fillRect(0, 0, s, s);
    hx.fillStyle = '#fff'; hx.fillRect(0, 0, s, s); hx.fillStyle = '#000'; hx.fillRect(0, 0, s, 4); hx.fillRect(0, 0, 4, s);
    x.fillStyle = 'rgba(60,60,60,0.45)'; x.fillRect(0, 0, s, 3); x.fillRect(0, 0, 3, s);
    windowAt(x, rx, 52, 70, 152, 100, '#7a8fa2', '#2c3846');
    T.panel = { map: tex(c, true), roughnessMap: tex(r), normalMap: tex(normalOf(h, 3)) }; }
  // cihly
  { const s = 256, c = cnv(s), x = c.getContext('2d'), h = cnv(s), hx = h.getContext('2d');
    x.fillStyle = '#d8d2c8'; x.fillRect(0, 0, s, s); hx.fillStyle = '#000'; hx.fillRect(0, 0, s, s);
    for (let row = 0; row < 16; row++) for (let col = -1; col < 9; col++) { const bx = col * 32 + (row % 2) * 16, by = row * 16, v = 175 + rr() * 60;
      x.fillStyle = 'rgb(' + v + ',' + (v * 0.92) + ',' + (v * 0.86) + ')'; x.fillRect(bx + 1, by + 1, 30, 14); hx.fillStyle = '#fff'; hx.fillRect(bx + 1, by + 1, 30, 14); }
    noiseFill(x, s, 0, 18, 0); T.brick = { map: tex(c, true), normalMap: tex(normalOf(h, 2.5)) }; }
  // pálené tašky
  { const s = 256, c = cnv(s), x = c.getContext('2d'), h = cnv(s), hx = h.getContext('2d');
    for (let row = 0; row < 8; row++) for (let col = -1; col < 9; col++) { const bx = col * 32 + (row % 2) * 16, by = row * 32;
      const g = grad(x, 0, by, 0, by + 32, [[0, '#f2efe9'], [0.8, '#c9c4bb'], [1, '#8c867c']]); x.fillStyle = g; x.fillRect(bx, by, 32, 32);
      const gh = grad(hx, 0, by, 0, by + 32, [[0, '#ffffff'], [0.85, '#888'], [1, '#000']]); hx.fillStyle = gh; hx.fillRect(bx, by, 32, 32);
      x.fillStyle = 'rgba(0,0,0,0.2)'; x.fillRect(bx, by, 2, 32); }
    noiseFill(x, s, 0, 14, 0); T.tile = { map: tex(c, true), normalMap: tex(normalOf(h, 3)) }; }
  // vlnitý plech
  { const s = 128, c = cnv(s), x = c.getContext('2d'), h = cnv(s), hx = h.getContext('2d');
    for (let px = 0; px < s; px++) { const v = Math.sin(px / s * Math.PI * 16) * 0.5 + 0.5; const g = Math.round(185 + v * 55); x.fillStyle = 'rgb(' + g + ',' + g + ',' + g + ')'; x.fillRect(px, 0, 1, s); hx.fillStyle = 'rgb(' + Math.round(v * 255) + ',0,0)'; hx.fillRect(px, 0, 1, s); }
    noiseFill(x, s, 0, 8, 0); T.metal = { map: tex(c, true), normalMap: tex(normalOf(h, 2)) }; }
  // výloha
  { const s = 256, c = cnv(s), x = c.getContext('2d'), r = cnv(s), rx = r.getContext('2d');
    x.fillStyle = '#e9e7e2'; x.fillRect(0, 0, s, s); rx.fillStyle = '#d0d0d0'; rx.fillRect(0, 0, s, s);
    x.fillStyle = grad(x, 0, 60, s, s, [[0, '#9fb2c2'], [0.5, '#4a5d6e'], [1, '#2e3a46']]); x.fillRect(14, 64, s - 28, s - 82);
    x.fillStyle = 'rgba(255,240,200,0.25)'; for (let i = 0; i < 6; i++) x.fillRect(30 + rr() * 180, 150 + rr() * 60, 14 + rr() * 26, 30 + rr() * 30);
    x.fillStyle = '#3a3f46'; x.fillRect(14, 60, s - 28, 6); x.fillRect(s / 2 - 3, 64, 6, s - 82); x.fillStyle = '#c9c6bf'; x.fillRect(0, s - 18, s, 18);
    rx.fillStyle = '#1e1e1e'; rx.fillRect(14, 64, s - 28, s - 82);
    T.shop = { map: tex(c, true), roughnessMap: tex(r) }; }
  // plochá střecha, beton, asfalt, tráva, listí
  const plainTex = (base, amp, cell, s) => { s = s || 256; const c = cnv(s), x = c.getContext('2d'); x.fillStyle = base; x.fillRect(0, 0, s, s); noiseFill(x, s, 0, amp, cell); return c; };
  { const c = plainTex('#d6d4cf', 26, 0); T.roof = { map: tex(c, true), normalMap: tex(normalOf(c, 1.2)) }; }
  { const c = plainTex('#ecebe7', 12, 8); T.plain = { map: tex(c, true) }; }
  { const c = plainTex('#e2e2e2', 30, 0, 512), x = c.getContext('2d'); x.strokeStyle = 'rgba(40,40,40,0.35)'; x.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) { x.beginPath(); let px = rr() * 512, py = rr() * 512; x.moveTo(px, py); for (let j = 0; j < 8; j++) { px += (rr() - 0.5) * 50; py += (rr() - 0.5) * 50; x.lineTo(px, py); } x.stroke(); }
    T.asphalt = { map: tex(c, true), normalMap: tex(normalOf(c, 0.8)) }; }
  { const c = plainTex('#e6efe0', 40, 3); T.lawn = { map: tex(c, true), normalMap: tex(normalOf(c, 1.5)) }; }
  { const s = 128, c = cnv(s), x = c.getContext('2d'); x.fillStyle = '#d8dccf'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 220; i++) { const v = 150 + rr() * 105; x.fillStyle = 'rgb(' + (v * 0.9) + ',' + v + ',' + (v * 0.8) + ')'; x.beginPath(); x.ellipse(rr() * s, rr() * s, 3 + rr() * 6, 2 + rr() * 4, rr() * 3, 0, 6.29); x.fill(); }
    T.leaf = { map: tex(c, true), normalMap: tex(normalOf(c, 4)) }; }
  // vlny na vodě
  { const s = 256, h = cnv(s), x = h.getContext('2d'), img = x.createImageData(s, s);
    for (let py = 0; py < s; py++) for (let px = 0; px < s; px++) { const u = px / s * 6.283, v = py / s * 6.283; const val = Math.sin(u * 3 + v * 2) * 0.3 + Math.sin(u * 7 - v * 5) * 0.2 + Math.sin(u * 13 + v * 11) * 0.12 + Math.sin(u * 2 - v * 9) * 0.2; const g = (val * 0.5 + 0.5) * 255; const i = (py * s + px) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = g; img.data[i + 3] = 255; }
    x.putImageData(img, 0, 0); T.water = { normalMap: tex(normalOf(h, 2.2)) }; }
  return T;
}
function makeMaterials(T, env) {
  const S = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.85, metalness: 0, envMap: env, envMapIntensity: 0.6 }, o));
  const M = [];
  M[MK.plain] = S({ map: T.plain.map, roughness: 0.82 });
  M[MK.res] = S({ map: T.res.map, roughnessMap: T.res.roughnessMap, roughness: 1, envMapIntensity: 0.9 });
  M[MK.office] = S({ map: T.office.map, roughnessMap: T.office.roughnessMap, roughness: 1, metalness: 0.35, envMapIntensity: 1.4 });
  M[MK.panel] = S({ map: T.panel.map, roughnessMap: T.panel.roughnessMap, normalMap: T.panel.normalMap, roughness: 1, envMapIntensity: 0.8 });
  M[MK.brick] = S({ map: T.brick.map, normalMap: T.brick.normalMap, roughness: 0.92 });
  M[MK.tile] = S({ map: T.tile.map, normalMap: T.tile.normalMap, roughness: 0.75 });
  M[MK.metal] = S({ map: T.metal.map, normalMap: T.metal.normalMap, roughness: 0.5, metalness: 0.45, envMapIntensity: 0.9 });
  M[MK.shop] = S({ map: T.shop.map, roughnessMap: T.shop.roughnessMap, roughness: 1, envMapIntensity: 1 });
  M[MK.roof] = S({ map: T.roof.map, normalMap: T.roof.normalMap, roughness: 0.95 });
  M[MK.asphalt] = S({ map: T.asphalt.map, normalMap: T.asphalt.normalMap, roughness: 0.92 });
  M[MK.leaf] = S({ map: T.leaf.map, normalMap: T.leaf.normalMap, roughness: 0.9, envMapIntensity: 0.4 });
  M[MK.glass] = S({ roughness: 0.08, metalness: 0.4, envMapIntensity: 1.5 });
  M[MK.paint] = S({ roughness: 0.32, metalness: 0.45, envMapIntensity: 1.2 });
  M[MK.lawn] = S({ map: T.lawn.map, normalMap: T.lawn.normalMap, roughness: 0.95, envMapIntensity: 0.4 });
  M[MK.water] = S({ normalMap: T.water.normalMap, roughness: 0.06, metalness: 0.1, envMapIntensity: 1.3 });
  M[MK.stone] = S({ map: T.stone.map, roughnessMap: T.stone.roughnessMap, roughness: 1, envMapIntensity: 0.8 });
  return M;
}
