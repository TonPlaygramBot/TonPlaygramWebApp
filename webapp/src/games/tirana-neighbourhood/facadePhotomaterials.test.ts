import {describe,expect,it,vi} from 'vitest';
import * as T from 'three';
import {cityFacadeClass,installFacadePhotomaterials} from './facadePhotomaterials';
import {appendBuildingShell,shellGeometry} from './buildingShell';
import {NEIGHBOURHOOD} from './data.mjs';
import {HERO_IDS} from './assets.mjs';
import {COMPLETED_BUILDING_IDS} from '../tirana-city-completion/buildingRegistry.mjs';
import {NEIGHBOURHOOD_REFERENCE_PROFILES} from '../tirana-city-source/neighbourhoodProfiles.mjs';

describe('solo civilian photomaterials',()=>{
 it('keeps ambiguous/non-civilian and unfinished records unmodified',()=>{
  expect(cityFacadeClass({building:'yes'})).toBe(0);
  expect(cityFacadeClass({building:'apartments','building:material':'steel'})).toBe(0);
  expect(cityFacadeClass({building:'apartments','building:material':'brick',military:'barracks'})).toBe(0);
  expect(cityFacadeClass({building:'construction','building:material':'brick'})).toBe(0);
  expect(cityFacadeClass({building:'house','building:material':'brick'})).toBe(1);
  expect(cityFacadeClass({building:'commercial'})).toBe(5);
 });
 it('does not change topology/colour/roof/existing UV and stores only one byte per vertex',()=>{
  const home={id:'example',p:[[0,0],[10,0],[10,10],[0,10]],h:8,holes:[[[2,2],[8,2],[8,8],[2,8]]],tags:{building:'residential'}};
  const a:number[]=[],b:number[]=[],p:number[]=[],c:number[]=[],f:number[]=[];
  appendBuildingShell(home,a,b);
  appendBuildingShell(home,p,c,f);
  expect(p).toEqual(a);expect(c).toEqual(b);expect(f.filter(x=>x===0)).not.toHaveLength(0);
  const g=shellGeometry(p,c,f);
  expect(g.getAttribute('cityFacadeClass').array).toBeInstanceOf(Uint8Array);
  expect(g.getAttribute('cityFacadeClass').count).toBe(g.getAttribute('position').count);
  expect([...new Set(f)]).toEqual([0,4]);
 });
 it('fails closed and releases a late texture exactly once',async()=>{
  const material=new T.MeshStandardMaterial(),initial=material.onBeforeCompile;
  const broken=installFacadePhotomaterials(material,async()=>{throw Error('fixture 404');});
  expect(await broken.ready).toBe(false);expect(material.onBeforeCompile).toBe(initial);
  let give:(t:T.Texture)=>void;
  const waiting=installFacadePhotomaterials(material,()=>new Promise(r=>{give=r;}));
  const t=new T.Texture();const close=vi.spyOn(t,'dispose');
  waiting.dispose();give!(t);expect(await waiting.ready).toBe(false);
  waiting.dispose();expect(close).toHaveBeenCalledTimes(1);expect(material.onBeforeCompile).toBe(initial);
 });
 it('covers thousands of mapped buildings across districts without fabricating exact matches',()=>{
  const eligible=NEIGHBOURHOOD.buildings.filter(b=>!HERO_IDS.has(b.id)&&!COMPLETED_BUILDING_IDS.has(b.id)&& !NEIGHBOURHOOD_REFERENCE_PROFILES[b.id]);
  const classes=new Array(6).fill(0), cells=new Set<string>();
  for(const b of eligible){const f=cityFacadeClass(b.tags);classes[f]++;
   if(f){const [x,z]=b.p[0];cells.add(Math.floor(x/960)+':'+Math.floor(z/960));}
  }
  console.log(JSON.stringify({mapped:eligible.length,classes,covered960mCells:cells.size}));
  expect(classes[0]).toBeGreaterThan(10000);expect(classes[1]+classes[2]+classes[3]).toBeGreaterThan(10);
  expect(classes.slice(1).reduce((s,n)=>s+n,0)).toBeGreaterThan(3000);
  expect(cells.size).toBeGreaterThan(15);
 });
});
