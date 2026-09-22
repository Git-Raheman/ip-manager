import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  User,
  Subnet,
  IPRecord,
  LdapConfig,
  AuditLog,
  GranularPermissions,
  AuthType,
  UserRole,
  DeviceClassification,
  AuditSettings,
  IPAMBackupData,
  RestoreOptions,
  SnmpMonitoringConfig,
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_SUBNETS,
  INITIAL_IPS,
  INITIAL_LDAP_CONFIG,
  INITIAL_AUDIT_LOGS,
  INITIAL_DEVICE_CLASSIFICATIONS,
  INITIAL_AUDIT_SETTINGS,
  INITIAL_SNMP_CONFIG,
  DEFAULT_PERMISSIONS,
} from '../data/initialData';
import { parseCIDR, isValidIPv4 } from '../utils/ipUtils';

export type NavigationTab =
  | 'dashboard'
  | 'subnets'
  | 'users'
  | 'device_classifications'
  | 'audit'
  | 'ldap_settings'
  | 'backup_restore';

const VALID_TABS: NavigationTab[] = [
  'dashboard',
  'subnets',
  'users',
  'device_classifications',
  'audit',
  'ldap_settings',
  'backup_restore',
];

export function parseInitialRoute(): {
  tab: NavigationTab;
  subnetId: string | null;
} {
  if (typeof window === 'undefined') {
    return { tab: 'dashboard', subnetId: null };
  }

  // 1. Search params (?tab=dashboard or ?tab=subnets or ?subnetId=...)
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const queryTab = searchParams.get('tab') as NavigationTab | null;
    const querySubnet = searchParams.get('subnetId') || searchParams.get('subnet') || null;
    if (queryTab && VALID_TABS.includes(queryTab)) {
      return { tab: queryTab, subnetId: queryTab === 'subnets' ? querySubnet : null };
    }
  } catch (e) {}

  // 2. URL Hash (#dashboard or #subnets/subnet-123 or #users or #subnets?id=...)
  try {
    const rawHash = window.location.hash.replace(/^#\/?/, '').trim();
    if (rawHash) {
      if (rawHash.startsWith('subnets/') || rawHash.startsWith('subnet/')) {
        const parts = rawHash.split('/');
        const sId = parts[1]?.trim() || null;
        return { tab: 'subnets', subnetId: sId };
      }
      if (rawHash.startsWith('subnets?') || rawHash.startsWith('subnet?')) {
        const queryStr = rawHash.includes('?') ? rawHash.split('?')[1] : '';
        const params = new URLSearchParams(queryStr);
        const sId = params.get('id') || params.get('subnetId') || null;
        return { tab: 'subnets', subnetId: sId };
      }
      const matchedTab = VALID_TABS.find((t) => t === rawHash);
      if (matchedTab) {
        return { tab: matchedTab, subnetId: null };
      }
    }
  } catch (e) {}

  // 3. Fallback to localStorage
  try {
    const savedTab = localStorage.getItem('ipam_active_tab') as NavigationTab | null;
    const savedSubnetId = localStorage.getItem('ipam_selected_subnet_id') || null;
    if (savedTab && VALID_TABS.includes(savedTab)) {
      return {
        tab: savedTab,
        subnetId: savedTab === 'subnets' ? savedSubnetId : null,
      };
    }
  } catch (e) {}

  return { tab: 'dashboard', subnetId: null };
}

interface IPAMContextType {
  currentUser: User | null;
  users: User[];
  subnets: Subnet[];
  ips: IPRecord[];
  ldapConfig: LdapConfig;
  auditLogs: AuditLog[];
  deviceClassifications: DeviceClassification[];
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  selectedSubnetId: string | null;
  setSelectedSubnetId: (id: string | null) => void;
  isInitialLoadDone: boolean;

  // Device classification management
  createDeviceClassification: (data: Omit<DeviceClassification, 'id' | 'createdAt' | 'updatedAt'>) => {
    success: boolean;
    message: string;
    classification?: DeviceClassification;
  };
  updateDeviceClassification: (id: string, updates: Partial<DeviceClassification>) => {
    success: boolean;
    message: string;
  };
  deleteDeviceClassification: (id: string) => {
    success: boolean;
    message: string;
  };
  
  // Auth actions
  login: (username: string, password: string) => Promise<{ success: boolean; message: string; user?: User }>;
  logout: () => void;
  switchUserDirectly: (userId: string) => void;
  inactivityMessage: string | null;
  clearInactivityMessage: () => void;
  
  // User management
  createUser: (userData: Omit<User, 'id' | 'createdAt'>) => { success: boolean; message: string; user?: User };
  updateUser: (id: string, updates: Partial<User>) => { success: boolean; message: string };
  changePassword: (userId: string, newPassword: string, oldPassword?: string) => { success: boolean; message: string };
  deleteUser: (id: string) => { success: boolean; message: string };
  toggleUserStatus: (id: string) => void;

  // LDAP settings
  updateLdapConfig: (config: LdapConfig) => void;
  testLdapConnection: (config?: LdapConfig) => Promise<{
    success: boolean;
    diagnostics: string[];
    responseTimeMs: number;
    error?: string;
  }>;

  // Subnet management
  createSubnet: (subnetData: {
    name: string;
    cidr: string;
    vlanId?: number;
    location: string;
    description: string;
    tags?: string[];
  }) => { success: boolean; message: string; subnet?: Subnet };
  updateSubnet: (id: string, updates: Partial<Subnet>) => { success: boolean; message: string };
  deleteSubnet: (id: string) => { success: boolean; message: string };

  // IP management
  allocateIP: (data: {
    subnetId: string;
    ip: string;
    hostname?: string;
    macAddress?: string;
    deviceType?: IPRecord['deviceType'];
    owner?: string;
    department?: string;
    notes?: string;
    status?: IPRecord['status'];
    lastPingStatus?: IPRecord['lastPingStatus'];
  }) => { success: boolean; message: string; record?: IPRecord };
  bulkAllocateIPs: (
    subnetId: string,
    records: Array<{
      ip: string;
      hostname?: string;
      macAddress?: string;
      deviceType?: IPRecord['deviceType'];
      owner?: string;
      department?: string;
      notes?: string;
      status?: IPRecord['status'];
      lastPingStatus?: IPRecord['lastPingStatus'];
    }>,
    mode?: 'skip_existing' | 'overwrite_existing'
  ) => { success: boolean; message: string; count: number };
  releaseIP: (id: string) => { success: boolean; message: string };
  deleteIP: (id: string) => { success: boolean; message: string };
  updateIP: (id: string, updates: Partial<IPRecord>) => { success: boolean; message: string };
  pingIP: (idOrIp: string) => Promise<{
    success?: boolean;
    online: boolean;
    status: 'online' | 'offline' | 'unreachable';
    latencyMs: number;
    openPorts?: string[];
    hostname?: string;
    macAddress?: string;
    deviceType?: string;
  }>;
  batchPingIPs: (idsOrIps?: string[]) => Promise<{
    total: number;
    online: number;
    offline: number;
    results: Array<{ ip: string; online: boolean; latencyMs: number }>;
  }>;

  // Audit
  auditSettings: AuditSettings;
  updateAuditSettings: (updates: Partial<AuditSettings>) => { success: boolean; message: string };
  clearAllAuditLogs: () => { success: boolean; message: string; clearedCount: number };
  clearAuditLogsOlderThan: (days: number) => { success: boolean; message: string; purgedCount: number };
  rotateAuditLogs: () => { success: boolean; message: string; purgedCount: number };
  logAudit: (
    action: string,
    category: AuditLog['category'],
    target: string,
    details: string,
    severity?: AuditLog['severity']
  ) => void;

  // Permissions helper
  hasPermission: (permKey: keyof GranularPermissions, subnetId?: string) => boolean;

  // Backup & Restore
  createBackupPackage: (includeAuditLogs?: boolean) => IPAMBackupData;
  exportBackupToFile: (includeAuditLogs?: boolean) => void;
  restoreFromBackup: (
    backup: IPAMBackupData,
    options?: Partial<RestoreOptions>
  ) => {
    success: boolean;
    message: string;
    stats: { subnets: number; ips: number; users: number; deviceClasses: number; auditLogs: number };
  };

  // SNMP Telemetry & Monitoring
  snmpConfig: SnmpMonitoringConfig;
  updateSnmpConfig: (config: Partial<SnmpMonitoringConfig>) => Promise<{ success: boolean; config: SnmpMonitoringConfig }>;
  triggerServerSnmpProbe: () => Promise<{ success: boolean; config: SnmpMonitoringConfig }>;

  // Reset
  resetData: () => void;
}

const IPAMContext = createContext<IPAMContextType | undefined>(undefined);

// Clear legacy database cache blobs from browser localStorage so the browser is never stuck with stale data
if (typeof window !== 'undefined') {
  const keysToPurge = [
    'ipam_ips',
    'ipam_subnets',
    'ipam_users',
    'ipam_audit_logs',
    'ipam_device_classifications',
    'ipam_ldap_config',
    'ipam_audit_settings',
    'ipam_snmp_monitoring_config',
    'ipam_current_user_id',
    'ipam_db_version',
  ];
  for (const k of keysToPurge) {
    try {
      localStorage.removeItem(k);
    } catch (e) {}
  }
}

const SESSION_USER_KEY = 'ipam_session_user_id';
const SESSION_BOOT_KEY = 'ipam_session_boot_id';
const SESSION_ACTIVITY_KEY = 'ipam_session_last_activity';
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

const getStoredSession = (): { userId: string | null; bootId: string | null; isExpired: boolean } => {
  if (typeof window === 'undefined') return { userId: null, bootId: null, isExpired: false };
  try {
    const userId = localStorage.getItem(SESSION_USER_KEY);
    const bootId = localStorage.getItem(SESSION_BOOT_KEY);
    const lastActivityStr = localStorage.getItem(SESSION_ACTIVITY_KEY);
    if (!userId) return { userId: null, bootId: null, isExpired: false };
    const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : 0;
    const isExpired = Date.now() - lastActivity >= IDLE_TIMEOUT_MS;
    return { userId, bootId, isExpired };
  } catch {
    return { userId: null, bootId: null, isExpired: false };
  }
};

const clearStoredSession = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem(SESSION_BOOT_KEY);
    localStorage.removeItem(SESSION_ACTIVITY_KEY);
  } catch {}
};

export const IPAMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Direct live in-memory state; authoritative data is loaded live from server database
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  // Restore current user immediately if active within 15-minute window to avoid refresh flicker
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const session = getStoredSession();
    if (session.userId && !session.isExpired) {
      const candidate = INITIAL_USERS.find((u) => u.id === session.userId);
      return candidate || null;
    }
    return null;
  });
  const [subnets, setSubnets] = useState<Subnet[]>(INITIAL_SUBNETS);
  const [ips, setIps] = useState<IPRecord[]>(INITIAL_IPS);
  const [ldapConfig, setLdapConfig] = useState<LdapConfig>(INITIAL_LDAP_CONFIG);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [deviceClassifications, setDeviceClassifications] = useState<DeviceClassification[]>(INITIAL_DEVICE_CLASSIFICATIONS);
  const [auditSettings, setAuditSettings] = useState<AuditSettings>(INITIAL_AUDIT_SETTINGS);
  const [snmpConfig, setSnmpConfig] = useState<SnmpMonitoringConfig>(INITIAL_SNMP_CONFIG);

  const initialRoute = parseInitialRoute();
  const [activeTab, setActiveTab] = useState<NavigationTab>(initialRoute.tab);
  const [selectedSubnetId, setSelectedSubnetId] = useState<string | null>(initialRoute.subnetId);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);

  // Sync URL hash & localStorage with current view so browser refresh stays on current page
  useEffect(() => {
    try {
      localStorage.setItem('ipam_active_tab', activeTab);
      if (activeTab === 'subnets' && selectedSubnetId) {
        localStorage.setItem('ipam_selected_subnet_id', selectedSubnetId);
      } else {
        localStorage.removeItem('ipam_selected_subnet_id');
      }
    } catch (e) {}

    if (typeof window !== 'undefined') {
      let targetHash = `#${activeTab}`;
      if (activeTab === 'subnets' && selectedSubnetId) {
        targetHash = `#subnets/${selectedSubnetId}`;
      }
      if (window.location.hash !== targetHash) {
        window.history.replaceState(null, '', targetHash);
      }
    }
  }, [activeTab, selectedSubnetId]);

  // Listen to browser Back / Forward buttons (hashchange and popstate)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleRouteSync = () => {
      const route = parseInitialRoute();
      setActiveTab((prev) => (prev !== route.tab ? route.tab : prev));
      setSelectedSubnetId((prev) => (prev !== route.subnetId ? route.subnetId : prev));
    };

    window.addEventListener('hashchange', handleRouteSync);
    window.addEventListener('popstate', handleRouteSync);
    return () => {
      window.removeEventListener('hashchange', handleRouteSync);
      window.removeEventListener('popstate', handleRouteSync);
    };
  }, []);

  // Load full state from backend database API on startup
  const isInitialLoadDoneRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchServerDatabase() {
      try {
        const res = await fetch('/api/ipam/state', { cache: 'no-store' });
        if (!res.ok) {
          isInitialLoadDoneRef.current = true;
          setIsInitialLoadDone(true);
          return;
        }
        const result = await res.json();
        if (result.success && result.data && isMounted) {
          const d = result.data;
          const serverBootId: string | undefined = result.serverBootId;
          if (Array.isArray(d.subnets)) setSubnets(d.subnets);
          if (Array.isArray(d.ips)) setIps(d.ips);
          if (Array.isArray(d.users)) {
            setUsers(d.users);

            const session = getStoredSession();
            if (session.isExpired && session.userId) {
              // 15-minute idle timeout expired while away/refreshed
              clearStoredSession();
              setCurrentUser(null);
              setInactivityMessage('Your session has expired due to 15 minutes of inactivity. Please sign in again.');
            } else if (session.userId) {
              // Check if docker compose down and up happened (serverBootId mismatch)
              if (session.bootId && serverBootId && session.bootId !== serverBootId) {
                // Server was rebooted / fresh docker container: reset session
                clearStoredSession();
                setCurrentUser(null);
              } else {
                // Same server / fresh refresh: re-validate user in live database
                const liveUser = d.users.find((u: User) => u.id === session.userId && u.status !== 'disabled');
                if (liveUser) {
                  setCurrentUser(liveUser);
                  if (serverBootId) {
                    try {
                      localStorage.setItem(SESSION_BOOT_KEY, serverBootId);
                      localStorage.setItem(SESSION_ACTIVITY_KEY, String(Date.now()));
                    } catch {}
                  }
                } else {
                  clearStoredSession();
                  setCurrentUser(null);
                }
              }
            }
          }
          if (d.ldapConfig) setLdapConfig(d.ldapConfig);
          if (Array.isArray(d.auditLogs)) setAuditLogs(d.auditLogs);
          if (Array.isArray(d.deviceClassifications)) {
            setDeviceClassifications(d.deviceClassifications);
          }
          if (d.auditSettings) setAuditSettings(d.auditSettings);
          if (d.snmpConfig) setSnmpConfig(d.snmpConfig);
        }
      } catch (err) {
        console.warn('[IPAM] Server database load error:', err);
      } finally {
        if (isMounted) {
          isInitialLoadDoneRef.current = true;
          setIsInitialLoadDone(true);
        }
      }
    }
    fetchServerDatabase();

    return () => {
      isMounted = false;
    };
  }, []);

  // Continuous background status polling (syncs server-side telemetry probes to all views)
  const isTelemetryUpdateRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    const interval = setInterval(async () => {
      if (!isMounted) return;
      try {
        const res = await fetch('/api/snmp/status', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && isMounted) {
          if (data.config) {
            setSnmpConfig((prev) => {
              if (
                prev.lastPolledAt !== data.config.lastPolledAt ||
                prev.totalPollCycles !== data.config.totalPollCycles ||
                prev.enabled !== data.config.enabled ||
                prev.intervalSeconds !== data.config.intervalSeconds ||
                prev.lastLatencyMs !== data.config.lastLatencyMs
              ) {
                return data.config;
              }
              return prev;
            });
          }
          if (Array.isArray(data.ips) && data.ips.length > 0) {
            const statusMap = new Map(data.ips.map((item: any) => [item.id, item]));
            isTelemetryUpdateRef.current = true;
            setIps((prev) => {
              let hasChanged = false;
              const next = prev.map((rec) => {
                const updated: any = statusMap.get(rec.id);
                if (
                  updated &&
                  (rec.lastPingStatus !== updated.lastPingStatus ||
                    rec.lastPingAt !== updated.lastPingAt ||
                    rec.lastPingLatencyMs !== updated.lastPingLatencyMs)
                ) {
                  hasChanged = true;
                  return {
                    ...rec,
                    lastPingStatus: updated.lastPingStatus,
                    lastPingAt: updated.lastPingAt,
                    lastPingLatencyMs: updated.lastPingLatencyMs,
                  };
                }
                return rec;
              });
              if (!hasChanged) {
                isTelemetryUpdateRef.current = false;
              }
              return hasChanged ? next : prev;
            });
          }
        }
      } catch (err) {}
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Debounced server database synchronization
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncToServer = useCallback(
    (payload: {
      subnets: Subnet[];
      ips: IPRecord[];
      users: User[];
      ldapConfig: LdapConfig;
      auditLogs: AuditLog[];
      deviceClassifications: DeviceClassification[];
      auditSettings: AuditSettings;
    }) => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        fetch('/api/ipam/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch((err) => {
          console.error('[IPAM] Background server synchronization failed:', err);
        });
      }, 150);
    },
    []
  );

  const syncImmediate = useCallback(
    (payload: Partial<{
      subnets: Subnet[];
      ips: IPRecord[];
      users: User[];
      ldapConfig: LdapConfig;
      auditLogs: AuditLog[];
      deviceClassifications: DeviceClassification[];
      auditSettings: AuditSettings;
    }>) => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      return fetch('/api/ipam/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch((err) => {
        console.error('[IPAM] Direct server synchronization failed:', err);
      });
    },
    []
  );

  useEffect(() => {
    if (!isInitialLoadDoneRef.current) {
      return;
    }
    // Prevent telemetry polling from triggering full database sync back to server
    if (isTelemetryUpdateRef.current) {
      isTelemetryUpdateRef.current = false;
      return;
    }
    syncToServer({ subnets, ips, users, ldapConfig, auditLogs, deviceClassifications, auditSettings });
  }, [subnets, ips, users, ldapConfig, auditLogs, deviceClassifications, auditSettings, syncToServer]);

  // Automatic log rotation / pruning on startup when retention policy is enabled
  useEffect(() => {
    if (auditSettings.retentionPolicyEnabled && auditSettings.retentionDays > 0 && auditSettings.autoRotateOnStartup) {
      const cutoffTime = Date.now() - auditSettings.retentionDays * 24 * 60 * 60 * 1000;
      const expiredCount = auditLogs.filter((l) => new Date(l.timestamp).getTime() < cutoffTime).length;
      if (expiredCount > 0) {
        setAuditLogs((prev) => prev.filter((l) => new Date(l.timestamp).getTime() >= cutoffTime));
        setAuditSettings((prev) => ({
          ...prev,
          lastRotatedAt: new Date().toISOString(),
          totalPurgedCount: prev.totalPurgedCount + expiredCount,
        }));
      }
    }
  }, []);

  // Logging function
  const logAudit = (
    action: string,
    category: AuditLog['category'],
    target: string,
    details: string,
    severity: AuditLog['severity'] = 'info'
  ) => {
    // If logging is disabled and not an override action to re-enable logging
    if (!auditSettings.loggingEnabled && action !== 'AUDIT_LOGGING_ENABLED') {
      return;
    }

    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      actorUsername: currentUser ? currentUser.username : 'SYSTEM',
      actorAuthType: currentUser ? currentUser.authType : 'local',
      actorRole: currentUser ? currentUser.role : 'system',
      action,
      category,
      target,
      details,
      severity,
      clientIp: '127.0.0.1',
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Update audit log settings (enable/disable, retention days, auto-rotate)
  const updateAuditSettings = (
    updates: Partial<AuditSettings>
  ): { success: boolean; message: string } => {
    const canManage =
      currentUser?.role === 'super_admin' ||
      currentUser?.role === 'network_admin' ||
      Boolean(currentUser?.permissions?.manageAuditSettings);

    if (!canManage) {
      return {
        success: false,
        message: 'Permission denied: Administrator rights required to modify audit logging configuration.',
      };
    }

    setAuditSettings((prev) => ({ ...prev, ...updates }));

    if (updates.loggingEnabled !== undefined) {
      logAudit(
        updates.loggingEnabled ? 'AUDIT_LOGGING_ENABLED' : 'AUDIT_LOGGING_DISABLED',
        'system',
        'Audit Engine',
        updates.loggingEnabled
          ? `Audit logging stream was ENABLED by administrator ${currentUser?.username || 'admin'}`
          : `Audit logging stream was PAUSED / DISABLED by administrator ${currentUser?.username || 'admin'}`,
        updates.loggingEnabled ? 'info' : 'warning'
      );
    } else if (updates.retentionDays !== undefined || updates.retentionPolicyEnabled !== undefined) {
      logAudit(
        'AUDIT_RETENTION_POLICY_UPDATE',
        'system',
        'Audit Engine',
        `Retention policy updated: ${updates.retentionPolicyEnabled !== undefined ? (updates.retentionPolicyEnabled ? 'Active' : 'Disabled') : auditSettings.retentionPolicyEnabled ? 'Active' : 'Disabled'}, retention window: ${updates.retentionDays ?? auditSettings.retentionDays} days`,
        'info'
      );
    }

    return {
      success: true,
      message: 'Audit configuration and retention policy updated successfully.',
    };
  };

  // Clear all audit logs
  const clearAllAuditLogs = (): { success: boolean; message: string; clearedCount: number } => {
    const canClear =
      currentUser?.role === 'super_admin' ||
      currentUser?.role === 'network_admin' ||
      Boolean(currentUser?.permissions?.clearAuditLogs);

    if (!canClear) {
      return {
        success: false,
        message: 'Permission denied: Administrator rights required to clear audit records.',
        clearedCount: 0,
      };
    }

    const count = auditLogs.length;
    setAuditLogs([]);
    setAuditSettings((prev) => ({
      ...prev,
      totalPurgedCount: prev.totalPurgedCount + count,
      lastRotatedAt: new Date().toISOString(),
    }));

    if (auditSettings.loggingEnabled) {
      setTimeout(() => {
        logAudit(
          'AUDIT_LOGS_PURGED',
          'system',
          'Audit Store',
          `All security audit logs (${count} records) were purged by administrator ${currentUser?.username || 'admin'}. Fresh log sequence initialized.`,
          'warning'
        );
      }, 50);
    }

    return {
      success: true,
      message: `Successfully cleared all ${count} audit records.`,
      clearedCount: count,
    };
  };

  // Clear audit logs older than custom days
  const clearAuditLogsOlderThan = (
    days: number
  ): { success: boolean; message: string; purgedCount: number } => {
    const canClear =
      currentUser?.role === 'super_admin' ||
      currentUser?.role === 'network_admin' ||
      Boolean(currentUser?.permissions?.clearAuditLogs);

    if (!canClear) {
      return {
        success: false,
        message: 'Permission denied: Administrator rights required to clear audit records.',
        purgedCount: 0,
      };
    }

    if (days < 1) {
      return {
        success: false,
        message: 'Retention window must be at least 1 day.',
        purgedCount: 0,
      };
    }

    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
    const toKeep: AuditLog[] = [];
    let purgedCount = 0;

    for (const log of auditLogs) {
      const logTime = new Date(log.timestamp).getTime();
      if (logTime < cutoffTime) {
        purgedCount++;
      } else {
        toKeep.push(log);
      }
    }

    setAuditLogs(toKeep);
    setAuditSettings((prev) => ({
      ...prev,
      totalPurgedCount: prev.totalPurgedCount + purgedCount,
      lastRotatedAt: new Date().toISOString(),
    }));

    if (auditSettings.loggingEnabled && purgedCount > 0) {
      logAudit(
        'AUDIT_LOGS_ROTATED',
        'system',
        'Audit Store',
        `Rotated / purged ${purgedCount} audit logs older than ${days} days (${new Date(cutoffTime).toLocaleDateString()}) by administrator ${currentUser?.username || 'admin'}`,
        'info'
      );
    }

    return {
      success: true,
      message: `Successfully pruned ${purgedCount} audit records older than ${days} days.`,
      purgedCount,
    };
  };

  // Rotate logs according to current retention policy days
  const rotateAuditLogs = (): { success: boolean; message: string; purgedCount: number } => {
    return clearAuditLogsOlderThan(auditSettings.retentionDays);
  };

  // Permission check
  const hasPermission = (permKey: keyof GranularPermissions, subnetId?: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'super_admin') return true;
    if (!currentUser.permissions) return false;

    // Check specific boolean permission
    const permVal = currentUser.permissions[permKey];
    if (typeof permVal === 'boolean' && !permVal) return false;

    // Check subnet scoping if a subnetId is provided
    if (subnetId && currentUser.permissions.allowedSubnetIds && currentUser.permissions.allowedSubnetIds.length > 0) {
      return currentUser.permissions.allowedSubnetIds.includes(subnetId);
    }

    return true;
  };

  // Login handler supporting Local DB & Active Directory / LDAP
  const login = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; message: string; user?: User }> => {
    const trimmedUser = username.trim().toLowerCase();
    if (!trimmedUser || !password) {
      return { success: false, message: 'Please enter both username and password.' };
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUser, password }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.user) {
        const loggedUser: User = data.user;
        setCurrentUser(loggedUser);
        setUsers((prev) => prev.map((u) => (u.id === loggedUser.id ? loggedUser : u)));
        clearInactivityMessage();

        try {
          localStorage.setItem(SESSION_USER_KEY, loggedUser.id);
          if (data.serverBootId) {
            localStorage.setItem(SESSION_BOOT_KEY, data.serverBootId);
          }
          localStorage.setItem(SESSION_ACTIVITY_KEY, String(Date.now()));
        } catch {}

        lastActivityTimeRef.current = Date.now();
        lastSavedActivityRef.current = Date.now();

        setActiveTab('dashboard');
        setSelectedSubnetId(null);

        logAudit(
          'AUTH_LOGIN',
          'auth',
          loggedUser.username,
          loggedUser.authType === 'ldap_ad'
            ? `Active Directory / LDAP bind succeeded against ${ldapConfig.serverUrl || 'directory server'} (${loggedUser.ldapUpn || loggedUser.username})`
            : `Local Database authentication succeeded for user '${loggedUser.username}' (${loggedUser.role})`,
          'info'
        );

        return {
          success: true,
          message: data.message || 'Authentication successful',
          user: loggedUser,
        };
      } else {
        logAudit(
          'AUTH_FAILURE',
          'auth',
          trimmedUser,
          `Authentication failed for '${trimmedUser}': ${data.message || 'Invalid credentials'}`,
          'warning'
        );

        return {
          success: false,
          message: data.message || 'Invalid username or password.',
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: 'Authentication server error: ' + (err.message || 'Could not connect to server'),
      };
    }
  };

  const logout = () => {
    if (currentUser) {
      logAudit(
        'AUTH_LOGOUT',
        'auth',
        currentUser.username,
        `User logged out from session (${currentUser.authType.toUpperCase()})`,
        'info'
      );
    }
    clearStoredSession();
    setCurrentUser(null);
  };

  // 15-Minute Inactivity Auto-Logout Tracker
  const [inactivityMessage, setInactivityMessage] = useState<string | null>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());
  const lastSavedActivityRef = useRef<number>(Date.now());

  const clearInactivityMessage = () => {
    setInactivityMessage(null);
  };

  useEffect(() => {
    if (!currentUser) return;

    // Check if previous session was already idle for 15 minutes
    const storedActivity = localStorage.getItem(SESSION_ACTIVITY_KEY);
    const prevTimestamp = storedActivity ? parseInt(storedActivity, 10) : Date.now();
    if (Date.now() - prevTimestamp >= IDLE_TIMEOUT_MS) {
      logAudit(
        'AUTH_TIMEOUT',
        'auth',
        currentUser.username,
        `Session terminated automatically due to 15 minutes of inactivity.`,
        'warning'
      );
      clearStoredSession();
      setCurrentUser(null);
      setInactivityMessage('Your session has expired due to 15 minutes of inactivity. Please sign in again.');
      return;
    }

    // Initialize activity timestamp when user is active
    lastActivityTimeRef.current = Date.now();
    lastSavedActivityRef.current = Date.now();

    const recordActivity = () => {
      const now = Date.now();
      lastActivityTimeRef.current = now;
      // Throttled update to localStorage (at most once every 10 seconds to avoid CPU work)
      if (now - lastSavedActivityRef.current > 10000) {
        lastSavedActivityRef.current = now;
        try {
          localStorage.setItem(SESSION_ACTIVITY_KEY, String(now));
        } catch {}
      }
    };

    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'wheel',
    ];

    activityEvents.forEach((evt) =>
      window.addEventListener(evt, recordActivity, { passive: true })
    );

    const checkIdleTimeout = () => {
      const idleTime = Date.now() - lastActivityTimeRef.current;
      if (idleTime >= IDLE_TIMEOUT_MS) {
        logAudit(
          'AUTH_TIMEOUT',
          'auth',
          currentUser.username,
          `Session terminated automatically due to 15 minutes of inactivity.`,
          'warning'
        );
        clearStoredSession();
        setCurrentUser(null);
        setInactivityMessage(
          'Your session has expired due to 15 minutes of inactivity. Please sign in again.'
        );
      }
    };

    const intervalId = setInterval(checkIdleTimeout, 5000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkIdleTimeout();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      activityEvents.forEach((evt) =>
        window.removeEventListener(evt, recordActivity)
      );
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(intervalId);
    };
  }, [currentUser]);

  const switchUserDirectly = (userId: string) => {
    const target = users.find((u) => u.id === userId);
    if (target) {
      setCurrentUser(target);
      clearInactivityMessage();
      try {
        localStorage.setItem(SESSION_USER_KEY, target.id);
        localStorage.setItem(SESSION_ACTIVITY_KEY, String(Date.now()));
      } catch {}
      lastActivityTimeRef.current = Date.now();
      lastSavedActivityRef.current = Date.now();
      setActiveTab('dashboard');
      setSelectedSubnetId(null);
      logAudit(
        'USER_SWITCH',
        'auth',
        target.username,
        `Session switched to user '${target.username}' (${target.role}, ${target.authType})`,
        'info'
      );
    }
  };

  // User Management
  const createUser = (userData: Omit<User, 'id' | 'createdAt'>): { success: boolean; message: string; user?: User } => {
    if (!hasPermission('manageUsers')) {
      return { success: false, message: 'Permission denied: manageUsers required' };
    }

    // Check unique username
    const exists = users.some((u) => u.username.toLowerCase() === userData.username.trim().toLowerCase());
    if (exists) {
      return { success: false, message: `Username '${userData.username}' already exists.` };
    }

    const newUser: User = {
      ...userData,
      id: `usr-${Date.now()}`,
      createdAt: new Date().toISOString(),
      permissions: userData.permissions || { ...(DEFAULT_PERMISSIONS[userData.role] || DEFAULT_PERMISSIONS.operator) },
    };

    setUsers((prev) => {
      const next = [...prev, newUser];
      syncImmediate({ users: next });
      return next;
    });
    logAudit(
      'USER_CREATE',
      'user',
      newUser.username,
      `Created user '${newUser.fullName}' (@${newUser.username}) with Auth Type: [${newUser.authType.toUpperCase()}] and Role: [${newUser.role}]`,
      'success'
    );

    return { success: true, message: 'User created successfully', user: newUser };
  };

  const updateUser = (id: string, updates: Partial<User>): { success: boolean; message: string } => {
    if (!hasPermission('manageUsers') && currentUser?.id !== id) {
      return { success: false, message: 'Permission denied: manageUsers required' };
    }

    const existing = users.find((u) => u.id === id);
    if (!existing) return { success: false, message: 'User not found' };

    // Built-in Super Admin Protection: 'admin' account role must remain super_admin and status must remain active
    if (existing.username.toLowerCase() === 'admin' || existing.id === 'usr-admin') {
      if (updates.role && updates.role !== 'super_admin') {
        return { success: false, message: "Security Violation: The primary 'admin' account cannot be demoted from Super Admin." };
      }
      if (updates.status && updates.status !== 'active') {
        return { success: false, message: "Security Violation: The primary 'admin' account cannot be deactivated." };
      }
    }

    setUsers((prev) => {
      const next = prev.map((u) => (u.id === id ? { ...u, ...updates } : u));
      syncImmediate({ users: next });
      return next;
    });

    if (currentUser?.id === id) {
      setCurrentUser((prev) => (prev ? { ...prev, ...updates } : null));
    }

    logAudit(
      'USER_UPDATE',
      'user',
      existing.username,
      `Updated user attributes for '${existing.username}': ${Object.keys(updates).join(', ')}`,
      'info'
    );

    return { success: true, message: 'User updated successfully' };
  };

  const changePassword = (
    userId: string,
    newPassword: string,
    oldPassword?: string
  ): { success: boolean; message: string } => {
    const user = users.find((u) => u.id === userId);
    if (!user) return { success: false, message: 'User not found' };

    // If changing own password, verify old password if provided
    if (currentUser?.id === userId && oldPassword) {
      if (user.localPassword && user.localPassword !== oldPassword) {
        return { success: false, message: 'Current password is incorrect. Please check and try again.' };
      }
    } else if (!hasPermission('manageUsers') && currentUser?.id !== userId) {
      return { success: false, message: 'Permission denied: manageUsers required' };
    }

    if (!newPassword || newPassword.trim().length < 3) {
      return { success: false, message: 'New password must be at least 3 characters.' };
    }

    const updatedUser: User = { ...user, localPassword: newPassword };
    setUsers((prev) => {
      const next = prev.map((u) => (u.id === userId ? updatedUser : u));
      syncImmediate({ users: next });
      return next;
    });
    if (currentUser?.id === userId) {
      setCurrentUser(updatedUser);
    }

    logAudit(
      'USER_PASSWORD_CHANGE',
      'user',
      user.username,
      `Password successfully changed for user '${user.username}'`,
      'info'
    );

    return { success: true, message: 'Password updated successfully' };
  };

  const deleteUser = (id: string): { success: boolean; message: string } => {
    if (!hasPermission('manageUsers')) {
      return { success: false, message: 'Permission denied: manageUsers required' };
    }

    if (currentUser?.id === id) {
      return { success: false, message: 'Cannot delete your own active account.' };
    }

    const target = users.find((u) => u.id === id);
    if (!target) return { success: false, message: 'User not found' };

    // Built-in Super Admin Protection: 'admin' account can never be deleted
    if (target.username.toLowerCase() === 'admin' || target.id === 'usr-admin') {
      return { success: false, message: "Security Violation: The primary 'admin' root account cannot be deleted by any user." };
    }

    // Protection: Prevent deleting the last remaining super_admin
    if (target.role === 'super_admin') {
      const superAdminCount = users.filter((u) => u.role === 'super_admin' && u.id !== id).length;
      if (superAdminCount === 0) {
        return { success: false, message: 'Cannot delete the only remaining Super Administrator account.' };
      }
    }

    setUsers((prev) => {
      const next = prev.filter((u) => u.id !== id);
      syncImmediate({ users: next });
      return next;
    });
    logAudit(
      'USER_DELETE',
      'user',
      target.username,
      `Deleted user account '${target.username}' (${target.fullName})`,
      'warning'
    );

    return { success: true, message: 'User deleted successfully' };
  };

  const toggleUserStatus = (id: string) => {
    if (!hasPermission('manageUsers')) return;
    const target = users.find((u) => u.id === id);
    if (!target || target.id === currentUser?.id) return;

    // The primary admin account cannot be deactivated
    if (target.username.toLowerCase() === 'admin' || target.id === 'usr-admin') {
      return;
    }

    const newStatus = target.status === 'active' ? 'disabled' : 'active';
    updateUser(id, { status: newStatus });
  };

  // LDAP settings
  const updateLdapConfig = (config: LdapConfig) => {
    if (!hasPermission('manageAuthSettings')) return;
    setLdapConfig(config);
    logAudit(
      'LDAP_CONFIG_UPDATE',
      'system',
      'Active Directory / LDAP Integration',
      `Updated LDAP server URL to ${config.serverUrl}, Domain ${config.domain}, Base DN ${config.baseDn}`,
      'warning'
    );
  };

  const testLdapConnection = async (configOverride?: LdapConfig) => {
    const cfg = configOverride || ldapConfig;

    if (!cfg.serverUrl || !cfg.serverUrl.trim()) {
      return {
        success: false,
        diagnostics: [
          '[-] Directory Controller Server URL is missing or blank.',
          '[-] Connection failed: Incomplete configuration.',
        ],
        responseTimeMs: 0,
        error: 'Missing Server URL.',
      };
    }

    try {
      const response = await fetch('/api/network/ldap-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });

      if (response.ok) {
        const data = await response.json();
        logAudit(
          'LDAP_TEST',
          'system',
          cfg.serverUrl,
          `Active Directory connection test (${data.success ? 'PASS' : 'FAIL'}) in ${data.responseTimeMs}ms against ${cfg.domain || cfg.serverUrl}`,
          data.success ? 'success' : 'warning'
        );
        return data;
      }
    } catch (e: any) {
      console.warn('Backend LDAP test call failed, falling back:', e);
    }

    // Fallback if backend API unreachable
    return {
      success: false,
      diagnostics: [
        `[-] Failed to dispatch diagnostic check to IPAM backend service.`,
        `[-] Verify backend network services are running.`,
      ],
      responseTimeMs: 0,
      error: 'Backend network service error',
    };
  };

  // Device Classification Management
  const createDeviceClassification = (data: Omit<DeviceClassification, 'id' | 'createdAt' | 'updatedAt'>): {
    success: boolean;
    message: string;
    classification?: DeviceClassification;
  } => {
    const canManage =
      currentUser?.role === 'super_admin' ||
      currentUser?.role === 'network_admin' ||
      currentUser?.permissions.manageDeviceClassifications;
    if (!canManage) {
      return { success: false, message: 'Permission denied: manageDeviceClassifications required' };
    }

    if (!data.name || !data.name.trim()) {
      return { success: false, message: 'Classification name is required' };
    }

    const cleanCode = (data.code || data.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')).trim().toLowerCase();
    if (!cleanCode) {
      return { success: false, message: 'Unique code identifier is required' };
    }

    const duplicate = deviceClassifications.find(
      (dc) => dc.code.toLowerCase() === cleanCode || dc.name.toLowerCase() === data.name.trim().toLowerCase()
    );
    if (duplicate) {
      return { success: false, message: `Device classification with code '${cleanCode}' or name '${data.name}' already exists.` };
    }

    const newClass: DeviceClassification = {
      id: `devclass-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: data.name.trim(),
      code: cleanCode,
      category: data.category || 'Compute & Servers',
      description: data.description?.trim() || '',
      icon: data.icon || 'server',
      color: data.color || 'blue',
      vendor: data.vendor?.trim() || '',
      defaultPorts: data.defaultPorts?.trim() || '',
      snmpEnabled: data.snmpEnabled ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedClasses = [...deviceClassifications, newClass];
    setDeviceClassifications(updatedClasses);
    syncImmediate({ deviceClassifications: updatedClasses });

    logAudit(
      'DEVICE_CLASS_CREATE',
      'device',
      newClass.name,
      `Created device classification '${newClass.name}' (Code: ${newClass.code}, Category: ${newClass.category})`,
      'success'
    );

    return { success: true, message: `Device classification '${newClass.name}' created successfully`, classification: newClass };
  };

  const updateDeviceClassification = (id: string, updates: Partial<DeviceClassification>): {
    success: boolean;
    message: string;
  } => {
    const canManage =
      currentUser?.role === 'super_admin' ||
      currentUser?.role === 'network_admin' ||
      currentUser?.permissions.manageDeviceClassifications;
    if (!canManage) {
      return { success: false, message: 'Permission denied: manageDeviceClassifications required' };
    }

    const target = deviceClassifications.find((dc) => dc.id === id);
    if (!target) {
      return { success: false, message: 'Device classification not found' };
    }

    if (updates.code) {
      const cleanCode = updates.code.trim().toLowerCase();
      const duplicate = deviceClassifications.find((dc) => dc.id !== id && dc.code.toLowerCase() === cleanCode);
      if (duplicate) {
        return { success: false, message: `Another classification with code '${cleanCode}' already exists.` };
      }
      updates.code = cleanCode;
    }

    const updatedClasses = deviceClassifications.map((dc) =>
      dc.id === id ? { ...dc, ...updates, updatedAt: new Date().toISOString() } : dc
    );
    setDeviceClassifications(updatedClasses);
    syncImmediate({ deviceClassifications: updatedClasses });

    logAudit(
      'DEVICE_CLASS_UPDATE',
      'device',
      target.name,
      `Updated device classification '${target.name}' details: ${Object.keys(updates).join(', ')}`,
      'info'
    );

    return { success: true, message: `Device classification '${target.name}' updated successfully` };
  };

  const deleteDeviceClassification = (id: string): { success: boolean; message: string } => {
    const canManage =
      currentUser?.role === 'super_admin' ||
      currentUser?.role === 'network_admin' ||
      currentUser?.permissions.manageDeviceClassifications;
    if (!canManage) {
      return { success: false, message: 'Permission denied: manageDeviceClassifications required' };
    }

    const target = deviceClassifications.find((dc) => dc.id === id);
    if (!target) {
      return { success: false, message: 'Device classification not found' };
    }

    // Check how many IPs currently reference this deviceType code
    const matchingIps = ips.filter((ip) => ip.deviceType === target.code);
    if (matchingIps.length > 0) {
      // Re-assign matching IPs to 'other' so they don't break
      setIps((prev) =>
        prev.map((ip) => (ip.deviceType === target.code ? { ...ip, deviceType: 'other' } : ip))
      );
    }

    const updatedClasses = deviceClassifications.filter((dc) => dc.id !== id);
    setDeviceClassifications(updatedClasses);
    syncImmediate({ deviceClassifications: updatedClasses });

    logAudit(
      'DEVICE_CLASS_DELETE',
      'device',
      target.name,
      `Deleted device classification '${target.name}' (${target.code}). Migrated ${matchingIps.length} assigned IP(s) to 'other'`,
      'warning'
    );

    return {
      success: true,
      message: `Device classification '${target.name}' deleted successfully.${matchingIps.length > 0 ? ` ${matchingIps.length} allocated IP(s) updated to general type.` : ''}`,
    };
  };

  // Subnet Management
  const createSubnet = (subnetData: {
    name: string;
    cidr: string;
    vlanId?: number;
    location: string;
    description: string;
    tags?: string[];
  }): { success: boolean; message: string; subnet?: Subnet } => {
    if (!hasPermission('createSubnet')) {
      return { success: false, message: 'Permission denied: createSubnet required' };
    }

    const info = parseCIDR(subnetData.cidr);
    if (!info) {
      return { success: false, message: 'Invalid CIDR notation. Must be e.g. 192.168.1.0/24' };
    }

    // Check if CIDR already exists
    const duplicate = subnets.find((s) => s.cidr === subnetData.cidr);
    if (duplicate) {
      return { success: false, message: `Subnet with CIDR ${subnetData.cidr} already exists.` };
    }

    const subnetId = `subnet-${Date.now()}`;
    const newSubnet: Subnet = {
      id: subnetId,
      name: subnetData.name,
      cidr: subnetData.cidr,
      vlanId: subnetData.vlanId,
      vrf: 'DEFAULT_VRF',
      location: subnetData.location,
      description: subnetData.description,
      gateway: info.gateway,
      dnsServers: ['1.1.1.1', '8.8.8.8'],
      totalHosts: info.totalHosts,
      usableHosts: info.usableHosts,
      networkAddress: info.networkAddress,
      broadcastAddress: info.broadcastAddress,
      mask: info.subnetMask,
      tags: subnetData.tags && subnetData.tags.length > 0 ? subnetData.tags : ['New'],
      colorTag: 'emerald',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSubnets((prev) => [...prev, newSubnet]);

    // Automatically allocate the gateway IP
    const gatewayRecord: IPRecord = {
      id: `ip-${Date.now()}-gw`,
      ip: info.gateway,
      subnetId,
      status: 'allocated',
      hostname: `gw-${newSubnet.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.corp.internal`,
      deviceType: 'router',
      owner: 'Network Infrastructure',
      notes: 'Subnet Default Gateway',
      allocatedAt: new Date().toISOString(),
      allocatedBy: currentUser?.username || 'admin',
      lastPingStatus: 'unknown',
      lastPingAt: undefined,
      dnsResolved: true,
    };
    setIps((prev) => [...prev, gatewayRecord]);

    // Automatically probe gateway health in background
    setTimeout(() => {
      pingIP(gatewayRecord.id).catch(() => {});
    }, 150);

    logAudit(
      'SUBNET_CREATE',
      'subnet',
      newSubnet.cidr,
      `Created subnet '${newSubnet.name}' (${newSubnet.cidr}, VLAN ${newSubnet.vlanId || 'N/A'}) in ${newSubnet.location}`,
      'success'
    );

    return { success: true, message: 'Subnet created successfully', subnet: newSubnet };
  };

  const updateSubnet = (id: string, updates: Partial<Subnet>): { success: boolean; message: string } => {
    if (!hasPermission('editSubnet', id)) {
      return { success: false, message: 'Permission denied: editSubnet required for this subnet' };
    }

    const target = subnets.find((s) => s.id === id);
    if (!target) return { success: false, message: 'Subnet not found' };

    setSubnets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s))
    );

    logAudit(
      'SUBNET_UPDATE',
      'subnet',
      target.cidr,
      `Updated subnet '${target.name}' (${target.cidr}): ${Object.keys(updates).join(', ')}`,
      'info'
    );

    return { success: true, message: 'Subnet updated successfully' };
  };

  const deleteSubnet = (id: string): { success: boolean; message: string } => {
    if (!hasPermission('deleteSubnet', id)) {
      return { success: false, message: 'Permission denied: deleteSubnet required' };
    }

    const target = subnets.find((s) => s.id === id);
    if (!target) return { success: false, message: 'Subnet not found' };

    setSubnets((prev) => prev.filter((s) => s.id !== id));
    // Clean up associated IPs
    setIps((prev) => prev.filter((ip) => ip.subnetId !== id));

    if (selectedSubnetId === id) {
      setSelectedSubnetId(null);
    }

    logAudit(
      'SUBNET_DELETE',
      'subnet',
      target.cidr,
      `Deleted subnet '${target.name}' (${target.cidr}) and purged associated IP records`,
      'warning'
    );

    return { success: true, message: 'Subnet deleted successfully' };
  };

  // IP Management
  const allocateIP = (data: {
    subnetId: string;
    ip: string;
    hostname?: string;
    macAddress?: string;
    deviceType?: IPRecord['deviceType'];
    owner?: string;
    department?: string;
    notes?: string;
    status?: IPRecord['status'];
    lastPingStatus?: IPRecord['lastPingStatus'];
  }): { success: boolean; message: string; record?: IPRecord } => {
    if (!hasPermission('allocateIP', data.subnetId)) {
      return { success: false, message: 'Permission denied: allocateIP required for this subnet' };
    }

    // Check if IP already allocated in this subnet
    const existing = ips.find((i) => i.subnetId === data.subnetId && i.ip === data.ip);
    if (existing && existing.status !== 'available') {
      return { success: false, message: `IP ${data.ip} is already assigned (${existing.status})` };
    }

    const newRecord: IPRecord = {
      id: existing ? existing.id : `ip-${Date.now()}`,
      subnetId: data.subnetId,
      ip: data.ip,
      status: data.status || 'allocated',
      hostname: data.hostname,
      macAddress: data.macAddress,
      deviceType: data.deviceType || 'server',
      owner: data.owner || currentUser?.fullName,
      department: data.department || currentUser?.department,
      notes: data.notes,
      allocatedAt: new Date().toISOString(),
      allocatedBy: currentUser?.username || 'admin',
      lastPingStatus: data.lastPingStatus || 'unknown',
      lastPingAt: undefined,
      dnsResolved: Boolean(data.hostname),
    };

    if (existing) {
      setIps((prev) => prev.map((item) => (item.id === existing.id ? newRecord : item)));
    } else {
      setIps((prev) => [...prev, newRecord]);
    }

    // Immediately trigger background probe to update real network health
    setTimeout(() => {
      pingIP(newRecord.id).catch(() => {});
    }, 150);

    logAudit(
      'IP_ALLOCATE',
      'ip',
      data.ip,
      `Allocated IP ${data.ip} (${newRecord.hostname || 'No Hostname'}) [Status: ${newRecord.status}] by ${currentUser?.username}`,
      'success'
    );

    return { success: true, message: 'IP allocated successfully', record: newRecord };
  };

  const bulkAllocateIPs = (
    subnetId: string,
    records: Array<{
      ip: string;
      hostname?: string;
      macAddress?: string;
      deviceType?: IPRecord['deviceType'];
      owner?: string;
      department?: string;
      notes?: string;
      status?: IPRecord['status'];
      lastPingStatus?: IPRecord['lastPingStatus'];
    }>,
    mode: 'skip_existing' | 'overwrite_existing' = 'skip_existing'
  ): { success: boolean; message: string; count: number } => {
    if (!hasPermission('allocateIP', subnetId)) {
      return { success: false, message: 'Permission denied: allocateIP required for this subnet', count: 0 };
    }

    if (!records || records.length === 0) {
      return { success: false, message: 'No IP records provided for allocation', count: 0 };
    }

    let affectedCount = 0;
    const nowIso = new Date().toISOString();
    const allocatedBy = currentUser?.username || 'admin';
    const defaultOwner = currentUser?.fullName || '';
    const defaultDept = currentUser?.department || '';

    setIps((prev) => {
      // Build O(1) lookup index of existing IPs for this subnet to avoid O(N^2) scans
      const updated = [...prev];
      const existingIpIndexMap = new Map<string, number>();
      for (let i = 0; i < updated.length; i++) {
        if (updated[i].subnetId === subnetId) {
          existingIpIndexMap.set(updated[i].ip, i);
        }
      }

      const newItems: IPRecord[] = [];
      const timestampBase = Date.now();

      for (let idx = 0; idx < records.length; idx++) {
        const data = records[idx];
        const existingIdx = existingIpIndexMap.get(data.ip);

        if (existingIdx !== undefined) {
          if (mode === 'overwrite_existing') {
            const currentItem = updated[existingIdx];
            updated[existingIdx] = {
              ...currentItem,
              hostname: data.hostname ?? currentItem.hostname,
              macAddress: data.macAddress ?? currentItem.macAddress,
              deviceType: data.deviceType ?? currentItem.deviceType,
              owner: data.owner ?? currentItem.owner,
              department: data.department ?? currentItem.department,
              notes: data.notes ?? currentItem.notes,
              status: data.status || 'allocated',
              allocatedAt: nowIso,
              allocatedBy,
              lastPingStatus: data.lastPingStatus || 'unknown',
              lastPingAt: undefined,
              dnsResolved: Boolean(data.hostname),
            };
            affectedCount++;
          }
        } else {
          const newRec: IPRecord = {
            id: `ip-${timestampBase}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            subnetId,
            ip: data.ip,
            status: data.status || 'allocated',
            hostname: data.hostname || '',
            macAddress: data.macAddress || '',
            deviceType: data.deviceType || 'workstation',
            owner: data.owner || defaultOwner,
            department: data.department || defaultDept,
            notes: data.notes || '',
            allocatedAt: nowIso,
            allocatedBy,
            lastPingStatus: data.lastPingStatus || 'unknown',
            lastPingAt: undefined,
            dnsResolved: Boolean(data.hostname),
          };
          newItems.push(newRec);
          // Register in map immediately to handle any duplicate rows inside the batch itself
          existingIpIndexMap.set(data.ip, updated.length + newItems.length - 1);
          affectedCount++;
        }
      }

      if (newItems.length > 0) {
        // Trigger background batch probe on new items
        const newIps = newItems.map((n) => n.ip);
        setTimeout(() => {
          batchPingIPs(newIps).catch(() => {});
        }, 200);
        return updated.concat(newItems);
      }
      return updated;
    });

    logAudit(
      'IP_BULK_ALLOCATE',
      'ip',
      `${records.length} IPs`,
      `Bulk processed ${records.length} IP records for subnet (${affectedCount} added/updated, mode: ${mode})`,
      'success'
    );

    return { success: true, message: `Successfully processed ${affectedCount} IP records.`, count: affectedCount };
  };

  const releaseIP = (id: string): { success: boolean; message: string } => {
    const target = ips.find((i) => i.id === id);
    if (!target) return { success: false, message: 'IP record not found' };

    if (!hasPermission('releaseIP', target.subnetId)) {
      return { success: false, message: 'Permission denied: releaseIP required for this subnet' };
    }

    setIps((prev) => prev.filter((i) => i.id !== id));

    logAudit(
      'IP_RELEASE',
      'ip',
      target.ip,
      `Released IP ${target.ip} previously assigned to ${target.hostname || target.owner || 'unnamed'}`,
      'info'
    );

    return { success: true, message: `IP ${target.ip} has been released.` };
  };

  const updateIP = (id: string, updates: Partial<IPRecord>): { success: boolean; message: string } => {
    const target = ips.find((i) => i.id === id);
    if (!target) return { success: false, message: 'IP record not found' };

    if (!hasPermission('editIP', target.subnetId)) {
      return { success: false, message: 'Permission denied: editIP required for this subnet' };
    }

    setIps((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));

    logAudit(
      'IP_UPDATE',
      'ip',
      target.ip,
      `Updated IP ${target.ip} details: ${Object.keys(updates).join(', ')}`,
      'info'
    );

    return { success: true, message: 'IP updated successfully' };
  };

  const pingIP = async (
    idOrIp: string
  ): Promise<{
    success?: boolean;
    online: boolean;
    status: 'online' | 'offline' | 'unreachable';
    latencyMs: number;
    openPorts?: string[];
    hostname?: string;
    macAddress?: string;
    deviceType?: string;
  }> => {
    const target = ips.find((i) => i.id === idOrIp || i.ip === idOrIp);
    const targetIp = target ? target.ip : idOrIp;

    try {
      const res = await fetch('/api/network/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: targetIp, timeoutMs: 800, probePorts: true, resolveDns: true }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const resultStatus: 'online' | 'unreachable' = data.online ? 'online' : 'unreachable';
          const latency = data.online ? (data.latencyMs ?? 1) : 0;

          if (target) {
            const updated: Partial<IPRecord> = {
              lastPingStatus: resultStatus,
              lastPingAt: new Date().toISOString(),
            };

            // If reverse DNS resolved a hostname and record had none, auto-fill it
            if (data.hostname && (!target.hostname || target.hostname === 'Unassigned' || target.hostname.trim() === '')) {
              updated.hostname = data.hostname;
            }
            // If ARP found a MAC and record had none, auto-fill it
            if (data.macAddress && (!target.macAddress || target.macAddress === '00:00:00:00:00:00' || target.macAddress.trim() === '')) {
              updated.macAddress = data.macAddress;
            }

            setIps((prev) => prev.map((i) => (i.id === target!.id ? { ...i, ...updated } : i)));
          }

          return {
            success: true,
            online: Boolean(data.online),
            status: resultStatus,
            latencyMs: latency,
            openPorts: data.openPorts || [],
            hostname: data.hostname,
            macAddress: data.macAddress,
            deviceType: data.deviceType,
          };
        }
      }
    } catch (e) {
      console.warn('Real network ping probe API request failed, falling back:', e);
    }

    // Fallback if network API fails or host is unreachable
    if (target) {
      const updated = {
        lastPingStatus: 'unreachable' as const,
        lastPingAt: new Date().toISOString(),
      };
      setIps((prev) => prev.map((i) => (i.id === target.id ? { ...i, ...updated } : i)));
    }
    return {
      success: true,
      online: false,
      status: 'unreachable',
      latencyMs: 0,
      openPorts: [],
    };
  };

  const batchPingIPs = async (
    idsOrIps?: string[]
  ): Promise<{
    total: number;
    online: number;
    offline: number;
    results: Array<{ ip: string; online: boolean; latencyMs: number }>;
  }> => {
    let targetIps: string[] = [];
    if (idsOrIps && idsOrIps.length > 0) {
      const idOrIpSet = new Set(idsOrIps);
      targetIps = ips
        .filter((i) => idOrIpSet.has(i.id) || idOrIpSet.has(i.ip))
        .map((i) => i.ip);
      idsOrIps.forEach((item) => {
        if (isValidIPv4(item) && !targetIps.includes(item)) {
          targetIps.push(item);
        }
      });
    } else {
      targetIps = ips
        .filter((i) => i.status !== 'available')
        .map((i) => i.ip);
    }

    if (targetIps.length === 0) {
      return { total: 0, online: 0, offline: 0, results: [] };
    }

    const uniqueIps = Array.from(new Set(targetIps));
    const allResults: Array<{
      ip: string;
      online: boolean;
      latencyMs: number;
      hostname?: string;
      macAddress?: string;
      openPorts?: string[];
      deviceType?: string;
    }> = [];

    const batchSize = 32;
    for (let i = 0; i < uniqueIps.length; i += batchSize) {
      const slice = uniqueIps.slice(i, i + batchSize);
      try {
        const res = await fetch('/api/network/scan-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ips: slice,
            probePorts: true,
            resolveDns: true,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.results)) {
            allResults.push(...data.results);
          }
        }
      } catch (err) {
        console.warn('[IPAM] Batch scan slice failed:', err);
      }
    }

    const resultMap = new Map<string, { online: boolean; latencyMs: number; hostname?: string; macAddress?: string; deviceType?: string }>();
    allResults.forEach((r) => {
      resultMap.set(r.ip, r);
    });

    const nowIso = new Date().toISOString();
    let onlineCount = 0;
    let offlineCount = 0;

    setIps((prev) =>
      prev.map((item) => {
        const probe = resultMap.get(item.ip);
        if (!probe) {
          return item;
        }

        if (probe.online) {
          onlineCount++;
        } else {
          offlineCount++;
        }

        const updated: IPRecord = {
          ...item,
          lastPingStatus: probe.online ? 'online' : 'unreachable',
          lastPingAt: nowIso,
        };

        if (probe.hostname && (!item.hostname || item.hostname === 'Unassigned' || item.hostname.trim() === '')) {
          updated.hostname = probe.hostname;
        }
        if (probe.macAddress && (!item.macAddress || item.macAddress === '00:00:00:00:00:00' || item.macAddress.trim() === '')) {
          updated.macAddress = probe.macAddress;
        }

        return updated;
      })
    );

    return {
      total: uniqueIps.length,
      online: onlineCount,
      offline: offlineCount,
      results: allResults,
    };
  };

  const updateSnmpConfig = async (
    incoming: Partial<SnmpMonitoringConfig>
  ): Promise<{ success: boolean; config: SnmpMonitoringConfig }> => {
    setSnmpConfig((prev) => ({ ...prev, ...incoming }));
    try {
      const res = await fetch('/api/snmp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incoming),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          setSnmpConfig(data.config);
          return { success: true, config: data.config };
        }
      }
    } catch (err) {
      console.warn('[IPAM] Error updating SNMP config on server:', err);
    }
    return { success: true, config: { ...snmpConfig, ...incoming } };
  };

  const triggerServerSnmpProbe = async (): Promise<{ success: boolean; config: SnmpMonitoringConfig }> => {
    try {
      const res = await fetch('/api/snmp/probe', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          setSnmpConfig(data.config);
          const statusRes = await fetch('/api/snmp/status');
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.success && Array.isArray(statusData.ips)) {
              const statusMap = new Map(statusData.ips.map((item: any) => [item.id, item]));
              setIps((prev) =>
                prev.map((rec) => {
                  const updated: any = statusMap.get(rec.id);
                  if (updated) {
                    return {
                      ...rec,
                      lastPingStatus: updated.lastPingStatus,
                      lastPingAt: updated.lastPingAt,
                      lastPingLatencyMs: updated.lastPingLatencyMs,
                    };
                  }
                  return rec;
                })
              );
            }
          }
          return { success: true, config: data.config };
        }
      }
    } catch (err) {
      console.warn('[IPAM] Error triggering server probe:', err);
    }
    return { success: false, config: snmpConfig };
  };

  const createBackupPackage = (includeAuditLogs: boolean = true): IPAMBackupData => {
    return {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      exportedBy: {
        username: currentUser?.username || 'system',
        fullName: currentUser?.fullName || 'System User',
        role: currentUser?.role || 'super_admin',
      },
      metadata: {
        appName: 'Enterprise IPAM Suite',
        totalSubnets: subnets.length,
        totalIPs: ips.length,
        totalUsers: users.length,
        totalDeviceClassifications: deviceClassifications.length,
        totalAuditLogs: includeAuditLogs ? auditLogs.length : 0,
        ldapConfigured: ldapConfig.enabled,
        hasSnmpConfig: true,
      },
      data: {
        subnets: JSON.parse(JSON.stringify(subnets)),
        ips: JSON.parse(JSON.stringify(ips)),
        users: JSON.parse(JSON.stringify(users)),
        ldapConfig: JSON.parse(JSON.stringify(ldapConfig)),
        deviceClassifications: JSON.parse(JSON.stringify(deviceClassifications)),
        auditLogs: includeAuditLogs ? JSON.parse(JSON.stringify(auditLogs)) : [],
        auditSettings: JSON.parse(JSON.stringify(auditSettings)),
        snmpConfig: JSON.parse(JSON.stringify(snmpConfig)),
      },
    };
  };

  const exportBackupToFile = (includeAuditLogs: boolean = true) => {
    const backup = createBackupPackage(includeAuditLogs);
    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeDate = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.href = url;
    link.download = `IPAM_Full_Backup_${safeDate}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logAudit(
      'SYSTEM_BACKUP_EXPORT',
      'system',
      'Full System Backup',
      `Exported full system backup package (${backup.metadata.totalSubnets} subnets, ${backup.metadata.totalIPs} IPs, ${backup.metadata.totalUsers} users, ${backup.metadata.totalDeviceClassifications} device classes)`,
      'info'
    );
  };

  const restoreFromBackup = (
    backup: IPAMBackupData,
    options: Partial<RestoreOptions> = {}
  ): {
    success: boolean;
    message: string;
    stats: { subnets: number; ips: number; users: number; deviceClasses: number; auditLogs: number };
  } => {
    if (currentUser && currentUser.role !== 'super_admin') {
      return {
        success: false,
        message: 'Permission denied: System Administrator (super_admin) privileges required to execute disaster recovery restore.',
        stats: { subnets: 0, ips: 0, users: 0, deviceClasses: 0, auditLogs: 0 },
      };
    }

    if (!backup || !backup.data) {
      return {
        success: false,
        message: 'Invalid backup format. Missing backup data payload.',
        stats: { subnets: 0, ips: 0, users: 0, deviceClasses: 0, auditLogs: 0 },
      };
    }

    const {
      restoreSubnets = true,
      restoreIPs = true,
      restoreUsers = true,
      restoreLdap = true,
      restoreDeviceClasses = true,
      restoreAuditLogs = true,
      restoreAuditSettings = true,
      restoreSnmpConfig = true,
      mode = 'overwrite',
    } = options;

    let subnetsRestored = 0;
    let ipsRestored = 0;
    let usersRestored = 0;
    let deviceClassesRestored = 0;
    let auditLogsRestored = 0;

    let nextSubnets = subnets;
    let nextIps = ips;
    let nextUsers = users;
    let nextLdapConfig = ldapConfig;
    let nextAuditLogs = auditLogs;
    let nextAuditSettings = auditSettings;
    let nextDeviceClassifications = deviceClassifications;

    // 1. Subnets
    if (restoreSubnets && Array.isArray(backup.data.subnets)) {
      if (mode === 'overwrite') {
        nextSubnets = backup.data.subnets;
        setSubnets(backup.data.subnets);
        subnetsRestored = backup.data.subnets.length;
      } else {
        const merged = [...subnets];
        backup.data.subnets.forEach((s) => {
          const idx = merged.findIndex((x) => x.id === s.id || x.cidr === s.cidr);
          if (idx >= 0) {
            merged[idx] = s;
          } else {
            merged.push(s);
          }
        });
        nextSubnets = merged;
        setSubnets(merged);
        subnetsRestored = backup.data.subnets.length;
      }
    }

    // 2. IPs
    if (restoreIPs && Array.isArray(backup.data.ips)) {
      if (mode === 'overwrite') {
        nextIps = backup.data.ips;
        setIps(backup.data.ips);
        ipsRestored = backup.data.ips.length;
      } else {
        const merged = [...ips];
        backup.data.ips.forEach((ipRec) => {
          const idx = merged.findIndex((x) => x.subnetId === ipRec.subnetId && x.ip === ipRec.ip);
          if (idx >= 0) {
            merged[idx] = ipRec;
          } else {
            merged.push(ipRec);
          }
        });
        nextIps = merged;
        setIps(merged);
        ipsRestored = backup.data.ips.length;
      }
    }

    // 3. Users
    if (restoreUsers && Array.isArray(backup.data.users) && backup.data.users.length > 0) {
      if (mode === 'overwrite') {
        nextUsers = backup.data.users;
        setUsers(backup.data.users);
        const stillExists = backup.data.users.find((u) => u.id === currentUser?.id);
        if (!stillExists) {
          setCurrentUser(backup.data.users[0]);
        }
        usersRestored = backup.data.users.length;
      } else {
        const merged = [...users];
        backup.data.users.forEach((u) => {
          const idx = merged.findIndex((x) => x.id === u.id || x.username === u.username);
          if (idx >= 0) {
            merged[idx] = u;
          } else {
            merged.push(u);
          }
        });
        nextUsers = merged;
        setUsers(merged);
        usersRestored = backup.data.users.length;
      }
    }

    // 4. LDAP Settings
    if (restoreLdap && backup.data.ldapConfig) {
      nextLdapConfig = backup.data.ldapConfig;
      setLdapConfig(backup.data.ldapConfig);
    }

    // 5. Device Classifications (Hardened)
    if (restoreDeviceClasses) {
      const incomingClasses = Array.isArray(backup.data.deviceClassifications)
        ? backup.data.deviceClassifications
        : [];

      // Validate and sanitize incoming classifications
      const sanitizedIncoming: DeviceClassification[] = incomingClasses
        .filter((d: any) => d && typeof d === 'object' && (d.name || d.code))
        .map((d: any) => ({
          id: d.id || `devclass-${(d.code || d.name || 'custom').toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          name: d.name || 'Unnamed Classification',
          code: (d.code || d.name || 'custom').toLowerCase().trim(),
          category: d.category || 'Custom Appliance',
          description: d.description || '',
          icon: d.icon || 'server',
          color: d.color || 'blue',
          vendor: d.vendor || '',
          defaultPorts: d.defaultPorts || '',
          snmpEnabled: d.snmpEnabled !== false,
          createdAt: d.createdAt || new Date().toISOString(),
          updatedAt: d.updatedAt || new Date().toISOString(),
        }));

      if (sanitizedIncoming.length > 0) {
        if (mode === 'overwrite') {
          nextDeviceClassifications = sanitizedIncoming;
          setDeviceClassifications(sanitizedIncoming);
          deviceClassesRestored = sanitizedIncoming.length;
        } else {
          const merged = [...deviceClassifications];
          sanitizedIncoming.forEach((d) => {
            const idx = merged.findIndex(
              (x) => x.id === d.id || x.code.toLowerCase() === d.code.toLowerCase() || x.name.toLowerCase() === d.name.toLowerCase()
            );
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], ...d };
            } else {
              merged.push(d);
            }
          });
          nextDeviceClassifications = merged;
          setDeviceClassifications(merged);
          deviceClassesRestored = sanitizedIncoming.length;
        }
      } else if (deviceClassifications.length === 0 && INITIAL_DEVICE_CLASSIFICATIONS.length > 0) {
        // Fallback to initial classifications if current state is empty and baseline exists
        nextDeviceClassifications = INITIAL_DEVICE_CLASSIFICATIONS;
        setDeviceClassifications(INITIAL_DEVICE_CLASSIFICATIONS);
        deviceClassesRestored = INITIAL_DEVICE_CLASSIFICATIONS.length;
      }
    }

    // 6. Audit Settings
    if (restoreAuditSettings && backup.data.auditSettings) {
      nextAuditSettings = backup.data.auditSettings;
      setAuditSettings(backup.data.auditSettings);
    }

    // 7. SNMP Config
    if (restoreSnmpConfig && backup.data.snmpConfig) {
      setSnmpConfig((prev) => {
        const merged = { ...prev, ...backup.data.snmpConfig };
        try {
          localStorage.setItem('ipam_snmp_monitoring_config', JSON.stringify(merged));
        } catch (e) {}
        return merged;
      });
    }

    // 8. Audit Logs
    if (restoreAuditLogs && Array.isArray(backup.data.auditLogs) && backup.data.auditLogs.length > 0) {
      if (mode === 'overwrite') {
        nextAuditLogs = backup.data.auditLogs;
        setAuditLogs(backup.data.auditLogs);
        auditLogsRestored = backup.data.auditLogs.length;
      } else {
        const ids = new Set(auditLogs.map((l) => l.id));
        const newEntries = backup.data.auditLogs.filter((l) => !ids.has(l.id));
        auditLogsRestored = newEntries.length;
        const merged = [...newEntries, ...auditLogs];
        nextAuditLogs = merged;
        setAuditLogs(merged);
      }
    }

    // Immediately push to backend API so disk database and PostgreSQL are updated synchronously
    syncToServer({
      subnets: nextSubnets,
      ips: nextIps,
      users: nextUsers,
      ldapConfig: nextLdapConfig,
      auditLogs: nextAuditLogs,
      deviceClassifications: nextDeviceClassifications,
      auditSettings: nextAuditSettings,
    });

    const summaryMsg = `Restored ${subnetsRestored} subnets, ${ipsRestored} IPs, ${usersRestored} users, ${deviceClassesRestored} device classes from backup package`;
    logAudit(
      'SYSTEM_BACKUP_RESTORE',
      'system',
      'System Restore',
      summaryMsg,
      'warning'
    );

    return {
      success: true,
      message: `System restored successfully! ${summaryMsg}`,
      stats: {
        subnets: subnetsRestored,
        ips: ipsRestored,
        users: usersRestored,
        deviceClasses: deviceClassesRestored,
        auditLogs: auditLogsRestored,
      },
    };
  };

  const resetData = () => {
    if (currentUser && currentUser.role !== 'super_admin') {
      return;
    }

    localStorage.removeItem('ipam_users');
    localStorage.removeItem('ipam_subnets');
    localStorage.removeItem('ipam_ips');
    localStorage.removeItem('ipam_ldap_config');
    localStorage.removeItem('ipam_audit_logs');
    localStorage.removeItem('ipam_device_classifications');
    localStorage.removeItem('ipam_audit_settings');
    localStorage.removeItem('ipam_current_user_id');

    if (typeof window !== 'undefined') {
      localStorage.removeItem('ipam_users');
      localStorage.removeItem('ipam_subnets');
      localStorage.removeItem('ipam_ips');
      localStorage.removeItem('ipam_ldap_config');
      localStorage.removeItem('ipam_audit_logs');
      localStorage.removeItem('ipam_device_classifications');
      localStorage.removeItem('ipam_audit_settings');
      localStorage.removeItem('ipam_current_user_id');
      localStorage.setItem('ipam_db_version', '3.2.0');
    }

    setUsers(INITIAL_USERS);
    setCurrentUser(INITIAL_USERS[0]);
    setSubnets(INITIAL_SUBNETS);
    setIps(INITIAL_IPS);
    setLdapConfig(INITIAL_LDAP_CONFIG);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setDeviceClassifications(INITIAL_DEVICE_CLASSIFICATIONS);
    setAuditSettings(INITIAL_AUDIT_SETTINGS);
    setSelectedSubnetId(null);
    setActiveTab('subnets');
    try {
      localStorage.removeItem('ipam_active_tab');
      localStorage.removeItem('ipam_selected_subnet_id');
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', '#subnets');
      }
    } catch (e) {}
    fetch('/api/ipam/reset', { method: 'POST' }).catch(() => {});
  };

  return (
    <IPAMContext.Provider
      value={{
        currentUser,
        users,
        subnets,
        ips,
        ldapConfig,
        auditLogs,
        auditSettings,
        deviceClassifications,
        activeTab,
        setActiveTab,
        selectedSubnetId,
        setSelectedSubnetId,
        isInitialLoadDone,
        createDeviceClassification,
        updateDeviceClassification,
        deleteDeviceClassification,
        login,
        logout,
        switchUserDirectly,
        inactivityMessage,
        clearInactivityMessage,
        createUser,
        updateUser,
        changePassword,
        deleteUser,
        toggleUserStatus,
        updateLdapConfig,
        testLdapConnection,
        createSubnet,
        updateSubnet,
        deleteSubnet,
        allocateIP,
        bulkAllocateIPs,
        releaseIP,
        deleteIP: releaseIP,
        updateIP,
        pingIP,
        batchPingIPs,
        logAudit,
        updateAuditSettings,
        clearAllAuditLogs,
        clearAuditLogsOlderThan,
        rotateAuditLogs,
        hasPermission,
        resetData,
        createBackupPackage,
        exportBackupToFile,
        restoreFromBackup,
        snmpConfig,
        updateSnmpConfig,
        triggerServerSnmpProbe,
      }}
    >
      {children}
    </IPAMContext.Provider>
  );
};

export const useIPAM = () => {
  const context = useContext(IPAMContext);
  if (!context) {
    throw new Error('useIPAM must be used within an IPAMProvider');
  }
  return context;
};
