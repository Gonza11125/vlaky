'use strict';
// Herní data: suroviny, epochy, jednotky, budovy, technologie.

const RES = ['food', 'wood', 'stone', 'ore', 'metal', 'gold', 'know', 'grain', 'flour'];
const RES_NAME = { food: 'Jídlo', wood: 'Dřevo', stone: 'Kámen', ore: 'Ruda', metal: 'Kov', gold: 'Zlato', know: 'Vědění', grain: 'Obilí', flour: 'Mouka' };

/* 1.5.0: výrobní řetězce. rate je počet cyklů za sekundu,
 * vstupy a výstupy jsou skutečné jednotky zdrojů na jeden cyklus. */
const ECON_RECIPES = Object.freeze({
  mill: { name: 'Mletí obilí', rate: 0.4, input: { grain: 1 }, output: { flour: 1 } },
  bakery: { name: 'Pečení chleba', rate: 0.35, input: { flour: 1, wood: 0.2 }, output: { food: 2 } },
  smelter: { name: 'Tavení kovu', rate: 0.3, input: { ore: 2, wood: 0.5 }, output: { metal: 1 } },
});
const ECON_RESERVE = ['wood', 'ore', 'grain', 'flour'];
const ECON_RESERVE_DEFAULT = Object.freeze({ wood: 20, ore: 0, grain: 0, flour: 0 });
const ECON_PRIORITY_SCALE = [0, 0.65, 1, 1.25];
const ECON_TARGETS = [0, 50, 150, 300, 600];

const ERAS = ['Doba kamenná', 'Doba bronzová', 'Doba železná', 'Středověk', 'Novověk'];
const SEASONS = ['Jaro', 'Léto', 'Podzim', 'Zima'];
const SEASON_LEN = 60;            // sekund na roční období
const FARM_SEASON = [0.8, 1.0, 1.3, 0];
const TEAM_COLORS = [0x2f6fd0, 0xc8402f];

const MAP_TYPES = { balanced: 'Vyvážená krajina', forest: 'Lesnatá krajina', highlands: 'Hornatá krajina', river: 'Říční údolí' };
const MATCH_DEFAULTS = { map: 'balanced', resources: 1, stocks: 1, goal: 'conquest', years: 5, peace: 0, seed: null };
function matchOptions(value) {
  const v = value || {}, choose = (key, allowed) => allowed.includes(v[key]) ? v[key] : MATCH_DEFAULTS[key];
  return { map: choose('map', Object.keys(MAP_TYPES)), resources: choose('resources', [0.6, 1, 1.8]), stocks: choose('stocks', [0.75, 1, 2]),
    goal: choose('goal', ['conquest', 'survival', 'development']), years: choose('years', [3, 5, 10]), peace: choose('peace', [0, 120, 300, 600]),
    seed: Number.isInteger(v.seed) && v.seed >= 0 && v.seed <= 4294967295 ? v.seed : null };
}
function goalDescription(match) {
  if (match.goal === 'survival') return 'Přežij ' + match.years + ' celých let. Po síti přežití obou osad znamená remízu.';
  if (match.goal === 'development') return 'Dosáhni doby železné, 20 lidí, 300 jídla a 100 zlata dřív než soupeř.';
  return 'Znič nepřátelské Sídlo a uchraň vlastní.';
}

const UNITS = {
  caravan:  { name: 'Karavana', cls: 'trade', at: 'market', req: ['currency'], cost: { food: 60, wood: 50, gold: 20 }, time: 24, hp: 80, atk: 0, cd: 1, speed: 3.6, armor: 0, upkeep: 2,
              desc: 'Vozí zboží mezi dvěma vlastními Tržišti vzdálenými alespoň 24 metrů. Zlato přiveze až po celé cestě tam a zpět. Vyber ji a ukaž na cílové Tržiště; neumí bojovat.' },
  vil:      { name: 'Vesničan', cls: 'vil', at: 'tc', cost: { food: 50 }, time: 14, hp: 40, atk: 2, cd: 1.5, speed: 3.4, armor: 0, upkeep: 2,
              desc: 'Sbírá suroviny, staví a opravuje budovy, obdělává pole.' },
  spear:    { name: 'Kopiník', cls: 'inf', at: 'barracks', cost: { food: 40, wood: 20 }, time: 14, hp: 65, atk: 6, cd: 1.4, speed: 3.3, armor: 0, upkeep: 3, bonus: { cav: 2.2 },
              desc: 'Levná pěchota. Dlouhé kopí zastaví jízdu.' },
  sword:    { name: 'Šermíř', cls: 'inf', at: 'barracks', req: ['bronze'], cost: { food: 50, metal: 25 }, time: 18, hp: 110, atk: 11, cd: 1.3, speed: 3.2, armor: 2, upkeep: 3,
              desc: 'Těžká pěchota s kovovým mečem a štítem.' },
  archer:   { name: 'Lučištník', cls: 'arch', at: 'range', cost: { food: 30, wood: 35 }, time: 15, hp: 40, atk: 5, range: 9, cd: 1.7, speed: 3.3, armor: 0, upkeep: 3, proj: 'arrow',
              desc: 'Střílí z dálky, v boji zblízka nevydrží.' },
  xbow:     { name: 'Kušiník', cls: 'arch', at: 'range', req: ['crossbow'], cost: { food: 40, wood: 30, metal: 15 }, time: 18, hp: 55, atk: 10, range: 10, cd: 2.4, speed: 3.1, armor: 0, pierce: 2, upkeep: 3, proj: 'arrow',
              desc: 'Šipka z kuše probije zbroj. Nabíjí pomaleji než luk.' },
  musket:   { name: 'Mušketýr', cls: 'arch', at: 'range', req: ['gunpowder'], cost: { food: 50, metal: 35, gold: 15 }, time: 20, hp: 60, atk: 26, range: 11, cd: 3.6, speed: 3.1, armor: 0, pierce: 99, upkeep: 3, proj: 'shot',
              desc: 'Olověná kule ignoruje jakoukoli zbroj. Dlouhé nabíjení.' },
  rider:    { name: 'Jezdec', cls: 'cav', at: 'stable', req: ['horses'], cost: { food: 70, metal: 10 }, time: 20, hp: 110, atk: 9, cd: 1.4, speed: 5.6, armor: 1, upkeep: 4,
              desc: 'Rychlá jízda na přepady lučištníků a vesničanů.' },
  knight:   { name: 'Rytíř', cls: 'cav', at: 'stable', req: ['stirrups', 'steel'], cost: { food: 90, metal: 50, gold: 30 }, time: 26, hp: 190, atk: 15, cd: 1.4, speed: 5.2, armor: 4, upkeep: 5,
              desc: 'Obrněný jezdec. Třmeny mu dovolí udeřit plnou vahou koně.' },
  catapult: { name: 'Katapult', cls: 'siege', at: 'workshop', req: ['mechanics'], cost: { wood: 150, metal: 30 }, time: 30, hp: 90, atk: 40, range: 14, cd: 5, speed: 1.8, armor: 1, upkeep: 2, bonus: { bld: 3.5 }, proj: 'rock',
              desc: 'Obléhací stroj na budovy. Pomalý a bezbranný zblízka.' },
  cannon:   { name: 'Dělo', cls: 'siege', at: 'workshop', req: ['artillery'], cost: { wood: 100, metal: 150, gold: 60 }, time: 34, hp: 130, atk: 85, range: 16, cd: 6, speed: 1.6, armor: 2, upkeep: 2, bonus: { bld: 3 }, pierce: 99, proj: 'ball',
              desc: 'Bronzové dělo. Hradby a věže proti němu neobstojí.' },
};

const BUILDINGS = {
  forester: { name: 'Lesovna', size: 2, hp: 500, time: 25, req: ['agri'], cost: { wood: 80, food: 40 },
              desc: 'Každých 30 sekund obnoví jeden vytěžený strom do vzdálenosti 22 metrů. Strom nesmí překrývat stavbu. Dřevo pak musí pokácet a donést vesničané.' },
  bakery:   { name: 'Pekárna', size: 2, hp: 600, time: 28, req: ['agri', 'pottery'], cost: { wood: 80, stone: 40 },
              desc: 'Z 1 mouky a 0,2 dřeva upeče 2 jídla. V realistickém režimu potřebuje pekaře; výrobu lze řídit podle zásob.' },
  tc:       { name: 'Sídlo', size: 3, hp: 2400, pop: 6, drop: true, atk: 6, range: 11, cd: 1.6, cost: null,
              desc: 'Srdce osady. Cvičí vesničany, přijímá suroviny a posouvá osadu do další epochy. Když padne, prohráváš.' },
  house:    { name: 'Dům', size: 2, hp: 500, time: 18, pop: 5, cost: { wood: 30 },
              desc: 'Ubytuje 5 lidí.' },
  store:    { name: 'Sklad', size: 2, hp: 600, time: 20, drop: true, cost: { wood: 50 },
              desc: 'Vesničané sem odnášejí suroviny. Postav ho blízko lesa nebo lomu, ať nechodí daleko.' },
  farm:     { name: 'Pole', size: 3, hp: 200, time: 14, req: ['agri'], cost: { wood: 30 },
              desc: 'Jeden rolník, úroda od jara do podzimu. Zelenina dává přímo jídlo; po přepnutí na obilí zásobuje Mlýn a Pekárnu. V zimě pole nerodí.' },
  pasture:  { name: 'Pastvina', size: 3, hp: 300, time: 22, req: ['husbandry'], cost: { wood: 60 },
              desc: 'Dobytek dává trochu jídla celý rok, i v zimě. Nepotřebuje pracovníka.' },
  library:  { name: 'Knihovna', size: 2, hp: 600, time: 30, req: ['writing'], cost: { wood: 80, stone: 40 },
              desc: 'Vytváří vědění a zkoumá vědecké objevy. Počítají se nejvýš čtyři.' },
  smelter:  { name: 'Huť', size: 2, hp: 700, time: 28, req: ['bronze'], cost: { wood: 40, stone: 60 },
              desc: 'Ze 2 rud a 0,5 dřeva vyrobí 1 kov. V realistickém režimu potřebuje hutníka a dostupné zásobování.' },
  smithy:   { name: 'Kovárna', size: 2, hp: 700, time: 28, req: ['bronze'], cost: { wood: 70, stone: 30 },
              desc: 'Zkoumá nástroje, zbraně a zbroj.' },
  barracks: { name: 'Kasárna', size: 3, hp: 1100, time: 30, cost: { wood: 90 },
              desc: 'Cvičí pěchotu.' },
  range:    { name: 'Střelnice', size: 3, hp: 1000, time: 30, cost: { wood: 100 },
              desc: 'Cvičí střelce.' },
  stable:   { name: 'Stáj', size: 3, hp: 1000, time: 30, req: ['horses'], cost: { wood: 110, stone: 20 },
              desc: 'Cvičí jízdu.' },
  workshop: { name: 'Dílna', size: 3, hp: 1000, time: 34, req: ['mechanics'], cost: { wood: 140, metal: 30 },
              desc: 'Staví obléhací stroje.' },
  mill:     { name: 'Mlýn', size: 2, hp: 500, time: 22, req: ['agri'], cost: { wood: 60 },
              desc: 'Mele 1 obilí na 1 mouku, až 0,4 za sekundu. V realistickém režimu potřebuje mlynáře. Výrobu lze zpomalit nebo pozastavit.' },
  market:   { name: 'Tržiště', size: 3, hp: 800, time: 30, req: ['currency'], cost: { wood: 120, stone: 40 },
              desc: 'Tady prodáš přebytky za zlato a nakoupíš, co chybí. Ceny se hýbou podle toho, co prodáváš a kupuješ. Samo vynáší trochu zlata z obchodu.' },
  palisade: { name: 'Palisáda', size: 1, hp: 350, time: 5, wall: true, line: true, cost: { wood: 6 },
              desc: 'Hradba z kůlů. Levná, ale dlouho nevydrží. Klikni na začátek a pak na konec úseku.' },
  wall:     { name: 'Hradba', size: 1, hp: 1300, time: 9, wall: true, line: true, req: ['masonry'], cost: { stone: 8 },
              desc: 'Kamenná zeď. Pěchota ji bourá pomalu, obléhací stroje rychle. Klikni na začátek a pak na konec úseku.' },
  gate:     { name: 'Brána', size: 1, hp: 700, time: 12, wall: true, gate: true, cost: { wood: 40 },
              desc: 'Tvoji lidé projdou, nepřítel ne. Postav ji do mezery v hradbě.' },
  granary:  { name: 'Sýpka', size: 2, hp: 600, time: 20, real: true, req: ['agri'], cost: { wood: 70 },
              desc: 'Suchý sklad na obilí. Uskladní dalších 250 jídla; co se nevejde, to se kazí.' },
  well:     { name: 'Studna', size: 1, hp: 400, time: 14, real: true, cost: { wood: 10, stone: 40 },
              desc: 'Čistá voda snižuje riziko nákazy a je po ruce při hašení požárů. Jedna studna stačí asi pro 15 lidí.' },
  healer:   { name: 'Ošetřovna', size: 2, hp: 500, time: 24, real: true, req: ['herbs'], cost: { wood: 70, stone: 20 },
              desc: 'Nemocní v okolí se uzdraví třikrát rychleji a nemoc jim neubírá životy. Léčí i raněné.' },
  tower:    { name: 'Věž', size: 1, hp: 900, time: 26, req: ['masonry'], atk: 8, range: 12, cd: 1.5, cost: { wood: 20, stone: 90 },
              desc: 'Kamenná strážní věž. Sama střílí na nepřátele v dosahu.' },
};
const BUILD_ORDER = ['house', 'store', 'farm', 'mill', 'bakery', 'forester', 'pasture', 'barracks', 'range', 'palisade', 'gate', 'library', 'smelter', 'smithy', 'market', 'stable', 'workshop', 'wall', 'tower', 'granary', 'well', 'healer'];

// era = nejnižší epocha, ve které jde technologii zkoumat; setsEra = postup do epochy
const TECHS = {
  agri:      { name: 'Zemědělství', era: 0, at: 'tc', cost: { know: 15 }, time: 20,
               desc: 'Lidé přestávají jen sbírat a začínají sít obilí. Odemyká Pole.' },
  pottery:   { name: 'Hrnčířství', era: 0, at: 'tc', cost: { know: 20 }, time: 20,
               desc: 'V pálených nádobách se zásoby nekazí. Spotřeba jídla −15 %.' },
  husbandry: { name: 'Chov dobytka', era: 0, at: 'tc', cost: { know: 25, food: 50 }, time: 25,
               desc: 'Ochočené ovce a kozy. Odemyká Pastvinu, která živí i v zimě.' },
  herbs:     { name: 'Bylinkářství', era: 0, at: 'tc', real: true, cost: { know: 20 }, time: 20,
               desc: 'Odvary a obklady. Nemoc ubírá o polovinu méně životů. Odemyká Ošetřovnu.' },
  era1:      { name: 'Doba bronzová', era: 0, at: 'tc', setsEra: 1, req: ['agri'], cost: { know: 50, food: 150 }, time: 40,
               desc: 'Usedlý život a přebytky úrody uživí řemeslníky. Postup do další epochy.' },

  wheel:     { name: 'Kolo', era: 1, at: 'tc', cost: { know: 30, wood: 60 }, time: 25,
               desc: 'Dvoukolové káry. Vesničané unesou o polovinu víc a chodí rychleji.' },
  writing:   { name: 'Písmo', era: 1, at: 'tc', cost: { know: 35 }, time: 30,
               desc: 'Vědění se dá zapsat a předat dál. Odemyká Knihovnu, vědění +20 %.' },
  bronze:    { name: 'Hornictví a tavení', era: 1, at: 'tc', cost: { know: 40, wood: 50, stone: 50 }, time: 30,
               desc: 'Měď s cínem dá bronz. Vesničané mohou těžit rudu a zlato. Odemyká Huť, Kovárnu a Šermíře.' },
  masonry:   { name: 'Zdivo', era: 1, at: 'tc', cost: { know: 40, stone: 80 }, time: 30,
               desc: 'Opracovaný kámen spojený maltou. Odemyká Věž, budovy vydrží o čtvrtinu víc.' },
  horses:    { name: 'Chov koní', era: 1, at: 'tc', cost: { know: 40, food: 100 }, time: 30,
               desc: 'Kůň pod sedlem. Odemyká Stáj a Jezdce.' },
  currency:  { name: 'Ražba mincí', era: 1, at: 'tc', cost: { know: 35, wood: 40 }, time: 25,
               desc: 'Kov se stejnou vahou a značkou vládce. Odemyká Tržiště.' },
  dikes:     { name: 'Hráze', era: 1, at: 'tc', real: true, cost: { know: 40, stone: 80 }, time: 30,
               desc: 'Náspy a odvodňovací strouhy. Povodeň ničí stavby jen třetinovou silou.' },
  btools:    { name: 'Kovové nástroje', era: 1, at: 'smithy', cost: { know: 30, metal: 30 }, time: 25,
               desc: 'Sekery, krumpáče a dláta z kovu. Těžba dřeva, kamene a rudy +20 %.' },
  bweap:     { name: 'Kovové hroty', era: 1, at: 'smithy', cost: { know: 35, metal: 40 }, time: 25,
               desc: 'Kopí a meče s litým ostřím. Útok pěchoty a jízdy +2.' },
  era2:      { name: 'Doba železná', era: 1, at: 'tc', setsEra: 2, req: ['bronze', 'writing'], cost: { know: 130, food: 300, metal: 60, gold: 40 }, time: 50,
               desc: 'Železná ruda je všude, jen ji umět vytavit. Postup do další epochy.' },

  iron:      { name: 'Zpracování železa', era: 2, at: 'smithy', cost: { know: 80, metal: 80 }, time: 35,
               desc: 'Kujné železo z dýmačky. Huť taví o polovinu rychleji, pěchota a jízda +2 útok a +1 zbroj.' },
  plow:      { name: 'Železný pluh', era: 2, at: 'tc', req: ['iron'], cost: { know: 70, metal: 40, wood: 60 }, time: 30,
               desc: 'Radlice obrací i těžkou půdu. Úroda polí +30 %.' },
  math:      { name: 'Matematika', era: 2, at: 'library', cost: { know: 90 }, time: 35,
               desc: 'Geometrie a počty. Vědění +25 %, základ pro mechaniku.' },
  mechanics: { name: 'Mechanika', era: 2, at: 'library', req: ['math'], cost: { know: 100, wood: 100 }, time: 40,
               desc: 'Páka, kladka a torzní pružina. Odemyká Dílnu a Katapult.' },
  medicine:  { name: 'Medicína', era: 2, at: 'library', real: true, cost: { know: 90 }, time: 35,
               desc: 'Lékaři popisují příznaky a oddělují nemocné. Nemoc trvá o polovinu kratší dobu.' },
  era3:      { name: 'Středověk', era: 2, at: 'tc', setsEra: 3, req: ['iron', 'math'], cost: { know: 260, food: 500, metal: 150, gold: 120 }, time: 60,
               desc: 'Postup do další epochy.' },

  threefield:{ name: 'Trojpolní hospodaření', era: 3, at: 'tc', cost: { know: 120, food: 100 }, time: 35,
               desc: 'Ozim, jař a úhor se střídají, půda se nevyčerpá. Úroda polí +30 %.' },
  stirrups:  { name: 'Třmeny', era: 3, at: 'smithy', req: ['horses'], cost: { know: 110, metal: 60 }, time: 35,
               desc: 'Jezdec se v sedle opře a udrží kopí při nárazu. Spolu s ocelí odemyká Rytíře.' },
  steel:     { name: 'Ocel', era: 3, at: 'smithy', cost: { know: 160, metal: 150 }, time: 45,
               desc: 'Nauhličené a kalené železo. Pěchota a jízda +3 útok a +1 zbroj.' },
  crossbow:  { name: 'Kuše', era: 3, at: 'smithy', cost: { know: 120, wood: 100, metal: 50 }, time: 35,
               desc: 'Ocelový luk s napínákem. Odemyká Kušiníka.' },
  university:{ name: 'Univerzity', era: 3, at: 'library', cost: { know: 150, stone: 150, gold: 80 }, time: 45,
               desc: 'Učenci se sdružují a přou. Vědění +40 %.' },
  sanitation:{ name: 'Kanalizace', era: 3, at: 'tc', real: true, cost: { know: 120, stone: 150 }, time: 40,
               desc: 'Stoky odvádějí splašky od studní. Nákaza propuká mnohem vzácněji.' },
  era4:      { name: 'Novověk', era: 3, at: 'tc', setsEra: 4, req: ['steel', 'university'], cost: { know: 500, food: 700, metal: 300, gold: 250 }, time: 70,
               desc: 'Postup do poslední epochy.' },

  gunpowder: { name: 'Střelný prach', era: 4, at: 'library', cost: { know: 250, metal: 100 }, time: 50,
               desc: 'Ledek, síra a dřevěné uhlí. Odemyká Mušketýra.' },
  artillery: { name: 'Dělostřelectví', era: 4, at: 'smithy', req: ['gunpowder'], cost: { know: 300, metal: 250 }, time: 55,
               desc: 'Lité hlavně a železné koule. Odemyká Dělo.' },
  printing:  { name: 'Knihtisk', era: 4, at: 'library', cost: { know: 200, wood: 150, gold: 60 }, time: 45,
               desc: 'Kniha za zlomek ceny opisu. Vědění +50 %.' },
  blast:     { name: 'Vysoká pec', era: 4, at: 'smithy', cost: { know: 200, stone: 200 }, time: 45,
               desc: 'Měchy hnané vodním kolem roztaví železo do tekuta. Huť taví dvakrát rychleji.' },
};

const NODE_DEF = {
  tree:  { name: 'Strom', res: 'wood', amt: 100, rate: 0.5 },
  bush:  { name: 'Keř s bobulemi', res: 'food', amt: 160, rate: 0.45 },
  stone: { name: 'Kamenný lom', res: 'stone', amt: 500, rate: 0.4 },
  ore:   { name: 'Ložisko rudy', res: 'ore', amt: 500, rate: 0.35, req: 'bronze' },
  gold:  { name: 'Zlatá žíla', res: 'gold', amt: 400, rate: 0.3, req: 'bronze' },
  fish:  { name: 'Hejno ryb', res: 'food', amt: 320, rate: 0.4 },
  meat:  { name: 'Ulovená zvěř', res: 'food', amt: 140, rate: 0.65 },
};
