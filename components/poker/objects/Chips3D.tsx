import { BRAND } from '../../../lib/config';

export default function Chips3D() {
  return (
    <group>
      {[0, 0.15, 0.3].map(y => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}> 
          <cylinderGeometry args={[0.5, 0.5, 0.1, 32]} />
          <meshStandardMaterial color={BRAND.gold} metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}
