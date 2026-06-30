from pathlib import Path

from railforge.cli import main


def test_generate_outputs(tmp_path: Path):
    result = main(["generate", "175", "--output", str(tmp_path)])
    assert result == 0
    out = tmp_path / "cz_175_p21"
    assert (out / "stops.geojson").exists()
    assert (out / "route.gpx").exists()
    assert (out / "route.kml").exists()
    assert (out / "stops.csv").exists()
    assert (out / "speed_limits.csv").exists()
    assert (out / "report.md").exists()
