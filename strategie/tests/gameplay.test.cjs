const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(process.env.GAME_SOURCE || path.join(__dirname, '..'));
function game() {
  // These tests exercise simulation and terrain arrays without a GPU or DOM.
  const context = vm.createContext({ THREE: { Color: class {}, Matrix4: class {}, Quaternion: class {}, Vector3: class {} }, console });
  for (const file of ['data.js', 'world.js', 'game.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  vm.runInContext(`function msg() {} function alertAttack() {} function showEnd() {} function showSaveOffer() {} function clearSave() {}`, context);
  return code => vm.runInContext(code, context);
}

test('map options reject invalid inputs and keep the zero seed', () => {
  const run = game();
  assert.equal(run(`matchOptions({seed:0}).seed`), 0);
  assert.equal(run(`matchOptions({peace:-1, resources:99, map:'unknown'}).peace`), 0);
  assert.equal(run(`matchOptions({seed:1.5}).seed`), null);
  assert.equal(run(`matchOptions({seed:4294967296}).seed`), null);
});

test('each terrain type is repeatable and connects both settlements', () => {
  for (const type of ['balanced', 'forest', 'highlands']) {
    const run = game();
    run(`G.match = matchOptions({map:'${type}'}); makeWorld(73);`);
    const first = run(`JSON.stringify({h:Array.from(hgt), n:nodes.map(n=>[n.type,n.cx,n.cy,n.amt])})`);
    assert.equal(run(`findPath(STARTS[0].cx-1,STARTS[0].cy+1,STARTS[1].cx-1,STARTS[1].cy+1,STARTS[1].cx-1,STARTS[1].cy+1,0).ok`), true, type);
    run(`makeWorld(73);`);
    assert.equal(run(`JSON.stringify({h:Array.from(hgt), n:nodes.map(n=>[n.type,n.cx,n.cy,n.amt])})`), first, type);
  }
});

test('forest maps contain more trees and highlands have higher terrain', () => {
  const run = game();
  run(`G.match=matchOptions(); makeWorld(73);`);
  const normalTrees = run(`nodes.filter(n=>n.type==='tree').length`);
  const normalHeight = run(`hgt.reduce((a,b)=>a+b,0)/hgt.length`);
  run(`G.match=matchOptions({map:'forest'}); makeWorld(73);`);
  assert.ok(run(`nodes.filter(n=>n.type==='tree').length`) > normalTrees);
  run(`G.match=matchOptions({map:'highlands'}); makeWorld(73);`);
  assert.ok(run(`hgt.reduce((a,b)=>a+b,0)/hgt.length`) > normalHeight);
});

test('resource density and initial stocks change usable quantities', () => {
  const run = game();
  run(`G.match=matchOptions({resources:0.6,stocks:2}); makeWorld(73);`);
  assert.equal(run(`nodes.find(n=>n.type==='tree').amt`), 60);
  assert.equal(run(`mkTeam(0).res.food`), 400);
  run(`G.match=matchOptions({resources:1.8}); makeWorld(73);`);
  assert.equal(run(`nodes.find(n=>n.type==='tree').amt`), 180);
});

test('peace prevents manual attacks and damage, then expires', () => {
  const run = game();
  run(`G.match=matchOptions({peace:120}); const target={team:1,hp:100,isU:true,def:{cls:'inf',armor:0},type:'vil'}; const attacker={team:0,isU:true};`);
  run(`hurt(target,attacker,10,'inf'); orderAttack(attacker,target);`);
  assert.equal(run(`target.hp`), 100);
  assert.equal(run(`attacker.order`), undefined);
  run(`G.time=120; teams.push(mkTeam(0),mkTeam(1)); hurt(target,attacker,10,'inf');`);
  assert.equal(run(`target.hp`), 90);
});

test('survival and development end only when their actual conditions are met', () => {
  const run = game();
  run(`teams.push(mkTeam(0),mkTeam(1)); G.match=matchOptions({goal:'survival',years:3}); G.time=719; checkVictory();`);
  assert.equal(run(`G.over`), false);
  run(`G.time=720; checkVictory();`);
  assert.equal(run(`G.loser`), 1);
  run(`G.over=false; G.mode='host'; checkVictory();`);
  assert.equal(run(`G.loser`), -1);
  run(`G.over=false; G.match=matchOptions({goal:'development'}); teams[1].era=2; teams[1].pop=20; teams[1].res.food=300; teams[1].res.gold=99; checkVictory();`);
  assert.equal(run(`G.over`), false);
  run(`teams[1].res.gold=100; checkVictory();`);
  assert.equal(run(`G.loser`), 0);
});

test('resource statistics count production, not the initial stock', () => {
  const run = game();
  run(`const T=mkTeam(0); gainResource(T,'food',12.5); gainResource(T,'food',5);`);
  assert.equal(run(`T.res.food`), 217.5);
  assert.equal(run(`T.stats.produced.food`), 17.5);
});
