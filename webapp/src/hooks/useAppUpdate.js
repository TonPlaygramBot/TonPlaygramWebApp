import { useEffect, useRef, useState } from 'react';
import { checkForNewBuild, refreshClientToLatestBuild } from '../utils/appUpdate.js';
import { CURRENT_BUILD } from '../utils/versioning.js';

const DEFAULT_POLL_MS = 5 * 60 * 1000;

export default function useAppUpdate({ pollIntervalMs = DEFAULT_POLL_MS } = {}) {
  const [status, setStatus] = useState('idle');
  const [latestBuild, setLatestBuild] = useState(null);
  const reloadTriggeredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const runCheck = async () => {
      if (cancelled) return;
      setStatus(prev => (prev === 'updating' ? prev : 'checking'));

      const result = await checkForNewBuild();
      if (cancelled) return;

      if (result.latestBuild) {
        setLatestBuild(result.latestBuild);
      }

      if (result.hasUpdate) {
        setStatus('updating');
        if (!reloadTriggeredRef.current) {
          reloadTriggeredRef.current = true;
          await refreshClientToLatestBuild();
        }
      } else {
        setStatus('idle');
      }
    };

    void runCheck();

    const intervalId = setInterval(runCheck, pollIntervalMs);
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        void runCheck();
      }
    };

    window.addEventListener('online', runCheck);
    document.addEventListener('visibilitychange', visibilityHandler);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener('online', runCheck);
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [pollIntervalMs]);

  return {
    status,
    latestBuild,
    currentBuild: CURRENT_BUILD
  };
}

