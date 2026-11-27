import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const web=createRequire(new URL('../webapp/package.json',import.meta.url));
const {Box3,BoxGeometry,Group,Mesh,Vector3}=web('three');
const {GLTFLoader}=await import(pathToFileURL(web.resolve('three/examples/jsm/loaders/GLTFLoader.js')));
import {fitImportedFlightVisual} from '../webapp/src/games/tiranastreets-november/flightVisualHeading.mjs';
import {FlightSimulation} from '../webapp/src/games/tiranastreets-november/street-career/FlightSimulation.mjs';
import {pilotView} from '../webapp/src/games/tiranastreets-november/street-career/flightView.mjs';
import {screenStick} from '../webapp/src/games/tiranastreets-november/street-career/humanRoster.mjs';

const original=process.env.TIRANA_FLIGHT_ORIGINAL==='1';
const fit = original ? (model,length)=>{
  const b=new Box3().setFromObject(model),size=b.getSize(new Vector3());
  model.scale.setScalar(length/Math.max(size.x,size.y,size.z));
  model.updateMatrixWorld(true);
  model.position.sub(b.setFromObject(model).getCenter(new Vector3()));
  model.updateMatrixWorld(true);
  return model;
} : fitImportedFlightVisual;
const center = object => new Box3().setFromObject(object).getCenter(new Vector3());
const part=(model,match)=>{
  let node;
  model.traverse(o=>{if(o.isMesh&&match(o))node=o;});
  assert.ok(node);
  return center(node);
};
const along=(offset,direction)=>offset.x*direction.x+offset.z*direction.z;

function modelFixture() {
  const root=new Group(),body=new Mesh(new BoxGeometry(2,2,8));
  const cockpit=new Mesh(new BoxGeometry(.5,.5,.5));
  cockpit.position.z=2.6;cockpit.name='cockpit';root.add(body,cockpit);return root;
}
function gameFlight(kind, heading=0, down=false) {
  const sim = {
    player:{id:'local',health:100}, body:{},
    state:{helicopter:{id:'heli'}},
    world:{clearance:()=>true,surface:()=>0,cast:()=>({kind:'none'})},
    intent:{...screenStick(0,down?44:-44,44),fast:false,brake:false,fire:false},
    event:()=>{}
  };
  const flight = new FlightSimulation(sim);
  const a=kind==='jet'?sim.state.jet:sim.state.helicopter;
  sim.player.aircraftId=a.id;a.pilot='local';
  a.y=30;a.airborne=true;a.heading=heading;a.speed=0;
  const origin={x:a.x,z:a.z};
  for(let n=0;n<60;n++)flight.step(1/60);
  return {a,delta:{x:a.x-origin.x,z:a.z-origin.z},camera:pilotView(a,a.heading,0,390/844).direction};
}

for(const kind of ['helicopter','jet'])test(`${kind} up stick matches both game travel and its displayed nose`,()=>{
  for(const heading of [0,Math.PI/2,-Math.PI*.62]){
    const {a,delta,camera}=gameFlight(kind,heading);
    const parent=new Group();parent.rotation.y=a.heading;
    parent.add(fit(modelFixture(),8));
    parent.updateMatrixWorld(true);
    const visualFront=part(parent,o=>o.name==='cockpit').sub(center(parent));
    assert.ok(along(delta,camera)>8,'up stick moves forward in pilot direction through the real controller');
    assert.ok(along(visualFront,camera)>2,'imported cockpit leads the travel direction');
    assert.ok(along(visualFront,delta)>10,'chase view no longer shows tail-first travel');
    assert.ok(Math.abs(along(delta,{x:camera.z,z:-camera.x}))<1e-6,'no sign reversal on diagonals');
  }
});
test('keeps existing helicopter reverse and jet down-stick slowdown',()=>{
  const heli=gameFlight('helicopter',Math.PI/2,true);
  assert.ok(along(heli.delta,heli.camera)<-3);
  const jet=gameFlight('jet',Math.PI/2,true);
  assert.ok(Math.abs(along(jet.delta,jet.camera))<1e-6);
});

const assetDir=process.env.TIRANA_FLIGHT_GLB_DIR;
for(const code of ['helicopter','f15'])test(`${code} cached glTF cockpit and tail verify the geometry correction`,{skip:!assetDir},async()=>{
  globalThis.self??=globalThis;
  // Node verifies vertex and hierarchy transforms only; no browser texture decode.
  globalThis.createImageBitmap??=async()=>({width:1,height:1,close(){}});
  const b=await readFile(`${assetDir}/${code}.glb`);
  const {scene}=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
  const isCockpit = code==='helicopter' ? o=>/windows/.test(o.name) : o=>o.material?.name==='Cockpit';
  const originalCockpit=part(scene,isCockpit).sub(center(scene));
  assert.ok(originalCockpit.z>1,'source geometry faces +Z');
  const visual=fit(scene,code==='helicopter'?8:15);
  const fixedCockpit=part(visual,isCockpit).sub(center(visual));
  assert.ok(fixedCockpit.z< -1,'cockpit faces the engine nose vector -Z');
  if(code==='helicopter') assert.ok(part(visual,o=>/backrotor/.test(o.name)).z>1,'tail rotor remains behind the hull');
});
