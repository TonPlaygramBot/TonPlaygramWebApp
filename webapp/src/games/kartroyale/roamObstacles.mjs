import {WORLD} from '../tiranastreets/shared/world.mjs';
import {RAILINGS} from '../tiranastreets/shared/landscape.mjs';
import {clearRoadSegment} from '../tiranastreets/shared/streetSafety.mjs';
import {HYDROGRAPHY} from '../tirana-environment/hydrography.mjs';
import {riverRing} from '../tirana-environment/riverShapeCore.mjs';
import {bridgeRailSections} from '../tirana-environment/infrastructureCore.mjs';
import {LAMPS} from '../tirana-environment/urbanLampRegistry.mjs';
import {CANOPY_TREES} from '../tirana-street-life/canopyRegistry.mjs';
import {MATURE_TREE_IDS,FUEL_CANOPY_IDS} from '../tirana-street-life/registry.mjs';
import {MAPPED_TREES} from '../tirana-city-source/registry.mjs';
import {STREET_DETAILS} from '../tirana-street-detail/sharedRoadDetails.mjs';
import {STREET_SOLIDS} from '../tiranastreets/shared/streetDressing.mjs';

let data;
export function drivingWorldData(){
  return data ||= {
    ...WORLD,
    buildings:WORLD.buildings.filter(b=>!FUEL_CANOPY_IDS.has(b.id)),
    trees:[...CANOPY_TREES.map(t=>({...t,radius:t.crown*.045})),
      ...MAPPED_TREES.filter(t=>!MATURE_TREE_IDS.has(t.id)).map(t=>({...t,radius:.22*t.scale,height:7*t.scale}))],
    waterPolygons:[...HYDROGRAPHY.paths.map(p=>({outer:riverRing(p),holes:[]})),
      ...WORLD.water.filter(Array.isArray).map(outer=>({outer,holes:[]}))],
    obstacles:[...RAILINGS.map(r=>({a:r.a,b:r.b,radius:.055,height:1.16,material:'metal'})),
      ...STREET_SOLIDS.map(p=>{
        const [x0,z0,x1,z1]=p.box,c=Math.cos(p.yaw||0),s=Math.sin(p.yaw||0);
        return {outer:[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(([x,z])=>[p.x+c*x+s*z,p.z-s*x+c*z]),
          material:p.name==='mapped_tree_trunk'?'tree':p.name==='stone_planter'?'concrete':'metal',
          height:p.name==='mapped_tree_trunk'?12:p.name==='stone_planter'?.75:2};
      }),
      ...WORLD.roads.flatMap(r=>bridgeRailSections(r,clearRoadSegment)).map(r=>({...r,radius:.055,height:1.36,material:'metal'})),
      ...LAMPS.map(p=>({x:p.x,z:p.z,radius:.095,height:p.height,material:'metal'})),
      ...STREET_DETAILS.posts.map(p=>({x:p.x,z:p.z,radius:.19,height:1,material:'concrete'}))]
  };
}
