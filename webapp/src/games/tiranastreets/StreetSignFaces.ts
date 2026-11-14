import * as T from 'three';
import {nearbyIndex} from '../tirana-street-life/streetModels.mjs';

export type StreetSign = {x:number;y:number;z:number;yaw:number;text:string;w:number;h:number;bg:string;fg:string;round?:boolean};
/** One local atlas and one draw for road names and road signs. Back faces have
 * their own rotated instance, so the lettering reads correctly on both sides. */
export class StreetSignFaces {
  readonly mesh:T.InstancedMesh;
  private near:ReturnType<typeof nearbyIndex>;
  private texture:T.CanvasTexture;
  private ctx:CanvasRenderingContext2D;
  private slots:string[]=[];
  private last=-Infinity;
  private dummy=new T.Object3D();
  private capacity=64;
  constructor(signs:StreetSign[]) {
    this.near=nearbyIndex(signs);
    const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=512;
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Road sign canvas unavailable');this.ctx=ctx;
    this.texture=new T.CanvasTexture(canvas);this.texture.colorSpace=T.SRGBColorSpace;
    this.texture.anisotropy=4;
    const material=new T.MeshStandardMaterial({map:this.texture,emissiveMap:this.texture,emissive:0xffffff,emissiveIntensity:.12,roughness:.6,transparent:true,alphaTest:.3,polygonOffset:true,polygonOffsetFactor:-1});
    material.userData.environmentLight='street';material.userData.nightIntensity=.38;
    material.onBeforeCompile=shader=>{
      shader.vertexShader='attribute vec4 signAtlas;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv=vMapUv*signAtlas.zw+signAtlas.xy;\n#endif\n#ifdef USE_EMISSIVEMAP\nvEmissiveMapUv=vEmissiveMapUv*signAtlas.zw+signAtlas.xy;\n#endif');
    };
    material.customProgramCacheKey=()=> 'tirana-road-sign-atlas-v1';
    const geometry=new T.PlaneGeometry(1,1);
    geometry.setAttribute('signAtlas',new T.InstancedBufferAttribute(new Float32Array(this.capacity*2*4),4).setUsage(T.DynamicDrawUsage));
    this.mesh=new T.InstancedMesh(geometry,material,this.capacity*2);this.mesh.count=0;
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.mesh.frustumCulled=false;
    this.mesh.name='Readable local street names and road signs';
  }
  update(viewer:{x:number;z:number},seconds:number,battery=false) {
    if(seconds>=this.last&&seconds-this.last<.25)return;this.last=seconds;
    const selected=this.near(viewer,battery?110:190,battery?32:this.capacity) as StreetSign[];
    const uv=this.mesh.geometry.getAttribute('signAtlas') as T.InstancedBufferAttribute;
    this.mesh.count=0;
    selected.forEach((s,i)=>{
      const key=JSON.stringify([s.text,s.bg,s.fg,!!s.round]),x=(i%8)*256,y=Math.floor(i/8)*64;
      if(this.slots[i]!==key){
        this.slots[i]=key;const c=this.ctx;c.clearRect(x,y,256,64);
        c.fillStyle=s.bg;c.strokeStyle=s.round?'#c42a2a':s.fg;c.lineWidth=s.round?6:2;
        if(s.round){c.beginPath();c.ellipse(x+128,y+32,121,28,0,0,Math.PI*2);c.fill();c.stroke();}
        else {c.fillRect(x,y,256,64);c.strokeRect(x+3,y+3,250,58);}
        c.fillStyle=s.fg;c.font=`600 ${s.round?42:28}px Arial`;c.textAlign='center';c.textBaseline='middle';c.fillText(s.text,x+128,y+33,s.round?160:238);
        this.texture.needsUpdate=true;
      }
      for(const back of [false,true]){
        const n=this.mesh.count++,yaw=s.yaw+(back?Math.PI:0);
        this.dummy.position.set(s.x+Math.sin(yaw)*.055,s.y,s.z+Math.cos(yaw)*.055);
        this.dummy.rotation.set(0,yaw,0);this.dummy.scale.set(s.w,s.h,1);this.dummy.updateMatrix();
        this.mesh.setMatrixAt(n,this.dummy.matrix);uv.setXYZW(n,(x+1)/2048,1-(y+63)/512,254/2048,62/512);
      }
    });
    this.mesh.instanceMatrix.needsUpdate=true;uv.needsUpdate=true;
  }
  dispose(){this.mesh.removeFromParent();this.mesh.dispose();this.mesh.geometry.dispose();(this.mesh.material as T.Material).dispose();this.texture.dispose();}
}
