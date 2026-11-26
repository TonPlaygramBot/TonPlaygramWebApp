import * as T from 'three';
import { describe, expect, it, vi } from 'vitest';
import { mountTabakeveMasonry, TABAKEVE_MASONRY_URL } from './tabakeveMasonry';

function fixture() {
  const bridge=new T.Group();bridge.name='Ura e Tabakëve:authored-stone-pedestrian-bridge';
  const fallback=new T.MeshStandardMaterial({map:new T.Texture()});
  const s = new T.Shape([new T.Vector2(0,0),new T.Vector2(1,0),new T.Vector2(1,1)]);
  const sides=[new T.Mesh(new T.ShapeGeometry(s),fallback),new T.Mesh(new T.ShapeGeometry(s),fallback)];
  const deck=new T.Mesh(new T.BoxGeometry(1,1,1),fallback);
  bridge.add(...sides,deck);
  return {bridge,fallback,sides,deck};
}

describe('Tirana Tabakëve bridge photo-colour layer',()=>{
  it('swaps only two existing sidewalls to one shared material without new geometry or deck change',async()=>{
    const {bridge,fallback,sides,deck}=fixture();
    const geometries=bridge.children.map(o=>(o as T.Mesh).geometry);
    const image=new T.Texture(),load=vi.fn(async (_url:string)=>image);
    const mounted=mountTabakeveMasonry(bridge,load);
    expect(await mounted.ready).toBe(true);
    expect(load).toHaveBeenCalledExactlyOnceWith(TABAKEVE_MASONRY_URL);
    expect(sides[0].material).toBe(sides[1].material);
    expect(sides[0].material).not.toBe(fallback);
    expect(sides[0].material.map).toBe(image);
    expect(deck.material).toBe(fallback);
    expect(image.wrapS).toBe(T.MirroredRepeatWrapping);
    expect(image.colorSpace).toBe(T.SRGBColorSpace);
    expect(bridge.children.map(o=>(o as T.Mesh).geometry)).toEqual(geometries);
    const release=vi.spyOn(image,'dispose');
    mounted.dispose();mounted.dispose();
    expect(sides.every(w=>w.material===fallback)).toBe(true);
    expect(release).toHaveBeenCalledTimes(1);
  });
  it('skips unrecognized meshes and preserves fallback on failed load',async()=>{
    const {bridge,fallback,sides}=fixture();
    const load=vi.fn(async (_url:string)=>{throw new Error('404');});
    expect(await mountTabakeveMasonry(new T.Group(),load).ready).toBe(false);
    expect(load).not.toHaveBeenCalled();
    expect(await mountTabakeveMasonry(bridge,load).ready).toBe(false);
    expect(sides.every(w=>w.material===fallback)).toBe(true);
  });
  it('releases a texture that resolves after renderer teardown',async()=>{
    const {bridge,fallback,sides}=fixture(),image=new T.Texture();
    const release=vi.spyOn(image,'dispose');
    const mounted=mountTabakeveMasonry(bridge,async()=>image);
    mounted.dispose();
    expect(await mounted.ready).toBe(false);
    expect(sides.every(w=>w.material===fallback)).toBe(true);
    expect(release).toHaveBeenCalledTimes(1);
  });
});
