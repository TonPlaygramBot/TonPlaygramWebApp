import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getOnlineCount } from '../utils/api.js';

const WALL_REPEAT = new THREE.Vector2(10, 2.8); // tighter marble tiling around the hallway
const PREFERRED_SIZES = ['4k', '2k', '1k'];
const LANTERN_URLS = [
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Lantern/glTF-Binary/Lantern.glb',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Lantern/glTF-Binary/Lantern.glb',
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Lantern/glTF-Binary/Lantern.glb',
  'https://fastly.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Lantern/glTF-Binary/Lantern.glb'
];

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

    const gltfLoader = new GLTFLoader();
    gltfLoader.setCrossOrigin('anonymous');

    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambient);

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
    const ceiling = new THREE.Mesh(new THREE.CircleGeometry(18, 64), ceilingMat);
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
    const floor = new THREE.Mesh(new THREE.CircleGeometry(20, 128), floorMat);
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
    const walls = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 8, 96, 1, true), wallMat);
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

    const loadCenterLantern = async () => {
      try {
        let gltf = null;
        for (const url of LANTERN_URLS) {
          try {
            gltf = await gltfLoader.loadAsync(url);
            break;
          } catch (error) {
            gltf = null;
          }
        }
        if (!gltf) {
          throw new Error('Lantern failed to load');
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
        const lanternRoot = gltf.scene;
        lanternRoot.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              const material = child.material;
              if ('emissiveIntensity' in material) {
                material.emissiveIntensity = Math.max(material.emissiveIntensity || 0.1, 0.35);
              }
              if ('metalness' in material) {
                material.metalness = Math.min(material.metalness + 0.05, 1);
              }
              if ('roughness' in material) {
                material.roughness = Math.max(material.roughness * 0.85, 0.12);
              }
              if ('envMapIntensity' in material) {
                material.envMapIntensity = 1.1;
              }
            }
          }
        });
        const lanternBox = new THREE.Box3().setFromObject(lanternRoot);
        const lanternSize = lanternBox.getSize(new THREE.Vector3());
        const lanternCenter = lanternBox.getCenter(new THREE.Vector3());
        lanternRoot.position.sub(lanternCenter);
        lanternRoot.position.y -= lanternSize.y * 0.5;
        lanternRoot.scale.set(0.92, 0.92, 0.92);
        lanternRoot.position.y -= 0.35;
        lanternRoot.rotation.y = Math.PI;
        chandelier.add(lanternRoot);
        const lanternLight = new THREE.PointLight(0xffe6b0, 1.45, 16, 2.2);
        lanternLight.position.set(0, -0.2, 0);
        lanternLight.castShadow = false;
        chandelier.add(lanternLight);
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
      ctx.font = 'bold 240px "Inter", Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let fontSize = 240;
      const maxWidth = signCanvas.width - 360;
      while (fontSize > 120) {
        ctx.font = `bold ${fontSize}px "Inter", Arial`;
        if (ctx.measureText(label).width <= maxWidth) {
          break;
        }
        fontSize -= 10;
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
      doorAngles.push(angle);
    });

    if (doorAngles.length > 1) {
      const potMaterial = new THREE.MeshStandardMaterial({
        color: '#b07d52',
        roughness: 0.32,
        metalness: 0.18
      });
      const potRimMaterial = new THREE.MeshStandardMaterial({
        color: '#c89a6d',
        roughness: 0.28,
        metalness: 0.22
      });
      const soilMaterial = new THREE.MeshStandardMaterial({
        color: '#3a2b20',
        roughness: 0.65,
        metalness: 0.05
      });
      const foliageMaterial = new THREE.MeshStandardMaterial({
        color: '#1f8a4c',
        roughness: 0.5,
        metalness: 0.1,
        emissive: '#0f4c2a',
        emissiveIntensity: 0.25
      });
      const sconceMetal = new THREE.MeshStandardMaterial({
        color: '#d3b06a',
        metalness: 0.88,
        roughness: 0.32
      });
      const sconceGlass = new THREE.MeshStandardMaterial({
        color: '#ffe7c2',
        emissive: '#ffd9a0',
        emissiveIntensity: 0.7,
        metalness: 0.1,
        roughness: 0.18,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
      });

      doorAngles.forEach((angle, index) => {
        const nextAngle = index === doorAngles.length - 1 ? doorAngles[0] + Math.PI * 2 : doorAngles[index + 1];
        const midAngle = angle + (nextAngle - angle) * 0.5;
        const potRadius = 17.2;
        const potX = Math.cos(midAngle) * potRadius;
        const potZ = Math.sin(midAngle) * potRadius;

        const potGroup = new THREE.Group();
        potGroup.position.set(potX, 0.75, potZ);
        potGroup.lookAt(0, 0.75, 0);

        const potBody = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.25, 1.5, 32, 1, true), potMaterial);
        potBody.castShadow = true;
        potBody.receiveShadow = true;
        potGroup.add(potBody);

        const potRim = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.12, 24, 48), potRimMaterial);
        potRim.rotation.x = Math.PI / 2;
        potRim.position.y = 0.75;
        potRim.castShadow = true;
        potRim.receiveShadow = true;
        potGroup.add(potRim);

        const potSoil = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1, 0.18, 24), soilMaterial);
        potSoil.position.y = 0.9;
        potSoil.castShadow = true;
        potSoil.receiveShadow = true;
        potGroup.add(potSoil);

        const foliage = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.8, 28, 1, true), foliageMaterial);
        foliage.position.y = 1.8;
        foliage.castShadow = true;
        foliage.receiveShadow = true;
        potGroup.add(foliage);

        scene.add(potGroup);

        const sconceGroup = new THREE.Group();
        const sconceRadius = 19.1;
        const lampHeight = 4.4;
        const lampX = Math.cos(midAngle) * sconceRadius;
        const lampZ = Math.sin(midAngle) * sconceRadius;
        sconceGroup.position.set(lampX, lampHeight, lampZ);
        sconceGroup.lookAt(0, lampHeight, 0);

        const backplate = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 32), sconceMetal);
        backplate.rotation.x = Math.PI / 2;
        backplate.castShadow = true;
        backplate.receiveShadow = true;
        sconceGroup.add(backplate);

        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.55, 16), sconceMetal);
        arm.rotation.z = Math.PI / 2;
        arm.position.z = -0.3;
        arm.castShadow = true;
        arm.receiveShadow = true;
        sconceGroup.add(arm);

        const shade = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.9, 24, 1, true), sconceGlass);
        shade.position.z = -0.75;
        shade.rotation.x = Math.PI;
        shade.castShadow = false;
        shade.receiveShadow = false;
        sconceGroup.add(shade);

        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 16), new THREE.MeshStandardMaterial({
          color: '#fff3d8',
          emissive: '#ffe8b5',
          emissiveIntensity: 1.2,
          metalness: 0.05,
          roughness: 0.2
        }));
        bulb.position.z = -0.52;
        bulb.castShadow = false;
        sconceGroup.add(bulb);

        const sconceLight = new THREE.PointLight(0xffe5b0, 1.1, 9.5, 2.4);
        sconceLight.position.z = -0.45;
        sconceGroup.add(sconceLight);

        scene.add(sconceGroup);
      });
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const clampPitch = (value) => THREE.MathUtils.clamp(value, -Math.PI / 8, Math.PI / 4);
    const clampRadius = (value) => THREE.MathUtils.clamp(value, 3.6, 14);
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

    const clock = new THREE.Clock();
    let animationId = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const now = performance.now();

      targetPitch = clampPitch(targetPitch);
      targetRadius = clampRadius(targetRadius);
      targetYaw = wrapAngle(targetYaw);

      if (!dragging && now - lastInteraction > 4500) {
        targetYaw = wrapAngle(targetYaw - THREE.MathUtils.degToRad(4) * delta);
      }

      const yawLerp = 1 - Math.exp(-delta * 4.5);
      const pitchLerp = 1 - Math.exp(-delta * 5.5);
      const radiusLerp = 1 - Math.exp(-delta * 5);
      yaw = lerpAngle(yaw, targetYaw, yawLerp);
      pitch = THREE.MathUtils.lerp(pitch, targetPitch, pitchLerp);
      radius = THREE.MathUtils.lerp(radius, targetRadius, radiusLerp);

      updateCamera();
      renderer.render(scene, camera);
    };

    updateCamera();
    animate();

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
