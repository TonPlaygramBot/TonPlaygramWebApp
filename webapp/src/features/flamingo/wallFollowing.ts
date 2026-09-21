import { useEffect, useSyncExternalStore } from 'react';
import { API_BASE_URL } from '../../utils/api.js';
import { wallAccountHeaders, wallProfileEvents } from './wallIdentity';

type Follow = { authorAccountId: string; notify: boolean };
let snapshot: { accountId: string; following: Follow[] } = {
  accountId: '',
  following: []
};
const listeners = new Set<() => void>();
let revision = 0;
let loading: AbortController | undefined;
let users = 0;
export async function socialRequest(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal
) {
  const response = await fetch(
    `${API_BASE_URL}/api/flamingo-wall/social${path}`,
    {
      method,
      signal,
      cache: 'no-store',
      headers: wallAccountHeaders({ 'Content-Type': 'application/json' }),
      ...(body ? { body: JSON.stringify(body) } : {})
    }
  );
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || 'Your choice could not be saved.');
  return result;
}
function emit() {
  listeners.forEach((listener) => listener());
}
export async function refreshFollowing() {
  loading?.abort();
  const controller = new AbortController();
  loading = controller;
  const currentRevision = revision;
  try {
    const next = await socialRequest(
      '/following',
      'GET',
      undefined,
      controller.signal
    );
    if (!controller.signal.aborted && currentRevision === revision) {
      snapshot = {
        accountId: typeof next.accountId === 'string' ? next.accountId : '',
        following: Array.isArray(next.following) ? next.following : []
      };
      emit();
    }
  } catch {
    if (!controller.signal.aborted && currentRevision === revision) {
      snapshot = { accountId: '', following: [] };
      emit();
    }
  }
}
export async function saveFollowing(
  accountId: string,
  following: boolean,
  notify: boolean
) {
  await socialRequest(`/following/${encodeURIComponent(accountId)}`, 'PUT', {
    following,
    notify
  });
  revision++;
  snapshot = {
    ...snapshot,
    following: snapshot.following
      .filter((row) => row.authorAccountId !== accountId)
      .concat(following ? [{ authorAccountId: accountId, notify }] : [])
  };
  emit();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => snapshot;
export function useWallFollowing() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    if (users++ === 0) {
      void refreshFollowing();
      wallProfileEvents.forEach((event) =>
        window.addEventListener(event, refreshFollowing)
      );
    }
    return () => {
      if (--users === 0) {
        loading?.abort();
        wallProfileEvents.forEach((event) =>
          window.removeEventListener(event, refreshFollowing)
        );
      }
    };
  }, []);
  return state;
}
