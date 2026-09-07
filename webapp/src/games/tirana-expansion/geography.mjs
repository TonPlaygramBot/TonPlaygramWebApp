/** Map coordinates stay in the original WORLD metre frame. Never shift the city
 * to make a distant landmark fit. Source coordinates are not survey guarantees. */
export const REFERENCES = Object.freeze({
  lower: Object.freeze({id:'dajti-lower',name:'Dajti Ekspres · lower station',latitude:41.35078,longitude:19.86106,osm:'node/1911239826',source:'https://mapcarta.com/N1911239826',accuracy:'OSM mirror, rounded to five decimals'}),
  upper: Object.freeze({id:'dajti-upper',name:'Dajti Ekspres · upper station',latitude:41.36842,longitude:19.90559,osm:'node/8956716488',source:'https://mapcarta.com/N8956716488',accuracy:'OSM mirror, rounded to five decimals'})
});
export const CIVIC_SITES = Object.freeze([
  {id:'culture',way:'1249637844',name:'Palace of Culture',material:'limestone',source:'https://51n4e.com/projects/skanderbeg-square/'},
  {id:'bank',way:'236566880',name:'Bank of Albania',material:'brick',source:'https://www.bankofalbania.org/'},
  {id:'city-hall',way:'175108137',name:'Tirana City Hall',material:'ochre',source:'https://www.openstreetmap.org/way/175108137'},
  {id:'hotel',way:'236566876',name:'Tirana International Hotel',material:'limestone',source:'https://www.openstreetmap.org/way/236566876'}
].map(Object.freeze));
export function project(origin,latitude,longitude) {
  if(!Array.isArray(origin)||origin.length!==2||![...origin,latitude,longitude].every(Number.isFinite)||Math.abs(origin[0])>=90||Math.abs(latitude)>90||Math.abs(longitude)>180)throw Error('Invalid geographic coordinate');
  return {x:(longitude-origin[1])*111320*Math.cos(origin[0]*Math.PI/180),z:(origin[0]-latitude)*111320};
}
export function unproject(origin,p) {
  project(origin,origin[0],origin[1]);
  if(!p||![p.x,p.z].every(Number.isFinite))throw Error('Invalid map point');
  return {latitude:origin[0]-p.z/111320,longitude:origin[1]+p.x/(111320*Math.cos(origin[0]*Math.PI/180))};
}
export function referenceLinks(origin,p) {
  const {latitude,longitude}=unproject(origin,p),coordinate=`${latitude.toFixed(7)},${longitude.toFixed(7)}`;
  return {
    satellite:`https://www.google.com/maps/@?api=1&map_action=map&center=${coordinate}&zoom=19&basemap=satellite`,
    streetView:`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coordinate}`,
    openMap:`https://www.openstreetmap.org/?mlat=${latitude.toFixed(7)}&mlon=${longitude.toFixed(7)}#map=19/${latitude.toFixed(7)}/${longitude.toFixed(7)}`
  };
}
export function civicSites(world) {
  return CIVIC_SITES.flatMap(site=>{
    const matches=world.buildings.filter(b=>String(b.id)===site.way);
    if(matches.length!==1)return [];
    const b=matches[0],p=b.p;
    if(!p?.length||p.some(v=>v.length<2||!v.slice(0,2).every(Number.isFinite)))return [];
    return [{...site,x:p.reduce((s,v)=>s+v[0],0)/p.length,z:p.reduce((s,v)=>s+v[1],0)/p.length,footprint:p.map(v=>v.slice(0,2)),height:Number(b.h)||12}];
  });
}
/** Broad skyline only. NOT a DEM or terrain used by player collision. */
export function mountainHeight(x,z,origin) {
  const top=project(origin,REFERENCES.upper.latitude,REFERENCES.upper.longitude);
  const dx=x-top.x-1050,dz=z-top.z;
  const ridge=1450*Math.exp(-((dx/1500)**2+(dz/4200)**2));
  const foothill=160*Math.exp(-(((dx+2100)/1700)**2+(dz/3200)**2));
  const lower=project(origin,REFERENCES.lower.latitude,REFERENCES.lower.longitude);
  const vx=top.x-lower.x,vz=top.z-lower.z;
  const t=Math.max(0,Math.min(1,((x-lower.x)*vx+(z-lower.z)*vz)/(vx*vx+vz*vz)));
  const distance=Math.hypot(x-lower.x-vx*t,z-lower.z-vz*t);
  // An explicitly authored corridor keeps the visible cable above its terrain
  // and seats the stations. This is continuity/clearance, NOT a measured DEM.
  const blend=Math.exp(-((distance/600)**4));
  const corridor=274+770*t+69*Math.sin(Math.PI*t);
  return (30+ridge+foothill)*(1-blend)+corridor*blend;
}
/** Cable support locations, sag and elevations are authored approximations.
 * Only terminal horizontal coordinates are tied to the cited map records. */
export function cablePath(origin,samples=97) {
  if(!Number.isInteger(samples)||samples<2||samples>1025)throw Error('Invalid cable sample count');
  const a=project(origin,REFERENCES.lower.latitude,REFERENCES.lower.longitude),b=project(origin,REFERENCES.upper.latitude,REFERENCES.upper.longitude);
  return Array.from({length:samples},(_,i)=>{const t=i/(samples-1);return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,y:280+770*t+95*Math.sin(Math.PI*t)};});
}
export function cablePose(path,t,returning=false,lane=2.1) {
  if(path.length<2||!Number.isFinite(t)||!Number.isFinite(lane))throw Error('Invalid cable journey');
  const u=Math.max(0,Math.min(1,t)),p=(returning?1-u:u)*(path.length-1),i=Math.min(path.length-2,Math.floor(p)),f=p-i,a=path[i],b=path[i+1];
  const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,offset=returning?-lane:lane;
  return {x:a.x+dx*f+dz/len*offset,y:a.y+(b.y-a.y)*f,z:a.z+dz*f-dx/len*offset,yaw:Math.atan2(-dx,-dz)+(returning?Math.PI:0)};
}
