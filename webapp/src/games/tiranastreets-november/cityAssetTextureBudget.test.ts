import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { prepareCityAssetTextures } from './CityAssetLoader';

const sceneWith = (...materials: T.Material[]) => {
  const scene = new T.Scene();
  for (const material of materials) scene.add(new T.Mesh(new T.PlaneGeometry(), material));
  return scene;
};
const cityBudget = { scalarMapLimit: 2 };

describe('Tirana Streets core city texture sampling budget', () => {
  it('keeps authored color, normal, alpha and emissive maps sharp and limits scalar channels without changing their pixels or encoding', () => {
    const map = new T.Texture({ width: 512, height: 512 });
    map.colorSpace = T.SRGBColorSpace;
    map.wrapS = T.RepeatWrapping;
    map.offset.set(0.25, 0.5);
    const normalMap = new T.Texture(), alphaMap = new T.Texture(), emissiveMap = new T.Texture(), roughnessMap = new T.Texture();
    const material = new T.MeshStandardMaterial({
      map, normalMap, alphaMap, emissiveMap, roughnessMap, metalnessMap: roughnessMap,
      color: 'tan', alphaTest: 0.3, transparent: true, roughness: 0.42,
    });
    const state = {
      image: map.image, color: material.color.getHex(), minFilter: map.minFilter,
      alphaTest: material.alphaTest,
    };
    const scene = sceneWith(material);
    prepareCityAssetTextures(scene, 16, cityBudget);
    expect([map, normalMap, alphaMap, emissiveMap].map(texture => texture.anisotropy)).toEqual([8, 8, 8, 8]);
    expect(roughnessMap.anisotropy).toBe(2);
    expect(material.metalnessMap).toBe(roughnessMap);
    expect(roughnessMap.colorSpace).toBe(T.NoColorSpace);
    expect(map.image).toBe(state.image);
    expect(map.minFilter).toBe(state.minFilter);
    expect(map.colorSpace).toBe(T.SRGBColorSpace);
    expect(map.wrapS).toBe(T.RepeatWrapping);
    expect(map.offset.toArray()).toEqual([0.25, 0.5]);
    expect(material.color.getHex()).toBe(state.color);
    expect(material.alphaTest).toBe(state.alphaTest);
    expect(material.transparent).toBe(true);
    expect(material.roughness).toBe(0.42);
    const versions = [map.version, roughnessMap.version, map.source.version];
    prepareCityAssetTextures(scene, 16, cityBudget);
    expect([map.version, roughnessMap.version, map.source.version]).toEqual(versions);
  });

  it('prioritizes full detail for cross-role reuse, including UV transform clones of the same source', () => {
    const shared = new T.Texture();
    const uvClone = shared.clone();
    uvClone.offset.x = 0.5;
    const scalarOnly = new T.Texture();
    const scene = sceneWith(
      new T.MeshStandardMaterial({ roughnessMap: shared, aoMap: scalarOnly }),
      new T.MeshStandardMaterial({ map: shared, metalnessMap: uvClone }),
    );
    prepareCityAssetTextures(scene, 16, cityBudget);
    expect([shared.anisotropy, uvClone.anisotropy, scalarOnly.anisotropy]).toEqual([8, 8, 2]);
  });

  it('skips sampler changes that WebGL ignores and supports textures with baked mipmaps', () => {
    const noMips = new T.Texture(), noMipFilter = new T.Texture(), nearest = new T.Texture();
    const manual = new T.Texture();
    noMips.generateMipmaps = false;
    noMipFilter.minFilter = T.LinearFilter;
    nearest.magFilter = T.NearestFilter;
    manual.generateMipmaps = false;
    manual.mipmaps = [{ width: 4, height: 4 }, { width: 2, height: 2 }, { width: 1, height: 1 }];
    prepareCityAssetTextures(sceneWith(new T.MeshStandardMaterial({
      map: noMips, normalMap: noMipFilter, alphaMap: nearest, roughnessMap: manual,
    })), 16, cityBudget);
    expect([noMips, noMipFilter, nearest].map(texture => [texture.anisotropy, texture.version])).toEqual([[1, 0], [1, 0], [1, 0]]);
    expect(manual.anisotropy).toBe(2);
  });

  it('keeps legacy callers unchanged and respects device caps', () => {
    const roughnessMap = new T.Texture();
    const scene = sceneWith(new T.MeshStandardMaterial({ roughnessMap }));
    prepareCityAssetTextures(scene, 16);
    expect(roughnessMap.anisotropy).toBe(8);
    prepareCityAssetTextures(scene, 1, cityBudget);
    expect(roughnessMap.anisotropy).toBe(1);
    const version = roughnessMap.version;
    prepareCityAssetTextures(scene, Number.NaN, cityBudget);
    expect(roughnessMap.version).toBe(version);
  });
});
