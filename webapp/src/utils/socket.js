import { io } from 'socket.io-client';

const baseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;
export const socket = io(baseUrl);
