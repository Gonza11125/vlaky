#!/usr/bin/env python3
"""Playwright acceptance test of the 1.7.0 river world and exploration."""
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
    with tempfile.TemporaryDirectory(prefix="vek-frontier-") as tmp:
        shutil.copytree(ROOT,Path(tmp)/'strategie',ignore=shutil.ignore_patterns('__pycache__'))
        server=ThreadingHTTPServer(('127.0.0.1',0),
            lambda *a,**k:QuietHandler(*a,directory=tmp,**k))
        thread=Thread(target=server.serve_forever,daemon=True);thread.start()
        url=f"http://127.0.0.1:{server.server_port}/strategie/versions/1.7.0/index.html"
        try:
            with sync_playwright() as p:
                exe=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
                browser=p.chromium.launch(**({'executable_path':exe} if exe else {}),
                    headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
                context=browser.new_context(viewport={'width':1280,'height':900})
                context.route('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js',
                    lambda route:route.fulfill(body=asset,content_type='application/javascript'))
                context.route('https://fonts.googleapis.com/**',
                    lambda route:route.fulfill(body='',content_type='text/css'))
                page=context.new_page()
                errors=[]
                page.on('pageerror',lambda error:errors.append(str(error)))
                for realistic in (False,True):
                    page.goto(url)
                    page.wait_for_function('!!window.GAME && GAME.units.length>0')
                    page.locator('#match-settings summary').click()
                    page.locator('#match-map').select_option('river')
                    if realistic:
                        page.locator('.opts[data-k="real"] [data-d="1"]').click()
                    page.locator('#b-start').click()
                    page.wait_for_function("document.getElementById('start').hidden")
                    assert page.evaluate("G.match.map")== 'river'
                    basic=page.evaluate("""() => {
                        const a=STARTS[0],b=STARTS[1];
                        const crossing=findPath(a.cx-1,a.cy+1,b.cx-1,b.cy+1,b.cx-1,b.cy+1,0);
                        const sites=FRONTIER.sites;
                        return {bridges:FRONTIER.bridges.length,sites:sites.length,
                            cross:crossing.ok,hidden:sites.filter(s=>!frontierWasSeen(s)).length,
                            used:FRONTIER.sites.filter(s=>s.visited).length};
                    }""")
                    assert basic['bridges']==3,basic
                    assert basic['sites']>=5 and basic['cross'],basic
                    assert basic['hidden']>=1 and basic['used']==0,basic
                    page.locator('#b-world').click()
                    assert page.locator('#world-panel').is_visible()
                    assert 'Neznámá lokalita' in page.locator('#world-sites').inner_text()
                    page.locator('#b-world-close').click()
                    result=page.evaluate("""() => {
                        const site=FRONTIER.sites[0],unit=units.find(u=>u.team===0&&u.type==='vil');
                        const before=Object.fromEntries(Object.keys(site.reward).map(k=>[k,teams[0].res[k]]));
                        if(!unit||!site)throw Error('Missing scout or landmark');
                        PT=0;const route=findPath(cellOf(unit.x),cellOf(unit.z),site.cx,site.cy,site.cx+1,site.cy+1,0);
                        if(!route.ok)throw Error('Landmark unreachable');
                        unit.x=site.x;unit.z=site.z;
                        updateFog();frontierTick(0.4);frontierFrame();
                        const delta=Object.fromEntries(Object.keys(before).map(k=>[k,teams[0].res[k]-before[k]]));
                        frontierTick(0.4);
                        return {found:frontierWasSeen(site),visited:!!(site.visited&1),
                            delta,twice: Object.fromEntries(Object.keys(before).map(k=>[k,teams[0].res[k]-before[k]])),
                            visible:site.mesh.visible,name:site.name};
                    }""")
                    assert result['found'] and result['visited'] and result['visible'],result
                    assert result['delta']==result['twice'],result
                    page.locator('#b-world').click()
                    assert 'Navštíveno' in page.locator('#world-sites').inner_text()
                    page.locator('#b-world-close').click()
                    page.locator('#b-save').click()
                    page.reload()
                    page.wait_for_function('!!window.GAME && GAME.units.length>0')
                    page.locator('#b-continue').click()
                    page.wait_for_function("document.getElementById('start').hidden")
                    assert page.evaluate("FRONTIER.sites[0].visited&1")
                    assert page.evaluate("FRONTIER.bridges.length")==3
                    page.set_viewport_size({'width':390,'height':844})
                    page.locator('#b-world').click()
                    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
                    page.locator('#b-world-close').click()
                    page.set_viewport_size({'width':1280,'height':900})
                    print('PASS 1.7 '+('realistic' if realistic else 'classic')+
                          ': river, bridges, fog, landmarks, rewards, save/load, mobile',flush=True)
                assert not errors,errors
                browser.close()
        finally:
            server.shutdown();server.server_close();thread.join()
if __name__=='__main__':
    main()
