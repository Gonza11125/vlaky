const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'renaissance.js'),'utf8');
function make(){
 const values=new Map();
 const ctx=vm.createContext({
  cityArtQuality:()=> 'high',G:{paused:false,coarse:false},
  localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},
  console,
 });
 vm.runInContext(code,ctx);
 return {run:s=>vm.runInContext(s,ctx),values};
}
test('procedural walk swings arms and legs in opposite directions',()=>{
 const {run}=make();
 const pose=run("renaissancePose('move',1.2,8,false,true,false,0)");
 assert.notEqual(pose.leftLeg,0);
 assert.ok(Math.abs(pose.leftLeg+pose.rightLeg)<1e-9);
 assert.ok(Math.abs(pose.leftArm+pose.rightArm)<1e-9);
 assert.ok(pose.bounce>=0);
});
test('idle breathes softly but keeps feet planted',()=>{
 const {run}=make();
 const pose=run("renaissancePose(null,1.2,8,false,false,false,0)");
 assert.equal(pose.leftLeg,0);
 assert.equal(pose.rightLeg,0);
 assert.equal(pose.bounce,0);
 assert.ok(Math.abs(pose.bodyLean)<0.02);
});
test('work, combat and taking a hit have distinct poses',()=>{
 const {run}=make();
 const build=run("renaissancePose('build',1.7,3,true,false,false,0)");
 const fight=run("renaissancePose('attack',1.7,3,true,false,true,0)");
 const struck=run("renaissancePose('attack',1.7,3,true,false,true,0.18)");
 assert.notEqual(build.rightArm,fight.rightArm);
 assert.notEqual(fight.tool,build.tool);
 assert.notEqual(struck.hit,0);
});
test('unrecognized graphics settings are rejected and do not persist',()=>{
 const {run,values}=make();
 assert.equal(run("renaissanceSet('enabled',true)"),true);
 assert.equal(run("renaissanceSet('unknown',false)"),false);
 assert.equal(run("renaissanceSet('motion',0)"),false);
 assert.equal(run('RENAISSANCE.motion'),true);
 assert.equal(values.size,1);
});
test('graphics settings are local, and never touch simulation speed',()=>{
 const {run,values}=make();
 run("G.speed=3;renaissanceSet('motion',false);");
 assert.equal(run('G.speed'),3);
 const saved=JSON.parse(values.get('vek-pokroku-renaissance-2'));
 assert.equal(saved.motion,false);
 assert.equal(saved.enabled,true);
});
test('graphics LOD respects the existing quality tier',()=>{
 const {run}=make();
 assert.equal(run('renaissanceDetail()'),true);
 run('RENAISSANCE.enabled=false');
 assert.equal(run('renaissanceDetail()'),false);
});
test('game releases visual entities after death, reset and scene transitions',()=>{
 const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
 const ui=fs.readFileSync(path.join(root,'ui.js'),'utf8');
 assert.match(game,/renaissanceDeath\(e\)/);
 assert.match(game,/renaissanceRemove\(e\)/);
 assert.match(game,/renaissanceClear\(\)/);
 assert.match(ui,/renaissanceFrame\(t,dt\)/);
 assert.match(ui,/u\.renRig/);
});
test('graphics toggle and material layer do not become game saves or network data',()=>{
 const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
 const net=fs.readFileSync(path.join(root,'net.js'),'utf8');
 assert.doesNotMatch(net,/RENAISSANCE|renaissance/);
 const save=game.slice(game.indexOf('function saveState()'),game.indexOf('function loadState('));
 assert.doesNotMatch(save,/renaissance|RENAISSANCE|renRig|renVehicle/);
});
test('graphics facade and rig have bounded budgets and pooled geometries',()=>{
 assert.match(code,/unitLimit:92,buildingLimit:55/);
 assert.match(code,/if\(RENAISSANCE\.shapes\)return;/);
 assert.match(code,/Math\.hypot\(u\.x-cam\.x,u\.z-cam\.z\)<range/);
 assert.match(code,/RENAISSANCE\.corpses\.length>=12/);
});

test('distant rigs can be evicted and visual budget reused without touching simulation',()=>{
 const {run}=make();
 // Pure range decision uses only camera position and visibility.
 run("cam={x:5,z:5};const e={x:8,z:9,mesh:{visible:true}}");
 assert.equal(run('renaissanceOutOfRange(e,6)'),false);
 assert.equal(run('renaissanceOutOfRange(e,4)'),true);
 run('e.mesh.visible=false');
 assert.equal(run('renaissanceOutOfRange(e,100)'),true);
 assert.equal(run("G.speed=2;RENAISSANCE.rigs=92;G.speed"),2);
});
