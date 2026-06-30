from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Stop:
    name: str
    km: float
    lat: float
    lon: float
    kind: str = "stop"


@dataclass(frozen=True)
class SpeedLimit:
    start_km: float
    end_km: float
    speed_kmh: int
    note: str = ""


@dataclass(frozen=True)
class Route:
    id: str
    line: str
    name: str
    country: str
    stops: list[Stop]
    speed_limits: list[SpeedLimit]

    @property
    def length_km(self) -> float:
        if not self.stops:
            return 0.0
        return max(stop.km for stop in self.stops)

    def to_feature_collection(self) -> dict[str, Any]:
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [stop.lon, stop.lat]},
                    "properties": {
                        "name": stop.name,
                        "km": stop.km,
                        "kind": stop.kind,
                        "route_id": self.id,
                    },
                }
                for stop in self.stops
            ],
        }
