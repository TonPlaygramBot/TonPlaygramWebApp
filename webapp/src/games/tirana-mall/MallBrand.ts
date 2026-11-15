import * as T from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import fontData from './brandFont';
const font = new FontLoader().parse(fontData);

/** Dimensional lettering, shared by the actual mapped Pyramid and mall interior. */
export function createMallBrand(width = 15) {
  const group = new T.Group();
  group.name = 'TonPlayGram:Pyramid-gaming-mall-sign';
  const title = new T.ExtrudeGeometry(font.generateShapes('TonPlayGram', 1), {
    depth: .17, bevelEnabled: true, bevelThickness: .015, bevelSize: .01, bevelSegments: 1, curveSegments: 3
  });
  title.computeBoundingBox();
  const box = title.boundingBox!, scale = width / Math.max(.1, box.max.x - box.min.x);
  title.translate(-(box.max.x + box.min.x) / 2, 0, 0);
  const material = new T.MeshStandardMaterial({color:'#87f3d2',metalness:.45,roughness:.3,emissive:'#127c66',emissiveIntensity:.35});
  const front = new T.Mesh(title, material); front.scale.setScalar(scale); group.add(front);
  const back = new T.Mesh(title, material); back.scale.setScalar(scale); back.rotation.y = Math.PI; back.position.z = -.2; group.add(back);
  group.userData.mall = true;
  return group;
}
