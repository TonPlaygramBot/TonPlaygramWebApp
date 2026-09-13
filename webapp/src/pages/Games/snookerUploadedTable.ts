import * as THREE from 'three';
import geometry from './snookerUploadedTableGeometry.json';

type Point = { x: number; y: number };
export const UPLOADED_SNOOKER_TABLE_URL = '/assets/snooker-royal/mesxwi/snooker-table.glb';
export const SNOOKER_CAMERA_BASELINE = 'a560959';

export function createUploadedSnookerMapping(playWidth: number, playLength: number, ballRadius: number) {
  const bed = geometry.bed;
  const scale = Math.min(playWidth / (bed.maxX-bed.minX), playLength / (bed.maxZ-bed.minZ));
  const centerX = (bed.minX+bed.maxX)/2;
  const centerZ = (bed.minZ+bed.maxZ)/2;
  const point = ([x, z]: number[]) => new THREE.Vector2((centerX-x)*scale, (centerZ-z)*scale);
  const contours = geometry.cushionContours.map(contour => contour.map(point));
  const segments = contours.flatMap(contour => contour.map((start, i) => {
    const end = contour[(i+1)%contour.length];
    const delta = end.clone().sub(start);
    // Contours are CCW; the right-hand normal points out of the rubber.
    return { start, end, normal: new THREE.Vector2(delta.y, -delta.x).normalize(), type: 'glb-cushion' };
  }));
  const pockets = geometry.pockets.map(pocket => ({
    center: point(pocket.center), polygon: pocket.polygon.map(point), lip: pocket.lip.map(point),
    radius: Math.max(...pocket.lip.map(p => point(p).distanceTo(point(pocket.center))))
  }));
  const sourceField = geometry.field;
  const field = {
    minX: (centerX-sourceField.maxX)*scale, maxX: (centerX-sourceField.minX)*scale,
    minY: (centerZ-sourceField.maxZ)*scale, maxY: (centerZ-sourceField.minZ)*scale
  };
  return {
    scale, centerX, centerZ, contours, segments, pockets, field, ballRadius,
    clothSourceY: geometry.clothY,
    cushionHeight: (geometry.cushionTopY-geometry.clothY)*scale,
    limitX: Math.min(-field.minX, field.maxX)-ballRadius,
    limitY: Math.min(-field.minY, field.maxY)-ballRadius,
    spots: Object.fromEntries(Object.entries(geometry.spots).map(([key, p]) => [key, point(p).toArray()]))
  };
}
export type UploadedSnookerMapping = ReturnType<typeof createUploadedSnookerMapping>;

function insidePolygon(point: Point, polygon: Point[]) {
  let inside = false;
  for (let i=0, j=polygon.length-1; i<polygon.length; j=i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y>point.y)!==(b.y>point.y) && point.x < (b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
  }
  return inside;
}

export function uploadedPocketContains(mapping: UploadedSnookerMapping, index: number, point: Point) {
  const pocket = mapping.pockets[index];
  return Boolean(pocket && insidePolygon(point, pocket.polygon));
}

export function uploadedBallFits(mapping: UploadedSnookerMapping, point: Point, radius = mapping.ballRadius) {
  const f = mapping.field;
  if (point.x<f.minX+radius || point.x>f.maxX-radius || point.y<f.minY+radius || point.y>f.maxY-radius) return false;
  const p = new THREE.Vector2(point.x, point.y);
  for (const s of mapping.segments) {
    const delta=s.end.clone().sub(s.start);
    const t=THREE.MathUtils.clamp(p.clone().sub(s.start).dot(delta)/delta.lengthSq(), 0, 1);
    if (p.distanceTo(s.start.clone().addScaledVector(delta,t))<radius) return false;
  }
  return !mapping.pockets.some((_, i) => uploadedPocketContains(mapping, i, point));
}

/** Exact authored cushions, including rounded jaws, with no circular jaw overlay. */
export function reflectUploadedSnookerCushions(
  ball: { pos: THREE.Vector2; vel: THREE.Vector2; lastRailHitAt?: number; lastRailHitType?: string },
  mapping: UploadedSnookerMapping, restitution: number
) {
  let impact: { type: string; normal: THREE.Vector2; tangent: THREE.Vector2 } | null = null;
  const delta=new THREE.Vector2(), offset=new THREE.Vector2(), nearest=new THREE.Vector2();
  // Two passes resolve a sphere touching adjacent facets of a rounded jaw.
  for (let pass=0; pass<2; pass++) {
    let deepest=0;
    let normal: THREE.Vector2 | null=null;
    for (const s of mapping.segments) {
      if (ball.vel.dot(s.normal)>=0) continue;
      delta.copy(s.end).sub(s.start);
      offset.copy(ball.pos).sub(s.start);
      const t=THREE.MathUtils.clamp(offset.dot(delta)/delta.lengthSq(),0,1);
      nearest.copy(s.start).addScaledVector(delta,t);
      offset.copy(ball.pos).sub(nearest);
      const distance=offset.length();
      if (distance>=mapping.ballRadius) continue;
      const penetration=mapping.ballRadius-distance;
      if (penetration>deepest) {
        deepest=penetration;
        normal=distance>1e-9 ? offset.clone().divideScalar(distance) : s.normal.clone();
        if (normal.dot(s.normal)<0) normal.negate();
      }
    }
    if (!normal) break;
    ball.pos.addScaledVector(normal,deepest+1e-6);
    const vn=ball.vel.dot(normal);
    if (vn<0) ball.vel.addScaledVector(normal,-(1+restitution)*vn);
    const tangent=new THREE.Vector2(-normal.y,normal.x);
    ball.vel.addScaledVector(tangent,-ball.vel.dot(tangent)*.04);
    impact={type:'rail',normal,tangent};
  }
  // A missed discrete contact may only be recovered away from a real pocket.
  // Do not install the old full-rectangle wall across the six mouth corridors.
  const nearPocket=mapping.pockets.some(p=>ball.pos.distanceTo(p.center)<p.radius+mapping.ballRadius*2);
  if (!impact && !nearPocket) {
    const f=mapping.field, r=mapping.ballRadius;
    const x=THREE.MathUtils.clamp(ball.pos.x,f.minX+r,f.maxX-r);
    const y=THREE.MathUtils.clamp(ball.pos.y,f.minY+r,f.maxY-r);
    if (x!==ball.pos.x || y!==ball.pos.y) {
      const normal=new THREE.Vector2(x-ball.pos.x,y-ball.pos.y).normalize();
      ball.pos.set(x,y);
      const vn=ball.vel.dot(normal);
      if (vn<0) ball.vel.addScaledVector(normal,-(1+restitution)*vn);
      impact={type:'rail',normal,tangent:new THREE.Vector2(-normal.y,normal.x)};
    }
  }
  if (impact) { ball.lastRailHitAt=performance.now(); ball.lastRailHitType=impact.type; }
  return impact;
}

/** Cloth is the anchor. Preserve the tabletop uniformly; extend only lower legs
 * to the existing arena floor so the morning character/camera coordinates stay valid. */
export function fitUploadedSnookerModel(model: THREE.Object3D, mapping: UploadedSnookerMapping, clothY: number, floorY: number) {
  model.updateMatrixWorld(true);
  const sourceFloor = new THREE.Box3().setFromObject(model).min.y;
  const legJoinY=.501;
  const targetFloorSource=mapping.clothSourceY+(floorY-clothY)/mapping.scale;
  const point=new THREE.Vector3();
  model.traverse(node=>{
    if (!(node instanceof THREE.Mesh)) return;
    const label=node.name;
    if (/^Object_(67|93|95|97|99|101|103|105)$/.test(label)) {
      node.geometry=node.geometry.clone();
      const positions=node.geometry.getAttribute('position');
      for (let i=0;i<positions.count;i++) {
        point.fromBufferAttribute(positions,i); node.localToWorld(point);
        if (point.y<legJoinY) {
          point.y=legJoinY+(point.y-legJoinY)*(legJoinY-targetFloorSource)/(legJoinY-sourceFloor);
          node.worldToLocal(point); positions.setXYZ(i,point.x,point.y,point.z);
        }
      }
      positions.needsUpdate=true; node.geometry.computeVertexNormals();
      node.geometry.computeBoundingBox(); node.geometry.computeBoundingSphere();
    }
    node.castShadow=true; node.receiveShadow=true;
    node.userData.isUploadedSnookerTable=true;
  });
  const wrapper=new THREE.Group();
  wrapper.name='mesxwi-snooker-table'; wrapper.add(model);
  // A wrapper preserves the GLB's root transform instead of overwriting it.
  wrapper.rotation.y=Math.PI;
  wrapper.scale.setScalar(mapping.scale);
  wrapper.position.set(mapping.centerX*mapping.scale,clothY-mapping.clothSourceY*mapping.scale,mapping.centerZ*mapping.scale);
  wrapper.updateMatrixWorld(true);
  return wrapper;
}
