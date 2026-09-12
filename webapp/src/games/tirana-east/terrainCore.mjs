import {TERRAIN} from './terrainData.mjs';
// Retain the existing city's flat datum. Only the 900 m seam outside it is
// blended; eastern relief and the skyline use real DEM samples, not peaks added by hand.
export const URBAN_DATUM_BOUNDS=Object.freeze([-5624.88,-5322.32,4983.39,4774.98]);
export const TRAVEL_BOUNDS=Object.freeze([-5624.88,-8620,12650,6960]);
export const TERRAIN_STEP=60;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function gridHeight(g,x,z){
 const u=clamp((x-g.x)/g.step,0,g.nx-1),v=clamp((z-g.z)/g.step,0,g.nz-1),i=Math.min(g.nx-2,Math.floor(u)),j=Math.min(g.nz-2,Math.floor(v)),a=u-i,b=v-j;
 const q=j*g.nx+i,h=g.heights;
 return h[q]*(1-a)*(1-b)+h[q+1]*a*(1-b)+h[q+g.nx]*(1-a)*b+h[q+g.nx+1]*a*b;
}
export function elevation(x,z){
 const fine=TERRAIN.grids[1],g=x>=fine.x&&z>=fine.z&&x<=fine.x+(fine.nx-1)*fine.step&&z<=fine.z+(fine.nz-1)*fine.step?fine:TERRAIN.grids[0];
 return gridHeight(g,x,z);
}
export const CITY_ELEVATION=elevation(0,0);
export function urbanDistance(x,z){const b=URBAN_DATUM_BOUNDS;return Math.hypot(Math.max(b[0]-x,0,x-b[2]),Math.max(b[1]-z,0,z-b[3]));}
function vertexHeight(x,z){const t=clamp(urbanDistance(x,z)/900,0,1),blend=t*t*(3-2*t);return Math.max(0,elevation(x,z)-CITY_ELEVATION)*blend;}
// Exactly the same a-c-b / b-c-d triangles as TerrainLayer (60 m grid).
// Physics must not use bilinear interpolation over a visibly planar triangle.
export function groundHeight(x,z){
 if(!Number.isFinite(x)||!Number.isFinite(z))return 0;
 if(urbanDistance(x,z)===0)return 0;
 const s=TERRAIN_STEP,ix=Math.floor(x/s)*s,iz=Math.floor(z/s)*s,u=(x-ix)/s,v=(z-iz)/s;
 const a=vertexHeight(ix,iz),b=vertexHeight(ix+s,iz),c=vertexHeight(ix,iz+s),d=vertexHeight(ix+s,iz+s);
 return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}
export function buildingGround(b){return Math.max(...b.p.map(p=>groundHeight(p[0],p[1])));}
export function terrainRay(a,d,max){
 // Horizontal rays can hit a rising hillside; downward-only plane tests cannot.
 const steps=Math.max(1,Math.ceil(max/3));let previous=0;
 for(let i=0;i<=steps;i++){
  const t=max*i/steps,x=a.x+d.x*t,z=a.z+d.z*t;
  if(a.y+d.y*t<=groundHeight(x,z)+.08){
   let lo=previous,hi=t;for(let j=0;j<12;j++){const m=(lo+hi)/2;if(a.y+d.y*m>groundHeight(a.x+d.x*m,a.z+d.z*m)+.08)lo=m;else hi=m;}return hi;
  }previous=t;
 }return null;
}
export const TERRAIN_ATTRIBUTION=TERRAIN.attribution;
