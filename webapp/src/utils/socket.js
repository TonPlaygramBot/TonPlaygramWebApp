import { io } from 'socket.io-client';

let baseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;

if (typeof window !== 'undefined' && window.location.protocol === 'https:' && baseUrl.startsWith('http:')) {
  baseUrl = baseUrl.replace(/^http:/, 'https:');
}

if (import.meta.env.DEV) {
  console.log('Socket is trying to connect to:', baseUrl);
}
export const socket = io(baseUrl, {
  transports: ['websocket', 'polling']
});
