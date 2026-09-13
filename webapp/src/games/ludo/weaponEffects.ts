import * as THREE from 'three';
import { createCaliberProjectileFx, type FirearmBallistics } from '../../utils/ludoFirearmPresentation';
import { isThrownWeapon, makeWeaponFallback, weaponSpec } from './weaponModels';
import { V } from './characterContact';
export function createLudoProjectile(id:string, profile:FirearmBallistics) {
  const root=isThrownWeapon(id)?makeWeaponFallback(id):createCaliberProjectileFx(profile);
  if(isThrownWeapon(id))root.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.isMesh)mesh.material=Array.isArray(mesh.material)?mesh.material.map(material=>material.clone()):mesh.material.clone();});
  if(weaponSpec(id).kind==='rocket')for(let i=0;i<4;i++){
    const fin=new THREE.Mesh(new THREE.BoxGeometry(profile.bulletRadius*3,profile.bulletLength*.24,profile.bulletRadius*.22),new THREE.MeshStandardMaterial({color:'#535f43',roughness:.55}));
    fin.position.y=-profile.bulletLength*.4;fin.rotation.y=i*Math.PI/2;root.add(fin);
  }
  root.visible=false;return root;
}
export function createLudoImpact(id:string) {
  const kind=weaponSpec(id).impact,root=new THREE.Group();root.visible=false;
  const particles:THREE.Mesh[]=[],count=kind==='bullet'?8:16;
  for(let i=0;i<count;i++){
    const smoke=i>=count*.5;
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(smoke?.018:.009,8,6),new THREE.MeshBasicMaterial({color:smoke?'#747570':kind==='fire'?'#f48d32':'#ffd18a',transparent:true,opacity:1,depthWrite:false}));
    root.add(mesh);particles.push(mesh);
  }
  const ring=new THREE.Mesh(new THREE.RingGeometry(.025,.035,32),new THREE.MeshBasicMaterial({color:kind==='fire'?'#f39845':'#dbb879',transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;root.add(ring);
  return {root,update(t:number){
    const u=THREE.MathUtils.clamp(t,0,1);root.visible=t>=0&&u<1;
    const radius=kind==='bullet'?.05:kind==='fire'?.12:.18;
    particles.forEach((particle,i)=>{
      const angle=i*2.399,smoke=i>=count*.5,spread=radius*(.3+u*.7);
      particle.position.set(Math.cos(angle)*spread,.009+Math.sin(Math.PI*u)*radius*(smoke?1.4:.6),Math.sin(angle)*spread);
      particle.scale.setScalar(smoke?.8+u*3:.6+Math.sin(Math.PI*u)*2);
      (particle.material as THREE.MeshBasicMaterial).opacity=(1-u)*(smoke?.35:.85);
    });
    ring.scale.setScalar(1+u*(kind==='bullet'?1:5));(ring.material as THREE.MeshBasicMaterial).opacity=(1-u)*.55;
  },dispose(){disposeEffect(root);}};
}
export function disposeEffect(root:THREE.Object3D) {
  root.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;mesh.geometry.dispose();for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])mat.dispose();});root.removeFromParent();
}
export function sampleCasing(origin:THREE.Vector3,velocity:THREE.Vector3,ageSeconds:number,floorY:number) {
  const landing=(velocity.y+Math.sqrt(velocity.y*velocity.y+7.2*Math.max(0,origin.y-floorY)))/3.6;
  const t=Math.min(Math.max(0,ageSeconds),landing),position=origin.clone().addScaledVector(velocity,t);position.y=ageSeconds>=landing?floorY:Math.max(floorY,position.y-1.8*t*t);return position;
}
export function projectileFlightPoint(start:THREE.Vector3,end:THREE.Vector3,t:number,thrown:boolean) {
  const position=start.clone().lerp(end,t);if(thrown)position.y+=Math.sin(Math.PI*t)*Math.min(.35,start.distanceTo(end)*.26);return position;
}
