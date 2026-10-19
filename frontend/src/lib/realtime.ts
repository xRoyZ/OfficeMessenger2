import { API_BASE_URL } from './api';
import type { WsEvent } from './types';

const WS_PATH = '/api/ws';
const RECONNECT_DELAY_MS = 1500;

const handlers = new Set<(event: WsEvent) => void>();

let socket: WebSocket | null = null;
let currentToken: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let manuallyClosed = false;

function realtimeUrl(token: string): string {
  const base = API_BASE_URL.replace(/^http/i, 'ws');
  return `${base}${WS_PATH}?token=${encodeURIComponent(token)}`;
}

function clearReconnectTimer(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function dispatch(event: WsEvent): void {
  for (const handler of handlers) {
    handler(event);
  }
}

function scheduleReconnect(token: string): void {
  clearReconnectTimer();
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!manuallyClosed && currentToken === token) {
      openSocket(token);
    }
  }, RECONNECT_DELAY_MS);
}

function openSocket(token: string): void {
  if (typeof WebSocket === 'undefined') {
    return;
  }

  socket = new WebSocket(realtimeUrl(token));

  socket.onmessage = (message: MessageEvent<string>) => {
    try {
      const event = JSON.parse(message.data) as WsEvent;
      dispatch(event);
    } catch {
      return;
    }
  };

  socket.onclose = (event: CloseEvent) => {
    socket = null;
    if (event.code === 4401) {
      currentToken = null;
      return;
    }
    if (!manuallyClosed) {
      scheduleReconnect(token);
    }
  };

  socket.onerror = () => {
    socket?.close();
  };
}

export function connectRealtime(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (
    currentToken === token &&
    socket !== null &&
    (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  clearReconnectTimer();
  manuallyClosed = false;
  currentToken = token;
  socket?.close();
  openSocket(token);
}

export function disconnectRealtime(): void {
  manuallyClosed = true;
  currentToken = null;
  clearReconnectTimer();
  socket?.close();
  socket = null;
  handlers.clear();
}

export function subscribe(handler: (event: WsEvent) => void): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}
