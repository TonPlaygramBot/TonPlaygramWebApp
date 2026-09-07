import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createRng, type Obstacle } from './core';
let rng=createRng(45192);
const material=(color:THREE.ColorRepresentation,roughness=.75,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
export type World = { obstacles:Obstacle[]; rain:THREE.LineSegments; rainData:Float32Array; extraction:THREE.Group; gun:THREE.Group; muzzle:THREE.Mesh; gunLight:THREE.PointLight; sky:THREE.Mesh; dispose:()=>void; update?:(position:THREE.Vector3)=>void };
function texture(kind:'concrete'|'road'|'metal'){
  const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d')!,data=ctx.createImageData(512,512);
  for(let i=0;i<data.data.length;i+=4){const n=rng(),v=kind==='road'?65+n*42:kind==='metal'?135+n*22:135+n*55;data.data[i]=v;data.data[i+1]=v;data.data[i+2]=v;data.data[i+3]=255;}ctx.putImageData(data,0,0);
  if(kind==='concrete'){
    for(let i=0;i<120;i++){ctx.fillStyle=`rgba(36,42,39,${rng()*.13})`;const x=rng()*512;ctx.fillRect(x,rng()*512,1+rng()*6,30+rng()*170);}
    ctx.strokeStyle='#777777';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,250);ctx.lineTo(512,250);ctx.stroke();
  }else if(kind==='road'){
    for(let i=0;i<35;i++){ctx.strokeStyle=`rgba(20,24,24,${rng()*.3})`;ctx.lineWidth=.6;ctx.beginPath();let x=rng()*512,y=rng()*512;ctx.moveTo(x,y);for(let j=0;j<5;j++){x+=rng()*40-20;y+=rng()*30;ctx.lineTo(x,y);}ctx.stroke();}
  }
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(kind==='road'?10:2,kind==='road'?14:2);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
function signTexture(text:string,bg:string,fg:string){
 const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d')!;ctx.fillStyle=bg;ctx.fillRect(0,0,1024,256);ctx.strokeStyle=fg;ctx.globalAlpha=.4;ctx.strokeRect(18,18,988,220);ctx.globalAlpha=1;ctx.fillStyle=fg;ctx.font='bold 90px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,134,940);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
export function makeWorld(scene:THREE.Scene,camera:THREE.PerspectiveCamera,renderer:THREE.WebGLRenderer, cityShell=true):World{
  rng=createRng(45192);
  const resources:{dispose:()=>void}[]=[];
  if(renderer instanceof THREE.WebGLRenderer){const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.06);scene.environment=env.texture;scene.environmentIntensity=.42;resources.push(env);room.dispose();pmrem.dispose();}
  scene.fog=new THREE.FogExp2('#819496',.0165);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(190,24,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color('#304750')},bottom:{value:new THREE.Color('#b8b7a6')}},vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 top;uniform vec3 bottom;varying vec3 v;void main(){float h=normalize(v).y;gl_FragColor=vec4(mix(bottom,top,smoothstep(-.05,.65,h)),1.);}'}));scene.add(sky);
  scene.add(new THREE.HemisphereLight('#bdd2dc','#414945',2.1));
  const sun=new THREE.DirectionalLight('#ffd6aa',3.0);sun.position.set(-28,35,-45);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-42;sun.shadow.camera.right=42;sun.shadow.camera.top=42;sun.shadow.camera.bottom=-42;sun.shadow.camera.near=1;sun.shadow.camera.far=130;sun.shadow.normalBias=.025;sun.shadow.bias=-.0002;sun.shadow.autoUpdate=false;sun.shadow.needsUpdate=true;scene.add(sun);sun.target.position.set(0,0,-8);scene.add(sun.target);
  const concreteMap=texture('concrete'),roadMap=texture('road'),metalMap=texture('metal');
  const mats={
    concrete:new THREE.MeshStandardMaterial({color:'#84908d',map:concreteMap,bumpMap:concreteMap,bumpScale:.035,roughness:.9}),
    cream:new THREE.MeshStandardMaterial({color:'#b7ad91',map:concreteMap,bumpMap:concreteMap,bumpScale:.03,roughness:.88}),
    dark:material('#273538'),trim:material('#757d76',.5,.3),black:material('#131e22',.4,.2),
    glass:material('#284754',.2,.7),warm:new THREE.MeshStandardMaterial({color:'#b8a275',emissive:'#e0a764',emissiveIntensity:.8,roughness:.4}),
    glow:new THREE.MeshBasicMaterial({color:'#ffd3a0'}),cyan:new THREE.MeshBasicMaterial({color:'#8cc2bd'}),
    road:new THREE.MeshStandardMaterial({color:'#697b7f',map:roadMap,bumpMap:roadMap,bumpScale:.028,metalness:.22,roughness:.37}),
    green:material('#53675c',.55,.35),rust:new THREE.MeshStandardMaterial({color:'#6e5545',map:metalMap,roughness:.65,metalness:.5}),
    orange:material('#ce7240'),white:material('#b0b8ad'),red:material('#754e3c'),rubber:material('#131a1b',.92),blue:material('#3c5862',.48,.4),
  };
  const batches=new Map<THREE.Material,THREE.Matrix4[]>();const boxGeo=new THREE.BoxGeometry(1,1,1);const dummy=new THREE.Object3D();const obstacles:Obstacle[]=[];
  function box(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material,rot=0){dummy.position.set(x,y,z);dummy.rotation.set(0,rot,0);dummy.scale.set(w,h,d);dummy.updateMatrix();if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push(dummy.matrix.clone());}
  function cylinder(x:number,y:number,z:number,r:number,h:number,m:THREE.Material,rz=0){const geo=new THREE.CylinderGeometry(r,r,h,10);const mesh=new THREE.Mesh(geo,m);mesh.position.set(x,y,z);mesh.rotation.z=rz;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);}
  function obstacle(x:number,z:number,w:number,h:number,d:number,m:THREE.Material){box(x,h/2,z,w,h,d,m);obstacles.push({x,z,w,d,h});}
  function sign(text:string,x:number,y:number,z:number,w:number,h:number,rot:number,bg='#1c2d30',fg='#e5c491'){
    const t=signTexture(text,bg,fg);const m=new THREE.MeshStandardMaterial({map:t,emissiveMap:t,emissive:'#ffffff',emissiveIntensity:.24,roughness:.45});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);mesh.position.set(x,y,z);mesh.rotation.y=rot;scene.add(mesh);
  }
  if (cityShell) {
  box(0,-.2,-5,160,.4,160,mats.road);
  for(const side of [-1,1]){
    box(side*14.8,.10,-5,4.1,.2,64,mats.concrete);box(side*12.72,.14,-5,.18,.28,64,mats.trim);
    for(let z=-32;z<26;z+=2){box(side*12.73,.30,z,.18,.045,1.05,z%4===0?mats.white:mats.dark);}
    for(let i=0;i<5;i++){
      const z=19-i*12.5,height=11+rng()*12,mat=i%2?mats.cream:mats.concrete,x=side*22.5;
      box(x,height/2,z,11,height,12,mats.dark);box(x-side*.05,height/2,z,10.9,height-.2,11.95,mat);
      box(x,height+.25,z,11.6,.5,12.6,mats.trim);box(x,height+.7,z,10,.9,10,mats.dark);
      for(let floor=1;floor<height/3;floor++){
        const y=floor*3;box(side*16.92,y-1.1,z,.32,.2,12.5,mats.trim);
        for(let col=-1;col<=1;col++){
          const zz=z+col*3.8;box(side*16.96,y,zz,.18,1.85,2.1,mats.black);box(side*16.83,y,zz,.16,1.62,1.88,rng()>.79?mats.warm:mats.glass);
          box(side*16.69,y,zz,.14,1.65,.075,mats.trim);box(side*16.70,y,zz,.14,.07,1.9,mats.trim);
          box(side*16.55,y-1.02,zz,.55,.15,2.45,mats.concrete);
          if(rng()>.48){box(side*16.45,y-.9,zz+1.30,.6,.58,.9,mats.trim);for(let j=0;j<4;j++)box(side*16.12,y-1.12+j*.1,zz+1.3,.03,.04,.7,mats.dark);}
        }
      }
      for(const col of [-1,1]){
        box(side*16.87,1.38,z+col*2.8,.2,2.6,4.5,mats.black);
        for(let j=0;j<15;j++)box(side*16.70,.2+j*.155,z+col*2.8,.06,.12,4.4,mats.trim);
      }
      box(side*16.0,3.25,z,2,.2,11,mats.green);box(side*15.02,3.08,z,.12,.38,11,mats.dark);
      const names=side===-1?['SOUTH BLOCK','MERCER & CO.','NORTH YARD','COLD STORAGE','HARBOR WORKS']:['AUTO SERVICE','RIVERSIDE','DISTRICT 09','CUSTOMS','WAREHOUSE'];
      sign(names[i],side*16.78,4.25,z,8,1.1,-side*Math.PI/2);
      for(let j=0;j<3;j++){box(x-3+j*3,height+1.15,z,.9,1.1,2,mats.trim);cylinder(x-3+j*3,height+2.2,z,.14,1.7,mats.dark);}
    }
    for(let z=-28;z<24;z+=16){
      cylinder(side*12.1,2.9,z,.07,5.8,mats.dark);box(side*11.4,5.76,z,1.55,.1,.12,mats.dark);box(side*10.8,5.64,z,.75,.09,.35,mats.glow);
      const light=new THREE.PointLight('#ffc393',12,11,2);light.position.set(side*10.8,5.2,z);if(z===4||z===-12)scene.add(light);
      // Warm streaks on the wet pavement.
      const sheen=new THREE.Mesh(new THREE.PlaneGeometry(1.15,5),new THREE.MeshBasicMaterial({color:'#daa676',transparent:true,opacity:.08,depthWrite:false}));sheen.rotation.x=-Math.PI/2;sheen.position.set(side*10.8,.012,z+1.5);scene.add(sheen);
    }
  }
  for(let z=-29;z<24;z+=6){box(-.17,.017,z,.1,.014,2.6,mats.white);box(.17,.017,z,.1,.014,2.6,mats.white);}
  for(let i=0;i<7;i++)box(-8+i*2.6,.019,14,1.3,.012,3.3,mats.white);
  for(let i=0;i<24;i++){const x=rng()*23-11.5,z=rng()*60-33;const puddle=new THREE.Mesh(new THREE.CircleGeometry(.5+rng()*1.4,18),new THREE.MeshPhysicalMaterial({color:'#536c75',roughness:.06,metalness:.55,transparent:true,opacity:.65,clearcoat:1}));puddle.rotation.x=-Math.PI/2;puddle.scale.y=.35+rng()*.7;puddle.position.set(x,.009,z);scene.add(puddle);}
  function barrier(x:number,z:number,rot=0){
    const w=rot?1.0:3.4,d=rot?3.4:1.0;obstacle(x,z,w,.95,d,mats.concrete);box(x,.18,z,w+.25,.34,d+.22,mats.concrete);box(x,.99,z,w*.9,.08,d*.7,mats.trim);
    for(let i=-1;i<=1;i++)box(x+(rot?0:i),.64,z+(rot?i:.515),rot?.515:.42,.23,rot?.42:.016,i%2?mats.orange:mats.black);
  }
  barrier(-4,9);barrier(7,1);barrier(-5,-18);barrier(6,-25);
  function container(x:number,z:number,color:THREE.Material){obstacle(x,z,3.2,2.55,7,color);box(x,2.61,z,3.35,.13,7.1,mats.trim);for(let i=0;i<20;i++){for(const side of [-1,1])box(x+side*1.62,1.32,z-3.3+i*.34,.075,2.5,.09,color);}box(x,.12,z,3.3,.22,7.1,mats.dark);for(const dx of [-1.35,0,1.35])box(x+dx,1.3,z+3.56,.055,2.4,.07,mats.trim);}
  container(-9,-5,mats.green);container(9,-13,mats.rust);
  sign('BW / 042',-9,1.7,-1.43,2.5,.6,0,'#3c5148','#b9c4ab');
  function car(x:number,z:number,mat:THREE.Material){
    obstacles.push({x,z,w:2.1,d:4.7,h:1.45});box(x,.60,z,2.05,.62,4.4,mat);box(x,1.08,z+.2,1.9,.53,2.4,mat);box(x,1.14,z-.48,1.75,.42,1.15,mats.glass);box(x,1.36,z+.25,1.8,.11,1.75,mat);box(x,1.08,z+1.1,1.73,.38,.15,mats.glass);box(x,.42,z-2.22,2.1,.23,.12,mats.dark);box(x,.45,z+2.22,2.1,.23,.12,mats.dark);
    for(const side of [-1,1]){for(const zz of [-1.42,1.38]){cylinder(x+side*1.02,.4,z+zz,.4,.22,mats.rubber,Math.PI/2);cylinder(x+side*1.15,.4,z+zz,.2,.03,mats.trim,Math.PI/2);}box(x+side*.75,.73,z-2.22,.40,.18,.05,mats.glow);box(x+side*.75,.69,z+2.24,.4,.17,.03,mats.red);box(x+side*1.06,1.0,z-.5,.19,.15,.27,mat);}
  }
  car(8,12,mats.blue);car(-9,-24,mats.black);
  for(const [x,z] of [[12,20],[-12,1],[12,-22],[-12,-16]]){obstacle(x,z,1.1,1.18,1.1,mats.green);box(x,1.24,z,1.2,.13,1.2,mats.dark);}
  for(const [x,z] of [[3,-10],[-3,-28],[11,6],[-13,14]]){cylinder(x,.4,z,.22,.8,mats.orange);box(x,.02,z,.6,.04,.6,mats.rubber);cylinder(x,.52,z,.227,.13,mats.white);}
  // End walls and industrial gate create an unmistakable playable boundary.
  box(0,3.1,-35,35,6.2,1,mats.concrete);box(0,2.6,-34.44,11,5,.12,mats.dark);for(let i=-5;i<=5;i++)box(i,2.5,-34.29,.07,4.8,.12,mats.trim);sign('NORTH GATE  /  09',0,5.45,-34.3,10,.9,0);
  box(0,2.7,25,35,5.4,1,mats.concrete);sign('SOUTH BLOCK',0,3.0,24.45,9,1,Math.PI);
  // Roofline beyond the arena.
  for(let i=0;i<30;i++){const x=rng()*160-80,z=-70-rng()*50,h=12+rng()*48;box(x,h/2,z,7+rng()*8,h,8+rng()*10,i%2?mats.dark:mats.concrete);}
  // Overhead utility wires.
  for(const z of [-20,1,21])for(let k=0;k<3;k++){const points=[];for(let i=0;i<=12;i++){const x=-17+i*34/12;points.push(new THREE.Vector3(x,10-1.1*Math.sin(i/12*Math.PI)+k*.13,z+k*.3));}scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#273d40'})));}
  for(const [mat,transforms] of batches){const mesh=new THREE.InstancedMesh(boxGeo,mat,transforms.length);transforms.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=mat!==mats.glow&&mat!==mats.cyan;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);}
  }
  resources.push(boxGeo, concreteMap, roadMap, metalMap, ...Object.values(mats));
  const rainData=new Float32Array(550*6);for(let i=0;i<550;i++){const x=rng()*54-27,y=rng()*22,z=rng()*70-40;rainData.set([x,y,z,x+.04,y+.38,z+.02],i*6);}
  const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainData,3).setUsage(THREE.DynamicDrawUsage));const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:'#c1d4d5',transparent:true,opacity:.19,depthWrite:false}));rain.frustumCulled=false;scene.add(rain);
  const extraction=new THREE.Group();extraction.position.set(0,.04,-29);const ring=new THREE.Mesh(new THREE.RingGeometry(2.3,2.4,48),new THREE.MeshBasicMaterial({color:'#a3e3b8',side:THREE.DoubleSide,transparent:true,opacity:.8}));ring.rotation.x=-Math.PI/2;extraction.add(ring);for(const x of [-2,2]){const stick=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,1.1,8),mats.cyan);stick.position.set(x,.55,0);extraction.add(stick);}extraction.visible=false;scene.add(extraction);
  const {gun,muzzle,gunLight}=makeGun();camera.add(gun);scene.add(camera);
  return {obstacles,rain,rainData,extraction,gun,muzzle,gunLight,sky,dispose:()=>{const geos=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line||o instanceof THREE.Points){geos.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});for(const m of materials){for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);m.dispose();}geos.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());resources.forEach(r=>r.dispose());}};
}
function makeGun(){
  const gun=new THREE.Group();const body=material('#293536',.4,.72),metal=material('#555b55',.35,.72),grip=material('#4b5043',.8,.12),black=material('#131b1b',.5,.5),skin=material('#6d6b53',.85),sleeve=material('#364341',.9);
  function box(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.frustumCulled=false;gun.add(mesh);return mesh;}
  function cyl(x:number,y:number,z:number,r:number,l:number,m:THREE.Material){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,l,12),m);mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);gun.add(mesh);return mesh;}
  box(0,0,0,.125,.145,.34,body);box(0,-.07,.04,.105,.10,.23,metal);box(0,.024,-.29,.104,.13,.36,grip);box(0,.10,-.14,.09,.026,.57,black);
  for(let i=0;i<15;i++)box(0,.12,.12-i*.041,.105,.022,.015,metal);
  for(let i=0;i<7;i++){box(.055,.015,-.15-i*.04,.009,.045,.021,black);box(-.055,.015,-.15-i*.04,.009,.045,.021,black);box(0,-.047,-.15-i*.04,.107,.017,.024,metal);}
  cyl(0,.025,-.55,.022,.22,metal);cyl(0,.025,-.70,.035,.10,black);for(let i=0;i<3;i++)cyl(0,.025,-.68-i*.027,.036,.01,metal);
  const mag=box(0,-.18,-.02,.078,.25,.12,grip);mag.rotation.x=-.12;for(let i=0;i<4;i++)box(.042,-.12-i*.035,-.02,.007,.012,.093,black);
  box(0,-.17,.17,.076,.2,.09,grip).rotation.x=-.3;box(0,0,.31,.095,.105,.27,body);box(0,-.035,.44,.1,.23,.07,grip);
  // Open reflex optic and a luminous aiming point.
  box(0,.142,-.085,.094,.035,.12,black);box(-.049,.19,-.085,.016,.085,.065,metal);box(.049,.19,-.085,.016,.085,.065,metal);box(0,.235,-.085,.11,.016,.065,metal);
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(.083,.069),new THREE.MeshBasicMaterial({color:'#90ddcc',transparent:true,opacity:.07,side:THREE.DoubleSide}));glass.position.set(0,.19,-.083);gun.add(glass);
  const dot=new THREE.Mesh(new THREE.SphereGeometry(.0025,6,4),new THREE.MeshBasicMaterial({color:'#ff624d'}));dot.position.set(0,.19,-.081);gun.add(dot);
  box(.068,.011,.053,.018,.039,.093,black);box(.074,-.035,.11,.027,.035,.024,metal);
  // Gloved hands and articulated forearms stay inside the camera's view model.
  const right=box(.024,-.16,.15,.125,.12,.14,skin);right.rotation.z=-.13;const forearm=box(.13,-.28,.32,.16,.17,.42,sleeve);forearm.rotation.set(-.35,-.25,-.3);
  const left=box(-.036,-.102,-.31,.137,.14,.14,skin);left.rotation.z=.2;const arm=box(-.20,-.21,-.1,.15,.18,.45,sleeve);arm.rotation.set(-.25,.66,.25);
  for(let i=0;i<3;i++)box(-.065,-.08-i*.026,-.32,.078,.014,.12,grip);
  gun.position.set(.25,-.26,-.52);gun.rotation.set(0,0,0);
  const muzzle=new THREE.Mesh(new THREE.OctahedronGeometry(.11,0),new THREE.MeshBasicMaterial({color:'#ffe7a3',transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));muzzle.position.set(0,.025,-.79);muzzle.scale.set(.8,.8,2.5);muzzle.visible=false;gun.add(muzzle);const gunLight=new THREE.PointLight('#ffc381',0,6);gunLight.position.copy(muzzle.position);gun.add(gunLight);
  return {gun,muzzle,gunLight};
}
export type ActorVisual={group:THREE.Group;legs:THREE.Group[];arms:THREE.Group[];flash:THREE.Mesh;materials:THREE.Material[]};
export function makeEnemy():ActorVisual{
  const group=new THREE.Group();const cloth=material('#50574c'),vest=material('#303a34',.85),gear=material('#777966',.6),dark=material('#1d292a',.45),visor=new THREE.MeshStandardMaterial({color:'#392e28',emissive:'#f06d44',emissiveIntensity:1.1,metalness:.4,roughness:.3});
  function box(parent:THREE.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
  function capsule(parent:THREE.Object3D,x:number,y:number,z:number,r:number,l:number,m:THREE.Material){const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(r,l,3,6),m);mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
  capsule(group,0,1.13,0,.26,.40,cloth);box(group,0,1.2,-.055,.55,.54,.33,vest);box(group,0,1.17,.22,.39,.52,.20,vest);
  for(const x of [-.15,0,.15])box(group,x,1.07,-.25,.12,.19,.1,gear);box(group,0,.84,0,.50,.10,.32,dark);
  capsule(group,0,1.71,0,.195,.12,dark);capsule(group,0,1.83,.015,.219,.04,cloth);box(group,0,1.75,-.185,.32,.10,.06,visor);box(group,0,1.64,-.19,.18,.1,.05,dark);
  const legs:THREE.Group[]=[],arms:THREE.Group[]=[];
  for(const side of [-1,1]){const leg=new THREE.Group();leg.position.set(side*.16,.85,0);capsule(leg,0,-.21,0,.12,.25,cloth);capsule(leg,0,-.57,.018,.10,.26,cloth);box(leg,0,-.72,-.07,.21,.14,.36,dark);box(leg,0,-.44,-.11,.18,.2,.10,gear);group.add(leg);legs.push(leg);
    const arm=new THREE.Group();arm.position.set(side*.31,1.4,0);capsule(arm,0,-.13,-.02,.10,.2,cloth);capsule(arm,side*-.03,-.3,-.20,.08,.24,cloth).rotation.x=1.0;box(arm,-side*.06,-.29,-.33,.12,.13,.14,gear);group.add(arm);arms.push(arm);}
  box(group,.14,1.12,-.38,.09,.13,.52,dark);box(group,.14,1.10,-.70,.04,.04,.18,dark);box(group,.14,1.20,-.39,.08,.09,.10,gear);
  const flash=new THREE.Mesh(new THREE.OctahedronGeometry(.12),new THREE.MeshBasicMaterial({color:'#ffd293',blending:THREE.AdditiveBlending}));flash.position.set(.14,1.11,-.84);flash.visible=false;group.add(flash);
  return{group,legs,arms,flash,materials:[cloth,vest,gear,dark,visor]};
}
