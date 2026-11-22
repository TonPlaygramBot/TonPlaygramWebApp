// Pure local arcade state, never connected to dispatch, person tracking or a network.
export const MIN_ALTITUDE=6, MAX_ALTITUDE=42, SCAN_RADIUS=18;
export function rescueTargetFrom(origin,walkable){
  const offsets=[[36,34],[-42,38],[16,53],[58,14],[-44,13],[-31,-29]];
  for(const [dx,dz] of offsets){const x=origin.x+dx,z=origin.z+dz;
    if(walkable(x,z,2.5))return Object.freeze({x,z});
  }
  throw new Error('Nuk ka vend të lirë për ushtrimin e shpëtimit.');
}
export function createRescueFlight(target,origin){
  if(![target?.x,target?.z,origin?.x,origin?.z].every(Number.isFinite))throw Error('Invalid simulated flight coordinates');
  let phase='search';
  let position={x:origin.x,y:21,z:origin.z};
  return Object.freeze({
    target,
    fly(x,y,z,bounds){
      if([x,y,z].every(Number.isFinite))position={
        x:Math.min(bounds[2]-2,Math.max(bounds[0]+2,x)),
        y:Math.min(MAX_ALTITUDE,Math.max(MIN_ALTITUDE,y)),
        z:Math.min(bounds[3]-2,Math.max(bounds[1]+2,z))};
      return this.state();
    },
    state(){const proximity=Math.hypot(target.x-position.x,target.z-position.z);
      return {...position,phase,canInteract:phase==='found'||(phase==='search'&&proximity<=SCAN_RADIUS&&position.y<=29)};
    },
    interact(){
      if(this.state().canInteract)phase=phase==='search'?'found':'dispatched';
      return this.state();
    }
  });
}
