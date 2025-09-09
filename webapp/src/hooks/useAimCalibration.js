import { useCallback, useEffect, useState } from 'react';

const KEY = 'snooker-aim-calibration';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function save(cfg) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg));
  } catch {}
}

export function useAimCalibration() {
  const [cfg, setCfg] = useState(() => ({
    invertX: false,
    invertY: false,
    swap: false,
    ...load()
  }));

  useEffect(() => {
    save(cfg);
  }, [cfg]);

  const mapDelta = useCallback(
    (dx, dy) => {
      let x = cfg.swap ? dy : dx;
      let y = cfg.swap ? dx : dy;
      if (cfg.invertX) x = -x;
      if (cfg.invertY) y = -y;
      return { dx: x, dy: y };
    },
    [cfg]
  );

  return { cfg, setCfg, mapDelta };
}
