import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronDown,
  Download,
  HardDrive,
  PackageOpen,
  Play,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X
} from 'lucide-react';
import useGamePacks from '../hooks/useGamePacks.js';
import { formatBytes } from '../pwa/gamePackManager.js';
import './gamePackManager.css';

const STATUS_LABELS = {
  installed: 'Installed',
  'update-available': 'Update available',
  downloading: 'Downloading',
  partial: 'Ready to resume',
  failed: 'Retry download',
  'not-installed': 'Not installed'
};

const actionLabel = status => {
  if (status === 'installed') return 'Remove';
  if (status === 'update-available') return 'Update';
  if (status === 'partial' || status === 'failed') return 'Resume';
  return 'Download';
};

export default function GamePackManager() {
  const location = useLocation();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const focusedPackId = query.get('downloadPack') || '';
  const pendingRoute = query.get('returnTo');
  const safePendingRoute = pendingRoute?.startsWith('/games/') ? pendingRoute : null;
  const [expanded, setExpanded] = useState(Boolean(focusedPackId));
  const {
    packs,
    storage,
    loading,
    error,
    supported,
    install,
    remove,
    cancel,
    refresh
  } = useGamePacks();

  const visiblePacks = useMemo(() => {
    if (!focusedPackId) return packs;
    return [...packs].sort((left, right) => Number(right.id === focusedPackId) - Number(left.id === focusedPackId));
  }, [focusedPackId, packs]);

  const installedCount = useMemo(
    () => packs.filter(pack => ['installed', 'update-available'].includes(pack.status)).length,
    [packs]
  );
  const storageLabel = storage.quota
    ? `${formatBytes(storage.usage)} used · ${formatBytes(Math.max(0, storage.quota - storage.usage))} free`
    : 'Storage is calculated by your device';

  return (
    <section className={`game-pack-manager ${expanded ? 'is-open' : ''}`} aria-label="Game downloads">
      <button
        type="button"
        className="game-pack-manager__summary"
        onClick={() => setExpanded(value => !value)}
        aria-expanded={expanded}
      >
        <span className="game-pack-manager__summary-icon"><PackageOpen size={19} /></span>
        <span className="game-pack-manager__summary-copy">
          <strong>Game downloads</strong>
          <small>{installedCount} installed · {storageLabel}</small>
        </span>
        <ChevronDown className="game-pack-manager__chevron" size={19} />
      </button>

      {expanded && (
        <div className="game-pack-manager__body">
          <div className="game-pack-manager__intro">
            <div>
              <p><HardDrive size={15} /> Install once, load faster</p>
              <span>Downloaded assets stay on this device and only changed files are fetched during updates.</span>
            </div>
            <button type="button" onClick={() => void refresh({ forceCatalog: true })} aria-label="Check for game updates">
              <RefreshCw size={16} />
            </button>
          </div>

          {!supported && (
            <p className="game-pack-manager__notice">
              This browser does not expose persistent cache storage. The games still work online, but device downloads are unavailable.
            </p>
          )}

          {error && <p className="game-pack-manager__error">{error}</p>}

          {loading && !packs.length ? (
            <div className="game-pack-manager__loading">Checking available game packs…</div>
          ) : (
            <div className="game-pack-manager__list">
              {visiblePacks.map(pack => {
                const download = pack.progress;
                const percent = Math.max(0, Math.min(100, download?.percent || 0));
                const working = pack.status === 'downloading' || Boolean(download && !['complete', 'failed', 'cancelled'].includes(download.phase));
                const installed = pack.status === 'installed';
                const displayBytes = pack.totalBytes || pack.installation?.totalBytes || download?.totalBytes || 0;

                return (
                  <article className={`game-pack-card ${pack.id === focusedPackId ? 'is-focused' : ''}`} key={pack.id}>
                    <img src={pack.cover} alt="" loading="lazy" />
                    <div className="game-pack-card__content">
                      <div className="game-pack-card__topline">
                        <div>
                          <h3>{pack.title}</h3>
                          <p>{pack.description}</p>
                        </div>
                        <span className={`game-pack-card__status status-${pack.status}`}>
                          {installed && <CheckCircle2 size={12} />}
                          {STATUS_LABELS[pack.status] || pack.status}
                        </span>
                      </div>

                      <div className="game-pack-card__meta">
                        <span>{displayBytes ? formatBytes(displayBytes) : 'Size calculated at install'}</span>
                        {pack.assetCount > 0 && <span>{pack.assetCount.toLocaleString()} files</span>}
                        {pack.installation?.reusedBytes > 0 && (
                          <span>{formatBytes(pack.installation.reusedBytes)} reused</span>
                        )}
                      </div>

                      {working && (
                        <div className="game-pack-progress" aria-label={`${pack.title} download ${percent}%`}>
                          <div><span style={{ width: `${percent}%` }} /></div>
                          <p>
                            <strong>{percent}%</strong>
                            <span>{download?.completedAssets || 0}/{download?.totalAssets || 0} files</span>
                          </p>
                        </div>
                      )}

                      <div className="game-pack-card__actions">
                        {working ? (
                          <button type="button" className="secondary" onClick={() => cancel(pack.id)}>
                            <X size={15} /> Cancel
                          </button>
                        ) : installed ? (
                          <>
                            <Link className="primary" to={(pack.id === focusedPackId && safePendingRoute) || pack.route || '/games'}>
                              <Play size={15} /> Play
                            </Link>
                            <button type="button" className="danger" onClick={() => void remove(pack.id)}>
                              <Trash2 size={15} /> Remove
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="primary"
                            disabled={!supported}
                            onClick={() => void install(pack.id)}
                          >
                            <Download size={15} />
                            {actionLabel(pack.status)}
                          </button>
                        )}
                        {pack.status === 'update-available' && (
                          <>
                            <Link className="secondary" to={(pack.id === focusedPackId && safePendingRoute) || pack.route || '/games'}>
                              <Play size={15} /> Play current
                            </Link>
                            <button type="button" className="danger" onClick={() => void remove(pack.id)}>
                              <Trash2 size={15} /> Remove
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <p className="game-pack-manager__footer">
            <ShieldCheck size={14} /> Release manifests verify small files with SHA-256 and reuse unchanged cached files.
          </p>
        </div>
      )}
    </section>
  );
}
