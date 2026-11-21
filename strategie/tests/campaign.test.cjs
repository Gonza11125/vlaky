const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
function simulation(store={}){
 const Mock=class {constructor(){}};
 const localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v);}};
 const ctx=vm.createContext({THREE:{Color:Mock,Matrix4:Mock,Quaternion:Mock,Vector3:Mock},console,localStorage});
 for(const name of ['data.js','world.js','game.js','frontier.js','campaign.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,name),'utf8'),ctx);
 vm.runInContext("var ended=null;function msg(){} function alertAttack(){} function showEnd(){} endGame=(l,r)=>{ended=[l,r];G.over=true;};",ctx);
 const run=js=>vm.runInContext(js,ctx);
 run("G.match.map='river';makeWorld(17417);teams.push(mkTeam(0),mkTeam(1));G.mode='ai';MY=0;G.hist=[]");
 return run;
}
test('2.0: missions are ordered, unlock one by one and start with their own rules',()=>{
 const store={},run=simulation(store);
 assert.equal(run("CAMPAIGN.length"),6);
 assert.equal(run("campaignUnlocked(0)&&!campaignUnlocked(1)"),true);
 assert.equal(run("campaignStart('c2')"),false);
 assert.equal(run("campaignStart('c1')"),true);
 assert.deepEqual(JSON.parse(run("JSON.stringify([G.campaign,G.diff,G.aggr,G.match.peace,G.match.resources])")),['c1',0,0,600,1.8]);
 store['vek-pokroku-campaign']=JSON.stringify({done:['c1']});
 assert.equal(run("campaignUnlocked(1)"),true);
});
test('2.0: mission checks decide victory and defeat in the simulation',()=>{
 const run=simulation();
 run("campaignStart('c1');G.time=241;teams[0].pop=7;campaignTick(1)");
 assert.equal(run("ended[0]"),0);
 assert.match(run("ended[1]"),/nesplněna/);
 run("G.over=false;ended=null;teams[0].pop=12;campaignTick(1)");
 assert.equal(run("ended[0]"),1);
 run("G.over=false;ended=null;G.campaign='c3';G.time=100;FRONTIER.sites=frontierLayout(17417);FRONTIER.sites.slice(0,3).forEach(s=>s.owner=0);campaignTick(1)");
 assert.equal(run("ended&&ended[0]"),1);
 run("G.over=false;ended=null;G.campaign='c5';G.time=1801;teams[0].stats.tradeGold=100;campaignTick(1)");
 assert.equal(run("ended[0]"),0);
});
test('2.0: badges are stored once and survive broken storage',()=>{
 const store={'vek-pokroku-badges':'{broken'},run=simulation(store);
 run("awardBadge('iron');awardBadge('iron')");
 assert.equal(Object.keys(JSON.parse(store['vek-pokroku-badges'])).length,1);
 assert.equal(run("CAMP.newBadges.length"),1);
});
