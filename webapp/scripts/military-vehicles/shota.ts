import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const V=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);
export function createShota(){
 const root=new T.Group(); root.name='SHOTA_4x4'; root.userData={description:'Exterior estimated from public SHOTA references. Interior is a custom van-style layout. Not factory CAD.',units:'metres',forward:'+Z'};
 const mats:Record<string,T.MeshStandardMaterial>={};
 const mat=(name:string,color:number,roughness=.75,metalness=.1)=>{const m=new T.MeshStandardMaterial({color,roughness,metalness});m.name=name;mats[name]=m;return m;};
 const paint=mat('paint',0x666b4f,.78,.16), edge=mat('paint_dark',0x4c513e,.75,.22), rubber=mat('rubber',0x151a1a,.97), metal=mat('metal',0x63706c,.46,.8), black=mat('cabin',0x23292a,.85), fabric=mat('fabric',0x414843,.98), glass=mat('glass',0x607a7b,.13,.2), lamp=mat('headlamp',0xeee6bf,.2,.2), red=mat('tail_light',0xa31813,.25), amber=mat('indicator',0xd48420,.3), bolt=mat('bolts',0x798177,.43,.7), dash=mat('gauge',0x96c6ad,.36);
 glass.transparent=true;glass.opacity=.43;glass.depthWrite=false;glass.side=T.DoubleSide;
 lamp.emissive.set(0xffeac2);lamp.emissiveIntensity=.35;dash.emissive.set(0x619677);dash.emissiveIntensity=.5;
 const shell=new T.Group();shell.name='Body';root.add(shell);
 function mesh(g:T.BufferGeometry,m:T.Material,p:T.Vector3,parent:T.Object3D=shell,name=''){const o=new T.Mesh(g,m);o.position.copy(p);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
 function box(name:string,p:number[],s:number[],m:T.Material=paint,parent:T.Object3D=shell){return mesh(new T.BoxGeometry(...s as [number,number,number]),m,V(...p as [number,number,number]),parent,name);}
 function cyl(name:string,p:number[],r:number,depth:number,m:T.Material=metal,parent:T.Object3D=shell){return mesh(new T.CylinderGeometry(r,r,depth,16),m,V(...p as [number,number,number]),parent,name);}
 function bar(name:string,a:number[],b:number[],r:number,m:T.Material=metal,parent:T.Object3D=shell){const A=V(...a as [number,number,number]),B=V(...b as [number,number,number]);const o=mesh(new T.CylinderGeometry(r,r,A.distanceTo(B),10),m,A.clone().add(B).multiplyScalar(.5),parent,name);o.quaternion.setFromUnitVectors(V(0,1,0),B.sub(A).normalize());return o;}
 function plate(name:string,points:number[][],m:T.Material=paint,parent:T.Object3D=shell){const ar:number[]=[];const uv:number[]=[];for(let i=1;i<points.length-1;i++){for(const j of [0,i,i+1]){ar.push(...points[j]);uv.push(points[j][0]+points[j][2],points[j][1]);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(ar,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();const o=mesh(g,m,V(0,0,0),parent,name);(m as T.MeshStandardMaterial).side=T.DoubleSide;return o;}
 function side(name:string,x:number,pts:number[][],m:T.Material=paint,parent:T.Object3D=shell){const shape=new T.Shape();pts.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:false});geo.rotateY(-Math.PI/2);return mesh(geo,m,V(x,0,0),parent,name);}
 // Separate hollow body panels preserve the functional cabin.
 box('Frame',[0,.73,0],[1.3,.22,5.2],black);for(const x of [-.66,.66])box('Chassis rail',[x,.64,0],[.16,.24,5.4],black);
 box('Cabin floor',[0,1.02,-.73],[2.04,.14,3.96],edge);
 plate('Underbody left',[[-1.02,1,-2.65],[0,.55,-2.65],[0,.55,1.15],[-1.02,1,1.15]],edge);
 plate('Underbody right',[[1.02,1,-2.65],[0,.55,-2.65],[0,.55,1.15],[1.02,1,1.15]],edge);
 // Engine nose, taper and bonnet.
 box('Engine compartment',[0,1.42,1.94],[1.74,.61,1.57],paint);
 plate('Bonnet',[[-.92,1.69,2.9],[.92,1.69,2.9],[.97,2.02,1.65],[-.97,2.02,1.65]],paint);
 for(const x of [-1,1]){
  plate('Bonnet cheek',[[x*.92,1.69,2.9],[x*.97,2.02,1.65],[x*1.05,1.32,1.65],[x*.97,1.29,2.9]],paint);
  bar('Bonnet edge',[x*.92,1.695,2.88],[x*.97,2.025,1.65],.013,edge);
  for(const z of [1.35,2.47])box('Bonnet latch',[x*.975,1.63,z],[.05,.16,.065],black);
 }
 // Signature SHOTA faceted nose cage with horizontal grille and slit lights.
 plate('Front upper cage',[[-1.18,1.89,2.68],[1.18,1.89,2.68],[1.11,1.47,3.10],[-1.11,1.47,3.10]],paint);
 for(const x of [-1,1]){
  plate('Outer diagonal armour',[[x*1.18,1.90,2.68],[x*1.40,1.61,2.85],[x*1.25,.70,3.13],[x*.99,.72,3.20],[x*1.08,1.42,3.13]],paint);
  plate('Lower bevel',[[x*1.25,.70,3.13],[x*.99,.72,3.20],[x*.58,.63,3.27],[x*.58,.85,3.22]],edge);
  box('Lower lateral grille',[x*.84,1.10,3.12],[.34,.35,.04],black);
  for(let i=0;i<3;i++)box('Lower louver',[x*.84,.99+i*.10,3.158],[.32,.038,.045],edge);
  box('Headlight recess',[x*.85,1.57,3.06],[.38,.13,.02],black);
  box('Slit headlight',[x*.85,1.60,3.086],[.32,.047,.024],lamp);
  box('Indicator',[x*.85,1.52,3.095],[.28,.019,.016],amber);
 }
 plate('Central lower nose',[[-.54,.62,3.29],[.54,.62,3.29],[.63,1.43,3.15],[-.63,1.43,3.15]],paint);
 box('Lower radiator',[0,1.00,3.24],[.77,.53,.045],black);
 for(let i=0;i<5;i++)box('Centre lower louver',[0,.81+i*.086,3.272],[.75,.035,.035],edge);
 box('Upper grille backing',[0,1.78,2.817],[1.04,.17,.025],black).rotation.x=-.73;
 for(let i=0;i<3;i++)box('Upper horizontal grille',[0,1.72+i*.060,2.89-i*.062],[1.05,.026,.041],edge);
 for(const x of [-.38,0,.38])bar('Upper grille rib',[x,1.69,2.96],[x,1.90,2.70],.016,paint);
 box('Nose nameplate',[0,1.53,3.08],[1.02,.12,.034],paint).rotation.x=-.6;
 box('Winch housing',[0,.72,3.33],[.44,.20,.12],black);
 for(const x of [-.15,0,.15])bar('Winch roller',[x,.65,3.41],[x,.81,3.41],.032,metal);
 bar('Tow loop',[-.16,.57,3.39],[.16,.57,3.39],.031,metal);
 for(const x of [-.6,.6])box('Roof work light',[x,2.93,.61],[.22,.13,.12],black);
 // Split windshield, sloping A pillars, slab roof.
 const bottomZ=1.68,topZ=.67,bottomY=2.00,topY=2.8;
 for(const s of [-1,1]){
  plate('Windscreen glass',[[s*.07,bottomY+.07,bottomZ-.028],[s*.95,bottomY+.07,bottomZ-.028],[s*.9,topY-.07,topZ+.03],[s*.07,topY-.07,topZ+.03]],glass);
  bar('A pillar',[s*1.025,bottomY,bottomZ],[s*.97,topY,topZ],.058,paint);
  bar('Windscreen wiper',[s*.18,2.07,1.107],[s*.76,2.20,1.04],.014,black);
  bar('Wiper arm',[s*.52,2.09,1.107],[s*.54,2.32,.99],.012,black);
 }
 bar('Windscreen divider',[0,bottomY,bottomZ],[0,topY,topZ],.038,paint);
 bar('Lower screen surround',[-1.02,bottomY,bottomZ],[1.02,bottomY,bottomZ],.057,paint);
 bar('Upper screen surround',[-.99,topY,topZ],[.99,topY,topZ],.055,paint);
 box('Roof',[0,2.815,-.93],[2.01,.12,3.27],paint);
 // Side wall outline, windows individually framed with roof rail and B/C pillars.
 for(const s of [-1,1]){
  const x=s*1.015;
  side('Lower side armour',x,[[1.68,1.06],[-2.61,1.06],[-2.61,1.91],[1.68,2.00]],paint);
  side('Upper rear corner',x,[[-2.61,1.85],[-2.37,1.85],[-2.37,2.79],[-2.61,2.79]],paint);
  side('Roof edge',x,[[.67,2.8],[-2.61,2.8],[-2.61,2.64],[.75,2.64]],paint);
  side('Forward door pillar',x,[[1.68,1.93],[1.50,1.95],[.56,2.68],[.67,2.8]],paint);
  side('Troop lower shoulder',x,[[-.48,1.9],[-2.61,1.9],[-2.61,2.25],[-.48,2.25]],paint);
  side('Troop upper rail',x,[[-.48,2.62],[-2.61,2.62],[-2.61,2.8],[-.48,2.8]],paint);
  box('Door B pillar',[x,2.31,-.46],[.075,.91,.15],paint);
  const driverWindow=[[1.43,2.035],[-.34,2.035],[-.34,2.61],[.61,2.61]];
  side('Driver side glass',x+s*.025,driverWindow,glass);
  for(let j=0;j<4;j++){const a=driverWindow[j],b=driverWindow[(j+1)%4];bar('Side window frame',[x+s*.04,a[1],a[0]],[x+s*.04,b[1],b[0]],.036,edge);}
  for(let i=0;i<3;i++){
   const z=-.84-i*.67;
   box('Troop window pillar',[x,2.445,z+.33],[.075,.42,.10],paint);
   side('Troop glass',x+s*.01,[[z+.265,2.27],[z-.265,2.27],[z-.265,2.60],[z+.265,2.60]],glass);
   for(let j=0;j<4;j++)box('Window louver',[x+s*.055,2.30+j*.087,z],[.072,.032,.55],edge);
   box('Square recess surround',[x+s*.023,2.09,z],[.032,.115,.12],edge);
   box('Square recess',[x+s*.046,2.09,z],[.021,.074,.065],black);
  }
  for(const z of [-.46,1.45])bar('Door seam',[x+s*.022,1.2,z],[x+s*.022,1.94,z],.007,black);
  bar('Door seam lower',[x+s*.023,1.2,1.45],[x+s*.023,1.2,-.46],.007,black);
  box('Door handle base',[x+s*.046,1.84,-.19],[.035,.11,.23],edge);
  bar('Door handle',[x+s*.075,1.855,-.28],[x+s*.075,1.855,-.11],.02,metal);
  for(const y of [1.34,1.83])box('Door hinge',[x+s*.06,y,1.42],[.13,.12,.10],metal);
  // Running boards and climbing rungs.
  box('Step tread',[s*1.16,.91,.55],[.35,.09,1.43],edge);
  for(const z of [.08,1.12])bar('Step support',[s*.85,.91,z],[s*1.29,.91,z],.027,metal);
  bar('Mirror support',[x,2.32,.76],[s*1.39,2.32,.98],.028,edge);
  box('Mirror housing',[s*1.43,2.30,.98],[.13,.35,.24],black);
  box('Mirror glass',[s*1.43,2.30,.848],[.10,.29,.012],metal);
  for(let iz=0;iz<12;iz++)for(const y of [1.14,1.92,2.73]){
   const o=cyl('Armour bolt',[x+s*.049,y,-2.42+iz*.30],.017,.014,bolt);o.rotation.z=Math.PI/2;
  }
  box('Lower entry step',[s*1.16,.48,.45],[.36,.065,.64],metal);
  for(const z of [.14,.76])bar('Entry step strut',[s*1.14,.88,z],[s*1.22,.49,z],.028,edge);
  box('Side marker',[s*1.06,1.49,2.5],[.025,.07,.13],amber);
 }
 // Rear ramp/door with small observation glass.
 box('Rear wall',[0,1.62,-2.625],[2.01,1.14,.075],paint);
 box('Rear window sill',[0,2.20,-2.625],[2.01,.18,.075],paint);
 box('Rear upper',[0,2.72,-2.625],[2.01,.22,.075],paint);
 for(const x of [-.76,.76])box('Rear pillar',[x,2.46,-2.625],[.5,.38,.075],paint);

 box('Rear glass',[0,2.43,-2.686],[.86,.25,.018],glass);
 box('Rear bumper',[0,.91,-2.86],[2.25,.22,.20],edge);
 for(const s of [-1,1]){box('Rear tail lamp',[s*.88,1.35,-2.69],[.17,.24,.06],red);box('Rear indicator',[s*.88,1.53,-2.69],[.17,.075,.06],amber);}


 const hatch=cyl('Roof hatch',[0,2.94,-.24],.49,.09,edge);for(const x of [-.28,.28])bar('Hatch grab handle',[x,3.01,-.35],[x,3.01,-.1],.025,metal);
 cyl('Antenna mount',[.82,2.97,-2.22],.065,.16,black);bar('Antenna',[.82,3.03,-2.22],[.86,3.87,-2.20],.012,black);
 // Polygonal roof shield, purely visual, with viewing ports.
 const shield=new T.Group();shield.name='Roof_shield';shell.add(shield);
 cyl('Shield base',[0,3.02,-.16],.59,.16,edge,shield);
 const sides=6;
 for(let i=0;i<sides;i++){
  const a=i*Math.PI*2/sides,b=(i+1)*Math.PI*2/sides;
  const x1=Math.cos(a)*.64,z1=-.16+Math.sin(a)*.64,x2=Math.cos(b)*.64,z2=-.16+Math.sin(b)*.64;
  const midX=(x1+x2)/2,midZ=(z1+z2)/2;
  plate('Shield lower panel',[[x1,3.04,z1],[x2,3.04,z2],[x2,3.28,z2],[x1,3.28,z1]],paint,shield);
  plate('Shield upper edge',[[x1,3.50,z1],[x2,3.50,z2],[x2,3.61,z2],[x1,3.61,z1]],paint,shield);
  for(const k of [0,1]){const t=k===0?0:.76,u=k===0?.24:1;plate('Shield port frame',[[x1+(x2-x1)*t,3.28,z1+(z2-z1)*t],[x1+(x2-x1)*u,3.28,z1+(z2-z1)*u],[x1+(x2-x1)*u,3.5,z1+(z2-z1)*u],[x1+(x2-x1)*t,3.5,z1+(z2-z1)*t]],paint,shield);}
  plate('Shield observation glass',[[x1+(x2-x1)*.24,3.28,z1+(z2-z1)*.24],[x1+(x2-x1)*.76,3.28,z1+(z2-z1)*.76],[x1+(x2-x1)*.76,3.5,z1+(z2-z1)*.76],[x1+(x2-x1)*.24,3.5,z1+(z2-z1)*.24]],glass,shield);
 }
 // Van-style individual high-back seats with headrests and belts.
 const interior=new T.Group();interior.name='Interior';root.add(interior);
 for(const z of [.05,-1.04,-2.03])for(const x of [-.54,.54]){
  const g=new T.Group();g.name=z===.05?(x>0?'Driver_seat':'Passenger_seat'):'Van_seat';interior.add(g);
  box('Seat pedestal',[x,1.21,z],[.39,.30,.43],black,g);
  box('Seat cushion',[x,1.44,z],[.68,.18,.67],fabric,g);
  const back=box('Seat back',[x,1.85,z-.27],[.64,.82,.16],fabric,g);back.rotation.x=-.08;
  box('Headrest',[x,2.33,z-.31],[.41,.25,.15],fabric,g);
  for(const dx of [-.12,.12])bar('Headrest post',[x+dx,2.2,z-.30],[x+dx,2.26,z-.30],.015,metal,g);
  for(const dx of [-.31,.31])box('Seat bolster',[x+dx,1.75,z-.23],[.075,.64,.22],edge,g);
  bar('Safety belt',[x-.24,2.21,z-.168],[x+.25,1.49,z+.1],.018,black,g);
  box('Belt buckle',[x+.3,1.56,z+.05],[.055,.075,.07],red,g);
 }
 box('Dashboard',[0,1.81,.76],[1.88,.33,.37],black,interior);
 box('Centre console',[0,1.53,.45],[.34,.74,.49],black,interior);
 box('Dashboard centre display',[0,1.91,.552],[.26,.13,.016],dash,interior);
 for(const x of [.65,.42]){
  const d=cyl('Instrument dial',[x,1.92,.539],.086,.02,black,interior);d.rotation.x=Math.PI/2;
  bar('Instrument needle',[x,1.92,.523],[x+.034,1.96,.523],.006,dash,interior);
 }
 for(const x of [-.82,.29,.76])box('Air vent',[x,1.85,.541],[.15,.09,.02],edge,interior);
 const steering=new T.Group();steering.name='Steering_wheel';steering.position.set(.54,1.89,.46);steering.rotation.x=-.4;interior.add(steering);
 mesh(new T.TorusGeometry(.21,.019,8,32),black,V(0,0,0),steering,'Steering rim');cyl('Steering hub',[0,0,0],.054,.07,black,steering).rotation.x=Math.PI/2;
 for(let i=0;i<3;i++){const a=i*Math.PI*2/3;bar('Steering spoke',[0,0,0],[Math.sin(a)*.2,Math.cos(a)*.2,0],.014,metal,steering);}
 bar('Steering column',[.54,1.82,.48],[.54,1.74,.7],.035,black,interior);
 bar('Gear selector',[.07,1.65,.3],[.07,1.89,.29],.018,metal,interior);box('Gear knob',[.07,1.9,.29],[.065,.075,.07],black,interior);
 for(const x of [.66,.47])box('Pedal',[x,1.21,.65],[.1,.03,.15],black,interior);
 // Wheels are articulated under independent steering pivots, local X axle.
 const wheels:T.Group[]=[];
 function wheel(name:string,x:number,z:number,spare=false){
  const pivot=new T.Group();pivot.name=name+'_steer';pivot.position.set(x,.65,z);root.add(pivot);
  const w=new T.Group();w.name=name; pivot.add(w);wheels.push(w);
  const tire=mesh(new T.TorusGeometry(.455,.155,12,40),rubber,V(0,0,0),w,'All terrain tire');tire.rotation.y=Math.PI/2;
  const hub=cyl('Wheel rim',[0,0,0],.332,.30,edge,w);hub.rotation.z=Math.PI/2;
  for(const s of [-1,1]){
   const rim=cyl('Rim face',[s*.177,0,0],.295,.03,metal,w);rim.rotation.z=Math.PI/2;
   const cap=cyl('Wheel hub',[s*.208,0,0],.12,.09,edge,w);cap.rotation.z=Math.PI/2;
   for(let j=0;j<8;j++){const a=j*Math.PI/4;const c=cyl('Lug bolt',[s*.224,Math.cos(a)*.17,Math.sin(a)*.17],.026,.033,bolt,w);c.rotation.z=Math.PI/2;}
   for(let j=0;j<8;j++){const a=(j+.5)*Math.PI/4;const c=cyl('Rim vent',[s*.198,Math.cos(a)*.245,Math.sin(a)*.245],.037,.007,black,w);c.rotation.z=Math.PI/2;}
  }
  for(let j=0;j<42;j++)for(const s of [-1,1]){const a=j*Math.PI*2/42;const lug=box('Tread block',[s*.083,Math.cos(a)*.593,Math.sin(a)*.593],[.158,.044,.068],rubber,w);lug.rotation.x=a;lug.rotation.y=s*.24;}
  if(spare){pivot.position.set(x,1.14,-.78);}
  return pivot;
 }
 for(const x of [-1.08,1.08])for(const z of [1.98,-1.78]){
  wheel((z>0?'Front':'Rear')+(x>0?'_left':'_right'),x,z);
  // Angular arch strips with a clear wheel opening, mud flaps.
  const s=Math.sign(x);
  for(let j=0;j<8;j++){const a=.05+j*Math.PI/8,b=.05+(j+1)*Math.PI/8;const p=[[z+Math.cos(a)*.69,.65+Math.sin(a)*.69],[z+Math.cos(b)*.69,.65+Math.sin(b)*.69],[z+Math.cos(b)*.82,.65+Math.sin(b)*.82],[z+Math.cos(a)*.82,.65+Math.sin(a)*.82]];side('Fender',s*1.31,p,paint);plate('Fender top',[[s*.93,p[2][1],p[2][0]],[s*1.33,p[2][1],p[2][0]],[s*1.33,p[3][1],p[3][0]],[s*.93,p[3][1],p[3][0]]],paint);}
  box('Mud flap',[s*1.1,.62,z-.72],[.37,.57,.028],rubber);
 }
 for(const z of [1.98,-1.78]){bar('Axle',[-1.07,.65,z],[1.07,.65,z],.068,black);cyl('Differential',[0,.65,z],.17,.24,black).rotation.z=Math.PI/2;for(const x of [-.65,.65])for(let i=0;i<3;i++)box('Leaf spring',[x,.70+i*.025,z],[.07,.018,1.02-i*.15],metal);}
 wheel('Spare_left',1.27,0,true);wheel('Spare_right',-1.27,0,true);
 // Batch each static component by material; retain semantic moving groups.
 function batch(group:T.Group){const collected=new Map<T.Material,T.BufferGeometry[]>();const rm:T.Object3D[]=[];group.updateMatrixWorld(true);for(const child of [...group.children]){if(child instanceof T.Mesh){const g=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();g.applyMatrix4(child.matrix);let a=collected.get(child.material as T.Material);if(!a)collected.set(child.material as T.Material,a=[]);a.push(g);rm.push(child);}else if(child instanceof T.Group)batch(child);}
  for(const child of rm)group.remove(child);for(const [m,gs]of collected){const g=mergeGeometries(gs,false);if(g)mesh(g,m,V(0,0,0),group,(m as T.MeshStandardMaterial).name+'_batch');for(const x of gs)x.dispose();}}
 batch(root);return root;
}
