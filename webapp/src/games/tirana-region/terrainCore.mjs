import {projectRegion} from './regionCore.mjs';

/** The legacy city frame is retained, not relabelled as a surveyed CRS.
 * All layers use this exact inverse; renderer-local translations happen later. */
export function unprojectTerrain(origin,x,z){
 projectRegion(origin,origin?.[0],origin?.[1]);
 if(![x,z].every(Number.isFinite))throw Error('Invalid city coordinate');
 const latitude=origin[0]-z/111320;
 const longitude=origin[1]+x/(111320*Math.cos(origin[0]*Math.PI/180));
 projectRegion(origin,latitude,longitude);
 return {latitude,longitude};
}

/** A georeferenced elevation grid, not procedural hills. Extent is the centre
 * of the first/last samples, NOT the outside edges of GeoTIFF pixels. */
export function createTerrainSampler(raw,origin,reference){
 projectRegion(origin,origin?.[0],origin?.[1]);
 if(!raw||raw.version!==1||raw.kind!=='tirana-elevation-grid'||raw.horizontalCrs!=='EPSG:4326'||raw.rowOrder!=='north-to-south'||raw.registration!=='sample-centres'||raw.units!=='metre')throw Error('Unsupported terrain grid contract');
 const {width,height,bbox,verticalDatum,surfaceType}=raw;
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2||width*height>4000000||!Array.isArray(raw.values)||raw.values.length!==width*height)throw Error('Invalid terrain dimensions');
 if(!Array.isArray(bbox)||bbox.length!==4||!bbox.every(Number.isFinite))throw Error('Invalid terrain extent');
 const [west,south,east,north]=bbox;
 if(west>=east||south>=north||west< -180||east>180||south<= -89||north>=89)throw Error('Invalid terrain extent');
 if(!['DTM','DSM'].includes(surfaceType)||typeof verticalDatum!=='string'||!verticalDatum.trim())throw Error('Terrain surface type and vertical datum required');
 if(!reference||!Number.isFinite(reference.height)||reference.verticalDatum!==verticalDatum)throw Error('Scene reference must use the same vertical datum; no implicit geoid conversion');
 const source=raw.source;
 if(!source||!/^https:\/\//.test(source.url||'')||typeof source.acquiredAt!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(source.acquiredAt)||!Number.isFinite(Date.parse(source.acquiredAt))||!/^[a-f0-9]{64}$/.test(source.sha256||'')||typeof source.license!=='string'||!source.license.trim())throw Error('Terrain provenance required');
 const url=new URL(source.url);if(!url.hostname||url.username||url.password)throw Error('Invalid terrain source URL');
 // Snapshot all inputs. No-data is never replaced with sea level or nearest land.
 const values=raw.values.map(v=>{if(v===null)return null;if(!Number.isFinite(v))throw Error('Non-finite terrain elevation');return v;});
 const frame=[...origin],base=reference.height;
 const snap=v=>Math.abs(v-Math.round(v))<1e-8?Math.round(v):v;
 function sample(latitude,longitude){
  if(![latitude,longitude].every(Number.isFinite)||longitude<west||longitude>east||latitude<south||latitude>north)return null;
  const u=snap((longitude-west)/(east-west)*(width-1)),v=snap((north-latitude)/(north-south)*(height-1));
  const i=Math.min(width-2,Math.floor(u)),j=Math.min(height-2,Math.floor(v)),tx=u-i,tz=v-j;
  const ids=[j*width+i,j*width+i+1,(j+1)*width+i,(j+1)*width+i+1];
  const weights=[(1-tx)*(1-tz),tx*(1-tz),(1-tx)*tz,tx*tz];
  let elevation=0;
  for(let k=0;k<4;k++){if(weights[k]===0)continue;const value=values[ids[k]];if(value===null)return null;elevation+=value*weights[k];}
  return Object.freeze({elevation,y:elevation-base,verticalDatum,surfaceType});
 }
 return Object.freeze({
  sample,
  sampleWorld(x,z){const p=unprojectTerrain(frame,x,z);return sample(p.latitude,p.longitude);},
  // DSMs include roofs/trees. Neither grid alone approves navigation/collision.
  surfaceType,verticalDatum,runtimeReady:false,
  bounds:Object.freeze([...bbox]),
  coverage:values.filter(v=>v!==null).length/values.length
 });
}
