import {roofClearance} from '../tirana-city-source/housingCore.mjs';
export function amenityAnchor(site,clearance=2.8){
 if(!site.ring)return null;
 const xs=site.ring.map(p=>p[0]),zs=site.ring.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
 let best=null,score=-Infinity;
 const step=Math.max(2,Math.max(maxX-minX,maxZ-minZ)/30);
 for(let x=minX+clearance;x<maxX-clearance;x+=step)for(let z=minZ+clearance;z<maxZ-clearance;z+=step){
  const edge=roofClearance(x,z,site.ring);if(edge<clearance)continue;
  const d=(x-site.x)**2+(z-site.z)**2;if(-d>score){score=-d;best={x,z};}
 }
 return best;
}
