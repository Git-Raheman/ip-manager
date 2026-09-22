import { Subnet, IPRecord, User, LdapConfig, AuditLog, GranularPermissions, DeviceClassification, AuditSettings, SnmpMonitoringConfig } from '../types';

export const DEFAULT_PERMISSIONS: Record<string, GranularPermissions> = {
  super_admin: {
    manageUsers: true,
    manageAuthSettings: true,
    manageDeviceClassifications: true,
    manageAuditSettings: true,
    clearAuditLogs: true,
    createSubnet: true,
    editSubnet: true,
    deleteSubnet: true,
    allocateIP: true,
    releaseIP: true,
    editIP: true,
    viewAuditLogs: true,
    exportData: true,
    allowedSubnetIds: [], // all
  },
  network_admin: {
    manageUsers: false,
    manageAuthSettings: false,
    manageDeviceClassifications: true,
    manageAuditSettings: true,
    clearAuditLogs: true,
    createSubnet: true,
    editSubnet: true,
    deleteSubnet: false,
    allocateIP: true,
    releaseIP: true,
    editIP: true,
    viewAuditLogs: true,
    exportData: true,
    allowedSubnetIds: [],
  },
  operator: {
    manageUsers: false,
    manageAuthSettings: false,
    manageDeviceClassifications: false,
    manageAuditSettings: false,
    clearAuditLogs: false,
    createSubnet: false,
    editSubnet: false,
    deleteSubnet: false,
    allocateIP: true,
    releaseIP: true,
    editIP: true,
    viewAuditLogs: false,
    exportData: true,
    allowedSubnetIds: [],
  },
  auditor: {
    manageUsers: false,
    manageAuthSettings: false,
    manageDeviceClassifications: false,
    manageAuditSettings: false,
    clearAuditLogs: false,
    createSubnet: false,
    editSubnet: false,
    deleteSubnet: false,
    allocateIP: false,
    releaseIP: false,
    editIP: false,
    viewAuditLogs: true,
    exportData: true,
    allowedSubnetIds: [],
  },
};

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

