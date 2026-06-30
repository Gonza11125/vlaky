from __future__ import annotations

import csv
import json
from pathlib import Path
from xml.sax.saxutils import escape

from railforge.models import Route


def export_route(route: Route, output_dir: Path) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    files = [
        _write_geojson(route, output_dir / "stops.geojson"),
        _write_gpx(route, output_dir / "route.gpx"),
        _write_kml(route, output_dir / "route.kml"),
        _write_stops_csv(route, output_dir / "stops.csv"),
        _write_speed_csv(route, output_dir / "speed_limits.csv"),
        _write_report(route, output_dir / "report.md"),
    ]
    return files


def _write_geojson(route: Route, path: Path) -> Path:
    path.write_text(json.dumps(route.to_feature_collection(), ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def _write_gpx(route: Route, path: Path) -> Path:
    waypoints = "\n".join(
        f'  <wpt lat="{stop.lat}" lon="{stop.lon}"><name>{escape(stop.name)}</name><desc>km {stop.km:.3f}</desc></wpt>'
        for stop in route.stops
    )
    trkpts = "\n".join(f'      <trkpt lat="{stop.lat}" lon="{stop.lon}" />' for stop in route.stops)
    path.write_text(
        f'''<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RailForge AI" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>{escape(route.name)}</name></metadata>
{waypoints}
  <trk><name>{escape(route.name)}</name><trkseg>
{trkpts}
  </trkseg></trk>
</gpx>
''',
        encoding="utf-8",
    )
    return path


def _write_kml(route: Route, path: Path) -> Path:
    placemarks = "\n".join(
        f'''    <Placemark><name>{escape(stop.name)}</name><description>km {stop.km:.3f}</description><Point><coordinates>{stop.lon},{stop.lat},0</coordinates></Point></Placemark>'''
        for stop in route.stops
    )
    coords = " ".join(f"{stop.lon},{stop.lat},0" for stop in route.stops)
    path.write_text(
        f'''<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>{escape(route.name)}</name>
{placemarks}
    <Placemark><name>Route centerline draft</name><LineString><coordinates>{coords}</coordinates></LineString></Placemark>
  </Document>
</kml>
''',
        encoding="utf-8",
    )
    return path


def _write_stops_csv(route: Route, path: Path) -> Path:
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(["name", "km", "lat", "lon", "kind"])
        for stop in route.stops:
            writer.writerow([stop.name, f"{stop.km:.3f}", stop.lat, stop.lon, stop.kind])
    return path


def _write_speed_csv(route: Route, path: Path) -> Path:
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(["start_km", "end_km", "speed_kmh", "note"])
        for speed in route.speed_limits:
            writer.writerow([f"{speed.start_km:.3f}", f"{speed.end_km:.3f}", speed.speed_kmh, speed.note])
    return path


def _write_report(route: Route, path: Path) -> Path:
    stops = "\n".join(f"- km {stop.km:.3f}: {stop.name} ({stop.kind})" for stop in route.stops)
    speeds = "\n".join(
        f"- km {item.start_km:.3f}–{item.end_km:.3f}: {item.speed_kmh} km/h" for item in route.speed_limits
    )
    path.write_text(
        f"# {route.name}\n\nTrať: {route.line}\n\nDélka podle zastávek: {route.length_km:.3f} km\n\n## Zastávky\n\n{stops}\n\n## Rychlostní profil\n\n{speeds}\n",
        encoding="utf-8",
    )
    return path
