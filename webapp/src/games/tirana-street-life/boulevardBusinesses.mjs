/** Public exterior references only; no downloaded photographs or logo artwork. */
export const LAGUNA_BOULEVARD_ID='way/1111613943';
export const BAR_WEST_ID='node/12779107687';

// node/12779107687, mapped 2025-04-23 (shared September street source).
const BAR_WEST_POINT=Object.freeze([65.413,529.661]);
export function boulevardStorefronts(storefronts) {
 const sites=storefronts.map(site=>site.id===LAGUNA_BOULEVARD_ID?
  {...site,name:'Laguna',visualStyle:'laguna-kiosk'}:site);
 // This individually corroborated café is on the public podium frontage;
 // the broad Twin Towers footprint did not resolve to a ground-floor tenant.
 if(!sites.some(site=>site.id===BAR_WEST_ID)){
  const a=[65.53,527.01],b=[72.74,532],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  const nx=dz/length,nz=-dx/length,u=2.85;
  sites.push({id:BAR_WEST_ID,buildingId:'295492165',name:'Bar West',kind:'cafe',shop:null,
   x:a[0]+u*dx/length+.1*nx,z:a[1]+u*dz/length+.1*nz,yaw:Math.atan2(nx,nz),width:4.8,
   street:'Bulevardi Dëshmorët e Kombit',terrace:true,point:BAR_WEST_POINT,
   placementAccuracy:'OSM café point; nearby public-facing podium edge inferred from frontage photograph',
   visualStyle:'bar-west-terrace'});
 }
 return sites;
}
