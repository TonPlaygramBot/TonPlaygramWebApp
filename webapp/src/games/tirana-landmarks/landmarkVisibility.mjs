/** Distances only: never relocate or enlarge a landmark to make it visible.
 * Racing approaches stay ~341m from the Pyramid.
 * Keep a margin for chase-camera offset and LOD hysteresis. */
export function landmarkNearDistance(id, racing=false, battery=false){
 if(battery)return 35;
 if(racing&&id==='pyramid')return 410;
 return id==='skanderbeg'?90:190;
}
