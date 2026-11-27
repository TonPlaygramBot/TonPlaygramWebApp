import * as T from 'three';
import type {ImportedTree} from './ImportedTreeLayer';

const IMAGE='/assets/tirana-streets/city-realism/urban-tree-distance-v1.webp';
const CAPACITY=6000;
// Crop from the original Poly Haven Island Tree 02 (CC0) model.
// Opaque silhouette bounds, including its trunk, are 211×190 inside 219×198.
const WIDTH=219/211, HEIGHT=198/190, BASE_PAD=4/190;

/** Upright cutouts of the source model, in one draw call. Buildings and
 * other trees still occlude them; only foliage with no active 3D LOD qualifies. */
export class DistantBroadleafLayer {
 private material=new T.MeshLambertMaterial({alphaTest:.30,side:T.DoubleSide,color:0xe4e4e4});
 readonly mesh=new T.InstancedMesh(new T.PlaneGeometry(1,1),this.material,CAPACITY);
 private texture?:T.Texture;
 private state:'idle'|'pending'|'ready'|'failed'|'disposed'='idle';
 private dummy=new T.Object3D();
 private color=new T.Color();
 constructor(private load=()=>new T.TextureLoader().loadAsync(IMAGE)){
  this.mesh.name='Tirana:source-broadleaf-distance';
  this.mesh.count=0;this.mesh.frustumCulled=false;
  this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
 }
 get ready(){return this.state==='ready';}
 request(){
  if(this.state!=='idle')return;
  this.state='pending';
  void this.load().then(texture=>{
   if(this.state==='disposed'){texture.dispose();return;}
   this.texture=texture;texture.colorSpace=T.SRGBColorSpace;
   texture.minFilter=T.LinearMipmapLinearFilter;
   this.material.map=texture;this.material.needsUpdate=true;this.state='ready';
  }).catch(()=>{if(this.state==='pending')this.state='failed';});
 }
 begin(){this.mesh.count=0;}
 add(tree:ImportedTree,eye:{x:number;z:number}){
  if(!this.ready||this.mesh.count>=CAPACITY||!['garden','umbrella'].includes(tree.shape))return false;
  this.dummy.position.set(tree.x,(tree.y??.12)+tree.height*(HEIGHT/2-BASE_PAD),tree.z);
  this.dummy.rotation.y=Math.atan2(eye.x-tree.x,eye.z-tree.z);
  this.dummy.scale.set(tree.crown*WIDTH,tree.height*HEIGHT,1);
  this.dummy.updateMatrix();
  const i=this.mesh.count++;
  this.mesh.setMatrixAt(i,this.dummy.matrix);
  this.color.setScalar(.88+((Math.abs(tree.seed)%7)/7)*.12);
  this.mesh.setColorAt(i,this.color);
  return true;
 }
 end(){
  if(!this.mesh.count)return;
  this.mesh.instanceMatrix.needsUpdate=true;
  if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;
 }
 dispose(){
  if(this.state==='disposed')return;
  this.state='disposed';this.mesh.removeFromParent();this.mesh.dispose();
  this.mesh.geometry.dispose();this.material.dispose();this.texture?.dispose();
 }
}
