import {WORLD} from '../tiranastreets/shared/world.mjs';
import {SIGNALS,SHOP} from '../tiranastreets/shared/streetLayout.mjs';
import {RIVER_PATHS} from '../tiranastreets/shared/landscape.mjs';
import {buildRoadDetails,createPostCollider} from './roadDetailCore.mjs';
export const STREET_DETAILS=buildRoadDetails(WORLD,{signals:SIGNALS,river:RIVER_PATHS,exclude:(x,z)=>Math.hypot(x-SHOP.x,z-SHOP.z)<12});
export const collideDetailPosts=createPostCollider(STREET_DETAILS.posts);
export const detailPostObstacles=(origin={x:0,z:0})=>STREET_DETAILS.posts.map(p=>({x:p.x-origin.x,z:p.z-origin.z,w:p.radius*2,d:p.radius*2,h:p.height+.23,minY:.23}));
