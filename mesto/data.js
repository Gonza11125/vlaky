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
  fire:      { name: 'Hasičská stanice', cat: 'safety', size: 1, cost: 450000, up: 22000, r: 11, desc: 'Hasí požáry v dosahu. Bez hasičů požár sežere celou čtvrť.' },
  barracks:  { name: 'Vojenská základna', cat: 'safety', size: 3, cost: 4000000, up: 150000, army: 400, desc: '400 vojáků. Brání město ve válce. Když je armáda nespokojená, může se pokusit o převrat.' },
  intel:     { name: 'Tajná služba', cat: 'safety', size: 1, cost: 2500000, up: 120000, req: 'intel', desc: 'Odhaluje extremisty dřív, než udeří, a umožňuje tajné operace v sousedních městech.' },
  clinic:    { name: 'Poliklinika', cat: 'health', size: 1, cost: 500000, up: 25000, r: 9, desc: 'Praktičtí lékaři pro okolí.' },
  hospital:  { name: 'Nemocnice', cat: 'health', size: 2, cost: 3000000, up: 120000, r: 20, desc: 'Velký dosah, zvládá epidemie a katastrofy.' },
  school:    { name: 'Základní škola', cat: 'edu', size: 1, cost: 600000, up: 30000, r: 10, edu: 0.5, rp: 1, desc: 'Základ vzdělání pro děti z okolí.' },
  highschool:{ name: 'Střední škola', cat: 'edu', size: 2, cost: 1600000, up: 60000, r: 16, edu: 0.8, rp: 3, desc: 'Vzdělaní lidé chtějí pracovat v kancelářích.' },
  university:{ name: 'Univerzita', cat: 'edu', size: 3, cost: 6000000, up: 200000, r: 40, edu: 1, rp: 20, desc: 'Vzdělání pro celé město a hodně výzkumu.' },
  institute: { name: 'Výzkumný ústav', cat: 'edu', size: 2, cost: 3000000, up: 110000, rp: 25, needs: 'university', desc: 'Jen výzkum. Potřebuje ve městě univerzitu.' },
  park:      { name: 'Park', cat: 'fun', size: 1, cost: 80000, up: 2000, r: 5, park: 0.6, desc: 'Zeleň zvedá cenu pozemků a náladu lidí.' },
  bigpark:   { name: 'Městský park', cat: 'fun', size: 2, cost: 320000, up: 8000, r: 8, park: 1, desc: 'Velký park s jezírkem.' },
  church:    { name: 'Kostel', cat: 'fun', size: 2, cost: 1500000, up: 6000, r: 7, park: 0.5, desc: 'Dominanta obce. Zvedá cenu pozemků a náladu v okolí.' },
  plaza:     { name: 'Náměstí', cat: 'fun', size: 1, cost: 150000, up: 3000, r: 4, park: 0.4, shop: 1, desc: 'Místo pro trhy a setkávání. Pomáhá obchodům kolem.' },
  stadium:   { name: 'Stadion', cat: 'fun', size: 3, cost: 5000000, up: 80000, r: 40, park: 0.3, happy: 4, desc: 'Celé město je o něco spokojenější. Fanoušci ale umí i demonstrovat.' },
  bus:       { name: 'Autobusové depo', cat: 'trans', size: 1, cost: 400000, up: 15000, r: 9, transit: 0.5, desc: 'Městská doprava ulehčí silnicím.' },
  metro:     { name: 'Stanice metra', cat: 'trans', size: 1, cost: 2500000, up: 40000, r: 12, transit: 1, req: 'metro', desc: 'Rychlá podzemní doprava. Výrazně ubere aut.' },
  station:   { name: 'Nákladové nádraží', cat: 'trans', size: 2, cost: 2500000, up: 40000, trade: 4000, desc: 'Vyveze a doveze 4 000 jednotek zboží měsíčně.' },
  port:      { name: 'Přístav', cat: 'trans', size: 3, cost: 5000000, up: 80000, trade: 12000, coast: true, desc: 'Velká obchodní kapacita. Musí stát u vody.' },
  airport:   { name: 'Letiště', cat: 'trans', size: 4, cost: 15000000, up: 200000, trade: 3000, tourism: 1, req: 'aviation', desc: 'Turisté, obchod a prestiž. Hluk sníží cenu pozemků okolo.' },
  warehouse: { name: 'Městské sklady', cat: 'trans', size: 2, cost: 600000, up: 9000, store: 6000, desc: 'Uskladní dalších 6 000 jednotek od každé suroviny.' },
  dike:      { name: 'Protipovodňová hráz', cat: 'gov', size: 1, cost: 25000, up: 200, req: 'flood', line: true, desc: 'Hráz podél řeky. Zastaví vodu, když lemuje celý břeh.' },
};
const SERV_CATS = [
  { key: 'power', name: 'Energie' }, { key: 'water', name: 'Voda a odpad' }, { key: 'safety', name: 'Bezpečnost' },
  { key: 'health', name: 'Zdraví' }, { key: 'edu', name: 'Vzdělání' }, { key: 'fun', name: 'Volný čas' },
  { key: 'trans', name: 'Doprava a obchod' }, { key: 'gov', name: 'Správa' },
];
const PW_RES = 0.05, PW_JOB = 0.08, WT_RES = 0.15, WT_JOB = 0.08;
const ROAD_COST = 3000, BRIDGE_COST = 18000, DEMOLISH_COST = 2000, ROAD_UP = 50;

// ---------- obchod ----------
const GOODS = {
  food:  { name: 'Potraviny', price: 400, unit: 't' },
  goods: { name: 'Zboží', price: 900, unit: 't' },
  tech:  { name: 'Technologie', price: 2600, unit: 'ks' },
  fuel:  { name: 'Palivo', price: 620, unit: 't' },
};
const GOOD_KEYS = Object.keys(GOODS);
const BASE_TRADE = 1500, BASE_STORE = 3000;

// ---------- výzkum ----------
const TECHS = {
  gasturb:   { name: 'Plynové turbíny', cat: 'Energie', cost: 40, desc: 'Odemyká plynovou elektrárnu.' },
  wind:      { name: 'Větrná energie', cat: 'Energie', cost: 45, desc: 'Odemyká větrné elektrárny.' },
  solar:     { name: 'Fotovoltaika', cat: 'Energie', cost: 90, req: ['wind'], desc: 'Odemyká solární parky.' },
  smartgrid: { name: 'Chytrá síť', cat: 'Energie', cost: 140, req: ['solar'], desc: 'Spotřeba elektřiny a vody klesne o 15 %.' },
  nuclear:   { name: 'Jaderná energetika', cat: 'Energie', cost: 260, req: ['gasturb'], desc: 'Odemyká jadernou elektrárnu.' },
  hygiene:   { name: 'Hygiena a kanalizace', cat: 'Zdraví', cost: 35, desc: 'Odemyká čistírnu odpadních vod.' },
  vaccines:  { name: 'Očkování', cat: 'Zdraví', cost: 90, req: ['hygiene'], desc: 'Epidemie jsou vzácnější a slabší.' },
  bus:       { name: 'Jízdní řády', cat: 'Doprava', cost: 30, desc: 'Autobusy jezdí častěji: dosah dep +30 %.' },
  metro:     { name: 'Metro', cat: 'Doprava', cost: 180, req: ['bus'], desc: 'Odemyká stanice metra.' },
  logistics: { name: 'Logistika', cat: 'Doprava', cost: 80, desc: 'Obchodní kapacita města +30 %.' },
  aviation:  { name: 'Letectví', cat: 'Doprava', cost: 200, req: ['logistics'], desc: 'Odemyká letiště.' },
  forensics: { name: 'Kriminalistika', cat: 'Bezpečnost', cost: 60, desc: 'Policie je o 25 % účinnější proti kriminalitě.' },
  riot:      { name: 'Pořádková jednotka', cat: 'Bezpečnost', cost: 80, req: ['forensics'], desc: 'Rozehnání demonstrace méně často skončí nepokoji.' },
  intel:     { name: 'Zpravodajství', cat: 'Bezpečnost', cost: 120, req: ['forensics'], desc: 'Odemyká tajnou službu.' },
  firecode:  { name: 'Požární předpisy', cat: 'Bezpečnost', cost: 50, desc: 'Požáry vznikají o 40 % méně.' },
  seismic:   { name: 'Seizmické normy', cat: 'Stavebnictví', cost: 90, desc: 'Zemětřesení zboří o 60 % méně budov.' },
  flood:     { name: 'Protipovodňová ochrana', cat: 'Stavebnictví', cost: 60, desc: 'Odemyká protipovodňové hráze.' },
  skyscraper:{ name: 'Výškové stavby', cat: 'Stavebnictví', cost: 150, desc: 'Husté zóny mohou růst až do 5. úrovně.' },
  filters:   { name: 'Průmyslové filtry', cat: 'Ekologie', cost: 70, desc: 'Průmysl a elektrárny znečišťují o 35 % méně.' },
  recycling: { name: 'Recyklace', cat: 'Ekologie', cost: 100, req: ['filters'], desc: 'Odemyká recyklační centrum.' },
  incin:     { name: 'Energetické využití odpadu', cat: 'Ekologie', cost: 70, desc: 'Odemyká spalovnu.' },
  hightech:  { name: 'High-tech výroba', cat: 'Ekonomika', cost: 130, desc: 'Nové továrny mohou vyrábět technologie, pokud jsou lidé vzdělaní.' },
  banking:   { name: 'Bankovnictví', cat: 'Ekonomika', cost: 70, desc: 'Úvěry jsou levnější, kanceláře se rozrůstají rychleji.' },
  tourism:   { name: 'Cestovní ruch', cat: 'Ekonomika', cost: 90, desc: 'Parky, stadion a letiště vydělávají na turistech.' },
  egov:      { name: 'Elektronická správa', cat: 'Správa', cost: 110, desc: 'Provoz úřadů −15 %, důvěra ve vedení roste.' },
  mediation: { name: 'Mediace konfliktů', cat: 'Správa', cost: 70, desc: 'Vyjednávání s demonstranty a stávkujícími častěji uspěje.' },
  diplomacy: { name: 'Diplomatický sbor', cat: 'Správa', cost: 90, desc: 'Vztahy se sousedy se lepší rychleji a hůř se kazí.' },
};

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
const TECH_LEVELS = [
  { name: 'Základní', techs: [] },
  { name: 'Rozvinutá', techs: ['gasturb', 'wind', 'hygiene', 'bus', 'forensics', 'firecode', 'flood', 'filters', 'logistics'] },
  { name: 'Špičková', techs: ['gasturb', 'wind', 'solar', 'hygiene', 'vaccines', 'bus', 'metro', 'logistics', 'forensics', 'riot', 'intel', 'firecode', 'seismic', 'flood', 'skyscraper', 'filters', 'recycling', 'incin', 'hightech', 'banking', 'tourism', 'egov', 'mediation'] },
];
const CRISIS_LEVELS = [{ name: 'Klidné časy', k: 0.45 }, { name: 'Běžné', k: 1 }, { name: 'Neklidná doba', k: 1.8 }];

// ---------- sousední města ----------
const NEIGHBORS = [
  { name: 'Kamenná Lhota', side: 'W', pop: 38000, aggr: 0.2, rel: 35, trait: 'obchodní', desc: 'Klidné obchodní město. Rádo uzavírá smlouvy.' },
  { name: 'Bystřany', side: 'N', pop: 95000, aggr: 0.65, rel: 0, trait: 'hrdé', desc: 'Velké a sebevědomé město se silnou armádou. Urážky nezapomíná.' },
  { name: 'Velké Dvory', side: 'E', pop: 24000, aggr: 0.4, rel: 15, trait: 'nevyzpytatelné', desc: 'Menší průmyslové město s výkyvy nálad.' },
];
