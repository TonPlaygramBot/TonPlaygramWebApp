import * as T from 'three';
import type {ImportedTree} from './ImportedTreeLayer';

const ROOT='/assets/tirana-streets/city-realism/';
type Profile = {id:string; file:string; shapes:readonly string[]; width:number; height:number; basePad:number; capacity:number};
const BROADLEAF={id:'broadleaf',file:'urban-tree-distance-v1.webp',shapes:['garden','umbrella'],width:219/211,height:198/190,basePad:4/190,capacity:6000};
const UPRIGHT={id:'upright',file:'plane-tree-distance-v1.webp',shapes:['upright'],width:160/152,height:219/211,basePad:4/211,capacity:6000};
const COLUMN={id:'column',file:'italian-cypress-mature-distance-v1.webp',shapes:['column'],width:45/37,height:215/207,basePad:4/207,capacity:6000};

/** Upright cutouts of the source model, in one draw call. Buildings and
 * other trees still occlude them; only foliage with no active 3D LOD qualifies. */
export class DistantBroadleafLayer {
 // A cutout already contains directional leaf/trunk shading from its source.
 // A second Lambert term made the whole tree nearly black when the viewer
 // faced away from the sun. Preserve baked detail and let the sky light and
 // Three's regular fog/tone mapper set its scene brightness instead.
 private material=new T.MeshBasicMaterial({alphaTest:.30,side:T.DoubleSide,color:0xffffff});
 readonly mesh:T.InstancedMesh;
 private texture?:T.Texture;
 private state:'idle'|'pending'|'ready'|'failed'|'disposed'='idle';
 private dummy=new T.Object3D();
 private color=new T.Color();
 constructor(private load?:()=>Promise<T.Texture>,private profile:Profile=BROADLEAF){
  this.mesh=new T.InstancedMesh(new T.PlaneGeometry(1,1),this.material,profile.capacity);
  this.mesh.name='Tirana:source-'+profile.id+'-distance';
  this.mesh.count=0;this.mesh.frustumCulled=false;
  this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
 }
 get profileId(){return this.profile.id;}
 setSkyLight(environmentIntensity:number){
  const value=Number.isFinite(environmentIntensity)?environmentIntensity:.8;
  const daylight=T.MathUtils.clamp((value-.22)/.58,0,1);
  this.material.color.setScalar(.43+2.22*daylight);
 }
 get ready(){return this.state==='ready';}
 request(){
  if(this.state!=='idle')return;
  this.state='pending';
  void (this.load?.()??new T.TextureLoader().loadAsync(ROOT+this.profile.file)).then(texture=>{
   if(this.state==='disposed'){texture.dispose();return;}
   this.texture=texture;texture.colorSpace=T.SRGBColorSpace;
   texture.minFilter=T.LinearMipmapLinearFilter;
   this.material.map=texture;this.material.needsUpdate=true;this.state='ready';
  }).catch(()=>{if(this.state==='pending')this.state='failed';});
 }
 begin(){this.mesh.count=0;}
 add(tree:ImportedTree,eye:{x:number;z:number}){
  if(!this.ready||this.mesh.count>=this.profile.capacity||!this.profile.shapes.includes(tree.shape))return false;
  this.dummy.position.set(tree.x,(tree.y??.12)+tree.height*(this.profile.height/2-this.profile.basePad),tree.z);
  this.dummy.rotation.y=Math.atan2(eye.x-tree.x,eye.z-tree.z);
  this.dummy.scale.set(tree.crown*this.profile.width,tree.height*this.profile.height,1);
  this.dummy.updateMatrix();
  const i=this.mesh.count++;
  this.mesh.setMatrixAt(i,this.dummy.matrix);
  this.color.setScalar(.88+((Math.abs(tree.seed)%7)/7)*.12);
  this.mesh.setColorAt(i,this.color);
  return true;
 }
 end(){
  if(!this.mesh.count)return;
  for(const [attr,components] of [[this.mesh.instanceMatrix,16],[this.mesh.instanceColor,3]] as const){
   if(attr){attr.clearUpdateRanges();attr.addUpdateRange(0,this.mesh.count*components);attr.needsUpdate=true;}
  }
 }
 dispose(){
  if(this.state==='disposed')return;
  this.state='disposed';this.mesh.removeFromParent();this.mesh.dispose();
  this.mesh.geometry.dispose();this.material.dispose();this.texture?.dispose();
 }
}

/** Preserve all potential nearby fallback shadow casters outside Battery. */
export const distanceTreeMinDistance=(shape:string,battery:boolean)=>!battery?65:
 shape==='upright'||shape==='column'?36:50;

// Each registered tree belongs to at most one profile. A scene without column
// trees does not allocate an unused instance buffer or request the cypress art.
export function distanceTreeProfiles(trees:readonly Pick<ImportedTree,'shape'>[]){
 const counts=new Map<string,number>();
 for(const tree of trees)counts.set(tree.shape,(counts.get(tree.shape)??0)+1);
 return [BROADLEAF,UPRIGHT,COLUMN].flatMap(profile=>{
  const capacity=Math.min(profile.capacity,profile.shapes.reduce((n,shape)=>n+(counts.get(shape)??0),0));
  return capacity?[new DistantBroadleafLayer(undefined,{...profile,capacity})]:[];
 });
}
