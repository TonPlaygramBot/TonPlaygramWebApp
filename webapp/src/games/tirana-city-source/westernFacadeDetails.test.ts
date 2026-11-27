import * as T from 'three';
import {describe,expect,it} from 'vitest';
import {WORLD as race} from '../tiranastreets/shared/world.mjs';
import {WORLD as streets} from '../tiranastreets-november/shared/world.mjs';
import {facadeEdges} from './sourceCore.mjs';
import {WESTERN_FACADE_PROFILES as profiles} from './westernFacadeProfiles.mjs';
import {NEIGHBOURHOOD_REFERENCE_PROFILES,OBSERVED_HEIGHTS} from './neighbourhoodProfiles.mjs';
import {westernFacadeDetails} from './WesternFacadeDetails';
describe('western mapped streetscape',()=>{
 for(const id of ['712391761','1162828946','256326439','659804576','1127816735'])it('fits mapped exterior '+id,()=>{
  const b=race.buildings.find(x=>x.id===id),s=streets.buildings.find(x=>x.id===id),p=profiles[id];
  expect(b).toBeTruthy();
  expect(s?.p).toEqual(b?.p);
  expect(s?.h).toEqual(b?.h);
  expect(OBSERVED_HEIGHTS[id]).toBeUndefined();
  expect(NEIGHBOURHOOD_REFERENCE_PROFILES[id]).toBe(p);
  expect(p.photo).toBeNull();
  const height=p.height??b!.h, edges=facadeEdges(b!.p);
  const layers=new Set<number>();let triangles=0,arrows=0,highest=0;
  const add=(color:number,g:T.BufferGeometry)=>{
   const attr=g.getAttribute('position');
   for(let i=0;i<attr.count;i++)expect(Number.isFinite(attr.getX(i)+attr.getY(i)+attr.getZ(i))).toBe(true);
   triangles+=(g.index?.count??attr.count)/3;
   if(color===0xd3ce92)arrows++;
   layers.add(color);g.dispose();
  };
  expect(westernFacadeDetails(p,edges,height,add,(e,color,u,y,w,h,d,off)=>{
   expect(u-w/2).toBeGreaterThanOrEqual(-.01);
   expect(u+w/2).toBeLessThanOrEqual(e.length+.01);
   expect(y-h/2).toBeGreaterThanOrEqual(0);
   highest=Math.max(highest,y+h/2);
   triangles+=d>.2?12:2;layers.add(color);
  })).toBe(true);
  expect(highest).toBeLessThanOrEqual(height+.03);
  expect(triangles).toBeGreaterThan(200);
  expect(triangles).toBeLessThan(10000);
  expect(layers.size).toBeLessThan(12);
  if(id==='712391761')expect(arrows).toBeGreaterThan(10);
  else expect(arrows).toBe(0);
 });
});

it('mounts original raised Marinaj lettering on the single photographed road-facing roofline',()=>{
 const b=race.buildings.find(x=>x.id==='1162828946')!,p=profiles[b.id],edges=facadeEdges(b.p);
 const front=edges.find(e=>e.length>=20&&e.nx>.5&&e.nz<-.5)!;
 const details:T.Vector3[]=[];
 westernFacadeDetails(p,edges,p.height!, (color,geo)=>{
  if(color===0xf4f2e7){
   const xyz=geo.getAttribute('position');
   for(let i=0;i<xyz.count;i++)details.push(new T.Vector3(xyz.getX(i),xyz.getY(i),xyz.getZ(i)));
  }
  geo.dispose();
 },()=>{});
 expect(details.length).toBeGreaterThan(500);
 expect(details.every(v=>v.y>p.height!-2&&v.y<p.height!)).toBe(true);
 const depth=details.map(v=>(v.x-front.x)*front.nx+(v.z-front.z)*front.nz);
 expect(Math.max(...depth)-Math.min(...depth)).toBeGreaterThan(.11);
 expect(depth.every(x=>x>.22&&x<.44)).toBe(true);
});
