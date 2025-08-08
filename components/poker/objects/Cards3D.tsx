import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { TableState } from '../../../shared/pokerTypes';

interface Props {
  table?: TableState;
  cardsRef?: React.MutableRefObject<THREE.Mesh[]>;
}

export default function Cards3D({ table, cardsRef }: Props) {
  const internal = useRef<THREE.Mesh[]>([]);
  const cards = cardsRef ?? internal;
  const rotations = useRef<number[]>(Array(5).fill(Math.PI));

  useEffect(() => {
    const n = table?.board.length ?? 0;
    rotations.current = rotations.current.map((rot, i) => (i < n ? rot : Math.PI));
  }, [table?.board]);

  useFrame(() => {
    const n = table?.board.length ?? 0;
    cards.current.forEach((m, i) => {
      if (!m) return;
      const target = i < n ? 0 : Math.PI;
      const current = rotations.current[i];
      const next = current + (target - current) * 0.15;
      rotations.current[i] = next;
      m.rotation.y = next;
      m.visible = i < n;
    });
  });

  return (
    <group position={[0, 0.05, 0]}>
      {[0,1,2,3,4].map(i => (
        <mesh
          key={i}
          ref={el => (cards.current[i] = el!)}
          position={[i * 1.2 - 2.4, 0, 0]}
          rotation={[0, Math.PI, 0]}
        >
          <boxGeometry args={[1, 0.02, 1.5]} />
          <meshStandardMaterial color="white" />
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(1,0.02,1.5)]} />
            <lineBasicMaterial color="#777" />
          </lineSegments>
        </mesh>
      ))}
    </group>
  );
}
