# Věk pokroku – verze hry

Hráč otevře `strategie/`, které ho přesměruje na naposledy vybrané vydání
(při první návštěvě na nejnovější). V úvodní nabídce je **Verze hry**.
Výběrem jiného čísla se načte jeho vlastní HTML a JavaScript, nejen jiné označení.
Tlačítko **Verze 1.0.1** v horní liště dovoluje změnu i během hraní.
Před přepnutím se hra proti počítači uloží; hru po síti přepnutí ukončí.

První vydání je **1.0.1**. Další verze se objeví v nabídce až po svém vydání.

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
python strategie/tests/browser_smoke.py
```

První příkaz používá pouze standardní Python. Pro druhý je potřeba Python
Playwright a Chromium. Prohlížečový test si vytvoří dočasnou kopii hry, server
a zkušební vydání **1.0.2**; do skutečného seznamu žádnou falešnou verzi nepřidává.
Ověřuje spuštění hry, přepínání tam i zpět, uložení, import, zapamatování volby
a ovládání na úzkém displeji. Three.js stáhne pro test z oficiálního npm balíčku
přes HTTPS a ověří jeho integritu podle metadat registru.
