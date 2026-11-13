'use strict';
// Výzkum: obory, stupně, návaznosti a účinky. Účinky se sčítají přes tfx(klíč).

const FIELDS = [
  { key: 'energie', name: 'Energetika', col: '#c99a2e' }, { key: 'doprava', name: 'Doprava', col: '#5a6a7a' }, { key: 'stavby', name: 'Stavby a urbanismus', col: '#8a6a4a' },
  { key: 'zachrana', name: 'Hasiči, policie, záchrana', col: '#b8402f' }, { key: 'zdravi', name: 'Zdravotnictví', col: '#b84a6a' }, { key: 'veda', name: 'Školství a věda', col: '#c47a2a' },
  { key: 'ekonomika', name: 'Ekonomika a průmysl', col: '#3d6a9a' }, { key: 'ekologie', name: 'Ekologie', col: '#4f8a3f' }, { key: 'sprava', name: 'Správa a společnost', col: '#7a66a8' }, { key: 'obrana', name: 'Obrana', col: '#5a6a3a' },
];
const TIER_COST = [0, 45, 100, 200, 360, 600];
// t: stupeň 1–5, r: předpoklady, fx: účinky, u: co odemyká (pro popis)
const TECHS = {
  // energetika
  gasturb:   { name: 'Plynové turbíny', f: 'energie', t: 1, u: 'Plynová elektrárna', desc: 'Výkonnější a čistší elektrárna než uhelná.' },
  wind:      { name: 'Větrná energie', f: 'energie', t: 1, u: 'Větrná elektrárna', desc: 'Elektřina bez paliva a kouře.' },
  gridmaint: { name: 'Údržba rozvodné sítě', f: 'energie', t: 1, fx: { powerOut: 0.05 }, desc: 'Méně ztrát ve vedení.' },
  hydro:     { name: 'Vodní energie', f: 'energie', t: 2, r: ['gridmaint'], u: 'Vodní elektrárna', desc: 'Turbíny na řece dávají stálý výkon.' },
  solar:     { name: 'Fotovoltaika', f: 'energie', t: 2, r: ['wind'], u: 'Solární park', desc: 'Panely na volných plochách.' },
  cogen:     { name: 'Kogenerace', f: 'energie', t: 2, r: ['gasturb'], fx: { powerOut: 0.08, polPower: -0.1 }, desc: 'Odpadní teplo z elektráren vytápí domy.' },
  storage:   { name: 'Bateriová úložiště', f: 'energie', t: 3, r: ['solar'], fx: { renewOut: 0.25 }, desc: 'Vítr a slunce dodávají i v bezvětří a v noci.' },
  smartgrid: { name: 'Chytrá síť', f: 'energie', t: 3, r: ['solar', 'compsys'], desc: 'Spotřeba elektřiny a vody klesne o 15 %.' },
  nuclear:   { name: 'Jaderná energetika', f: 'energie', t: 3, r: ['cogen'], u: 'Jaderná elektrárna', desc: 'Obrovský výkon bez kouře.' },
  geothermal:{ name: 'Geotermální energie', f: 'energie', t: 4, r: ['nuclear'], u: 'Geotermální elektrárna', desc: 'Teplo z hlubin Země, výkon bez paliva.' },
  supercond: { name: 'Supravodivé vedení', f: 'energie', t: 5, r: ['smartgrid', 'storage'], fx: { powerOut: 0.15, powerDemand: -0.05 }, desc: 'Elektřina se přenáší téměř bez ztrát.' },
  // doprava
  bus:       { name: 'Jízdní řády', f: 'doprava', t: 1, desc: 'Autobusy jezdí častěji, dosah dep +30 %.' },
  signals:   { name: 'Řízené křižovatky', f: 'doprava', t: 1, fx: { trafficCap: 0.15 }, desc: 'Semafory a zelené vlny.' },
  pedestrian:{ name: 'Pěší zóny', f: 'doprava', t: 2, u: 'Pěší zóna', desc: 'Centrum bez aut: dlažba, lavičky, stromy.' },
  avenues:   { name: 'Městské třídy', f: 'doprava', t: 2, r: ['signals'], u: 'Třída', desc: 'Čtyřproudé třídy se stromořadím.' },
  logistics: { name: 'Logistika', f: 'doprava', t: 2, desc: 'Obchodní kapacita města +30 %.' },
  highways:  { name: 'Rychlostní silnice', f: 'doprava', t: 3, r: ['avenues'], u: 'Rychlostní silnice', desc: 'Čtyři pruhy bez křižovatek s domy.' },
  tram:      { name: 'Tramvajová doprava', f: 'doprava', t: 3, r: ['avenues', 'bus'], u: 'Tramvajová třída', desc: 'Tramvaje po třídách odvezou lidi z okolí.' },
  metro:     { name: 'Metro', f: 'doprava', t: 3, r: ['bus', 'avenues'], u: 'Stanice metra', desc: 'Podzemní dráha bez zácp.' },
  aviation:  { name: 'Letectví', f: 'doprava', t: 4, r: ['logistics', 'highways'], u: 'Letiště', desc: 'Turisté, obchod a prestiž.' },
  its:       { name: 'Inteligentní řízení dopravy', f: 'doprava', t: 4, r: ['signals', 'internet'], fx: { trafficCap: 0.25 }, desc: 'Semafory reagují na provoz v reálném čase.' },
  autonomous:{ name: 'Samořiditelná vozidla', f: 'doprava', t: 5, r: ['its', 'ai'], fx: { trafficCap: 0.3, polTraffic: -0.2 }, desc: 'Auta jezdí plynuleji a hustěji za sebou.' },
  // stavby a urbanismus
  zoning:    { name: 'Územní plánování', f: 'stavby', t: 1, fx: { landValue: 4, growth: 0.1 }, desc: 'Uspořádanější čtvrti rostou rychleji a mají vyšší cenu.' },
  flood:     { name: 'Protipovodňová ochrana', f: 'stavby', t: 1, u: 'Protipovodňová hráz', desc: 'Hráze podél řeky.' },
  firecode:  { name: 'Požární předpisy', f: 'stavby', t: 1, desc: 'Požáry vznikají o 40 % méně.' },
  prefab:    { name: 'Prefabrikovaná výstavba', f: 'stavby', t: 2, r: ['zoning'], fx: { growth: 0.2 }, desc: 'Domy se staví rychleji a levněji.' },
  seismic:   { name: 'Seizmické normy', f: 'stavby', t: 2, desc: 'Zemětřesení zboří o 60 % méně budov.' },
  skyscraper:{ name: 'Výškové stavby', f: 'stavby', t: 3, r: ['prefab'], desc: 'Husté zóny mohou růst až do 5. úrovně.' },
  greenroofs:{ name: 'Zelené střechy', f: 'stavby', t: 3, r: ['filters'], fx: { polAll: -0.08, happy: 2 }, desc: 'Střechy porostlé zelení čistí vzduch a chladí.' },
  resilient: { name: 'Odolná infrastruktura', f: 'stavby', t: 4, r: ['seismic', 'flood'], fx: { quake: -0.4, storm: -0.5, flood: -0.4 }, desc: 'Pohromy napáchají mnohem menší škody.' },
  smarthomes:{ name: 'Chytré domácnosti', f: 'stavby', t: 4, r: ['smartgrid'], fx: { powerDemand: -0.08, waterDemand: -0.1 }, desc: 'Domy samy šetří energií a vodou.' },
  // hasiči, policie, záchrana
  firetech:  { name: 'Hasičská technika', f: 'zachrana', t: 1, fx: { fireEff: 0.2 }, desc: 'Lepší cisterny, žebříky a dýchací přístroje.' },
  forensics: { name: 'Kriminalistika', f: 'zachrana', t: 1, desc: 'Policie je o 25 % účinnější proti kriminalitě.' },
  ems:       { name: 'Integrovaný záchranný systém', f: 'zachrana', t: 2, r: ['firetech'], fx: { fireEff: 0.15, fireRange: 0.2, healthRange: 0.1 }, u: 'Centrální hasičská stanice', desc: 'Hasiči, záchranka a policie mají společný dispečink.' },
  riot:      { name: 'Pořádková jednotka', f: 'zachrana', t: 2, r: ['forensics'], desc: 'Rozehnání demonstrace méně často skončí nepokoji.' },
  intel:     { name: 'Zpravodajství', f: 'zachrana', t: 3, r: ['forensics'], u: 'Tajná služba', desc: 'Odhaluje extremisty a umožňuje tajné operace.' },
  aerialfire:{ name: 'Letecké hašení', f: 'zachrana', t: 3, r: ['ems'], fx: { fireEff: 0.1 }, u: 'Letecká hasičská základna', desc: 'Vrtulníky s vodními vaky pokryjí celé město.' },
  cyber:     { name: 'Kybernetická bezpečnost', f: 'zachrana', t: 4, r: ['intel', 'compsys'], fx: { intel: 0.25 }, desc: 'Sabotáže a dezinformace mají menší šanci.' },
  predictive:{ name: 'Prediktivní policie', f: 'zachrana', t: 5, r: ['cyber'], fx: { crime: -0.15 }, desc: 'Hlídky jezdí tam, kde hrozí trestný čin.' },
  drones:    { name: 'Záchranářské drony', f: 'zachrana', t: 4, r: ['aerialfire', 'compsys'], fx: { fireEff: 0.2, police: 0.15 }, desc: 'Drony najdou ohniska i pohřešované lidi.' },
  // zdravotnictví
  hygiene:   { name: 'Hygiena a kanalizace', f: 'zdravi', t: 1, u: 'Čistírna odpadních vod', desc: 'Čistá voda brání nemocem.' },
  ambulance: { name: 'Zdravotnická záchranná služba', f: 'zdravi', t: 2, r: ['hygiene'], fx: { healthRange: 0.25, health: 3 }, desc: 'Sanitky dojedou rychleji a dál.' },
  vaccines:  { name: 'Očkování', f: 'zdravi', t: 2, r: ['hygiene'], desc: 'Epidemie jsou vzácnější a slabší.' },
  diagnostics:{ name: 'Moderní diagnostika', f: 'zdravi', t: 3, r: ['ambulance'], fx: { health: 6 }, desc: 'Nemoci se odhalí včas.' },
  telemed:   { name: 'Telemedicína', f: 'zdravi', t: 4, r: ['internet'], fx: { healthRange: 0.2 }, desc: 'Lékař na dálku i pro okrajové čtvrti a vesnice.' },
  biotech:   { name: 'Biotechnologie', f: 'zdravi', t: 4, r: ['vaccines', 'diagnostics'], fx: { epidemic: -0.4, health: 4 }, desc: 'Nové léky a rychlé vakcíny.' },
  precision: { name: 'Personalizovaná medicína', f: 'zdravi', t: 5, r: ['biotech', 'ai'], fx: { health: 8, happy: 2 }, desc: 'Léčba na míru každému pacientovi.' },
  // školství a věda
  pedagogy:  { name: 'Moderní pedagogika', f: 'veda', t: 1, fx: { eduGain: 0.25 }, desc: 'Děti se učí rychleji a raději.' },
  compsys:   { name: 'Výpočetní technika', f: 'veda', t: 2, r: ['pedagogy'], fx: { research: 0.15, officeDem: 0.05 }, desc: 'Počítače v úřadech, firmách i laboratořích.' },
  grants:    { name: 'Vědecké granty', f: 'veda', t: 2, r: ['pedagogy'], fx: { research: 0.2 }, desc: 'Peníze pro nejlepší vědecké týmy.' },
  internet:  { name: 'Internet', f: 'veda', t: 3, r: ['compsys'], fx: { research: 0.2, officeDem: 0.08 }, desc: 'Rychlé připojení pro každou domácnost.' },
  techpark:  { name: 'Technologické parky', f: 'veda', t: 3, r: ['grants'], u: 'Technologický park', desc: 'Startupy a laboratoře pod jednou střechou.' },
  ai:        { name: 'Umělá inteligence', f: 'veda', t: 4, r: ['internet'], fx: { research: 0.3, prod: 0.1 }, desc: 'Stroje, které pomáhají vědcům i továrnám.' },
  quantum:   { name: 'Kvantové výpočty', f: 'veda', t: 5, r: ['ai'], fx: { research: 0.4 }, desc: 'Výpočty, na které klasické počítače nestačí.' },
  // ekonomika a průmysl
  banking:   { name: 'Bankovnictví', f: 'ekonomika', t: 1, desc: 'Levnější úvěry, kanceláře rostou rychleji.' },
  massprod:  { name: 'Pásová výroba', f: 'ekonomika', t: 1, fx: { prod: 0.15 }, desc: 'Továrny vyrobí víc za stejnou dobu.' },
  tourism:   { name: 'Cestovní ruch', f: 'ekonomika', t: 2, desc: 'Parky, stadion a letiště vydělávají na turistech.' },
  hightech:  { name: 'High-tech výroba', f: 'ekonomika', t: 3, r: ['compsys'], desc: 'Továrny mohou vyrábět technologie.' },
  ecommerce: { name: 'Elektronický obchod', f: 'ekonomika', t: 4, r: ['internet'], fx: { comDem: 0.08, trade: 0.15 }, desc: 'Obchody prodávají i přes internet.' },
  automation:{ name: 'Automatizace výroby', f: 'ekonomika', t: 3, r: ['massprod', 'compsys'], fx: { prod: 0.25, polInd: 0.05 }, desc: 'Linky běží bez přestávky.' },
  finance:   { name: 'Finanční centrum', f: 'ekonomika', t: 4, r: ['banking', 'internet'], fx: { officeTax: 0.2 }, desc: 'Banky a pojišťovny platí víc daní.' },
  robotics:  { name: 'Robotika', f: 'ekonomika', t: 5, r: ['automation', 'ai'], fx: { prod: 0.3 }, desc: 'Roboti v továrnách a skladech.' },
  // ekologie
  filters:   { name: 'Průmyslové filtry', f: 'ekologie', t: 1, desc: 'Průmysl a elektrárny znečišťují o 35 % méně.' },
  incin:     { name: 'Energetické využití odpadu', f: 'ekologie', t: 1, u: 'Spalovna', desc: 'Z odpadu elektřina.' },
  urbangreen:{ name: 'Městská zeleň', f: 'ekologie', t: 2, fx: { parkEff: 0.3, landValue: 2 }, desc: 'Stromořadí a parky působí silněji.' },
  recycling: { name: 'Recyklace', f: 'ekologie', t: 2, r: ['filters'], u: 'Recyklační centrum', desc: 'Třídění odpadu.' },
  ebus:      { name: 'Elektrobusy', f: 'ekologie', t: 3, r: ['bus'], fx: { polTraffic: -0.25, transitEff: 0.1 }, desc: 'Tichá a čistá městská doprava.' },
  circular:  { name: 'Oběhové hospodářství', f: 'ekologie', t: 3, r: ['recycling'], fx: { garbage: -0.3 }, desc: 'Odpad se stává surovinou.' },
  carbon:    { name: 'Uhlíková neutralita', f: 'ekologie', t: 5, r: ['circular', 'smartgrid'], fx: { polAll: -0.25, happy: 3 }, desc: 'Město nepřispívá ke změně klimatu.' },
  // správa a společnost
  publicrel: { name: 'Komunikace s veřejností', f: 'sprava', t: 1, fx: { approval: 3 }, desc: 'Lidé rozumí, co radnice dělá a proč.' },
  egov:      { name: 'Elektronická správa', f: 'sprava', t: 3, r: ['compsys'], desc: 'Provoz úřadů −5 %, důvěra ve vedení roste.' },
  mediation: { name: 'Mediace konfliktů', f: 'sprava', t: 2, r: ['publicrel'], desc: 'Vyjednávání s demonstranty a odbory častěji uspěje.' },
  diplomacy: { name: 'Diplomatický sbor', f: 'sprava', t: 2, r: ['publicrel'], desc: 'Vztahy se sousedy se lepší rychleji.' },
  participation: { name: 'Participativní rozpočet', f: 'sprava', t: 3, r: ['mediation'], fx: { happy: 3, protest: -0.3 }, desc: 'Lidé sami rozhodují o části peněz.' },
  anticorr:  { name: 'Protikorupční opatření', f: 'sprava', t: 4, r: ['egov'], fx: { scandal: -0.7, upkeep: -0.04 }, desc: 'Otevřené zakázky a kontrola úředníků.' },
  smartcity: { name: 'Chytré město', f: 'sprava', t: 4, r: ['egov', 'internet'], fx: { upkeep: -0.1, crime: -0.1, trafficCap: 0.1 }, desc: 'Senzory a data řídí služby i dopravu.' },
  // obrana
  proarmy:   { name: 'Profesionální armáda', f: 'obrana', t: 1, fx: { armyLoy: 8 }, desc: 'Vojáci z povolání jsou disciplinovanější.' },
  airdef:    { name: 'Protivzdušná obrana', f: 'obrana', t: 2, r: ['proarmy'], fx: { army: 0.2 }, desc: 'Město je hůř zranitelné ze vzduchu.' },
  mechanized:{ name: 'Mechanizované jednotky', f: 'obrana', t: 3, r: ['airdef'], fx: { army: 0.3 }, desc: 'Obrněné transportéry a tanky.' },
  counterintel: { name: 'Kontrarozvědka', f: 'obrana', t: 4, r: ['intel'], fx: { intel: 0.3 }, desc: 'Cizí agenti se hůř dostanou do města.' },
  uav:       { name: 'Bezpilotní letouny', f: 'obrana', t: 4, r: ['mechanized', 'compsys'], fx: { army: 0.3 }, desc: 'Průzkum a obrana bez rizika pro vojáky.' },
};
for (const id in TECHS) { const t = TECHS[id]; t.cost = t.cost || TIER_COST[t.t]; t.req = t.r || []; t.fx = t.fx || {}; }

// popis účinků: [text, jednotka, kladné je dobré]
const FXN = {
  powerOut: ['Výkon elektráren', '%', 1], renewOut: ['Výkon větru, slunce a vody', '%', 1], powerDemand: ['Spotřeba elektřiny', '%', 0], waterDemand: ['Spotřeba vody', '%', 0],
  polInd: ['Znečištění z průmyslu', '%', 0], polPower: ['Znečištění z elektráren', '%', 0], polTraffic: ['Znečištění z dopravy', '%', 0], polAll: ['Veškeré znečištění', '%', 0],
  trafficCap: ['Kapacita silnic', '%', 1], crime: ['Kriminalita', '%', 0], police: ['Účinnost policie', '%', 1], fireRisk: ['Riziko požárů', '%', 0], fireEff: ['Účinnost hasičů', '%', 1],
  fireRange: ['Dosah hasičů', '%', 1], health: ['Zdraví obyvatel', 'b', 1], healthRange: ['Dosah zdravotnictví', '%', 1], epidemic: ['Šíření epidemií', '%', 0], eduGain: ['Rychlost vzdělávání', '%', 1],
  research: ['Rychlost výzkumu', '%', 1], officeDem: ['Poptávka po kancelářích', 'd', 1], comDem: ['Poptávka po obchodech', 'd', 1], prod: ['Výroba továren', '%', 1], officeTax: ['Daně z kanceláří', '%', 1],
  trade: ['Obchodní kapacita', '%', 1], upkeep: ['Provoz služeb', '%', 0], happy: ['Spokojenost', 'b', 1], approval: ['Důvěra ve vedení', 'b', 1], flood: ['Škody povodní', '%', 0], quake: ['Škody zemětřesení', '%', 0],
  storm: ['Škody vichřic', '%', 0], garbage: ['Množství odpadu', '%', 0], landValue: ['Cena pozemků', 'b', 1], army: ['Síla armády', '%', 1], armyLoy: ['Loajalita armády', 'b', 1], intel: ['Účinnost tajné služby', '%', 1],
  growth: ['Rychlost výstavby', '%', 1], protest: ['Četnost demonstrací', '%', 0], scandal: ['Četnost afér', '%', 0], parkEff: ['Účinek parků', '%', 1], transitEff: ['Účinek MHD', '%', 1],
};
function fxText(fx) {
  return Object.keys(fx).map(k => { const n = FXN[k]; if (!n) return ''; const v = fx[k], s = v > 0 ? '+' : '−', a = Math.abs(v);
    return n[0] + ' ' + s + (n[1] === '%' ? Math.round(a * 100) + ' %' : n[1] === 'd' ? Math.round(a * 100) + ' %' : a + ' b.'); }).filter(Boolean);
}
let _fxCache = null;
function tfx(k) {
  if (!_fxCache) { _fxCache = {}; for (const id in S.techs) if (S.techs[id] && TECHS[id]) for (const e in TECHS[id].fx) _fxCache[e] = (_fxCache[e] || 0) + TECHS[id].fx[e]; }
  return _fxCache[k] || 0;
}
function fxReset() { _fxCache = null; }

const TECH_LEVELS = [
  { name: 'Základní', techs: [] },
  { name: 'Rozvinutá', techs: ['gasturb', 'wind', 'gridmaint', 'hygiene', 'bus', 'signals', 'zoning', 'flood', 'firecode', 'firetech', 'forensics', 'pedagogy', 'massprod', 'banking', 'filters', 'publicrel', 'logistics', 'proarmy'] },
  { name: 'Špičková', techs: ['gasturb', 'wind', 'gridmaint', 'hydro', 'solar', 'cogen', 'storage', 'hygiene', 'ambulance', 'vaccines', 'bus', 'signals', 'pedestrian', 'avenues', 'logistics', 'highways', 'tram', 'metro', 'zoning', 'flood', 'firecode', 'prefab', 'seismic', 'skyscraper',
    'firetech', 'forensics', 'ems', 'riot', 'intel', 'pedagogy', 'compsys', 'grants', 'internet', 'banking', 'massprod', 'tourism', 'hightech', 'filters', 'incin', 'urbangreen', 'recycling', 'publicrel', 'egov', 'mediation', 'proarmy', 'airdef'] },
];
