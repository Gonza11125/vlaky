const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
function simulation(){
 const Mock=class {constructor(){}};
 const ctx=vm.createContext({THREE:{Color:Mock,Matrix4:Mock,Quaternion:Mock,Vector3:Mock},
   console,btoa:s=>Buffer.from(s,'binary').toString('base64'),
   atob:s=>Buffer.from(s,'base64').toString('binary')});
 for(const name of ['data.js','world.js','game.js','frontier.js'])
   vm.runInContext(fs.readFileSync(path.join(ROOT,name),'utf8'),ctx);
 vm.runInContext("function msg(){} function alertAttack(){} function showEnd(){}",ctx);
 return js=>vm.runInContext(js,ctx);
}
test('river seeds create three true pathfinding crossings',()=>{
 const run=simulation();
 for(const seed of [17417,20261120,777]){
   run("G.match.map='river';makeWorld("+seed+");");
   const mask1=run("JSON.stringify(Array.from(bridgeMask))");
   run("makeWorld("+seed+");");
   assert.equal(run("JSON.stringify(Array.from(bridgeMask))"),mask1);
   for(const cy of [24,55,86]){
     assert.ok(run("bridgeMask.reduce((n,v,i)=>n+(v&&Math.floor(i/N)==="+cy+"),0)")>11);
     assert.ok(run("(()=>{const x=Math.round(riverCenter("+cy+","+seed+"));return findPath(x-11,"+cy+",x+11,"+cy+",x+11,"+cy+",0).ok})()"));
   }
   assert.equal(run("findPath(23,87,85,25,85,25,0).ok"),true);
 }
});
test('old map types keep their original starts and no bridges',()=>{
 const run=simulation();
 for(const mode of ['balanced','forest','highlands']){
   run("G.match.map='"+mode+"';makeWorld(5044);");
   assert.equal(run("bridgeMask.some(Boolean)"),false);
   assert.equal(run("findPath(23,87,85,25,85,25,0).ok"),true);
 }
});
test('neutral sites are unique, accessible and deterministic',()=>{
 const run=simulation();
 run("G.match.map='river';makeWorld(17417);const sites=frontierLayout(17417);");
 assert.equal(run("sites.length"),6);
 assert.equal(run("new Set(sites.map(s=>s.name)).size"),6);
 assert.equal(run("sites.every(s=>walk[cidx(s.cx,s.cy)]&&!bridgeMask[cidx(s.cx,s.cy)])"),true);
 const layout=run("JSON.stringify(sites.map(s=>[s.name,s.cx,s.cy]))");
 run("makeWorld(17417)");
 assert.equal(run("JSON.stringify(frontierLayout(17417).map(s=>[s.name,s.cx,s.cy]))"),layout);
});
test('visit rewards happen only on arrival and once per team',()=>{
 const run=simulation();
 run("G.match.map='river';makeWorld(17417);teams.push(mkTeam(0),mkTeam(1));FRONTIER.sites=frontierLayout(17417)");
 run("const site=FRONTIER.sites[0];const worker={team:0,dead:false,x:1,z:1};units.push(worker);const before=teams[0].res.food");
 run("frontierTick(0.35)");
 assert.equal(run("teams[0].res.food===before"),true);
 run("worker.x=site.x;worker.z=site.z;frontierTick(0.36)");
 assert.equal(run("teams[0].res.food-before"),45);
 assert.equal(run("site.visited"),1);
 run("frontierTick(3)");
 assert.equal(run("teams[0].res.food-before"),45);
 run("const enemy={team:1,dead:false,x:site.x,z:site.z};units.push(enemy);frontierTick(0.35)");
 assert.equal(run("site.visited"),3);
 assert.equal(run("teams[1].res.food"),245);
 assert.equal(run("teams[0].stats.expeditions"),1);
});
test('visited flags persist; legacy imported saves stay legacy',()=>{
 const run=simulation();
 run("G.match.map='balanced';makeWorld(17417);FRONTIER.sites=frontierLayout(17417);FRONTIER.sites[0].visited=3");
 assert.equal(run("frontierSave()[0][1]"),3);
 run("const saved=frontierSave();frontierReset();FRONTIER.sites=frontierLayout(17417);frontierLoad(saved)");
 assert.equal(run("FRONTIER.sites[0].visited"),3);
 run("frontierLoad({broken:true})");
 assert.equal(run("FRONTIER.sites[0].visited"),3);
 run("FRONTIER.legacy=true");
 assert.equal(run("frontierSave()"),null);
});
test('journal discovery follows explored cells without showing unknown places',()=>{
 const run=simulation();
 run("G.match.map='river';makeWorld(17417);FRONTIER.sites=frontierLayout(17417)");
 assert.equal(run("frontierSummary(0).seen"),0);
 run("explored[cidx(FRONTIER.sites[0].cx,FRONTIER.sites[0].cy)]=1");
 assert.equal(run("frontierSummary(0).seen"),1);
 assert.equal(run("frontierSummary(0).visited"),0);
});
test('1.7.1: computer opponent scouts unvisited sites with a rider first',()=>{
 const run=simulation();
 run("G.match.map='river';G.diff=1;makeWorld(17417);teams.push(mkTeam(0),mkTeam(1));teams[0].tcx=10;teams[0].tcz=200;FRONTIER.sites=frontierLayout(17417);G.time=50");
 run("const mk=(id,type,x,z)=>{const u={id,isU:true,team:1,type,def:UNITS[type],x,z,hp:50,dead:false,order:null};byId.set(id,u);units.push(u);return u};const vil=mk(901,'vil',150,40),rider=mk(902,'rider',150,42);const mine=[vil,rider]");
 run("frontierAiScout(mine)");
 assert.equal(run("AI.scout"),0,'too early on medium difficulty');
 run("G.time=200;frontierAiScout(mine);AI.scoutNext=0;frontierAiScout(mine)");
 assert.equal(run("AI.scout===rider.id"),true);
 assert.equal(run("!!(rider.order&&rider.order.scout)"),true);
 run("FRONTIER.sites.forEach(s=>s.visited|=2);AI.scoutNext=0;frontierAiScout(mine)");
 assert.equal(run("AI.scout"),0);
});
