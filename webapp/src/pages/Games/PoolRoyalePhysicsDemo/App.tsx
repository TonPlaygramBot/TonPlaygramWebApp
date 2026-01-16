import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  DEFAULT_PARAMS,
  PhysicsState,
  SpinOffset,
  createInitialState,
  resetState,
  stepPhysics,
  strikeCueBall
} from '../poolRoyalePhysicsEngine';

const TABLE_COLOR = '#1f5f3b';
const RAIL_COLOR = '#4b2e1f';
const TABLE_BOUNDS = {
  minX: -1.2,
  maxX: 1.2,
  minZ: -2.2,
  maxZ: 2.2
};

const usePhysicsState = () => {
  const stateRef = useRef<PhysicsState>(createInitialState(DEFAULT_PARAMS));
  const [revision, setRevision] = useState(0);

  const reset = () => {
    resetState(stateRef.current);
    setRevision((prev) => prev + 1);
  };

  return { stateRef, revision, reset };
};

const BallMeshes = ({ stateRef }: { stateRef: React.MutableRefObject<PhysicsState> }) => {
  const meshes = useRef<Record<string, THREE.Mesh>>({});

  useFrame((_, delta) => {
    stepPhysics(stateRef.current.balls, DEFAULT_PARAMS, Math.min(delta, 0.016), TABLE_BOUNDS);
    for (const ball of stateRef.current.balls) {
      const mesh = meshes.current[ball.id];
      if (!mesh) continue;
      mesh.position.set(ball.pos.x, ball.radius ?? DEFAULT_PARAMS.ballRadius, ball.pos.y);
      const axis = ball.omega?.clone() ?? new THREE.Vector3(0, 0, 0);
      const angle = axis.length() * delta;
      if (angle > 0.0001) {
        axis.normalize();
        mesh.rotateOnAxis(axis, angle);
      }
    }
  });

  return (
    <group>
      {stateRef.current.balls.map((ball) => (
        <mesh
          key={ball.id}
          ref={(node) => {
            if (node) meshes.current[ball.id] = node;
          }}
          position={[ball.pos.x, ball.radius ?? DEFAULT_PARAMS.ballRadius, ball.pos.y]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[ball.radius ?? DEFAULT_PARAMS.ballRadius, 32, 32]} />
          <meshStandardMaterial color={ball.color} />
        </mesh>
      ))}
    </group>
  );
};

const Table = () => {
  const width = TABLE_BOUNDS.maxX - TABLE_BOUNDS.minX;
  const depth = TABLE_BOUNDS.maxZ - TABLE_BOUNDS.minZ;
  const railHeight = 0.06;
  const railThickness = 0.08;

  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={TABLE_COLOR} />
      </mesh>
      <mesh
        position={[0, railHeight / 2, TABLE_BOUNDS.minZ - railThickness / 2]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[width + railThickness * 2, railHeight, railThickness]} />
        <meshStandardMaterial color={RAIL_COLOR} />
      </mesh>
      <mesh
        position={[0, railHeight / 2, TABLE_BOUNDS.maxZ + railThickness / 2]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[width + railThickness * 2, railHeight, railThickness]} />
        <meshStandardMaterial color={RAIL_COLOR} />
      </mesh>
      <mesh
        position={[TABLE_BOUNDS.minX - railThickness / 2, railHeight / 2, 0]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[railThickness, railHeight, depth]} />
        <meshStandardMaterial color={RAIL_COLOR} />
      </mesh>
      <mesh
        position={[TABLE_BOUNDS.maxX + railThickness / 2, railHeight / 2, 0]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[railThickness, railHeight, depth]} />
        <meshStandardMaterial color={RAIL_COLOR} />
      </mesh>
    </group>
  );
};

const ShotTests = [
  {
    label: 'Stun (stop cue ball)',
    spinOffset: { x: 0, y: 0 },
    power: 0.5,
    angle: -Math.PI / 2
  },
  {
    label: 'Draw (backspin)',
    spinOffset: { x: 0, y: -0.6 },
    power: 0.55,
    angle: -Math.PI / 2
  },
  {
    label: 'Follow (topspin)',
    spinOffset: { x: 0, y: 0.6 },
    power: 0.55,
    angle: -Math.PI / 2
  },
  {
    label: 'Rail english',
    spinOffset: { x: 0.7, y: 0.1 },
    power: 0.5,
    angle: -Math.PI / 3
  },
  {
    label: 'Cut throw',
    spinOffset: { x: -0.4, y: 0.1 },
    power: 0.45,
    angle: -Math.PI / 2.4
  },
  {
    label: 'Break stability',
    spinOffset: { x: 0, y: 0 },
    power: 1,
    angle: -Math.PI / 2
  }
];

const SpinController = ({
  spinOffset,
  onChange
}: {
  spinOffset: SpinOffset;
  onChange: (next: SpinOffset) => void;
}) => {
  const radius = 60;
  const maxOffset = DEFAULT_PARAMS.maxSpinOffset;

  const handlePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rawX = (event.clientX - centerX) / radius;
    const rawY = (centerY - event.clientY) / radius;
    const length = Math.hypot(rawX, rawY);
    const clamped = length > 1 ? 1 / length : 1;
    const nextX = rawX * clamped;
    const nextY = rawY * clamped;
    const limitedX = THREE.MathUtils.clamp(nextX, -maxOffset, maxOffset);
    const limitedY = THREE.MathUtils.clamp(nextY, -maxOffset, maxOffset);
    onChange({ x: limitedX, y: limitedY });
  };

  const dotStyle = {
    transform: `translate(${spinOffset.x * radius}px, ${-spinOffset.y * radius}px)`
  } as React.CSSProperties;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative h-32 w-32 rounded-full border border-white/50 bg-white/10"
        onPointerDown={handlePointer}
        onPointerMove={(event) => {
          if (event.buttons !== 1) return;
          handlePointer(event);
        }}
      >
        <div
          className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
          style={dotStyle}
        />
      </div>
      <div className="text-xs text-white/70">Spin offset: {spinOffset.x.toFixed(2)}, {spinOffset.y.toFixed(2)}</div>
    </div>
  );
};

const ShotPanel = ({
  spinOffset,
  setSpinOffset,
  power,
  setPower,
  angle,
  setAngle,
  onShoot,
  onReset
}: {
  spinOffset: SpinOffset;
  setSpinOffset: (next: SpinOffset) => void;
  power: number;
  setPower: (next: number) => void;
  angle: number;
  setAngle: (next: number) => void;
  onShoot: () => void;
  onReset: () => void;
}) => (
  <div className="flex w-full flex-col gap-4 rounded-2xl bg-slate-900/80 p-4 text-white shadow-xl">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold">Pool Royale Physics Demo</h2>
        <p className="text-xs text-white/70">Spin controller + realistic slip-to-roll response.</p>
      </div>
      <button
        className="rounded-full border border-white/20 px-3 py-1 text-xs hover:bg-white/10"
        onClick={onReset}
        type="button"
      >
        Reset rack
      </button>
    </div>

    <SpinController spinOffset={spinOffset} onChange={setSpinOffset} />

    <label className="flex flex-col gap-2 text-sm">
      <span>Power: {power.toFixed(2)}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={power}
        onChange={(event) => setPower(Number(event.target.value))}
      />
    </label>

    <label className="flex flex-col gap-2 text-sm">
      <span>Aim angle: {(THREE.MathUtils.radToDeg(angle) + 90).toFixed(0)}°</span>
      <input
        type="range"
        min={-Math.PI}
        max={0}
        step={0.01}
        value={angle}
        onChange={(event) => setAngle(Number(event.target.value))}
      />
    </label>

    <button
      className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900"
      onClick={onShoot}
      type="button"
    >
      Shoot
    </button>

    <div className="space-y-2 text-xs text-white/70">
      <div className="font-semibold text-white">Shot tests</div>
      <div className="grid gap-2">
        {ShotTests.map((shot) => (
          <button
            key={shot.label}
            className="rounded-lg border border-white/10 px-2 py-1 text-left hover:bg-white/10"
            onClick={() => {
              setSpinOffset(shot.spinOffset);
              setPower(shot.power);
              setAngle(shot.angle);
              onShoot();
            }}
            type="button"
          >
            {shot.label}
          </button>
        ))}
      </div>
    </div>
  </div>
);

const CameraRig = () => {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  useFrame(() => {
    if (!cameraRef.current) return;
    cameraRef.current.lookAt(0, 0, 0);
  });
  return (
    <perspectiveCamera
      ref={cameraRef}
      position={[0, 2.6, 3.6]}
      fov={45}
      near={0.1}
      far={50}
    />
  );
};

export default function App() {
  const { stateRef, reset } = usePhysicsState();
  const [spinOffset, setSpinOffset] = useState<SpinOffset>({ x: 0, y: 0 });
  const [power, setPower] = useState(0.55);
  const [angle, setAngle] = useState(-Math.PI / 2);

  const direction = useMemo(() => {
    const dir = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
    return dir;
  }, [angle]);

  const shoot = () => {
    const cueBall = stateRef.current.balls.find((ball) => ball.id === 'cue');
    if (!cueBall) return;
    cueBall.vel.set(0, 0);
    cueBall.omega?.set(0, 0, 0);
    strikeCueBall(cueBall, direction, power, spinOffset, DEFAULT_PARAMS);
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-white">
      <div className="absolute inset-0">
        <Canvas shadows camera={{ position: [0, 2.6, 3.6], fov: 45 }}>
          <CameraRig />
          <ambientLight intensity={0.7} />
          <directionalLight position={[2, 4, 3]} intensity={1.2} castShadow />
          <Table />
          <BallMeshes stateRef={stateRef} />
        </Canvas>
      </div>
      <div className="relative z-10 flex min-h-screen flex-col justify-end p-4">
        <ShotPanel
          spinOffset={spinOffset}
          setSpinOffset={setSpinOffset}
          power={power}
          setPower={setPower}
          angle={angle}
          setAngle={setAngle}
          onShoot={shoot}
          onReset={reset}
        />
      </div>
    </div>
  );
}
