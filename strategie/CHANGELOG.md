# Vydání Věku pokroku

## 2.2.0 – Grafická renesance

- **Nové detailní 3D postavy:** procedurálně sestavená kostra pěšáků a vesničanů (trup, krk a hlava, účes, pokrývky, oči, ruce, boty, opasek, plášť, barevné lemy podle hráče). Jednotlivé části se pohybují samostatně; kvalitnější model se zapíná pouze poblíž kamery.
- **Pracovní a bojové animace:** chůze s protichůdným pohybem paží a nohou, přirozené drobné pohyby při stání, údery kladivem, seky, práce na poli, řemeslné pohyby, útok a reakce na zásah; zůstanou i krátkodobá těla padlých.
- **Profese a vybavení:** nástroje vesničanů podle právě vykonávaného úkolu (kladivo, sekera, srp), bojové zbraně podle typu jednotky (luk, mušketová hlaveň, kopí, meč/sekera), přilba a štít u vybraných vojáků. Jde o vizuální vrstvu, vybavení nemění statistiky.
- **Jezdci a vozy:** animovaný ocas koně, kopyta a plášť jezdce; pohybující se detaily kol a praporky u vozů a obléhacích strojů.
- **Detailní fasády:** dodatečná architektura obytných a pracovních budov podle epochy: sokly, dveře, prosklená okna, okenice, okapy, střešní prvky, komíny, prapory a vybavení trhu. Změny denního světla, kouř, žár pece a jednoduché trhliny po poškození.
- **Výkon a ovládání:** zapínání nové grafiky a animací v Město → Grafická renesance; automatický LOD podle vzdálenosti, limity počtu detailních postav a fasád, sdílené geometrie i materiály. Úsporná kvalita používá původní jednoduché modely, i na iPadu.
- **Kompatibilita:** beze změny herních pravidel, map, herních příkazů, uložených partií a multiplayeru. Nové volby grafiky se ukládají pouze lokálně. Samostatné vydání má vlastní soubory, starší verze zůstávají dostupné.
- **Testy:** animace, grafická nastavení, životní cyklus objektů, zátěžové limity, obě herní varianty a mobilní rozložení v Chromiu.

## 2.1.0 – Spolu i proti sobě

- **Spolupráce proti počítači:** při zakládání síťové hry jde vybrat „Spolu proti počítači“. Oba hráči ovládají jednu modrou osadu, počítač hraje za červené podle zvolené obtížnosti a agrese. Zprávy a varování dostávají oba.
- **Pozvánka odkazem:** u přímého spojení stačí poslat odkaz; soupeřovi se po otevření sama připraví odpověď, kterou pošle zpátky.
- **Obnovení spojení:** když přímé spojení spadne, v Menu je tlačítko Obnovit spojení se soupeřem. Hra běží dál a po novém propojení dostane soupeř celý aktuální stav.
- **Uložení síťové partie:** kdo hru založil, ji uloží (tlačítko Uložit nebo Menu) a později v ní se soupeřem pokračuje tlačítkem Pokračovat v uložené síťové partii.
- Testy spolupráce; síťový průběh ověřen ve dvou prohlížečích (odkaz, výpadek, obnovení, pokračování).

## 2.0.0 – Kampaň

- **Kampaň o šesti misích:** Pazourek a oheň (přečkej první zimu), Věk bronzu (doba bronzová do 14 minut), Mosty přes řeku (drž 3 lokality), Obrana údolí (vydrž 10 minut proti útočnému soupeři), Hedvábná stezka (250 zlata z karavan) a Poslední bitva (dobytí na těžkou). Každá mise má vlastní mapu, soupeře a ochranu; další se odemkne po splnění předchozí. Pamatuje se nejlepší čas.
- **Cíl a postup mise** v horní liště, na konci tlačítka Další mise a Zkusit znovu.
- **12 odznaků** za úspěchy ve všech partiích (první vítězství, vítězství na těžkou, doba železná, novověk, velká osada, stálá armáda, vojevůdce, kupec, diplomat, pán údolí, ochránce, kronikář). Přehled na úvodní obrazovce, nové odznaky na konci partie.
- **Graf průběhu partie** na konci hry: obyvatelé a vojsko tvoje i soupeřovo v čase. Průběh se ukládá s partií.
- Postup kampaně a odznaky jsou společné pro všechna vydání od 2.0 v tomto prohlížeči. Nový modul `campaign.js`, testy misí a odznaků.

## 1.10.0 – Nový vzhled

- **Krajina:** velké skvrny světlejší a sušší louky, kamenité svahy podle sklonu, mokrý písek u vody a tmavší hlubiny; jemná textura trávy v obou režimech.
- **Tráva a květiny:** tisíce trsů trávy a lučních květin (bílé, žluté, fialové, červené, modré); mizí pod stavbami, poli a v neprozkoumaném území.
- **Stromy a kameny:** smrky z pěti pater, listnáče s větvemi a několika oblými korunami, oblé balvany s mechem; každý strom a kámen má trochu jiný odstín.
- **Voda:** tmavší, lesklejší hladina s pohyblivými vlnkami.
- **Postavy:** pásek, boty a krk u všech lidí a vojáků.
- **Neutrální lokality:** nové podrobné modely: ves s doškovými střechami, studnou a stohem, ruiny se sloupy a padlým kladím, dřevěná strážní věž se střechou a žebříkem, lom s jeřábem a vozíkem, tábor se stany a ohništěm, kovárna s komínem, kovadlinou a sudy.
- **Realistický režim:** nižší expozice, barvy už nejsou vybledlé.
- **Výkon:** oblé tvary z málo ploch; úsporná kvalita (výchozí na telefonech) kreslí původní jednoduché stromy a méně trávy. Pravidla hry, uložení ani síť se nemění.

## 1.9.0 – Válka a obrana

- **8 nových druhů vojáků:** Zvěd (rychlý průzkumník ze Sídla, vidí daleko), Prakovník (levný střelec doby kamenné), Sekerník (dvojnásobné poškození budov), Pikenýr (trojnásobek proti jízdě), Válečný vůz (rozjede střelce), Jízdní lučištník, Dragoun (karabina ze sedla) a Beranidlo (brány a hradby, šípy se od něj odrážejí). Všichni mají vlastní 3D model.
- **10 vojenských výzkumů:** Pletené štíty, Skládaný luk, Kroužková zbroj, Opeřené šípy, Opevňování (hradby a věže +40 % životů, věže dostřel +2), Píky, Rytířství (jízda +20 % životů), Odvody (výcvik −25 %), Balistika a Stálé vojsko (vojsko jí o 30 % méně).
- **Postoje jednotek:** útočný, obranný (krátká honička a návrat) a držet pozici (voják se nehne). Postoj se ukládá.
- **Opevněné mosty:** na říčních mostech jde postavit palisádu, hradbu, bránu nebo věž.
- **Chytřejší soupeř:** cvičí pestřejší vojsko včetně nových jednotek, zkoumá vojenské technologie, ustoupí, když útok vázne, lehkou jízdou přepadá karavany a cvičí si zvěda.
- Nové testy jednotek, výzkumů, mostů a postojů.

## 1.8.0 – Živý svět

- **Lokality, které jde držet:** navštívenou lokalitu obsadíš, když u ní tvoje jednotky vydrží 9 s bez soupeře; osadu a poutnický tábor jen vojáci (16 s). Když jsou u místa oba, nikdo nepostupuje. Držitel dostává každou sezónu příjem: osada jídlo a dřevo, tábor jídlo a dřevo, lom kámen, kovárna kov, ruiny vědění, hláska zlato a daleký výhled. Nad drženou lokalitou vlaje vlajka v barvě týmu a minimapa ji obarví.
- **Spojenectví s osadami:** v panelu Svět (M) se dá s navštívenou osadou nebo táborem uzavřít spojenectví za zlato a jídlo; soupeřovo spojenectví jde přeplatit za dvojnásobek.
- **Události ve světě:** putující obchodník s nabídkou na 75 sekund, uprchlíci, kteří se přidají k osadě, a lapkové z ruin. Lapky odrazí aspoň 3 vojáci (plus jeden za každou epochu) nebo věže u Sídla, jinak vyplení 12 % jídla, dřeva a zlata.
- **8 nových výzkumů:** Stopaři (dohled +2), Rybářské sítě a Lovecké pasti (+30 %), Kartografie (odhalí lokality), Diplomacie (levnější spojenectví, vyšší příjem), Dlážděné cesty (rychlost +8 %), Cechy (výroba +25 %) a Bankovnictví (zlato z tržišť +60 %).
- **Soupeř:** obsazuje lokality zvědem nebo vojákem, kupuje spojenectví, přijímá výhodné nabídky obchodníka a zkoumá nové technologie.
- **Síť a uložení:** držení, postup obsazování a události se ukládají i synchronizují; starší vydání nový formát bezpečně přeskočí.
- Nové testy obsazování, spojenectví, příjmu a ukládání.

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
