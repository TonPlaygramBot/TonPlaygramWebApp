import * as T from 'three';

export const CITY_FACADE_ATLAS = '/assets/tirana-streets/environment/civilian-wall-atlas-v1.webp';

type Tags = Record<string, string | undefined>;
const homes = new Set(['apartments', 'residential', 'house', 'detached', 'terrace', 'semidetached_house']);
const shops = new Set(['retail', 'commercial', 'office']);
const nonFinished = new Set(['construction', 'ruins', 'roof', 'shed', 'garage', 'greenhouse']);
/** IDs are rendering classes, not new survey claims. 1,2,3 are tagged
 * brick/plaster/concrete, 4,5 are intentionally representative finishes. */
export function cityFacadeClass(tags: Tags = {}): number {
  const type = tags.building || '';
  if (nonFinished.has(type) || tags.construction || tags.historic || tags.amenity || tags.military) return 0;
  switch (tags['building:material']) {
    case 'brick': return 1;
    case 'plaster': case 'stucco': return 2;
    case 'concrete': return 3;
    case undefined: case '': break;
    default: return 0;
  }
  return homes.has(type) ? 4 : shops.has(type) ? 5 : 0;
}

/** Install one asynchronously loaded atlas on the existing district material.
 * A failed request/preload leaves the stock material+geometry exactly active. */
export function installFacadePhotomaterials(material: T.MeshStandardMaterial,
  load = (url: string) => new T.TextureLoader().loadAsync(url)) {
  let dead = false;
  let atlas: T.Texture | undefined;
  const oldCompile = material.onBeforeCompile;
  const oldKey = material.customProgramCacheKey;
  const ready = load(CITY_FACADE_ATLAS).then(texture => {
    if (dead) { texture.dispose(); return false; }
    atlas = texture;
    texture.colorSpace = T.SRGBColorSpace;
    texture.minFilter = T.LinearMipmapLinearFilter;
    texture.magFilter = T.LinearFilter;
    texture.anisotropy = 2;
    material.customProgramCacheKey = () => oldKey.call(material) + ':civilian-wall-atlas-v1';
    material.onBeforeCompile = (shader, renderer) => {
      oldCompile.call(material, shader, renderer);
      shader.uniforms.cityFacadeAtlas = {value: atlas};
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float cityFacadeClass;\nvarying vec3 vCityFacade;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvCityFacade = vec3(uv, cityFacadeClass);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D cityFacadeAtlas;\nvarying vec3 vCityFacade;')
        .replace('#include <map_fragment>', `
          #include <map_fragment>
          if (vCityFacade.z > 0.5) {
            float c = vCityFacade.z;
            vec2 slot = c < 1.5 ? vec2(0.,1.) :
              c < 2.5 ? vec2(1.,1.) : c < 3.5 || c > 4.5 ? vec2(0.,0.) : vec2(1.,0.);
            vec2 repeat = c < 1.5 ? vec2(2.3, 2.5) : c < 2.5 ? vec2(2.2,1.8) : vec2(1.9);
            // Continuous mirrored repeat preserves texture derivatives at seams.
            vec2 tile = 1.0 - abs(mod(vCityFacade.xy * repeat, 2.0)-1.0);
            vec2 atlasUv = .5 * slot + (24.0 + tile * 208.0) / 512.0;
            vec3 photo = texture2D(cityFacadeAtlas, atlasUv).rgb;
            float strength = c > 3.5 ? .30 : .56;
            diffuseColor.rgb *= mix(vec3(1.), min(photo * 2.15, vec3(1.30)), strength);
          }
        `);
    };
    material.needsUpdate = true;
    return true;
  }, () => false);
  return { ready, dispose() {
    if (dead) return;
    dead = true;
    if (!atlas) return;
    material.onBeforeCompile = oldCompile;
    material.customProgramCacheKey = oldKey;
    material.needsUpdate = true;
    atlas.dispose(); atlas = undefined;
  }};
}
