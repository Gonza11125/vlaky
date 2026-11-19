const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function make(){
  const kv=new Map();
  const ctx=vm.createContext({
    console,
    G:{time:0,real:false,rain:0},
    MY:0,
    CITY_ART:{quality:'auto'},
    cityArtQuality:()=> 'high',
    localStorage:{getItem:k=>kv.get(k)||null,setItem:(k,v)=>kv.set(k,String(v))},
    window:{},
    blds:[],
    teams:[],
    scene:null,terrain:null,weather:null,sun:null,skyLight:null,
    THREE:{},
  });
  vm.runInContext(fs.readFileSync(path.join(root,'atmosphere.js'),'utf8'),ctx);
  return {run:code=>vm.runInContext(code,ctx),kv};
}
test('noon, dusk and night differ in a deterministic 120-second cycle',()=>{
  const {run}=make();
  assert.ok(run('atmoClock(30).day')>0.99);
  assert.ok(run('atmoClock(90).day')<0.001);
  assert.equal(run('atmoClock(30).label'),'Den');
  assert.equal(run('atmoClock(90).label'),'Noc');
  assert.equal(run('atmoClock(150).day'),run('atmoClock(30).day'));
  assert.equal(run('atmoClock(-90).day'),run('atmoClock(30).day'));
});
test('realistic night is darker; disabling cycle preserves fixed daylight',()=>{
  const {run}=make();
  const bright=run('atmoLightProfile(90,false,true).intensity');
  const dim=run('atmoLightProfile(90,true,true).intensity');
  assert.ok(dim<bright);
  assert.ok(run('atmoLightProfile(90,true,false).intensity')>0.99);
  assert.equal(run('atmoLightProfile(90,true,false).label'),'Stálý den');
});
test('night lanterns turn off during the day without modifying game time',()=>{
  const {run}=make();
  assert.ok(run('atmoLightProfile(90,true,true).lamps')>0.99);
  assert.ok(run('atmoLightProfile(30,true,true).lamps')<0.001);
  assert.equal(run('G.time'),0);
});
test('settings accept valid values, reject invalid types and persist locally',()=>{
  const {run,kv}=make();
  assert.equal(run("atmoSetSetting('quality','invalid')"),false);
  assert.equal(run("atmoSetSetting('enabled',0)"),false);
  assert.equal(run("atmoSetSetting('quality','low')"),true);
  assert.equal(run("atmoSetSetting('volume',0.7)"),true);
  assert.equal(run('ATMOS.volume'),0.7);
  assert.equal(run("atmoSetSetting('clouds',false)"),true);
  const saved=JSON.parse(kv.get('vek-pokroku-atmosphere-1'));
  assert.equal(saved.clouds,false);
  assert.equal(saved.quality,'low');
  assert.equal(saved.volume,0.7);
  assert.equal(run('G.time'),0);
});
test('mobile/performance low mode reduces particle cap without changing game logic',()=>{
  const {run}=make();
  assert.equal(run('atmoMaxParticles()'),1600);
  run("atmoSetSetting('quality','low')");
  assert.equal(run('atmoMaxParticles()'),280);
  run("atmoSetSetting('quality','auto')");
  run('ATMOS.frames=95;ATMOS.sampleStart=1000;atmoFrameSample(7000);');
  run('ATMOS.frames=90;ATMOS.sampleStart=7000;atmoFrameSample(13000);');
  assert.equal(run('ATMOS.slow'),true);
  assert.equal(run('atmoMaxParticles()'),280);
  run("atmoSetSetting('quality','high')");
  assert.equal(run('ATMOS.slow'),false);
});
test('lamp selection excludes construction, destroyed and unknown structures',()=>{
  const {run}=make();
  run("const testB=[{id:1,type:'tc',done:true,dead:false,mesh:{},x:1,y:2,z:3,size:3},{id:2,type:'house',done:false,dead:false,mesh:{},x:2,y:2,z:3,size:2},{id:3,type:'house',done:true,dead:true,mesh:{},x:3,y:2,z:3,size:2},{id:4,type:'wall',done:true,dead:false,mesh:{},x:4,y:2,z:3,size:1},{id:5,type:'market',done:true,dead:false,mesh:{},x:5,y:2,z:3,size:3}];");
  assert.equal(run('atmoLampPlan(testB,10).length'),2);
  assert.equal(run('atmoLampPlan(testB,1)[0].id'),1);
});
test('weather remains visual-only and respects low-quality, snow/rain flags',()=>{
  const {run}=make();
  assert.equal(run("ATMOS.fx"),true);
  assert.equal(run("atmoSetSetting('fx',false)"),true);
  assert.equal(run("G.rain"),0);
  assert.equal(run("ATMOS.enabled"),true);
});
test('sound defaults off, including when a browser lacks Web Audio',async()=>{
  const {run}=make();
  assert.equal(run('ATMOS.sound'),false);
  assert.equal(await run('atmoSetSound(true)'),false);
  assert.equal(run('ATMOS.sound'),false);
});
test('original gameplay modules keep the cycle out of save/network payload',()=>{
  const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
  const net=fs.readFileSync(path.join(root,'net.js'),'utf8');
  assert.match(game,/atmoReset\(\)/);
  assert.doesNotMatch(game,/v: 1,\s*seed: G\.seed,.*ATMOS/);
  assert.doesNotMatch(net,/ATMOS/);
});
