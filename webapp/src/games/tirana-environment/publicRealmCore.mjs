// Local presentation only. Keep mapped trees and the square's surrounding gardens.
// The architect documents the open central paving and planted perimeter:
// https://51n4e.com/projects/skanderbeg-square/
const squareGardens = new Set([
  '624093777','624093780','624093782','624093787','624093788',
  '624093792','624093795','624093803','624093804'
]);
export function keepSquareTree(tree) {
  if (tree.zone !== 'estimated-area-canopy') return true;
  const area = /^canopy\/way\/(\d+)\//.exec(tree.id)?.[1];
  return !squareGardens.has(area);
}
export function squareSeatingZone(x,z) {
  // The central square plus its immediate garden margins, in source-frame metres.
  return x >= -125 && x <= 128 && z >= -150 && z <= 115;
}
export function publicRealmSeatingZone(x,z,lanaLine) {
  if (squareSeatingZone(x,z)) return 'square';
  for (let i=1;i<lanaLine.length;i++) {
    const [ax,az]=lanaLine[i-1], [bx,bz]=lanaLine[i];
    if (x<Math.min(ax,bx)-46 || x>Math.max(ax,bx)+46 ||
        z<Math.min(az,bz)-46 || z>Math.max(az,bz)+46) continue;
    const dx=bx-ax,dz=bz-az;
    const along=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1)));
    if ((x-ax-along*dx)**2+(z-az-along*dz)**2<=46**2) return 'lana';
  }
  return null;
}
// Some source points are a serial line of individual seats, not repeated
// full-size park benches. Keep a representative subset without altering OSM.
export function curateMappedBenches(points,lanaLine) {
  const retained={square:[],lana:[]};
  return points.filter(p=>{
    const zone=publicRealmSeatingZone(p.x,p.z,lanaLine);
    if(!zone) return true;
    const spacing=zone==='square'?10:14;
    if(retained[zone].some(q=>(q.x-p.x)**2+(q.z-p.z)**2<spacing**2)) return false;
    retained[zone].push(p);
    return true;
  });
}
