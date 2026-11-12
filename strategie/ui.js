'use strict';
// Ovládání, kamera, HUD a hlavní smyčka.

const $ = id => document.getElementById(id);
const view = $('view'), hud = $('hud'), hctx = hud.getContext('2d'), mini = $('mini'), mctx = mini.getContext('2d');
const cam = { x: 0, z: 0, dist: 62, yaw: 0, pitch: 0.96 };
let W = 1, H = 1, DPR = 1;
let sel = [], placing = null, ghost = null, amoveMode = false, razeArm = 0;
const keys = {}, rings = [], markers = [];
let ping = null, lastAlert = -99;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tmpV = new THREE.Vector3();
const ME = () => teams[MY];

// ---------- hlášky ----------
function msg(text, cls) {
  const box = $('msgs'), d = document.createElement('div');
  d.className = 'msg ' + (cls || ''); d.textContent = text; box.appendChild(d);
  while (box.children.length > 5) box.firstChild.remove();
  setTimeout(() => d.remove(), 7000);
}
function alertAttack(x, z, isB) { if (G.time - lastAlert < 15) return; lastAlert = G.time; ping = { x, z, until: performance.now() + 6000 }; msg(isB ? 'Nepřítel útočí na tvoje budovy!' : 'Nepřítel útočí na tvoje lidi!', 'bad'); }
function showEnd(win) {
  $('end-title').textContent = win ? 'Vítězství' : 'Porážka';
  const s = ME().stats, m = Math.floor(G.time / 60);
  $('end-text').textContent = (win ? 'Nepřátelské Sídlo padlo. ' : 'Tvoje Sídlo padlo. ') + 'Hra trvala ' + m + ' min (rok ' + year() + '), dosáhl jsi epochy ' + ERAS[ME().era] + '. Zabito nepřátel: ' + s.kills + ', zbořeno budov: ' + s.razed + ', vlastní ztráty: ' + s.lost + '.';
  $('end').hidden = false; G.reveal = true; if (G.mode === 'ai') clearSave(); showSaveOffer();
}
function costHTML(cost) { return Object.keys(cost || {}).map(k => '<i class="dot ' + k + '"></i>' + cost[k]).join(''); }

// ---------- kamera a výběr v prostoru ----------
function resize() {
  W = view.clientWidth; H = view.clientHeight; DPR = Math.min(window.devicePixelRatio || 1, G.coarse ? 1.5 : 2);
  $('msgs').style.top = ($('top').offsetHeight + 8) + 'px';
  if (!W || !H) return;
  renderer.setPixelRatio(DPR); renderer.setSize(W, H, false);
  camera.aspect = W / H; camera.updateProjectionMatrix();
  hud.width = W * DPR; hud.height = H * DPR;
}
function updateCamera() {
  cam.x = clamp(cam.x, 4, WORLD - 4); cam.z = clamp(cam.z, 4, WORLD - 4); cam.dist = clamp(cam.dist, 22, 130);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), ty = Math.max(0, heightAt(cam.x, cam.z));
  camera.position.set(cam.x + Math.sin(cam.yaw) * cp * cam.dist, ty + sp * cam.dist, cam.z + Math.cos(cam.yaw) * cp * cam.dist);
  camera.lookAt(cam.x, ty, cam.z);
  sun.target.position.set(cam.x, 0, cam.z);
  if (G.real) { const p = (G.time % 120) / 120 * 6.283, el = 0.5 + 0.5 * Math.sin(p); sun.position.set(cam.x + 75 * Math.cos(p), 42 + 78 * el, cam.z + 30 + 30 * Math.sin(p)); sun.color.setHex(0xffb074).lerp(_col.setHex(0xfff4e2), sstep(0, 0.55, el)); sun.intensity = (0.72 + 0.26 * el) * (G.rain ? 0.75 : 1); }
  else { sun.position.set(cam.x + 60, 110, cam.z + 45); sun.color.setHex(0xfff1da); sun.intensity = 0.9; }
}
function pan(right, fwd) { cam.x += Math.cos(cam.yaw) * right - Math.sin(cam.yaw) * fwd; cam.z += -Math.sin(cam.yaw) * right - Math.cos(cam.yaw) * fwd; }
const pxPerUnit = () => H / (2 * Math.tan(camera.fov * Math.PI / 360) * cam.dist);
function toScreen(x, y, z) { tmpV.set(x, y, z).project(camera); return { x: (tmpV.x + 1) / 2 * W, y: (1 - tmpV.y) / 2 * H, ok: tmpV.z < 1 }; }
function groundAt(sx, sy) {
  ndc.set(sx / W * 2 - 1, -(sy / H) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObject(terrain)[0];
  if (hit) return hit.point;
  const o = ray.ray.origin, d = ray.ray.direction; if (d.y >= 0) return null;
  const t = -o.y / d.y; return new THREE.Vector3(o.x + d.x * t, 0, o.z + d.z * t);
}
function pickAt(sx, sy, touch) {
  const out = { unit: null, bld: null, node: null, animal: null, pt: groundAt(sx, sy) };
  let bd = touch ? Math.max(30, pxPerUnit() * 1.2) : Math.max(16, pxPerUnit() * 0.9);
  for (const a of animals) { if (!a.mesh.visible) continue; const p = toScreen(a.x, heightAt(a.x, a.z) + 0.9, a.z); const d = Math.hypot(p.x - sx, p.y - sy); if (p.ok && d < bd) { bd = d; out.animal = a; } }
  for (const u of units) { if (!u.mesh.visible) continue; const p = toScreen(u.x, heightAt(u.x, u.z) + 0.9, u.z); if (!p.ok) continue; const d = Math.hypot(p.x - sx, p.y - sy); if (d < bd) { bd = d; out.unit = u; out.animal = null; } }
  if (out.pt && out.pt.x >= 0 && out.pt.z >= 0 && out.pt.x < WORLD && out.pt.z < WORLD) {
    const cx = cellOf(out.pt.x), cy = cellOf(out.pt.z);
    out.bld = byId.get(bAt[cidx(cx, cy)]) || null; if (out.bld && !out.bld.mesh.visible) out.bld = null;
    let nd = 1.9;
    for (let j = cy - 1; j <= cy + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) { if (!inMap(i, j)) continue; const id = nodeAt[cidx(i, j)]; if (id < 0 || !explored[cidx(i, j)]) continue; const n = nodes[id], d = Math.hypot(n.x - out.pt.x, n.z - out.pt.z); if (d < nd) { nd = d; out.node = n; } }
  }
  if (!out.bld) { let best = 1e9; for (const b of blds) { if (b.type === 'farm' || b.type === 'pasture' || !b.mesh.visible) continue; const p = toScreen(b.x, b.y + 1.6, b.z); const d = Math.hypot(p.x - sx, p.y - sy); if (d < b.size * CS * 0.42 * pxPerUnit() && d < best) { best = d; out.bld = b; } } }
  return out;
}
function marker(x, z, color) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 20), new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, heightAt(x, z) + 0.15, z); m.renderOrder = 5; scene.add(m); markers.push({ m, t: 0.6 });
}

// ---------- výběr a rozkazy ----------
const ownUnits = () => sel.filter(e => e.isU && e.team === MY && !e.dead);
function setSel(list) { sel = list; amoveMode = false; razeArm = 0; cmdSig = ''; }
const ids = l => l.map(u => u.id);
function command(p, forceA) {
  const own = ownUnits();
  if (!p.pt && !p.unit && !p.animal) return;
  if (!own.length) {
    const b = sel[0];
    if (b && b.isB && b.team === MY && p.pt) { b.rally = { x: p.pt.x, z: p.pt.z, node: p.node || null }; act(['rally', b.id, r1(p.pt.x), r1(p.pt.z), p.node ? p.node.id : -1]); marker(p.pt.x, p.pt.z, 0xffe08a); }
    return;
  }
  const vils = own.filter(u => u.type === 'vil');
  const enemy = (p.unit && p.unit.team !== MY) ? p.unit : (p.bld && p.bld.team !== MY ? p.bld : null);
  if (enemy) { act(['atk', ids(own), enemy.id]); marker(enemy.x, enemy.z, 0xff6a50); return; }
  if (p.animal && vils.length) { act(['hunt', ids(vils), p.animal.id]); marker(p.animal.x, p.animal.z, 0xff6a50); return; }
  if (p.bld && p.bld.team === MY) {
    const b = p.bld;
    if (vils.length && (!b.done || b.hp < b.maxHp || b.fire > 0)) { act(['build', ids(vils), b.id]); marker(b.x, b.z, 0x8fe08a); return; }
    if (vils.length && b.type === 'farm' && b.done) { act(['farm', ids(vils), b.id]); marker(b.x, b.z, 0x8fe08a); return; }
  }
  if (p.node && vils.length) {
    if (p.node.def.req && !ME().tech[p.node.def.req]) { msg(p.node.def.name + ': těžit to zatím neumíš. Vyzkoumej v Sídle Hornictví a tavení.', 'bad'); return; }
    act(['gather', ids(own), p.node.id]);
    marker(p.node.x, p.node.z, 0x8fe08a); return;
  }
  if (!p.pt) return;
  const a = forceA || amoveMode;
  act(['move', ids(own), r1(p.pt.x), r1(p.pt.z), a ? 1 : 0]);
  marker(p.pt.x, p.pt.z, a ? 0xff6a50 : 0x8fe08a);
  if (amoveMode) { amoveMode = false; cmdSig = ''; }
}
function startPlacing(type) {
  const def = BUILDINGS[type];
  if (!afford(ME(), def.cost)) { msg('Chybí: ' + missing(ME(), def.cost) + '.', 'bad'); return; }
  cancelPlacing();
  ghost = []; placing = { type, line: !!def.line, anchor: null, cells: [], cx: -1, cy: -1, ok: false, set: false };
  if (def.line) msg('Klikni na začátek úseku a pak na jeho konec. Pravým tlačítkem nebo Esc skončíš.');
}
function cancelPlacing() { if (ghost) ghost.forEach(g => { scene.remove(g); g.material.dispose(); }); ghost = null; placing = null; $('place').hidden = true; cmdSig = ''; }
function lineCells(a, b) {
  const out = []; let x = a.cx, y = a.cy; const dx = Math.abs(b.cx - x), dy = Math.abs(b.cy - y), sx = x < b.cx ? 1 : -1, sy = y < b.cy ? 1 : -1; let err = dx - dy;
  for (let i = 0; i < 60; i++) { out.push({ cx: x, cy: y }); if (x === b.cx && y === b.cy) break; const e2 = 2 * err; if (e2 > -dy) { err -= dy; x += sx; } if (e2 < dx) { err += dx; y += sy; } }
  return out;
}
function moveGhost(sx, sy) {
  const pt = groundAt(sx, sy); if (!pt || !placing) return false;
  const s = BUILDINGS[placing.type].size;
  placing.cx = Math.round(pt.x / CS - s / 2); placing.cy = Math.round(pt.z / CS - s / 2); placing.set = true;
  const here = { cx: placing.cx, cy: placing.cy };
  placing.cells = placing.line && placing.anchor ? lineCells(placing.anchor, here) : [here];
  placing.ok = false;
  placing.cells.forEach((c, i) => {
    if (!ghost[i]) { ghost[i] = new THREE.Mesh(geoFor('b', placing.type, MY), ghostMat.clone()); scene.add(ghost[i]); }
    c.ok = canPlace(placing.type, c.cx, c.cy); if (c.ok) placing.ok = true;
    const h = inMap(c.cx, c.cy) && inMap(c.cx + s - 1, c.cy + s - 1) ? cellH(c.cx + (s >> 1), c.cy + (s >> 1)) : 0;
    ghost[i].position.set((c.cx + s / 2) * CS, h + 0.1, (c.cy + s / 2) * CS); ghost[i].visible = true; ghost[i].material.color.setHex(!c.ok ? 0xff5544 : G.real && h < 1.12 ? 0xffb347 : 0x66ff88); if (c.ok && G.real && h < 1.12) placing.low = true; else if (i === 0) placing.low = false;
  });
  for (let i = placing.cells.length; i < ghost.length; i++) ghost[i].visible = false;
  return true;
}
function confirmPlace(keep) {
  if (!placing || !placing.set) return;
  const def = BUILDINGS[placing.type];
  if (!placing.ok) { msg('Tady stavět nejde. Místo musí být volné a rovné.', 'bad'); return; }
  if (!afford(ME(), def.cost)) { msg('Chybí: ' + missing(ME(), def.cost) + '.', 'bad'); cancelPlacing(); return; }
  if (placing.line && !placing.anchor) { placing.anchor = { cx: placing.cx, cy: placing.cy }; return; }
  if (placing.low && !placing.line) msg('Pozor, tohle místo leží nízko. Jarní povodeň ho může zaplavit.', 'bad');
  const cells = placing.cells.filter(c => c.ok && canPlace(placing.type, c.cx, c.cy)).map(c => [c.cx, c.cy]);
  const short = false;
  if (cells.length) act(['place', placing.type, cells, ids(ownUnits().filter(u => u.type === 'vil'))]);
  if (placing.line && !short) { placing.anchor = placing.cells[placing.cells.length - 1]; placing.set = false; ghost.forEach(g => { g.visible = false; }); return; }
  if (keep && afford(ME(), def.cost)) { placing.ok = false; placing.set = false; ghost.forEach(g => { g.visible = false; }); $('place').hidden = true; }
  else cancelPlacing();
}

// ---------- ukazatel (myš i dotyk) ----------
const groups = {};
let boxMode = false;
function setBoxMode(on) { boxMode = on; $('t-box').classList.toggle('on', on); }
$('t-box').onclick = () => { setBoxMode(!boxMode); if (boxMode) msg('Táhni prstem přes jednotky, které chceš vybrat.'); };
$('t-army').onclick = () => { const l = units.filter(u => u.team === MY && u.type !== 'vil'); if (l.length) setSel(l); else msg('Zatím nemáš žádné vojáky.'); };
$('t-none').onclick = () => { if (placing) cancelPlacing(); setSel([]); setBoxMode(false); };
const ptrs = new Map(); let drag = null, pinch = null, lastClick = { t: 0, id: 0 };
view.addEventListener('contextmenu', e => e.preventDefault());
view.addEventListener('pointerdown', e => {
  try { view.setPointerCapture(e.pointerId); } catch (_) { }
  const r = view.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  ptrs.set(e.pointerId, { x, y });
  const touch = e.pointerType !== 'mouse';
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; drag = null; $('box').hidden = true; return; }
  drag = { x0: x, y0: y, x, y, moved: false, touch, btn: e.button, mode: touch ? (boxMode && !placing ? 'box' : 'pan') : e.button === 0 ? (placing ? 'none' : 'box') : e.button === 1 ? 'pan' : 'cmd', shift: e.shiftKey, ctrl: e.ctrlKey };
});
view.addEventListener('pointermove', e => {
  const r = view.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x, y });
  if (pinch && ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, k = pxPerUnit();
    if (d > 10) cam.dist *= pinch.d / d;
    pan(-(mx - pinch.mx) / k, (my - pinch.my) / k / Math.sin(cam.pitch));
    pinch = { d, mx, my }; return;
  }
  if (placing && e.pointerType === 'mouse') moveGhost(x, y);
  if (!drag) return;
  const dx = x - drag.x, dy = y - drag.y; drag.x = x; drag.y = y;
  if (!drag.moved && Math.hypot(x - drag.x0, y - drag.y0) > (drag.touch ? 10 : 5)) drag.moved = true;
  if (!drag.moved) return;
  if (drag.mode === 'pan') { const k = pxPerUnit(); pan(-dx / k, dy / k / Math.sin(cam.pitch)); }
  else if (drag.mode === 'box') { const bx = $('box'); bx.hidden = false; bx.style.left = Math.min(drag.x0, x) + 'px'; bx.style.top = Math.min(drag.y0, y) + 'px'; bx.style.width = Math.abs(x - drag.x0) + 'px'; bx.style.height = Math.abs(y - drag.y0) + 'px'; }
});
function pointerEnd(e) {
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch = null;
  const d = drag; if (!d || ptrs.size) { if (!ptrs.size) drag = null; return; }
  drag = null; $('box').hidden = true;
  if (e.type === 'pointercancel') return;
  if (d.moved) { if (d.mode === 'box') boxSelect(d.x0, d.y0, d.x, d.y, d.shift); return; }
  click(d.x, d.y, d);
}
view.addEventListener('pointerup', pointerEnd); view.addEventListener('pointercancel', pointerEnd);
view.addEventListener('wheel', e => { e.preventDefault(); cam.dist *= Math.exp(e.deltaY * 0.0012); }, { passive: false });

function boxSelect(x0, y0, x1, y1, add) {
  const l = Math.min(x0, x1), r = Math.max(x0, x1), t = Math.min(y0, y1), b = Math.max(y0, y1);
  const list = units.filter(u => { if (u.team !== MY) return false; const p = toScreen(u.x, heightAt(u.x, u.z) + 0.8, u.z); return p.ok && p.x >= l && p.x <= r && p.y >= t && p.y <= b; });
  if (list.length) setSel(add ? [...new Set([...ownUnits(), ...list])] : list);
  setBoxMode(false);
}
function click(x, y, d) {
  if (placing) {
    if (d.btn === 2) { cancelPlacing(); return; }
    if (!moveGhost(x, y)) return;
    if (d.touch && !placing.line) { $('place').hidden = false; return; }
    confirmPlace(d.shift); return;
  }
  const p = pickAt(x, y, d.touch);
  if (d.btn === 2) { command(p, d.ctrl); return; }
  const target = p.unit || p.animal || p.bld || p.node;
  if (d.touch) {
    const own = ownUnits();
    if (own.length) {
      const b = p.bld, hasVil = own.some(u => u.type === 'vil');
      const selectIt = (p.unit && p.unit.team === MY) || (!p.unit && b && b.team === MY && !(hasVil && (!b.done || b.hp < b.maxHp || b.type === 'farm')));
      if (!selectIt) { command(p, false); return; }
    } else if (!target) { setSel([]); return; }
  }
  if (!target) { setSel([]); return; }
  const now = performance.now();
  if (target.isU && target.team === MY && lastClick.id === target.id && now - lastClick.t < 400) {
    setSel(units.filter(u => { if (u.team !== MY || u.type !== target.type) return false; const s = toScreen(u.x, 1, u.z); return s.ok && s.x > 0 && s.y > 0 && s.x < W && s.y < H; }));
  } else if (d.shift && target.isU && target.team === MY) { const cur = ownUnits(); setSel(cur.includes(target) ? cur.filter(u => u !== target) : [...cur, target]); }
  else setSel([target]);
  lastClick = { t: now, id: target.id };
}
$('b-place-ok').onclick = () => confirmPlace(false);
$('b-place-no').onclick = cancelPlacing;

addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys[e.code] = true;
  if (e.code === 'Escape') { if (!$('techs').hidden) $('techs').hidden = true; else if (placing) cancelPlacing(); else setSel([]); }
  if (e.code === 'Space') { e.preventDefault(); togglePause(); }
  if (e.code === 'Period') idleVil();
  if (e.code === 'KeyH') { cam.x = ME().tcx; cam.z = ME().tcz; }
  if (e.code.startsWith('Arrow')) e.preventDefault();
  if (/^Digit[1-9]$/.test(e.code)) { const k = e.code.slice(5); if (e.ctrlKey || e.metaKey) { e.preventDefault(); groups[k] = ownUnits(); msg('Skupina ' + k + ' uložena.'); } else if (groups[k]) { const l = groups[k].filter(u => !u.dead); if (l.length) setSel(l); } }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// ---------- mapka ----------
const mbase = document.createElement('canvas'); mbase.width = N; mbase.height = N;
function drawMiniBase() {
  const c = mbase.getContext('2d'), img = c.createImageData(N, N), col = terrain.geometry.attributes.color.array;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = (j * NV + i) * 3, o = (j * N + i) * 4; let r = col[k], g = col[k + 1], b = col[k + 2];
    if (cellH(i, j) < 0.1) { r = 0.25; g = 0.45; b = 0.57; }
    const nid = nodeAt[cidx(i, j)]; if (nid >= 0) { const t = nodes[nid].type; if (t === 'tree') { r *= 0.62; g *= 0.72; b *= 0.6; } else if (t === 'stone') { r = g = b = 0.72; } else if (t === 'ore') { r = 0.8; g = 0.5; b = 0.2; } }
    const fk = !explored[cidx(i, j)] ? 0.06 : vis[cidx(i, j)] ? 1 : 0.6;
    img.data[o] = r * 255 * fk; img.data[o + 1] = g * 255 * fk; img.data[o + 2] = b * 255 * fk; img.data[o + 3] = 255;
  }
  c.putImageData(img, 0, 0);
}
function drawMini() {
  const S = mini.width, k = S / WORLD;
  mctx.imageSmoothingEnabled = true; mctx.drawImage(mbase, 0, 0, S, S);
  for (const b of blds) { if (!b.mesh.visible) continue; mctx.fillStyle = b.team ? '#ff5a45' : '#58a6ff'; const s = Math.max(3, b.size * CS * k); mctx.fillRect(b.x * k - s / 2, b.z * k - s / 2, s, s); }
  for (const u of units) { if (!u.mesh.visible) continue; mctx.fillStyle = u.team ? '#ff8a7a' : '#bfe0ff'; mctx.fillRect(u.x * k - 1, u.z * k - 1, 2.2, 2.2); }
  mctx.strokeStyle = '#fff'; mctx.lineWidth = 1; mctx.beginPath();
  [[0, 0], [W, 0], [W, H], [0, H]].forEach(([x, y], i) => { const p = groundPlane(x, y); if (i) mctx.lineTo(p.x * k, p.z * k); else mctx.moveTo(p.x * k, p.z * k); });
  mctx.closePath(); mctx.stroke();
  if (ping && performance.now() < ping.until) { const r = 4 + (performance.now() / 120) % 8; mctx.strokeStyle = '#ffdd55'; mctx.lineWidth = 2; mctx.beginPath(); mctx.arc(ping.x * k, ping.z * k, r, 0, 6.3); mctx.stroke(); }
}
function groundPlane(sx, sy) { ndc.set(sx / W * 2 - 1, -(sy / H) * 2 + 1); ray.setFromCamera(ndc, camera); const o = ray.ray.origin, d = ray.ray.direction, t = d.y < -0.01 ? -o.y / d.y : 400; return { x: o.x + d.x * t, z: o.z + d.z * t }; }
function miniGo(e) { const r = mini.getBoundingClientRect(); cam.x = (e.clientX - r.left) / r.width * WORLD; cam.z = (e.clientY - r.top) / r.height * WORLD; }
mini.addEventListener('pointerdown', e => { try { mini.setPointerCapture(e.pointerId); } catch (_) { } mini._d = true; miniGo(e); });
mini.addEventListener('pointermove', e => { if (mini._d) miniGo(e); });
mini.addEventListener('pointerup', () => { mini._d = false; }); mini.addEventListener('pointercancel', () => { mini._d = false; });

// ---------- panely ----------
$('resbar').innerHTML = RES.map(r => '<span class="res"><i class="dot ' + r + '"></i><b>' + RES_NAME[r] + '</b><em id="r-' + r + '">0</em>' + (r === 'food' || r === 'know' ? '<small id="rate-' + r + '"></small>' : '') + '</span>').join('');
function tip(html) { const t = $('tip'); if (!html) { t.hidden = true; return; } t.innerHTML = html; t.hidden = false; }
let cmdSig = '', cmdBtns = [], tipTimer = 0;
function addBtn(o) {
  const b = document.createElement('button'); b.className = 'cbtn ' + (o.cls || '');
  b.innerHTML = '<span class="n"></span>' + (o.cost ? '<span class="c">' + costHTML(o.cost) + '</span>' : o.sub ? '<span class="c">' + o.sub + '</span>' : '');
  b.firstChild.textContent = o.label;
  const tipHtml = '<h3>' + o.label + '</h3>' + (o.cost ? '<p class="c">' + costHTML(o.cost) + (o.time ? ' · ' + o.time + ' s' : '') + '</p>' : '') + (o.desc ? '<p>' + o.desc + '</p>' : '');
  b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') tip(tipHtml); });
  b.addEventListener('pointerleave', () => tip(null));
  b.onclick = () => { o.fn(); cmdSig = ''; if (o.desc) { tip(tipHtml); clearTimeout(tipTimer); tipTimer = setTimeout(() => tip(null), 3500); } };
  $('cmd').appendChild(b); cmdBtns.push({ el: b, cost: o.cost });
}
function tryQueue(b, kind, id) { act(['queue', b.id, kind, id]); }
function buildCmd() {
  const T = ME(), own = ownUnits(), b = sel[0];
  const sig = sel.map(e => e.id).join(',') + '|' + Object.keys(T.tech).length + '|' + Object.keys(T.busy).length + '|' + T.era + '|' + (placing ? placing.type : '') + amoveMode + razeArm + (b && b.type === 'market' ? Object.values(PRICE).map(Math.round).join() : '') + (b && b.isB ? b.done : '');
  if (sig === cmdSig) return; cmdSig = sig;
  $('cmd').innerHTML = ''; cmdBtns = [];
  if (own.length) {
    if (own.some(u => u.type === 'vil')) for (const type of BUILD_ORDER) { const d = BUILDINGS[type]; if (!hasReq(T, d)) continue; addBtn({ label: d.name, cost: d.cost, time: d.time, desc: d.desc, cls: placing && placing.type === type ? 'on' : '', fn: () => startPlacing(type) }); }
    if (own.some(u => u.type !== 'vil')) addBtn({ label: 'Útočný přesun', cls: amoveMode ? 'on' : '', desc: 'Jednotky dojdou na místo a cestou napadnou každého nepřítele. Pak ukaž cíl na mapě. (S myší také Ctrl + pravé tlačítko.)', fn: () => { amoveMode = !amoveMode; } });
    addBtn({ label: 'Stát', fn: () => act(['stop', ids(own)]) });
    addBtn({ label: 'Zrušit výběr', fn: () => setSel([]) });
  } else if (b && b.isB && b.team === MY) {
    if (b.done) {
      for (const id in UNITS) { const d = UNITS[id]; if (d.at !== b.type || !hasReq(T, d)) continue; addBtn({ label: d.name, cost: d.cost, time: d.time, desc: d.desc + ' Životy ' + d.hp + ', útok ' + d.atk + (d.range ? ', dostřel ' + d.range : '') + ', zbroj ' + d.armor + '. Sní ' + d.upkeep + ' jídla za minutu.', fn: () => tryQueue(b, 'u', id) }); }
      for (const id in TECHS) { const d = TECHS[id]; if (d.at !== b.type || !techAvail(T, id)) continue; addBtn({ label: d.name, cost: d.cost, time: d.time, desc: d.desc, cls: 'tech', fn: () => tryQueue(b, 't', id) }); }
      if (b.type === 'market') for (const r in PRICE) {
        addBtn({ label: 'Prodat: ' + RES_NAME[r].toLowerCase(), sub: '100 za <i class="dot gold"></i>' + Math.floor(PRICE[r] * 0.7), fn: () => act(['trade', r, 0]) });
        addBtn({ label: 'Koupit: ' + RES_NAME[r].toLowerCase(), sub: '100 za <i class="dot gold"></i>' + Math.ceil(PRICE[r] * 1.3), fn: () => act(['trade', r, 1]) });
      }
      if (b.queue.length) addBtn({ label: 'Zrušit poslední', desc: 'Zruší poslední položku ve frontě a vrátí suroviny.', fn: () => act(['unq', b.id]) });
    }
    if (b.type !== 'tc') addBtn({ label: razeArm === b.id ? 'Opravdu zbořit?' : 'Zbořit', cls: razeArm === b.id ? 'on' : '', fn: () => { if (razeArm === b.id) { act(['raze', b.id]); setSel([]); } else razeArm = b.id; } });
    addBtn({ label: 'Zrušit výběr', fn: () => setSel([]) });
  }
}
const TASK = { move: 'jde', amove: 'táhne do útoku', attack: 'bojuje', build: 'staví', farm: 'pracuje na poli' };
function refreshUI() {
  const T = ME();
  for (const r of RES) $('r-' + r).textContent = Math.floor(T.res[r]);
  const net = (farmIncome(T) - upkeepRate(T)) * 60;
  $('rate-food').textContent = (net >= 0 ? '+' : '−') + Math.abs(net).toFixed(0) + '/min';
  if (G.real) { const fc = foodCap(T); $('rate-food').textContent += ' · sklad ' + fc; $('r-food').style.color = T.res.food > fc ? 'var(--brass)' : ''; } else $('r-food').style.color = '';
  $('rate-food').style.color = net < 0 ? 'var(--bad)' : '';
  $('rate-know').textContent = '+' + (knowRate(T) * 60).toFixed(0) + '/min';
  $('s-pop').textContent = T.pop + '/' + T.cap;
  $('s-era').textContent = ERAS[T.era];
  $('s-time').textContent = 'Rok ' + year() + ' · ' + SEASONS[season()];
  let evs = '';
  if (G.real) {
    const sick = units.filter(u => u.team === MY && u.sick > 0).length, fires = blds.filter(b => b.team === MY && b.fire > 0).length;
    if (G.flood > 0.15) evs += '<b class="ev">Povodeň</b>'; else if (G.rain) evs += '<b class="ev">Voda stoupá</b>';
    if (EV.drought) evs += '<b class="ev">Sucho</b>'; if (EV.frost) evs += '<b class="ev">Tuhá zima</b>';
    if (T.cold) evs += '<b class="ev">Mrznou</b>'; if (sick) evs += '<b class="ev">Nemocní ' + sick + '</b>'; if (fires) evs += '<b class="ev">Požár ' + fires + '</b>';
  }
  if ($('s-ev')._h !== evs) { $('s-ev').innerHTML = evs; $('s-ev')._h = evs; $('msgs').style.top = ($('top').offsetHeight + 8) + 'px'; }
  const idle = units.filter(u => u.team === MY && u.type === 'vil' && !u.order).length;
  $('b-idle').textContent = 'Nečinní ' + idle; $('b-idle').classList.toggle('warn', idle > 0);
  sel = sel.filter(e => e.isNode ? e.amt > 0 : !e.dead);
  buildCmd();
  for (const c of cmdBtns) if (c.cost) c.el.classList.toggle('cant', !afford(T, c.cost));
  // informační panel
  const info = $('info'); let h = '';
  const hpBar = e => '<div class="bar"><i style="width:' + clamp(e.hp / e.maxHp * 100, 0, 100) + '%"></i></div>';
  if (!sel.length) h = '<p>Nic není vybráno. Vyber vesničany a pošli je sbírat jídlo a dřevo, nebo vyber Sídlo a začni zkoumat.</p>';
  else if (sel.length > 1) {
    const by = {}; sel.forEach(u => by[u.def.name] = (by[u.def.name] || 0) + 1);
    h = '<h2>Výběr: ' + sel.length + '</h2><p class="stat">' + Object.keys(by).map(k => by[k] + '× ' + k).join(', ') + '</p>';
  } else {
    const e = sel[0];
    if (e.isAnimal) h = '<h2>Jelen</h2>' + hpBar(e) + '<p>Divoká zvěř. Pošli vesničany na lov, z úlovku pak nanosí jídlo.</p>';
    else if (e.isNode) h = '<h2>' + e.def.name + '</h2><p class="stat">Zbývá ' + Math.ceil(e.amt) + ' (' + RES_NAME[e.def.res].toLowerCase() + ')</p>' + (e.def.req && !T.tech[e.def.req] ? '<p>K těžbě potřebuješ Hornictví a tavení.</p>' : '');
    else if (e.isU) {
      const o = e.order, task = !o ? 'čeká' : o.type === 'gather' ? 'sbírá: ' + RES_NAME[o.node.def.res].toLowerCase() : TASK[o.type];
      h = '<h2>' + e.def.name + (e.team !== MY ? ' (nepřítel)' : '') + '</h2>' + hpBar(e) + '<p class="stat">Životy ' + Math.ceil(e.hp) + '/' + e.maxHp + ' · útok ' + atkOf(e) + ' · zbroj ' + armorOf(e) + (e.def.range ? ' · dostřel ' + e.def.range : '') + '</p>' +
        (e.team === MY ? '<p>Teď ' + task + (e.carry >= 1 ? ', nese ' + Math.floor(e.carry) + ' (' + RES_NAME[e.ctype].toLowerCase() + ')' : '') + '.</p>' : '');
    } else {
      h = '<h2>' + e.def.name + (e.team !== MY ? ' (nepřítel)' : '') + '</h2>' + hpBar(e) + '<p class="stat">Odolnost ' + Math.ceil(e.hp) + '/' + e.maxHp + (e.done ? '' : ' · rozestavěno ' + Math.floor(e.prog * 100) + ' %') + '</p>';
      if (e.team === MY) {
        if (!e.done) h += '<p>Pošli sem vesničany, ať stavbu dokončí.</p>';
        else if (e.queue.length) { const q = e.queue[0], d = (q.kind === 'u' ? UNITS : TECHS)[q.id]; h += '<div class="bar q"><i style="width:' + clamp(q.t / q.total * 100, 0, 100) + '%"></i></div><div class="qrow">' + e.queue.map((x, i) => '<span class="qitem">' + (i ? '' : (q.t >= q.total ? 'čeká na dům: ' : '')) + (x.kind === 'u' ? UNITS : TECHS)[x.id].name + '</span>').join('') + '</div>'; }
        else if (e.type === 'farm') h += '<p>' + (farmFree(e) ? 'Pole leží ladem. Pošli sem vesničana.' : season() === 3 ? 'Zima: pole odpočívá.' : 'Úroda ' + (farmRate(T) * 60).toFixed(0) + ' jídla za minutu.') + '</p>';
        else h += '<p>' + e.def.desc + '</p>';
      }
    }
  }
  const e0 = sel.length === 1 ? sel[0] : null;
  if (e0 && e0.sick > 0) h += '<p class="warnp">Je nemocný: slábne a nakazí každého poblíž. Uzdraví ho Ošetřovna.</p>';
  if (e0 && e0.fire > 0) h += '<p class="warnp">Hoří! Pošli sem vesničany, ať hasí.</p>';
  if (e0 && e0.isB && G.flood > 0.2 && e0.y < G.flood - 0.1) h += '<p class="warnp">Stavba je pod vodou a chátrá.</p>';
  if (info._h !== h) { info.innerHTML = h; info._h = h; }
}
function farmIncome(T) { let s = 0; for (const b of blds) if (b.team === T.id && b.done) { if (b.type === 'pasture') s += season() === 3 ? 0.16 : 0.24; else if (b.type === 'farm' && !farmFree(b)) s += farmRate(T); } return s; }
function idleVil() { const l = units.filter(u => u.team === MY && u.type === 'vil' && !u.order); if (!l.length) return; idleVil.i = ((idleVil.i || 0) + 1) % l.length; const u = l[idleVil.i]; setSel([u]); cam.x = u.x; cam.z = u.z; }
function togglePause() { if (G.over || !$('start').hidden) return; if (G.mode !== 'ai') { msg('Hru po síti nejde pozastavit.'); return; } G.paused = !G.paused; $('b-pause').textContent = G.paused ? 'Pokračovat' : 'Pauza'; $('b-pause').classList.toggle('warn', G.paused); }
$('b-idle').onclick = idleVil;
$('b-pause').onclick = togglePause;
$('b-speed').onclick = () => { if (G.mode !== 'ai') { msg('Ve hře po síti se rychlost nemění.'); return; } G.speed = G.speed >= 3 ? 1 : G.speed + 1; $('b-speed').textContent = G.speed + '×'; };
$('b-tech').onclick = () => {
  const T = ME(); let h = '';
  ERAS.forEach((era, i) => {
    h += '<h2>' + era + '</h2><div class="tgrid">';
    for (const id in TECHS) { const d = TECHS[id]; if (d.era !== i || (d.real && !G.real)) continue;
      const st = T.tech[id] ? ['done', 'vyzkoumáno'] : T.busy[id] ? ['avail', 'zkoumá se'] : techAvail(T, id) ? ['avail', 'dostupné'] : ['lock', T.era < d.era ? 'pozdější epocha' : 'chybí: ' + d.req.filter(r => !T.tech[r]).map(r => TECHS[r].name).join(', ')];
      h += '<div class="tech ' + st[0] + '"><h4>' + d.name + '<span class="st">' + st[1] + '</span></h4><p>' + BUILDINGS[d.at].name + ' · <span class="c">' + costHTML(d.cost) + '</span></p><p>' + d.desc + '</p></div>'; }
    h += '</div>';
  });
  $('tech-list').innerHTML = h; $('techs').hidden = false;
};
$('b-tech-close').onclick = () => { $('techs').hidden = true; };
const OPT = { diff: 1, aggr: 2, real: 0 };
for (const row of document.querySelectorAll('.opts')) row.onclick = e => { const b = e.target.closest('.pick'); if (!b) return; for (const x of row.children) x.classList.toggle('on', x === b); OPT[row.dataset.k] = +b.dataset.d; };
function applyOpts() { G.diff = OPT.diff; G.aggr = OPT.aggr; G.real = !!OPT.real; }
$('b-start').onclick = () => { applyOpts(); G.mode = 'ai'; MY = 0; startFresh(); $('start').hidden = true; G.paused = false; msg('Začni jídlem a dřevem: keře, lov jelenů, ryby u břehu. V Sídle vyzkoumej Zemědělství, než přijde zima.'); };
$('b-again').onclick = () => { $('end').hidden = true; netReset(); netStatus(); G.mode = 'ai'; MY = 0; startFresh(); $('start').hidden = false; G.paused = true; };

// ---------- uložení ----------
const SAVE_KEY = 'vek-pokroku-save-1';
function readSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return s && s.v === 1 ? s : null; } catch (_) { return null; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (_) { } }
function doSave(quiet) {
  if (G.mode !== 'ai') { if (!quiet) msg('Hru po síti uložit nejde.', 'bad'); return false; }
  if (G.over || !$('start').hidden) return false;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(Object.assign(saveState(), { cam: { x: cam.x, z: cam.z, dist: cam.dist, yaw: cam.yaw } }))); if (!quiet) msg('Hra uložena. Příště ji najdeš na úvodní obrazovce.', 'good'); return true; }
  catch (e) { if (!quiet) msg('Uložení se nepovedlo: prohlížeč nedovolil zápis.', 'bad'); return false; }
}
function resetView() { sel = []; cmdSig = ''; rings.length = 0; markers.length = 0; ghost = null; placing = null; $('place').hidden = true; lastSeason = -1; snowShown = -1; baseT = 0; acc = 0; lastAlert = -99; ping = null; for (const k in groups) delete groups[k]; }
function startFresh() { resetView(); newGame(G.diff); cam.x = ME().tcx; cam.z = ME().tcz + 4; cam.yaw = 0; cam.dist = view.clientWidth < 760 ? 84 : 62; }
function continueSave() {
  const sv = readSave(); if (!sv) return;
  G.mode = 'ai'; MY = 0;
  resetView();
  try { newGame(0, sv); } catch (e) { clearSave(); startFresh(); msg('Uloženou hru se nepodařilo načíst, začíná nová.', 'bad'); $('start').hidden = true; G.paused = false; return; }
  if (sv.cam) Object.assign(cam, sv.cam);
  $('b-speed').textContent = G.speed + '×'; $('start').hidden = true; G.paused = false; $('b-pause').textContent = 'Pauza'; $('b-pause').classList.remove('warn');
  msg('Hra načtena.', 'good');
}
function showSaveOffer() {
  const sv = readSave(), el = $('b-continue'); el.hidden = !sv; if (!sv) return;
  el.textContent = 'Pokračovat v uložené hře (rok ' + (Math.floor(sv.G.time / (SEASON_LEN * 4)) + 1) + ', ' + ERAS[sv.teams[0].era].toLowerCase() + ')';
}
$('b-save').onclick = () => doSave(false);
$('b-continue').onclick = continueSave;
setInterval(() => { if (!G.paused) doSave(true); }, 45000);
document.addEventListener('visibilitychange', () => { if (document.hidden) doSave(true); });
addEventListener('pagehide', () => doSave(true));

// ---------- vykreslení ----------
function ring(i) {
  if (!rings[i]) { const m = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 4; scene.add(m); rings[i] = m; }
  return rings[i];
}
function drawWorldUI(now) {
  let n = 0;
  for (const e of sel) {
    if (e.dead) continue; const m = ring(n++); m.visible = true;
    const r = e.isB ? e.size * CS * 0.74 : e.isNode ? 1.1 : (e.def.cls === 'cav' || e.def.cls === 'siege') ? 1.3 : 0.8;
    m.scale.setScalar(r); m.position.set(e.x, (e.isB ? e.y : heightAt(e.x, e.z)) + 0.12, e.z);
    m.material.color.setHex(e.isNode || e.isAnimal ? 0xffffff : e.team !== MY ? 0xff6a50 : 0x9df08f);
  }
  for (let i = n; i < rings.length; i++) rings[i].visible = false;
  hctx.setTransform(DPR, 0, 0, DPR, 0, 0); hctx.clearRect(0, 0, W, H);
  const bar = (e, y, w) => {
    const p = toScreen(e.x, y, e.z); if (!p.ok || p.x < -40 || p.x > W + 40 || p.y < 0 || p.y > H) return;
    const k = clamp(e.hp / e.maxHp, 0, 1); hctx.fillStyle = '#000a'; hctx.fillRect(p.x - w / 2 - 1, p.y - 1, w + 2, 5);
    hctx.fillStyle = k > 0.5 ? '#7fd66f' : k > 0.25 ? '#e8c14a' : '#ee5a45'; hctx.fillRect(p.x - w / 2, p.y, w * k, 3);
  };
  for (const u of units) if (u.mesh.visible && (u.hp < u.maxHp - 0.5 || sel.includes(u))) bar(u, heightAt(u.x, u.z) + (u.def.cls === 'cav' ? 3.2 : 2.4), 22);
  for (const b of blds) if (b.mesh.visible && !(b.def.line && !sel.includes(b) && b.hp > b.maxHp * 0.99) && (b.hp < b.maxHp - 0.5 || sel.includes(b))) bar(b, b.y + 4.5, 20 + b.size * 10);
  const s0 = sel[0];
  if (s0 && s0.isB && s0.team === MY && s0.rally) { const p = toScreen(s0.rally.x, heightAt(s0.rally.x, s0.rally.z) + 0.3, s0.rally.z); if (p.ok) { hctx.strokeStyle = '#ffe08a'; hctx.lineWidth = 2; hctx.beginPath(); hctx.moveTo(p.x, p.y); hctx.lineTo(p.x, p.y - 18); hctx.stroke(); hctx.fillStyle = '#ffe08a'; hctx.fillRect(p.x, p.y - 18, 10, 7); } }
}
const FARM_TINT = [0x9fd070, 0xc4d868, 0xe6c35a, 0xf4f4f4];
let last = performance.now(), acc = 0, fogT = 0, uiT = 0, miniT = 0, baseT = 0, lastSeason = -1, snowShown = -1;
const STEP = 1 / 30;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (view.clientWidth !== W || view.clientHeight !== H) resize();
  netFrame(now, dt);
  const ps = cam.dist * 0.9 * dt;
  if (keys.KeyW || keys.ArrowUp) pan(0, ps); if (keys.KeyS || keys.ArrowDown) pan(0, -ps);
  if (keys.KeyA || keys.ArrowLeft) pan(-ps, 0); if (keys.KeyD || keys.ArrowRight) pan(ps, 0);
  if (keys.KeyQ) cam.yaw += dt * 1.4; if (keys.KeyE) cam.yaw -= dt * 1.4;
  if (!G.paused) {
    acc += dt * G.speed; let n = 0;
    while (G.mode !== 'guest' && acc >= STEP && n < 10 && !G.over) { simStep(STEP); acc -= STEP; n++; }
    if (n === 10 || G.mode === 'guest') acc = 0;
    const se = season();
    if (se !== lastSeason) {
      if (lastSeason >= 0) msg(['Jaro. Pole se znovu obdělávají.', 'Léto.', 'Podzim. Sklizeň je nejbohatší, chystej zásoby na zimu.', 'Zima. Pole nerodí, lidé jedí ze zásob.'][se], se === 3 ? 'bad' : '');
      lastSeason = se; farmMat.color.setHex(FARM_TINT[se]);
    }
    G.snow = clamp(G.snow + (se === 3 ? 1 : -1) * dt * G.speed * 0.12, 0, 1);
  }
  if (Math.abs(G.snow - snowShown) > 0.02 || (G.snow !== snowShown && (G.snow === 0 || G.snow === 1))) { snowShown = G.snow; applySnow(G.snow); baseT = 0; }
  if (now - fogT > 120) { fogT = now; updateFog(); }
  updatePuffs(dt);
  if (terrainDirty) { terrain.geometry.computeVertexNormals(); terrainDirty = false; }
  const t = now / 1000;
  for (const b of blds) if (b.team !== MY) { if (vis[cidx(cellOf(b.x), cellOf(b.z))]) b.seen = true; b.mesh.visible = !!b.seen; }
  if (G.real) {
    for (const b of blds) {
      if (b.fire > 0 && b.mesh.visible && Math.random() < dt * 9) { const ox = (Math.random() - 0.5) * b.size * 1.4, oz = (Math.random() - 0.5) * b.size * 1.4; puff(b.x + ox, b.y + 2.4 + Math.random() * 1.6, b.z + oz, Math.random() < 0.6 ? 0xff7a1e : 0xffc23a, 1.1, 0.8, 2.8); if (Math.random() < 0.5) puff(b.x + ox, b.y + 4.5, b.z + oz, 0x3a3632, 1.2, 2.4, 2.4); }
      else if (b.type === 'house' && b.done && b.mesh.visible && G.snow > 0.3 && Math.random() < dt * 0.35) puff(b.x - 0.9, b.y + 3.1, b.z - 0.4, 0xcfcac2, 0.35, 2.4, 1.1);
    }
    const snowing = G.snow > 0.25 && season() === 3, raining = !!G.rain;
    weather.visible = snowing || raining;
    if (weather.visible) {
      const wp = weather.geometry.attributes.position, a = wp.array, sp = raining ? 42 : 5, mt = weather.material;
      mt.size = raining ? 0.34 : 0.42; mt.color.setHex(raining ? 0xcfe2f0 : 0xffffff); mt.opacity = raining ? 0.75 : 0.9;
      for (let i = 1; i < a.length; i += 3) { a[i] -= sp * dt; if (a[i] < 0) a[i] += 45; if (!raining) a[i - 1] += Math.sin(t + i) * dt * 0.8; }
      wp.needsUpdate = true; weather.position.set(cam.x, 0, cam.z);
    }
    waterMesh.position.y = (G.flood || 0) + Math.sin(t * 0.9) * 0.035;
  } else if (waterMesh.position.y !== 0) waterMesh.position.y = 0;
  for (const a of animals) { const m = a.mesh; m.visible = !!vis[cidx(cellOf(a.x), cellOf(a.z))]; m.position.set(a.x, heightAt(a.x, a.z) + (a.moving ? Math.abs(Math.sin(t * 8 + a.id)) * 0.1 : 0), a.z); let d = a.face - m.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); m.rotation.y += d * Math.min(1, dt * 8); }
  for (const u of units) {
    const m = u.mesh, h = heightAt(u.x, u.z);
    if (u.team !== MY) m.visible = !!vis[cidx(cellOf(u.x), cellOf(u.z))];
    const wm = u.sick > 0 ? sickMat : unitMat; if (m.material !== wm) m.material = wm;
    m.position.set(u.x, h + (u.moving ? Math.abs(Math.sin(t * 9 + u.id)) * 0.13 : 0), u.z);
    let d = u.face - m.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); m.rotation.y += d * Math.min(1, dt * 12);
    m.rotation.x = u.working && u.def.cls !== 'siege' && u.def.cls !== 'cav' ? Math.max(0, Math.sin(t * 7 + u.id)) * 0.28 : 0;
  }
  for (let i = markers.length - 1; i >= 0; i--) { const k = markers[i]; k.t -= dt; if (k.t <= 0) { scene.remove(k.m); markers.splice(i, 1); } else { k.m.scale.setScalar(0.4 + k.t * 1.6); k.m.material.opacity = k.t / 0.6; } }
  updateCamera();
  drawWorldUI(now);
  renderer.render(scene, camera);
  if (now - uiT > 200) { uiT = now; refreshUI(); }
  if (now - baseT > 900) { baseT = now; drawMiniBase(); }
  if (now - miniT > 150) { miniT = now; drawMini(); }
}

function boot() {
  initScene(view);
  newGame(1);
  showSaveOffer();
  $('b-host').onclick = netHost; $('b-join').onclick = netJoin; netBoot();
  cam.x = ME().tcx; cam.z = ME().tcz + 4; if (view.clientWidth < 760) cam.dist = 84;
  document.addEventListener('gesturestart', e => e.preventDefault());
  resize(); applySnow(0); snowShown = 0;
  addEventListener('resize', resize);
  window.GAME = { G, teams, units, blds, cam };
  window.addEventListener('contextmenu', e => { if (placing) e.preventDefault(); });
  requestAnimationFrame(frame);
}
boot();
