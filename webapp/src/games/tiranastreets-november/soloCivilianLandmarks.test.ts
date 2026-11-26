import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { WORLD } from './shared/world.mjs';
import { NEIGHBOURHOOD } from '../tirana-neighbourhood/data.mjs';
import { QUARTER } from '../tirana-tabakeve/quarterData.mjs';
import { CITY_PLACES } from '../tirana-city-source/registry.mjs';
import { containsPoint } from '../tirana-landmarks/nativeLocations.mjs';
import { segmentDistance } from '../tirana-city-source/sourceCore.mjs';
import { createGramenoMemorial, GRAMENO_PLAQUE_NAME } from './GramenoMemorial';
import { balletSchoolMapPlace, BALLET_BUILDING_ID, BALLET_CAMPUS_ID, gramenoMemorial, GRAMENO_MAP_ID } from './soloCivilianLandmarks.mjs';

describe('verified Tabakëve civilian landmarks',()=>{
  it('reuses the one owned Ballet School and gives it a street-side map anchor',()=>{
    const owned=QUARTER.buildings.filter(p=>p.id===BALLET_BUILDING_ID);
    expect(owned).toHaveLength(1);
    expect(owned[0].name).toBe('Shkolla Kombëtare Koreografike');
    expect(CITY_PLACES.sites.filter(s=>s.sourceId===BALLET_CAMPUS_ID&&s.buildingId===BALLET_BUILDING_ID)).toHaveLength(1);
    const p=balletSchoolMapPlace(WORLD);
    expect(p?.name).toContain('Shkolla e Baletit');
    if(!p)throw new Error('School missing');
    const shell=WORLD.buildings.find(b=>String(b.id)===BALLET_BUILDING_ID);
    expect(containsPoint(p.x,p.z,shell.p)).toBe(false);
    const street=WORLD.roads.filter(r=>r.name==='Rruga Petro Nini Luarasi');
    expect(Math.min(...street.map(r=>segmentDistance(p.x,p.z,r.a,r.b)))).toBeLessThan(30);
    expect(balletSchoolMapPlace(WORLD,[p])).toBeNull();
    expect(balletSchoolMapPlace(WORLD,[],[])).toBeNull();
  });
  it('uses the original bust pin once and has clearance from roads',()=>{
    const existing=NEIGHBOURHOOD.places.filter(p=>p.id===GRAMENO_MAP_ID);
    expect(existing).toHaveLength(1);
    const p=gramenoMemorial();
    expect([p?.x,p?.z]).toEqual(existing[0].point);
    expect(gramenoMemorial([...existing,...existing])).toBeNull();
    if(!p)throw new Error('Memorial missing');
    expect(WORLD.roads.filter(r=>!r.walk).every(r=>segmentDistance(p.x,p.z,r.a,r.b)>(r.w||0)/2+.45)).toBe(true);
  });
  it('finishes the original bust without moving it or copying the original artwork',()=>{
    const statue=createGramenoMemorial(material => { material.userData.reusedFinish = true; });
    expect(statue?.children).toHaveLength(3);
    expect(statue?.userData.realWorkReplicated).toBe(false);
    if(!statue)throw new Error('Bust missing');
    const bounds=new T.Box3().setFromObject(statue);
    expect(bounds.getSize(new T.Vector3()).y).toBeCloseTo(1.927,2);
    const [base,figure,plaque] = statue.children as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>[];
    expect(base.material.userData.reusedFinish).toBe(true);
    expect(figure.material.userData.reusedFinish).toBeUndefined();
    expect(plaque.name).toBe(GRAMENO_PLAQUE_NAME);
    expect(plaque.castShadow).toBe(false);
    expect(plaque.position.z - .57/2).toBeCloseTo(.004,3);
    const baseSize=new T.Box3().setFromObject(base).getSize(new T.Vector3());
    expect(baseSize.y).toBeCloseTo(1,3);
    expect(base.geometry.getAttribute('position').count).toBeLessThan(350);
    for(const o of statue.children){
      expect(o).toBeInstanceOf(T.Mesh);
      const {geometry,material}=o as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
      material.map?.dispose();
      expect(geometry.getAttribute('position').count).toBeLessThan(10000);
      geometry.dispose();material.dispose();
    }
  });
});
