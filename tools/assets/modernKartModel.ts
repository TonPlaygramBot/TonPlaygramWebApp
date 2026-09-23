import * as T from '../../webapp/node_modules/three/build/three.module.js';
import { RoundedBoxGeometry } from '../../webapp/node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from '../../webapp/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';

// Original models inspired by real competition/rental construction. Coordinates
// retain the game's existing +Z nose, wheelbase, seat and animation sockets.
export const KART_DESIGNS = [
  {id:'apex',name:'Apex Sprint',family:'sprint',paint:'#c9282c',accent:'#f3eee1',number:'07'},
  {id:'oobi',name:'Eagle Shifter',family:'shifter',paint:'#1854af',accent:'#c5df46',number:'12'},
  {id:'oodi',name:'Illyrian Drift',family:'drift',paint:'#7138aa',accent:'#f6e6d0',number:'23'},
  {id:'ooli',name:'Besa Endurance',family:'endurance',paint:'#24735b',accent:'#f0e6c9',number:'35'},
  {id:'oopi',name:'Dajti Cross',family:'cross',paint:'#e96c20',accent:'#e9e0c9',number:'44'},
  {id:'photon',name:'Photon GT',family:'electric',paint:'#24b6cf',accent:'#e8eee8',number:'60'},
  {id:'vortex',name:'Vortex R',family:'electric-sport',paint:'#903d98',accent:'#eadbc5',number:'81'},
  {id:'aegis',name:'Aegis XR',family:'electric-endurance',paint:'#d2a339',accent:'#e3e9df',number:'95'}
] as const;

export function buildModernKart(id:string,low=false) {
  const spec=KART_DESIGNS.find(s=>s.id===id);if(!spec)throw new Error('Unknown kart '+id);
  const electric=spec.family.startsWith('electric'),cross=spec.family==='cross';
  const enclosed=electric||spec.family==='endurance',shifter=spec.family==='shifter';
  const raised=cross?.10:0,radius=cross?.31:.235;
  const root=new T.Group();root.name=spec.name;
  const body=new T.Group();body.name='body';root.add(body);
  const features=new Set<string>();
  const mat=(name:string,color:string,metalness=0,roughness=.45)=>new T.MeshStandardMaterial({name,color,metalness,roughness});
  const paint=mat('paint',spec.paint,.24,.3),accent=mat('Livery ivory',spec.accent,.1,.34);
  const rubber=mat('Slick vulcanised rubber','#22252a',0,.94),trim=mat('Moulded bumper polymer','#252c32',0,.72);
  const carbon=mat('Satin composite','#30373e',.08,.57),alloy=mat('Brushed alloy','#aeb3b4',.82,.28);
  const magnesium=mat('Magnesium wheel centres','#958466',.72,.35),steel=mat('Steel fasteners','#697178',.9,.3);
  const seat=mat('Seat fabric','#242a31',0,.96),tank=mat('Fuel reservoir','#d8cdb0',0,.47);
  const glass=mat('Display glass','#122f38',.35,.22),red=mat('brake_light','#951d22',.05,.25);
  red.emissive.set('#e92420');red.emissiveIntensity=.35;
  const led=mat('energy','#c8e7df',.1,.24);led.emissive.set('#93cbc5');led.emissiveIntensity=.32;
  const cable=mat('Insulated power cable','#cc5829',0,.65);
  const vec=(p:number[])=>new T.Vector3(...p as [number,number,number]);
  function mesh(name:string,geometry:T.BufferGeometry,material:T.Material,parent:T.Object3D=body,p=[0,0,0]) {
    const m=new T.Mesh(geometry,material);m.name=name;m.position.set(...p as [number,number,number]);parent.add(m);features.add(name);return m;
  }
  function box(name:string,p:number[],size:number[],material:T.Material,parent:T.Object3D=body,bevel=.02) {
    const rounded=bevel>.014&&Math.min(...size)>=.06;
    const geometry=rounded?new RoundedBoxGeometry(size[0],size[1],size[2],1,Math.min(bevel,Math.min(...size)*.42)):new T.BoxGeometry(size[0],size[1],size[2]);
    return mesh(name,geometry,material,parent,p);
  }
  function tube(name:string,a:number[],b:number[],r:number,material:T.Material,parent:T.Object3D=body,segments=low?8:14) {
    const from=vec(a),to=vec(b),delta=to.clone().sub(from);
    const m=mesh(name,new T.CylinderGeometry(r,r,delta.length(),segments),material,parent,from.add(to).multiplyScalar(.5).toArray());
    m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return m;
  }
  function path(name:string,points:number[][],r:number,material:T.Material,parent:T.Object3D=body) {
    const perimeter=name==='Perimeter impact belt';
    const segments=perimeter?48:Math.min(low?48:96,Math.max(low?8:16,points.length*(low?2:4)));
    return mesh(name,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(vec),false,'centripetal'),segments,r,perimeter?8:low?6:10,false),material,parent);
  }
  function socket(name:string,p:number[],parent:T.Object3D=body) {
    const group=new T.Group();group.name=name;group.position.copy(vec(p));parent.add(group);return group;
  }
  // A lofted moulding with a rounded rectangular cross section. Stations are
  // z, half-width, bottom, top, optional x centre. Curved plan/section replaces
  // the old box-wedge nose while keeping feet and steering hardware visible.
  function fairing(name:string,stations:number[][],material:T.Material,parent:T.Object3D=body) {
    const verts:number[]=[],indices:number[]=[],uv:number[]=[];
    const section=[[-.75,0],[.75,0],[1,.20],[1,.68],[.79,1],[-.79,1],[-1,.68],[-1,.20]];
    stations.forEach(([z,w,lo,hi,x=0],i)=>section.forEach(([sx,sy],j)=>{verts.push(x+sx*w,lo+(hi-lo)*sy,z);uv.push(j/8,i/(stations.length-1));}));
    for(let i=0;i<stations.length-1;i++)for(let j=0;j<8;j++){const a=i*8+j,b=i*8+(j+1)%8,c=(i+1)*8+j,d=(i+1)*8+(j+1)%8;indices.push(a,b,c,b,d,c);}
    for(let j=1;j<7;j++){indices.push(0,j+1,j);const end=(stations.length-1)*8;indices.push(end,end+j,end+j+1);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    return mesh(name,g,material,parent);
  }
  // Exposed frame has real bent tube paths and crossmembers, not a solid slab.
  for(const sign of [-1,1]) {
    path('Bent chassis rail',[[sign*.50,.18+raised,-1.06],[sign*.47,.17+raised,-.45],[sign*.40,.16+raised,.38],[sign*.55,.19+raised,.87]],.025,paint);
    tube('Seat stay',[sign*.42,.18+raised,-.66],[sign*.25,.68+raised,-.56],.018,steel);
    tube('Front kingpin bracket',[sign*.42,.20+raised,.78],[sign*.79,radius,.78],.025,alloy);
  }
  for(const z of [-.93,-.42,.43,.79])tube('Welded frame crossmember',[-.47,.18+raised,z],[.47,.18+raised,z],.024,paint);
  box('Pressed floor tray',[0,.167+raised,.27],[.90,.032,1.30],carbon,body,.01);
  if(!low)for(let i=0;i<7;i++)box('Floor anti slip ribs',[0,.187+raised,.15+i*.09],[.80,.009,.016],trim,body,.003);

  // The broad low front bumper curves back at the ends, as on modern CIK karts.
  const front=socket('front_fairing',[0,raised,0]);
  const sections=[];
  for(let i=0;i<=(low?12:28);i++){
    const x=-.91+1.82*i/(low?12:28),curve=Math.pow(Math.abs(x)/.91,2);
    sections.push([x,.14,.39-.025*curve,1.28-.18*curve]);
  }
  // Build a transverse loft using the same moulded section, then rotate it.
  const bumper=fairing('Sculpted front bumper',sections.map(([x,lo,hi,z])=>[x,.105,lo,hi,z]),enclosed?trim:accent,front);
  bumper.rotation.y=-Math.PI/2;
  for(const sign of [-1,1]) {
    const stripe=box('Front bumper livery',[sign*.52,.30,1.22],[.58,.16,.015],paint,front,.009);stripe.rotation.y=sign*.13;
    tube('Front bumper mounting tube',[sign*.51,.22,.87],[sign*.51,.22,1.17],.022,steel,front);
  }
  // Each family has its own body profile while retaining the same collision footprint.
  const noseTop=cross?.53:spec.family==='electric-sport'?.54:enclosed?.59:.56;
  fairing('Nassau nose fairing',[[.31,.13,.44+raised,noseTop+raised],[.44,.11,.37+raised,.49+raised],[.70,.085,.29+raised,.40+raised],[.98,.16,.25+raised,.32+raised],[1.12,.14,.23+raised,.275+raised]],paint);
  fairing('Nose stripe',[[.32,.09,noseTop+raised+.004,noseTop+raised+.013],[.45,.10,.487+raised,.497+raised],[.71,.075,.40+raised,.41+raised],[.99,.046,.32+raised,.33+raised]],accent);
  for(const sign of [-1,1]) {
    const x=sign*(enclosed?.68:.66),w=enclosed?.205:.18;
    fairing('Moulded sidepod',[[-.91,w*.66,.19+raised,.38+raised,x],[-.72,w,.17+raised,(enclosed?.51:.40)+raised,x],[.15,w,.17+raised,.39+raised,x],[.39,w*.76,.19+raised,.32+raised,x]],paint);
    const stripe=box('Sidepod graphic',[x+sign*(w+.004),.31+raised,-.23],[.009,.085,1.00],accent,body,.003);stripe.rotation.x=-.03;
    if(!low)for(let i=0;i<5;i++)box('Sidepod grille',[x,.403+raised,-.34+i*.075],[.18,.013,.025],carbon,body,.005);
    tube('Sidepod support',[sign*.45,.19+raised,-.38],[sign*.73,.19+raised,-.38],.025,steel);
  }
  // Seat shell has open bowl, bolsters and a curved reclined back.
  box('Seat bowl',[0,.34+raised,-.28],[.49,.09,.54],carbon,body,.06);
  box('Seat cushion',[0,.396+raised,-.25],[.40,.052,.40],seat,body,.04);
  const back=box('Reclined seat shell',[0,.68+raised,-.56],[.50,.66,.075],carbon,body,.045);back.rotation.x=-.16;
  const backPad=box('Seat back pad',[0,.67+raised,-.51],[.39,.52,.028],seat,body,.025);backPad.rotation.x=-.16;
  for(const sign of [-1,1]) {
    fairing('Seat side bolster',[[-.58,.06,.35+raised,.74+raised,sign*.22],[-.30,.046,.34+raised,.47+raised,sign*.235],[.01,.03,.34+raised,.41+raised,sign*.22]],carbon);
    tube('Pedal hinge',[sign*.24,.22+raised,.68],[sign*.12,.22+raised,.68],.014,steel);
    const pedalPivot=socket(sign>0?'pedal_brake':'pedal_throttle',[sign*.176,.22+raised,.72]);
    const pedal=box('Adjustable alloy pedal',[0,.035,.08],[.135,.14,.025],alloy,pedalPivot,.012);pedal.rotation.x=-.30;
    if(!low)for(const y of [-.01,.025,.06])box('Pedal grip pad',[0,y,.064],[.10,.009,.012],trim,pedalPivot,.002);
    tube('Pedal return linkage',[sign*.176,.23+raised,.73],[sign*.28,.20+raised,.43],.007,steel);
  }
  tube('Steering column',[0,.19+raised,.49],[0,.70+raised,.16],.018,steel);
  const wheel=socket('steering_wheel',[0,.70+raised,.16]);
  path('Steering wheel grip',[[-.17,0,0],[-.15,.11,0],[0,.16,0],[.15,.11,0],[.17,0,0],[.11,-.12,0],[-.11,-.12,0],[-.17,0,0]],.024,trim,wheel);
  for(const p of [[-.15,0,0],[.15,0,0],[0,-.12,0]])tube('Wheel spoke',[0,0,0],p,.016,alloy,wheel);
  box('Steering wheel hub',[0,0,.006],[.12,.075,.04],carbon,wheel,.012);
  box('Lap timer',[0,.068,.03],[.105,.042,.028],glass,wheel,.008);
  if(electric){for(const sign of [-1,1])box('Thumb switch',[sign*.11,0,.025],[.02,.018,.012],sign<0?red:led,wheel,.003);}

  tube('Live rear axle',[-.87,radius,-.78],[.87,radius,-.78],.022,steel);
  for(const x of [-.42,.42])box('Axle bearing carrier',[x,radius,-.78],[.08,.095,.10],alloy,body,.017);
  // Rear axle brake and chain sprocket are separate readable components.
  tube('Rear brake disc',[-.30,radius,-.78],[-.285,radius,-.78],.125,alloy);
  box('Rear brake caliper',[-.31,radius+.09,-.72],[.09,.07,.08],paint,body,.012);
  if(!electric) {
    box('Central fuel reservoir',[0,.28+raised,.10],[.25,.20,.34],tank,body,.07);
    tube('Fuel filler cap',[0,.38+raised,.10],[0,.41+raised,.10],.048,trim);
    box('Engine crankcase',[-.41,.35+raised,-.69],[.30,.24,.35],alloy,body,.06);
    for(let i=0;i<(low?4:8);i++)box('Cylinder cooling fin',[-.43,.48+raised+i*.021,-.72],[.24,.011,.26],alloy,body,.004);
    box('Cylinder head',[-.43,.665+raised,-.72],[.23,.06,.25],steel,body,.025);
    tube('Spark plug',[-.43,.69+raised,-.72],[-.43,.73+raised,-.72],.023,carbon);
    box('Intake airbox',[-.47,.39+raised,-.33],[.26,.17,.29],trim,body,.05);
    for(const x of [-.53,-.43])tube('Intake trumpet',[x,.40+raised,-.24],[x,.40+raised,-.13],.036,carbon);
    path('Expansion exhaust',[[-.50,.49+raised,-.87],[-.49,.55+raised,-1.03],[-.16,.55+raised,-1.07],[.17,.50+raised,-1.04],[.34,.43+raised,-.97]],.055,steel);
    tube('Exhaust silencer',[.36,.43+raised,-.92],[.36,.43+raised,-1.18],.073,alloy);
    tube('Exhaust outlet',[.36,.43+raised,-1.18],[.36,.43+raised,-1.23],.035,trim);
    tube('Chain sprocket',[-.22,radius,-.78],[-.205,radius,-.78],.11,magnesium);
    path('Guarded drive chain',[[-.23,.34,-.52],[-.23,.35,-.78],[-.23,.16,-.85],[-.23,.20,-.51],[-.23,.34,-.52]],.012,steel);
    box('Chain guard',[-.235,.38+raised,-.64],[.085,.022,.41],carbon,body,.01);
  } else {
    for(const sign of [-1,1]) {
      box('Battery module',[sign*.42,.31,-.29],[.24,.23,.87],carbon,body,.035);
      box('Battery heat spreader',[sign*.42,.435,-.33],[.23,.012,.67],alloy,body,.005);
      if(!low)for(let i=0;i<6;i++)box('Battery cooling rib',[sign*.42,.445,-.61+i*.10],[.22,.018,.015],steel,body,.003);
    }
    tube('Electric motor',[-.27,.36,-.98],[.22,.36,-.98],.125,alloy);
    tube('Motor end cap',[.22,.36,-.98],[.25,.36,-.98],.119,carbon);
    box('Power inverter',[.36,.50,-.77],[.24,.11,.27],carbon,body,.025);
    path('Orange power cable',[[.37,.53,-.68],[.30,.57,-.91],[.20,.49,-1.00]],.016,cable);
    fairing('Rear battery bodywork',[[-1.17,.45,.26,.49],[-.99,.46,.26,.53],[-.82,.36,.28,.48]],paint);
    box('Rear brake light',[0,.465,-1.182],[.32,.033,.017],red,body,.006);
    for(const sign of [-1,1])box('Front running light',[sign*.48,.34,1.285],[.30,.025,.018],led,body,.006);
  }
  // Broad, flat slick tread and rounded sidewalls; front tyres are narrower.
  for(const [front,z] of [[true,.78],[false,-.78]] as const)for(const sign of [-1,1]) {
    const suffix=(front?'f':'r')+(sign>0?'l':'r'),x=sign*.80,width=front?.25:.36;
    const steer=front?socket('steer_'+suffix,[x,radius,z]):body;
    const wheel=socket('wheel_'+suffix,front?[0,0,0]:[x,radius,z],steer);
    const profile=[[-.5,.57],[-.5,.82],[-.43,.96],[-.30,1],[.30,1],[.43,.96],[.5,.82],[.5,.57],[-.5,.57]];
    const tyre=new T.LatheGeometry(profile.map(([w,r])=>new T.Vector2(r*radius,w*width)),low?20:40);tyre.rotateZ(Math.PI/2);
    mesh(cross?'Cross terrain tyre':'Slick tyre',tyre,rubber,wheel);
    const rimProfile=[[-.49,.58],[-.47,.64],[-.40,.64],[-.38,.56],[.38,.56],[.40,.64],[.47,.64],[.49,.58],[-.49,.58]];
    const rim=new T.LatheGeometry(rimProfile.map(([w,r])=>new T.Vector2(r*radius,w*width)),low?16:32);rim.rotateZ(Math.PI/2);mesh('Dished rim barrel',rim,alloy,wheel);
    tube('Wheel hub',[-width*.50,0,0],[width*.50,0,0],.050,magnesium,wheel);
    for(const face of [-1,1])for(let i=0;i<(low?3:6);i++) {
      const angle=i*Math.PI*2/(low?3:6),y=Math.cos(angle),z=Math.sin(angle),end=radius*.56;
      tube('Cast rim spoke',[face*width*.35,y*.042,z*.042],[face*width*.44,y*end,z*end],low?.018:.014,magnesium,wheel,6);
      if(!low&&i%2===0)tube('Wheel nut',[face*width*.50,y*.063,z*.063],[face*width*.55,y*.063,z*.063],.013,steel,wheel,6);
    }
    if(cross)for(let i=0;i<(low?12:22);i++) {
      const a=i*Math.PI*2/(low?12:22);
      const tread=box('Terrain tread',[0,Math.cos(a)*radius*.98,Math.sin(a)*radius*.98],[width*.91,.038,.070],rubber,wheel,.008);tread.rotation.x=a;
    }
    if(front) {
      path('Steering tie rod',[[sign*.15,.22+raised,.53],[sign*.40,.23+raised,.63],[x*.96,radius-.05,.72]],.010,steel);
      if(shifter) {
        tube('Front brake disc',[-sign*.10,0,0],[-sign*.085,0,0],.117,alloy,steer);
        box('Front brake caliper',[-sign*.09,.07,-.06],[.07,.075,.08],paint,steer,.011);
      }
    }
  }
  if(shifter) {
    const rad=socket('radiator',[.38,0,-.64]);
    const panel=box('Tall radiator',[0,.64,0],[.30,.55,.08],alloy,rad,.02);panel.rotation.x=-.10;
    if(!low)for(let i=0;i<12;i++)box('Radiator fin',[-.133+i*.024,.64,.046],[.007,.49,.008],carbon,rad,.002);
    path('Coolant hose',[[.37,.89,-.63],[.10,.88,-.69],[-.41,.63,-.77]],.017,trim);
    tube('Gear lever',[-.27,.30,-.02],[-.30,.64,.06],.012,steel);box('Gear knob',[-.30,.66,.06],[.052,.075,.052],trim,body,.02);
  }
  if(enclosed) {
    const belt=[[-.96,.25,-.94],[-.99,.25,.47],[-.87,.25,1.16],[-.48,.25,1.31],[.48,.25,1.31],[.87,.25,1.16],[.99,.25,.47],[.96,.25,-.94],[.59,.25,-1.25],[-.59,.25,-1.25],[-.96,.25,-.94]];
    path('Perimeter impact belt',belt,.067,trim);
    for(const sign of [-1,1])box('Seat adjustment runner',[sign*.18,.275,-.35],[.032,.035,.73],steel,body,.01);
    if(spec.family==='endurance') {
      fairing('Covered engine pod',[[-1.15,.45,.27,.58],[-.90,.44,.27,.72],[-.65,.34,.30,.68]],paint);
      for(const sign of [-1,1])box('Amber endurance lamp',[sign*.51,.35,1.278],[.21,.045,.02],led,body,.009);
    }
  } else {
    path('Rear protective bumper',[[-.88,.28+raised,-.95],[-.79,.28+raised,-1.21],[0,.28+raised,-1.26],[.79,.28+raised,-1.21],[.88,.28+raised,-.95]],.045,trim);
  }
  if(spec.family==='drift'||spec.family==='electric-sport') {
    const diffuser=socket('aero_wing',[0,.20,-1.14]);
    box('Low rear diffuser',[0,0,0],[1.02,.040,.28],carbon,diffuser,.01);
    for(const x of [-.42,-.21,0,.21,.42])box('Diffuser strake',[x,-.02,0],[.014,.065,.25],carbon,diffuser,.004);
  }
  if(cross||spec.family==='electric-endurance') {
    const h=cross?1.35:1.16;
    path('Rounded roll hoop',[[-.40,.33+raised,-.61],[-.40,h-.1,-.68],[-.30,h,-.68],[.30,h,-.68],[.40,h-.1,-.68],[.40,.33+raised,-.61]],.026,steel);
    for(const sign of [-1,1])tube('Rear hoop brace',[sign*.39,h-.2,-.67],[sign*.49,.26+raised,-1.14],.020,steel);
  }
  if(cross)for(const sign of [-1,1])for(const z of [-.78,.78]) {
    tube('Cross suspension arm',[sign*.36,.30,z],[sign*.73,.28,z],.025,alloy);
    const a=vec([sign*.46,.47,z-.04]),b=vec([sign*.76,.28,z]);
    tube('Damper shaft',a.toArray(),b.toArray(),.018,alloy);
    const points=[];for(let i=0;i<=48;i++){const t=i/48,p=a.clone().lerp(b,t);p.y+=Math.sin(t*Math.PI*12)*.037;p.z+=Math.cos(t*Math.PI*12)*.037;points.push(p.toArray());}path('Coil spring',points,.007,paint);
  }
  if(spec.family==='electric-sport'||spec.family==='shifter') {
    const wing=socket('rear_spoiler',[0,.88+raised,-1.03]);
    box('Sculpted aero blade',[0,0,0],[.94,.045,.21],carbon,wing,.019);
    for(const sign of [-1,1]) {
      box('Aero end plate',[sign*.46,.025,0],[.018,.13,.24],paint,wing,.008);
      tube('Spoiler support',[sign*.30,.24,-.96],[sign*.30,.87+raised,-1.03],.012,steel);
    }
  }
  if(cross) {
    box('Trail skid plate',[0,.11,.83],[.82,.026,.36],alloy,body,.01);
    for(const sign of [-1,1])box('Trail front mudguard',[sign*.80,.66,.79],[.31,.025,.55],trim,body,.01);
  }
  if(spec.family==='electric'||spec.family==='electric-endurance') {
    for(const sign of [-1,1])fairing('Sculpted battery cooling duct',[[.27,.11,.38,.48,sign*.61],[.06,.12,.36,.46,sign*.63],[-.15,.11,.33,.40,sign*.64]],carbon);
  }
  if(!low) {
    for(const sign of [-1,1]) {
      path('Brake hydraulic hose',[[sign*.18,.21,.70],[sign*.40,.20,.10],[sign*.36,.22,-.70]],.005,trim);
      for(const z of [-.65,.12,.83])tube('Chassis bolt',[sign*.42,.185+raised,z],[sign*.42,.203+raised,z],.009,steel,body,6);
    }
  }
  // Painted race numbers are original flat geometry, requiring no texture or
  // per-kart image download. The plate sits on the upper nose facing forwards.
  const plate=socket('race_number',[0,noseTop-.003+raised,.335]);plate.rotation.x=-.69;
  box('Number plate',[0,0,0],[.225,.136,.010],accent,plate,.013);
  const digitSegments=[['a','b','c','d','e','f'],['b','c'],['a','b','g','e','d'],['a','b','g','c','d'],['f','g','b','c'],['a','f','g','c','d'],['a','f','g','c','d','e'],['a','b','c'],['a','b','c','d','e','f','g'],['a','b','c','d','f','g']];
  const segments:Record<string,number[]>={a:[0,.047,.051,.011],g:[0,0,.051,.011],d:[0,-.047,.051,.011],b:[.027,.024,.010,.044],c:[.027,-.024,.010,.044],e:[-.027,-.024,.010,.044],f:[-.027,.024,.010,.044]};
  [...spec.number].forEach((n,j)=>{for(const key of digitSegments[Number(n)]){const [x,y,w,h]=segments[key];box('Race number',[x+(j-.5)*.085,y,.007],[w,h,.003],carbon,plate,.001);}});
  socket('driver_eye',[0,1.20+raised,-.28]);socket('driver_mount',[0,0,0]);socket('exhaust_mount',electric?[0,.34,-1.17]:[.36,.43+raised,-1.22]);

  // Batch static parts by material under their owning pivot. Keep steering,
  // wheels, seat sockets and diffuser independently articulatable.
  // These fittings are static: merge them into the chassis material batches.
  root.updateMatrixWorld(true);
  for(const name of ['radiator','race_number','rear_spoiler']){
    const group=root.getObjectByName(name);if(!group)continue;
    const parts:T.Mesh[]=[];group.traverse(o=>{if(o instanceof T.Mesh)parts.push(o);});
    for(const part of parts)body.attach(part);group.removeFromParent();
  }
  function batch(parent:T.Object3D) {
    for(const child of [...parent.children])if(!(child instanceof T.Mesh))batch(child);
    const groups=new Map<T.Material,T.Mesh[]>();
    for(const child of parent.children)if(child instanceof T.Mesh){const m=child.material as T.Material;if(!groups.has(m))groups.set(m,[]);groups.get(m)!.push(child);}
    for(const [material,meshes] of groups) {
      const geometries=meshes.map(m=>{m.updateMatrix();const g=(m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone()).applyMatrix4(m.matrix);if(!g.getAttribute('uv'))g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count*2),2));return g;});
      const merged=mergeGeometries(geometries,false)!;const compact=mergeVertices(merged,1e-5);merged.dispose();geometries.forEach(g=>g.dispose());
      for(const m of meshes){parent.remove(m);m.geometry.dispose();}
      const result=new T.Mesh(compact,material);result.name=material.name;parent.add(result);
    }
  }
  batch(body);root.updateMatrixWorld(true);
  root.userData={kartId:id,revision:'city-driver-v2',family:spec.family,features:[...features],wheelRadius:radius,units:'game metres',forward:'+Z',driverRaised:raised};
  return root;
}
