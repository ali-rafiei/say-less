import { RATE_LIMIT_MS, type ClientMessage, type ServerMessage } from '@say-less/shared';

export type SocketStatus = 'connecting' | 'open' | 'closed';

type Listener = (message: ServerMessage) => void;
type StatusListener = (status: SocketStatus) => void;

/** Reconnecting WebSocket with a small outbound queue. One instance per tab. */
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
  status: SocketStatus = 'closed';

  constructor(private readonly url: string) {}

  connect(): void {
    this.closedByUser = false;
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    this.setStatus('connecting');
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.onopen = () => {
      this.attempt = 0;
      this.setStatus('open');
      this.drain();
    };
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as ServerMessage;
        for (const listener of this.listeners) listener(message);
      } catch {
        // ignore malformed frames
      }
    };
    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      this.setStatus('closed');
      if (!this.closedByUser) this.scheduleReconnect();
    };
    socket.onerror = () => socket.close();
  }

  /** Intents are paced to the server's rate limit so a fast double-tap is delayed, not dropped. */
  send(message: ClientMessage): void {
    this.queue.push(JSON.stringify(message));
    this.drain();
  }

  private drain(): void {
    if (this.drainTimer) return;
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.connect();
      return;
    }
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

  close(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
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

  private scheduleReconnect(): void {
    const delay = Math.min(500 * 2 ** this.attempt, 8_000) + Math.random() * 250;
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private setStatus(status: SocketStatus): void {
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }
}

export function defaultSocketUrl(): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/ws`;
}
