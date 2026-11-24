import * as T from 'three';

// The frozen Kenney sedan uses authored road-wheel pivots. Keep axle spin and
// steering separate as in the historical prepareLegacyWheels implementation.
export function prepareSedanWheels(root){
  root.updateMatrixWorld(true);
  const tires=[];root.traverse(o=>{if(/^wheel-(front|back)-(left|right)$/.test(o.name))tires.push(o);});
  return tires.map(tire=>{
    const parent=tire.parent,yaw=new T.Group(),pivot=new T.Group();
    yaw.name='Steering-'+tire.name;yaw.position.copy(tire.position);parent.add(yaw);yaw.add(pivot);
    pivot.name='Rolling-'+tire.name;root.updateMatrixWorld(true);pivot.attach(tire);
    return {yaw,pivot,front:tire.name.startsWith('wheel-front')};
  });
}

// The old standalone used this style of authored basic cabin for a car GLB
// without cabin meshes. This is a neutral road sedan, not a manufacturer replica.
export function buildCityCabin(){
  const group=new T.Group(),wheel=new T.Group(),needle=new T.Group();
  const charcoal=new T.MeshStandardMaterial({color:0x161a1d,roughness:.8});
  const trim=new T.MeshStandardMaterial({color:0x493d32,roughness:.45,metalness:.18});
  const metal=new T.MeshStandardMaterial({color:0x8a9096,roughness:.3,metalness:.65});
  const black=new T.MeshStandardMaterial({color:0x080b0d,roughness:.8});
  const face=new T.MeshStandardMaterial({color:0x31535e,roughness:.65,emissive:0x13292f,emissiveIntensity:.38});
  const orange=new T.MeshStandardMaterial({color:0xe9b259,emissive:0xe9b259,emissiveIntensity:.22});
  const box=(name,w,h,d,x,y,z,mat,parent=group)=>{
    const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);mesh.name=name;mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  };
  box('Dash',1.74,.27,.54,.37,-.49,-.82,charcoal);
  box('Trim',1.74,.026,.04,.37,-.47,-.54,trim);
  box('Binnacle',.47,.2,.22,0,-.3,-.73,charcoal);
  box('Instrument glass',.41,.15,.014,0,-.28,-.61,face);
  box('Center screen',.33,.175,.026,.51,-.34,-.535,face);
  box('Center console',.24,.43,.36,.51,-.65,-.647,charcoal);
  for(const i of [-1,1]){
    box('Door upper',.075,.18,.88,.37+i*.89,-.52,-.03,charcoal);
    box('Vent',.16,.055,.016,.37+i*.69,-.415,-.54,black);
  }
  wheel.position.set(0,-.39,-.49);group.add(wheel);
  const rim=new T.Mesh(new T.TorusGeometry(.174,.019,10,36),charcoal);wheel.add(rim);
  for(const angle of [0,Math.PI*.7,-Math.PI*.7]){
    const spoke=box('Spoke',.026,.17,.023,-Math.sin(angle)*.085,Math.cos(angle)*.085,0,metal,wheel);spoke.rotation.z=angle;
  }
  const hub=new T.Mesh(new T.CylinderGeometry(.059,.059,.035,20),charcoal);hub.rotation.x=Math.PI/2;wheel.add(hub);
  needle.position.set(-.089,-.284,-.6);group.add(needle);
  box('Gauge needle',.007,.061,.007,0,.026,0,orange,needle);
  group.name='Historic-style civilian sedan cabin';
  return {group,wheel,needle};
}
