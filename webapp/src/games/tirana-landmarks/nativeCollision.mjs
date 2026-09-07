import { resolveNativeLandmarks } from './nativeLocations.mjs';

/** Solid volumes of the original native meshes, in the same local metres as
 * nativeModels.mjs. Museum wings leave the real model's courtyard open; the
 * mosque arcade remains traversable between its columns. */
export function nativeLandmarkObstacles(world, origin = {x:0,z:0}) {
  const {landmarks} = resolveNativeLandmarks(world), obstacles = [];
  const add = (l, x, z, w, d, h, minY = 0) => {
    const c = Math.cos(l.yaw), s = Math.sin(l.yaw);
    obstacles.push({landmarkId:l.id, x:l.x-origin.x+x*c+z*s,
      z:l.z-origin.z-x*s+z*c, w, d, h:h+l.groundY, minY, rot:l.yaw});
  };
  for (const l of landmarks) {
    if(l.id==='clock') add(l,0,0,5.6,5.6,35);
    if(l.id==='mosque') {
      add(l,0,0,14,14,13.8);add(l,-8.1,-3,2.5,2.5,30.5);
      for(let i=0;i<6;i++) add(l,-7+i*2.8,9,.52,.52,5.5);
    }
    if(l.id==='pyramid') add(l,0,0,58,58,18.2);
    if(l.id==='museum') {
      add(l,0,21.5,92,17,18.75);add(l,0,-22.5,92,15,18.75);
      add(l,-37,0,18,30,18.75);add(l,37,0,18,30,18.75);
      for(let i=0;i<6;i++) add(l,-22.5+i*9,31.8,.65,1,5.7);
    }
    if(l.id==='eyes') {
      add(l,0,0,46,32,24);add(l,0,0,33.4,28.4,135,24);
    }
    if(l.id==='skanderbeg') {
      add(l,0,0,9,7.2,3.4);add(l,0,-.6,2.2,4.8,10.5,3.4);
    }
  }
  return obstacles;
}
