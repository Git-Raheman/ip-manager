import { IPRecord, Subnet } from '../types';

export interface LearnedKnowledge {
  id: string;
  topic: 'port_mapping' | 'service_alias' | 'user_note' | 'device_role' | 'probe_result';
  key: string; // e.g. '80', 'web-prod', 'database', '192.168.10.15'
  value: string; // e.g. 'HTTP Web Server (Nginx/Apache)', 'Primary ERP DB'
  source: 'user_taught' | 'notes_scan' | 'live_probe' | 'system_default';
  confidence: number;
  timestamp: string;
}

const STORAGE_KEY = 'ipam_chatbot_learned_memory';

// Common well-known port mappings for network intelligence
const SYSTEM_PORT_KNOWLEDGE: Array<Omit<LearnedKnowledge, 'id' | 'timestamp'>> = [
  { topic: 'port_mapping', key: '80', value: 'HTTP Web Server (World Wide Web, Nginx, Apache)', source: 'system_default', confidence: 1.0 },
  { topic: 'port_mapping', key: '443', value: 'HTTPS Secure Web Server (SSL/TLS, Web Applications)', source: 'system_default', confidence: 1.0 },
  { topic: 'port_mapping', key: '22', value: 'SSH Secure Shell (Remote Linux Management, SFTP)', source: 'system_default', confidence: 1.0 },
  { topic: 'port_mapping', key: '53', value: 'DNS Domain Name System (Name resolution servers)', source: 'system_default', confidence: 1.0 },
  { topic: 'port_mapping', key: '25', value: 'SMTP Mail Transfer Agent (Email delivery)', source: 'system_default', confidence: 1.0 },
  { topic: 'port_mapping', key: '389', value: 'LDAP Active Directory Directory Services', source: 'system_default', confidence: 1.0 },
  { topic: 'port_mapping', key: '636', value: 'LDAPS Secure Active Directory LDAP over SSL', source: 'system_default', confidence: 1.0 },
  { topic: 'port_mapping', key: '3306', value: 'MySQL / MariaDB Relational Database Service', source: 'system_default', confidence: 1.0 },
  { topic: 'port_mapping', key: '5432', value: 'PostgreSQL Relational Database Service', source: 'system_default', confidence: 1.0 },
  { topic: 'port_mapping', key: '8080', value: 'HTTP-Alt Web Proxy / Tomcat / Microservice Backend', source: 'system_default', confidence: 1.0 },
  { topic: 'port_mapping', key: '8443', value: 'HTTPS-Alt Secure Admin Management Interface', source: 'system_default', confidence: 1.0 },
  { topic: 'port_mapping', key: '6379', value: 'Redis In-Memory Key-Value Cache / Queue', source: 'system_default', confidence: 1.0 },
  { topic: 'port_mapping', key: '27017', value: 'MongoDB NoSQL Document Database', source: 'system_default', confidence: 1.0 },
  { topic: 'port_mapping', key: '3389', value: 'RDP Microsoft Windows Remote Desktop Protocol', source: 'system_default', confidence: 1.0 },
  { topic: 'port_mapping', key: '161', value: 'SNMP Network Device Monitoring & Telemetry', source: 'system_default', confidence: 1.0 },
  { topic: 'port_mapping', key: '123', value: 'NTP Network Time Protocol Synchronization', source: 'system_default', confidence: 1.0 },
  { topic: 'port_mapping', key: '21', value: 'FTP File Transfer Protocol Control', source: 'system_default', confidence: 1.0 },
  { topic: 'port_mapping', key: '23', value: 'Telnet Legacy Unencrypted Remote Terminal', source: 'system_default', confidence: 1.0 },
];

let inMemoryCache: LearnedKnowledge[] | null = null;

/**
 * Load learned memory from storage or defaults
 */
export function getLearnedKnowledge(): LearnedKnowledge[] {
  if (inMemoryCache && inMemoryCache.length > 0) {
    return inMemoryCache;
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: LearnedKnowledge[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemoryCache = parsed;
          return parsed;
        }
      }
    }
  } catch {
    // Ignore storage issues
  }

  // Initialize with system defaults
  const defaults: LearnedKnowledge[] = SYSTEM_PORT_KNOWLEDGE.map((item, idx) => ({
    ...item,
    id: `sys-${idx}-${Date.now()}`,
    timestamp: new Date().toISOString(),
  }));

  saveLearnedKnowledge(defaults);
  return defaults;
}

/**
 * Persist learned knowledge into localStorage and inMemoryCache
 */
export function saveLearnedKnowledge(items: LearnedKnowledge[]): void {
  inMemoryCache = items;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  } catch {
    // Storage quota or unavailable
  }
}

/**
 * Clear all learned items back to system defaults
 */
export function resetLearnedKnowledge(): void {
  inMemoryCache = null;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
  getLearnedKnowledge();
}

/**
 * Explicitly add a learned fact or alias
 */
export function addLearnedKnowledge(
  item: Omit<LearnedKnowledge, 'id' | 'timestamp'>
): LearnedKnowledge {
  const current = getLearnedKnowledge();
  // Check if existing key with same topic exists
  const existingIdx = current.findIndex(
    (k) => k.topic === item.topic && k.key.toLowerCase() === item.key.toLowerCase()
  );

  const newItem: LearnedKnowledge = {
    ...item,
    id: `learn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    current[existingIdx] = newItem;
  } else {
    current.unshift(newItem);
  }

  saveLearnedKnowledge(current);
  return newItem;
}

/**
 * Remove a specific learned item by key
 */
export function removeLearnedKnowledge(key: string): boolean {
  const current = getLearnedKnowledge();
  const filtered = current.filter((k) => k.key.toLowerCase() !== key.toLowerCase());
  if (filtered.length !== current.length) {
    saveLearnedKnowledge(filtered);
    return true;
  }
  return false;
}

/**
 * Auto-learn by scanning all IP notes, hostnames, and descriptions
 */
export function autoLearnFromDatabase(ips: IPRecord[], subnets: Subnet[]): number {
  const knowledge = getLearnedKnowledge();
  let newLearnedCount = 0;

  for (const ip of ips) {
    if (!ip.notes && !ip.hostname) continue;

    const notesOnly = (ip.notes || '').toLowerCase();
    const hostnameText = (ip.hostname || '').toLowerCase();

    // 1. Scan for all port numbers mentioned in notes (e.g. "port 80", "80, 443", "80/tcp", ":8080", "3306")
    const portMatches = notesOnly.matchAll(/\b(?:port\s*[:=]?\s*|ports\s*[:=]?\s*|:\s*|listening on\s*|runs on\s*|tcp\/|udp\/)?(\d{1,5})\b/gi);
    for (const pMatch of Array.from(portMatches)) {
      const portNum = pMatch[1];
      if (portNum.startsWith('0')) continue; // Skip leading zeros like 01, 02
      const portInt = parseInt(portNum, 10);
      if (
        portInt > 0 &&
        portInt <= 65535 &&
        (notesOnly.includes('port') ||
          [80, 443, 22, 53, 25, 389, 636, 3306, 5432, 8080, 8443, 6379, 27017, 3389, 161, 123, 21, 23, 3000, 5000, 8000, 9000].includes(portInt))
      ) {
        const key = `ip_${ip.ip}_port_${portNum}`;
        const exists = knowledge.some((k) => k.key === key);
        if (!exists) {
          knowledge.push({
            id: `auto-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            topic: 'port_mapping',
            key: key,
            value: `IP ${ip.ip} (${ip.hostname || 'Host'}) configured for Port ${portNum}${ip.notes ? ` (Notes: "${ip.notes}")` : ''}`,
            source: 'notes_scan',
            confidence: 0.9,
            timestamp: new Date().toISOString(),
          });
          newLearnedCount++;
        }
      }
    }

    // 2. Scan for service keywords in notes and hostname
    const combinedText = `${notesOnly} ${hostnameText}`;
    const services = ['nginx', 'apache', 'mysql', 'postgres', 'redis', 'mongodb', 'docker', 'k8s', 'proxy', 'gateway', 'vpn', 'web', 'database', 'db', 'ssh', 'dns', 'ldap', 'firewall', 'router', 'switch'];
    for (const s of services) {
      if (combinedText.includes(s)) {
        const key = `ip_${ip.ip}_service_${s}`;
        const exists = knowledge.some((k) => k.key === key);
        if (!exists) {
          knowledge.push({
            id: `auto-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            topic: 'device_role',
            key: key,
            value: `IP ${ip.ip} provides ${s.toUpperCase()} service (${ip.hostname || 'Host'})`,
            source: 'notes_scan',
            confidence: 0.85,
            timestamp: new Date().toISOString(),
          });
          newLearnedCount++;
        }
      }
    }
  }

  if (newLearnedCount > 0) {
    saveLearnedKnowledge(knowledge);
  }

  return newLearnedCount;
}

/**
 * Auto-learn from a live ping/port probe result
 */
export function autoLearnFromProbe(
  ip: string,
  openPorts?: string[],
  hostname?: string
): void {
  if (!openPorts || openPorts.length === 0) return;

  const knowledge = getLearnedKnowledge();
  for (const portStr of openPorts) {
    const portMatch = portStr.match(/\d+/);
    const portNum = portMatch ? portMatch[0] : portStr;
    const key = `probe_${ip}_port_${portNum}`;

    const existingIdx = knowledge.findIndex((k) => k.key === key);
    const item: LearnedKnowledge = {
      id: `probe-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      topic: 'probe_result',
      key: key,
      value: `Live probe confirmed IP ${ip} has open port ${portStr}${hostname ? ` (Reverse DNS: ${hostname})` : ''}`,
      source: 'live_probe',
      confidence: 1.0,
      timestamp: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      knowledge[existingIdx] = item;
    } else {
      knowledge.unshift(item);
    }
  }

  saveLearnedKnowledge(knowledge);
}

export interface DeepScanResult {
  ip: IPRecord;
  matchReasons: string[];
  relevanceScore: number;
  matchedPorts?: string[];
}

/**
 * Deep search across all database records and notes for specific ports, protocols, or keywords
 */
export function deepSearchDatabase(
  query: string,
  ips: IPRecord[],
  subnets: Subnet[]
): {
  results: DeepScanResult[];
  detectedPorts: string[];
  detectedPort?: string;
  detectedService?: string;
  learnedMatches: LearnedKnowledge[];
} {
  const cleanQuery = query.toLowerCase().trim();
  const knowledge = getLearnedKnowledge();

  const wellKnownPorts = ['80', '443', '22', '53', '25', '389', '636', '3306', '5432', '8080', '8443', '6379', '27017', '3389', '161', '123', '21', '23', '3000', '5000', '8000', '9000'];
  const hasPortKeyword = /\bports?\b/i.test(cleanQuery) || /\b(tcp|udp|listening)\b/i.test(cleanQuery) || /:\d{2,5}\b/.test(cleanQuery);

  const detectedPorts: string[] = [];

  if (hasPortKeyword) {
    const matches = Array.from(cleanQuery.matchAll(/\b(?:port\s*[:=]?\s*|ports\s*[:=]?\s*|:\s*)?(\d{1,5})\b/gi));
    for (const m of matches) {
      const num = parseInt(m[1], 10);
      if (num >= 1 && num <= 65535 && !detectedPorts.includes(m[1])) {
        detectedPorts.push(m[1]);
      }
    }
  } else if (!cleanQuery.includes('.')) {
    // Only detect as port if query does NOT have dots and user mentioned a recognized well-known service port
    const standaloneMatches = Array.from(cleanQuery.matchAll(/\b(\d{2,5})\b/g));
    for (const m of standaloneMatches) {
      if (wellKnownPorts.includes(m[1]) && !detectedPorts.includes(m[1])) {
        detectedPorts.push(m[1]);
      }
    }
  }

  const detectedPort = detectedPorts.length > 0 ? detectedPorts[0] : undefined;

  // 2. Detect common service names (http, https, ssh, mysql, web, database, etc.)
  let detectedService: string | undefined;
  if (cleanQuery.includes('http') || cleanQuery.includes('web') || cleanQuery.includes('nginx') || cleanQuery.includes('apache')) {
    detectedService = 'HTTP / Web Server';
    if (!detectedPorts.includes('80')) detectedPorts.push('80');
    if (!detectedPorts.includes('443')) detectedPorts.push('443');
  } else if (cleanQuery.includes('https') || cleanQuery.includes('ssl') || cleanQuery.includes('tls')) {
    detectedService = 'HTTPS / Secure Web';
    if (!detectedPorts.includes('443')) detectedPorts.push('443');
  } else if (cleanQuery.includes('ssh') || cleanQuery.includes('sftp') || cleanQuery.includes('terminal')) {
    detectedService = 'SSH Remote Shell';
    if (!detectedPorts.includes('22')) detectedPorts.push('22');
  } else if (cleanQuery.includes('mysql') || cleanQuery.includes('mariadb')) {
    detectedService = 'MySQL Database';
    if (!detectedPorts.includes('3306')) detectedPorts.push('3306');
  } else if (cleanQuery.includes('postgres') || cleanQuery.includes('psql')) {
    detectedService = 'PostgreSQL Database';
    if (!detectedPorts.includes('5432')) detectedPorts.push('5432');
  } else if (cleanQuery.includes('database') || cleanQuery.includes('db')) {
    detectedService = 'Database Service';
    if (!detectedPorts.includes('3306')) detectedPorts.push('3306');
    if (!detectedPorts.includes('5432')) detectedPorts.push('5432');
  } else if (cleanQuery.includes('dns')) {
    detectedService = 'DNS Name Server';
    if (!detectedPorts.includes('53')) detectedPorts.push('53');
  } else if (cleanQuery.includes('ldap') || cleanQuery.includes('ad') || cleanQuery.includes('active directory')) {
    detectedService = 'Active Directory / LDAP';
    if (!detectedPorts.includes('389')) detectedPorts.push('389');
    if (!detectedPorts.includes('636')) detectedPorts.push('636');
  } else if (cleanQuery.includes('redis')) {
    detectedService = 'Redis Cache';
    if (!detectedPorts.includes('6379')) detectedPorts.push('6379');
  } else if (cleanQuery.includes('mongo') || cleanQuery.includes('mongodb')) {
    detectedService = 'MongoDB NoSQL';
    if (!detectedPorts.includes('27017')) detectedPorts.push('27017');
  }

  // 3. Find learned knowledge matches
  const learnedMatches = knowledge.filter((k) => {
    if (detectedPorts.some((p) => k.key.includes(p) || k.value.includes(p))) return true;
    if (cleanQuery.length >= 3 && (k.key.toLowerCase().includes(cleanQuery) || k.value.toLowerCase().includes(cleanQuery))) return true;
    return false;
  });

  // 4. Tokenize search terms for multi-field scoring
  const stopWords = new Set([
    'used', 'use', 'uses', 'with', 'has', 'in', 'on', 'for', 'the', 'a', 'an',
    'all', 'any', 'that', 'see', 'like', 'notes', 'note', 'and', 'or', 'to',
    'of', 'at', 'from', 'is', 'are', 'ip', 'ips', 'port', 'ports', 'which',
    'who', 'what', 'where', 'how', 'show', 'list', 'print', 'find', 'search'
  ]);

  const searchTokens = cleanQuery
    .replace(/^(find|search|show|get|list|look up|where is|which ip|ips|print ip list that see in notes like|print|scan notes for|scan notes|search notes for|search notes)\s+/i, '')
    .split(/[\s,]+/)
    .filter((t) => t.length > 1 && !stopWords.has(t) && !detectedPorts.includes(t));

  const results: DeepScanResult[] = [];

  for (const ip of ips) {
    const parentSubnet = subnets.find((s) => s.id === ip.subnetId);
    const matchReasons: string[] = [];
    const matchedPortsSet = new Set<string>();
    let score = 0;

    const notesRaw = ip.notes || '';
    const notesLower = notesRaw.toLowerCase();
    const hostRaw = ip.hostname || '';
    const hostLower = hostRaw.toLowerCase();
    const ownerLower = (ip.owner || '').toLowerCase();
    const deptLower = (ip.department || '').toLowerCase();
    const typeLower = (ip.deviceType || '').toLowerCase();
    const subNameLower = (parentSubnet?.name || '').toLowerCase();
    const subDescLower = (parentSubnet?.description || '').toLowerCase();

    // Check Port Matching specifically across notes and hostnames
    if (detectedPorts.length > 0) {
      for (const p of detectedPorts) {
        // Match word boundaries or prefixes: "port 80", "80/tcp", ":80", "80, 443", "\b80\b"
        const portRegex = new RegExp(`(?:port\\s*[:=]?\\s*|ports\\s*[:=]?\\s*|:\\s*|/\\s*|\\b)${p}(?:/|\\b|,|\\s|$)`, 'i');
        if (portRegex.test(notesLower) || new RegExp(`\\b${p}\\b`).test(notesLower)) {
          matchReasons.push(`Found Port \`${p}\` in Notes: "*${notesRaw}*"`);
          matchedPortsSet.add(p);
          score += 60;
        }
        if (portRegex.test(hostLower) || new RegExp(`\\b${p}\\b`).test(hostLower)) {
          matchReasons.push(`Found Port \`${p}\` in Hostname: \`${hostRaw}\``);
          matchedPortsSet.add(p);
          score += 45;
        }
        // Check learned memory for this IP
        const memMatch = learnedMatches.find((m) => m.key.includes(ip.ip) && m.key.includes(p));
        if (memMatch) {
          matchReasons.push(`Learned Memory: ${memMatch.value}`);
          matchedPortsSet.add(p);
          score += 50;
        }
      }
    }

    // Check Token Matches across all fields
    for (const token of searchTokens) {
      if (token === 'port' || token === 'ports' || detectedPorts.includes(token)) continue;

      if (notesLower.includes(token)) {
        matchReasons.push(`Found token \`${token}\` in Notes: "*${notesRaw}*"`);
        score += 25;
      }
      if (hostLower.includes(token)) {
        matchReasons.push(`Found token \`${token}\` in Hostname: \`${hostRaw}\``);
        score += 30;
      }
      if (typeLower.includes(token)) {
        matchReasons.push(`Device Type matches \`${token}\``);
        score += 20;
      }
      if (ownerLower.includes(token)) {
        matchReasons.push(`Owner matches \`${token}\`: ${ip.owner}`);
        score += 15;
      }
      if (deptLower.includes(token)) {
        matchReasons.push(`Department matches \`${token}\`: ${ip.department}`);
        score += 10;
      }
      if (subNameLower.includes(token) || subDescLower.includes(token)) {
        matchReasons.push(`Subnet matches \`${token}\`: ${parentSubnet?.name}`);
        score += 10;
      }
      if (ip.ip.includes(token)) {
        matchReasons.push(`IP Address matches \`${token}\``);
        score += 35;
      }
      if (ip.macAddress && ip.macAddress.toLowerCase().includes(token)) {
        matchReasons.push(`MAC Address matches \`${token}\``);
        score += 25;
      }
    }

    if (score > 0) {
      results.push({
        ip,
        matchReasons: Array.from(new Set(matchReasons)),
        matchedPorts: Array.from(matchedPortsSet),
        relevanceScore: score,
      });
    }
  }

  // Sort descending by relevance score
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return {
    results,
    detectedPorts,
    detectedPort,
    detectedService,
    learnedMatches,
  };
}
