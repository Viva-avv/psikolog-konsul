'use client';

import { io, type Socket } from 'socket.io-client';
import { API_URL, getAccessToken, refreshSession } from './api';

let socket: Socket | null = null;
let authRetries = 0;

export function getChatSocket(): Socket {
  if (socket) return socket;
  socket = io(`${new URL(API_URL).origin}/chat`, {
    // Evaluated on every (re)connect so a refreshed access token is used.
    auth: (cb) => cb({ token: getAccessToken() }),
    transports: ['websocket'],
    autoConnect: false,
  });
  socket.on('connect', () => {
    authRetries = 0;
  });
  socket.on('connect_error', async (err) => {
    if (err.message === 'UNAUTHORIZED' && authRetries++ < 1 && (await refreshSession())) socket?.connect();
  });
  return socket;
}

export function disconnectChatSocket() {
  socket?.disconnect();
  socket = null;
}
