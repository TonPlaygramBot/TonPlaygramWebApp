import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {WATER_PATHS} from '../tirana-environment/riverGeometry';
import {LANA_CRAFT_DRAW_RADIUS,LANA_CRAFT_LOAD_RADIUS,LANA_SOLO_WATER_LEVEL,lanaCraftAnchors} from './lanaWatercraftLayout.mjs';

const ASSET='/assets/tirana-streets/environment/lana-watercraft.glb';
type Batch={mesh:T.InstancedMesh;restY:number};
export class LanaWatercraft {
  readonly group=new T.Group();
  private readonly anchors=lanaCraftAnchors(WATER_PATHS);
  private readonly dummy=new T.Object3D();
  private source?:T.Group;
  private batches:Batch[]=[];
  private dead=false;
  private requested=false;
  private at=-Infinity;
  constructor(){this.group.name='Solo: moored Lana watercraft';}
  update(viewer:{x:number;z:number},time:number,battery:boolean){
    if(this.dead||!this.anchors.length)return;
    const p=this.anchors[1],d2=(viewer.x-p.x)**2+(viewer.z-p.z)**2;
    const visible=d2<LANA_CRAFT_DRAW_RADIUS**2;
    this.group.visible=visible;
    if(!this.requested&&d2<LANA_CRAFT_LOAD_RADIUS**2){
      this.requested=true;
      void new GLTFLoader().loadAsync(ASSET).then(g=>{
        if(this.dead){disposeCraft(g.scene);return;}
        this.source=g.scene;
        try{this.install(g.scene);}
        catch(error){this.clearBatches();disposeCraft(g.scene);this.source=undefined;console.warn('Lana watercraft unavailable',error);}
      },()=>{/* A missing optional asset must never interrupt play. */});
    }
    if(!visible||!this.batches.length)return;
    if(time>=this.at&&time-this.at<(battery?.15:.08))return;
    this.at=time;
    // Every craft uses the same animation matrix across all material batches.
    const matrices=this.anchors.map(({x,z,yaw,phase})=>{
      const step=time*1.12+phase;
      this.dummy.position.set(x,this.batches[0].restY+Math.sin(step)*.055,z);
      this.dummy.rotation.set(Math.sin(step+.3)*.014,yaw,Math.cos(step*.9)*.021,'YXZ');
      this.dummy.updateMatrix();
      return this.dummy.matrix.clone();
    });
    this.batches.forEach(({mesh})=>{
      matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
      mesh.count=this.anchors.length;mesh.instanceMatrix.needsUpdate=true;
    });
  }
  private install(source:T.Group){
    source.rotation.y=-Math.PI/2;
    source.updateMatrixWorld(true);
    const hull=new T.Box3().setFromObject(source);
    if(hull.isEmpty()||hull.max.y-hull.min.y<.5)throw Error('Invalid watercraft asset');
    const restY=LANA_SOLO_WATER_LEVEL-hull.min.y-.27;
    const sets=new Map<string,{material:T.Material;geometries:T.BufferGeometry[]}>();
    source.traverse(object=>{
      if(!(object instanceof T.Mesh)||Array.isArray(object.material))return;
      const g=(object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone()).applyMatrix4(object.matrixWorld);
      const key=object.material.uuid+':'+Object.keys(g.attributes).sort().join(',');
      const set=sets.get(key)??{material:object.material,geometries:[]};
      set.geometries.push(g);sets.set(key,set);
    });
    if(!sets.size)throw Error('No watercraft material groups');
    try{
      for(const {material,geometries} of sets.values()){
        const geometry=mergeGeometries(geometries);
        if(!geometry)throw Error('Watercraft meshes could not be batched');
        const mesh=new T.InstancedMesh(geometry,material,this.anchors.length);
        mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.count=0;
        mesh.frustumCulled=false; // Three tightly bounded craft share one visible group.
        this.group.add(mesh);this.batches.push({mesh,restY});
      }
    }finally{sets.forEach(s=>s.geometries.forEach(g=>g.dispose()));}
    this.at=-Infinity;
  }
  private clearBatches(){this.batches.forEach(({mesh})=>{mesh.geometry.dispose();mesh.dispose();mesh.removeFromParent();});this.batches=[];}
  dispose(){if(this.dead)return;this.dead=true;this.clearBatches();if(this.source)disposeCraft(this.source);this.source=undefined;this.group.removeFromParent();}
}
function disposeCraft(source:T.Object3D){
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
  source.traverse(object=>{
    if(!(object instanceof T.Mesh))return;
    geometries.add(object.geometry);
    for(const m of Array.isArray(object.material)?object.material:[object.material]){
      materials.add(m);
      for(const texture of Object.values(m))if(texture instanceof T.Texture)textures.add(texture);
    }
  });
  textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());
}
