import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {groundHeight} from '../tirana-east/terrainCore.mjs';
import {polygonContains} from '../tiranastreets/shared/architecture.mjs';
import {segmentDistance} from '../tiranastreets/shared/streetLayout.mjs';
import {ribbonExclusion} from '../tirana-street-detail/roadDetailCore.mjs';
import type {StreetDetailOptions} from '../tirana-street-detail/StreetDetailLayer';
import {MAPPED_PARKS} from './mappedAmenitiesCore.mjs';
import {bridgeRibOffsets, downtownPlayPoint, etcRoofText, findEtcWalkBridge, PLAY_RADIUS} from './etcCorridor.mjs';

type Point = {x: number; z: number};
type Detail = {anchor: Point; radius: number; make: () => T.Group; object?: T.Group};
type Part = T.BufferGeometry[];

function box(into: Part, x: number, y: number, z: number, width: number, height: number, depth: number, pitch = 0) {
  into.push(new T.BoxGeometry(width,height,depth).rotateX(pitch).translate(x,y,z));
}
function batch(root: T.Group, parts: Part, material: T.MeshStandardMaterial) {
  const geometry = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  if (!geometry) { material.dispose(); return; }
  const mesh = new T.Mesh(geometry, material);
  mesh.receiveShadow = true;
  root.add(mesh);
}
function material(color: number, roughness = 0.64, metalness = 0.16) {
  return new T.MeshStandardMaterial({color,roughness,metalness});
}
function rib(width: number, z: number) {
  // An original curved steel ribbon, not a trace or extrusion of a sponsor logo.
  const face = new T.Shape();
  face.moveTo(-width,0.19);
  face.bezierCurveTo(-width,2.6,-0.95,4.45,0.86,4.92);
  face.quadraticCurveTo(0.16,4.14,0.31,3.32);
  face.quadraticCurveTo(width,2.27,width,0.19);
  face.lineTo(width-0.17,0.19);
  face.quadraticCurveTo(width-0.17,2.10,0.12,3.14);
  face.quadraticCurveTo(-0.05,3.84,0.43,4.57);
  face.bezierCurveTo(-1.05,3.88,-width+0.19,2.53,-width+0.19,0.19);
  face.closePath();
  return new T.ExtrudeGeometry(face,{depth:0.16,bevelEnabled:false,curveSegments:8}).translate(0,0,z-0.08);
}
function makeBridge(road: NonNullable<ReturnType<typeof findEtcWalkBridge>>, offsets: number[]) {
  const root = new T.Group(), ribs: Part = [], collars: Part = [];
  const dx = road.b[0]-road.a[0], dz = road.b[1]-road.a[1];
  const width = road.w/2+0.10;
  // Six evenly spaced ribs with clear entrances and the original walking width.
  for (const z of offsets) {
    ribs.push(rib(width,z));
    for (const side of [-1,1]) box(collars,side*(width-0.055),0.34,z,0.25,0.28,0.25);
  }
  batch(root,ribs,material(0xc52034,0.37,0.38));
  batch(root,collars,material(0xb9bfc0,0.43,0.54));
  root.position.set((road.a[0]+road.b[0])/2,0,(road.a[1]+road.b[1])/2);
  root.rotation.y = Math.atan2(dx,dz);
  root.name = 'Ura e Vodafone-it · Lana';
  return root;
}

function makeEtcText(site: NonNullable<ReturnType<typeof etcRoofText>>) {
  const root = new T.Group(), letters: Part = [], supports: Part = [];
  const t = 0.23, h = 1.7, w = 1.1, spacing = 1.46, centre = 1.14;
  const add = (x: number,y: number,ww: number,hh: number) => box(letters,x,centre+y,0.14,ww,hh,0.25);
  for (const offset of [-spacing,spacing]) {
    add(offset-w/2+t/2,0,t,h);
    for (const sign of [-1,1]) add(offset+t/2,sign*(h-t)/2,w-t,t);
  }
  add(-spacing+t/2,0,w-t-0.16,t);
  add(0,(h-t)/2,w,t);
  add(0,-t/2,t,h-t);
  for (const x of [-1.50,0,1.50]) box(supports,x,0.22,-0.02,0.12,0.44,0.45);
  box(supports,0,0.37,-0.03,4.18,0.12,0.18);
  batch(root,letters,new T.MeshStandardMaterial({color:0xe8e0d5,roughness:0.36,metalness:0.12,emissive:0xa35639,emissiveIntensity:0.22}));
  batch(root,supports,material(0x323c41));
  root.position.set(site.x,site.roof+groundHeight(site.x,site.z),site.z);
  root.rotation.y = site.yaw;
  root.name = 'Galeria ETC · roof identifier';
  return root;
}

function makePlayground(site: Point) {
  const root = new T.Group(), surf: Part = [], painted: Part = [], steel: Part = [], boards: Part = [];
  // 5.4 x 4 m rubber play pad plus a compact elevated deck and slide.
  const pad = new T.Shape().moveTo(-2.32,-2).lineTo(2.32,-2)
    .quadraticCurveTo(2.7,-2,2.7,-1.62).lineTo(2.7,1.62)
    .quadraticCurveTo(2.7,2,2.32,2).lineTo(-2.32,2)
    .quadraticCurveTo(-2.7,2,-2.7,1.62).lineTo(-2.7,-1.62)
    .quadraticCurveTo(-2.7,-2,-2.32,-2);
  surf.push(new T.ExtrudeGeometry(pad,{depth:0.035,curveSegments:3,bevelEnabled:false})
    .rotateX(-Math.PI/2).translate(0,0.035,0));
  for (const x of [-0.97,-0.06]) for (const z of [-0.88,-0.03]) box(steel,x,0.86,z,0.08,1.64,0.08);
  box(boards,-0.52,0.94,-0.45,0.98,0.10,0.89);
  for (const z of [-0.88,-0.03]) box(painted,-0.52,1.53,z,0.97,0.12,0.05);
  box(painted,-0.52,1.73,-0.45,1.17,0.12,1.11);
  box(steel,-0.52,0.53,0.71,0.55,0.055,1.6,0.59);
  for (const x of [-0.86,-0.18]) box(painted,x,0.58,0.71,0.09,0.165,1.6,0.59);
  for (let i = 0; i < 5; i++) box(steel,-0.52,0.2+i*0.166,-1.21,0.63,0.052,0.07);
  for (const x of [-0.87,-0.17]) box(painted,x,0.54,-1.2,0.063,0.99,0.065);
  // Separate low timber balance feature, aligned on its own pad side.
  box(boards,1.54,0.37,0.47,0.20,0.13,1.94);
  for (const z of [-0.21,1.14]) box(steel,1.54,0.22,z,0.23,0.32,0.20);
  batch(root,surf,material(0x4d7770,0.92,0));
  batch(root,painted,material(0xdd9f43,0.54,0.08));
  batch(root,steel,material(0x6b7b82,0.43,0.5));
  batch(root,boards,material(0xa97949,0.82,0.02));
  root.position.set(site.x,groundHeight(site.x,site.z),site.z);
  root.name = 'Downtown One · Kënd lojërash';
  return root;
}

export class EtcCorridorDetails {
  readonly group = new T.Group();
  private readonly items: Detail[] = [];

  constructor(world: typeof WORLD, options: StreetDetailOptions) {
    this.group.name = 'Tirana:ETC-and-Downtown-corridor';
    const excluded = options.track ? ribbonExclusion(options.track) : () => false;
    const road = findEtcWalkBridge(world.roads);
    if (road) {
      const x = (road.a[0]+road.b[0])/2, z = (road.a[1]+road.b[1])/2;
      const offsets = bridgeRibOffsets(road,excluded);
      if (offsets.length) this.items.push({anchor:{x,z},radius:300,make:() => makeBridge(road,offsets)});
    }
    const site = etcRoofText(world.buildings);
    if (site) this.items.push({anchor:site,radius:640,make:() => makeEtcText(site)});
    const play = downtownPlayPoint(MAPPED_PARKS,world.buildings,(x,z,radius) =>
      !excluded(x,z,radius) &&
      !world.roads.some(r => segmentDistance(x,z,r.a,r.b) < radius+r.w/2) &&
      !world.buildings.some(b => polygonContains(x,z,b.p) ||
        b.p.some((p,i) => segmentDistance(x,z,p,b.p[(i+1)%b.p.length]) < radius))
    );
    if (play) this.items.push({anchor:play,radius:130,make:() => makePlayground(play)});
  }

  update(viewer: Point, battery: boolean) {
    for (const item of this.items) {
      const visible = Math.hypot(item.anchor.x-viewer.x,item.anchor.z-viewer.z) < item.radius*(battery?0.8:1);
      if (visible && !item.object) {
        item.object = item.make();
        this.group.add(item.object);
      }
      if (item.object) item.object.visible = visible;
    }
  }

  dispose() {
    this.group.traverse(o => { if (o instanceof T.Mesh) { o.geometry.dispose(); (o.material as T.Material).dispose(); } });
    this.group.removeFromParent();
    this.group.clear();
    this.items.length = 0;
  }
}
