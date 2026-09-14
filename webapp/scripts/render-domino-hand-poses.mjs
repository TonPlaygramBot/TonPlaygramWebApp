/** Offline, depth-tested mesh snapshots of the production Domino hand poses. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as shared from '../src/pages/Games/shared/seatedHumanActors.js';

const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
// Freeze breathing so a before/after render differs only by the pose code.
Object.defineProperty(performance,'now',{configurable:true,value:()=>0});
const output = process.argv[2] || '/tmp/domino-hand-poses';
mkdirSync(output, {recursive:true});
const bytes = readFileSync(new URL('../public/assets/pool-royale/readyplayer.me.glb',import.meta.url));
const jsonLength=bytes.readUInt32LE(12), gltf=JSON.parse(bytes.subarray(20,20+jsonLength)), bin=bytes.subarray(28+jsonLength);
const arrayTypes={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5121:Uint8Array,5122:Int16Array,5120:Int8Array};
const itemSizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
function accessor(index) {
  const a=gltf.accessors[index], view=gltf.bufferViews[a.bufferView], Type=arrayTypes[a.componentType], size=itemSizes[a.type], result=new Type(a.count*size);
  const stride=view.byteStride || size*Type.BYTES_PER_ELEMENT, start=(view.byteOffset||0)+(a.byteOffset||0);
  for(let i=0;i<a.count;i++) for(let j=0;j<size;j++) { const p=start+i*stride+j*Type.BYTES_PER_ELEMENT; result[i*size+j]=a.componentType===5126?bin.readFloatLE(p):a.componentType===5125?bin.readUInt32LE(p):a.componentType===5123?bin.readUInt16LE(p):bin.readUInt8(p); }
  return new THREE.BufferAttribute(result,size,a.normalized||false);
}
function actualTemplate() {
  const jointIds=new Set(gltf.skins.flatMap(s=>s.joints));
  const nodes=gltf.nodes.map((n,i)=>{
    const o=jointIds.has(i)?new THREE.Bone():new THREE.Group();o.name=n.name||'';
    if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);
    return o;
  });
  gltf.nodes.forEach((n,i)=>(n.children||[]).forEach(child=>nodes[i].add(nodes[child])));
  const root=new THREE.Group();gltf.scenes[0].nodes.forEach(i=>root.add(nodes[i]));root.updateMatrixWorld(true);
  gltf.nodes.forEach((n,i)=>{
    if(n.mesh==null)return;
    const source=gltf.meshes[n.mesh];
    source.primitives.forEach(p=>{
      const g=new THREE.BufferGeometry();
      for(const [from,to]of [['POSITION','position'],['NORMAL','normal'],['JOINTS_0','skinIndex'],['WEIGHTS_0','skinWeight']])if(p.attributes[from]!=null)g.setAttribute(to,accessor(p.attributes[from]));
      if(p.indices!=null)g.setIndex(accessor(p.indices));
      const name=source.name||n.name||'', color=/Body|Head/.test(name)?0xc59476:/Eye|Teeth/.test(name)?0xdeddd2:/Top/.test(name)?0x526888:/Bottom/.test(name)?0x253948:0x493a2c;
      const material=new THREE.MeshStandardMaterial({color});
      const mesh=n.skin==null?new THREE.Mesh(g,material):new THREE.SkinnedMesh(g,material);mesh.name=name;
      nodes[i].add(mesh);
      if(n.skin!=null){const skin=gltf.skins[n.skin], matrices=accessor(skin.inverseBindMatrices).array;mesh.bind(new THREE.Skeleton(skin.joints.map(j=>nodes[j]),skin.joints.map((_,j)=>new THREE.Matrix4().fromArray(matrices,j*16))),new THREE.Matrix4());}
    });
  });
  root.updateMatrixWorld(true);const bounds=new THREE.Box3();root.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});
  root.position.set(-(bounds.min.x+bounds.max.x)/2,-bounds.min.y,-(bounds.min.z+bounds.max.z)/2);root.updateMatrixWorld(true);
  root.userData.seatedHumanScale=shared.computeSeatedHumanScale(root,1.13);return root;
}
const template=actualTemplate();
function makeActualDominoRig(seat){
  const radii=[3.39418125,2.55028125,3.12418125,2.55028125],angle=[Math.PI/2,0,Math.PI*1.5,Math.PI][seat],chair=new THREE.Group();
  chair.position.set(Math.cos(angle)*radii[seat],0,Math.sin(angle)*radii[seat]);chair.lookAt(0,0,0);chair.updateMatrixWorld(true);
  return {...shared.createRestoredSeatedHumanActor(template,chair,{targetHeight:1.13,seatHeight:.69017025}),chair};
}
const {parse}=createRequire(import.meta.url)('@babel/parser');
const {buildSync}=createRequire(import.meta.url)('esbuild');
const cameraBuild=buildSync({entryPoints:[fileURLToPath(new URL('./domino-royal-review-camera.ts',import.meta.url))],bundle:true,write:false,format:'esm',platform:'node',external:['three']});
const cameraSource=cameraBuild.outputFiles[0].text.replaceAll('from "three"',`from ${JSON.stringify(new URL('../node_modules/three/build/three.module.js',import.meta.url).href)}`);
const {fitDominoReviewCamera}=await import(`data:text/javascript;base64,${Buffer.from(cameraSource).toString('base64')}`);
const testUrl=new URL('../src/pages/Games/shared/seatedHumanActors.domino.test.js',import.meta.url),testSource=readFileSync(testUrl,'utf8');
const fn=parse(testSource,{sourceType:'module'}).program.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='makeProductionHandHarness');
const harnessSource=testSource.slice(fn.start,fn.end).replaceAll('import.meta.url',JSON.stringify(testUrl.href));
const c=vm.runInNewContext(`(${harnessSource})()`,{THREE,vm,readFileSync,createRequire,URL,makeActualDominoRig,...shared});
let randomSeed=703;c.Math=Object.create(Math);c.Math.random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};
const gameSource=readFileSync(new URL('../public/domino-royal-game.js',import.meta.url),'utf8');
const definitions=new Map();
for(const node of parse(gameSource,{sourceType:'module'}).program.body){
  if(node.type==='FunctionDeclaration')definitions.set(node.id.name,gameSource.slice(node.start,node.end));
  if(node.type==='VariableDeclaration')for(const declaration of node.declarations)if(declaration.id.name&&declaration.init)definitions.set(declaration.id.name,gameSource.slice(declaration.init.start,declaration.init.end));
}
function load(name){
  if(Object.hasOwn(c,name))return c[name];
  for(;;)try{return c[name]=vm.runInContext(`(${definitions.get(name)})`,c);}catch(error){const dependency=error.message.match(/^(\w+) is not defined$/)?.[1];if(!dependency||!definitions.has(dependency))throw error;load(dependency);}
}
['blendDominoHandTargetFrame','updateKnockAnimations','KNOCK_DURATION','KNOCK_CONTACT_PHASE','poseDominoShuffleHands','updateDominoShuffleTiles','spawnOpeningShuffleAnimation','OPENING_SHUFFLE_ANIM_DURATION','shuffle'].forEach(load);
Object.assign(c,{drawAnimations:[],placementAnimations:[],knockAnimations:[],SFX:{pass(){}},showPassBubble(){},nextTurn(){},flushPendingDominoState(){},renderBoneyardStack(){},setStatus(){},refreshDominoControls(){},dominoMotionTime:0});
const originalMake=c.makeDomino;
c.makeDomino=(...args)=>{const root=originalMake(...args);root.add(new THREE.Mesh(new RoundedBoxGeometry(1,2,.22,2,.06),new THREE.MeshStandardMaterial({color:0xf4e6c8})));return root;};
const scene=new THREE.Scene();c.seatedHumanActors.forEach(({chair})=>scene.add(chair));scene.add(c.piecesG);
const table=new THREE.Mesh(new THREE.CylinderGeometry(c.CLOTH_RADIUS,c.CLOTH_RADIUS,.06,8),new THREE.MeshStandardMaterial({color:0x15513e}));table.position.y=c.CLOTH_TOP-.03;table.rotation.y=Math.PI/8;scene.add(table);
const key=V(.5,1,.7).normalize();
function snapshot(name,seat,close=false,preview=false){
  scene.updateMatrixWorld(true);scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
  const rig=c.seatedHumanActors[seat].rig;
  const gripPoint=rig.rightHand.getWorldPosition(V());
  const tips=rig.rightContactTips.filter(Boolean);if(tips.length){const center=tips.reduce((sum,b)=>sum.add(b.getWorldPosition(V())),V()).multiplyScalar(1/tips.length);gripPoint.lerp(center,.55);}
  const anchors=['leftUpperArm','rightUpperArm','leftForeArm','rightForeArm','leftHand','rightHand','neck','head','hips'].map(key=>rig[key]?.getWorldPosition(V())).filter(Boolean);
  const bounds=new THREE.Box3().setFromPoints(anchors);
  const target=close?gripPoint:bounds.getCenter(V());
  const camera=new THREE.PerspectiveCamera(40,close?1.2:.72,.01,100);
  const front=c.seatedHumanActors[seat].chair.position.clone().setY(0).normalize().negate(),side=V(front.z,0,-front.x);
  const offset=front.multiplyScalar(close?1.55:4.8).addScaledVector(side,close?.85:2.8).add(V(0,close?1:3,0));
  camera.position.copy(target).add(offset);camera.lookAt(target);camera.updateMatrixWorld(true);
  if(!close){const direction=offset.normalize();for(let distance=4.2;distance<=12;distance+=.1){camera.position.copy(target).addScaledVector(direction,distance);camera.lookAt(target);camera.updateMatrixWorld(true);if(anchors.every(p=>{const q=p.clone().project(camera);return Math.abs(q.x)<.77&&Math.abs(q.y)<.76;}))break;}}
  if(preview)fitDominoReviewCamera(camera,'hands',390/550,{kind:name.includes('landing')?'place':'hold',sourceSeat:seat,activePoints:anchors});
  const triangles=[];
  scene.traverse(o=>{
    if(!o.isMesh)return;
    if(o.isSkinnedMesh&&!c.seatedHumanActors[seat].actor.getObjectById(o.id))return;
    const pos=o.geometry.getAttribute('position'),indices=o.geometry.index?.array||Array.from({length:pos.count},(_,i)=>i),verts=[];
    for(let i=0;i<pos.count;i++){const v=V().fromBufferAttribute(pos,i);if(o.isSkinnedMesh)o.applyBoneTransform(i,v);verts.push(v.applyMatrix4(o.matrixWorld));}
    const col=o.material.color;
    for(let i=0;i<indices.length;i+=3){const world=[verts[indices[i]],verts[indices[i+1]],verts[indices[i+2]]],normal=world[1].clone().sub(world[0]).cross(world[2].clone().sub(world[0])).normalize(),shade=.42+.58*Math.max(0,normal.dot(key));
      const projected=world.map(v=>v.clone().project(camera));if(projected.some(v=>v.z<-1||v.z>1))continue;
      for(const v of projected)triangles.push(v.x,v.y,v.z);triangles.push(Math.pow(col.r,.4545)*shade*255,Math.pow(col.g,.4545)*shade*255,Math.pow(col.b,.4545)*shade*255);
    }
  });
  writeFileSync(`${output}/${name}.bin`,Buffer.from(new Float32Array(triangles).buffer));
  return {name,width:preview?390:close?900:650,height:preview?550:close?750:900,triangles:triangles.length/12};
}
const manifest=[];
for(const seat of (process.argv[3]||'0,1,2,3').split(',').map(Number)){
  for(const player of c.players)player.hand=Array.from({length:7},()=>({a:2,b:5}));c.renderHands();c.dominoHandContacts.clear();c.poseDominoHands(seat);
  manifest.push(snapshot(`seat-${seat}-rack`,seat),snapshot(`seat-${seat}-rack-hand`,seat,true));
  if(seat===1)manifest.push(snapshot('preview-rack',seat,false,true));
  const mesh=c.players[seat].hand[3].mesh;c.players[seat].hand[3].mesh=null;
  const board=new THREE.Object3D();c.orientDominoFlat(board,Math.PI/2);
  const anim={mesh,sourceSeat:seat,segment:{},start:mesh.position.clone(),end:V(0,c.CHAIN_TILE_Y,0),startQuat:mesh.quaternion.clone(),endQuat:board.quaternion.clone(),startScale:mesh.scale.clone(),endScale:V(.1,.016/.22,.1).multiplyScalar(c.DOMINO_WORLD_SCALE),arc:c.PLACE_ANIM_ARC};anim.humanReachProfile=c.getDominoHumanReachProfile(anim);
  for(const t of [0,.12,.18,.4,.7,.92,1]){
    const rotate=c.smoothPlacementStep(c.PLACE_ANIM_LIFT_END,c.PLACE_ANIM_LOWER_END,t);mesh.position.copy(c.resolvePrecisionPlacementPosition(anim,t));mesh.quaternion.slerpQuaternions(anim.startQuat,anim.endQuat,rotate);mesh.scale.lerpVectors(anim.startScale,anim.endScale,rotate);c.updateSeatedHumanDominoAction(anim,t);
    if(t===0)continue;const name=`seat-${seat}-place-${String(t).replace('.','-')}`;manifest.push(snapshot(name,seat),snapshot(name+'-hand',seat,true));
    if(seat===1&&t===.92)manifest.push(snapshot('preview-landing',seat,false,true));
  }
  c.orientDominoFaceDown(board,Math.PI/2);
  const draw={...anim,segment:undefined,contactSide:undefined,startHandContact:undefined,startHandFrame:undefined,start:V(0,c.CLOTH_TOP+.006,c.CLOTH_RADIUS*.45),end:anim.start.clone(),startQuat:board.quaternion.clone(),endQuat:anim.startQuat.clone(),startScale:anim.endScale.clone(),endScale:anim.startScale.clone()};draw.humanReachProfile=c.getDominoHumanReachProfile(draw);
  for(const t of [0,.12,.18,.4,.7,.92]){
    const rotate=c.smoothPlacementStep(c.PLACE_ANIM_LIFT_END,c.PLACE_ANIM_LOWER_END,t);mesh.position.copy(c.resolvePrecisionPlacementPosition(draw,t));mesh.quaternion.slerpQuaternions(draw.startQuat,draw.endQuat,rotate);mesh.scale.lerpVectors(draw.startScale,draw.endScale,rotate);c.updateSeatedHumanDominoAction(draw,t);
    if(t===0)continue;const name=`seat-${seat}-draw-${String(t).replace('.','-')}`;manifest.push(snapshot(name,seat),snapshot(name+'-hand',seat,true));
  }
  c.poseDominoHands(seat);c.knockAnimations=[{sourceSeat:seat,startTime:0,remote:true}];
  for(const t of [.25,.56,.85]){c.updateKnockAnimations(t*c.KNOCK_DURATION);const name=`seat-${seat}-knock-${String(t).replace('.','-')}`;manifest.push(snapshot(name,seat),snapshot(name+'-hand',seat,true));}
  c.knockAnimations=[];
}
for(const player of c.players)player.hand=[];c.renderHands();c.boneyard=[];for(let a=0;a<=6;a++)for(let b=a;b<=6;b++)c.boneyard.push({a,b});c.spawnOpeningShuffleAnimation();
for(let i=0;i<=90;i++){const t=i/120;c.updateDominoShuffleTiles(c.openingSequence,t,t*c.OPENING_SHUFFLE_ANIM_DURATION);c.poseDominoShuffleHands(c.openingSequence,t);if([30,60,90].includes(i)){const name=`seat-1-shuffle-${i}`;manifest.push(snapshot(name,1),snapshot(name+'-hand',1,true));}}
writeFileSync(`${output}/manifest.json`,JSON.stringify(manifest,null,2));console.log(JSON.stringify({output,snapshots:manifest.length}));
