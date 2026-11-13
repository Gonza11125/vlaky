'use strict';
// Zvuky a hudba. Všechno se skládá v prohlížeči (WebAudio), žádné zvukové soubory.

const AU = { ctx: null, on: true, vol: 0.7, music: true, amb: true, started: false, last: {}, nb: null, amb2: {}, mus: { next: 0, i: 0, mel: 0 }, bellT: 0, birdT: 2, crT: 0 };
try { const v = JSON.parse(localStorage.getItem('starosta-audio') || 'null'); if (v) Object.assign(AU, { on: v.on !== false, vol: v.vol != null ? v.vol : 0.7, music: v.music !== false, amb: v.amb !== false }); } catch (_) { }
function audioSave() { try { localStorage.setItem('starosta-audio', JSON.stringify({ on: AU.on, vol: AU.vol, music: AU.music, amb: AU.amb })); } catch (_) { } }

function audioStart() {
  if (AU.started) { if (AU.ctx && AU.ctx.state === 'suspended') AU.ctx.resume().catch(() => { }); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  let c; try { c = new AC(); } catch (_) { return; }
  AU.ctx = c; AU.started = true;
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.connect(c.destination);
  AU.master = c.createGain(); AU.master.gain.value = AU.on ? AU.vol : 0; AU.master.connect(comp);
  // dozvuk
  const len = c.sampleRate * 2.6, ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  AU.rev = c.createConvolver(); AU.rev.buffer = ir; const rg = c.createGain(); rg.gain.value = 0.35; AU.rev.connect(rg); rg.connect(AU.master);
  AU.sfx = c.createGain(); AU.sfx.gain.value = 0.8; AU.sfx.connect(AU.master);
  AU.ambG = c.createGain(); AU.ambG.gain.value = AU.amb ? 0.6 : 0; AU.ambG.connect(AU.master);
  AU.musG = c.createGain(); AU.musG.gain.value = AU.music ? 0.32 : 0; AU.musG.connect(AU.master); AU.musG.connect(AU.rev);
  // šum pro vítr, déšť, město
  const nb = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), nd = nb.getChannelData(0); let b = 0;
  for (let i = 0; i < nd.length; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; nd[i] = w * 0.5 + b * 3; }
  AU.nb = nb;
  const loop = (type, f, q) => { const s = c.createBufferSource(); s.buffer = nb; s.loop = true; s.playbackRate.value = 0.7 + Math.random() * 0.3; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q || 0.7; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(AU.ambG); s.start(); return { g, fl }; };
  AU.amb2 = { city: loop('lowpass', 380), traffic: loop('bandpass', 1100, 0.6), wind: loop('lowpass', 520), rain: loop('highpass', 2600) };
  AU.mus.next = c.currentTime + 1.5;
}
addEventListener('pointerdown', audioStart, true); addEventListener('keydown', audioStart, true);
function setAudio(o) { Object.assign(AU, o); audioSave(); if (!AU.ctx) return; const t = AU.ctx.currentTime;
  AU.master.gain.setTargetAtTime(AU.on ? AU.vol : 0, t, 0.05); AU.ambG.gain.setTargetAtTime(AU.amb ? 0.6 : 0, t, 0.2); AU.musG.gain.setTargetAtTime(AU.music ? 0.32 : 0, t, 0.3); }

// ---------- stavební kameny ----------
function env(g, t, a, peak, d) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function tone(freq, t, dur, peak, type, out, attack, bend) {
  const c = AU.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t); if (bend) o.frequency.exponentialRampToValueAtTime(bend, t + dur);
  o.connect(g); g.connect(out || AU.sfx); env(g, t, attack || 0.008, peak, dur); o.start(t); o.stop(t + (attack || 0.008) + dur + 0.05); return o;
}
function noise(t, dur, peak, type, f0, f1, out, q) {
  const c = AU.ctx, s = c.createBufferSource(); s.buffer = AU.nb; s.playbackRate.value = 1; const fl = c.createBiquadFilter(); fl.type = type || 'lowpass'; fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur); fl.Q.value = q || 0.8;
  const g = c.createGain(); s.connect(fl); fl.connect(g); g.connect(out || AU.sfx); env(g, t, 0.005, peak, dur); s.start(t, Math.random() * 2); s.stop(t + dur + 0.1);
}
// hlasitost podle vzdálenosti od středu pohledu a přiblížení
function near(x, z) { if (x == null) return 1; const d = Math.hypot(x - cam.x, z - cam.z); return clamp(1.15 - d / (cam.dist * 0.9 + 40), 0, 1) * clamp(1.4 - cam.dist / 380, 0.25, 1); }
function rate(name, s) { const now = performance.now(); if (now - (AU.last[name] || 0) < s * 1000) return false; AU.last[name] = now; return true; }

// ---------- zvukové efekty ----------
function sfx(name, x, z) {
  if (!AU.ctx || !AU.on || AU.ctx.state !== 'running') return;
  const c = AU.ctx, t = c.currentTime + 0.01, v = near(x, z); if (v <= 0.02) return;
  switch (name) {
    case 'click': if (!rate('click', 0.05)) return; tone(1800, t, 0.04, 0.08, 'triangle'); break;
    case 'build': if (!rate('build', 0.25)) return; for (let i = 0; i < 3; i++) { noise(t + i * 0.13, 0.08, 0.5 * v, 'lowpass', 900, 300); tone(140, t + i * 0.13, 0.08, 0.25 * v, 'sine'); } tone(1320, t + 0.42, 0.5, 0.06, 'sine'); break;
    case 'road': if (!rate('road', 0.2)) return; noise(t, 0.18, 0.3, 'bandpass', 700, 300, null, 1.2); break;
    case 'zone': if (!rate('zone', 0.2)) return; tone(660, t, 0.12, 0.06, 'sine'); tone(880, t + 0.06, 0.15, 0.05, 'sine'); break;
    case 'demolish': if (!rate('demolish', 0.3)) return; noise(t, 0.9, 0.7 * v, 'lowpass', 1400, 120); tone(70, t, 0.6, 0.3 * v, 'sine', null, 0.01, 40); break;
    case 'boom': if (!rate('boom', 0.15)) return; noise(t, 1.6, 0.9 * v, 'lowpass', 2400, 90); tone(55, t, 1.0, 0.6 * v, 'sine', null, 0.005, 30); break;
    case 'thunder': { const d = 0.2 + Math.random() * 1.2; noise(t + d, 3.2, 0.7, 'lowpass', 900, 60); noise(t + d, 0.25, 0.4, 'highpass', 2000, 800); break; }
    case 'siren': { if (!rate('siren', 4)) return; const out = c.createGain(); out.gain.value = 0.11 * v; out.connect(AU.sfx); out.connect(AU.rev);   // dvoutónová hasičská siréna
      for (let i = 0; i < 6; i++) { const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = i % 2 ? 440 : 587; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; o.connect(lp); lp.connect(g); g.connect(out); g.gain.setValueAtTime(0, t + i * 0.55); g.gain.linearRampToValueAtTime(1, t + i * 0.55 + 0.02); g.gain.setValueAtTime(1, t + i * 0.55 + 0.5); g.gain.linearRampToValueAtTime(0, t + i * 0.55 + 0.54); o.start(t + i * 0.55); o.stop(t + i * 0.55 + 0.56); }
      break; }
    case 'police': { if (!rate('police', 4)) return; const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter(); o.type = 'sawtooth'; lp.type = 'lowpass'; lp.frequency.value = 2000; o.connect(lp); lp.connect(g); g.connect(AU.sfx);
      for (let i = 0; i < 4; i++) { o.frequency.setValueAtTime(600, t + i * 0.8); o.frequency.linearRampToValueAtTime(1150, t + i * 0.8 + 0.4); o.frequency.linearRampToValueAtTime(600, t + i * 0.8 + 0.8); }
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.08 * v, t + 0.1); g.gain.setValueAtTime(0.08 * v, t + 3); g.gain.linearRampToValueAtTime(0, t + 3.2); o.start(t); o.stop(t + 3.3); break; }
    case 'horn': { if (!rate('horn', 2.5)) return; for (const f of [311, 392]) { const o = tone(f, t, 0.9, 0.09 * v, 'sawtooth', null, 0.04); } break; }
    case 'bell': tone(1560, t, 0.25, 0.07 * v, 'triangle'); tone(2080, t, 0.2, 0.03 * v, 'sine'); break;
    case 'good': if (!rate('good', 1.2)) return; tone(784, t, 0.25, 0.08, 'sine'); tone(1046, t + 0.09, 0.4, 0.07, 'sine'); break;
    case 'bad': if (!rate('bad', 1.5)) return; tone(330, t, 0.3, 0.09, 'triangle'); tone(247, t + 0.16, 0.45, 0.09, 'triangle'); break;
    case 'research': for (let i = 0; i < 4; i++) tone([523, 659, 784, 1046][i], t + i * 0.09, 0.4, 0.07, 'sine'); break;
    case 'fanfare': [[523, 0], [659, 0.16], [784, 0.32], [1046, 0.5], [784, 0.75], [1046, 0.9]].forEach(([f, d]) => { tone(f, t + d, 0.35, 0.09, 'triangle'); tone(f / 2, t + d, 0.35, 0.05, 'sine'); }); break;
    case 'coin': if (!rate('coin', 0.4)) return; tone(988, t, 0.08, 0.06, 'square'); tone(1319, t + 0.07, 0.25, 0.06, 'square'); break;
    case 'firework': { const d = 0.05 + Math.random() * 0.2; noise(t + d, 0.5, 0.35 * v, 'lowpass', 1800, 200); for (let i = 0; i < 6; i++) noise(t + d + 0.25 + Math.random() * 0.6, 0.04, 0.12 * v, 'highpass', 3000, 5000); break; }
    case 'crowd': { if (!rate('crowd', 6)) return; noise(t, 2.5, 0.25 * v, 'bandpass', 600, 900, null, 0.6); break; }
  }
}

// ---------- hudba: klidné akordy a melodie, v noci a v krizi molově ----------
const MUS_DAY = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67], [60, 64, 67, 72], [52, 55, 59, 64], [53, 57, 60, 65], [55, 59, 62, 65]];
const MUS_NIGHT = [[57, 60, 64, 67], [53, 57, 60, 64], [50, 53, 57, 60], [52, 56, 59, 64]];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function musicTick() {
  const c = AU.ctx; if (AU.mus.next < c.currentTime) AU.mus.next = c.currentTime + 0.2; const t0 = AU.mus.next; if (!AU.music || t0 > c.currentTime + 0.3) return;
  const night = ATM && ATM.n > 0.6, tense = S && (S.inc || []).some(i => ['riot', 'assault', 'flood', 'bigfire'].includes(i.type));
  const prog = night || tense ? MUS_NIGHT : MUS_DAY, ch = prog[AU.mus.i % prog.length], dur = tense ? 5 : 8;
  AU.mus.i++; AU.mus.next = t0 + dur;
  // podklad
  for (const m of ch) { const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter(); o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = mtof(m - 12); o2.frequency.value = mtof(m - 12) * 1.003;
    lp.type = 'lowpass'; lp.frequency.value = night ? 700 : 1100; o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(AU.musG);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.05, t0 + 2.2); g.gain.setValueAtTime(0.05, t0 + dur - 1.5); g.gain.linearRampToValueAtTime(0.0001, t0 + dur + 1);
    o.start(t0); o2.start(t0); o.stop(t0 + dur + 1.1); o2.stop(t0 + dur + 1.1); }
  tone(mtof(ch[0] - 24), t0, dur, 0.06, 'sine', AU.musG, 1.5);
  // melodie z tónů akordu a pentatoniky
  const scale = [0, 2, 4, 7, 9], n = tense ? 2 : 3 + ((Math.random() * 3) | 0);
  for (let i = 0; i < n; i++) { if (Math.random() < 0.25) continue; const base = ch[(Math.random() * ch.length) | 0] + 12, m = Math.random() < 0.5 ? base : 72 + scale[(Math.random() * 5) | 0] - (night ? 3 : 0), tt = t0 + 0.5 + i * (dur - 1) / n + Math.random() * 0.3;
    tone(mtof(m), tt, 1.6, 0.045, 'sine', AU.musG, 0.01); tone(mtof(m) * 2, tt, 0.6, 0.012, 'sine', AU.musG, 0.01); }
}

// ---------- okolní zvuky podle toho, na co se díváš ----------
let _auT = 0;
function updateAudio(dt) {
  if (!AU.ctx || AU.ctx.state !== 'running') return;
  const c = AU.ctx, t = c.currentTime; _auT -= dt;
  if (AU.music) musicTick();
  if (_auT > 0) return; _auT = 0.25;
  const A = AU.amb2, playing = G.playing, zoom = clamp(1.5 - cam.dist / 300, 0.15, 1);
  // kolik města je kolem kamery
  const cx = clamp(Math.round((cam.x + HALF) / TS - 0.5), 0, N - 1), cy = clamp(Math.round((cam.z + HALF) / TS - 0.5), 0, N - 1), r = clamp(Math.round(cam.dist / 14), 4, 14);
  let built = 0, green = 0, roads = 0, tr = 0, cnt = 0;
  for (let j = cy - r; j <= cy + r; j += 2) for (let i = cx - r; i <= cx + r; i += 2) { if (!inb(i, j)) continue; const k = idx(i, j); cnt++; if (lvl[k]) built += dens[k] ? 2 : 1; else if (ter[k] === 3 || ter[k] === 4 || ter[k] === 0) green++; if (road[k]) { roads++; tr += traf[k]; } }
  const urb = cnt ? clamp(built / cnt, 0, 1.5) : 0, nat = cnt ? green / cnt : 0, traffic = roads ? tr / roads : 0, n = ATM ? ATM.n : 0;
  const w = ATM ? ATM.weather : 'jasno', wind = ATM ? (0.15 + ATM.snow * 0.3 + (w === 'bouřka' ? 0.6 : w === 'prší' ? 0.25 : 0)) : 0.15;
  const set = (o, v) => o.g.gain.setTargetAtTime(playing ? v : 0, t, 0.6);
  set(A.city, (0.05 + urb * 0.22) * zoom * (1 - n * 0.45));
  set(A.traffic, Math.min(0.2, traffic * 0.12 + urb * 0.04) * zoom * (1 - n * 0.6));
  set(A.wind, wind * (0.5 + (1 - zoom) * 0.6) * 0.5); A.wind.fl.frequency.setTargetAtTime(380 + Math.sin(t * 0.3) * 160, t, 1);
  set(A.rain, w === 'prší' || w === 'bouřka' ? 0.22 : 0);
  if (!playing) return;
  // ptáci ve dne v přírodě, cvrčci v létě v noci
  AU.birdT -= 0.25;
  if (AU.amb && n < 0.4 && nat > 0.25 && (ATM ? ATM.snow < 0.3 : true) && AU.birdT <= 0) { AU.birdT = 0.6 + Math.random() * 2.5; const f = 2400 + Math.random() * 1800, tt = t + Math.random() * 0.2;
    for (let i = 0; i < 2 + ((Math.random() * 4) | 0); i++) tone(f * (1 + Math.random() * 0.2), tt + i * 0.11, 0.07, 0.025 * nat * zoom, 'sine', AU.ambG, 0.005, f * (Math.random() < 0.5 ? 1.35 : 0.75)); }
  if (AU.amb && n > 0.6 && ATM && ATM.snow < 0.05 && ATM.autumn < 0.5 && nat > 0.2) { AU.crT -= 0.25; if (AU.crT <= 0) { AU.crT = 0.5 + Math.random() * 0.8; for (let i = 0; i < 6; i++) tone(4600, t + i * 0.045, 0.02, 0.012 * nat * zoom, 'square', AU.ambG, 0.002); } }
  // zvonek na přejezdu, který je vidět
  if (RL && RL.cross) { AU.bellT -= 0.25; const on = RL.cross.find(cr => cr.active && near(cr.x, cr.z) > 0.3); if (on && AU.bellT <= 0) { AU.bellT = 0.5; sfx('bell', on.x, on.z); setTimeout(() => sfx('bell', on.x, on.z), 250); } }
}
