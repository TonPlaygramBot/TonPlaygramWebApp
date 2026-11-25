export const FACADE_FILE='wall-plaster-512.webp';

export function facadeUv(geometry,tile=4){
  const p=geometry.getAttribute('position');
  const n=geometry.getAttribute('normal');
  const uv=geometry.getAttribute('uv');
  for(let i=0;i<p.count;i++){
    const nx=n.getX(i), nz=n.getZ(i);
    if(Math.abs(n.getY(i))>.5) uv.setXY(i,p.getX(i)/tile,p.getZ(i)/tile);
    else uv.setXY(i,(-nz*p.getX(i)+nx*p.getZ(i))/tile,p.getY(i)/tile);
  }
  uv.needsUpdate=true;
  return geometry;
}

export function applyFacadeFinish(stage,map){
  const seen=new Set();
  stage.traverse(node=>{
    const mat=node.material;
    if(!mat?.userData?.plasterFacade||mat.map===map||seen.has(mat))return;
    seen.add(mat);
    mat.map=map;
    mat.needsUpdate=true;
  });
}
