import { safeGetItem, safeSetItem } from '../utils/storage.js';

const CACHE_KEY = 'weather_cache_v1';
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

let memoryCache = null;

function mapCode(code) {
  // open-meteo weather codes -> condition
  if (code === 0) return 'clear';
  if ([1, 2, 3].includes(code)) return 'clouds';
  if ([45, 48].includes(code)) return 'mist';
  if ([51, 53, 55, 56, 57].includes(code)) return 'rain';
  if ([61, 63, 65, 80, 81, 82, 66, 67].includes(code)) return 'rain';
  if ([95, 96, 99].includes(code)) return 'thunderstorm';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  return 'clear';
}

async function fetchLocation() {
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (!res.ok) throw new Error('ipapi failed');
    const data = await res.json();
    return { lat: data.latitude, lon: data.longitude, city: data.city };
  } catch (e) {
    if (navigator.geolocation) {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
              city: '',
            }),
          reject,
        );
      });
    }
    throw e;
  }
}

async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=sunrise,sunset&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('weather failed');
  const data = await res.json();
  return {
    code: data.current_weather.weathercode,
    isDay: Boolean(data.current_weather.is_day),
    sunrise: data.daily.sunrise[0],
    sunset: data.daily.sunset[0],
  };
}

export async function getWeather() {
  const cachedRaw = safeGetItem(CACHE_KEY);
  if (cachedRaw) {
    try {
      const cached = JSON.parse(cachedRaw);
      if (Date.now() - cached.timestamp < CACHE_DURATION) {
        memoryCache = cached;
        return cached;
      }
    } catch {}
  } else if (memoryCache && Date.now() - memoryCache.timestamp < CACHE_DURATION) {
    return memoryCache;
  }
  try {
    const loc = await fetchLocation();
    const weather = await fetchWeather(loc.lat, loc.lon);
    const condition = mapCode(weather.code);
    const result = {
      ...loc,
      ...weather,
      condition,
      timestamp: Date.now(),
    };
    memoryCache = result;
    safeSetItem(CACHE_KEY, JSON.stringify(result));
    return result;
  } catch {
    if (memoryCache) {
      return memoryCache;
    }
    return { condition: 'clear', isDay: true };
  }
}
