import { exec, execFile } from 'child_process';
import dns from 'dns';
import net from 'net';
import { testLdapDirectory } from './ldapUtils.js';
import { LdapConfig } from '../src/types.js';

export interface PingResult {
  ip: string;
  online: boolean;
  latencyMs: number;
  hostname?: string;
  macAddress?: string;
  openPorts?: string[];
  deviceType?: string;
}

// Common ports probed during discovery
const COMMON_DISCOVERY_PORTS = [80, 443, 22, 445, 3389, 53, 161, 8080, 9100, 631, 8443, 5000];

/**
 * Strict IPv4 address validator to eliminate Command Injection vectors.
 */
export function isValidIPv4(ip: string): boolean {
  if (typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  const ipv4Regex = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  return ipv4Regex.test(trimmed);
}

/**
 * Validates whether a target is a safe IPv4 address or alphanumeric FQDN hostname.
 */
export function isValidTarget(target: string): boolean {
  if (typeof target !== 'string') return false;
  const trimmed = target.trim();
  if (isValidIPv4(trimmed)) return true;
  // Standard hostname RFC 1123 regex
  const hostnameRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$|^[a-zA-Z0-9\-]{1,63}$/;
  return hostnameRegex.test(trimmed);
}

/**
 * Perform a fast TCP port connection probe with clean socket lifecycle management
 */
export function checkPort(host: string, port: number, timeoutMs = 250): Promise<boolean> {
  return new Promise((resolve) => {
    if (!isValidTarget(host) || isNaN(port) || port < 1 || port > 65535) {
      return resolve(false);
    }

    const socket = new net.Socket();
    let settled = false;

    const finalize = (success: boolean) => {
      if (!settled) {
        settled = true;
        try {
          socket.destroy();
        } catch (e) {}
        resolve(success);
      }
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finalize(true));
    socket.once('timeout', () => finalize(false));
    socket.once('error', () => finalize(false));

    try {
      socket.connect(port, host);
    } catch (e) {
      finalize(false);
    }
  });
}

/**
 * Scan a list of ports for an IP concurrently
 */
export async function scanPorts(ip: string, ports: number[] = COMMON_DISCOVERY_PORTS): Promise<string[]> {
  if (!isValidTarget(ip)) return [];

  const openPorts: string[] = [];
  const promises = ports.map(async (p) => {
    const isOpen = await checkPort(ip, p, 250);
    if (isOpen) {
      openPorts.push(String(p));
    }
  });
  await Promise.all(promises);
  return openPorts;
}

/**
 * Perform reverse DNS lookup to get hostname
 */
export function resolveDns(ip: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (!isValidIPv4(ip)) return resolve(null);

    try {
      dns.reverse(ip, (err, hostnames) => {
        if (!err && hostnames && hostnames.length > 0) {
          resolve(hostnames[0]);
        } else {
          resolve(null);
        }
      });
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Read and parse operating system ARP table safely
 */
export function getArpTable(): Promise<Map<string, string>> {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'arp' : 'arp';
    const args = ['-a'];

    execFile(cmd, args, { timeout: 3000 }, (err, stdout) => {
      const map = new Map<string, string>();
      if (err || !stdout) return resolve(map);

      const lines = stdout.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        const match = trimmed.match(/(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F-]{17}|[0-9a-fA-F:]{17})/);
        if (match) {
          const ip = match[1];
          const mac = match[2].replace(/-/g, ':').toUpperCase();
          if (isValidIPv4(ip)) {
            map.set(ip, mac);
          }
        }
      }
      resolve(map);
    });
  });
}

/**
 * Real ICMP / TCP Ping Probe using execFile to eliminate shell injection vulnerability.
 */
export function pingHost(ip: string, timeoutMs = 700): Promise<{ online: boolean; latencyMs: number }> {
  return new Promise((resolve) => {
    const cleanIp = ip ? ip.trim() : '';
    if (!isValidIPv4(cleanIp)) {
      return resolve({ online: false, latencyMs: 0 });
    }

    const isWin = process.platform === 'win32';
    const pingBinary = isWin ? 'ping.exe' : 'ping';
    const args = isWin
      ? ['-n', '1', '-w', String(Math.min(timeoutMs, 5000)), cleanIp]
      : ['-c', '1', '-W', '1', cleanIp];

    const start = Date.now();

    execFile(pingBinary, args, { timeout: timeoutMs + 1000 }, async (err, stdout) => {
      const duration = Date.now() - start;
      let isOk = false;
      let latency = 0;

      if (stdout) {
        const lower = stdout.toLowerCase();
        isOk =
          (lower.includes(`reply from ${cleanIp.toLowerCase()}`) ||
            lower.includes(`bytes from ${cleanIp.toLowerCase()}`) ||
            (lower.includes('bytes=') && !lower.includes('bytes=0'))) &&
          !lower.includes('destination host unreachable') &&
          !lower.includes('request timed out') &&
          !lower.includes('100% packet loss') &&
          !lower.includes('100% loss');

        const match = stdout.match(/time[=<](\d+(?:\.\d+)?)ms/i);
        if (match) {
          latency = parseFloat(match[1]);
        } else if (isOk) {
          latency = duration;
        }
      }

      // Fallback TCP probe if ICMP was blocked by host firewall
      if (!isOk) {
        const tcpOk =
          (await checkPort(cleanIp, 80, 200)) ||
          (await checkPort(cleanIp, 443, 200)) ||
          (await checkPort(cleanIp, 22, 200)) ||
          (await checkPort(cleanIp, 445, 200)) ||
          (await checkPort(cleanIp, 135, 200));

        if (tcpOk) {
          isOk = true;
          latency = Math.max(1, duration);
        }
      }

      resolve({
        online: isOk,
        latencyMs: isOk ? Math.max(0.5, Number(latency.toFixed(1))) : 0,
      });
    });
  });
}

/**
 * Heuristic device type inference based on ports, DNS, and MAC
 */
export function inferDeviceType(
  ip: string,
  hostname?: string,
  openPorts: string[] = [],
  mac?: string
): string {
  const portsSet = new Set(openPorts);
  const hostLower = (hostname || '').toLowerCase();

  if (portsSet.has('9100') || portsSet.has('631') || portsSet.has('515') || hostLower.includes('print')) {
    return 'printer';
  }
  if (hostLower.includes('fw') || hostLower.includes('firewall') || hostLower.includes('palo') || hostLower.includes('forti')) {
    return 'firewall';
  }
  if (
    portsSet.has('179') ||
    (portsSet.has('161') && (hostLower.includes('gw') || hostLower.includes('router') || hostLower.includes('rtr')))
  ) {
    return 'router';
  }
  if (portsSet.has('161') || hostLower.includes('sw-') || hostLower.includes('switch')) {
    return 'switch';
  }
  if (portsSet.has('554') || portsSet.has('1883') || portsSet.has('502') || hostLower.includes('cam') || hostLower.includes('iot')) {
    return 'iot';
  }
  if (portsSet.has('3389') || (portsSet.has('445') && (hostLower.includes('pc') || hostLower.includes('wks') || hostLower.includes('laptop')))) {
    return 'workstation';
  }
  if (portsSet.has('22') || portsSet.has('80') || portsSet.has('443') || portsSet.has('8080') || portsSet.has('389') || portsSet.has('6443')) {
    return 'server';
  }

  return 'server';
}

/**
 * Scan a batch of IPs concurrently with concurrency limit
 */
export async function scanIpsBatch(
  ips: string[],
  options: { probePorts?: boolean; resolveDns?: boolean } = {}
): Promise<PingResult[]> {
  const validIps = ips.filter(isValidIPv4);
  const { probePorts = true, resolveDns: shouldResolveDns = true } = options;
  const arpTable = await getArpTable();

  const concurrency = 16;
  const results: PingResult[] = [];

  for (let i = 0; i < validIps.length; i += concurrency) {
    const chunk = validIps.slice(i, i + concurrency);
    const chunkResults = await Promise.all(
      chunk.map(async (ip) => {
        const ping = await pingHost(ip, 650);
        if (!ping.online) {
          return {
            ip,
            online: false,
            latencyMs: 0,
          };
        }

        let hostname: string | undefined;
        if (shouldResolveDns) {
          const resolved = await resolveDns(ip);
          if (resolved) hostname = resolved;
        }

        let openPorts: string[] = [];
        if (probePorts) {
          openPorts = await scanPorts(ip);
        }

        const macAddress = arpTable.get(ip);
        const deviceType = inferDeviceType(ip, hostname, openPorts, macAddress);

        return {
          ip,
          online: true,
          latencyMs: ping.latencyMs,
          hostname,
          macAddress,
          openPorts,
          deviceType,
        };
      })
    );
    results.push(...chunkResults);
  }

  return results;
}

/**
 * Diagnostic test against Active Directory / LDAP Server.
 * Delegates to testLdapDirectory for deep protocol testing.
 */
export async function checkLdapServer(
  serverUrl: string,
  domain?: string,
  baseDn?: string,
  bindDn?: string,
  useTls = true
): Promise<{ success: boolean; diagnostics: string[]; responseTimeMs: number; error?: string }> {
  const config: LdapConfig = {
    enabled: true,
    serverUrl,
    domain: domain || '',
    adNetbiosDomain: '',
    baseDn: baseDn || '',
    bindDn: bindDn || '',
    bindPassword: '',
    userSearchFilter: '(&(objectCategory=person)(sAMAccountName={username}))',
    useTls,
    timeoutMs: 5000,
    syncIntervalHours: 12,
    defaultRole: 'operator',
  };

  return testLdapDirectory(config);
}
