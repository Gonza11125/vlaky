'use strict';
// Hra dvou hráčů po síti. Hostitel počítá celou hru a posílá stav, host posílá jen rozkazy.
// Zprávy se mohou ztratit, proto se posílá vždy celý stav a rozkazy se opakují do potvrzení.

const UT = Object.keys(UNITS), BT = Object.keys(BUILDINGS), OT = ['', 'move', 'amove', 'attack', 'gather', 'build', 'farm', 'hunt'], PK = ['arrow', 'shot', 'rock', 'ball'];
Object.assign(NET, { room: null, bc: null, ready: false, started: false, peerAt: 0, lost: false, tick: 0, lastTick: 0, gen: 0, seq: 0, pend: [], ack: 0, lastResend: 0, initId: 0, parts: null, logN: 0, lastInit: 0, ug: null, bg: null, helloT: 0 });
const el = id => document.getElementById(id);

async function netBoot() {
  try {
    if (window.claude && window.claude.use) {
      const r = await window.claude.use('room');
      if (r) { NET.room = r; r.on('h', m => { if (!m.sameTab) netIn(m.data); }); r.on('g', m => { if (!m.sameTab) netIn(m.data); }); }
    }
  } catch (e) { }
  if (!NET.room && 'BroadcastChannel' in window) { try { NET.bc = new BroadcastChannel('vek-pokroku-net'); NET.bc.onmessage = e => netIn(e.data); } catch (e) { } }
  NET.ready = true; netStatus();
}
function netStatus(text) {
  const s = el('net-status'); if (!s) return;
  if (text) { s.textContent = text; return; }
  s.textContent = NET.room ? 'Soupeř musí mít tuhle stránku otevřenou a nasdílenou s právem přispívat.' : NET.bc ? 'Síť Claude tu není k dispozici. Funguje jen hra mezi dvěma okny téhož prohlížeče.' : 'Hra po síti tady není dostupná.';
  el('b-host').disabled = el('b-join').disabled = !(NET.room || NET.bc);
}
function netSend(d) {
  d.c = NET.code;
  if (NET.room) NET.room.emit(NET.role === 'host' ? 'h' : 'g', d).catch(e => { if (NET.err) return; NET.err = (e && e.code) || 'chyba'; const t = NET.err === 'not_permitted' ? 'Nemáš právo posílat do hry. Vlastník ti musí stránku nasdílet s právem přispívat.' : 'Síť hlásí chybu (' + NET.err + ').'; netStatus(t); msg(t, 'bad'); });
  else if (NET.bc) NET.bc.postMessage(d);
}
function netReset() { Object.assign(NET, { role: null, code: '', started: false, out: [], shots: [], log: [], pend: [], seq: 0, ack: 0, parts: null, logN: 0, ug: null, bg: null, lost: false, err: null }); }

// ---------- lobby ----------
function netHost() {
  if (!NET.ready) return;
  netReset(); NET.role = 'host'; NET.code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPRSTUVXYZ'[Math.floor(Math.random() * 22)]).join('');
  netStatus('Kód hry: ' + NET.code + '. Pošli ho soupeři. Hra začne, jakmile se připojí. Nastavení režimu výše platí pro oba.');
}
function netJoin() {
  if (!NET.ready) return;
  const code = (el('net-code').value || '').trim().toUpperCase();
  if (code.length !== 4) { netStatus('Zadej čtyřpísmenný kód, který ti poslal soupeř.'); return; }
  netReset(); NET.role = 'guest'; NET.code = code; NET.helloT = 0;
  netStatus('Hledám hru ' + code + '…');
}
function hostStart() {
  applyOpts(); G.mode = 'host'; MY = 0; G.speed = 1; el('b-speed').textContent = '1×';
  startFresh(); NET.started = true; NET.log = []; NET.out = []; NET.shots = []; NET.ack = 0;
  el('start').hidden = true; G.paused = false;
  msg('Soupeř se připojil. Hraješ za modré, on za červené.', 'good');
}
function sendInit() {
  const now = performance.now(); if (now - NET.lastInit < 2500) return; NET.lastInit = now;
  const s = JSON.stringify(Object.assign(saveState(), { logN: NET.log.length })), n = Math.ceil(s.length / 1500), id = ++NET.initId;
  for (let k = 0; k < n; k++) setTimeout(() => netSend({ t: 'i', id, k, n, d: s.slice(k * 1500, (k + 1) * 1500) }), k * 45);
}
function guestStart(sv) {
  sv.explored = ''; for (const b of sv.blds) b.seen = false;
  G.mode = 'guest'; MY = 1; resetView();
  newGame(0, sv);
  G.speed = 1; el('b-speed').textContent = '1×';
  NET.logN = sv.logN || 0; NET.started = true; NET.parts = null; NET.ug = null; NET.bg = null;
  cam.x = teams[1].tcx; cam.z = teams[1].tcz + 4; cam.yaw = 0;
  el('start').hidden = true; G.paused = false;
  msg('Připojeno. Hraješ za červené, soupeř za modré.', 'good');
}

// ---------- příjem ----------
function netIn(d) {
  if (!d || typeof d !== 'object' || !NET.role || d.c !== NET.code) return;
  try { if (NET.role === 'host') hostIn(d); else guestIn(d); } catch (e) { console.error(e); }
}
function hostIn(d) {
  if (d.t === 'hello') { NET.peerAt = performance.now(); if (!NET.started) hostStart(); sendInit(); return; }
  if (d.t !== 'c' || !NET.started || !Array.isArray(d.l)) return;
  NET.peerAt = performance.now();
  for (const it of d.l.slice(0, 20)) { if (!Array.isArray(it) || it[0] !== NET.ack + 1 || !Array.isArray(it[1])) continue; NET.ack = it[0]; try { execCmd(1, it[1]); } catch (e) { } }
}
function guestIn(d) {
  if (d.t === 'i') {
    if (NET.started && (!NET.resync || performance.now() - NET.resync > 6000)) return;
    if (!NET.parts || NET.parts.id !== d.id) NET.parts = { id: d.id, n: d.n, got: [], cnt: 0 };
    const P = NET.parts; if (P.got[d.k] == null) { P.got[d.k] = d.d; P.cnt++; }
    if (P.cnt === P.n) { let sv = null; try { sv = JSON.parse(P.got.join('')); } catch (e) { NET.parts = null; return; } NET.resync = 0; guestStart(sv); }
    return;
  }
  if (!NET.started) return;
  NET.peerAt = performance.now();
  if (d.t === 'u') applyUnits(d); else if (d.t === 'b') applyBlds(d); else if (d.t === 's') applyState(d); else if (d.t === 'n') applyWorld(d);
}
function chunkDone(key, d) {
  let g = NET[key]; if (!g || g.gen !== d.g) g = NET[key] = { gen: d.g, n: d.n, got: new Set() };
  g.got.add(d.k); return g.got.size === g.n;
}
function applyUnits(d) {
  for (const e of d.d) {
    let u = byId.get(e[0]); const team = e[1] >= 100 ? 1 : 0, type = UT[e[1] % 100], x = e[2] / 10, z = e[3] / 10;
    if (!u) { if (!type) continue; const keep = nextId; nextId = e[0]; u = addUnit(team, type, x, z); nextId = Math.max(keep, e[0] + 1); u.tx = x; u.tz = z; }
    if (!u.isU) continue;
    u.tx = x; u.tz = z; u.hp = e[4]; u.gen = d.g; const f = e[5];
    u.moving = !!(f & 1); u.working = !!(f & 2); u.sick = f & 4 ? 1 : 0; u.face = e[6] / 10;
    const ot = (f >> 3) & 7; u.order = ot ? { type: OT[ot], node: { def: { res: RES[(f >> 6) & 7] } } } : null;
  }
  if (chunkDone('ug', d)) for (let i = units.length - 1; i >= 0; i--) if (units[i].gen !== d.g) { teams[units[i].team].pop--; dropEnt(units[i]); units.splice(i, 1); }
  for (const s of d.sh || []) { const a = byId.get(s[0]), t = byId.get(s[1]); if (a && t && PK[s[2]]) { shoot(a, t, PK[s[2]], 0); projs[projs.length - 1].fx = true; } }
}
function applyBlds(d) {
  for (const e of d.d) {
    let b = byId.get(e[0]); const team = e[1] >= 100 ? 1 : 0, type = BT[e[1] % 100], done = !!(e[6] & 1);
    if (!b) { if (!type) continue; const keep = nextId; nextId = e[0]; b = placeBuilding(team, type, e[2], e[3], done); nextId = Math.max(keep, e[0] + 1); }
    if (!b.isB) continue;
    b.hp = e[4]; b.maxHp = e[5]; b.gen = d.g; b.fire = e[6] & 2 ? 1 : 0; b.prog = e[7] / 100;
    if (done && !b.done) { b.done = true; b.mesh.scale.y = 1; cmdSig = ''; } else if (!done) b.mesh.scale.y = 0.12 + 0.88 * Math.min(1, b.prog);
  }
  if (chunkDone('bg', d)) for (let i = blds.length - 1; i >= 0; i--) if (blds[i].gen !== d.g) { dropEnt(blds[i]); blds.splice(i, 1); }
}
function applyState(d) {
  G.time = d.time; G.flood = d.fl || 0; G.rain = d.rn || 0; EV.drought = !!d.dr; EV.frost = !!d.fr;
  (d.T || []).forEach((s, i) => { const T = teams[i]; if (!T || !s) return; RES.forEach((k, j) => { T.res[k] = s.r[j] || 0; }); T.era = s.era; T.pop = s.pop; T.cap = s.cap; T.hungry = !!s.h; T.cold = !!s.cold; if (s.tech) { T.tech = {}; s.tech.forEach(k => { T.tech[k] = true; }); T.busy = {}; (s.busy || []).forEach(k => { T.busy[k] = true; }); } });
  const cn = teams[MY].n = {}; for (const b of blds) if (b.team === MY) { if (b.done) cn[b.type] = (cn[b.type] || 0) + 1; b.queue = []; }
  for (const q of d.q || []) { const b = byId.get(q[0]); if (b && b.isB) b.queue = q[1].map(x => ({ kind: x[0], id: x[1], t: x[2], total: x[3] })); }
  if (d.pr) Object.assign(PRICE, d.pr);
  NET.pend = NET.pend.filter(p => p[0] > d.ack);
  for (const m of d.m || []) { if (m[0] === '!') alertAttack(m[1], m[2], !!m[3]); else msg(String(m[0]).slice(0, 200), m[1] === 'good' || m[1] === 'bad' ? m[1] : ''); }
  if (d.over >= 0 && !G.over) endGame(d.over);
}
function applyWorld(d) {
  if (d.li > NET.logN) { if (!NET.resync) { NET.resync = performance.now(); NET.helloT = 0; } return; }   // něco uteklo: vyžádat celý stav znovu
  for (let i = NET.logN - d.li; i < d.log.length; i++) {
    const e = d.log[i]; NET.logN++;
    if (e[0] === 0) { const n = nodes[e[1]]; if (n && n.amt > 0) depleteNode(n); }
    else { const n = { id: nodes.length, isNode: true, type: 'meat', def: NODE_DEF.meat, cx: e[1], cy: e[2], x: e[3], z: e[4], amt: NODE_DEF.meat.amt, inst: -1, v: 0.5 }; nodes.push(n); nodeAt[cidx(n.cx, n.cy)] = n.id; addMeat(n); n.mesh.rotation.y = e[5]; }
  }
  const seen = new Set();
  for (const e of d.an || []) { seen.add(e[0]); let a = animals.find(a => a.id === e[0]); if (!a) { a = addAnimal(e[1] / 10, e[2] / 10); a.id = e[0]; } a.tx = e[1] / 10; a.tz = e[2] / 10; }
  for (let i = animals.length - 1; i >= 0; i--) if (!seen.has(animals[i].id)) { scene.remove(animals[i].mesh); animals[i].dead = true; animals.splice(i, 1); }
}

// ---------- odesílání ----------
function netCmd(c) { NET.pend.push([++NET.seq, c]); netSend({ t: 'c', l: NET.pend.slice(0, 12) }); NET.lastResend = performance.now(); }
const encU = u => { const o = u.order, ot = o ? Math.max(0, OT.indexOf(o.type)) : 0, ri = o && o.type === 'gather' ? RES.indexOf(o.node.def.res) : 0; return [u.id, u.team * 100 + UT.indexOf(u.type), Math.round(u.x * 10), Math.round(u.z * 10), Math.ceil(u.hp), (u.moving ? 1 : 0) | (u.working ? 2 : 0) | (u.sick > 0 ? 4 : 0) | (ot << 3) | (ri << 6), Math.round(u.face * 10)]; };
const encB = b => [b.id, b.team * 100 + BT.indexOf(b.type), b.cx, b.cy, Math.ceil(b.hp), b.maxHp, (b.done ? 1 : 0) | (b.fire > 0 ? 2 : 0), Math.round(b.prog * 100)];
function sendChunks(t, list, enc, per, extra) {
  const g = ++NET.gen, n = Math.max(1, Math.ceil(list.length / per));
  for (let k = 0; k < n; k++) { const m = { t, g, k, n, d: list.slice(k * per, (k + 1) * per).map(enc) }; if (!k && extra) Object.assign(m, extra); netSend(m); }
}
function hostTick() {
  const i = NET.tick++;
  if (i % 2 === 0) sendChunks('u', units, encU, 90, { sh: NET.shots.splice(0, 40).map(s => [s[0], s[1], PK.indexOf(s[2])]) });
  if (i % 10 === 1) sendChunks('b', blds, encB, 85);
  if (i % 5 === 2) netSend({
    t: 's', time: r1(G.time), fl: r1(G.flood || 0), rn: G.rain || 0, dr: EV.drought ? 1 : 0, fr: EV.frost ? 1 : 0, ack: NET.ack, over: G.over ? G.loser : -1,
    T: teams.map((T, k) => ({ r: RES.map(r => Math.floor(T.res[r])), era: T.era, pop: T.pop, cap: T.cap, h: T.hungry ? 1 : 0, cold: T.cold ? 1 : 0, tech: k === 1 ? Object.keys(T.tech) : undefined, busy: k === 1 ? Object.keys(T.busy) : undefined })),
    q: blds.filter(b => b.team === 1 && b.queue.length).slice(0, 12).map(b => [b.id, b.queue.map(q => [q.kind, q.id, r1(q.t), q.total])]),
    pr: { food: Math.round(PRICE.food), wood: Math.round(PRICE.wood), stone: Math.round(PRICE.stone), metal: Math.round(PRICE.metal) }, m: NET.out.splice(0, 5),
  });
  if (i % 10 === 6) netSend({ t: 'n', li: Math.max(0, NET.log.length - 50), log: NET.log.slice(-50), an: animals.map(a => [a.id, Math.round(a.x * 10), Math.round(a.z * 10)]) });
}
function netFrame(now, dt) {
  if (!NET.role) return;
  if (NET.role === 'guest' && (!NET.started || NET.resync) && now - NET.helloT > 1500) { NET.helloT = now; netSend({ t: 'hello' }); }
  if (!NET.started) return;
  if (NET.role === 'host') { if (now - NET.lastTick >= 100) { NET.lastTick = now; hostTick(); } }
  else {
    const k = Math.min(1, dt * 9);
    for (const u of units) if (u.tx != null) { u.x += (u.tx - u.x) * k; u.z += (u.tz - u.z) * k; }
    for (const a of animals) if (a.tx != null) { const dx = a.tx - a.x, dz = a.tz - a.z; a.moving = Math.abs(dx) + Math.abs(dz) > 0.15; if (a.moving) a.face = Math.atan2(dx, dz); a.x += dx * k; a.z += dz * k; }
    updateProjs(dt);
    if (now - NET.lastResend > (NET.pend.length ? 500 : 3000)) { NET.lastResend = now; netSend({ t: 'c', l: NET.pend.slice(0, 12) }); }
  }
  const quiet = NET.peerAt && now - NET.peerAt > 9000;
  if (quiet && !NET.lost) { NET.lost = true; msg(NET.role === 'host' ? 'Soupeř neodpovídá. Hra běží dál.' : 'Hostitel neodpovídá. Čekám na spojení…', 'bad'); }
  else if (!quiet && NET.lost) { NET.lost = false; msg('Spojení obnoveno.', 'good'); }
}
