/** Regional references are NOT roads or survey control points. WGS84 degrees.
 * No new coordinates are written into the original playable WORLD. */
export const REGION_REFERENCES = Object.freeze([
  {id:'kamza-turn',name:'Kthesa e Kamzës',latitude:41.34357,longitude:19.77643,source:'https://mapcarta.com/N10909820605',osm:'node/10909820605',accuracy:'Rounded OSM bus-stop position, not interchange geometry'},
  {id:'teg',name:'TEG · Rruga e Elbasanit',latitude:41.28316,longitude:19.85720,source:'https://mapcarta.com/W293898197',osm:'way/293898197',accuracy:'Rounded OSM building centre, not a road entrance'},
  {id:'dajti-lower',name:'Dajti · stacioni i poshtëm',latitude:41.35078,longitude:19.86106,source:'https://mapcarta.com/N1911239826',osm:'node/1911239826',accuracy:'Rounded OSM terminal reference'},
  {id:'dajti-upper',name:'Dajti · stacioni i sipërm',latitude:41.36842,longitude:19.90559,source:'https://mapcarta.com/N8956716488',osm:'node/8956716488',accuracy:'Rounded OSM terminal reference'},
  {id:'dajti-summit',name:'Mali i Dajtit · maja',latitude:41.3666378,longitude:19.9240231,source:'https://mapy.com/en/?id=6304596&source=osm',accuracy:'OSM mirror peak position; not a drivable destination'}
].map(Object.freeze));
// Authored acquisition envelope, not an administrative boundary or ring-road line.
export const REGION_BBOX = Object.freeze([19.740,41.270,19.945,41.405]); // west,south,east,north
export const REGION_STATUS='Regional extent and references. Continuous roads, terrain and collision require the reviewed regional import.';
export function projectRegion(origin,latitude,longitude){
  if(!Array.isArray(origin)||origin.length!==2||![...origin,latitude,longitude].every(Number.isFinite)||Math.abs(origin[0])>=89||Math.abs(origin[1])>180||Math.abs(latitude)>90||Math.abs(longitude)>180)throw Error('Invalid WGS84 coordinate');
  return {x:(longitude-origin[1])*111320*Math.cos(origin[0]*Math.PI/180),z:(origin[0]-latitude)*111320};
}
export function regionalReferences(origin){return REGION_REFERENCES.map(p=>({...p,...projectRegion(origin,p.latitude,p.longitude),available:false}));}
export function regionalBounds(origin,cityBounds){
  if(!Array.isArray(cityBounds)||cityBounds.length!==4||!cityBounds.every(Number.isFinite)||cityBounds[0]>=cityBounds[2]||cityBounds[1]>=cityBounds[3])throw Error('Invalid city bounds');
  const a=projectRegion(origin,REGION_BBOX[3],REGION_BBOX[0]),b=projectRegion(origin,REGION_BBOX[1],REGION_BBOX[2]);
  return Object.freeze([Math.min(cityBounds[0],a.x),Math.min(cityBounds[1],a.z),Math.max(cityBounds[2],b.x),Math.max(cityBounds[3],b.z)]);
}
export function referenceLinks(p){
  projectRegion([0,0],p.latitude,p.longitude);const c=`${p.latitude.toFixed(7)},${p.longitude.toFixed(7)}`;
  return {satellite:`https://www.google.com/maps/@?api=1&map_action=map&center=${c}&zoom=18&basemap=satellite`,streetView:`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${c}`,earth:'https://earth.google.com/web/',osm:p.osm?`https://www.openstreetmap.org/${p.osm}`:`https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}`};
}
export function buildRegionQuery(){
  const [w,s,e,n]=REGION_BBOX,b=`${s},${w},${n},${e}`;
  return `[out:json][timeout:180];(way[highway](${b});way[building](${b});way[waterway](${b});way[natural=water](${b});relation[natural=water](${b});relation[landuse=reservoir](${b});way[landuse=reservoir](${b});relation[waterway=riverbank](${b});way[landuse~"^(farmland|meadow|grass|forest|orchard|vineyard|allotments|plant_nursery)$"](${b});relation[landuse~"^(farmland|meadow|grass|forest|orchard|vineyard|allotments|plant_nursery)$"](${b});way[natural~"^(wood|scrub|grassland|heath|wetland|bare_rock|scree|sand)$"](${b});relation[natural~"^(wood|scrub|grassland|heath|wetland|bare_rock|scree|sand)$"](${b});way[leisure~"^(park|garden|pitch|golf_course)$"](${b});relation[leisure~"^(park|garden|pitch|golf_course)$"](${b});relation(20772795););(._;>>;);out body;`;
}
/** Bilinear sampling in map metres. Missing/no-data elevations stay missing.
 * sourceDatum / sceneDatum must be explicit; never flatten a failed DEM to zero. */
export function sampleHeight(grid,x,z){
  if(!grid||!Number.isFinite(x)||!Number.isFinite(z)||!Number.isInteger(grid.width)||!Number.isInteger(grid.height)||grid.width<2||grid.height<2||!Array.isArray(grid.bounds)||grid.bounds.length!==4||!grid.bounds.every(Number.isFinite)||grid.values?.length!==grid.width*grid.height)return null;
  const [x0,z0,x1,z1]=grid.bounds;if(x1<=x0||z1<=z0||x<x0||x>x1||z<z0||z>z1)return null;
  const u=(x-x0)/(x1-x0)*(grid.width-1),v=(z-z0)/(z1-z0)*(grid.height-1),i=Math.min(grid.width-2,Math.floor(u)),j=Math.min(grid.height-2,Math.floor(v)),tx=u-i,tz=v-j;
  const a=grid.values[j*grid.width+i],b=grid.values[j*grid.width+i+1],c=grid.values[(j+1)*grid.width+i],d=grid.values[(j+1)*grid.width+i+1];
  if([a,b,c,d].some(h=>!Number.isFinite(h)||h===grid.noData))return null;
  return a*(1-tx)*(1-tz)+b*tx*(1-tz)+c*(1-tx)*tz+d*tx*tz;
}
