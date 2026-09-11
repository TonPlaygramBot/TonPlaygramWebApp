/** Rendering policy only. Metres in the existing WORLD frame, not a new datum. */
export const PANORAMA_FAR = 65000;
export const DURRES_REFERENCE = Object.freeze({latitude:41.31333,longitude:19.44583,
  source:'https://en.wikipedia.org/wiki/Durr%C3%ABs',
  accuracy:'Rounded city reference; skyline geometry is an authored distant silhouette'});
export const PANORAMA_SOURCE = 'https://dajtiekspres.com/facilities/restaurant-ballkoni-dajtit/';
export function panoramaBlend(height) {
  if (!Number.isFinite(height)) return 0;
  const t=Math.max(0,Math.min(1,(height-180)/650));
  return t*t*(3-2*t);
}
export function panoramaVisible(viewer,bounds) {
  if(!viewer||![viewer.x,viewer.y,viewer.z].every(Number.isFinite))return false;
  const x=Math.max(bounds[0],Math.min(bounds[2],viewer.x));
  const z=Math.max(bounds[1],Math.min(bounds[3],viewer.z));
  return panoramaBlend(viewer.y)>0 && Math.hypot(viewer.x-x,viewer.z-z)<22000;
}
