// Utility functions for IP address calculations, CIDR parsing, and validations

export function ipToLong(ip: string): number {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return 0;
  return parts.reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

export function longToIp(long: number): string {
  return [
    (long >>> 24) & 255,
    (long >>> 16) & 255,
    (long >>> 8) & 255,
    long & 255,
  ].join('.');
}

export function isValidIPv4(ip: string): boolean {
  const regex = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  return regex.test(ip.trim());
}

export function isValidCIDR(cidr: string): boolean {
  const parts = cidr.trim().split('/');
  if (parts.length !== 2) return false;
  const [ip, prefixStr] = parts;
  if (!isValidIPv4(ip)) return false;
  const prefix = parseInt(prefixStr, 10);
  return !isNaN(prefix) && prefix >= 1 && prefix <= 32;
}

export interface CIDRInfo {
  networkAddress: string;
  broadcastAddress: string;
  subnetMask: string;
  wildcardMask: string;
  gateway: string;
  firstUsableIp: string;
  lastUsableIp: string;
  totalHosts: number;
  usableHosts: number;
  prefix: number;
  binaryMask: string;
}

export function parseCIDR(cidr: string): CIDRInfo | null {
  if (!isValidCIDR(cidr)) return null;
  const [ipStr, prefixStr] = cidr.trim().split('/');
  const prefix = parseInt(prefixStr, 10);

  const maskLong = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const wildcardLong = ~maskLong >>> 0;

  const ipLong = ipToLong(ipStr);
  const networkLong = (ipLong & maskLong) >>> 0;
  const broadcastLong = (networkLong | wildcardLong) >>> 0;

  const totalHosts = Math.pow(2, 32 - prefix);
  const usableHosts = prefix >= 31 ? totalHosts : Math.max(0, totalHosts - 2);

  const firstUsableLong = prefix >= 31 ? networkLong : networkLong + 1;
  const lastUsableLong = prefix >= 31 ? broadcastLong : broadcastLong - 1;
  // Default gateway usually first usable IP
  const gatewayLong = firstUsableLong;

  // Binary mask
  const binaryMask = maskLong.toString(2).padStart(32, '0').match(/.{8}/g)?.join('.') || '';

  return {
    networkAddress: longToIp(networkLong),
    broadcastAddress: longToIp(broadcastLong),
    subnetMask: longToIp(maskLong),
    wildcardMask: longToIp(wildcardLong),
    gateway: longToIp(gatewayLong),
    firstUsableIp: longToIp(firstUsableLong),
    lastUsableIp: longToIp(lastUsableLong),
    totalHosts,
    usableHosts,
    prefix,
    binaryMask,
  };
}

export function isIpInSubnet(ip: string, subnetCidr: string): boolean {
  const info = parseCIDR(subnetCidr);
  if (!info) return false;
  const ipLong = ipToLong(ip);
  const netLong = ipToLong(info.networkAddress);
  const bcastLong = ipToLong(info.broadcastAddress);
  return ipLong >= netLong && ipLong <= bcastLong;
}

export function formatMAC(mac: string): string {
  const cleaned = mac.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (cleaned.length === 0) return '';
  const parts = cleaned.match(/.{1,2}/g) || [];
  return parts.slice(0, 6).join(':');
}

export function isValidMAC(mac: string): boolean {
  return /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(mac.trim());
}

// Generate an array of IPv4 string addresses in a range (capped for performance)
export function generateIPsForSubnet(networkAddress: string, total: number, maxCount: number = 256): string[] {
  const startLong = ipToLong(networkAddress);
  const count = Math.min(total, maxCount);
  const ips: string[] = [];
  for (let i = 0; i < count; i++) {
    ips.push(longToIp(startLong + i));
  }
  return ips;
}

export interface SubnetBlock {
  blockIndex: number;
  startIp: string;
  endIp: string;
  cidrLabel: string;
  hostCount: number;
  startLong: number;
  endLong: number;
}

// Partition large subnets (like /16, /20, /22) into browsable /24 or 256-host blocks
export function getSubnetBlocks(cidr: string, blockSize: number = 256): SubnetBlock[] {
  const info = parseCIDR(cidr);
  if (!info) return [];

  const startLong = ipToLong(info.networkAddress);
  const total = info.totalHosts;

  if (total <= blockSize) {
    return [
      {
        blockIndex: 0,
        startIp: info.networkAddress,
        endIp: info.broadcastAddress,
        cidrLabel: cidr,
        hostCount: total,
        startLong,
        endLong: ipToLong(info.broadcastAddress),
      },
    ];
  }

  const blocks: SubnetBlock[] = [];
  const numBlocks = Math.ceil(total / blockSize);

  for (let i = 0; i < numBlocks; i++) {
    const curStartLong = (startLong + i * blockSize) >>> 0;
    const curCount = Math.min(blockSize, total - i * blockSize);
    const curEndLong = (curStartLong + curCount - 1) >>> 0;

    const startIp = longToIp(curStartLong);
    const endIp = longToIp(curEndLong);
    const subPrefix = 32 - Math.round(Math.log2(blockSize));
    const cidrLabel = `${startIp}/${subPrefix}`;

    blocks.push({
      blockIndex: i,
      startIp,
      endIp,
      cidrLabel,
      hostCount: curCount,
      startLong: curStartLong,
      endLong: curEndLong,
    });
  }

  return blocks;
}
