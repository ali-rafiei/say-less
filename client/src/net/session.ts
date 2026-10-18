export interface StoredSession {
  code: string;
  sessionToken: string;
  name: string;
}

const KEY = 'say-less.session';

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed.code || !parsed.sessionToken || !parsed.name) return null;
    return { code: parsed.code, sessionToken: parsed.sessionToken, name: parsed.name };
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Private mode or blocked storage: reconnect just will not survive a refresh.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

const NAME_KEY = 'say-less.name';
export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // ignore
  }
}

const DEVICE_KEY = 'say-less.device';

/** An anonymous random id for this browser, sent on join for play counts only. */
export function deviceId(): string {
  try {
    const stored = localStorage.getItem(DEVICE_KEY);
    if (stored) return stored;
    const fresh = randomId();
    localStorage.setItem(DEVICE_KEY, fresh);
    return fresh;
  } catch {
    // Storage blocked: a per-page id still counts this visit once.
    pageDeviceId ??= randomId();
    return pageDeviceId;
  }
}

let pageDeviceId: string | null = null;

/** 32 hex characters. getRandomValues works on plain-HTTP pages too, unlike randomUUID. */
function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
