export function pointInFootprint(x,z,p){
  let hit=false;
  for(let i=0,j=p.length-1;i<p.length;j=i++){
    const a=p[i],b=p[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }
  return hit;
}
function onStrip(x,z,{a,b,w}){
  const dx=b[0]-a[0],dz=b[1]-a[1],q=dx*dx+dz*dz||1;
  const t=Math.min(1,Math.max(0,((x-a[0])*dx+(z-a[1])*dz)/q));
  return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<=w/2;
}
export function makeWalkability({bounds:b,buildings,markings,roads,water}){
  const bridges=roads.filter(r=>r.bridge);
  const polygons=[...buildings.map(x=>x.p),...markings.map(x=>x.footprint).filter(Array.isArray)];
  const walls=polygons.map(p=>({p,minX:Math.min(...p.map(v=>v[0])),maxX:Math.max(...p.map(v=>v[0])),minZ:Math.min(...p.map(v=>v[1])),maxZ:Math.max(...p.map(v=>v[1]))}));
  return (x,z,padding=.22)=>x>b[0]+1&&x<b[2]-1&&z>b[1]+1&&z<b[3]-1&&
    [[0,0],[padding,0],[-padding,0],[0,padding],[0,-padding]].every(([dx,dz])=>{
      const u=x+dx,v=z+dz;
      if(walls.some(w=>u>w.minX&&u<w.maxX&&v>w.minZ&&v<w.maxZ&&pointInFootprint(u,v,w.p)))return false;
      if(water.some(w=>w.p?pointInFootprint(u,v,w.p):onStrip(u,v,w)))return bridges.some(r=>onStrip(u,v,r));
      return true;
    });
}
export function approachLandmark(landmark,walkable){
  const {id,x,z}=landmark;
  if(walkable(x,z,1.1))return {...landmark};
  for(let d=2;d<=50;d+=1)for(let i=0;i<48;i++){
    const angle=i/48*Math.PI*2,a=x+d*Math.cos(angle),b=z+d*Math.sin(angle);
    if(walkable(a,b,1.1))return {id,x:a,z:b};
  }
  throw new Error('No walkable approach for '+id);
}
