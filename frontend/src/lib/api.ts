const API_BASE = import.meta.env.VITE_API_BASE_URL;

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
}
