import { isIP } from 'node:net';

/**
 * Per-client limit key: X-Forwarded-For only from a loopback peer; IPv6 grouped by /64.
 * null means the machine itself: a loopback peer with no usable forwarded address. In
 * production every player arrives through Caddy, which always sets the header, and the
 * app listens on 127.0.0.1 only, so this is local dev, the test suite or an on-box script.
 */
export function clientKey(
  peer: string | undefined,
  forwardedFor: string | string[] | undefined,
): string | null {
  const direct = unmapIPv4(peer ?? '');
  const header = Array.isArray(forwardedFor) ? forwardedFor.join(',') : (forwardedFor ?? '');
  const forwarded = unmapIPv4(header.split(',').pop()?.trim() ?? '');
  if (isLoopback(direct) && !isIP(forwarded)) return null;
  const address = isLoopback(direct) ? forwarded : direct;
  return isIP(address) === 6 ? ipv6Prefix64(address) : address;
}

function unmapIPv4(address: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  return mapped ? mapped[1]! : address;
}

function isLoopback(address: string): boolean {
  return address === '::1' || address.startsWith('127.');
}

function ipv6Prefix64(address: string): string {
  const [head = '', tail] = address.split('%')[0]!.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const zeros = tail === undefined ? [] : Array<string>(8 - left.length - right.length).fill('0');
  const groups = [...left, ...zeros, ...right].slice(0, 4);
  return `${groups.map((g) => g.toLowerCase().replace(/^0+(?=.)/, '')).join(':')}::/64`;
}
