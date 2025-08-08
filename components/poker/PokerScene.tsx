'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { MutableRefObject } from 'react';
import Table3D from './objects/Table3D';
import Chips3D from './objects/Chips3D';
import Cards3D from './objects/Cards3D';
import type { TableState } from '../../shared/pokerTypes';

interface Props {
  table?: TableState;
  cardsRef?: MutableRefObject<THREE.Mesh[]>;
}

export default function PokerScene({ table, cardsRef }: Props) {
  return (
    <Canvas dpr={[1, 2]} camera={{ fov: 55, position: [0, 6.5, 10] }}>
      <ambientLight intensity={0.5} />
      <spotLight position={[0, 8, 5]} angle={0.3} penumbra={1} />
      <Environment preset="city" />
      <Table3D />
      <Chips3D />
      <Cards3D table={table} cardsRef={cardsRef} />
      <OrbitControls enableZoom={false} maxPolarAngle={Math.PI / 2.2} />
    </Canvas>
  );
}
