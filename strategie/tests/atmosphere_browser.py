#!/usr/bin/env python3
"""Chromium acceptance tests for Věk pokroku 1.6.0 atmosphere and performance."""
import os
import shutil
import tempfile
from pathlib import Path
from threading import Thread
from http.server import ThreadingHTTPServer

from playwright.sync_api import sync_playwright
from browser_smoke import ROOT, QuietHandler, three_asset

def main():
    asset=three_asset()
    with tempfile.TemporaryDirectory(prefix="vek-atmo-") as tmp:
        shutil.copytree(ROOT,Path(tmp)/'strategie',
                        ignore=shutil.ignore_patterns('__pycache__'))
        server=ThreadingHTTPServer(("127.0.0.1",0),
            lambda *a,**k:QuietHandler(*a,directory=tmp,**k))
        worker=Thread(target=server.serve_forever,daemon=True);worker.start()
        url=f"http://127.0.0.1:{server.server_port}/strategie/versions/1.6.0/index.html"
        try:
            with sync_playwright() as p:
                exe=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
                browser=p.chromium.launch(
                    **({'executable_path':exe} if exe else {}),
                    headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
                ctx=browser.new_context(viewport={"width":1280,"height":900})
                ctx.route("https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js",
                    lambda route:route.fulfill(body=asset,content_type="application/javascript"))
                ctx.route("https://fonts.googleapis.com/**",
                    lambda route:route.fulfill(body="",content_type="text/css"))
                page=ctx.new_page()
                errors=[]
                page.on('pageerror',lambda error:errors.append(str(error)))
                for realistic in (False,True):
                    page.goto(url)
                    page.wait_for_function("!!window.GAME && GAME.units.length>0 && !!GAME.ATMOS")
                    if realistic:
                        page.locator('.opts[data-k="real"] [data-d="1"]').click()
                    page.locator("#b-start").click()
                    page.wait_for_function("document.getElementById('start').hidden")
                    page.locator("#b-pause").click()
                    before=page.evaluate("""() => {
                       atmoSetSetting('enabled',true);
                       G.time=30;atmoUpdateLight(cam);
                       const noon={sun:sun.intensity,sky:scene.background.getHex(),day:atmoClock(G.time).label};
                       G.time=90;atmoUpdateLight(cam);
                       const night={sun:sun.intensity,sky:scene.background.getHex(),day:atmoClock(G.time).label};
                       atmoSyncLamps(true);
                       return {noon,night,lamps:ATMOS.lamps.length};
                    }""")
                    assert before['noon']['day']=='Den'
                    assert before['night']['day']=='Noc'
                    assert before['noon']['sun']>before['night']['sun']
                    assert before['noon']['sky']!=before['night']['sky']
                    assert before['lamps']>0
                    page.locator("#b-city").click()
                    assert page.locator("#atmo-day").is_checked()
                    page.locator("#atmo-day").uncheck()
                    assert page.evaluate("ATMOS.enabled===false")
                    assert page.evaluate("atmoLightProfile(G.time,G.real,ATMOS.enabled).day>0.99")
                    page.locator("#atmo-day").check()
                    page.locator("#atmo-quality").select_option('low')
                    assert page.evaluate("atmoMaxParticles()===280")
                    if realistic:
                        page.evaluate("G.rain=1;atmoUpdateWeather(0.1,42)")
                        assert page.evaluate("weather.visible && weather.geometry.drawRange.count===280")
                    page.locator("#atmo-quality").select_option('high')
                    assert page.evaluate("atmoMaxParticles()===1600")
                    page.locator("#atmo-volume").evaluate("""el => {
                        el.value='55';
                        el.dispatchEvent(new Event('input',{bubbles:true}));
                        el.dispatchEvent(new Event('change',{bubbles:true}));
                    }""")
                    assert abs(page.evaluate("ATMOS.volume")-0.55)<0.01
                    page.locator("#b-atmo-sound").click()
                    # Web Audio may be denied by a headless browser; no page error is acceptable.
                    assert page.evaluate("typeof ATMOS.sound==='boolean'")
                    if page.evaluate("ATMOS.sound"):
                        page.locator("#b-atmo-sound").click()
                    page.locator("#b-city-close").click()
                    page.locator("#b-save").click()
                    page.reload()
                    page.wait_for_function("!!window.GAME && GAME.units.length>0")
                    assert page.evaluate("ATMOS.quality==='high' && Math.abs(ATMOS.volume-0.55)<0.01")
                    page.locator("#b-continue").click()
                    page.wait_for_function("document.getElementById('start').hidden")
                    assert page.evaluate("G.real")==realistic
                    page.locator("#b-city").click()
                    assert page.locator("#atmo-quality").input_value()=='high'
                    page.locator("#b-city-close").click()
                    page.set_viewport_size({"width":390,"height":844})
                    page.locator("#b-city").click()
                    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
                    page.locator("#b-city-close").click()
                    page.set_viewport_size({"width":1280,"height":900})
                    page.screenshot(path='/tmp/vek-atmo-1.6-'+('real' if realistic else 'classic')+'.png')
                    print('PASS 1.6 '+('realistic' if realistic else 'classic')+
                      ': day/night, lamps, weather, graphics, audio controls, save and mobile',flush=True)
                assert not errors,errors
                browser.close()
        finally:
            server.shutdown()
            server.server_close()
            worker.join()
if __name__=="__main__":
    main()
