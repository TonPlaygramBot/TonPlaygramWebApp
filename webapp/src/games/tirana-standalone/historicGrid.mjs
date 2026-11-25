export const HISTORIC_CELL=384;
export const HISTORIC_OFFSETS=[-256,-64];
export const HISTORIC_MAX=9;
const MARGIN=95;
export function gridKey(x,z){
  return Math.floor((x-HISTORIC_OFFSETS[0])/HISTORIC_CELL)+'_'+Math.floor((z-HISTORIC_OFFSETS[1])/HISTORIC_CELL);
}
export function gridBounds(key){
  if(!/^-?\d{1,2}_-?\d{1,2}$/.test(key))throw Error('Invalid historic sector key');
  const [i,j]=key.split('_').map(Number),x=i*HISTORIC_CELL+HISTORIC_OFFSETS[0],z=j*HISTORIC_CELL+HISTORIC_OFFSETS[1];
  return [x,z,x+HISTORIC_CELL,z+HISTORIC_CELL];
}
export function desiredSectors({x,z},has){
  const [i,j]=gridKey(x,z).split('_').map(Number),[l,t,r,b]=gridBounds(i+'_'+j);
  const xs=[i],zs=[j];
  if(x<l+MARGIN)xs.push(i-1);
  if(x>r-MARGIN)xs.push(i+1);
  if(z<t+MARGIN)zs.push(j-1);
  if(z>b-MARGIN)zs.push(j+1);
  return xs.flatMap(i=>zs.map(j=>i+'_'+j)).filter(key=>has.has(key));
}
export function combineHistoric(meta,cells){
  const regions=[...cells].map(c=>c.bounds);
  if(!regions.length)throw Error('No playable sectors');
  const bounds=[Math.min(...regions.map(b=>b[0])),Math.min(...regions.map(b=>b[1])),Math.max(...regions.map(b=>b[2])),Math.max(...regions.map(b=>b[3]))];
  return {bounds,regions,landmarks:meta.landmarks,
    ...Object.fromEntries(['roads','buildings','parks','areas','water'].map(k=>[k,[...cells].flatMap(c=>c[k])])),
    markings:[...cells].flatMap(c=>c.neutralCivicMarks)};
}
