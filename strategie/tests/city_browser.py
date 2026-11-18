#!/usr/bin/env python3
"""Real Chromium smoke test of Věk pokroku 1.3.0 city management, both modes."""
import os
from pathlib import Path
import shutil
import tempfile
from threading import Thread
from http.server import ThreadingHTTPServer

from playwright.sync_api import sync_playwright
from browser_smoke import ROOT, QuietHandler, three_asset


def main():
    asset = three_asset()
    with tempfile.TemporaryDirectory(prefix="vek-city-") as temp:
        root = Path(temp) / "strategie"
        shutil.copytree(ROOT, root, ignore=shutil.ignore_patterns("__pycache__"))
        handler = lambda *a, **kw: QuietHandler(*a, directory=temp, **kw)
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f"http://127.0.0.1:{server.server_port}/strategie/versions/1.3.0/index.html"
        try:
            with sync_playwright() as playwright:
                executable = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium")
                browser = playwright.chromium.launch(
                    **({"executable_path": executable} if executable else {}),
                    headless=True, args=["--no-sandbox", "--enable-unsafe-swiftshader"])
                context = browser.new_context(viewport={"width": 1280, "height": 900})
                context.route(
                    "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js",
                    lambda route: route.fulfill(body=asset, content_type="application/javascript"))
                context.route("https://fonts.googleapis.com/**",
                              lambda route: route.fulfill(body="", content_type="text/css"))
                page = context.new_page()
                errors = []
                page.on("pageerror", lambda err: errors.append(str(err)))

                for realistic in (False, True):
                    page.goto(url)
                    page.wait_for_function("!!window.GAME && GAME.units.length > 0")
                    if realistic:
                        page.locator('.opts[data-k="real"] [data-d="1"]').click()
                    page.locator("#b-start").click()
                    page.wait_for_function("document.getElementById('start').hidden")
                    assert bool(page.evaluate("G.real")) == realistic

                    page.locator("#b-city").click()
                    assert page.locator("#city-panel").is_visible()
                    assert bool(page.locator("#city-real").is_visible()) == realistic
                    assert int(page.locator("#city-pop").inner_text()) >= 5
                    for key in ["food", "stone", "ore", "gold"]:
                        page.locator(f'[data-city-priority="{key}"]').select_option("0")
                    page.locator('[data-city-priority="wood"]').select_option("3")
                    page.locator("#b-city-auto").click()
                    assert page.evaluate("teams[0].city.auto")
                    assert page.evaluate("teams[0].city.priorities.wood") == 3
                    page.locator("#b-city-close").click()
                    page.evaluate("cityAssignJobs(teams[0])")
                    page.wait_for_function(
                        "units.some(u => u.team===0 && u.type==='vil' && u.order && u.order.type==='gather')")

                    page.evaluate("""() => {
                      G.paused = true;
                      const tc = blds.find(b=>b.team===0 && b.type==='tc');
                      const spot = findSpot('house', tc.cx, tc.cy, 1);
                      if (!spot) throw new Error('No available building site');
                      window.testHouse = placeBuilding(0,'house',spot.cx,spot.cy,true).id;
                    }""")
                    page.wait_for_function("cityRoadCells.length > 0")
                    result = page.evaluate("""() => {
                      const b = byId.get(window.testHouse);
                      const hp = b.hp;
                      updateBuilding(b,12);
                      const wear = b.hp < hp;
                      b.hp = hp - 25;
                      const wood = teams[0].res.wood;
                      cityRepair(b,teams[0],1);
                      return {wear,paid:teams[0].res.wood < wood,roads:cityRoadCells.length};
                    }""")
                    assert result["roads"] > 0
                    assert result["wear"] is realistic
                    assert result["paid"] is realistic
                    page.keyboard.press("c")
                    assert page.locator("#city-panel").is_visible()
                    page.keyboard.press("Escape")
                    assert not page.locator("#city-panel").is_visible()
                    label = "realistic" if realistic else "classic"
                    page.screenshot(path=f"/tmp/vek-city-{label}.png")
                    print(f"PASS: {label} city mode, jobs, roads, maintenance and shortcuts", flush=True)

                assert not errors, errors
                browser.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == "__main__":
    main()
