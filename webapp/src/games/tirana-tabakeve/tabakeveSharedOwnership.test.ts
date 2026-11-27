// @vitest-environment jsdom
import * as T from 'three';
import {expect,it,vi} from 'vitest';
import {BRIDGE} from './quarterCore.mjs';
import {TabakeveQuarterLayer} from './TabakeveQuarterLayer';
import {TABAKEVE_MASONRY_URL} from './tabakeveMasonry';

it('shares one visible-only masonry mount and keeps the race ribbon exclusion',async()=>{
 const context=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(
  (()=>new Proxy({}, {get:(o,key)=>Reflect.has(o,key)?Reflect.get(o,key):()=>{}})) as typeof HTMLCanvasElement.prototype.getContext);
 const load=vi.spyOn(T.TextureLoader.prototype,'loadAsync').mockImplementation(async()=>new T.Texture());
 const clear=new TabakeveQuarterLayer({profile:'fps'});
 const blocked=new TabakeveQuarterLayer({profile:'fps',track:{width:9,points:[
  {x:BRIDGE.x-20,z:BRIDGE.z},{x:BRIDGE.x+20,z:BRIDGE.z}
 ]}});
 try{
  clear.update(0,{x:BRIDGE.x+185,z:BRIDGE.z},true);
  blocked.update(0,BRIDGE,true);
  expect(blocked.bridge.visible).toBe(false);
  expect(load).not.toHaveBeenCalled();
  clear.update(1,BRIDGE,true);clear.update(2,BRIDGE,true);await Promise.resolve();
  expect(clear.bridge.visible).toBe(true);
  expect(load).toHaveBeenCalledExactlyOnceWith(TABAKEVE_MASONRY_URL);
  const photo=clear.bridge.children.filter(x=>(x as T.Mesh).material instanceof T.Material
    && ((x as T.Mesh).material as T.Material).name.includes('photo masonry'));
  expect(photo.length).toBe(2);
 }finally{clear.dispose();blocked.dispose();context.mockRestore();load.mockRestore();}
});
