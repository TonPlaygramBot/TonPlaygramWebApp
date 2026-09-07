import * as T from 'three';
import { TilesRenderer, GLTFCesiumRTCExtension } from '3d-tiles-renderer';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import {
  ecefToGameMatrix,
  GOOGLE_SESSION_MS,
  GOOGLE_TILE_PREFIX,
  googleTileUrl,
  tileBudget,
  type GoogleTileConfig
} from './shared/googleTiles.mjs';
import {
  LOCAL_MAP_STATUS,
  type CityMapStatus,
  type CityMapService
} from './mapTypes';
export type { CityMapService } from './mapTypes';

type Tile = {
  geometricError?: number;
  __visible?: boolean;
  cached?: {
    scene?: T.Object3D;
    metadata?: { asset?: { copyright?: string } };
  };
};
type TileEvent = { scene?: T.Object3D; tile?: Tile };

/** Google supplies the surroundings; the independently authored foreground remains playable. */
export class GoogleCity {
  group = new T.Group();
  status: CityMapStatus = LOCAL_MAP_STATUS;
  private tiles: TilesRenderer | null = null;
  private draco: DRACOLoader | null = null;
  private config: GoogleTileConfig | null = null;
  private generation = 0;
  private abort = new AbortController();
  private sessionAbort = new AbortController();
  private started = 0;
  private sample = 0;
  private failed = false;
  private enabled = true;
  private disposed = false;
  private materials = new WeakSet<T.Material>();
  private fade = { value: 0 };
  private center = { value: new T.Vector2() };
  private radius = { value: 145 };
  private visible = new Set<Tile>();
  private bound = new T.Box3();
  private point = new T.Vector3();
  private quality = '';
  constructor(
    private renderer: T.WebGLRenderer,
    private camera: T.Camera,
    private service: CityMapService = { configUrl: '/api/tirana-3d/config' }
  ) {
    this.group.name = 'Google Maps · streamed surroundings';
    this.group.visible = false;
    void this.configure();
  }
  private publish(
    phase: CityMapStatus['phase'],
    message: string,
    credits: string[] = []
  ) {
    if (
      this.status.phase === phase &&
      this.status.message === message &&
      this.status.credits.join(';') === credits.join(';')
    )
      return;
    this.status = {
      phase,
      message,
      credits,
      available: Boolean(this.config?.enabled)
    };
  }
  private async configure() {
    try {
      const res = await fetch(this.service.configUrl, {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: this.service.headers?.(),
        signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(10000)])
      });
      if (this.disposed) return;
      if (!res.ok) {
        this.publish(
          'unavailable',
          res.status === 401
            ? 'Google 3D · Sign in required'
            : 'Google 3D · Temporarily unavailable'
        );
        return;
      }
      const config = (await res.json()) as GoogleTileConfig;
      if (this.disposed) return;
      this.config = config;
      if (!config.enabled) {
        this.publish('local', 'Tirana · Built city');
        return;
      }
      if (
        !Number.isFinite(config.originHeight) ||
        config.root !== GOOGLE_TILE_PREFIX + '/v1/3dtiles/root.json'
      )
        throw Error('Invalid map configuration');
      if (this.enabled) this.start();
    } catch {
      if (!this.disposed)
        this.publish('unavailable', 'Google 3D · Connection unavailable');
    }
  }
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
      this.publish('local', 'Tirana · Built city');
    } else if (this.config?.enabled) this.start();
    else void this.configure();
  }
  private start() {
    if (!this.config?.enabled || this.disposed) return;
    this.stop();
    this.failed = false;
    this.sessionAbort = new AbortController();
    const sessionSignal = this.sessionAbort.signal;
    const generation = this.generation;
    this.publish('loading', 'Google 3D · Loading surroundings');
    const root = new URL(
      this.config.root,
      this.service.configUrl.startsWith('http')
        ? this.service.configUrl
        : window.location.href
    );
    const tiles = new TilesRenderer(root.href);
    this.tiles = tiles;
    tiles.group.matrixAutoUpdate = false;
    tiles.group.matrix.set(
      ...(ecefToGameMatrix(this.config.originHeight) as Parameters<
        T.Matrix4['set']
      >)
    );
    tiles.group.updateMatrixWorld(true);
    this.group.add(tiles.group);
    tiles.setCamera(this.camera);
    tiles.fetchOptions = {
      credentials: 'same-origin',
      headers: this.service.headers?.() || {}
    };
    tiles.manager.setURLModifier((uri) => {
      if (/^(blob:|data:)/.test(uri)) return uri;
      const url = new URL(uri, root);
      if (url.origin === 'https://tile.googleapis.com') {
        url.searchParams.delete('key');
        const safe = googleTileUrl(url.pathname, url.search);
        return new URL(GOOGLE_TILE_PREFIX + safe.pathname + safe.search, root)
          .href;
      }
      if (
        url.origin !== root.origin ||
        !url.pathname.startsWith(GOOGLE_TILE_PREFIX + '/')
      )
        throw Error('Invalid map resource');
      return url.href;
    });
    this.draco = new DRACOLoader()
      .setDecoderPath('/assets/tirana-streets/draco/')
      .setWorkerLimit(2);
    const loader = new GLTFLoader(tiles.manager).setDRACOLoader(this.draco);
    loader.register(() => new GLTFCesiumRTCExtension());
    tiles.manager.addHandler(/\.(gltf|glb)$/i, loader);
    tiles.manager.onError = () => {
      if (generation === this.generation) this.failed = true;
    };
    // Same-origin proxy keeps the API key on the server. Each request retains Google's session.
    tiles.registerPlugin({
      name: 'TIRANA_GOOGLE_PROXY',
      fetchData: async (url: string, options: RequestInit) => {
        const resource = new URL(url);
        if (
          resource.origin !== root.origin ||
          !resource.pathname.startsWith(GOOGLE_TILE_PREFIX + '/')
        )
          throw Error('Invalid map resource');
        try {
          const signals = [
            this.abort.signal,
            sessionSignal,
            AbortSignal.timeout(20000)
          ];
          if (options.signal) signals.push(options.signal);
          const res = await fetch(url, {
            ...options,
            signal: AbortSignal.any(signals)
          });
          if (generation === this.generation && !res.ok) this.failed = true;
          return res;
        } catch (e) {
          if (generation === this.generation && !options.signal?.aborted)
            this.failed = true;
          throw e;
        }
      }
    });
    tiles.addEventListener('load-model', (event: TileEvent) => {
      if (generation !== this.generation || !event.scene) return;
      this.patch(event.scene, true);
      event.scene.traverse((o) => {
        if (o instanceof T.Mesh) {
          o.castShadow = false;
          o.receiveShadow = false;
        }
      });
    });
    tiles.addEventListener(
      'tile-visibility-change',
      (event: TileEvent & { visible?: boolean }) => {
        if (!event.tile) return;
        if (event.visible) this.visible.add(event.tile);
        else this.visible.delete(event.tile);
      }
    );
    this.started = performance.now();
    this.quality = '';
  }
  /** Clip only static local scenery. Actors, the enterable shop and controls stay intact. */
  patch(root: T.Object3D, google = false) {
    root.traverse((object) => {
      if (!(
        object instanceof T.Mesh ||
        object instanceof T.Sprite ||
        object instanceof T.Line
      ))
        return;
      for (const mat of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        if (this.materials.has(mat)) continue;
        this.materials.add(mat);
        const previous = mat.onBeforeCompile.bind(mat),
          key = mat.customProgramCacheKey.bind(mat);
        mat.onBeforeCompile = (
          shader: Parameters<T.Material['onBeforeCompile']>[0],
          renderer: T.WebGLRenderer
        ) => {
          previous(shader, renderer);
          shader.uniforms.cityMapOn = this.fade;
          shader.uniforms.cityMapCenter = this.center;
          shader.uniforms.cityMapRadius = this.radius;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            '#include <common>\nvarying vec2 cityMapPosition;'
          );
          // The group's ECEF-to-local transform is composed on the CPU by Three.
          const vertex =
            object instanceof T.Sprite
              ? 'cityMapPosition = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;'
              : `vec4 cityMapWorld = vec4(transformed, 1.0);
              #ifdef USE_INSTANCING
                cityMapWorld = instanceMatrix * cityMapWorld;
              #endif
              cityMapPosition = (modelMatrix * cityMapWorld).xz;`;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <project_vertex>',
            vertex + '\n#include <project_vertex>'
          );
          if (object instanceof T.Sprite)
            shader.vertexShader = shader.vertexShader.replace(
              'void main() {',
              'void main() {\n' + vertex
            );
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            '#include <common>\nvarying vec2 cityMapPosition; uniform float cityMapOn; uniform vec2 cityMapCenter; uniform float cityMapRadius;'
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            'void main() {',
            `void main() {
            if (cityMapOn > 0.5 && distance(cityMapPosition, cityMapCenter) ${google ? '<' : '>'} cityMapRadius) discard;`
          );
        };
        mat.customProgramCacheKey = () =>
          key() + (google ? ':google-surroundings-v1' : ':local-city-v1');
        mat.needsUpdate = true;
      }
    });
  }
  update(center: T.Vector3, quality: string) {
    if (!this.tiles || this.disposed || document.hidden) return;
    const now = performance.now();
    if (this.failed) {
      this.stop();
      this.publish('unavailable', 'Google 3D · Unavailable; built city active');
      return;
    }
    if (now - this.started >= GOOGLE_SESSION_MS) {
      this.start();
      return;
    }
    const tiles = this.tiles;
    this.center.value.set(center.x, center.z);
    if (quality !== this.quality) {
      this.quality = quality;
      const budget = tileBudget(quality);
      tiles.errorTarget = budget.error;
      tiles.downloadQueue.maxJobs = budget.downloads;
      tiles.parseQueue.maxJobs = budget.parse;
      Object.assign(tiles.lruCache, {
        maxBytesSize: budget.bytes,
        minBytesSize: budget.bytes * 0.65,
        maxSize: budget.items,
        minSize: budget.items * 0.65
      });
    }
    this.camera.updateMatrixWorld();
    tiles.group.updateMatrixWorld(true);
    tiles.setResolutionFromRenderer(this.camera, this.renderer);
    tiles.update();
    if (now - this.sample < 750) return;
    this.sample = now;
    let detailed = false;
    const copyrights = new Set<string>();
    for (const tile of this.visible) {
      const value = tile.cached?.metadata?.asset?.copyright;
      if (value)
        value
          .split(';')
          .map((v) => v.trim())
          .filter(Boolean)
          .forEach((v) => copyrights.add(v));
      if (tile.cached?.scene && (tile.geometricError ?? Infinity) <= 30) {
        this.bound.setFromObject(tile.cached.scene);
        this.point.copy(center);
        this.point.y = this.bound.min.y;
        if (this.bound.distanceToPoint(this.point) < 550) detailed = true;
      }
    }
    // A coarse globe tile is not proof of photorealistic coverage in Tirana.
    this.group.visible = detailed;
    this.fade.value = detailed ? 1 : 0;
    if (detailed)
      this.publish('ready', 'Google 3D · Surroundings', [...copyrights].sort());
    else if (now - this.started > 45000) {
      this.stop();
      this.publish(
        'unavailable',
        'Google 3D · Detailed coverage unavailable here'
      );
    } else this.publish('loading', 'Google 3D · Loading surroundings');
  }
  private stop() {
    this.generation++;
    this.sessionAbort.abort();
    this.fade.value = 0;
    this.group.visible = false;
    this.tiles?.dispose();
    this.tiles?.group.removeFromParent();
    this.tiles = null;
    this.draco?.dispose();
    this.draco = null;
    this.visible.clear();
  }
  dispose() {
    this.disposed = true;
    this.abort.abort();
    this.stop();
    this.group.removeFromParent();
  }
}
