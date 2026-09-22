import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Session tokens prove ownership of a player id across reconnects. They are
 * `playerId.signature`; the secret is per server process because rooms are
 * in-memory and die with the process anyway.
 */
export class SessionSigner {
  constructor(private readonly secret: Buffer = randomBytes(32)) {}

  newPlayerId(): string {
    return randomBytes(9).toString('base64url');
  }

  sign(playerId: string): string {
    return `${playerId}.${this.signature(playerId)}`;
  }

  /** Returns the player id if the token is authentic, otherwise null. */
  verify(token: string | undefined): string | null {
    if (!token) return null;
    const dot = token.lastIndexOf('.');
    if (dot <= 0) return null;
    const playerId = token.slice(0, dot);
    const given = Buffer.from(token.slice(dot + 1), 'base64url');
    const expected = Buffer.from(this.signature(playerId), 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    return playerId;
  }

  private signature(playerId: string): string {
    return createHmac('sha256', this.secret).update(playerId).digest('base64url');
  }
}
