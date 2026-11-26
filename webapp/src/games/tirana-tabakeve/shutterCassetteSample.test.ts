import {expect,it,vi} from 'vitest';
import * as T from 'three';
import {createQuarterCassetteSample,selectCassetteSample} from './shutterCassetteSample';
import {QUARTER} from './quarterData.mjs';
import {BRIDGE,quarterFacadeParts} from './quarterCore.mjs';

const parts=quarterFacadeParts(QUARTER.buildings.find(b=>String(b.id)==='409325648'));
const ornament=()=>{const scene=new T.Group(); const mesh=new T.Mesh(new T.BoxGeometry(2,.2,.3),new T.MeshStandardMaterial());mesh.name='tabakeve_shutter_cassette';scene.add(mesh);return {scene,mesh};};
it('selects two existing covers only, not windows, roof trim, or other building IDs',()=>{
 const selected=selectCassetteSample(parts);
 expect(selected).toHaveLength(2);
 expect(selected.every(x=>x.w===2.45&&x.h===.11&&x.d===.58)).toBe(true);
 expect(selectCassetteSample(parts.map(p=>({...p,buildingId:'other'})))).toHaveLength(0);
});
it('retains fallbacks during load and at distance, opts into replacement only once',async()=>{
 const {scene}=ornament(),load=vi.fn(async()=>scene),state=createQuarterCassetteSample(load);
 expect(state.update({x:0,z:0},parts).size).toBe(0);expect(load).not.toHaveBeenCalled();
 expect(state.update(BRIDGE,parts).size).toBe(0);expect(await state.ready).toBe(true);
 expect(state.update(BRIDGE,parts).size).toBe(2);expect(load).toHaveBeenCalledOnce();
 expect(state.update({x:0,z:0},parts).size).toBe(0);expect((state.group.children[0] as T.InstancedMesh).count).toBe(0);
 state.dispose();expect(state.group.children).toHaveLength(0);
});
it('successfully retains fallback after an asset error, and disposes late assets once',async()=>{
 const bad=createQuarterCassetteSample(async()=>{throw Error('404');});bad.update(BRIDGE,parts);expect(await bad.ready).toBe(false);
 expect(bad.update(BRIDGE,parts).size).toBe(0);
 let resolve!:(scene:T.Group)=>void;
 const late=createQuarterCassetteSample(()=>new Promise(r=>{resolve=r;}));
 const {scene,mesh}=ornament();const disposed=vi.spyOn(mesh.geometry,'dispose');
 late.update(BRIDGE,parts);late.dispose();resolve(scene);expect(await late.ready).toBe(false);expect(disposed).toHaveBeenCalledOnce();
});
