'use strict';
// Herní data: suroviny, epochy, jednotky, budovy, technologie.

const RES = ['food', 'wood', 'stone', 'ore', 'metal', 'know'];
const RES_NAME = { food: 'Jídlo', wood: 'Dřevo', stone: 'Kámen', ore: 'Ruda', metal: 'Kov', know: 'Vědění' };
const ERAS = ['Doba kamenná', 'Doba bronzová', 'Doba železná', 'Středověk', 'Novověk'];
const SEASONS = ['Jaro', 'Léto', 'Podzim', 'Zima'];
const SEASON_LEN = 60;            // sekund na roční období
const FARM_SEASON = [0.8, 1.0, 1.3, 0];
const TEAM_COLORS = [0x2f6fd0, 0xc8402f];

const UNITS = {
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
  musket:   { name: 'Mušketýr', cls: 'arch', at: 'range', req: ['gunpowder'], cost: { food: 50, metal: 35 }, time: 20, hp: 60, atk: 26, range: 11, cd: 3.6, speed: 3.1, armor: 0, pierce: 99, upkeep: 3, proj: 'shot',
              desc: 'Olověná kule ignoruje jakoukoli zbroj. Dlouhé nabíjení.' },
  rider:    { name: 'Jezdec', cls: 'cav', at: 'stable', req: ['horses'], cost: { food: 70, metal: 10 }, time: 20, hp: 110, atk: 9, cd: 1.4, speed: 5.6, armor: 1, upkeep: 4,
              desc: 'Rychlá jízda na přepady lučištníků a vesničanů.' },
  knight:   { name: 'Rytíř', cls: 'cav', at: 'stable', req: ['stirrups', 'steel'], cost: { food: 90, metal: 50 }, time: 26, hp: 190, atk: 15, cd: 1.4, speed: 5.2, armor: 4, upkeep: 5,
              desc: 'Obrněný jezdec. Třmeny mu dovolí udeřit plnou vahou koně.' },
  catapult: { name: 'Katapult', cls: 'siege', at: 'workshop', req: ['mechanics'], cost: { wood: 150, metal: 30 }, time: 30, hp: 90, atk: 40, range: 14, cd: 5, speed: 1.8, armor: 1, upkeep: 2, bonus: { bld: 3.5 }, proj: 'rock',
              desc: 'Obléhací stroj na budovy. Pomalý a bezbranný zblízka.' },
  cannon:   { name: 'Dělo', cls: 'siege', at: 'workshop', req: ['artillery'], cost: { wood: 100, metal: 150 }, time: 34, hp: 130, atk: 85, range: 16, cd: 6, speed: 1.6, armor: 2, upkeep: 2, bonus: { bld: 3 }, pierce: 99, proj: 'ball',
              desc: 'Bronzové dělo. Hradby a věže proti němu neobstojí.' },
};

const BUILDINGS = {
  tc:       { name: 'Sídlo', size: 3, hp: 2400, pop: 6, drop: true, atk: 6, range: 11, cd: 1.6, cost: null,
              desc: 'Srdce osady. Cvičí vesničany, přijímá suroviny a posouvá osadu do další epochy. Když padne, prohráváš.' },
  house:    { name: 'Dům', size: 2, hp: 500, time: 18, pop: 5, cost: { wood: 30 },
              desc: 'Ubytuje 5 lidí.' },
  store:    { name: 'Sklad', size: 2, hp: 600, time: 20, drop: true, cost: { wood: 50 },
              desc: 'Vesničané sem odnášejí suroviny. Postav ho blízko lesa nebo lomu, ať nechodí daleko.' },
  farm:     { name: 'Pole', size: 3, hp: 200, time: 14, req: ['agri'], cost: { wood: 30 },
              desc: 'Jeden rolník, úroda od jara do podzimu. V zimě pole nerodí.' },
  pasture:  { name: 'Pastvina', size: 3, hp: 300, time: 22, req: ['husbandry'], cost: { wood: 60 },
              desc: 'Dobytek dává trochu jídla celý rok, i v zimě. Nepotřebuje pracovníka.' },
  library:  { name: 'Knihovna', size: 2, hp: 600, time: 30, req: ['writing'], cost: { wood: 80, stone: 40 },
              desc: 'Vytváří vědění a zkoumá vědecké objevy. Počítají se nejvýš čtyři.' },
  smelter:  { name: 'Huť', size: 2, hp: 700, time: 28, req: ['bronze'], cost: { wood: 40, stone: 60 },
              desc: 'Sama taví rudu na kov: 2 rudy a trochu dřeva na 1 kov.' },
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
  tower:    { name: 'Věž', size: 1, hp: 900, time: 26, req: ['masonry'], atk: 8, range: 12, cd: 1.5, cost: { wood: 20, stone: 90 },
              desc: 'Kamenná strážní věž. Sama střílí na nepřátele v dosahu.' },
};
const BUILD_ORDER = ['house', 'store', 'farm', 'pasture', 'barracks', 'range', 'library', 'smelter', 'smithy', 'stable', 'workshop', 'tower'];

// era = nejnižší epocha, ve které jde technologii zkoumat; setsEra = postup do epochy
const TECHS = {
  agri:      { name: 'Zemědělství', era: 0, at: 'tc', cost: { know: 15 }, time: 20,
               desc: 'Lidé přestávají jen sbírat a začínají sít obilí. Odemyká Pole.' },
  pottery:   { name: 'Hrnčířství', era: 0, at: 'tc', cost: { know: 20 }, time: 20,
               desc: 'V pálených nádobách se zásoby nekazí. Spotřeba jídla −15 %.' },
  husbandry: { name: 'Chov dobytka', era: 0, at: 'tc', cost: { know: 25, food: 50 }, time: 25,
               desc: 'Ochočené ovce a kozy. Odemyká Pastvinu, která živí i v zimě.' },
  era1:      { name: 'Doba bronzová', era: 0, at: 'tc', setsEra: 1, req: ['agri'], cost: { know: 50, food: 150 }, time: 40,
               desc: 'Usedlý život a přebytky úrody uživí řemeslníky. Postup do další epochy.' },

  wheel:     { name: 'Kolo', era: 1, at: 'tc', cost: { know: 30, wood: 60 }, time: 25,
               desc: 'Dvoukolové káry. Vesničané unesou o polovinu víc a chodí rychleji.' },
  writing:   { name: 'Písmo', era: 1, at: 'tc', cost: { know: 35 }, time: 30,
               desc: 'Vědění se dá zapsat a předat dál. Odemyká Knihovnu, vědění +20 %.' },
  bronze:    { name: 'Hornictví a tavení', era: 1, at: 'tc', cost: { know: 40, wood: 50, stone: 50 }, time: 30,
               desc: 'Měď s cínem dá bronz. Vesničané mohou těžit rudu. Odemyká Huť, Kovárnu a Šermíře.' },
  masonry:   { name: 'Zdivo', era: 1, at: 'tc', cost: { know: 40, stone: 80 }, time: 30,
               desc: 'Opracovaný kámen spojený maltou. Odemyká Věž, budovy vydrží o čtvrtinu víc.' },
  horses:    { name: 'Chov koní', era: 1, at: 'tc', cost: { know: 40, food: 100 }, time: 30,
               desc: 'Kůň pod sedlem. Odemyká Stáj a Jezdce.' },
  btools:    { name: 'Kovové nástroje', era: 1, at: 'smithy', cost: { know: 30, metal: 30 }, time: 25,
               desc: 'Sekery, krumpáče a dláta z kovu. Těžba dřeva, kamene a rudy +20 %.' },
  bweap:     { name: 'Kovové hroty', era: 1, at: 'smithy', cost: { know: 35, metal: 40 }, time: 25,
               desc: 'Kopí a meče s litým ostřím. Útok pěchoty a jízdy +2.' },
  era2:      { name: 'Doba železná', era: 1, at: 'tc', setsEra: 2, req: ['bronze', 'writing'], cost: { know: 130, food: 300, metal: 60 }, time: 50,
               desc: 'Železná ruda je všude, jen ji umět vytavit. Postup do další epochy.' },

  iron:      { name: 'Zpracování železa', era: 2, at: 'smithy', cost: { know: 80, metal: 80 }, time: 35,
               desc: 'Kujné železo z dýmačky. Huť taví o polovinu rychleji, pěchota a jízda +2 útok a +1 zbroj.' },
  plow:      { name: 'Železný pluh', era: 2, at: 'tc', req: ['iron'], cost: { know: 70, metal: 40, wood: 60 }, time: 30,
               desc: 'Radlice obrací i těžkou půdu. Úroda polí +30 %.' },
  math:      { name: 'Matematika', era: 2, at: 'library', cost: { know: 90 }, time: 35,
               desc: 'Geometrie a počty. Vědění +25 %, základ pro mechaniku.' },
  mechanics: { name: 'Mechanika', era: 2, at: 'library', req: ['math'], cost: { know: 100, wood: 100 }, time: 40,
               desc: 'Páka, kladka a torzní pružina. Odemyká Dílnu a Katapult.' },
  era3:      { name: 'Středověk', era: 2, at: 'tc', setsEra: 3, req: ['iron', 'math'], cost: { know: 260, food: 500, metal: 150 }, time: 60,
               desc: 'Postup do další epochy.' },

  threefield:{ name: 'Trojpolní hospodaření', era: 3, at: 'tc', cost: { know: 120, food: 100 }, time: 35,
               desc: 'Ozim, jař a úhor se střídají, půda se nevyčerpá. Úroda polí +30 %.' },
  stirrups:  { name: 'Třmeny', era: 3, at: 'smithy', req: ['horses'], cost: { know: 110, metal: 60 }, time: 35,
               desc: 'Jezdec se v sedle opře a udrží kopí při nárazu. Spolu s ocelí odemyká Rytíře.' },
  steel:     { name: 'Ocel', era: 3, at: 'smithy', cost: { know: 160, metal: 150 }, time: 45,
               desc: 'Nauhličené a kalené železo. Pěchota a jízda +3 útok a +1 zbroj.' },
  crossbow:  { name: 'Kuše', era: 3, at: 'smithy', cost: { know: 120, wood: 100, metal: 50 }, time: 35,
               desc: 'Ocelový luk s napínákem. Odemyká Kušiníka.' },
  university:{ name: 'Univerzity', era: 3, at: 'library', cost: { know: 150, stone: 150 }, time: 45,
               desc: 'Učenci se sdružují a přou. Vědění +40 %.' },
  era4:      { name: 'Novověk', era: 3, at: 'tc', setsEra: 4, req: ['steel', 'university'], cost: { know: 500, food: 700, metal: 300 }, time: 70,
               desc: 'Postup do poslední epochy.' },

  gunpowder: { name: 'Střelný prach', era: 4, at: 'library', cost: { know: 250, metal: 100 }, time: 50,
               desc: 'Ledek, síra a dřevěné uhlí. Odemyká Mušketýra.' },
  artillery: { name: 'Dělostřelectví', era: 4, at: 'smithy', req: ['gunpowder'], cost: { know: 300, metal: 250 }, time: 55,
               desc: 'Lité hlavně a železné koule. Odemyká Dělo.' },
  printing:  { name: 'Knihtisk', era: 4, at: 'library', cost: { know: 200, wood: 150 }, time: 45,
               desc: 'Kniha za zlomek ceny opisu. Vědění +50 %.' },
  blast:     { name: 'Vysoká pec', era: 4, at: 'smithy', cost: { know: 200, stone: 200 }, time: 45,
               desc: 'Měchy hnané vodním kolem roztaví železo do tekuta. Huť taví dvakrát rychleji.' },
};

const NODE_DEF = {
  tree:  { name: 'Strom', res: 'wood', amt: 100, rate: 0.5 },
  bush:  { name: 'Keř s bobulemi', res: 'food', amt: 160, rate: 0.45 },
  stone: { name: 'Kamenný lom', res: 'stone', amt: 500, rate: 0.4 },
  ore:   { name: 'Ložisko rudy', res: 'ore', amt: 500, rate: 0.35, req: 'bronze' },
};
