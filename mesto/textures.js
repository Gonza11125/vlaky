'use strict';
// Realistické materiály: textury fasád, střech, asfaltu, trávy a vody kreslené v prohlížeči.

const MK = { plain: 0, res: 1, office: 2, panel: 3, brick: 4, tile: 5, metal: 6, shop: 7, roof: 8, asphalt: 9, leaf: 10, glass: 11, paint: 12, lawn: 13, water: 14, stone: 15, wood: 16, pave: 17, field: 18, soil: 19 };
// měřítko UV: [šířka jednoho opakování, výška] ve světových jednotkách
const MUV = { plain: [6, 6], res: [1.6, 1.25], office: [1.5, 1.1], panel: [1.75, 1.15], brick: [2.4, 2.4], tile: [1.4, 0.9], metal: [1.2, 3], shop: [2.2, 1.6], roof: [3, 3], asphalt: [4, 4], leaf: [1.2, 1.2], glass: [4, 4], paint: [4, 4], lawn: [4, 4], water: [3, 3], stone: [1.6, 1.25], wood: [1.6, 1.6], pave: [1.6, 1.6], field: [4, 4], soil: [1.5, 1.5] };
// kolik oken (sloupců a pater) obsahuje jedna textura fasády
const TREP = { res: [4, 4], stone: [4, 4], panel: [4, 4], office: [4, 4] };
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

// okno: rám, sklo s odleskem, parapet, náhodně záclony, žaluzie nebo truhlík; kreslí i mapu drsnosti
function windowAt(x, rx, X, Y, W, H, glassTop, glassBot, vary) {
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(X - 3, Y - 3, W + 6, H + 8);
  x.fillStyle = '#f4f3ef'; x.fillRect(X - 5, Y - 5, W + 10, H + 10);
  x.fillStyle = grad(x, X, Y, X + W * 0.4, Y + H, [[0, glassTop], [0.55, glassBot], [1, glassBot]]); x.fillRect(X, Y, W, H);
  x.fillStyle = 'rgba(255,255,255,0.18)'; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + W * 0.55, Y); x.lineTo(X, Y + H * 0.6); x.closePath(); x.fill();
  x.fillStyle = '#eceae4'; x.fillRect(X + W / 2 - 3, Y, 6, H); x.fillRect(X, Y + H * 0.38 - 3, W, 6);
  if (vary) {
    const r = rr();
    if (r < 0.28) { x.fillStyle = 'rgba(236,230,214,0.82)'; x.fillRect(X + 3, Y + 3, W * 0.28, H - 6); x.fillRect(X + W * 0.72 - 3, Y + 3, W * 0.28, H - 6); }
    else if (r < 0.48) { x.fillStyle = 'rgba(220,214,200,0.9)'; const hb = H * (0.25 + rr() * 0.5); for (let yy = Y + 2; yy < Y + hb; yy += 5) x.fillRect(X + 2, yy, W - 4, 3); }
    else if (r < 0.58) { x.fillStyle = 'rgba(10,14,20,0.55)'; x.fillRect(X + W / 2 + 3, Y + 2, W / 2 - 5, H - 4); }
    else if (r < 0.68) { x.fillStyle = 'rgba(250,240,210,0.35)'; x.fillRect(X + 2, Y + H * 0.45, W - 4, H * 0.5); }
    x.fillStyle = '#eceae4'; x.fillRect(X + W / 2 - 3, Y, 6, H); x.fillRect(X, Y + H * 0.38 - 3, W, 6);
    if (rr() < 0.18) { x.fillStyle = '#7a5a3e'; x.fillRect(X - 2, Y + H + 2, W + 4, 9); for (let i = 0; i < 9; i++) { x.fillStyle = ['#c8372d', '#e05a8a', '#f0c040', '#5f8a3a'][(rr() * 4) | 0]; x.beginPath(); x.arc(X + 4 + rr() * (W - 8), Y + H + 1, 3 + rr() * 2, 0, 6.29); x.fill(); } }
  }
  x.fillStyle = '#d9d6cf'; x.fillRect(X - 9, Y + H + 4, W + 18, 8);
  if (rx) { rx.fillStyle = '#2a2a2a'; rx.fillRect(X, Y, W, H); }
}
function makeTextures() {
  const T = {};
  // omítka s okny (bydlení)
  { const s = 1024, c = cnv(s), x = c.getContext('2d'), r = cnv(s), rx = r.getContext('2d');
    x.fillStyle = '#ecebe6'; x.fillRect(0, 0, s, s); noiseFill(x, s, 0, 10, 0); rx.fillStyle = '#e6e6e6'; rx.fillRect(0, 0, s, s);
    x.fillStyle = 'rgba(0,0,0,0.05)'; for (let f = 0; f < 4; f++) x.fillRect(0, f * 256 + 250, s, 6);
    for (let f = 0; f < 4; f++) for (let b = 0; b < 4; b++) windowAt(x, rx, b * 256 + 70, f * 256 + 58, 116, 128, '#7d93a6', '#2b3846', true);
    T.res = { map: tex(c, true), roughnessMap: tex(r) }; }
  // kámen a světlá omítka veřejných budov
  { const s = 1024, c = cnv(s), x = c.getContext('2d'), r = cnv(s), rx = r.getContext('2d');
    x.fillStyle = '#efeadf'; x.fillRect(0, 0, s, s); noiseFill(x, s, 0, 12, 4); x.fillStyle = 'rgba(0,0,0,0.07)'; for (let y = 0; y < s; y += 32) x.fillRect(0, y, s, 2);
    rx.fillStyle = '#e0e0e0'; rx.fillRect(0, 0, s, s);
    for (let f = 0; f < 4; f++) { x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, f * 256 + 240, s, 10); x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(0, f * 256 + 236, s, 4);
      for (let b = 0; b < 4; b++) { x.fillStyle = 'rgba(0,0,0,0.1)'; x.fillRect(b * 256 + 66, f * 256 + 26, 124, 12); windowAt(x, rx, b * 256 + 78, f * 256 + 46, 100, 160, '#8a9eb0', '#2a3644', true); } }
    T.stone = { map: tex(c, true), roughnessMap: tex(r) }; }
  // prosklená fasáda kanceláří
  { const s = 1024, c = cnv(s), x = c.getContext('2d'), r = cnv(s), rx = r.getContext('2d'), u = 256;
    x.fillStyle = grad(x, 0, 0, s * 0.3, s, [[0, '#b3c6d4'], [0.5, '#7590a8'], [1, '#4d6882']]); x.fillRect(0, 0, s, s);
    for (let i = 0; i < 160; i++) { x.fillStyle = 'rgba(255,255,255,' + (rr() * 0.07) + ')'; x.fillRect(rr() * s, rr() * s, 20 + rr() * 120, 6 + rr() * 30); }
    for (let f = 0; f < 4; f++) for (let b = 0; b < 8; b++) { const t = rr(); if (t < 0.25) { x.fillStyle = 'rgba(225,228,230,0.45)'; x.fillRect(b * 128 + 4, f * u + 4, 120, u * 0.3 + rr() * u * 0.4); } else if (t < 0.4) { x.fillStyle = 'rgba(10,18,28,0.35)'; x.fillRect(b * 128 + 4, f * u + 4, 120, u - 54); } }
    rx.fillStyle = '#141414'; rx.fillRect(0, 0, s, s);
    for (let f = 0; f < 4; f++) { x.fillStyle = '#39424d'; x.fillRect(0, f * u + u - 46, s, 46); rx.fillStyle = '#909090'; rx.fillRect(0, f * u + u - 46, s, 46); x.fillStyle = '#2b3138'; x.fillRect(0, f * u + u - 48, s, 4); }
    x.fillStyle = '#2b3138'; for (let b = 0; b < 8; b++) x.fillRect(b * 128, 0, 5, s);
    T.office = { map: tex(c, true), roughnessMap: tex(r) }; }
  // panelový dům
  { const s = 256, c = cnv(s), x = c.getContext('2d'), r = cnv(s), rx = r.getContext('2d'), h = cnv(s), hx = h.getContext('2d');
    x.fillStyle = '#e4e2dc'; x.fillRect(0, 0, s, s); noiseFill(x, s, 0, 14, 0); rx.fillStyle = '#ececec'; rx.fillRect(0, 0, s, s);
    hx.fillStyle = '#fff'; hx.fillRect(0, 0, s, s); hx.fillStyle = '#000'; hx.fillRect(0, 0, s, 4); hx.fillRect(0, 0, 4, s);
    x.fillStyle = 'rgba(60,60,60,0.45)'; x.fillRect(0, 0, s, 3); x.fillRect(0, 0, 3, s);
    windowAt(x, rx, 52, 70, 152, 100, '#7a8fa2', '#2c3846');
    const c4 = cnv(1024), x4 = c4.getContext('2d'), r4 = cnv(1024), rx4 = r4.getContext('2d'), h4 = cnv(1024), hx4 = h4.getContext('2d');
    const tones = ['#e4e2dc', '#ddd9cf', '#e9e4d8', '#d6d8d6'];
    for (let f = 0; f < 4; f++) for (let b = 0; b < 4; b++) { x4.drawImage(c, b * 256, f * 256); x4.fillStyle = tones[(f + b * 3 + (rr() * 2 | 0)) % 4]; x4.globalAlpha = 0.25; x4.fillRect(b * 256, f * 256, 256, 256); x4.globalAlpha = 1;
      windowAt(x4, null, b * 256 + 52, f * 256 + 70, 152, 100, '#7a8fa2', '#2c3846', true); rx4.drawImage(r, b * 256, f * 256); hx4.drawImage(h, b * 256, f * 256); }
    T.panel = { map: tex(c4, true), roughnessMap: tex(r4), normalMap: tex(normalOf(h4, 3)) }; }
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
  // prkna, dlažba, brázdy pole, hlína
  { const s = 256, c = cnv(s), x = c.getContext('2d'), h = cnv(s), hx = h.getContext('2d');
    for (let i = 0; i < 16; i++) { const v = 170 + rr() * 70; x.fillStyle = 'rgb(' + v + ',' + (v * 0.93) + ',' + (v * 0.85) + ')'; x.fillRect(i * 16, 0, 16, s); x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(i * 16, 0, 2, s); hx.fillStyle = '#fff'; hx.fillRect(i * 16 + 2, 0, 14, s); hx.fillStyle = '#000'; hx.fillRect(i * 16, 0, 2, s); }
    noiseFill(x, s, 0, 16, 0); T.wood = { map: tex(c, true), normalMap: tex(normalOf(h, 2)) }; }
  { const s = 256, c = cnv(s), x = c.getContext('2d'), h = cnv(s), hx = h.getContext('2d'); hx.fillStyle = '#000'; hx.fillRect(0, 0, s, s);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) { const v = 200 + rr() * 40; x.fillStyle = 'rgb(' + v + ',' + (v * 0.98) + ',' + (v * 0.94) + ')'; x.fillRect(col * 32 + 1, row * 32 + 1, 30, 30); hx.fillStyle = '#fff'; hx.fillRect(col * 32 + 2, row * 32 + 2, 28, 28); }
    noiseFill(x, s, 0, 14, 0); T.pave = { map: tex(c, true), normalMap: tex(normalOf(h, 1.5)) }; }
  { const s = 256, c = cnv(s), x = c.getContext('2d'), h = cnv(s), hx = h.getContext('2d');
    for (let py = 0; py < s; py++) { const v = Math.sin(py / s * Math.PI * 32) * 0.5 + 0.5, g = 170 + v * 70; x.fillStyle = 'rgb(' + g + ',' + g + ',' + g + ')'; x.fillRect(0, py, s, 1); hx.fillStyle = 'rgb(' + Math.round(v * 255) + ',0,0)'; hx.fillRect(0, py, s, 1); }
    noiseFill(x, s, 0, 30, 2); T.field = { map: tex(c, true), normalMap: tex(normalOf(h, 2.5)) }; }
  { const c = plainTex('#c9b9a4', 40, 2, 128); T.soil = { map: tex(c, true), normalMap: tex(normalOf(c, 2)) }; }
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
  M[MK.wood] = S({ map: T.wood.map, normalMap: T.wood.normalMap, roughness: 0.9 });
  M[MK.pave] = S({ map: T.pave.map, normalMap: T.pave.normalMap, roughness: 0.9 });
  M[MK.field] = S({ map: T.field.map, normalMap: T.field.normalMap, roughness: 1, envMapIntensity: 0.3 });
  M[MK.soil] = S({ map: T.soil.map, normalMap: T.soil.normalMap, roughness: 1, envMapIntensity: 0.3 });
  return M;
}
