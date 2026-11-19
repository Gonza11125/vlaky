const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'ui.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'play.html'), 'utf8');

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => { values.set(key, String(value)); },
  };
}
function reader(localStorage) {
  const start = source.indexOf('const saveVersion =');
  const end = source.indexOf('const CLOUD =', start);
  const beginLocal = source.indexOf('function readLocal()');
  const endLocal = source.indexOf('function readCloud()', beginLocal);
  assert.ok(start >= 0 && end > start && beginLocal > end && endLocal > beginLocal);
  return new Function('localStorage', 'VEK_RELEASE', 'SAVE_KEY',
    source.slice(start, end) + '\n' + source.slice(beginLocal, endLocal) +
    '\nreturn { readLocal, saveValid, saveMatchesVersion };'
  )(localStorage, { id: '1.6.0' }, 'vek-pokroku-save-1.6.0');
}
const fixture = (version='1.5.0',time=90) => ({
  v: 1, gameVersion: version, seed: 73, saved: Date.now(),
  G: { time }, AI: {}, PRICE: {}, explored: 'AAAA',
  teams: [{ era: 0, res: {}, tech: {} }, { era: 0, res: {}, tech: {} }],
  amt: [], meat: [], blds: [], units: [], animals: [],
});

test('1.5.0 save migrates on first visit and stays intact', () => {
  const previous=JSON.stringify(fixture());
  const local=storage({'vek-pokroku-save-1.5.0':previous});
  const loaded=reader(local).readLocal();
  assert.equal(loaded.gameVersion,'1.6.0');
  assert.equal(local.getItem('vek-pokroku-save-1.5.0'),previous);
  assert.equal(JSON.parse(local.getItem('vek-pokroku-save-1.6.0')).gameVersion,'1.6.0');
});
test('1.4.0, 1.3.0, 1.2.0 and 1.1.0 remain fallback sources', () => {
  for(const version of ['1.4.0','1.3.0','1.2.0','1.1.0']) {
    const raw=JSON.stringify(fixture(version));
    const local=storage({['vek-pokroku-save-'+version]:raw});
    assert.equal(reader(local).readLocal().gameVersion,'1.6.0');
    assert.equal(local.getItem('vek-pokroku-save-'+version),raw);
  }
});
test('incomplete save is rejected without overwriting another edition', () => {
  const bad=fixture();
  delete bad.animals;
  const local=storage({'vek-pokroku-save-1.5.0':JSON.stringify(bad)});
  assert.equal(reader(local).readLocal(),null);
  assert.equal(local.getItem('vek-pokroku-save-1.6.0'),null);
});
test('existing 1.6.0 save takes precedence', () => {
  const local=storage({
    'vek-pokroku-save-1.5.0':JSON.stringify(fixture('1.5.0',90)),
    'vek-pokroku-save-1.6.0':JSON.stringify(fixture('1.6.0',250)),
  });
  assert.equal(reader(local).readLocal().G.time,250);
});
test('city, economy, sound, atmosphere and graphics controls are unique', () => {
  for(const id of ['b-help','b-menu','help','b-help-close','pause-menu',
    'b-resume','b-return','b-help-done','b-city','city-panel',
    'city-art-quality','city-art-hint','b-economy','economy-panel','b-economy-close','economy-lines','b-sound','s-atmo','atmo-day','atmo-quality','atmo-volume','b-atmo-sound']) {
    assert.equal(html.split('id="'+id+'"').length-1,1,id);
  }
  assert.match(html,/aria-modal="true"/);
  assert.match(source,/if \(e\.code === 'F1'\)/);
  assert.match(source,/cityArtAnimate\(t, dt\)/);
});
