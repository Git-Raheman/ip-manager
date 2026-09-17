import {
  IPRecord,
  Subnet,
  User,
  GranularPermissions,
  DeviceClassification,
  AuditLog,
  UserRole,
} from '../types';
import { parseCIDR, isIpInSubnet, isValidIPv4, ipToLong, longToIp } from './ipUtils';
import {
  getLearnedKnowledge,
  addLearnedKnowledge,
  removeLearnedKnowledge,
  resetLearnedKnowledge,
  autoLearnFromDatabase,
  autoLearnFromProbe,
  deepSearchDatabase,
  LearnedKnowledge,
} from './chatbotMemory';
import { detectFuzzyIntent, normalizeAndCorrectTypos, FuzzyMatchResult } from './fuzzyMatcher';

export type WizardType =
  | 'create_subnet'
  | 'delete_subnet'
  | 'create_user'
  | 'delete_user'
  | 'create_classification';

export interface WizardState {
  type: WizardType;
  step: string;
  data: Record<string, any>;
}

export interface ChatbotContext {
  subnets: Subnet[];
  ips: IPRecord[];
  users?: User[];
  currentUser: User | null;
  hasPermission: (key: keyof GranularPermissions) => boolean;
  allocateIP: (data: Omit<IPRecord, 'id'>) => Promise<{ success: boolean; message: string; ip?: IPRecord }>;
  updateIP: (id: string, updates: Partial<IPRecord>) => void;
  releaseIP: (id: string) => void;
  pingIP: (idOrIp: string) => Promise<{
    success?: boolean;
    online: boolean;
    status: 'online' | 'offline' | 'unreachable';
    latencyMs?: number;
    openPorts?: string[];
    hostname?: string;
    macAddress?: string;
    deviceType?: string;
  }>;
  createSubnet?: (subnetData: { name: string; cidr: string; vlanId?: number; location: string; description: string; tags?: string[] }) => { success: boolean; message: string; subnet?: Subnet };
  updateSubnet?: (id: string, updates: Partial<Subnet>) => { success: boolean; message: string };
  deleteSubnet?: (id: string) => { success: boolean; message: string };
  createUser?: (userData: Omit<User, 'id' | 'createdAt'>) => { success: boolean; message: string; user?: User };
  updateUser?: (id: string, updates: Partial<User>) => { success: boolean; message: string };
  deleteUser?: (id: string) => { success: boolean; message: string };
  changePassword?: (userId: string, newPassword: string, oldPassword?: string) => { success: boolean; message: string };
  deviceClassifications: DeviceClassification[];
  createDeviceClassification?: (data: Omit<DeviceClassification, 'id' | 'createdAt' | 'updatedAt'>) => { success: boolean; message: string; classification?: DeviceClassification };
  updateDeviceClassification?: (id: string, updates: Partial<DeviceClassification>) => { success: boolean; message: string };
  deleteDeviceClassification?: (id: string) => { success: boolean; message: string };
  auditLogs: AuditLog[];
  setSelectedSubnetId: (id: string | null) => void;
  setActiveTab: (tab: any) => void;
  wizardState?: WizardState | null;
  setWizardState?: (state: WizardState | null) => void;
}

export interface ChatAction {
  label?: string;
  actionType: 'allocate' | 'ping' | 'view_subnet' | 'release' | 'navigate_tab' | 'quick_prompt';
  payload?: any;
  variant?: 'primary' | 'danger' | 'secondary' | 'outline';
}

export interface BotResponse {
  id: string;
  sender: 'bot';
  timestamp: string;
  text: string;
  ipCards?: IPRecord[];
  subnetCards?: Array<Subnet & { allocatedCount: number; availableCount: number; utilizationPercent: number }>;
  actions?: ChatAction[];
  suggestions?: string[];
  isSecurityAlert?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  timestamp: string;
  text: string;
  ipCards?: IPRecord[];
  subnetCards?: Array<Subnet & { allocatedCount: number; availableCount: number; utilizationPercent: number }>;
  actions?: ChatAction[];
  suggestions?: string[];
  isSecurityAlert?: boolean;
}

/**
 * Filter subnets and IPs based on currentUser granular scope
 */
export function getAccessibleSubnets(subnets: Subnet[], currentUser: User | null): Subnet[] {
  if (!currentUser) return [];
  const allowed = currentUser.permissions?.allowedSubnetIds || [];
  if (allowed.length === 0) return subnets;
  return subnets.filter((s) => allowed.includes(s.id));
}

export function getAccessibleIPs(ips: IPRecord[], subnets: Subnet[], currentUser: User | null): IPRecord[] {
  const allowedSubnets = getAccessibleSubnets(subnets, currentUser);
  const allowedIds = new Set(allowedSubnets.map((s) => s.id));
  return ips.filter((ip) => allowedIds.has(ip.subnetId));
}

/**
 * Find next available IP address in a subnet
 */
export function findNextAvailableIp(subnet: Subnet, existingIps: IPRecord[]): string | null {
  const cidrInfo = parseCIDR(subnet.cidr);
  if (!cidrInfo) return null;

  const allocatedSet = new Set(
    existingIps
      .filter((rec) => rec.subnetId === subnet.id && rec.status !== 'available')
      .map((rec) => rec.ip)
  );

  const startLong = ipToLong(cidrInfo.firstUsableIp);
  const endLong = ipToLong(cidrInfo.lastUsableIp);

  for (let current = startLong; current <= endLong; current++) {
    const candidateIp = longToIp(current);
    if (!allocatedSet.has(candidateIp)) {
      return candidateIp;
    }
  }

  return null;
}

/**
 * Interactive Command Center & Menu Hub Generators
 */
export function getMainMenuResponse(now: string, ctx: ChatbotContext, messageId: string): BotResponse {
  const allowedSubnets = getAccessibleSubnets(ctx.subnets, ctx.currentUser);
  const userRole = ctx.currentUser?.role?.replace('_', ' ').toUpperCase() || 'USER';

  const isSuperAdmin = ctx.currentUser?.role === 'super_admin';
  const canSeeUsers = Boolean(isSuperAdmin || ctx.hasPermission('manageUsers'));
  const canSeeDeviceTypes = Boolean(
    isSuperAdmin ||
      (ctx.hasPermission('manageDeviceClassifications') && ctx.currentUser?.role !== 'auditor') ||
      (ctx.currentUser?.role === 'network_admin' && ctx.currentUser?.permissions?.manageDeviceClassifications !== false)
  );

  const actions: ChatAction[] = [
    { label: '🔍 Find / Search IP', actionType: 'quick_prompt', payload: 'find ip', variant: 'primary' },
    { label: `🌐 Subnets (${allowedSubnets.length})`, actionType: 'quick_prompt', payload: 'subnets', variant: 'outline' },
  ];

  if (canSeeUsers) {
    actions.push({ label: `👥 Users (${ctx.users?.length || 0})`, actionType: 'quick_prompt', payload: 'users', variant: 'secondary' });
  }

  if (canSeeDeviceTypes) {
    actions.push({ label: `🏷️ Device Types (${ctx.deviceClassifications.length})`, actionType: 'quick_prompt', payload: 'device types', variant: 'secondary' });
  }

  actions.push({ label: '📊 Fleet Overview', actionType: 'quick_prompt', payload: 'subnet utilization summary', variant: 'secondary' });

  const suggestions = ['20.1', 'Subnets'];
  if (canSeeUsers) suggestions.push('Users');
  if (canSeeDeviceTypes) suggestions.push('Device types');
  suggestions.push('Find next available IP', 'Help');

  return {
    id: messageId,
    sender: 'bot',
    timestamp: now,
    text: `🎛️ **IPAM Command Center & Assistant**\n\nWelcome **${ctx.currentUser?.fullName || ctx.currentUser?.username || 'User'}** (${userRole} access).\nSelect an interactive command module below or enter an IP/query directly:`,
    actions,
    suggestions,
  };
}

export function getSubnetsMenuResponse(now: string, ctx: ChatbotContext, messageId: string): BotResponse {
  const allowedSubnets = getAccessibleSubnets(ctx.subnets, ctx.currentUser);
  if (allowedSubnets.length === 0) {
    return {
      id: messageId,
      sender: 'bot',
      timestamp: now,
      text: `🌐 **Subnets Menu**\n\n⚠️ No accessible subnets found for your account.`,
      actions: [
        { label: '🧙 Create Subnet', actionType: 'quick_prompt', payload: 'create subnet', variant: 'primary' },
        { label: '🏠 Main Menu', actionType: 'quick_prompt', payload: 'menu', variant: 'secondary' },
      ],
      suggestions: ['Menu', 'Create Subnet', 'Help'],
    };
  }

  const subnetCards = allowedSubnets.map((sub) => {
    const cidrInfo = parseCIDR(sub.cidr);
    const subIps = ctx.ips.filter((r) => r.subnetId === sub.id && r.status !== 'available');
    const total = cidrInfo?.usableHosts || subIps.length;
    const allocated = subIps.length;
    const available = Math.max(0, total - allocated);
    const util = total > 0 ? Math.round((allocated / total) * 100) : 0;
    return {
      ...sub,
      allocatedCount: allocated,
      availableCount: available,
      utilizationPercent: util,
    };
  });

  const actions: ChatAction[] = allowedSubnets.slice(0, 8).map((sub) => ({
    label: `🌐 ${sub.name} (${sub.cidr})`,
    actionType: 'quick_prompt',
    payload: `subnet overview ${sub.id}`,
    variant: 'outline',
  }));

  if (ctx.hasPermission('createSubnet')) {
    actions.push({ label: '➕ Create Subnet', actionType: 'quick_prompt', payload: 'create subnet', variant: 'primary' });
  }
  actions.push({ label: '🏠 Main Menu', actionType: 'quick_prompt', payload: 'menu', variant: 'secondary' });

  return {
    id: messageId,
    sender: 'bot',
    timestamp: now,
    text: `🌐 **Accessible Subnets (${allowedSubnets.length} Total)**\n\nSelect a subnet below to view utilization, available free IPs, or allocated endpoints:`,
    subnetCards,
    actions,
    suggestions: [
      ...allowedSubnets.slice(0, 3).map((s) => `Subnet overview ${s.name}`),
      'Menu',
      'Create Subnet',
    ],
  };
}

export function getSubnetOverviewResponse(
  subnet: Subnet,
  now: string,
  ctx: ChatbotContext,
  messageId: string
): BotResponse {
  const cidrInfo = parseCIDR(subnet.cidr);
  const subnetIps = ctx.ips.filter((r) => r.subnetId === subnet.id);
  const allocatedIps = subnetIps.filter((r) => r.status !== 'available');
  const totalUsable = cidrInfo?.usableHosts || subnetIps.length;
  const allocatedCount = allocatedIps.length;
  const availableCount = Math.max(0, totalUsable - allocatedCount);
  const utilPercent = totalUsable > 0 ? Math.round((allocatedCount / totalUsable) * 100) : 0;

  const cardData = [{
    ...subnet,
    allocatedCount,
    availableCount,
    utilizationPercent: utilPercent,
  }];

  const canAllocate = ctx.hasPermission('allocateIP');

  const actions: ChatAction[] = [
    {
      label: `🟢 Show Free / Available IPs (${availableCount})`,
      actionType: 'quick_prompt',
      payload: `free ips in ${subnet.id}`,
      variant: 'primary',
    },
    {
      label: `🔵 Show Allocated IPs (${allocatedCount})`,
      actionType: 'quick_prompt',
      payload: `allocated ips in ${subnet.id}`,
      variant: 'outline',
    },
  ];

  if (canAllocate && availableCount > 0) {
    actions.push({
      label: '⚡ Allocate Next Free IP',
      actionType: 'quick_prompt',
      payload: `allocate next available ip in ${subnet.id}`,
      variant: 'secondary',
    });
  }

  actions.push({
    label: '📊 Open in Subnets Table',
    actionType: 'view_subnet',
    payload: { subnetId: subnet.id },
    variant: 'secondary',
  });

  actions.push({
    label: '🔙 Back to Subnets List',
    actionType: 'quick_prompt',
    payload: 'subnets',
    variant: 'secondary',
  });

  actions.push({
    label: '🏠 Main Menu',
    actionType: 'quick_prompt',
    payload: 'menu',
    variant: 'secondary',
  });

  return {
    id: messageId,
    sender: 'bot',
    timestamp: now,
    text: `📊 **Subnet Overview: ${subnet.name}**\n\n` +
      `- **CIDR Network**: \`${subnet.cidr}\`\n` +
      `- **Gateway IP**: \`${subnet.gateway || 'N/A'}\`\n` +
      `- **VLAN ID**: \`${subnet.vlanId !== undefined ? subnet.vlanId : 'N/A'}\`\n` +
      `- **Location**: ${subnet.location || 'Primary DC'}\n` +
      `- **Capacity / Usable Hosts**: **${totalUsable}**\n` +
      `- **Allocated Endpoints**: **${allocatedCount}**\n` +
      `- **Available / Free IPs**: **${availableCount}**\n` +
      `- **Subnet Utilization**: **${utilPercent}%**\n\n` +
      `Choose an action below to explore or manage this subnet:`,
    subnetCards: cardData,
    actions,
    suggestions: [
      `Free IPs in ${subnet.name}`,
      `Allocated IPs in ${subnet.name}`,
      `Allocate next available IP in ${subnet.name}`,
      'Subnets',
      'Menu',
    ],
  };
}

export function getSubnetFreeIpsResponse(
  subnet: Subnet,
  now: string,
  ctx: ChatbotContext,
  messageId: string
): BotResponse {
  const cidrInfo = parseCIDR(subnet.cidr);
  const allocatedSet = new Set(
    ctx.ips.filter((r) => r.subnetId === subnet.id && r.status !== 'available').map((r) => r.ip)
  );

  const freeIps: string[] = [];
  if (cidrInfo) {
    const startLong = ipToLong(cidrInfo.firstUsableIp);
    const endLong = ipToLong(cidrInfo.lastUsableIp);
    for (let current = startLong; current <= endLong; current++) {
      const candidate = longToIp(current);
      if (!allocatedSet.has(candidate)) {
        freeIps.push(candidate);
        if (freeIps.length >= 15) break;
      }
    }
  }

  if (freeIps.length === 0) {
    return {
      id: messageId,
      sender: 'bot',
      timestamp: now,
      text: `⚠️ **No Available / Free IPs** in Subnet **${subnet.name}** (\`${subnet.cidr}\`). All usable hosts are allocated.`,
      actions: [
        { label: `🔵 Show Allocated IPs`, actionType: 'quick_prompt', payload: `allocated ips in ${subnet.id}`, variant: 'primary' },
        { label: `🔙 Subnet Overview`, actionType: 'quick_prompt', payload: `subnet overview ${subnet.id}`, variant: 'secondary' },
        { label: `🌐 Subnets List`, actionType: 'quick_prompt', payload: 'subnets', variant: 'secondary' },
      ],
    };
  }

  const canAllocate = ctx.hasPermission('allocateIP');
  const actions: ChatAction[] = [];

  if (canAllocate && freeIps.length > 0) {
    actions.push({
      label: `⚡ Allocate ${freeIps[0]}`,
      actionType: 'quick_prompt',
      payload: `allocate ${freeIps[0]} in ${subnet.id}`,
      variant: 'primary',
    });
    if (freeIps.length > 1) {
      actions.push({
        label: `⚡ Allocate ${freeIps[1]}`,
        actionType: 'quick_prompt',
        payload: `allocate ${freeIps[1]} in ${subnet.id}`,
        variant: 'outline',
      });
    }
  }

  actions.push({
    label: `📡 Ping ${freeIps[0]}`,
    actionType: 'ping',
    payload: { ip: freeIps[0] },
    variant: 'secondary',
  });

  actions.push({
    label: `🔵 Show Allocated IPs`,
    actionType: 'quick_prompt',
    payload: `allocated ips in ${subnet.id}`,
    variant: 'secondary',
  });

  actions.push({
    label: `🔙 Subnet Overview`,
    actionType: 'quick_prompt',
    payload: `subnet overview ${subnet.id}`,
    variant: 'secondary',
  });

  actions.push({
    label: `🌐 Subnets List`,
    actionType: 'quick_prompt',
    payload: 'subnets',
    variant: 'secondary',
  });

  const ipListStr = freeIps.map((ip) => `• \`${ip}\``).join('    ');

  return {
    id: messageId,
    sender: 'bot',
    timestamp: now,
    text: `🟢 **Available / Free IPs in ${subnet.name} (\`${subnet.cidr}\`):**\n\n` +
      `Here are the next unassigned available addresses:\n\n` +
      `${ipListStr}\n\n` +
      `Click an action below to allocate or ping, or return to subnet overview:`,
    actions,
    suggestions: [
      `Allocate ${freeIps[0]} in ${subnet.name}`,
      `Ping ${freeIps[0]}`,
      `Subnet overview ${subnet.name}`,
      'Subnets',
      'Menu',
    ],
  };
}

export function getSubnetAllocatedIpsResponse(
  subnet: Subnet,
  now: string,
  ctx: ChatbotContext,
  messageId: string
): BotResponse {
  const allocated = ctx.ips.filter((r) => r.subnetId === subnet.id && r.status !== 'available');

  if (allocated.length === 0) {
    return {
      id: messageId,
      sender: 'bot',
      timestamp: now,
      text: `ℹ️ **No Allocated IPs** in Subnet **${subnet.name}** (\`${subnet.cidr}\`). All addresses are currently free.`,
      actions: [
        { label: `🟢 Show Free IPs`, actionType: 'quick_prompt', payload: `free ips in ${subnet.id}`, variant: 'primary' },
        { label: `🔙 Subnet Overview`, actionType: 'quick_prompt', payload: `subnet overview ${subnet.id}`, variant: 'secondary' },
        { label: `🌐 Subnets List`, actionType: 'quick_prompt', payload: 'subnets', variant: 'secondary' },
      ],
    };
  }

  const summaries = allocated.slice(0, 8).map((r) => {
    return `• \`${r.ip}\` — **${r.hostname || 'No Hostname'}** (${r.deviceType || 'Device'}, Owner: *${r.owner || 'Unassigned'}*) [${r.status.toUpperCase()}]`;
  });

  const actions: ChatAction[] = [];

  // Provide interactive buttons for top allocated IPs
  allocated.slice(0, 3).forEach((r) => {
    actions.push({
      label: `🔍 ${r.ip} (${r.hostname || 'Host'})`,
      actionType: 'quick_prompt',
      payload: `find ${r.ip}`,
      variant: 'outline',
    });
  });

  actions.push({
    label: `🟢 Show Free IPs`,
    actionType: 'quick_prompt',
    payload: `free ips in ${subnet.id}`,
    variant: 'secondary',
  });

  actions.push({
    label: `🔙 Subnet Overview`,
    actionType: 'quick_prompt',
    payload: `subnet overview ${subnet.id}`,
    variant: 'secondary',
  });

  actions.push({
    label: `🌐 Subnets List`,
    actionType: 'quick_prompt',
    payload: 'subnets',
    variant: 'secondary',
  });

  return {
    id: messageId,
    sender: 'bot',
    timestamp: now,
    text: `🔵 **Allocated IPs in ${subnet.name} (\`${subnet.cidr}\`) — ${allocated.length} Total:**\n\n` +
      `${summaries.join('\n')}\n\n` +
      `Click an IP card below to ping or view details:`,
    ipCards: allocated.slice(0, 6),
    actions,
    suggestions: [
      `Free IPs in ${subnet.name}`,
      `Subnet overview ${subnet.name}`,
      'Subnets',
      'Menu',
    ],
  };
}

export function getFindIpMenuResponse(now: string, messageId: string): BotResponse {
  return {
    id: messageId,
    sender: 'bot',
    timestamp: now,
    text: `🔍 **Find & Search IP / Hostname / Notes**\n\n` +
      `Type an exact IP address, partial IP (e.g. \`20.1\`, \`.25\`), hostname, MAC, or keyword in notes.\n\n` +
      `*Or try one of the fast search shortcuts below:*`,
    actions: [
      { label: '🔍 Match 20.1', actionType: 'quick_prompt', payload: '20.1', variant: 'primary' },
      { label: '🔍 Match 10.1', actionType: 'quick_prompt', payload: '10.1', variant: 'outline' },
      { label: '🔍 Hosts with "server"', actionType: 'quick_prompt', payload: 'find server', variant: 'secondary' },
      { label: '🔍 Port 80 Hosts', actionType: 'quick_prompt', payload: 'find ips used port 80', variant: 'secondary' },
      { label: '🏠 Main Menu', actionType: 'quick_prompt', payload: 'menu', variant: 'secondary' },
    ],
    suggestions: [
      '20.1',
      'find 10.1',
      'find ips used port 80',
      'Menu',
    ],
  };
}

export function getUsersMenuResponse(now: string, ctx: ChatbotContext, messageId: string): BotResponse {
  const isSuperAdmin = ctx.currentUser?.role === 'super_admin';
  const canManageUsers = isSuperAdmin || ctx.hasPermission('manageUsers');

  if (!canManageUsers) {
    return {
      id: messageId,
      sender: 'bot',
      timestamp: now,
      text: `⛔ **Access Denied**: Your account (@${ctx.currentUser?.username || 'user'}) with role **${(ctx.currentUser?.role || 'USER').toUpperCase()}** does not have permission to view or manage user accounts.`,
      isSecurityAlert: true,
      actions: [
        { label: '🔍 Find IP', actionType: 'quick_prompt', payload: 'find ip', variant: 'primary' },
        { label: '🏠 Main Menu', actionType: 'quick_prompt', payload: 'menu', variant: 'secondary' },
      ],
      suggestions: ['Menu', 'Find IP', 'Subnets', 'Help'],
    };
  }

  const users = ctx.users || [];
  const summaries = users.map((u) => `• \`@${u.username}\` (**${u.fullName}**) — Role: \`${u.role.toUpperCase()}\`, Status: ${u.status}`);

  const actions: ChatAction[] = [];
  if (isSuperAdmin || ctx.hasPermission('manageUsers')) {
    actions.push({ label: '➕ Create User', actionType: 'quick_prompt', payload: 'create user', variant: 'primary' });
    actions.push({ label: '🗑️ Delete User', actionType: 'quick_prompt', payload: 'delete user', variant: 'danger' });
  }
  actions.push({ label: '📋 Open Users View', actionType: 'navigate_tab', payload: { tab: 'users' }, variant: 'outline' });
  actions.push({ label: '🏠 Main Menu', actionType: 'quick_prompt', payload: 'menu', variant: 'secondary' });

  return {
    id: messageId,
    sender: 'bot',
    timestamp: now,
    text: `👥 **User Accounts Management (${users.length} Users):**\n\n${summaries.join('\n')}\n\nSelect an action:`,
    actions,
    suggestions: [
      'Create user',
      'Delete user',
      'Menu',
    ],
  };
}

export function getDeviceTypesMenuResponse(now: string, ctx: ChatbotContext, messageId: string): BotResponse {
  const isSuperAdmin = ctx.currentUser?.role === 'super_admin';
  const canSeeDeviceTypes = Boolean(
    isSuperAdmin ||
      (ctx.hasPermission('manageDeviceClassifications') && ctx.currentUser?.role !== 'auditor') ||
      (ctx.currentUser?.role === 'network_admin' && ctx.currentUser?.permissions?.manageDeviceClassifications !== false)
  );

  if (!canSeeDeviceTypes) {
    return {
      id: messageId,
      sender: 'bot',
      timestamp: now,
      text: `⛔ **Access Denied**: Your account (@${ctx.currentUser?.username || 'user'}) with role **${(ctx.currentUser?.role || 'USER').toUpperCase()}** does not have permission to view or manage device types and classifications.`,
      isSecurityAlert: true,
      actions: [
        { label: '🔍 Find IP', actionType: 'quick_prompt', payload: 'find ip', variant: 'primary' },
        { label: '🏠 Main Menu', actionType: 'quick_prompt', payload: 'menu', variant: 'secondary' },
      ],
      suggestions: ['Menu', 'Find IP', 'Subnets', 'Help'],
    };
  }

  const types = ctx.deviceClassifications;
  const summaries = types.map((d) => {
    const count = ctx.ips.filter((ip) => ip.deviceType?.toLowerCase() === d.code.toLowerCase() || ip.deviceType?.toLowerCase() === d.name.toLowerCase()).length;
    return `• **${d.name}** (\`${d.code}\`) — ${count} IPs assigned (Default Ports: \`${d.defaultPorts || 'None'}\`)`;
  });

  const actions: ChatAction[] = [
    { label: '➕ Add Classification', actionType: 'quick_prompt', payload: 'create classification', variant: 'primary' },
    { label: '📋 Open Device Types View', actionType: 'navigate_tab', payload: { tab: 'device_classifications' }, variant: 'outline' },
    { label: '🏠 Main Menu', actionType: 'quick_prompt', payload: 'menu', variant: 'secondary' },
  ];

  return {
    id: messageId,
    sender: 'bot',
    timestamp: now,
    text: `🏷️ **Device Classifications (${types.length} Types):**\n\n${summaries.join('\n')}\n\nSelect an action:`,
    actions,
    suggestions: [
      'Create classification',
      'Menu',
    ],
  };
}

/**
 * Main Natural Language Intent Processor with Fuzzy Spell Tolerance & RBAC
 */
export async function processChatCommand(
  input: string,
  ctx: ChatbotContext
): Promise<BotResponse> {
  const trimmed = input.trim();
  const { normalized, hasCorrections, correctedWords } = normalizeAndCorrectTypos(trimmed);
  const lower = normalized.toLowerCase();
  const fuzzy = detectFuzzyIntent(trimmed);

  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const messageId = `msg-${Date.now()}`;

  const allowedSubnets = getAccessibleSubnets(ctx.subnets, ctx.currentUser);
  const allowedIPs = getAccessibleIPs(ctx.ips, ctx.subnets, ctx.currentUser);

  // Auto-learn from current database
  autoLearnFromDatabase(allowedIPs, ctx.subnets);

  // Extract explicit IP if present
  const ipMatch = trimmed.match(/\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/);
  const extractedIp = ipMatch ? ipMatch[0] : null;

  // Extract explicit CIDR if present
  const cidrMatch = trimmed.match(/\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\/(?:3[0-2]|[12]?\d)\b/);
  const extractedCidr = cidrMatch ? cidrMatch[0] : null;

  // Check mentioned subnet scope
  let requestedSubnet: Subnet | undefined;
  if (extractedCidr) {
    requestedSubnet = ctx.subnets.find((s) => s.cidr.toLowerCase() === extractedCidr.toLowerCase());
  } else {
    requestedSubnet = ctx.subnets.find((s) =>
      lower.includes(s.name.toLowerCase()) || lower.includes(s.cidr.toLowerCase())
    );
  }

  if (requestedSubnet && !allowedSubnets.some((s) => s.id === requestedSubnet!.id)) {
    return {
      id: messageId,
      sender: 'bot',
      timestamp: now,
      text: `⛔ **Access Denied**: You do not have permission to view or manage IPs in Subnet **${requestedSubnet.name}** (\`${requestedSubnet.cidr}\`). Your account is restricted to assigned subnets only.`,
      isSecurityAlert: true,
      suggestions: ['List all allocated IPs', 'Subnet utilization summary'],
    };
  }

  const targetSubnet = requestedSubnet;

  // =========================================================================
  // 0. CANCEL / ABORT CURRENT OPERATION
  // =========================================================================
  if (fuzzy.intent === 'CANCEL') {
    if (ctx.setWizardState) ctx.setWizardState(null);
    return {
      id: messageId,
      sender: 'bot',
      timestamp: now,
      text: `🚫 **Operation Cancelled.**\n\nWhat else can I help you with?`,
      suggestions: [
        'Help',
        'Create Subnet',
        'Create User',
        'Delete Subnet',
        'Delete User',
        'Add Device Classification',
        'Find 10.10',
        'Subnet utilization summary',
      ],
    };
  }

  // =========================================================================
  // 0.1 CLEAR CHAT HISTORY
  // =========================================================================
  if (fuzzy.intent === 'CLEAR_CHAT') {
    if (ctx.setWizardState) ctx.setWizardState(null);
    return {
      id: messageId,
      sender: 'bot',
      timestamp: now,
      text: `🧹 **Chat History Cleared.**\n\nAll previous conversation messages have been cleared. How can I assist you now?`,
      suggestions: [
        'Help',
        'Create Subnet',
        'Create User',
        'Find 10.10',
        'Subnet utilization summary',
      ],
    };
  }

  // =========================================================================
  // 0.2 START NEW CONVERSATION
  // =========================================================================
  if (fuzzy.intent === 'NEW_CHAT') {
    if (ctx.setWizardState) ctx.setWizardState(null);
    return {
      id: messageId,
      sender: 'bot',
      timestamp: now,
      text: `👋 **Fresh Conversation Started!**\n\nI am your **IPAM Assistant**. Ready to execute operations with your **${ctx.currentUser?.role?.replace('_', ' ').toUpperCase() || 'USER'}** permissions.\n\nType \`help\` anytime to view the complete list of commands and examples.`,
      suggestions: [
        'Help',
        'Create Subnet',
        'Find next available IP',
        'Find ips used port 80',
        'Subnet utilization summary',
      ],
    };
  }

  // =========================================================================
  // 0.25 INTERACTIVE COMMAND MENU & FORM-BASED CMD DISPATCHER
  // =========================================================================
  if (
    lower === 'menu' ||
    lower === 'main menu' ||
    lower === 'start' ||
    lower === 'options' ||
    lower === 'home' ||
    lower === 'cmd' ||
    lower === 'commands' ||
    lower === 'help menu' ||
    lower === 'categories'
  ) {
    if (ctx.setWizardState) ctx.setWizardState(null);
    return getMainMenuResponse(now, ctx, messageId);
  }

  // Find IP Menu Prompt
  if (lower === 'find ip' || lower === 'search ip' || lower === 'lookup ip') {
    return getFindIpMenuResponse(now, messageId);
  }

  // Subnets Menu
  if (
    lower === 'subnets' ||
    lower === 'subnet' ||
    lower === 'list subnets' ||
    lower === 'show subnets' ||
    lower === 'available subnets' ||
    lower === 'print subnets' ||
    lower === 'subnets list'
  ) {
    return getSubnetsMenuResponse(now, ctx, messageId);
  }

  // Subnet Overview: `subnet overview <id|name|cidr>`
  if (
    lower.startsWith('subnet overview') ||
    lower.startsWith('overview of subnet') ||
    lower.startsWith('view subnet overview') ||
    lower.startsWith('inspect subnet')
  ) {
    const rawTarget = trimmed
      .replace(/^(?:subnet overview|overview of subnet|view subnet overview|inspect subnet)\s*/i, '')
      .trim();
    let target = ctx.subnets.find(
      (s) =>
        s.id.toLowerCase() === rawTarget.toLowerCase() ||
        s.cidr.toLowerCase() === rawTarget.toLowerCase() ||
        s.name.toLowerCase() === rawTarget.toLowerCase() ||
        (rawTarget && (s.name.toLowerCase().includes(rawTarget.toLowerCase()) || s.cidr.toLowerCase().includes(rawTarget.toLowerCase())))
    );
    if (!target) target = targetSubnet || allowedSubnets[0];
    if (target) {
      if (!allowedSubnets.some((s) => s.id === target!.id)) {
        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: `⛔ **Access Denied**: You do not have permission to view Subnet **${target.name}** (\`${target.cidr}\`).`,
          isSecurityAlert: true,
        };
      }
      return getSubnetOverviewResponse(target, now, ctx, messageId);
    }
  }

  // Subnet Free / Available IPs: `free ips in <id|name|cidr>`
  if (
    lower.startsWith('free ips in') ||
    lower.startsWith('available ips in') ||
    lower.startsWith('show free ips') ||
    lower.startsWith('free ips of') ||
    lower.startsWith('print free ips') ||
    lower.startsWith('available ips of') ||
    lower.startsWith('free ip in')
  ) {
    const rawTarget = trimmed
      .replace(/^(?:free ips in|available ips in|show free ips in|show free ips|free ips of|print free ips in|print free ips|available ips of|free ip in)\s*/i, '')
      .trim();
    let target = ctx.subnets.find(
      (s) =>
        s.id.toLowerCase() === rawTarget.toLowerCase() ||
        s.cidr.toLowerCase() === rawTarget.toLowerCase() ||
        s.name.toLowerCase() === rawTarget.toLowerCase() ||
        (rawTarget && (s.name.toLowerCase().includes(rawTarget.toLowerCase()) || s.cidr.toLowerCase().includes(rawTarget.toLowerCase())))
    );
    if (!target) target = targetSubnet || allowedSubnets[0];
    if (target) {
      if (!allowedSubnets.some((s) => s.id === target!.id)) {
        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: `⛔ **Access Denied**: You do not have permission to view Subnet **${target.name}** (\`${target.cidr}\`).`,
          isSecurityAlert: true,
        };
      }
      return getSubnetFreeIpsResponse(target, now, ctx, messageId);
    }
  }

  // Subnet Allocated IPs: `allocated ips in <id|name|cidr>`
  if (
    lower.startsWith('allocated ips in') ||
    lower.startsWith('show allocated ips') ||
    lower.startsWith('print allocated ips') ||
    lower.startsWith('allocated ips of') ||
    lower.startsWith('show assigned ips') ||
    lower.startsWith('allocated ip in')
  ) {
    const rawTarget = trimmed
      .replace(/^(?:allocated ips in|show allocated ips in|show allocated ips|print allocated ips in|print allocated ips|allocated ips of|show assigned ips in|show assigned ips|allocated ip in)\s*/i, '')
      .trim();
    let target = ctx.subnets.find(
      (s) =>
        s.id.toLowerCase() === rawTarget.toLowerCase() ||
        s.cidr.toLowerCase() === rawTarget.toLowerCase() ||
        s.name.toLowerCase() === rawTarget.toLowerCase() ||
        (rawTarget && (s.name.toLowerCase().includes(rawTarget.toLowerCase()) || s.cidr.toLowerCase().includes(rawTarget.toLowerCase())))
    );
    if (!target) target = targetSubnet || allowedSubnets[0];
    if (target) {
      if (!allowedSubnets.some((s) => s.id === target!.id)) {
        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: `⛔ **Access Denied**: You do not have permission to view Subnet **${target.name}** (\`${target.cidr}\`).`,
          isSecurityAlert: true,
        };
      }
      return getSubnetAllocatedIpsResponse(target, now, ctx, messageId);
    }
  }

  // Users Menu
  if (lower === 'users' || lower === 'list users' || lower === 'manage users' || lower === 'user menu') {
    return getUsersMenuResponse(now, ctx, messageId);
  }

  // Device Types Menu
  if (
    lower === 'device types' ||
    lower === 'device classifications' ||
    lower === 'classifications' ||
    lower === 'device categories' ||
    lower === 'types'
  ) {
    return getDeviceTypesMenuResponse(now, ctx, messageId);
  }

  // =========================================================================
  // 0.3 COMPREHENSIVE HELP & COMMANDS GUIDE WITH EXAMPLES
  // =========================================================================
  if (fuzzy.intent === 'HELP') {
    if (ctx.setWizardState) ctx.setWizardState(null);
    return {
      id: messageId,
      sender: 'bot',
      timestamp: now,
      text: `📖 **IPAM Assistant — Comprehensive Command & Feature Guide**

Here are all supported commands and capabilities with practical examples:

---

### 🔍 1. Search, Find & Auto-Complete
- \`find 10.10\` or \`10.10\` — *e.g. Find IP ending in .10.10 with full details & live ping*
- \`find .25\` — *e.g. Suffix search for all hosts ending in .25*
- \`find ips used port 80\` — *e.g. Deep scan all database records & notes for port 80*
- \`who has hostname web-01\` — *e.g. Lookup host by name*
- \`find next available IP in HQ-Management\` — *e.g. Get first free IP in subnet*

---

### ⚡ 2. IP Allocation & Management
- \`allocate next available IP in HQ-Management\` — *e.g. Allocate next free IP*
- \`allocate 192.168.10.50 to web-prod-01 description Web Server\` — *e.g. Direct allocation*
- \`update IP 192.168.10.50 hostname to db-cluster\` — *e.g. Update existing IP metadata*
- \`release IP 192.168.10.50\` — *e.g. Deallocate IP and return to available pool*

---

### 🌐 3. Subnet Management & Wizards
- \`create subnet\` — *e.g. Launches 2-step guided interactive creation wizard*
- \`create subnet Office-LAN 10.0.70.0/24 vlan 70 location London\` — *e.g. 1-line creation*
- \`delete subnet\` — *e.g. Interactive list of subnets with safety confirmation*
- \`subnet utilization summary\` — *e.g. Overview of capacity, free IPs & utilization %*

---

### 👤 4. User Management & Security
- \`create user\` — *e.g. Launches 4-step guided user creation wizard*
- \`create user sarah role operator password SecurePass123!\` — *e.g. Direct account creation*
- \`delete user\` — *e.g. Interactive deletion list with root @admin protection*
- \`update password for user sarah to NewPass123!\` — *e.g. Update user password*

---

### 🏷️ 5. Device Classifications
- \`create classification\` — *e.g. Guided 2-step wizard for device category*
- \`add device type Firewall code FW ports 443,8443\` — *e.g. Direct classification creation*
- \`list device classifications\` — *e.g. Show all registered device types*

---

### 📡 6. Live Network Diagnostics & Probing
- \`ping 192.168.10.1\` — *e.g. ICMP/TCP ping, measuring latency, open ports & reverse DNS*
- \`ping 10.10\` — *e.g. Probes matching host from database*

---

### 🧠 7. Automatic Self-Learning & Notes Scanner
- \`find ips used port 80\` or \`list ip that use port 80\` — *e.g. Automatically scan all notes & metadata for port 80*
- \`ports 80, 443\` — *e.g. Multi-port detection and IP listing*
- \`scan notes for DB\` — *e.g. Semantic notes scanning across all subnets*
- \`what have you learned?\` — *e.g. View automatically indexed knowledge & protocols*

---

### 🔄 8. Session & Assistant Controls
- \`new chat\` — *e.g. Resets to a fresh conversation*
- \`clear chat\` — *e.g. Clears previous messages*
- \`cancel\` — *e.g. Aborts any active wizard immediately*`,
      actions: [
        { label: '🧙 Create Subnet', actionType: 'quick_prompt', payload: 'create subnet', variant: 'primary' },
        { label: '👤 Create User', actionType: 'quick_prompt', payload: 'create user', variant: 'outline' },
        { label: '📊 Subnet Summary', actionType: 'quick_prompt', payload: 'subnet utilization summary', variant: 'secondary' },
        { label: '🔍 Find Port 80', actionType: 'quick_prompt', payload: 'find ips used port 80', variant: 'secondary' },
        { label: '📡 Ping 127.0.0.1', actionType: 'quick_prompt', payload: 'ping 127.0.0.1', variant: 'secondary' },
        { label: '🧠 Show Memory', actionType: 'quick_prompt', payload: 'what have you learned?', variant: 'secondary' },
      ],
      suggestions: [
        'Create Subnet',
        'Create User',
        'Find ips used port 80',
        'Find next available IP',
        'Subnet utilization summary',
        'New chat',
      ],
    };
  }

  // =========================================================================
  // ACTIVE MULTI-STEP WIZARD DISPATCHER
  // =========================================================================
  if (ctx.wizardState) {
    const wizard = ctx.wizardState;

    // --- A. CREATE SUBNET WIZARD ---
    if (wizard.type === 'create_subnet') {
      if (wizard.step === 'ask_name') {
        const nameCandidate = trimmed.replace(/^(?:name|named|create|subnet|is)\s+/i, '').trim();
        if (ctx.setWizardState) {
          ctx.setWizardState({
            type: 'create_subnet',
            step: 'ask_cidr',
            data: { ...wizard.data, name: nameCandidate },
          });
        }
        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: `🌐 Got it! The subnet will be named **${nameCandidate}**.\n\nNow, what **IPv4 CIDR block** should I assign to **${nameCandidate}**? *(e.g. \`192.168.10.0/24\` or \`10.0.60.0/24\`)*`,
          actions: [
            { label: 'Use 192.168.20.0/24', actionType: 'quick_prompt', payload: '192.168.20.0/24', variant: 'primary' },
            { label: 'Use 10.0.60.0/24', actionType: 'quick_prompt', payload: '10.0.60.0/24', variant: 'outline' },
            { label: 'Use 172.16.10.0/24', actionType: 'quick_prompt', payload: '172.16.10.0/24', variant: 'secondary' },
            { label: '❌ Cancel Operation', actionType: 'quick_prompt', payload: 'cancel', variant: 'secondary' },
          ],
        };
      }

      if (wizard.step === 'ask_cidr') {
        const cidrCandidate = extractedCidr || trimmed;
        const cidrInfo = parseCIDR(cidrCandidate);
        if (!cidrInfo) {
          return {
            id: messageId,
            sender: 'bot',
            timestamp: now,
            text: `❌ **Invalid CIDR format**: \`${cidrCandidate}\`.\n\nPlease provide a valid IPv4 network CIDR like \`192.168.20.0/24\` or \`10.0.0.0/16\`:`,
            actions: [{ label: '❌ Cancel Operation', actionType: 'quick_prompt', payload: 'cancel' }],
          };
        }

        const existing = ctx.subnets.find((s) => s.cidr.toLowerCase() === cidrCandidate.toLowerCase());
        if (existing) {
          return {
            id: messageId,
            sender: 'bot',
            timestamp: now,
            text: `⚠️ **Subnet Collision**: CIDR \`${cidrCandidate}\` is already registered as **${existing.name}**. Please choose a different CIDR block:`,
            actions: [{ label: '❌ Cancel Operation', actionType: 'quick_prompt', payload: 'cancel' }],
          };
        }

        if (ctx.setWizardState) {
          ctx.setWizardState({
            type: 'create_subnet',
            step: 'confirm',
            data: {
              ...wizard.data,
              cidr: cidrCandidate,
              vlanId: 10,
              location: 'Primary Datacenter',
              usableHosts: cidrInfo.usableHosts,
            },
          });
        }

        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: `📋 **Subnet Summary — Ready to create:**

- **Name**: **${wizard.data.name || 'Custom-Subnet'}**
- **CIDR Block**: \`${cidrCandidate}\`
- **Total Usable Hosts**: **${cidrInfo.usableHosts}**
- **Default Gateway**: \`${cidrInfo.firstUsableIp}\`
- **VLAN ID**: \`10\`
- **Location**: Primary Datacenter

Should I go ahead and create this subnet?`,
          actions: [
            { label: '✅ Yes, Create Subnet', actionType: 'quick_prompt', payload: 'confirm create subnet', variant: 'primary' },
            { label: '❌ Cancel Operation', actionType: 'quick_prompt', payload: 'cancel', variant: 'secondary' },
          ],
        };
      }

      if (wizard.step === 'confirm') {
        if (lower.includes('confirm') || lower.includes('yes') || lower.includes('create') || lower.includes('ok')) {
          const name = wizard.data.name || 'Custom-Subnet';
          const cidr = wizard.data.cidr;
          if (ctx.createSubnet && cidr) {
            const res = ctx.createSubnet({
              name,
              cidr,
              vlanId: wizard.data.vlanId || 10,
              location: wizard.data.location || 'Primary Datacenter',
              description: 'Created via IPAM Assistant Wizard',
              tags: ['chatbot-created'],
            });

            if (ctx.setWizardState) ctx.setWizardState(null);

            if (res.success && res.subnet) {
              return {
                id: messageId,
                sender: 'bot',
                timestamp: now,
                text: `✅ **Subnet Created Successfully!**

- **Name**: **${res.subnet.name}**
- **CIDR**: \`${res.subnet.cidr}\`
- **Gateway**: \`${res.subnet.gateway}\`
- **Usable Hosts**: **${res.subnet.usableHosts || 254}**
- **VLAN ID**: \`${res.subnet.vlanId || 'Default'}\`
- **Location**: ${res.subnet.location}`,
                subnetCards: [
                  {
                    ...res.subnet,
                    allocatedCount: 0,
                    availableCount: res.subnet.usableHosts || 254,
                    utilizationPercent: 0,
                  },
                ],
                actions: [
                  { label: 'View Subnet in Table', actionType: 'view_subnet', payload: { subnetId: res.subnet.id } },
                  {
                    label: `Allocate Next IP in ${res.subnet.name}`,
                    actionType: 'quick_prompt',
                    payload: `Allocate next available IP in ${res.subnet.name}`,
                    variant: 'primary',
                  },
                ],
              };
            }
          }
        }
      }
    }

    // --- B. DELETE SUBNET CONFIRMATION WIZARD ---
    if (wizard.type === 'delete_subnet') {
      if (wizard.step === 'select_subnet') {
        const cleanInput = trimmed.replace(/^(?:delete\s+subnet|delete|subnet|do delete subnet)\s+/i, '').trim();
        const found = allowedSubnets.find(
          (s) =>
            s.id === cleanInput ||
            s.name.toLowerCase() === cleanInput.toLowerCase() ||
            s.cidr.toLowerCase() === cleanInput.toLowerCase() ||
            cleanInput.toLowerCase().includes(s.name.toLowerCase())
        );

        if (found) {
          const allocatedCount = ctx.ips.filter((r) => r.subnetId === found.id && r.status !== 'available').length;
          if (ctx.setWizardState) {
            ctx.setWizardState({
              type: 'delete_subnet',
              step: 'confirm',
              data: { subnetId: found.id, name: found.name, cidr: found.cidr },
            });
          }

          return {
            id: messageId,
            sender: 'bot',
            timestamp: now,
            text: `⚠️ **Confirmation Required**: Are you sure you want to permanently delete Subnet **${found.name}** (\`${found.cidr}\`)?

- **Active Allocations**: **${allocatedCount} IP records** will be permanently removed.
- **Location**: ${found.location}
- **VLAN ID**: ${found.vlanId || 'Default'}

*This action cannot be undone.*`,
            actions: [
              {
                label: `🔴 Yes, Delete "${found.name}"`,
                actionType: 'quick_prompt',
                payload: `confirm delete`,
                variant: 'danger',
              },
              {
                label: '❌ Cancel Operation',
                actionType: 'quick_prompt',
                payload: 'cancel',
                variant: 'secondary',
              },
            ],
          };
        }
      }

      if (wizard.step === 'confirm' && (lower.includes('confirm') || lower.includes('yes') || lower.includes('do delete') || lower.includes('delete') || lower.includes('ok'))) {
        const subId = wizard.data.subnetId;
        const subName = wizard.data.name;
        if (ctx.deleteSubnet && subId) {
          const res = ctx.deleteSubnet(subId);
          if (ctx.setWizardState) ctx.setWizardState(null);
          return {
            id: messageId,
            sender: 'bot',
            timestamp: now,
            text: res.success
              ? `🗑️ **Subnet \`${subName}\` Deleted Successfully.** All associated IP records have been cleared.`
              : `❌ **Failed to delete subnet**: ${res.message}`,
            actions: [{ label: 'View Subnets', actionType: 'navigate_tab', payload: { tab: 'subnets' } }],
          };
        }
      }
    }

    // --- C. CREATE USER WIZARD ---
    if (wizard.type === 'create_user') {
      if (wizard.step === 'ask_username') {
        const cleanUser = trimmed.replace(/^(?:user|username|is|account)\s+/i, '').replace(/@/g, '').trim();
        if (ctx.setWizardState) {
          ctx.setWizardState({
            type: 'create_user',
            step: 'ask_fullname',
            data: { ...wizard.data, username: cleanUser },
          });
        }
        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: `👤 Got it! The username is set to **@${cleanUser}**.\n\nWhat is the **Full Name** for **@${cleanUser}**? *(e.g. Sarah Connor)*`,
          actions: [
            { label: `Use: ${cleanUser}`, actionType: 'quick_prompt', payload: cleanUser, variant: 'outline' },
            { label: '❌ Cancel Operation', actionType: 'quick_prompt', payload: 'cancel' },
          ],
        };
      }

      if (wizard.step === 'ask_fullname') {
        const fullName = trimmed.replace(/^(?:full name|fullname|name|is)\s+/i, '').trim();
        if (ctx.setWizardState) {
          ctx.setWizardState({
            type: 'create_user',
            step: 'ask_role',
            data: { ...wizard.data, fullName },
          });
        }
        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: `👤 Great! Full Name set to **${fullName}**.\n\nWhat **role & permissions** should **${fullName}** have?`,
          actions: [
            { label: '🛡️ Super Admin (Full Control)', actionType: 'quick_prompt', payload: 'role super_admin', variant: 'primary' },
            { label: '🌐 Network Admin (Subnets & IPs)', actionType: 'quick_prompt', payload: 'role network_admin', variant: 'outline' },
            { label: '⚙️ Operator (Allocate & Update IPs)', actionType: 'quick_prompt', payload: 'role operator', variant: 'secondary' },
            { label: '📋 Auditor (Read-Only & Logs)', actionType: 'quick_prompt', payload: 'role auditor', variant: 'secondary' },
            { label: '❌ Cancel Operation', actionType: 'quick_prompt', payload: 'cancel' },
          ],
        };
      }

      if (wizard.step === 'ask_role') {
        let role: UserRole = 'operator';
        if (lower.includes('super_admin') || lower.includes('super admin')) role = 'super_admin';
        else if (lower.includes('network_admin') || lower.includes('network admin')) role = 'network_admin';
        else if (lower.includes('auditor') || lower.includes('audit')) role = 'auditor';
        else if (lower.includes('operator')) role = 'operator';

        if (ctx.setWizardState) {
          ctx.setWizardState({
            type: 'create_user',
            step: 'ask_password',
            data: { ...wizard.data, role },
          });
        }

        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: `🔑 Role selected: **${role.toUpperCase()}**.\n\nPlease enter a **password** (min 8 characters) for **@${wizard.data.username}**, or pick a secure preset:`,
          actions: [
            { label: 'Use: SecureUserPass123!', actionType: 'quick_prompt', payload: 'password SecureUserPass123!', variant: 'primary' },
            { label: 'Use: AdminPass#2026!', actionType: 'quick_prompt', payload: 'password AdminPass#2026!', variant: 'outline' },
            { label: '❌ Cancel Operation', actionType: 'quick_prompt', payload: 'cancel' },
          ],
        };
      }

      if (wizard.step === 'ask_password') {
        const passMatch = trimmed.match(/(?:password|pass)\s+([^\s]+)/i);
        const pass = passMatch && passMatch[1] ? passMatch[1] : trimmed;
        const password = pass.length >= 8 ? pass : 'SecureUserPass123!';

        if (ctx.setWizardState) {
          ctx.setWizardState({
            type: 'create_user',
            step: 'confirm',
            data: { ...wizard.data, password },
          });
        }

        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: `📋 **User Account Summary — Ready to create:**

- **Username**: \`@${wizard.data.username}\`
- **Full Name**: **${wizard.data.fullName}**
- **Role**: \`${String(wizard.data.role || 'operator').toUpperCase()}\`
- **Department**: IT Infrastructure
- **Authentication**: Local Database Account

Should I create this user account now?`,
          actions: [
            { label: '✅ Yes, Create User', actionType: 'quick_prompt', payload: 'confirm create user', variant: 'primary' },
            { label: '❌ Cancel Operation', actionType: 'quick_prompt', payload: 'cancel', variant: 'secondary' },
          ],
        };
      }

      if (wizard.step === 'confirm') {
        if (lower.includes('confirm') || lower.includes('yes') || lower.includes('create')) {
          const username = wizard.data.username;
          const fullName = wizard.data.fullName || username;
          const role: UserRole = wizard.data.role || 'operator';
          const password = wizard.data.password || 'SecureUserPass123!';

          const defaultPerms: GranularPermissions = {
            manageUsers: role === 'super_admin',
            manageAuthSettings: role === 'super_admin',
            manageDeviceClassifications: role === 'super_admin' || role === 'network_admin',
            manageAuditSettings: role === 'super_admin',
            clearAuditLogs: role === 'super_admin',
            createSubnet: role === 'super_admin' || role === 'network_admin',
            editSubnet: role === 'super_admin' || role === 'network_admin',
            deleteSubnet: role === 'super_admin',
            allocateIP: role !== 'auditor',
            releaseIP: role !== 'auditor',
            editIP: role !== 'auditor',
            viewAuditLogs: true,
            exportData: true,
            allowedSubnetIds: [],
          };

          if (ctx.createUser) {
            const res = ctx.createUser({
              username,
              fullName,
              email: `${username}@company.local`,
              authType: 'local',
              localPassword: password,
              role,
              status: 'active',
              department: 'IT Infrastructure',
              permissions: defaultPerms,
            });

            if (ctx.setWizardState) ctx.setWizardState(null);

            if (res.success && res.user) {
              return {
                id: messageId,
                sender: 'bot',
                timestamp: now,
                text: `✅ **User Account Created Successfully!**

- **Username**: \`@${res.user.username}\`
- **Full Name**: **${res.user.fullName}**
- **Role**: \`${res.user.role.toUpperCase()}\`
- **Email**: \`${res.user.email}\`
- **Department**: ${res.user.department}
- **Authentication**: Local Database Account`,
                actions: [{ label: 'View Users Management', actionType: 'navigate_tab', payload: { tab: 'users' } }],
              };
            }
          }
        }
      }
    }

    // --- D. DELETE USER CONFIRMATION WIZARD ---
    if (wizard.type === 'delete_user') {
      if (wizard.step === 'select_user') {
        const cleanUser = trimmed.replace(/^(?:delete\s+user|delete|user|usr|account|do delete user)\s+/i, '').replace(/@/g, '').trim();
        const targetUser = (ctx.users || []).find(
          (u) =>
            u.id === cleanUser ||
            u.username.toLowerCase() === cleanUser.toLowerCase() ||
            (u.fullName && u.fullName.toLowerCase() === cleanUser.toLowerCase()) ||
            cleanUser.toLowerCase().includes(u.username.toLowerCase())
        );

        if (targetUser) {
          if (targetUser.username.toLowerCase() === 'admin') {
            if (ctx.setWizardState) ctx.setWizardState(null);
            return {
              id: messageId,
              sender: 'bot',
              timestamp: now,
              text: `🛡️ **Protected Root Account**: The primary \`@admin\` account is protected and cannot be deleted.`,
              isSecurityAlert: true,
            };
          }

          if (targetUser.id === ctx.currentUser?.id) {
            if (ctx.setWizardState) ctx.setWizardState(null);
            return {
              id: messageId,
              sender: 'bot',
              timestamp: now,
              text: `⚠️ **Self-Deletion Blocked**: You cannot delete your currently active logged-in user account.`,
              isSecurityAlert: true,
            };
          }

          if (ctx.setWizardState) {
            ctx.setWizardState({
              type: 'delete_user',
              step: 'confirm',
              data: { userId: targetUser.id, username: targetUser.username, fullName: targetUser.fullName },
            });
          }

          return {
            id: messageId,
            sender: 'bot',
            timestamp: now,
            text: `⚠️ **Confirmation Required**: Are you sure you want to permanently delete user **@${targetUser.username}** (${targetUser.fullName || 'No display name'})?

- **Role**: \`${targetUser.role.toUpperCase()}\`
- **Email**: \`${targetUser.email || 'N/A'}\`
- **Department**: ${targetUser.department || 'N/A'}

*This user will immediately lose system access.*`,
            actions: [
              {
                label: `🔴 Yes, Delete @${targetUser.username}`,
                actionType: 'quick_prompt',
                payload: `confirm delete user`,
                variant: 'danger',
              },
              {
                label: '❌ Cancel Operation',
                actionType: 'quick_prompt',
                payload: 'cancel',
                variant: 'secondary',
              },
            ],
          };
        }
      }

      if (wizard.step === 'confirm' && (lower.includes('confirm') || lower.includes('yes') || lower.includes('do delete') || lower.includes('delete') || lower.includes('ok'))) {
        const userId = wizard.data.userId;
        const username = wizard.data.username;
        if (ctx.deleteUser && userId) {
          const res = ctx.deleteUser(userId);
          if (ctx.setWizardState) ctx.setWizardState(null);
          return {
            id: messageId,
            sender: 'bot',
            timestamp: now,
            text: res.success
              ? `🗑️ **User Account \`@${username}\` Deleted Successfully.** Access revoked.`
              : `❌ **Failed to delete user**: ${res.message}`,
            actions: [{ label: 'View Users Management', actionType: 'navigate_tab', payload: { tab: 'users' } }],
          };
        }
      }
    }

    // --- E. CREATE DEVICE CLASSIFICATION WIZARD ---
    if (wizard.type === 'create_classification') {
      if (wizard.step === 'ask_name') {
        const name = trimmed.replace(/^(?:type|name|category|is)\s+/i, '').trim();
        const code = name.length >= 2 ? name.substring(0, 3).toUpperCase() : 'DEV';
        if (ctx.setWizardState) {
          ctx.setWizardState({
            type: 'create_classification',
            step: 'ask_ports',
            data: { name, code },
          });
        }
        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: `🏷️ Device category name set to **${name}** (Code: \`${code}\`).\n\nWhat **default network ports** are associated with this device type? *(e.g. \`80,443\` or \`22,8443\` or \`5432\`)*`,
          actions: [
            { label: 'Management Ports (443, 8443, 22)', actionType: 'quick_prompt', payload: 'ports 443,8443,22', variant: 'primary' },
            { label: 'Web Tier Ports (80, 443)', actionType: 'quick_prompt', payload: 'ports 80,443', variant: 'outline' },
            { label: 'Database Ports (3306, 5432)', actionType: 'quick_prompt', payload: 'ports 3306,5432', variant: 'secondary' },
            { label: 'SNMP Monitoring (161, 162)', actionType: 'quick_prompt', payload: 'ports 161,162', variant: 'secondary' },
            { label: '❌ Cancel Operation', actionType: 'quick_prompt', payload: 'cancel' },
          ],
        };
      }

      if (wizard.step === 'ask_ports' || wizard.step === 'confirm') {
        const portsMatch = trimmed.match(/(?:ports|default ports)\s+([0-9, ]+)/i);
        const defaultPorts = portsMatch && portsMatch[1] ? portsMatch[1].trim() : (trimmed.match(/^[0-9, ]+$/) ? trimmed.trim() : '80,443');
        const name = wizard.data.name || 'Custom Device';
        const code = wizard.data.code || 'DEV';

        if (ctx.createDeviceClassification) {
          const res = ctx.createDeviceClassification({
            name,
            code,
            category: 'Infrastructure',
            description: `Registered device type for ${name}`,
            icon: 'Server',
            color: 'cyan',
            defaultPorts,
          });

          if (ctx.setWizardState) ctx.setWizardState(null);

          return {
            id: messageId,
            sender: 'bot',
            timestamp: now,
            text: res.success
              ? `🏷️ **Device Classification \`${name}\` (\`${code}\`) Created Successfully!**\nDefault Ports: \`${defaultPorts}\``
              : `❌ **Failed to create device category**: ${res.message}`,
            actions: [{ label: 'View Device Types', actionType: 'navigate_tab', payload: { tab: 'device_classifications' } }],
          };
        }
      }
    }
  }

  // =========================================================================
  // 2. CREATE NEW SUBNET (With guided flow, typo tolerance, and validation)
  // =========================================================================
  if (fuzzy.intent === 'CREATE_SUBNET') {
    if (!ctx.hasPermission('createSubnet')) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⛔ **Permission Denied**: Your account (@${ctx.currentUser?.username}) does not have the **createSubnet** permission required to create network subnets.`,
        isSecurityAlert: true,
      };
    }

    // Check if user provided CIDR or if we should start multi-step wizard
    const cidr = extractedCidr;

    if (!cidr) {
      if (ctx.setWizardState) {
        ctx.setWizardState({
          type: 'create_subnet',
          step: 'ask_name',
          data: {},
        });
      }

      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `🌐 Sure! What **name** would you like to give to this new subnet? *(e.g. Office LAN, DMZ-Web, Servers)*\n\nYou can type the name below or pick one of the quick suggestions:`,
        actions: [
          { label: 'Office-LAN', actionType: 'quick_prompt', payload: 'Office-LAN', variant: 'primary' },
          { label: 'DMZ-Web', actionType: 'quick_prompt', payload: 'DMZ-Web', variant: 'outline' },
          { label: 'IoT-Devices', actionType: 'quick_prompt', payload: 'IoT-Devices', variant: 'secondary' },
          { label: 'Branch-Office', actionType: 'quick_prompt', payload: 'Branch-Office', variant: 'secondary' },
          { label: '❌ Cancel Operation', actionType: 'quick_prompt', payload: 'cancel', variant: 'secondary' },
        ],
        suggestions: [
          'create subnet Office-LAN 192.168.30.0/24 vlan 30',
          'Subnet utilization summary',
        ],
      };
    }

    // Extract Name
    let name: string | undefined;
    const nameMatch = (normalized + ' ' + trimmed).match(/(?:name|named)\s+[:=]?\s*([a-zA-Z0-9_\-\. ]+?)(?:\s+(?:cidr|vlan|location|desc|description)|$)/i);
    if (nameMatch && nameMatch[1] && !nameMatch[1].toLowerCase().includes('subnet')) {
      name = nameMatch[1].trim();
    } else {
      const parts = normalized.split(/\s+/);
      const subIdx = parts.findIndex((p) => p.toLowerCase().includes('subnet') || p.toLowerCase().includes('subn'));
      if (subIdx >= 0 && parts[subIdx + 1] && !parts[subIdx + 1].includes('/') && !['create', 'add', 'new', 'make'].includes(parts[subIdx + 1].toLowerCase())) {
        name = parts[subIdx + 1].replace(/[^a-zA-Z0-9_\-\.]/g, '');
      }
    }

    // Extract VLAN ID
    let vlanId: number | undefined;
    const vlanMatch = (trimmed + ' ' + normalized).match(/(?:vlan|vlanid|vlan id)\s*[:=]?\s*(\d{1,4})/i);
    if (vlanMatch && vlanMatch[1]) {
      vlanId = parseInt(vlanMatch[1], 10);
    }

    // Extract Location
    let location = 'Primary Datacenter';
    const locMatch = (trimmed + ' ' + normalized).match(/(?:location|loc|site)\s*[:=]?\s*([a-zA-Z0-9_\-\. ]+?)(?:\s+(?:name|cidr|vlan|desc|description)|$)/i);
    if (locMatch && locMatch[1]) {
      location = locMatch[1].trim();
    }

    // Extract Description
    let description = 'Created via IPAM Assistant';
    const descMatch = (trimmed + ' ' + normalized).match(/(?:desc|description|notes)\s*[:=]?\s*([^,\n]+)/i);
    if (descMatch && descMatch[1]) {
      description = descMatch[1].trim();
    }

    // Validate CIDR
    const cidrInfo = parseCIDR(cidr);
    if (!cidrInfo) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `❌ **Invalid CIDR format**: \`${cidr}\`. Please provide a valid IPv4 CIDR like \`192.168.20.0/24\`.`,
      };
    }

    // Check collision
    const existing = ctx.subnets.find((s) => s.cidr.toLowerCase() === cidr.toLowerCase());
    if (existing) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⚠️ **Subnet Collision**: CIDR \`${cidr}\` is already registered as **${existing.name}** (ID: \`${existing.id}\`).`,
        actions: [{ label: `View ${existing.name}`, actionType: 'view_subnet', payload: { subnetId: existing.id } }],
      };
    }

    const subnetName = name || `Subnet-${cidr.replace(/\//g, '-').replace(/\./g, '_')}`;

    if (ctx.createSubnet) {
      const res = ctx.createSubnet({
        name: subnetName,
        cidr,
        vlanId: vlanId || 10,
        location,
        description,
        tags: ['chatbot-created'],
      });

      if (res.success && res.subnet) {
        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: `✅ **Subnet Created Successfully!**

- **Name**: **${res.subnet.name}**
- **CIDR**: \`${res.subnet.cidr}\`
- **Gateway**: \`${res.subnet.gateway}\`
- **Usable Hosts**: **${res.subnet.usableHosts || 254}**
- **VLAN ID**: \`${res.subnet.vlanId || 'Default'}\`
- **Location**: ${res.subnet.location}`,
          subnetCards: [
            {
              ...res.subnet,
              allocatedCount: 0,
              availableCount: res.subnet.usableHosts || 254,
              utilizationPercent: 0,
            },
          ],
          actions: [
            { label: 'View Subnet in Table', actionType: 'view_subnet', payload: { subnetId: res.subnet.id } },
            {
              label: `Allocate Next IP in ${res.subnet.name}`,
              actionType: 'quick_prompt',
              payload: `Allocate next available IP in ${res.subnet.name}`,
              variant: 'primary',
            },
          ],
        };
      } else {
        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: `❌ **Failed to create subnet**: ${res.message}`,
        };
      }
    }
  }

  // =========================================================================
  // 3. DELETE SUBNET (With Selection List & Strict Confirmation)
  // =========================================================================
  if (fuzzy.intent === 'DELETE_SUBNET') {
    if (!ctx.hasPermission('deleteSubnet')) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⛔ **Permission Denied**: Your account (@${ctx.currentUser?.username}) does not have the **deleteSubnet** permission required to delete subnets.`,
        isSecurityAlert: true,
      };
    }

    // Check if a specific target subnet was requested in the message
    let target = targetSubnet;

    // Check if message has direct confirmation payload: `do delete subnet <id>`
    const doDeleteMatch = trimmed.match(/(?:do delete subnet|confirm delete subnet)\s+([a-zA-Z0-9_\-\.]+)/i);
    if (doDeleteMatch && doDeleteMatch[1]) {
      const matchIdOrCidr = doDeleteMatch[1];
      target = ctx.subnets.find((s) => s.id === matchIdOrCidr || s.cidr === matchIdOrCidr || s.name.toLowerCase() === matchIdOrCidr.toLowerCase());
      if (target && ctx.deleteSubnet) {
        const res = ctx.deleteSubnet(target.id);
        if (ctx.setWizardState) ctx.setWizardState(null);
        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: res.success
            ? `🗑️ **Subnet \`${target.name}\` (\`${target.cidr}\`) Deleted Successfully.** All associated IP allocations have been removed.`
            : `❌ **Failed to delete subnet**: ${res.message}`,
          actions: [{ label: 'View Subnets Tab', actionType: 'navigate_tab', payload: { tab: 'subnets' } }],
        };
      }
    }

    if (!target) {
      if (ctx.setWizardState) {
        ctx.setWizardState({
          type: 'delete_subnet',
          step: 'select_subnet',
          data: {},
        });
      }

      // List all accessible subnets for user to select from
      const actions: ChatAction[] = allowedSubnets.map((sub) => ({
        label: `🗑️ Delete "${sub.name}" (${sub.cidr})`,
        actionType: 'quick_prompt',
        payload: `delete subnet ${sub.name}`,
        variant: 'danger',
      }));
      actions.push({ label: '❌ Cancel Operation', actionType: 'quick_prompt', payload: 'cancel', variant: 'secondary' });

      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `🌐 Which subnet would you like to delete?\n\nPlease choose one from the list below or type its name / CIDR:`,
        actions,
        suggestions: ['Cancel', 'Subnet utilization summary'],
      };
    }

    // Ask for explicit confirmation for the target subnet
    const allocatedCount = ctx.ips.filter((r) => r.subnetId === target!.id && r.status !== 'available').length;
    if (ctx.setWizardState) {
      ctx.setWizardState({
        type: 'delete_subnet',
        step: 'confirm',
        data: { subnetId: target.id, name: target.name, cidr: target.cidr },
      });
    }

    return {
      id: messageId,
      sender: 'bot',
      timestamp: now,
      text: `⚠️ **Confirmation Required**: Are you sure you want to permanently delete Subnet **${target.name}** (\`${target.cidr}\`)?

- **Active Allocations**: **${allocatedCount} IP records** will be permanently removed.
- **Location**: ${target.location}
- **VLAN ID**: ${target.vlanId || 'Default'}

*This action cannot be undone.*`,
      actions: [
        {
          label: `🔴 Yes, Delete "${target.name}"`,
          actionType: 'quick_prompt',
          payload: `do delete subnet ${target.id}`,
          variant: 'danger',
        },
        {
          label: '❌ Cancel Operation',
          actionType: 'quick_prompt',
          payload: 'cancel',
          variant: 'secondary',
        },
      ],
    };
  }

  // =========================================================================
  // 4. CREATE USER ACCOUNT (With Guided Wizard)
  // =========================================================================
  if (fuzzy.intent === 'CREATE_USER') {
    const isSuperAdmin = ctx.currentUser?.role === 'super_admin';
    const canManageUsers = isSuperAdmin || ctx.hasPermission('manageUsers');

    if (!canManageUsers) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⛔ **Permission Denied**: Your account (@${ctx.currentUser?.username}) does not have permission to create or manage user accounts.`,
        isSecurityAlert: true,
      };
    }

    // Extract Username
    let username: string | undefined;
    const userMatch = (normalized + ' ' + trimmed).match(/(?:user|username|usr|account|acct)\s+[:=]?\s*@?([a-zA-Z0-9_\-\.]+)/i);
    if (userMatch && userMatch[1] && !['create', 'new', 'add', 'a', 'the', 'account', 'named', 'name'].includes(userMatch[1].toLowerCase())) {
      username = userMatch[1].replace(/@/g, '');
    } else {
      const parts = normalized.split(/\s+/);
      const userIdx = parts.findIndex((p) => p.toLowerCase() === 'user' || p.toLowerCase() === 'account');
      if (userIdx >= 0 && parts[userIdx + 1] && !['create', 'new', 'add', 'a', 'the', 'named', 'role', 'password'].includes(parts[userIdx + 1].toLowerCase())) {
        username = parts[userIdx + 1].replace(/@/g, '');
      }
    }

    // If no username was given in the initial prompt, start guided wizard
    if (!username) {
      if (ctx.setWizardState) {
        ctx.setWizardState({
          type: 'create_user',
          step: 'ask_username',
          data: {},
        });
      }

      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `👤 Sure! I can help you create a new user account.\n\nWhat **username** should we assign to this account? *(e.g. \`sarah_connor\`, \`alex_smith\`)*`,
        actions: [
          { label: 'Create @sarah_connor', actionType: 'quick_prompt', payload: 'user sarah_connor', variant: 'primary' },
          { label: 'Create @netadmin_user', actionType: 'quick_prompt', payload: 'user netadmin_user', variant: 'outline' },
          { label: 'Create @operator_john', actionType: 'quick_prompt', payload: 'user operator_john', variant: 'secondary' },
          { label: '❌ Cancel Operation', actionType: 'quick_prompt', payload: 'cancel', variant: 'secondary' },
        ],
        suggestions: [
          'create user sam role operator',
          'create user devops_lead role network_admin',
        ],
      };
    }

    // Extract Full Name
    let fullName: string | undefined;
    const nameMatch = (trimmed + ' ' + normalized).match(/(?:full name|fullname|name)\s+[:=]?\s*([a-zA-Z0-9_\-\. ]+?)(?:\s+(?:email|role|password|pass|passwd|dept|department)|$)/i);
    if (nameMatch && nameMatch[1]) {
      fullName = nameMatch[1].trim();
    }

    // Extract Email
    let email: string | undefined;
    const emailMatch = trimmed.match(/\b([a-zA-Z0-9_\.\+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-\.]+)\b/);
    if (emailMatch) {
      email = emailMatch[1];
    }

    // Extract Role
    let role: UserRole = 'operator';
    if (lower.includes('super_admin') || lower.includes('super admin')) role = 'super_admin';
    else if (lower.includes('network_admin') || lower.includes('network admin')) role = 'network_admin';
    else if (lower.includes('auditor') || lower.includes('audit')) role = 'auditor';
    else if (lower.includes('operator')) role = 'operator';

    // Extract Password
    let password = 'TempUserPass123!';
    const passMatch = (trimmed + ' ' + normalized).match(/(?:password|pass|passwd|paswrd|pswrd)\s+[:=]?\s*([^\s,]+)/i);
    if (passMatch && passMatch[1]) {
      password = passMatch[1].trim();
    }

    // Extract Department
    let department = 'IT Infrastructure';
    const deptMatch = (trimmed + ' ' + normalized).match(/(?:dept|department)\s+[:=]?\s*([a-zA-Z0-9_\-\. ]+?)(?:\s+(?:role|password|email)|$)/i);
    if (deptMatch && deptMatch[1]) {
      department = deptMatch[1].trim();
    }

    // Default permissions based on role
    const defaultPerms: GranularPermissions = {
      manageUsers: role === 'super_admin',
      manageAuthSettings: role === 'super_admin',
      manageDeviceClassifications: role === 'super_admin' || role === 'network_admin',
      manageAuditSettings: role === 'super_admin',
      clearAuditLogs: role === 'super_admin',
      createSubnet: role === 'super_admin' || role === 'network_admin',
      editSubnet: role === 'super_admin' || role === 'network_admin',
      deleteSubnet: role === 'super_admin',
      allocateIP: role !== 'auditor',
      releaseIP: role !== 'auditor',
      editIP: role !== 'auditor',
      viewAuditLogs: true,
      exportData: true,
      allowedSubnetIds: [],
    };

    if (ctx.createUser) {
      const res = ctx.createUser({
        username,
        fullName: fullName || username,
        email: email || `${username}@company.local`,
        authType: 'local',
        localPassword: password,
        role,
        status: 'active',
        department,
        permissions: defaultPerms,
      });

      if (res.success && res.user) {
        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: `✅ **User Account Created Successfully!**

- **Username**: \`@${res.user.username}\`
- **Full Name**: **${res.user.fullName}**
- **Role**: \`${res.user.role.toUpperCase()}\`
- **Email**: \`${res.user.email}\`
- **Department**: ${res.user.department}
- **Authentication**: Local Database Account`,
          actions: [
            { label: 'View User Management', actionType: 'navigate_tab', payload: { tab: 'users' } },
          ],
        };
      } else {
        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: `❌ **Failed to create user**: ${res.message}`,
        };
      }
    }
  }

  // =========================================================================
  // 4.1 DELETE USER ACCOUNT (With Selection List & Strict Confirmation)
  // =========================================================================
  if (fuzzy.intent === 'DELETE_USER') {
    const isSuperAdmin = ctx.currentUser?.role === 'super_admin';
    const canManageUsers = isSuperAdmin || ctx.hasPermission('manageUsers');

    if (!canManageUsers) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⛔ **Permission Denied**: Your account (@${ctx.currentUser?.username}) does not have permission to delete user accounts.`,
        isSecurityAlert: true,
      };
    }

    // Check direct delete execution: `do delete user <id>`
    const doDeleteMatch = trimmed.match(/(?:do delete user|confirm delete user)\s+([a-zA-Z0-9_\-\.]+)/i);
    if (doDeleteMatch && doDeleteMatch[1]) {
      const targetIdOrUser = doDeleteMatch[1].replace(/@/g, '');
      const targetUser = ctx.users?.find((u) => u.id === targetIdOrUser || u.username.toLowerCase() === targetIdOrUser.toLowerCase());
      if (targetUser && ctx.deleteUser) {
        const res = ctx.deleteUser(targetUser.id);
        if (ctx.setWizardState) ctx.setWizardState(null);
        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: res.success
            ? `🗑️ **User Account \`@${targetUser.username}\` Deleted Successfully.** Access has been revoked.`
            : `❌ **Failed to delete user**: ${res.message}`,
          actions: [{ label: 'View Users Management', actionType: 'navigate_tab', payload: { tab: 'users' } }],
        };
      }
    }

    // Extract target username from prompt if mentioned
    let targetUsername: string | undefined;
    const userMatch = (trimmed + ' ' + normalized).match(/(?:user|usr|account|for)\s+@?([a-zA-Z0-9_\-\.]+)/i);
    if (userMatch && userMatch[1] && !['delete', 'remove', 'the', 'a', 'account'].includes(userMatch[1].toLowerCase())) {
      targetUsername = userMatch[1].replace(/@/g, '');
    }

    const deletableUsers = (ctx.users || []).filter(
      (u) => u.username.toLowerCase() !== 'admin' && u.id !== ctx.currentUser?.id
    );

    let targetUser = targetUsername ? ctx.users?.find((u) => u.username.toLowerCase() === targetUsername!.toLowerCase()) : undefined;

    if (!targetUser) {
      if (deletableUsers.length === 0) {
        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: `ℹ️ **No removable user accounts found.** (The root \`@admin\` account and your active logged-in session cannot be deleted).`,
          actions: [{ label: 'Create New User', actionType: 'quick_prompt', payload: 'create user' }],
        };
      }

      if (ctx.setWizardState) {
        ctx.setWizardState({
          type: 'delete_user',
          step: 'select_user',
          data: {},
        });
      }

      const actions: ChatAction[] = deletableUsers.map((u) => ({
        label: `🗑️ Delete @${u.username} (${u.fullName})`,
        actionType: 'quick_prompt',
        payload: `delete user @${u.username}`,
        variant: 'danger',
      }));
      actions.push({ label: '❌ Cancel Operation', actionType: 'quick_prompt', payload: 'cancel', variant: 'secondary' });

      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `👤 Which user account would you like to delete?\n\nPlease choose from the list below or type their username:`,
        actions,
      };
    }

    if (targetUser.username.toLowerCase() === 'admin') {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⛔ **System Protection**: Root administrator account \`@admin\` is protected and cannot be deleted.`,
        isSecurityAlert: true,
      };
    }

    if (targetUser.id === ctx.currentUser?.id) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⚠️ **Action Prevented**: You cannot delete your own currently active session account (@${targetUser.username}).`,
      };
    }

    // Prompt for confirmation
    if (ctx.setWizardState) {
      ctx.setWizardState({
        type: 'delete_user',
        step: 'confirm',
        data: { userId: targetUser.id, username: targetUser.username },
      });
    }

    return {
      id: messageId,
      sender: 'bot',
      timestamp: now,
      text: `⚠️ **Confirmation Required**: Are you sure you want to permanently delete user account **@${targetUser.username}** (${targetUser.fullName})?

- **Role**: \`${targetUser.role.toUpperCase()}\`
- **Department**: ${targetUser.department}
- **Authentication**: ${targetUser.authType}

*This user will immediately lose system access.*`,
      actions: [
        {
          label: `🔴 Yes, Delete @${targetUser.username}`,
          actionType: 'quick_prompt',
          payload: `do delete user ${targetUser.id}`,
          variant: 'danger',
        },
        {
          label: '❌ Cancel Operation',
          actionType: 'quick_prompt',
          payload: 'cancel',
          variant: 'secondary',
        },
      ],
    };
  }

  // =========================================================================
  // 5. CHANGE / UPDATE USER PASSWORD
  // =========================================================================
  if (fuzzy.intent === 'UPDATE_PASSWORD') {
    let targetUsername = ctx.currentUser?.username || '';
    const userMatch = (trimmed + ' ' + normalized).match(/(?:for user|for usr|user|usr|for|account)\s+@?([a-zA-Z0-9_\-\.]+)/i);
    if (userMatch && userMatch[1] && !['password', 'to', 'my', 'the', 'a', 'is', 'new'].includes(userMatch[1].toLowerCase())) {
      targetUsername = userMatch[1].replace(/@/g, '');
    }

    const isSelf = targetUsername.toLowerCase() === ctx.currentUser?.username.toLowerCase();
    const isSuperAdmin = ctx.currentUser?.role === 'super_admin';
    const canManageUsers = isSuperAdmin || ctx.hasPermission('manageUsers');

    if (!isSelf && !canManageUsers) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⛔ **Permission Denied**: You do not have administrative permission to reset passwords for other accounts.`,
        isSecurityAlert: true,
      };
    }

    // Extract New Password
    let newPassword: string | undefined;
    const passMatch = trimmed.match(/(?:to|new password|password)\s+[:=]?\s*([^\s,]+)$/i) ||
                      trimmed.match(/(?:to|is)\s+([^\s,]+)/i);
    if (passMatch && passMatch[1] && !['password', 'user', 'usr', 'the', 'a'].includes(passMatch[1].toLowerCase())) {
      newPassword = passMatch[1].trim();
    }

    if (!newPassword) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `🔑 **Update Password Command**\n\nPlease specify the new password.\nExample: \`change password for user ${targetUsername} to NewSecurePass123!\``,
      };
    }

    if (newPassword.length < 8) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⚠️ **Password Policy Error**: Password must be at least 8 characters in length.`,
      };
    }

    const targetUserObj = ctx.users?.find((u) => u.username.toLowerCase() === targetUsername.toLowerCase()) ||
                          (isSelf ? ctx.currentUser : undefined);

    if (!targetUserObj) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⚠️ **User Not Found**: Account \`@${targetUsername}\` does not exist in the database.`,
      };
    }

    if (targetUserObj.authType === 'ldap_ad') {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⚠️ **Active Directory Account**: User \`@${targetUsername}\` is managed by LDAP/Active Directory. Passwords must be updated via your Windows Domain Controller.`,
      };
    }

    if (ctx.changePassword) {
      const res = ctx.changePassword(targetUserObj.id, newPassword);
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: res.success
          ? `🔒 **Password Updated Successfully for @${targetUsername}!**\nThe user credentials have been securely stored.`
          : `❌ **Password Update Failed**: ${res.message}`,
      };
    }
  }

  // =========================================================================
  // 6. DEVICE CLASSIFICATION / CATEGORIES
  // =========================================================================
  if (fuzzy.intent === 'DEVICE_CLASSIFICATION') {
    const isSuperAdmin = ctx.currentUser?.role === 'super_admin';
    const canSeeDeviceTypes = Boolean(
      isSuperAdmin ||
        (ctx.hasPermission('manageDeviceClassifications') && ctx.currentUser?.role !== 'auditor') ||
        (ctx.currentUser?.role === 'network_admin' && ctx.currentUser?.permissions?.manageDeviceClassifications !== false)
    );

    if (!canSeeDeviceTypes) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⛔ **Access Denied**: Your account (@${ctx.currentUser?.username || 'user'}) with role **${(ctx.currentUser?.role || 'USER').toUpperCase()}** does not have permission to view or manage device types and classifications.`,
        isSecurityAlert: true,
        actions: [
          { label: '🔍 Find IP', actionType: 'quick_prompt', payload: 'find ip', variant: 'primary' },
          { label: '🏠 Main Menu', actionType: 'quick_prompt', payload: 'menu', variant: 'secondary' },
        ],
        suggestions: ['Menu', 'Find IP', 'Subnets', 'Help'],
      };
    }

    const isAdding = lower.includes('add') || lower.includes('create') || lower.includes('new');

    if (isAdding) {
      const canManage = ctx.currentUser?.role === 'super_admin' || ctx.hasPermission('manageDeviceClassifications');
      if (!canManage) {
        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: `⛔ **Permission Denied**: You do not have permission to create or modify device classifications.`,
          isSecurityAlert: true,
        };
      }

      // Extract details
      const nameMatch = trimmed.match(/(?:type|name|category)\s+[:=]?\s*([a-zA-Z0-9_\-\. ]+?)(?:\s+(?:code|desc|description|icon|ports)|$)/i);
      if (!nameMatch) {
        if (ctx.setWizardState) {
          ctx.setWizardState({
            type: 'create_classification',
            step: 'ask_name',
            data: {},
          });
        }
        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: `🏷️ Sure! What **device classification or category** would you like to create? *(e.g. \`Load-Balancer\`, \`Firewall\`, \`Storage-NAS\`, \`Access-Point\`)*`,
          actions: [
            { label: 'Create: Load-Balancer', actionType: 'quick_prompt', payload: 'Load-Balancer', variant: 'primary' },
            { label: 'Create: Firewall-Appliance', actionType: 'quick_prompt', payload: 'Firewall-Appliance', variant: 'outline' },
            { label: 'Create: Storage-NAS', actionType: 'quick_prompt', payload: 'Storage-NAS', variant: 'secondary' },
            { label: '❌ Cancel Operation', actionType: 'quick_prompt', payload: 'cancel', variant: 'secondary' },
          ],
        };
      }

      const name = nameMatch[1].trim();
      const codeMatch = trimmed.match(/(?:code)\s+[:=]?\s*([a-zA-Z0-9_\-]+)/i);
      const code = codeMatch && codeMatch[1] ? codeMatch[1].toUpperCase() : name.substring(0, 3).toUpperCase();
      const descMatch = trimmed.match(/(?:desc|description)\s+[:=]?\s*([^,\n]+)/i);
      const description = descMatch && descMatch[1] ? descMatch[1].trim() : `Device type for ${name}`;
      const portsMatch = trimmed.match(/(?:ports|default ports)\s+[:=]?\s*([0-9, ]+)/i);
      const defaultPorts = portsMatch && portsMatch[1] ? portsMatch[1].trim() : '80,443';

      if (ctx.createDeviceClassification) {
        const res = ctx.createDeviceClassification({
          name,
          code,
          category: 'Infrastructure',
          description,
          icon: 'Server',
          color: 'blue',
          defaultPorts,
        });

        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: res.success
            ? `🏷️ **Device Classification \`${name}\` (\`${code}\`) Created!**\nDefault Ports: \`${defaultPorts}\``
            : `❌ **Failed to create device category**: ${res.message}`,
          actions: [{ label: 'View Device Types', actionType: 'navigate_tab', payload: { tab: 'device_classifications' } }],
        };
      }
    }

    // Otherwise list device classifications
    const classList = ctx.deviceClassifications.map((d) => `- **${d.name}** (\`${d.code}\`): ${d.description} ${d.defaultPorts ? `*(Ports: ${d.defaultPorts})*` : ''}`);
    return {
      id: messageId,
      sender: 'bot',
      timestamp: now,
      text: `🏷️ **Registered Device Classifications (${ctx.deviceClassifications.length} total):**\n\n${classList.join('\n')}`,
      actions: [
        { label: 'Manage Device Types Tab', actionType: 'navigate_tab', payload: { tab: 'device_classifications' } },
      ],
      suggestions: [
        'add device type Load Balancer code LB',
        'Find ips used port 80',
      ],
    };
  }

  // =========================================================================
  // 7. PING / LIVE CONNECTIVITY CHECK
  // =========================================================================
  if (fuzzy.intent === 'PING_IP') {
    let targetIpToPing = extractedIp;

    if (!targetIpToPing) {
      // Try resolving from partial IP, octet, or hostname in query
      const pingArg = trimmed.replace(/^(?:ping|probe|check|test|pign|png)\s+/i, '').trim();
      if (pingArg) {
        const matched = allowedIPs.find(
          (r) =>
            r.ip === pingArg ||
            r.ip.endsWith(`.${pingArg}`) ||
            r.ip.endsWith(pingArg) ||
            r.ip.includes(pingArg) ||
            (r.hostname && r.hostname.toLowerCase() === pingArg.toLowerCase()) ||
            (r.hostname && r.hostname.toLowerCase().includes(pingArg.toLowerCase()))
        );
        if (matched) {
          targetIpToPing = matched.ip;
        } else if (isValidIPv4(pingArg)) {
          targetIpToPing = pingArg;
        }
      }
    }

    if (!targetIpToPing) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⚠️ **Please specify a valid IPv4 address or hostname to ping.**\nExample: \`ping 192.168.10.10\` or \`ping 10.10\``,
        suggestions: ['Ping 127.0.0.1', 'Ping 192.168.10.1', 'Find 10.10'],
      };
    }

    const existing = allowedIPs.find((rec) => rec.ip === targetIpToPing);

    try {
      const pingRes = await ctx.pingIP(existing ? existing.id : targetIpToPing);
      const isOnline = Boolean(pingRes.online || pingRes.status === 'online');
      const latency = pingRes.latencyMs ?? (isOnline ? 1 : 0);
      const hostname = pingRes.hostname || existing?.hostname;
      const openPorts = pingRes.openPorts && pingRes.openPorts.length > 0 ? pingRes.openPorts : undefined;
      const mac = pingRes.macAddress || existing?.macAddress;

      if (openPorts && openPorts.length > 0) {
        autoLearnFromProbe(targetIpToPing, openPorts, hostname);
      }

      const parentSubnet = existing
        ? ctx.subnets.find((s) => s.id === existing.subnetId)
        : ctx.subnets.find((s) => isIpInSubnet(targetIpToPing!, s.cidr));

      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `📡 **ICMP / TCP Ping Probe Result for \`${targetIpToPing}\`:**

- **Status**: ${isOnline ? '🟢 **ONLINE (Active Responder)**' : '🔴 **OFFLINE / Unreachable**'}
- **Latency**: ${isOnline ? `⚡ ${latency} ms` : 'N/A (No ICMP Reply / Timeout)'}
${hostname ? `- **Reverse DNS / Hostname**: \`${hostname}\`` : ''}
${mac && mac !== '00:00:00:00:00:00' ? `- **MAC Address**: \`${mac}\`` : ''}
${parentSubnet ? `- **Subnet**: **${parentSubnet.name}** (\`${parentSubnet.cidr}\`)` : ''}
${openPorts ? `- **Open Ports Detected**: \`${openPorts.join(', ')}\`` : ''}`,
        ipCards: existing ? [existing] : undefined,
        actions: parentSubnet
          ? [
              { label: 'View in Subnet', actionType: 'view_subnet', payload: { subnetId: parentSubnet.id, ip: targetIpToPing } },
              { label: 'Ping Again', actionType: 'ping', payload: { ip: targetIpToPing } },
            ]
          : [
              { label: 'Ping Again', actionType: 'ping', payload: { ip: targetIpToPing } },
              { label: 'Allocate this IP', actionType: 'quick_prompt', payload: `Allocate IP ${targetIpToPing}` },
            ],
      };
    } catch (e: any) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `❌ Error probing \`${targetIpToPing}\`: ${e.message || 'Connection test failed'}`,
      };
    }
  }

  // =========================================================================
  // 8. NEXT AVAILABLE / FREE IP QUERY
  // =========================================================================
  if (
    lower.includes('next free') ||
    lower.includes('next available') ||
    lower.includes('find next ip') ||
    lower.includes('available ip in') ||
    lower.includes('suggest free ip')
  ) {
    const target = targetSubnet || allowedSubnets[0];
    if (!target) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⚠️ **No accessible subnets found for your account.** Please verify your assigned subnet permissions.`,
      };
    }

    if (!allowedSubnets.some((s) => s.id === target.id)) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⛔ **Access Denied**: You do not have permission to view or manage IPs in Subnet **${target.name}** (\`${target.cidr}\`).`,
        isSecurityAlert: true,
      };
    }

    const nextIp = findNextAvailableIp(target, ctx.ips);
    if (!nextIp) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⚠️ **Subnet Exhausted**: All usable IP addresses in **${target.name}** (\`${target.cidr}\`) are currently allocated or reserved.`,
      };
    }

    const canAllocate = ctx.hasPermission('allocateIP');

    return {
      id: messageId,
      sender: 'bot',
      timestamp: now,
      text: `💡 **Next Available IP Address:**

- **IP Address**: \`${nextIp}\`
- **Target Subnet**: **${target.name}** (\`${target.cidr}\`)
- **Gateway**: \`${target.gateway}\`
- **Location**: ${target.location}

${canAllocate ? 'Would you like to allocate this IP now?' : '*(Note: Your account does not have allocateIP permission)*'}`,
      actions: canAllocate
        ? [
            {
              label: `Allocate ${nextIp}`,
              actionType: 'quick_prompt',
              payload: `Allocate IP ${nextIp} in ${target.name}`,
              variant: 'primary',
            },
            {
              label: `Ping ${nextIp}`,
              actionType: 'ping',
              payload: { ip: nextIp },
              variant: 'outline',
            },
            {
              label: `View Subnet`,
              actionType: 'view_subnet',
              payload: { subnetId: target.id },
              variant: 'secondary',
            },
          ]
        : [],
      suggestions: [
        `Allocate IP ${nextIp} to web-server`,
        'Subnet utilization summary',
      ],
    };
  }

  // =========================================================================
  // 9. ALLOCATE IP ADDRESS
  // =========================================================================
  if (fuzzy.intent === 'ALLOCATE_IP') {
    if (!ctx.hasPermission('allocateIP')) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⛔ **Permission Denied**: Your account (@${ctx.currentUser?.username}) does not have the **allocateIP** permission required to allocate IP addresses.`,
        isSecurityAlert: true,
      };
    }

    let subnetToUse = targetSubnet;
    let ipToAllocate = extractedIp;

    if (!subnetToUse && ipToAllocate) {
      subnetToUse = ctx.subnets.find((s) => isIpInSubnet(ipToAllocate!, s.cidr));
    }

    if (!subnetToUse) {
      subnetToUse = allowedSubnets[0];
    }

    if (!subnetToUse) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⚠️ **No accessible subnet found.** Please create a subnet first or verify your permissions.`,
      };
    }

    if (!allowedSubnets.some((s) => s.id === subnetToUse!.id)) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⛔ **Scope Restriction**: You cannot allocate IPs in Subnet **${subnetToUse.name}** (\`${subnetToUse.cidr}\`). Your account is restricted to assigned subnets only.`,
        isSecurityAlert: true,
      };
    }

    if (!ipToAllocate) {
      ipToAllocate = findNextAvailableIp(subnetToUse, ctx.ips);
      if (!ipToAllocate) {
        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: `⚠️ **Subnet Full**: No free IP addresses available in **${subnetToUse.name}** (\`${subnetToUse.cidr}\`).`,
        };
      }
    }

    if (!isIpInSubnet(ipToAllocate, subnetToUse.cidr)) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⚠️ **CIDR Mismatch**: IP \`${ipToAllocate}\` is outside the bounds of subnet **${subnetToUse.name}** (\`${subnetToUse.cidr}\`).`,
      };
    }

    const existingAlloc = ctx.ips.find(
      (r) => r.subnetId === subnetToUse!.id && r.ip === ipToAllocate && r.status !== 'available'
    );
    if (existingAlloc) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⚠️ **IP Already Allocated**: \`${ipToAllocate}\` is already registered to **${existingAlloc.hostname || 'Unknown Host'}** with status **${existingAlloc.status.toUpperCase()}**.`,
        ipCards: [existingAlloc],
      };
    }

    let hostname: string | undefined;
    const hostMatch = trimmed.match(/(?:to|for|hostname|host)\s+(?:to\s+|is\s+|:\s*|=?\s*)?([a-zA-Z0-9_\-\.]+)/i);
    if (hostMatch && hostMatch[1] && !isValidIPv4(hostMatch[1])) {
      const candidate = hostMatch[1].trim();
      if (!['to', 'is', 'as', 'the', 'a', 'ip', 'in'].includes(candidate.toLowerCase())) {
        hostname = candidate;
      }
    }

    let notes: string | undefined;
    const descMatch = trimmed.match(/(?:description|notes|desc|purpose)\s+[:=]?\s*([^,\n]+)/i);
    if (descMatch && descMatch[1]) {
      notes = descMatch[1].trim();
    }

    let deviceType = 'server';
    if (lower.includes('router')) deviceType = 'router';
    else if (lower.includes('switch')) deviceType = 'switch';
    else if (lower.includes('firewall')) deviceType = 'firewall';
    else if (lower.includes('workstation') || lower.includes('pc')) deviceType = 'workstation';
    else if (lower.includes('vm') || lower.includes('virtual')) deviceType = 'vm';
    else if (lower.includes('storage')) deviceType = 'storage';
    else if (lower.includes('iot')) deviceType = 'iot';

    const allocResult = await ctx.allocateIP({
      ip: ipToAllocate,
      subnetId: subnetToUse.id,
      status: 'allocated',
      hostname: hostname || `host-${ipToAllocate.replace(/\./g, '-')}`,
      deviceType,
      notes: notes || 'Allocated via IPAM Assistant',
      owner: ctx.currentUser?.fullName || ctx.currentUser?.username,
      department: ctx.currentUser?.department || 'Infrastructure',
    });

    if (allocResult.success && allocResult.ip) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `✅ **IP Address Allocated Successfully!**

- **IP Address**: \`${allocResult.ip.ip}\`
- **Hostname**: **${allocResult.ip.hostname}**
- **Subnet**: **${subnetToUse.name}** (\`${subnetToUse.cidr}\`)
- **Device Class**: \`${allocResult.ip.deviceType}\`
- **Owner**: ${allocResult.ip.owner}
- **Allocated By**: @${ctx.currentUser?.username}`,
        ipCards: [allocResult.ip],
        actions: [
          { label: 'View in Subnet Table', actionType: 'view_subnet', payload: { subnetId: subnetToUse.id } },
          { label: 'Ping Live', actionType: 'ping', payload: { ipId: allocResult.ip.id, ip: allocResult.ip.ip } },
        ],
        suggestions: [
          `Find IP ${allocResult.ip.ip}`,
          `Ping ${allocResult.ip.ip}`,
          'Subnet utilization summary',
        ],
      };
    } else {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `❌ **Allocation Failed**: ${allocResult.message}`,
      };
    }
  }

  // =========================================================================
  // 10. UPDATE IP ADDRESS
  // =========================================================================
  if (
    lower.startsWith('update ip') ||
    lower.startsWith('change hostname') ||
    lower.startsWith('edit ip') ||
    lower.startsWith('set status') ||
    (lower.includes('update') && extractedIp)
  ) {
    if (!ctx.hasPermission('editIP')) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⛔ **Permission Denied**: Your account (@${ctx.currentUser?.username}) does not have the **editIP** permission required to modify IP records.`,
        isSecurityAlert: true,
      };
    }

    if (!extractedIp) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⚠️ **Please specify the IP address you want to update.**\nExample: \`update IP 192.168.10.15 hostname to web-prod-01\``,
      };
    }

    const targetRecord = allowedIPs.find((r) => r.ip === extractedIp);
    if (!targetRecord) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⚠️ **IP Record Not Found**: \`${extractedIp}\` is not registered or not accessible within your permitted subnets.`,
      };
    }

    const updates: Partial<IPRecord> = {};

    const hostMatch = trimmed.match(/(?:hostname|name|host)\s+(?:to\s+|is\s+|:\s*|=?\s*)?([a-zA-Z0-9_\-\.]+)/i);
    if (hostMatch && hostMatch[1] && !isValidIPv4(hostMatch[1])) {
      const candidate = hostMatch[1].trim();
      if (!['to', 'is', 'as', 'the', 'a', 'ip'].includes(candidate.toLowerCase())) {
        updates.hostname = candidate;
      }
    }

    if (lower.includes('reserved') || lower.includes('reserve')) updates.status = 'reserved';
    else if (lower.includes('allocated')) updates.status = 'allocated';
    else if (lower.includes('available')) updates.status = 'available';
    else if (lower.includes('dhcp')) updates.status = 'dhcp';

    if (lower.includes('server')) updates.deviceType = 'server';
    else if (lower.includes('router')) updates.deviceType = 'router';
    else if (lower.includes('switch')) updates.deviceType = 'switch';
    else if (lower.includes('firewall')) updates.deviceType = 'firewall';
    else if (lower.includes('workstation')) updates.deviceType = 'workstation';

    const ownerMatch = trimmed.match(/(?:owner|assigned to)\s+([a-zA-Z0-9_\-\. ]+)/i);
    if (ownerMatch && ownerMatch[1]) {
      updates.owner = ownerMatch[1].trim();
    }

    const notesMatch = trimmed.match(/(?:notes|description|desc)\s+[:=]?\s*([^,\n]+)/i);
    if (notesMatch && notesMatch[1]) {
      updates.notes = notesMatch[1].trim();
    }

    if (Object.keys(updates).length === 0) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⚠️ **No changes specified.** What would you like to update on \`${extractedIp}\`?\nExample: \`update IP ${extractedIp} hostname to app-server-02 status to reserved\``,
        ipCards: [targetRecord],
      };
    }

    ctx.updateIP(targetRecord.id, updates);
    const updatedRecord = { ...targetRecord, ...updates };

    return {
      id: messageId,
      sender: 'bot',
      timestamp: now,
      text: `✅ **IP Record Updated Successfully!**

- **IP Address**: \`${updatedRecord.ip}\`
- **Updated Fields**: ${Object.keys(updates).map((k) => `\`${k}: ${String((updates as any)[k])}\``).join(', ')}`,
      ipCards: [updatedRecord],
      actions: [
        { label: 'View in Subnet', actionType: 'view_subnet', payload: { subnetId: updatedRecord.subnetId } },
        { label: 'Ping', actionType: 'ping', payload: { ipId: updatedRecord.id, ip: updatedRecord.ip } },
      ],
    };
  }

  // =========================================================================
  // 11. RELEASE / DELETE IP ADDRESS
  // =========================================================================
  if (fuzzy.intent === 'RELEASE_IP') {
    if (!ctx.hasPermission('releaseIP')) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⛔ **Permission Denied**: Your account (@${ctx.currentUser?.username}) does not have the **releaseIP** permission required to deallocate IP addresses.`,
        isSecurityAlert: true,
      };
    }

    if (!extractedIp) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⚠️ **Please specify the IP address you want to release.**\nExample: \`release IP 192.168.10.25\``,
      };
    }

    const targetRecord = allowedIPs.find((r) => r.ip === extractedIp);
    if (!targetRecord) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⚠️ **IP Record Not Found**: \`${extractedIp}\` is not currently allocated in any of your permitted subnets.`,
      };
    }

    ctx.releaseIP(targetRecord.id);

    return {
      id: messageId,
      sender: 'bot',
      timestamp: now,
      text: `🗑️ **IP Address \`${extractedIp}\` Released / Deallocated.**\nIt is now marked as **AVAILABLE** in the pool.`,
      actions: [
        { label: 'View Subnet', actionType: 'view_subnet', payload: { subnetId: targetRecord.subnetId } },
      ],
      suggestions: [
        'Show next available IP',
        'Subnet utilization summary',
      ],
    };
  }

  // =========================================================================
  // 12. LIST ALLOCATED / SPECIFIC IPs
  // =========================================================================
  if (
    !lower.includes('port') &&
    !lower.includes('ports') &&
    !lower.includes('note') &&
    !lower.includes('notes') &&
    !lower.includes('that use') &&
    !lower.includes('that uses') &&
    !lower.includes('using port') &&
    !lower.includes('used port') &&
    (lower.includes('allocated') ||
      lower.includes('which ip is allocate') ||
      lower.includes('list ips') ||
      lower.includes('list all ips') ||
      lower.includes('show all ips') ||
      lower.includes('list servers') ||
      lower.includes('list switches'))
  ) {
    let filtered = allowedIPs.filter((r) => r.status !== 'available');

    if (targetSubnet) {
      filtered = filtered.filter((r) => r.subnetId === targetSubnet!.id);
    }

    if (lower.includes('server')) filtered = filtered.filter((r) => r.deviceType?.toLowerCase() === 'server');
    else if (lower.includes('switch')) filtered = filtered.filter((r) => r.deviceType?.toLowerCase() === 'switch');
    else if (lower.includes('router')) filtered = filtered.filter((r) => r.deviceType?.toLowerCase() === 'router');
    else if (lower.includes('firewall')) filtered = filtered.filter((r) => r.deviceType?.toLowerCase() === 'firewall');

    if (filtered.length === 0) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `📋 **No matching allocated IP records found**${targetSubnet ? ` in **${targetSubnet.name}**` : ''}.`,
        suggestions: ['Find next available IP', 'Subnet utilization summary'],
      };
    }

    return {
      id: messageId,
      sender: 'bot',
      timestamp: now,
      text: `📋 **Allocated IP Records (${filtered.length} total)${targetSubnet ? ` in ${targetSubnet.name}` : ''}:**`,
      ipCards: filtered.slice(0, 6),
      actions: targetSubnet
        ? [{ label: `Open ${targetSubnet.name}`, actionType: 'view_subnet', payload: { subnetId: targetSubnet.id } }]
        : [{ label: 'Go to Subnets', actionType: 'navigate_tab', payload: { tab: 'subnets' } }],
    };
  }

  // =========================================================================
  // 13. UNIVERSAL DEEP SEARCH & AUTOMATIC NOTES SCANNER (Exact, Partial, Port, Notes)
  // =========================================================================
  if (
    fuzzy.intent === 'WHO_USES_OR_FIND' ||
    lower.startsWith('find ') ||
    lower.startsWith('search ') ||
    lower.startsWith('who has ') ||
    lower.startsWith('who use') ||
    lower.startsWith('lookup ') ||
    lower.startsWith('scan ') ||
    lower.startsWith('print ') ||
    lower.includes('port') ||
    lower.includes('ports') ||
    lower.includes('note') ||
    lower.includes('notes') ||
    extractedIp ||
    /\b(?:\d{1,3}\.){1,3}\d{0,3}\b/.test(trimmed) ||
    /^\.?\d{1,3}$/.test(trimmed)
  ) {
    // 1. Exact IP match
    if (extractedIp) {
      const match = allowedIPs.find((r) => r.ip === extractedIp);
      if (match) {
        const sub = ctx.subnets.find((s) => s.id === match.subnetId);
        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: `🔍 **IP Record & Ownership Details for \`${extractedIp}\`:**

- **Assigned User / Owner**: **${match.owner || 'Unassigned'}**
- **Hostname**: **${match.hostname || 'No Hostname'}**
- **Status**: \`${match.status.toUpperCase()}\`
- **Subnet**: **${sub?.name || 'Unknown'}** (\`${sub?.cidr || ''}\`)
- **Device Class**: \`${match.deviceType || 'Other'}\`
- **Department**: ${match.department || 'Infrastructure'}
- **MAC Address**: \`${match.macAddress || 'Dynamic ARP'}\`
${match.notes ? `- **Notes**: ${match.notes}` : ''}`,
          ipCards: [match],
          actions: [
            { label: 'View in Subnet Table', actionType: 'view_subnet', payload: { subnetId: match.subnetId } },
            { label: 'Ping Live', actionType: 'ping', payload: { ipId: match.id, ip: match.ip } },
          ],
        };
      } else {
        const parentSubnet = allowedSubnets.find((s) => isIpInSubnet(extractedIp, s.cidr));
        if (parentSubnet) {
          const canAlloc = ctx.hasPermission('allocateIP');
          return {
            id: messageId,
            sender: 'bot',
            timestamp: now,
            text: `ℹ️ **IP \`${extractedIp}\` is currently UNALLOCATED (Available)** in Subnet **${parentSubnet.name}** (\`${parentSubnet.cidr}\`).`,
            actions: canAlloc
              ? [
                  {
                    label: `Allocate ${extractedIp}`,
                    actionType: 'quick_prompt',
                    payload: `Allocate IP ${extractedIp}`,
                    variant: 'primary',
                  },
                  {
                    label: `Ping ${extractedIp}`,
                    actionType: 'ping',
                    payload: { ip: extractedIp },
                  },
                ]
              : [],
          };
        } else {
          return {
            id: messageId,
            sender: 'bot',
            timestamp: now,
            text: `⚠️ **IP \`${extractedIp}\` not found in any registered subnets** (or outside your allowed scope).`,
          };
        }
      }
    }

    // 2. Comprehensive Search Engine: Octet Matching (10.1, 115), Hostnames (vm), Notes, Subnets
    const rawSearch = trimmed
      .replace(/^(find|search|lookup|who has|who uses|who use|where is|scan|show|get|ip for)\s+/i, '')
      .trim();
    const cleanFrag = rawSearch.startsWith('.') ? rawSearch.substring(1) : rawSearch;
    const lowerSearch = rawSearch.toLowerCase();

    // Check if user explicitly asked for port scan
    const hasExplicitPortQuery =
      /\bports?\b/i.test(lower) ||
      /\b(tcp|udp|listening)\b/i.test(lower) ||
      /:\d{2,5}\b/.test(lower) ||
      (!rawSearch.includes('.') && /^\d{2,5}$/.test(rawSearch) && ['80', '443', '22', '53', '25', '389', '636', '3306', '5432', '8080', '8443', '6379', '27017', '3389', '161', '123', '21', '23', '3000', '5000', '8000', '9000'].includes(rawSearch));

    if (hasExplicitPortQuery) {
      const searchRes = deepSearchDatabase(trimmed, allowedIPs, ctx.subnets);

      if (searchRes.results.length > 0) {
        const portDefinitions = searchRes.learnedMatches.filter(
          (m) => m.topic === 'port_mapping' && searchRes.detectedPorts.includes(m.key)
        );

        let headerText = `🔍 **Deep Database & Notes Scan Results**`;
        if (searchRes.detectedPorts.length > 1) {
          headerText = `🔍 **Found ${searchRes.results.length} IP(s) matching Ports \`${searchRes.detectedPorts.join(', ')}\`**${searchRes.detectedService ? ` (${searchRes.detectedService})` : ''}:`;
        } else if (searchRes.detectedPorts.length === 1) {
          headerText = `🔍 **Found ${searchRes.results.length} IP(s) matching Port \`${searchRes.detectedPorts[0]}\`**${searchRes.detectedService ? ` (${searchRes.detectedService})` : ''}:`;
        }

        const matchSummaries = searchRes.results.slice(0, 6).map((r) => {
          const sub = ctx.subnets.find((s) => s.id === r.ip.subnetId);
          const reasonStr = r.matchReasons.length > 0 ? `\n  - *${r.matchReasons.join(', ')}*` : '';
          return `• \`${r.ip.ip}\` (**${r.ip.hostname || 'Unassigned'}**) — Owner: *${r.ip.owner || 'N/A'}*, Subnet: *${sub?.name || 'Unknown'}* (${r.ip.status.toUpperCase()})${reasonStr}`;
        });

        let fullText = `${headerText}\n\n${matchSummaries.join('\n')}`;
        if (portDefinitions.length > 0) {
          fullText += `\n\n📌 **Port Definitions**:\n` + portDefinitions.map((p) => `• Port \`${p.key}\`: *${p.value}*`).join('\n');
        }

        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: fullText,
          ipCards: searchRes.results.map((r) => r.ip).slice(0, 5),
          actions: searchRes.results[0]
            ? [
                { label: 'View in Subnet', actionType: 'view_subnet', payload: { subnetId: searchRes.results[0].ip.subnetId } },
                { label: `Ping ${searchRes.results[0].ip.ip}`, actionType: 'ping', payload: { ip: searchRes.results[0].ip.ip } },
              ]
            : undefined,
          suggestions: ['Subnet utilization summary', 'Menu'],
        };
      } else {
        const portStr = searchRes.detectedPorts.join(', ');
        return {
          id: messageId,
          sender: 'bot',
          timestamp: now,
          text: `🔍 **Database Scan for Port(s) \`${portStr}\`:**\n\n⚠️ No active IP records currently have Port \`${portStr}\` documented in their notes or hostname.`,
          actions: [
            { label: 'Subnet Utilization', actionType: 'quick_prompt', payload: 'subnet utilization summary' },
            { label: '🏠 Main Menu', actionType: 'quick_prompt', payload: 'menu', variant: 'secondary' },
          ],
          suggestions: ['Subnet utilization summary', 'Menu'],
        };
      }
    }

    // --- Standard Non-Port Search (Octets, Hostname, Notes, Subnet, Device Type) ---
    const isSingleOctet = /^\.?\d{1,3}$/.test(rawSearch);
    const isTwoOctets = /^\d{1,3}\.\d{1,3}$/.test(rawSearch);

    const matchingIPs = allowedIPs.filter((r) => {
      const ipParts = r.ip.split('.');

      // 1. Single octet match: last octet equals cleanFrag (e.g. "115" -> xxx.xxx.xxx.115)
      if (isSingleOctet && ipParts.length === 4) {
        if (ipParts[3] === cleanFrag) return true;
      }

      // 2. Two octet match (e.g. "10.1" -> 3rd octet is 10 and 4th is 1, or ends in .10.1, or starts with 10.1.)
      if (isTwoOctets && ipParts.length === 4) {
        const [oct3, oct4] = rawSearch.split('.');
        if (ipParts[2] === oct3 && ipParts[3] === oct4) return true;
        if (r.ip.endsWith(`.${rawSearch}`)) return true;
        if (r.ip.startsWith(`${rawSearch}.`)) return true;
      }

      // 3. Substring in IP address
      if (r.ip.includes(rawSearch) || r.ip.endsWith(`.${cleanFrag}`)) return true;

      // 4. Hostname match (e.g. "vm", "server", "web-01")
      if (r.hostname && r.hostname.toLowerCase().includes(lowerSearch)) return true;

      // 5. Device type / category match (e.g. "server", "switch", "router", "vm")
      if (r.deviceType && r.deviceType.toLowerCase().includes(lowerSearch)) return true;

      // 6. Notes match (e.g. "vm", "database", "snmp")
      if (r.notes && r.notes.toLowerCase().includes(lowerSearch)) return true;

      // 7. Owner, Department, MAC
      if (r.owner && r.owner.toLowerCase().includes(lowerSearch)) return true;
      if (r.department && r.department.toLowerCase().includes(lowerSearch)) return true;
      if (r.macAddress && r.macAddress.toLowerCase().includes(lowerSearch)) return true;

      return false;
    });

    // 2.1 Single Match Found
    if (matchingIPs.length === 1) {
      const single = matchingIPs[0];
      const sub = ctx.subnets.find((s) => s.id === single.subnetId);
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `🔍 **IP Record & Details for \`${single.ip}\` (Matching \`${rawSearch}\`):**

- **Assigned User / Owner**: **${single.owner || 'Unassigned'}**
- **Hostname**: **${single.hostname || 'No Hostname'}**
- **Status**: \`${single.status.toUpperCase()}\`
- **Subnet**: **${sub?.name || 'Unknown'}** (\`${sub?.cidr || ''}\`)
- **Device Class**: \`${single.deviceType || 'Other'}\`
- **Department**: ${single.department || 'Infrastructure'}
- **MAC Address**: \`${single.macAddress || 'Dynamic ARP'}\`
${single.notes ? `- **Notes**: ${single.notes}` : ''}`,
        ipCards: [single],
        actions: [
          { label: 'View in Subnet Table', actionType: 'view_subnet', payload: { subnetId: single.subnetId, ip: single.ip } },
          { label: `Ping ${single.ip}`, actionType: 'ping', payload: { ip: single.ip } },
          { label: '🏠 Main Menu', actionType: 'quick_prompt', payload: 'menu', variant: 'secondary' },
        ],
        suggestions: [
          `Ping ${single.ip}`,
          'Find next available IP',
          'List all allocated IPs',
          'Menu',
        ],
      };
    }

    // 2.2 Multiple Matches Found
    if (matchingIPs.length > 1) {
      const summaries = matchingIPs.slice(0, 6).map((r) => {
        const sub = ctx.subnets.find((s) => s.id === r.subnetId);
        return `• \`${r.ip}\` (**${r.hostname || 'No Host'}**) — Owner: *${r.owner || 'N/A'}*, Subnet: *${sub?.name || 'Unknown'}* (\`${r.status.toUpperCase()}\`)`;
      });

      const actions: ChatAction[] = [];
      matchingIPs.slice(0, 4).forEach((r) => {
        actions.push({
          label: `🔍 ${r.ip} (${r.hostname || 'Host'})`,
          actionType: 'quick_prompt',
          payload: `find ${r.ip}`,
          variant: 'outline',
        });
      });
      if (matchingIPs[0]) {
        actions.push({
          label: `📡 Ping ${matchingIPs[0].ip}`,
          actionType: 'ping',
          payload: { ip: matchingIPs[0].ip },
          variant: 'secondary',
        });
      }
      actions.push({
        label: '🏠 Main Menu',
        actionType: 'quick_prompt',
        payload: 'menu',
        variant: 'secondary',
      });

      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `🔍 **Matching Endpoints for \`${rawSearch}\` (${matchingIPs.length} match(es)):**\n\n${summaries.join('\n')}\n\nSelect an IP to inspect or ping:`,
        ipCards: matchingIPs.slice(0, 6),
        actions,
        suggestions: [
          `Find ${matchingIPs[0].ip}`,
          `Ping ${matchingIPs[0].ip}`,
          'Subnets',
          'Menu',
        ],
      };
    }

    // 2.3 Zero Allocated IP Matches — Check Subnets & Compute Free Candidate IPs
    // A) If single octet (e.g. "115" -> check if any subnet has candidate *.115 available)
    if (isSingleOctet) {
      const octetNum = parseInt(cleanFrag, 10);
      if (octetNum >= 1 && octetNum <= 254) {
        const freeCandidates: Array<{ ip: string; subnet: Subnet }> = [];
        const allocatedSet = new Set(ctx.ips.filter((r) => r.status !== 'available').map((r) => r.ip));

        for (const sub of allowedSubnets) {
          const info = parseCIDR(sub.cidr);
          if (!info) continue;
          const parts = info.firstUsableIp.split('.');
          const candIp = `${parts[0]}.${parts[1]}.${parts[2]}.${octetNum}`;
          if (isIpInSubnet(candIp, sub.cidr) && !allocatedSet.has(candIp)) {
            if (!freeCandidates.some((c) => c.ip === candIp)) {
              freeCandidates.push({ ip: candIp, subnet: sub });
            }
          }
        }

        if (freeCandidates.length > 0) {
          const actions: ChatAction[] = [];
          if (ctx.hasPermission('allocateIP')) {
            actions.push({
              label: `⚡ Allocate ${freeCandidates[0].ip}`,
              actionType: 'quick_prompt',
              payload: `allocate ${freeCandidates[0].ip}`,
              variant: 'primary',
            });
            if (freeCandidates.length > 1) {
              actions.push({
                label: `⚡ Allocate ${freeCandidates[1].ip}`,
                actionType: 'quick_prompt',
                payload: `allocate ${freeCandidates[1].ip}`,
                variant: 'outline',
              });
            }
          }
          actions.push({
            label: `📡 Ping ${freeCandidates[0].ip}`,
            actionType: 'ping',
            payload: { ip: freeCandidates[0].ip },
            variant: 'secondary',
          });
          actions.push({ label: '🌐 Subnets List', actionType: 'quick_prompt', payload: 'subnets', variant: 'secondary' });
          actions.push({ label: '🏠 Main Menu', actionType: 'quick_prompt', payload: 'menu', variant: 'secondary' });

          return {
            id: messageId,
            sender: 'bot',
            timestamp: now,
            text: `🔍 **Host Search for Last Octet \`.${cleanFrag}\` (\`*.${cleanFrag}\`):**\n\n` +
              `No allocated IP currently ends with \`.${cleanFrag}\`.\n\n` +
              `💡 **Available candidate addresses in your subnets:**\n` +
              freeCandidates.map((c) => `• \`${c.ip}\` in Subnet **${c.subnet.name}** (\`${c.subnet.cidr}\`) — **AVAILABLE (Free)**`).join('\n') +
              `\n\nClick an action below to allocate or ping:`,
            actions,
            suggestions: [
              `Allocate ${freeCandidates[0].ip}`,
              `Ping ${freeCandidates[0].ip}`,
              'Subnets',
              'Menu',
            ],
          };
        }
      }
    }

    // B) If two octets (e.g. "10.1" -> check if any subnet covers *.10.1 or 10.1.*)
    if (isTwoOctets) {
      const [oct3, oct4] = rawSearch.split('.').map((p) => parseInt(p, 10));
      if (oct3 >= 0 && oct3 <= 255 && oct4 >= 1 && oct4 <= 254) {
        const freeTwoOctetCandidates: Array<{ ip: string; subnet: Subnet }> = [];
        const allocatedSet = new Set(ctx.ips.filter((r) => r.status !== 'available').map((r) => r.ip));

        for (const sub of allowedSubnets) {
          const info = parseCIDR(sub.cidr);
          if (!info) continue;
          const parts = info.firstUsableIp.split('.');
          if (parts[2] === String(oct3) || parts[1] === String(oct3)) {
            const candIp = `${parts[0]}.${parts[1]}.${oct3}.${oct4}`;
            if (isIpInSubnet(candIp, sub.cidr) && !allocatedSet.has(candIp)) {
              if (!freeTwoOctetCandidates.some((c) => c.ip === candIp)) {
                freeTwoOctetCandidates.push({ ip: candIp, subnet: sub });
              }
            }
          }
        }

        if (freeTwoOctetCandidates.length > 0) {
          const actions: ChatAction[] = [];
          if (ctx.hasPermission('allocateIP')) {
            actions.push({
              label: `⚡ Allocate ${freeTwoOctetCandidates[0].ip}`,
              actionType: 'quick_prompt',
              payload: `allocate ${freeTwoOctetCandidates[0].ip}`,
              variant: 'primary',
            });
          }
          actions.push({
            label: `📡 Ping ${freeTwoOctetCandidates[0].ip}`,
            actionType: 'ping',
            payload: { ip: freeTwoOctetCandidates[0].ip },
            variant: 'secondary',
          });
          actions.push({ label: '🌐 Subnets List', actionType: 'quick_prompt', payload: 'subnets', variant: 'secondary' });
          actions.push({ label: '🏠 Main Menu', actionType: 'quick_prompt', payload: 'menu', variant: 'secondary' });

          return {
            id: messageId,
            sender: 'bot',
            timestamp: now,
            text: `🔍 **IP Search for \`${rawSearch}\` (Last two octets \`*.${rawSearch}\`):**\n\n` +
              `No allocated IP currently ends with \`.${rawSearch}\`.\n\n` +
              `💡 **Available candidate address in your subnets:**\n` +
              freeTwoOctetCandidates.map((c) => `• \`${c.ip}\` in Subnet **${c.subnet.name}** (\`${c.subnet.cidr}\`) — **AVAILABLE (Free)**`).join('\n') +
              `\n\nClick an action below to allocate or ping:`,
            actions,
            suggestions: [
              `Allocate ${freeTwoOctetCandidates[0].ip}`,
              `Ping ${freeTwoOctetCandidates[0].ip}`,
              'Subnets',
              'Menu',
            ],
          };
        }
      }
    }

    // C) Check if matching Subnets
    const matchedSubnets = allowedSubnets.filter(
      (s) =>
        s.cidr.includes(rawSearch) ||
        s.name.toLowerCase().includes(lowerSearch) ||
        (s.description && s.description.toLowerCase().includes(lowerSearch))
    );

    if (matchedSubnets.length > 0) {
      const subActions: ChatAction[] = matchedSubnets.slice(0, 4).map((s) => ({
        label: `🌐 ${s.name} (${s.cidr})`,
        actionType: 'quick_prompt',
        payload: `subnet overview ${s.id}`,
        variant: 'outline',
      }));
      subActions.push({ label: '🏠 Main Menu', actionType: 'quick_prompt', payload: 'menu', variant: 'secondary' });

      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `🔍 **No active allocated IP matched \`${rawSearch}\`**, but found **${matchedSubnets.length} matching subnet(s)**:\n\n` +
          matchedSubnets.map((s) => `• Subnet **${s.name}** (\`${s.cidr}\`) — Gateway: \`${s.gateway || 'N/A'}\``).join('\n') +
          `\n\nSelect a subnet below to inspect utilization or view available free IPs:`,
        actions: subActions,
        suggestions: [
          `Free IPs in ${matchedSubnets[0].name}`,
          `Subnet overview ${matchedSubnets[0].name}`,
          'Subnets',
          'Menu',
        ],
      };
    }

    // D) Fallback when nothing matched
    return {
      id: messageId,
      sender: 'bot',
      timestamp: now,
      text: `🔍 **Search Results for \`${rawSearch}\`:**\n\n` +
        `No active allocated IP records, hostnames, device types, notes, or subnets matched **\`${rawSearch}\`**.\n\n` +
        `💡 **Search Tips:**\n` +
        `• **Host Octet**: Enter e.g. \`115\` to find hosts ending in \`.115\`\n` +
        `• **Subnet Octets**: Enter e.g. \`20.1\` or \`10.1\` to find \`xxx.xxx.10.1\`\n` +
        `• **Hostname**: Enter e.g. \`vm\`, \`server\`, \`gw\`, \`db\`\n` +
        `• **Browse Subnets**: View all available free IPs directly`,
      actions: [
        { label: '🌐 Browse Subnets', actionType: 'quick_prompt', payload: 'subnets', variant: 'primary' },
        { label: '🔍 Find Another IP', actionType: 'quick_prompt', payload: 'find ip', variant: 'outline' },
        { label: '🏠 Main Menu', actionType: 'quick_prompt', payload: 'menu', variant: 'secondary' },
      ],
      suggestions: [
        'Subnets',
        'Find ip',
        'Menu',
      ],
    };
  }

  // =========================================================================
  // 13.5. LEARNED KNOWLEDGE & MEMORY VIEW
  // =========================================================================
  if (fuzzy.intent === 'LEARN_OR_MEMORY') {
    const knowledge = getLearnedKnowledge();
    const autoNotesItems = knowledge.filter((k) => k.source === 'notes_scan');
    const probedItems = knowledge.filter((k) => k.source === 'live_probe');
    const userItems = knowledge.filter((k) => k.source === 'user_taught');

    const sections: string[] = [];

    if (autoNotesItems.length > 0) {
      sections.push(
        `📝 **Automatically Learned from IP Notes (${autoNotesItems.length}):**\n` +
          autoNotesItems.slice(0, 8).map((k) => `• ${k.value}`).join('\n')
      );
    }

    if (probedItems.length > 0) {
      sections.push(
        `📡 **Learned from Live Probes & Scans (${probedItems.length}):**\n` +
          probedItems.slice(0, 5).map((k) => `• ${k.value}`).join('\n')
      );
    }

    if (userItems.length > 0) {
      sections.push(
        `💡 **Custom Notes & Aliases (${userItems.length}):**\n` +
          userItems.slice(0, 5).map((k) => `• \`${k.key}\`: ${k.value}`).join('\n')
      );
    }

    const bodyText = sections.length > 0 ? sections.join('\n\n') : `⚡ *Continuous scanning is active. All IP notes and hostnames are indexed automatically in real-time.*`;

    return {
      id: messageId,
      sender: 'bot',
      timestamp: now,
      text: `🧠 **Enterprise Self-Learning Knowledge Base**

I automatically analyze and index all IP notes, descriptions, hostnames, and live probe results continuously without needing manual input.

${bodyText}

💡 **Try querying:**
- \`find ips used port 80\`
- \`ports 80, 443\`
- \`scan notes for DB\``,
      actions: [
        { label: '🔍 Scan Port 80', actionType: 'quick_prompt', payload: 'find ips used port 80', variant: 'primary' },
        { label: '🔍 Scan Port 443', actionType: 'quick_prompt', payload: 'find ips used port 443', variant: 'outline' },
        { label: '📊 Subnet Summary', actionType: 'quick_prompt', payload: 'subnet utilization summary', variant: 'secondary' },
      ],
      suggestions: [
        'Find ips used port 80',
        'Ports 80, 443',
        'Scan notes for DB',
        'List all allocated IPs',
      ],
    };
  }

  // =========================================================================
  // 14. SUBNET UTILIZATION / CAPACITY SUMMARY
  // =========================================================================
  if (fuzzy.intent === 'SUBNET_SUMMARY') {
    const enrichedSubnets = allowedSubnets.map((sub) => {
      const subIps = ctx.ips.filter((r) => r.subnetId === sub.id && r.status !== 'available');
      const allocatedCount = subIps.length;
      const usable = sub.usableHosts || sub.totalHosts || 254;
      const availableCount = Math.max(0, usable - allocatedCount);
      const utilizationPercent = Math.min(100, Math.round((allocatedCount / usable) * 100));

      return {
        ...sub,
        allocatedCount,
        availableCount,
        utilizationPercent,
      };
    });

    const totalCapacity = enrichedSubnets.reduce((acc, s) => acc + (s.usableHosts || 254), 0);
    const totalAllocated = enrichedSubnets.reduce((acc, s) => acc + s.allocatedCount, 0);
    const overallPercent = totalCapacity > 0 ? Math.round((totalAllocated / totalCapacity) * 100) : 0;

    return {
      id: messageId,
      sender: 'bot',
      timestamp: now,
      text: `📊 **Enterprise Subnet Capacity & Utilization Summary:**

- **Accessible Subnets**: **${enrichedSubnets.length}**
- **Total IP Capacity**: **${totalCapacity.toLocaleString()}**
- **Active Allocations**: **${totalAllocated.toLocaleString()}** (${overallPercent}% utilized)
- **Available Free IPs**: **${(totalCapacity - totalAllocated).toLocaleString()}**`,
      subnetCards: enrichedSubnets,
      suggestions: [
        'Find next available IP',
        'List all allocated IPs',
        'Create new subnet',
      ],
    };
  }

  // =========================================================================
  // 15. AUDIT LOGS
  // =========================================================================
  if (fuzzy.intent === 'AUDIT_LOGS') {
    if (!ctx.hasPermission('viewAuditLogs')) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `⛔ **Permission Denied**: Your account (@${ctx.currentUser?.username}) does not have permission to view security audit logs.`,
        isSecurityAlert: true,
      };
    }

    const recent = ctx.auditLogs.slice(0, 5);
    if (recent.length === 0) {
      return {
        id: messageId,
        sender: 'bot',
        timestamp: now,
        text: `📜 **No recent security audit logs found.**`,
      };
    }

    const logLines = recent.map((l) => {
      const time = new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `- **[${time}]** \`${l.action}\` by **@${l.actorUsername}**: ${l.details}`;
    });

    return {
      id: messageId,
      sender: 'bot',
      timestamp: now,
      text: `📜 **Recent Security & Change Audit Logs (Last ${recent.length}):**\n\n${logLines.join('\n')}`,
      actions: [
        { label: 'View Full Audit View', actionType: 'navigate_tab', payload: { tab: 'audit' } },
      ],
    };
  }

  // =========================================================================
  // 16. FALLBACK WITH "DID YOU MEAN?" SUGGESTION
  // =========================================================================
  const didYouMean = fuzzy.didYouMeanPrompt || 'Help';

  return {
    id: messageId,
    sender: 'bot',
    timestamp: now,
    text: `🤔 I didn't quite understand *"**${trimmed}**"*.

${hasCorrections ? `💡 *Auto-correction applied:* \`${normalized}\`\n` : ''}
Did you mean: **${didYouMean}**?`,
    actions: [
      { label: `Try: ${didYouMean}`, actionType: 'quick_prompt', payload: didYouMean, variant: 'primary' },
      { label: 'Create New Subnet', actionType: 'quick_prompt', payload: 'create subnet' },
      { label: 'Find next available IP', actionType: 'quick_prompt', payload: 'find next available IP' },
    ],
    suggestions: [
      'Find ips used port 80',
      'Create new subnet',
      'List all allocated IPs',
      'Subnet utilization summary',
    ],
  };
}
