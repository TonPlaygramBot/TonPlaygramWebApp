import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bridgeIsClear, bridgeRequiredLift, findBridgeRetraction } from './poolRoyalBridgeSafety.ts';

const part = new THREE.Box3(new THREE.Vector3(-0.1, 0.8, 0.4), new THREE.Vector3(0.1, 0.9, 0.7));
const bounds = { halfWidth: 1, halfLength: 2, cushionTopY: 1 };

describe('posed bridge volume safety', () => {
  it('checks finger tips beyond the palm and retains a visible gap from balls', () => {
    const environment = { bounds, obstacles: [{ position: new THREE.Vector3(0.12, 0.85, 0.65), radius: 0.06 }] };
    expect(bridgeIsClear([part], environment, 0.01)).toBe(false);
    const forward = new THREE.Vector3(0, 0, -1);
    const offset = findBridgeRetraction([part], forward, environment, 0.01, 0.5)!;
    expect(offset.dot(forward)).toBeLessThan(0);
    expect(Math.abs(offset.x)).toBe(0);
    expect(bridgeIsClear([part], environment, 0.01, offset)).toBe(true);
  });

  it('reports a blocked search and computes enough lift to clear the actual sphere', () => {
    const environment = { bounds, obstacles: [{ position: new THREE.Vector3(0, 0.85, 0.5), radius: 0.4 }] };
    expect(findBridgeRetraction([part], new THREE.Vector3(0, 0, -1), environment, 0.01, 0.1)).toBeNull();
    const lift = bridgeRequiredLift([part], environment, 0.01);
    expect(lift).toBeGreaterThan(0.4);
    expect(bridgeIsClear([part], environment, 0.01, new THREE.Vector3(0, lift + 1e-8, 0))).toBe(true);
  });

  it('raises a corner bridge above both cushion faces without clamping it across the ball', () => {
    const corner = part.clone().translate(new THREE.Vector3(1, 0, 1.5));
    const environment = { bounds, obstacles: [] };
    expect(bridgeIsClear([corner], environment, 0.01)).toBe(false);
    const lift = bridgeRequiredLift([corner], environment, 0.01);
    expect(bridgeIsClear([corner], environment, 0.01, new THREE.Vector3(0, lift + 1e-8, 0))).toBe(true);
  });
});
