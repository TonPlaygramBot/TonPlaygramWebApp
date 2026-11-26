// Decorative craft do not interact with traffic, game saves or navigation.
// The line is resolved from the existing OSM-authored game channel, not copied
// into a new geometry dataset. Water height is an authored gameplay datum.
export const LANA_SOLO_WATER_LEVEL = -2.15;
export const LANA_CRAFT_LOAD_RADIUS = 260;
export const LANA_CRAFT_DRAW_RADIUS = 150;
export function lanaCraftAnchors(paths) {
  const line=paths.find(p=>p.lana&&p.id==='733080610')?.line;
  if(!line||line.length<10)return [];
  const a=line[8], b=line[9], dx=b[0]-a[0], dz=b[1]-a[1];
  const length=Math.hypot(dx,dz);
  if(length<28||length>45)return [];
  // +Z is the hull nose after the manufacturer's +X is rotated into game space.
  return [.20,.47,.74].map((t,i)=>({
    x:a[0]+t*dx+2*dz/length,
    z:a[1]+t*dz-2*dx/length,
    yaw:Math.atan2(dx,dz),
    phase:i*2.1
  }));
}
