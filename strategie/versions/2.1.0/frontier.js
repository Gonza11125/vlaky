'use strict';
// Věk pokroku 1.7 – říční přechody a objevitelné neutrální lokality; od 1.7.1 je zkoumá i počítačový soupeř.
// Žádný přístup k síti; stav odměn je určován simulací hostitele.
const FRONTIER = {
  sites: [], bridges: [], groups: [], acc: 0, redraw: true, legacy: false,
  cube: null, wood: null, stone: null, roof: null, gold: null, mat: null,
};
const FRONTIER_SITES = Object.freeze([
  {kind:'village',name:'Neutrální osada',desc:'Malá nezávislá osada. Při první návštěvě ti nabídne zásoby.',cx:22,cy:26,reward:{food:45,wood:25}},
  {kind:'ruins',name:'Staré ruiny',desc:'Zbytky dávné stavby ukrývají poznatky předchozích generací.',cx:84,cy:84,reward:{know:38}},
  {kind:'tower',name:'Opuštěná hláska',desc:'Z výšky je patrné okolí a uvnitř zůstala cenná výbava.',cx:42,cy:40,reward:{gold:30}},
  {kind:'quarry',name:'Ztracený lom',desc:'Opuštěné kamenické pracoviště nabízí již vytěžený kámen.',cx:70,cy:69,reward:{stone:55}},
  {kind:'camp',name:'Poutnický tábor',desc:'Cestovatelé v táboře se s tebou podělí o jídlo a dřevo.',cx:29,cy:64,reward:{food:30,wood:30}},
  {kind:'workshop',name:'Opuštěná kovárna',desc:'Staré vybavení obsahuje využitelný kov.',cx:83,cy:45,reward:{metal:20}},
]);
function frontierSpotOK(cx,cy,found) {
  if(cx<4||cy<4||cx>N-6||cy>N-6)return false;
  if(STARTS.some(s=>Math.hypot(cx-s.cx,cy-s.cy)<13))return false;
  if(found.some(p=>Math.hypot(cx-p.cx,cy-p.cy)<13))return false;
  let height=0,lo=Infinity,hi=-Infinity;
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
    const x=cx+dx,y=cy+dy,i=cidx(x,y),h=cellH(x,y);
    if(!walk[i]||bridgeMask[i]||resv[i]||nodeAt[i]>=0||forest[i])return false;
    height+=h;lo=Math.min(lo,h);hi=Math.max(hi,h);
  }
  return height/4>0.55 && hi-lo<1.0;
}
function frontierFindSpot(want,found,seed){
  const offset=Math.floor(hash2(want.cx,want.cy,seed)*5)-2;
  const cx0=want.cx+offset,cy0=want.cy-offset;
  // 1.9: širší hledání (dřív 22), aby se lokalita vešla i vedle počátečních staveb
  for(let rad=0;rad<=36;rad++){
    for(let dy=-rad;dy<=rad;dy++)for(let dx=-rad;dx<=rad;dx++){
      if(rad && Math.max(Math.abs(dx),Math.abs(dy))!==rad)continue;
      const cx=cx0+dx,cy=cy0+dy;
      if(!frontierSpotOK(cx,cy,found))continue;
      // Sídla musí být dostupná skutečnou cestou, nikoliv na ostrově.
      if(findPath(STARTS[0].cx-1,STARTS[0].cy+1,cx,cy,cx+1,cy+1,0).ok ||
         findPath(STARTS[1].cx-1,STARTS[1].cy+1,cx,cy,cx+1,cy+1,0).ok)
        return {cx,cy};
    }
  }
  return null;
}
function frontierLayout(seed){
  const list=[];
  for(const def of FRONTIER_SITES){
    const pos=frontierFindSpot(def,list,seed);
    if(pos)list.push({...def,...pos,id:list.length,x:cellC(pos.cx+0.5),z:cellC(pos.cy+0.5),visited:0,owner:-1,prog:[0,0],inc:0,mesh:null});
  }
  return list;
}
function frontierInitMesh(){
  if(!FRONTIER.cube)FRONTIER.cube=new THREE.BoxGeometry(1,1,1);
  if(!FRONTIER.mat){
    FRONTIER.mat={
      wood:new THREE.MeshLambertMaterial({color:0x86613e}),
      stone:new THREE.MeshLambertMaterial({color:0x9d9682}),
      roof:new THREE.MeshLambertMaterial({color:0x9b5140}),
      gold:new THREE.MeshLambertMaterial({color:0xe4c17a}),
      leaves:new THREE.MeshLambertMaterial({color:0x759358}),
    };
    FRONTIER.roof=new THREE.ConeGeometry(1,1,4);
  }
}
function frontierBox(group,w,h,d,x,y,z,material){
  const mesh=new THREE.Mesh(FRONTIER.cube,FRONTIER.mat[material]||FRONTIER.mat.wood);
  mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  return mesh;
}
function frontierLandmarkMesh(site){
  frontierInitMesh();
  // 1.10: podrobné modely z jedné sloučené geometrie (doškové střechy, studna, stany, jeřáb, výheň…)
  const g=new THREE.Group(),p=[],W=0xe2d6bc,TH=0xc7a75a,TL=0x9c4a32,S=0xa39d8f,SD=0x7f796c,WD=0x7a5a3c,WK=0x56402c;
  g.position.set(site.x,heightAt(site.x,site.z),site.z);
  const house=(x,z,ry,w,d,wall,roof)=>{
    const c=Math.cos(ry),s2=Math.sin(ry),at=(lx,lz)=>[x+lx*c+lz*s2,z-lx*s2+lz*c];
    p.push(P(box(w,1.3,d),wall,x,0.65,z,0,ry,0));
    p.push(P(cyl(w/1.732*1.15,w/1.732*1.15,d+0.35,3),roof,x,1.3+0.55,z,-Math.PI/2,ry,0,1,1,0.62));
    const [dx,dz]=at(0,d/2+0.01);p.push(P(box(0.42,0.75,0.05),WK,dx,0.38,dz,0,ry,0));
    for(const sx of [-1,1]){const [wx,wz]=at(sx*w*0.3,d/2+0.01);p.push(P(box(0.3,0.28,0.05),0x3b4a55,wx,0.85,wz,0,ry,0));}
  };
  const fence=(x0,z0,x1,z1)=>{const n=Math.max(2,Math.round(Math.hypot(x1-x0,z1-z0)/0.8));for(let i=0;i<=n;i++){const t=i/n;p.push(P(box(0.1,0.6,0.1),WD,x0+(x1-x0)*t,0.3,z0+(z1-z0)*t));}
    const a=Math.atan2(x1-x0,z1-z0),L=Math.hypot(x1-x0,z1-z0);for(const y of [0.25,0.5])p.push(P(box(0.05,0.06,L),WD,(x0+x1)/2,y,(z0+z1)/2,0,a,0));};
  if(site.kind==='village'){
    house(-1.9,0.2,0.2,2.1,1.7,W,TH);house(1.7,-1.1,-0.35,1.9,1.6,W,TH);house(0.5,2.1,1.4,1.6,1.4,0xd8c9a6,TH);
    p.push(P(cyl(0.45,0.5,0.6,10),S,-0.2,0.3,-1.6),P(cyl(0.36,0.36,0.08,10),0x2c4a5a,-0.2,0.6,-1.6),P(box(0.08,1.0,0.08),WD,-0.6,0.9,-1.6),P(box(0.08,1.0,0.08),WD,0.2,0.9,-1.6),P(cyl(0.05,0.55,0.4,4),TL,-0.2,1.55,-1.6,0,Math.PI/4,0));
    p.push(P(cyl(0.45,0.6,0.7,8),0xd9bf6a,2.6,0.35,1.4),P(cyl(0,0.45,0.35,8),0xcfb35e,2.6,0.87,1.4));
    fence(-3.2,-2.6,-0.9,-3.1);fence(2.9,-2.4,3.2,0.4);
  } else if(site.kind==='ruins'){
    p.push(P(box(4.2,0.3,3.9),SD,0,0.12,0));
    for(const [x,z,h] of [[-1.4,-1.3,2.4],[1.4,-1.2,1.5],[-1.3,1.3,0.9],[1.3,1.4,2.0],[0,-1.4,1.2]])p.push(P(cyl(0.3,0.34,h,9),S,x,h/2+0.25,z),P(box(0.75,0.18,0.75),SD,x,0.3,z));
    p.push(P(box(3.0,0.32,0.62),S,-0.1,2.65,-1.3,0,0,-0.06),P(box(0.7,0.5,0.6),S,0.9,0.5,0.3,0.4,0.6,0.2),P(box(0.5,0.35,1.1),SD,-0.7,0.42,0.6,0,0.9,0.3));
    p.push(P(box(1.2,0.25,0.4),0xe4c17a,0.1,0.42,-0.2),P(cyl(0.2,0.2,0.4,8),0x6d8f4a,-1.6,0.45,0.1));
  } else if(site.kind==='tower'){
    for(const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]])p.push(P(cyl(0.13,0.17,3.6,6),WD,x,1.8,z,x*0.05,0,-z*0.05));
    p.push(P(box(2.8,0.22,2.8),WD,0,3.55,0),P(box(0.1,0.1,2.0),WK,0,1.3,0,0,0.78,0.6),P(box(0.1,0.1,2.0),WK,0,2.4,0,0,-0.78,-0.6));
    for(const s2 of [-1,1]){p.push(P(box(2.8,0.08,0.08),WK,0,4.1,s2*1.35),P(box(0.08,0.08,2.8),WK,s2*1.35,4.1,0));}
    for(const [x,z] of [[-1.3,-1.3],[1.3,-1.3],[-1.3,1.3],[1.3,1.3]])p.push(P(box(0.1,1.2,0.1),WK,x,4.2,z));
    p.push(P(cyl(0.05,2.25,1.2,4),TL,0,5.4,0,0,Math.PI/4,0),P(box(0.1,3.6,0.6),WD,1.55,1.8,0,0,0,0.12));
  } else if(site.kind==='quarry'){
    for(let i=0;i<6;i++)p.push(P(box(1.1+0.2*i,0.45+0.12*i,1.0),i%2?S:SD,Math.sin(i*2.3)*1.7,0.25+i*0.04,Math.cos(i*2.3)*1.5,0,i*0.7,0));
    p.push(P(box(0.15,2.6,0.15),WD,-2.1,1.3,0),P(box(1.8,0.12,0.12),WD,-1.3,2.55,0,0,0,-0.15),P(box(0.03,1.2,0.03),0x2a2622,-0.5,1.95,0),P(box(0.4,0.3,0.3),S,-0.5,1.25,0));
    p.push(P(box(1.1,0.35,0.7),WD,1.9,0.5,1.6),P(cyl(0.3,0.3,0.1,8),WK,1.5,0.3,1.95,Math.PI/2,0,0),P(cyl(0.3,0.3,0.1,8),WK,2.3,0.3,1.95,Math.PI/2,0,0));
  } else if(site.kind==='camp'){
    for(const [x,z,c] of [[-1.5,0.9,0xd8cba8],[1.4,1.2,0xc9b48c],[0.2,-1.6,0xb98f65]])p.push(P(cyl(0.05,1.15,1.6,6),c,x,0.8,z),P(box(0.06,1.8,0.06),WK,x,0.9,z));
    for(let i=0;i<6;i++){const a=i*1.05;p.push(P(cyl(0.07,0.07,0.8,5),WK,Math.cos(a)*0.3,0.12,Math.sin(a)*0.3,Math.PI/2,a,0));}
    p.push(P(blob(0.26),0xff9a3a,0,0.3,0,0,0,0,1,1.4,1),P(cyl(0.6,0.7,0.12,10),SD,0,0.06,0));
    p.push(P(box(1.1,0.4,0.8),WD,2.4,0.55,-0.9),P(cyl(0.32,0.32,0.1,8),WK,2.0,0.32,-0.5,Math.PI/2,0,0),P(cyl(0.32,0.32,0.1,8),WK,2.8,0.32,-0.5,Math.PI/2,0,0));
  } else {
    house(0,0,0,2.4,2.0,0x9d9682,TL);
    p.push(P(box(0.55,2.6,0.55),SD,0.75,1.3,-0.5),P(box(0.7,0.3,0.7),S,0.75,2.65,-0.5));
    p.push(P(box(0.5,0.3,0.28),0x3a3d42,2.0,0.55,1.1),P(box(0.25,0.4,0.2),0x3a3d42,2.0,0.25,1.1),P(box(1.6,0.12,0.7),WD,2.1,0.9,-0.6));
    for(const [x,z] of [[-2.0,1.0],[-2.3,0.3],[-1.6,1.5]])p.push(P(cyl(0.28,0.28,0.65,10),WD,x,0.33,z),P(cyl(0.29,0.29,0.06,10),0x3a3d42,x,0.45,z));
  }
  const mesh=new THREE.Mesh(merge(p),bldMat||new THREE.MeshLambertMaterial({vertexColors:true}));
  mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);
  g.visible=false;scene.add(g);FRONTIER.groups.push(g);site.mesh=g;
}
function frontierBridges(){
  if(G.match.map!=='river')return;
  frontierInitMesh();
  for(const cy of RIVER_CROSSINGS){
    const xs=[];
    for(let x=1;x<N-1;x++)if(bridgeMask[cidx(x,cy)])xs.push(x);
    if(!xs.length)continue;
    const a=Math.min(...xs),b=Math.max(...xs);
    const g=new THREE.Group();
    const cx=(a+b+1)*CS/2,z=(cy+1)*CS;
    frontierBox(g,(b-a+1)*CS,0.27,CS*2.05,cx,1.22,z,'wood');
    for(let x=a;x<=b;x++){
      frontierBox(g,CS*0.88,0.06,CS*2.03,cellC(x),1.40,z,x%4===0?'stone':'wood');
    }
    for(const zz of [z-CS*1.13,z+CS*1.13]){
      frontierBox(g,(b-a+1)*CS,0.17,0.14,cx,2.22,zz,'wood');
      for(let x=a;x<=b;x+=3)frontierBox(g,0.20,0.93,0.20,cellC(x),1.83,zz,'wood');
    }
    scene.add(g);FRONTIER.bridges.push(g);
  }
}
function frontierReset(){
  if(scene){
    for(const g of FRONTIER.groups)scene.remove(g);
    for(const g of FRONTIER.bridges)scene.remove(g);
  }
  FRONTIER.groups=[];FRONTIER.bridges=[];FRONTIER.sites=[];
  FRONTIER.acc=0;FRONTIER.redraw=true;FRONTIER.legacy=false;FRONTIER.events=[];FRONTIER.evNext=0;FRONTIER.evId=0;
}
function frontierBuild(seed,oldSave){
  frontierReset();
  frontierBridges();
  FRONTIER.legacy=!!oldSave;
  // Partie z 1.6 a starších nemusí mít prostor pro nové lokality.
  if(oldSave)return;
  FRONTIER.sites=frontierLayout(seed);
  for(const site of FRONTIER.sites){
    for(let y=site.cy;y<site.cy+2;y++)for(let x=site.cx;x<site.cx+2;x++)
      resv[cidx(x,y)]=1;
    frontierLandmarkMesh(site);
  }
}
function frontierWasSeen(site){
  return !!explored[cidx(site.cx,site.cy)];
}
function frontierFrame(){
  for(const site of FRONTIER.sites)if(site.mesh)
    site.mesh.visible=frontierWasSeen(site);
  frontierFlags();
}
function frontierTick(dt){
  FRONTIER.acc+=dt;
  if(FRONTIER.acc<0.32)return;
  const step=FRONTIER.acc;FRONTIER.acc=0;
  if(!FRONTIER.legacy){frontierControl(step);frontierEvents();}
  for(const site of FRONTIER.sites){
    for(const u of units){
      if(u.dead||u.team<0||u.team>1||(site.visited&(1<<u.team)))continue;
      if(Math.hypot(u.x-site.x,u.z-site.z)>4.1)continue;
      site.visited|=1<<u.team;
      const T=teams[u.team];
      if(!T)continue;
      for(const [key,value] of Object.entries(site.reward)){
        gainResource(T,key,value);
        economyRecord(T,key,value);
      }
      T.stats.expeditions=(T.stats.expeditions||0)+1;
      say(u.team,'Průzkumníci navštívili '+site.name+' – získáno: '+
        Object.entries(site.reward).map(([k,v])=>v+' '+RES_NAME[k].toLowerCase()).join(', ')+'.','good');
      FRONTIER.redraw=true;
    }
  }
}
function frontierSave(){
  if(FRONTIER.legacy)return null;
  // [id, navštěvy, vlastník, postup obsazení ×100, příjem] + na konci objekt s událostmi (starší verze ho přeskočí)
  const out=FRONTIER.sites.map(s=>{frontierSiteState(s);return [s.id,s.visited,s.owner,Math.round(s.prog[0]*100),Math.round(s.prog[1]*100),Math.round(s.inc)];});
  out.push({events:(FRONTIER.events||[]).map(e=>({...e})),evNext:Math.round(FRONTIER.evNext||0),evId:FRONTIER.evId||0});
  return out;
}
function frontierLoad(saved){
  if(!Array.isArray(saved))return;
  for(const e of saved){
    if(!Array.isArray(e)||!Number.isInteger(e[0])||!Number.isInteger(e[1]))continue;
    const site=FRONTIER.sites[e[0]];
    if(!site)continue;
    site.visited=e[1]&3;frontierSiteState(site);
    if(e.length>2){
      site.owner=[0,1].includes(e[2])?e[2]:-1;
      site.prog=[clamp((e[3]||0)/100,0,1),clamp((e[4]||0)/100,0,1)];
      site.inc=clamp(e[5]||0,0,SEASON_LEN);
    }
  }
  const extra=saved.find(e=>e&&!Array.isArray(e)&&typeof e==='object');
  if(extra){
    FRONTIER.events=Array.isArray(extra.events)?extra.events.filter(e=>e&&typeof e==='object'&&[0,1].includes(e.team)).slice(-12):[];
    FRONTIER.evNext=Number.isFinite(extra.evNext)?extra.evNext:0;FRONTIER.evId=Number.isInteger(extra.evId)?extra.evId:0;
  }
  FRONTIER.redraw=true;
}
function frontierSummary(team){
  const sites=FRONTIER.sites;
  return {total:sites.length,seen:sites.filter(frontierWasSeen).length,
    visited:sites.filter(s=>!!(s.visited&(1<<team))).length};
}
// 1.7.1: počítačový soupeř posílá jednoho zvěda k nenavštíveným lokalitám.
// Přednost má jezdec, pak lehký voják; vesničana pošle až ve větší osadě.
// Místa u hráčova Sídla odkládá na konec, aby zvěd nevběhl rovnou do obrany.
function frontierAiScout(mine){
  if(!FRONTIER.sites.length||G.time<(AI.scoutNext||0)||G.time<[260,170,100][G.diff])return;
  const T=teams[1];
  // 1.8: osady, které zvěd navštívil, si soupeř koupí spojenectvím, když má zlato navíc
  for(const site of FRONTIER.sites){
    if(!FRONTIER_SETTLE(site.kind)||!(site.visited&2)||frontierSiteState(site).owner===1)continue;
    const cost=frontierAllyCost(1,site);
    if(T.res.gold>=cost.gold+40&&T.res.food>=cost.food+120){frontierAlly(1,site.id);break;}
  }
  // cíle: nejdřív nenavštívená místa, pak obsazení lokalit, které soupeř nedrží (osady jen vojáky)
  const visit=FRONTIER.sites.filter(s=>!(s.visited&2));
  let u=byId.get(AI.scout);
  const soldier=u&&!u.dead&&isSoldier(u);
  const hold=FRONTIER.sites.filter(s=>(s.visited&2)&&frontierSiteState(s).owner!==1&&(!FRONTIER_SETTLE(s.kind)||soldier)&&G.time>[420,320,240][G.diff]);
  const todo=visit.length?visit:hold;
  if(!todo.length){if(u&&!u.dead&&u.order&&u.order.scout)orderStop(u);AI.scout=0;return;}
  if(!u||u.dead||u.team!==1){
    const free=v=>!v.dead&&(!v.order||v.order.type==='move'||v.order.type==='amove');
    const army=mine.filter(v=>isSoldier(v)&&v.def.cls!=='siege'&&free(v));
    const vils=mine.filter(v=>v.type==='vil');
    u=army.find(v=>v.type==='scout')||army.find(v=>v.def.cls==='cav')||army.find(v=>v.def.cls==='inf'||v.def.cls==='arch')||
      (visit.length&&vils.length>=[14,11,8][G.diff]?vils.find(v=>!v.order||v.order.type==='gather'):null);
    if(!u){
      // 1.9: se Stopaři si soupeř vycvičí lehkého zvěda v Sídle
      const tc=frontierTcOf(1);
      if(tc&&T.tech.scouting&&!tc.queue.some(q=>q.id==='scout')&&!mine.some(v=>v.type==='scout')&&T.res.food>=140)enqueue(tc,'u','scout');
      AI.scoutNext=G.time+15;return;
    }
    AI.scout=u.id;
  }
  // zvěd stojí na lokalitě a obsazuje ji: nech ho stát
  const here=FRONTIER.sites.find(s=>Math.hypot(s.x-u.x,s.z-u.z)<FRONTIER_RADIUS-1);
  if(here&&!visit.length&&here.owner!==1&&todo.includes(here))return;
  if(u.order&&u.order.scout)return;
  // po návštěvě si zvěd odpočine; lehký soupeř chodí pomaleji
  if(AI.scoutRest!==u.id+':'+todo.length){AI.scoutRest=u.id+':'+todo.length;AI.scoutNext=G.time+[50,30,14][G.diff];return;}
  const foe=teams[0];let best=null,bd=1e9;
  for(const s of todo){
    const d=Math.hypot(s.x-u.x,s.z-u.z)+(foe&&Math.hypot(s.x-foe.tcx,s.z-foe.tcz)<34?120:0);
    if(d<bd){bd=d;best=s;}
  }
  orderMove(u,best.x+1.2,best.z+1.2,false);
  if(u.order)u.order.scout=1;
  AI.scoutNext=G.time+3;
}
// ---------- 1.8 Živý svět: držení lokalit, spojenectví, události ----------
// Každá lokalita může mít vlastníka. Obsazuje se přítomností jednotek (osady jen vojáky),
// osady se dají získat i spojenectvím. Vlastník dostává každou sezónu (60 s) příjem.
const FRONTIER_INCOME=Object.freeze({village:{food:40,wood:15},camp:{food:25,wood:25},quarry:{stone:45},workshop:{metal:18},ruins:{know:18},tower:{gold:12}});
const FRONTIER_SETTLE=kind=>kind==='village'||kind==='camp';
const FRONTIER_RADIUS=5.5;
const FRONTIER_OFFERS=Object.freeze([
  {give:{gold:80},get:{metal:60}},{give:{gold:50},get:{food:150}},{give:{wood:120},get:{gold:60}},
  {give:{food:120},get:{gold:50}},{give:{gold:60},get:{stone:120}},{give:{gold:70},get:{know:60}},{give:{stone:100},get:{gold:45}},
]);
function frontierSiteState(site){
  if(site.owner===undefined)site.owner=-1;
  if(!Array.isArray(site.prog))site.prog=[0,0];
  if(!(site.inc>=0))site.inc=0;
  return site;
}
function frontierIncome(site,team){
  const T=teams[team],f=T&&T.tech.diplomacy?1.25:1,out={};
  for(const [k,v] of Object.entries(FRONTIER_INCOME[site.kind]||{}))out[k]=Math.round(v*f);
  return out;
}
function frontierAllyCost(team,site){
  const T=teams[team];let f=T&&T.tech.diplomacy?0.6:1;
  if(site.owner>=0&&site.owner!==team)f*=2;
  return {gold:Math.round(40*f),food:Math.round(60*f)};
}
const frontierList=o=>Object.entries(o).map(([k,v])=>v+' '+RES_NAME[k].toLowerCase()).join(', ');
function frontierSetOwner(site,team,how){
  const prev=site.owner;site.owner=team;site.prog=[0,0];site.inc=0;FRONTIER.redraw=true;
  const T=teams[team];if(T){T.stats.sites=(T.stats.sites||0)+1;}
  const what=how==='ally'?'uzavřela spojenectví s tebou':'je teď pod tvou správou';
  say(team,site.name+' '+what+'. Každou sezónu přinese '+frontierList(frontierIncome(site,team))+'.','good');
  if(prev>=0&&prev!==team)say(prev,(how==='ally'?'Soupeř přeplatil spojenectví: ':'Soupeř obsadil ')+site.name+'. Příjem z ní ti končí.','bad');
}
function frontierAlly(team,id){
  const site=FRONTIER.sites[id],T=teams[team];
  if(!site||!T||!FRONTIER_SETTLE(site.kind))return 'Spojenectví jde uzavřít jen s osadou nebo táborem.';
  frontierSiteState(site);
  if(!(site.visited&(1<<team)))return 'Nejdřív musí osadu navštívit tvůj průzkumník.';
  if(site.owner===team)return 'S touto osadou už spojenectví máš.';
  const cost=frontierAllyCost(team,site);
  if(!afford(T,cost))return 'Na spojenectví chybí: '+missing(T,cost)+'.';
  pay(T,cost);frontierSetOwner(site,team,'ally');return null;
}
function frontierMerchant(team,id){
  const ev=(FRONTIER.events||[]).find(e=>e.id===id&&e.type==='merchant'&&e.team===team&&!e.done);
  const T=teams[team];if(!ev||!T)return 'Obchodník už odjel.';
  if(G.time>ev.until)return 'Obchodník už odjel.';
  if(!afford(T,ev.give))return 'Na obchod chybí: '+missing(T,ev.give)+'.';
  pay(T,ev.give);for(const [k,v] of Object.entries(ev.get)){gainResource(T,k,v);}
  ev.done=true;FRONTIER.redraw=true;say(team,'Obchodník ti prodal '+frontierList(ev.get)+'.','good');return null;
}
function frontierControl(step){
  for(const site of FRONTIER.sites){
    frontierSiteState(site);
    const near=[0,0],sold=[0,0];
    for(const u of units){
      if(u.dead||u.team<0||u.team>1||!u.def||u.def.cls==='trade')continue;
      if(Math.hypot(u.x-site.x,u.z-site.z)>FRONTIER_RADIUS)continue;
      near[u.team]++;if(isSoldier(u))sold[u.team]++;
    }
    const settle=FRONTIER_SETTLE(site.kind),pres=settle?sold:near;
    const t=pres[0]&&!pres[1]?0:pres[1]&&!pres[0]?1:-1;
    if(t>=0&&site.owner!==t&&!(peaceActive()&&site.owner>=0)){
      site.prog[t]=Math.min(1,site.prog[t]+step/(settle?16:9)*Math.min(2,1+(pres[t]-1)*0.25));
      site.prog[1-t]=Math.max(0,site.prog[1-t]-step/10);
      if(site.prog[t]>=1)frontierSetOwner(site,t,'capture');
    } else if(t>=0)site.prog[1-t]=Math.max(0,site.prog[1-t]-step/10);
    else if(!pres[0]&&!pres[1])for(let k=0;k<2;k++)site.prog[k]=Math.max(0,site.prog[k]-step/30);
    if(site.owner>=0){
      site.inc+=step;
      if(site.inc>=SEASON_LEN){
        site.inc-=SEASON_LEN;const T=teams[site.owner];
        if(T)for(const [k,v] of Object.entries(frontierIncome(site,site.owner))){gainResource(T,k,v);economyRecord(T,k,v);}
      }
    }
  }
}
function frontierTcOf(team){return blds.find(b=>b.team===team&&b.type==='tc'&&!b.dead);}
function frontierEvent(){
  const roll=Math.random(),ev=FRONTIER.events||(FRONTIER.events=[]);
  const id=(FRONTIER.evId=(FRONTIER.evId||0)+1);
  if(roll<0.45){
    for(const team of [0,1]){
      const offer=FRONTIER_OFFERS[Math.floor(Math.random()*FRONTIER_OFFERS.length)];
      const e={id:id*2+team,type:'merchant',team,give:offer.give,get:offer.get,until:G.time+75,done:false};ev.push(e);
      say(team,'Do osady dorazil putující obchodník: nabízí '+frontierList(e.get)+' za '+frontierList(e.give)+'. Obchod uzavřeš v panelu Svět (M).','good');
      if(team===1&&aiOn()){const T=teams[1],[k]=Object.keys(e.get);if(T.res[k]<200&&Object.keys(e.give).every(g=>T.res[g]>=e.give[g]+60))frontierMerchant(1,e.id);}
    }
  } else if(roll<0.75&&G.time>SEASON_LEN*8){
    const ruins=FRONTIER.sites.find(s=>s.kind==='ruins');
    const team=ruins&&ruins.owner>=0?1-ruins.owner:Math.random()<0.5?0:1;
    const tc=frontierTcOf(team);if(!tc)return;
    ev.push({id,type:'raid',team,at:G.time+30,until:G.time+30,done:false});
    say(team,'Z ruin vyrazila banda lapků k tvé osadě! Dorazí za 30 sekund. Postav k Sídlu vojáky nebo věže.','bad');
    sayAlert({team,x:tc.x,z:tc.z,isB:true});
  } else {
    const team=[0,1].filter(k=>teams[k]&&teams[k].pop+2<=teams[k].cap&&teams[k].pop<60).sort(()=>Math.random()-0.5)[0];
    if(team===undefined)return;
    const tc=frontierTcOf(team);if(!tc)return;
    spawnFrom(tc,'vil');spawnFrom(tc,'vil');
    ev.push({id,type:'refugees',team,until:G.time+20,done:true});
    say(team,'K Sídlu dorazili uprchlíci z vypálené vesnice a přidali se k tobě: 2 noví vesničané.','good');
  }
}
function frontierRaid(e){
  e.done=true;const T=teams[e.team],tc=frontierTcOf(e.team);if(!T||!tc)return;
  let def=0;
  for(const u of units)if(u.team===e.team&&!u.dead&&isSoldier(u)&&Math.hypot(u.x-tc.x,u.z-tc.z)<32)def++;
  for(const b of blds)if(b.team===e.team&&!b.dead&&b.done&&b.type==='tower'&&Math.hypot(b.x-tc.x,b.z-tc.z)<32)def+=2;
  const need=3+T.era;
  if(def>=need){gainResource(T,'gold',30);e.won=true;say(e.team,'Lapkové narazili na tvé vojáky a utekli. V jejich táboře zůstalo 30 zlata.','good');return;}
  const loss={};
  for(const k of ['food','wood','gold']){const v=Math.floor(T.res[k]*0.12);if(v>0){T.res[k]-=v;loss[k]=v;}}
  if(G.real){const f=blds.filter(b=>b.team===e.team&&FLAMMABLE(b));if(f.length)ignite(f[Math.floor(Math.random()*f.length)]);}
  say(e.team,'Lapkové vyplenili osadu'+(Object.keys(loss).length?' a odnesli '+frontierList(loss):'')+'. Na obranu potřebuješ u Sídla aspoň '+need+' vojáky nebo věže.','bad');
}
function frontierEvents(){
  if(FRONTIER.legacy)return;
  if(!(FRONTIER.evNext>0))FRONTIER.evNext=Math.max(300,G.match.peace+90)+Math.random()*120;
  if(G.time>=FRONTIER.evNext){FRONTIER.evNext=G.time+150+Math.random()*120;frontierEvent();FRONTIER.redraw=true;}
  const ev=FRONTIER.events||[];
  for(const e of ev)if(e.type==='raid'&&!e.done&&G.time>=e.at){frontierRaid(e);FRONTIER.redraw=true;}
  FRONTIER.events=ev.filter(e=>G.time<=e.until+40).slice(-12);
}
// Vidění z držených lokalit (hláska vidí daleko).
function frontierVision(team){
  for(const site of FRONTIER.sites)if(site.owner===team)reveal(site.cx,site.cy,site.kind==='tower'?13:5);
  const T=teams[team];
  if(T&&T.tech.cartography)for(const site of FRONTIER.sites)
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(inMap(site.cx+dx,site.cy+dy))explored[cidx(site.cx+dx,site.cy+dy)]=1;
}
function frontierFlag(site){
  frontierInitMesh();
  if(site.flag)return site.flag;
  const pole=new THREE.Mesh(FRONTIER.cube,FRONTIER.mat.wood);pole.scale.set(0.14,3.6,0.14);pole.position.set(2.6,1.8,-2.2);
  const mat=new THREE.MeshLambertMaterial({color:0xffffff});
  const cloth=new THREE.Mesh(FRONTIER.cube,mat);cloth.scale.set(1.3,0.8,0.06);cloth.position.set(3.3,3.2,-2.2);
  const g=new THREE.Group();g.add(pole);g.add(cloth);g.userData.cloth=cloth;g.visible=false;
  if(site.mesh)site.mesh.add(g);site.flag=g;return g;
}
function frontierFlags(){
  for(const site of FRONTIER.sites){
    if(!site.mesh)continue;frontierSiteState(site);
    const f=frontierFlag(site);f.visible=site.owner>=0;
    if(site.owner>=0){const c=TEAM_COLORS[site.owner];if(f.userData.col!==c){f.userData.col=c;f.userData.cloth.material.color.setHex(c);}
      f.userData.cloth.rotation.y=Math.sin(G.time*2.2+site.id)*0.25;}
  }
}
