const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
function simulation(){
 const Mock=class {constructor(){}};
 const ctx=vm.createContext({THREE:{Color:Mock,Matrix4:Mock,Quaternion:Mock,Vector3:Mock},console});
 for(const name of ['data.js','world.js','game.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,name),'utf8'),ctx);
 vm.runInContext("var shown=[];function msg(t){shown.push(t)} function alertAttack(){} function showEnd(){}",ctx);
 return js=>vm.runInContext(js,ctx);
}
test('2.1: co-op runs the computer opponent for the host and routes messages to the partner',()=>{
 const run=simulation();
 run("G.mode='host';G.coop=false;MY=0;NET.out=[]");
 assert.equal(run("aiOn()"),false);
 run("say(1,'pro soupeře');say(0,'pro hostitele')");
 assert.deepEqual(JSON.parse(run("JSON.stringify([NET.out.length,shown.length])")),[1,1]);
 run("G.coop=true;NET.out=[];shown=[];say(1,'počítač');say(0,'oba')");
 assert.equal(run("aiOn()"),true);
 assert.equal(run("peerTeam()"),0);
 assert.deepEqual(JSON.parse(run("JSON.stringify([NET.out.map(m=>m[0]),shown])")),[['oba'],['oba']]);
 run("G.mode='ai';G.coop=true");
 assert.equal(run("aiOn()"),true);
});
