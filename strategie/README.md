# Věk pokroku – verze hry

Hráč otevře `strategie/`, které ho přesměruje na naposledy vybrané vydání
(při první návštěvě na nejnovější). V úvodní nabídce je **Verze hry**.
Výběrem jiného čísla se načte jeho vlastní HTML a JavaScript, nejen jiné označení.
Tlačítko **Verze hry** v horní liště dovoluje změnu i během hraní.
Před přepnutím se hra proti počítači uloží; hru po síti přepnutí ukončí.

V nabídce jsou **1.0.1**, **1.0.2**, **1.1.0**, **1.2.0**, **1.3.0**, **1.4.0**, **1.5.0**, **1.6.0**, **1.7.0**, **1.7.1**, **1.8.0**, **1.9.0**, **1.10.0**, **2.0.0**, **2.1.0** a **2.2.0**. Nový hráč dostane nejnovější
vydání; dřívější volba se zachovává. Novinky jsou v [CHANGELOG.md](CHANGELOG.md).

## Novinky ve 2.2.0 – Grafická renesance

Grafika má novou volitelnou procedurální vrstvu v modulu `renaissance.js`.
Pěší jednotky v blízkosti kamery dostávají model s oddělenými rameny,
nohama, hlavou, oblečením a vybavením; mají různé animace pro chůzi, práci,
boj, zranění a stání. Jezdci mají pohyblivé kopyto, ocas a plášť; vozy
a obléhací stroje pohyblivé doplňky. Dokončené stavby získávají detaily
fasád, okna, okenice, prapory, kouř, žár a viditelné poškození.

V panelu **Město → Grafická renesance** lze obě novinky zapnout či
vypnout, nastavení se pamatují v prohlížeči. Vzdálené objekty používají
původní úsporné modely, detailní modely mají horní limit počtu současně
zobrazených objektů. **Úsporná grafika** se i nadále hodí pro iPad;
pro největší vizuální rozdíl ručně nastav **Detailní**.

Toto vydání nemění žádnou herní ekonomiku, pohyb jednotek ani bojové
výpočty. Uložení, kampaň a spolupráce více hráčů z 2.1.0 zůstávají
zachované. Pokročilé animace jsou stylizované procedurální modely,
nikoli ručně modelované a pohybově snímané postavy.

## Novinky ve 2.1.0 – Spolu i proti sobě

Síťová hra umí **spolupráci proti počítači** (oba hráči jedna osada), přímé
spojení jde navázat **odkazem**, po výpadku ho jde **obnovit** z Menu a hostitel
může síťovou partii **uložit** a později v ní pokračovat.

## Novinky ve 2.0.0 – Kampaň

Na úvodní obrazovce je **Kampaň a odznaky**: šest misí od doby kamenné po
poslední bitvu, každá s vlastním nastavením a cílem, který hra sama vyhodnocuje
(modul `campaign.js`). Postup a 12 odznaků se pamatují v prohlížeči; na konci
každé partie je graf obyvatel a vojska.

## Novinky ve 1.10.0 – Nový vzhled

Čistě grafická aktualizace: pestřejší terén se svahy a mokrým pískem, tráva
a květiny, plnější stromy a oblé balvany s jemnými odstíny, vlnící se voda,
podrobnější postavy a nové modely všech neutrálních lokalit. Modul `look.js`
se kopíruje do vydání jako volitelný herní soubor. Úsporná kvalita zůstává lehká.

## Novinky ve 1.9.0 – Válka a obrana

Osm nových druhů vojáků (Zvěd, Prakovník, Sekerník, Pikenýr, Válečný vůz,
Jízdní lučištník, Dragoun, Beranidlo) a deset vojenských výzkumů. Vybraným
vojákům se dá nastavit postoj (útočný, obranný, držet pozici) a na mostech
jde stavět opevnění. Soupeř cvičí pestřejší vojsko, ustupuje a přepadá karavany.

## Novinky ve 1.8.0 – Živý svět

Neutrální lokality už nejsou jen jednorázová odměna. Obsadíš je jednotkami
(osady a tábor jen vojáky) nebo s osadou uzavřeš spojenectví v panelu **Svět (M)**.
Kdo lokalitu drží, dostává každou sezónu příjem a nad místem vlaje jeho vlajka.
Svět žije i sám: putující obchodník, uprchlíci a lapkové z ruin. Přibylo osm
výzkumů pro průzkum, hospodářství a diplomacii. Soupeř o lokality soutěží také.

## Novinky ve 1.7.1 – Soupeř na průzkumu

Počítačový soupeř posílá zvěda k nenavštíveným neutrálním lokalitám a bere
jejich odměny; podle obtížnosti začíná později nebo dřív a mezi místy odpočívá.
Typ mapy se vybírá tlačítky přímo na úvodní obrazovce. Nové vydání převezme
nejnovější kompatibilní místní uložení z kterékoli starší verze.

## Novinky ve 1.7.0 – Nový svět

Nová volitelná mapa **Říční údolí** má skutečné koryto řeky, které brání
pohybu jednotek, a **tři průchozí dřevěné mosty**. Voda ani mosty nejsou
pouze dekorace; hledání cest respektuje říční překážku. Suroviny jsou
obohacené na obou březích.

Na nově založené mapě je až **šest nezávislých neutrálních lokalit**
(osada, ruiny, hláska, lom, poutnický tábor, kovárna). V mapě se ukážou
až po prozkoumání území. Po první návštěvě jednotkou získá každý tým
jednorázovou odměnu. Neutrální místa **nemají autonomní obyvatele ani
diplomatický systém**. Panel **Svět (M)** ukazuje postup objevování,
odměny a umožní poslat průzkumníka do odhalené lokality.

Průzkum, jednorázové odměny a stav návštěv se ukládají a synchronizují.
Při převodu partie ze starší verze zůstávají původní budovy chráněné:
neutrální objekty se nepřidávají do již osídlené mapy. Všechna původní
herní pravidla fungují v klasickém i realistickém režimu.

## Novinky ve 1.6.0 – Atmosféra a svět

Verze doplňuje čistě **obrazové a zvukové efekty** bez zásahu do výroby,
boje či možností pohybu. Celá osada prochází každých 120 herních sekund
svítáním, dnem, soumrakem a nocí. Za soumraku se rozsvěcují lampy
u dokončených staveb; realistický režim má tmavší noc, klasický
zachovává snazší orientaci v mapě. Denní cyklus nijak nemění rychlost
technologií, práce nebo spotřeby.

V **Město → Atmosféra** lze přepnout trvale denní světlo, proměnlivou
oblačnost, částice počasí a kvalitu efektů. Automatická kvalita
snižuje počty částic po delším poklesu FPS. Přes tlačítko **Zvuk**
v horní liště nebo v Městě je možné ručně spustit syntetický ambientní
zvuk (vítr a ptáci). Hra nikdy nespouští zvuk bez výslovného kliknutí.
Hlasitost a vzhledové volby zůstávají místní pro daný prohlížeč; po síti
se synchronizuje herní čas, nikoli lokální zvukové preference.

Kompatibilní místní uložené partie z **1.5.0 až 1.1.0** je možné
převzít bez přepsání originálu. Samostatné archivované vydání 1.6.0
je v `versions/1.6.0/`.

## Novinky ve 1.5.0 – Hospodářství a život obyvatel

Hra má nově tlačítko **Ekonomika** (klávesa **K**) s bilancemi výroby a spotřeby
za posledních nejvýše 60 sekund. Výrobny (Mlýn, Pekárna, Huť) mají vlastní
výkonové priority, volitelný cíl vyrobené suroviny a lze jim nastavit
**rezervu vstupů**, kterou nesmějí spotřebovat. Sledované toky jsou
skutečné výrobní změny zásob; bez jednorázových stavebních nákladů a obchodu.
Přehled uvádí také předpokládanou spotřebu jídla na příští zimu při stávající
velikosti osady.

**Klasický režim** zachovává automatickou výrobu, řemeslníci nejsou povinní.
**Realistický režim** vyžaduje pro dokončený mlýn, pekárnu a huť volného
vesničana (přidělíš výběrem výrobny nebo tlačítkem Obsadit v Ekonomice;
automatika v Městě obsazuje pouze volné lidi). Účinnost závisí také na
vzdálenosti k nejbližšímu dokončenému Skladu nebo Sídlu. Není simulován
fyzický převoz surovin mezi budovami: stav zásob zůstává celoměstský.

Vesničané v realistickém režimu získávají zkušenost v jednotlivých
profesích (sběr, pole, stavba, řemeslo) na čtyřech úrovních a jejich
produktivita mírně roste. Všechny nové parametry se ukládají a sdílejí
po síti. Staré místní uložené partie **1.4.0–1.1.0** se mohou převzít
bez přepsání předchozího souboru.

## Novinky ve 1.4.0 – Živé město II

Cílem této aktualizace je vizuální čitelnost a příjemnější život v osadě bez
změn herní ekonomiky a rozdělení klasického/realistického režimu.

- **Detailnější 3D budovy**: dveře, okna, podpěry, komíny, dílny, nářadí,
  zásoby a skutečně odlišené typy staveb. Doplňky se rozvíjejí s epochami.
- **Výstavba v několika etapách**: základ, konstrukce, střecha a dokončení.
  Lešení se mění podle skutečného procenta rozestavěnosti a po dokončení zmizí.
  V panelu budovy se zobrazuje fáze výstavby a počet stavitelů.
- **Povolání stavitelů/opravářů**: u budovy lze jedním tlačítkem přiřadit až tři
  nejbližší nečinné vesničany. Již přidělené úkoly zůstávají nedotčeny.
- **Animovaní vesničané**: při chůzi, stavění, těžbě a práci na poli se pohybují
  paže, nástroje a viditelně se přenáší nasbíraný materiál.
- **Pohyblivý větrný mlýn**: při povolené výrobě a běžící hře se otáčí lopaty.
- **Drobná výbava osady**: ploty, bedny, sudy, povozy, dřevo, seno, květiny,
  ohniště, generované deterministicky do okolí hotových budov.
- **Upravené pěšiny**: trochu přirozenější odstín, výplň a barevná proměna
  podle epochy. Zůstávají čistě vizuální, neovlivňují průchodnost.
- **Grafika a výkon**: v panelu Město je výběr Automaticky / Úsporná /
  Detailní. Úsporný režim omezuje rozlišení vykreslování, stíny, detaily
  blízkých obyvatel a počet dekorací. Scenérie využívá sdružené geometrie
  a vykreslování instancí pro snížení počtu draw-callů.

V obou režimech je stejný nový vizuální základ. Realistický režim nadále
obsahuje spokojenost, materiálové opravy, chátrání a pochůzky obyvatel;
klasický režim nic z toho nepřidává. Výběr grafiky nemění pravidla hry.

**Uložení:** při první návštěvě lze vytvořit kopii platné místní uložené
hry 1.3.0 (případně 1.2.0 nebo 1.1.0). Originál staré verze se nemění.
Grafická výbava se odvozuje z herního stavu a nezvyšuje velikost uložení.

## Novinky ve 1.3.0 – Živé město

V horní liště otevři **Město** (na klávesnici také **C**).
Zde vidíš pracovní rozdělení vesničanů a stav budov. Automatiku práce lze
zapnout a vypnout; nikdy nepřepisuje ručně zadané příkazy. Pro jídlo, dřevo,
kámen, rudu a zlato nastavíš priority 0–3. Automatika přiděluje práci
jen volným vesničanům, dostupným surovinám a dokončeným polím.
Při nedostatku zásob mění skutečné pořadí práce podle potřeb osady.

Vizuální **pěšiny** propojují sídlo s dokončenými přístupnými budovami.
Nespotřebovávají suroviny, nemění průchodnost terénu a nepřidávají bonus pohybu.

| Mechanika | Klasický režim | Realistický režim |
| --- | --- | --- |
| Přehled práce, priority a volitelná automatika | Ano | Ano |
| Vizuální pěšiny | Ano | Ano |
| Ruční opravy poškozených budov | Bez materiálů | Spotřebují dřevo, u hradeb/věží kámen |
| Automatické opravy | Nejsou potřeba (stavby samy nechátrají) | Zapínatelné, pokud jsou volní lidé a materiál |
| Přirozené opotřebení budov | Ne | Ano, nezničí stavbu samo |
| Spokojenost obyvatel a vliv na práci | Ne | Ano |
| Volné pochůzky nečinných obyvatel | Ne | Ano |

Spokojenost se postupně mění podle hladovění, zásob, zranění, stavu budov
a pohrom. Ve skutečné ekonomice má mírný vliv na výtěžnost těžby a polí.

**Uložení:** pokud prohlížeč nemá uloženou partii 1.3.0, může na první
návštěvě vytvořit kopii platného místního uložení z 1.2.0 nebo 1.1.0.
Starší soubory zůstanou na původních místech. Mezi verzemi nejsou sdílené
síťové partie ani ukládání přes službu Claude.

## Novinky ve 1.2.0

- **Menu** během partie umožňuje pokračovat nebo uložit a vrátit se
  do úvodní nabídky. Odpojení ze síťové hry ukládání nepodporuje.
- **Nápověda** je přístupná tlačítkem v liště i klávesou F1. V sólo
  hře se při čtení simulace pozastaví.
- **Přechod z 1.1.0:** není-li v prohlížeči uložená hra 1.2.0,
  při první návštěvě vznikne kopie platného místního uložení 1.1.0.
  Originál zůstane beze změny a ostatní verze mají oddělená uložení.
- Neúplná uložení se před načtením odmítnou; import má limit 5 MB.

## Jak využít nové hospodářství v 1.1.0

- **Soběstačná osada:** přímé jídlo ze zeleninových polí a pastvin. Lesovna
  u vytěženého lesa obnovuje stromy, které dál musí zpracovat vesničané.
- **Potravinová výroba:** přepni dokončené pole na obilí. Mlýn mele mouku,
  Pekárna ji s dřevem mění na jídlo (1 mouka + 0,2 dřeva → 2 jídla).
  Než se rozběhne řetězec, zachovej přímý zdroj jídla. V zimě pole stojí,
  ale Mlýn a Pekárna mohou zpracovávat uložené zásoby.
- **Obchod:** dvě vlastní Tržiště alespoň 24 metrů od sebe, průchodná cesta
  a Karavana. Delší trasa přinese více zlata za jednu cestu, ale trvá déle
  a musí se chránit. Nová Karavana hledá trasu sama; jinou zvolíš kliknutím
  na cílové Tržiště nebo příkazem Obnovit obchodní trasu.

## Publikování na GitHub Pages

Repozitář má GitHub Pages nastavené na větev
`claude/realistic-3d-strategy-ynyqjy`, kořenovou složku. Push do této větve
spouští existující GitHub workflow **pages build and deployment**. Toto nastavení
se zachovává. Před pushem spusť níže uvedené testy a přidej nové vydání i katalog
do stejného commitu. Kořenový `index.html` otevře hru ve `strategie/` a soubor
`.nojekyll` zachovává statické soubory bez zpracování Jekyllem.

Veřejná adresa hry: **https://gonza11125.github.io/vlaky/**.
Úspěšné nasazení se ověřuje v GitHub Actions pro odpovídající commit.

Webový balík lze připravit i samostatně:

```sh
python strategie/tools/build_site.py --output /tmp/vek-site
```

Cílová složka musí být prázdná. Balík obsahuje všechna vydání a výběr verzí,
neobsahuje pracovní zdroje, testy, nástroje ani jiné části repozitáře.
Soubor `release-info.json` v sestaveném balíku uvádí zahrnutá vydání.

## Spuštění a vývoj

Z kořene repozitáře spusť:

```sh
python -m http.server 8000 --bind 0.0.0.0
```

Hra je na cestě `/strategie/`. Pracovní zdroje jsou herní soubory `.js` přímo
ve `strategie/` a `strategie/play.html`. Cesta `/strategie/play.html` spouští
vývojovou verzi s vlastním uložením, aby vývoj nepřepisoval hráčova vydání.
Není potřeba sestavení ani instalace balíčků. Three.js **0.128.0** se načítá
z `cdn.jsdelivr.net`; Google Fonts jsou volitelné, hra má náhradní systémová písma.

## Přidání dalšího vydání

1. Uprav a vyzkoušej pracovní zdroje, nikoli vydané složky.
2. Z kořene repozitáře vytvoř další vydání:

   ```sh
   python strategie/tools/release.py --description "Popis novinek pro hráče."
   ```

   Nástroj automaticky zvýší poslední číslo, například z `1.0.1` na `1.0.2`.
   Větší vydání lze zadat výslovně:

   ```sh
   python strategie/tools/release.py 1.1.0 --description "Popis větší aktualizace."
   ```

3. Vyzkoušej nové vydání přes herní nabídku a přidej `versions.js` i novou
   složku `versions/<číslo>/` do stejného commitu a nasazení.

Nástroj kopíruje celé HTML a všech pět herních skriptů do samostatné složky.
Odmítne stejné či nižší číslo i přepsání existující složky. Vydání se nepřepisují:
oprava se vydává s vyšším číslem. Pokud hra získá další soubory, doplň je do
`GAME_FILES` a kopírování v `tools/release.py`. Sdílené `version-picker.js`,
`version-picker.css` a `versions.js` poskytují pouze výběr a identitu vydání;
musí zůstat zpětně kompatibilní se zveřejněnými verzemi.

## Uložené hry a síť

Každé vydání má vlastní místní uložení, cloudový dokument i místní síťovou lobby.
Verze **1.0.1** zachovává původní klíč `vek-pokroku-save-1` a cloudový dokument
`save`, takže načte i dřívější hry bez čísla verze. Exportované soubory obsahují
číslo vydání; import z jiného vydání doporučí přepnutí a nepřepíše aktuální hru.
Původní ukládání přes účet Claude stále vyžaduje běh v jeho podporovaném prostředí.
Síťové zprávy kontrolují číslo vydání; soupeři musí mít stejnou verzi.

Volba hráče se pamatuje v tomto prohlížeči. Bez přístupu k místnímu úložišti
výběr dál funguje, jen se po návratu na hlavní adresu použije nejnovější vydání.

## Kontroly

```sh
python -m unittest discover -s strategie/tests -p 'test_*.py'
node --test strategie/tests/*.test.cjs
python strategie/tests/browser_smoke.py
python strategie/tests/economy_browser.py
# Na GitHub Actions se při změnách spouští také testy Node.js a Pythonu.
```

První příkaz používá pouze standardní Python, druhý vestavěný testovací systém
Node.js. Prohlížečové testy vyžadují Python Playwright a Chromium. Vytvářejí
dočasnou kopii hry, server a případná zkušební vydání; do skutečného seznamu
žádnou falešnou verzi nepřidávají.
Ověřuje spuštění hry, přepínání tam i zpět, uložení, import, zapamatování volby
a ovládání na úzkém displeji. Three.js stáhne pro test z oficiálního npm balíčku
přes HTTPS a ověří jeho integritu podle metadat registru.
Ekonomický test navíc ověřuje výrobu, lesnictví, náklad karavan při uložení,
chování soupeře a skutečné spojení dvou hráčů přes BroadcastChannel. Přímé
WebRTC spojení mezi různými zařízeními zůstává závislé na síti obou hráčů.
