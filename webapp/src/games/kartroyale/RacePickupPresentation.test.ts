import * as T from 'three';
import {describe,expect,it} from 'vitest';
import {RaceItemEffects,PICKUP_COLORS} from './RaceItemEffects';
import {createBoostPadLayer} from './BoostPadLayer';
import {raceItemPickups} from './raceItems.mjs';
import {boostPads} from './arcadeRules.mjs';

const track={length:800,width:8,points:[{x:0,z:0},{x:0,z:220},{x:180,z:220},{x:180,z:0}]} as any;
const named=(fx:RaceItemEffects,n:string)=>fx.group.getObjectByName(n) as T.InstancedMesh;
const matrixAt=(mesh:T.InstancedMesh,index:number)=>{const matrix=new T.Matrix4();mesh.getMatrixAt(index,matrix);return matrix;};

describe('arcade pickup presentation',()=>{
  it('keeps three category silhouettes and matching colors without moving the rule-provided coordinates',()=>{
    const fx=new RaceItemEffects();
    try{
      fx.update([],{itemCooldowns:{}} as any,track,0,true);
      const models={rocket:'Amber arcade pickup',shield:'Shield pickup outline',boost:'Boost pickup chevrons'};
      for(const [kind,name] of Object.entries(models)){
        const expected=raceItemPickups(track).filter(p=>p.kind===kind);
        const mesh=named(fx,name);
        expect(mesh.count).toBe(expected.length);
        const color=new T.Color();mesh.getColorAt(0,color);
        expect(color.getHexString()).toBe(new T.Color(PICKUP_COLORS[kind as keyof typeof PICKUP_COLORS]).getHexString());
        for(const [i,p] of expected.entries()){
          const position=new T.Vector3().setFromMatrixPosition(matrixAt(mesh,i));
          expect(position.x).toBeCloseTo(p.x);expect(position.z).toBeCloseTo(p.z);
          expect(position.y).toBeGreaterThan(.5);
        }
      }
      const shield=named(fx,models.shield);
      const ray=new T.Raycaster(new T.Vector3(0,0,1),new T.Vector3(0,0,-1));
      expect(ray.intersectObject(new T.Mesh(shield.geometry,shield.material))).toHaveLength(0);
      expect(fx.group.children).toHaveLength(8);
    }finally{fx.dispose();}
  });
  it('hides a cooled-down glyph and road locator together, with stable reduced-motion matrices',()=>{
    const fx=new RaceItemEffects();
    const shield=raceItemPickups(track).find(p=>p.kind==='shield')!;
    try{
      const me={itemCooldowns:{[shield.id]:10}} as any;
      fx.update([],me,track,1,true);
      const glyph=named(fx,'Shield pickup outline'),ring=named(fx,'Pickup road locators');
      expect(glyph.count).toBe(raceItemPickups(track).filter(p=>p.kind==='shield').length-1);
      expect(ring.count).toBe(raceItemPickups(track).length-1);
      const frozen=matrixAt(glyph,0).elements;
      fx.update([],me,track,2,true);
      expect(matrixAt(glyph,0).elements).toEqual(frozen);
      fx.update([],me,track,12,true);
      expect(ring.count).toBe(raceItemPickups(track).length);
    }finally{fx.dispose();}
  });
  it('uses two pad batches and points each arrow forward along the unmodified boost pad',()=>{
    const pads=boostPads(track),layer=createBoostPadLayer(track);
    expect(pads.length).toBeGreaterThan(2);
    const [floors,arrows]=layer.children as T.InstancedMesh[];
    expect(layer.children).toHaveLength(2);
    expect(floors.count).toBe(pads.length);expect(arrows.count).toBe(pads.length*6);
    expect((arrows.material as T.MeshBasicMaterial).color.getHexString()).toBe(new T.Color(PICKUP_COLORS.boost).getHexString());
    for(const [i,pad] of pads.entries()){
      const forward=new T.Vector3(Math.sin(pad.yaw),0,Math.cos(pad.yaw));
      for(let side=0;side<2;side++){
        const dir=side?1:-1,unit=matrixAt(arrows,i*6+side);
        const inside=new T.Vector3(-dir*.5,0,0).applyMatrix4(unit);
        const outside=new T.Vector3(dir*.5,0,0).applyMatrix4(unit);
        expect(inside.sub(outside).dot(forward)).toBeGreaterThan(.1);
      }
    }
    floors.geometry.dispose();(floors.material as T.Material).dispose();(arrows.material as T.Material).dispose();
  });
});
