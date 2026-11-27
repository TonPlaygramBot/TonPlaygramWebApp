import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {surfaceGeometry} from './riverGeometry';
import {lakeShoreTexture,selectMappedLakes,type LakeSource,type MappedLake} from './mappedLakeCore.mjs';

// Same render-only datum as the established ornamental water surfaces. Not
// a surveyed lake height and not used by movement/water collision.
const LAKE_SCENE_DATUM=.075;
type LakeEntry = {lake:MappedLake;bounds:number[];mesh?:T.Mesh<T.BufferGeometry,T.MeshPhysicalMaterial>;data?:T.DataTexture};
type Point = {x:number;z:number};

export class MappedLakes {
 readonly group = new T.Group();
 private readonly entries:LakeEntry[];
 private readonly time={value:0};

 constructor(raw:readonly LakeSource[] = []) {
  this.group.name='Tirana:exact-mapped-lakes';
  this.entries=selectMappedLakes(raw).map(lake=>{
   const p=lake.polygons.flatMap(p=>p.outer);
   return {lake,bounds:[Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))]};
  });
 }
 private build(entry:LakeEntry) {
  const {lake:{polygons,profile,source}}=entry;
  const raster=lakeShoreTexture(polygons,profile.resolution,profile.range);
  const tex=new T.DataTexture(raster.data,profile.resolution,profile.resolution,T.RedFormat,T.UnsignedByteType);
  tex.magFilter=tex.minFilter=T.LinearFilter;tex.needsUpdate=true;
  const material=new T.MeshPhysicalMaterial({color:profile.color,roughness:.34,metalness:.015,clearcoat:.65,clearcoatRoughness:.26});
  material.name=profile.name;
  material.customProgramCacheKey=()=> 'tirana-lake-shallow-shore-v1';
  material.onBeforeCompile=shader=>{
   shader.uniforms.lakeShoreField={value:tex};
   shader.uniforms.lakeShoreBounds={value:new T.Vector4(raster.minX,raster.minZ,raster.width,raster.depth)};
   shader.uniforms.lakeShoreTint={value:new T.Color(profile.shore)};
   shader.uniforms.lakeTime=this.time;
   shader.vertexShader=shader.vertexShader
    .replace('#include <common>','#include <common>\nvarying vec2 vLakePosition;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\nvLakePosition=position.xz;');
   shader.fragmentShader=shader.fragmentShader
    .replace('#include <common>','#include <common>\nvarying vec2 vLakePosition; uniform sampler2D lakeShoreField; uniform vec4 lakeShoreBounds; uniform vec3 lakeShoreTint; uniform float lakeTime;')
    .replace('#include <color_fragment>',`#include <color_fragment>
      vec2 lakeUv=(vLakePosition-lakeShoreBounds.xy)/lakeShoreBounds.zw;
      float edge=texture2D(lakeShoreField,lakeUv).r;
      float lakeA=sin(dot(vLakePosition,vec2(.58,.32))-lakeTime*.93);
      float lakeB=sin(dot(vLakePosition,vec2(-.84,.42))+lakeTime*1.1);
      float brokenBank=.05*sin(dot(vLakePosition,vec2(.29,.47)));
      float shallow=1.0-smoothstep(.04,.77,edge+brokenBank);
      diffuseColor.rgb=mix(diffuseColor.rgb,lakeShoreTint,shallow*.68);
      diffuseColor.rgb*=1.0+.045*lakeA+.025*lakeB;`)
    .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      normal=normalize(normal+vec3(lakeA*.023,lakeB*.019,0.0)*(1.0-shallow*.59));`);
  };
  const parts=polygons.map(p=>surfaceGeometry([p.outer,...(p.holes||[])],LAKE_SCENE_DATUM));
  const geometry=parts.length===1?parts[0]:mergeGeometries(parts);
  if(parts.length>1)parts.forEach(p=>p.dispose());
  if(!geometry) { tex.dispose(); material.dispose(); return; }
  const mesh=new T.Mesh(geometry,material);
  mesh.name=profile.name;mesh.userData={source,accuracy:'Exact mapped footprint; color/detail authored; not a surveyed water level'};
  mesh.receiveShadow=true;
  entry.mesh=mesh;entry.data=tex;this.group.add(mesh);
 }

 update(viewer:Point,seconds:number,battery:boolean) {
  this.time.value=seconds;
  for(const entry of this.entries){
   const [x0,z0,x1,z1]=entry.bounds;
   const distance=Math.hypot(Math.max(x0-viewer.x,0,viewer.x-x1),Math.max(z0-viewer.z,0,viewer.z-z1));
   const visible=distance<(battery?420:820);
   if(visible&&!entry.mesh)this.build(entry);
   if(entry.mesh)entry.mesh.visible=visible;
  }
 }

 dispose() {
  for(const e of this.entries){e.mesh?.geometry.dispose();e.mesh?.material.dispose();e.data?.dispose();}
  this.entries.length=0;this.group.clear();this.group.removeFromParent();
 }
}
