import { describe, expect, it } from 'vitest';
import { clientKey } from '../src/clientAddress.ts';

describe('clientKey', () => {
  it('uses the socket peer and ignores X-Forwarded-For when the peer is not loopback', () => {
    expect(clientKey('203.0.113.9', '198.51.100.1')).toBe('203.0.113.9');
  });

  it('trusts the last X-Forwarded-For entry when the peer is loopback', () => {
    expect(clientKey('127.0.0.1', '10.0.0.1, 198.51.100.7')).toBe('198.51.100.7');
    expect(clientKey('::ffff:127.0.0.1', '198.51.100.7')).toBe('198.51.100.7');
    expect(clientKey('::1', ['198.51.100.7'])).toBe('198.51.100.7');
  });

  it('treats a loopback peer without a usable X-Forwarded-For as the machine itself', () => {
    // In production every player comes through Caddy, which always sets the header, and
    // the app listens on 127.0.0.1 only; a bare loopback connection is dev, tests or the box.
    expect(clientKey('127.0.0.1', undefined)).toBeNull();
    expect(clientKey('::1', 'not-an-ip')).toBeNull();
  });

  it('groups IPv6 clients by their /64, since one home network holds a whole /64', () => {
    // Arrange: two devices on the same network, one on another
    const phone = clientKey('2001:db8:1:2:aaaa::1', undefined);
    const laptop = clientKey('127.0.0.1', '2001:db8:1:2:bbbb:cccc:dddd:eeee');
    const elsewhere = clientKey('2001:db8:1:3::1', undefined);
    // Assert
    expect(phone).toBe(laptop);
    expect(phone).not.toBe(elsewhere);
  });

  it('treats an IPv4-mapped IPv6 peer as the IPv4 address', () => {
    expect(clientKey('::ffff:203.0.113.9', undefined)).toBe('203.0.113.9');
  });
});
