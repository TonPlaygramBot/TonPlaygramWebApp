import { io } from 'socket.io-client';

let baseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;

if (typeof window !== 'undefined' && window.location.protocol === 'https:' && baseUrl.startsWith('http:')) {
  baseUrl = baseUrl.replace(/^http:/, 'https:');
}

export const socket = io(baseUrl, { transports: ['websocket'] });
