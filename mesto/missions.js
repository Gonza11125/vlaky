'use strict';
// Mise s cílem a termínem, odznaky za úspěchy a statistiky s grafy.

const bcount = t => { let n = 0; for (const b of blds.values()) if (b.type === t && b.built >= 1) n++; return n; };
const pctOf = (v, goal) => clamp(v / goal, 0, 1);
const MISSIONS = [
  { id: 'vesnice', name: 'Z vesnice město', size: 1, tech: 0, crisis: 1, years: 12, desc: 'Pár stovek lidí, kostel a hospoda. Vybuduj z vesnice pořádné město s nemocnicí a spokojenými lidmi.',
    goals: [{ t: 'Obyvatel aspoň 20 000', ok: () => T.pop >= 20000, p: () => pctOf(T.pop, 20000) }, { t: 'Nemocnice ve městě', ok: () => bcount('hospital') > 0, p: () => bcount('hospital') ? 1 : 0 }, { t: 'Spokojenost aspoň 55 %', ok: () => S.happy >= 55, p: () => pctOf(S.happy, 55) }] },
  { id: 'dluh', name: 'Zadlužené město', size: 3, tech: 1, crisis: 1, years: 3, desc: 'Předchozí vedení nechalo dluh 25 milionů a prázdnou pokladnu. Dej finance do pořádku, aniž by tě lidé vyhnali z radnice.',
    setup: () => { S.loan = 25000000; S.money = -1500000; S.mood -= 5; },
    goals: [{ t: 'Splať všechny úvěry', ok: () => S.loan <= 0, p: () => 1 - pctOf(S.loan, 25000000) }, { t: 'V pokladně aspoň 5 mil. Kč', ok: () => S.money >= 5e6, p: () => pctOf(Math.max(0, S.money), 5e6) }, { t: 'Důvěra aspoň 50 %', ok: () => S.approval >= 50, p: () => pctOf(S.approval, 50) }] },
  { id: 'voda', name: 'Velká voda', size: 2, tech: 1, crisis: 1, years: 4, desc: 'Řeka se tu vylévá skoro každé jaro. Ochraň lidi hrázemi a nech městečko vyrůst.',
    setup: () => { S.mission.floodK = 4; },
    goals: [{ t: 'Aspoň 8 políček hrází', ok: () => bcount('dike') >= 8, p: () => pctOf(bcount('dike'), 8) }, { t: 'Obyvatel aspoň 10 000', ok: () => T.pop >= 10000, p: () => pctOf(T.pop, 10000) }, { t: 'Spokojenost aspoň 55 %', ok: () => S.happy >= 55, p: () => pctOf(S.happy, 55) }] },
  { id: 'zelene', name: 'Zelené město', size: 3, tech: 1, crisis: 1, years: 6, desc: 'Město dusí smog z uhelných elektráren. Zbav se uhlí i plynu, vyčisti vzduch a přitom nech město růst.',
    setup: () => { S.mission.c0 = bcount('coal') + bcount('gas'); },
    goals: [{ t: 'Žádná uhelná ani plynová elektrárna', ok: () => !bcount('coal') && !bcount('gas'), p: () => 1 - (bcount('coal') + bcount('gas')) / Math.max(1, S.mission.c0 || 1) }, { t: 'Znečištění pod 3', ok: () => T.pollR < 3, p: () => clamp(3 / Math.max(3, T.pollR), 0, 1) }, { t: 'Obyvatel aspoň 45 000', ok: () => T.pop >= 45000, p: () => pctOf(T.pop, 45000) }] },
  { id: 'uzel', name: 'Železniční uzel', size: 2, tech: 1, crisis: 1, years: 6, desc: 'Městečko na hlavní trati. Udělej z něj železniční uzel celého kraje.',
    goals: [{ t: 'Hlavní nádraží', ok: () => bcount('mainst') > 0, p: () => bcount('mainst') ? 1 : S.techs.intercity ? 0.5 : 0 }, { t: 'Aspoň 15 000 cestujících měsíčně', ok: () => (S.rail.pax || 0) >= 15000, p: () => pctOf(S.rail.pax || 0, 15000) }, { t: 'Aspoň 3 nákladní vlaky v provozu', ok: () => T.railSv && T.railSv.eff.fr >= 3, p: () => pctOf(T.railSv ? T.railSv.eff.fr : 0, 3) }] },
  { id: 'turismus', name: 'Turistický ráj', size: 2, tech: 1, crisis: 0, years: 6, desc: 'Malebné městečko s velkým potenciálem. Přilákej turisty památkami a hezkým prostředím.',
    goals: [{ t: 'Cestovní ruch 400 tis. Kč měsíčně', ok: () => S.last && S.last.inc.tourism >= 400000, p: () => pctOf(S.last ? S.last.inc.tourism : 0, 400000) }, { t: 'Aspoň 3 památky', ok: () => (T.landN || 0) >= 3, p: () => pctOf(T.landN || 0, 3) }, { t: 'Spokojenost aspoň 62 %', ok: () => S.happy >= 62, p: () => pctOf(S.happy, 62) }] },
  { id: 'krize', name: 'Neklidná doba', size: 3, tech: 1, crisis: 2, years: 6, desc: 'Radikálové sílí, sousedé jsou nepřátelští a lidé nevěří radnici. Vydrž šest let ve funkci a uklidni město.',
    setup: () => { S.radical = 30; S.approval = 45; S.mood -= 8; S.nb.forEach(n => { n.rel = Math.min(n.rel, 25); }); },
    goals: [{ t: 'Vydrž ve funkci 6 let', ok: () => S.day - S.mission.start >= 6 * 360 - 30, p: () => pctOf(S.day - S.mission.start, 6 * 360) }, { t: 'Radikálů pod 12 %', ok: () => S.radical < 12, p: () => clamp(12 / Math.max(12, S.radical), 0, 1) }, { t: 'Důvěra aspoň 58 %', ok: () => S.approval >= 58, p: () => pctOf(S.approval, 58) }] },
];
const missionOf = id => MISSIONS.find(m => m.id === id);

// ---------- odznaky ----------
const ACHS = [
  { id: 'pop1k', name: 'První tisícovka', desc: '1 000 obyvatel.', ok: () => T.pop >= 1000 },
  { id: 'pop10k', name: 'Okresní město', desc: '10 000 obyvatel.', ok: () => T.pop >= 10000 },
  { id: 'pop50k', name: 'Krajské město', desc: '50 000 obyvatel.', ok: () => T.pop >= 50000 },
  { id: 'pop100k', name: 'Velkoměsto', desc: '100 000 obyvatel.', ok: () => T.pop >= 100000 },
  { id: 'rich', name: 'Zlatý důl', desc: '50 milionů v pokladně.', ok: () => S.money >= 50e6 },
  { id: 'nodebt', name: 'Bez dluhů', desc: 'Pět let bez jediného úvěru.', ok: () => S.hist.length >= 60 && S.hist.slice(-60).every(h => !(h.loan > 0)) },
  { id: 'happy', name: 'Šťastné město', desc: 'Spokojenost aspoň 75 % při 5 000 obyvatelích.', ok: () => S.happy >= 75 && T.pop >= 5000 },
  { id: 'safe', name: 'Bezpečné ulice', desc: 'Kriminalita pod 5 % při 10 000 obyvatelích.', ok: () => S.crime < 5 && T.pop >= 10000 },
  { id: 'clean', name: 'Čistý vzduch', desc: 'Znečištění pod 5 při 10 000 obyvatelích.', ok: () => T.pollR < 5 && T.pop >= 10000 },
  { id: 'science', name: 'Vědecké centrum', desc: '40 vyzkoumaných technologií.', ok: () => Object.keys(S.techs).length >= 40 },
  { id: 'allsci', name: 'Všechno vyzkoumáno', desc: 'Celý strom výzkumu.', ok: () => Object.keys(TECHS).every(t => S.techs[t]) },
  { id: 'rail', name: 'Vlakem do práce', desc: '20 000 cestujících vlakem měsíčně.', ok: () => (S.rail.pax || 0) >= 20000 },
  { id: 'mainst', name: 'Hlavní nádraží', desc: 'Postav hlavní nádraží.', ok: () => bcount('mainst') > 0 },
  { id: 'hsr', name: 'Rychlovlak', desc: 'Rozjeď rychlovlaky.', ok: () => T.railSv && T.railSv.eff.hs > 0 },
  { id: 'tourist', name: 'Turistický magnet', desc: 'Čtyři památky ve městě.', ok: () => (T.landN || 0) >= 4 },
  { id: 'elect', name: 'Znovuzvolen', desc: 'Vyhraj volby.', ok: () => S.stat && S.stat.elections >= 1 },
  { id: 'elect3', name: 'Starosta na doživotí', desc: 'Vyhraj troje volby.', ok: () => S.stat && S.stat.elections >= 3 },
  { id: 'fire50', name: 'Hasičský sbor', desc: 'Hasiči uhasili 50 požárů.', ok: () => S.stat && S.stat.fires >= 50 },
  { id: 'mission', name: 'Úkol splněn', desc: 'Splň jakoukoli misi.', ok: () => Object.keys(ACH.best).length > 0 },
  { id: 'mission3', name: 'Na tři hvězdy', desc: 'Splň misi na tři hvězdy.', ok: () => Object.values(ACH.best).some(v => v >= 3) },
];
const ACH = { list: {}, best: {} };
try { const v = JSON.parse(localStorage.getItem('starosta-ach') || 'null'); if (v) { ACH.list = v.list || {}; ACH.best = v.best || {}; } } catch (_) { }
function achSave() {
  try { localStorage.setItem('starosta-ach', JSON.stringify(ACH)); } catch (_) { }
  if (CLOUD.db) CLOUD.db.collection('data/users/' + CLOUD.uid).doc('achievements').set({ list: ACH.list, best: ACH.best }).catch(() => { });
}
// odznaky z účtu (sloučí se s místními)
(function waitCloud(n) {
  if (!CLOUD.tried) { if (n < 40) setTimeout(() => waitCloud(n + 1), 500); return; }
  if (!CLOUD.db) return;
  CLOUD.db.collection('data/users/' + CLOUD.uid).doc('achievements').get().then(sn => {
    if (!sn.exists) { if (Object.keys(ACH.list).length) achSave(); return; }
    const d = sn.data(); let changed = false;
    for (const k in d.list || {}) if (!ACH.list[k]) { ACH.list[k] = d.list[k]; changed = true; }
    for (const k in d.best || {}) if ((d.best[k] || 0) > (ACH.best[k] || 0)) { ACH.best[k] = d.best[k]; changed = true; }
    try { localStorage.setItem('starosta-ach', JSON.stringify(ACH)); } catch (_) { }
    if (Object.keys(ACH.list).some(k => !(d.list || {})[k])) achSave();
    if (changed && !G.playing) drawStart();
  }).catch(() => { });
})(0);
function checkAchievements() {
  let got = [];
  for (const a of ACHS) { if (ACH.list[a.id]) continue; let ok = false; try { ok = a.ok(); } catch (_) { } if (ok) { ACH.list[a.id] = Date.now(); got.push(a); } }
  if (!got.length) return;
  achSave();
  for (const a of got) toast('Nový odznak: ' + a.name, 'good');
  sfx('fanfare');
}

// ---------- průběh mise ----------
function startMission(id) {
  const m = missionOf(id); if (!m) return;
  newGame({ name: m.name, size: m.size, tech: m.tech, crisis: m.crisis, wars: true, elections: true });
  S.mission = { id, start: S.day, deadline: S.day + m.years * 360, done: false, failed: false };
  if (m.setup) m.setup();
  analysis();
  cam.x = tileX(W.cx); cam.z = tileZ(W.cy); cam.dist = m.size >= 3 ? 210 : m.size ? 150 : 120; cam.yaw = 0.65; cam.pitch = 0.95;
  startPlaying(); G.missionOpen = true; drawMission();
  note('Mise: ' + m.name + '. ' + m.desc, 'tip');
}
function missionState() {
  const M = S.mission; if (!M) return null; const m = missionOf(M.id); if (!m) return null;
  const goals = m.goals.map(g => { let ok = false, p = 0; try { ok = !!g.ok(); p = ok ? 1 : clamp(g.p(), 0, 1); } catch (_) { } return { t: g.t, ok, p }; });
  return { m, M, goals, left: M.deadline - S.day };
}
function missionMonthly() {
  checkAchievements();
  const st = missionState(); if (!st || st.M.done || st.M.failed) { drawMission(); return; }
  if (st.goals.every(g => g.ok)) {
    const f = (S.day - st.M.start) / (st.M.deadline - st.M.start);
    const stars = st.m.id === 'krize' ? (S.approval >= 62 ? 3 : S.approval >= 54 ? 2 : 1) : f <= 0.5 ? 3 : f <= 0.8 ? 2 : 1;
    st.M.done = true; st.M.stars = stars;
    if ((ACH.best[st.m.id] || 0) < stars) { ACH.best[st.m.id] = stars; achSave(); }
    checkAchievements(); sfx('fanfare');
    missionModal(true, stars, st);
  } else if (S.day >= st.M.deadline) { st.M.failed = true; sfx('bad'); missionModal(false, 0, st); }
  drawMission();
}
const starStr = n => '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n);
function missionModal(win, stars, st) {
  const box = $('overbox'); $('over').hidden = false;
  box.innerHTML = '<h2>' + (win ? 'Mise splněna!' : 'Mise nesplněna') + '</h2><p class="lead">' + esc(st.m.name) + (win ? ' · <span class="stars">' + starStr(stars) + '</span>' : '') + '</p><p>' + (win ? 'Zvládl jsi to ' + (stars === 3 ? 'skvěle a rychle.' : stars === 2 ? 'v dobrém čase.' : 'těsně před termínem.') + ' Město je tvoje, můžeš v něm hrát dál.' : 'Čas vypršel. Můžeš to zkusit znovu, nebo ve městě hrát dál bez mise.') + '</p>'
    + '<button class="choice" id="m-cont"><b>Hrát dál</b><small>Město zůstane, mise skončí.</small></button>' + (win ? '' : '<button class="choice" id="m-retry"><b>Zkusit znovu</b><small>Mise začne od začátku.</small></button>') + '<button class="choice" id="m-menu"><b>Zpět na úvod</b></button>';
  $('m-cont').onclick = () => { $('over').hidden = true; drawMission(); };
  const r = $('m-retry'); if (r) r.onclick = () => { $('over').hidden = true; startMission(st.m.id); };
  $('m-menu').onclick = () => { $('over').hidden = true; showStart(); };
}
function drawMission() {
  const el = $('mission'); if (!el) return; const st = G.playing && missionState();
  if (!st) { el.hidden = true; return; }
  el.hidden = false;
  const y = Math.floor(Math.max(0, st.left) / 360), mo = Math.floor(Math.max(0, st.left) % 360 / 30), done = st.goals.filter(g => g.ok).length;
  const head = '<button class="mi-h" id="mi-t"><b>' + esc(st.m.name) + '</b><span>' + (st.M.done ? '<span class="stars">' + starStr(st.M.stars) + '</span>' : st.M.failed ? 'nesplněno' : (y ? y + ' r ' : '') + mo + ' m · ' + done + '/' + st.goals.length) + '</span></button>';
  el.innerHTML = head + (G.missionOpen ? '<div class="mi-b">' + st.goals.map(g => '<div class="mi-g' + (g.ok ? ' ok' : '') + '"><span>' + (g.ok ? '✓ ' : '') + esc(g.t) + '</span><i style="width:' + Math.round(g.p * 100) + '%"></i></div>').join('') + '</div>' : '');
  $('mi-t').onclick = () => { G.missionOpen = !G.missionOpen; drawMission(); };
}
function drawMissionsStart() {
  const el = $('s-missions'); if (!el) return;
  el.innerHTML = '<h3>Mise</h3><div class="cards mis">' + MISSIONS.map(m => '<button class="pick" data-mis="' + m.id + '"><b>' + esc(m.name) + (ACH.best[m.id] ? ' <span class="stars">' + starStr(ACH.best[m.id]) + '</span>' : '') + '</b><small>' + esc(m.desc) + '</small><small class="mi-meta">' + STARTS[m.size].name + ' · ' + m.years + ' ' + (m.years < 5 ? 'roky' : 'let') + ' · ' + CRISIS_LEVELS[m.crisis].name.toLowerCase() + '</small></button>').join('') + '</div>'
    + '<p class="hint">Odznaky: ' + Object.keys(ACH.list).length + ' z ' + ACHS.length + '. Najdeš je ve hře v záložce Statistiky.</p>';
}
$('s-missions').onclick = e => { const b = e.target.closest('[data-mis]'); if (b) startMission(b.dataset.mis); };

// ---------- statistiky s grafy ----------
const STAT_RANGE = { r: 60 };
function sparkChart(title, series, o) {
  o = o || {}; const H = S.hist.slice(-STAT_RANGE.r); if (H.length < 2) return '';
  const w = 320, h = 104, pl = 6, pr = 6, pt = 8, pb = 16, vals = series.flatMap(s => H.map(s.f)).filter(v => v != null && isFinite(v));
  if (!vals.length) return '';
  let lo = o.min != null ? o.min : Math.min(0, ...vals), hi = o.max != null ? o.max : Math.max(...vals); if (hi - lo < 1e-9) hi = lo + 1;
  const X = i => pl + i * (w - pl - pr) / (H.length - 1), Y = v => pt + (1 - (v - lo) / (hi - lo)) * (h - pt - pb);
  let svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" class="chart" role="img" aria-label="' + esc(title) + '">';
  svg += '<line x1="' + pl + '" x2="' + (w - pr) + '" y1="' + Y(lo) + '" y2="' + Y(lo) + '" class="ax"/>';
  if (lo < 0 && hi > 0) svg += '<line x1="' + pl + '" x2="' + (w - pr) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" class="zero"/>';
  if (o.bars) { const bw = Math.max(1, (w - pl - pr) / H.length - 1); H.forEach((r, i) => { const v = series[0].f(r) || 0; svg += '<rect x="' + (X(i) - bw / 2) + '" y="' + Math.min(Y(v), Y(0)) + '" width="' + bw + '" height="' + Math.abs(Y(v) - Y(0)) + '" fill="' + (v >= 0 ? '#2e8f55' : '#c8402f') + '"/>'; }); }
  else series.forEach((s, j) => { const pts = H.map((r, i) => { const v = s.f(r); return v == null ? null : X(i).toFixed(1) + ',' + Y(v).toFixed(1); }).filter(Boolean);
    if (j === 0 && series.length === 1) svg += '<polygon points="' + pl + ',' + Y(lo) + ' ' + pts.join(' ') + ' ' + (w - pr) + ',' + Y(lo) + '" fill="' + s.col + '" opacity=".12"/>';
    svg += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + s.col + '" stroke-width="2" stroke-linejoin="round"/>'; });
  svg += '<text x="' + pl + '" y="' + (h - 3) + '" class="lb">' + dateStr(H[0].d).replace(/^\d+\. /, '') + '</text><text x="' + (w - pr) + '" y="' + (h - 3) + '" class="lb" text-anchor="end">' + dateStr(H[H.length - 1].d).replace(/^\d+\. /, '') + '</text></svg>';
  const fmtV = o.fmt || fmt, last = H[H.length - 1];
  const legend = series.map(s => '<span><i style="background:' + s.col + '"></i>' + esc(s.name) + ' <b class="num">' + fmtV(s.f(last)) + '</b></span>').join('');
  return '<div class="chartbox"><div class="ch-h"><b>' + esc(title) + '</b><small>' + fmtV(hi) + ' max</small></div>' + svg + '<div class="ch-l">' + legend + '</div></div>';
}
PANELS.stats = {
  title: () => 'Statistiky',
  html: () => {
    let h = '';
    const st = missionState();
    if (st) h += '<h4>Mise: ' + esc(st.m.name) + '</h4>' + st.goals.map(g => row((g.ok ? '✓ ' : '') + esc(g.t), pct(g.p * 100), g.ok ? 'pos' : '')).join('') + row('Zbývá', st.M.done ? 'splněno ' + starStr(st.M.stars) : st.M.failed ? 'nesplněno' : Math.floor(Math.max(0, st.left) / 30) + ' měsíců');
    h += '<div class="btns seg2">' + [[24, '2 roky'], [60, '5 let'], [240, 'Vše']].map(([r, n]) => '<button class="btn' + (STAT_RANGE.r === r ? ' pri' : '') + '" data-rg="' + r + '">' + n + '</button>').join('') + '</div>';
    if (S.hist.length < 2) h += '<p>Grafy se začnou kreslit po dvou měsících hry.</p>';
    else {
      const money = v => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1).replace('.', ',') + ' mil.' : fmt(v / 1000) + ' tis.');
      h += sparkChart('Obyvatelé', [{ f: r => r.pop, col: '#2a64c4', name: 'Obyvatel' }]);
      h += sparkChart('Pokladna a dluh', [{ f: r => r.money, col: '#2e8f55', name: 'Pokladna' }, { f: r => r.loan, col: '#c8402f', name: 'Úvěry' }], { fmt: money });
      h += sparkChart('Měsíční bilance', [{ f: r => r.net, col: '#2e8f55', name: 'Minulý měsíc' }], { bars: true, fmt: money });
      h += sparkChart('Nálada', [{ f: r => r.happy, col: '#2e8f55', name: 'Spokojenost' }, { f: r => r.approval, col: '#2a64c4', name: 'Důvěra' }], { min: 0, max: 100, fmt: v => Math.round(v) + ' %' });
      h += sparkChart('Kriminalita a radikálové', [{ f: r => r.crime, col: '#c8402f', name: 'Kriminalita' }, { f: r => r.radical, col: '#7a66a8', name: 'Radikálové' }], { min: 0, fmt: v => Math.round(v) + ' %' });
      h += sparkChart('Nezaměstnanost', [{ f: r => r.unemp, col: '#c98a1e', name: 'Bez práce' }], { min: 0, fmt: v => (v == null ? '–' : v.toFixed(1).replace('.', ',') + ' %') });
      h += sparkChart('Znečištění a zdraví', [{ f: r => r.poll, col: '#7d766b', name: 'Znečištění' }, { f: r => r.health, col: '#b84a6a', name: 'Zdraví' }], { min: 0, fmt: v => v == null ? '–' : Math.round(v) });
      h += sparkChart('Doprava', [{ f: r => r.traf, col: '#5a6a7a', name: 'Vytížení silnic' }], { min: 0, fmt: v => v == null ? '–' : Math.round(v) + ' %' });
      h += sparkChart('Cestující vlakem', [{ f: r => r.pax, col: '#2f6f6a', name: 'Za měsíc' }], { min: 0 });
      h += sparkChart('Cestovní ruch', [{ f: r => r.tour, col: '#b08a3a', name: 'Příjem' }], { min: 0, fmt: money });
    }
    h += '<h4>Odznaky (' + Object.keys(ACH.list).length + ' z ' + ACHS.length + ')</h4><div class="achs">' + ACHS.map(a => '<div class="ach' + (ACH.list[a.id] ? ' on' : '') + '"><b>' + (ACH.list[a.id] ? '★ ' : '') + esc(a.name) + '</b><small>' + esc(a.desc) + '</small></div>').join('') + '</div>';
    return h;
  },
  bind: () => { $('pbody').onclick = e => { const b = e.target.closest('[data-rg]'); if (b) { STAT_RANGE.r = +b.dataset.rg; renderPanel(); } }; },
  static: true,
};
drawMissionsStart();
setInterval(() => { if (G.playing) drawMission(); }, 2000);
