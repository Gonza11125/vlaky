'use strict';
// Ovládání a rozhraní: nástroje, panely správy, krize, zprávy, mapka, ukládání, hlavní smyčka.

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const view = $('view'), hud = $('hud'), hx = hud.getContext('2d'), mini = $('mini'), mx = mini.getContext('2d');
const G = { speed: 1, acc: 0, playing: false, panel: null, cat: null, tool: { kind: 'select' }, hover: null, drag: null, demo: true, lastAuto: 0 };
const DAY_SEC = [0, 0.8, 0.32, 0.1];

// ---------- zprávy ----------
UIH.note = m => {
  if (!G.playing) return;
  const el = document.createElement('div'); el.className = 'note ' + m.cls + (m.k >= 0 ? ' jump' : ''); el.textContent = m.text;
  if (m.k >= 0) el.onclick = () => focusTile(m.k % N, (m.k / N) | 0);
  const f = $('feed'); f.appendChild(el); while (f.children.length > 5) f.firstChild.remove();
  setTimeout(() => el.remove(), m.cls === 'tip' ? 11000 : 8000);
};
function toast(text, cls) { UIH.note({ text, cls: cls || '', k: -1 }); }
function focusTile(x, y) { cam.x = tileX(x); cam.z = tileZ(y); if (cam.dist > 160) cam.dist = 120; }

// ---------- nástroje ----------
const CAT_COL = { power: '#c99a2e', water: '#3d7fb8', safety: '#2c4f8f', health: '#b84a5f', edu: '#c47a2a', fun: '#4f8a3f', trans: '#6a7682', gov: '#7a66a8' };
const RAIL = [
  { key: 'select', name: 'Prohlížet', sw: '#ffffff' }, { key: 'road', name: 'Silnice', sw: '#5a5f69' }, { key: 'zones', name: 'Zóny', sw: '#6fbf5a' },
  ...SERV_CATS.map(c => ({ key: 'cat:' + c.key, name: c.name, sw: CAT_COL[c.key] })),
  { key: 'demolish', name: 'Bourat', sw: '#e0483a' }, { key: 'maps', name: 'Mapy', sw: '#a184dd' },
];
function drawRail() {
  $('tools').innerHTML = RAIL.map(r => '<button class="tool' + (railOn(r.key) ? ' on' : '') + '" data-k="' + r.key + '"><span class="sw" style="background:' + r.sw + '"></span>' + r.name + '</button>').join('');
}
function railOn(key) { const t = G.tool; if (key === 'select') return t.kind === 'select' && !G.cat; if (key === 'road') return t.kind === 'road'; if (key === 'demolish') return t.kind === 'demolish'; return G.cat === key; }
$('tools').onclick = e => {
  const b = e.target.closest('.tool'); if (!b) return; const k = b.dataset.k;
  if (k === 'select' || k === 'road' || k === 'demolish') { setTool({ kind: k }); G.cat = null; }
  else G.cat = G.cat === k ? null : k;
  drawRail(); drawSub();
};
function setTool(t) { G.tool = t; G.drag = null; showPreview([]); showGhost(null); if (t.kind === 'select') { G.cat = G.cat === 'maps' ? 'maps' : null; } drawRail(); drawToolChip(); }
// štítek aktivního nástroje (hlavně pro dotyk): co dělá a tlačítko Hotovo
function drawToolChip() {
  const c = $('toolchip'), t = G.tool; if (!G.playing || t.kind === 'select') { c.hidden = true; return; }
  const name = t.kind === 'road' ? 'Silnice' : t.kind === 'zone' ? ZONES[t.z].short + (t.d ? ' – hustá' : ' – řídká') : t.kind === 'dezone' ? 'Zrušit zónu' : t.kind === 'demolish' ? 'Bourat' : SERV[t.type].name;
  const touch = RS.coarse || window.innerWidth < 860, drag = t.kind !== 'build' || SERV[t.type].line;
  c.innerHTML = '<span><b>' + name + '</b> <small>' + (touch ? (drag ? 'táhni prstem, mapu posuneš dvěma' : 'klepni na místo stavby') : (drag ? 'táhni myší, Esc ukončí' : 'klikni na místo, Esc ukončí')) + '</small></span><button class="btn pri" id="tc-done">Hotovo</button>';
  c.hidden = false; $('tc-done').onclick = () => { setTool({ kind: 'select' }); G.cat = null; drawRail(); drawSub(); };
}
function drawSub() {
  const s = $('sub'); if (!G.cat) { s.hidden = true; return; } s.hidden = false;
  let h = '';
  if (G.cat === 'zones') {
    h = '<h3>Zóny</h3><p style="margin:0 0 8px;color:var(--ink2);font-size:12.5px">Táhni přes mapu. Zóny jsou zdarma, stavět začnou lidé a firmy, až bude elektřina, voda a silnice.</p>';
    for (const z of [1, 2, 3, 4]) for (const d of [0, 1]) { const on = G.tool.kind === 'zone' && G.tool.z === z && G.tool.d === d;
      h += '<button class="opt' + (on ? ' on' : '') + '" data-zone="' + z + d + '"><span class="sw" style="background:' + ZONES[z].color + ';opacity:' + (d ? 1 : 0.55) + '"></span><b>' + ZONES[z].short + (d ? ' – hustá' : ' – řídká') + '</b><span class="c">zdarma</span>' + (d ? '' : '<em>' + ZONES[z].desc + '</em>') + '</button>'; }
    h += '<button class="opt' + (G.tool.kind === 'dezone' ? ' on' : '') + '" data-zone="0"><span class="sw" style="background:#cfc8b8"></span><b>Zrušit zónu</b><span class="c"></span></button>';
  } else if (G.cat === 'maps') {
    h = '<h3>Přehledové mapy</h3>' + '<button class="opt' + (!RS.overlay ? ' on' : '') + '" data-ov=""><span class="sw" style="background:#fff"></span><b>Bez mapy</b><span></span></button>';
    for (const k in OVERLAYS) h += '<button class="opt' + (RS.overlay === k ? ' on' : '') + '" data-ov="' + k + '"><span class="sw" style="background:#a184dd"></span><b>' + OVERLAYS[k].name + '</b><span></span></button>';
  } else {
    const cat = G.cat.slice(4), c = SERV_CATS.find(c => c.key === cat);
    h = '<h3>' + c.name + '</h3>';
    for (const t in SERV) { const d = SERV[t]; if (d.cat !== cat || t === 'townhall' && [...blds.values()].some(b => b.type === 'townhall')) continue;
      const lock = d.req && !S.techs[d.req], on = G.tool.kind === 'build' && G.tool.type === t;
      h += '<button class="opt' + (on ? ' on' : '') + (lock ? ' lock' : '') + '" data-b="' + t + '"><span class="sw" style="background:' + CAT_COL[cat] + '"></span><b>' + d.name + '</b><span class="c num">' + money(d.cost) + '</span><em>' + (lock ? 'Vyžaduje výzkum: ' + TECHS[d.req].name + '. ' : '') + d.desc + ' Provoz ' + money(d.up) + ' měsíčně.' + (d.size > 1 ? ' Zabere ' + d.size + '×' + d.size + ' políček.' : '') + '</em></button>'; }
  }
  s.innerHTML = h;
}
$('sub').onclick = e => {
  const z = e.target.closest('[data-zone]'), b = e.target.closest('[data-b]'), ov = e.target.closest('[data-ov]');
  if (z) { const v = z.dataset.zone; setTool(v === '0' ? { kind: 'dezone' } : { kind: 'zone', z: +v[0], d: +v[1] }); G.cat = 'zones'; }
  if (b) { const t = b.dataset.b, d = SERV[t]; if (d.req && !S.techs[d.req]) { toast('Nejdřív vyzkoumej: ' + TECHS[d.req].name + '.', 'bad'); return; } setTool({ kind: 'build', type: t }); G.cat = 'cat:' + d.cat; }
  if (ov) { setOverlay(ov.dataset.ov || null); }
  drawRail(); drawSub();
  if (window.innerWidth < 860 && (z || b)) $('sub').hidden = true;
};
function setOverlay(k) { RS.overlay = k; updateOverlay(); const o = $('ovbar'); o.hidden = !k; if (k) o.innerHTML = '<b>' + OVERLAYS[k].name + '</b><button class="btn" id="ovx">Skrýt</button>'; if (k) $('ovx').onclick = () => { setOverlay(null); drawSub(); }; }

// ---------- výběr oblasti tahem ----------
function lineCells(a, b) {
  const out = [], hor = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y), corner = hor ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
  const seg = (p, q) => { const dx = Math.sign(q.x - p.x), dy = Math.sign(q.y - p.y); let x = p.x, y = p.y; for (let n = 0; n < 200; n++) { out.push({ x, y }); if (x === q.x && y === q.y) break; x += dx; y += dy; } };
  seg(a, corner); out.pop(); seg(corner, b);
  return out.filter(c => inb(c.x, c.y));
}
function rectCells(a, b) { const out = []; for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) if (inb(x, y)) out.push({ x, y }); return out.slice(0, 1600); }
function previewCells(a, b) {
  const t = G.tool; let cells = [], cost = 0;
  if (t.kind === 'road' || (t.kind === 'build' && SERV[t.type].line)) {
    cells = lineCells(a, b).map(c => { const k = idx(c.x, c.y); if (t.kind === 'build') { const ok = !servProblem(t.type, c.x, c.y); if (ok) cost += SERV[t.type].cost; return { ...c, col: ok ? 0x8f99a3 : 0xe0483a }; }
      if (road[k]) return null; const bad = bld[k]; if (!bad) cost += ter[k] === 1 ? BRIDGE_COST : ROAD_COST + (lvl[k] ? DEMOLISH_COST : 0); return { ...c, col: bad ? 0xe0483a : ter[k] === 1 ? 0x4a7fd9 : 0x5a5f69 }; }).filter(Boolean);
  } else if (t.kind === 'zone') {
    cells = rectCells(a, b).map(c => { const k = idx(c.x, c.y); if (ter[k] === 1 || road[k] || bld[k]) return null; return { ...c, col: ZONES[t.z].hex }; }).filter(Boolean);
  } else if (t.kind === 'dezone' || t.kind === 'demolish') {
    cells = rectCells(a, b).map(c => { const k = idx(c.x, c.y); const any = t.kind === 'dezone' ? zone[k] : (road[k] || bld[k] || zone[k] || ruin[k] || ter[k] === 3); if (!any) return null; if (t.kind === 'demolish' && (lvl[k] || road[k] || bld[k] || ruin[k])) cost += DEMOLISH_COST; return { ...c, col: 0xe0483a }; }).filter(Boolean);
  }
  showPreview(cells); G.dragCost = cost; G.dragCells = cells;
}
function applyDrag() {
  const t = G.tool, cells = G.dragCells || []; let n = 0, poor = false, err = null;
  if (t.kind === 'road') for (const c of cells) { const r = buildRoad(c.x, c.y); if (r === -1) { poor = true; break; } if (r > 0) n++; }
  else if (t.kind === 'zone') for (const c of cells) { const r = setZone(c.x, c.y, t.z, t.d); if (r === -1) { poor = true; break; } if (r > 0) n++; }
  else if (t.kind === 'dezone') for (const c of cells) { if (zone[idx(c.x, c.y)]) { const e = demolish(c.x, c.y); if (!e) n++; } }
  else if (t.kind === 'demolish') { const done = new Set(); for (const c of cells) { const k = idx(c.x, c.y); if (bld[k]) { if (done.has(bld[k])) continue; done.add(bld[k]); } const e = demolish(c.x, c.y); if (e && cells.length === 1) err = e; else if (!e) n++; } }
  else if (t.kind === 'build') for (const c of cells) { const r = placeServ(t.type, c.x, c.y); if (typeof r === 'string') { if (cells.length === 1) err = r; if (r.startsWith('Nemáš')) { poor = true; break; } } else n++; }
  if (poor) toast('Došly peníze.', 'bad'); if (err) toast(err, 'bad');
  showPreview([]); G.dragCells = null; refreshNow();
}

// ---------- ukazatel ----------
const ptrs = new Map(); let pinch = null;
view.addEventListener('contextmenu', e => e.preventDefault());
view.addEventListener('pointerdown', e => {
  if (!G.playing) return;
  try { view.setPointerCapture(e.pointerId); } catch (_) { }
  ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; G.drag = null; showPreview([]); return; }
  const touch = e.pointerType !== 'mouse', btn = e.button;
  const g = pickGround(e.offsetX, e.offsetY);
  let mode = 'tool';
  if (!touch && btn === 2) mode = 'pan'; else if (!touch && btn === 1) mode = 'rotate';
  else if (G.tool.kind === 'select' || (G.tool.kind === 'build' && !SERV[G.tool.type].line)) mode = 'click';
  G.drag = { mode, x0: e.offsetX, y0: e.offsetY, x: e.offsetX, y: e.offsetY, moved: false, a: g && g.ok ? { x: g.x, y: g.y } : null, touch };
  if (mode === 'tool' && G.drag.a) previewCells(G.drag.a, G.drag.a);
});
view.addEventListener('pointermove', e => {
  const px = e.offsetX, py = e.offsetY;
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: px, y: py });
  if (pinch && ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x), mxx = (a.x + b.x) / 2, myy = (a.y + b.y) / 2;
    if (d > 20) cam.dist *= pinch.d / d; cam.yaw -= ang - pinch.ang; panBy(mxx - pinch.mx, myy - pinch.my);
    pinch = { d, ang, mx: mxx, my: myy }; return;
  }
  const g = pickGround(px, py); G.hover = g && g.ok ? g : null;
  const dr = G.drag;
  if (dr) {
    const dx = px - dr.x, dy = py - dr.y; dr.x = px; dr.y = py;
    if (!dr.moved && Math.hypot(px - dr.x0, py - dr.y0) > (dr.touch ? 10 : 5)) dr.moved = true;
    if (dr.mode === 'pan' || (dr.mode === 'click' && dr.moved)) { dr.mode = dr.mode === 'click' ? 'pan' : dr.mode; panBy(dx, dy); }
    else if (dr.mode === 'rotate') { cam.yaw -= dx * 0.008; cam.pitch += dy * 0.006; }
    else if (dr.mode === 'tool' && dr.a && G.hover) previewCells(dr.a, G.hover);
  }
  updateHoverVisuals();
});
function pointerEnd(e) {
  ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
  const dr = G.drag; if (!dr || ptrs.size) { if (!ptrs.size) G.drag = null; return; }
  G.drag = null; if (e.type === 'pointercancel') { showPreview([]); return; }
  if (dr.mode === 'tool' && dr.a) applyDrag();
  else if (dr.mode === 'click' && !dr.moved) {
    const g = pickGround(e.offsetX, e.offsetY); if (!g || !g.ok) return;
    if (G.tool.kind === 'select') openInfo(g.x, g.y);
    else if (G.tool.kind === 'build') { const s = SERV[G.tool.type].size, x = g.x - ((s - 1) >> 1), y = g.y - ((s - 1) >> 1); const r = placeServ(G.tool.type, x, y); if (typeof r === 'string') toast(r, 'bad'); else { toast(SERV[G.tool.type].name + ': stavba začala.', 'good'); refreshNow(); } }
  }
}
view.addEventListener('pointerup', pointerEnd); view.addEventListener('pointercancel', pointerEnd);
view.addEventListener('pointerleave', () => { G.hover = null; updateHoverVisuals(); });
view.addEventListener('wheel', e => { e.preventDefault(); cam.dist *= Math.exp(e.deltaY * 0.0011); }, { passive: false });
function panBy(dx, dy) {
  const k = 2 * cam.dist * Math.tan(camera.fov * Math.PI / 360) / VH, sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw), sp = Math.max(0.5, Math.sin(cam.pitch));
  cam.x += -dx * k * cy - dy * k * sy / sp; cam.z += dx * k * sy - dy * k * cy / sp;
}
function updateHoverVisuals() {
  const h = G.hover, t = G.tool;
  if (!h) { showCursor(-1); if (t.kind === 'build') showGhost(null); return; }
  if (t.kind === 'build') { const s = SERV[t.type].size, x = h.x - ((s - 1) >> 1), y = h.y - ((s - 1) >> 1); showGhost(t.type, x, y, !servProblem(t.type, x, y)); showCursor(x, y, s, servProblem(t.type, x, y) ? 0xff6655 : 0xffffff); }
  else showCursor(h.x, h.y, 1, t.kind === 'demolish' ? 0xff6655 : 0xffffff);
}
const keys = {};
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  keys[e.code] = true;
  if (!G.playing) return;
  if (e.code === 'Space') { e.preventDefault(); setSpeed(G.speed ? 0 : (G.lastSpeed || 1)); }
  if (e.code === 'Digit1') setSpeed(1); if (e.code === 'Digit2') setSpeed(2); if (e.code === 'Digit3') setSpeed(3);
  if (e.code === 'Escape') { if (G.tool.kind !== 'select') { setTool({ kind: 'select' }); drawSub(); } else if (G.panel) closePanel(); else { G.cat = null; drawRail(); drawSub(); } }
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// ---------- horní lišta ----------
document.querySelectorAll('.sp').forEach(b => b.onclick = () => setSpeed(+b.dataset.s));
function setSpeed(s) { if (s) G.lastSpeed = s; G.speed = s; document.querySelectorAll('.sp').forEach(b => b.classList.toggle('on', +b.dataset.s === s)); }
function meterCol(v) { return v >= 60 ? 'var(--good)' : v >= 40 ? 'var(--warn)' : 'var(--bad)'; }
function updateTop() {
  $('t-name').textContent = S.name; $('t-date').textContent = dateStr(S.day);
  $('t-money').textContent = money(S.money); $('t-money').className = 'num' + (S.money < 0 ? ' neg' : '');
  const net = S.last ? S.last.net : 0; $('t-net').textContent = (net >= 0 ? '+' : '') + money(net) + '/měs.'; $('t-net').className = 'num ' + (net >= 0 ? 'pos' : 'neg');
  $('t-pop').textContent = fmt(T.pop); $('t-unemp').textContent = 'bez práce ' + Math.round(T.unemp * 100) + ' %'; $('t-unemp').className = 'num ' + (T.unemp > 0.08 ? 'neg' : '');
  $('t-happy').textContent = Math.round(S.happy) + ' %'; $('m-happy').style.cssText = 'width:' + S.happy + '%;background:' + meterCol(S.happy);
  $('t-appr').textContent = Math.round(S.approval) + ' %'; $('m-appr').style.cssText = 'width:' + S.approval + '%;background:' + meterCol(S.approval);
  const n = S.inc.length; $('b-crisis').hidden = !n; $('b-crisis').textContent = n;
  let d = ''; for (const z of [1, 2, 3, 4]) { const v = T.dem[z], h = Math.abs(v) * 50; d += '<div class="d"><div class="bar"><span style="background:' + (v >= 0 ? ZONES[z].color : '#e0483a') + ';height:' + h + '%;' + (v >= 0 ? 'bottom:50%' : 'top:50%') + '"></span></div><small style="color:' + ZONES[z].color + '">' + ZONES[z].key + '</small></div>'; }
  $('demand').innerHTML = d;
}

// ---------- panely ----------
const PANELS = {};
document.querySelectorAll('.tab').forEach(b => b.onclick = () => { document.body.classList.remove('tabsopen'); G.panel === b.dataset.p ? closePanel() : openPanel(b.dataset.p); });
$('b-manage').onclick = () => { const o = document.body.classList.toggle('tabsopen'); $('b-manage').setAttribute('aria-expanded', o); if (o) { G.cat = null; drawRail(); drawSub(); } };
$('b-mini').onclick = () => { document.body.classList.toggle('minion'); };
$('pclose').onclick = closePanel;
function openPanel(p, arg) { G.panel = p; G.parg = arg; $('panel').hidden = false; document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.p === p)); renderPanel(); if (window.innerWidth < 860) { G.cat = null; drawRail(); drawSub(); } }
function closePanel() { G.panel = null; $('panel').hidden = true; document.querySelectorAll('.tab').forEach(b => b.classList.remove('on')); }
function renderPanel() { const P = PANELS[G.panel]; if (!P) return; $('ptitle').textContent = P.title(G.parg); $('pbody').onclick = null; $('pbody').innerHTML = P.html(G.parg); if (P.bind) P.bind(G.parg); }
function livePanel() { const P = PANELS[G.panel]; if (!P) return; if (P.live) P.live(G.parg); else if (!P.static) { const sc = $('pbody').scrollTop; renderPanel(); $('pbody').scrollTop = sc; } }
function refreshNow() { updateTop(); if (G.panel && PANELS[G.panel] && !PANELS[G.panel].live) livePanel(); }
const row = (a, b, cls) => '<div class="row"><span>' + a + '</span><b class="' + (cls || '') + '">' + b + '</b></div>';
const pct = v => Math.round(v) + ' %';
const pill = (t, c) => '<span class="pill ' + (c || '') + '">' + t + '</span>';
function meter(v, col) { return '<div class="meter" style="width:100%;height:8px"><span style="width:' + clamp(v, 0, 100) + '%;background:' + (col || meterCol(v)) + '"></span></div>'; }

// informace o políčku
PANELS.info = {
  title: a => { const k = idx(a.x, a.y); if (bld[k]) return SERV[blds.get(bld[k]).type].name; if (road[k]) return ter[k] === 1 ? 'Most' : 'Silnice'; if (zone[k]) return ZONES[zone[k]].name; return ter[k] === 1 ? 'Voda' : ter[k] === 3 ? 'Les' : ter[k] === 4 ? 'Pole' : ter[k] === 5 ? 'Zahrada' : 'Volný pozemek'; },
  html: a => {
    const k = idx(a.x, a.y); let h = '';
    if (bld[k]) {
      const b = blds.get(bld[k]), d = SERV[b.type];
      h += '<p>' + d.desc + '</p><h4>Stav</h4>';
      if (b.built < 1) h += row('Stavba', pct(b.built * 100)); else if (!b.ok) h += row('Provoz', b.off > 0 ? 'mimo provoz ' + b.off + ' dní' : 'chybí silnice', 'neg'); else h += row('Provoz', b.flooded ? 'pod vodou' : 'v pořádku', b.flooded ? 'neg' : 'pos');
      if (d.power) h += row('Výkon', fmt(b.out || 0) + ' MW');
      if (d.water && b.type === 'pump') h += row('Voda', fmt(d.water * (nearWater(b.x, b.y, 1, 2) ? 1.5 : 1)) + ' m³');
      if (d.r && d.r < 30) h += row('Dosah', d.r + ' políček');
      if (d.police) h += row('Policistů', d.police); if (d.army) h += row('Vojáků', d.army); if (d.trade) h += row('Obchodní kapacita', fmt(d.trade) + ' t/měs.'); if (d.rp) h += row('Výzkum', d.rp + ' bodů/měs.');
      if (d.garbage) h += row('Odpad', 'pro ' + fmt(d.garbage) + ' lidí');
      h += row('Provoz', money(d.up * (BUD_OF[b.type] ? S.bud[BUD_OF[b.type]] / 100 : 1)) + '/měs.');
      if (b.type !== 'townhall') h += '<div class="btns"><button class="btn dan" id="i-demo">Zbořit (' + money(DEMOLISH_COST * b.size) + ')</button></div>';
      return h;
    }
    if (road[k]) return row('Provoz', traf[k] > 1.1 ? 'zácpy' : traf[k] > 0.6 ? 'hustý' : 'plynulý', traf[k] > 1.1 ? 'neg' : '') + row('Propojeno s dálnicí', conn[k] ? 'ano' : 'ne', conn[k] ? '' : 'neg') + '<div class="btns"><button class="btn dan" id="i-demo">Zbořit</button></div>';
    if (zone[k]) {
      const z = zone[k], c = lvl[k] ? capOf(k) : 0;
      h += row('Hustota', dens[k] ? 'hustá zástavba' : 'řídká zástavba') + row('Úroveň budovy', lvl[k] ? lvl[k] + ' z ' + (dens[k] ? (S.techs.skyscraper ? 5 : 4) : 3) : 'prázdná parcela');
      if (lvl[k]) h += row(z === 1 ? 'Obyvatelé' : 'Zaměstnanci', fmt(occ[k]) + ' / ' + fmt(c));
      if (z === 3 && lvl[k]) h += row('Výroba', SPEC[spec[k]]);
      const probs = [];
      if (!acc[k]) probs.push('Daleko od silnice napojené na dálnici.'); if (acc[k] && !pw[k]) probs.push('Chybí elektřina.'); if (acc[k] && !wt[k]) probs.push('Chybí voda.');
      if (aband[k]) probs.push('Budova je opuštěná.'); if (flood[k]) probs.push('Pod vodou.'); if (fire[k]) probs.push('Hoří!');
      if (!lvl[k] && !probs.length) probs.push(T.dem[z] > 0 ? 'Čeká se na stavitele.' : 'O tuhle zónu teď není zájem.');
      if (lvl[k] && lvl[k] < (dens[k] ? 5 : 3) && lv[k] < LV_NEED[dens[k]][lvl[k] + 1]) probs.push('K vyšší budově je potřeba hodnota pozemku ' + LV_NEED[dens[k]][lvl[k] + 1] + '. Pomůže park, služby a méně znečištění.');
      h += '<h4>Okolí</h4>' + row('Cena pozemku', Math.round(lv[k])) + row('Znečištění', Math.round(poll[k]), poll[k] > 30 ? 'neg' : '') + row('Kriminalita', Math.round(crime[k]), crime[k] > 30 ? 'neg' : '');
      if (z === 1 && lvl[k]) h += row('Spokojenost', pct(hap[k])) + row('Vzdělanost', pct(eduT[k] * 100));
      h += row('Policie / hasiči', pct(Math.min(1, cov.police[k]) * 100) + ' / ' + pct(Math.min(1, cov.fire[k]) * 100)) + row('Zdravotnictví / školy', pct(Math.min(1, cov.health[k]) * 100) + ' / ' + pct(Math.min(1, cov.edu[k]) * 100));
      if (fpl[k]) h += '<p>Leží v záplavovém území.</p>';
      if (probs.length) h += '<h4>Poznámky</h4>' + probs.map(p => '<p>' + p + '</p>').join('');
      return h;
    }
    h += row('Cena pozemku', Math.round(lv[k])) + row('Znečištění', Math.round(poll[k]));
    if (fpl[k]) h += '<p>Záplavové území u řeky. Při povodni sem dojde voda, pokud ji nezastaví hráz.</p>';
    if (ter[k] === 3) h += '<p>Les. Při stavbě se vykácí.</p>';
    if (ter[k] === 4) h += '<p>Pole. Při stavbě se zastaví.</p>';
    if (ter[k] === 5) h += '<p>Zahrada. Při stavbě zmizí.</p>';
    return h;
  },
  bind: a => { const b = $('i-demo'); if (b) b.onclick = () => { const e = demolish(a.x, a.y); if (e) toast(e, 'bad'); closePanel(); refreshNow(); }; },
};
function openInfo(x, y) { openPanel('info', { x, y }); }

PANELS.budget = {
  title: () => 'Rozpočet', static: true,
  html: () => {
    let h = '<h4>Daně</h4><p>Vyšší daně dají víc peněz, ale lidé a firmy je nemají rádi. Prudké zvýšení vyvolá demonstrace.</p>';
    for (const z of ['R', 'C', 'I', 'O']) { const zz = { R: 1, C: 2, I: 3, O: 4 }[z]; h += '<div class="slider"><label for="tx' + z + '">' + ZONES[zz].name + '</label><output id="otx' + z + '">' + S.tax[z] + ' %</output><input type="range" id="tx' + z + '" min="0" max="25" value="' + S.tax[z] + '"></div>'; }
    h += '<h4>Rozpočet služeb</h4><p>Pod 100 % služby slábnou, nad 100 % pracují lépe a víc stojí.</p>';
    const BN = { police: 'Policie a tajná služba', fire: 'Hasiči', health: 'Zdravotnictví', edu: 'Školství a výzkum', transit: 'Městská doprava', army: 'Armáda', parks: 'Parky a sport' };
    for (const c in BN) h += '<div class="slider"><label for="bd' + c + '">' + BN[c] + '</label><output id="obd' + c + '">' + S.bud[c] + ' %</output><input type="range" id="bd' + c + '" min="50" max="150" step="5" value="' + S.bud[c] + '"></div>';
    h += '<h4>Minulý měsíc</h4><div id="b-last"></div><h4>Úvěry</h4><div id="b-loan"></div>';
    return h;
  },
  bind: () => {
    for (const z of ['R', 'C', 'I', 'O']) $('tx' + z).oninput = e => { S.tax[z] = +e.target.value; $('otx' + z).textContent = S.tax[z] + ' %'; };
    for (const c in S.bud) { const el = $('bd' + c); if (el) el.oninput = e => { S.bud[c] = +e.target.value; $('obd' + c).textContent = S.bud[c] + ' %'; covDirty = true; }; }
    PANELS.budget.live();
  },
  live: () => {
    const L = S.last; let h = '';
    if (!L) h = '<p>První vyúčtování bude na konci měsíce.</p>';
    else {
      const I = L.inc, E = L.exp, ITEMS = [['Daně z bydlení', I.R], ['Daně z obchodů', I.C], ['Daně z průmyslu', I.I], ['Daně z kanceláří', I.O], ['Prodej elektřiny', I.power], ['Cestovní ruch', I.tourism], ['Recyklace', I.recycle || 0], ['Obchod se zbožím', L.trade.net]];
      for (const [a, v] of ITEMS) if (Math.abs(v) >= 1) h += row(a, (v >= 0 ? '+' : '') + money(v), v >= 0 ? 'pos' : 'neg');
      for (const [a, v] of [['Provoz služeb', E.services], ['Správa města', E.admin], ['Údržba silnic', E.roads], ['Vyhlášky', E.policies], ['Úroky', E.loan]]) if (v >= 1) h += row(a, '−' + money(v), 'neg');
      h += row('<b>Celkem</b>', (L.net >= 0 ? '+' : '') + money(L.net), L.net >= 0 ? 'pos' : 'neg');
    }
    $('b-last').innerHTML = h;
    $('b-loan').innerHTML = row('Dluh', money(S.loan)) + '<div class="btns"><button class="btn" data-l="1000000">Půjčit 1 mil.</button><button class="btn" data-l="5000000">Půjčit 5 mil.</button><button class="btn" data-l="20000000">Půjčit 20 mil.</button>' + (S.loan ? '<button class="btn" data-r="1000000">Splatit 1 mil.</button><button class="btn" data-r="all">Splatit vše</button>' : '') + '</div>';
    $('b-loan').onclick = e => { const b = e.target.closest('button'); if (!b) return; const err = b.dataset.l ? takeLoan(+b.dataset.l) : repayLoan(b.dataset.r === 'all' ? S.loan : +b.dataset.r); if (err) toast(err, 'bad'); PANELS.budget.live(); updateTop(); };
  },
};

PANELS.trade = {
  title: () => 'Obchod', static: true,
  html: () => '<p>Továrny vyrábějí, obyvatelé, obchody, kanceláře a elektrárny spotřebovávají. Přebytky můžeš prodat, nedostatek se dováží dráž. Kapacitu zvýší nádraží, přístav, letiště a výzkum Logistiky.</p><div id="tr-cap"></div><div style="overflow-x:auto"><table class="tbl" id="tr-tbl"></table></div><h4>Ruční obchod</h4><div id="tr-man"></div><h4>Smlouvy</h4><div id="tr-con"></div>',
  bind: () => {
    PANELS.trade.live();
    $('tr-man').onclick = e => { const b = e.target.closest('button'); if (!b) return; const err = tradeNow(b.dataset.g, +b.dataset.q, b.dataset.buy === '1'); if (err) toast(err, 'bad'); PANELS.trade.live(); updateTop(); };
    $('tr-tbl').onchange = e => { const s = e.target.closest('select'); if (s) S.auto[s.dataset.g] = s.value; };
  },
  live: () => {
    const L = S.last && S.last.trade;
    $('tr-cap').innerHTML = row('Obchodní kapacita', fmt(S.tradeUsed) + ' / ' + fmt(T.trade) + ' t měsíčně') + row('Sklady', 'do ' + fmt(T.store) + ' od každé suroviny');
    let t = '<tr><th>Surovina</th><th class="r">Sklad</th><th class="r">Výroba</th><th class="r">Spotřeba</th><th class="r">Cena</th><th>Přebytky</th></tr>';
    for (const g of GOOD_KEYS) { const G0 = GOODS[g], pr = S.price[g], tr = pr > G0.price * 1.08 ? ' ▲' : pr < G0.price * 0.92 ? ' ▼' : '';
      t += '<tr><td>' + G0.name + (S.short[g] ? ' ' + pill('chybí', 'bad') : '') + '</td><td class="r">' + fmt(S.stock[g]) + '</td><td class="r">' + (L ? fmt(L.prod[g]) : '–') + '</td><td class="r">' + (L ? fmt(L.cons[g]) : '–') + '</td><td class="r">' + fmt(pr) + tr + '</td><td><select class="sel" data-g="' + g + '"><option value="sell"' + (S.auto[g] === 'sell' ? ' selected' : '') + '>prodávat</option><option value="keep"' + (S.auto[g] === 'keep' ? ' selected' : '') + '>skladovat</option></select></td></tr>'; }
    const tbl = $('tr-tbl'); if (!tbl.contains(document.activeElement)) tbl.innerHTML = t;
    let m = ''; for (const g of GOOD_KEYS) m += '<div class="row"><span>' + GOODS[g].name + '</span><span class="btns" style="margin:0"><button class="btn" data-g="' + g + '" data-q="100" data-buy="1">Koupit 100</button><button class="btn" data-g="' + g + '" data-q="100">Prodat 100</button><button class="btn" data-g="' + g + '" data-q="500">Prodat 500</button></span></div>';
    $('tr-man').innerHTML = m;
    $('tr-con').innerHTML = S.nb.filter(n => n.contract).map(n => row(n.name, (n.contract.sell ? 'prodej ' : 'nákup ') + n.contract.q + ' t ' + GOODS[n.contract.g].name.toLowerCase() + ', ještě ' + n.contract.months + ' měs.')).join('') || '<p>Žádné smlouvy. Uzavřeš je v záložce Sousedé.</p>';
  },
};

PANELS.research = {
  title: () => 'Rozvoj a výzkum',
  html: () => {
    const rp = T.rp + T.fil[4] * 0.003;
    let h = row('Výzkum měsíčně', fmt(rp) + ' bodů') + row('Naspořeno', fmt(S.rp) + ' bodů');
    if (S.research) { const t = TECHS[S.research]; h += '<h4>Právě se zkoumá</h4><div class="tech cur"><b>' + t.name + '</b><span class="num">' + fmt(S.rp) + ' / ' + t.cost + '</span><p>' + t.desc + '</p></div>' + meter(S.rp / t.cost * 100, 'var(--accent)'); }
    if (rp < 1) h += '<p>Výzkum dělají školy, univerzita, výzkumný ústav a kanceláře. Postav aspoň základní školu.</p>';
    const cats = [...new Set(Object.values(TECHS).map(t => t.cat))];
    for (const c of cats) { h += '<h4>' + c + '</h4>'; for (const id in TECHS) { const t = TECHS[id]; if (t.cat !== c) continue;
      const done = S.techs[id], cur = S.research === id, miss = (t.req || []).filter(r => !S.techs[r]);
      h += '<div class="tech' + (done ? ' done' : cur ? ' cur' : '') + '"><b>' + t.name + '</b><span>' + (done ? pill('hotovo', 'good') : cur ? pill('zkoumá se', 'warn') : miss.length ? pill('nejdřív ' + miss.map(r => TECHS[r].name).join(', ')) : '<button class="btn pri" data-t="' + id + '">Zkoumat · ' + t.cost + '</button>') + '</span><p>' + t.desc + '</p></div>'; } }
    return h;
  },
  bind: () => { $('pbody').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; const err = setResearch(b.dataset.t); if (err) toast(err, 'bad'); renderPanel(); }; },
};

PANELS.policy = {
  title: () => 'Vyhlášky',
  html: () => {
    let h = row('Svoboda', pct(S.freedom)) + meter(S.freedom) + '<p>Některé vyhlášky omezují svobody. Lidé to nesou těžce a radikálů přibývá.</p>';
    for (const id in POLICIES) { const p = POLICIES[id], lock = p.req && !S.techs[p.req], c = p.cost * T.pop / 1000;
      h += '<div class="toggle"><b>' + p.name + (POLICY_FREEDOM[id] ? ' ' + pill('svoboda ' + POLICY_FREEDOM[id], 'warn') : '') + '</b><button class="sw2' + (S.pol[id] ? ' on' : '') + '" data-p="' + id + '" aria-label="' + p.name + '"' + (lock ? ' disabled' : '') + '></button><p>' + p.desc + (c ? ' Stojí ' + money(c) + ' měsíčně.' : '') + (lock ? ' Vyžaduje výzkum: ' + TECHS[p.req].name + '.' : '') + '</p></div>'; }
    return h;
  },
  bind: () => { $('pbody').onclick = e => { const b = e.target.closest('[data-p]'); if (!b) return; const err = togglePolicy(b.dataset.p); if (err) toast(err, 'bad'); renderPanel(); }; },
};

PANELS.security = {
  title: () => 'Bezpečnost',
  html: () => {
    const need = Math.ceil(T.pop / 450);
    let h = '<h4>Policie</h4>' + row('Kriminalita', pct(S.crime), S.crime > 30 ? 'neg' : '') + meter(100 - S.crime) + row('Policistů', fmt(T.officers) + ' (doporučeno ' + fmt(need) + ')', T.officers < need * 0.8 ? 'neg' : '') + row('Rozpočet policie', S.bud.police + ' %');
    h += '<h4>Extremismus</h4>' + row('Radikalizace', pct(S.radical), S.radical > 35 ? 'neg' : '') + meter(100 - S.radical) + row('Tajná služba', T.intel ? 'pracuje' : 'není') + '<p>Radikály živí nezaměstnanost, nespokojenost a omezování svobod. Tajná služba odhalí část útoků předem.</p>';
    h += '<h4>Armáda</h4>';
    if (!T.army) h += '<p>Město nemá vojenskou základnu. Ve válce ho brání jen policie, převrat ale nehrozí.</p>';
    else { h += row('Vojáků', fmt(S.soldiers) + ' / ' + fmt(T.army)) + row('Loajalita armády', pct(S.armyLoy), S.armyLoy < 35 ? 'neg' : '') + meter(S.armyLoy) + row('Rozpočet armády', S.bud.army + ' %');
      if (S.armyLoy < 35) h += '<p style="color:var(--bad)">Armáda je nespokojená. Když loajalita klesne ještě níž a lidé budou proti tobě, hrozí převrat. Pomůže vyšší rozpočet, příplatky vojákům a nepoužívat armádu proti lidem.</p>';
      h += '<div class="btns"><button class="btn' + (S.martial > 0 ? ' pri' : '') + '" id="sec-ml">' + (S.martial > 0 ? 'Stáhnout armádu z ulic (' + S.martial + ' dní)' : 'Nasadit armádu do ulic') + '</button></div><p>Vojáci v ulicích rychle utlumí kriminalitu i nepokoje, ale omezí svobodu a armádě se to nelíbí.</p>'; }
    h += '<h4>Svoboda</h4>' + row('Občanské svobody', pct(S.freedom)) + meter(S.freedom);
    return h;
  },
  bind: () => { const b = $('sec-ml'); if (b) b.onclick = () => { const e = martialLaw(); if (e) toast(e, 'bad'); renderPanel(); }; },
};

function spark(data, key, col, min, max) {
  if (data.length < 2) return '<p>Graf se objeví po pár měsících.</p>';
  const vals = data.map(d => d[key]); const lo = min != null ? min : Math.min(...vals), hi = max != null ? max : Math.max(...vals), r = hi - lo || 1;
  const pts = vals.map((v, i) => (i / (vals.length - 1) * 300).toFixed(1) + ',' + (52 - (v - lo) / r * 46).toFixed(1)).join(' ');
  return '<svg class="spark" viewBox="0 0 300 56" preserveAspectRatio="none"><polyline points="0,52 ' + pts + ' 300,52" fill="' + col + '22" stroke="none"/><polyline points="' + pts + '" fill="none" stroke="' + col + '" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>';
}
PANELS.society = {
  title: () => 'Společnost',
  html: () => {
    let h = row('Spokojenost', pct(S.happy)) + meter(S.happy) + row('Důvěra ve vedení', pct(S.approval)) + meter(S.approval);
    h += '<h4>Co ovlivňuje náladu</h4>' + row('Bydlení a okolí (průměr)', Math.round(T.localHappy));
    for (const m of T.mods || []) h += row(m[0], (m[1] > 0 ? '+' : '') + Math.round(m[1]), m[1] >= 0 ? 'pos' : 'neg');
    h += '<h4>Lidé</h4>' + row('Obyvatelé', fmt(T.pop)) + row('Nezaměstnanost', pct(T.unemp * 100), T.unemp > 0.08 ? 'neg' : '') + row('Vzdělanost', pct(T.eduRate * 100)) + row('Zdraví', pct(S.health), S.health < 60 ? 'neg' : '') + row('Opuštěné budovy', fmt(T.abandoned));
    h += '<h4>Služby</h4>' + row('Elektřina', fmt(T.pDem) + ' / ' + fmt(T.pCap) + ' MW', T.pRatio < 1 ? 'neg' : '') + row('Voda', fmt(T.wDem) + ' / ' + fmt(T.wCap) + ' m³', T.wRatio < 1 ? 'neg' : '') + row('Odpad', fmt(T.gDem) + ' / ' + fmt(T.gCap), T.gCap < T.gDem ? 'neg' : '') + row('Doprava', T.traffic > 1 ? 'zácpy' : T.traffic > 0.6 ? 'hustá' : 'plynulá', T.traffic > 1 ? 'neg' : '');
    if (S.opts.elections) { const y = yearOf(S.day); let ey = y; while ((ey - 2026) % 4 !== 2 || (ey === y && monthOf(S.day) > 9)) ey++; h += row('Příští volby', 'říjen ' + ey); }
    h += '<h4>Obyvatelé v čase</h4>' + spark(S.hist, 'pop', '#3f82dd') + '<h4>Spokojenost a důvěra</h4>' + spark(S.hist, 'happy', '#3aa556', 0, 100) + spark(S.hist, 'approval', '#ff7a45', 0, 100) + '<h4>Pokladna</h4>' + spark(S.hist, 'money', '#8a5bd6');
    return h;
  },
};

const REL = r => r >= 60 ? ['spojenec', 'good'] : r >= 25 ? ['přátelské', 'good'] : r >= -20 ? ['neutrální', ''] : r >= -60 ? ['napjaté', 'warn'] : ['nepřátelské', 'bad'];
PANELS.diplo = {
  title: () => 'Sousední města',
  html: () => {
    let h = '<p>Sousedé obchodují, pomáhají v nouzi, ale také urážejí, sabotují a v krajním případě útočí. Válka není cíl hry. Ke konfliktu dojde, když vztahy dlouho hnijí, nebo když si o něj řekneš.</p>';
    S.nb.forEach((n, i) => {
      const N0 = NEIGHBORS[i], [rl, rc] = n.war ? ['válka', 'bad'] : REL(n.rel);
      h += '<div class="item' + (n.war ? ' crit' : '') + '"><h5>' + N0.name + pill(rl, rc) + '</h5><p>' + N0.desc + '</p>' + row('Obyvatel', fmt(N0.pop)) + row('Armáda', fmt(n.strength) + ' vojáků') + row('Vztahy', Math.round(n.rel)) + meter((n.rel + 100) / 2);
      if (n.contract) h += row('Smlouva', (n.contract.sell ? 'prodej ' : 'nákup ') + n.contract.q + ' t ' + GOODS[n.contract.g].name.toLowerCase() + ' za ' + fmt(n.contract.price) + ' Kč/t');
      if (n.war) h += row('Stav války', n.war.score >= 0 ? 'vedeme +' + n.war.score : 'prohráváme ' + n.war.score, n.war.score >= 0 ? 'pos' : 'neg') + '<div class="btns"><button class="btn pri" data-a="counter" data-n="' + i + '">Protiútok</button><button class="btn" data-a="peace" data-n="' + i + '">Navrhnout mír</button></div>';
      else {
        h += '<div class="btns"><button class="btn" data-a="gift" data-n="' + i + '">Dar 300 tis.</button><button class="btn" data-a="visit" data-n="' + i + '">Návštěva 60 tis.</button><button class="btn" data-a="insult" data-n="' + i + '">Ostrá nóta</button></div>';
        if (!n.contract) h += '<div class="btns"><select class="sel" id="cg' + i + '">' + GOOD_KEYS.map(g => '<option value="' + g + '">' + GOODS[g].name + '</option>').join('') + '</select><select class="sel" id="cs' + i + '"><option value="1">prodávat</option><option value="0">kupovat</option></select><select class="sel" id="cq' + i + '"><option>100</option><option>250</option><option>500</option></select><button class="btn" data-a="contract" data-n="' + i + '">Uzavřít smlouvu</button></div>';
        if (T.intel) h += '<div class="btns"><button class="btn" data-a="propaganda" data-n="' + i + '">Propaganda 200 tis.</button><button class="btn" data-a="sabotage" data-n="' + i + '">Sabotáž 600 tis.</button><button class="btn dan" data-a="burn" data-n="' + i + '">Zapálit radnici 1,2 mil.</button></div>';
        if (S.opts.wars && n.rel <= -30) h += '<div class="btns"><button class="btn dan" data-a="war" data-n="' + i + '">Vyhlásit válku</button></div>';
      }
      h += '</div>';
    });
    if (!T.intel) h += '<p>Tajné operace (propaganda, sabotáž, zapálení radnice) umožní Tajná služba. Odhalená operace vztahy hodně zhorší.</p>';
    return h;
  },
  bind: () => { $('pbody').onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; const i = +b.dataset.n, a = b.dataset.a; let err;
    if (a === 'contract') err = signContract(i, $('cg' + i).value, $('cs' + i).value === '1', +$('cq' + i).value); else err = nbAction(i, a);
    if (err) toast(err, 'bad'); renderPanel(); updateTop(); }; },
};

function incTitle(i) {
  switch (i.type) {
    case 'protest': return ['Demonstrace', fmt(i.size) + ' lidí protestuje: ' + (i.policy ? 'vyhláška „' + POLICIES[i.policy].name + '“' : CAUSE[i.cause]) + '.'];
    case 'riot': return ['Nepokoje', fmt(i.size) + ' výtržníků ničí a zapaluje okolí.'];
    case 'strike': return ['Stávka', (i.zone === 3 ? 'Továrny' : 'Obchody') + ' stojí. Výroba a daně klesly na polovinu.'];
    case 'bigfire': return ['Velký požár', 'Hoří ' + fireCount() + ' budov. Hasiči nestíhají.'];
    case 'flood': return ['Povodeň', 'Voda zaplavuje záplavové území. Den ' + (S.floodEv ? S.floodEv.day + ' z ' + S.floodEv.len : '–') + '.'];
    case 'epidemic': return ['Epidemie', S.epi ? 'Nemocných ' + (S.epi.sick * 100).toFixed(1).replace('.', ',') + ' %, zemřelo ' + fmt(S.epi.dead) + '.' : ''];
    case 'quake': return ['Po zemětřesení', 'Zřítilo se ' + i.size + ' budov. Lidé hledají blízké v troskách.'];
    case 'aftermath': return ['Po útoku extremistů', 'Město je v šoku. Lidé čekají, co uděláš.'];
    case 'spill': return ['Chemická havárie', 'Okolí továrny je zamořené.'];
    case 'coupwarn': return ['Neklid v armádě', 'Loajalita armády je ' + Math.round(S.armyLoy) + ' %.'];
    case 'assault': return ['Útok: ' + NEIGHBORS[i.nb].name, fmt(i.size) + ' vojáků dorazí za ' + Math.max(0, i.eta - S.day) + ' dní.' + (i.intercept ? ' Armáda jim jde naproti.' : '')];
  }
  return [i.type, ''];
}
PANELS.crisis = {
  title: () => 'Krize',
  html: () => {
    if (!S.inc.length) return '<p>Ve městě je klid.</p>' + (S.radical > 30 ? '<p>Radikálů ale přibývá. Podívej se do záložky Bezpečnost.</p>' : '');
    let h = '';
    for (const i of S.inc) { const [t, d] = incTitle(i), acts = incActions(i), crit = ['riot', 'assault', 'bigfire'].includes(i.type);
      h += '<div class="item' + (crit ? ' crit' : '') + '"><h5>' + t + '<button class="btn" data-f="' + i.id + '">Ukázat</button></h5><p>' + d + '</p><div class="btns">';
      for (const a of acts) h += '<button class="btn act" data-i="' + i.id + '" data-a="' + a.id + '"><span>' + a.label + (a.cost ? ' · ' + money(a.cost) : '') + '</span><small>' + a.hint + '</small></button>';
      h += '</div></div>'; }
    return h;
  },
  bind: () => { $('pbody').onclick = e => { const f = e.target.closest('[data-f]'); if (f) { const i = incById(+f.dataset.f); if (i) focusTile(i.x, i.y); return; }
    const b = e.target.closest('[data-a]'); if (!b) return; const err = incAction(+b.dataset.i, b.dataset.a); if (err) toast(err, 'bad'); renderPanel(); updateTop(); }; },
};

// ---------- uložení ----------
const SLOT = n => 'starosta-' + n;
function readSlot(n) { try { const s = localStorage.getItem(SLOT(n)); return s ? JSON.parse(s) : null; } catch (_) { return null; } }
function writeSlot(n, quiet) {
  if (!G.playing || S.over) return false;
  try { const sv = saveGame(); sv.cam = { x: cam.x, z: cam.z, dist: cam.dist, yaw: cam.yaw, pitch: cam.pitch }; localStorage.setItem(SLOT(n), JSON.stringify(sv)); if (!quiet) toast('Hra uložena.', 'good'); return true; }
  catch (e) { if (!quiet) toast('Uložení se nepovedlo. Prohlížeč nemá místo nebo ukládání nedovolí.', 'bad'); return false; }
}
function slotLabel(sv) { return esc(sv.S.name) + ' · ' + dateStr(sv.S.day) + ' · ' + fmt((sv.S.hist[sv.S.hist.length - 1] || {}).pop || 0) + ' obyvatel'; }
PANELS.menu = {
  title: () => 'Hra',
  html: () => {
    let h = '<h4>Uložené hry</h4><p>Hra se ukládá do tohoto prohlížeče. Automaticky každé dva měsíce a při odchodu ze stránky.</p>';
    for (const n of ['auto', 0, 1, 2]) { const sv = readSlot(n); h += '<div class="item"><h5>' + (n === 'auto' ? 'Automatické uložení' : 'Pozice ' + (n + 1)) + '</h5><p>' + (sv ? slotLabel(sv) : 'prázdná') + '</p><div class="btns">' + (n !== 'auto' ? '<button class="btn pri" data-s="' + n + '">Uložit sem</button>' : '') + (sv ? '<button class="btn" data-l="' + n + '">Načíst</button>' : '') + '</div></div>'; }
    h += '<h4>Kvalita grafiky</h4><div class="btns">' + ['Nízká', 'Střední', 'Vysoká'].map((n, i) => '<button class="btn' + (RS.quality === i ? ' pri' : '') + '" data-q="' + i + '">' + n + '</button>').join('') + '</div><p>Vysoká má ostré dlouhé stíny a plné rozlišení. Nízká vypne stíny a sníží rozlišení, hodí se pro slabší telefony a notebooky.</p>';
    h += '<h4>Ovládání</h4><p>Myš: levým tlačítkem stavíš nebo vybíráš, pravým posouváš mapu, kolečkem přibližuješ, prostředním otáčíš. Klávesy: WASD posun, Q a E otáčení, R a F sklon, mezerník pauza, 1 až 3 rychlost, Esc zruší nástroj.</p><p>Dotyk: jedním prstem stavíš nebo posouváš mapu (s nástrojem Prohlížet), dvěma prsty přibližuješ, otáčíš a posouváš.</p>';
    h += '<div class="btns"><button class="btn dan" id="g-new">' + (G.newArm ? 'Opravdu začít znovu?' : 'Nová hra') + '</button></div>';
    return h;
  },
  bind: () => {
    $('pbody').onclick = e => {
      const s = e.target.closest('[data-s]'), l = e.target.closest('[data-l]');
      if (s) { writeSlot(+s.dataset.s); renderPanel(); }
      if (l) { const n = l.dataset.l; loadSlot(n === 'auto' ? 'auto' : +n); }
      const q = e.target.closest('[data-q]'); if (q) { setQuality(+q.dataset.q); try { localStorage.setItem('starosta-quality', q.dataset.q); } catch (_) { } renderPanel(); }
      if (e.target.id === 'g-new') { if (G.newArm) { G.newArm = false; closePanel(); showStart(); } else { G.newArm = true; renderPanel(); setTimeout(() => { G.newArm = false; }, 4000); } }
    };
  },
};
function loadSlot(n) {
  const sv = readSlot(n); if (!sv) { toast('Tahle pozice je prázdná.', 'bad'); return; }
  try { loadGame(sv); } catch (e) { toast('Uloženou hru se nepodařilo načíst.', 'bad'); return; }
  if (sv.cam) Object.assign(cam, sv.cam);
  startPlaying(); toast('Hra načtena: ' + S.name + '.', 'good');
}

// ---------- otázky a konec hry ----------
function showAsk() {
  const a = S.asks[0], box = $('askbox');
  if (!a) { $('ask').hidden = true; return; }
  $('ask').hidden = false;
  box.innerHTML = '<h2>' + esc(a.title) + '</h2><p class="lead">' + esc(a.text) + '</p>' + a.opts.map(o => '<button class="choice" data-o="' + o.id + '"><b>' + esc(o.label) + (o.cost ? ' · ' + money(o.cost) : '') + '</b>' + (o.hint ? '<small>' + esc(o.hint) + '</small>' : '') + '</button>').join('');
  box.onclick = e => { const b = e.target.closest('[data-o]'); if (!b) return; const err = answer(a, b.dataset.o); if (err) { toast(err, 'bad'); return; } showAsk(); refreshNow(); };
}
UIH.ask = () => { if (G.playing) showAsk(); };
const OVER = {
  election: v => ['Prohrál jsi volby', 'Získal jsi jen ' + v + ' % hlasů. Město povede někdo jiný. Můžeš ale pokračovat jako nový starosta s čistým štítem.', true],
  coup: () => ['Převrat', 'Armáda převzala radnici. Generálové vyhlásili výjimečný stav a tvoje funkce skončila.', false],
  bankrot: () => ['Nucená správa', 'Město je předlužené. Vláda dosadila nuceného správce a tvá funkce skončila.', false],
};
UIH.over = (why, v) => {
  const [t, d, cont] = OVER[why](v); $('over').hidden = false;
  $('overbox').innerHTML = '<h2>' + t + '</h2><p class="lead">' + d + '</p>' + (cont ? '<button class="choice" id="o-cont"><b>Pokračovat jako nový starosta</b><small>Město zůstane, důvěra se vrátí na 50 %.</small></button>' : '') + (readSlot('auto') ? '<button class="choice" id="o-load"><b>Načíst automatické uložení</b></button>' : '') + '<button class="choice" id="o-new"><b>Nová hra</b></button>';
  const c = $('o-cont'); if (c) c.onclick = () => { S.over = null; S.approval = 50; S.mood = 0; $('over').hidden = true; };
  const l = $('o-load'); if (l) l.onclick = () => { $('over').hidden = true; loadSlot('auto'); };
  $('o-new').onclick = () => { $('over').hidden = true; showStart(); };
};

// ---------- ukazatele na mapě, ikony problémů, mapka ----------
const mkEls = new Map();
function updateMarkers() {
  const live = new Set();
  for (const i of S.inc) {
    if (!['protest', 'riot', 'assault', 'bigfire', 'spill', 'aftermath'].includes(i.type)) continue; live.add(i.id);
    let el = mkEls.get(i.id);
    if (!el) { el = document.createElement('button'); el.className = 'mk ' + (['protest', 'riot', 'assault'].includes(i.type) ? i.type : 'other'); el.onclick = () => openPanel('crisis'); $('markers').appendChild(el); mkEls.set(i.id, el); }
    el.className = 'mk ' + (['protest', 'riot', 'assault'].includes(i.type) ? i.type : 'other');
    const p = project(tileX(i.x), 6, tileZ(i.y));
    el.style.display = p.ok ? '' : 'none'; el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
    el.textContent = incTitle(i)[0] + (i.size && ['protest', 'riot', 'assault'].includes(i.type) ? ' · ' + fmt(i.size) : '');
  }
  for (const [id, el] of mkEls) if (!live.has(id)) { el.remove(); mkEls.delete(id); }
}
function drawHud() {
  if (hud.width !== Math.round(VW * DPR) || hud.height !== Math.round(VH * DPR)) { hud.width = Math.round(VW * DPR); hud.height = Math.round(VH * DPR); }
  hx.setTransform(DPR, 0, 0, DPR, 0, 0); hx.clearRect(0, 0, VW, VH);
  if (!G.playing) return;
  if (cam.dist < 190) {
    let n = 0;
    for (let k = 0; k < NN && n < 260; k++) {
      if (!zone[k] || !lvl[k] || ruin[k]) continue;
      const p0 = !acc[k] ? 'road' : !pw[k] ? 'power' : !wt[k] ? 'water' : aband[k] ? 'aband' : null; if (!p0) continue;
      const p = project(tileX(k % N), 5, tileZ((k / N) | 0)); if (!p.ok || p.x < 0 || p.y < 0 || p.x > VW || p.y > VH) continue;
      icon(p.x, p.y, p0); n++;
    }
  }
  const dr = G.drag;
  if (dr && dr.mode === 'tool' && G.dragCost) { hx.font = '600 14px Inter, sans-serif'; const t = money(G.dragCost); const w = hx.measureText(t).width + 16; hx.fillStyle = 'rgba(35,48,61,.85)'; roundRect(dr.x + 14, dr.y + 10, w, 24, 8); hx.fill(); hx.fillStyle = S.money >= G.dragCost ? '#fff' : '#ffb3a8'; hx.fillText(t, dr.x + 22, dr.y + 27); }
}
function roundRect(x, y, w, h, r) { hx.beginPath(); hx.moveTo(x + r, y); hx.arcTo(x + w, y, x + w, y + h, r); hx.arcTo(x + w, y + h, x, y + h, r); hx.arcTo(x, y + h, x, y, r); hx.arcTo(x, y, x + w, y, r); hx.closePath(); }
function icon(x, y, t) {
  hx.fillStyle = t === 'aband' ? '#7a6f66' : '#e0483a'; hx.strokeStyle = '#fff'; hx.lineWidth = 2;
  hx.beginPath(); hx.arc(x, y, 9, 0, 6.29); hx.fill(); hx.stroke(); hx.fillStyle = '#fff'; hx.beginPath();
  if (t === 'power') { hx.moveTo(x + 1, y - 6); hx.lineTo(x - 4, y + 1); hx.lineTo(x, y + 1); hx.lineTo(x - 1, y + 6); hx.lineTo(x + 4, y - 1); hx.lineTo(x, y - 1); hx.closePath(); hx.fill(); }
  else if (t === 'water') { hx.moveTo(x, y - 6); hx.quadraticCurveTo(x + 5, y + 1, x, y + 5); hx.quadraticCurveTo(x - 5, y + 1, x, y - 6); hx.fill(); }
  else if (t === 'road') { hx.fillRect(x - 5, y - 1.5, 10, 3); }
  else { hx.fillRect(x - 1.5, y - 6, 3, 8); hx.fillRect(x - 1.5, y + 3, 3, 3); }
}
const mbase = document.createElement('canvas'); mbase.width = N; mbase.height = N;
function drawMiniBase() {
  const c = mbase.getContext('2d'), img = c.createImageData(N, N);
  for (let k = 0; k < NN; k++) {
    let col = ter[k] === 1 ? [62, 110, 134] : ter[k] === 3 ? [70, 105, 58] : ter[k] === 2 ? [160, 150, 115] : ter[k] === 4 ? [196, 178, 112] : ter[k] === 5 ? [104, 140, 76] : [112, 140, 80];
    if (road[k]) col = [80, 85, 95]; else if (bld[k]) col = [150, 140, 170]; else if (zone[k]) { const z = new THREE.Color(ZONES[zone[k]].hex); const f = lvl[k] ? 0.85 : 0.55; col = [z.r * 255 * f + (lvl[k] ? 0 : 143 * 0.45), z.g * 255 * f + (lvl[k] ? 0 : 207 * 0.45), z.b * 255 * f + (lvl[k] ? 0 : 104 * 0.45)]; }
    if (fire[k]) col = [255, 110, 40]; if (flood[k]) col = [60, 120, 230]; if (ruin[k]) col = [160, 150, 135];
    img.data.set([col[0], col[1], col[2], 255], k * 4);
  }
  c.putImageData(img, 0, 0);
}
function drawMini() {
  const S2 = mini.width; mx.imageSmoothingEnabled = false; mx.drawImage(mbase, 0, 0, S2, S2);
  const k = S2 / (N * TS);
  for (const i of S.inc) if (i.x != null && ['protest', 'riot', 'assault', 'bigfire'].includes(i.type)) { mx.fillStyle = '#e0483a'; mx.beginPath(); mx.arc((tileX(i.x) + HALF) * k, (tileZ(i.y) + HALF) * k, 4, 0, 6.29); mx.fill(); }
  mx.strokeStyle = '#fff'; mx.lineWidth = 2; mx.beginPath();
  [[0, 0], [VW, 0], [VW, VH], [0, VH]].forEach(([x, y], i) => { const g = pickGround(x, y); const p = g ? [g.wx, g.wz] : [cam.x, cam.z]; const px = (clamp(p[0], -HALF * 2, HALF * 2) + HALF) * k, pz = (clamp(p[1], -HALF * 2, HALF * 2) + HALF) * k; if (i) mx.lineTo(px, pz); else mx.moveTo(px, pz); });
  mx.closePath(); mx.stroke();
}
function miniGo(e) { const r = mini.getBoundingClientRect(); cam.x = (e.clientX - r.left) / r.width * N * TS - HALF; cam.z = (e.clientY - r.top) / r.height * N * TS - HALF; }
mini.addEventListener('pointerdown', e => { try { mini.setPointerCapture(e.pointerId); } catch (_) { } mini._d = true; miniGo(e); });
mini.addEventListener('pointermove', e => { if (mini._d) miniGo(e); });
mini.addEventListener('pointerup', () => { mini._d = false; }); mini.addEventListener('pointercancel', () => { mini._d = false; });

// ---------- úvodní obrazovka ----------
const OPT = { size: 2, tech: 1, crisis: 1, wars: true, elections: true };
function drawStart() {
  $('s-size').innerHTML = STARTS.map((s, i) => '<button class="pick' + (OPT.size === i ? ' on' : '') + '" data-v="' + i + '"><b>' + s.name + '</b><small>' + (s.pop ? 'asi ' + fmt(s.pop) + ' obyvatel. ' : '') + s.desc + ' V pokladně ' + money(s.money) + '.</small></button>').join('');
  $('s-tech').innerHTML = TECH_LEVELS.map((t, i) => '<button class="pick' + (OPT.tech === i ? ' on' : '') + '" data-v="' + i + '"><b>' + t.name + '</b><small>' + (i === 0 ? 'Vše se musí vyzkoumat.' : i === 1 ? 'Plyn, vítr, filtry, MHD a protipovodňová ochrana už jsou.' : 'Skoro všechno je vyzkoumané včetně metra a tajné služby.') + '</small></button>').join('');
  $('s-crisis').innerHTML = CRISIS_LEVELS.map((c, i) => '<button class="pick' + (OPT.crisis === i ? ' on' : '') + '" data-v="' + i + '"><b>' + c.name + '</b><small>' + ['Katastrofy a nepokoje jsou vzácné. Hodí se pro klidné budování.', 'Občas něco vyhoří, zaplaví nebo vypukne demonstrace.', 'Pohromy, stávky a extremisté přicházejí často.'][i] + '</small></button>').join('');
  $('s-rules').innerHTML = '<button class="pick' + (OPT.wars ? ' on' : '') + '" data-r="wars"><b>Války a převraty: ' + (OPT.wars ? 'ano' : 'ne') + '</b><small>Sousedé mohou zaútočit a nespokojená armáda se může vzbouřit.</small></button><button class="pick' + (OPT.elections ? ' on' : '') + '" data-r="elections"><b>Volby: ' + (OPT.elections ? 'ano' : 'ne') + '</b><small>Každé čtyři roky. S nízkou důvěrou prohraješ.</small></button>';
  const saves = ['auto', 0, 1, 2].map(n => [n, readSlot(n)]).filter(s => s[1]);
  $('s-saves').innerHTML = saves.length ? '<h3>Pokračovat</h3>' + saves.map(([n, sv]) => '<div class="item"><span>' + slotLabel(sv) + '</span><button class="btn pri" data-load="' + n + '">Pokračovat</button></div>').join('') : '';
}
for (const id of ['s-size', 's-tech', 's-crisis']) $(id).onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; OPT[{ 's-size': 'size', 's-tech': 'tech', 's-crisis': 'crisis' }[id]] = +b.dataset.v; drawStart(); };
$('s-rules').onclick = e => { const b = e.target.closest('[data-r]'); if (!b) return; OPT[b.dataset.r] = !OPT[b.dataset.r]; drawStart(); };
$('s-saves').onclick = e => { const b = e.target.closest('[data-load]'); if (!b) return; const n = b.dataset.load; loadSlot(n === 'auto' ? 'auto' : +n); };
$('s-go').onclick = () => {
  const name = ($('s-name').value || '').trim() || 'Nové Lhoty';
  newGame({ name, size: OPT.size, tech: OPT.tech, crisis: OPT.crisis, wars: OPT.wars, elections: OPT.elections });
  cam.x = tileX(W.cx); cam.z = tileZ(W.cy); cam.dist = OPT.size >= 3 ? 210 : OPT.size ? 150 : 120; cam.yaw = 0.65; cam.pitch = 0.95;
  if (!OPT.size) { cam.x = tileX(8); }
  startPlaying();
};
function showStart() { G.playing = false; $('start').hidden = false; drawStart(); closePanel(); G.cat = null; drawSub(); }
function startPlaying() {
  document.body.classList.remove('tabsopen', 'minion');
  rebuildAll(); drawMiniBase(); RS.overlay = null; setOverlay(null);
  for (const el of mkEls.values()) el.remove(); mkEls.clear(); $('feed').innerHTML = '';
  G.playing = true; G.demo = false; G.acc = 0; G.lastAuto = S.day; $('start').hidden = true; $('over').hidden = true;
  setTool({ kind: 'select' }); G.cat = S.day === 0 && !T.pop ? 'cat:power' : null; drawRail(); drawSub(); setSpeed(1); updateTop(); showAsk();
  if (S.day === 0) for (const m of S.log) UIH.note(m);
}

// ---------- hlavní smyčka ----------
let last = performance.now(), uiT = 0, miniT = 0, liveT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000); last = now; const t = now / 1000;
  if (view.clientWidth !== VW || view.clientHeight !== VH) resizeRender(view.clientWidth, view.clientHeight);
  const th = $('top').offsetHeight; if (th !== G.topH) { G.topH = th; document.documentElement.style.setProperty('--topH', th + 'px'); }
  const ks = cam.dist * 0.9 * dt;
  if (keys.KeyW || keys.ArrowUp) panBy(0, ks * 6); if (keys.KeyS || keys.ArrowDown) panBy(0, -ks * 6); if (keys.KeyA || keys.ArrowLeft) panBy(ks * 6, 0); if (keys.KeyD || keys.ArrowRight) panBy(-ks * 6, 0);
  if (keys.KeyQ) cam.yaw += dt * 1.3; if (keys.KeyE) cam.yaw -= dt * 1.3; if (keys.KeyR) cam.pitch += dt * 0.8; if (keys.KeyF) cam.pitch -= dt * 0.8;
  if (keys.Equal || keys.NumpadAdd) cam.dist *= 1 - dt; if (keys.Minus || keys.NumpadSubtract) cam.dist *= 1 + dt;
  let dayFrac = 0;
  if (G.playing) {
    const blocked = S.asks.length > 0 || S.over || !$('ask').hidden;
    if (G.speed && !blocked) { G.acc += dt; let n = 0; const ds = DAY_SEC[G.speed]; while (G.acc >= ds && n < 8) { simDay(); G.acc -= ds; n++; } if (n === 8) G.acc = 0; dayFrac = G.acc / ds; }
    if (S.asks.length && $('ask').hidden) showAsk();
    if (S.day - G.lastAuto >= 60) { G.lastAuto = S.day; writeSlot('auto', true); }
  } else { cam.yaw += dt * 0.05; simDayDemo(dt); }
  renderFrame(dt, t, dayFrac);
  if (G.playing) {
    updateMarkers(); drawHud();
    if (now - uiT > 250) { uiT = now; updateTop(); }
    if (now - liveT > 1000) { liveT = now; if (G.panel && PANELS[G.panel]) { const P = PANELS[G.panel]; if (P.live) P.live(G.parg); else if (!P.static && !$('pbody').contains(document.activeElement)) livePanel(); } if (RS.overlay) updateOverlay(); }
    if (now - miniT > 1200) { miniT = now; drawMiniBase(); }
    drawMini();
  }
}
let demoAcc = 0;
function simDayDemo(dt) { demoAcc += dt; if (demoAcc > 0.5) { demoAcc = 0; simDay(); S.asks.length = 0; } }
document.addEventListener('visibilitychange', () => { if (document.hidden) writeSlot('auto', true); });
addEventListener('pagehide', () => writeSlot('auto', true));

function boot() {
  initRender(view); resizeRender(view.clientWidth || innerWidth, view.clientHeight || innerHeight);
  let q = RS.coarse ? 1 : 2; try { const v = localStorage.getItem('starosta-quality'); if (v != null) q = +v; } catch (_) { }
  setQuality(q);
  newGame({ name: 'Ukázka', size: 3, tech: 1, crisis: 0, wars: false, elections: false });
  rebuildAll(); cam.x = tileX(W.cx); cam.z = tileZ(W.cy); cam.dist = 190;
  drawRail(); drawStart();
  window.GAME = { S, T, cam, G };
  requestAnimationFrame(loop);
}
boot();
