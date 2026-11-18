const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(process.env.GAME_SOURCE || path.join(__dirname, '..'));
const fakeThree = {
  Color: class {}, Matrix4: class { compose() { return this; } },
  Quaternion: class { setFromAxisAngle() { return this; } },
  Vector3: class { constructor(x,y,z) { this.x=x; this.y=y; this.z=z; } },
  PlaneGeometry: class { dispose() {} },
  MeshLambertMaterial: class { dispose() {} },
  InstancedMesh: class {
    constructor(geometry,material,count) { Object.assign(this,{geometry,material,count,instanceMatrix:{needsUpdate:false}}); }
    setMatrixAt() {}
  },
  DoubleSide: 2,
};
function game() {
  const ctx = vm.createContext({
    THREE: fakeThree, console,
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    atob: s => Buffer.from(s, 'base64').toString('binary'),
  });
  for (const file of ['data.js', 'world.js', 'game.js'])
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx);
  vm.runInContext('function msg() {} function alertAttack() {} function showEnd() {} function showSaveOffer() {} function clearSave() {}',ctx);
  return code => vm.runInContext(code,ctx);
}
function setup(run) {
  run('teams.push(mkTeam(0),mkTeam(1)); walk.fill(1); hgt.fill(1);');
}
test('city priorities are validated for player and remote commands', () => {
  const run=game();setup(run);
  run("execCmd(0,['city','food',1]);execCmd(0,['city','food',9]);execCmd(0,['city','auto',true]);execCmd(0,['city','auto','false']);");
  assert.equal(run('teams[0].city.priorities.food'),1);
  assert.equal(run('teams[0].city.auto'),true);
});
test('automation assigns only idle workers according to allowed priorities', () => {
  const run=game();setup(run);
  run("const T=teams[0]; T.city.auto=true; Object.keys(T.city.priorities).forEach(k=>T.city.priorities[k]=k==='wood'?3:0);");
  run("nodes.push({id:0,type:'tree',def:NODE_DEF.tree,amt:100,x:24,z:24,cx:12,cy:12});");
  run("units.push({id:101,team:0,type:'vil',def:UNITS.vil,hp:40,maxHp:40,x:22,z:22,order:null,ctype:null,carry:0});cityAssignJobs(teams[0]);");
  assert.equal(run("units[0].order.type"),'gather');
  assert.equal(run("units[0].order.node.type"),'tree');
  run("const first=units[0].order;cityAssignJobs(teams[0]);");
  assert.equal(run("units[0].order===first"),true);
  assert.equal(run("cityCensus(0).gathering"),1);
});
test('classic has no building wear and repairs do not consume material', () => {
  const run=game();setup(run);
  run("const b={team:0,type:'house',done:true,hp:100,maxHp:200,def:{wall:false},queue:[],fire:0};G.real=false;updateBuilding(b,10);cityRepair(b,teams[0],1);");
  assert.equal(run('b.hp'),110);
  assert.equal(run('teams[0].res.wood'),200);
});
test('realistic mode has mild building wear and wood-paid repairs', () => {
  const run=game();setup(run);
  run("const b={team:0,type:'house',done:true,hp:100,maxHp:200,def:{wall:false},queue:[],fire:0};G.real=true;updateBuilding(b,10);const worn=b.hp;cityRepair(b,teams[0],1);");
  assert.ok(run('worn')<100);
  assert.ok(run('b.hp')>run('worn'));
  assert.ok(run('teams[0].res.wood')<200);
});
test('morale affects only realistic simulation', () => {
  const run=game();setup(run);
  run("teams[0].city.morale=80;teams[0].hungry=true;G.real=true;cityMorale(teams[0],10);");
  assert.ok(run('teams[0].city.morale')<80);
  run('G.real=false;cityMorale(teams[0],10);');
  assert.equal(run('teams[0].city.morale'),100);
});
test('city state is included in saved games', () => {
  const run=game();setup(run);
  run("teams[0].city.auto=true; const saved=saveState();");
  assert.equal(run('saved.teams[0].city.auto'),true);
  assert.equal(run('saved.teams[0].city.priorities.food'),3);
});
test('roads are generated between buildings without changing walking grid', () => {
  const run=game();setup(run);
  run("scene={add(){},remove(){}};terrain={}; const hub={team:0,type:'tc',cx:12,cy:12,size:3,x:27,z:27,done:true,dead:false,def:{wall:false}}; const house={team:0,type:'house',cx:24,cy:18,size:2,x:50,z:38,done:true,dead:false,def:{wall:false}};blds.push(hub,house);const walkBefore=walk.slice();updateCityRoads();const roadsResult={segments:cityRoadCells.length,unchanged:walk.every((v,i)=>v===walkBefore[i]),dirty:cityRoadDirty};");
  assert.ok(run('roadsResult.segments')>0);
  assert.equal(run('roadsResult.unchanged'),true);
  assert.equal(run('roadsResult.dirty'),false);
});
test('realistic idle walkers remain available for manual orders', () => {
  const run=game();setup(run);
  run("G.real=true; const home={team:0,type:'house',cx:20,cy:20,size:2,x:42,z:42,done:true,dead:false,def:{wall:false}}; blds.push(home); const u={id:88,team:0,type:'vil',def:UNITS.vil,x:22,z:22,hp:40,maxHp:40,cd:0,order:null,leisureTimer:0};units.push(u);updateUnit(u,0.1);");
  assert.equal(run('units[0].order'),null);
  run('orderMove(units[0],30,30);');
  assert.equal(run('units[0].order.type'),'move');
});
