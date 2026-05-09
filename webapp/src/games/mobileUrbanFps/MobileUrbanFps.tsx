import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import * as THREE from 'three';
import { mobileUrbanFpsAssets, assetSourceNotes } from './assetConfig';
import {
  DISPLAY_ITEMS,
  FIRST_PERSON_WEAPON,
  FPS_HAND_DONOR,
  FPS_WEAPON_OPTIONS,
  TOTAL_ITEMS,
  type DisplayEntry
} from './assetCatalog';
import { rifleStats, useMobileFpsStore } from './store';
import type { EnemyRuntime } from './types';
import {
  ShootAction,
  type ShootTarget,
  stableStep
} from './systems/ShootAction';
import {
  attachHandsToWeapon,
  configureModel,
  createProceduralMachine,
  disposeObject,
  loadModelByUrls,
  normalizeObject,
  targetDisplayLength
} from './systems/AssetLoader';
import './MobileUrbanFps.css';

const enemySeed: Array<[number, number, number]> = [
  [-4, 0.9, -11],
  [3.8, 0.9, -14],
  [-1.2, 0.9, -19],
  [5.5, 0.9, -27],
  [-5.5, 0.9, -34],
  [0.6, 0.9, -43]
];

const colliders = [
  new THREE.Box3(new THREE.Vector3(-8, -1, -56), new THREE.Vector3(8, 4, -55)),
  new THREE.Box3(new THREE.Vector3(-8, -1, 1), new THREE.Vector3(8, 4, 2)),
  new THREE.Box3(
    new THREE.Vector3(-8.5, -1, -56),
    new THREE.Vector3(-7.5, 4, 2)
  ),
  new THREE.Box3(new THREE.Vector3(7.5, -1, -56), new THREE.Vector3(8.5, 4, 2)),
  new THREE.Box3(
    new THREE.Vector3(-2.4, -1, -9),
    new THREE.Vector3(0.4, 2, -7.8)
  ),
  new THREE.Box3(
    new THREE.Vector3(2.4, -1, -17),
    new THREE.Vector3(5.8, 2, -15.8)
  ),
  new THREE.Box3(
    new THREE.Vector3(-6.4, -1, -22),
    new THREE.Vector3(-3.6, 2, -20.6)
  )
];

function clampPlayer(position: THREE.Vector3) {
  position.x = THREE.MathUtils.clamp(position.x, -6.8, 6.8);
  position.z = THREE.MathUtils.clamp(position.z, -54, -0.5);
  const playerBox = new THREE.Box3().setFromCenterAndSize(
    position,
    new THREE.Vector3(0.7, 1.7, 0.7)
  );
  for (const box of colliders) {
    if (playerBox.intersectsBox(box)) {
      const left = Math.abs(playerBox.max.x - box.min.x);
      const right = Math.abs(box.max.x - playerBox.min.x);
      const front = Math.abs(playerBox.max.z - box.min.z);
      const back = Math.abs(box.max.z - playerBox.min.z);
      const min = Math.min(left, right, front, back);
      if (min === left) position.x -= left;
      else if (min === right) position.x += right;
      else if (min === front) position.z -= front;
      else position.z += back;
    }
  }
}

function AssetLoader() {
  useEffect(() => {
    useGLTF.preload(mobileUrbanFpsAssets.weapon.rifleGlb);
    useGLTF.preload(mobileUrbanFpsAssets.hands.armsGlb);
    useGLTF.preload(mobileUrbanFpsAssets.enemies.soldierGlb);
    useGLTF.preload(mobileUrbanFpsAssets.city.buildingGlb);
    useGLTF.preload(mobileUrbanFpsAssets.city.propsGlb);
  }, []);
  return null;
}

function PbrMaterials() {
  const road = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#202025',
        roughness: 0.84,
        metalness: 0.02
      }),
    []
  );
  const concrete = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#77736b',
        roughness: 0.92,
        metalness: 0.01
      }),
    []
  );
  const brick = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#70463c',
        roughness: 0.88,
        metalness: 0.02
      }),
    []
  );
  const metal = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#4b5360',
        roughness: 0.48,
        metalness: 0.82
      }),
    []
  );
  const glass = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#a5c7dc',
        roughness: 0.16,
        metalness: 0,
        transmission: 0.18,
        transparent: true,
        opacity: 0.42
      }),
    []
  );
  return { road, concrete, brick, metal, glass };
}

function Building({
  x,
  z,
  height,
  width,
  depth,
  material,
  glass
}: {
  x: number;
  z: number;
  height: number;
  width: number;
  depth: number;
  material: THREE.Material;
  glass: THREE.Material;
}) {
  const windows = [];
  for (let floor = 1; floor < height; floor += 1.5) {
    windows.push(
      <mesh
        key={`w-${floor}`}
        position={[x, floor, z + depth / 2 + 0.011]}
        material={glass}
      >
        <boxGeometry args={[width * 0.62, 0.58, 0.03]} />
      </mesh>
    );
  }
  return (
    <group>
      <mesh
        position={[x, height / 2, z]}
        material={material}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width, height, depth]} />
      </mesh>
      {windows}
      <mesh position={[x, height + 0.05, z]} material={material} receiveShadow>
        <boxGeometry args={[width + 0.35, 0.1, depth + 0.35]} />
      </mesh>
    </group>
  );
}

const districtBlocks = [-6, -13, -21, -30, -40, -50];
const crossStreets = [-10, -24, -38, -50];

function RoadMarkings({ material }: { material: THREE.Material }) {
  return (
    <group>
      {Array.from({ length: 16 }, (_, i) => -2.5 - i * 3.2).map((z) => (
        <mesh
          key={`lane-${z}`}
          position={[0, 0.026, z]}
          rotation-x={-Math.PI / 2}
          material={material}
        >
          <planeGeometry args={[0.18, 1.25]} />
        </mesh>
      ))}
      {crossStreets.map((z) => (
        <group key={`crosswalk-${z}`} position={[0, 0.029, z]}>
          {[-2.7, -1.8, -0.9, 0, 0.9, 1.8, 2.7].map((x) => (
            <mesh
              key={`${z}-${x}`}
              position={[x, 0, 0]}
              rotation-x={-Math.PI / 2}
              material={material}
            >
              <planeGeometry args={[0.38, 2.35]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function StreetLight({ x, z }: { x: number; z: number }) {
  const mats = PbrMaterials();
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.85, 0]} material={mats.metal} castShadow>
        <cylinderGeometry args={[0.045, 0.06, 3.7, 8]} />
      </mesh>
      <mesh position={[x < 0 ? 0.32 : -0.32, 3.55, 0]} material={mats.metal}>
        <boxGeometry args={[0.62, 0.06, 0.08]} />
      </mesh>
      <pointLight
        position={[x < 0 ? 0.42 : -0.42, 3.42, 0]}
        intensity={1.65}
        distance={10}
        color="#ffe2a3"
      />
      <mesh position={[x < 0 ? 0.46 : -0.46, 3.38, 0]} material={mats.glass}>
        <sphereGeometry args={[0.14, 12, 8]} />
      </mesh>
    </group>
  );
}

function TrafficSignal({ x, z }: { x: number; z: number }) {
  const mats = PbrMaterials();
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.6, 0]} material={mats.metal}>
        <cylinderGeometry args={[0.035, 0.045, 3.2, 8]} />
      </mesh>
      <mesh position={[0, 3.05, 0]} material={mats.metal} castShadow>
        <boxGeometry args={[0.28, 0.72, 0.18]} />
      </mesh>
      {[
        ['#ff3b30', 3.24],
        ['#ffd60a', 3.05],
        ['#30d158', 2.86]
      ].map(([color, y]) => (
        <mesh key={color} position={[0, Number(y), -0.095]}>
          <sphereGeometry args={[0.055, 10, 8]} />
          <meshBasicMaterial color={String(color)} />
        </mesh>
      ))}
    </group>
  );
}

function BusStop({ x, z }: { x: number; z: number }) {
  const mats = PbrMaterials();
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.15, 0]} material={mats.glass}>
        <boxGeometry args={[1.25, 1.7, 0.05]} />
      </mesh>
      <mesh position={[0, 2.08, 0]} material={mats.metal} castShadow>
        <boxGeometry args={[1.5, 0.12, 0.72]} />
      </mesh>
      <mesh position={[0, 0.42, -0.25]} material={mats.metal} castShadow>
        <boxGeometry args={[1.08, 0.16, 0.28]} />
      </mesh>
      <mesh position={[0, 1.5, -0.33]} material={mats.metal}>
        <boxGeometry args={[0.72, 0.34, 0.04]} />
      </mesh>
    </group>
  );
}

function UrbanArena() {
  const mats = PbrMaterials();
  const markings = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#f8fafc',
        transparent: true,
        opacity: 0.76
      }),
    []
  );
  const park = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#256d3c',
        roughness: 0.9,
        metalness: 0.02
      }),
    []
  );
  const cover = [
    [-1, 0.55, -8.6, 2.8, 1.1, 1],
    [4.1, 0.55, -16.4, 3.4, 1.1, 1.1],
    [-5, 0.55, -28.5, 2.8, 1.1, 1.4],
    [2.2, 0.55, -39, 2.6, 1.1, 1.2]
  ];
  return (
    <group>
      <fog attach="fog" args={['#aab8c9', 42, 86]} />
      <hemisphereLight args={['#f7fbff', '#9aa07f', 1.55]} />
      <directionalLight
        position={[-6, 12, 5]}
        intensity={2.6}
        color="#fff3d6"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <mesh
        position={[0, 0, -27]}
        rotation-x={-Math.PI / 2}
        material={mats.road}
        receiveShadow
      >
        <planeGeometry args={[16, 58]} />
      </mesh>
      <mesh
        position={[-5.2, 0.012, -27]}
        rotation-x={-Math.PI / 2}
        material={mats.concrete}
        receiveShadow
      >
        <planeGeometry args={[4.2, 56]} />
      </mesh>
      <mesh
        position={[5.2, 0.012, -27]}
        rotation-x={-Math.PI / 2}
        material={mats.concrete}
        receiveShadow
      >
        <planeGeometry args={[4.2, 56]} />
      </mesh>
      <RoadMarkings material={markings} />
      {crossStreets.map((z) => (
        <mesh
          key={`avenue-${z}`}
          position={[0, 0.018, z]}
          rotation-x={-Math.PI / 2}
          material={mats.road}
          receiveShadow
        >
          <planeGeometry args={[15.5, 2.8]} />
        </mesh>
      ))}
      {[-7.1, 7.1].map((x) =>
        districtBlocks.map((z, i) => (
          <Building
            key={`${x}-${z}`}
            x={x}
            z={z}
            width={2.1 + ((i + (x > 0 ? 1 : 0)) % 3) * 0.55}
            depth={2.6 + (i % 2) * 0.4}
            height={5.4 + i * 0.72 + (x > 0 ? 0.55 : 0)}
            material={i % 2 ? mats.brick : mats.concrete}
            glass={mats.glass}
          />
        ))
      )}
      <mesh
        position={[-5.15, 0.035, -43.8]}
        rotation-x={-Math.PI / 2}
        material={park}
        receiveShadow
      >
        <planeGeometry args={[3.7, 6.4]} />
      </mesh>
      {[-6.2, -5, -4.1].map((x, i) => (
        <group key={`tree-${i}`} position={[x, 0, -42 - i * 1.55]}>
          <mesh position={[0, 0.72, 0]} material={mats.brick} castShadow>
            <cylinderGeometry args={[0.08, 0.12, 1.35, 8]} />
          </mesh>
          <mesh position={[0, 1.55, 0]} castShadow>
            <sphereGeometry args={[0.52, 12, 10]} />
            <meshStandardMaterial color="#1f7a3f" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {cover.map(([x, y, z, w, h, d], i) => (
        <mesh
          key={i}
          position={[x, y, z]}
          material={i === 1 ? mats.metal : mats.concrete}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[w, h, d]} />
        </mesh>
      ))}
      {[-12, -18, -26, -36, -46].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh
            position={[-2.8, 0.45, 0]}
            material={mats.metal}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[1, 0.9, 1.2]} />
          </mesh>
          <mesh
            position={[2.2, 0.35, 0.7]}
            material={mats.brick}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[1.2, 0.7, 1.2]} />
          </mesh>
        </group>
      ))}
      {[-4.25, 4.25].map((x) =>
        [-6, -14, -22, -30, -38, -48].map((z) => (
          <StreetLight key={`${x}-${z}`} x={x} z={z} />
        ))
      )}
      {crossStreets.flatMap((z) => [
        <TrafficSignal key={`tl-${z}-l`} x={-3.65} z={z + 1.25} />,
        <TrafficSignal key={`tl-${z}-r`} x={3.65} z={z - 1.25} />
      ])}
      <BusStop x={-5.45} z={-18.5} />
      <BusStop x={5.45} z={-34.5} />
      {[-12, -32, -46].map((z, i) => (
        <mesh
          key={`utility-${z}`}
          position={[i % 2 ? 5.35 : -5.35, 2.15, z]}
          material={mats.metal}
        >
          <boxGeometry args={[0.08, 4.2, 0.08]} />
        </mesh>
      ))}
    </group>
  );
}

type RuntimeDisplayAsset = {
  entry: DisplayEntry;
  root: THREE.Object3D;
  mixer?: THREE.AnimationMixer;
  basePosition: THREE.Vector3;
  baseRotation: THREE.Euler;
  index: number;
};

function assetSlotPosition(index: number) {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return new THREE.Vector3(-4.8 + col * 4.8, 0.18, -6.5 - row * 3.15);
}

function AssetArmory() {
  const groupRef = useRef<THREE.Group>(null);
  const runtimes = useRef<RuntimeDisplayAsset[]>([]);
  const { gl } = useThree();

  useEffect(() => {
    const mountedGroup = groupRef.current;
    if (!mountedGroup) return undefined;
    const liveGroup: THREE.Group = mountedGroup;
    let disposed = false;
    const loadedRoots: THREE.Object3D[] = [];

    async function loadDonor() {
      try {
        const { gltf } = await loadModelByUrls(
          'FPS donor hands',
          FPS_HAND_DONOR.urls,
          12000
        );
        if (disposed) return null;
        configureModel(gltf.scene, gl, { mobileMaxAnisotropy: 2 });
        return gltf.scene;
      } catch (error) {
        console.warn(
          'Urban FPS donor hands unavailable; weapons still load without cloned hands.',
          error
        );
        return null;
      }
    }

    async function loadEntry(
      entry: DisplayEntry,
      index: number,
      donorScene: THREE.Object3D | null
    ) {
      if (disposed) return;
      const slot = new THREE.Group();
      slot.position.copy(assetSlotPosition(index));
      slot.rotation.y = Math.PI;
      liveGroup.add(slot);
      loadedRoots.push(slot);

      try {
        const { gltf } = await loadModelByUrls(entry.name, entry.urls, 14000);
        if (disposed) return;
        const model = gltf.scene;
        configureModel(model, gl, { mobileMaxAnisotropy: 2 });
        normalizeObject(model, targetDisplayLength(entry) * 0.72);
        model.rotation.x =
          entry.rotateX ?? (entry.kind === 'weapon' ? -0.06 : 0);
        model.rotation.y =
          (entry.rotateY ?? 0) + (entry.kind === 'weapon' ? Math.PI : 0);
        attachHandsToWeapon(entry, model, donorScene, gl);
        slot.add(model);
        const mixer = gltf.animations.length
          ? new THREE.AnimationMixer(model)
          : undefined;
        if (mixer) {
          gltf.animations.forEach((clip) =>
            mixer
              .clipAction(clip)
              .setLoop(THREE.LoopRepeat, Infinity)
              .reset()
              .play()
          );
        }
        runtimes.current.push({
          entry,
          root: model,
          mixer,
          basePosition: model.position.clone(),
          baseRotation: model.rotation.clone(),
          index
        });
      } catch (error) {
        console.warn(
          'Urban FPS asset fell back to procedural stand-in:',
          entry.name,
          error
        );
        const fallback = createProceduralMachine(entry);
        normalizeObject(fallback, targetDisplayLength(entry) * 0.72);
        fallback.rotation.y = entry.rotateY ?? 0;
        slot.add(fallback);
        runtimes.current.push({
          entry,
          root: fallback,
          basePosition: fallback.position.clone(),
          baseRotation: fallback.rotation.clone(),
          index
        });
      }
    }

    async function loadAll() {
      const donorScene = await loadDonor();
      await Promise.allSettled(
        DISPLAY_ITEMS.map((entry, index) => loadEntry(entry, index, donorScene))
      );
    }

    loadAll();

    return () => {
      disposed = true;
      runtimes.current.forEach((runtime) => disposeObject(runtime.root));
      loadedRoots.forEach((root) => liveGroup.remove(root));
      runtimes.current = [];
    };
  }, [gl]);

  useFrame((_, dt) => {
    const elapsed = performance.now() / 1000;
    runtimes.current.forEach((runtime) => {
      runtime.mixer?.update(Math.min(dt, 0.05));
      const offset = runtime.index * 0.61;
      const isWeapon = runtime.entry.kind === 'weapon';
      const isFloating =
        runtime.entry.kind === 'aircraft' || runtime.entry.kind === 'equipment';
      const idle = Math.sin(elapsed * 2.2 + offset) * 0.018;
      const float =
        Math.sin(elapsed * (1.35 + offset * 0.03)) *
        (runtime.entry.floatAmp ?? 0.0);
      const sway = Math.sin(elapsed * 1.25 + offset) * 0.028;
      runtime.root.position.y = THREE.MathUtils.lerp(
        runtime.root.position.y,
        runtime.basePosition.y +
          (isWeapon ? idle : 0) +
          (isFloating ? float : 0),
        0.16
      );
      runtime.root.rotation.y = THREE.MathUtils.lerp(
        runtime.root.rotation.y,
        runtime.baseRotation.y +
          (isWeapon
            ? sway
            : isFloating
              ? elapsed * (runtime.entry.spinSpeed ?? 0.0006)
              : 0),
        0.12
      );
      runtime.root.traverse((obj) => {
        if (obj.name === 'procedural-propeller') obj.rotation.x = elapsed * 28;
      });
    });
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.04, -19]} receiveShadow>
        <boxGeometry args={[14.8, 0.08, 29.5]} />
        <meshStandardMaterial
          color="#10151f"
          roughness={0.82}
          metalness={0.08}
        />
      </mesh>
      <mesh position={[0, 0.1, -19]} receiveShadow>
        <boxGeometry args={[15.1, 0.1, 30.2]} />
        <meshStandardMaterial
          color="#252b35"
          roughness={0.78}
          metalness={0.16}
        />
      </mesh>
    </group>
  );
}

function FirstPersonWeaponAsset({
  visible,
  selectedWeapon,
  onReady
}: {
  visible: boolean;
  selectedWeapon: DisplayEntry;
  onReady: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { gl } = useThree();

  useEffect(() => {
    const mountedGroup = groupRef.current;
    if (!mountedGroup) return undefined;
    const liveGroup: THREE.Group = mountedGroup;
    let disposed = false;
    let root: THREE.Object3D | null = null;

    async function loadFirstPersonRig() {
      try {
        const [weaponResult, donorResult] = await Promise.allSettled([
          loadModelByUrls(selectedWeapon.name, selectedWeapon.urls, 14000),
          loadModelByUrls('FPS donor hands', FPS_HAND_DONOR.urls, 14000)
        ]);
        if (disposed || weaponResult.status !== 'fulfilled') return;
        const weapon = weaponResult.value.gltf.scene;
        const donorScene =
          donorResult.status === 'fulfilled'
            ? donorResult.value.gltf.scene
            : null;
        configureModel(weapon, gl, {
          frustumCulled: false,
          mobileMaxAnisotropy: 2
        });
        if (donorScene)
          configureModel(donorScene, gl, {
            frustumCulled: false,
            mobileMaxAnisotropy: 2
          });
        normalizeObject(weapon, 0.86);
        weapon.position.set(0, 0.02, 0);
        weapon.rotation.set(-0.04, Math.PI, 0);
        attachHandsToWeapon(selectedWeapon, weapon, donorScene, gl);
        root = weapon;
        liveGroup.add(weapon);
        onReady();
      } catch (error) {
        console.warn(
          'Urban FPS first-person GLTF rig unavailable; using procedural fallback.',
          error
        );
      }
    }

    loadFirstPersonRig();

    return () => {
      disposed = true;
      if (root) {
        liveGroup.remove(root);
        disposeObject(root);
      }
    };
  }, [gl, onReady, selectedWeapon]);

  useFrame(() => {
    if (!groupRef.current) return;
    const recoil = useMobileFpsStore.getState().recoil;
    groupRef.current.position.z = -0.86 + recoil * 2.4;
    groupRef.current.position.y = -0.42 - recoil * 0.75;
  });

  return (
    <group
      ref={groupRef}
      visible={visible}
      position={[0.48, -0.42, -0.86]}
      rotation={[0.03, -0.08, 0]}
    />
  );
}

function WeaponView() {
  const selectedWeaponId = useMobileFpsStore((state) => state.selectedWeaponId);
  const selectedWeapon =
    FPS_WEAPON_OPTIONS.find((entry) => entry.id === selectedWeaponId) ??
    FIRST_PERSON_WEAPON;
  const [assetReady, setAssetReady] = useState(false);
  const handleWeaponReady = useCallback(() => setAssetReady(true), []);

  useEffect(() => {
    setAssetReady(false);
  }, [selectedWeapon.id]);
  const muzzleFlashUntil = useMobileFpsStore((state) => state.muzzleFlashUntil);
  const now = performance.now();
  const rifleMetal = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#24272d',
        roughness: 0.38,
        metalness: 0.92
      }),
    []
  );
  const wornWood = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#5c3822',
        roughness: 0.68,
        metalness: 0.04
      }),
    []
  );
  const leather = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#2b1c16',
        roughness: 0.86,
        metalness: 0.02
      }),
    []
  );
  return (
    <>
      <FirstPersonWeaponAsset
        key={selectedWeapon.id}
        visible={assetReady}
        selectedWeapon={selectedWeapon}
        onReady={handleWeaponReady}
      />
      <group
        visible={!assetReady}
        position={[0.48, -0.42, -0.86]}
        rotation={[0.03, -0.08, 0]}
      >
        <mesh material={wornWood} castShadow>
          <boxGeometry args={[0.18, 0.16, 0.78]} />
        </mesh>
        <mesh position={[0, 0.08, -0.55]} material={rifleMetal} castShadow>
          <boxGeometry args={[0.12, 0.1, 1.08]} />
        </mesh>
        <mesh
          position={[0, 0.08, -1.2]}
          rotation-x={Math.PI / 2}
          material={rifleMetal}
          castShadow
        >
          <cylinderGeometry args={[0.038, 0.048, 0.7, 16]} />
        </mesh>
        <mesh position={[-0.15, -0.11, -0.18]} material={leather} castShadow>
          <boxGeometry args={[0.12, 0.24, 0.32]} />
        </mesh>
        {now < muzzleFlashUntil && (
          <pointLight
            position={[0, 0.1, -1.62]}
            intensity={7}
            distance={4}
            color="#ffb15c"
          />
        )}
        {now < muzzleFlashUntil && (
          <mesh
            position={[0, 0.1, -1.58]}
            material={
              new THREE.MeshBasicMaterial({
                color: '#ffdd8a',
                transparent: true,
                opacity: 0.82
              })
            }
          >
            <coneGeometry args={[0.18, 0.5, 12]} />
          </mesh>
        )}
      </group>
      {now < muzzleFlashUntil && assetReady && (
        <pointLight
          position={[0.48, -0.32, -2.44]}
          intensity={7}
          distance={4}
          color="#ffb15c"
        />
      )}
    </>
  );
}

function EnemyMesh({
  enemy,
  register
}: {
  enemy: EnemyRuntime;
  register: (target: ShootTarget | null) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const body = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#52605a',
        roughness: 0.78,
        metalness: 0.05
      }),
    []
  );
  const vest = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#22272c',
        roughness: 0.62,
        metalness: 0.18
      }),
    []
  );

  useEffect(() => {
    if (!ref.current) return;
    register({
      id: enemy.id,
      object: ref.current,
      applyDamage: (damage) => {
        enemy.health = Math.max(0, enemy.health - damage);
        enemy.hitFlash = 0.12;
      }
    });
    return () => register(null);
  }, [enemy, register]);

  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.position.copy(enemy.position);
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    ref.current.visible = enemy.state !== 'dead';
  });

  return (
    <group ref={ref}>
      <mesh
        position={[0, 0.05, 0]}
        material={
          enemy.hitFlash > 0
            ? new THREE.MeshBasicMaterial({ color: '#ff4d4d' })
            : vest
        }
        castShadow
      >
        <capsuleGeometry args={[0.34, 0.78, 6, 10]} />
      </mesh>
      <mesh position={[0, 0.78, 0]} material={body} castShadow>
        <sphereGeometry args={[0.24, 12, 10]} />
      </mesh>
      <mesh position={[0, -0.43, 0.12]} material={body} castShadow>
        <boxGeometry args={[0.55, 0.34, 0.22]} />
      </mesh>
    </group>
  );
}

function TracerLine({
  from,
  to,
  material
}: {
  from: [number, number, number];
  to: [number, number, number];
  material: THREE.LineBasicMaterial;
}) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...from),
      new THREE.Vector3(...to)
    ]);
    return new THREE.Line(geometry, material);
  }, [from, material, to]);
  useEffect(() => () => line.geometry.dispose(), [line]);
  return <primitive object={line} />;
}

function Effects() {
  const tracers = useMobileFpsStore((state) => state.tracers);
  const impacts = useMobileFpsStore((state) => state.impacts);
  const tracerMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#ffe7a3',
        transparent: true,
        opacity: 0.9
      }),
    []
  );
  const impactMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffb86b',
        transparent: true,
        opacity: 0.62
      }),
    []
  );
  return (
    <group>
      {tracers.map((tracer) => (
        <TracerLine
          key={tracer.id}
          from={tracer.from}
          to={tracer.to}
          material={tracerMaterial}
        />
      ))}
      {impacts.map((impact) => (
        <mesh
          key={impact.id}
          position={impact.position}
          material={impactMaterial}
        >
          <sphereGeometry args={[0.11 + impact.life * 0.16, 8, 8]} />
        </mesh>
      ))}
    </group>
  );
}

function CameraController({ enemies }: { enemies: EnemyRuntime[] }) {
  const { camera } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(0);
  const player = useRef(new THREE.Vector3(0, 1.55, -1.2));
  const fixedAccumulator = useRef(0);
  const shootAction = useMemo(() => new ShootAction(), []);
  const targets = useRef<Map<string, ShootTarget>>(new Map());

  useEffect(() => {
    camera.position.copy(player.current);
    camera.rotation.order = 'YXZ';
  }, [camera]);

  useFrame((_, dt) => {
    const state = useMobileFpsStore.getState();
    state.tickFx(dt);
    state.recoverRecoil(rifleStats.recoilRecovery * dt * 0.02);
    if (state.phase !== 'playing') return;

    const lookSensitivity = 2.45;
    yaw.current -= state.input.lookX * lookSensitivity * dt;
    pitch.current = THREE.MathUtils.clamp(
      pitch.current - state.input.lookY * lookSensitivity * dt - state.recoil,
      -1.1,
      1.05
    );
    state.setInput({ lookX: 0, lookY: 0 });

    fixedAccumulator.current += Math.min(dt, 0.05);
    while (fixedAccumulator.current >= stableStep) {
      const forward = new THREE.Vector3(
        Math.sin(yaw.current),
        0,
        Math.cos(yaw.current) * -1
      );
      const right = new THREE.Vector3(
        Math.cos(yaw.current),
        0,
        Math.sin(yaw.current)
      );
      const move = forward
        .multiplyScalar(state.input.moveY)
        .add(right.multiplyScalar(state.input.moveX));
      if (move.lengthSq() > 1) move.normalize();
      player.current.addScaledVector(move, 4.2 * stableStep);
      clampPlayer(player.current);
      updateEnemies(enemies, player.current, stableStep);
      fixedAccumulator.current -= stableStep;
    }

    const alive = enemies.filter((enemy) => enemy.state !== 'dead').length;
    state.setEnemiesAlive(alive);
    camera.position.lerp(player.current, 0.72);
    camera.rotation.set(pitch.current, yaw.current, 0);
    shootAction.update(
      performance.now(),
      Array.from(targets.current.values()),
      camera
    );
  });

  return (
    <>
      {enemies.map((enemy) => (
        <EnemyMesh
          key={enemy.id}
          enemy={enemy}
          register={(target) => {
            if (target) targets.current.set(enemy.id, target);
            else targets.current.delete(enemy.id);
          }}
        />
      ))}
      <primitive object={camera}>
        <WeaponView />
      </primitive>
    </>
  );
}

function updateEnemies(
  enemies: EnemyRuntime[],
  player: THREE.Vector3,
  dt: number
) {
  const store = useMobileFpsStore.getState();
  for (const enemy of enemies) {
    if (enemy.health <= 0) {
      enemy.state = 'dead';
      continue;
    }
    const toPlayer = player.clone().sub(enemy.position);
    const distance = toPlayer.length();
    if (distance < 1.45) {
      enemy.state = 'attack';
      enemy.attackCooldown -= dt;
      if (enemy.attackCooldown <= 0) {
        store.damagePlayer(8);
        enemy.attackCooldown = 0.95;
      }
      continue;
    }
    enemy.state = distance < 11 ? 'chase' : 'patrol';
    const target = enemy.state === 'chase' ? player : enemy.patrolTarget;
    const desired = target.clone().sub(enemy.position);
    desired.y = 0;
    if (desired.length() < 0.25 && enemy.state === 'patrol') {
      enemy.patrolTarget.set(
        enemy.position.x + (Math.random() - 0.5) * 3,
        enemy.position.y,
        enemy.position.z + (Math.random() - 0.5) * 3
      );
    } else {
      desired.normalize();
      enemy.position.addScaledVector(
        desired,
        (enemy.state === 'chase' ? 1.45 : 0.55) * dt
      );
    }
  }
}

const Scene = memo(function Scene() {
  const enemies = useMemo<EnemyRuntime[]>(
    () =>
      enemySeed.map((pos, index) => ({
        id: `enemy-${index}`,
        position: new THREE.Vector3(...pos),
        patrolTarget: new THREE.Vector3(
          pos[0] + (index % 2 ? 1.8 : -1.4),
          pos[1],
          pos[2] - 1.2
        ),
        health: 100,
        maxHealth: 100,
        state: 'idle',
        attackCooldown: 0.7,
        hitFlash: 0
      })),
    []
  );
  return (
    <>
      <AssetLoader />
      <ambientLight intensity={0.42} />
      <directionalLight
        position={[3, 8, 2]}
        intensity={2.3}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <hemisphereLight args={['#9fb7ff', '#1f2937', 0.65]} />
      <UrbanArena />
      <AssetArmory />
      <CameraController enemies={enemies} />
      <Effects />
    </>
  );
});

function TouchHud() {
  const health = useMobileFpsStore((state) => state.health);
  const ammo = useMobileFpsStore((state) => state.ammo);
  const reserveAmmo = useMobileFpsStore((state) => state.reserveAmmo);
  const reloading = useMobileFpsStore((state) => state.reloading);
  const enemiesAlive = useMobileFpsStore((state) => state.enemiesAlive);
  const phase = useMobileFpsStore((state) => state.phase);
  const hitMarkerUntil = useMobileFpsStore((state) => state.hitMarkerUntil);
  const selectedWeaponId = useMobileFpsStore((state) => state.selectedWeaponId);
  const cycleWeapon = useMobileFpsStore((state) => state.cycleWeapon);
  const setInput = useMobileFpsStore((state) => state.setInput);
  const reset = useMobileFpsStore((state) => state.reset);
  const selectedWeapon =
    FPS_WEAPON_OPTIONS.find((entry) => entry.id === selectedWeaponId) ??
    FIRST_PERSON_WEAPON;
  const stick = useRef<HTMLDivElement>(null);
  const joystickId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });

  const resetStick = () => {
    joystickId.current = null;
    setInput({ moveX: 0, moveY: 0 });
    if (stick.current) stick.current.style.transform = 'translate(0px, 0px)';
  };

  const updateJoystick = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const maxRadius = rect.width * 0.42;
    const rawLength = Math.hypot(dx, dy);
    const len = Math.min(maxRadius, rawLength);
    const angle = Math.atan2(dy, dx);
    const x = Math.cos(angle) * len;
    const y = Math.sin(angle) * len;
    const normalized = rawLength < 8 ? 0 : len / maxRadius;
    setInput({
      moveX: Math.cos(angle) * normalized,
      moveY: -Math.sin(angle) * normalized
    });
    if (stick.current)
      stick.current.style.transform = `translate(${x}px, ${y}px)`;
  };

  return (
    <div className="mobile-fps-hud">
      <div className="mobile-fps-topbar">
        <div className="mobile-fps-pill">
          <span className="mobile-fps-label">HEALTH</span>
          <span className="mobile-fps-value">{health}</span>
        </div>
        <div className="mobile-fps-pill">
          <span className="mobile-fps-label">AMMO</span>
          <span className="mobile-fps-value">
            {reloading ? 'RELOAD' : `${ammo}/${reserveAmmo}`}
          </span>
        </div>
        <div className="mobile-fps-pill">
          <span className="mobile-fps-label">TARGETS</span>
          <span className="mobile-fps-value">{enemiesAlive}</span>
        </div>
      </div>
      <div className="mobile-fps-crosshair" />
      <div
        className={`mobile-fps-hit ${performance.now() < hitMarkerUntil ? 'active' : ''}`}
      />
      <div
        className="mobile-fps-joystick"
        onPointerDown={(event) => {
          joystickId.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          updateJoystick(event);
        }}
        onPointerMove={(event) => {
          if (joystickId.current !== event.pointerId) return;
          updateJoystick(event);
        }}
        onPointerCancel={resetStick}
        onPointerUp={resetStick}
      >
        <div ref={stick} className="mobile-fps-stick" />
      </div>
      <div
        className="mobile-fps-lookzone"
        onPointerDown={(event) => {
          lookId.current = event.pointerId;
          lookLast.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (lookId.current !== event.pointerId) return;
          const dx = event.clientX - lookLast.current.x;
          const dy = event.clientY - lookLast.current.y;
          lookLast.current = { x: event.clientX, y: event.clientY };
          setInput({
            lookX: THREE.MathUtils.clamp(dx / 58, -0.82, 0.82),
            lookY: THREE.MathUtils.clamp(dy / 58, -0.82, 0.82)
          });
        }}
        onPointerUp={() => {
          lookId.current = null;
          setInput({ lookX: 0, lookY: 0 });
        }}
        onPointerCancel={() => {
          lookId.current = null;
          setInput({ lookX: 0, lookY: 0 });
        }}
      />
      <button
        className="mobile-fps-button mobile-fps-reload"
        onPointerDown={() => setInput({ reloading: true })}
      >
        RELOAD
      </button>
      <button
        className="mobile-fps-button mobile-fps-shoot"
        onPointerDown={() => setInput({ firing: true })}
        onPointerUp={() => setInput({ firing: false })}
        onPointerCancel={() => setInput({ firing: false })}
      >
        FIRE
      </button>
      <div className="mobile-fps-weapon-switch">
        <button
          type="button"
          onPointerDown={() => cycleWeapon(-1)}
          aria-label="Previous weapon"
        >
          ◀
        </button>
        <span>{selectedWeapon.shortName}</span>
        <button
          type="button"
          onPointerDown={() => cycleWeapon(1)}
          aria-label="Next weapon"
        >
          ▶
        </button>
      </div>
      <div className="mobile-fps-status">
        Smooth joystick · right drag aims · {TOTAL_ITEMS} open-source GLB/GLTF
        slots
      </div>
      {phase !== 'playing' && (
        <div className="mobile-fps-modal">
          <div className="mobile-fps-card">
            <h2>{phase === 'won' ? 'Zone cleared' : 'You were downed'}</h2>
            <p>
              {phase === 'won'
                ? 'All enemy targets neutralized.'
                : 'Use cover, reload early, and keep distance.'}
            </p>
            <button
              onClick={() => {
                reset();
                window.location.reload();
              }}
            >
              Restart Mission
            </button>
          </div>
        </div>
      )}
      <div className="mobile-fps-notes">
        PBR/GLB paths are configurable; mobile build targets low draw calls,
        simple colliders, no heavy postprocessing.
      </div>
    </div>
  );
}

export default function MobileUrbanFps() {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <main
      className="mobile-fps-shell"
      aria-label="Mobile portrait FPS preview frame"
    >
      <section className="mobile-fps-frame">
        <Canvas
          className="mobile-fps-canvas"
          shadows
          dpr={[1, 1.65]}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
          camera={{ fov: 68, near: 0.08, far: 58, position: [0, 1.55, -1.2] }}
        >
          <Scene />
        </Canvas>
        <TouchHud />
      </section>
      <div className="sr-only">{assetSourceNotes.join(' ')}</div>
    </main>
  );
}
