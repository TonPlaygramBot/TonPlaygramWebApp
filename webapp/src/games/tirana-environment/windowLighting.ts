import * as T from 'three';
/** Keep window reflections during the day. At night, occupancy varies by room
 * and floor rather than illuminating a whole apartment block uniformly. */
export function applyWindowLighting(material:T.MeshStandardMaterial){
 if(material.userData.roomLighting)return;
 material.userData.roomLighting=true;
 const previous=material.onBeforeCompile;
 const cacheKey=material.customProgramCacheKey.bind(material);
 const key=cacheKey();
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 roomPosition;');
  shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
   vec4 roomWorld=vec4(transformed,1.);
   #ifdef USE_INSTANCING
   roomWorld=instanceMatrix*roomWorld;
   #endif
   roomPosition=(modelMatrix*roomWorld).xyz;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 roomPosition;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   vec3 room=floor(roomPosition/vec3(3.7,3.2,3.7));
   float occupied=fract(sin(dot(room,vec3(12.9898,78.233,41.713)))*43758.5453);
   totalEmissiveRadiance*=step(.42,occupied)*mix(vec3(1.,.68,.38),vec3(.78,.88,1.),step(.88,occupied));`);
 };
 material.customProgramCacheKey=()=>`${key}:tirana-room-lighting-v1`;
 material.needsUpdate=true;
}
