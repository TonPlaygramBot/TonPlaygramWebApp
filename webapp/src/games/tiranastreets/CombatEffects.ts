import {WEAPON_BY_ID} from './shared/weapons.mjs';
import {LudoImpactVisuals} from './LudoImpactVisuals';
import {CombatTraceMarks} from './CombatTraceMarks';
import * as T from 'three';
import {tracerSpan} from './tracerCore.mjs';
type Point = {x:number;y:number;z:number};
type Event = {id:number;kind:string;x:number;y?:number;z:number;toX:number;toY?:number;toZ:number;radius?:number;ejectX?:number;ejectY?:number;ejectZ?:number;weapon?:string;hitKind?:string;nx?:number;ny?:number;nz?:number;floorY?:number};
type Particle = {p:T.Vector3;v:T.Vector3;age:number;life:number;size:number;spin:number;floor:number;kind:number;trace?:{from:T.Vector3;distance:number};rendered?:boolean;caseLength?:number};
type Pool = {mesh:T.InstancedMesh;alpha:T.InstancedBufferAttribute;items:Particle[];free:Particle[];capacity:number};

/** Bounded instanced particles and ground traces. Simulation owns damage;
 * these reusable pools never create a mesh/material for an individual shot. */
export class CombatEffects {
  readonly group = new T.Group();
  private ludoImpact:LudoImpactVisuals;
  private bloodMarks=new CombatTraceMarks();
  private bloodEnabled=true;
  private pools:Pool[]=[];
  private transform=new T.Object3D();
  private color=new T.Color();
  private lastEvent=0;
  private emission=0;
  private trails=new Map<number,Point>();
  private dustQueue:{at:Point;radius:number;floor:number;delay:number}[]=[];
  private trailDirection=new T.Vector3();
  private trailUp=new T.Vector3(0,0,1);
  private lights=[new T.PointLight(0xffb35d,0,18,2),new T.PointLight(0xff7d32,0,18,2)];
  private lightTime=[0,0];
  private cuts=Array.from({length:12},()=>new T.Vector4(0,-10000,0,0));
  private patched=new Map<T.Material,{compile:T.Material['onBeforeCompile'];key:T.Material['customProgramCacheKey']}>();
  constructor(scene:T.Scene) {
    this.group.name='Tirana:combat-effects';scene.add(this.group);const impactGroup=new T.Group();impactGroup.name='Ludo missile impacts';this.group.add(impactGroup);this.ludoImpact=new LudoImpactVisuals(impactGroup);
    for(let kind=0;kind<7;kind++) {
      const capacity=kind===1?120:kind===2?160:kind===3?80:kind===4?48:64;
      const geometry=(kind<2||kind>=5)?new T.PlaneGeometry(1,1):kind===3||kind===4?new T.CylinderGeometry(.5,.5,1,10).rotateX(Math.PI/2):new T.BoxGeometry(1,1,1);
      const material=kind===2||kind===3 ? new T.MeshStandardMaterial({roughness:kind===3?.3:.95,metalness:kind===3?.75:0,transparent:true,depthWrite:true})
        : new T.MeshBasicMaterial({transparent:true,depthWrite:false,blending:kind===0||kind===4?T.AdditiveBlending:T.NormalBlending,side:T.DoubleSide});
      material.onBeforeCompile=shader=>{
        shader.vertexShader='attribute float particleAlpha; varying float vParticleAlpha;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvParticleAlpha=particleAlpha;');
        shader.fragmentShader='varying float vParticleAlpha;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          diffuseColor.a *= vParticleAlpha;
          ${kind<2||kind>=5?'float r=length(vUv-.5)*2.; diffuseColor.a*=(1.-smoothstep(.25,1.,r)); if(diffuseColor.a<.015)discard;':''}`);
      };
      // Billboard smoke and flame use UVs even without a texture map.
      if(kind<2||kind>=5)material.defines={USE_UV:''};
      material.customProgramCacheKey=()=>`tirana-particle-${kind}`;
      const mesh=new T.InstancedMesh(geometry,material,capacity);
      const alpha=new T.InstancedBufferAttribute(new Float32Array(capacity),1);
      geometry.setAttribute('particleAlpha',alpha);mesh.count=0;mesh.frustumCulled=false;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.renderOrder=kind<2?8:3;
      const free=Array.from({length:capacity},():Particle=>({p:new T.Vector3(),v:new T.Vector3(),age:0,life:1,size:0,spin:0,floor:0,kind}));
      this.group.add(mesh);this.pools.push({mesh,alpha,items:[],free,capacity});
    }
    this.group.add(this.bloodMarks.mesh);this.lights.forEach(l=>this.group.add(l));
  }
  private particle(kind:number,at:Point,v:Point,life:number,size:number,floor=0) {
    const pool=this.pools[kind],p=pool.free.pop()??pool.items.shift()!;
    p.p.set(at.x,at.y,at.z);p.v.set(v.x,v.y,v.z);p.age=0;p.life=life;p.size=size;p.spin=Math.random()*Math.PI*2;p.floor=floor;p.rendered=false;p.caseLength=undefined;
    pool.items.push(p);
  }
  setBloodEnabled(enabled:boolean){
    if(this.bloodEnabled===enabled)return;this.bloodEnabled=enabled;
    if(!enabled){const pool=this.pools[6];pool.free.push(...pool.items);pool.items.length=0;pool.mesh.count=0;this.bloodMarks.reset();}
  }
  /** Confirmed injury only. Direction points away from the attacker; floor is
   * the victim's support height, so rooftop hits never paint the road below. */
  blood(at:Point,direction:Point={x:0,y:.15,z:0},floor=0){
    if(!this.bloodEnabled||![at.x,at.y,at.z,floor].every(Number.isFinite))return;
    const length=Math.hypot(direction.x,direction.y,direction.z),scale=Number.isFinite(length)&&length>1e-5?.8/length:0;
    for(let i=0;i<5;i++)this.particle(6,at,{x:(direction.x*scale||0)+(Math.random()-.5)*.7,y:.1+Math.random()*.45,z:(direction.z*scale||0)+(Math.random()-.5)*.7},1.2,.028+Math.random()*.032,floor);
  }
  /** A material-aware, surface-directed impact burst; marks are owned by
   * SurfaceImpactMarks, which anchors moving vehicle panels correctly. */
  surfaceHit(at:Point,normal:Point={x:0,y:1,z:0},kind='wall',floor=0){
    if(![at.x,at.y,at.z,normal.x,normal.y,normal.z,floor].every(Number.isFinite))return;
    const length=Math.hypot(normal.x,normal.y,normal.z)||1;
    for(let i=0;i<4;i++)this.particle(2,at,{x:normal.x/length*(.7+Math.random())+(Math.random()-.5),y:normal.y/length*1.4+Math.random(),z:normal.z/length*(.7+Math.random())+(Math.random()-.5)},.25+Math.random()*.15,kind==='car'?.017:.03,floor);
    if(kind==='car')this.particle(0,at,{x:normal.x*.2,y:normal.y*.2,z:normal.z*.2},.06,.12,floor);
    else this.particle(5,at,{x:normal.x*.2,y:.3+Math.max(0,normal.y)*.2,z:normal.z*.2},.45,.17,floor);
  }
  shot(from:Point,to:Point,floor=0,ejection?:Point,weapon?:string) {
    const d=new T.Vector3(to.x-from.x,to.y-from.y,to.z-from.z),length=d.length();d.normalize();
    this.particle(4,from,{x:d.x*180,y:d.y*180,z:d.z*180},Math.max(1/60,length/180),.027,floor);
    const tracer=this.pools[4].items.at(-1)!;tracer.trace??={from:new T.Vector3(),distance:0};tracer.trace.from.set(from.x,from.y,from.z);tracer.trace.distance=length;
    for(let i=0;i<3;i++)this.particle(0,from,{x:d.x*2,y:d.y*2,z:d.z*2},.055+i*.015,.2+i*.08,floor);
    const port=ejection??{x:from.x-d.x*.45,y:from.y-.045,z:from.z-d.z*.45};
    const category=WEAPON_BY_ID.get(weapon||'')?.category;
    const size=category==='shotgun'?.018:category==='sidearm'||category==='smg'?.009:.01;
    this.particle(3,port,{x:-d.z*1.8,y:1.1+Math.random()*.4,z:d.x*1.8},1.6,size,floor);
    this.pools[3].items.at(-1)!.caseLength=category==='sidearm'||category==='smg'?.022:.05;
  }
  explosion(at:Point,radius=8,floor=0) {
    for(let i=0;i<36;i++){
      const angle=Math.random()*Math.PI*2,up=Math.random(),speed=2+Math.random()*radius;
      const v={x:Math.cos(angle)*speed,y:up*speed+2,z:Math.sin(angle)*speed};
      this.particle(2,at,v,2+Math.random()*3,.1+Math.random()*.32,floor);
      if(i<16)this.particle(0,at,{x:v.x*.4,y:v.y*.35,z:v.z*.4},.3+Math.random()*.5,1+Math.random()*2,floor);
      if(i<18)this.particle(1,at,{x:v.x*.15,y:1+up*3,z:v.z*.15},2+Math.random()*4,1+Math.random()*2,floor);
    }
    if(this.dustQueue.length>=12)this.dustQueue.shift();
    this.dustQueue.push({at:{...at},radius,floor,delay:.14});
    const slot=this.lightTime[0]<=this.lightTime[1]?0:1;
    this.lights[slot].position.set(at.x,at.y+1,at.z);this.lightTime[slot]=.3;
  }
  private dust(at:Point,radius:number,floor:number) {
    for(let i=0;i<16;i++){
      const a=i*Math.PI*2/16, speed=1+Math.random()*Math.min(radius,9);
      this.particle(5,{x:at.x,y:floor+.2,z:at.z},{x:Math.cos(a)*speed,y:.25+Math.random()*.4,z:Math.sin(a)*speed},2.5+Math.random()*2,.8+Math.random(),floor);
    }
  }
  demolition(at:Point,radius=4,floor=0) {
    // Structural breakup follows the blast event; it must not create a second fireball.
    for(let i=0;i<28;i++)this.particle(2,{x:at.x+(Math.random()-.5)*radius,y:at.y+(Math.random()-.5)*radius,z:at.z+(Math.random()-.5)*radius},
      {x:(Math.random()-.5)*4,y:Math.random()*3,z:(Math.random()-.5)*4},2+Math.random()*3,.12+Math.random()*.38,floor);
    this.dust(at,radius,floor);
  }
  consume(events:Event[],floor:(x:number,z:number)=>number=()=>0) {
    for(const e of events){
      if(e.id<=this.lastEvent)continue;this.lastEvent=e.id;
      const p={x:e.x,y:e.y??floor(e.x,e.z)+1.3,z:e.z};
      if(e.kind==='shot')this.shot(p,{x:e.toX,y:e.toY??floor(e.toX,e.toZ)+1.2,z:e.toZ},floor(e.x,e.z),e.ejectX!==undefined?{x:e.ejectX,y:e.ejectY!,z:e.ejectZ!}:undefined,e.weapon);
      if(e.kind==='blast'){this.ludoImpact.spawn(p,e.radius||11);this.demolition(p,Math.min(4,e.radius||4),floor(e.x,e.z));}
      if(['vehicle-explosion','explosion'].includes(e.kind))this.explosion(p,e.radius||8,floor(e.x,e.z));
      if(e.kind==='hit')this.surfaceHit(p,{x:e.nx??0,y:e.ny??1,z:e.nz??0},e.hitKind,floor(e.x,e.z));
      if(e.kind==='blood')this.blood(p,{x:e.toX,y:e.toY??.15,z:e.toZ},Number.isFinite(e.floorY)?e.floorY!:floor(e.x,e.z));
      if(e.kind==='crash'){this.dust(p,e.radius||2,floor(e.x,e.z));for(let i=0;i<12;i++)this.particle(2,p,{x:(Math.random()-.5)*6,y:Math.random()*3,z:(Math.random()-.5)*6},.65,.03,floor(e.x,e.z));}
      if(e.kind==='fracture')this.demolition(p,e.radius||4,floor(e.x,e.z));
    }
  }
  /** Localized spherical breaches in static masonry; collision uses the same cuts. */
  fracture(scene:T.Scene,sections:(Point&{radius:number})[],excluded:T.Object3D[]=[]) {
    this.cuts.forEach(c=>c.set(0,-10000,0,0));
    sections.slice(0,12).forEach((s,i)=>this.cuts[i].set(s.x,s.y,s.z,s.radius));
    const box=new T.Box3(),size=new T.Vector3();
    const visit=(o:T.Object3D)=>{
      if(excluded.includes(o)||o===this.group)return;
      if(o instanceof T.Mesh && !(o instanceof T.SkinnedMesh)) {
        box.setFromObject(o);box.getSize(size);
        if(size.y>4&&sections.some(s=>box.intersectsSphere(new T.Sphere(new T.Vector3(s.x,s.y,s.z),s.radius+.5)))) {
          for(const material of Array.isArray(o.material)?o.material:[o.material]){
            if(this.patched.has(material)||!(material instanceof T.MeshStandardMaterial||material instanceof T.MeshBasicMaterial))continue;
            const compile=material.onBeforeCompile,key=material.customProgramCacheKey;
            this.patched.set(material,{compile,key});
            material.onBeforeCompile=(shader,renderer)=>{
              compile.call(material,shader,renderer);shader.uniforms.tiranaCuts={value:this.cuts};
              shader.vertexShader='varying vec3 vTiranaWorld;\n'+shader.vertexShader;
              shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
                vec4 cutPos=vec4(transformed,1.);
                #ifdef USE_INSTANCING
                cutPos=instanceMatrix*cutPos;
                #endif
                vTiranaWorld=(modelMatrix*cutPos).xyz;`);
              shader.fragmentShader='uniform vec4 tiranaCuts[12]; varying vec3 vTiranaWorld;\n'+shader.fragmentShader;
              shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
                for(int i=0;i<12;i++){if(tiranaCuts[i].w<=0.)continue;
                  float d=distance(vTiranaWorld,tiranaCuts[i].xyz);
                  if(d<tiranaCuts[i].w)discard;
                  diffuseColor.rgb*=mix(.16,1.,smoothstep(tiranaCuts[i].w,tiranaCuts[i].w+.5,d));}`);
            };
            material.customProgramCacheKey=()=>key.call(material)+'-tirana-breach-v1';material.needsUpdate=true;
          }
        }
      }
      for(const child of o.children)visit(child);
    };visit(scene);
  }
  update(dt:number,camera:T.Camera,fires:Point[]=[],missiles:(Point&{id?:number;direction?:Point})[]=[],battery=false) {
    if(!Number.isFinite(dt)||dt<=0)return;
    for(let i=this.dustQueue.length-1;i>=0;i--){const q=this.dustQueue[i];q.delay-=dt;if(q.delay<=0){if(q.delay> -4.5)this.dust(q.at,q.radius,q.floor);this.dustQueue.splice(i,1);}}
    const ids=new Set<number>();
    for(const [index,missile]of missiles.slice(0,8).entries()){
      const d=missile.direction??{x:0,y:0,z:0};
      const at={...missile,x:missile.x-d.x*.84,y:missile.y-d.y*.84,z:missile.z-d.z*.84};
      const id=at.id??index;ids.add(id);const previous=this.trails.get(id);
      if(previous){
        const distance=Math.hypot(at.x-previous.x,at.y-previous.y,at.z-previous.z),count=Math.min(battery?6:14,Math.floor(distance/.7));
        for(let i=0;i<count;i++){const t=(i+1)/Math.max(1,count);this.particle(1,{x:previous.x+(at.x-previous.x)*t,y:previous.y+(at.y-previous.y)*t,z:previous.z+(at.z-previous.z)*t},{x:.25,y:.2,z:.1},1.1,.18,at.y-200);}
        if(count)this.trails.set(id,{...at});
      }else this.trails.set(id,{...at});
    }
    for(const id of this.trails.keys())if(!ids.has(id))this.trails.delete(id);
    this.ludoImpact.update(dt);
    this.emission+=dt;
    if(this.emission>.075){this.emission=0;
      for(const at of fires.slice(0,battery?4:8)){
        this.particle(0,{x:at.x+(Math.random()-.5),y:at.y,z:at.z+(Math.random()-.5)},{x:0,y:2.2,z:0},.65,.6+Math.random(),at.y-1);
        this.particle(1,at,{x:.25,y:1.9,z:0},4,1.1,at.y-1);
      }

    }
    for(let k=0;k<this.pools.length;k++){
      const pool=this.pools[k];
      for(let i=pool.items.length-1;i>=0;i--){const p=pool.items[i];const step=p.rendered?dt:0;p.age+=step;
        // Visibility only limits GPU submissions. Every live slot ages, including
        // particles omitted by battery mode, so hidden effects cannot accumulate.
        p.rendered=true;
        if(p.age>=p.life){pool.items.splice(i,1);pool.free.push(p);continue;}
        if(k===1||k===5){const blend=1-Math.exp(-step*.25);p.v.x+=(.22-p.v.x)*blend;p.v.z+=(.12-p.v.z)*blend;}
        if(k!==4){p.p.addScaledVector(p.v,step);if(k===2||k===3||k===6){p.p.y-=4.905*step*step;p.v.y-=9.81*step;p.spin+=step*5;}}
        if(k===2||k===3)p.v.multiplyScalar(Math.exp(-step*.22));
        if(k===6&&p.p.y<=p.floor+.02){this.bloodMarks.add(p.p.x,p.floor,p.p.z,p.size*2.5);pool.items.splice(i,1);pool.free.push(p);continue;}
        if((k===2||k===3)&&p.p.y<p.floor+.03){p.p.y=p.floor+.03;p.v.y=Math.abs(p.v.y)*.22;p.v.x*=.7;p.v.z*=.7;}
      }
      const budget=battery?Math.ceil(pool.capacity*.55):pool.capacity,range=k===6?(battery?40:75):k===3?(battery?35:65):(battery?160:300);
      let count=0;
      for(let i=pool.items.length-1;i>=0&&count<budget;i--){
        const p=pool.items[i],t=Math.min(1,p.age/p.life);
        if(p.p.distanceToSquared(camera.position)>range*range)continue;
        this.transform.position.copy(p.p);
        this.transform.quaternion.copy(camera.quaternion);
        if(k<2||k===5)this.transform.scale.setScalar(p.size*(1+t*(k===0?1.3:2.5)));
        else if(k===6)this.transform.scale.set(p.size,p.size*1.5,1);
        else if(k===4){
          const span=tracerSpan(p.trace!.distance,Math.max(p.age,Math.min(dt,p.life,1/60)));this.trailDirection.copy(p.v).normalize();
          this.transform.position.copy(p.trace!.from).addScaledVector(this.trailDirection,span.center);
          this.transform.quaternion.setFromUnitVectors(this.trailUp,this.trailDirection);
          this.transform.scale.set(p.size,p.size,span.length);
        }
        else{this.transform.rotation.set(p.spin,p.spin*.7,p.spin*.3);this.transform.scale.set(p.size,p.size,k===3?p.caseLength??p.size*2.8:p.size);}
        this.transform.updateMatrix();pool.mesh.setMatrixAt(count,this.transform.matrix);
        this.color.set(k===0?(t<.25?0xffedbc:t<.65?0xffa336:0xb13912):k===1?0x555559:k===2?0x82796b:k===3?0xc5a34a:k===5?0xa79a84:k===6?0x741e1b:0xffd794);
        pool.mesh.setColorAt(count,this.color);pool.alpha.setX(count,k===4?Math.max(.3,1-t):(1-t)*(k===1||k===5?.45:1));count++;
      }
      pool.mesh.count=count;
      pool.mesh.instanceMatrix.needsUpdate=true;if(pool.mesh.instanceColor)pool.mesh.instanceColor.needsUpdate=true;pool.alpha.needsUpdate=true;
    }
    this.bloodMarks.update(dt,camera,battery);
    this.lights.forEach((l,i)=>{this.lightTime[i]=Math.max(0,this.lightTime[i]-dt);l.intensity=battery?0:this.lightTime[i]*120;});
  }
  private restoreMaterials() {
    for(const [m,saved]of this.patched){m.onBeforeCompile=saved.compile;m.customProgramCacheKey=saved.key;m.needsUpdate=true;}
    this.patched.clear();
  }
  reset() {
    this.ludoImpact.reset();
    this.lastEvent=0;this.emission=0;this.trails.clear();this.dustQueue=[];
    this.pools.forEach(p=>{p.free.push(...p.items);p.items.length=0;p.mesh.count=0;});this.bloodMarks.reset();this.cuts.forEach(c=>c.set(0,-10000,0,0));
    this.lightTime=[0,0];this.lights.forEach(l=>l.intensity=0);this.restoreMaterials();
  }
  dispose() {
    this.reset();this.ludoImpact.dispose();this.bloodMarks.dispose();this.group.removeFromParent();for(const p of this.pools){p.mesh.geometry.dispose();(p.mesh.material as T.Material).dispose();}
  }
}
