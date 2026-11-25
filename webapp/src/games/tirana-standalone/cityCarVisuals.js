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

// Civilian road fallback from 871f3c38 DriverInterior.ts and shared/driverView.mjs.
const ROAD_SEAT=Object.freeze({x:-.38,y:1.19,z:.08,width:1.85});
const STEERING_AXIS=new T.Vector3(0,.18,1).normalize();
const WORLD_UP=new T.Vector3(0,1,0);
export const cityDriverFov=aspect=>aspect<.8?78:68;

export function updateCityCabin(cabin,camera,car,baseY){
  // Legacy heading points down -Z; the standalone drives down +Z at yaw zero.
  const h=car.yaw+Math.PI,c=Math.cos(h),s=Math.sin(h);
  const eyeX=car.x+ROAD_SEAT.x*c+ROAD_SEAT.z*s;
  const eyeY=baseY+ROAD_SEAT.y,eyeZ=car.z-ROAD_SEAT.x*s+ROAD_SEAT.z*c;
  camera.position.set(eyeX,eyeY,eyeZ);
  camera.lookAt(eyeX-s,eyeY-.06,eyeZ-c);
  cabin.group.position.copy(camera.position);
  cabin.group.quaternion.setFromAxisAngle(WORLD_UP,h);
  const steer=Number.isFinite(car.steer)?T.MathUtils.clamp(car.steer,-1,1):0;
  cabin.wheel.quaternion.setFromAxisAngle(STEERING_AXIS,-steer*1.7);
  // Same needle travel as the original, normalized to this sedan's 11 m/s cap.
  const speed=Number.isFinite(car.speed)?Math.abs(car.speed):0;
  cabin.needle.rotation.z=2.2-Math.min(1,speed/11)*4.4;
}

export function buildCityCabin(){
  const group=new T.Group(),wheel=new T.Group(),needle=new T.Group();
  const material=(color,roughness=.8,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
  const charcoal=material(0x161a1d),trim=material(0x493d32,.45,.18);
  const metal=material(0x8a9096,.3,.65),black=material(0x080b0d),screen=material(0x233735,.4);
  const box=(name,w,h,d,x,y,z,m,parent=group)=>{
    const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);
    mesh.name=name;mesh.position.set(x,y,z);mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  const center=-ROAD_SEAT.x,width=ROAD_SEAT.width*.91;
  box('Basic dashboard',width,.24,.49,center,-.49,-.83,charcoal);
  box('Dashboard trim',width,.035,.04,center,-.48,-.54,trim);
  box('Centre console',.23,.45,.35,center+.12,-.66,-.65,charcoal);
  box('Instrument binnacle',.47,.2,.2,0,-.30,-.73,charcoal);
  box('Instrument glass',.42,.15,.014,0,-.28,-.619,black);
  box('Centre screen',.33,.19,.025,center+.12,-.32,-.56,screen);
  for(const side of [-1,1]){
    box('Door upper',.07,.18,.88,center+side*width*.51,-.52,-.03,charcoal);
    box('Air vent',.17,.07,.015,side<0?center-width*.41:center+width*.4,-.43,-.55,black);
  }
  wheel.position.set(0,-.4,-.39);group.add(wheel);
  wheel.add(new T.Mesh(new T.TorusGeometry(.215,.019,8,36),charcoal));
  for(const angle of [0,Math.PI*.7,-Math.PI*.7]){
    const spoke=box('Spoke',.025,.19,.025,-Math.sin(angle)*.09,Math.cos(angle)*.09,0,metal,wheel);
    spoke.rotation.z=angle;
  }
  const hub=new T.Mesh(new T.CylinderGeometry(.065,.065,.04,16),charcoal);
  hub.rotation.x=Math.PI/2;wheel.add(hub);
  needle.position.set(-.10,-.27,-.605);group.add(needle);
  box('Gauge needle',.007,.06,.007,0,.026,0,material(0xe9b259),needle);
  group.name='Historical authored road cabin';
  return {group,wheel,needle};
}
