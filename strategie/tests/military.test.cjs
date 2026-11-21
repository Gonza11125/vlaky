const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
function simulation(){
 const Mock=class {constructor(){}};
 const ctx=vm.createContext({THREE:{Color:Mock,Matrix4:Mock,Quaternion:Mock,Vector3:Mock},console});
 for(const name of ['data.js','world.js','game.js','frontier.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,name),'utf8'),ctx);
 vm.runInContext("function msg(){} function alertAttack(){} function showEnd(){}",ctx);
 const run=js=>vm.runInContext(js,ctx);
 run("G.match.map='river';makeWorld(17417);teams.push(mkTeam(0),mkTeam(1));var mk=(id,team,type,x,z)=>{const u={id,isU:true,team,type,def:UNITS[type],x,z,hp:UNITS[type].hp,maxHp:UNITS[type].hp,dead:false,order:null,stance:0,cd:0,scan:0};byId.set(id,u);units.push(u);return u}");
 return run;
}
test('1.9: every unit has a training building, cost and a sensible profile',()=>{
 const run=simulation();
 assert.equal(run("Object.keys(UNITS).length"),19);
 assert.equal(run("Object.values(UNITS).every(d=>(d.at in BUILDINGS)&&d.cost&&d.hp>0&&d.speed>0&&(!d.req||d.req.every(r=>r in TECHS)))"),true);
 assert.equal(run("Object.values(TECHS).every(d=>(d.at in BUILDINGS)&&(!d.req||d.req.every(r=>r in TECHS)))"),true);
});
test('1.9: archery, armour and ballistics research change combat values',()=>{
 const run=simulation();
 run("var a=mk(1,0,'archer',10,10),c=mk(2,0,'catapult',12,10),s=mk(3,0,'sword',14,10)");
 assert.deepEqual(JSON.parse(run("JSON.stringify([rangeOf(a),atkOf(a),rangeOf(c),armorOf(s)])")),[9,5,14,2]);
 run("Object.assign(teams[0].tech,{composite:true,fletching:true,ballistics:true,shields:true,chainmail:true})");
 assert.deepEqual(JSON.parse(run("JSON.stringify([rangeOf(a),atkOf(a),rangeOf(c),armorOf(s),armorOf(a)])")),[11,9,16,4,1]);
});
test('1.9: walls, gates and towers may be built on bridges, houses may not',()=>{
 const run=simulation();
 run("var cell=bridgeMask.findIndex(Boolean),cx=cell%N,cy=Math.floor(cell/N)");
 assert.equal(run("canPlace('wall',cx,cy)&&canPlace('gate',cx,cy)&&canPlace('tower',cx,cy)"),true);
 assert.equal(run("canPlace('house',cx,cy)"),false);
});
test('1.9: stance command is limited to own soldiers; conscription shortens training',()=>{
 const run=simulation();
 run("var p=mk(5,0,'pike',20,20),v=mk(6,0,'vil',22,20),e=mk(7,1,'spear',24,20);execCmd(0,['stance',[5,6,7],2])");
 assert.deepEqual(JSON.parse(run("JSON.stringify([p.stance,v.stance,e.stance])")),[2,0,0]);
 run("teams[0].res.food=999;teams[0].res.wood=999;teams[0].res.metal=999;teams[0].tech.pikes=true;teams[0].tech.conscription=true;var b={team:0,queue:[]};enqueue(b,'u','pike');enqueue(b,'u','vil')");
 assert.deepEqual(JSON.parse(run("JSON.stringify(b.queue.map(q=>q.total))")),[Math.round(18*0.75),14]);
});
