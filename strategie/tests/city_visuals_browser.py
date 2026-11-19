#!/usr/bin/env python3
"""Chromium integration checks for the independently published Věk pokroku 1.4.0."""
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
    with tempfile.TemporaryDirectory(prefix="vek-visuals-") as temp:
        root = Path(temp) / "strategie"
        shutil.copytree(ROOT, root, ignore=shutil.ignore_patterns("__pycache__"))
        server = ThreadingHTTPServer(("127.0.0.1", 0),
            lambda *a, **kw: QuietHandler(*a, directory=temp, **kw))
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f"http://127.0.0.1:{server.server_port}/strategie/versions/1.4.0/index.html"
        try:
            with sync_playwright() as playwright:
                executable = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium")
                browser = playwright.chromium.launch(
                    **({"executable_path": executable} if executable else {}),
                    headless=True, args=["--no-sandbox", "--enable-unsafe-swiftshader"])
                context = browser.new_context(viewport={"width":1280, "height":900})
                context.route(
                    "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js",
                    lambda route:route.fulfill(body=asset, content_type="application/javascript"))
                context.route("https://fonts.googleapis.com/**",
                    lambda route:route.fulfill(body="",content_type="text/css"))
                page=context.new_page()
                errors=[]
                page.on("pageerror",lambda err:errors.append(str(err)))
                for realistic in (False,True):
                    page.goto(url)
                    page.wait_for_function("!!window.GAME && GAME.units.length>0")
                    if realistic:
                        page.locator('.opts[data-k="real"] [data-d="1"]').click()
                    page.locator("#b-start").click()
                    page.wait_for_function("document.getElementById('start').hidden")
                    assert page.evaluate("G.real") == realistic
                    page.locator("#b-city").click()
                    page.locator("#city-art-quality").select_option("low")
                    assert page.evaluate("cityArtQuality()==='low' && renderer.getPixelRatio()<=1.1")
                    page.locator("#city-art-quality").select_option("high")
                    assert page.evaluate("cityArtQuality()==='high' && renderer.shadowMap.enabled")
                    page.locator("#b-city-close").click()

                    page.evaluate("""() => {
                      const tc=blds.find(b=>b.team===0&&b.type==='tc');
                      const sp=findSpot('house',tc.cx,tc.cy,1);
                      if (!sp) throw Error('No site for house');
                      const b=placeBuilding(0,'house',sp.cx,sp.cy,false);
                      window.siteId=b.id;
                      window.stageOne=cityArtStage(b);
                    }""")
                    page.wait_for_function("CITY_ART.sites.has(window.siteId)",timeout=12000)
                    assert page.evaluate("window.stageOne") == "Základy"
                    state = page.evaluate("""() => {
                      const b=byId.get(window.siteId);
                      b.prog=0.72;cityArtUpdateScaffolds();
                      const site=CITY_ART.sites.get(b.id);
                      const roof=site.roof.visible;
                      const stage=cityArtStage(b);
                      const before=b.mesh.geometry.attributes.position.count;
                      finishBuilding(b);
                      const removed=!CITY_ART.sites.has(b.id);
                      teams[0].era=2;
                      cityArtSyncEpochs();
                      const later=b.mesh.geometry.attributes.position.count;
                      cityArtRebuildProps();
                      return {roof,stage,removed,before,later,decor:CITY_ART.props.length};
                    }""")
                    assert state["roof"] and state["stage"]=="Střecha"
                    assert state["removed"] and state["later"]>state["before"]
                    assert state["decor"]>0, state

                    rot = page.evaluate("""() => {
                      const tc=blds.find(b=>b.team===0&&b.type==='tc');
                      const sp=findSpot('mill',tc.cx,tc.cy,1);
                      if (!sp) throw Error('No site for mill');
                      const mill=placeBuilding(0,'mill',sp.cx,sp.cy,true);
                      cityArtSyncRotors();
                      if (!mill.artRotor) throw Error('Mill rotor missing');
                      G.paused=false;
                      const before=mill.artRotor.rotation.z;
                      cityArtAnimate(12,0.3);
                      const moving=mill.artRotor.rotation.z!==before;
                      mill.enabled=false;
                      const stopped=mill.artRotor.rotation.z;
                      cityArtAnimate(13,0.3);
                      return {moving,paused:mill.artRotor.rotation.z===stopped};
                    }""")
                    assert rot["moving"] and rot["paused"], rot
                    work = page.evaluate("""() => {
                      const u=units.find(u=>u.team===0&&u.type==='vil');
                      if (!u) throw Error('No villager');
                      cityArtCreateWorker(u);
                      u.working=true;u.moving=false;
                      u.order={type:'build',b:byId.get(window.siteId)};
                      cityArtAnimate(14,0.1);
                      return {rig:!!u.art,tool:u.art.tool.visible,
                        moving:Math.abs(u.art.right.rotation.x)>0};
                    }""")
                    assert work["rig"] and work["tool"] and work["moving"], work
                    if not realistic:
                        page.set_viewport_size({"width":390,"height":844})
                        page.locator("#b-city").click()
                        page.locator("#city-art-quality").select_option("low")
                        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
                        page.locator("#b-city-close").click()
                        page.set_viewport_size({"width":1280,"height":900})
                    page.screenshot(path=f"/tmp/vek-1.4-{'real' if realistic else 'classic'}.png")
                    print("PASS: 1.4", "realistic" if realistic else "classic",
                          "construction, visual tiers, era, decals, rotors, workers", flush=True)
                assert not errors, errors
                browser.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__=="__main__":
    main()
