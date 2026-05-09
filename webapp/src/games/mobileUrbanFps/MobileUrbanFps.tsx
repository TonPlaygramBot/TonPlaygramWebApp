import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  Component,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type { PointerEvent, ReactNode } from 'react';
import * as THREE from 'three';
import { mobileUrbanFpsAssets, assetSourceNotes } from './assetConfig';
import {
  openWorldAssetManifest,
  openWorldMaterialSources
} from './openWorldAssets';
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
import {
  helicopterFlightConfig,
  isNearPoint,
  stepHelicopterFlight
} from './systems/HelicopterSystem';
import {
  mapPortraitLookDelta,
  normalizeJoystickInput
} from './systems/MobileControlsSystem';
import { applyFirstPersonRecoil } from './systems/RecoilSystem';
import './MobileUrbanFps.css';

const FPS_GRAPHICS_STORAGE_KEY = 'mobileUrbanFpsGraphics';
const FPS_GRAPHICS_OPTIONS = [
  {
    id: 'fhd60',
    label: 'Performance (60 Hz)',
    fps: 60,
    dpr: [1, 1.15] as [number, number],
    shadows: false,
    antialias: false,
    note: 'Pool Royale style 2K/mobile battery profile.'
  },
  {
    id: 'qhd90',
    label: 'Smooth (90 Hz)',
    fps: 90,
    dpr: [1, 1.45] as [number, number],
    shadows: true,
    antialias: false,
    note: 'Pool Royale style 4K clarity target for modern phones.'
  },
  {
    id: 'uhd120',
    label: 'Ultra (120 Hz)',
    fps: 120,
    dpr: [1, 1.75] as [number, number],
    shadows: true,
    antialias: true,
    note: 'High refresh profile; use only on strong devices.'
  }
] as const;

function readInitialGraphicsId() {
  if (typeof window === 'undefined') return 'fhd60';
  const stored = window.localStorage?.getItem(FPS_GRAPHICS_STORAGE_KEY);
  if (FPS_GRAPHICS_OPTIONS.some((option) => option.id === stored))
    return stored;
  const memory = (navigator as any).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  return memory >= 6 && cores >= 6 ? 'qhd90' : 'fhd60';
}

class MobileFpsErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Mobile Urban FPS render failed', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mobile-fps-fallback">
          <strong>Graphics reset needed</strong>
          <span>Urban Ops could not start WebGL on this device.</span>
          <button onClick={() => window.location.reload()}>Reload game</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const CITY_BOUNDS = {
  minX: -24,
  maxX: 24,
  minZ: -162,
  maxZ: 8
} as const;

const PLAYER_STANDING_Y = 1.55;
const HELIPAD_POSITION = new THREE.Vector3(0, 12.45, -70);
const ARMORY_VISIBLE_ITEM_LIMIT = 9;
const ARMORY_REMOTE_LOAD_LIMIT = 4;
const ARMORY_REMOTE_LOAD_DELAY_MS = 700;

type PbrMaterialSet = ReturnType<typeof PbrMaterials>;

const enemySeed: Array<[number, number, number]> = [
  [-5, 0.9, -18],
  [6, 0.9, -31],
  [-11, 0.9, -48],
  [10, 0.9, -66],
  [-6, 0.9, -91],
  [7, 0.9, -118],
  [-12, 0.9, -139],
  [12, 0.9, -152]
];

type BuildingSpec = {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  material: 'concrete' | 'brick' | 'metal' | 'mall';
  label?: string;
  mall?: boolean;
};

type CityCollider = {
  box: THREE.Box3;
  roofHeight: number;
};

type StairSpec = {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  side: -1 | 1;
};

const districtBlocks = Array.from(
  { length: 13 },
  (_, index) => -8 - index * 12
);
const crossStreets = [-16, -40, -64, -88, -112, -136, -156];

const TONPLAYGRAM_MALL: BuildingSpec = {
  id: 'tonplaygram-mall',
  x: 0,
  z: -70,
  width: 17,
  depth: 22,
  height: 10.8,
  material: 'mall',
  label: 'TonPlaygram Mall',
  mall: true
};

const generatedBuildings: BuildingSpec[] = districtBlocks.flatMap((z, row) =>
  [-1, 1].flatMap((side) => {
    const nearMall = z < -56 && z > -84;
    const frontX = side * (9.8 + (row % 2) * 0.8);
    const backX = side * (18.2 + (row % 3) * 0.45);
    const baseHeight = 8 + ((row * 1.7 + (side > 0 ? 2 : 0)) % 7);
    return [
      {
        id: `tower-${side}-${row}-front`,
        x: nearMall ? side * 19 : frontX,
        z,
        width: 4.8 + (row % 3) * 0.7,
        depth: 5.6,
        height: baseHeight,
        material: row % 2 ? 'brick' : 'concrete'
      },
      {
        id: `tower-${side}-${row}-rear`,
        x: backX,
        z: z - 3.2,
        width: 4.4 + ((row + 1) % 3) * 0.65,
        depth: 5.2,
        height: baseHeight + 2.6,
        material: row % 2 ? 'concrete' : 'brick'
      }
    ] as BuildingSpec[];
  })
);

const cityBuildings: BuildingSpec[] = [TONPLAYGRAM_MALL, ...generatedBuildings];

const roofStairs: StairSpec[] = cityBuildings.map((building) => {
  const side = building.x >= 0 ? 1 : -1;
  const width = building.mall ? 3.8 : 1.35;
  const depth = building.mall ? 9.8 : 5.2;
  return {
    id: `${building.id}-roof-stairs`,
    x: building.x + side * (building.width / 2 + width / 2 + 0.22),
    z: building.z + building.depth * 0.12,
    width,
    depth,
    height: building.height,
    side
  };
});

function makeCollider(building: BuildingSpec): CityCollider {
  return {
    box: new THREE.Box3(
      new THREE.Vector3(
        building.x - building.width / 2,
        -1,
        building.z - building.depth / 2
      ),
      new THREE.Vector3(
        building.x + building.width / 2,
        building.height + 1.4,
        building.z + building.depth / 2
      )
    ),
    roofHeight: building.height
  };
}

const cityColliders: CityCollider[] = [
  {
    box: new THREE.Box3(
      new THREE.Vector3(CITY_BOUNDS.minX - 3, -1, CITY_BOUNDS.minZ - 3),
      new THREE.Vector3(CITY_BOUNDS.maxX + 3, 20, CITY_BOUNDS.minZ)
    ),
    roofHeight: 99
  },
  ...cityBuildings.map(makeCollider)
];

function isInsideRect(
  x: number,
  z: number,
  centerX: number,
  centerZ: number,
  width: number,
  depth: number
) {
  return (
    x >= centerX - width / 2 &&
    x <= centerX + width / 2 &&
    z >= centerZ - depth / 2 &&
    z <= centerZ + depth / 2
  );
}

function navigationHeight(position: THREE.Vector3) {
  let targetY = PLAYER_STANDING_Y;

  for (const stair of roofStairs) {
    if (
      !isInsideRect(
        position.x,
        position.z,
        stair.x,
        stair.z,
        stair.width,
        stair.depth
      )
    )
      continue;
    const localZ = THREE.MathUtils.clamp(
      (position.z - (stair.z - stair.depth / 2)) / stair.depth,
      0,
      1
    );
    targetY = Math.max(targetY, PLAYER_STANDING_Y + localZ * stair.height);
  }

  for (const building of cityBuildings) {
    const onRoof = isInsideRect(
      position.x,
      position.z,
      building.x,
      building.z,
      building.width + 0.6,
      building.depth + 0.6
    );
    if (onRoof && position.y >= building.height - 0.4) {
      targetY = Math.max(targetY, building.height + PLAYER_STANDING_Y);
    }
  }

  return targetY;
}

function clampPlayer(position: THREE.Vector3, vehicleMode = false) {
  position.x = THREE.MathUtils.clamp(
    position.x,
    CITY_BOUNDS.minX,
    CITY_BOUNDS.maxX
  );
  position.z = THREE.MathUtils.clamp(
    position.z,
    CITY_BOUNDS.minZ,
    CITY_BOUNDS.maxZ
  );

  if (vehicleMode) {
    position.y = THREE.MathUtils.clamp(position.y, 6, 42);
    return;
  }

  position.y = navigationHeight(position);
  const playerBox = new THREE.Box3().setFromCenterAndSize(
    position,
    new THREE.Vector3(0.7, 1.7, 0.7)
  );

  for (const collider of cityColliders) {
    if (position.y > collider.roofHeight + 0.9) continue;
    const box = collider.box;
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

  position.y = navigationHeight(position);
}

function isNearHelipad(position: THREE.Vector3) {
  return isNearPoint(position, HELIPAD_POSITION, 6.8);
}

function AssetLoader() {
  useEffect(() => {
    useGLTF.preload(mobileUrbanFpsAssets.weapon.rifleGlb);
    useGLTF.preload(mobileUrbanFpsAssets.hands.armsGlb);

    const preloadOptionalAssets = () => {
      FPS_WEAPON_OPTIONS.slice(0, 2).forEach((entry) => {
        useGLTF.preload(entry.urls[0]);
      });
    };

    const idleId = window.setTimeout(
      preloadOptionalAssets,
      ARMORY_REMOTE_LOAD_DELAY_MS
    );
    return () => window.clearTimeout(idleId);
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

function createTextSpriteMaterial(
  text: string,
  options: {
    width?: number;
    height?: number;
    bg?: string;
    fg?: string;
    fontSize?: number;
  } = {}
) {
  const width = options.width ?? 1024;
  const height = options.height ?? 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = options.bg ?? 'rgba(3, 7, 18, 0.78)';
    const drawRoundedRect =
      typeof ctx.roundRect === 'function'
        ? (mode: 'fill' | 'stroke') => {
            ctx.beginPath();
            ctx.roundRect(18, 18, width - 36, height - 36, 32);
            if (mode === 'fill') ctx.fill();
            else ctx.stroke();
          }
        : null;
    if (drawRoundedRect) drawRoundedRect('fill');
    else ctx.fillRect(18, 18, width - 36, height - 36);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 8;
    if (drawRoundedRect) drawRoundedRect('stroke');
    ctx.fillStyle = options.fg ?? '#ffffff';
    ctx.font = `900 ${options.fontSize ?? 78}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2, width - 90);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
  });
  material.userData.disposeTexture = () => texture.dispose();
  return material;
}

function LabelSprite({
  text,
  position,
  scale = [4, 1, 1],
  bg,
  fg,
  fontSize
}: {
  text: string;
  position: [number, number, number];
  scale?: [number, number, number];
  bg?: string;
  fg?: string;
  fontSize?: number;
}) {
  const material = useMemo(
    () => createTextSpriteMaterial(text, { bg, fg, fontSize }),
    [bg, fg, fontSize, text]
  );
  useEffect(
    () => () => {
      material.userData.disposeTexture?.();
      material.dispose();
    },
    [material]
  );
  return <sprite position={position} scale={scale} material={material} />;
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

function RoadMarkings({ material }: { material: THREE.Material }) {
  return (
    <group>
      {Array.from({ length: 50 }, (_, i) => 4 - i * 3.3).map((z) => (
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
          {[-3.7, -2.5, -1.25, 0, 1.25, 2.5, 3.7].map((x) => (
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

function StreetLight({
  x,
  z,
  mats
}: {
  x: number;
  z: number;
  mats: PbrMaterialSet;
}) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.85, 0]} material={mats.metal} castShadow>
        <cylinderGeometry args={[0.045, 0.06, 3.7, 8]} />
      </mesh>
      <mesh position={[x < 0 ? 0.32 : -0.32, 3.55, 0]} material={mats.metal}>
        <boxGeometry args={[0.62, 0.06, 0.08]} />
      </mesh>
      <mesh position={[x < 0 ? 0.46 : -0.46, 3.38, 0]} material={mats.glass}>
        <sphereGeometry args={[0.14, 12, 8]} />
      </mesh>
    </group>
  );
}

function TrafficSignal({
  x,
  z,
  mats
}: {
  x: number;
  z: number;
  mats: PbrMaterialSet;
}) {
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

function BusStop({
  x,
  z,
  mats
}: {
  x: number;
  z: number;
  mats: PbrMaterialSet;
}) {
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

const mallGameSections = [
  'Urban Ops FPS',
  'Pool Royale',
  'Domino Royal',
  'Texas Holdem',
  'Chess Battle',
  'Goal Rush',
  'Air Hockey',
  'Snake & Ladder',
  'Murlan Royale',
  'Snooker Royal',
  'Tennis',
  'Bowling'
];

function BuildingBlock({
  building,
  mats
}: {
  building: BuildingSpec;
  mats: PbrMaterialSet;
}) {
  const material =
    building.material === 'brick'
      ? mats.brick
      : building.material === 'metal'
        ? mats.metal
        : building.material === 'mall'
          ? mats.glass
          : mats.concrete;
  return (
    <group>
      <Building
        x={building.x}
        z={building.z}
        width={building.width}
        depth={building.depth}
        height={building.height}
        material={material}
        glass={mats.glass}
      />
      {building.mall && (
        <>
          <LabelSprite
            text="TONPLAYGRAM MALL"
            position={[
              building.x,
              building.height + 0.72,
              building.z + building.depth / 2 + 0.18
            ]}
            scale={[8.5, 1.8, 1]}
            bg="rgba(14, 116, 144, 0.82)"
            fontSize={86}
          />
          <mesh
            position={[building.x, building.height + 0.16, building.z]}
            material={mats.metal}
          >
            <boxGeometry args={[7.2, 0.12, 7.2]} />
          </mesh>
          <mesh
            position={[
              HELIPAD_POSITION.x,
              building.height + 0.24,
              HELIPAD_POSITION.z
            ]}
            rotation-x={-Math.PI / 2}
          >
            <ringGeometry args={[1.7, 2.35, 32]} />
            <meshBasicMaterial color="#f8fafc" transparent opacity={0.82} />
          </mesh>
        </>
      )}
    </group>
  );
}

function RooftopStair({
  stair,
  mats
}: {
  stair: StairSpec;
  mats: PbrMaterialSet;
}) {
  const stepCount = 8;
  return (
    <group>
      {Array.from({ length: stepCount }, (_, i) => {
        const t = (i + 0.5) / stepCount;
        return (
          <mesh
            key={`${stair.id}-${i}`}
            position={[
              stair.x,
              0.12 + t * stair.height * 0.5,
              stair.z - stair.depth / 2 + t * stair.depth
            ]}
            material={mats.concrete}
            castShadow
            receiveShadow
          >
            <boxGeometry
              args={[
                stair.width,
                0.24 + t * stair.height,
                stair.depth / stepCount
              ]}
            />
          </mesh>
        );
      })}
      <mesh
        position={[stair.x, stair.height + 0.05, stair.z + stair.depth / 2]}
        material={mats.metal}
        receiveShadow
      >
        <boxGeometry args={[stair.width * 1.15, 0.1, 1.2]} />
      </mesh>
    </group>
  );
}

function TonPlaygramMallInterior({ mats }: { mats: PbrMaterialSet }) {
  return (
    <group position={[0, 0.06, -70]}>
      <mesh position={[0, 0.03, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[13.8, 17.5]} />
        <meshStandardMaterial
          color="#d8c8a4"
          roughness={0.58}
          metalness={0.08}
        />
      </mesh>
      {mallGameSections.map((name, index) => {
        const side = index % 2 === 0 ? -1 : 1;
        const row = Math.floor(index / 2);
        const z = -7 + row * 2.55;
        return (
          <group
            key={name}
            position={[side * 4.7, 0, z]}
            rotation={[0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}
          >
            <mesh position={[0, 1.55, 0]} material={mats.metal} castShadow>
              <boxGeometry args={[2.7, 1.7, 0.16]} />
            </mesh>
            <mesh position={[0, 1.57, -0.09]}>
              <planeGeometry args={[2.35, 1.26]} />
              <meshBasicMaterial
                color={
                  index % 3 === 0
                    ? '#2563eb'
                    : index % 3 === 1
                      ? '#7c3aed'
                      : '#059669'
                }
              />
            </mesh>
            <LabelSprite
              text={name}
              position={[0, 1.58, -0.16]}
              scale={[1.95, 0.48, 1]}
              bg="rgba(2, 6, 23, 0.72)"
              fontSize={70}
            />
            <mesh
              position={[-0.55, 0.48, -0.42]}
              material={mats.concrete}
              castShadow
            >
              <capsuleGeometry args={[0.16, 0.55, 5, 8]} />
            </mesh>
            <mesh
              position={[0.55, 0.48, -0.42]}
              material={mats.brick}
              castShadow
            >
              <capsuleGeometry args={[0.16, 0.55, 5, 8]} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[1.2, 1.45, 0.16, 32]} />
        <meshStandardMaterial
          color="#6ee7b7"
          roughness={0.36}
          metalness={0.12}
        />
      </mesh>
      <pointLight
        position={[0, 4.8, 0]}
        intensity={1.7}
        distance={18}
        color="#bde7ff"
      />
    </group>
  );
}

function ParkAndCourts() {
  return (
    <group>
      <mesh
        position={[-14.5, 0.035, -96]}
        rotation-x={-Math.PI / 2}
        receiveShadow
      >
        <planeGeometry args={[8.2, 15]} />
        <meshStandardMaterial color="#237a3f" roughness={0.9} />
      </mesh>
      <mesh
        position={[14.5, 0.04, -96]}
        rotation-x={-Math.PI / 2}
        receiveShadow
      >
        <planeGeometry args={[8.2, 15]} />
        <meshStandardMaterial color="#3454d1" roughness={0.76} />
      </mesh>
      <mesh position={[14.5, 0.052, -96]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[3.2, 3.26, 4]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
      </mesh>
      {[-17, -14.5, -12].map((x, i) => (
        <group key={`park-tree-${i}`} position={[x, 0, -91 - i * 3.8]}>
          <mesh position={[0, 0.72, 0]} castShadow>
            <cylinderGeometry args={[0.11, 0.16, 1.4, 8]} />
            <meshStandardMaterial color="#6b3f23" roughness={0.86} />
          </mesh>
          <mesh position={[0, 1.66, 0]} castShadow>
            <sphereGeometry args={[0.72, 14, 10]} />
            <meshStandardMaterial color="#1f7a3f" roughness={0.9} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.08, -118]} receiveShadow>
        <cylinderGeometry args={[2.5, 2.8, 0.16, 36]} />
        <meshStandardMaterial
          color="#9bd4ff"
          roughness={0.22}
          metalness={0.02}
        />
      </mesh>
      <pointLight
        position={[0, 2.4, -118]}
        intensity={0.65}
        distance={10}
        color="#9bd4ff"
      />
      <mesh position={[0, 0.06, -145]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[17, 10]} />
        <meshStandardMaterial color="#1e7a42" roughness={0.84} />
      </mesh>
      <LabelSprite
        text="TONPLAYGRAM STADIUM"
        position={[0, 1.4, -145]}
        scale={[8.8, 1.6, 1]}
        bg="rgba(22, 101, 52, 0.78)"
        fontSize={82}
      />
    </group>
  );
}

function CityTraffic() {
  const vehicles = useMemo(
    () => [
      {
        id: 'police',
        color: '#1d4ed8',
        z: -18,
        lane: -1.8,
        speed: 7.5,
        light: '#ef4444'
      },
      {
        id: 'ambulance',
        color: '#f8fafc',
        z: -54,
        lane: 1.8,
        speed: 6.5,
        light: '#60a5fa'
      },
      {
        id: 'fire',
        color: '#dc2626',
        z: -94,
        lane: -1.8,
        speed: 5.4,
        light: '#f97316'
      },
      {
        id: 'taxi',
        color: '#facc15',
        z: -130,
        lane: 1.8,
        speed: 6.8,
        light: '#fde68a'
      }
    ],
    []
  );
  const refs = useRef<Array<THREE.Group | null>>([]);

  useFrame((_, dt) => {
    refs.current.forEach((ref, index) => {
      if (!ref) return;
      const config = vehicles[index];
      ref.position.z -= config.speed * dt;
      if (ref.position.z < CITY_BOUNDS.minZ + 5)
        ref.position.z = CITY_BOUNDS.maxZ - 4;
    });
  });

  return (
    <group>
      {vehicles.map((vehicle, index) => (
        <group
          key={vehicle.id}
          ref={(ref) => {
            refs.current[index] = ref;
          }}
          position={[vehicle.lane, 0.38, vehicle.z]}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry
              args={[1.35, 0.55, vehicle.id === 'fire' ? 2.4 : 1.9]}
            />
            <meshStandardMaterial
              color={vehicle.color}
              roughness={0.48}
              metalness={0.18}
            />
          </mesh>
          <mesh position={[0, 0.42, -0.18]}>
            <boxGeometry args={[0.82, 0.12, 0.24]} />
            <meshBasicMaterial color={vehicle.light} />
          </mesh>
          <pointLight
            position={[0, 0.75, -0.3]}
            intensity={0.45}
            distance={4}
            color={vehicle.light}
          />
        </group>
      ))}
    </group>
  );
}

function FarCitySkyline() {
  const skyline = useMemo(
    () =>
      Array.from({ length: 34 }, (_, index) => ({
        x: -48 + index * 3,
        h: 8 + ((index * 7) % 19),
        z: -188 - (index % 5) * 3,
        w: 1.6 + (index % 4) * 0.6
      })),
    []
  );
  return (
    <group>
      {skyline.map((tower, index) => (
        <mesh
          key={`skyline-${index}`}
          position={[tower.x, tower.h / 2 - 1, tower.z]}
        >
          <boxGeometry args={[tower.w, tower.h, 2.2]} />
          <meshBasicMaterial color="#172033" transparent opacity={0.56} />
        </mesh>
      ))}
    </group>
  );
}

function ParkedHelicopter({ active }: { active: boolean }) {
  const rotor = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (rotor.current) rotor.current.rotation.y += dt * (active ? 28 : 3.2);
  });
  return (
    <group
      position={[
        HELIPAD_POSITION.x,
        HELIPAD_POSITION.y + 0.65,
        HELIPAD_POSITION.z
      ]}
      scale={2.15}
    >
      <mesh castShadow>
        <capsuleGeometry args={[0.32, 1.45, 8, 16]} />
        <meshStandardMaterial
          color="#52616b"
          roughness={0.58}
          metalness={0.35}
        />
      </mesh>
      <mesh position={[0, 0.13, -0.9]} castShadow>
        <boxGeometry args={[0.14, 0.12, 1.5]} />
        <meshStandardMaterial
          color="#2d3742"
          roughness={0.62}
          metalness={0.35}
        />
      </mesh>
      <mesh ref={rotor} position={[0, 0.55, 0]}>
        <boxGeometry args={[2.5, 0.025, 0.11]} />
        <meshStandardMaterial color="#111827" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0.36, 0.08, 0.34]}>
        <sphereGeometry args={[0.22, 14, 10]} />
        <meshStandardMaterial
          color="#9bd4ff"
          roughness={0.18}
          transparent
          opacity={0.62}
        />
      </mesh>
    </group>
  );
}

function UrbanArena() {
  const mats = PbrMaterials();
  const vehicleMode = useMobileFpsStore((state) => state.vehicleMode);
  const markings = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#f8fafc',
        transparent: true,
        opacity: 0.76
      }),
    []
  );
  return (
    <group>
      <color attach="background" args={['#8fc8ff']} />
      <fog attach="fog" args={['#b7d9f4', 76, 225]} />
      <hemisphereLight args={['#f7fbff', '#70906f', 1.9]} />
      <directionalLight
        position={[-20, 35, 18]}
        intensity={3.1}
        color="#fff1cf"
        castShadow
        shadow-mapSize-width={1536}
        shadow-mapSize-height={1536}
      />
      <mesh position={[0, -0.08, -78]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[190, 230]} />
        <meshStandardMaterial
          color="#1d6fa3"
          roughness={0.32}
          metalness={0.02}
          transparent
          opacity={0.88}
        />
      </mesh>
      <mesh position={[0, 0, -78]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[50, 176]} />
        <meshStandardMaterial
          color="#64735e"
          roughness={0.88}
          metalness={0.02}
        />
      </mesh>
      <mesh
        position={[0, 0.02, -78]}
        rotation-x={-Math.PI / 2}
        material={mats.road}
        receiveShadow
      >
        <planeGeometry args={[8.6, 168]} />
      </mesh>
      <mesh
        position={[-6.8, 0.032, -78]}
        rotation-x={-Math.PI / 2}
        material={mats.concrete}
        receiveShadow
      >
        <planeGeometry args={[3.2, 168]} />
      </mesh>
      <mesh
        position={[6.8, 0.032, -78]}
        rotation-x={-Math.PI / 2}
        material={mats.concrete}
        receiveShadow
      >
        <planeGeometry args={[3.2, 168]} />
      </mesh>
      <RoadMarkings material={markings} />
      {crossStreets.map((z) => (
        <mesh
          key={`avenue-${z}`}
          position={[0, 0.038, z]}
          rotation-x={-Math.PI / 2}
          material={mats.road}
          receiveShadow
        >
          <planeGeometry args={[47, 4.2]} />
        </mesh>
      ))}
      {cityBuildings.map((building) => (
        <BuildingBlock key={building.id} building={building} mats={mats} />
      ))}
      {roofStairs.map((stair) => (
        <RooftopStair key={stair.id} stair={stair} mats={mats} />
      ))}
      <TonPlaygramMallInterior mats={mats} />
      <ParkAndCourts />
      <CityTraffic />
      <ParkedHelicopter active={vehicleMode === 'helicopter'} />
      {[-5.2, 5.2, -20, 20].map((x) =>
        Array.from({ length: 18 }, (_, i) => -4 - i * 9).map((z) => (
          <StreetLight key={`${x}-${z}`} x={x} z={z} mats={mats} />
        ))
      )}
      {crossStreets.flatMap((z) => [
        <TrafficSignal key={`tl-${z}-l`} x={-4.9} z={z + 1.9} mats={mats} />,
        <TrafficSignal key={`tl-${z}-r`} x={4.9} z={z - 1.9} mats={mats} />
      ])}
      <BusStop x={-7.9} z={-30} mats={mats} />
      <BusStop x={7.9} z={-104} mats={mats} />
      <FarCitySkyline />
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
      donorScene: THREE.Object3D | null,
      slot: THREE.Group,
      fallbackRoot?: THREE.Object3D
    ) {
      if (disposed) return;

      try {
        const { gltf } = await loadModelByUrls(entry.name, entry.urls, 7000);
        if (disposed) return;
        const model = gltf.scene;
        configureModel(model, gl, { mobileMaxAnisotropy: 2 });
        normalizeObject(model, targetDisplayLength(entry) * 0.72);
        model.rotation.x =
          entry.rotateX ?? (entry.kind === 'weapon' ? -0.06 : 0);
        model.rotation.y =
          (entry.rotateY ?? 0) + (entry.kind === 'weapon' ? Math.PI : 0);
        attachHandsToWeapon(entry, model, donorScene, gl);
        if (fallbackRoot) {
          slot.remove(fallbackRoot);
          disposeObject(fallbackRoot);
          runtimes.current = runtimes.current.filter(
            (runtime) => runtime.root !== fallbackRoot
          );
        }
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
          'Urban FPS asset kept procedural stand-in after remote load failed:',
          entry.name,
          error
        );
      }
    }

    async function loadAll() {
      const visibleItems = DISPLAY_ITEMS.slice(0, ARMORY_VISIBLE_ITEM_LIMIT);
      visibleItems.forEach((entry, index) => {
        const fallbackSlot = new THREE.Group();
        fallbackSlot.position.copy(assetSlotPosition(index));
        fallbackSlot.rotation.y = Math.PI;
        const fallback = createProceduralMachine(entry);
        normalizeObject(fallback, targetDisplayLength(entry) * 0.72);
        fallbackSlot.add(fallback);
        liveGroup.add(fallbackSlot);
        loadedRoots.push(fallbackSlot);
        runtimes.current.push({
          entry,
          root: fallback,
          basePosition: fallback.position.clone(),
          baseRotation: fallback.rotation.clone(),
          index
        });
      });

      await new Promise((resolve) =>
        window.setTimeout(resolve, ARMORY_REMOTE_LOAD_DELAY_MS)
      );
      const donorScene = await loadDonor();
      for (const [index, entry] of visibleItems
        .slice(0, ARMORY_REMOTE_LOAD_LIMIT)
        .entries()) {
        if (disposed) return;
        const slot = loadedRoots[index] as THREE.Group | undefined;
        const fallbackRoot = runtimes.current.find(
          (runtime) => runtime.index === index
        )?.root;
        if (slot) await loadEntry(entry, index, donorScene, slot, fallbackRoot);
      }
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
    applyFirstPersonRecoil(groupRef.current, recoil);
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
  const vehicleMode = useMobileFpsStore((state) => state.vehicleMode);
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
  if (vehicleMode === 'helicopter') return null;
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

function HelicopterCockpit() {
  const vehicleMode = useMobileFpsStore((state) => state.vehicleMode);
  const rotor = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (rotor.current) rotor.current.rotation.y += dt * 34;
  });
  if (vehicleMode !== 'helicopter') return null;
  return (
    <group position={[0, -0.52, -1.35]} rotation={[0.02, 0, 0]}>
      <mesh position={[0, 0.08, -0.18]}>
        <boxGeometry args={[1.35, 0.42, 0.68]} />
        <meshStandardMaterial
          color="#1f2937"
          roughness={0.52}
          metalness={0.35}
        />
      </mesh>
      <mesh position={[0, 0.44, -0.58]}>
        <boxGeometry args={[1.55, 0.42, 0.05]} />
        <meshPhysicalMaterial
          color="#8bd3ff"
          transparent
          opacity={0.28}
          roughness={0.06}
        />
      </mesh>
      <mesh ref={rotor} position={[0, 1.18, -0.42]}>
        <boxGeometry args={[3.2, 0.025, 0.1]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.6} />
      </mesh>
      <pointLight
        position={[0, 0.4, -0.9]}
        intensity={0.75}
        distance={3.5}
        color="#8bd3ff"
      />
    </group>
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
    state.recoverRecoil(rifleStats.recoilRecovery * dt);
    if (state.phase !== 'playing') return;

    const lookSensitivity = state.vehicleMode === 'helicopter' ? 3.2 : 4.35;
    yaw.current -= state.input.lookX * lookSensitivity * dt;
    pitch.current = THREE.MathUtils.clamp(
      pitch.current - state.input.lookY * lookSensitivity * dt,
      -1.28,
      1.18
    );
    state.setInput({ lookX: 0, lookY: 0 });

    fixedAccumulator.current += Math.min(dt, 0.05);
    while (fixedAccumulator.current >= stableStep) {
      const flying = state.vehicleMode === 'helicopter';
      if (flying) {
        stepHelicopterFlight({
          position: player.current,
          yaw: yaw.current,
          pitch: pitch.current,
          moveX: state.input.moveX,
          moveY: state.input.moveY,
          lift: state.input.lift,
          dt: stableStep,
          bounds: CITY_BOUNDS
        });
      } else {
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
        player.current.addScaledVector(move, 9.4 * stableStep);
        clampPlayer(player.current, false);
      }
      state.setCanBoardHelicopter(!flying && isNearHelipad(player.current));
      updateEnemies(enemies, player.current, stableStep);
      fixedAccumulator.current -= stableStep;
    }

    const alive = enemies.filter((enemy) => enemy.state !== 'dead').length;
    state.setEnemiesAlive(alive);
    camera.position.lerp(
      player.current,
      state.vehicleMode === 'helicopter'
        ? helicopterFlightConfig.cameraLerp
        : 0.8
    );
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
        <HelicopterCockpit />
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

function TouchHud({
  graphicsId,
  onGraphicsChange
}: {
  graphicsId: string;
  onGraphicsChange: (id: string) => void;
}) {
  const health = useMobileFpsStore((state) => state.health);
  const ammo = useMobileFpsStore((state) => state.ammo);
  const reserveAmmo = useMobileFpsStore((state) => state.reserveAmmo);
  const reloading = useMobileFpsStore((state) => state.reloading);
  const enemiesAlive = useMobileFpsStore((state) => state.enemiesAlive);
  const phase = useMobileFpsStore((state) => state.phase);
  const hitMarkerUntil = useMobileFpsStore((state) => state.hitMarkerUntil);
  const selectedWeaponId = useMobileFpsStore((state) => state.selectedWeaponId);
  const aimSensitivity = useMobileFpsStore((state) => state.aimSensitivity);
  const setAimSensitivity = useMobileFpsStore(
    (state) => state.setAimSensitivity
  );
  const vehicleMode = useMobileFpsStore((state) => state.vehicleMode);
  const canBoardHelicopter = useMobileFpsStore(
    (state) => state.canBoardHelicopter
  );
  const setVehicleMode = useMobileFpsStore((state) => state.setVehicleMode);
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
    const normalized = normalizeJoystickInput(dx, dy, maxRadius);
    setInput({ moveX: normalized.moveX, moveY: normalized.moveY });
    if (stick.current)
      stick.current.style.transform = `translate(${normalized.knobX}px, ${normalized.knobY}px)`;
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
          setInput(mapPortraitLookDelta(dx, dy, aimSensitivity));
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
      {(canBoardHelicopter || vehicleMode === 'helicopter') && (
        <button
          className="mobile-fps-button mobile-fps-heli"
          onPointerDown={() =>
            setVehicleMode(
              vehicleMode === 'helicopter' ? 'onFoot' : 'helicopter'
            )
          }
        >
          {vehicleMode === 'helicopter' ? 'EXIT HELI' : 'FLY HELI'}
        </button>
      )}
      {vehicleMode === 'helicopter' && (
        <div className="mobile-fps-heli-lift">
          <button
            type="button"
            onPointerDown={() => setInput({ lift: 1 })}
            onPointerUp={() => setInput({ lift: 0 })}
            onPointerCancel={() => setInput({ lift: 0 })}
          >
            UP
          </button>
          <button
            type="button"
            onPointerDown={() => setInput({ lift: -1 })}
            onPointerUp={() => setInput({ lift: 0 })}
            onPointerCancel={() => setInput({ lift: 0 })}
          >
            DOWN
          </button>
        </div>
      )}
      <label className="mobile-fps-sensitivity">
        <span>AIM {Math.round(aimSensitivity * 100)}%</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={aimSensitivity}
          onChange={(event) => setAimSensitivity(Number(event.target.value))}
        />
      </label>
      <div className="mobile-fps-graphics" aria-label="Graphics quality">
        {FPS_GRAPHICS_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={option.id === graphicsId ? 'active' : ''}
            onPointerDown={() => onGraphicsChange(option.id)}
          >
            {option.fps}
          </button>
        ))}
      </div>
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
        {vehicleMode === 'helicopter'
          ? 'Helicopter mode · joystick flies · right drag turns fast'
          : `Fast joystick · responsive aim · ${TOTAL_ITEMS} open-source GLB/GLTF slots`}
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
        Open-world GLB manifest: {openWorldAssetManifest.length} asset groups ·{' '}
        {openWorldMaterialSources.length} PBR material sources.
      </div>
    </div>
  );
}

export default function MobileUrbanFps() {
  const [graphicsId, setGraphicsId] = useState(readInitialGraphicsId);
  const graphicsProfile =
    FPS_GRAPHICS_OPTIONS.find((option) => option.id === graphicsId) ??
    FPS_GRAPHICS_OPTIONS[0];

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    window.localStorage?.setItem(FPS_GRAPHICS_STORAGE_KEY, graphicsProfile.id);
  }, [graphicsProfile.id]);

  return (
    <main
      className="mobile-fps-shell"
      aria-label="Mobile portrait FPS preview frame"
      data-graphics={graphicsProfile.id}
    >
      <section className="mobile-fps-frame">
        <MobileFpsErrorBoundary key={graphicsProfile.id}>
          <Canvas
            className="mobile-fps-canvas"
            shadows={graphicsProfile.shadows}
            dpr={graphicsProfile.dpr}
            gl={{
              antialias: graphicsProfile.antialias,
              powerPreference: 'high-performance',
              alpha: false,
              depth: true,
              stencil: false
            }}
            camera={{
              fov: 70,
              near: 0.08,
              far: 260,
              position: [0, 1.55, -1.2]
            }}
            onCreated={({ gl }) => {
              gl.setClearColor('#8fc8ff', 1);
            }}
          >
            <Scene />
          </Canvas>
        </MobileFpsErrorBoundary>
        <TouchHud
          graphicsId={graphicsProfile.id}
          onGraphicsChange={setGraphicsId}
        />
      </section>
      <div className="sr-only">
        {assetSourceNotes.join(' ')} {graphicsProfile.note}
      </div>
    </main>
  );
}
