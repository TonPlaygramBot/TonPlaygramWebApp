import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { loadSoloFacadeTextures } from './soloFacadeTextures';

describe('solo city photographic shell materials', () => {
  it('assigns four shared sRGB image textures without replacing tints or geometry', async () => {
    const materials = Array.from({length:8}, () => new THREE.MeshStandardMaterial({color:0xe1d2b7}));
    const worldTextures = new Set<THREE.Texture>();
    const load = vi.fn(async (_url: string) => new THREE.Texture());
    await loadSoloFacadeTextures({ materials, worldTextures, maxAnisotropy:12, isDisposed:() => false, load });
    expect(load).toHaveBeenCalledTimes(4);
    expect(load.mock.calls.every(([url]) => url.startsWith('/assets/tirana-streets/environment/solo-'))).toBe(true);
    expect(worldTextures.size).toBe(4);
    expect(materials[0].map).toBe(materials[5].map);
    expect(materials[1].map).not.toBe(materials[0].map);
    expect(materials[0].map?.repeat.toArray()).toEqual([1.25,1.25]);
    expect(materials[4].map).not.toBe(materials[1].map);
    expect(materials[4].map?.wrapS).toBe(THREE.MirroredRepeatWrapping);
    expect(materials[4].map?.repeat.toArray()).toEqual([5 / .82, 5 / 1.75]);
    expect(materials[3].map?.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(materials[3].map?.anisotropy).toBe(4);
    expect(materials.every(m => m.color.getHex() === 0xe1d2b7)).toBe(true);
  });

  it('preserves the existing fallback for a failed family and does not dispose referenced fallback clones', async () => {
    const keep = new THREE.Texture(), replace = new THREE.Texture(), external = new THREE.Texture();
    const keepDispose = vi.spyOn(keep,'dispose'), replaceDispose = vi.spyOn(replace,'dispose'), externalDispose = vi.spyOn(external,'dispose');
    const materials = Array.from({length:8}, () => new THREE.MeshStandardMaterial());
    materials[0].map=materials[2].map=keep;
    materials[1].map=materials[4].map=replace;
    materials[1].normalMap=external;
    const worldTextures = new Set([keep,replace]);
    await loadSoloFacadeTextures({ materials, worldTextures, maxAnisotropy:1, isDisposed:() => false,
      load: async (url) => { if (url.endsWith('.webp')) throw new Error('image unavailable'); return new THREE.Texture(); } });
    expect(materials[0].map).toBe(keep);
    expect(materials[4].map).toBe(replace);
    expect(keepDispose).not.toHaveBeenCalled();
    expect(replaceDispose).not.toHaveBeenCalled();
    expect(externalDispose).not.toHaveBeenCalled();
    expect(materials[1].normalMap).toBe(null);
  });

  it('disposes a delayed texture if the player leaves before it arrives', async () => {
    const materials = Array.from({length:8}, () => new THREE.MeshStandardMaterial());
    const worldTextures = new Set<THREE.Texture>();
    const pending = Array.from({length:4}, () => {
      let finish: (t: THREE.Texture) => void = () => {};
      const p = new Promise<THREE.Texture>(r => { finish = r; });
      return { p, finish };
    });
    let disposed=false,i=0;
    const run=loadSoloFacadeTextures({materials,worldTextures,maxAnisotropy:2,isDisposed:()=>disposed,load:()=>pending[i++].p});
    disposed=true;
    const late = pending.map(p => { const t=new THREE.Texture(),dispose=vi.spyOn(t,'dispose');p.finish(t);return dispose; });
    await run;
    expect(late.every(fn=>fn.mock.calls.length===1)).toBe(true);
    expect(worldTextures.size).toBe(0);
    expect(materials.every(m=>m.map===null)).toBe(true);
  });
});
