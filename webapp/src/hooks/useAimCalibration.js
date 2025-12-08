import { useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';

const PREFIX = 'billiards.calib.';

function loadFlag(key, def) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v === null ? def : JSON.parse(v);
  } catch {
    return def;
  }
}

function saveFlag(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {}
}

export function useAimCalibration() {
  const [cfg, setCfg] = useState(() => ({
    invertX: loadFlag('invertX', false),
    invertY: loadFlag('invertY', false),
    swap: loadFlag('swap', false),
    sens: loadFlag('sens', 1)
  }));

  useEffect(() => {
    const auto = () => {
      const portrait = window.innerHeight > window.innerWidth;
      setCfg((c) => ({ ...c, swap: portrait, invertX: false, invertY: false }));
    };
    auto();
    window.addEventListener('resize', auto);
    return () => window.removeEventListener('resize', auto);
  }, []);

  useEffect(() => {
    saveFlag('invertX', cfg.invertX);
    saveFlag('invertY', cfg.invertY);
    saveFlag('swap', cfg.swap);
    saveFlag('sens', cfg.sens);
  }, [cfg]);

  const mapDelta = useCallback(
    (dx, dy, camera) => {
      let x = cfg.swap ? dy : dx;
      let y = cfg.swap ? dx : dy;
      if (cfg.invertX) x = -x;
      if (cfg.invertY) y = -y;
      x *= cfg.sens;
      y *= cfg.sens;
      if (!camera) return new THREE.Vector2(x, y);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      right.y = 0;
      forward.y = 0;
      if (right.lengthSq()) right.normalize();
      if (forward.lengthSq()) forward.normalize();
      const delta = right.multiplyScalar(x).add(forward.multiplyScalar(-y));
      return new THREE.Vector2(delta.x, delta.z);
    },
    [cfg]
  );

  return { cfg, setCfg, mapDelta };
}
