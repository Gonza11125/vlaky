'use strict';
// Věk pokroku 1.7.0 – říční přechody a objevitelné neutrální lokality.
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
  for(let rad=0;rad<=22;rad++){
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
    if(pos)list.push({...def,...pos,id:list.length,x:cellC(pos.cx+0.5),z:cellC(pos.cy+0.5),visited:0,mesh:null});
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
  const g=new THREE.Group();
  g.position.set(site.x,heightAt(site.x,site.z),site.z);
  const house=(x,z)=>{
    frontierBox(g,2.1,1.5,1.8,x,0.75,z,'stone');
    const roof=new THREE.Mesh(FRONTIER.roof,FRONTIER.mat.roof);
    roof.scale.set(1.65,1.2,1.6);roof.rotation.y=Math.PI/4;
    roof.position.set(x,1.98,z);g.add(roof);
  };
  if(site.kind==='village'){
    house(-1.9,0.3);house(1.7,-1);
    frontierBox(g,1.4,0.12,0.5,0.3,0.4,1.7,'wood');
    frontierBox(g,0.35,1.5,0.35,-0.5,0.75,-2,'wood');
  } else if(site.kind==='ruins'){
    for(const [x,z,h] of [[-1.3,-1.2,2.0],[1.3,-1,1.4],[-1.2,1.2,0.8],[1.2,1.3,1.7]])
      frontierBox(g,0.63,h,0.63,x,h/2,z,'stone');
    frontierBox(g,3.9,0.45,3.8,0,0.15,0,'stone');
    frontierBox(g,1.3,0.25,0.5,0,1.1,-1,'gold');
  } else if(site.kind==='tower'){
    for(const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]])
      frontierBox(g,0.36,3.5,0.36,x,1.75,z,'wood');
    frontierBox(g,2.7,0.35,2.7,0,3.5,0,'stone');
    frontierBox(g,0.25,1.35,0.25,0,4.3,0,'wood');
  } else if(site.kind==='quarry'){
    for(let i=0;i<5;i++) frontierBox(g,1.2+0.24*i,0.5+0.14*i,1.1,Math.sin(i*2.5)*1.7,0.4,Math.cos(i*2.5)*1.5,'stone');
    frontierBox(g,0.2,2,0.2,-2,1,0,'wood');
  } else if(site.kind==='camp'){
    house(-1.4,0.8);
    frontierBox(g,0.65,0.30,0.65,1.8,0.15,-0.4,'stone');
    frontierBox(g,0.45,0.55,0.45,1.8,0.5,-0.4,'gold');
    frontierBox(g,0.25,1.8,0.25,2,0.9,1.7,'wood');
  } else {
    house(0,0);
    frontierBox(g,2.1,0.25,0.6,2.3,0.9,1.1,'wood');
    frontierBox(g,0.9,0.55,0.8,-2.1,0.4,1.1,'stone');
  }
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
  FRONTIER.acc=0;FRONTIER.redraw=true;FRONTIER.legacy=false;
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
}
function frontierTick(dt){
  FRONTIER.acc+=dt;
  if(FRONTIER.acc<0.32)return;
  FRONTIER.acc=0;
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
function frontierSave(){return FRONTIER.legacy?null:FRONTIER.sites.map(s=>[s.id,s.visited]);}
function frontierLoad(saved){
  if(!Array.isArray(saved))return;
  for(const e of saved){
    if(!Array.isArray(e)||!Number.isInteger(e[0])||!Number.isInteger(e[1]))continue;
    const site=FRONTIER.sites[e[0]];
    if(site)site.visited=e[1]&3;
  }
  FRONTIER.redraw=true;
}
function frontierSummary(team){
  const sites=FRONTIER.sites;
  return {total:sites.length,seen:sites.filter(frontierWasSeen).length,
    visited:sites.filter(s=>!!(s.visited&(1<<team))).length};
}
