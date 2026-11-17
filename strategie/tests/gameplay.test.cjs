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

const economy = fs.readFileSync(path.join(root, 'game.js'), 'utf8').includes('function productionTick');
test('grain, flour and bread consume real inputs; paused factories make nothing', { skip: !economy }, () => {
  const run = game();
  run(`teams.push(mkTeam(0),mkTeam(1)); const T=teams[0]; T.res.grain=2; const mill={type:'mill',team:0,enabled:true,y:1}; const bakery={type:'bakery',team:0,enabled:true,y:1}; productionTick(mill,5);`);
  assert.equal(run(`T.res.grain`), 0);
  assert.equal(run(`T.res.flour`), 2);
  run(`productionTick(bakery,5);`);
  assert.equal(run(`T.res.food`), 203.5);
  assert.equal(run(`T.res.flour`), 0.25);
  assert.ok(Math.abs(run(`T.res.wood`) - 199.65) < 1e-8);
  run(`bakery.enabled=false; productionTick(bakery,20);`);
  assert.equal(run(`T.res.flour`), 0.25);
  run(`bakery.enabled=true; T.res.wood=0; productionTick(bakery,20);`);
  assert.equal(run(`T.res.food`), 203.5);
});

test('foresters restore depleted trees without generating wood or growing through buildings', { skip: !economy }, () => {
  const run = game();
  run(`teams.push(mkTeam(0),mkTeam(1)); makeWorld(73); const n=nodes.find(n=>n.type==='tree'); n.amt=0; nodeAt[cidx(n.cx,n.cy)]=-1; const f={type:'forester',team:0,enabled:true,y:1,x:n.x,z:n.z,workT:29}; productionTick(f,1);`);
  assert.equal(run(`n.amt`), 100);
  assert.equal(run(`teams[0].stats.regrown`), 1);
  assert.equal(run(`teams[0].res.wood`), 200);
  run(`n.amt=0; nodeAt[cidx(n.cx,n.cy)]=-1; resv[cidx(n.cx,n.cy)]=1; productionTick(f,30);`);
  assert.equal(run(`n.amt`), 0);
  assert.equal(run(`teams[0].stats.regrown`), 1);
});

function caravanGame() {
  const run = game();
  run(`teams.push(mkTeam(0),mkTeam(1)); walk.fill(1); hgt.fill(1);
    const from={id:10,type:'market',team:0,done:true,dead:false,isB:true,size:3,cx:8,cy:8,x:19,z:19};
    const to={...from,id:11,cx:40,x:83}; byId.set(10,from); byId.set(11,to);
    const u={id:12,type:'caravan',team:0,def:UNITS.caravan,x:19,z:23,carry:0,path:null};`);
  return run;
}

test('caravans earn gold only after a real outbound and return journey', { skip: !economy }, () => {
  const run = caravanGame();
  assert.equal(run(`tradeRoute(u,from,to)`), true);
  run(`for(let i=0;i<1000 && !u.order.loaded;i++) updateCaravan(u,0.1);`);
  assert.equal(run(`u.order.loaded`), true);
  assert.equal(run(`teams[0].res.gold`), 0);
  assert.equal(run(`u.carry`), 14);
  run(`for(let i=0;i<1000 && teams[0].res.gold===0;i++) updateCaravan(u,0.1);`);
  assert.equal(run(`teams[0].res.gold`), 14);
  assert.equal(run(`teams[0].stats.tradeGold`), 14);
  assert.equal(run(`isSoldier(u)`), false);
  run(`to.dead=true; updateCaravan(u,0.1);`);
  assert.equal(run(`u.order`), null);
});

test('short, enemy and impassable trade routes are rejected', { skip: !economy }, () => {
  const run = caravanGame();
  assert.equal(run(`tradeRoute(u,from,{...to,x:30,cx:13})`), false);
  assert.equal(run(`tradeRoute(u,from,{...to,team:1})`), false);
  run(`for(let y=0;y<N;y++) walk[cidx(25,y)]=0;`);
  assert.equal(run(`tradeRoute(u,from,to)`), false);
  assert.equal(run(`teams[0].res.gold`), 0);
});

test('trade orders preserve both endpoints and loaded state through serialization', { skip: !economy }, () => {
  const run = caravanGame();
  run(`tradeRoute(u,from,to); u.order.returning=true; u.order.loaded=true; const packed=packOrder(u.order); const restored=unpackOrder(u,packed,new Map());`);
  assert.equal(run(`restored.from===from && restored.to===to && restored.returning && restored.loaded`), true);
});
