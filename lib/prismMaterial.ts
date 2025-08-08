import { JSX } from 'react';

export function PrismMaterial(props: JSX.IntrinsicElements['meshPhysicalMaterial']) {
  return (
    <meshPhysicalMaterial
      clearcoat={1}
      transmission={0.12}
      ior={1.4}
      metalness={0.85}
      roughness={0.2}
      color="#0f1224"
      {...props}
    />
  );
}
