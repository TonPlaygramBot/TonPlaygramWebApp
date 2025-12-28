import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { clone as cloneSkinnedMesh } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { getOnlineCount } from '../utils/api.js';

const WALL_REPEAT = new THREE.Vector2(10, 2.8); // tighter marble tiling around the hallway
const PREFERRED_SIZES = ['4k', '2k', '1k'];

const fallbackGameNames = [
  'Chess Arena',
  'Ludo Royale',
  'Dice Duel',
  'Snake & Ladder',
  'Horse Racing',
  'Pool Royale',
  'Free Kick',
  'Texas Holdem',
  'Domino Royal 3D',
  'Blackjack Multi',
  'Goal Rush'
];

let modernLightBufferPromise = null;
let sharedKTX2Loader = null;

function buildModernCeilingLightBuffer() {
  if (!modernLightBufferPromise) {
    modernLightBufferPromise = new Promise((resolve, reject) => {
      const light = new THREE.Group();

      const outerRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.7, 0.22, 28, 96),
        new THREE.MeshStandardMaterial({ color: '#f4f4f4', metalness: 0.8, roughness: 0.2 })
      );
      light.add(outerRing);

      const innerRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.82, 0.08, 24, 64),
        new THREE.MeshStandardMaterial({ color: '#d8d8d8', metalness: 0.72, roughness: 0.22 })
      );
      innerRing.position.y = 0.08;
      light.add(innerRing);

      const diffuser = new THREE.Mesh(
        new THREE.CylinderGeometry(1.08, 1.08, 0.2, 64, 1, true),
        new THREE.MeshStandardMaterial({
          color: '#fff8ec',
          emissive: '#ffe8c4',
          emissiveIntensity: 0.9,
          metalness: 0.05,
          roughness: 0.22,
          transparent: true,
          opacity: 0.96,
          side: THREE.DoubleSide
        })
      );
      diffuser.position.y = -0.05;
      light.add(diffuser);

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 0.62, 24),
        new THREE.MeshStandardMaterial({ color: '#e3e3e3', metalness: 0.85, roughness: 0.25 })
      );
      stem.position.y = 1.05;
      light.add(stem);

      const mount = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.48, 0.22, 32),
        new THREE.MeshStandardMaterial({ color: '#e3e3e3', metalness: 0.88, roughness: 0.24 })
      );
      mount.position.y = 1.46;
      light.add(mount);

      const exporter = new GLTFExporter();
      try {
        exporter.parse(
          light,
          (result) => {
            if (result instanceof ArrayBuffer) {
              resolve(result);
            } else {
              reject(new Error('Modern light exporter did not return binary data'));
            }
          },
          { binary: true },
          (error) => reject(error)
        );
      } catch (error) {
        reject(error);
      }
    });
  }
  return modernLightBufferPromise;
}

function useBodyScrollLock(isLocked) {
  useEffect(() => {
    if (!isLocked) {
      return undefined;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isLocked]);
}

function createConfiguredGLTFLoader(renderer = null) {
  const loader = new GLTFLoader();
  loader.setCrossOrigin('anonymous');
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);

  if (!sharedKTX2Loader) {
    sharedKTX2Loader = new KTX2Loader();
    sharedKTX2Loader.setTranscoderPath(
      'https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/libs/basis/'
    );
    if (renderer) {
      try {
        sharedKTX2Loader.detectSupport(renderer);
      } catch (error) {
        console.warn('GamesHallway: KTX2 support detection failed', error);
      }
    }
  }

  loader.setKTX2Loader(sharedKTX2Loader);
  return loader;
}

export default function GamesHallway({ games, onClose }) {
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const [selectedGame, setSelectedGame] = useState(null);
  const overlayRootRef = useRef(null);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    if (!overlayRootRef.current) {
      let root = document.getElementById('hallway-overlay-root');
      if (!root) {
        root = document.createElement('div');
        root.id = 'hallway-overlay-root';
        document.body.appendChild(root);
      }
      overlayRootRef.current = root;
    }
  }, []);

  useBodyScrollLock(true);

  useEffect(() => {
    let cancelled = false;
    const updateCount = () => {
      getOnlineCount()
        .then((data) => {
          if (!cancelled && typeof data?.count === 'number') {
            setOnlineCount(data.count);
          }
        })
        .catch(() => {});
    };
    updateCount();
    const interval = setInterval(updateCount, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#fffaf3');

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.85;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';
    container.appendChild(renderer.domElement);
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      200
    );
    camera.position.set(0, 3, 10);

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    const gltfLoader = createConfiguredGLTFLoader(renderer);

    const loadGltfWithFallbacks = async (urls) => {
      let lastError = null;
      for (const url of urls) {
        try {
          const resolvedUrl = new URL(url, window.location.href).href;
          const resourcePath = resolvedUrl.substring(0, resolvedUrl.lastIndexOf('/') + 1);
          const isAbsolute = /^https?:\/\//i.test(resolvedUrl);
          gltfLoader.setResourcePath(resourcePath);
          gltfLoader.setPath(isAbsolute ? '' : resourcePath);
          // eslint-disable-next-line no-await-in-loop
          return await gltfLoader.loadAsync(resolvedUrl);
        } catch (error) {
          lastError = error;
          // try next fallback
        }
      }
      if (lastError) throw lastError;
      throw new Error('All GLTF sources failed');
    };

    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambient);

    const wrapAngle = (value) => {
      const twoPi = Math.PI * 2;
      let next = value % twoPi;
      if (next > Math.PI) {
        next -= twoPi;
      } else if (next < -Math.PI) {
        next += twoPi;
      }
      return next;
    };

    const ceilingTex = loader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r150/examples/textures/water.jpg');
    ceilingTex.wrapS = THREE.RepeatWrapping;
    ceilingTex.wrapT = THREE.RepeatWrapping;
    ceilingTex.repeat.set(4, 4);
    ceilingTex.colorSpace = THREE.SRGBColorSpace;

    const ceilingMat = new THREE.MeshStandardMaterial({
      color: '#fdf8ef',
      emissive: '#f0e8d0',
      emissiveIntensity: 0.5,
      metalness: 0.25,
      roughness: 0.1,
      map: ceilingTex
    });
    const ceiling = new THREE.Mesh(new THREE.CircleGeometry(18, 56), ceilingMat);
    ceiling.position.set(0, 8.3, 0);
    ceiling.rotation.x = Math.PI / 2;
    scene.add(ceiling);

    const modernSpot = new THREE.SpotLight(0xfff0c9, 1.2, 40, Math.PI / 4, 0.3, 1.5);
    modernSpot.position.set(0, 8, 0);
    scene.add(modernSpot);

    const carpetTex = loader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r150/examples/textures/checker.png');
    carpetTex.wrapS = THREE.RepeatWrapping;
    carpetTex.wrapT = THREE.RepeatWrapping;
    carpetTex.repeat.set(48, 48);
    carpetTex.colorSpace = THREE.SRGBColorSpace;

    const floorMat = new THREE.MeshStandardMaterial({
      color: '#8b0000',
      map: carpetTex,
      roughness: 0.45,
      metalness: 0.2,
      emissive: '#2b0000',
      emissiveIntensity: 0.3
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(20, 96), floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    let disposed = false;
    const marbleWallTextures = [];
    const disposeMaterial = (material) => {
      if (!material) {
        return;
      }
      ['map', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'normalMap', 'alphaMap'].forEach((key) => {
        const value = material[key];
        if (value?.dispose) {
          value.dispose();
        }
      });
      material.dispose?.();
    };
    const disposeMeshMaterials = (material) => {
      if (Array.isArray(material)) {
        material.forEach(disposeMaterial);
      } else {
        disposeMaterial(material);
      }
    };
    const wallMat = new THREE.MeshStandardMaterial({
      color: '#d8d6d1',
      side: THREE.BackSide,
      roughness: 0.52,
      metalness: 0.02
    });
    const walls = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 8, 80, 1, true), wallMat);
    walls.position.y = 4;
    scene.add(walls);

    const wrapTexture = (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.copy(WALL_REPEAT);
      texture.anisotropy = maxAnisotropy;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
    };

    const applyMarbleWalls = async () => {
      try {
        const response = await fetch('https://api.polyhaven.com/files/marble_01');
        if (!response.ok) {
          return;
        }
        const json = await response.json();
        const urls = pickBestTextureUrls(json, PREFERRED_SIZES);
        if (!urls.diffuse || !urls.normal || !urls.roughness) {
          return;
        }

        const [albedo, normal, roughness] = await Promise.all([
          loadTexture(loader, urls.diffuse, true),
          loadTexture(loader, urls.normal, false),
          loadTexture(loader, urls.roughness, false)
        ]);
        [albedo, normal, roughness].forEach((tex) => {
          wrapTexture(tex);
          marbleWallTextures.push(tex);
        });

        if (disposed) {
          marbleWallTextures.forEach((tex) => tex.dispose?.());
          return;
        }

        wallMat.map = albedo;
        wallMat.normalMap = normal;
        wallMat.roughnessMap = roughness;
        wallMat.color = new THREE.Color(0xffffff);
        wallMat.needsUpdate = true;
      } catch (error) {
        // ignore failed marble load and keep fallback material
      }
    };

    void applyMarbleWalls();

    const cornice = new THREE.Mesh(
      new THREE.TorusGeometry(19.1, 0.12, 24, 256),
      new THREE.MeshStandardMaterial({ color: '#c4a26c', metalness: 0.75, roughness: 0.28 })
    );
    cornice.rotation.x = Math.PI / 2;
    cornice.position.y = 7.9;
    scene.add(cornice);

    const baseboard = new THREE.Mesh(
      new THREE.CylinderGeometry(19.2, 19.2, 0.3, 128, 1, true),
      new THREE.MeshStandardMaterial({ color: '#b78a54', metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide })
    );
    baseboard.position.y = 0.15;
    scene.add(baseboard);

    const chandelierStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, 1.6, 24),
      new THREE.MeshStandardMaterial({ color: '#d8b070', metalness: 0.9, roughness: 0.25 })
    );
    chandelierStem.position.y = 7.6;
    scene.add(chandelierStem);

    const chandelierMount = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.65, 0.3, 32),
      new THREE.MeshStandardMaterial({ color: '#d6b378', metalness: 0.88, roughness: 0.28 })
    );
    chandelierMount.position.y = 8.15;
    scene.add(chandelierMount);

    const chandelier = new THREE.Group();
    chandelier.position.y = 6.6;
    scene.add(chandelier);

    const centerLanternUrls = [
      'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Lantern/glTF-Binary/Lantern.glb',
      'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Lantern/glTF-Binary/Lantern.glb'
    ];
    const lanternEmissiveColor = new THREE.Color('#b48440');
    const blackColor = new THREE.Color(0x000000);

    const loadCenterLantern = async () => {
      try {
        let gltf = null;
        for (const url of centerLanternUrls) {
          try {
            gltf = await gltfLoader.loadAsync(url);
            break;
          } catch (error) {
            // try next fallback
          }
        }
        if (!gltf) {
          throw new Error('Lantern glTF failed to load from all sources');
        }
        if (disposed) {
          gltf.scene?.traverse((child) => {
            if (child.isMesh) {
              child.geometry?.dispose?.();
              disposeMeshMaterials(child.material);
            }
          });
          return;
        }
        gltf.scene.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            const material = child.material;
            if (material?.isMaterial) {
              if (material.emissive?.equals?.(blackColor)) {
                material.emissive = lanternEmissiveColor.clone();
              }
              if (typeof material.emissiveIntensity === 'number') {
                material.emissiveIntensity = Math.max(material.emissiveIntensity, 0.6);
              }
              if (typeof material.envMapIntensity === 'number') {
                material.envMapIntensity = Math.max(material.envMapIntensity, 1.2);
              }
              material.roughness = Math.min(material.roughness ?? 0.6, 0.6);
              material.metalness = Math.max(material.metalness ?? 0.35, 0.35);
              material.needsUpdate = true;
            }
          }
        });
        gltf.scene.scale.set(0.78, 0.78, 0.78);
        gltf.scene.position.set(0, -0.55, 0);
        gltf.scene.rotation.y = Math.PI;
        chandelier.add(gltf.scene);

        const lanternHighlight = new THREE.PointLight(0xffe8c4, 1.35, 9, 2.1);
        lanternHighlight.position.set(0, -0.35, 0);
        chandelier.add(lanternHighlight);
      } catch (error) {
        // keep procedural chandelier as fallback
      }
    };

    void loadCenterLantern();

    const chandelierShade = new THREE.Mesh(
      new THREE.CylinderGeometry(1.35, 1.75, 1.15, 64, 1, true),
      new THREE.MeshStandardMaterial({
        color: '#fff2ce',
        emissive: '#ffe5b1',
        emissiveIntensity: 0.65,
        metalness: 0.2,
        roughness: 0.32,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92
      })
    );
    chandelierShade.position.y = -0.05;
    chandelier.add(chandelierShade);

    const chandelierShadeInner = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.55, 1.1, 64, 1, true),
      new THREE.MeshStandardMaterial({
        color: '#fff0c3',
        emissive: '#ffdca1',
        emissiveIntensity: 0.4,
        metalness: 0.12,
        roughness: 0.4,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55
      })
    );
    chandelierShadeInner.position.y = -0.05;
    chandelier.add(chandelierShadeInner);

    const chandelierDiffuser = new THREE.Mesh(
      new THREE.CircleGeometry(1.35, 48),
      new THREE.MeshStandardMaterial({
        color: '#fff4cf',
        emissive: '#ffe7b4',
        emissiveIntensity: 0.7,
        metalness: 0.15,
        roughness: 0.28,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95
      })
    );
    chandelierDiffuser.rotation.x = Math.PI / 2;
    chandelierDiffuser.position.y = -0.6;
    chandelier.add(chandelierDiffuser);

    const chandelierCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.6, 0.3, 32),
      new THREE.MeshStandardMaterial({ color: '#d8b070', metalness: 0.9, roughness: 0.25 })
    );
    chandelierCap.position.y = 0.55;
    chandelier.add(chandelierCap);

    const chandelierGlow = new THREE.PointLight(0xffe6b0, 2.6, 28, 1.6);
    chandelierGlow.position.set(0, chandelier.position.y - 0.15, 0);
    scene.add(chandelierGlow);

    const floorGlow = new THREE.PointLight(0xffc890, 0.6, 16, 2.2);
    floorGlow.position.set(0, 1.2, 0);
    scene.add(floorGlow);

    const woodTex = loader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r150/examples/textures/wood/mahogany_diffuse.jpg');
    woodTex.colorSpace = THREE.SRGBColorSpace;
    woodTex.wrapS = THREE.RepeatWrapping;
    woodTex.wrapT = THREE.RepeatWrapping;
    woodTex.anisotropy = maxAnisotropy;

    const handleTex = loader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r150/examples/textures/metal/Brass_Albedo.jpg');
    handleTex.colorSpace = THREE.SRGBColorSpace;

    const doorMat = new THREE.MeshStandardMaterial({
      map: woodTex,
      color: '#7b4a1a',
      roughness: 0.3,
      metalness: 0.25
    });
    const handleMat = new THREE.MeshStandardMaterial({
      map: handleTex,
      color: '#ffd700',
      metalness: 1,
      roughness: 0.1
    });
    const frameMat = new THREE.MeshStandardMaterial({ color: '#c4a26c', metalness: 0.8, roughness: 0.2 });

    const signBackgroundColor = '#000000';
    const signBorderColor = '#d4af37';
    const signTextColor = '#ffcc33';

    const doorEntries = Array.isArray(games) && games.length > 0
      ? games
      : fallbackGameNames.map((name) => ({ name }));

    const interactable = [];
    const handleGeom = new THREE.CylinderGeometry(0.07, 0.07, 0.4, 32);
    const doorAngles = [];

    doorEntries.forEach((game, index) => {
      const label = String(game?.name || fallbackGameNames[index % fallbackGameNames.length]);
      const angle = (index / doorEntries.length) * Math.PI * 2;
      doorAngles.push(angle);
      const radius = 18;
      const dx = Math.cos(angle) * radius;
      const dz = Math.sin(angle) * radius;
      const rotY = -(angle + Math.PI / 2);

      const doorGroup = new THREE.Group();
      doorGroup.position.set(dx, 2.6, dz);
      doorGroup.rotation.y = rotY;
      doorGroup.userData = { type: 'door', route: game?.route ?? null, game };

      const frame = new THREE.Mesh(new THREE.BoxGeometry(4.6, 5.2, 0.25), frameMat);
      frame.castShadow = true;
      frame.receiveShadow = true;
      frame.userData = { type: 'door', route: game?.route ?? null, game };
      doorGroup.add(frame);
      interactable.push(frame);

      const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(2, 4.8, 0.12), doorMat);
      const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(2, 4.8, 0.12), doorMat);
      leftDoor.position.set(-1.05, 0, 0.12);
      rightDoor.position.set(1.05, 0, 0.12);
      [leftDoor, rightDoor].forEach((doorPanel) => {
        doorPanel.castShadow = true;
        doorPanel.receiveShadow = true;
        doorPanel.userData = { type: 'door', route: game?.route ?? null, game };
        interactable.push(doorPanel);
      });
      doorGroup.add(leftDoor);
      doorGroup.add(rightDoor);

      const leftHandle = new THREE.Mesh(handleGeom, handleMat);
      const rightHandle = leftHandle.clone();
      leftHandle.rotation.z = Math.PI / 2;
      rightHandle.rotation.z = Math.PI / 2;
      leftHandle.position.set(0.85, 0, 0.16);
      rightHandle.position.set(-0.85, 0, 0.16);
      [leftHandle, rightHandle].forEach((handle) => {
        handle.castShadow = true;
        handle.receiveShadow = false;
        handle.userData = { type: 'door', route: game?.route ?? null, game };
        interactable.push(handle);
      });
      leftDoor.add(leftHandle);
      rightDoor.add(rightHandle);

      const signCanvas = document.createElement('canvas');
      signCanvas.width = 2048;
      signCanvas.height = 512;
      const ctx = signCanvas.getContext('2d');

      const patternCanvas = document.createElement('canvas');
      patternCanvas.width = 128;
      patternCanvas.height = 128;
      const patternCtx = patternCanvas.getContext('2d');
      patternCtx.fillStyle = '#050505';
      patternCtx.fillRect(0, 0, patternCanvas.width, patternCanvas.height);
      patternCtx.fillStyle = '#0f0f0f';
      patternCtx.fillRect(0, 0, patternCanvas.width / 2, patternCanvas.height / 2);
      patternCtx.fillRect(patternCanvas.width / 2, patternCanvas.height / 2, patternCanvas.width / 2, patternCanvas.height / 2);
      patternCtx.fillStyle = '#1a1a1a';
      patternCtx.beginPath();
      patternCtx.moveTo(patternCanvas.width / 2, 0);
      patternCtx.lineTo(patternCanvas.width, 0);
      patternCtx.lineTo(0, patternCanvas.height);
      patternCtx.lineTo(0, patternCanvas.height / 2);
      patternCtx.closePath();
      patternCtx.fill();
      patternCtx.beginPath();
      patternCtx.moveTo(patternCanvas.width, patternCanvas.height / 2);
      patternCtx.lineTo(patternCanvas.width, patternCanvas.height);
      patternCtx.lineTo(patternCanvas.width / 2, patternCanvas.height);
      patternCtx.closePath();
      patternCtx.fill();

      const carbonPattern = ctx.createPattern(patternCanvas, 'repeat');
      if (carbonPattern) {
        ctx.fillStyle = carbonPattern;
      } else {
        ctx.fillStyle = signBackgroundColor;
      }
      ctx.fillRect(0, 0, signCanvas.width, signCanvas.height);
      ctx.strokeStyle = signBorderColor;
      ctx.lineWidth = 20;
      ctx.strokeRect(12, 12, signCanvas.width - 24, signCanvas.height - 24);
      const screwRadius = 36;
      const screwMarginX = 110;
      const screwMarginY = 90;
      const screwPositions = [
        [screwMarginX, screwMarginY],
        [signCanvas.width - screwMarginX, screwMarginY],
        [signCanvas.width - screwMarginX, signCanvas.height - screwMarginY],
        [screwMarginX, signCanvas.height - screwMarginY]
      ];
      screwPositions.forEach(([x, y]) => {
        const gradient = ctx.createRadialGradient(
          x - screwRadius * 0.3,
          y - screwRadius * 0.3,
          screwRadius * 0.2,
          x,
          y,
          screwRadius
        );
        gradient.addColorStop(0, '#fff4c2');
        gradient.addColorStop(0.4, '#f1cf64');
        gradient.addColorStop(0.7, '#c99c2e');
        gradient.addColorStop(1, '#8a641a');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, screwRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#5a3e10';
        ctx.stroke();
        ctx.beginPath();
        ctx.fillStyle = '#f9d87d';
        ctx.arc(x - screwRadius * 0.2, y - screwRadius * 0.2, screwRadius * 0.35, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = signTextColor;
      ctx.font = 'bold 210px "Inter", Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let fontSize = 210;
      const maxWidth = signCanvas.width - 360;
      while (fontSize > 110) {
        ctx.font = `bold ${fontSize}px "Inter", Arial`;
        if (ctx.measureText(label).width <= maxWidth) {
          break;
        }
        fontSize -= 8;
      }
      ctx.font = `bold ${fontSize}px "Inter", Arial`;
      ctx.fillText(label, signCanvas.width / 2, signCanvas.height / 2);
      const signTexture = new THREE.CanvasTexture(signCanvas);
      signTexture.colorSpace = THREE.SRGBColorSpace;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 2), new THREE.MeshBasicMaterial({ map: signTexture }));
      sign.position.set(0, 3, -0.25);
      sign.userData = { type: 'sign', route: game?.route ?? null, game };
      doorGroup.add(sign);
      interactable.push(sign);

      scene.add(doorGroup);
    });

    const carbonFiberTexture = (() => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width / 2, canvas.height / 2);
        ctx.fillRect(canvas.width / 2, canvas.height / 2, canvas.width / 2, canvas.height / 2);
        ctx.fillStyle = '#161616';
        ctx.fillRect(0, canvas.height / 2, canvas.width / 2, canvas.height / 2);
        ctx.fillRect(canvas.width / 2, 0, canvas.width / 2, canvas.height / 2);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(8, 8);
      texture.anisotropy = maxAnisotropy;
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    })();

    const potFallbackTexture = loader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r150/examples/textures/uv_grid_opengl.jpg');
    potFallbackTexture.colorSpace = THREE.SRGBColorSpace;
    potFallbackTexture.wrapS = THREE.RepeatWrapping;
    potFallbackTexture.wrapT = THREE.RepeatWrapping;
    potFallbackTexture.repeat.set(1.6, 1.6);
    potFallbackTexture.anisotropy = maxAnisotropy;

    const buildProceduralPlant = () => {
      const pot = new THREE.Group();
      const potBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 1.15, 1.2, 24),
        new THREE.MeshStandardMaterial({
          color: '#d2b48c',
          map: potFallbackTexture,
          metalness: 0.2,
          roughness: 0.55
        })
      );
      potBody.position.y = 0.6;
      pot.add(potBody);

      const leaves = new THREE.Mesh(
        new THREE.ConeGeometry(1.45, 2.4, 28, 6),
        new THREE.MeshStandardMaterial({
          color: '#2f5d37',
          emissive: '#1a3a1f',
          emissiveIntensity: 0.12,
          metalness: 0.15,
          roughness: 0.6
        })
      );
      leaves.position.y = 2.2;
      pot.add(leaves);

      return { scene: pot, scale: 1.1 };
    };

    const plantModelSources = [
      {
        urls: [
          'https://dl.polyhaven.org/file/ph-assets/Models/gltf/2k/potted_plant_01/potted_plant_01_2k.gltf',
          'https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/potted_plant_01/potted_plant_01_1k.gltf'
        ],
        scale: 2.35
      },
      {
        urls: [
          'https://dl.polyhaven.org/file/ph-assets/Models/gltf/2k/potted_plant_02/potted_plant_02_2k.gltf',
          'https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/potted_plant_02/potted_plant_02_1k.gltf'
        ],
        scale: 2.15
      }
    ];

    const sconcePlateMat = new THREE.MeshStandardMaterial({
      color: '#0a0a0a',
      metalness: 0.72,
      roughness: 0.32,
      map: carbonFiberTexture
    });
    const sconceShadeMat = new THREE.MeshStandardMaterial({
      color: '#fff0cd',
      emissive: '#ffe4b0',
      emissiveIntensity: 0.8,
      metalness: 0.25,
      roughness: 0.22,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide
    });
    const sconceBulbMat = new THREE.MeshStandardMaterial({
      color: '#fff9ec',
      emissive: '#ffe7c4',
      emissiveIntensity: 0.95,
      metalness: 0.1,
      roughness: 0.1
    });

    const addFlowerPotsBetweenDoors = async () => {
      if (!doorAngles.length) {
        return;
      }

      const potRadius = 16.6;
      const sconceRadius = 19.15;
      const twoPi = Math.PI * 2;

      const loadedPlants = await Promise.all(
        plantModelSources.map(async (source) => {
          try {
            const gltf = await loadGltfWithFallbacks(source.urls);
            return { gltf, source };
          } catch (error) {
            return null;
          }
        })
      );

      if (disposed) {
        loadedPlants
          .filter(Boolean)
          .forEach(({ gltf }) => {
            gltf?.scene?.traverse((child) => {
              if (child.isMesh) {
                child.geometry?.dispose?.();
                disposeMeshMaterials(child.material);
              }
            });
          });
        return;
      }

      const plantVariants = loadedPlants
        .filter(Boolean)
        .map(({ gltf, source }) => {
          const scene = gltf?.scene;
          if (scene) {
            scene.traverse((child) => {
              if (child.isMesh && child.material) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.material.roughness = Math.max(child.material.roughness ?? 0.4, 0.4);
                child.material.metalness = Math.min(child.material.metalness ?? 0.3, 0.3);
                if (child.material.map) {
                  child.material.map.colorSpace = THREE.SRGBColorSpace;
                  child.material.map.anisotropy = maxAnisotropy;
                } else {
                  child.material.map = potFallbackTexture;
                }
                if (child.material.emissiveMap) {
                  child.material.emissiveMap.colorSpace = THREE.SRGBColorSpace;
                  child.material.emissiveMap.anisotropy = maxAnisotropy;
                }
                if (child.material.normalMap) {
                  child.material.normalMap.anisotropy = maxAnisotropy;
                }
                child.material.needsUpdate = true;
              }
            });
          }
          return scene ? { scene, scale: source.scale } : null;
        })
        .filter(Boolean);

      if (!plantVariants.length) {
        plantVariants.push(buildProceduralPlant());
      }

      doorAngles.forEach((angle, index) => {
        let delta = wrapAngle(doorAngles[(index + 1) % doorAngles.length] - angle);
        if (delta <= 0) {
          delta += twoPi;
        }
        const midpointAngle = angle + delta / 2;
        const potX = Math.cos(midpointAngle) * potRadius;
        const potZ = Math.sin(midpointAngle) * potRadius;

        const potGroup = new THREE.Group();
        potGroup.position.set(potX, 0, potZ);
        potGroup.rotation.y = -(midpointAngle + Math.PI / 2);
        potGroup.scale.setScalar(1.12);

        if (plantVariants.length) {
          const variant = plantVariants[index % plantVariants.length];
          const instance = cloneSkinnedMesh(variant.scene);
          instance.position.set(0, 0.05, 0);
          instance.scale.setScalar(variant.scale * 1.08);
          potGroup.add(instance);
        }

        const potAccent = new THREE.PointLight(0xc9f7d2, 0.48, 5.2, 2.6);
        potAccent.position.set(0, 1.55, 0);
        potGroup.add(potAccent);

        scene.add(potGroup);

        const sconceGroup = new THREE.Group();
        const sconceX = Math.cos(midpointAngle) * sconceRadius;
        const sconceZ = Math.sin(midpointAngle) * sconceRadius;
        sconceGroup.position.set(sconceX, 4.45, sconceZ);
        sconceGroup.rotation.y = -(midpointAngle + Math.PI / 2);

        const backplate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.5, 0.1), sconcePlateMat);
        backplate.receiveShadow = true;
        sconceGroup.add(backplate);

        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.55, 16), sconcePlateMat);
        arm.rotation.x = Math.PI / 2;
        arm.position.z = 0.33;
        sconceGroup.add(arm);

        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 12), sconceBulbMat);
        bulb.position.set(0, 0.12, 0.7);
        bulb.castShadow = true;
        sconceGroup.add(bulb);

        const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.35, 0.8, 26, 1, true), sconceShadeMat);
        shade.position.set(0, 0.12, 0.65);
        shade.castShadow = true;
        shade.receiveShadow = true;
        sconceGroup.add(shade);

        const sconceGlow = new THREE.PointLight(0xffe4bf, 1.6, 10, 2.2);
        sconceGlow.position.set(0, 0.35, 0.5);
        sconceGroup.add(sconceGlow);

        const sconceBeam = new THREE.SpotLight(0xffe9c8, 1.35, 11, Math.PI / 3.3, 0.55, 1.8);
        sconceBeam.position.set(0, 0.3, 0.4);
        sconceBeam.target.position.set(0, -1.8, -2.4);
        sconceGroup.add(sconceBeam);
        sconceGroup.add(sconceBeam.target);

        scene.add(sconceGroup);
      });
    };

    void addFlowerPotsBetweenDoors();

    const addModernCeilingLight = async () => {
      try {
        const buffer = await buildModernCeilingLightBuffer();
        const gltf = await new Promise((resolve, reject) => {
          gltfLoader.parse(buffer.slice(0), '', resolve, reject);
        });
        if (disposed) {
          gltf?.scene?.traverse((child) => {
            if (child.isMesh) {
              child.geometry?.dispose?.();
              disposeMeshMaterials(child.material);
            }
          });
          return;
        }
        const light = gltf.scene || new THREE.Group();
        light.position.set(0, 7.95, 0);
        light.scale.set(2.45, 2.45, 2.45);
        light.rotation.y = Math.PI / 6;
        light.traverse((child) => {
          if (child.isMesh && child.material) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.material.roughness = Math.max(child.material.roughness ?? 0.2, 0.2);
            child.material.metalness = Math.min(child.material.metalness ?? 0.7, 0.7);
            if (child.material.map) {
              child.material.map.colorSpace = THREE.SRGBColorSpace;
              child.material.map.anisotropy = maxAnisotropy;
            }
            child.material.needsUpdate = true;
          }
        });
        scene.add(light);

        const softGlow = new THREE.PointLight(0xffedc8, 1.55, 18, 2.1);
        softGlow.position.set(0, 7.45, 0);
        scene.add(softGlow);

        const downlight = new THREE.SpotLight(0xfff2da, 1.35, 22, Math.PI / 2.8, 0.45, 1.6);
        downlight.position.set(0, 7.6, 0);
        downlight.target.position.set(0, 2.6, 0);
        scene.add(downlight);
        scene.add(downlight.target);
      } catch (error) {
        // keep chandelier-only layout on failure
      }
    };

    void addModernCeilingLight();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const clampPitch = (value) => THREE.MathUtils.clamp(value, -Math.PI / 8, Math.PI / 4);
    const clampRadius = (value) => THREE.MathUtils.clamp(value, 3.6, 14);
    const lerpAngle = (start, end, alpha) => {
      const difference = wrapAngle(end - start);
      return wrapAngle(start + difference * alpha);
    };

    let yaw = wrapAngle(Math.PI / 6);
    let pitch = clampPitch(-0.08);
    let radius = 4.2;
    let targetYaw = yaw;
    let targetPitch = pitch;
    let targetRadius = radius;
    let dragging = false;
    let pointerMoved = false;
    let lastX = 0;
    const pointerDown = new THREE.Vector2();
    const CLICK_THRESHOLD = 6;
    let lastInteraction = performance.now();

    const markInteraction = () => {
      lastInteraction = performance.now();
    };

    const updateCamera = () => {
      const clampedPitch = clampPitch(pitch);
      pitch = clampedPitch;
      const horizontalRadius = Math.cos(clampedPitch) * radius;
      const cx = Math.sin(yaw) * horizontalRadius;
      const cz = Math.cos(yaw) * horizontalRadius;
      const cy = 3 + Math.sin(clampedPitch) * 2;
      camera.position.set(cx, cy, cz);
      camera.lookAt(0, 2, 0);
    };

    const handleInteraction = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(interactable, true);
      if (!intersects.length) {
        return;
      }
      const { type, route, game } = intersects[0].object.userData || {};
      if (type === 'door') {
        if (route) {
          navigate(route);
        } else if (game) {
          setSelectedGame(game);
        }
      } else if (type === 'sign' && game) {
        setSelectedGame(game);
      }
    };

    const handlePointerDown = (event) => {
      markInteraction();
      dragging = true;
      pointerMoved = false;
      lastX = event.clientX;
      pointerDown.set(event.clientX, event.clientY);
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.style.cursor = 'grabbing';
    };

    const handlePointerMove = (event) => {
      if (!dragging) {
        return;
      }
      markInteraction();
      pointerMoved = true;
      const dx = event.clientX - lastX;
      lastX = event.clientX;
      targetYaw = wrapAngle(targetYaw - dx * 0.005);
    };

    const finalizePointer = (event, allowClick = true) => {
      if (dragging && renderer.domElement.hasPointerCapture?.(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
      dragging = false;
      renderer.domElement.style.cursor = 'grab';
      const distance = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
      if (allowClick && (!pointerMoved || distance <= CLICK_THRESHOLD)) {
        handleInteraction(event);
      }
      pointerMoved = false;
    };

    const handlePointerUp = (event) => {
      markInteraction();
      finalizePointer(event, true);
    };

    const handlePointerLeave = () => {
      dragging = false;
      renderer.domElement.style.cursor = 'grab';
    };

    const handlePointerCancel = (event) => {
      finalizePointer(event, false);
    };

    const handleLostPointerCapture = () => {
      dragging = false;
      renderer.domElement.style.cursor = 'grab';
    };

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    const contextMenuHandler = (event) => {
      event.preventDefault();
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave);
    renderer.domElement.addEventListener('pointercancel', handlePointerCancel);
    renderer.domElement.addEventListener('lostpointercapture', handleLostPointerCapture);
    const handleWheel = (event) => {
      event.preventDefault();
    };
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
    renderer.domElement.addEventListener('contextmenu', contextMenuHandler);
    window.addEventListener('resize', handleResize);

    const TARGET_FPS = 90;
    const TARGET_FRAME_TIME = 1000 / TARGET_FPS;
    const MAX_FRAME_TIME = TARGET_FRAME_TIME * 3;
    let lastRenderTime = performance.now();
    let animationId = 0;

    const animate = (time) => {
      animationId = requestAnimationFrame(animate);
      const deltaMs = time - lastRenderTime;
      if (deltaMs < TARGET_FRAME_TIME - 0.25) {
        return;
      }
      const clampedDelta = Math.min(deltaMs, MAX_FRAME_TIME) / 1000;
      lastRenderTime = time;

      targetPitch = clampPitch(targetPitch);
      targetRadius = clampRadius(targetRadius);
      targetYaw = wrapAngle(targetYaw);

      if (!dragging && time - lastInteraction > 4500) {
        targetYaw = wrapAngle(targetYaw - THREE.MathUtils.degToRad(4) * clampedDelta);
      }

      const yawLerp = 1 - Math.exp(-clampedDelta * 4.5);
      const pitchLerp = 1 - Math.exp(-clampedDelta * 5.5);
      const radiusLerp = 1 - Math.exp(-clampedDelta * 5);
      yaw = lerpAngle(yaw, targetYaw, yawLerp);
      pitch = THREE.MathUtils.lerp(pitch, targetPitch, pitchLerp);
      radius = THREE.MathUtils.lerp(radius, targetRadius, radiusLerp);

      updateCamera();
      renderer.render(scene, camera);
    };

    updateCamera();
    animate(performance.now());

    return () => {
      disposed = true;
      cancelAnimationFrame(animationId);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
      renderer.domElement.removeEventListener('pointercancel', handlePointerCancel);
      renderer.domElement.removeEventListener('lostpointercapture', handleLostPointerCapture);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      renderer.domElement.removeEventListener('contextmenu', contextMenuHandler);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
      scene.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose?.();
          const { material } = child;
          disposeMeshMaterials(material);
        }
      });
      handleGeom.dispose();
    };
  }, [games, navigate]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3 text-text">
        <div>
          <h3 className="text-lg font-semibold">TonPlaygram Luxury Hallway</h3>
          <p className="text-xs text-subtext">
            Drag left or right to browse the golden doors, tap one to enter instantly, or tap its illuminated sign to preview the lobby first.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
        >
          Close
        </button>
      </div>
      <div className="relative flex-1">
        <div ref={containerRef} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-6 inset-x-0 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-black/55 px-4 py-2 text-xs font-semibold tracking-wide text-white shadow-lg shadow-black/40 backdrop-blur-sm">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <span className="text-sm font-semibold text-white">{onlineCount}</span>
              <span className="text-[0.65rem] uppercase text-white/80">online</span>
            </div>
          </div>
        </div>
      </div>
      {selectedGame && overlayRootRef.current &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-black/95 px-6 text-center text-text">
            <div className="space-y-6">
              <h4 className="text-2xl font-bold">{selectedGame.name}</h4>
              <p className="text-sm text-subtext">
                Ready to enter the lobby? Choose how you want to continue below.
              </p>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedGame.route) {
                      navigate(selectedGame.route);
                    }
                    setSelectedGame(null);
                  }}
                  className="w-full rounded-full bg-primary px-6 py-3 text-base font-semibold text-black"
                >
                  Enter Lobby
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedGame(null)}
                  className="w-full rounded-full border border-border px-6 py-3 text-base font-semibold"
                >
                  Back to Hallway
                </button>
              </div>
            </div>
          </div>,
          overlayRootRef.current
        )}
    </div>
  );
}

function pickBestTextureUrls(apiJson, preferredSizes = PREFERRED_SIZES) {
  const urls = [];

  const walk = (value) => {
    if (!value) {
      return;
    }
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (value.startsWith('http') && (lower.includes('.jpg') || lower.includes('.png'))) {
        urls.push(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === 'object') {
      Object.values(value).forEach(walk);
    }
  };

  walk(apiJson);

  const pick = (keywords) => {
    const scored = urls
      .filter((url) => keywords.some((kw) => url.toLowerCase().includes(kw)))
      .map((url) => {
        const lower = url.toLowerCase();
        let score = 0;
        preferredSizes.forEach((size, index) => {
          if (lower.includes(size)) {
            score += (preferredSizes.length - index) * 10;
          }
        });
        if (lower.includes('jpg')) score += 6;
        if (lower.includes('png')) score += 3;
        if (lower.includes('preview') || lower.includes('thumb')) score -= 50;
        if (lower.includes('.exr')) score -= 100;
        return { url, score };
      })
      .sort((a, b) => b.score - a.score);
    return scored[0]?.url;
  };

  return {
    diffuse: pick(['diff', 'diffuse', 'albedo', 'basecolor']),
    normal: pick(['nor_gl', 'normal_gl', 'nor', 'normal']),
    roughness: pick(['rough', 'roughness'])
  };
}

async function loadTexture(loader, url, isColor) {
  return await new Promise((resolve, reject) => {
    loader.load(
      url,
      (texture) => {
        if (isColor) {
          texture.colorSpace = THREE.SRGBColorSpace;
        }
        resolve(texture);
      },
      undefined,
      () => reject(new Error('texture load failed'))
    );
  });
}
