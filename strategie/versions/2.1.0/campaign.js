'use strict';
// Věk pokroku 2.0 – kampaň, odznaky a průběh partie.
// Mise jsou partie proti počítači s pevným nastavením a vlastním cílem; postup a odznaky
// se pamatují v tomto prohlížeči (pro všechna vydání od 2.0 společně).
const CAMPAIGN_KEY = 'vek-pokroku-campaign', BADGE_KEY = 'vek-pokroku-badges';
const MY_T = () => teams[MY];
const heldSites = team => (typeof FRONTIER !== 'undefined' ? FRONTIER.sites : []).filter(s => s.owner === team);

const CAMPAIGN = Object.freeze([
  { id: 'c1', title: 'Pazourek a oheň', era: 'Doba kamenná',
    story: 'Kmen se usadil na mýtině. Nasbírej jídlo a dřevo, postav domy a přečkej první zimu.',
    goal: 'Na začátku druhého roku měj aspoň 10 lidí.',
    setup: { diff: 0, aggr: 0, real: false, match: { map: 'balanced', resources: 1.8, peace: 600 } },
    progress: () => 'Lidé ' + MY_T().pop + '/10 · do jara ' + Math.max(0, Math.ceil((240 - G.time) / 60)) + ' min',
    check: () => G.time >= 240 ? (MY_T().pop >= 10 ? 'win' : 'lose:Osada je na začátku roku příliš malá.') : null },
  { id: 'c2', title: 'Věk bronzu', era: 'Doba bronzová',
    story: 'Sousedé už znají kov. Vyzkoumej zemědělství a dostaň osadu do doby bronzové, než tě předběhnou.',
    goal: 'Vstup do doby bronzové do 14 minut.',
    setup: { diff: 0, aggr: 1, real: false, match: { map: 'forest', peace: 300 } },
    progress: () => ERAS[MY_T().era] + ' · zbývá ' + Math.max(0, Math.ceil((840 - G.time) / 60)) + ' min',
    check: () => MY_T().era >= 1 ? 'win' : G.time > 840 ? 'lose:Doba bronzová nepřišla včas.' : null },
  { id: 'c3', title: 'Mosty přes řeku', era: 'Živý svět',
    story: 'Údolí protíná řeka a za ní leží osady, lom i stará hláska. Kdo je drží, ovládá údolí.',
    goal: 'Drž najednou 3 neutrální lokality (do 25 minut).',
    setup: { diff: 1, aggr: 1, real: false, match: { map: 'river', peace: 240 } },
    progress: () => 'Držíš ' + heldSites(MY).length + '/3 lokalit · zbývá ' + Math.max(0, Math.ceil((1500 - G.time) / 60)) + ' min',
    check: () => heldSites(MY).length >= 3 ? 'win' : G.time > 1500 ? 'lose:Údolí ovládl někdo jiný.' : null },
  { id: 'c4', title: 'Obrana údolí', era: 'Válka',
    story: 'Útočný soupeř chystá výpad přes mosty. Opevni brody, postav věže a vydrž.',
    goal: 'Ubraň Sídlo 10 minut proti útočnému soupeři.',
    setup: { diff: 1, aggr: 3, real: false, match: { map: 'river', peace: 180 } },
    progress: () => 'Vydrž ještě ' + Math.max(0, Math.ceil((600 - G.time) / 60)) + ' min',
    check: () => G.time >= 600 ? 'win' : null },
  { id: 'c5', title: 'Hedvábná stezka', era: 'Obchod',
    story: 'Horami vede stará kupecká cesta. Postav dvě tržiště daleko od sebe a pošli karavany.',
    goal: 'Získej karavanami 250 zlata (do 30 minut).',
    setup: { diff: 1, aggr: 1, real: false, match: { map: 'highlands', peace: 420, resources: 1.8 } },
    progress: () => 'Zlato z karavan ' + Math.floor(MY_T().stats.tradeGold || 0) + '/250 · zbývá ' + Math.max(0, Math.ceil((1800 - G.time) / 60)) + ' min',
    check: () => (MY_T().stats.tradeGold || 0) >= 250 ? 'win' : G.time > 1800 ? 'lose:Karavany nevydělaly dost.' : null },
  { id: 'c6', title: 'Poslední bitva', era: 'Dobytí',
    story: 'Mocný a útočný soupeř nepřestane, dokud jedno Sídlo nepadne. Ať je to to jeho.',
    goal: 'Znič nepřátelské Sídlo.',
    setup: { diff: 2, aggr: 3, real: false, match: { map: 'balanced', peace: 300, stocks: 2 } },
    progress: () => 'Nepřátelské Sídlo stojí', check: () => null },
]);

const BADGES = Object.freeze([
  { id: 'first_win', name: 'První vítězství', desc: 'Vyhraj partii proti počítači.' },
  { id: 'hard_win', name: 'Vítěz na těžkou', desc: 'Vyhraj na těžkou obtížnost.' },
  { id: 'iron', name: 'Doba železná', desc: 'Dosáhni doby železné.' },
  { id: 'modern', name: 'Novověk', desc: 'Dosáhni poslední epochy.' },
  { id: 'big', name: 'Velká osada', desc: 'Měj najednou 60 lidí.' },
  { id: 'army', name: 'Stálá armáda', desc: 'Měj najednou 30 vojáků.' },
  { id: 'warlord', name: 'Vojevůdce', desc: 'Poraz v jedné partii 100 nepřátel.' },
  { id: 'merchant', name: 'Kupec', desc: 'Získej karavanami 300 zlata v jedné partii.' },
  { id: 'diplomat', name: 'Diplomat', desc: 'Drž najednou osadu i tábor.' },
  { id: 'valley', name: 'Pán údolí', desc: 'Drž najednou všechny neutrální lokality.' },
  { id: 'guard', name: 'Ochránce', desc: 'Odraz útok lapků.' },
  { id: 'chronicle', name: 'Kronikář', desc: 'Dokonči všechny mise kampaně.' },
]);

function readJSON(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v && typeof v === 'object' ? v : fallback; } catch (_) { return fallback; } }
function writeJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (_) { } }
function campaignState() { const s = readJSON(CAMPAIGN_KEY, {}); s.done = Array.isArray(s.done) ? s.done.filter(id => CAMPAIGN.some(m => m.id === id)) : []; s.best = s.best && typeof s.best === 'object' ? s.best : {}; return s; }
function campaignUnlocked(i) { return i === 0 || campaignState().done.includes(CAMPAIGN[i - 1].id); }
function badgeState() { const b = readJSON(BADGE_KEY, {}); return b; }
function campaignMission() { return G.campaign ? CAMPAIGN.find(m => m.id === G.campaign) || null : null; }

const CAMP = { acc: 0, newBadges: [], nextSample: 0 };
function awardBadge(id) {
  const b = badgeState(); if (b[id]) return;
  b[id] = Date.now(); writeJSON(BADGE_KEY, b); CAMP.newBadges.push(id);
  const d = BADGES.find(x => x.id === id); if (d && typeof msg === 'function') msg('Nový odznak: ' + d.name + '!', 'good');
}
// Vyhodnocení mise běží v simulaci (jen proti počítači).
function campaignTick(dt) {
  if (G.over || G.mode !== 'ai') return;
  CAMP.acc += dt; if (CAMP.acc < 1) return; CAMP.acc = 0;
  const m = campaignMission(); if (!m) return;
  const r = m.check(); if (!r) return;
  if (r === 'win') endGame(1 - MY, 'Mise „' + m.title + '“ splněna.');
  else endGame(MY, 'Mise „' + m.title + '“ nesplněna. ' + r.slice(5));
}
// Průběh partie (každých 10 s herního času) a odznaky – běží i u hosta v síťové hře.
function campaignFrame() {
  if (!teams.length || !Array.isArray(G.hist)) return;
  if (G.time >= CAMP.nextSample) {
    CAMP.nextSample = Math.floor(G.time / 10) * 10 + 10;
    const army = t => units.reduce((n, u) => n + (u.team === t && !u.dead && isSoldier(u) ? 1 : 0), 0);
    const last = G.hist[G.hist.length - 1];
    if (!last || G.time - last[0] >= 9) { G.hist.push([Math.round(G.time), teams[0].pop, teams[1] ? teams[1].pop : 0, army(0), army(1)]); if (G.hist.length > 720) G.hist.splice(0, G.hist.length - 720); }
    const T = MY_T(); if (!T) return;
    if (T.era >= 2) awardBadge('iron');
    if (T.era >= 4) awardBadge('modern');
    if (T.pop >= 60) awardBadge('big');
    if (army(MY) >= 30) awardBadge('army');
    if ((T.stats.kills || 0) >= 100) awardBadge('warlord');
    if ((T.stats.tradeGold || 0) >= 300) awardBadge('merchant');
    const held = heldSites(MY);
    if (held.some(s => s.kind === 'village') && held.some(s => s.kind === 'camp')) awardBadge('diplomat');
    if (typeof FRONTIER !== 'undefined' && FRONTIER.sites.length >= 5 && held.length === FRONTIER.sites.length) awardBadge('valley');
    if (typeof FRONTIER !== 'undefined' && (FRONTIER.events || []).some(e => e.type === 'raid' && e.team === MY && e.won)) awardBadge('guard');
  }
}
// Konec partie: postup v kampani, odznaky za výhru, graf a tlačítko další mise.
function campaignEnd(win) {
  const m = campaignMission(), box = document.getElementById('end-campaign');
  if (win && G.mode === 'ai' && G.loser !== -1) { awardBadge('first_win'); if (G.diff === 2) awardBadge('hard_win'); }
  let html = '';
  if (m && G.mode === 'ai') {
    const goal = document.getElementById('end-goal'); if (goal) goal.textContent = 'Cíl mise: ' + m.goal;
    const st = campaignState(), i = CAMPAIGN.indexOf(m);
    if (win) { if (!st.done.includes(m.id)) st.done.push(m.id); if (!st.best[m.id] || G.time < st.best[m.id]) st.best[m.id] = Math.round(G.time); writeJSON(CAMPAIGN_KEY, st); if (CAMPAIGN.every(x => st.done.includes(x.id))) awardBadge('chronicle'); }
    html = '<p><b>Kampaň ' + (i + 1) + '/' + CAMPAIGN.length + ':</b> ' + m.title + ' – ' + (win ? 'splněno' : 'nesplněno') + '.</p><div class="row">' +
      (!win ? '<button class="go alt" data-camp="' + m.id + '">Zkusit znovu</button>' : '') +
      (win && CAMPAIGN[i + 1] ? '<button class="go" data-camp="' + CAMPAIGN[i + 1].id + '">Další mise: ' + CAMPAIGN[i + 1].title + '</button>' : '') + '</div>';
  }
  const fresh = CAMP.newBadges.splice(0).map(id => BADGES.find(b => b.id === id)).filter(Boolean);
  if (fresh.length) html += '<p><b>Nové odznaky:</b> ' + fresh.map(b => '🏅 ' + b.name).join(', ') + '</p>';
  if (box) box.innerHTML = html;
  campaignChart(document.getElementById('end-chart'));
}
function campaignChart(cv) {
  if (!cv || !cv.getContext) return;
  const H = G.hist || [], c = cv.getContext('2d'), w = cv.width, h = cv.height;
  c.clearRect(0, 0, w, h); cv.hidden = H.length < 3; if (cv.hidden) return;
  const panels = [['Obyvatelé', 1, 2], ['Vojsko', 3, 4]], pw = w / 2;
  c.font = '12px sans-serif'; c.fillStyle = '#58a6ff'; c.fillText('● ty', w - 150, 12); c.fillStyle = '#ff6b57'; c.fillText('● soupeř', w - 105, 12);
  panels.forEach(([name, a, b], k) => {
    const x0 = k * pw + 30, x1 = (k + 1) * pw - 10, y0 = h - 22, y1 = 18;
    const max = Math.max(5, ...H.map(e => Math.max(e[a], e[b]))), t1 = Math.max(10, H[H.length - 1][0]);
    c.strokeStyle = '#3b4b4d'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y1); c.lineTo(x0, y0); c.lineTo(x1, y0); c.stroke();
    c.fillStyle = '#9fada8'; c.font = '12px sans-serif'; c.fillText(name, x0 + 4, y1 - 4); c.fillText(String(max), x0 - 26, y1 + 8); c.fillText(Math.round(t1 / 60) + ' min', x1 - 40, h - 6);
    for (const [idx, col] of [[MY === 0 ? a : b, '#58a6ff'], [MY === 0 ? b : a, '#ff6b57']]) {
      c.strokeStyle = col; c.lineWidth = 2; c.beginPath();
      H.forEach((e, i) => { const x = x0 + (x1 - x0) * e[0] / t1, y = y0 - (y0 - y1) * e[idx] / max; if (i) c.lineTo(x, y); else c.moveTo(x, y); });
      c.stroke();
    }
  });
}
// Úvodní obrazovka: karty misí a odznaky.
function renderCampaign() {
  const list = document.getElementById('campaign-list'), badges = document.getElementById('badge-list');
  if (!list) return;
  const st = campaignState();
  list.innerHTML = CAMPAIGN.map((m, i) => {
    const open = campaignUnlocked(i), done = st.done.includes(m.id);
    return '<article class="camp' + (done ? ' done' : '') + (open ? '' : ' locked') + '"><span class="camp-n">' + (i + 1) + '</span><h3>' + m.title + '</h3><p class="camp-era">' + m.era + (done ? ' · ✓ splněno' + (st.best[m.id] ? ' za ' + Math.ceil(st.best[m.id] / 60) + ' min' : '') : '') + '</p>' +
      '<p>' + m.story + '</p><p><b>Cíl:</b> ' + m.goal + '</p>' + (open ? '<button class="pick" data-camp="' + m.id + '">' + (done ? 'Hrát znovu' : 'Hrát misi') + '</button>' : '<p class="hint">Odemkne se po splnění předchozí mise.</p>') + '</article>';
  }).join('');
  const b = badgeState();
  if (badges) badges.innerHTML = '<p class="hint">Odznaky: ' + BADGES.filter(x => b[x.id]).length + ' z ' + BADGES.length + '</p><div class="badges">' +
    BADGES.map(x => '<span class="badge' + (b[x.id] ? ' got' : '') + '" title="' + x.desc + '">' + (b[x.id] ? '🏅 ' : '○ ') + x.name + '</span>').join('') + '</div>';
}
function campaignStart(id) {
  const m = CAMPAIGN.find(x => x.id === id), i = CAMPAIGN.indexOf(m); if (!m || !campaignUnlocked(i)) return false;
  G.diff = m.setup.diff; G.aggr = m.setup.aggr; G.real = !!m.setup.real; G.match = matchOptions(m.setup.match); G.campaign = m.id;
  CAMP.acc = 0; CAMP.nextSample = 0; CAMP.newBadges = [];
  return true;
}
