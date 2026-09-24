import { Subnet, IPRecord, User, LdapConfig, AuditLog, GranularPermissions, DeviceClassification, AuditSettings, SnmpMonitoringConfig, Project } from '../types';

export const DEFAULT_PERMISSIONS: Record<string, GranularPermissions> = {
  super_admin: {
    viewDashboard: true,
    viewSubnets: true,
    manageUsers: true,
    manageAuthSettings: true,
    manageDeviceClassifications: true,
    manageProjects: true,
    viewAuditLogs: true,
    manageBackupRestore: true,
    createSubnet: true,
    editSubnet: true,
    deleteSubnet: true,
    allocateIP: true,
    releaseIP: true,
    editIP: true,
    scanSubnet: true,
    manageAuditSettings: true,
    clearAuditLogs: true,
    exportData: true,
    allowedSubnetIds: [], // all
  },
  network_admin: {
    viewDashboard: true,
    viewSubnets: true,
    manageUsers: false,
    manageAuthSettings: false,
    manageDeviceClassifications: true,
    manageProjects: true,
    viewAuditLogs: true,
    manageBackupRestore: false,
    createSubnet: true,
    editSubnet: true,
    deleteSubnet: false,
    allocateIP: true,
    releaseIP: true,
    editIP: true,
    scanSubnet: true,
    manageAuditSettings: true,
    clearAuditLogs: true,
    exportData: true,
    allowedSubnetIds: [],
  },
  operator: {
    viewDashboard: true,
    viewSubnets: true,
    manageUsers: false,
    manageAuthSettings: false,
    manageDeviceClassifications: false,
    manageProjects: true,
    viewAuditLogs: false,
    manageBackupRestore: false,
    createSubnet: false,
    editSubnet: false,
    deleteSubnet: false,
    allocateIP: true,
    releaseIP: true,
    editIP: true,
    scanSubnet: true,
    manageAuditSettings: false,
    clearAuditLogs: false,
    exportData: true,
    allowedSubnetIds: [],
  },
  auditor: {
    viewDashboard: true,
    viewSubnets: true,
    manageUsers: false,
    manageAuthSettings: false,
    manageDeviceClassifications: false,
    manageProjects: false,
    viewAuditLogs: true,
    manageBackupRestore: false,
    createSubnet: false,
    editSubnet: false,
    deleteSubnet: false,
    allocateIP: false,
    releaseIP: false,
    editIP: false,
    scanSubnet: false,
    manageAuditSettings: false,
    clearAuditLogs: false,
    exportData: true,
    allowedSubnetIds: [],
  },
};

export function normalizePermissions(
  perms?: Partial<GranularPermissions>,
  role: string = 'operator'
): GranularPermissions {
  const base = DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.operator;
  if (!perms) return { ...base };
  return {
    viewDashboard: perms.viewDashboard !== undefined ? Boolean(perms.viewDashboard) : true,
    viewSubnets: perms.viewSubnets !== undefined ? Boolean(perms.viewSubnets) : true,
    manageUsers: perms.manageUsers !== undefined ? Boolean(perms.manageUsers) : base.manageUsers,
    manageAuthSettings: perms.manageAuthSettings !== undefined ? Boolean(perms.manageAuthSettings) : base.manageAuthSettings,
    manageDeviceClassifications: perms.manageDeviceClassifications !== undefined ? Boolean(perms.manageDeviceClassifications) : base.manageDeviceClassifications,
    manageProjects: perms.manageProjects !== undefined ? Boolean(perms.manageProjects) : base.manageProjects,
    viewAuditLogs: perms.viewAuditLogs !== undefined ? Boolean(perms.viewAuditLogs) : base.viewAuditLogs,
    manageBackupRestore: perms.manageBackupRestore !== undefined ? Boolean(perms.manageBackupRestore) : base.manageBackupRestore,
    createSubnet: perms.createSubnet !== undefined ? Boolean(perms.createSubnet) : base.createSubnet,
    editSubnet: perms.editSubnet !== undefined ? Boolean(perms.editSubnet) : base.editSubnet,
    deleteSubnet: perms.deleteSubnet !== undefined ? Boolean(perms.deleteSubnet) : base.deleteSubnet,
    allocateIP: perms.allocateIP !== undefined ? Boolean(perms.allocateIP) : base.allocateIP,
    releaseIP: perms.releaseIP !== undefined ? Boolean(perms.releaseIP) : base.releaseIP,
    editIP: perms.editIP !== undefined ? Boolean(perms.editIP) : base.editIP,
    scanSubnet: perms.scanSubnet !== undefined ? Boolean(perms.scanSubnet) : (perms.allocateIP !== false),
    manageAuditSettings: perms.manageAuditSettings !== undefined ? Boolean(perms.manageAuditSettings) : base.manageAuditSettings,
    clearAuditLogs: perms.clearAuditLogs !== undefined ? Boolean(perms.clearAuditLogs) : base.clearAuditLogs,
    exportData: perms.exportData !== undefined ? Boolean(perms.exportData) : base.exportData,
    allowedSubnetIds: Array.isArray(perms.allowedSubnetIds) ? perms.allowedSubnetIds : [],
  };
}

// Pre-configured baseline accounts for all default roles
export const INITIAL_USERS: User[] = [
  {
    id: 'usr-admin',
    username: 'admin',
    fullName: 'System Administrator',
    email: 'admin@network.local',
    authType: 'local',
    localPassword: 'admin',
    role: 'super_admin',
    status: 'active',
    permissions: { ...DEFAULT_PERMISSIONS.super_admin },
    createdAt: '2026-01-01T00:00:00Z',
    lastLoginAt: '2026-01-01T00:00:00Z',
    department: 'IT Infrastructure',
  },
  {
    id: 'usr-netadmin',
    username: 'netadmin',
    fullName: 'Network Administrator',
    email: 'netadmin@network.local',
    authType: 'local',
    localPassword: 'admin123',
    role: 'network_admin',
    status: 'active',
    permissions: { ...DEFAULT_PERMISSIONS.network_admin },
    createdAt: '2026-01-01T00:00:00Z',
    lastLoginAt: '2026-01-01T00:00:00Z',
    department: 'Network Engineering',
  },
  {
    id: 'usr-operator',
    username: 'operator',
    fullName: 'Subnet Operator',
    email: 'operator@network.local',
    authType: 'local',
    localPassword: 'admin123',
    role: 'operator',
    status: 'active',
    permissions: { ...DEFAULT_PERMISSIONS.operator },
    createdAt: '2026-01-01T00:00:00Z',
    lastLoginAt: '2026-01-01T00:00:00Z',
    department: 'Operations & NOC',
  },
  {
    id: 'usr-auditor',
    username: 'auditor',
    fullName: 'Compliance Auditor',
    email: 'auditor@network.local',
    authType: 'local',
    localPassword: 'admin123',
    role: 'auditor',
    status: 'active',
    permissions: { ...DEFAULT_PERMISSIONS.auditor },
    createdAt: '2026-01-01T00:00:00Z',
    lastLoginAt: '2026-01-01T00:00:00Z',
    department: 'Security & Compliance',
  },
];

// Clean fresh configuration for Active Directory / LDAP (disabled by default)
export const INITIAL_LDAP_CONFIG: LdapConfig = {
  enabled: false,
  serverUrl: '',
  domain: '',
  adNetbiosDomain: '',
  baseDn: '',
  bindDn: '',
  bindPassword: '',
  userSearchFilter: '(&(objectCategory=person)(sAMAccountName={username}))',
  useTls: true,
  timeoutMs: 5000,
  syncIntervalHours: 12,
  defaultRole: 'operator',
};

// Fresh, empty subnets (no demo data)
export const INITIAL_SUBNETS: Subnet[] = [];

// Fresh, empty IP records (no demo data)
export const INITIAL_IPS: IPRecord[] = [];

// Clean initial audit log indicating fresh system initialization
export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'audit-sys-init',
    timestamp: new Date().toISOString(),
    actorUsername: 'admin',
    actorAuthType: 'local',
    actorRole: 'super_admin',
    action: 'SYSTEM_INITIALIZATION',
    category: 'system',
    target: 'Fresh Database Initialized',
    details: 'Fresh IPAM database initialized with default root administrator account (admin).',
    clientIp: '127.0.0.1',
    severity: 'info',
  },
];

// Standard Enterprise Device Classification Library (empty baseline - user-defined classifications only)
export const INITIAL_DEVICE_CLASSIFICATIONS: DeviceClassification[] = [];

// Standard Enterprise Projects baseline for workload & IP allocation
export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'prj-vm-compute',
    name: 'Virtual Machines & Compute Farm',
    code: 'PRJ-VM',
    category: 'Compute & Virtualization',
    description: 'Production hypervisor workloads, guest VMs, and compute node allocations.',
    color: 'blue',
    icon: 'server',
    status: 'active',
    owner: 'System Administrator',
    department: 'IT Infrastructure',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'prj-cctv-surveillance',
    name: 'CCTV & Physical Surveillance',
    code: 'PRJ-CCTV',
    category: 'Security & Surveillance',
    description: 'High-definition IP cameras, NVR storage units, and perimeter surveillance feeds.',
    color: 'rose',
    icon: 'cctv',
    status: 'active',
    owner: 'Security Administrator',
    department: 'Facilities & Security',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'prj-core-network',
    name: 'Core Network Infrastructure',
    code: 'PRJ-NET',
    category: 'Network Infrastructure',
    description: 'Core and edge switches, routing appliances, gateways, and VLAN trunks.',
    color: 'indigo',
    icon: 'switch',
    status: 'active',
    owner: 'Network Admin',
    department: 'Network Operations',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'prj-alona-assets',
    name: 'Asset Management System (ALONA)',
    code: 'PRJ-ALONA',
    category: 'Enterprise Applications',
    description: 'Internal asset tracking services, database backends, and management nodes.',
    color: 'emerald',
    icon: 'database',
    status: 'active',
    owner: 'DevOps Lead',
    department: 'IT Applications',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];


export const INITIAL_AUDIT_SETTINGS: AuditSettings = {
  loggingEnabled: true,
  retentionPolicyEnabled: true,
  retentionDays: 90,
  autoRotateOnStartup: true,
  lastRotatedAt: '2026-01-01T00:00:00Z',
  totalPurgedCount: 0,
};

export const INITIAL_SNMP_CONFIG: SnmpMonitoringConfig = {
  enabled: true,
  intervalSeconds: 30,
  customValue: 30,
  customUnit: 'seconds',
  snmpVersion: 'v2c',
  communityString: 'public',
  snmpPort: 161,
  lastPolledAt: null,
  totalPollCycles: 0,
  lastLatencyMs: 14,
};

