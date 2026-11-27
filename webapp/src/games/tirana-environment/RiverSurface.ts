import * as T from 'three';
import {offsetRiver, type WaterPath} from './riverGeometry';
import {channelWaterMargin} from './riverShapeCore.mjs';

/** Ordered strip UVs follow the mapped channel rather than crossing its banks
 * on fixed world X/Z axes. No texture downloads, depth passes or reflection probes. */
export function flowSurface(path: WaterPath, water: number, bed: number, shoulder: number, origin: number) {
  const half = path.width/2+channelWaterMargin(water,bed,shoulder);
  const sides = [offsetRiver(path.line,-half),offsetRiver(path.line,half)];
  const geometry = new T.BufferGeometry();
  const positions:number[] = [], indices:number[] = [], flow:number[] = [];
  let distance = origin;
  for (let i=0;i<path.line.length;i++) {
    if(i) distance+=Math.hypot(path.line[i][0]-path.line[i-1][0],path.line[i][1]-path.line[i-1][1]);
    for(let j=0;j<2;j++){
      positions.push(sides[j][i][0],water,sides[j][i][1]);
      flow.push(j*2-1,distance,path.lana?1:0);
    }
    if(i) {
      const n=2*i;
      indices.push(n-2,n,n-1,n-1,n,n+1);
    }
  }
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('riverFlow',new T.Float32BufferAttribute(flow,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createRiverWater(time:{value:number}) {
  const water = new T.MeshPhysicalMaterial({color:0x69786a,roughness:.26,metalness:.04,clearcoat:.62,clearcoatRoughness:.24,envMapIntensity:.92});
  water.name='Lana flowing water';
  water.customProgramCacheKey=()=> 'tirana-lined-river-flow-v1';
  water.onBeforeCompile=shader=>{
    shader.uniforms.riverTime=time;
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute vec3 riverFlow; varying vec3 vRiverFlow; varying vec2 vRiverPoint;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvRiverFlow=riverFlow; vRiverPoint=position.xz;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nuniform float riverTime; varying vec3 vRiverFlow; varying vec2 vRiverPoint;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        float acrossRiver = vRiverFlow.x;
        float shore = smoothstep(.58,.99,abs(acrossRiver));
        float current = vRiverFlow.y-riverTime*.66;
        float pools = sin(current*.33+acrossRiver*6.0)*sin(current*.14-acrossRiver*8.5);
        float reflected = sin(current*2.1+acrossRiver*20.0 + pools*.45);
        float seams = sin(dot(vRiverPoint,vec2(.163,.211)));
        float silt = mix(1.0,1.18+seams*.055,shore);
        diffuseColor.rgb *= silt + pools*.047 + reflected*.024*(1.0-shore);
        diffuseColor.rgb *= mix(vec3(1.0),vec3(1.06,1.02,.93),shore*vRiverFlow.z);`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        float crossRipple=sin(current*2.1+acrossRiver*20.0 + pools*.45);
        float smallRipple=sin(current*5.6-acrossRiver*11.0+seams*.55);
        normal=normalize(normal+vec3(crossRipple*.026,smallRipple*.018,0.0)*(1.0-shore*.62));`);
  };
  return water;
}

export function styleRiverLiner(liner:T.MeshStandardMaterial) {
  liner.customProgramCacheKey=()=> 'tirana-lined-river-shore-v1';
  liner.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute float linerWaterLevel; varying vec3 vLinerDetail;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvLinerDetail=vec3(position.xz,position.y-linerWaterLevel);');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying vec3 vLinerDetail;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        // A broad uneven damp band with no ruler-straight white outline.
        float brokenEdge = .062*sin(vLinerDetail.x*.59+vLinerDetail.y*.77) +
          .034*sin(vLinerDetail.x*2.73-vLinerDetail.y*3.06);
        float dampness = 1.0-smoothstep(.07,.56,vLinerDetail.z+brokenEdge);
        float mineral = smoothstep(.34,.48,vLinerDetail.z+brokenEdge) *
          (1.0-smoothstep(.53,.68,vLinerDetail.z+brokenEdge));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(.64,.71,.54),dampness*.83);
        diffuseColor.rgb *= 1.0+mineral*.085;`);
  };
}
