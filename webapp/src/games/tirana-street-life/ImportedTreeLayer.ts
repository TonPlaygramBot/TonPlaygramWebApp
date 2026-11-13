import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {disposeWeaponResources} from '../tiranastreets/weaponModelResources';

export type ImportedTree = {x:number; y?:number; z:number; height:number; crown:number; seed:number; shape:string};
type SourceLoader = () => Promise<T.Group>;
/** Close-range glTF canopy. Keep every original mesh/material/UV attribute, with
 * shared instanced geometry rather than cloning a full scene for each trunk.
 * The caller retains its inexpensive distant canopy and failure fallback. */
export class ImportedTreeLayer {
 readonly group = new T.Group();
 private source?: T.Group;
 private meshes:T.InstancedMesh[] = [];
 private dead=false;
 private pending=false;
 private failed=false;
 private normalizer=new T.Matrix4();
 private transforms:T.Matrix4[]=[];
 private dummy=new T.Object3D();
 private matrix=new T.Matrix4();
 private count=0;
 readonly capacity=8;
 constructor(private loadSource:SourceLoader=async()=>
  (await new GLTFLoader().loadAsync('/assets/tirana-streets/city-realism/urban-tree.glb')).scene){
  this.group.name='Tirana:imported-close-canopy';
 }
 get ready(){return this.meshes.length>0&&!this.dead;}
 request(){
  if(this.dead||this.pending||this.failed||this.ready)return;
  this.pending=true;
  void this.loadSource().then(source=>{
   if(this.dead){disposeWeaponResources([source]);return;}
   this.source=source;source.updateMatrixWorld(true);
   const bounds=new T.Box3().setFromObject(source),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
   if(!Number.isFinite(size.length())||size.y<=0||Math.max(size.x,size.z)<=0)throw Error('Invalid tree bounds');
   const diameter=Math.max(size.x,size.z);
   this.normalizer.makeScale(1/diameter,1/size.y,1/diameter).multiply(new T.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));
   const parts:T.Mesh[]=[];
   source.traverseVisible(o=>{if(o instanceof T.Mesh)parts.push(o);});
   if(!parts.length||parts.some(o=>o instanceof T.SkinnedMesh||(o.morphTargetInfluences?.length??0)>0))throw Error('Tree must contain rigid meshes');
   for(const part of parts){
    const mesh=new T.InstancedMesh(part.geometry,part.material,this.capacity);
    mesh.name=part.name;mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.transforms.push(this.normalizer.clone().multiply(part.matrixWorld));
    this.meshes.push(mesh);this.group.add(mesh);
   }
   this.group.userData.status='ready';
  }).catch(error=>{
   this.failed=true;this.group.userData.status='fallback';
   if(this.source){disposeWeaponResources([this.source]);this.source=undefined;}
   if(!this.dead)console.warn('Tirana close canopy unavailable; retaining existing trees',error);
  }).finally(()=>{this.pending=false;});
 }
 begin(){this.count=0;for(const mesh of this.meshes)mesh.count=0;}
 add(tree:ImportedTree,battery=false){
  // Open-canopy garden tree is not stretched into upright boulevard trees or cypress columns.
  if(!this.ready||!['garden','umbrella'].includes(tree.shape)||this.count>=(battery?3:this.capacity))return false;
  this.dummy.position.set(tree.x,tree.y??.12,tree.z);
  this.dummy.rotation.set(0,tree.seed*2.399,0);
  this.dummy.scale.set(tree.crown,tree.height,tree.crown);this.dummy.updateMatrix();
  this.meshes.forEach((mesh,i)=>{this.matrix.multiplyMatrices(this.dummy.matrix,this.transforms[i]);mesh.setMatrixAt(this.count,this.matrix);mesh.count=this.count+1;mesh.castShadow=!battery;});
  this.count++;return true;
 }
 end(){for(const mesh of this.meshes)mesh.instanceMatrix.needsUpdate=true;this.group.userData.visibleTrees=this.count;}
 dispose(){
  if(this.dead)return;this.dead=true;
  // Instanced attributes are owned here; prototype geometry/textures only once.
  for(const mesh of this.meshes)mesh.dispose();
  if(this.source)disposeWeaponResources([this.source]);this.source=undefined;
  this.meshes=[];this.transforms=[];this.group.clear();this.group.removeFromParent();
 }
}
