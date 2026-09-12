/** Arc-length sampling carries spacing through short OSM segments and bends. */
export function sampleTreeRow(line, spacing=8){
 if(!Number.isFinite(spacing)||spacing<=0)throw Error('Tree spacing must be positive');
 const out=[];let walked=0,next=spacing/2;
 for(let i=1;i<line.length;i++){
  const a=line[i-1],b=line[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<1e-8)continue;
  while(next<walked+length){const t=(next-walked)/length;out.push({x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,metres:next});next+=spacing;}
  walked+=length;
 }
 return out;
}
/** Dynamic occupancy, including newly added rows, prevents seam duplicates. */
export function treeOccupancy(trees,spacing=4){
 const cells=new Map(),key=(x,z)=>`${Math.floor(x/spacing)}:${Math.floor(z/spacing)}`;
 const add=t=>{const k=key(t.x,t.z);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(t);};trees.forEach(add);
 const has=(x,z)=>{const cx=Math.floor(x/spacing),cz=Math.floor(z/spacing);for(let i=cx-1;i<=cx+1;i++)for(let j=cz-1;j<=cz+1;j++)for(const p of cells.get(`${i}:${j}`)||[])if(Math.hypot(p.x-x,p.z-z)<spacing)return true;return false;};
 return {add,has};
}
