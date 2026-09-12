import * as T from 'three';
import type { Track, Racer } from './simulation.mjs';
import { occupied } from './baseTiranaScenery';
import { cloneHuman, bakeHuman, poseHuman, type Human } from './supporterHuman';
import { FLAG_RATIOS } from '../tirana-city-source/flagRatios.mjs';
type Fan = { x: number; z: number; yaw: number; seed: number; scale: number; variant: number };
type Actor = { human: Human; fan?: Fan };
/** Animated nearby spectators and instanced distant spectators. No projectiles. */
export class Supporters {
  readonly group = new T.Group();
  private fans: Fan[] = [];
  private batches: T.InstancedMesh[][] = [];
  private actors: Actor[][] = [];
  private bakedHands: T.Vector3[] = [];
  private poles: T.InstancedMesh;
  private flags: T.InstancedMesh;
  private transform = new T.Object3D();
  private pole = new T.Object3D();
  private cloth = new T.Object3D();
  private hand = new T.Vector3();
  private clock = { value: 0 };
  constructor(track: Track, flagTexture: T.Texture, templates: T.Group[]) {
    const stride = Math.max(2, Math.round(12 / (track.length / track.points.length)));
    for (let i = 10; i < track.points.length - 15; i += stride) for (const side of [-1, 1]) {
      const p = track.points[i], offset = (p.width ?? track.width) / 2 + 2.3;
      const x = p.x - Math.cos(p.yaw) * offset * side, z = p.z + Math.sin(p.yaw) * offset * side;
      if (occupied(x, z)) continue;
      const seed = i * 2 + (side + 1) / 2;
      this.fans.push({ x, z, yaw: Math.atan2(p.x-x,p.z-z), seed, scale: .96 + (seed % 5) * .02, variant: seed % templates.length });
    }
    for (const template of templates) {
      const human = cloneHuman(template);
      const batches = bakeHuman(human).map(({ geometry, material }) => {
        const mesh = new T.InstancedMesh(geometry, material, this.fans.length);
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
        mesh.count = 0;
        this.group.add(mesh);
        return mesh;
      });
      this.bakedHands.push(human.bones.get('hand_l')?.[0]?.getWorldPosition(new T.Vector3()) || new T.Vector3(.37,1.55,.3));
      this.batches.push(batches);
      human.root.traverse(o => { if (o instanceof T.SkinnedMesh) o.skeleton.dispose(); });
      this.actors.push(Array.from({ length: 6 }, () => {
        const human = cloneHuman(template); this.group.add(human.root); return { human };
      }));
    }
    this.poles = new T.InstancedMesh(new T.CylinderGeometry(.018,.018,1.4,6), new T.MeshStandardMaterial({color:'#dbdce0',metalness:.55,roughness:.35}), this.fans.length);
    const material = new T.MeshStandardMaterial({map:flagTexture,side:T.DoubleSide,roughness:.85});
    material.onBeforeCompile = shader => {
      shader.uniforms.fanTime = this.clock;
      shader.vertexShader = 'uniform float fanTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat freeEdge = clamp(uv.x, 0.0, 1.0); transformed.z += sin(uv.x * 8.0 - fanTime * 4.0) * freeEdge * 0.065;');
    };
    const width = .98, height = width / FLAG_RATIOS.AL;
    // Hoist at x=0. Both pole and cloth inherit the same hand-mounted transform.
    this.flags = new T.InstancedMesh(new T.PlaneGeometry(width,height,12,4).translate(width/2,.84,0), material, this.fans.length);
    this.pole.add(this.cloth);
    for (const mesh of [this.poles,this.flags]) {
      mesh.frustumCulled=false; mesh.count=0; mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); this.group.add(mesh);
    }
  }
  update(time: number, me: Racer, battery: boolean) {
    this.clock.value=time;
    const near=this.fans.filter(f=>Math.hypot(f.x-me.x,f.z-me.z)<(battery?85:130));
    const assignments=new Map<Fan,Actor>();
    this.actors.forEach((pool,variant)=>{
      const wanted=near.filter(f=>f.variant===variant && Math.hypot(f.x-me.x,f.z-me.z)<(battery?25:42)).sort((a,b)=>Math.hypot(a.x-me.x,a.z-me.z)-Math.hypot(b.x-me.x,b.z-me.z)).slice(0,battery?3:6);
      pool.forEach((actor,i)=>{actor.fan=wanted[i];actor.human.root.visible=!!actor.fan;if(actor.fan)assignments.set(actor.fan,actor);});
    });
    const counts=this.batches.map(()=>0);
    let flagIndex=0;
    for(const fan of near){
      const m=this.transform,actor=assignments.get(fan);
      m.position.set(fan.x,.04,fan.z);m.rotation.set(0,fan.yaw,0);m.scale.setScalar(fan.scale);m.updateMatrix();
      if(actor){
        actor.human.root.position.copy(m.position);actor.human.root.rotation.copy(m.rotation);actor.human.root.scale.copy(m.scale);
        poseHuman(actor.human,time+fan.seed,-1,true);
        actor.human.bones.get('hand_l')?.[0]?.getWorldPosition(this.hand);
      }else{
        const n=counts[fan.variant]++;this.batches[fan.variant].forEach(mesh=>mesh.setMatrixAt(n,m.matrix));
        this.hand.copy(this.bakedHands[fan.variant]).applyMatrix4(m.matrix);
      }
      this.pole.position.copy(this.hand);this.pole.rotation.set(0,fan.yaw,actor?Math.sin(time*2+fan.seed)*.045:0);this.pole.scale.setScalar(1);this.pole.updateMatrixWorld(true);
      this.cloth.position.set(0,.5,0);this.cloth.updateMatrixWorld();this.poles.setMatrixAt(flagIndex,this.cloth.matrixWorld);
      this.flags.setMatrixAt(flagIndex++,this.pole.matrixWorld);
    }
    this.batches.forEach((batch,i)=>batch.forEach(mesh=>{mesh.count=counts[i];mesh.instanceMatrix.needsUpdate=true;}));
    for(const mesh of [this.poles,this.flags]){mesh.count=flagIndex;mesh.instanceMatrix.needsUpdate=true;}
  }
  dispose(){
    this.group.removeFromParent();
    for(const mesh of this.batches.flat()){mesh.geometry.dispose();mesh.dispose();}
    for(const mesh of [this.poles,this.flags]){mesh.geometry.dispose();(mesh.material as T.Material).dispose();mesh.dispose();}
    this.actors.flat().forEach(a=>a.human.root.traverse(o=>{if(o instanceof T.SkinnedMesh)o.skeleton.dispose();}));
  }
  get count(){return this.fans.length;}
}
