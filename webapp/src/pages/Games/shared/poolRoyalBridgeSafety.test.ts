import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { resolveSafeBridgeAnchor } from './poolRoyalBridgeSafety.ts';

describe('resolveSafeBridgeAnchor', () => {
  const bounds = { halfWidth: 1, halfLength: 2 };

  it('keeps a clear preferred bridge position', () => {
    const preferred = new THREE.Vector3(0, 0.8, 0.5);
    const result = resolveSafeBridgeAnchor(preferred, new THREE.Vector3(0, 0, -1), [], bounds, 0.1);
    expect(result.style).toBe('open');
    expect(result.anchor.toArray()).toEqual(preferred.toArray());
  });

  it('moves the hand rather than overlapping another ball', () => {
    const preferred = new THREE.Vector3(0, 0.8, 0.5);
    const obstacle = { position: preferred.clone(), radius: 0.06 };
    const result = resolveSafeBridgeAnchor(preferred, new THREE.Vector3(0, 0, -1), [obstacle], bounds, 0.1);
    const planarDistance = Math.hypot(
      result.anchor.x - obstacle.position.x,
      result.anchor.z - obstacle.position.z
    );
    expect(planarDistance).toBeGreaterThanOrEqual(0.16);
    expect(result.style).toBe('compact');
  });

  it('allows cushion contact but clamps the hand footprint inside it', () => {
    const result = resolveSafeBridgeAnchor(
      new THREE.Vector3(2, 0.8, 3),
      new THREE.Vector3(0, 0, -1),
      [], bounds, 0.1
    );
    expect(result.anchor.x).toBeCloseTo(0.9);
    expect(result.anchor.z).toBeCloseTo(1.9);
  });
});
