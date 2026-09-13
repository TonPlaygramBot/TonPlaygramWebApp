import * as T from 'three';
import {addFxSphere} from './ludoFxGeometry';
import {createLudoBlenderModel} from './ludoBlenderMeshes';
/** Ludo's authored +X nose and five exhaust lobes, shared with Tirana aircraft. */
export const LUDO_MISSILE_TRAIL=Object.freeze(Array.from({length:5},(_,i)=>Object.freeze({
 radius:.12+i*.03,x:-.84-i*.19,color:i<2?'#f6af4b':'#8f989d',roughness:i<2?.2:1,opacity:i<2?.8-i*.15:.26-(i-2)*.04
})));
export function createLudoMissileFx({withTrail=true}={}) {
 const root=new T.Group();root.userData.lockCaptureTexture=true;root.add(createLudoBlenderModel('missile'));
 const trail:T.Mesh[]=[];
 if(withTrail)for(const lobe of LUDO_MISSILE_TRAIL){
  const sphere=addFxSphere(root,lobe.radius,[lobe.x,0,0],lobe.color,lobe.roughness,0,true,lobe.opacity);
  trail.push(sphere);
 }
 root.visible=false;return {root,trail};
}

export const LUDO_IMPACT_DURATION=.92;
export function createLudoExplosionFx(){
 const root=new T.Group(),flash=addFxSphere(root,.28,[0,.25,0],'#ffe29f',.05,0,true,1);
 const fire:T.Mesh<T.SphereGeometry,T.MeshStandardMaterial>[]=[],smoke:T.Mesh<T.SphereGeometry,T.MeshStandardMaterial>[]=[];
 const colors=['#ffd166','#ff8c1a','#ff4d3d','#d7263d','#ff8fab','#ffe45e'];
 for(let i=0;i<6;i++)fire.push(addFxSphere(root,.21+i*.05,[0,.2+i*.045,0],colors[i],.2,0,true,.98-i*.1));
 for(let i=0;i<6;i++)smoke.push(addFxSphere(root,.17+i*.037,[0,.165+i*.067,0],'#646b72',1,0,true,.34-i*.035));
 root.scale.setScalar(.27);root.visible=false;return {root,flash,fire,smoke};
}
export function updateLudoExplosionFx(explosion:ReturnType<typeof createLudoExplosionFx>,age:number){
 explosion.root.visible=age>=0&&age<=LUDO_IMPACT_DURATION;if(!explosion.root.visible)return;
 const clamp=T.MathUtils.clamp,fireLife=clamp(1-age/.88,0,1),smokeLife=clamp(1-age/LUDO_IMPACT_DURATION,0,1);
 explosion.flash.scale.setScalar(.54+age*1.25);explosion.flash.material.opacity=clamp(fireLife*1.08,0,1);
 explosion.fire.forEach((mesh,i)=>{const angle=age*5+i*1.35;
  mesh.position.set(Math.cos(angle)*(.05+age*.11),.09+age*.21+i*.026,Math.sin(angle)*(.05+age*.1));
  mesh.scale.setScalar((.9+age*1.75)*(.78+i*.13));mesh.material.opacity=clamp(fireLife*(1.02-i*.08),0,1);
 });
 explosion.smoke.forEach((mesh,i)=>{const angle=i*1.1+age*1.8;
  mesh.position.set(Math.cos(angle)*(.05+i*.018),.12+age*(.16+i*.036),Math.sin(angle)*(.05+i*.018));
  mesh.scale.setScalar((.82+age*.95)*(.66+i*.12));mesh.material.opacity=smokeLife*(.45-i*.04);
 });
}
