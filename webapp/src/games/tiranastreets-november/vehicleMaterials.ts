import * as T from 'three';
/** Imported GLTF materials retain their UVs, maps, colors and roughness. Only
 * texture sampling and transparent depth behavior are normalized. No image
 * downloads, replacement skins or per-instance texture copies are introduced. */
export function prepareVehicleMaterials(root:T.Object3D){
 const textures=new Set<T.Texture>(),materials=new Set<T.Material>();
 const dataTextures=new Set<T.Texture>();
 let transparent=0;
 root.traverse(object=>{
  if(!(object instanceof T.Mesh))return;
  object.receiveShadow=true;object.castShadow=true;
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   materials.add(material);
   if(!(material instanceof T.MeshStandardMaterial))continue;
   for(const texture of [material.normalMap,material.roughnessMap,material.metalnessMap,material.aoMap,material.bumpMap,material.displacementMap,material.alphaMap])if(texture)dataTextures.add(texture);
  }
 });
 for(const material of materials){
   if(!(material instanceof T.MeshStandardMaterial))continue;
   for(const key of ['map','emissiveMap'] as const){
    const texture=material[key];if(!texture||texture.colorSpace!==T.NoColorSpace)continue;
    // GLTF normally creates separate texture views for color/data semantics.
    // A custom asset may share one object: keep its normal/roughness data linear
    // and let the color material own a separate GPU texture view of the image.
    const color=dataTextures.has(texture)?texture.clone():texture;
    color.colorSpace=T.SRGBColorSpace;color.needsUpdate=true;material[key]=color;
   }
   for(const value of Object.values(material))if(value instanceof T.Texture){
    textures.add(value);
    if(value.anisotropy<4){value.anisotropy=4;value.needsUpdate=true;}
   }
   // BLEND panes must not write an opaque depth rectangle over seats, another
   // window or the road. Alpha-tested grills and solid lenses keep depthWrite.
   // An opacity of 1 can still blend through map/alphaMap alpha (Fiat and
   // Benz originals do this). The blending mode, not uniform opacity, decides.
   if(material.transparent&&!material.alphaTest){material.depthWrite=false;transparent++;}
 }
 root.userData.vehicleMaterialAudit={materials:materials.size,textures:textures.size,transparent};
}
