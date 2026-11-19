const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
function runGame() {
  const mockThree = { Color: class {} };
  const ctx = vm.createContext({ THREE: mockThree, console, btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary') });
  for (const file of ['data.js', 'world.js', 'game.js'])
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx);
  return src => vm.runInContext(src, ctx);
}
test('construction phases use actual in-game progress', () => {
  const run=runGame();
  assert.equal(run("cityArtStage({done:false,prog:0.1})"),'Základy');
  assert.equal(run("cityArtStage({done:false,prog:0.4})"),'Nosná konstrukce');
  assert.equal(run("cityArtStage({done:false,prog:0.7})"),'Střecha');
  assert.equal(run("cityArtStage({done:false,prog:0.95})"),'Dokončovací práce');
  assert.equal(run("cityArtStage({done:true,prog:1})"),'Hotovo');
});
test('worker poses change between walking, gathering and building', () => {
  const run=runGame();
  const a=run("cityArtWorkPose('move',1,7,false,true)");
  const b=run("cityArtWorkPose('build',1,7,true,false)");
  const c=run("cityArtWorkPose('gather',1,7,true,false)");
  assert.notEqual(a.left, b.left);
  assert.notEqual(b.tool, c.tool);
  assert.equal(run("cityArtWorkPose(null,1,7,false,false).left"),0);
});
test('quality settings validate input and cap pixel ratio for low mode', () => {
  const run=runGame();
  assert.equal(run("cityArtSetQuality('invalid')"),false);
  assert.equal(run("CITY_ART.quality"),'auto');
  assert.equal(run("cityArtSetQuality('low')"),true);
  assert.equal(run("cityArtPixelRatio(2)"),1.1);
  assert.equal(run("cityArtSetQuality('high')"),true);
  assert.equal(run("cityArtPixelRatio(2)"),2);
  run("CITY_ART.quality='auto';G.coarse=true");
  assert.equal(run("cityArtQuality()"),'low');
});
test('decorative plan is repeatable, bounded and never changes the walking grid', () => {
  const run=runGame();
  run("walk.fill(1); nodeAt.fill(-1);const testB=[{id:1,type:'house',team:0,done:true,dead:false,cx:24,cy:24,size:2,x:50,z:50,mesh:{},def:{wall:false}}];");
  const a=run("JSON.stringify(cityArtDecorPlan(testB,0,[],'high'))");
  const b=run("JSON.stringify(cityArtDecorPlan(testB,0,[],'high'))");
  assert.equal(a,b);
  assert.equal(run("cityArtDecorPlan(testB,0,[],'low').length"),1);
  assert.equal(run("walk.every(v=>v===1)"),true);
  const item=JSON.parse(a)[0];
  const blocked=run("const d=cityArtDecorPlan(testB,0,[],'high')[0];const r=[cidx(cellOf(d.x),cellOf(d.z))];cityArtDecorPlan(testB,0,r,'high').length");
  assert.ok(blocked<JSON.parse(a).length);
  assert.equal(item.kind,'fence');
});
test('construction and environment metadata never enters serialized gameplay state', () => {
  const run=runGame();
  run("teams.push(mkTeam(0),mkTeam(1));");
  assert.ok(run("saveState().teams[0].city")!==undefined);
  assert.equal(run("Object.keys(saveState()).includes('CITY_ART')"),false);
});
test('unit geometry cache records era for buildings but not units', () => {
  const code=fs.readFileSync(path.join(root,'game.js'),'utf8');
  assert.match(code,/kind === 'b' \? teams\[team\]\.era/);
  assert.match(code,/buildingGeo\(type, TEAM_COLORS\[team\], era\)/);
});
