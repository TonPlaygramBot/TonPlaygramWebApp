import * as T from 'three';
import polygonClipping from 'polygon-clipping';
import {HYDROGRAPHY} from './hydrography.mjs';

export type WaterPath = {id: string; line: number[][]; width: number; lana?: boolean};
export const WATER_LEVEL = -2.85;
export const BED_LEVEL = -3.35;
export const BANK_LEVEL = .025;
export const BANK_WIDTH = 6.8;

/** Bounded miter joins maintain a constant channel width through river bends. */
export function offsetRiver(line: number[][], offset: number) {
  return line.map((p, i) => {
    const normal = (a: number[], b: number[]) => {
      const dx = b[0]-a[0], dz = b[1]-a[1], length = Math.hypot(dx,dz) || 1;
      return [dz/length, -dx/length];
    };
    const a = normal(line[Math.max(0,i-1)], i ? p : line[1]);
    const b = normal(i < line.length-1 ? p : line[i-1], line[Math.min(line.length-1,i+1)]);
    const nx = a[0]+b[0], nz = a[1]+b[1], length = Math.hypot(nx,nz);
    if (length < .01) return [p[0]+b[0]*offset,p[1]+b[1]*offset];
    const scale = offset / Math.max(.5,(nx*b[0]+nz*b[1])/length);
    return [p[0]+nx/length*scale,p[1]+nz/length*scale];
  });
}
export function riverRing(path: WaterPath, margin = BANK_WIDTH) {
  return [...offsetRiver(path.line,path.width/2+margin),...offsetRiver(path.line,-path.width/2-margin).reverse()];
}
export const WATER_PATHS: WaterPath[] = HYDROGRAPHY.paths;
export const CHANNEL_RINGS = WATER_PATHS.map(p => riverRing(p));
const boundsOf = (p: number[][]) => [Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))];
const channelBounds = CHANNEL_RINGS.map(boundsOf);

/** Used for the base ground AND every overlaid park/paving surface. */
export function cutChannels(polygon: number[][], holes: number[][][] = []) {
  const box = boundsOf(polygon);
  const cuts = CHANNEL_RINGS.filter((_,i) => {
    const b=channelBounds[i];return b[0]<=box[2] && b[2]>=box[0] && b[1]<=box[3] && b[3]>=box[1];
  });
  return (cuts.length ? polygonClipping.difference([polygon,...holes] as any,...cuts.map(p=>[p]) as any) : [[polygon,...holes]]) as number[][][][];
}
export function surfaceGeometry(rings: number[][][], y: number, metres = 3) {
  const shape = new T.Shape(rings[0].map(p=>new T.Vector2(p[0],-p[1])));
  for (const hole of rings.slice(1)) shape.holes.push(new T.Path(hole.map(p=>new T.Vector2(p[0],-p[1]))));
  const geometry = new T.ShapeGeometry(shape).rotateX(-Math.PI/2).translate(0,y,0);
  const p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
  for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/metres,p.getZ(i)/metres);
  return geometry;
}
export function bankGeometry(path: WaterPath, inner: number, y0: number, outer: number, y1: number) {
  const a=offsetRiver(path.line,inner),b=offsetRiver(path.line,outer),positions:number[]=[],uv:number[]=[];
  let distance=0;
  for(let i=1;i<a.length;i++){
    const length=Math.hypot(path.line[i][0]-path.line[i-1][0],path.line[i][1]-path.line[i-1][1]);
    const corners=[[a[i-1][0],y0,a[i-1][1]],[b[i-1][0],y1,b[i-1][1]],[a[i][0],y0,a[i][1]],[b[i][0],y1,b[i][1]]];
    const order=outer>inner?[0,2,1,2,3,1]:[0,1,2,2,1,3];
    const across=Math.hypot(outer-inner,y1-y0)/2.5;
    for(const j of order){positions.push(...corners[j]);uv.push((distance+(j>1?length:0))/2.5,j%2?across:0);}
    distance+=length;
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();
  return geometry;
}
