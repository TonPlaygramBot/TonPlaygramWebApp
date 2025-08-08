import { useMemo } from 'react';
import { MeshProps } from '@react-three/fiber';
import { BRAND } from '../../../lib/config';
import { PrismMaterial } from '../../../lib/prismMaterial';

export default function Table3D(props: MeshProps) {
  const radiusTop = 5;
  const height = 0.3;
  const segments = 32;
  const rim = useMemo(() => (
    <torus args={[radiusTop + 0.4, 0.2, 16, 64]} rotation={[Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color={BRAND.gold} metalness={0.8} roughness={0.3} />
    </torus>
  ), []);

  return (
    <group {...props}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radiusTop, radiusTop, height, segments]} />
        <PrismMaterial />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <cylinderGeometry args={[radiusTop - 0.2, radiusTop - 0.2, height / 2, segments]} />
        <meshStandardMaterial color={BRAND.bg} metalness={0.2} roughness={0.9} />
      </mesh>
      {rim}
    </group>
  );
}
