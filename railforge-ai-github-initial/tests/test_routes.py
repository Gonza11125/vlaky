from railforge.routes import load_route, normalize_route_id


def test_aliases():
    assert normalize_route_id("175") == "cz_175_p21"
    assert normalize_route_id("p21") == "cz_175_p21"


def test_load_route():
    route = load_route("175")
    assert route.line == "175"
    assert len(route.stops) == 15
    assert route.stops[0].name == "Rokycany"
    assert any(stop.name == "Kornatice" for stop in route.stops)


def test_speed_limits():
    route = load_route("175")
    assert [speed.speed_kmh for speed in route.speed_limits] == [80, 60, 50]
