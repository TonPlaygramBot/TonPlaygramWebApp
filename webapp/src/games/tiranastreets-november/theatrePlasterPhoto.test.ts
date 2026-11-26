import {it,expect,vi} from 'vitest';
import * as T from 'three';
import {ReferenceFacades} from '../tirana-city-source/ReferenceFacades';
import {installTheatrePlasterPhoto,THEATRE_PLASTER_URL} from './theatrePlasterPhoto';

const staged=()=>{const facade=new ReferenceFacades(undefined,new Set(['236566862']));
 const mapped=facade.group.children.find(c=>c.userData.osmWay==='236566862')!;
 const mesh=mapped.children.find(c=>c instanceof T.Mesh&&c.material.color?.getHex()===13343121) as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
 return {facade,mapped,mesh,opts:{root:facade.group,isDisposed:()=>false,maxAnisotropy:8}};
};
it('reuses the actual existing theatre batch, leaves model/collision alone, and restores fallback on release',async()=>{
 const {facade,mapped,mesh,opts}=staged();
 const shared=mesh.material,position=mesh.geometry.getAttribute('position'),uv=mesh.geometry.getAttribute('uv');
 const count=mapped.children.length,tex=new T.Texture(),disposed=vi.spyOn(tex,'dispose');
 const load=vi.fn(async()=>tex);
 const release=await installTheatrePlasterPhoto({...opts,load});
 expect(load).toHaveBeenCalledWith(THEATRE_PLASTER_URL);
 expect(mapped.children.length).toBe(count);
 expect(mesh.material).not.toBe(shared);expect(mesh.material.map).toBe(tex);expect(shared.map).toBeNull();
 expect(mesh.geometry.getAttribute('position')).toBe(position);
 expect(mesh.geometry.getAttribute('uv').count).toBe(position.count);
 expect(Array.from(mesh.geometry.getAttribute('uv').array).every(Number.isFinite)).toBe(true);
 expect(tex.colorSpace).toBe(T.SRGBColorSpace);expect(tex.anisotropy).toBe(4);
 release!();release!();
 expect(mesh.material).toBe(shared);expect(mesh.geometry.getAttribute('uv')).toBe(uv);expect(disposed).toHaveBeenCalledTimes(1);
 facade.dispose();
});
it('keeps the original material when the image fails or another active image is resolving twice',async()=>{
 const {facade,mesh,opts}=staged();const original=mesh.material;
 expect(await installTheatrePlasterPhoto({...opts,load:async()=>{throw Error('404')}})).toBeUndefined();
 expect(mesh.material).toBe(original);
 const a=new T.Texture(),b=new T.Texture(),dispose=vi.spyOn(b,'dispose');
 const out=await Promise.all([installTheatrePlasterPhoto({...opts,load:async()=>a}),installTheatrePlasterPhoto({...opts,load:async()=>b})]);
 expect(out.filter(Boolean).length).toBe(1);expect(dispose).toHaveBeenCalledTimes(1);out[0]!();facade.dispose();
});
it('does not fetch on an unrelated building or change a departed scene',async()=>{
 const {facade,opts,mesh}=staged(),original=mesh.material;
 const tex=new T.Texture(),dispose=vi.spyOn(tex,'dispose');let closed=false;
 const load=vi.fn(async()=>{closed=true;return tex;});
 expect(await installTheatrePlasterPhoto({...opts,root:new T.Group(),load})).toBeUndefined();
 expect(load).not.toHaveBeenCalled();
 expect(await installTheatrePlasterPhoto({...opts,isDisposed:()=>closed,load})).toBeUndefined();
 expect(dispose).toHaveBeenCalledTimes(1);expect(mesh.material).toBe(original);facade.dispose();
});
