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
  )(localStorage, { id: '1.3.0' }, 'vek-pokroku-save-1.3.0');
}
const fixture = () => ({
  v: 1, gameVersion: '1.2.0', seed: 73, saved: Date.now(),
  G: { time: 90 }, AI: {}, PRICE: {}, explored: 'AAAA',
  teams: [{ era: 0, res: {}, tech: {} }, { era: 0, res: {}, tech: {} }],
  amt: [], meat: [], blds: [], units: [], animals: [],
});

test('valid 1.2.0 save migrates on first visit, without modifying original', () => {
  const previous = JSON.stringify(fixture());
  const local = storage({ 'vek-pokroku-save-1.2.0': previous });
  const loaded = reader(local).readLocal();
  assert.equal(loaded.gameVersion, '1.3.0');
  assert.equal(local.getItem('vek-pokroku-save-1.2.0'), previous);
  assert.equal(JSON.parse(local.getItem('vek-pokroku-save-1.3.0')).gameVersion, '1.3.0');
});

test('an incomplete previous save is never migrated', () => {
  const incomplete = fixture();
  delete incomplete.animals;
  const local = storage({ 'vek-pokroku-save-1.2.0': JSON.stringify(incomplete) });
  assert.equal(reader(local).readLocal(), null);
  assert.equal(local.getItem('vek-pokroku-save-1.3.0'), null);
});

test('1.1.0 save is used if no 1.2.0 save exists', () => {
  const previous = fixture();
  previous.gameVersion = '1.1.0';
  const local = storage({ 'vek-pokroku-save-1.1.0': JSON.stringify(previous) });
  const loaded = reader(local).readLocal();
  assert.equal(loaded.gameVersion, '1.3.0');
  assert.equal(JSON.parse(local.getItem('vek-pokroku-save-1.1.0')).gameVersion, '1.1.0');
});

test('new save takes precedence over older release save', () => {
  const current = fixture();
  current.gameVersion = '1.3.0';
  current.G.time = 250;
  const local = storage({
    'vek-pokroku-save-1.2.0': JSON.stringify(fixture()),
    'vek-pokroku-save-1.3.0': JSON.stringify(current),
  });
  assert.equal(reader(local).readLocal().G.time, 250);
});

test('game menu and help controls are present exactly once', () => {
  for (const id of ['b-help', 'b-menu', 'help', 'b-help-close',
                    'pause-menu', 'b-resume', 'b-return', 'b-help-done']) {
    assert.equal(html.split('id="' + id + '"').length - 1, 1, id);
  }
  assert.match(html, /aria-modal="true"/);
  assert.match(source, /if \(e\.code === 'F1'\)/);
});
