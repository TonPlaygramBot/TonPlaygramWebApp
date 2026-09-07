import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { makeWorld, type World } from './world';
import { FpsCity, disposeObject } from '../tiranastreets/FpsCity';
import { ORIGIN, OBSTACLES, START, EXTRACTION, props } from './shared/layout.mjs';
import { WORLD } from '../tiranastreets/shared/world.mjs';
import { BUILDING_PROFILES } from '../tiranastreets/shared/architecture.mjs';
import { nativeReplacementIds } from '../tirana-landmarks/nativeLocations.mjs';
import { UrbanDetailLayer } from '../tirana-detail-kit/UrbanDetailLayer';

/** The active Tirana Streets FPS retains one simulation, camera and game loop. */
export function makeCityWorld(scene:THREE.Scene,camera:THREE.PerspectiveCamera,renderer:THREE.WebGLRenderer):World {
  const world = makeWorld(scene, camera, renderer, false);
  const webgl = renderer instanceof THREE.WebGLRenderer;
  const city = new FpsCity(webgl);
  city.group.position.set(-ORIGIN.x, 0, -ORIGIN.z);
  scene.add(city.group);
  // FpsCity already owns street facades. Add only rooftop modules, and leave its
  // researched civic profiles/native landmarks free of generic fixture dressing.
  const excluded=new Set([...nativeReplacementIds(WORLD),...Object.keys(BUILDING_PROFILES)]);
  const details=new UrbanDetailLayer(WORLD,excluded,{roofsOnly:true});
  details.group.position.set(-ORIGIN.x,0,-ORIGIN.z);scene.add(details.group);
  scene.userData.tiranaCity = city.group.userData;
  world.obstacles = [...OBSTACLES];
  world.extraction.position.set(EXTRACTION.x, .12, EXTRACTION.z);
  world.sky.position.set(START.x, 0, START.z);
  world.sky.renderOrder = -1000;
  const skyMaterial = world.sky.material as THREE.ShaderMaterial;
  skyMaterial.uniforms.top.value.set('#6c9cb9');
  skyMaterial.uniforms.bottom.value.set('#d1d8cc');
  scene.fog = new THREE.FogExp2('#c5d2cc', .0017);
  camera.far = 1200;
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
  for (const p of props) {
    const car = p.sx===8 && p.sz===12 || p.sx===-9 && p.sz===-24;
    const fallback = new THREE.Mesh(new THREE.BoxGeometry(p.w,p.h,p.d),car?metal:concrete);
    fallback.position.set(p.x,p.h/2,p.z); fallback.rotation.y=p.rot;
    fallback.castShadow=true; fallback.receiveShadow=true; cover.add(fallback);
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
  let shadowX = Infinity, shadowZ = Infinity;
  world.update = position => {
    point.copy(position);point.x+=ORIGIN.x;point.z+=ORIGIN.z;
    city.update(point, performance.now()/1000, !renderer.shadowMap.enabled);
    details.update(point,!webgl||!renderer.shadowMap.enabled);
    if (Math.hypot(position.x-shadowX,position.z-shadowZ)>12) {
      shadowX=position.x;shadowZ=position.z;
      sun.position.set(position.x-80,140,position.z-70);
      sun.target.position.set(position.x,0,position.z);
      sun.shadow.needsUpdate=true;
    }
  };
  world.update(new THREE.Vector3(START.x,1.68,START.z));
  const dispose = world.dispose;
  world.dispose=()=>{disposed=true;details.dispose();city.dispose();dispose();concrete.dispose();metal.dispose();};
  return world;
}
