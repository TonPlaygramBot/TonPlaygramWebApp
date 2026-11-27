// These are authored visual treatments anchored to exact road names in WORLD,
// not surveyed material claims. See docs/tirana-corridor-appearance.md.
import {kodraRoadFinish} from './kodraPriftit.mjs';
const keys=new Map([
 ['bulevardi deshmoret e kombit',1],
 ['bulevardi bajram curri',2],['bulevardi gjergj fishta',2],
 ['rruga e kavajes',3],
 ['rruga e durresit',4],
 ['rruga ali demi',5],['rruga petro nini luarasi',5],
 ['bulevardi zogu i pare',6],['bulevardi i ri',7],['rruga todi shkurti',8],
 ['rruga mine peza',9],['rruga bardhyl',10],['sheshi brryli',11],['ura te brryli',11],
 ['rruga myslym shyri',14],
]);
const bllokuRoutes=new Set(['rruga brigada viii','rruga pjeter bogdani','rruga ismail qemali',
 'rruga abdyl frasheri','rruga andon zako cajupi','rruga sami frasheri','rruga ibrahim rugova']);
const cleanName=name=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
export const BLLOKU_SURFACE_BOUNDS=Object.freeze([-540,550,24,1020]);
const memo=new Map();
export function corridorMaterialId(name){
 if(typeof name!=='string'||!name)return 0;
 if(memo.has(name))return memo.get(name);
 const id=keys.get(cleanName(name))||0;
 if(memo.size<1024)memo.set(name,id);
 return id;
}

/** Select source-confirmed surface subtypes without changing road geometry. */
export function corridorRoadMaterialId(road,sidewalk=false){
 const kodra=kodraRoadFinish(road);
 if(kodra)return kodra;
 const family=corridorMaterialId(road?.name);
 if(!family&&typeof road?.name==='string'&&bllokuRoutes.has(cleanName(road.name))&&road.a&&road.b){
  const x=(road.a[0]+road.b[0])*.5,z=(road.a[1]+road.b[1])*.5;
  const [xmin,zmin,xmax,zmax]=BLLOKU_SURFACE_BOUNDS;
  if(x>=xmin&&x<=xmax&&z>=zmin&&z<=zmax)return 15;
 }
 // The main Durrësit carriageway is asphalt. Only source-tagged drive
 // surfaces receive concrete; pedestrian paving uses its own existing pass.
 if(family===4&&!sidewalk&&!road.walk&&road.tags?.surface==='concrete')return 12;
 // The named Brryli approaches remain an asphalt treatment, not another deck.
 if(family===11&&road.bridge)return 13;
 return family;
}
