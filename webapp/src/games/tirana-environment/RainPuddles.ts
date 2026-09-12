import * as T from 'three';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {nearbyIndex} from '../tirana-street-life/streetModels.mjs';
/** Small depressions authored on mapped, non-elevated carriageways. A single
 * instanced PBR draw uses the scene environment and analytic rain ripples. */
export class RainPuddles {
 readonly group=new T.Group();
 private time={value:0};private water={value:0};
 private material=new T.MeshStandardMaterial({color:0x51616a,metalness:.55,roughness:.10,transparent:true,opacity:.72,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
 private geometry=new T.CircleGeometry(1,16).rotateX(-Math.PI/2);
 private mesh=new T.InstancedMesh(this.geometry,this.material,180);
 private near:ReturnType<typeof nearbyIndex>;private viewer={x:Infinity,z:Infinity};private dummy=new T.Object3D();private battery?:boolean;
 constructor(){
  const sites:any[]=[];
  for(const [i,r] of WORLD.roads.entries()){
   const length=Math.hypot(r.b[0]-r.a[0],r.b[1]-r.a[1]);
   if(r.walk||r.bridge||r.tunnel||r.w<4||length<12)continue;
   const dx=(r.b[0]-r.a[0])/length,dz=(r.b[1]-r.a[1])/length;
   for(let j=0;j<Math.min(12,Math.floor(length/18));j++){
    const t=(j+.45)/Math.max(1,Math.floor(length/18)),side=(i+j)%2?1:-1,offset=side*Math.max(0,r.w/2-1.2);
    sites.push({x:r.a[0]+dx*length*t-dz*offset,z:r.a[1]+dz*length*t+dx*offset,yaw:Math.atan2(dx,dz),size:.3+((i*7+j*13)%11)/16});
   }
  }
  this.near=nearbyIndex(sites);this.mesh.count=0;this.mesh.frustumCulled=false;this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.group.add(this.mesh);this.group.name='Tirana:small-rain-puddles';
  this.material.onBeforeCompile=shader=>{
   shader.uniforms.puddleTime=this.time;shader.uniforms.puddleWater=this.water;
   shader.vertexShader='varying vec2 puddleUV;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\npuddleUV=uv*2.-1.;');
   shader.fragmentShader='varying vec2 puddleUV;uniform float puddleTime,puddleWater;\n'+shader.fragmentShader.replace('#include <alphamap_fragment>',`#include <alphamap_fragment>
    float radius=length(puddleUV);float edge=.78+.09*sin(puddleUV.x*14.)*sin(puddleUV.y*17.);
    float extent=edge*sqrt(puddleWater);diffuseColor.a*=1.-smoothstep(extent-.14,extent,radius);if(diffuseColor.a<.015)discard;
   `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    float wave=sin(length(puddleUV+vec2(.23,-.17))*70.-puddleTime*12.)*.035*puddleWater;
    normal=normalize(normal+vec3(wave,0.,wave*.7));
   `);
  };
  this.material.customProgramCacheKey=()=> 'tirana-rain-puddles-v1';
 }
 update(seconds:number,viewer:{x:number;z:number},wetness:number,rain:number,battery=false){
  this.water.value=T.MathUtils.smoothstep(wetness,.2,.9);this.time.value=seconds;
  this.group.visible=this.water.value>.015;this.material.roughness=.075+.04*(1-rain);
  if(!this.group.visible)return;
  if(this.battery!==battery||Math.hypot(viewer.x-this.viewer.x,viewer.z-this.viewer.z)>20){
   this.viewer={x:viewer.x,z:viewer.z};this.battery=battery;const selected=this.near(viewer,battery?75:160,battery?60:180);this.mesh.count=selected.length;
   selected.forEach((p:any,i:number)=>{this.dummy.position.set(p.x,.097,p.z);this.dummy.rotation.set(0,p.yaw,0);this.dummy.scale.set(p.size,1,p.size*1.6);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);});
   this.mesh.instanceMatrix.needsUpdate=true;
  }
 }
 dispose(){this.mesh.dispose();this.geometry.dispose();this.material.dispose();this.group.removeFromParent();this.group.clear();}
}
