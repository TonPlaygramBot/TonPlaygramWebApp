import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { groundHeight } from '../tirana-east/terrainCore.mjs';
import { gramenoMemorial } from './soloCivilianLandmarks.mjs';

export const GRAMENO_PLAQUE_NAME = 'MIHAL GRAMENO';
const makePlaqueTexture = () => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 112;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#3c3328';
  ctx.fillRect(0, 0, 384, 112);
  ctx.strokeStyle = '#b39b70';
  ctx.lineWidth = 2;
  ctx.strokeRect(11, 11, 362, 90);
  ctx.fillStyle = '#e2d0aa';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 34px Georgia, serif';
  ctx.fillText(GRAMENO_PLAQUE_NAME, 192, 56, 330);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.name = 'Original identity plaque for Mihal Grameno';
  return texture;
};

// Original low-poly study of the historic figure's moustache, face and jacket
// from Kel Marubi's 1907–1920 portrait. Not a replica of Besart Papa's sculpture.
export function createGramenoMemorial(finishPlinth?: (material:T.MeshStandardMaterial) => void) {
  const point = gramenoMemorial();
  if (!point) return null;
  const root = new T.Group();
  root.name = 'Mihal Grameno — stilizim origjinal';
  root.userData = {kind:'civic-landmark', mapId:'node/9124938870', realWorkReplicated:false};
  root.position.set(point.x, groundHeight(point.x, point.z), point.z);
  root.rotation.y = -.7; // art-directed street-facing angle; not a surveyed orientation
  const bronze = new T.MeshStandardMaterial({color:0x605038, roughness:.61, metalness:.52});
  const stone = new T.MeshStandardMaterial({color:0xc1b6a0, roughness:.96});
  finishPlinth?.(stone);
  const parts: T.BufferGeometry[] = [];
  const place = (geometry:T.BufferGeometry, x:number,y:number,z:number) => {
    geometry.translate(x,y,z);
    parts.push(geometry.index ? geometry.toNonIndexed() : geometry);
    if (geometry.index) geometry.dispose();
  };
  const shape = (x:number,y:number,z:number,sx:number,sy:number,sz:number) => {
    place(new T.SphereGeometry(1,12,8).scale(sx,sy,sz),x,y,z);
  };
  place(new T.CylinderGeometry(.16,.38,.32,12).scale(1,1,.63),0,1.14,0);
  shape(0,1.34,0,.31,.22,.18);       // jacket and shoulders
  shape(0,1.52,.015,.105,.15,.101); // neck and standing collar
  shape(.02,1.72,.006,.16,.207,.147);
  shape(.018,1.65,.059,.126,.126,.117); // chin
  shape(.013,1.72,.148,.036,.048,.041); // nose
  shape(-.038,1.674,.148,.077,.027,.038);
  shape(.064,1.674,.148,.077,.027,.038); // split moustache
  shape(-.132,1.726,.018,.036,.063,.047);
  shape(.161,1.726,.018,.034,.063,.046);
  for(const side of [-1,1]){
    place(new T.BoxGeometry(.065,.196,.04).rotateZ(side*.47),side*.083,1.459,.137);
    shape(side*.053+.016,1.764,.132,.05,.023,.023); // brows
  }
  const geometry = mergeGeometries(parts,false)!;
  parts.forEach(p=>p.dispose());
  const figure = new T.Mesh(geometry,bronze);
  const base = new T.Mesh(new RoundedBoxGeometry(.68,1,.57,1,.012),stone);
  base.name = 'Grameno: worn masonry plinth';
  const plaqueMap = makePlaqueTexture();
  const plaque = new T.Mesh(new T.PlaneGeometry(.46,.134), new T.MeshStandardMaterial({
    color:plaqueMap ? 0xffffff : 0x3c3328, map:plaqueMap, roughness:.78, metalness:.14,
  }));
  plaque.name = GRAMENO_PLAQUE_NAME;
  // Original art-direction detail, not a claim about the real inscription.
  plaque.position.set(0,.75,.289);
  plaque.receiveShadow = true;
  base.position.y = .5;
  figure.castShadow = base.castShadow = true;
  figure.receiveShadow = base.receiveShadow = true;
  root.add(base,figure,plaque);
  return root;
}
