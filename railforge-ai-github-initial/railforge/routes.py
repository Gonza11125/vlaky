from __future__ import annotations

import json
from importlib.resources import files

from .models import Route, SpeedLimit, Stop

ALIASES = {
    "175": "cz_175_p21",
    "p21": "cz_175_p21",
    "cz_175_p21": "cz_175_p21",
}


def normalize_route_id(route_id: str) -> str:
    key = route_id.strip().lower()
    if key not in ALIASES:
        raise KeyError(f"Unknown route '{route_id}'. Available aliases: {', '.join(sorted(ALIASES))}")
    return ALIASES[key]


def load_route(route_id: str) -> Route:
    normalized = normalize_route_id(route_id)
    path = files("railforge.data.routes").joinpath(f"{normalized}.json")
    data = json.loads(path.read_text(encoding="utf-8"))
    return Route(
        id=data["id"],
        line=str(data["line"]),
        name=data["name"],
        country=data.get("country", "CZ"),
        stops=[Stop(**item) for item in data["stops"]],
        speed_limits=[SpeedLimit(**item) for item in data["speed_limits"]],
    )
