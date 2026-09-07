import * as THREE from 'three';
import {triangleInReplacement, type NativeLandmark} from './nativeLocations.mjs';

/** Isolated compatibility adapter for the two existing merged city renderers.
 * Retired objects stay owned by the original scene so its teardown frees them. */
export function replaceLegacyCityLandmarks(root: THREE.Object3D, locations: readonly NativeLandmark[], game: 'tiranastreets' | 'kartroyale') {
  const retired = new THREE.Group();
  retired.name = 'Tirana:retired-landmark-shells';
  retired.visible = false;
  const old = [...root.children];
  const specials = locations.filter(l => ['clock', 'mosque', 'pyramid'].includes(l.id));
  let retiredObjects = 0, removedTriangles = 0;
  root.updateMatrixWorld(true);
  for (const object of old) {
    let replace = false;
    if (object instanceof THREE.Group && object.children.length) {
      if (game === 'tiranastreets') {
        replace = specials.some(l => Math.hypot(object.position.x-l.x, object.position.z-l.z)<.02)
          && object.children.every(c => c instanceof THREE.Mesh || c instanceof THREE.Group);
      } else {
        // Racing's legacy landmarks are material-batched into world-space
        // vertices. Never identify a building merely by proximity or by size.
        const meshes = object.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh);
        const landmarkPalette = new Set([0xd8d1bf, 0x7c9797, 0xfff8e4]);
        const paletteMatches = meshes.length > 0 && meshes.length === object.children.length && meshes.every(m => {
          const mat = m.material;
          return !Array.isArray(mat) && 'color' in mat && landmarkPalette.has((mat as THREE.MeshStandardMaterial).color.getHex());
        });
        if (paletteMatches) {
          const box = new THREE.Box3().setFromObject(object), center = box.getCenter(new THREE.Vector3());
          replace = specials.some(l => Math.hypot(center.x-l.x, center.z-l.z)<30);
        }
      }
    }
    if (game === 'tiranastreets' && object instanceof THREE.Mesh) {
      const p=object.position, geometry=object.geometry;
      replace ||= Math.abs(p.x+48)<.01 && Math.abs(p.z-33)<.01 &&
        ((geometry instanceof THREE.BoxGeometry && Math.abs(p.y-2)<.01 && geometry.parameters.width===6 && geometry.parameters.height===4) ||
         (geometry instanceof THREE.CylinderGeometry && Math.abs(p.y-6.5)<.01 && geometry.parameters.height===5));
    }
    if (replace) { retired.add(object); retiredObjects++; }
  }
  root.add(retired);
  const footprints=locations.filter(l=>l.id==='museum'||l.id==='eyes').flatMap(l=>l.footprint?[l.footprint]:[]);
  if (footprints.length) {
    const vector=new THREE.Vector3();
    for (const object of old) {
      if (object.parent===retired) continue;
      object.traverse(child => {
        if (!(child instanceof THREE.Mesh) || child instanceof THREE.InstancedMesh || Array.isArray(child.material)) return;
        const mat=child.material as THREE.MeshStandardMaterial;
        const eligible = game==='tiranastreets'
          ? (Boolean(child.parent?.userData.center) || mat.color?.getHex()===0x506971)
          : (mat.vertexColors===true || mat.color?.getHex()===0x456273);
        if (!eligible) return;
        const geometry=child.geometry, position=geometry.getAttribute('position'), index=geometry.index;
        if (!position || geometry.groups.length>1) return;
        const count=index?index.count:position.count, keep:number[]=[];
        let removed=0;
        for(let i=0;i<count;i+=3){
          const ids=[0,1,2].map(n=>index?index.getX(i+n):i+n);
          const vertices=ids.map(id=>vector.fromBufferAttribute(position,id).applyMatrix4(child.matrixWorld).toArray());
          if(triangleInReplacement(vertices,footprints)) removed++;
          else keep.push(...ids);
        }
        if (!removed) return;
        const next=geometry.clone();
        next.clearGroups();
        next.setIndex(keep);
        next.setDrawRange(0,keep.length);
        child.geometry=next;
        // These are unique city-batch geometries, not shared source GLBs.
        geometry.dispose();
        removedTriangles+=removed;
      });
    }
  }
  return {retiredObjects,removedTriangles};
}

