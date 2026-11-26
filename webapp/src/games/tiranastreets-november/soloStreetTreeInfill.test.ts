import {describe,it,expect} from 'vitest';
import {CITY_COMPLETION} from '../tirana-city-completion/data.mjs';
import {insidePolygon} from './shared/engine.mjs';
import {SOLO_SIGNAL_FIXTURES,onCarriageway,segmentDistance} from './shared/streetLayout.mjs';
import {WORLD} from './shared/world.mjs';
import {SOLO_STREET_TREE_INFILL} from './soloStreetTreeInfill';

const old = [[1350.02,9.03],[861.02,-31.33],[1310.24,8],[926.84,-22.24],[1476.34,-81.41],[1123.17,-28.79],[1345.41,-.52]];
const ali = SOLO_STREET_TREE_INFILL.filter(t=>t.id.startsWith('solo-verge-tree/1/'));
const fixtures=SOLO_SIGNAL_FIXTURES;
const renderedLights=[...fixtures,...CITY_COMPLETION.fixtures.filter(p=>p.kind==='traffic_signals' &&
 !fixtures.some(s=>s.id===p.id||Math.hypot(s.point[0]-p.point[0],s.point[1]-p.point[1])<9))];
const clearance=(x:number,z:number)=>Math.min(...renderedLights.map(s=>Math.hypot(s.x-x,s.z-z)));
const road = WORLD.roads.filter(r=>!r.walk&&r.name==='Rruga Ali Demi');
const sideOfRoad=(x:number,z:number)=>{
 let nearest=road[0];
 for(const r of road) if(segmentDistance(x,z,r.a,r.b)<segmentDistance(x,z,nearest.a,nearest.b))nearest=r;
 const [a,b]=[nearest.a,nearest.b],dx=b[0]-a[0],dz=b[1]-a[1];
 return Math.sign(dx)*Math.sign(dx*(z-a[1])-dz*(x-a[0]));
};

describe('Ali Demi signal clearance',()=>{
 it('identifies exactly the prior three decorative trunks under 9 m and moves only them',()=>{
   expect(old.map(([x,z],i)=>clearance(x,z)<9?i:-1).filter(i=>i>=0)).toEqual([0,2,6]);
   expect(ali.map((t,i)=>t.x!==old[i][0]||t.z!==old[i][1]?i:-1).filter(i=>i>=0)).toEqual([0,2,6]);
   expect(ali.every(t=>clearance(t.x,t.z)>=10)).toBe(true);
 });
 it('preserves the site side and tree silhouette, outside roads, walking paths and buildings',()=>{
   for(const i of [0,2,6]){
     const t=ali[i],{x,z}=t;
     expect(sideOfRoad(x,z)).toBe(sideOfRoad(old[i][0],old[i][1]));
     expect(t.seed).toBe(2500+i);
     expect(t.shape).toBe('umbrella');
     expect(t.height).toBeCloseTo(8.4+(i%5)*.58);
     expect(t.crown).toBeCloseTo(4.6+(i%3)*.33);
     expect(onCarriageway(x,z,.65)).toBe(false);
     expect(WORLD.roads.some(r=>r.walk&&segmentDistance(x,z,r.a,r.b)<r.w/2+.6)).toBe(false);
     expect(WORLD.buildings.some(b=>insidePolygon(x,z,b.p)||b.p.some((a,j)=>segmentDistance(x,z,a,b.p[(j+1)%b.p.length])<.7))).toBe(false);
   }
 });
});
