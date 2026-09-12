import {bounds,inside,distance,hash} from '../tirana-city-completion/placementCore.mjs';
/** Mapped vegetation extents, not a survey of individual trunks. Plain grass,
 * pitches, parking and construction sites are deliberately not tree extents. */
export function vegetationKind(tags={}) {
 if(tags.building||tags.sport||tags.landuse==='construction')return null;
 if(tags.natural==='wood'||tags.landuse==='forest')return 'woodland';
 if(tags.landuse==='orchard')return 'orchard';
 if(['park','garden'].includes(tags.leisure))return 'garden';
 return null;
}
export function* canopyCandidates(feature){
 const kind=vegetationKind(feature.tags);if(!kind)return;
 const spacing=kind==='woodland'?11:kind==='orchard'?10:17;
 const [minX,minZ,maxX,maxZ]=bounds(feature.p),seed=hash(feature.id);
 const random=n=>((Math.imul(seed^n,1664525)+1013904223)>>>0)/4294967296;
 for(let ix=0,x=minX+spacing*.5;x<maxX;x+=spacing,ix++)for(let iz=0,z=minZ+spacing*.5;z<maxZ;z+=spacing,iz++){
  const n=hash(ix+':'+iz),px=x+(random(n)-.5)*spacing*.55,pz=z+(random(n^97531)-.5)*spacing*.55;
  if(!inside(px,pz,feature.p,feature.holes)||[feature.p,...(feature.holes||[])].some(r=>r.some((a,i)=>distance([px,pz],a,r[(i+1)%r.length])<2.8)))continue;
  yield {id:`canopy/${feature.id}/${ix}/${iz}`,x:+px.toFixed(2),z:+pz.toFixed(2),seed:n,kind};
 }
}
