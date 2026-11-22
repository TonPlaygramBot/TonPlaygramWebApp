import * as T from 'three';
const mat=(color,metalness=.18)=>new T.MeshStandardMaterial({color,roughness:.51,metalness});
function shape(parent,geo,material,x,y,z){const m=new T.Mesh(geo,material);m.position.set(x,y,z);parent.add(m);return m;}
export const ROTOR_NAMES=Object.freeze(['Rotor_FL','Rotor_FR','Rotor_RL','Rotor_RR']);
export async function loadRescueDrone(loader){
  const {scene:drone}=await loader.loadAsync('./assets/civil-survey-drone.glb');
  const rotors=ROTOR_NAMES.map(name=>drone.getObjectByName(name));
  if(rotors.some(x=>!x||![-1,1].includes(x.userData.spinDirection))||new Set(rotors).size!==4)throw Error('Animacioni i modelit të dronit mungon.');
  return {drone,rotors};
}
export function makeServiceVan(target){
  const van=new T.Group(),orange=mat(0xe57522),dark=mat(0x22313b),glass=mat(0x7d9eae,.45),light=new T.MeshStandardMaterial({color:0xffdc7c,emissive:0xff981f,emissiveIntensity:1.15});
  van.position.set(target.x,0,target.z);van.rotation.y=.55;
  shape(van,new T.BoxGeometry(2.01,.98,4.28),orange,0,.79,0);
  shape(van,new T.BoxGeometry(1.96,.87,2.46),orange,0,1.67,-.63);
  shape(van,new T.BoxGeometry(1.86,.64,1.19),glass,0,1.51,1.1);
  shape(van,new T.BoxGeometry(1.63,.18,.87),orange,0,1.89,1.1);
  shape(van,new T.BoxGeometry(.75,.11,.25),light,0,2.16,.04);
  for(const x of [-.84,.84])for(const z of [-1.36,1.4]){
    const tire=shape(van,new T.CylinderGeometry(.42,.42,.29,16),dark,x,.44,z);tire.rotation.z=Math.PI/2;
    const hub=shape(van,new T.CylinderGeometry(.22,.22,.32,14),mat(0x8f9aa5),x,.44,z);hub.rotation.z=Math.PI/2;
  }
  for(const side of [-1,1])shape(van,new T.BoxGeometry(.018,.2,1.55),mat(0xfff6d8),side*1.015,1.12,-.56);
  return van;
}
