# Věk pokroku – verze hry

Hráč otevře `strategie/`, které ho přesměruje na naposledy vybrané vydání
(při první návštěvě na nejnovější). V úvodní nabídce je **Verze hry**.
Výběrem jiného čísla se načte jeho vlastní HTML a JavaScript, nejen jiné označení.
Tlačítko **Verze 1.0.1** v horní liště dovoluje změnu i během hraní.
Před přepnutím se hra proti počítači uloží; hru po síti přepnutí ukončí.

V nabídce jsou **1.0.1**, **1.0.2** a **1.1.0**. Nový hráč dostane nejnovější
vydání; dřívější volba se zachovává. Novinky jsou v [CHANGELOG.md](CHANGELOG.md).

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
node --test strategie/tests/gameplay.test.cjs
python strategie/tests/browser_smoke.py
python strategie/tests/economy_browser.py
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
