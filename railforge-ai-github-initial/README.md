# RailForge AI

RailForge AI je startovní generátor železničních tratí pro Trainz/TransDEM.

První testovací trať je **CZ 175 / P21 Rokycany–Nezvěstice**.

## Cíl

Z veřejných geografických a železničních dat postupně vytvářet:

- osu tratě,
- zastávky,
- rychlostní profil,
- GeoJSON/GPX/KML/CSV výstupy,
- stavební plán pro Trainz editor,
- později OSM/DEM/Trainz export.

## Instalace pro vývoj

```bash
python -m pip install -e .[dev]
```

## Použití

```bash
railforge generate 175
```

Výstupy se vytvoří ve složce `output/cz_175_p21/`.

## Aktuální stav

- CLI `railforge`,
- aliasy `175`, `p21`, `cz_175_p21`,
- data všech zastávek trati 175,
- rychlostní profil,
- export GeoJSON, GPX, KML, CSV a Markdown,
- základní testy,
- GitHub Actions.

## Roadmapa

1. Railway Engine – kilometráž objektů.
2. OSM provider – Overpass API.
3. DEM/terrain engine.
4. Trainz build plan.
5. TransDEM workflow.
6. První reálný import do Trainzu.
