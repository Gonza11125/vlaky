# Vydání Věku pokroku

## 1.7.1 – Soupeř na průzkumu

- **Počítačový soupeř zkoumá svět:** posílá jednoho zvěda (nejraději jezdce, jinak lehkého vojáka, ve větší osadě i vesničana) k nenavštíveným neutrálním lokalitám a sbírá jejich odměny. Začíná podle obtížnosti po 4, 3 nebo necelých 2 minutách a mezi místy odpočívá, takže hráč má šanci být první. Místa u hráčova Sídla nechává na konec.
- **Volba mapy hned na úvodní obrazovce:** Vyvážená, Lesnatá, Hornatá a Říční údolí s mosty jako tlačítka s krátkým popisem; zbytek pravidel zůstává v sekci Mapa a pravidla partie.
- **Převzetí uložené hry:** nové vydání převezme nejnovější kompatibilní místní uložení z kterékoli starší verze (od 1.1.0), originál zůstává beze změny.
- Nový test průzkumu soupeře.

## 1.7.0 – Nový svět

- **Říční údolí:** nový volitelný typ mapy, deterministické koryto řeky a tři dřevěné mosty. Řeka skutečně blokuje cestu; mosty jsou průchozí a vyznačené v minimapě. Na mostech nelze stavět budovy.
- **Bohatší oblasti surovin:** na obou březích řeky jsou rozšířené shluky kamene, rudy a keřů; počáteční osady zůstávají se spravedlivými zdroji.
- **Neutrální lokality:** až šest míst na každé nově založené mapě (neutrální osada, staré ruiny, hláska, lom, tábor a opuštěná kovárna). Každé místo je nejdřív skryté mlhou války.
- **Skutečný průzkum:** odměna připadá hráči až po příchodu jeho jednotky, nejvýš jednou na místo a tým. Odměny zahrnují jídlo, dřevo, kámen, zlato, vědění a kov. Nejde o automatickou odměnu za pouhé objevení.
- **Svět (klávesa M):** nový panel objevených lokalit, průběh průzkumu, odměny, tlačítka Ukázat na mapě a Vyslat jednotku. Neobjevená místa neprozrazují souřadnice.
- **Zobrazení a 3D:** konstrukce dřevěných mostů, opuštěné domy, zříceniny, tábory a další drobné modely. V minimapě se po odkrytí zobrazí značky lokalit.
- **Multiplayer a uložení:** hostitel počítá odměny, stav návštěv se synchronizuje a ukládá. Po převodu starší uložené partie se nové lokality nevkládají mezi existující budovy; plnou mapu 1.7.0 získáš při založení nové partie.
- **Testy:** determinismus generování, dosažitelnost mostů, jednorázovost odměn, mlha války, ukládání a prohlížečové testy v obou režimech.

## 1.6.0 – Atmosféra a svět

- **Denní cyklus:** skutečné střídání svítání, dne, soumraku a noci po 120 herních sekundách. Mění se barva oblohy a mlhy, slunce a celkové osvětlení; vypínatelné v Městě.
- **Světla osady:** za tmy svítí okna a lampy u dokončených domů, tržišť, dílen a dalších budov. Světla jsou dekorativní a nepřekreslují průchodnost ani simulaci.
- **Proměnlivá oblačnost:** jemná změna množství přímého světla, samostatný přepínač.
- **Déšť a sníh:** částice realistického počasí používají vítr a nastavitelnou hustotu; herní záplavy a roční období se řídí původní simulací.
- **Volitelný syntetický zvuk:** vítr a denní ptactvo přes Web Audio; zapíná se až kliknutím na tlačítko Zvuk, nikdy automaticky. Nastavení hlasitosti.
- **Výkon:** automatické snížení počtu částic při poklesu FPS, 280 částic v úsporném a až 1 600 v detailním režimu, limit dekorativních lamp 18/70. Jen grafické efekty.
- **Režimy:** obě varianty mají den, noc a lampy; realistická varianta má výraznější tmu a zachované nebezpečné počasí, klasická zůstává čitelnější.
- **Ukládání:** kopie kompatibilních místních uložených partií 1.5.0–1.1.0; původní verze zůstávají neměnné. Atmosférická nastavení jsou místní prohlížečové preference, synchronizace hry je nepotřebuje.
- Nové testy osvětlení, výkonu, nastavení a prohlížečového rozhraní.

## 1.5.0 – Hospodářství a život obyvatel

- **Ekonomika (K)**: přehled zásob a skutečných toků surovin za posledních až 60 sekund, výhled spotřeby jídla na zimu a seznam výroben.
- **Společné recepty výroby**: Mlýn (obilí → mouka), Pekárna (mouka + dřevo → jídlo) a Huť (ruda + dřevo → kov); jejich činnost, využití surovin a záznamy jsou sjednocené.
- **Řízení každé výrobny**: výkon vypnutý/nízký/běžný/vysoký, limit cílových zásob a možnost pozastavení včetně hutě.
- **Rezervy dřeva, rudy, obilí a mouky**: výroba nedojde pod nastavené minimum. Výroba neprodukuje záporné zásoby.
- **Klasický režim**: výrobny pracují bez nutnosti přidělovat pracovníka; prioritami a cíli lze provoz dál řídit.
- **Realistický režim**: Mlýn, Pekárna a Huť vyžadují řemeslníka, kterého lze manuálně přiřadit nebo při zapnuté automatice přivolat z nečinných vesničanů. Blízkost dokončeného Skladu/Sídla ovlivňuje výrobní efektivitu (nikoli fyzickou dopravu zboží).
- **Zkušenosti vesničanů**: sběr, zemědělství, stavění a řemeslo mají čtyři úrovně; v realistickém režimu mírně zvyšují výkonnost. Povolání i zkušenosti se ukládají.
- **Synchronizace a kompatibilita**: síťově se předávají průběh práce, nastavení výroben, zkušenosti a ekonomická historie; uložené hry z 1.4.0 až 1.1.0 se místně převezmou bez změny původní kopie.
- Nové jednotkové a prohlížečové testy; starší vydání zůstávají samostatná.

## 1.4.0 – Živé město II

- Nové stavební detaily a vizuální změny staveb v pokročilejších epochách.
- Animované nástroje, pohyb paží, nesené suroviny a větrný mlýn.
- Skutečný grafický postup výstavby: lešení, stavební fáze a panel budovy.
- Tlačítko k přivolání až tří nečinných stavitelů nebo opravářů.
- Dekorace kolem budov (ploty, vozy, seno, dřevo, sudy, ohniště) v instancích.
- Vylepšené pěšiny a barevné varianty podle epochy.
- Tři volby kvality vykreslování a úspornější grafika na dotykových zařízeních.
- Původní ekonomika, klasický a realistický režim a síťová logika zachovány.
- Migrace uložených her 1.3.0/1.2.0/1.1.0 a automatické testy v Chromiu.

## 1.3.0 – Živé město (klasický a realistický režim)

- V obou režimech panel Město, přehled práce a stav budov.
- Volitelná automatika nečinných vesničanů s prioritami pěti surovin.
- Vizuální pěšiny mezi sídlem a budovami bez vlivu na průchodnost.
- Jen realisticky: procházky volných obyvatel, spokojenost,
  mírný dopad spokojenosti na produktivitu, přirozené opotřebení
  a materiálově nákladné opravy.
- Zachování ručních rozkazů, synchronizace městské správy po síti.
- Kopie platných místních uložených her 1.2.0/1.1.0 do nové verze.
- Nové testy městské správy, oprav a vizuálních cest.

## 1.2.0 – Ovládání a ochrana uložených partií

- Herní nabídka s návratem do hry nebo bezpečným návratem k nové partii.
- Nápověda během hraní (tlačítko, F1) a automatická pauza pro sólo partii.
- Převzetí platné místní uložené partie z 1.1.0 při první návštěvě 1.2.0;
  původní uložená hra zůstává zachovaná.
- Kontrola struktury uložení a limit 5 MB pro importovaný soubor.

## 1.1.0 – Hospodářství a obchodní cesty

- Pole lze přepínat mezi zeleninou (přímé jídlo) a obilím.
- Mlýn z obilí vyrábí mouku; nová Pekárna z mouky a dřeva vyrábí jídlo i v zimě.
- Výrobu v Mlýně, Pekárně a Lesovně lze pozastavit a znovu spustit.
- Lesovna obnovuje vytěžené stromy v okolí, nevyrábí dřevo přímo do zásob.
- Karavany jezdí mezi dvěma vlastními propojenými Tržišti alespoň 24 metrů od sebe.
  Zlato získají po návratu; zbořená nebo zablokovaná trasa výdělek zastaví.
- Počítačový soupeř používá obilná pole, pečení, obnovu lesa i karavany.
- Uložení zachovává plodiny, přerušenou výrobu, obnovu lesa a rozpracované obchodní cesty.
- Síťová hra synchronizuje nové zásoby, výrobní příkazy, karavany a obnovu stromů.
- Mobilní lišta zásob zobrazuje také obilí a mouku.

## 1.0.2 – Vlastní partie

- Vyvážené, lesnaté a hornaté mapy; volitelné číslo mapy pro opakované hraní.
- Tři úrovně surovin v krajině a počátečních zásob pro obě strany.
- Dobytí, přežití 3/5/10 let nebo rozvoj: doba železná, 20 lidí, 300 jídla a 100 zlata.
- Ochrana obou stran před útoky na 0/2/5/10 herních minut; lov zůstává dostupný.
- Ve hře po síti přežití obou osad do časového limitu znamená remízu.
- Přehled cíle během hry a závěrečné výsledky s výrobou a ztrátami.
- Pravidla jsou součástí uložení i počátečního stavu síťové hry.

## 1.0.1 – Původní hra

Původní hratelnost, nyní dostupná jako samostatné vydání ve výběru verzí.
