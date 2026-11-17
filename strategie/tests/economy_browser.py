#!/usr/bin/env python3
"""Real Chromium checks for the 1.1 economy and two-player synchronization."""
from http.server import ThreadingHTTPServer
import os
import json
from pathlib import Path
import shutil
import tempfile
from threading import Thread

from playwright.sync_api import sync_playwright, expect
from browser_smoke import ROOT, release, three_asset, QuietHandler


FIXTURES = '''() => {
  window.fixtureBuilding = (team,type,cx,cy) => {
    const sp=findSpot(type,cx,cy,type==='farm'?0:1);
    if (!sp) throw new Error('No construction site for '+type);
    return placeBuilding(team,type,sp.cx,sp.cy,true);
  };
  window.fixtureEconomy = team => {
    const tc=blds.find(b=>b.team===team && b.type==='tc');
    const T=teams[team]; Object.assign(T.tech,{agri:true,pottery:true,currency:true});
    Object.assign(T.res,{food:1000,wood:1000,stone:1000,gold:100,grain:0,flour:0});
    const farm=fixtureBuilding(team,'farm',tc.cx,tc.cy);
    const mill=fixtureBuilding(team,'mill',tc.cx,tc.cy);
    const bakery=fixtureBuilding(team,'bakery',tc.cx,tc.cy);
    const forester=fixtureBuilding(team,'forester',tc.cx,tc.cy);
    const from=fixtureBuilding(team,'market',tc.cx,tc.cy);
    let to, caravan;
    for (const [dx,dy] of [[22,-12],[-22,12],[0,-24],[0,24]]) {
      const sp=findSpot('market',from.cx+dx,from.cy+dy,1); if (!sp) continue;
      const candidate=placeBuilding(team,'market',sp.cx,sp.cy,true);
      if (!caravan) caravan=spawnFrom(from,'caravan');
      if (tradeRoute(caravan,from,candidate)) {to=candidate;break;}
    }
    if (!to) throw new Error('No usable test trade route');
    const tree=nodes.find(n=>n.type==='tree' && n.amt>0 && !resv[cidx(n.cx,n.cy)] && Math.hypot(n.x-forester.x,n.z-forester.z)<=22);
    if (!tree) throw new Error('No tree near the forester');
    return {farm:farm.id,mill:mill.id,bakery:bakery.id,forester:forester.id,from:from.id,to:to.id,caravan:caravan.id,tree:tree.id};
  };
}'''


def main():
    asset = three_asset()
    with tempfile.TemporaryDirectory(prefix='vek-economy-') as temp:
        root = Path(temp) / 'strategie'
        shutil.copytree(ROOT, root, ignore=shutil.ignore_patterns('__pycache__'))
        if not (root / 'versions' / '1.1.0').exists():
            release.publish(root, '1.1.0', 'Hospodářství')
        handler = lambda *a, **kw: QuietHandler(*a, directory=temp, **kw)
        server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = 'http://127.0.0.1:' + str(server.server_port) + '/strategie/versions/1.1.0/index.html'
        try:
            with sync_playwright() as p:
                executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
                browser = p.chromium.launch(**({'executable_path': executable} if executable else {}),
                    headless=True, args=['--no-sandbox', '--enable-unsafe-swiftshader'])
                context = browser.new_context(viewport={'width': 1280, 'height': 900})
                context.route('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js',
                    lambda route: route.fulfill(body=asset, content_type='application/javascript'))
                context.route('https://fonts.googleapis.com/**', lambda route: route.fulfill(body='', content_type='text/css'))
                errors = []

                def new_page():
                    page = context.new_page()
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    page.goto(url)
                    page.wait_for_function('!!window.GAME')
                    page.evaluate(FIXTURES)
                    return page

                page = new_page()
                page.locator('#match-settings summary').click()
                page.locator('#match-seed').fill('73')
                page.locator('#match-peace').select_option('600')
                page.locator('#b-start').click()
                page.locator('#b-pause').click()
                ids = page.evaluate('window.economyFixture=fixtureEconomy(0)')
                page.evaluate('setSel([byId.get(economyFixture.farm)]); refreshUI()')
                page.get_by_role('button', name='Pěstovat obilí', exact=True).click()
                assert page.evaluate('byId.get(economyFixture.farm).crop') == 'grain'
                production = page.evaluate('''() => {
                  const f=byId.get(economyFixture.farm), vil=units.find(u=>u.team===0 && u.type==='vil');
                  vil.x=f.x;vil.z=f.z;orderFarm(vil,f);
                  for(let i=0;i<1800;i++) simStep(1/30);
                  const n=nodes[economyFixture.tree], forester=byId.get(economyFixture.forester);
                  depleteNode(n); forester.workT=29;productionTick(forester,1);
                  return {produced:teams[0].stats.produced, tree:n.amt, regrown:teams[0].stats.regrown};
                }''')
                assert all(production['produced'].get(key, 0) > 0 for key in ['grain', 'flour', 'food'])
                assert production['tree'] > 0 and production['regrown'] >= 1
                page.evaluate('setSel([byId.get(economyFixture.mill)]); refreshUI()')
                page.get_by_role('button', name='Pozastavit výrobu', exact=True).click()
                assert not page.evaluate('byId.get(economyFixture.mill).enabled')
                print('PASS: field crop controls, grain/flour/bread, forest regrowth and production pause work in the real game', flush=True)

                enemy = page.evaluate('''() => {
                  const e=fixtureEconomy(1), tc=blds.find(b=>b.team===1 && b.type==='tc');
                  fixtureBuilding(1,'farm',tc.cx,tc.cy);fixtureBuilding(1,'farm',tc.cx,tc.cy);
                  aiTick();
                  return {grain:blds.filter(b=>b.team===1 && b.type==='farm' && b.crop==='grain').length,
                    trading:units.some(u=>u.team===1 && u.type==='caravan' && u.order?.type==='trade')};
                }''')
                assert enemy['grain'] >= 1 and enemy['trading']
                print('PASS: the computer opponent uses grain fields and operating trade routes', flush=True)

                loaded = page.evaluate('''() => {
                  const u=byId.get(economyFixture.caravan);
                  tradeRoute(u,byId.get(economyFixture.from),byId.get(economyFixture.to));
                  const before=teams[0].res.gold;
                  for(let i=0;i<10000 && !u.order.loaded;i++) updateCaravan(u,0.1);
                  return {loaded:u.order.loaded,cargo:u.carry,gold:teams[0].res.gold,before};
                }''')
                assert loaded['loaded'] and loaded['cargo'] > 0 and loaded['gold'] == loaded['before']
                page.locator('#b-save').click()
                page.reload()
                page.wait_for_function('!!window.GAME')
                page.locator('#b-continue').click()
                page.locator('#b-pause').click()
                page.evaluate('window.economyFixture=' + json.dumps(ids))
                restored = page.evaluate('''() => {
                  const u=byId.get(economyFixture.caravan), before=teams[0].stats.tradeGold;
                  if (!u.order.loaded || !u.order.returning) throw new Error('Cargo not restored');
                  for(let i=0;i<10000 && teams[0].stats.tradeGold===before;i++) updateCaravan(u,0.1);
                  const earned=teams[0].stats.tradeGold-before;
                  const result={earned,crop:byId.get(economyFixture.farm).crop,enabled:byId.get(economyFixture.mill).enabled,tree:nodes[economyFixture.tree].amt};
                  byId.get(economyFixture.to).dead=true;updateCaravan(u,0.1);
                  result.stopped=u.order===null;return result;
                }''')
                assert restored['earned'] == loaded['cargo']
                assert restored['crop'] == 'grain' and not restored['enabled'] and restored['tree'] > 0 and restored['stopped']
                print('PASS: loaded caravans, restored trees, crop modes and paused factories survive save/load; destroyed destinations stop trade', flush=True)
                page.set_viewport_size({'width': 390, 'height': 844})
                page.screenshot(path='/tmp/vek-1.1.0-economy-mobile.png')
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                page.close()

                host, guest = new_page(), new_page()
                host.locator('#match-settings summary').click()
                host.locator('#match-map').select_option('forest')
                host.locator('#match-goal').select_option('survival')
                host.locator('#match-years').select_option('3')
                host.locator('#match-peace').select_option('600')
                host.locator('#match-seed').fill('73')
                host.locator('#b-host').click()
                code = host.evaluate('NET.code')
                guest.locator('#net-code').fill(code)
                guest.locator('#b-join').click()
                try:
                    host.wait_for_function("GAME.G.mode==='host' && document.getElementById('start').hidden")
                    guest.wait_for_function("GAME.G.mode==='guest' && document.getElementById('start').hidden")
                except Exception:
                    for label, tab in [('host',host),('guest',guest)]:
                        print(label, tab.evaluate("({mode:G.mode,role:NET.role,code:NET.code,ready:NET.ready,started:NET.started,channel:NET.bc&&NET.bc.name,parts:NET.parts&&{count:NET.parts.cnt,total:NET.parts.n},status:document.getElementById('net-status').textContent})"), flush=True)
                    print('PAGE ERRORS:',errors,flush=True)
                    raise
                assert guest.evaluate('GAME.G.match.map') == 'forest'
                assert guest.evaluate('GAME.G.match.goal') == 'survival'
                host.evaluate('G.paused=true; window.economyFixture=fixtureEconomy(1)')
                net_ids = host.evaluate('economyFixture')
                guest.evaluate('window.economyFixture=' + json.dumps(net_ids))
                host.evaluate("byId.get(economyFixture.farm).crop='grain'; byId.get(economyFixture.mill).enabled=false; teams[1].res.flour=12; depleteNode(nodes[economyFixture.tree])")
                guest.wait_for_function("byId.get(economyFixture.farm)?.crop==='grain' && byId.get(economyFixture.mill)?.enabled===false && teams[1].res.flour===12")
                guest.wait_for_function('nodes[economyFixture.tree].amt===0')
                host.evaluate('byId.get(economyFixture.forester).workT=29; productionTick(byId.get(economyFixture.forester),1)')
                guest.wait_for_function('nodes[economyFixture.tree].amt>0')
                guest.wait_for_function("byId.get(economyFixture.caravan)?.order?.type==='trade'")
                guest.evaluate('setSel([byId.get(economyFixture.mill)]); refreshUI()')
                guest.get_by_role('button', name='Obnovit výrobu', exact=True).click()
                host.wait_for_function('byId.get(economyFixture.mill).enabled')
                print('PASS: two real browser players share match rules, crops, inventories, regrown trees, caravans and production commands', flush=True)
                host.evaluate('G.time=720;checkVictory()')
                expect(host.locator('#end-title')).to_have_text('Remíza')
                expect(guest.locator('#end-title')).to_have_text('Remíza', timeout=15000)
                print('PASS: survival draw and result summary synchronize to both players', flush=True)
                assert not errors, errors
                browser.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    main()
