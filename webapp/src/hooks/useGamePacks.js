import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadGamePackCatalog } from '../pwa/gamePackCatalog.js';
import {
  GAME_PACK_CHANGE_EVENT,
  GAME_PACK_PROGRESS_EVENT,
  cancelGamePackInstall,
  getGamePackInstallations,
  getGamePackStatus,
  reconcileGamePackInstallations,
  getGamePackStorageEstimate,
  installGamePack,
  isGamePackStorageSupported,
  removeGamePack
} from '../pwa/gamePackManager.js';

export default function useGamePacks() {
  const [catalog, setCatalog] = useState(null);
  const [installations, setInstallations] = useState(() => getGamePackInstallations());
  const [progress, setProgress] = useState({});
  const [storage, setStorage] = useState({ usage: 0, quota: 0, persisted: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const supported = isGamePackStorageSupported();

  const refresh = useCallback(async ({ forceCatalog = false } = {}) => {
    setLoading(true);
    try {
      const [nextCatalog, nextStorage, nextInstallations] = await Promise.all([
        loadGamePackCatalog({ force: forceCatalog }),
        getGamePackStorageEstimate(),
        reconcileGamePackInstallations()
      ]);
      setCatalog(nextCatalog);
      setStorage(nextStorage);
      setInstallations(nextInstallations);
      setError('');
    } catch (nextError) {
      setError(nextError?.message || 'Unable to load game downloads.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const onProgress = event => {
      const detail = event.detail || {};
      if (!detail.packId) return;
      setProgress(current => ({ ...current, [detail.packId]: detail }));
    };
    const onChanged = event => {
      const detail = event.detail || {};
      setInstallations(getGamePackInstallations());
      if (detail.packId && ['installed', 'not-installed'].includes(detail.status)) {
        setProgress(current => {
          const next = { ...current };
          delete next[detail.packId];
          return next;
        });
      }
      void getGamePackStorageEstimate().then(setStorage);
    };

    window.addEventListener(GAME_PACK_PROGRESS_EVENT, onProgress);
    window.addEventListener(GAME_PACK_CHANGE_EVENT, onChanged);
    window.addEventListener('online', refresh);
    return () => {
      window.removeEventListener(GAME_PACK_PROGRESS_EVENT, onProgress);
      window.removeEventListener(GAME_PACK_CHANGE_EVENT, onChanged);
      window.removeEventListener('online', refresh);
    };
  }, [refresh]);

  const install = useCallback(
    async packId => {
      if (!catalog) return;
      setError('');
      try {
        await installGamePack(packId, { catalog });
      } catch (nextError) {
        if (nextError?.name !== 'AbortError') {
          setError(nextError?.message || 'The game pack could not be downloaded.');
        }
      } finally {
        setInstallations(getGamePackInstallations());
        setStorage(await getGamePackStorageEstimate());
      }
    },
    [catalog]
  );

  const remove = useCallback(
    async packId => {
      if (!catalog) return;
      setError('');
      try {
        await removeGamePack(packId, { catalog });
      } catch (nextError) {
        setError(nextError?.message || 'The game pack could not be removed.');
      } finally {
        setInstallations(getGamePackInstallations());
        setStorage(await getGamePackStorageEstimate());
      }
    },
    [catalog]
  );

  const packs = useMemo(
    () =>
      (catalog?.packs || [])
        .filter(pack => !pack.hidden)
        .map(pack => ({
          ...pack,
          installation: installations[pack.id] || null,
          status: getGamePackStatus(pack, installations[pack.id]),
          progress: progress[pack.id] || null
        })),
    [catalog, installations, progress]
  );

  return {
    packs,
    catalog,
    installations,
    storage,
    loading,
    error,
    supported,
    install,
    remove,
    cancel: cancelGamePackInstall,
    refresh
  };
}
