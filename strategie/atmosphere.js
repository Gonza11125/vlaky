'use strict';
// Věk pokroku 1.6.0 – samostatná atmosférická vrstva.
// Čas světla vychází z G.time; pohyby, výrobu, HP ani povely nemění.
const ATMOS = {
  key: 'vek-pokroku-atmosphere-1', cycle: 120, enabled: true,
  clouds: true, fx: true, sound: false, volume: 0.35,
  quality: 'auto', slow: false, fps: 60, sampleStart: 0, frames: 0,
  lowSamples: 0, goodSamples: 0, lamps: [], lampStamp: '',
  lampTex: null, lampMat: null, townLight: null, lastLampSync: -1,
  audio: null, audioHint: 'Zvuk je vypnutý.',
};
function atmoClamp(x,a,b){return Math.max(a,Math.min(b,x));}
function atmoSmoother(x){x=atmoClamp(x,0,1);return x*x*(3-2*x);}
function atmoPeriod(time){
  const n=Number.isFinite(time)?time:0;
  return ((n%ATMOS.cycle)+ATMOS.cycle)%ATMOS.cycle/ATMOS.cycle;
}
function atmoClock(time){
  const p=atmoPeriod(time);
  const h=Math.sin(2*Math.PI*p);
  const day=atmoSmoother((h+0.18)/0.55);
  const golden=(1-day)*Math.max(0,h+0.22);
  const label=p<0.075?'Svítání':p<0.43?'Den':p<0.56?'Soumrak':'Noc';
  return {p,h,day,golden,label};
}
function atmoLightProfile(time,real,enabled){
  const s=enabled?atmoClock(time):{...atmoClock(ATMOS.cycle*0.25),label:'Stálý den'};
  const min=real?0.21:0.50;
  const intensity=min+(1-min)*s.day;
  return { ...s,intensity,ambient:(real?0.22:0.42)+(real?0.61:0.43)*s.day,
    lamps:enabled?atmoSmoother((0.63-s.day)/0.52):0 };
}
function atmoQuality(){
  if(ATMOS.quality==='low'||ATMOS.slow)return 'low';
  if(ATMOS.quality==='high')return 'high';
  return cityArtQuality()==='low'?'low':'high';
}
function atmoMaxParticles(){
  return atmoQuality()==='low'?280:1600;
}
function atmoFrameSample(now){
  if(!Number.isFinite(now))return ATMOS.fps;
  if(!ATMOS.sampleStart){ATMOS.sampleStart=now;ATMOS.frames=0;return ATMOS.fps;}
  ATMOS.frames++;
  const elapsed=now-ATMOS.sampleStart;
  if(elapsed<5000)return ATMOS.fps;
  const fps=1000*ATMOS.frames/elapsed;
  ATMOS.fps=Math.round(fps);
  if(ATMOS.quality==='auto'){
    if(fps<28){ATMOS.lowSamples++;ATMOS.goodSamples=0;}
    else if(fps>48){ATMOS.goodSamples++;ATMOS.lowSamples=0;}
    else {ATMOS.goodSamples=0;ATMOS.lowSamples=0;}
    if(ATMOS.lowSamples>=2)ATMOS.slow=true;
    if(ATMOS.goodSamples>=4)ATMOS.slow=false;
  }
  ATMOS.sampleStart=now;ATMOS.frames=0;
  return ATMOS.fps;
}
function atmoSettings(){
  return {enabled:ATMOS.enabled,clouds:ATMOS.clouds,fx:ATMOS.fx,
    quality:ATMOS.quality,volume:ATMOS.volume};
}
function atmoReadSettings(){
  try{
    const raw=JSON.parse(localStorage.getItem(ATMOS.key)||'null');
    if(!raw||typeof raw!=='object')return;
    if(typeof raw.enabled==='boolean')ATMOS.enabled=raw.enabled;
    if(typeof raw.clouds==='boolean')ATMOS.clouds=raw.clouds;
    if(typeof raw.fx==='boolean')ATMOS.fx=raw.fx;
    if(['auto','low','high'].includes(raw.quality))ATMOS.quality=raw.quality;
    if(typeof raw.volume==='number'&&Number.isFinite(raw.volume))
      ATMOS.volume=atmoClamp(raw.volume,0,1);
  }catch(_){}
}
function atmoSaveSettings(){
  try{localStorage.setItem(ATMOS.key,JSON.stringify(atmoSettings()));}catch(_){}
}
function atmoSetSetting(key,value){
  if(key==='enabled'||key==='clouds'||key==='fx'){
    if(typeof value!=='boolean')return false;
    ATMOS[key]=value;
  }else if(key==='quality'){
    if(!['auto','low','high'].includes(value))return false;
    ATMOS.quality=value;ATMOS.lowSamples=0;ATMOS.goodSamples=0;
    ATMOS.slow=false;
  }else if(key==='volume'){
    if(typeof value!=='number'||!Number.isFinite(value))return false;
    ATMOS.volume=atmoClamp(value,0,1);
    if(ATMOS.audio)ATMOS.audio.master.gain.value=ATMOS.sound?ATMOS.volume*0.25:0;
  }else return false;
  atmoSaveSettings();
  if(key==='enabled'||key==='quality'||key==='fx')atmoSyncLamps(true);
  return true;
}
function atmoUpdateLight(cam){
  if(!sun||!scene||!cam)return;
  const s=atmoLightProfile(G.time,G.real,ATMOS.enabled);
  const p=s.p*2*Math.PI,day=s.day;
  const rain=G.rain?0.84:1;
  const cloudCover=ATMOS.clouds?0.035+0.08*(0.5+0.5*Math.sin(G.time*0.093)):0;
  const clear=1-cloudCover;
  sun.target.position.set(cam.x,0,cam.z);
  sun.position.set(cam.x+75*Math.cos(p),26+115*Math.max(0,s.h),cam.z+75*Math.sin(p));
  sun.color.setRGB(1,0.69+0.26*day,0.46+0.50*day);
  sun.intensity=(G.real?0.89:0.90)*s.intensity*rain*clear;
  if(skyLight){
    skyLight.intensity=s.ambient*rain*(1-cloudCover*0.25);
    skyLight.color.setRGB(0.45+0.52*day,0.57+0.38*day,0.70+0.30*day);
  }
  const bg=scene.background;
  if(bg){
    const bright=G.real?1:1.1;
    bg.setRGB((0.035+0.59*day)*bright*rain,
      (0.055+0.67*day)*bright*rain,
      (0.105+0.70*day)*bright*rain);
    if(scene.fog)scene.fog.color.copy(bg);
  }
  if(ATMOS.lampMat) {
    ATMOS.lampMat.opacity=ATMOS.enabled ? s.lamps*(G.real?0.90:0.72):0;
  }
  if(ATMOS.townLight){
    ATMOS.townLight.intensity=ATMOS.enabled&&atmoQuality()==='high'
      ?1.1*s.lamps:0;
  }
}
function atmoDisposeLamps(){
  if(scene)for(const sprite of ATMOS.lamps)scene.remove(sprite);
  ATMOS.lamps.length=0;
  if(ATMOS.townLight&&scene)scene.remove(ATMOS.townLight);
  ATMOS.townLight=null;
  ATMOS.lampStamp='';
}
function atmoReset(){
  atmoDisposeLamps();
  ATMOS.lastLampSync=-1;
  ATMOS.slow=false;ATMOS.goodSamples=ATMOS.lowSamples=0;
  ATMOS.sampleStart=0;ATMOS.frames=0;ATMOS.fps=60;
}
function atmoLampTexture(){
  if(ATMOS.lampTex)return ATMOS.lampTex;
  const c=document.createElement('canvas');c.width=c.height=64;
  const x=c.getContext('2d'),r=x.createRadialGradient(32,32,1,32,32,32);
  r.addColorStop(0,'rgba(255,248,200,1)');
  r.addColorStop(0.18,'rgba(255,187,80,0.85)');
  r.addColorStop(0.5,'rgba(255,120,35,0.22)');
  r.addColorStop(1,'rgba(255,80,10,0)');
  x.fillStyle=r;x.fillRect(0,0,64,64);
  ATMOS.lampTex=new THREE.CanvasTexture(c);
  return ATMOS.lampTex;
}
function atmoLampPlan(buildings,limit){
  const list=[];
  for(const b of buildings){
    if(!b.done||b.dead||!b.mesh||!['tc','house','market','bakery','smithy','barracks','workshop','well','tower','store'].includes(b.type))continue;
    if(list.length>=limit)break;
    list.push({id:b.id,x:b.x+(b.size===1?0:1.1),y:b.y+(b.type==='tower'?4.6:1.85),z:b.z-0.4});
  }
  return list;
}
function atmoSyncLamps(force){
  if(!scene||!terrain||!ATMOS.enabled){atmoDisposeLamps();return;}
  const time=G.time;
  if(!force&&ATMOS.lastLampSync>=0&&time-ATMOS.lastLampSync<3)return;
  ATMOS.lastLampSync=time;
  const max=atmoQuality()==='low'?18:70;
  const source=blds.filter(b=>!b.dead&&b.mesh);
  const data=atmoLampPlan(source,max);
  const stamp=data.map(d=>d.id+':'+d.y.toFixed(1)).join(',');
  if(stamp===ATMOS.lampStamp)return;
  atmoDisposeLamps();ATMOS.lampStamp=stamp;
  if(!ATMOS.lampMat)ATMOS.lampMat=new THREE.SpriteMaterial({
    map:atmoLampTexture(),color:0xffe4a0,transparent:true,
    opacity:0,depthWrite:false,blending:THREE.AdditiveBlending
  });
  for(const d of data){
    const light=new THREE.Sprite(ATMOS.lampMat);
    light.position.set(d.x,d.y,d.z);light.scale.set(4.4,4.4,1);
    light.frustumCulled=true;scene.add(light);ATMOS.lamps.push(light);
  }
  if(atmoQuality()==='high'){
    const tc=blds.find(b=>b.team===MY&&b.type==='tc'&&!b.dead&&b.done);
    if(tc){
      ATMOS.townLight=new THREE.PointLight(0xffbb66,0,28,2);
      ATMOS.townLight.position.set(tc.x,tc.y+3.6,tc.z);
      scene.add(ATMOS.townLight);
    }
  }
}
function atmoUpdateWeather(dt,time){
  if(!weather||!weather.geometry)return;
  const snow=G.real&&G.snow>0.25&&season()===3;
  const rain=G.real&&!!G.rain;
  const visible=ATMOS.fx&&(snow||rain);
  weather.visible=visible;
  if(!visible)return;
  const wp=weather.geometry.attributes.position,a=wp.array;
  const n=Math.min(Math.floor(a.length/3),atmoMaxParticles());
  weather.geometry.setDrawRange(0,n);
  const mt=weather.material;
  mt.size=rain?0.32:0.44;mt.opacity=rain?0.75:0.89;
  mt.color.setHex(rain?0xc7d9e8:0xffffff);
  const speed=rain?42:5.2;
  const wind=(rain?2.2:1.1)*Math.sin(time*0.21);
  for(let i=0;i<n*3;i+=3){
    a[i]+=wind*dt+(rain?1.25:0.35)*dt;
    a[i+1]-=speed*dt;
    if(a[i+1]<0)a[i+1]+=45;
    if(a[i]>50)a[i]-=100;
    if(a[i]<-50)a[i]+=100;
  }
  wp.needsUpdate=true;weather.position.set(cam.x,0,cam.z);
}
function atmoAudioStop(){
  const a=ATMOS.audio;if(!a)return;
  try{a.master.gain.setTargetAtTime(0,a.ctx.currentTime,0.12);}catch(_){}
  ATMOS.sound=false;
}
function atmoAudioCreate(){
  const Ctx=window.AudioContext||window.webkitAudioContext;
  if(!Ctx)return null;
  const ctx=new Ctx(),master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
  const buf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),arr=buf.getChannelData(0);
  for(let i=0;i<arr.length;i++)arr[i]=Math.random()*2-1;
  const src=ctx.createBufferSource();src.buffer=buf;src.loop=true;
  const filt=ctx.createBiquadFilter();filt.type='lowpass';filt.frequency.value=280;
  const wind=ctx.createGain();wind.gain.value=0.20;
  src.connect(filt);filt.connect(wind);wind.connect(master);src.start();
  return {ctx,master,wind,nextBird:0,src};
}
async function atmoSetSound(on){
  if(!on){atmoAudioStop();ATMOS.audioHint='Zvuk vypnutý.';return false;}
  try{
    if(!ATMOS.audio)ATMOS.audio=atmoAudioCreate();
    if(!ATMOS.audio){ATMOS.audioHint='Zařízení nepodporuje Web Audio.';return false;}
    await ATMOS.audio.ctx.resume();
    if(ATMOS.audio.ctx.state!=='running'){
      ATMOS.audioHint='Prohlížeč blokuje zvuk. Zkus tlačítko znovu.';
      return false;
    }
    ATMOS.sound=true;ATMOS.audioHint='Zvuk zapnutý (syntetický vítr a ptáci).';
    ATMOS.audio.master.gain.setTargetAtTime(ATMOS.volume*0.25,ATMOS.audio.ctx.currentTime,0.08);
    return true;
  }catch(_){ATMOS.sound=false;ATMOS.audioHint='Zvuk nelze spustit v tomto prohlížeči.';return false;}
}
function atmoBird(a){
  if(!a||a.ctx.state!=='running')return;
  const t=a.ctx.currentTime,osc=a.ctx.createOscillator(),vol=a.ctx.createGain();
  osc.type='sine';
  osc.frequency.setValueAtTime(1150,t);
  osc.frequency.exponentialRampToValueAtTime(1750,t+0.12);
  osc.frequency.exponentialRampToValueAtTime(980,t+0.36);
  vol.gain.setValueAtTime(0,t);
  vol.gain.linearRampToValueAtTime(0.09,t+0.06);
  vol.gain.exponentialRampToValueAtTime(0.0001,t+0.37);
  osc.connect(vol);vol.connect(a.master);osc.start(t);osc.stop(t+0.4);
}
function atmoUpdateAudio(time){
  const a=ATMOS.audio;
  if(!a||!ATMOS.sound||a.ctx.state!=='running')return;
  const s=atmoLightProfile(G.time,G.real,ATMOS.enabled);
  a.wind.gain.setTargetAtTime(G.rain?0.65:0.10+0.07*(1-s.day),a.ctx.currentTime,0.7);
  if(G.time>=a.nextBird&&s.day>0.8&&!G.rain){
    a.nextBird=G.time+9+Math.random()*13;atmoBird(a);
  } else if(G.time>=a.nextBird)a.nextBird=G.time+5;
}
function atmoFrame(now,dt,time){
  atmoFrameSample(now);
  atmoUpdateLight(cam);
  atmoUpdateWeather(dt,time);
  atmoSyncLamps(false);
  atmoUpdateAudio(time);
}
atmoReadSettings();
