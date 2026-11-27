import * as T from 'three';

export const CITY_FACADE_ATLAS = '/assets/tirana-streets/environment/civilian-wall-atlas-v1.webp';

type Tags = Record<string, string | undefined>;
const homes = new Set(['apartments', 'residential', 'house', 'detached', 'terrace', 'semidetached_house']);
const shops = new Set(['retail', 'commercial', 'office']);
const nonFinished = new Set(['construction', 'ruins', 'roof', 'shed', 'garage', 'greenhouse']);
/** IDs are rendering classes, not survey claims. 1–3 are specified materials;
 * 4–6 are representative residential, retail or generic civilian finishes. */
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
  return homes.has(type) ? 4 : shops.has(type) ? 5 : type === 'yes' ? 6 : 0;
}

/** The window fallback is immediate and independent of texture availability.
 * When loaded, the existing licensed atlas adds surface detail to the same draw. */
export function installFacadePhotomaterials(material: T.MeshStandardMaterial,
  load: (url: string) => Promise<T.Texture> = url => new T.TextureLoader().loadAsync(url), loadTextures = true) {
  let dead = false;
  const atlas = {value: null as T.Texture | null};
  const atlasReady = {value: 0};
  const oldCompile = material.onBeforeCompile;
  const oldKey = material.customProgramCacheKey;
  material.customProgramCacheKey = () => oldKey.call(material) + ':civilian-facade-bays-v3';
  material.onBeforeCompile = (shader, renderer) => {
    oldCompile.call(material, shader, renderer);
    shader.uniforms.cityFacadeAtlas = atlas;
    shader.uniforms.cityFacadeAtlasReady = atlasReady;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float cityFacadeClass;\nattribute vec4 cityWindow;\nvarying vec3 vCityFacade;\nvarying vec3 vCityWindow;\nvarying vec2 vCityWindowSize;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvCityFacade = vec3(uv, cityFacadeClass);\nvCityWindow = cityWindow.xyz * vec3(24.,128.,128.) - vec3(0.,2.,0.);\nfloat baySize = floor(cityWindow.w * 65535. + .5);\nvCityWindowSize = vec2(floor(baySize / 256.), mod(baySize, 256.)) / 510.;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D cityFacadeAtlas;\nuniform float cityFacadeAtlasReady;\nvarying vec3 vCityFacade;\nvarying vec3 vCityWindow;\nvarying vec2 vCityWindowSize;')
      .replace('#include <map_fragment>', `
        #include <map_fragment>
        if (vCityFacade.z > 0.5 && cityFacadeAtlasReady > 0.5) {
          float c = vCityFacade.z;
          vec2 slot = c < 1.5 ? vec2(0.,1.) : c < 2.5 || c > 5.5 ? vec2(1.,1.) :
            c < 3.5 || c > 4.5 ? vec2(0.,0.) : vec2(1.,0.);
          vec2 repeat = c < 1.5 ? vec2(2.3, 2.5) : c < 2.5 ? vec2(2.2,1.8) : vec2(1.9);
          vec2 tile = 1.0 - abs(mod(vCityFacade.xy * repeat, 2.0)-1.0);
          vec2 atlasUv = .5 * slot + (24.0 + tile * 208.0) / 512.0;
          vec3 photo = texture2D(cityFacadeAtlas, atlasUv).rgb;
          float strength = c > 5.5 ? .22 : c > 3.5 ? .30 : .56;
          diffuseColor.rgb *= mix(vec3(1.), min(photo * 2.15, vec3(1.30)), strength);
        }
        // Window lines soften before they become smaller than a pixel.
        vec2 aa = max(fwidth(vCityWindow.xy), vec2(.003));
        if (vCityWindow.z > .5 && vCityWindow.y > 0. && vCityWindow.y < vCityWindow.z) {
          vec2 cell = fract(vCityWindow.xy);
          vec2 d = abs(cell - .5);
          vec2 edgeAA = min(aa, max(vCityWindowSize * .5, vec2(.0001)));
          vec2 aperture = 1. - smoothstep(vCityWindowSize-edgeAA,vCityWindowSize+edgeAA,d);
          float coverage = aperture.x * aperture.y * (1. - smoothstep(.08,.32,max(aa.x,aa.y)));
          float topGlint = .84 + .16*smoothstep(.44,.67,cell.y);
          vec3 glazing = diffuseColor.rgb*vec3(.30,.41,.48)*topGlint + vec3(.022,.038,.050);
          diffuseColor.rgb = mix(diffuseColor.rgb, glazing, coverage*.82);
        }
      `);
  };
  material.needsUpdate = true;
  const ready = loadTextures ? load(CITY_FACADE_ATLAS).then(texture => {
    if (dead) { texture.dispose(); return false; }
    atlas.value = texture;
    texture.colorSpace = T.SRGBColorSpace;
    texture.minFilter = T.LinearMipmapLinearFilter;
    texture.magFilter = T.LinearFilter;
    texture.anisotropy = 2;
    atlasReady.value = 1;
    return true;
  }, () => false) : Promise.resolve(false);
  return { ready, dispose() {
    if (dead) return;
    dead = true;
    material.onBeforeCompile = oldCompile;
    material.customProgramCacheKey = oldKey;
    material.needsUpdate = true;
    atlas.value?.dispose(); atlas.value = null; atlasReady.value = 0;
  }};
}
