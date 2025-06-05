export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export async function ping() {
  const res = await fetch(API_BASE_URL + '/');
  return res.text();
}
