import {edgeDistance} from './walkDrive.mjs';
export const LANA_DISTRICT='districts/lana-blloku.json';
export const LANA_TREE='districts/lana-tree.glb';
export const FIXTURES='/assets/tirana-streets/detail-kit/urban-fixtures.glb';
// West of the first block's spawn with enough lead to keep the current map
// interactive while the compact independent district is downloaded.
export const approachLana=({x,z})=>Number.isFinite(x)&&Number.isFinite(z)&&x<-65&&z>130&&z<625;
export function appendDistrict(central,zone){
  if(!zone||!Array.isArray(zone.bounds)||zone.bounds.join(',')!=='-580,155,-118,733'||!zone.roads?.length||!zone.buildings?.length||!zone.water?.length)throw Error('Invalid district');
  const [a,b,c,d]=central.bounds,[e,f,g,h]=zone.bounds;
  return {...central,bounds:[Math.min(a,e),Math.min(b,f),Math.max(c,g),Math.max(d,h)],regions:[central.bounds,zone.bounds],
    ...Object.fromEntries(['roads','buildings','areas','parks','water','landmarks'].map(key=>[key,[...central[key],...zone[key]]]))};
}

function contains(x,z,polygon){
  let hit=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[j],b=polygon[i];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }
  return hit;
}
const range=p=>[Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))];
// Authored public furniture placements, not an inventory of specific real fixtures.
export function districtPlacements(zone,mobility){
  const roofs=[],parks=[];
  for(const b of zone.buildings){
    const [loX,loZ,hiX,hiZ]=range(b.p),height=Math.min(83,b.h||0);
    const x=(loX+hiX)/2,z=(loZ+hiZ)/2;
    if(hiX-loX>9&&hiZ-loZ>8&&height>8&&x<-135&&contains(x,z,b.p))roofs.push({x,z,y:height,yaw:0,kind:'water-tank'});
  }
  const away=(x,z)=>!mobility.obstructed(x,z,1.9)&&!zone.roads.some(r=>edgeDistance(x,z,r.a,r.b)<r.w/2+1.7);
  for(const p of zone.parks){
    const [loX,loZ,hiX,hiZ]=range(p);
    if(hiX-loX<7||hiZ-loZ<7)continue;
    let placed=false;
    for(const xx of [.5,.27,.73]){
      for(const zz of [.5,.27,.73]){
        const x=loX+(hiX-loX)*xx,z=loZ+(hiZ-loZ)*zz;
        if(!contains(x,z,p)||!away(x,z))continue;
        parks.push({x,z,y:.06,yaw:xx*5.2,kind:'park-bench'});
        if(hiX-loX>17&&hiZ-loZ>12){
          const ox=x+(xx<.5?4:-4);
          if(contains(ox,z+3,p)&&away(ox,z+3))parks.push({x:ox,z:z+3,y:.06,yaw:zz*6.2,kind:'tree',height:7,crown:7.4});
        }
        placed=true;break;
      }
      if(placed)break;
    }
  }
  return [...parks,...roofs];
}
