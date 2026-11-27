import {Box3, Group, InstancedMesh, Mesh, Matrix4, Vector3} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {nearbyIndex} from '../tirana-street-life/streetModels.mjs';
import {groundHeight} from '../tirana-east/terrainCore.mjs';
import {STREET_BASKETS} from './streetBasketsData.mjs';

const CAP = 16, DETAIL_CAP = 3;
const MODEL_URL='/assets/tirana-streets/environment/civic/slatted-bin.glb';
const select = nearbyIndex(STREET_BASKETS.map(([id,x,z])=>({id,x,z})));
function release(root) {
  const g=new Set(),m=new Set(),t=new Set();
  root.traverse(o=>{
    if (!(o instanceof Mesh))return;
    g.add(o.geometry);
    for(const material of Array.isArray(o.material)?o.material:[o.material]){
      m.add(material);
      for(const value of Object.values(material))if(value?.isTexture)t.add(value);
    }
  });
  g.forEach(v=>v.dispose());m.forEach(v=>v.dispose());t.forEach(v=>v.dispose());
}
/** Existing city glTF remains the fallback. The authored model is loaded only
 * close by, instanced by original material, and bounded to three copies. */
export class StreetBasketVisuals {
  group = new Group();
  #fallback = [];
  #detail = [];
  #key = null;
  #source;
  #requested = false;
  #dead = false;
  constructor(source,loader=new GLTFLoader()) {
    this.loader=loader;
    this.group.name = 'Tirana: mapped sidewalk baskets';
    const template = source.getObjectByName('litter_bin');
    if (!template) return;
    template.updateWorldMatrix(true,true);
    template.traverse(node=>{
      if (!(node instanceof Mesh)) return;
      this.#fallback.push(this.#add(node.geometry,node.material,CAP,node.matrixWorld.clone()));
    });
  }
  #add(geometry,material,capacity,matrix){
    const mesh=new InstancedMesh(geometry,material,capacity);
    mesh.count=0;mesh.visible=false;mesh.receiveShadow=true;
    this.group.add(mesh);
    return {mesh,matrix};
  }
  async #load(){
    try{
      const {scene}=await this.loader.loadAsync(MODEL_URL);
      if(this.#dead){release(scene);return;}
      this.#source=scene;
      scene.updateMatrixWorld(true);
      const box=new Box3().setFromObject(scene);
      if(box.isEmpty())throw Error('Missing basket geometry');
      const center=box.getCenter(new Vector3());
      if(box.max.x-box.min.x>.9||box.max.z-box.min.z>.9||box.max.y-box.min.y>1.2)throw Error('Unexpected basket dimensions');
      const origin=new Matrix4().makeTranslation(-center.x,-box.min.y,-center.z);
      const parts=new Map();
      const merged=[];
      try{
        scene.traverse(o=>{
          if(!(o instanceof Mesh))return;
          if(Array.isArray(o.material))throw Error('Unexpected multiple materials per mesh');
          const clone=o.geometry.clone().applyMatrix4(new Matrix4().multiplyMatrices(origin,o.matrixWorld));
          const g=clone.index?clone.toNonIndexed():clone;
          if(g!==clone)clone.dispose();
          if(!parts.has(o.material))parts.set(o.material,[]);
          parts.get(o.material).push(g);
        });
        for(const [material,geometries] of parts){
          const geometry=mergeGeometries(geometries);
          if(!geometry)throw Error('Could not batch basket mesh');
          merged.push({material,geometry});
        }
      }catch(err){merged.forEach(({geometry})=>geometry.dispose());throw err;}
      finally{parts.forEach(geometries=>geometries.forEach(g=>g.dispose()));}
      this.#detail=merged.map(({geometry,material})=>this.#add(geometry,material,DETAIL_CAP,new Matrix4()));
      this.#key=null;
    }catch{
      if(this.#source){release(this.#source);this.#source=undefined;}
      this.group.userData.detailUnavailable=true;
    }
  }
  update(x,z,battery) {
    if (this.#dead||!Number.isFinite(x)||!Number.isFinite(z)) return;
    const points=select({x,z},battery?55:105,battery?8:CAP);
    const nearby=points.filter(p=>Math.hypot(p.x-x,p.z-z)<(battery?12:24)).slice(0,battery?1:DETAIL_CAP);
    if(nearby.length&&!this.#requested){this.#requested=true;void this.#load();}
    const preferred=this.#detail.length?nearby:[];
    const key=points.map(p=>p.id).join(',')+'|'+preferred.map(p=>p.id).join(',');
    if(key===this.#key)return;
    this.#key=key;
    const detailIds=new Set(preferred.map(p=>p.id));
    this.#place(this.#fallback,points.filter(p=>!detailIds.has(p.id)));
    this.#place(this.#detail,preferred);
  }
  #place(batches,points){
    const offset=new Matrix4();
    for(const {mesh,matrix} of batches){
      mesh.count=points.length;mesh.visible=points.length>0;
      points.forEach((p,i)=>{
        offset.makeTranslation(p.x,groundHeight(p.x,p.z)+.078,p.z).multiply(matrix);
        mesh.setMatrixAt(i,offset);
      });
      mesh.instanceMatrix.needsUpdate=true;
      if(mesh.visible)mesh.computeBoundingSphere();
    }
  }
  dispose() {
    if(this.#dead)return;this.#dead=true;
    for(const {mesh} of [...this.#fallback,...this.#detail])mesh.dispose();
    for(const {mesh} of this.#detail)mesh.geometry.dispose();
    if(this.#source)release(this.#source);
    this.group.clear();this.group.removeFromParent();
    this.#fallback.length=0;this.#detail.length=0;
  }
}
