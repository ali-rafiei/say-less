import { isIP } from 'node:net';

/** Per-client limit key: X-Forwarded-For only from a loopback peer; IPv6 grouped by /64. */
export function clientKey(
  peer: string | undefined,
  forwardedFor: string | string[] | undefined,
): string {
  const direct = unmapIPv4(peer ?? '');
  const header = Array.isArray(forwardedFor) ? forwardedFor.join(',') : (forwardedFor ?? '');
  const forwarded = unmapIPv4(header.split(',').pop()?.trim() ?? '');
  const address = isLoopback(direct) && isIP(forwarded) ? forwarded : direct;
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
