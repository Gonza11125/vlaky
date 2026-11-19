#!/usr/bin/env python3
"""Browser acceptance tests: Věk pokroku 1.5.0 economy in classic/realistic modes."""
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
    with tempfile.TemporaryDirectory(prefix="vek-1.5-economy-") as tmp:
        shutil.copytree(ROOT,Path(tmp)/'strategie',ignore=shutil.ignore_patterns('__pycache__'))
        server=ThreadingHTTPServer(('127.0.0.1',0),
            lambda *a,**k:QuietHandler(*a,directory=tmp,**k))
        thread=Thread(target=server.serve_forever,daemon=True);thread.start()
        url=f'http://127.0.0.1:{server.server_port}/strategie/versions/1.5.0/index.html'
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
                page.on('pageerror',lambda err:errors.append(str(err)))
                for realistic in (False,True):
                    page.goto(url)
                    page.wait_for_function('!!window.GAME && GAME.units.length>0')
                    if realistic:
                        page.locator('.opts[data-k="real"] [data-d="1"]').click()
                    page.locator('#b-start').click()
                    page.wait_for_function("document.getElementById('start').hidden")
                    assert page.evaluate('G.real')==realistic
                    page.locator('#b-economy').click()
                    assert page.locator('#economy-panel').is_visible()
                    page.locator('[data-economy-reserve="wood"]').select_option('50')
                    assert page.evaluate("cityState(teams[0]).reserves.wood")==50
                    page.locator('#b-economy-close').click()
                    prepared=page.evaluate("""() => {
                        const T=teams[0],tc=blds.find(x=>x.team===0&&x.type==='tc');
                        Object.assign(T.tech,{agri:true,pottery:true,bronze:true});
                        Object.assign(T.res,{wood:500,grain:30,flour:0,ore:30,metal:0,food:500});
                        const spot=findSpot('mill',tc.cx,tc.cy,1);
                        if(!spot)throw Error('No mill location');
                        const b=placeBuilding(0,'mill',spot.cx,spot.cy,true);
                        window.millId=b.id;
                        const before=T.res.flour;
                        const produced=industryTick(b,5);
                        return {produced,delta:T.res.flour-before,status:industryStatus(b)};
                    }""")
                    if realistic:
                        assert prepared['produced']==0 and prepared['status']=='Chybí řemeslník',prepared
                        restored=page.evaluate("""() => {
                            const b=byId.get(window.millId);
                            const worker=units.find(u=>u.team===0&&u.type==='vil'&&!u.order);
                            if(!worker)throw Error('No free craftsman');
                            // Accept an ordinary network-compatible craft order, then simulate arrival.
                            if(!orderCraft(worker,b))throw Error('Could not assign craftsman');
                            worker.x=b.x+b.size*CS/2+0.6;worker.z=b.z;worker.path=null;
                            const first=industryTick(b,5);
                            updateUnit(worker,1);
                            return {first,skill:professionExp(worker).craft,
                                ready:craftWorkerReady(b)};
                        }""")
                        assert restored['first']>0 and restored['skill']>0 and restored['ready'],restored
                    else:
                        assert abs(prepared['produced']-2)<0.00001,prepared
                    page.locator('#b-economy').click()
                    page.wait_for_function("document.querySelectorAll('#economy-lines tr').length===1")
                    assert page.locator('#economy-lines').inner_text().find('Mlýn')>=0
                    page.locator('[data-economy-industry="priority"]').select_option('3')
                    page.locator('[data-economy-industry="target"]').select_option('150')
                    assert page.evaluate("byId.get(window.millId).priority===3&&byId.get(window.millId).target===150")
                    page.locator('#b-economy-close').click()
                    page.locator('#b-save').click()
                    page.reload()
                    page.wait_for_function('!!window.GAME && GAME.units.length>0')
                    page.locator('#b-continue').click()
                    page.wait_for_function("document.getElementById('start').hidden")
                    saved=page.evaluate("""() => {
                        const b=blds.find(b=>b.team===0&&b.type==='mill');
                        const worker=units.find(u=>u.team===0&&u.order?.type==='craft');
                        return {real:G.real,priority:b.priority,target:b.target,
                            reserve:cityState(teams[0]).reserves.wood,
                            worker:worker?worker.id:0,linked:worker?worker.order.b===b:false,
                            rate:economyRate(teams[0],'flour').gain};
                    }""")
                    assert saved['real']==realistic and saved['priority']==3
                    assert saved['target']==150 and saved['reserve']==50,saved
                    if realistic:
                        assert saved['linked'] and saved['worker']>0,saved
                    page.set_viewport_size({'width':390,'height':844})
                    page.locator('#b-economy').click()
                    assert page.locator('#economy-panel').is_visible()
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                    page.locator('#b-economy-close').click()
                    page.set_viewport_size({'width':1280,'height':900})
                    print('PASS: v1.5 '+('realistic' if realistic else 'classic')+
                        ' economy, workers, reserves, UI, save/load, mobile',flush=True)
                assert not errors,errors
                browser.close()
        finally:
            server.shutdown();server.server_close();thread.join()
if __name__=='__main__':main()
