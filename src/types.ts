export type AuthType = 'local' | 'ldap_ad';

export type UserRole = 'super_admin' | 'network_admin' | 'operator' | 'auditor';

export type UserStatus = 'active' | 'disabled';

export interface GranularPermissions {
  manageUsers: boolean;
  manageAuthSettings: boolean;
  manageDeviceClassifications: boolean;
  manageAuditSettings: boolean;
  clearAuditLogs: boolean;
  createSubnet: boolean;
  editSubnet: boolean;
  deleteSubnet: boolean;
  allocateIP: boolean;
  releaseIP: boolean;
  editIP: boolean;
  viewAuditLogs: boolean;
  exportData: boolean;
  // Subnet access restriction: empty array means access to all subnets
  allowedSubnetIds: string[];
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  authType: AuthType;
  // If authType is local, password hash/string stored; if ldap_ad, external AD binds
  localPassword?: string;
  ldapUpn?: string; // e.g. user@corp.contoso.com or sAMAccountName
  role: UserRole;
  status: UserStatus;
  permissions: GranularPermissions;
  lastLoginAt?: string;
  createdAt: string;
  department?: string;
}

export interface LdapConfig {
  enabled: boolean;
  serverUrl: string; // e.g. ldaps://ad.corp.contoso.com:636
  domain: string; // e.g. CORP.CONTOSO.COM
  baseDn: string; // e.g. DC=corp,DC=contoso,DC=com
  bindDn: string; // e.g. CN=svc-ipam,OU=ServiceAccounts,DC=corp,DC=contoso,DC=com
  bindPassword: string;
  userSearchFilter: string; // e.g. (&(objectCategory=person)(sAMAccountName={username}))
  useTls: boolean;
  timeoutMs: number;
  syncIntervalHours: number;
  defaultRole: UserRole;
  adNetbiosDomain?: string; // e.g. CORP\
}

export type IPStatus = 'available' | 'allocated' | 'reserved' | 'dhcp' | 'offline';

export type DeviceType =
  | 'server'
  | 'router'
  | 'switch'
  | 'workstation'
  | 'vm'
  | 'firewall'
  | 'iot'
  | 'storage'
  | 'other'
  | string;

export interface DeviceClassification {
  id: string;
  name: string;
  code: string;
  category: string;
  description: string;
  icon: string;
  color: string;
  vendor?: string;
  defaultPorts?: string;
  snmpEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IPRecord {
  id: string;
  ip: string;
  subnetId: string;
  status: IPStatus;
  hostname?: string;
  macAddress?: string;
  deviceType?: DeviceType;
  owner?: string;
  department?: string;
  notes?: string;
  allocatedAt?: string;
  allocatedBy?: string; // Username
  lastPingStatus?: 'online' | 'offline' | 'unreachable' | 'unknown';
  lastPingAt?: string;
  lastPingLatencyMs?: number;
  dnsResolved?: boolean;
}

export interface SnmpMonitoringConfig {
  enabled: boolean;
  intervalSeconds: number;
  customValue: number;
  customUnit: 'seconds' | 'minutes' | 'hours';
  snmpVersion: 'v2c' | 'v3';
  communityString: string;
  snmpPort: number;
  lastPolledAt: string | null;
  totalPollCycles: number;
  lastLatencyMs: number;
}

export interface Subnet {
  id: string;
  name: string;
  cidr: string; // e.g. 192.168.10.0/24
  vlanId?: number;
  vrf?: string;
  location: string;
  description: string;
  gateway: string;
  dnsServers: string[];
  totalHosts: number;
  usableHosts: number;
  networkAddress: string;
  broadcastAddress: string;
  mask: string;
  tags: string[];
  colorTag?: string;
  createdAt: string;
  updatedAt: string;
}

export type AuditCategory = 'auth' | 'ip' | 'subnet' | 'user' | 'device' | 'system';
export type AuditSeverity = 'info' | 'warning' | 'error' | 'success';

export interface AuditLog {
  id: string;
  timestamp: string;
  actorUsername: string;
  actorAuthType: AuthType;
  actorRole: string;
  action: string;
  category: AuditCategory;
  target: string;
  details: string;
  severity: AuditSeverity;
  clientIp?: string;
}

export interface AuditSettings {
  loggingEnabled: boolean;
  retentionPolicyEnabled: boolean;
  retentionDays: number;
  autoRotateOnStartup: boolean;
  lastRotatedAt?: string;
  totalPurgedCount: number;
}

export interface IPAMBackupData {
  version: string;
  timestamp: string;
  exportedBy: {
    username: string;
    fullName: string;
    role: string;
  };
  metadata: {
    appName: string;
    totalSubnets: number;
    totalIPs: number;
    totalUsers: number;
    totalDeviceClassifications: number;
    totalAuditLogs: number;
    ldapConfigured: boolean;
  };
  data: {
    subnets: Subnet[];
    ips: IPRecord[];
    users: User[];
    ldapConfig: LdapConfig;
    deviceClassifications: DeviceClassification[];
    auditLogs: AuditLog[];
    auditSettings: AuditSettings;
  };
}

export interface RestoreOptions {
  restoreSubnets: boolean;
  restoreIPs: boolean;
  restoreUsers: boolean;
  restoreLdap: boolean;
  restoreDeviceClasses: boolean;
  restoreAuditLogs: boolean;
  restoreAuditSettings: boolean;
  mode: 'overwrite' | 'merge';
}
