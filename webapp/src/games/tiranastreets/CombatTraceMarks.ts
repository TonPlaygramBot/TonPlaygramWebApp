import * as T from 'three';

type Trace={x:number;y:number;z:number;size:number;rotation:number;age:number;active:boolean};

/** Small ground traces share a single draw call. Repeated hits merge locally;
 * slots are reused and fade even when outside the camera's effect budget. */
export class CombatTraceMarks {
  readonly mesh:T.InstancedMesh;
  private traces:Trace[];
  private next=0;
  private transform=new T.Object3D();
  private alpha:T.InstancedBufferAttribute;
  constructor(private capacity=64){
    const geometry=new T.PlaneGeometry(1,1),material=new T.MeshBasicMaterial({color:0x681c19,transparent:true,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});
    this.alpha=new T.InstancedBufferAttribute(new Float32Array(capacity),1);geometry.setAttribute('traceAlpha',this.alpha);
    material.defines={USE_UV:''};
    material.onBeforeCompile=shader=>{
      shader.vertexShader='attribute float traceAlpha;varying float vTraceAlpha;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTraceAlpha=traceAlpha;');
      shader.fragmentShader='varying float vTraceAlpha;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec2 p=(vUv-.5)*2.;float a=atan(p.y,p.x),r=length(p);
        float edge=.72+.13*sin(a*5.)+.07*cos(a*9.);
        diffuseColor.a*=vTraceAlpha*(1.-smoothstep(edge-.16,edge,r));
        if(diffuseColor.a<.015)discard;`);
    };
    material.customProgramCacheKey=()=> 'tirana-blood-trace-v1';
    this.mesh=new T.InstancedMesh(geometry,material,capacity);this.mesh.name='Tirana:blood-traces';this.mesh.count=0;this.mesh.frustumCulled=false;
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.mesh.renderOrder=2;
    this.traces=Array.from({length:capacity},()=>({x:0,y:0,z:0,size:0,rotation:0,age:0,active:false}));
  }
  add(x:number,y:number,z:number,size=.12){
    if(![x,y,z,size].every(Number.isFinite)||size<=0)return;
    const nearby=this.traces.find(t=>t.active&&Math.abs(t.y-y)<.08&&(t.x-x)**2+(t.z-z)**2<.018);
    if(nearby){nearby.size=Math.min(.3,Math.hypot(nearby.size,size*.5));nearby.age=Math.min(nearby.age,24);return;}
    const trace=this.traces[this.next];this.next=(this.next+1)%this.capacity;
    Object.assign(trace,{x,y,z,size:Math.min(.3,size),rotation:Math.random()*Math.PI*2,age:0,active:true});
  }
  update(dt:number,camera:T.Camera,battery=false){
    const step=Number.isFinite(dt)?Math.max(0,dt):0,range=battery?45:85,budget=battery?32:this.capacity;
    let count=0;
    for(const trace of this.traces){
      if(!trace.active)continue;
      trace.age+=step;if(trace.age>=45){trace.active=false;continue;}
      if(count>=budget||(trace.x-camera.position.x)**2+(trace.z-camera.position.z)**2>range*range)continue;
      this.transform.position.set(trace.x,trace.y+.012,trace.z);this.transform.rotation.set(-Math.PI/2,0,trace.rotation);this.transform.scale.set(trace.size,trace.size*.8,1);this.transform.updateMatrix();
      this.mesh.setMatrixAt(count,this.transform.matrix);this.alpha.setX(count++,Math.min(.7,(45-trace.age)/12*.7));
    }
    this.mesh.count=count;this.mesh.instanceMatrix.needsUpdate=true;this.alpha.needsUpdate=true;
  }
  reset(){for(const trace of this.traces)trace.active=false;this.next=0;this.mesh.count=0;}
  dispose(){this.reset();this.mesh.geometry.dispose();(this.mesh.material as T.Material).dispose();this.mesh.removeFromParent();}
}
