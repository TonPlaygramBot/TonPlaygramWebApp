import { retainWallTransfer } from './wallTransferActivity.js';

type DownloadRequest = {
  url: string;
  name: string;
  grant?: { url: string; headers: Record<string, string>; quality: string };
};
export type WallDownload = DownloadRequest & {
  id: string;
  phase: 'preparing' | 'ready' | 'requested' | 'sent' | 'cancelled' | 'error';
  error?: string;
  grantedAt?: number;
};
let downloads: WallDownload[] = [];
export const OPEN_WALL_TRANSFERS = 'wall-transfers-open';
const listeners = new Set<() => void>();
export const getWallDownloads = () => downloads;
export const subscribeWallDownloads = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
function update(id: string, patch: Partial<WallDownload>) {
  downloads = downloads.map((job) =>
    job.id === id ? { ...job, ...patch } : job
  );
  publish();
}
function publish() {
  retainWallTransfer(
    'wall-downloads',
    downloads.some((job) => job.phase !== 'sent')
  );
  listeners.forEach((listener) => listener());
}
export function dismissWallDownload(id: string) {
  downloads = downloads.filter((job) => job.id !== id);
  publish();
}

// Only request a signed URL here. Large video bytes go straight to the device
// downloader, never through a fetch/blob held in the mini app's memory.
async function prepare(id: string, native = true) {
  const job = downloads.find((item) => item.id === id);
  if (!job || job.phase === 'requested') return;
  update(id, { phase: 'preparing', error: undefined });
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 60000);
  try {
    let url = job.url;
    let name = job.name;
    if (job.grant) {
      const response = await fetch(job.grant.url, {
        method: 'POST',
        headers: { ...job.grant.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ quality: job.grant.quality, requestId: job.id }),
        signal: controller.signal
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || 'Download could not be prepared.');
      if (!payload.downloadUrl)
        throw new Error('The server did not provide a download link.');
      url = new URL(payload.downloadUrl, new URL(job.grant.url, location.href))
        .href;
      name = payload.name || name;
    }
    if (!downloads.some((item) => item.id === id)) return;
    update(id, {
      url: new URL(url, location.href).href,
      name,
      phase: 'ready',
      grantedAt: Date.now(),
      error: native ? undefined : 'Use Save in browser to download this file.'
    });
    const telegram = (window as any).Telegram?.WebApp;
    if (
      native &&
      typeof telegram?.downloadFile === 'function' &&
      (!telegram.isVersionAtLeast || telegram.isVersionAtLeast('8.0'))
    ) {
      saveWallDownload(id);
    }
    // Browsers require a fresh user gesture for reliable download handoff.
    // The global panel's Save button remains available on every app page.
  } catch (error) {
    update(id, {
      phase: 'error',
      error:
        error instanceof Error && error.name !== 'AbortError'
          ? error.message
          : 'Download preparation was interrupted. Retry from Transfers.'
    });
  } finally {
    clearTimeout(timer);
  }
}

export function startWallDownload(request: DownloadRequest) {
  window.dispatchEvent(new Event(OPEN_WALL_TRANSFERS));
  const existing = downloads.find(
    (job) =>
      job.phase !== 'sent' &&
      (request.grant
        ? job.grant?.url === request.grant.url &&
          job.grant?.quality === request.grant.quality &&
          JSON.stringify(job.grant?.headers) ===
            JSON.stringify(request.grant.headers)
        : job.url === request.url)
  );
  if (existing) {
    if (existing.phase === 'error') retryWallDownload(existing.id);
    if (existing.phase === 'cancelled') saveWallDownload(existing.id);
    return existing.id;
  }
  const id = crypto.randomUUID();
  downloads = [...downloads, { ...request, id, phase: 'preparing' }];
  publish();
  void prepare(id);
  return id;
}

export function retryWallDownload(id: string) {
  const job = downloads.find((item) => item.id === id);
  if (!job || ['preparing', 'requested'].includes(job.phase)) return;
  // The same requestId is retained even if the first payment response was lost.
  void prepare(id);
}

export function saveWallDownload(id: string) {
  const job = downloads.find((item) => item.id === id);
  if (!job || !['ready', 'cancelled', 'sent'].includes(job.phase)) return;
  if (job.grant && Date.now() - (job.grantedAt || 0) > 4 * 60 * 1000) {
    void prepare(id);
    return;
  }
  const telegram = (window as any).Telegram?.WebApp;
  try {
    if (
      !job.url.startsWith('blob:') &&
      typeof telegram?.downloadFile === 'function' &&
      (!telegram.isVersionAtLeast || telegram.isVersionAtLeast('8.0'))
    ) {
      update(id, { phase: 'requested' });
      try {
        telegram.downloadFile(
          { url: job.url, file_name: job.name },
          (accepted: boolean) => {
            // Acceptance is a handoff, not proof that the video finished saving.
            update(id, { phase: accepted ? 'sent' : 'cancelled' });
          }
        );
        return;
      } catch {
        // Older clients may expose the method without implementing it. Wait
        // for another user gesture before falling back to a browser download.
        update(id, {
          phase: 'ready',
          error: 'Use Save in browser to download this file.'
        });
        return;
      }
    }
    saveWallDownloadInBrowser(id);
  } catch (error) {
    update(id, {
      phase: 'ready',
      error:
        error instanceof Error ? error.message : 'Tap Save to device again.'
    });
  }
}

export function saveWallDownloadInBrowser(id: string) {
  const job = downloads.find((item) => item.id === id);
  if (!job || !['ready', 'cancelled', 'sent'].includes(job.phase)) return;
  if (job.grant && Date.now() - (job.grantedAt || 0) > 4 * 60 * 1000) {
    void prepare(id, false);
    return;
  }
  const telegram = (window as any).Telegram?.WebApp;
  if (
    !job.url.startsWith('blob:') &&
    typeof telegram?.openLink === 'function'
  ) {
    telegram.openLink(job.url, { try_instant_view: false });
  } else {
    const link = document.createElement('a');
    link.href = job.url;
    link.download = job.name;
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  update(id, { phase: 'sent', error: undefined });
}
