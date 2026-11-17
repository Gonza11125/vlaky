#!/usr/bin/env python3
"""Exercise real game releases in Chromium; no fake releases in the checkout."""
import base64
import hashlib
import hmac
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import tarfile
import tempfile
from threading import Thread
import urllib.request

from playwright.sync_api import sync_playwright, expect


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('release', ROOT / 'tools' / 'release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


def three_asset():
    # Chromium need not reach a proxy or relax TLS: fetch the pinned real package
    # with Python's trusted HTTPS stack, verify npm's SHA-512, then serve its bytes.
    with urllib.request.urlopen('https://registry.npmjs.org/three/0.128.0', timeout=30) as r:
        metadata = json.load(r)
    with urllib.request.urlopen(metadata['dist']['tarball'], timeout=30) as r:
        package = r.read()
    expected = metadata['dist']['integrity']
    actual = 'sha512-' + base64.b64encode(hashlib.sha512(package).digest()).decode()
    if not hmac.compare_digest(actual, expected):
        raise RuntimeError('Three.js package integrity mismatch')
    with tarfile.open(fileobj=io.BytesIO(package), mode='r:gz') as archive:
        return archive.extractfile('package/build/three.min.js').read()


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def main():
    asset = three_asset()
    with tempfile.TemporaryDirectory(prefix='vek-browser-') as temp:
        root = Path(temp) / 'strategie'
        shutil.copytree(ROOT, root, ignore=shutil.ignore_patterns('__pycache__'))
        original = {p.relative_to(root): p.read_bytes()
                    for p in (root / 'versions' / '1.0.1').iterdir()}
        with (root / 'data.js').open('a') as source:
            source.write('\nwindow.TEST_RELEASE = "next";\n')
        next_version = release.publish(root, description='Pouze dočasná testovací verze.')
        handler = lambda *a, **kw: QuietHandler(*a, directory=temp, **kw)
        server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = 'http://127.0.0.1:' + str(server.server_port) + '/strategie/'
        try:
            with sync_playwright() as p:
                executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
                browser = p.chromium.launch(
                    **({'executable_path': executable} if executable else {}),
                    headless=True, args=['--no-sandbox', '--enable-unsafe-swiftshader'])
                context = browser.new_context(viewport={'width': 1280, 'height': 900})
                context.route('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js',
                              lambda route: route.fulfill(body=asset, content_type='application/javascript'))
                context.route('https://fonts.googleapis.com/**',
                              lambda route: route.fulfill(body='', content_type='text/css'))
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))

                def ready(version):
                    page.wait_for_url('**/versions/' + version + '/index.html')
                    page.wait_for_function('!!window.GAME && GAME.units.length > 0')
                    assert page.evaluate('VEK_RELEASE.id') == version

                page.goto(base)
                ready(next_version)
                assert page.evaluate('window.TEST_RELEASE') == 'next'
                print('PASS: first visit loads the newest, independent game snapshot', flush=True)

                page.locator('#match-settings summary').click()
                page.locator('#match-map').select_option('forest')
                page.locator('#match-resources').select_option('1.8')
                page.locator('#match-stocks').select_option('2')
                page.locator('#match-goal').select_option('survival')
                page.locator('#match-years').select_option('3')
                page.locator('#match-peace').select_option('120')
                page.locator('#match-seed').fill('0')
                page.locator('#b-start').click()
                page.wait_for_function('GAME.G.time > 0.1')
                assert page.evaluate('GAME.G.seed') == 0
                assert page.evaluate('GAME.G.match.map') == 'forest'
                assert page.evaluate('GAME.teams[0].res.food') > 390
                page.locator('#b-save').click()
                page.reload()
                ready(next_version)
                page.locator('#b-continue').click()
                assert page.evaluate('GAME.G.match.peace') == 120
                assert page.evaluate('GAME.G.match.resources') == 1.8
                assert page.evaluate('GAME.G.seed') == 0
                page.evaluate('GAME.G.time = 720; checkVictory()')
                expect(page.locator('#end-title')).to_have_text('Vítězství')
                expect(page.locator('#end-goal')).to_contain_text('3 celých let')
                expect(page.locator('#end-stats')).to_contain_text('Vyrobeno a doneseno')
                print('PASS: match settings affect play, survive save/load and trigger the survival victory summary', flush=True)
                page.goto(base)
                ready(next_version)

                page.locator('#game-version').select_option('1.0.1')
                ready('1.0.1')
                assert page.evaluate('window.TEST_RELEASE') is None
                assert page.locator('#game-version').input_value() == '1.0.1'
                # Simulate an original pre-versioning save; preserve its real map.
                old_save = page.evaluate('''() => {
                  const save = makeSave(); delete save.gameVersion;
                  localStorage.setItem(VEK_RELEASE.saveKey, JSON.stringify(save));
                  return save;
                }''')
                page.reload()
                ready('1.0.1')
                expect(page.locator('#b-continue')).to_be_visible()
                page.locator('#b-continue').click()
                page.wait_for_function('GAME.G.time > 0.1')
                assert page.evaluate('GAME.G.seed') == old_save['seed']
                print('PASS: 1.0.1 plays and resumes original saves without losing the map', flush=True)

                page.locator('#b-pause').click()
                page.locator('#b-version').click()
                expect(page.locator('#version-dialog')).to_be_visible()
                page.keyboard.press('Escape')
                assert page.evaluate('GAME.G.paused')
                page.locator('#b-pause').click()
                page.locator('#b-version').click()
                assert page.evaluate('GAME.G.paused')
                page.get_by_role('button', name='Zpět do hry').click()
                assert not page.evaluate('GAME.G.paused')
                page.locator('#b-version').click()
                page.locator('#switch-version').focus()
                page.keyboard.press('ArrowUp')
                assert page.locator('#switch-version').input_value() == next_version
                page.get_by_role('button', name='Přepnout verzi', exact=True).click()
                ready(next_version)
                saved = page.evaluate("JSON.parse(localStorage.getItem('vek-pokroku-save-1'))")
                assert saved['gameVersion'] == '1.0.1'
                assert saved['seed'] == old_save['seed']
                expect(page.locator('#b-continue')).to_be_hidden()
                print('PASS: switching saves the old game, isolates saves and preserves pause/cancel', flush=True)

                page.locator('input[type=file]').set_input_files({
                    'name': 'old-save.json', 'mimeType': 'application/json',
                    'buffer': json.dumps(old_save).encode()})
                expect(page.locator('#msgs')).to_contain_text('patří do verze 1.0.1')
                expect(page.locator('#start')).to_be_visible()
                page.locator('#b-start').click()
                page.wait_for_function('GAME.G.time > 0.1')
                page.locator('#b-save').click()
                new_save = page.evaluate('JSON.parse(localStorage.getItem(VEK_RELEASE.saveKey))')
                assert new_save['gameVersion'] == next_version
                assert page.evaluate("JSON.parse(localStorage.getItem('vek-pokroku-save-1')).gameVersion") == '1.0.1'
                with page.expect_download() as downloaded:
                    page.locator('#b-export').click()
                assert next_version in downloaded.value.suggested_filename
                assert json.loads(Path(downloaded.value.path()).read_text())['gameVersion'] == next_version
                print('PASS: cross-version import is rejected; saves and exports carry the release', flush=True)

                mismatch = page.evaluate('''() => {
                  NET.role = 'host'; NET.code = 'ABCD'; NET.started = false;
                  netIn({t:'hello', c:'ABCD', version:'1.0.1'});
                  return {started:NET.started, text:document.getElementById('net-status').textContent};
                }''')
                assert not mismatch['started'] and 'jinou verzi' in mismatch['text']
                page.evaluate("GAME.G.mode = 'host'")
                page.locator('#b-version').click()
                expect(page.locator('#version-dialog')).to_contain_text('odpojí od soupeře')
                page.keyboard.press('Escape')
                page.evaluate("GAME.G.mode = 'ai'")
                print('PASS: mixed-version network peers are rejected and switching warns about disconnecting', flush=True)

                page.locator('#b-version').click()
                page.locator('#switch-version').select_option('1.0.1')
                page.get_by_role('button', name='Přepnout verzi', exact=True).click()
                ready('1.0.1')
                page.goto(base)
                ready('1.0.1')
                expect(page.locator('#b-continue')).to_be_visible()
                page.evaluate("localStorage.setItem('vek-pokroku-selected-version', '9.9.9')")
                page.goto(base)
                ready(next_version)
                print('PASS: last selection persists; a removed/unknown selection falls back to latest', flush=True)

                page.set_viewport_size({'width': 360, 'height': 740})
                select = page.locator('#game-version')
                select.scroll_into_view_if_needed()
                box = select.bounding_box()
                assert box['x'] >= 0 and box['x'] + box['width'] <= 360
                page.screenshot(path='/tmp/vek-versions-mobile.png')
                page.locator('#b-start').click()
                page.locator('#b-version').click()
                expect(page.locator('#version-dialog')).to_be_visible()
                dialog_box = page.locator('#version-dialog').bounding_box()
                assert dialog_box['x'] >= 0 and dialog_box['x'] + dialog_box['width'] <= 360
                page.screenshot(path='/tmp/vek-versions-mobile-dialog.png')
                page.keyboard.press('Escape')
                page.set_viewport_size({'width': 1280, 'height': 900})
                page.locator('#b-version').click()
                page.screenshot(path='/tmp/vek-versions-desktop-dialog.png')
                page.keyboard.press('Escape')
                print('PASS: version controls fit a 360px display and the dialog supports keyboard cancellation', flush=True)

                blocked = context.new_page()
                blocked.on('pageerror', lambda error: errors.append(str(error)))
                blocked.add_init_script('''for (const method of ['getItem','setItem','removeItem']) {
                  Storage.prototype[method] = () => { throw new Error('Storage blocked for test'); };
                }''')
                blocked.goto(base)
                blocked.wait_for_function('!!window.GAME')
                blocked.locator('#b-start').click()
                blocked.locator('#b-version').click()
                blocked.locator('#switch-version').select_option('1.0.1')
                blocked.get_by_role('button', name='Přepnout verzi', exact=True).click()
                expect(blocked.locator('#version-dialog')).to_contain_text('nepodařilo uložit')
                assert next_version in blocked.url
                blocked.get_by_role('button', name='Přepnout bez uložení', exact=True).click()
                blocked.wait_for_url('**/versions/1.0.1/index.html')
                blocked.wait_for_function('!!window.GAME')
                print('PASS: blocked storage does not break play and requires an explicit unsaved switch', flush=True)

                assert not errors, errors
                browser.close()
            assert all((root / name).read_bytes() == contents for name, contents in original.items())
            print('PASS: no game JavaScript errors; archived 1.0.1 files stayed unchanged', flush=True)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    main()
