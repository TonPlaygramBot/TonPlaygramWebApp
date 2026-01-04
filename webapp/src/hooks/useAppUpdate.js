import { useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { APP_BUILD } from '../config/buildInfo.js';
import { API_BASE_URL } from '../utils/api.js';

const VERSION_PATHS = ['/api/version', '/version.json'];
const STORAGE_KEY = 'tonplaygram-app-build';
const DEFAULT_BUILD = APP_BUILD || 'dev';
const POLL_INTERVAL_MS = 5 * 60 * 1000;

function normalizeBuild(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.build === 'string' && payload.build.trim()) return payload.build.trim();
  if (typeof payload.version === 'string' && payload.version.trim()) return payload.version.trim();
  if (typeof payload.appBuild === 'string' && payload.appBuild.trim()) return payload.appBuild.trim();
  return null;
}

async function fetchRemoteBuild() {
  const attempts = [];
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  VERSION_PATHS.forEach((path) => {
    const fromApi = API_BASE_URL ? `${API_BASE_URL}${path}` : path;
    const absolute = fromApi.startsWith('http') ? fromApi : `${origin}${fromApi}`;
    attempts.push(absolute);
    if (origin && !fromApi.startsWith('http')) {
      attempts.push(new URL(path, origin).toString());
    }
  });

  const uniqueAttempts = Array.from(new Set(attempts.filter(Boolean)));

  for (const url of uniqueAttempts) {
    try {
      const separator = url.includes('?') ? '&' : '?';
      const response = await fetch(`${url}${separator}t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) continue;
      const payload = await response.json();
      const build = normalizeBuild(payload);
      if (build) return build;
    } catch (err) {
      // Try the next source
    }
  }

  return null;
}

export default function useAppUpdate() {
  const [remoteBuild, setRemoteBuild] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const currentBuild = useMemo(() => DEFAULT_BUILD, []);

  useEffect(() => {
    let cancelled = false;

    const reloadApp = () => {
      setIsUpdating(true);
      setTimeout(() => {
        if (Capacitor.isNativePlatform()) {
          window.location.replace(window.location.href);
        } else {
          window.location.reload();
        }
      }, 750);
    };

    const storeBuild = (build) => {
      try {
        localStorage.setItem(STORAGE_KEY, build);
      } catch {
        // Ignore storage failures
      }
    };

    const checkVersion = async () => {
      const baseline = (() => {
        try {
          return localStorage.getItem(STORAGE_KEY) || currentBuild;
        } catch {
          return currentBuild;
        }
      })();
      const latest = await fetchRemoteBuild();
      if (!latest) return;

      setRemoteBuild(latest);
      if (cancelled) return;
      if (baseline && latest === baseline) {
        storeBuild(latest);
        return;
      }

      storeBuild(latest);
      reloadApp();
    };

    checkVersion().catch(() => {});
    const intervalId = window.setInterval(() => {
      checkVersion().catch(() => {});
    }, POLL_INTERVAL_MS);
    window.addEventListener('focus', checkVersion);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', checkVersion);
    };
  }, [currentBuild]);

  return { isUpdating, currentBuild, remoteBuild };
}
