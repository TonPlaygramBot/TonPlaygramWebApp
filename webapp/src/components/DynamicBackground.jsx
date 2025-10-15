import { useEffect, useMemo, useState } from 'react';
import { getWeather } from '../services/WeatherService.js';
import {
  isLocalStorageAvailable,
  safeGetItem,
  safeRemoveItem,
  safeSetItem
} from '../utils/storage.js';

export default function DynamicBackground() {
  const [info, setInfo] = useState({ condition: 'clear', isDay: true });
  const canPersistPreference = useMemo(() => isLocalStorageAvailable(), []);
  const [enabled, setEnabled] = useState(() => safeGetItem('weatherBgDisabled') !== '1');

  useEffect(() => {
    if (!enabled) return;
    let ignore = false;
    const update = async () => {
      const w = await getWeather();
      if (!ignore) setInfo({ condition: w.condition, isDay: w.isDay });
    };
    update();
    const id = setInterval(update, 15 * 60 * 1000);
    return () => {
      ignore = true;
      clearInterval(id);
    };
  }, [enabled]);

  const toggle = () => {
    const nv = !enabled;
    setEnabled(nv);
    if (!canPersistPreference) return;
    if (nv) safeRemoveItem('weatherBgDisabled');
    else safeSetItem('weatherBgDisabled', '1');
  };

  if (!enabled) {
    return (
      <button onClick={toggle} className="fixed bottom-2 right-2 z-50 text-xs bg-black/50 text-white px-2 py-1 rounded">
        Enable background
      </button>
    );
  }

  return (
    <>
      <div className={`weather-bg ${info.condition} ${info.isDay ? 'day' : 'night'} fixed inset-0 -z-10 pointer-events-none`} />
      <button onClick={toggle} className="fixed bottom-2 right-2 z-50 text-xs bg-black/50 text-white px-2 py-1 rounded">
        Disable background
      </button>
    </>
  );
}
