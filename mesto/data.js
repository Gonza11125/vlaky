'use strict';
// Starosta – herní data: zóny, budovy, výzkum, vyhlášky, obchod, sousedé.

const N = 80;            // dlaždic na stranu mapy
const TS = 4;            // velikost dlaždice ve světě
const MONTH = 30;        // dnů v měsíci
const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];

// ---------- zóny ----------
// kapacita budovy: [hustota][úroveň] = obyvatel nebo pracovních míst
const ZONES = {
  1: { key: 'R', name: 'Bydlení', short: 'Bydlení', color: '#6fbf5a', hex: 0x6fbf5a, cap: [[0, 8, 16, 26], [0, 60, 120, 200, 300, 420]],
       desc: 'Domy a byty. Lidé potřebují elektřinu, vodu, práci, školy, lékaře a bezpečí.' },
  2: { key: 'C', name: 'Obchody a služby', short: 'Obchody', color: '#4fa3e0', hex: 0x4fa3e0, cap: [[0, 6, 12, 20], [0, 40, 80, 130, 190, 260]],
       desc: 'Obchody, restaurace a služby. Potřebují zákazníky a zboží.' },
  3: { key: 'I', name: 'Průmysl', short: 'Průmysl', color: '#e3b53f', hex: 0xe3b53f, cap: [[0, 12, 24, 36], [0, 50, 100, 150, 210, 280]],
       desc: 'Továrny a sklady. Dávají práci a vyrábějí zboží na prodej, ale znečišťují okolí.' },
  4: { key: 'O', name: 'Kanceláře', short: 'Kanceláře', color: '#a184dd', hex: 0xa184dd, cap: [[0, 10, 20, 32], [0, 60, 120, 200, 300, 420]],
       desc: 'Firmy a úřady. Potřebují vzdělané lidi, platí nejvíc daní a neznečišťují.' },
};
// hodnota pozemku potřebná pro úroveň budovy
const LV_NEED = [[0, 0, 30, 50], [0, 0, 26, 40, 55, 70]];
const TAXK = { R: 5, C: 8, I: 7, O: 11 };   // Kč na obyvatele či místo za každé procento daně a měsíc
const SPEC = ['Zboží', 'Potraviny', 'Technologie'];

// ---------- služby a stavby ----------
// cost = cena stavby, up = měsíční provoz, r = dosah v dlaždicích, size = strana čtverce
const SERV = {
  townhall:  { name: 'Radnice', cat: 'gov', size: 2, cost: 800000, up: 15000, unique: true, desc: 'Sídlo vedení města. Bez radnice nejde vybírat daně. Je to i první cíl demonstrací.' },
  coal:      { name: 'Uhelná elektrárna', cat: 'power', size: 2, cost: 1200000, up: 45000, power: 1200, fuel: 0.06, poll: 40, desc: 'Levná a spolehlivá, ale silně znečišťuje a pálí palivo, které se musí dovážet.' },
  gas:       { name: 'Plynová elektrárna', cat: 'power', size: 2, cost: 2000000, up: 60000, power: 1800, fuel: 0.045, poll: 14, req: 'gasturb', desc: 'Čistší než uhlí a výkonnější. Také potřebuje palivo.' },
  hydro:     { name: 'Vodní elektrárna', cat: 'power', size: 2, cost: 3500000, up: 30000, power: 380, renew: true, req: 'hydro', coast: true, desc: 'Turbíny na řece. Stálý čistý výkon. Musí stát u vody.' },
  geo:       { name: 'Geotermální elektrárna', cat: 'power', size: 2, cost: 9000000, up: 110000, power: 2600, req: 'geothermal', desc: 'Teplo z hlubin. Velký výkon bez paliva a kouře.' },
  wind:      { name: 'Větrná elektrárna', cat: 'power', size: 1, cost: 420000, up: 6000, power: 90, req: 'wind', desc: 'Bez paliva a bez kouře. Výkon kolísá s větrem.' },
  solar:     { name: 'Solární park', cat: 'power', size: 2, cost: 1500000, up: 14000, power: 420, req: 'solar', desc: 'Čistá energie ze slunce. V zimě dává méně.' },
  nuclear:   { name: 'Jaderná elektrárna', cat: 'power', size: 3, cost: 12000000, up: 260000, power: 9000, req: 'nuclear', desc: 'Obrovský výkon bez kouře. Při špatné údržbě hrozí havárie.' },
  pump:      { name: 'Vodárna', cat: 'water', size: 1, cost: 350000, up: 12000, water: 1600, desc: 'Čerpá a upravuje pitnou vodu. U řeky čerpá o polovinu víc.' },
  sewage:    { name: 'Čistírna odpadních vod', cat: 'water', size: 2, cost: 1200000, up: 30000, sewage: 9000, req: 'hygiene', desc: 'Čistí odpadní vodu. Bez ní se šíří nemoci a řeka smrdí.' },
  dump:      { name: 'Skládka', cat: 'water', size: 2, cost: 300000, up: 15000, garbage: 20000, poll: 18, desc: 'Odpad od 20 000 lidí. Znečišťuje a snižuje cenu pozemků v okolí.' },
  incin:     { name: 'Spalovna', cat: 'water', size: 2, cost: 2000000, up: 50000, garbage: 40000, power: 160, poll: 10, req: 'incin', desc: 'Spálí odpad od 40 000 lidí a vyrobí z něj trochu elektřiny.' },
  recycle:   { name: 'Recyklační centrum', cat: 'water', size: 2, cost: 1500000, up: 36000, garbage: 25000, poll: 2, req: 'recycling', desc: 'Třídí odpad od 25 000 lidí. Skoro neznečišťuje a vydělává na druhotných surovinách.' },
  police:    { name: 'Policejní služebna', cat: 'safety', size: 1, cost: 500000, up: 25000, r: 10, police: 30, desc: '30 policistů. Snižují kriminalitu v okolí a zasahují při demonstracích.' },
  policehq:  { name: 'Policejní ředitelství', cat: 'safety', size: 2, cost: 2200000, up: 90000, r: 18, police: 120, desc: '120 policistů včetně pořádkové jednotky.' },
  firevol:   { name: 'Hasičská zbrojnice', cat: 'rescue', size: 1, cost: 180000, up: 6000, r: 7, fireStr: 0.6, trucks: 1, desc: 'Sbor dobrovolných hasičů. Levná, menší dosah, ideální pro vesnice.' },
  fire:      { name: 'Hasičská stanice', cat: 'rescue', size: 1, cost: 450000, up: 22000, r: 11, fireStr: 1, trucks: 2, desc: 'Profesionální hasiči hasí požáry v dosahu. Bez hasičů požár sežere celou čtvrť.' },
  firehq:    { name: 'Centrální hasičská stanice', cat: 'rescue', size: 2, cost: 1800000, up: 70000, r: 17, fireStr: 1.3, trucks: 4, req: 'ems', desc: 'Velká stanice s výškovou technikou a dispečinkem záchranného systému.' },
  fireair:   { name: 'Letecká hasičská základna', cat: 'rescue', size: 3, cost: 6000000, up: 150000, r: 45, fireStr: 0.75, trucks: 2, req: 'aerialfire', desc: 'Vrtulníky dolétnou k požáru kdekoli ve městě.' },
  barracks:  { name: 'Vojenská základna', cat: 'safety', size: 3, cost: 4000000, up: 150000, army: 400, desc: '400 vojáků. Brání město ve válce. Když je armáda nespokojená, může se pokusit o převrat.' },
  intel:     { name: 'Tajná služba', cat: 'safety', size: 1, cost: 2500000, up: 120000, req: 'intel', desc: 'Odhaluje extremisty dřív, než udeří, a umožňuje tajné operace v sousedních městech.' },
  clinic:    { name: 'Poliklinika', cat: 'health', size: 1, cost: 500000, up: 25000, r: 9, desc: 'Praktičtí lékaři pro okolí.' },
  hospital:  { name: 'Nemocnice', cat: 'health', size: 2, cost: 3000000, up: 120000, r: 20, desc: 'Velký dosah, zvládá epidemie a katastrofy.' },
  school:    { name: 'Základní škola', cat: 'edu', size: 1, cost: 600000, up: 30000, r: 10, edu: 0.5, rp: 1, desc: 'Základ vzdělání pro děti z okolí.' },
  highschool:{ name: 'Střední škola', cat: 'edu', size: 2, cost: 1600000, up: 60000, r: 16, edu: 0.8, rp: 3, desc: 'Vzdělaní lidé chtějí pracovat v kancelářích.' },
  university:{ name: 'Univerzita', cat: 'edu', size: 3, cost: 6000000, up: 200000, r: 40, edu: 1, rp: 20, desc: 'Vzdělání pro celé město a hodně výzkumu.' },
  techpark:  { name: 'Technologický park', cat: 'edu', size: 2, cost: 5000000, up: 140000, rp: 40, req: 'techpark', desc: 'Startupy a laboratoře. Hodně výzkumu a práce pro vzdělané lidi.' },
  institute: { name: 'Výzkumný ústav', cat: 'edu', size: 2, cost: 3000000, up: 110000, rp: 25, needs: 'university', desc: 'Jen výzkum. Potřebuje ve městě univerzitu.' },
  park:      { name: 'Park', cat: 'fun', size: 1, cost: 80000, up: 2000, r: 5, park: 0.6, desc: 'Zeleň zvedá cenu pozemků a náladu lidí.' },
  bigpark:   { name: 'Městský park', cat: 'fun', size: 2, cost: 320000, up: 8000, r: 8, park: 1, desc: 'Velký park s jezírkem.' },
  church:    { name: 'Kostel', cat: 'fun', size: 2, cost: 1500000, up: 6000, r: 7, park: 0.5, desc: 'Dominanta obce. Zvedá cenu pozemků a náladu v okolí.' },
  plaza:     { name: 'Náměstí', cat: 'fun', size: 1, cost: 150000, up: 3000, r: 4, park: 0.4, shop: 1, desc: 'Místo pro trhy a setkávání. Pomáhá obchodům kolem.' },
  stadium:   { name: 'Stadion', cat: 'fun', size: 3, cost: 5000000, up: 80000, r: 40, park: 0.3, happy: 4, desc: 'Celé město je o něco spokojenější. Fanoušci ale umí i demonstrovat.' },
  bus:       { name: 'Autobusové depo', cat: 'trans', size: 1, cost: 400000, up: 15000, r: 9, transit: 0.5, desc: 'Městská doprava ulehčí silnicím.' },
  metro:     { name: 'Stanice metra', cat: 'trans', size: 1, cost: 2500000, up: 40000, r: 12, transit: 1, req: 'metro', desc: 'Rychlá podzemní doprava. Výrazně ubere aut.' },
  // železnice: rail = druh stanice, pax = síla osobní dopravy, freight = kapacita nákladu (t/měs.)
  railhalt:  { name: 'Železniční zastávka', cat: 'rail', size: 1, cost: 300000, up: 7000, r: 9, rail: 'pass', pax: 0.55, desc: 'Nástupiště s přístřeškem. Osobní vlaky tu zastaví a vezmou lidi z okolí.' },
  railst:    { name: 'Nádraží', cat: 'rail', size: 2, cost: 1500000, up: 30000, r: 12, rail: 'pass', pax: 1, desc: 'Nádražní budova s pokladnou a krytým nástupištěm. Lidé jezdí vlakem do práce i za nákupy.' },
  mainst:    { name: 'Hlavní nádraží', cat: 'rail', size: 3, cost: 6000000, up: 110000, r: 18, rail: 'pass', pax: 1.6, main: true, req: 'intercity', desc: 'Velká hala nad nástupišti. Zastavují tu rychlíky a rychlovlaky, přijíždějí turisté a firmy.' },
  station:   { name: 'Nákladové nádraží', cat: 'rail', size: 2, cost: 2500000, up: 40000, r: 10, rail: 'freight', freight: 4000, desc: 'Sklady a vlečky. Nákladní vlaky odvezou až 4 000 t zboží měsíčně a průmysl v okolí vyrábí víc.' },
  container: { name: 'Kontejnerový terminál', cat: 'rail', size: 3, cost: 7000000, up: 110000, r: 14, rail: 'freight', freight: 12000, req: 'containers', desc: 'Portálové jeřáby a stovky kontejnerů. Až 12 000 t zboží měsíčně.' },
  depot:     { name: 'Železniční depo', cat: 'rail', size: 2, cost: 1800000, up: 35000, rail: 'depot', trains: 8, desc: 'Remíza a dílny. Každé depo udrží v provozu dalších 8 vlaků.' },
  port:      { name: 'Přístav', cat: 'trans', size: 3, cost: 5000000, up: 80000, trade: 12000, coast: true, desc: 'Velká obchodní kapacita. Musí stát u vody.' },
  airport:   { name: 'Letiště', cat: 'trans', size: 4, cost: 15000000, up: 200000, trade: 3000, tourism: 1, req: 'aviation', desc: 'Turisté, obchod a prestiž. Hluk sníží cenu pozemků okolo.' },
  warehouse: { name: 'Městské sklady', cat: 'trans', size: 2, cost: 600000, up: 9000, store: 6000, desc: 'Uskladní dalších 6 000 jednotek od každé suroviny.' },
  dike:      { name: 'Protipovodňová hráz', cat: 'gov', size: 1, cost: 25000, up: 200, req: 'flood', line: true, desc: 'Hráz podél řeky. Zastaví vodu, když lemuje celý břeh.' },
};
const SERV_CATS = [
  { key: 'power', name: 'Energie' }, { key: 'water', name: 'Voda a odpad' }, { key: 'rescue', name: 'Hasiči' }, { key: 'rail', name: 'Železnice' }, { key: 'safety', name: 'Policie a armáda' },
  { key: 'health', name: 'Zdraví' }, { key: 'edu', name: 'Vzdělání' }, { key: 'fun', name: 'Volný čas' },
  { key: 'trans', name: 'Doprava a obchod' }, { key: 'gov', name: 'Správa' },
];
const PW_RES = 0.05, PW_JOB = 0.08, WT_RES = 0.15, WT_JOB = 0.08;
const ROAD_COST = 3000, BRIDGE_COST = 18000, DEMOLISH_COST = 2000, ROAD_UP = 50;
// druhy silnic: cap = kapacita, lv = vliv na cenu pozemků okolo
const ROADS = {
  1: { key: 'street', name: 'Ulice', cost: 3000, up: 50, cap: 1, lv: 0, desc: 'Dvouproudá ulice s chodníky a lampami. Základ města.' },
  2: { key: 'rural', name: 'Venkovská silnice', cost: 2000, up: 35, cap: 0.9, lv: -2, desc: 'Venkovská silnice bez chodníků. Levná, hodí se do vesnic a mezi obce.' },
  3: { key: 'avenue', name: 'Třída', cost: 9000, up: 110, cap: 2.2, lv: 5, req: 'avenues', desc: 'Čtyřproudá třída se stromořadím uprostřed. Víc než dvojnásobná kapacita.' },
  4: { key: 'tram', name: 'Tramvajová třída', cost: 18000, up: 220, cap: 2, lv: 8, transit: 0.7, req: 'tram', desc: 'Třída s tramvajovou tratí. Tramvaj odveze lidi z okolí a ubere aut.' },
  5: { key: 'highway', name: 'Rychlostní silnice', cost: 22000, up: 260, cap: 4, lv: -10, poll: 4, noAccess: true, req: 'highways', desc: 'Čtyři pruhy se svodidly. Obrovská kapacita, ale hluk a smog. Domy a firmy z ní nemají sjezd.' },
  6: { key: 'ped', name: 'Pěší zóna', cost: 6000, up: 60, cap: 0.3, lv: 12, noCars: true, req: 'pedestrian', desc: 'Dlažba, lavičky a stromy bez aut. Cena pozemků a obchody v okolí rostou.' },
};

// druhy železničních tratí (vždy dvoukolejné)
const RAILS = {
  1: { key: 'rail', name: 'Železniční trať', cost: 14000, up: 140, speed: 1, desc: 'Dvoukolejná trať pro motorové vlaky. Napoj ji na okraj mapy, ať jezdí vlaky ze světa.' },
  2: { key: 'elec', name: 'Elektrizovaná trať', cost: 24000, up: 200, speed: 1.2, elec: true, req: 'electrification', desc: 'Trať s trolejovým vedením. Elektrické vlaky jsou rychlejší, levnější na provoz a nekouří.' },
  3: { key: 'hsr', name: 'Vysokorychlostní trať', cost: 60000, up: 450, speed: 2, elec: true, hs: true, req: 'hsr', desc: 'Pro rychlovlaky. Nesmí mít přejezdy. Hlavní nádraží se přiblíží velkým městům.' },
};
// vlakové spoje: cena za soupravu měsíčně (costE = elektrická)
const TRAINS = {
  reg: { name: 'Osobní vlaky', cost: 45000, costE: 32000, desc: 'Zastavují na všech zastávkách. Vozí lidi do práce a do škol, lidé můžou dojíždět za prací mimo město. Kraj platí 60 % provozu.' },
  ic:  { name: 'Rychlíky', cost: 110000, costE: 90000, req: 'intercity', desc: 'Dálkové vlaky přes hlavní nádraží. Přivezou turisty a firmy do kanceláří.' },
  fr:  { name: 'Nákladní vlaky', cost: 70000, costE: 55000, desc: 'Vozí zboží z nákladového nádraží. Každý vlak přidá 1 500 t obchodní kapacity měsíčně a průmysl roste.' },
  hs:  { name: 'Rychlovlaky', cost: 240000, costE: 240000, req: 'hsr', desc: 'Vysokorychlostní spoje po vysokorychlostní trati. Velký přínos pro kanceláře a cestovní ruch.' },
};
const RAIL_BASE_CAP = 4;

// ---------- obchod ----------
const GOODS = {
  food:  { name: 'Potraviny', price: 400, unit: 't' },
  goods: { name: 'Zboží', price: 900, unit: 't' },
  tech:  { name: 'Technologie', price: 2600, unit: 'ks' },
  fuel:  { name: 'Palivo', price: 620, unit: 't' },
};
const GOOD_KEYS = Object.keys(GOODS);
const BASE_TRADE = 1500, BASE_STORE = 3000;

// ---------- vyhlášky ----------
// cost = Kč měsíčně na 1 000 obyvatel
const POLICIES = {
  freebus:    { name: 'MHD zdarma', cost: 9000, desc: 'Méně aut a spokojenější lidé. Zaplatí to město.' },
  patrols:    { name: 'Posílené hlídky', cost: 7000, desc: 'Kriminalita −20 %. Lidé se cítí trochu sledovaní.' },
  cameras:    { name: 'Kamerový dohled', cost: 4000, req: 'forensics', desc: 'Kriminalita −15 %, svoboda klesá.' },
  ecolaw:     { name: 'Přísné ekologické normy', cost: 0, desc: 'Znečištění −30 %, průmysl roste pomaleji.' },
  minwage:    { name: 'Vyšší minimální mzda', cost: 0, desc: 'Lidé jsou spokojenější a stávkují méně. Firmy rostou pomaleji.' },
  bizsupport: { name: 'Podpora podnikání', cost: 6000, desc: 'Obchody a kanceláře rostou rychleji.' },
  integration:{ name: 'Integrační programy', cost: 5000, desc: 'Radikalizace pomalu klesá.' },
  youth:      { name: 'Volnočasové kluby pro mládež', cost: 4000, desc: 'Méně kriminality i radikalizace mezi mladými.' },
  gunlaw:     { name: 'Přísný zbrojní zákon', cost: 0, desc: 'Méně násilných činů a útoků. Část lidí to štve.' },
  censorship: { name: 'Kontrola médií', cost: 2000, desc: 'Méně demonstrací, ale svoboda prudce klesá a radikálů přibývá.' },
  noprotest:  { name: 'Zákaz demonstrací', cost: 0, desc: 'Demonstrace jsou vzácné, ale když vypuknou, bývají prudší.' },
  curfew:     { name: 'Zákaz vycházení', cost: 0, desc: 'Nepokoje rychle utichnou. Obchody trpí a svoboda klesá.' },
  quarantine: { name: 'Karanténa', cost: 0, desc: 'Epidemie se šíří pomaleji. Obchody trpí.' },
  armypay:    { name: 'Příplatky vojákům', cost: 3000, desc: 'Armáda je loajálnější.' },
  firesafety: { name: 'Kontroly požární bezpečnosti', cost: 2500, desc: 'Inspektoři kontrolují budovy. Požárů je o čtvrtinu méně.' },
};
const POLICY_FREEDOM = { patrols: -4, cameras: -10, censorship: -25, noprotest: -20, curfew: -25, gunlaw: -3, quarantine: -6 };

// ---------- začátek hry ----------
const STARTS = [
  { name: 'Prázdná krajina', pop: 0, money: 3500000, r: 0, desc: 'Jen louky, les a řeka. Silnice vede z dálnice na kraji mapy.' },
  { name: 'Vesnice', pop: 700, money: 3000000, r: 6, desc: 'Pár ulic, obchod a hospoda.' },
  { name: 'Městečko', pop: 5000, money: 6000000, r: 12, desc: 'Náměstí, škola, služebna a malá elektrárna.' },
  { name: 'Město', pop: 25000, money: 15000000, r: 20, desc: 'Paneláky, průmyslová zóna, nemocnice a nádraží.' },
  { name: 'Velkoměsto', pop: 90000, money: 25000000, r: 30, desc: 'Hustá výstavba, univerzita, armáda a spousta starostí.' },
];
const CRISIS_LEVELS = [{ name: 'Klidné časy', k: 0.45 }, { name: 'Běžné', k: 1 }, { name: 'Neklidná doba', k: 1.8 }];

// ---------- sousední města ----------
const NEIGHBORS = [
  { name: 'Kamenná Lhota', side: 'W', pop: 38000, aggr: 0.2, rel: 35, trait: 'obchodní', desc: 'Klidné obchodní město. Rádo uzavírá smlouvy.' },
  { name: 'Bystřany', side: 'N', pop: 95000, aggr: 0.65, rel: 0, trait: 'hrdé', desc: 'Velké a sebevědomé město se silnou armádou. Urážky nezapomíná.' },
  { name: 'Velké Dvory', side: 'E', pop: 24000, aggr: 0.4, rel: 15, trait: 'nevyzpytatelné', desc: 'Menší průmyslové město s výkyvy nálad.' },
];
