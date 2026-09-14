import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import {
  createMurlanStyleTable,
  applyTableMaterials
} from '../../utils/murlanTable.js';
import { backgammonHdriUrls } from './graphics.ts';

export function disposeBackgammonObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material)
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(
        (material) => {
          materials.add(material);
          Object.values(material).forEach((value) => {
            if (value instanceof THREE.Texture) textures.add(value);
          });
        }
      );
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  root.removeFromParent();
}

function loadAsset(
  loader: any,
  url: string,
  disposeLate: (value: any) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      reject(new Error('Asset load timed out'));
    }, 15000);
    loader.load(
      url,
      (value: any) => {
        if (settled) {
          disposeLate(value);
          return;
        }
        settled = true;
        clearTimeout(timeout);
        resolve(value);
      },
      undefined,
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

// Same Poly Haven manifest/include mapping as Murlan, with a Backgammon-owned
// lifecycle. Failed or superseded requests never replace the current furniture.
export function createBackgammonEnvironment({
  scene,
  renderer,
  createLoader,
  fallbackChair,
  tableRadius,
  tableHeight,
  chairDistance,
  seatY,
  status
}: any) {
  let disposed = false,
    tableRequest = 0,
    chairRequest = 0,
    hdriRequest = 0;
  const tableSettings = {
    arena: scene,
    renderer,
    tableRadius,
    tableHeight,
    includeBase: true
  };
  let table: any = null;
  let chairs: THREE.Group[] = [];
  let environment: THREE.WebGLRenderTarget | null = null,
    background: THREE.Texture | null = null;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const model = async (option: any, resolutions: string[]) => {
    const candidates: {
      url: string;
      include?: Record<string, { url: string }>;
    }[] = [];
    if (option.source === 'polyhaven') {
      for (const id of [
        ...new Set<string>([option.assetId, option.assetId.toLowerCase()])
      ]) {
        try {
          const response = await fetch(
            `https://api.polyhaven.com/files/${encodeURIComponent(id)}`,
            { signal: AbortSignal.timeout(12000) }
          );
          if (!response.ok) continue;
          const manifest = await response.json();
          for (const resolution of resolutions) {
            const entry = manifest.gltf?.[resolution]?.gltf;
            if (entry?.url)
              candidates.push({ url: entry.url, include: entry.include });
          }
          if (candidates.length) break;
        } catch {
          /* Direct asset paths are also provided by Poly Haven. */
        }
      }
      for (const resolution of resolutions)
        candidates.push({
          url: `https://dl.polyhaven.org/file/ph-assets/Models/gltf/${resolution}/${option.assetId}/${option.assetId}_${resolution}.gltf`
        });
    } else for (const url of option.urls || []) candidates.push({ url });
    for (const candidate of candidates) {
      if (disposed) throw new Error('Arena disposed');
      const manager = new THREE.LoadingManager();
      const includes = new Map<string, string>();
      Object.entries(candidate.include || {}).forEach(([path, entry]) => {
        includes.set(path, entry.url);
        includes.set(path.split('/').pop()!, entry.url);
      });
      manager.setURLModifier(
        (url) => includes.get(url) || includes.get(url.split('/').pop()!) || url
      );
      try {
        const loader = createLoader(renderer, manager);
        const gltf = await loadAsset(loader, candidate.url, (late) =>
          disposeBackgammonObject(late.scene)
        );
        loader.dracoLoader?.dispose();
        const root = gltf.scene;
        if (disposed) {
          disposeBackgammonObject(root);
          throw new Error('Arena disposed');
        }
        root.traverse((node: any) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });
        return root as THREE.Object3D;
      } catch {
        /* Try the next published resolution. */
      }
    }
    throw new Error(`Could not load ${option.label || option.name}`);
  };
  const clearTable = () => {
    if (table?.dispose) {
      table.group?.traverse((node: any) => node.geometry?.dispose());
      table.dispose();
    } else if (table?.group) disposeBackgammonObject(table.group);
  };
  return {
    async table(option: any, finish: any, resolutions: string[]) {
      const request = ++tableRequest;
      if (option.source !== 'polyhaven') {
        clearTable();
        table = createMurlanStyleTable({
          ...tableSettings,
          woodOption: finish?.woodOption
        });
        applyTableMaterials(
          table.materials,
          {
            woodOption: finish?.woodOption,
            clothOption: null,
            baseOption: null
          },
          renderer
        );
        status('');
        return;
      }
      status(`Loading ${option.label}…`);
      try {
        const root = await model(option, resolutions);
        if (disposed || request !== tableRequest) {
          disposeBackgammonObject(root);
          return;
        }
        const box = new THREE.Box3().setFromObject(root),
          size = box.getSize(new THREE.Vector3());
        // Fit both board lanes and off trays. Keep feet on the floor and the
        // tabletop at the same fixed height for every character and camera.
        root.scale.multiply(
          new THREE.Vector3(
            3.25 / Math.max(size.x, 0.01),
            tableHeight / Math.max(size.y, 0.01),
            2.72 / Math.max(size.z, 0.01)
          )
        );
        const fit = new THREE.Box3().setFromObject(root),
          center = fit.getCenter(new THREE.Vector3());
        root.position.add(new THREE.Vector3(-center.x, -fit.min.y, -center.z));
        clearTable();
        scene.add(root);
        table = { group: root };
        status('');
      } catch {
        if (!disposed && request === tableRequest)
          status(`${option.label} could not load. Current table retained.`);
      }
    },
    finish(finish: any) {
      if (table?.materials)
        applyTableMaterials(
          table.materials,
          {
            woodOption: finish?.woodOption,
            clothOption: null,
            baseOption: null
          },
          renderer
        );
    },
    async chairs(option: any, resolutions: string[]) {
      const request = ++chairRequest;
      let root: THREE.Object3D;
      try {
        root =
          option.source === 'polyhaven' || option.source === 'gltf'
            ? await model(option, resolutions)
            : fallbackChair(
                option.primary || option.seatColor,
                option.legColor
              );
      } catch {
        if (!disposed && request === chairRequest)
          status(`${option.label} could not load. Current chairs retained.`);
        return;
      }
      if (disposed || request !== chairRequest) {
        disposeBackgammonObject(root);
        return;
      }
      const bounds = new THREE.Box3().setFromObject(root),
        size = bounds.getSize(new THREE.Vector3());
      if (option.source === 'polyhaven' || option.source === 'gltf') {
        root.scale.multiplyScalar(1.7 / Math.max(size.y, 0.01));
        const fit = new THREE.Box3().setFromObject(root),
          center = fit.getCenter(new THREE.Vector3());
        // Seat is approximately halfway up these chair models, as in Murlan.
        root.position.add(
          new THREE.Vector3(
            -center.x,
            seatY - (fit.min.y + (fit.max.y - fit.min.y) * 0.48),
            -center.z
          )
        );
      } else root.position.y = seatY;
      const next = [0, 1].map((seat) => {
        const group = new THREE.Group();
        group.add(seat ? root.clone(true) : root);
        group.position.z = seat ? -chairDistance : chairDistance;
        group.rotation.y = seat ? 0 : Math.PI;
        scene.add(group);
        return group;
      });
      // Both clones share resources; dispose their previous resource set once.
      if (chairs[0]) disposeBackgammonObject(chairs[0]);
      chairs[1]?.removeFromParent();
      chairs = next;
    },
    async hdri(variant: any, resolutions: string[]) {
      const request = ++hdriRequest;
      const loader = new RGBELoader();
      for (const url of backgammonHdriUrls(variant, resolutions)) {
        if (disposed || request !== hdriRequest) return;
        try {
          const texture = await loadAsset(loader, url, (late) =>
            late.dispose()
          );
          if (disposed || request !== hdriRequest) {
            texture.dispose();
            return;
          }
          texture.mapping = THREE.EquirectangularReflectionMapping;
          const next = pmrem.fromEquirectangular(texture);
          scene.environment = next.texture;
          scene.background = texture;
          scene.backgroundBlurriness = 0.12;
          environment?.dispose();
          background?.dispose();
          environment = next;
          background = texture;
          status('');
          return;
        } catch {
          /* Fall back to smaller HDRI assets. */
        }
      }
      if (!disposed && request === hdriRequest)
        status('Environment could not load. Current lighting retained.');
    },
    dispose() {
      disposed = true;
      tableRequest++;
      chairRequest++;
      hdriRequest++;
      clearTable();
      if (chairs[0]) disposeBackgammonObject(chairs[0]);
      chairs[1]?.removeFromParent();
      environment?.dispose();
      background?.dispose();
      pmrem.dispose();
      scene.environment = null;
      scene.background = null;
    }
  };
}
