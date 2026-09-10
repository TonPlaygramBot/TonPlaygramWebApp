import {validatePolygonRing,containsRing,holesOverlap} from './polygonValidation.mjs';

const LANDUSE=new Set(['farmland','meadow','grass','forest','orchard','vineyard','allotments','plant_nursery']);
const NATURAL=new Set(['wood','scrub','grassland','heath','wetland','bare_rock','scree','sand']);
const LEISURE=new Set(['park','garden','pitch','golf_course']);
const eligible=t=>LANDUSE.has(t.landuse)||NATURAL.has(t.natural)||LEISURE.has(t.leisure);
const evidence=t=>Object.fromEntries(['name','landuse','natural','leisure','crop','surface','ele'].filter(k=>typeof t[k]==='string').map(k=>[k,t[k]]));

/** Preserve source areas, including field boundaries and islands. A farmland
 * tag says how land is used; it never flattens slopes or creates an elevation. */
export function importLandcover(ways,relations,point,stitch){
 const result=[],members=new Set();
 for(const relation of relations){
  const tags=relation.tags||{};if(tags.type!=='multipolygon'||!eligible(tags))continue;
  if((relation.members||[]).some(m=>m.type==='way'&&m.role&&!['outer','inner'].includes(m.role)))throw Error('Unknown landcover member role');
  const chains=role=>(relation.members||[]).filter(m=>m.type==='way'&&(m.role===role||role==='outer'&&!m.role)).map(m=>{
   const way=ways.get(m.ref);if(!way||!Array.isArray(way.nodes))throw Error(`Missing landcover member ${m.ref}`);
   members.add(m.ref);return way.nodes;
  });
  const rings=role=>stitch(chains(role)).map(c=>validatePolygonRing(c.slice(0,-1).map(point),`landcover/${relation.id}`));
  const outer=rings('outer'),inner=rings('inner');if(!outer.length)throw Error('Landcover has no outer ring');
  const polygons=outer.map(outer=>({outer,holes:[]}));
  for(const hole of inner){const owners=polygons.filter(p=>containsRing(p.outer,hole));
   if(owners.length!==1)throw Error('Landcover hole has no unique owner');
   if(owners[0].holes.some(h=>holesOverlap(h,hole)))throw Error('Overlapping landcover holes');
   owners[0].holes.push(hole);
  }
  result.push({id:`relation/${relation.id}`,polygons,tags:evidence(tags),elevation:null,source:`https://www.openstreetmap.org/relation/${relation.id}`});
 }
 for(const way of ways.values()){
  const tags=way.tags||{};if(!eligible(tags)||members.has(way.id))continue;
  if(!Array.isArray(way.nodes)||way.nodes.length<4||way.nodes[0]!==way.nodes.at(-1))throw Error(`Unclosed landcover ${way.id}`);
  const outer=validatePolygonRing(way.nodes.slice(0,-1).map(point),`landcover/${way.id}`);
  result.push({id:`way/${way.id}`,polygons:[{outer,holes:[]}],tags:evidence(tags),elevation:null,source:`https://www.openstreetmap.org/way/${way.id}`});
 }
 return result;
}
