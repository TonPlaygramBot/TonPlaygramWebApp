import {WORLD} from '../tiranastreets/shared/world.mjs';
import {SIGNALS,SHOP} from '../tiranastreets/shared/streetLayout.mjs';
import {RIVER_PATHS} from '../tiranastreets/shared/landscape.mjs';
import {buildRoadDetails,createPostCollider} from './roadDetailCore.mjs';
import {MAPPED_CYCLING} from '../tirana-city-source/registry.mjs';
import {cyclingDecals} from '../tirana-city-source/sourceCore.mjs';
const exclude=(x,z)=>Math.hypot(x-SHOP.x,z-SHOP.z)<12;
const existing=buildRoadDetails(WORLD,{signals:SIGNALS,river:RIVER_PATHS,exclude,includeCycling:false,includePosts:false});
export const STREET_DETAILS={...existing,
  // Remove visible concrete bollards and their physics from every city mode.
  posts:Object.freeze([]),
  decals:Object.freeze([...existing.decals,...cyclingDecals(MAPPED_CYCLING.segments,WORLD,exclude)]),
  cycles:Object.freeze(MAPPED_CYCLING.segments),
  accuracy:'OSM cycling centrelines and side tags; missing widths and marking style are authored. Metal roadside railings retained; concrete bollards removed.'};
export const collideDetailPosts=createPostCollider(STREET_DETAILS.posts);
export const detailPostObstacles=(origin={x:0,z:0})=>STREET_DETAILS.posts.map(p=>({x:p.x-origin.x,z:p.z-origin.z,w:p.radius*2,d:p.radius*2,h:p.height+.23,minY:.23}));
