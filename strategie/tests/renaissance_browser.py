#!/usr/bin/env python3
"""Chromium acceptance test for procedural 3D rigs and architecture in Věk pokroku 2.2."""
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
    with tempfile.TemporaryDirectory(prefix='vek-renaissance-') as tmp:
        shutil.copytree(ROOT,Path(tmp)/'strategie',ignore=shutil.ignore_patterns('__pycache__'))
        server=ThreadingHTTPServer(('127.0.0.1',0),
            lambda *a,**kw:QuietHandler(*a,directory=tmp,**kw))
        thread=Thread(target=server.serve_forever,daemon=True);thread.start()
        url=f'http://127.0.0.1:{server.server_port}/strategie/versions/2.2.0/index.html'
        try:
            with sync_playwright() as playwright:
                exe=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
                browser=playwright.chromium.launch(
                    **({'executable_path':exe} if exe else {}),
                    headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
                context=browser.new_context(viewport={'width':1280,'height':900})
                context.route('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js',
                    lambda route:route.fulfill(body=asset,content_type='application/javascript'))
                context.route('https://fonts.googleapis.com/**',
                    lambda route:route.fulfill(body='',content_type='text/css'))
                page=context.new_page()
                errors=[]
                page.on('pageerror',lambda err:errors.append(str(err)))
                for realistic in (False,True):
                    page.goto(url)
                    page.wait_for_function("!!window.GAME && GAME.units.length>0 && !!GAME.RENAISSANCE")
                    if realistic:
                        page.locator('.opts[data-k="real"] [data-d="1"]').click()
                    page.locator('#b-start').click()
                    page.wait_for_function("document.getElementById('start').hidden")
                    page.locator('#b-city').click()
                    page.locator('#city-art-quality').select_option('high')
                    assert page.locator('#renaissance-enable').is_checked()
                    assert page.locator('#renaissance-motion').is_checked()
                    page.locator('#b-city-close').click()
                    detail=page.evaluate("""() => {
                        G.paused=false;
                        const u=units.find(x=>x.team===0&&x.type==='vil'&&!x.dead);
                        if(!u)throw Error('No villager');
                        cam.x=u.x;cam.z=u.z;
                        renaissanceFrame(1,0.05);
                        if(!u.renRig)throw Error('Rig not created');
                        const r=u.renRig;
                        const parts=r.group.children.length;
                        u.moving=true;u.working=false;
                        r.phase=0;renaissanceFrame(2,0.12);const one=r.legs[0].rotation.x;
                        renaissanceFrame(2.2,0.12);const two=r.legs[0].rotation.x;
                        u.moving=false;u.working=true;u.order={type:'build'};
                        renaissanceFrame(2.4,0.12);
                        const hammer=r.tools.build.visible;
                        u.order=null;u.working=false;
                        return {parts,legMoves:Math.abs(two-one)>0.03,hammer,
                          hiddenBase:u.mesh.material===RENAISSANCE.hiddenMaterial,
                          visible:r.group.visible,rigs:RENAISSANCE.rigs};
                    }""")
                    assert detail['parts']>=3 and detail['legMoves'],detail
                    assert detail['hammer'] and detail['hiddenBase'] and detail['visible'],detail
                    scenery=page.evaluate("""() => {
                        const tc=blds.find(b=>b.team===0&&b.type==='tc');
                        const spot=findSpot('house',tc.cx,tc.cy,1);
                        if(!spot)throw Error('No house building spot');
                        const house=placeBuilding(0,'house',spot.cx,spot.cy,true);
                        window.renHouse=house.id;
                        cam.x=house.x;cam.z=house.z;
                        renaissanceFrame(3,0.1);
                        if(!house.renFacade)throw Error('Facade not created');
                        const f=house.renFacade;
                        const structures=f.group.children.length;
                        house.hp=house.maxHp*0.45;renaissanceFrame(4,0.1);
                        return {structures,windows:f.lit.length,
                          damaged:f.cracks.every(c=>c.visible),
                          facades:RENAISSANCE.facades};
                    }""")
                    assert scenery['structures']>=9 and scenery['windows']>=2,scenery
                    assert scenery['damaged'],scenery
                    tier=page.evaluate("""() => {
                        const u=units.find(u=>u.team===0&&u.type==='vil');
                        const b=byId.get(window.renHouse);
                        const before=saveState();delete before.saved;
                        cityArtSetQuality('low');renaissanceFrame(5,0.1);
                        const hidden=!u.renRig.group.visible&&!b.renFacade.group.visible;
                        cityArtSetQuality('high');renaissanceFrame(6,0.1);
                        const restored=u.renRig.group.visible&&b.renFacade.group.visible;
                        renaissanceSet('motion',false);
                        const fixed=renaissancePose('move',1,3,false,true,false,0);
                        renaissanceFrame(7,0.1);
                        const still=Math.abs(u.renRig.left.rotation.x)<0.0001;
                        renaissanceSet('motion',true);
                        const after=saveState();delete after.saved;
                        return {hidden,restored,still,pose:fixed,
                            noGameplayChange:JSON.stringify(before)===JSON.stringify(after)};
                    }""")
                    assert tier['hidden'] and tier['restored'] and tier['still'],tier
                    assert tier['noGameplayChange'],tier
                    page.locator('#b-city').click()
                    page.locator('#renaissance-enable').uncheck()
                    assert page.evaluate("RENAISSANCE.enabled===false")
                    page.locator('#renaissance-enable').check()
                    page.locator('#b-city-close').click()
                    page.locator('#b-save').click()
                    page.reload()
                    page.wait_for_function("!!window.GAME && GAME.units.length>0")
                    assert page.evaluate("RENAISSANCE.enabled&&RENAISSANCE.motion&&CITY_ART.quality==='auto'")
                    page.locator('#b-continue').click()
                    page.wait_for_function("document.getElementById('start').hidden")
                    assert page.evaluate('G.real')==realistic
                    page.set_viewport_size({'width':390,'height':844})
                    page.locator('#b-city').click()
                    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
                    page.locator('#b-city-close').click()
                    page.set_viewport_size({'width':1280,'height':900})
                    # Dead unit visual expires and cleans up with the next game.
                    cleanup=page.evaluate("""() => {
                        const victim=units.find(u=>u.team===0&&u.type==='vil');
                        cam.x=victim.x;cam.z=victim.z;
                        renaissanceFrame(9,0.1);
                        killEnt(victim,null);
                        const corpse=RENAISSANCE.corpses.length;
                        newGame(1);
                        return {corpse,none:RENAISSANCE.corpses.length===0,
                          rigs:RENAISSANCE.rigs,facades:RENAISSANCE.facades};
                    }""")
                    assert cleanup['corpse']>0 and cleanup['none'],cleanup
                    assert cleanup['rigs']==0 and cleanup['facades']==0,cleanup
                    assert not errors,errors
                    print('PASS 2.2 '+('realistic' if realistic else 'classic')+
                        ': rig, motion, equipment, facades, damage, LOD, controls, save, death, mobile',flush=True)
                browser.close()
        finally:
            server.shutdown();server.server_close();thread.join()
if __name__=='__main__':
    main()
