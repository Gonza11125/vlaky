'use strict';
// Věk pokroku 2.2.0 — Grafická renesance.
// Čistě klientská výtvarná vrstva: nepřidává herní příkazy, nemění stav ani síť.
const RENAISSANCE = {
  key:'vek-pokroku-renaissance-2',enabled:true,motion:true,
  rigs:0,facades:0,corpses:[],unitLimit:92,buildingLimit:55,
  shapes:null,mats:null,lit:[],acc:0,smokeAcc:0,stats:{units:0,buildings:0},
};
function renaissanceLoad(){
  try{
    const s=JSON.parse(localStorage.getItem(RENAISSANCE.key)||'null');
    if(s&&typeof s.enabled==='boolean')RENAISSANCE.enabled=s.enabled;
    if(s&&typeof s.motion==='boolean')RENAISSANCE.motion=s.motion;
  }catch(_){}
}
function renaissanceSet(key,v){
  if(!['enabled','motion'].includes(key)||typeof v!=='boolean')return false;
  RENAISSANCE[key]=v;
  try{localStorage.setItem(RENAISSANCE.key,JSON.stringify({
    enabled:RENAISSANCE.enabled,motion:RENAISSANCE.motion,
  }));}catch(_){}
  return true;
}
function renaissanceDetail(){
  return RENAISSANCE.enabled&&cityArtQuality()!=='low';
}
function renaissanceUnitClass(u){
  if(u.def.cls==='siege'||u.def.cls==='cav'||u.def.cls==='trade'||u.def.mount)return 'vehicle';
  return 'foot';
}
function renaissancePose(kind,t,id,working,moving,attack,hit){
  const phase=t+id*1.671;
  const stride=moving?Math.sin(phase)*0.74:0;
  const step=moving?Math.abs(Math.sin(phase))*0.095:0;
  const work=working?Math.sin(phase)*0.78:0;
  const fight=attack&&working ? Math.sin(phase*1.23)*1.05 : 0;
  return {
    leftLeg:stride,rightLeg:-stride,
    leftArm:working? -work*0.55-fight*0.35 : -stride*0.78,
    rightArm:working? work+fight : stride*0.78,
    bodyLean:working?(kind==='gather'?0.25:kind==='farm'?0.33:0.13):moving?0.08:0.018*Math.sin(phase),
    headTurn:0.07*Math.sin(t*0.72+id),bounce:step,
    tool:work*(kind==='build'?0.9:kind==='craft'?1.05:0.55),
    hit:hit>0?Math.sin(hit*12)*0.23:0,
  };
}
function renaissanceResources(){
  if(RENAISSANCE.shapes)return;
  RENAISSANCE.shapes={
    box:new THREE.BoxGeometry(1,1,1),
    ball:new THREE.SphereGeometry(1,10,7),
    tube:new THREE.CylinderGeometry(1,1,1,8),
    cone:new THREE.ConeGeometry(1,1,7),
    disk:new THREE.CylinderGeometry(1,1,0.16,12),
    bow:new THREE.TorusGeometry(0.46,0.047,4,12,Math.PI*1.85),
  };
  const make=c=>new THREE.MeshStandardMaterial({color:c,roughness:0.84,metalness:0.03,flatShading:true});
  RENAISSANCE.mats={
    skin:make(0xc89c76),skinB:make(0xe1ad87),hair:make(0x392c25),hairB:make(0x846143),
    leather:make(0x62412b),leatherB:make(0x876345),linen:make(0xc8b694),
    olive:make(0x6c7952),wool:make(0x94846f),iron:make(0x788188),
    steel:new THREE.MeshStandardMaterial({color:0xb0b5b4,roughness:0.35,metalness:0.6}),
    brass:new THREE.MeshStandardMaterial({color:0xa78b4d,roughness:0.43,metalness:0.5}),
    stone:make(0x958c78),wood:make(0x99744c),woodD:make(0x58412e),
    amber:new THREE.MeshStandardMaterial({color:0xffbb66,roughness:0.35,emissive:0xff8c22,emissiveIntensity:0.15}),
    glass:new THREE.MeshStandardMaterial({color:0x577587,metalness:0.1,roughness:0.28}),
    dark:make(0x302a27),
    blue:make(0x52748e),red:make(0x9e5341),
    team:[0,1].map(id=>make(TEAM_COLORS[id]||0x6688aa)),
  };
}
function renaissancePiece(parent,shape,mat,xyz,scale){
  const s=RENAISSANCE.shapes,m=RENAISSANCE.mats;
  const part=new THREE.Mesh(s[shape],typeof mat==='string'?m[mat]:mat);
  part.position.set(xyz[0],xyz[1],xyz[2]);
  part.scale.set(scale[0],scale[1],scale[2]);
  part.castShadow=shape!=='bow';part.receiveShadow=true;
  parent.add(part);return part;
}
function renaissanceFootRig(u){
  renaissanceResources();
  const g=new THREE.Group(),team=RENAISSANCE.mats.team[u.team];
  const style=u.type,vil=style==='vil',arch=['archer','xbow','slinger','musket'].includes(style),
    heavy=['sword','pike','xbow'].includes(style),
    metal=heavy?'iron':'leather';
  // Materiál hráče tvoří lem, nikdy celou postavu.
  const variant=(u.id%3),cloth=vil?(variant?'olive':'wool'):arch?'wool':variant?'leatherB':'olive';
  const trunk=new THREE.Group();trunk.position.y=0.92;g.add(trunk);
  renaissancePiece(trunk,'box',cloth,[0,0.24,0],[0.68,0.87,0.39]);
  renaissancePiece(trunk,'box',team,[0,-0.22,0.215],[0.73,0.10,0.045]);
  renaissancePiece(trunk,'box','leather',[0,-0.06,0.02],[0.74,0.12,0.43]);
  renaissancePiece(trunk,'box','brass',[0,-0.06,0.26],[0.14,0.14,0.06]);
  renaissancePiece(trunk,'box',cloth,[0,-0.36,0],[0.82,0.37,0.49]);
  if(heavy){
    renaissancePiece(trunk,'box','iron',[0,0.37,-0.255],[0.74,0.54,0.09]);
    renaissancePiece(trunk,'box','iron',[0,0.4,0.253],[0.68,0.54,0.09]);
    for(const x of [-0.29,0.29])renaissancePiece(trunk,'box','brass',[x,0.51,0.294],[0.09,0.06,0.04]);
  }
  const neck=new THREE.Group();neck.position.y=0.75;trunk.add(neck);
  renaissancePiece(neck,'tube','skin',[0,0.01,0],[0.12,0.15,0.12]);
  renaissancePiece(neck,'ball',variant===2?'skinB':'skin',[0,0.29,0],[0.255,0.31,0.232]);
  renaissancePiece(neck,'ball',variant?'hair':'hairB',[0,0.52,-0.035],[0.273,0.14,0.243]);
  if(vil){
    renaissancePiece(neck,'tube','leatherB',[0,0.54,0],[0.39,0.11,0.35]);
    renaissancePiece(neck,'cone','linen',[0,0.68,0],[0.32,0.25,0.32]);
  } else if(heavy){
    renaissancePiece(neck,'tube','iron',[0,0.54,0],[0.34,0.16,0.34]);
    renaissancePiece(neck,'cone','steel',[0,0.70,0],[0.20,0.24,0.20]);
    renaissancePiece(neck,'box',team,[0,0.85,0],[0.09,0.20,0.11]);
  } else if(arch){
    renaissancePiece(neck,'tube','olive',[0,0.57,0],[0.30,0.13,0.29]);
  }
  for(const x of [-0.095,0.095])renaissancePiece(neck,'ball','dark',[x,0.32,0.207],[0.021,0.024,0.02]);
  const arm=(side)=>{
    const pivot=new THREE.Group();pivot.position.set(side*0.46,0.56,0);trunk.add(pivot);
    renaissancePiece(pivot,'ball',cloth,[0,-0.14,0],[0.23,0.31,0.235]);
    renaissancePiece(pivot,'tube',vil?'skin':metal,[0,-0.49,0.012],[0.115,0.35,0.122]);
    renaissancePiece(pivot,'ball','skin',[0,-0.78,0.02],[0.125,0.15,0.13]);
    return pivot;
  };
  const left=arm(-1),right=arm(1);
  const legs=[];
  for(const x of [-0.21,0.21]){
    const pivot=new THREE.Group();pivot.position.set(x,0.69,0);g.add(pivot);
    renaissancePiece(pivot,'tube',heavy?'iron':'leather',[0,-0.29,0],[0.162,0.46,0.16]);
    renaissancePiece(pivot,'tube','leather',[0,-0.76,0.015],[0.16,0.40,0.16]);
    renaissancePiece(pivot,'box','dark',[0,-0.97,0.115],[0.32,0.19,0.48]);
    legs.push(pivot);
  }
  const equipment=new THREE.Group();equipment.position.set(0,-0.75,0.12);right.add(equipment);
  const tools={};
  const makeTool=(key,shape)=>{
    const p=new THREE.Group();equipment.add(p);
    if(shape==='hammer'){
      renaissancePiece(p,'tube','wood',[0,-0.28,0],[0.065,0.55,0.065]);
      renaissancePiece(p,'box','iron',[0,-0.66,0],[0.48,0.15,0.19]);
    } else if(shape==='axe'){
      renaissancePiece(p,'tube','wood',[0,-0.35,0],[0.06,0.75,0.06]);
      renaissancePiece(p,'box','iron',[0,-0.77,0.16],[0.34,0.26,0.13]);
    } else if(shape==='sickle'){
      renaissancePiece(p,'tube','wood',[0,-0.22,0],[0.055,0.43,0.055]);
      renaissancePiece(p,'bow','steel',[0,-0.55,0.02],[0.56,0.5,0.5]);
    } else if(shape==='bow'){
      renaissancePiece(p,'bow','wood',[0,-0.42,0.05],[0.95,1.16,0.75]);
      renaissancePiece(p,'box','linen',[-0.09,-0.42,0.06],[0.028,0.84,0.024]);
    } else if(shape==='gun'){
      renaissancePiece(p,'box','wood',[0,-0.27,0.05],[0.11,0.68,0.20]);
      renaissancePiece(p,'tube','iron',[0,-0.65,0.13],[0.07,0.58,0.07]);
    } else {
      renaissancePiece(p,'tube','wood',[0,-0.71,0],[0.065,1.65,0.065]);
      renaissancePiece(p,'cone','steel',[0,-1.62,0],[0.17,0.38,0.17]);
    }
    tools[key]=p;p.visible=false;
  };
  for(const [key,shape] of Object.entries({
    build:'hammer',gather:'axe',farm:'sickle',craft:'hammer',attack:
      ['sword','axe'].includes(style)?'axe':arch?(style==='musket'?'gun':'bow'):'spear'}))
    makeTool(key,shape);
  // Starší modely 1.9 měly štíty u některých pěšáků – udržujeme jejich siluetu.
  let shield=null;
  if(['sword','spear','pike','axe'].includes(style)){
    shield=renaissancePiece(left,'disk',team,[-0.13,-0.53,0.29],[0.37,0.55,0.13]);
    renaissancePiece(left,'disk','brass',[-0.13,-0.53,0.37],[0.09,0.13,0.18]);
  }
  const cloak=new THREE.Group();cloak.position.set(0,0.65,-0.28);trunk.add(cloak);
  if(!vil&&style!=='slinger')renaissancePiece(cloak,'box',team,[0,-0.43,-0.04],[0.6,0.91,0.08]);
  if(vil)renaissancePiece(trunk,'box','leatherB',[0,0.07,-0.36],[0.4,0.46,0.28]);
  g.userData.isRenRig=true;u.mesh.add(g);
  return {group:g,trunk,neck,left,right,legs,cloak,equipment,tools,shield,
    blend:0,phase:u.id*0.53,hit:0,hp:u.hp,body:0};
}
// Pohyblivé doplňky jezdců, vozů a obléhacích strojů — základní modely zůstávají.
function renaissanceVehicleRig(u){
  renaissanceResources();
  const g=new THREE.Group(),moving=[];
  const mount=['rider','scout','knight','horsearcher','dragoon'].includes(u.type);
  if(mount){
    const tail=new THREE.Group();tail.position.set(0,1.18,-0.94);g.add(tail);
    renaissancePiece(tail,'cone','hair',[0,-0.36,-0.15],[0.19,0.84,0.22]);
    moving.push({kind:'tail',node:tail});
    const cloak=new THREE.Group();cloak.position.set(0,2.2,-0.42);g.add(cloak);
    renaissancePiece(cloak,'box',RENAISSANCE.mats.team[u.team],[0,-0.38,0],[0.52,0.82,0.07]);
    moving.push({kind:'cape',node:cloak});
    for(const x of [-0.24,0.24])for(const z of [-0.65,0.65]){
      const hoof=new THREE.Group();hoof.position.set(x,0.79,z);g.add(hoof);
      renaissancePiece(hoof,'box','dark',[0,-0.32,0.09],[0.19,0.34,0.26]);
      moving.push({kind:'hoof',node:hoof,index:moving.length});
    }
  }else{
    const isCart=['chariot','caravan','ram','catapult','cannon'].includes(u.type);
    if(isCart){
      for(const x of [-0.85,0.85]){
        const wheel=new THREE.Group();wheel.position.set(x,0.53,0.25);g.add(wheel);
        renaissancePiece(wheel,'disk','iron',[0,0,0],[0.25,0.28,0.10]);
        for(let k=0;k<4;k++){
          const spoke=renaissancePiece(wheel,'box','woodD',[0,0,0],[0.08,0.54,0.08]);
          spoke.rotation.z=k*Math.PI/4;
        }
        moving.push({kind:'wheel',node:wheel});
      }
    }
    const banner=new THREE.Group();banner.position.set(0,2.25,-0.4);g.add(banner);
    renaissancePiece(banner,'box','wood',[0,0.21,0],[0.07,1.0,0.07]);
    renaissancePiece(banner,'box',RENAISSANCE.mats.team[u.team],[0.29,0.42,0],[0.58,0.36,0.06]);
    moving.push({kind:'flag',node:banner});
  }
  g.visible=false;u.mesh.add(g);
  return {group:g,moving};
}
function renaissanceAnimateVehicle(u,t,dt){
  if(!u.renVehicle)return;
  const moving=!!u.moving,phase=t*(moving?u.def.speed*1.8:0.4)+u.id;
  for(const [i,m] of u.renVehicle.moving.entries()){
    if(!RENAISSANCE.motion){m.node.rotation.set(0,0,0);continue;}
    if(m.kind==='tail')m.node.rotation.x=Math.sin(phase*0.7)*0.19;
    if(m.kind==='cape')m.node.rotation.x=moving?-0.18-Math.sin(phase)*0.07:0;
    if(m.kind==='hoof')m.node.rotation.x=moving?Math.sin(phase+i*Math.PI/2)*0.55:0;
    if(m.kind==='wheel')m.node.rotation.x=moving?-t*u.def.speed*0.8:0;
    if(m.kind==='flag')m.node.rotation.y=Math.sin(t*1.3+u.id)*0.16;
  }
}

function renaissanceFacade(b){
  renaissanceResources();
  const group=new THREE.Group(),lit=[],moving=[],w=b.size*CS;
  // Nové detaily mají samostatnou LOD vrstvu, starý základ budovy zůstává.
  const half=Math.min(w/2-0.12,Math.max(1.38,w/2-0.42));
  const era=teams[b.team]?teams[b.team].era:0,team=RENAISSANCE.mats.team[b.team];
  const name=b.type;
  const box=(mat,x,y,z,sx,sy,sz)=>renaissancePiece(group,'box',mat,[x,y,z],[sx,sy,sz]);
  if(!b.def.wall && !['farm','pasture','well','palisade','gate','tower'].includes(name)){
    // Kamenný sokl, bohaté rámování vstupu, dřevěné výztuhy.
    box('stone',0,0.16,half,Math.min(w-0.9,3.1),0.26,0.18);
    const left=-Math.min(1.12,half-0.45),right=Math.min(1.12,half-0.45);
    for(const x of [left,right]) {
      box(era>=3?'stone':'woodD',x,0.87,half,0.13,1.62,0.15);
      box('leather',x,1.54,half+0.005,0.17,0.11,0.18);
    }
    box('woodD',0,1.66,half,Math.abs(right-left)+0.25,0.15,0.17);
    box('leather',0,0.74,half+0.08,0.65,1.22,0.10);
    box('brass',0.22,0.78,half+0.145,0.07,0.10,0.04);
    for(const x of [-Math.min(1.5,half-0.4),Math.min(1.5,half-0.4)]){
      const glass=box(era>=4?'glass':'amber',x,1.21,half+0.095,0.46,0.49,0.045);
      box('woodD',x,1.21,half+0.14,0.055,0.56,0.065);
      box('woodD',x,1.21,half+0.15,0.51,0.055,0.07);
      box('stone',x,0.91,half+0.08,0.61,0.10,0.19);
      lit.push(glass);
    }
    if(era>=2){
      for(const x of [-1,1])box('stone',x*(half-0.04),0.15,0,0.20,0.31,w-0.70);
    }
    if(era>=3){
      for(const x of [-0.72,0,0.72])box('stone',x,1.81,half-0.01,0.10,0.25,0.14);
    }
    if(era>=4)box('brass',0,1.91,half+0.06,0.62,0.16,0.18);
  }
  if(['house','tc','bakery','smithy','library','granary','store','barracks','workshop','mill'].includes(name)){
    const roofY=name==='tc'?4.5:name==='mill'?3.35:2.4;
    for(let i=0;i<4;i++){
      const xx=-1.05+i*0.69;
      box(era>=3?'stone':'woodD',xx,roofY,-0.85,0.10,0.10,1.8);
    }
    if(['bakery','smithy','workshop','house','tc'].includes(name)){
      const chimney=box('stone',-0.92,roofY+0.25,-0.58,0.45,0.70,0.47);
      moving.push({kind:'chimney',mesh:chimney});
    }
  }
  if(['market','barracks','tc','store','library'].includes(name)){
    const banner=new THREE.Group();banner.position.set(half-0.20,2.28,half);group.add(banner);
    renaissancePiece(banner,'box','woodD',[0,0.23,0],[0.08,1.45,0.08]);
    renaissancePiece(banner,'box',team,[0.34,0.62,0],[0.67,0.54,0.07]);
    moving.push({kind:'flag',mesh:banner});
  }
  if(name==='market'){
    for(const x of [-0.75,0.75]){
      const awning=new THREE.Group();awning.position.set(x,2.02,half+0.33);group.add(awning);
      renaissancePiece(awning,'box',x<0?'red':'linen',[0,0,0],[1.12,0.09,1.0]);
      moving.push({kind:'awning',mesh:awning});
      box('wood',x,0.48,half+0.65,1.05,0.73,0.58);
    }
  }
  if(name==='smithy'||name==='smelter'||name==='bakery'){
    const ember=box('amber',0.78,0.51,half+0.06,0.47,0.35,0.075);
    moving.push({kind:'ember',mesh:ember});
  }
  if(name==='tower'||name==='barracks'){
    for(const x of [-0.85,0.85])box('iron',x,1.03,half+0.10,0.17,0.75,0.10);
  }
  const cracks=[];
  if(!b.def.wall&&name!=='farm'){
    for(const [x,y,z] of [[-0.72,0.52,half+0.16],[0.9,1.4,half+0.16]]){
      cracks.push(box('dark',x,y,z,0.075,0.60,0.04));
    }
  }
  group.visible=false;b.mesh.add(group);
  return {group,lit,moving,cracks,era};
}
function renaissanceRemove(e){
  if(!e)return;
  if(e.renRig){
    e.mesh.remove(e.renRig.group);
    e.renRig=null;RENAISSANCE.rigs=Math.max(0,RENAISSANCE.rigs-1);
  }
  if(e.renVehicle){
    e.mesh.remove(e.renVehicle.group);
    e.renVehicle=null;RENAISSANCE.rigs=Math.max(0,RENAISSANCE.rigs-1);
  }
  if(e.renFacade){
    e.mesh.remove(e.renFacade.group);
    e.renFacade=null;RENAISSANCE.facades=Math.max(0,RENAISSANCE.facades-1);
  }
}
function renaissanceClear(){
  for(const e of units)renaissanceRemove(e);
  for(const e of blds)renaissanceRemove(e);
  if(scene)for(const body of RENAISSANCE.corpses)scene.remove(body.mesh);
  RENAISSANCE.corpses.length=0;
  RENAISSANCE.rigs=RENAISSANCE.facades=0;
  RENAISSANCE.acc=RENAISSANCE.smokeAcc=0;RENAISSANCE.visualTime=0;
  RENAISSANCE.lit.length=0;
  RENAISSANCE.stats={units:0,buildings:0};
}
function renaissanceDeath(e){
  if(!e||!e.isU||!e.mesh||!e.mesh.visible||cityArtQuality()==='low')return;
  if(RENAISSANCE.corpses.length>=12){
    const old=RENAISSANCE.corpses.shift();if(scene)scene.remove(old.mesh);
  }
  renaissanceResources();
  const g=new THREE.Group();g.position.set(e.x,heightAt(e.x,e.z)+0.12,e.z);
  g.rotation.y=e.face;g.rotation.z=-Math.PI/2.45;
  renaissancePiece(g,'box',e.team===0?'blue':'red',[0,0.25,0],[0.6,0.72,0.40]);
  renaissancePiece(g,'ball','skin',[0,0.83,0],[0.23,0.24,0.22]);
  if(scene)scene.add(g);
  RENAISSANCE.corpses.push({mesh:g,life:8});
}
function renaissanceAnimateRig(u,t,dt){
  const r=u.renRig;if(!r)return;
  const kind=u.order&&u.order.type,attack=kind==='attack'||kind==='hunt';
  if(u.hp<r.hp-0.25)r.hit=0.42;
  r.hp=u.hp;r.hit=Math.max(0,r.hit-dt);
  const walk=!!u.moving,work=!!u.working;
  const target=(walk||work)?1:0.22;
  r.blend+=(target-r.blend)*Math.min(1,dt*8);
  r.phase+=dt*(walk?u.def.speed*2.2:work?6.5:0.72);
  const p=renaissancePose(kind,r.phase,u.id,work,walk,attack,r.hit);
  if(RENAISSANCE.motion){
    const b=r.blend;
    r.legs[0].rotation.x=p.leftLeg*b;
    r.legs[1].rotation.x=p.rightLeg*b;
    r.left.rotation.x=p.leftArm*b;
    r.right.rotation.x=p.rightArm*b;
    r.trunk.rotation.x=p.bodyLean*b;
    r.trunk.rotation.z=p.hit;
    r.neck.rotation.y=p.headTurn;
    r.group.position.y=p.bounce*b;
    r.cloak.rotation.x=walk?-0.16-Math.sin(r.phase)*0.06:0;
    r.equipment.rotation.z=work?p.tool:0;
  }else{
    r.legs[0].rotation.x=r.legs[1].rotation.x=0;
    r.left.rotation.x=r.right.rotation.x=0;
    r.trunk.rotation.x=r.trunk.rotation.z=0;
    r.neck.rotation.y=r.group.position.y=r.cloak.rotation.x=r.equipment.rotation.z=0;
  }
  const wanted=u.type==='vil'?(work?(['build','farm','craft','gather'].includes(kind)?kind:'gather'):null):'attack';
  for(const [key,tool] of Object.entries(r.tools))tool.visible=key===wanted;
}
function renaissanceFrame(t,dt){
  if(!scene||!terrain||!teams.length)return;
  const motionDt=G.paused?0:dt;
  RENAISSANCE.visualTime=(RENAISSANCE.visualTime||0)+motionDt;
  t=RENAISSANCE.visualTime;
  const high=renaissanceDetail(),range=G.coarse?39:68;
  let activeUnits=0,activeBuildings=0;
  const sunDown=typeof atmoClock==='function'?atmoClock(G.time).day<0.35:false;
  // Jednotky: detailní procedurální rig do blízkosti kamery, jinde původní mesh.
  for(const u of units){
    if(u.dead||!u.mesh)continue;
    const close=high&&u.mesh.visible&&Math.hypot(u.x-cam.x,u.z-cam.z)<range &&
      activeUnits<Math.min(RENAISSANCE.unitLimit,G.coarse?28:70);
    if(renaissanceUnitClass(u)==='vehicle' && close){
      if(!u.renVehicle&&RENAISSANCE.rigs<RENAISSANCE.unitLimit){
        u.renVehicle=renaissanceVehicleRig(u);RENAISSANCE.rigs++;
      }
      if(u.renVehicle){
        u.renVehicle.group.visible=true;
        renaissanceAnimateVehicle(u,t,motionDt);
        activeUnits++;
      }
    } else if(u.renVehicle)u.renVehicle.group.visible=false;
    if(renaissanceUnitClass(u)==='foot'&&close){
      if(!u.renRig&&RENAISSANCE.rigs<RENAISSANCE.unitLimit){
        u.renRig=renaissanceFootRig(u);RENAISSANCE.rigs++;
      }
      if(u.renRig){
        u.renRig.group.visible=true;
        // Materiál skryje jen pevné tělo; děti mesh (živá postava) zůstanou viditelné.
        if(!RENAISSANCE.hiddenMaterial)
          RENAISSANCE.hiddenMaterial=new THREE.MeshBasicMaterial({visible:false});
        u.mesh.material=RENAISSANCE.hiddenMaterial;
        if(u.art){u.art.left.visible=u.art.right.visible=u.art.pack.visible=false;}
        renaissanceAnimateRig(u,t,motionDt);
        activeUnits++;
      }
    } else if(u.renRig){
      u.renRig.group.visible=false;
      u.mesh.material=u.sick>0?sickMat:unitMat;
    }
  }
  // Architektonické detaily jsou volitelné a časově omezené vzdáleností.
  for(const b of blds){
    if(b.dead||!b.mesh)continue;
    const close=high&&b.done&&b.mesh.visible&&Math.hypot(b.x-cam.x,b.z-cam.z)<(G.coarse?50:96)
      &&activeBuildings<Math.min(RENAISSANCE.buildingLimit,G.coarse?22:44);
    if(close){
      const era=teams[b.team]&&teams[b.team].era;
      if(b.renFacade&&b.renFacade.era!==era)renaissanceRemove(b);
      if(!b.renFacade&&RENAISSANCE.facades<RENAISSANCE.buildingLimit){
        b.renFacade=renaissanceFacade(b);RENAISSANCE.facades++;
      }
      if(b.renFacade){
        const f=b.renFacade;
        f.group.visible=true;
        for(const glass of f.lit)glass.material=RENAISSANCE.mats[sunDown?'amber':'glass'];
        for(const crack of f.cracks)crack.visible=b.hp/b.maxHp<0.70;
        for(const moving of f.moving){
          if(moving.kind==='flag')moving.mesh.rotation.y=RENAISSANCE.motion?Math.sin(t*1.45+b.id)*0.19:0;
          if(moving.kind==='awning')moving.mesh.rotation.z=RENAISSANCE.motion?Math.sin(t*1.65+b.id)*0.025:0;
          if(moving.kind==='ember')moving.mesh.visible=b.enabled!==false;
        }
        activeBuildings++;
      }
    }else if(b.renFacade)b.renFacade.group.visible=false;
  }
  // Animace zásahů nezpomalují herní simulaci: těla po pádu mizí po 8 s.
  for(let i=RENAISSANCE.corpses.length-1;i>=0;i--){
    const c=RENAISSANCE.corpses[i];c.life-=motionDt;
    if(c.life<=0){scene.remove(c.mesh);RENAISSANCE.corpses.splice(i,1);}
  }
  if(high&&!G.paused&&RENAISSANCE.motion){
    RENAISSANCE.smokeAcc+=motionDt;
    if(RENAISSANCE.smokeAcc>1.15){
      RENAISSANCE.smokeAcc=0;
      let count=0;
      for(const b of blds)if(count<5&&b.done&&!b.dead&&b.renFacade&&b.renFacade.group.visible
        &&['smithy','bakery','workshop','house'].includes(b.type)&&(b.fire||0)<=0){
        puff(b.x-0.92,b.y+3.15,b.z-0.6,0x9d9486,0.28,1.25,1.4);count++;
      }
    }
  }
  RENAISSANCE.stats.units=activeUnits;
  RENAISSANCE.stats.buildings=activeBuildings;
}
renaissanceLoad();
