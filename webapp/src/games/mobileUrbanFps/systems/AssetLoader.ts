import * as THREE from 'three';
import {
  GLTFLoader,
  type GLTF
} from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  AIRCRAFT_DISPLAY_LENGTH,
  EQUIPMENT_DISPLAY_LENGTH,
  FPS_SHOTGUN_DISPLAY_LENGTH,
  type DisplayEntry,
  type HandTransform,
  mergedGripProfile,
  targetHandSize
} from '../assetCatalog';

function isImageUrl(url: string) {
  return /\.(png|jpe?g|webp|bmp|gif|ktx2?|basis)(\?|#|$)/i.test(url);
}

function isAbsoluteOrDataUrl(url: string) {
  return (
    /^(https?:)?\/\//i.test(url) ||
    url.startsWith('data:') ||
    url.startsWith('blob:')
  );
}

function parentFolder(url: string) {
  return url.slice(0, url.lastIndexOf('/') + 1);
}

function resolveRelativeUrl(url: string, baseFolder: string) {
  if (isAbsoluteOrDataUrl(url)) return url;
  return new URL(url, baseFolder).toString();
}

function makeLoaderForUrl(modelUrl: string) {
  const baseFolder = parentFolder(modelUrl);
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((resourceUrl) => {
    if (isAbsoluteOrDataUrl(resourceUrl)) return resourceUrl;
    if (isImageUrl(resourceUrl))
      return resolveRelativeUrl(resourceUrl, baseFolder);
    return resolveRelativeUrl(resourceUrl, baseFolder);
  });
  const loader = new GLTFLoader(manager);
  loader.setCrossOrigin('anonymous');
  return loader;
}

export async function loadModelByUrls(
  name: string,
  urls: string[],
  timeoutMs = 18000
): Promise<{ gltf: GLTF; url: string }> {
  let lastError: unknown = null;

  for (const url of urls) {
    try {
      const loader = makeLoaderForUrl(url);
      const gltf = await new Promise<GLTF>((resolve, reject) => {
        const timer = window.setTimeout(
          () => reject(new Error(`Timeout loading ${name}`)),
          timeoutMs
        );
        loader.load(
          url,
          (loaded) => {
            window.clearTimeout(timer);
            resolve(loaded);
          },
          undefined,
          (error) => {
            window.clearTimeout(timer);
            reject(error);
          }
        );
      });
      return { gltf, url };
    } catch (error) {
      lastError = error;
      console.warn('Urban FPS asset candidate failed:', name, url, error);
    }
  }

  throw lastError ?? new Error(`All URLs failed for ${name}`);
}

function getBounds(object: THREE.Object3D) {
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object);
}

export function normalizeObject(model: THREE.Object3D, targetLength: number) {
  model.updateMatrixWorld(true);
  const box = getBounds(model);
  const size = box.getSize(new THREE.Vector3());
  const maxLength = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxLength) || maxLength <= 0) return;

  model.scale.setScalar(targetLength / maxLength);
  model.updateMatrixWorld(true);

  const fittedBox = getBounds(model);
  const center = fittedBox.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y += -fittedBox.min.y + 0.05;
  model.updateMatrixWorld(true);
}

export function configureModel(
  model: THREE.Object3D,
  renderer: THREE.WebGLRenderer,
  options: { mobileMaxAnisotropy?: number; frustumCulled?: boolean } = {}
) {
  const maxAnisotropy = Math.min(
    options.mobileMaxAnisotropy ?? 4,
    renderer.capabilities.getMaxAnisotropy()
  );

  model.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!(mesh as any).isMesh && !(mesh as any).isSkinnedMesh) return;

    (mesh as any).castShadow = true;
    (mesh as any).receiveShadow = true;
    (mesh as any).frustumCulled = options.frustumCulled ?? true;

    const materials = Array.isArray((mesh as any).material)
      ? (mesh as any).material
      : (mesh as any).material
        ? [(mesh as any).material]
        : [];

    materials.forEach((material: any) => {
      [
        'map',
        'emissiveMap',
        'normalMap',
        'roughnessMap',
        'metalnessMap',
        'aoMap',
        'alphaMap'
      ].forEach((key) => {
        const texture = material[key] as THREE.Texture | null | undefined;
        if (texture && texture.isTexture) {
          if (key === 'map' || key === 'emissiveMap')
            texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = maxAnisotropy;
          texture.needsUpdate = true;
        }
      });
      material.needsUpdate = true;
    });
  });
}

function buildObjectPath(object: THREE.Object3D) {
  const names: string[] = [];
  let current: THREE.Object3D | null = object;
  while (current) {
    names.push(current.name || current.type);
    current = current.parent;
  }
  return names.reverse().join('/');
}

function centerXOfObject(object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  return center.x;
}

function sideScore(path: string, side: 'left' | 'right') {
  const leftRegex = /(^|[^a-z])(left|l)([^a-z]|$)/i;
  const rightRegex = /(^|[^a-z])(right|r)([^a-z]|$)/i;
  if (side === 'left')
    return leftRegex.test(path) ? 2 : rightRegex.test(path) ? -2 : 0;
  return rightRegex.test(path) ? 2 : leftRegex.test(path) ? -2 : 0;
}

function isRenderable(obj: THREE.Object3D) {
  return (obj as any).isMesh || (obj as any).isSkinnedMesh;
}

function visibleMeshBounds(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  let hasMesh = false;

  root.traverse((obj) => {
    if (!isRenderable(obj) || !obj.visible) return;
    const meshBox = new THREE.Box3().setFromObject(obj);
    if (!Number.isFinite(meshBox.min.x) || !Number.isFinite(meshBox.max.x))
      return;
    box.union(meshBox);
    hasMesh = true;
  });

  return hasMesh ? box : null;
}

function visibleMaxDimension(root: THREE.Object3D) {
  const box = visibleMeshBounds(root);
  if (!box) return 0;
  const size = box.getSize(new THREE.Vector3());
  return Math.max(size.x, size.y, size.z);
}

function centerVisibleMeshesAtLocalOrigin(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = visibleMeshBounds(root);
  if (!box) return;
  const center = box.getCenter(new THREE.Vector3());

  root.position.x -= center.x;
  root.position.y -= center.y;
  root.position.z -= center.z;
  root.updateMatrixWorld(true);
}

export function makeHandRigFromDonor(
  donorScene: THREE.Object3D,
  side: 'left' | 'right'
) {
  const rig = cloneSkinned(donorScene);
  rig.updateMatrixWorld(true);

  const renderables: THREE.Object3D[] = [];
  rig.traverse((obj) => {
    if (isRenderable(obj)) renderables.push(obj);
  });

  let keptCount = 0;
  renderables.forEach((obj) => {
    const path = buildObjectPath(obj).toLowerCase();
    const isHand = /(hand|finger|wrist|glove)/i.test(path);
    const isArmOnly =
      /(arm|sleeve|forearm|elbow|shoulder)/i.test(path) && !isHand;
    const isWeaponPart =
      /(gun|weapon|rifle|shotgun|barrel|mag|magazine|scope|stock|trigger)/i.test(
        path
      );
    const score =
      (isHand ? 40 : 0) +
      sideScore(path, side) * 20 +
      (side === 'right' ? centerXOfObject(obj) : -centerXOfObject(obj));
    const keep = !isWeaponPart && !isArmOnly && score > 20;
    (obj as any).visible = keep;
    if (keep) keptCount += 1;
  });

  if (keptCount === 0) {
    renderables.forEach((obj) => {
      const path = buildObjectPath(obj).toLowerCase();
      const isWeaponPart =
        /(gun|weapon|rifle|shotgun|barrel|mag|magazine|scope|stock|trigger)/i.test(
          path
        );
      const x = centerXOfObject(obj);
      const keep = !isWeaponPart && (side === 'right' ? x >= 0 : x <= 0);
      (obj as any).visible = keep;
    });
  }

  return rig;
}

export function makeFittedHandGroup(
  donorScene: THREE.Object3D,
  entry: DisplayEntry,
  side: 'left' | 'right',
  transform: HandTransform,
  renderer: THREE.WebGLRenderer
) {
  const group = new THREE.Group();
  group.name = `${entry.id}-${side}-small-fps-hand`;
  group.position.set(
    transform.position[0],
    transform.position[1],
    transform.position[2]
  );
  group.rotation.set(
    transform.rotation[0],
    transform.rotation[1],
    transform.rotation[2]
  );

  const rig = makeHandRigFromDonor(donorScene, side);
  rig.name = `${entry.id}-${side}-human-fps-hand-rig`;
  configureModel(rig, renderer, {
    frustumCulled: false,
    mobileMaxAnisotropy: 2
  });

  centerVisibleMeshesAtLocalOrigin(rig);
  const currentMax = visibleMaxDimension(rig);
  const desiredMax = targetHandSize(entry, side);

  if (currentMax > 0) rig.scale.setScalar(desiredMax / currentMax);
  else rig.scale.setScalar(0.018);

  group.add(rig);
  return group;
}

export function attachHandsToWeapon(
  entry: DisplayEntry,
  root: THREE.Object3D,
  donorScene: THREE.Object3D | null,
  renderer: THREE.WebGLRenderer
) {
  if (entry.kind !== 'weapon' || !donorScene) return;
  if (entry.id === 'slot-18-fps-gun-gltf') return;

  const profile = mergedGripProfile(entry);
  if (!profile) return;

  root.add(
    makeFittedHandGroup(donorScene, entry, 'right', profile.right, renderer)
  );
  if (entry.handMode === 'both' && profile.left) {
    root.add(
      makeFittedHandGroup(donorScene, entry, 'left', profile.left, renderer)
    );
  }
}

export function targetDisplayLength(entry: DisplayEntry) {
  if (entry.kind === 'equipment')
    return entry.displayLength ?? EQUIPMENT_DISPLAY_LENGTH;
  if (entry.kind === 'aircraft')
    return entry.displayLength ?? AIRCRAFT_DISPLAY_LENGTH;
  if (entry.kind === 'vehicle') return entry.displayLength ?? 1.55;
  return entry.displayLength ?? FPS_SHOTGUN_DISPLAY_LENGTH;
}

export function createProceduralMachine(entry: DisplayEntry) {
  const group = new THREE.Group();
  const bodyColor =
    entry.fallbackColor ?? (entry.kind === 'equipment' ? '#9ca3af' : '#7c8791');
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.65,
    metalness: 0.2
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: '#374151',
    roughness: 0.7,
    metalness: 0.12
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#1e3a5f',
    roughness: 0.22,
    metalness: 0.22
  });

  if (entry.kind === 'weapon') {
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.16, 0.12),
      darkMat
    );
    stock.position.set(-0.36, 0.3, 0);
    group.add(stock);
    const receiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.16, 0.14),
      bodyMat
    );
    receiver.position.set(0.05, 0.32, 0);
    group.add(receiver);
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 0.72, 14),
      darkMat
    );
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0.62, 0.33, 0);
    group.add(barrel);
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.28, 0.1),
      darkMat
    );
    grip.position.set(-0.08, 0.12, 0);
    grip.rotation.z = -0.25;
    group.add(grip);
  } else if (entry.id.includes('helicopter')) {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.24, 0.95, 8, 18),
      bodyMat
    );
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.35;
    group.add(body);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.08, 0.08),
      darkMat
    );
    tail.position.set(-0.72, 0.36, 0);
    group.add(tail);
    const cockpit = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 18, 12),
      glassMat
    );
    cockpit.position.set(0.37, 0.42, 0);
    group.add(cockpit);
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.025, 0.08),
      darkMat
    );
    rotor.position.set(0, 0.92, 0);
    rotor.name = 'procedural-propeller';
    group.add(rotor);
    const rotor2 = rotor.clone();
    rotor2.rotation.y = Math.PI / 2;
    rotor2.name = 'procedural-propeller';
    group.add(rotor2);
  } else if (entry.id.includes('f15') || entry.id.includes('drone')) {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, 1.6, 18),
      bodyMat
    );
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.32;
    group.add(body);
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.42, 18),
      bodyMat
    );
    nose.rotation.z = -Math.PI / 2;
    nose.position.set(1.0, 0.32, 0);
    group.add(nose);
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.035, 1.3),
      bodyMat
    );
    wing.position.set(-0.05, 0.28, 0);
    group.add(wing);
  } else if (entry.id.includes('rocket')) {
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.17, 1.75, 24),
      bodyMat
    );
    shaft.position.y = 0.9;
    group.add(shaft);
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.42, 24),
      bodyMat
    );
    nose.position.y = 1.98;
    group.add(nose);
  } else if (entry.id.includes('antenna')) {
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 2.15, 12),
      bodyMat
    );
    mast.position.y = 1.05;
    group.add(mast);
    for (let i = 0; i < 4; i += 1) {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.95 - i * 0.13, 0.025, 0.025),
        darkMat
      );
      arm.position.y = 0.65 + i * 0.38;
      arm.rotation.y = i % 2 === 0 ? 0 : Math.PI / 2;
      group.add(arm);
    }
  } else {
    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.28, 0.45),
      bodyMat
    );
    chassis.position.y = 0.35;
    group.add(chassis);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.35, 0.42),
      bodyMat
    );
    cabin.position.set(0.38, 0.65, 0);
    group.add(cabin);
  }

  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  return group;
}

export function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!(mesh as any).isMesh && !(mesh as any).isSkinnedMesh) return;
    mesh.geometry?.dispose?.();
    const materials = Array.isArray((mesh as any).material)
      ? (mesh as any).material
      : (mesh as any).material
        ? [(mesh as any).material]
        : [];
    materials.forEach((material: any) => {
      [
        'map',
        'emissiveMap',
        'normalMap',
        'roughnessMap',
        'metalnessMap',
        'aoMap',
        'alphaMap'
      ].forEach((key) => {
        const texture = material[key] as THREE.Texture | null | undefined;
        texture?.dispose?.();
      });
      material.dispose?.();
    });
  });
}
