import {CinematicAtmosphere} from '../tirana-environment/CinematicAtmosphere';
import {CollectionVehicleVisuals} from '../tiranastreets/CollectionVehicleVisuals';
import {ImportedAssetVisuals} from '../tiranastreets/ImportedAssetVisuals';
import { AlbanianForcesVisuals, type ForceFrame } from '../tiranastreets/AlbanianForcesVisuals';
import * as THREE from 'three';
import { TiranaCityScene } from '../tiranastreets/TiranaCityScene';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { makeWorld, type World } from './world';
import { disposeObject } from '../tiranastreets/FpsCity';
import { ORIGIN, OBSTACLES, START, EXTRACTION, props } from './shared/layout.mjs';

/** The active Tirana Streets FPS retains one simulation, camera and game loop. */
export function makeCityWorld(scene:THREE.Scene,camera:THREE.PerspectiveCamera,renderer:THREE.WebGLRenderer):World {
  const world = makeWorld(scene, camera, renderer, false);
  const webgl = renderer instanceof THREE.WebGLRenderer;
  const sharedCity = new TiranaCityScene(webgl);
  const city = sharedCity.city;
  sharedCity.group.position.set(-ORIGIN.x, 0, -ORIGIN.z);
  scene.add(sharedCity.group);
  scene.userData.tiranaCity = city.group.userData;
  world.obstacles = [...OBSTACLES];
  world.extraction.position.set(EXTRACTION.x, .12, EXTRACTION.z);
  world.sky.position.set(START.x, 0, START.z);
  world.sky.renderOrder = -1000;
  const skyMaterial = world.sky.material as THREE.ShaderMaterial;
  skyMaterial.uniforms.top.value.set('#6c9cb9');
  skyMaterial.uniforms.bottom.value.set('#d1d8cc');
  scene.fog = new THREE.FogExp2('#c5d2cc', .0017);
  camera.far = 2800;
  camera.updateProjectionMatrix();
  world.rain.userData.enabled = false;
  world.rain.visible = false;
  const sun = scene.children.find(o => o instanceof THREE.DirectionalLight) as THREE.DirectionalLight;
  sun.color.set('#ffedcd'); sun.intensity = 3.2;
  sun.shadow.camera.far = 380;
  sun.shadow.camera.updateProjectionMatrix();
  const cover = new THREE.Group();
  cover.name = 'FPS cover and Tirana parked cars';
  scene.add(cover);
  const concrete = new THREE.MeshStandardMaterial({color:0x999c91,roughness:.95});
  const metal = new THREE.MeshStandardMaterial({color:0x526457,roughness:.7,metalness:.25});
  let disposed = false;
  const forces = webgl ? new AlbanianForcesVisuals() : undefined;
  if (forces) scene.add(forces.group);
  const collection=webgl?new CollectionVehicleVisuals():undefined;
  if(collection)scene.add(collection.group);
  const collectionCars=props.filter(p=>p.collectionVehicle).map(p=>({id:`collection-${p.collectionVehicle}`,collectionVehicle:p.collectionVehicle,x:p.x,z:p.z,heading:p.rot-Math.PI,npcDriver:true}));
  const fleet: ForceFrame = {cars: props.filter(p => p.forceVehicle).map((p, i) => ({
    id: `battlefield-fleet-${i}`, forceVehicle: p.forceVehicle, model: 'police',
    x: p.x, z: p.z, heading: p.rot - Math.PI, speed: 0, steering: 0,
  })), traffic: [], units: [], npcs: []};
  const imported=new ImportedAssetVisuals();scene.add(imported.group);
  const importedPlacements=props.filter(p=>p.racingAsset||p.assetId).map((p,i)=>({id:`imported-${i}`,x:p.x,z:p.z,heading:p.rot,racingAsset:p.racingAsset,assetId:p.assetId}));
  const importedFallbacks = new Map<string, THREE.Object3D>();
  const fleetFallbacks = new Map<string, THREE.Object3D>();
  for (const p of props) {
    // Original models own these props. Never draw a low-detail substitute.
    if(p.collectionVehicle)continue;
    if(p.racingAsset||p.assetId) {
      const entry=importedPlacements.find(e=>e.racingAsset===p.racingAsset&&e.assetId===p.assetId)!;
      const placeholder=new THREE.Mesh(new THREE.BoxGeometry(p.w,p.h,p.d),metal);
      placeholder.position.set(p.x,p.h/2,p.z);cover.add(placeholder);importedFallbacks.set(entry.id,placeholder);continue;
    }
    const car = p.sx===8 && p.sz===12 || p.sx===-9 && p.sz===-24;
    const fallback = new THREE.Mesh(new THREE.BoxGeometry(p.w,p.h,p.d),car?metal:concrete);
    fallback.position.set(p.x,p.h/2,p.z); fallback.rotation.y=p.rot;
    fallback.castShadow=true; fallback.receiveShadow=true; cover.add(fallback);
    if (p.forceVehicle) {
      const entry = fleet.cars.find(c => c.forceVehicle === p.forceVehicle)!;
      fleetFallbacks.set(entry.id, fallback);
      continue;
    }
    if (car && webgl) new GLTFLoader().load('/assets/tirana-streets/'+(p.sx===8?'taxi':'sedan')+'.glb', gltf=>{
      if(disposed){disposeObject(gltf.scene);return;}
      const box=new THREE.Box3().setFromObject(gltf.scene),size=box.getSize(new THREE.Vector3());
      const model=new THREE.Group(); model.add(gltf.scene);
      gltf.scene.scale.set(p.w/size.x,p.h/size.y,p.d/size.z);
      gltf.scene.position.set(-(box.min.x+size.x/2)*gltf.scene.scale.x,-box.min.y*gltf.scene.scale.y,-(box.min.z+size.z/2)*gltf.scene.scale.z);
      model.position.set(p.x,0,p.z);model.rotation.y=p.rot;
      model.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
      cover.add(model);fallback.removeFromParent();fallback.geometry.dispose();
    },undefined,()=>city.group.userData.assetErrors.push('parked car'));
  }
  const point = new THREE.Vector3();
  const atmosphere=new CinematicAtmosphere(scene,renderer);
  world.sky.visible=false;
  let forceTime = performance.now() / 1000;
  world.update = position => {
    const now = performance.now() / 1000;
    forces?.update(fleet, position, now, Math.min(.05, now - forceTime), !renderer.shadowMap.enabled);
    imported.update(importedPlacements,position,!renderer.shadowMap.enabled);
    collection?.update(collectionCars,position,Math.min(.05,now-forceTime));
    city.group.userData.collectionErrors=collection?Object.fromEntries(collection.errors):{};
    for(const [id,fallback] of importedFallbacks)fallback.visible=!imported.has(id);
    forceTime = now;
    for (const [id, fallback] of fleetFallbacks) fallback.visible = !forces?.has(id);
    point.copy(position);point.x+=ORIGIN.x;point.z+=ORIGIN.z;
    sharedCity.update(point, now, !webgl || !renderer.shadowMap.enabled, camera);
    atmosphere.update(now,camera,!renderer.shadowMap.enabled);
  };
  world.update(new THREE.Vector3(START.x,1.68,START.z));
  const dispose = world.dispose;
  world.dispose=()=>{disposed=true;atmosphere.dispose();collection?.dispose();imported.dispose();forces?.dispose();sharedCity.dispose();dispose();concrete.dispose();metal.dispose();};
  return world;
}
