import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {CollectionVehicleVisuals,type CollectionCar} from '../../webapp/src/games/tiranastreets/CollectionVehicleVisuals';
import {VEHICLE_COLLECTION} from '../../webapp/src/games/tiranastreets/shared/vehicleCollection.mjs';
function App(){
 const host=useRef<HTMLDivElement>(null),api=useRef<any>();const[id,setId]=useState('benz'),[status,setStatus]=useState('Loading…');
 useEffect(()=>{
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,Math.max(300,innerHeight-180));renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;host.current!.appendChild(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#a1b1c0');scene.add(new T.HemisphereLight(0xffffff,0x607080,2));
  const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(4,6,3);scene.add(sun);
  const pmrem=new T.PMREMGenerator(renderer),env=pmrem.fromScene(new RoomEnvironment());scene.environment=env.texture;
  const camera=new T.PerspectiveCamera(40,innerWidth/Math.max(300,innerHeight-180),.05,100);camera.position.set(8.4,4.9,-11.3);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.8,0);controls.update();
  const floor=new T.Mesh(new T.PlaneGeometry(40,40),new T.MeshStandardMaterial({color:'#607080',roughness:.85}));floor.rotation.x=-Math.PI/2;floor.position.y=-.02;scene.add(floor);
  const layer=new CollectionVehicleVisuals({maxVisible:10});scene.add(layer.group);
  let car:CollectionCar={id:'probe',collectionVehicle:'benz',x:0,z:0,heading:-Math.PI/2,npcDriver:true};let frame=0,onlyDriver=false,dirty=true,rendered='';controls.addEventListener('change',()=>{dirty=true});
  const getStats=()=>{const root=layer.getRoot('probe');if(!root)return{ready:false,errors:Object.fromEntries(layer.errors)};root.updateMatrixWorld(true);const driver=root.getObjectByName('npc-driver:probe')!;let triangles=0,meshes=0;root.children[0].traverse(o=>{if(o instanceof T.Mesh){triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;meshes++;}});const b=new T.Box3().setFromObject(root.children[0]);return{ready:true,id:root.userData.collectionVehicle,triangles,meshes,size:b.getSize(new T.Vector3()).toArray(),driver:driver.userData,driverVisible:driver.visible,driverPosition:driver.position.toArray(),driverBounds:new T.Box3().setFromObject(driver,true).getSize(new T.Vector3()).toArray(),errors:Object.fromEntries(layer.errors)};};
  api.current=(window as any).collectionProbe={layer,scene,camera,renderer,stats:getStats,select:(id:string)=>{car={...car,collectionVehicle:id};setId(id)},driverOnly:()=>{onlyDriver=!onlyDriver;dirty=true},occupy:(value:boolean)=>{car.driver=value?'test-player':null;dirty=true},dispose:()=>layer.dispose()};
  const tick=()=>{frame=requestAnimationFrame(tick);layer.update([car],{x:0,z:0},1/60);const root=layer.getRoot('probe');if(root){root.children[0].visible=!onlyDriver;setStatus(`${car.collectionVehicle} · ${getStats().triangles?.toLocaleString()} triangles · human driver`);}else setStatus(layer.errors.size?JSON.stringify(Object.fromEntries(layer.errors)):'Loading original GLB and driver…');const key=root?.userData.collectionVehicle||'';if(key!==rendered){rendered=key;dirty=true}if(dirty){renderer.render(scene,camera);dirty=false}};tick();
  return()=>{cancelAnimationFrame(frame);layer.dispose();controls.dispose();env.dispose();pmrem.dispose();renderer.dispose();renderer.domElement.remove()};
 },[]);
 return <><header><strong>TIRANA STREETS · VEHICLE CHECK</strong><p role="status">{status}</p><select aria-label="Vehicle" value={id} onChange={e=>api.current.select(e.target.value)}>{VEHICLE_COLLECTION.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button onClick={()=>api.current.driverOnly()}>Inspect seated driver</button></header><div ref={host}/></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
