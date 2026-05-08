import { io } from 'socket.io-client';

// VITE_SOCKET_URL is set in .env.production for deployment.
// In dev, Vite proxies /socket.io → localhost:3001 so URL can be empty.
const URL = import.meta.env.VITE_SOCKET_URL ?? '';

// Singleton socket — autoConnect:false so it only connects when the user
// explicitly enters a room (socket.connect() is called in useWebRTC).
export const socket = io(URL, { autoConnect: false });
