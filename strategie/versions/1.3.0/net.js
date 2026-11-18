'use strict';
// Hra dvou hráčů po síti. Hostitel počítá celou hru a posílá stav, host posílá jen rozkazy.
// Zprávy se mohou ztratit, proto se posílá vždy celý stav a rozkazy se opakují do potvrzení.

const UT = Object.keys(UNITS), BT = Object.keys(BUILDINGS), OT = ['', 'move', 'amove', 'attack', 'gather', 'build', 'farm', 'hunt', 'trade'], PK = ['arrow', 'shot', 'rock', 'ball'];
Object.assign(NET, { room: null, bc: null, ready: false, started: false, peerAt: 0, lost: false, tick: 0, lastTick: 0, gen: 0, seq: 0, pend: [], ack: 0, lastResend: 0, initId: 0, parts: null, logN: 0, lastInit: 0, ug: null, bg: null, helloT: 0 });
const el = id => document.getElementById(id);

async function netBoot() {
  try {
    if (window.claude && window.claude.use) {
      const r = await window.claude.use('room');
      if (r) {
        NET.room = r; r.on('h', m => { if (!m.sameTab) netIn(m.data); }, netRoomErr); r.on('g', m => { if (!m.sameTab) netIn(m.data); }, netRoomErr);
        r.onConnection(c => { NET.conn = c; netConnInfo(); }, netRoomErr);
        r.onPeers(ch => { NET.others = ch.peers.filter(p => p.kind === 'viewer' && !p.sameTab).length; netConnInfo(); }, netRoomErr);
      }
    }
  } catch (e) { }
  try {
    const u = window.claude && window.claude.use ? await window.claude.use('user') : null;
    if (u) { const me = await u.me(); NET.who = me && me.isOwner ? 'owner' : me && me.id ? 'member' : 'anon'; } else NET.who = window.claude ? 'anon' : null;
  } catch (e) { }
  if (!NET.room && 'BroadcastChannel' in window) { try { NET.bc = new BroadcastChannel(VEK_RELEASE.channel); NET.bc.onmessage = e => netIn(e.data); } catch (e) { } }
  NET.ready = true; netStatus(); netConnInfo(); netRestore();
}
function netRoomErr(e) { if (NET.roomErr) return; NET.roomErr = (e && e.code) || 'chyba'; netConnInfo(); }
const plural = (n, a, b, c) => n === 1 ? a : n >= 2 && n <= 4 ? b : c;
// stav připojení zvlášť pod pokyny: hned je vidět, jestli jsou oba hráči na stránce
function netConnInfo() {
  let c = el('net-conn'); const s = el('net-status'); if (!s) return;
  if (!c) { c = document.createElement('p'); c.className = 'hint'; c.id = 'net-conn'; s.after(c); }
  if (!NET.ready) { c.textContent = ''; return; }
  let t, bad = true;
  if (!NET.room) t = !window.claude ? (window.RTCPeerConnection ? 'Hra tu běží mimo claude.ai: se soupeřem se spoj napřímo přes zprávu níže.' : '⚠ Hra po síti tady není dostupná.')
    : NET.who === 'anon' ? '⚠ Tahle stránka není připojená k síti Claude: Claude tě tu nepoznává. Nejsi přihlášený na claude.ai, nebo jsi přihlášený jiným účtem, než na který přišla pozvánka. Přihlas se správným účtem a stránku načti znovu.'
    : NET.who === 'member' ? '⚠ Jsi přihlášený a pozvaný, ale síť Claude pro hry tě sem nepustila. Hosty zvenku účtu nejspíš nepouští, to nastavuje claude.ai.'
    : '⚠ Tahle stránka není připojená k síti Claude, takže hra přes internet nepůjde.';
  else if (NET.roomErr) t = '⚠ Síť Claude hlásí chybu (' + NET.roomErr + '). ' + (NET.roomErr === 'not_granted' || NET.roomErr === 'revoked' ? 'Tahle stránka není připojená: otevři hru přihlášený na claude.ai přes pozvánku s právem přispívat.' : 'Zkus stránku načíst znovu.');
  else if (!NET.conn) t = 'Připojuji se k síti Claude…';
  else { const n = NET.others || 0; bad = false; t = '✓ Připojeno k síti Claude. ' + (n ? 'Na stránce ' + plural(n, 'je', 'jsou', 'je') + ' ještě ' + n + ' ' + plural(n, 'další hráč', 'další hráči', 'dalších hráčů') + '.' : 'Na stránce jsi zatím sám – soupeř ji nemá otevřenou, nebo není připojený.'); }
  c.textContent = t; c.style.color = bad ? '#e8a07a' : '';
}
function netStatus(text) {
  const s = el('net-status'); if (!s) return;
  if (text) { s.textContent = text; return; }
  s.textContent = !window.claude ? 'Hra běží mimo claude.ai. Na různých zařízeních se spojíte přímým spojením přes zprávu níže; Založit hru tu spojí jen dvě okna jednoho prohlížeče.' : 'Jeden z vás klikne na Založit hru a druhému pošle kód. Oba musíte být přihlášení na claude.ai a soupeř musí mít hru nasdílenou s právem přispívat – veřejný odkaz nestačí.';
  el('b-host').disabled = el('b-join').disabled = !(NET.room || NET.bc);
}
// lobby přežije znovunačtení stránky (na telefonu se při přepnutí do jiné aplikace stránka často načte znovu)
function netRemember(on) { try { if (on) localStorage.setItem(VEK_RELEASE.lobbyKey, JSON.stringify({ role: NET.role, code: NET.code, t: Date.now() })); else localStorage.removeItem(VEK_RELEASE.lobbyKey); } catch (e) { } }
function netRestore() {
  let v = null; try { v = JSON.parse(localStorage.getItem(VEK_RELEASE.lobbyKey) || 'null'); } catch (e) { }
  if (!v || !v.code || Date.now() - v.t > 20 * 60000 || NET.role || el('start').hidden || !(NET.room || NET.bc)) return;
  if (v.role === 'host') { netReset(); NET.role = 'host'; NET.code = v.code; netStatus('Kód hry: ' + NET.code + '. Pošli ho soupeři. Hra začne, jakmile se připojí. Nastavení režimu výše platí pro oba.'); }
  else if (v.role === 'guest') { el('net-code').value = v.code; netJoin(); }
}
function netSend(d) {
  d.c = NET.code; d.version = VEK_RELEASE.id;
  if (NET.rtc && NET.rtc.readyState === 'open') { if (NET.rtc.bufferedAmount < 1e6) try { NET.rtc.send(JSON.stringify(d)); } catch (e) { } return; }
  if (NET.room) NET.room.emit(NET.role === 'host' ? 'h' : 'g', d).catch(e => { if (NET.err) return; NET.err = (e && e.code) || 'chyba'; const t = NET.err === 'not_permitted' ? 'Nemáš právo posílat do hry. Vlastník ti musí stránku nasdílet s právem přispívat.' : 'Síť hlásí chybu (' + NET.err + ').'; netStatus(t); msg(t, 'bad'); });
  else if (NET.bc) NET.bc.postMessage(d);
}
function netReset() { Object.assign(NET, { role: null, code: '', started: false, out: [], shots: [], log: [], pend: [], seq: 0, ack: 0, parts: null, logN: 0, ug: null, bg: null, lost: false, err: null }); }

// ---------- přímé spojení (WebRTC) bez sítě Claude ----------
// Pozvánka a odpověď jsou zabalené popisy spojení; hráči si je pošlou zprávou. Pak už hry mluví napřímo.
const P2P = { mode: null }, ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
const b64u = u8 => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = t => { const s = atob(t.replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
async function zipStream(u8, Ctor) { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new Ctor('deflate-raw'))).arrayBuffer()); }
async function packSdp(type, sdp) {
  let bytes = new TextEncoder().encode(sdp), z = '0';
  if (window.CompressionStream) try { bytes = await zipStream(bytes, CompressionStream); z = '1'; } catch (e) { bytes = new TextEncoder().encode(sdp); }
  return 'VEK' + type + z + b64u(bytes);
}
async function unpackSdp(text) {
  const m = /VEK([oa])([01])([A-Za-z0-9_-]{20,})/.exec((text || '').replace(/\s+/g, '')); if (!m) return null;
  try { let bytes = unb64u(m[3]); if (m[2] === '1') bytes = await zipStream(bytes, DecompressionStream); return { type: m[1] === 'o' ? 'offer' : 'answer', sdp: new TextDecoder().decode(bytes) }; } catch (e) { return null; }
}
function iceDone(pc) {
  return new Promise(res => { if (pc.iceGatheringState === 'complete') return res(); const t = setTimeout(res, 4000);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); });
}
function p2pUi(status, cls, text, go, showText) {
  const st = el('p-status'); st.textContent = status || ''; st.className = 'hint' + (cls ? ' ' + cls : '');
  if (text != null) el('p-text').value = text;
  el('p-text').hidden = !showText; el('p-btns').hidden = !showText; el('p-copy').hidden = !el('p-text').readOnly;
  if (go) el('p-go').textContent = go; el('p-go').hidden = !go;
}
function p2pClose() { if (NET.pc) { try { NET.pc.close(); } catch (e) { } } NET.pc = null; if (NET.rtc) { try { NET.rtc.close(); } catch (e) { } } NET.rtc = null; }
function p2pWire(ch, role) {
  ch.onopen = () => {
    if (NET.rtc && NET.rtc !== ch) return;
    NET.rtc = ch; netReset(); netRemember(false); NET.role = role; NET.code = 'VEK1'; P2P.mode = 'open';
    if (role === 'guest') { NET.helloT = 0; NET.joinAt = performance.now(); NET.hinted = true; }
    p2pUi('Spojeno! ' + (role === 'host' ? 'Hra začíná…' : 'Načítám hru…'), 'ok', null, null, false);
    netStatus('Spojeno napřímo se soupeřem.');
  };
  ch.onmessage = e => { let d = null; try { d = JSON.parse(e.data); } catch (x) { return; } netIn(d); };
  ch.onclose = () => { if (NET.rtc !== ch) return; NET.rtc = null; if (NET.started) msg('Přímé spojení se soupeřem se přerušilo.', 'bad'); else p2pUi('Spojení se přerušilo. Zkuste to znovu od začátku.', 'bad', null, null, false); };
}
function p2pWatch(pc) {
  pc.onconnectionstatechange = () => { if (pc !== NET.pc) return; if (pc.connectionState === 'failed') p2pUi('Napřímo se spojit nepodařilo. Zkuste být oba na stejné Wi-Fi a začněte znovu novou pozvánkou.', 'bad', null, null, false); };
}
async function p2pHost() {
  if (!matchFormValid()) return;
  if (!window.RTCPeerConnection) { p2pUi('Tenhle prohlížeč přímé spojení neumí.', 'bad', null, null, false); return; }
  p2pClose(); netReset(); P2P.mode = 'host'; p2pUi('Připravuji pozvánku…', '', '', null, false);
  try {
    const pc = NET.pc = new RTCPeerConnection({ iceServers: ICE }); p2pWatch(pc); p2pWire(pc.createDataChannel('vek'), 'host');
    await pc.setLocalDescription(await pc.createOffer()); await iceDone(pc); if (pc !== NET.pc) return;
    el('p-text').readOnly = true;
    p2pUi('1) Pošli tenhle text soupeři. 2) Až ti pošle odpověď, klikni na Vložit odpověď, vlož ji a klikni na Spojit.', '', await packSdp('o', pc.localDescription.sdp), 'Vložit odpověď', true);
    P2P.mode = 'hostOffer';
  } catch (e) { p2pUi('Pozvánku se nepodařilo vytvořit (' + (e && e.name || 'chyba') + ').', 'bad', null, null, false); }
}
function p2pGuest() {
  if (!window.RTCPeerConnection) { p2pUi('Tenhle prohlížeč přímé spojení neumí.', 'bad', null, null, false); return; }
  p2pClose(); netReset(); P2P.mode = 'guest'; el('p-text').readOnly = false;
  p2pUi('Vlož sem pozvánku od soupeře a klikni na Odpovědět.', '', '', 'Odpovědět', true); el('p-text').focus();
}
async function p2pGo() {
  if (P2P.mode === 'hostOffer') { el('p-text').readOnly = false; P2P.mode = 'hostAnswer'; p2pUi('Vlož sem odpověď od soupeře a klikni na Spojit.', '', '', 'Spojit', true); el('p-text').focus(); return; }
  const got = await unpackSdp(el('p-text').value);
  if (P2P.mode === 'guest') {
    if (!got || got.type !== 'offer') { p2pUi(got ? 'Tohle je odpověď, ne pozvánka. Pozvánku vytváří ten, kdo klikl na Vytvořit pozvánku.' : 'Tohle nevypadá jako pozvánka. Zkopíruj celý text, který ti soupeř poslal.', 'bad', null, 'Odpovědět', true); return; }
    try {
      p2pClose(); const pc = NET.pc = new RTCPeerConnection({ iceServers: ICE }); p2pWatch(pc); pc.ondatachannel = e => p2pWire(e.channel, 'guest');
      p2pUi('Připravuji odpověď…', '', null, null, false);
      await pc.setRemoteDescription({ type: 'offer', sdp: got.sdp }); await pc.setLocalDescription(await pc.createAnswer()); await iceDone(pc); if (pc !== NET.pc) return;
      el('p-text').readOnly = true; P2P.mode = 'guestAnswer';
      p2pUi('Pošli tenhle text zpátky soupeři. Hra začne, jakmile ho vloží.', '', await packSdp('a', pc.localDescription.sdp), null, true);
    } catch (e) { p2pUi('Pozvánku se nepodařilo použít (' + (e && e.name || 'chyba') + '). Ať soupeř vytvoří novou.', 'bad', null, null, false); }
    return;
  }
  if (P2P.mode === 'hostAnswer') {
    if (!got || got.type !== 'answer') { p2pUi(got ? 'Tohle je tvoje vlastní pozvánka. Vlož odpověď, kterou ti poslal soupeř.' : 'Tohle nevypadá jako odpověď. Zkopíruj celý text, který ti soupeř poslal.', 'bad', null, 'Spojit', true); return; }
    try { await NET.pc.setRemoteDescription({ type: 'answer', sdp: got.sdp }); p2pUi('Spojuji…', '', null, null, false); }
    catch (e) { p2pUi('Odpověď nesedí k téhle pozvánce. Začněte znovu: Vytvořit pozvánku.', 'bad', null, null, false); }
  }
}
async function p2pCopy() {
  const t = el('p-text').value; if (!t) return;
  if (navigator.share) { try { await navigator.share({ text: t }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(t); el('p-status').textContent = 'Zkopírováno. Teď to vlož do zprávy soupeři. ' + el('p-status').textContent.replace(/^Zkopírováno\. Teď to vlož do zprávy soupeři\. /, ''); return; } catch (e) { }
  const ta = el('p-text'); ta.focus(); ta.select(); try { document.execCommand('copy'); el('p-status').textContent = 'Zkopírováno. Teď to vlož do zprávy soupeři.'; } catch (e) { el('p-status').textContent = 'Text je označený, zkopíruj ho ručně.'; }
}

// ---------- lobby ----------
function netHost() {
  if (!matchFormValid()) return;
  if (!NET.ready) return;
  netReset(); NET.role = 'host'; NET.code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPRSTUVXYZ'[Math.floor(Math.random() * 22)]).join('');
  netStatus('Kód hry: ' + NET.code + '. Pošli ho soupeři. Hra začne, jakmile se připojí. Nastavení režimu výše platí pro oba.');
  netRemember(true);
}
function netJoin() {
  if (!NET.ready) return;
  const code = (el('net-code').value || '').trim().toUpperCase();
  if (code.length !== 4) { netStatus('Zadej čtyřpísmenný kód, který ti poslal soupeř.'); return; }
  netReset(); NET.role = 'guest'; NET.code = code; NET.helloT = 0; NET.joinAt = performance.now(); NET.hinted = false;
  netStatus('Hledám hru ' + code + '…'); netRemember(true);
}
function hostStart() {
  if (!applyOpts()) return; G.mode = 'host'; MY = 0; G.speed = 1; el('b-speed').textContent = '1×';
  startFresh(); NET.started = true; NET.log = []; NET.out = []; NET.shots = []; NET.ack = 0; netRemember(false);
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
  NET.logN = sv.logN || 0; NET.started = true; NET.parts = null; NET.ug = null; NET.bg = null; netRemember(false);
  cam.x = teams[1].tcx; cam.z = teams[1].tcz + 4; cam.yaw = 0;
  el('start').hidden = true; G.paused = false;
  msg('Připojeno. Hraješ za červené, soupeř za modré.', 'good');
}

// ---------- příjem ----------
function netIn(d) {
  if (!d || typeof d !== 'object' || !NET.role || d.c !== NET.code) return;
  if ((d.version || '1.0.1') !== VEK_RELEASE.id) { netStatus('Soupeř má jinou verzi hry. Oba vyberte stejnou verzi v nabídce Verze hry.'); return; }
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
    const ot = (f >> 3) & 15; u.order = ot ? { type: OT[ot], node: { def: { res: RES[(f >> 7) & 15] } } } : null;
    u.carry = (e[7] || 0) / 10; u.ctype = RES[e[8]] || null; u.homeMarket = e[9];
  }
  if (chunkDone('ug', d)) for (let i = units.length - 1; i >= 0; i--) if (units[i].gen !== d.g) { teams[units[i].team].pop--; dropEnt(units[i]); units.splice(i, 1); }
  for (const s of d.sh || []) { const a = byId.get(s[0]), t = byId.get(s[1]); if (a && t && PK[s[2]]) { shoot(a, t, PK[s[2]], 0); projs[projs.length - 1].fx = true; } }
}
function applyBlds(d) {
  for (const e of d.d) {
    let b = byId.get(e[0]); const team = e[1] >= 100 ? 1 : 0, type = BT[e[1] % 100], done = !!(e[6] & 1);
    if (!b) { if (!type) continue; const keep = nextId; nextId = e[0]; b = placeBuilding(team, type, e[2], e[3], done); nextId = Math.max(keep, e[0] + 1); }
    if (!b.isB) continue;
    b.hp = e[4]; b.maxHp = e[5]; b.gen = d.g; b.fire = e[6] & 2 ? 1 : 0; b.prog = e[7] / 100; b.crop = e[8] ? 'grain' : 'food'; b.enabled = e[9] !== 0;
    if (done && !b.done) { b.done = true; b.mesh.scale.y = 1; cmdSig = ''; cityRoadDirty = true; } else if (!done) b.mesh.scale.y = 0.12 + 0.88 * Math.min(1, b.prog);
  }
  if (chunkDone('bg', d)) for (let i = blds.length - 1; i >= 0; i--) if (blds[i].gen !== d.g) { cityRoadDirty = true; dropEnt(blds[i]); blds.splice(i, 1); }
}
function applyState(d) {
  G.time = d.time; G.flood = d.fl || 0; G.rain = d.rn || 0; EV.drought = !!d.dr; EV.frost = !!d.fr;
  (d.T || []).forEach((s, i) => { const T = teams[i]; if (!T || !s) return; RES.forEach((k, j) => { T.res[k] = s.r[j] || 0; }); T.era = s.era; T.pop = s.pop; T.cap = s.cap; T.hungry = !!s.h; T.cold = !!s.cold; if (s.city && typeof s.city === 'object') { T.city = s.city; cityState(T); } if (s.tech) { T.tech = {}; s.tech.forEach(k => { T.tech[k] = true; }); T.busy = {}; (s.busy || []).forEach(k => { T.busy[k] = true; }); } });
  const cn = teams[MY].n = {}; for (const b of blds) if (b.team === MY) { if (b.done) cn[b.type] = (cn[b.type] || 0) + 1; b.queue = []; }
  for (const q of d.q || []) { const b = byId.get(q[0]); if (b && b.isB) b.queue = q[1].map(x => ({ kind: x[0], id: x[1], t: x[2], total: x[3] })); }
  if (d.pr) Object.assign(PRICE, d.pr);
  NET.pend = NET.pend.filter(p => p[0] > d.ack);
  for (const m of d.m || []) { if (m[0] === '!') alertAttack(m[1], m[2], !!m[3]); else msg(String(m[0]).slice(0, 200), m[1] === 'good' || m[1] === 'bad' ? m[1] : ''); }
  (d.T || []).forEach((s, i) => { if (teams[i] && s.stats) teams[i].stats = s.stats; });
  if (Number.isInteger(d.over) && d.over >= -1 && !G.over) endGame(d.over, d.reason);
}
function applyWorld(d) {
  if (d.li > NET.logN) { if (!NET.resync) { NET.resync = performance.now(); NET.helloT = 0; } return; }   // něco uteklo: vyžádat celý stav znovu
  for (let i = NET.logN - d.li; i < d.log.length; i++) {
    const e = d.log[i]; NET.logN++;
    if (e[0] === 0) { const n = nodes[e[1]]; if (n && n.amt > 0) depleteNode(n); }
    else if (e[0] === 2) { const n = nodes[e[1]]; if (n && n.type === 'tree') regrowTree(n, e[2]); }
    else { const n = { id: nodes.length, isNode: true, type: 'meat', def: NODE_DEF.meat, cx: e[1], cy: e[2], x: e[3], z: e[4], amt: NODE_DEF.meat.amt, inst: -1, v: 0.5 }; nodes.push(n); nodeAt[cidx(n.cx, n.cy)] = n.id; addMeat(n); n.mesh.rotation.y = e[5]; }
  }
  const seen = new Set();
  for (const e of d.an || []) { seen.add(e[0]); let a = animals.find(a => a.id === e[0]); if (!a) { a = addAnimal(e[1] / 10, e[2] / 10); a.id = e[0]; } a.tx = e[1] / 10; a.tz = e[2] / 10; }
  for (let i = animals.length - 1; i >= 0; i--) if (!seen.has(animals[i].id)) { scene.remove(animals[i].mesh); animals[i].dead = true; animals.splice(i, 1); }
}

// ---------- odesílání ----------
function netCmd(c) { NET.pend.push([++NET.seq, c]); netSend({ t: 'c', l: NET.pend.slice(0, 12) }); NET.lastResend = performance.now(); }
const encU = u => { const o = u.order, ot = o ? Math.max(0, OT.indexOf(o.type)) : 0, ri = o && o.type === 'gather' ? RES.indexOf(o.node.def.res) : 0; return [u.id, u.team * 100 + UT.indexOf(u.type), Math.round(u.x * 10), Math.round(u.z * 10), Math.ceil(u.hp), (u.moving ? 1 : 0) | (u.working ? 2 : 0) | (u.sick > 0 ? 4 : 0) | (ot << 3) | (ri << 7), Math.round(u.face * 10), Math.round(u.carry * 10), RES.indexOf(u.ctype), u.homeMarket]; };
const encB = b => [b.id, b.team * 100 + BT.indexOf(b.type), b.cx, b.cy, Math.ceil(b.hp), b.maxHp, (b.done ? 1 : 0) | (b.fire > 0 ? 2 : 0), Math.round(b.prog * 100), b.crop === 'grain' ? 1 : 0, b.enabled ? 1 : 0];
function sendChunks(t, list, enc, per, extra) {
  const g = ++NET.gen, n = Math.max(1, Math.ceil(list.length / per));
  for (let k = 0; k < n; k++) { const m = { t, g, k, n, d: list.slice(k * per, (k + 1) * per).map(enc) }; if (!k && extra) Object.assign(m, extra); netSend(m); }
}
function hostTick() {
  const i = NET.tick++;
  if (i % 2 === 0) sendChunks('u', units, encU, 90, { sh: NET.shots.splice(0, 40).map(s => [s[0], s[1], PK.indexOf(s[2])]) });
  if (i % 10 === 1) sendChunks('b', blds, encB, 85);
  if (i % 5 === 2) netSend({
    t: 's', time: r1(G.time), fl: r1(G.flood || 0), rn: G.rain || 0, dr: EV.drought ? 1 : 0, fr: EV.frost ? 1 : 0, ack: NET.ack, over: G.over ? G.loser : -2, reason: G.endReason,
    T: teams.map((T, k) => ({ r: RES.map(r => Math.floor(T.res[r])), era: T.era, pop: T.pop, cap: T.cap, h: T.hungry ? 1 : 0, cold: T.cold ? 1 : 0, city: { auto: cityState(T).auto, maintenance: cityState(T).maintenance, priorities: cityState(T).priorities, morale: cityState(T).morale }, stats: T.stats, tech: k === 1 ? Object.keys(T.tech) : undefined, busy: k === 1 ? Object.keys(T.busy) : undefined })),
    q: blds.filter(b => b.team === 1 && b.queue.length).slice(0, 12).map(b => [b.id, b.queue.map(q => [q.kind, q.id, r1(q.t), q.total])]),
    pr: { food: Math.round(PRICE.food), wood: Math.round(PRICE.wood), stone: Math.round(PRICE.stone), metal: Math.round(PRICE.metal) }, m: NET.out.splice(0, 5),
  });
  if (i % 10 === 6) netSend({ t: 'n', li: Math.max(0, NET.log.length - 50), log: NET.log.slice(-50), an: animals.map(a => [a.id, Math.round(a.x * 10), Math.round(a.z * 10)]) });
}
function netFrame(now, dt) {
  if (!NET.role) return;
  if (NET.role === 'guest' && (!NET.started || NET.resync) && now - NET.helloT > 1500) { NET.helloT = now; netSend({ t: 'hello' }); }
  if (NET.role === 'guest' && !NET.started && !NET.hinted && NET.joinAt && now - NET.joinAt > 12000) {   // dlouho bez odpovědi: poradit, co zkontrolovat
    NET.hinted = true;
    netStatus('Hra ' + NET.code + ' se pořád nehlásí. ' + (NET.room && NET.conn && !NET.others ? 'Na stránce teď nikoho dalšího nevidím: soupeř ji nemá otevřenou, nebo jeho stránka není připojená k síti Claude. ' : '') + 'Zkontroluj, že kód je správně, soupeř klikl na Založit hru a má hru otevřenou na obrazovce, a že u vás obou dole svítí „Připojeno k síti Claude“. Hledám dál…');
  }
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
