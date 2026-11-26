import * as T from 'three';

export const THEATRE_PLASTER_URL='/assets/tirana-streets/environment/solo-teatri-kukullave-plaster-2024.webp';
const THEATRE_WAY='236566862';
const MAIN_SHELL=13343121;

type Options={
  root:T.Group; isDisposed:()=>boolean; maxAnisotropy:number;
  load?:(url:string)=>Promise<T.Texture>;
};

/** One photo sample from the same building. No new meshes, geometry or wall outlines. */
export async function installTheatrePlasterPhoto({
  root,isDisposed,maxAnisotropy,load=url=>new T.TextureLoader().loadAsync(url)
}:Options):Promise<(()=>void)|undefined>{
  if(isDisposed())return;
  const theatre=root.children.find(o=>o.userData.osmWay===THEATRE_WAY);
  const candidates=theatre?.children.filter((child):child is T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>=>
    child instanceof T.Mesh&&child.material instanceof T.MeshStandardMaterial&&child.material.color.getHex()===MAIN_SHELL
  );
  if(candidates?.length!==1)return;
  const mesh=candidates[0],original=mesh.material,geom=mesh.geometry;
  const pos=geom.getAttribute('position'),normal=geom.getAttribute('normal'),priorUv=geom.getAttribute('uv');
  if(!pos||!normal||normal.count!==pos.count||!priorUv)return;
  const tex=await load(THEATRE_PLASTER_URL).catch(()=>null);
  if(!tex)return;
  if(isDisposed()||mesh.parent!==theatre||mesh.material!==original){tex.dispose();return;}

  // Retain the original physical relief silhouette. Use metre-based wall
  // coordinates, and a constant sample for horizontal cap faces.
  const uv=new Float32Array(pos.count*2);
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),nx=normal.getX(i),nz=normal.getZ(i);
    const norm=Math.hypot(nx,nz);
    uv[i*2]=norm<.1?.5:(x*nz-z*nx)/(.62*norm);
    uv[i*2+1]=norm<.1?.5:y/1.3;
  }
  tex.colorSpace=T.SRGBColorSpace;
  tex.wrapS=tex.wrapT=T.MirroredRepeatWrapping;
  tex.anisotropy=Math.max(1,Math.min(4,maxAnisotropy));
  const mat=original.clone();
  mat.name='Theatre pink lime plaster · Andis Rado / CC BY-SA 4.0';
  mat.color.set(0xffffff);mat.map=tex;mat.normalMap=null;mat.roughnessMap=null;mat.roughness=.9;
  mat.needsUpdate=true;
  geom.setAttribute('uv',new T.BufferAttribute(uv,2));mesh.material=mat;
  let released=false;
  return ()=>{
    if(released)return;
    released=true;
    if(mesh.material===mat){mesh.material=original;geom.setAttribute('uv',priorUv);}
    mat.dispose();tex.dispose();
  };
}
