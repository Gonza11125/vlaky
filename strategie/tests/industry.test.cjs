const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root=path.resolve(__dirname,'..');
function game(){
 const ctx=vm.createContext({THREE:{Color:class{},Matrix4:class{},Quaternion:class{},Vector3:class{}},
   console,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary')});
 for(const f of ['data.js','world.js','game.js'])
   vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
 vm.runInContext('function msg(){} function alertAttack(){} function showEnd(){}',ctx);
 return code=>vm.runInContext(code,ctx);
}
function setup(run){
 run("teams.push(mkTeam(0),mkTeam(1));const T=teams[0];T.res.grain=20;T.res.flour=0;T.res.ore=20;");
 run("const mill={id:10,team:0,type:'mill',def:BUILDINGS.mill,isB:true,done:true,dead:false,enabled:true,priority:2,target:0,fire:0,x:40,z:40,y:2,size:2,cx:19,cy:19,queue:[]};");
 run("const bakery={...mill,id:11,type:'bakery',def:BUILDINGS.bakery,x:50};const smelter={...mill,id:12,type:'smelter',def:BUILDINGS.smelter,x:60};");
 run("blds.push(mill,bakery,smelter);byId.set(10,mill);byId.set(11,bakery);byId.set(12,smelter);G.flood=0;G.mode='ai';G.real=false;");
}
test('classic production uses existing material ratios without workers',()=>{
 const run=game();setup(run);
 run('productionTick(mill,5);productionTick(bakery,5);productionTick(smelter,5);');
 assert.equal(run('T.res.grain'),18);
 assert.equal(run('T.res.flour'),0.25);
 assert.ok(Math.abs(run('T.res.food')-203.5)<1e-8);
 assert.ok(Math.abs(run('T.res.metal')-1.5)<1e-8);
 assert.ok(Math.abs(run('T.res.ore')-17)<1e-8);
});
test('reserves, output targets, power and nonnegative materials are enforced',()=>{
 const run=game();setup(run);
 run('T.res.grain=5;T.city.reserves.grain=4;productionTick(mill,20);');
 assert.equal(run('T.res.grain'),4);assert.equal(run('T.res.flour'),1);
 run('T.city.reserves.grain=0;mill.target=50;T.res.flour=49.5;productionTick(mill,40);');
 assert.equal(run('T.res.flour'),50);
 run('mill.priority=0;mill.target=0;const p=T.res.grain;productionTick(mill,40);');
 assert.equal(run('p===T.res.grain'),true);
 run('smelter.priority=3;T.res.ore=1;T.city.reserves.ore=1;productionTick(smelter,10);');
 assert.equal(run('T.res.ore'),1);
});
test('realistic industry needs a present worker, and experts produce more',()=>{
 const run=game();setup(run);
 run('G.real=true;productionTick(mill,10);');
 assert.equal(run('T.res.flour'),0);
 assert.equal(run('industryStatus(mill)'),'Chybí řemeslník');
 run("const u={id:71,isU:true,type:'vil',team:0,dead:false,def:UNITS.vil,x:41,z:41,hp:40,maxHp:40,path:null,order:{type:'craft',b:mill},exp:{craft:0}};mill.crafter=u;units.push(u);");
 assert.equal(run('craftWorkerReady(mill)'),true);
 const novice=run('industryTick(mill,1)');
 run('u.exp.craft=360;');
 const master=run('industryTick(mill,1)');
 assert.ok(master>novice);assert.equal(run("professionLevel(u,'craft')"),4);
 run('u.path=[{x:50,z:50}];');
 assert.equal(run('industryStatus(mill)'),'Řemeslník přichází');
 run('G.real=false;');
 assert.equal(run("professionBonus(u,'craft')"),1);
});
test('rolling accounts reflect actual flows and trim the old samples',()=>{
 const run=game();setup(run);
 run('industryTick(mill,5);economyAdvance(T,10);');
 assert.equal(run("economyRate(T,'grain').use"),12);
 assert.equal(run("economyRate(T,'flour').gain"),12);
 run('for(let i=0;i<80;i++)economyAdvance(T,10);');
 assert.equal(run('economyState(T).history.length'),6);
 assert.equal(run("economyRate(T,'grain').use"),0);
});
test('commands validate owner, priority, reserve and stock target',()=>{
 const run=game();setup(run);
 run("execCmd(1,['industry',10,'priority',3]);execCmd(0,['industry',10,'priority',99]);execCmd(0,['industry',10,'target',9999]);");
 assert.equal(run('mill.priority'),2);assert.equal(run('mill.target'),0);
 run("execCmd(0,['city','reserve',-50,'wood']);");
 assert.equal(run('cityState(T).reserves.wood'),20);
 run("execCmd(0,['city','reserve',50,'wood']);execCmd(0,['industry',10,'priority',3]);execCmd(0,['industry',10,'target',150]);");
 assert.equal(run('cityState(T).reserves.wood'),50);
 assert.equal(run('mill.priority'),3);assert.equal(run('mill.target'),150);
});
test('industry automation never overwrites a villager manual order',()=>{
 const run=game();setup(run);
 run("G.real=true;T.city.auto=true;T.city.priorities.industry=3;const manual={id:71,type:'vil',team:0,dead:false,order:{type:'gather'},hp:40,maxHp:40,x:35,z:35};units.push(manual);industryStaff(T);");
 assert.equal(run('manual.order.type'),'gather');
 assert.equal(run('craftStaffFree(mill)'),true);
});
test('craft orders and economic metadata survive serialization',()=>{
 const run=game();setup(run);
 run("const worker={id:55,isU:true,type:'vil',team:0,x:40,z:40,def:UNITS.vil,hp:40,maxHp:40,carry:0,ctype:null,face:0,exp:{craft:200},order:{type:'craft',b:mill}};units.push(worker);byId.set(55,worker);mill.crafter=worker;");
 run('const packed=packOrder(worker.order);const restored=unpackOrder(worker,packed,new Map());');
 assert.equal(run('packed.type'),'craft');assert.equal(run('restored.b===mill'),true);
 run('mill.priority=3;mill.target=300;const saved=saveState();');
 assert.equal(run('saved.blds.find(b=>b.id===10).priority'),3);
 assert.equal(run('saved.blds.find(b=>b.id===10).target'),300);
 assert.equal(run('saved.units.find(u=>u.id===55).exp.craft'),200);
 assert.ok(run('!!saved.teams[0].economy'));
});
test('realistic supply distance does not modify navigation',()=>{
 const run=game();setup(run);
 run("G.real=true;walk.fill(1);resv.fill(0);const far=industryLogistics(mill);const hub={id:20,team:0,type:'store',def:BUILDINGS.store,done:true,dead:false,x:39,z:40,size:2};blds.push(hub);const near=industryLogistics(mill);");
 assert.equal(run('near'),1);assert.ok(run('near>=far'));
 assert.equal(run('walk.every(x=>x===1)'),true);
});
