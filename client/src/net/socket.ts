import { RATE_LIMIT_MS, type ClientMessage, type ServerMessage } from '@say-less/shared';

export type SocketStatus = 'connecting' | 'open' | 'closed';

type Listener = (message: ServerMessage) => void;
type StatusListener = (status: SocketStatus) => void;

const PING_INTERVAL_MS = 15_000;
const PONG_TIMEOUT_MS = 8_000;

/**
 * Reconnecting WebSocket with paced sends.
 *  - Intents are paced to the server's rate limit so a double-tap is delayed, not dropped.
 *  - Anything queued while offline is discarded on reconnect: stale votes and submits
 *    must not replay into a phase that has moved on.
 *  - A client-side ping detects half-open sockets (iOS backgrounding) and reconnects
 *    immediately when the tab returns to the foreground or the network comes back.
 */
export class GameSocket {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<StatusListener>();
  private queue: string[] = [];
  private attempt = 0;
  private closedByUser = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSentAt = 0;
  private drainTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  status: SocketStatus = 'closed';

  constructor(private readonly url: string) {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.wake);
      window.addEventListener('pageshow', this.wake);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.wake();
      });
    }
  }

  connect(): void {
    this.closedByUser = false;
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    this.setStatus('connecting');
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.onopen = () => {
      this.attempt = 0;
      this.setStatus('open');
      this.startHeartbeat();
      this.drain();
    };
    socket.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }
      if (message.type === 'pong') {
        this.clearPongTimer();
        return;
      }
      for (const listener of this.listeners) listener(message);
    };
    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      this.stopHeartbeat();
      this.queue = [];
      if (this.drainTimer) {
        clearTimeout(this.drainTimer);
        this.drainTimer = null;
      }
      this.setStatus('closed');
      if (!this.closedByUser) this.scheduleReconnect();
    };
    socket.onerror = () => socket.close();
  }

  /** Paced, queued while open; dropped if the socket is not open (see class note). */
  send(message: ClientMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.connect();
      return;
    }
    this.queue.push(JSON.stringify(message));
    this.drain();
  }

  /** Sent immediately, ahead of the paced queue: used for the (re)join right after open. */
  sendNow(message: ClientMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(message));
    this.lastSentAt = Date.now();
  }

  close(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    this.socket?.close();
  }

  onMessage(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Foreground / network-back: reconnect right away instead of waiting for backoff. */
  private wake = (): void => {
    if (this.closedByUser) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.attempt = 0;
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.ping();
      return;
    }
    this.connect();
  };

  private drain(): void {
    if (this.drainTimer) return;
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const wait = this.lastSentAt + RATE_LIMIT_MS + 20 - Date.now();
    if (wait > 0) {
      this.drainTimer = setTimeout(() => {
        this.drainTimer = null;
        this.drain();
      }, wait);
      return;
    }
    const raw = this.queue.shift();
    if (raw === undefined) return;
    this.socket.send(raw);
    this.lastSentAt = Date.now();
    if (this.queue.length > 0) this.drain();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => this.ping(), PING_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    this.clearPongTimer();
  }

  private ping(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    if (this.pongTimer) return;
    this.socket.send(JSON.stringify({ type: 'ping', payload: {} }));
    this.pongTimer = setTimeout(() => {
      this.pongTimer = null;
      // Half-open socket: force a close so the normal reconnect path runs.
      this.socket?.close();
    }, PONG_TIMEOUT_MS);
  }

  private clearPongTimer(): void {
    if (this.pongTimer) clearTimeout(this.pongTimer);
    this.pongTimer = null;
  }

  private scheduleReconnect(): void {
    const delay = Math.min(500 * 2 ** this.attempt, 8_000) + Math.random() * 250;
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private setStatus(status: SocketStatus): void {
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }
}

export function defaultSocketUrl(): string {
  const configured = import.meta.env.VITE_WS_URL as string | undefined;
  if (configured) return configured;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/ws`;
}
