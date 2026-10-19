import { API_BASE_URL } from './api';
import type { WsEvent } from './types';

const WS_PATH = '/api/ws';

const handlers = new Set<(event: WsEvent) => void>();

function realtimeUrl(token: string): string {
  const base = API_BASE_URL.replace(/^http/i, 'ws');
  return `${base}${WS_PATH}?token=${encodeURIComponent(token)}`;
}

export function connectRealtime(token: string): void {
  void realtimeUrl(token);
}

export function disconnectRealtime(): void {
  handlers.clear();
}

export function subscribe(handler: (event: WsEvent) => void): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}
