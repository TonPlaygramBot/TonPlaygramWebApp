/** Conservative broad phase: footprints are indexed in every touched cell.
 * The caller retains its exact polygon/hole test after candidate selection.
 */
export function footprintIndex(buildings,size=80,padding=0){
 const cells=new Map();
 for(const building of buildings){
  const p=building.p;if(!p?.length)continue;
  const xs=p.map(v=>v[0]),zs=p.map(v=>v[1]);
  for(let x=Math.floor((Math.min(...xs)-padding)/size);x<=Math.floor((Math.max(...xs)+padding)/size);x++)
   for(let z=Math.floor((Math.min(...zs)-padding)/size);z<=Math.floor((Math.max(...zs)+padding)/size);z++){
    const key=`${x}:${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(building);
   }
 }
 return (x,z)=>cells.get(`${Math.floor(x/size)}:${Math.floor(z/size)}`)||[];
}
