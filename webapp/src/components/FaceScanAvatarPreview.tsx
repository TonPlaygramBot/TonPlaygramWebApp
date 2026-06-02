import { Canvas, useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';

type FaceScanAvatarPreviewProps = {
  bodyLabel?: string;
  bodyAccent?: string;
  scanProgress?: number;
  headTextureUrl?: string;
  captureCount?: number;
};

type AvatarRigProps = Required<Pick<FaceScanAvatarPreviewProps, 'bodyLabel' | 'bodyAccent' | 'scanProgress' | 'captureCount'>> & {
  headTextureUrl?: string;
};

function AvatarRig({
  bodyLabel,
  bodyAccent,
  scanProgress,
  headTextureUrl,
  captureCount
}: AvatarRigProps) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const headTexture = useMemo(() => {
    if (!headTextureUrl) return null;
    const texture = new THREE.TextureLoader().load(headTextureUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    return texture;
  }, [headTextureUrl]);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(elapsed * 0.55) * 0.22;
      groupRef.current.position.y = Math.sin(elapsed * 0.9) * 0.035;
    }
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(elapsed * 1.2) * 0.1;
    }
  });

  const accentColor = new THREE.Color(bodyAccent);
  const scanHeight = THREE.MathUtils.clamp(scanProgress / 100, 0.1, 1.05) * 2.75;

  return (
    <group ref={groupRef} position={[0, -1.15, 0]}>
      <mesh position={[0, 1.55, 0]} castShadow>
        <capsuleGeometry args={[0.42, 0.64, 12, 24]} />
        <meshStandardMaterial
          color="#f1c7a5"
          roughness={0.56}
          metalness={0.04}
          map={headTexture ?? undefined}
        />
      </mesh>
      <mesh ref={headRef} position={[0, 1.58, 0.04]} castShadow>
        <sphereGeometry args={[0.48, 48, 48]} />
        <meshStandardMaterial
          color={headTexture ? '#ffffff' : '#f0b891'}
          roughness={0.5}
          metalness={0.02}
          map={headTexture ?? undefined}
        />
      </mesh>
      <mesh position={[-0.17, 1.65, 0.47]}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh position={[0.17, 1.65, 0.47]}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh position={[0, 1.5, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.12, 0.012, 10, 32, Math.PI]} />
        <meshStandardMaterial color="#7c2d12" roughness={0.72} />
      </mesh>

      <mesh position={[0, 0.72, 0]} castShadow>
        <capsuleGeometry args={[0.58, 1.05, 12, 24]} />
        <meshStandardMaterial color={accentColor} roughness={0.42} metalness={0.08} />
      </mesh>
      <mesh position={[0, 1.05, 0.01]} scale={[0.92, 0.62, 0.86]}>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshStandardMaterial color="#111827" roughness={0.35} metalness={0.18} />
      </mesh>
      <mesh position={[-0.62, 0.72, 0]} rotation={[0, 0, -0.28]} castShadow>
        <capsuleGeometry args={[0.16, 0.72, 8, 16]} />
        <meshStandardMaterial color={accentColor.clone().offsetHSL(0, 0, 0.1)} roughness={0.5} />
      </mesh>
      <mesh position={[0.62, 0.72, 0]} rotation={[0, 0, 0.28]} castShadow>
        <capsuleGeometry args={[0.16, 0.72, 8, 16]} />
        <meshStandardMaterial color={accentColor.clone().offsetHSL(0, 0, 0.1)} roughness={0.5} />
      </mesh>
      <mesh position={[-0.28, -0.38, 0]} rotation={[0, 0, 0.08]} castShadow>
        <capsuleGeometry args={[0.18, 0.95, 8, 16]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} />
      </mesh>
      <mesh position={[0.28, -0.38, 0]} rotation={[0, 0, -0.08]} castShadow>
        <capsuleGeometry args={[0.18, 0.95, 8, 16]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} />
      </mesh>

      <mesh position={[0, scanHeight - 0.96, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.82, 0.012, 8, 96]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.82} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 2.9, 48, 1, true]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
      {Array.from({ length: Math.max(1, captureCount) }).map((_, index) => {
        const angle = (index / Math.max(1, captureCount)) * Math.PI * 2;
        return (
          <mesh key={angle} position={[Math.sin(angle) * 1.08, 1.45, Math.cos(angle) * 1.08]}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshBasicMaterial color="#f0abfc" />
          </mesh>
        );
      })}
      <mesh position={[0, -0.98, 0]} receiveShadow>
        <cylinderGeometry args={[1.05, 1.18, 0.08, 56]} />
        <meshStandardMaterial color="#020617" roughness={0.6} metalness={0.25} />
      </mesh>
      <sprite position={[0, 2.38, 0]} scale={[1.7, 0.32, 1]}>
        <spriteMaterial color="#ffffff" transparent opacity={0.0} />
      </sprite>
    </group>
  );
}

export default function FaceScanAvatarPreview({
  bodyLabel = 'Human Body',
  bodyAccent = '#7c3aed',
  scanProgress = 0,
  headTextureUrl,
  captureCount = 0
}: FaceScanAvatarPreviewProps) {
  return (
    <div className="relative h-80 w-full overflow-hidden rounded-2xl border border-cyan-200/30 bg-slate-950">
      <Canvas camera={{ position: [0, 1.05, 5.2], fov: 38 }} shadows dpr={[1, 1.7]}>
        <color attach="background" args={["#020617"]} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[2.5, 4, 4]} intensity={2.2} castShadow />
        <pointLight position={[-2, 2, 2]} color="#a855f7" intensity={2.3} />
        <pointLight position={[2, 1, 1]} color="#22d3ee" intensity={1.7} />
        <AvatarRig
          bodyLabel={bodyLabel}
          bodyAccent={bodyAccent}
          scanProgress={scanProgress}
          headTextureUrl={headTextureUrl}
          captureCount={captureCount}
        />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[11px] font-semibold text-cyan-50 backdrop-blur">
        <span>{bodyLabel}</span>
        <span>{Math.round(scanProgress)}% scan</span>
      </div>
      <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-2xl border border-cyan-200/20 bg-cyan-400/10 px-3 py-2 text-[11px] text-cyan-50/85 backdrop-blur">
        User 3D face scan attached to selected human character body.
      </div>
    </div>
  );
}
