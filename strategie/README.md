# Věk pokroku – verze hry

Hráč otevře `strategie/`, které ho přesměruje na naposledy vybrané vydání
(při první návštěvě na nejnovější). V úvodní nabídce je **Verze hry**.
Výběrem jiného čísla se načte jeho vlastní HTML a JavaScript, nejen jiné označení.
Tlačítko **Verze hry** v horní liště dovoluje změnu i během hraní.
Před přepnutím se hra proti počítači uloží; hru po síti přepnutí ukončí.

V nabídce jsou **1.0.1**, **1.0.2**, **1.1.0**, **1.2.0** a **1.3.0**. Nový hráč dostane nejnovější
vydání; dřívější volba se zachovává. Novinky jsou v [CHANGELOG.md](CHANGELOG.md).

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

Hra je na cestě `/strategie/`. Pracovní zdroje jsou pět souborů `.js` přímo
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
