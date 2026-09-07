import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {disposeTree} from './WorldEnhancements';
/** Same shipped Adobe/Mixamo GLB used by Tirana Streets/Chess. Preserve its
 * embedded PBR maps and license; never ship this model as a standalone pack. */
export const EXISTING_HUMAN_URL='/assets/tirana-streets/living/human.glb';
export class ExistingHumans {
 readonly group=new T.Group();readonly errors:string[]=[];private mixers:T.AnimationMixer[]=[];
 readonly loadedIds=new Set<string>();
 private disposed=false;private source?:T.Group;readonly ready:Promise<void>;
 constructor(contacts:{id:string;x:number;z:number;y?:number}[]){
  this.group.name='Tirana:existing-glTF-career-contacts';
  this.ready=new GLTFLoader().loadAsync(EXISTING_HUMAN_URL).then(gltf=>{
   if(this.disposed){disposeTree(gltf.scene);return;}
   this.source=gltf.scene;
   const bounds=new T.Box3().setFromObject(gltf.scene),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
   if(!(size.y>.1))throw Error('Existing human GLB has invalid height');
   const scale=1.76/size.y;
   for(const contact of contacts){
    const root=new T.Group(),human=clone(gltf.scene);root.name=`contact:${contact.id}`;root.position.set(contact.x,contact.y||0,contact.z);
    human.scale.setScalar(scale);human.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
    human.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});root.add(human);this.group.add(root);this.loadedIds.add(contact.id);
    const mixer=new T.AnimationMixer(human),idle=gltf.animations.find(a=>/idle/i.test(a.name));if(idle)mixer.clipAction(idle).play();this.mixers.push(mixer);
   }
  }).catch(e=>{this.errors.push(`Existing human model failed: ${String(e)}`);});
 }
 update(dt:number,player:T.Vector3){
  this.group.children.forEach((o,i)=>{const d=Math.hypot(o.position.x-player.x,o.position.z-player.z);o.visible=d<180;if(d<60)this.mixers[i]?.update(dt);if(d<12)o.rotation.y=Math.atan2(player.x-o.position.x,player.z-o.position.z);});
 }
 dispose(){this.disposed=true;this.mixers.forEach(m=>{m.stopAllAction();m.uncacheRoot(m.getRoot());});this.group.traverse(o=>{if(o instanceof T.SkinnedMesh)o.skeleton.dispose();});this.group.removeFromParent();this.group.clear();this.loadedIds.clear();if(this.source)disposeTree(this.source);}
}
