/** Authored playable cut of the archived OSM city, in the unchanged metre frame.
 * Retains Kombinat, Lapraka, Kinostudio, Shkozë, Sauk and the central districts;
 * removes the rural belt, Surrel and the Dajti excursion from city gameplay. */
export const URBAN_BOUNDS=Object.freeze([-5000,-3500,3600,3100]);
export function pointInUrbanBounds(point,margin=0){
 if(!point)return false;
 const x=Array.isArray(point)?point[0]:point.x,z=Array.isArray(point)?point[1]:point.z,b=URBAN_BOUNDS;
 return Number.isFinite(x)&&Number.isFinite(z)&&x>=b[0]+margin&&x<=b[2]-margin&&z>=b[1]+margin&&z<=b[3]-margin;
}
