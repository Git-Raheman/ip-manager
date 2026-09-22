import React, { useState, useMemo } from 'react';
import { useIPAM, NavigationTab } from '../context/IPAMContext';
import { IPRecord, Subnet, DeviceClassification } from '../types';
import {
  LayoutDashboard,
  Network,
  Users,
  Layers,
  Search,
  ArrowRight,
  Activity,
  Server,
  Plus,
  Clock,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  FileText,
  MapPin,
  Wifi,
  Radio,
  Eye,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Lock,
  Unlock,
  Building,
  User as UserIcon,
  Tag,
  AlertTriangle,
  X,
  SlidersHorizontal,
  Edit2,
} from 'lucide-react';
import { renderDeviceIcon } from '../utils/deviceIcons';
import { getClassificationTheme } from '../utils/deviceColors';

interface DashboardViewProps {
  onSelectSubnet: (subnetId: string, targetIp?: string, action?: 'view' | 'edit' | 'allocate') => void;
  onNavigateTab: (tab: NavigationTab) => void;
  onOpenCreateSubnet?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSelectSubnet,
  onNavigateTab,
  onOpenCreateSubnet,
}) => {
  const {
    currentUser,
    subnets,
    ips,
    users,
    deviceClassifications,
    auditLogs,
    ldapConfig,
    hasPermission,
    pingIP,
    releaseIP,
    updateIP,
  } = useIPAM();

  // Search state
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchCategory, setSearchCategory] = useState<'all' | 'subnets' | 'ips' | 'devices' | 'users' | 'audit'>('all');

  // Selected IP for Properties Modal
  const [selectedIpRecord, setSelectedIpRecord] = useState<IPRecord | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isPingingModalIp, setIsPingingModalIp] = useState(false);
  const [modalPingStatus, setModalPingStatus] = useState<{
    tested: boolean;
    online: boolean;
    latencyMs: number;
    message?: string;
  } | null>(null);
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false);
  const [releaseStatusMsg, setReleaseStatusMsg] = useState<string | null>(null);

  // Notes editing state for IP property popup
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSaveStatus, setNotesSaveStatus] = useState<string | null>(null);

  // Sync draft notes when selectedIpRecord changes
  React.useEffect(() => {
    if (selectedIpRecord) {
      setNotesDraft(selectedIpRecord.notes || '');
      setIsEditingNotes(false);
      setNotesSaveStatus(null);
    }
  }, [selectedIpRecord]);

  const handleSaveNotes = () => {
    if (!selectedIpRecord) return;
    const res = updateIP(selectedIpRecord.id, { notes: notesDraft });
    if (res.success) {
      setSelectedIpRecord((prev) => (prev ? { ...prev, notes: notesDraft } : null));
      setIsEditingNotes(false);
      setNotesSaveStatus('Note saved successfully.');
      setTimeout(() => setNotesSaveStatus(null), 2500);
    } else {
      setNotesSaveStatus(res.message || 'Failed to update note.');
    }
  };

  // RBAC & Permission scopes
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isAuditor = currentUser?.role === 'auditor';

  // Subnet scoping restriction (allowedSubnetIds)
  const isRestrictedScope = Boolean(
    currentUser &&
      !isSuperAdmin &&
      currentUser.permissions?.allowedSubnetIds &&
      currentUser.permissions.allowedSubnetIds.length > 0
  );

  // Accessible Subnets strictly according to user permissions
  const accessibleSubnets = useMemo(() => {
    if (!currentUser) return subnets;
    if (isSuperAdmin) return subnets;
    const allowed = currentUser.permissions?.allowedSubnetIds;
    if (!allowed || allowed.length === 0) return subnets;
    return subnets.filter((s) => allowed.includes(s.id));
  }, [subnets, currentUser, isSuperAdmin]);

  const accessibleSubnetIds = useMemo(() => {
    return new Set(accessibleSubnets.map((s) => s.id));
  }, [accessibleSubnets]);

  // Accessible IPs strictly within accessible subnets
  const accessibleIps = useMemo(() => {
    if (!currentUser) return ips;
    if (isSuperAdmin) return ips;
    const allowed = currentUser.permissions?.allowedSubnetIds;
    if (!allowed || allowed.length === 0) return ips;
    return ips.filter((ip) => accessibleSubnetIds.has(ip.subnetId));
  }, [ips, currentUser, isSuperAdmin, accessibleSubnetIds]);

  // Granular component visibility permissions
  const canSeeUsers = Boolean(isSuperAdmin || currentUser?.permissions?.manageUsers);
  const canSeeDeviceTypes = Boolean(
    isSuperAdmin ||
      (currentUser?.permissions?.manageDeviceClassifications && !isAuditor) ||
      (currentUser?.role === 'network_admin' && currentUser?.permissions?.manageDeviceClassifications !== false)
  );
  const canSeeAudit = Boolean(isSuperAdmin || currentUser?.permissions?.viewAuditLogs);
  const canCreateSubnet = hasPermission('createSubnet');
  const isReaderOnly = isAuditor || (!currentUser?.permissions?.createSubnet && !currentUser?.permissions?.allocateIP && !currentUser?.permissions?.editIP);

  // Compute Network KPIs strictly on accessible scope
  const totalSubnets = accessibleSubnets.length;
  const totalUsers = users.length;
  const totalClassifications = deviceClassifications.length;

  const totalUsableCapacity = useMemo(() => {
    return accessibleSubnets.reduce((acc, s) => acc + (s.usableHosts || 0), 0);
  }, [accessibleSubnets]);

  const allocatedIpsCount = useMemo(() => {
    return accessibleIps.filter((i) => i.status === 'allocated').length;
  }, [accessibleIps]);

  const reservedIpsCount = useMemo(() => {
    return accessibleIps.filter((i) => i.status === 'reserved').length;
  }, [accessibleIps]);

  const dhcpIpsCount = useMemo(() => {
    return accessibleIps.filter((i) => i.status === 'dhcp').length;
  }, [accessibleIps]);

  const totalInUse = allocatedIpsCount + reservedIpsCount + dhcpIpsCount;
  const globalUtilizationPct =
    totalUsableCapacity > 0
      ? Math.min(100, Math.round((totalInUse / totalUsableCapacity) * 100))
      : 0;

  // Online ping status count within accessible scope
  const onlineIpsCount = useMemo(() => {
    return accessibleIps.filter((i) => i.lastPingStatus === 'online').length;
  }, [accessibleIps]);

  // Subnet summary with utilization calculations (accessible subnets only)
  const subnetSummaries = useMemo(() => {
    return accessibleSubnets
      .map((subnet) => {
        const subnetIps = accessibleIps.filter((ip) => ip.subnetId === subnet.id);
        const allocated = subnetIps.filter((ip) => ip.status === 'allocated').length;
        const reserved = subnetIps.filter((ip) => ip.status === 'reserved').length;
        const dhcp = subnetIps.filter((ip) => ip.status === 'dhcp').length;
        const used = allocated + reserved + dhcp;
        const pct = subnet.usableHosts > 0 ? Math.min(100, Math.round((used / subnet.usableHosts) * 100)) : 0;

        return {
          ...subnet,
          allocatedCount: allocated,
          reservedCount: reserved,
          dhcpCount: dhcp,
          usedCount: used,
          utilizationPct: pct,
        };
      })
      .sort((a, b) => b.utilizationPct - a.utilizationPct);
  }, [accessibleSubnets, accessibleIps]);

  // Device Classification breakdown counts (accessible IPs only)
  const deviceTypeDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    accessibleIps.forEach((ip) => {
      if (ip.status !== 'available' && ip.deviceType) {
        counts[ip.deviceType] = (counts[ip.deviceType] || 0) + 1;
      }
    });

    return deviceClassifications
      .map((dc) => ({
        ...dc,
        assignedCount: counts[dc.code] || 0,
      }))
      .sort((a, b) => b.assignedCount - a.assignedCount);
  }, [deviceClassifications, accessibleIps]);

  // Comprehensive "Search Everything" Engine
  // Searches across all fields, tokens, tags, network properties, and records
  // Strictly filtered to permitted scope (no unauthorized subnets, IPs, users, or audit logs)
  const searchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return null;

    const tokens = q.split(/\s+/).filter(Boolean);

    // Helper: item matches if EVERY token matches at least one candidate string in the item
    const matchesAllTokens = (fields: (string | number | undefined | null)[]) => {
      const combined = fields
        .filter((f): f is string | number => f !== undefined && f !== null && f !== '')
        .map((f) => String(f).toLowerCase())
        .join(' ');
      return tokens.every((tok) => combined.includes(tok));
    };

    // Subnets (Permitted scope only)
    const matchedSubnets = accessibleSubnets.filter((s) =>
      matchesAllTokens([
        s.name,
        s.cidr,
        s.location,
        s.vlanId,
        s.description,
        s.gateway,
        s.networkAddress,
        s.broadcastAddress,
        s.mask,
        s.vrf,
        (s.tags || []).join(' '),
        (s.dnsServers || []).join(' '),
      ])
    );

    // IP Records (Permitted scope only)
    const matchedIps = accessibleIps.filter((i) => {
      const parent = accessibleSubnets.find((s) => s.id === i.subnetId);
      return matchesAllTokens([
        i.ip,
        i.hostname,
        i.macAddress,
        i.owner,
        i.department,
        i.notes,
        i.status,
        i.deviceType,
        i.allocatedBy,
        i.lastPingStatus,
        parent?.name,
        parent?.cidr,
        parent?.location,
      ]);
    });

    // Categories / Device Types (only if permitted)
    const matchedCategories = canSeeDeviceTypes
      ? deviceClassifications.filter((c) =>
          matchesAllTokens([c.name, c.code, c.category, c.vendor, c.description, c.defaultPorts, c.icon])
        )
      : [];

    // Users (only if permitted)
    const matchedUsers = canSeeUsers
      ? users.filter((u) =>
          matchesAllTokens([u.username, u.fullName, u.email, u.department, u.role, u.authType])
        )
      : [];

    // Audit Logs (only if permitted)
    const matchedAudit = canSeeAudit
      ? auditLogs.filter((a) =>
          matchesAllTokens([
            a.action,
            a.details,
            a.actorUsername,
            a.target,
            a.category,
            a.severity,
            a.actorRole,
          ])
        )
      : [];

    return {
      subnets: matchedSubnets,
      ips: matchedIps,
      categories: matchedCategories,
      users: matchedUsers,
      audit: matchedAudit,
      totalCount:
        matchedSubnets.length +
        matchedIps.length +
        matchedCategories.length +
        matchedUsers.length +
        matchedAudit.length,
    };
  }, [
    globalSearch,
    accessibleSubnets,
    accessibleIps,
    deviceClassifications,
    users,
    auditLogs,
    canSeeDeviceTypes,
    canSeeUsers,
    canSeeAudit,
  ]);

  // Recent Audit Logs (scoped to permission)
  const recentAuditLogs = useMemo(() => {
    if (!canSeeAudit) return [];
    return [...auditLogs]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);
  }, [auditLogs, canSeeAudit]);

  // Copy helper for IP properties
  const handleCopy = (text: string, fieldKey: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Live Ping check for the IP in the properties modal
  const handlePingModalIp = async () => {
    if (!selectedIpRecord) return;
    setIsPingingModalIp(true);
    setModalPingStatus(null);
    try {
      const res = await pingIP(selectedIpRecord.id || selectedIpRecord.ip);
      setModalPingStatus({
        tested: true,
        online: res.online,
        latencyMs: res.latencyMs,
        message: res.online ? `Online (${res.latencyMs}ms latency)` : 'Host offline / unreachable',
      });
    } catch (err: any) {
      setModalPingStatus({
        tested: true,
        online: false,
        latencyMs: 0,
        message: err?.message || 'Ping failed',
      });
    } finally {
      setIsPingingModalIp(false);
    }
  };

  // Release IP action inside modal
  const handleReleaseIp = () => {
    if (!selectedIpRecord) return;
    const res = releaseIP(selectedIpRecord.id);
    if (res.success) {
      setReleaseStatusMsg('IP successfully released back to available pool.');
      setReleaseConfirmOpen(false);
      // update local state
      setSelectedIpRecord((prev) => (prev ? { ...prev, status: 'available', owner: '', hostname: '', macAddress: '', notes: '' } : null));
    } else {
      setReleaseStatusMsg(res.message || 'Failed to release IP.');
    }
  };

  // Find parent subnet and classification for the active modal IP
  const activeSubnet = useMemo(() => {
    if (!selectedIpRecord) return null;
    return subnets.find((s) => s.id === selectedIpRecord.subnetId);
  }, [selectedIpRecord, subnets]);

  const activeClassification = useMemo(() => {
    if (!selectedIpRecord?.deviceType) return null;
    return deviceClassifications.find((d) => d.code === selectedIpRecord.deviceType);
  }, [selectedIpRecord, deviceClassifications]);

  const canEditSelectedIp = selectedIpRecord ? hasPermission('editIP', selectedIpRecord.subnetId) : false;
  const canReleaseSelectedIp = selectedIpRecord ? hasPermission('releaseIP', selectedIpRecord.subnetId) : false;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Global Search Card */}
      <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden transition-colors">
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-96 h-96 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-80 h-80 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-5">
          {/* Welcome & Permission Scope Status Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center shadow-xs">
                  <LayoutDashboard className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Network Overview &amp; Dashboard
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Welcome back,{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {currentUser?.fullName || currentUser?.username}
                    </strong>{' '}
                    ({currentUser?.role.replace('_', ' ').toUpperCase()})
                  </p>
                </div>
              </div>
            </div>

            {/* Role & Scope Badges + Permitted Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Scope restriction indicator */}
              {isRestrictedScope && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  <span>
                    Scoped Access: {accessibleSubnets.length} of {subnets.length} Subnets
                  </span>
                </div>
              )}

              {/* Reader / Auditor Mode Indicator */}
              {isReaderOnly && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300">
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>Read-Only Viewer</span>
                </div>
              )}

              {/* Active Directory Sync Indicator */}
              {ldapConfig.enabled && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                  <Server className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Active Directory Sync</span>
                </div>
              )}

              {/* Action Button: Permitted Users get Create/Manage, Readers get Browse */}
              {canCreateSubnet ? (
                <button
                  onClick={() => {
                    if (onOpenCreateSubnet) {
                      onOpenCreateSubnet();
                    } else {
                      onNavigateTab('subnets');
                    }
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Manage Subnets</span>
                </button>
              ) : (
                <button
                  onClick={() => onNavigateTab('subnets')}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 shadow-xs transition-colors cursor-pointer"
                >
                  <Network className="w-3.5 h-3.5 text-blue-500" />
                  <span>Browse Subnets</span>
                </button>
              )}
            </div>
          </div>

          {/* MAIN PROMINENT SEARCH BAR (Search Everything) */}
          <div className="pt-2">
            <div className="relative w-full">
              <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="dashboard-global-search-input"
                placeholder="Search everything: IP addresses, subnets, CIDR, VLANs, hostnames, MACs, owners, departments, device types..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-20 py-3.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 shadow-inner focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-sans"
              />
              {globalSearch && (
                <button
                  type="button"
                  onClick={() => setGlobalSearch('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs px-2 py-1 rounded-lg bg-slate-200/60 dark:bg-slate-800 cursor-pointer"
                >
                  ✕ Clear
                </button>
              )}
            </div>

            {/* Live Search Results Dropdown Panel */}
            {searchResults && (
              <div className="mt-3 bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xl max-h-[500px] overflow-y-auto space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 text-xs gap-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Found {searchResults.totalCount} match{searchResults.totalCount === 1 ? '' : 'es'} for &ldquo;
                    {globalSearch}&rdquo;
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => setSearchCategory('all')}
                      className={`text-[11px] px-2.5 py-1 rounded-lg capitalize transition-colors cursor-pointer ${
                        searchCategory === 'all'
                          ? 'bg-blue-600 text-white font-semibold shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      All ({searchResults.totalCount})
                    </button>
                    <button
                      onClick={() => setSearchCategory('subnets')}
                      className={`text-[11px] px-2.5 py-1 rounded-lg capitalize transition-colors cursor-pointer ${
                        searchCategory === 'subnets'
                          ? 'bg-blue-600 text-white font-semibold shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      Subnets ({searchResults.subnets.length})
                    </button>
                    <button
                      onClick={() => setSearchCategory('ips')}
                      className={`text-[11px] px-2.5 py-1 rounded-lg capitalize transition-colors cursor-pointer ${
                        searchCategory === 'ips'
                          ? 'bg-blue-600 text-white font-semibold shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      IPs ({searchResults.ips.length})
                    </button>
                    {canSeeDeviceTypes && (
                      <button
                        onClick={() => setSearchCategory('devices')}
                        className={`text-[11px] px-2.5 py-1 rounded-lg capitalize transition-colors cursor-pointer ${
                          searchCategory === 'devices'
                            ? 'bg-blue-600 text-white font-semibold shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        Categories ({searchResults.categories.length})
                      </button>
                    )}
                    {canSeeUsers && (
                      <button
                        onClick={() => setSearchCategory('users')}
                        className={`text-[11px] px-2.5 py-1 rounded-lg capitalize transition-colors cursor-pointer ${
                          searchCategory === 'users'
                            ? 'bg-blue-600 text-white font-semibold shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        Users ({searchResults.users.length})
                      </button>
                    )}
                    {canSeeAudit && (
                      <button
                        onClick={() => setSearchCategory('audit')}
                        className={`text-[11px] px-2.5 py-1 rounded-lg capitalize transition-colors cursor-pointer ${
                          searchCategory === 'audit'
                            ? 'bg-blue-600 text-white font-semibold shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        Audit ({searchResults.audit.length})
                      </button>
                    )}
                  </div>
                </div>

                {searchResults.totalCount === 0 ? (
                  <div className="py-8 text-center space-y-1.5">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      No matching records found for &ldquo;{globalSearch}&rdquo;.
                    </p>
                    {isRestrictedScope && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        (Note: Search is scoped strictly to your {accessibleSubnets.length} authorized subnets).
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Matching IP Records - CLICK OPENS IP PROPERTIES MODAL */}
                    {(searchCategory === 'all' || searchCategory === 'ips') &&
                      searchResults.ips.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              IP Addresses ({searchResults.ips.length})
                            </p>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                              Click any IP to inspect properties &amp; diagnostics
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {searchResults.ips.slice(0, 12).map((ip) => {
                              const parentSubnet = accessibleSubnets.find((s) => s.id === ip.subnetId);
                              const dc = deviceClassifications.find((d) => d.code === ip.deviceType);
                              const theme = dc ? getClassificationTheme(dc.color) : null;
                              return (
                                <button
                                  key={ip.id}
                                  onClick={() => {
                                    setSelectedIpRecord(ip);
                                    setModalPingStatus(null);
                                    setReleaseStatusMsg(null);
                                    setReleaseConfirmOpen(false);
                                  }}
                                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 bg-slate-50/60 dark:bg-slate-950/60 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 text-left transition-all cursor-pointer group shadow-2xs"
                                >
                                  <div className="flex items-start gap-2.5 min-w-0">
                                    {dc && theme ? (
                                      <div
                                        className={`w-7 h-7 rounded-lg ${theme.bg} ${theme.border} border flex items-center justify-center shrink-0 mt-0.5`}
                                      >
                                        {renderDeviceIcon(dc.icon, `w-3.5 h-3.5 ${theme.text}`)}
                                      </div>
                                    ) : (
                                      <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                                        <Activity className="w-3.5 h-3.5" />
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                                          {ip.ip}
                                        </span>
                                        <span
                                          className={`text-[9px] px-1.5 py-0.2 rounded font-sans uppercase font-semibold ${
                                            ip.status === 'allocated'
                                              ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
                                              : ip.status === 'reserved'
                                              ? 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800'
                                              : ip.status === 'dhcp'
                                              ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                          }`}
                                        >
                                          {ip.status}
                                        </span>
                                        {ip.lastPingStatus === 'online' && (
                                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Online" />
                                        )}
                                      </div>
                                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                        {ip.hostname || 'No hostname'}
                                        {ip.owner ? ` • ${ip.owner}` : ''}
                                        {parentSubnet ? ` • ${parentSubnet.name}` : ''}
                                      </p>
                                    </div>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    {/* Matching Subnets */}
                    {(searchCategory === 'all' || searchCategory === 'subnets') &&
                      searchResults.subnets.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Subnets ({searchResults.subnets.length})
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {searchResults.subnets.map((sub) => (
                              <button
                                key={sub.id}
                                onClick={() => {
                                  onSelectSubnet(sub.id);
                                  onNavigateTab('subnets');
                                }}
                                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/60 bg-slate-50/60 dark:bg-slate-950/60 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 text-left transition-all cursor-pointer group shadow-2xs"
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0 font-mono text-[11px] font-bold">
                                    /{sub.cidr.split('/')[1]}
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                      {sub.name}
                                    </p>
                                    <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                      {sub.cidr} • <span className="font-sans">{sub.location}</span>
                                      {sub.vlanId ? ` • VLAN ${sub.vlanId}` : ''}
                                    </p>
                                  </div>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Matching Device Categories */}
                    {(searchCategory === 'all' || searchCategory === 'devices') &&
                      canSeeDeviceTypes &&
                      searchResults.categories.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Device Classifications ({searchResults.categories.length})
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {searchResults.categories.map((cat) => {
                              const theme = getClassificationTheme(cat.color);
                              return (
                                <button
                                  key={cat.id}
                                  onClick={() => onNavigateTab('device_classifications')}
                                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-purple-500/60 bg-slate-50/60 dark:bg-slate-950/60 hover:bg-purple-50/40 dark:hover:bg-purple-950/30 text-left transition-all cursor-pointer group shadow-2xs"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className={`w-7 h-7 rounded-lg ${theme.bg} ${theme.border} border flex items-center justify-center shrink-0`}
                                    >
                                      {renderDeviceIcon(cat.icon, `w-3.5 h-3.5 ${theme.text}`)}
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
                                        {cat.name}
                                      </p>
                                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                        [{cat.code}] • {cat.category} {cat.vendor ? `• ${cat.vendor}` : ''}
                                      </p>
                                    </div>
                                  </div>
                                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    {/* Matching Users */}
                    {(searchCategory === 'all' || searchCategory === 'users') &&
                      canSeeUsers &&
                      searchResults.users.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Users ({searchResults.users.length})
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {searchResults.users.map((usr) => (
                              <button
                                key={usr.id}
                                onClick={() => onNavigateTab('users')}
                                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/60 bg-slate-50/60 dark:bg-slate-950/60 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 text-left transition-all cursor-pointer group shadow-2xs"
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shrink-0">
                                    <Users className="w-3.5 h-3.5" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                      {usr.fullName || usr.username}
                                    </p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                      @{usr.username} • {usr.role.replace('_', ' ')}
                                      {usr.department ? ` • ${usr.department}` : ''}
                                    </p>
                                  </div>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Matching Audit Logs */}
                    {(searchCategory === 'all' || searchCategory === 'audit') &&
                      canSeeAudit &&
                      searchResults.audit.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Audit Records ({searchResults.audit.length})
                          </p>
                          <div className="space-y-1.5">
                            {searchResults.audit.slice(0, 5).map((log) => (
                              <button
                                key={log.id}
                                onClick={() => onNavigateTab('audit')}
                                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/60 bg-slate-50/40 dark:bg-slate-950/40 text-left transition-all cursor-pointer group"
                              >
                                <div>
                                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                                    {log.details || log.action}
                                  </p>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                    @{log.actorUsername} • {log.category} • {new Date(log.timestamp).toLocaleString()}
                                  </p>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CORE KPI METRIC CARDS (Total Subnets, Total Users, Total Category/Device Types, and Total IPs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: TOTAL SUBNETS */}
        <div
          onClick={() => onNavigateTab('subnets')}
          className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group hover:border-blue-500/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isRestrictedScope ? 'Authorized Subnets' : 'Total Subnets'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Network className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {totalSubnets}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {isRestrictedScope ? `of ${subnets.length} permitted` : 'subnets active'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
              <span>{totalUsableCapacity.toLocaleString()} usable hosts</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 text-[11px]">
                Explore <ArrowRight className="w-3 h-3" />
              </span>
            </p>
          </div>
        </div>

        {/* CARD 2: TOTAL USERS */}
        <div
          onClick={() => canSeeUsers && onNavigateTab('users')}
          className={`bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all group ${
            canSeeUsers ? 'cursor-pointer hover:border-indigo-500/50' : 'opacity-90 cursor-default'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Users
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {totalUsers}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                registered
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
              <span>
                {users.filter((u) => u.status === 'active').length} active • {ldapConfig.enabled ? 'LDAP' : 'Local'}
              </span>
              {canSeeUsers ? (
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 text-[11px]">
                  Manage <ArrowRight className="w-3 h-3" />
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 font-medium">Restricted</span>
              )}
            </p>
          </div>
        </div>

        {/* CARD 3: TOTAL CATEGORIES & DEVICE TYPES */}
        <div
          onClick={() => canSeeDeviceTypes && onNavigateTab('device_classifications')}
          className={`bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all group ${
            canSeeDeviceTypes ? 'cursor-pointer hover:border-purple-500/50' : 'opacity-90 cursor-default'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Categories
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {totalClassifications}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                device types
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
              <span>Servers, CCTV, Routers, IoT...</span>
              {canSeeDeviceTypes ? (
                <span className="text-purple-600 dark:text-purple-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 text-[11px]">
                  View <ArrowRight className="w-3 h-3" />
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 font-medium">Standard</span>
              )}
            </p>
          </div>
        </div>

        {/* CARD 4: IP UTILIZATION & CAPACITY */}
        <div
          onClick={() => onNavigateTab('subnets')}
          className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group hover:border-emerald-500/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              IP Utilization
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                {globalUtilizationPct}%
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                ({totalInUse} / {totalUsableCapacity})
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  globalUtilizationPct > 85
                    ? 'bg-rose-500'
                    : globalUtilizationPct > 60
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${globalUtilizationPct}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 flex items-center justify-between">
              <span>{allocatedIpsCount} Allocated • {reservedIpsCount} Reserved</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {onlineIpsCount} Online
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* TWO COLUMN GRID: SUBNET HEALTH LEADERBOARD & DEVICE CATEGORY BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT 2 COLS: SUBNET UTILIZATION LEADERBOARD */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Subnet Capacity &amp; Utilization Overview
              </h2>
            </div>
            <button
              onClick={() => onNavigateTab('subnets')}
              className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              View All Subnets <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            {subnetSummaries.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                {isRestrictedScope ? 'No authorized subnets assigned to your account.' : 'No subnets created yet.'}
              </p>
            ) : (
              subnetSummaries.slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    onSelectSubnet(s.id);
                    onNavigateTab('subnets');
                  }}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/40 bg-slate-50/40 dark:bg-slate-950/40 hover:bg-slate-100/60 dark:hover:bg-slate-900/60 transition-all cursor-pointer group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center font-bold text-xs shrink-0">
                        /{s.cidr.split('/')[1]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            {s.name}
                          </p>
                          {s.vlanId && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800 font-mono">
                              VLAN {s.vlanId}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                          {s.cidr} • <span className="font-sans">{s.location}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {s.usedCount} / {s.usableHosts} IPs
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {s.usableHosts - s.usedCount} available
                        </p>
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-lg border ${
                          s.utilizationPct > 85
                            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
                            : s.utilizationPct > 60
                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                        }`}
                      >
                        {s.utilizationPct}%
                      </span>
                    </div>
                  </div>

                  {/* Subnet capacity progress bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        s.utilizationPct > 85
                          ? 'bg-rose-500'
                          : s.utilizationPct > 60
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${s.utilizationPct}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT 1 COL: DEVICE CATEGORIES BREAKDOWN */}
        <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Category &amp; Device Types
              </h2>
            </div>
            {canSeeDeviceTypes && (
              <button
                onClick={() => onNavigateTab('device_classifications')}
                className="text-xs text-purple-600 dark:text-purple-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                All Types <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {deviceTypeDistribution.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No classifications active in current scope.</p>
            ) : (
              deviceTypeDistribution.slice(0, 6).map((dc) => {
                const theme = getClassificationTheme(dc.color);
                return (
                  <div
                    key={dc.id}
                    onClick={() => canSeeDeviceTypes && onNavigateTab('device_classifications')}
                    className={`flex items-center justify-between p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-purple-400/40 bg-slate-50/40 dark:bg-slate-950/40 transition-all ${
                      canSeeDeviceTypes ? 'cursor-pointer group' : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl ${theme.bg} ${theme.border} border flex items-center justify-center shrink-0`}>
                        {renderDeviceIcon(dc.icon, `w-4 h-4 ${theme.text}`)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
                          {dc.name}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {dc.category} • [{dc.code}]
                        </p>
                      </div>
                    </div>
                    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-mono font-bold border ${theme.badge}`}>
                      {dc.assignedCount} IPs
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* RECENT SECURITY AUDIT ACTIVITY */}
      {canSeeAudit && (
        <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Recent Audit &amp; Network Activity Stream
              </h2>
            </div>
            <button
              onClick={() => onNavigateTab('audit')}
              className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              View Full Audit Trail <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {recentAuditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No recent activity logged.</p>
            ) : (
              recentAuditLogs.map((log) => (
                <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        log.severity === 'error'
                          ? 'bg-rose-500'
                          : log.severity === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {log.details || log.action}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Actor: <strong className="text-slate-700 dark:text-slate-300">@{log.actorUsername}</strong> (
                        {log.actorRole.replace('_', ' ')}) • Category: {log.category}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* IP PROPERTY MODAL (TRIGGERED ON CLICKING AN IP FROM SEARCH RESULTS OR DASHBOARD) */}
      {selectedIpRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col transition-colors">
            {/* Modal Header - Fixed at Top */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-[#111111] z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shadow-xs">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    IP Address Properties &amp; Details
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {activeSubnet ? `${activeSubnet.name} (${activeSubnet.cidr})` : 'Subnet Detail'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedIpRecord(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Scrollable Content (No Overlap) */}
            <div className="p-6 space-y-5 flex-1 overflow-y-auto">
              {/* Primary Identity Pill & Status */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      {selectedIpRecord.ip}
                    </span>
                    <button
                      onClick={() => handleCopy(selectedIpRecord.ip, 'ip')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
                      title="Copy IP Address"
                    >
                      {copiedField === 'ip' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Hostname:{' '}
                    <strong className="text-slate-700 dark:text-slate-200 font-mono">
                      {selectedIpRecord.hostname || 'None assigned'}
                    </strong>
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Status Badge */}
                  <span
                    className={`text-xs px-3 py-1 rounded-xl font-bold uppercase tracking-wider border ${
                      selectedIpRecord.status === 'allocated'
                        ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
                        : selectedIpRecord.status === 'reserved'
                        ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800'
                        : selectedIpRecord.status === 'dhcp'
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                        : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {selectedIpRecord.status}
                  </span>

                  {/* Device Classification Pill */}
                  {activeClassification && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-xs font-semibold text-purple-700 dark:text-purple-300">
                      {renderDeviceIcon(activeClassification.icon, 'w-3.5 h-3.5 text-purple-500')}
                      <span>{activeClassification.name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Permission & Access Context Notice */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                  canEditSelectedIp
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  {canEditSelectedIp ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span>
                    {canEditSelectedIp
                      ? 'You have operator / modify permissions on this subnet.'
                      : 'Viewer access: You are in read-only mode for this subnet.'}
                  </span>
                </div>
                {activeSubnet && (
                  <span className="font-mono font-semibold">VLAN {activeSubnet.vlanId || 'Default'}</span>
                )}
              </div>

              {/* Grid of Key Properties */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* MAC Address */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Hardware / MAC Address
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      {selectedIpRecord.macAddress || 'Not registered'}
                    </span>
                    {selectedIpRecord.macAddress && (
                      <button
                        onClick={() => handleCopy(selectedIpRecord.macAddress!, 'mac')}
                        className="text-slate-400 hover:text-blue-500 p-1 rounded cursor-pointer"
                        title="Copy MAC"
                      >
                        {copiedField === 'mac' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Subnet & Gateway */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Subnet &amp; Gateway
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {activeSubnet?.name || 'Unknown'} ({activeSubnet?.cidr || 'N/A'})
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      GW: {activeSubnet?.gateway || 'N/A'} • {activeSubnet?.location || 'General'}
                    </p>
                  </div>
                </div>

                {/* Owner & Department */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Assigned Owner &amp; Dept
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {selectedIpRecord.owner || 'Unassigned'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {selectedIpRecord.department || 'No department specified'}
                    </p>
                  </div>
                </div>

                {/* Allocation Audit Info */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Allocation History
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      By: {selectedIpRecord.allocatedBy ? `@${selectedIpRecord.allocatedBy}` : 'System / Auto'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {selectedIpRecord.allocatedAt
                        ? new Date(selectedIpRecord.allocatedAt).toLocaleString()
                        : 'Pre-configured'}
                    </p>
                  </div>
                </div>
              </div>

              {/* ALWAYS VISIBLE ADMINISTRATIVE NOTES BOX */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-500" />
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Administrative Notes &amp; Documentation
                    </span>
                  </div>
                  {canEditSelectedIp && !isEditingNotes && (
                    <button
                      type="button"
                      onClick={() => setIsEditingNotes(true)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{selectedIpRecord.notes ? 'Edit Note' : 'Add Note'}</span>
                    </button>
                  )}
                </div>

                {isEditingNotes ? (
                  <div className="space-y-2">
                    <textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      placeholder="Add administrative notes, server purpose, change ticket #, maintenance window..."
                      rows={3}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all font-sans"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingNotes(false);
                          setNotesDraft(selectedIpRecord.notes || '');
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveNotes}
                        className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs cursor-pointer"
                      >
                        Save Note
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {selectedIpRecord.notes ? (
                      <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {selectedIpRecord.notes}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                        No administrative notes recorded for this IP address.
                        {canEditSelectedIp && ' Click "Add Note" to write notes.'}
                      </p>
                    )}
                  </div>
                )}

                {notesSaveStatus && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    {notesSaveStatus}
                  </p>
                )}
              </div>

              {/* Live Diagnostic ICMP Probe Section */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-blue-500" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      ICMP Ping Diagnostics &amp; Health Probe
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={handlePingModalIp}
                    disabled={isPingingModalIp}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isPingingModalIp ? 'animate-spin' : ''}`} />
                    <span>{isPingingModalIp ? 'Pinging...' : 'Test Ping Now'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-medium">Ping Health Status</span>
                    <span
                      className={`font-bold capitalize flex items-center gap-1.5 mt-0.5 ${
                        modalPingStatus
                          ? modalPingStatus.online
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                          : selectedIpRecord.lastPingStatus === 'online'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          modalPingStatus
                            ? modalPingStatus.online
                              ? 'bg-emerald-500'
                              : 'bg-rose-500'
                            : selectedIpRecord.lastPingStatus === 'online'
                            ? 'bg-emerald-500'
                            : 'bg-slate-400'
                        }`}
                      />
                      {modalPingStatus
                        ? modalPingStatus.online
                          ? 'Online'
                          : 'Offline'
                        : selectedIpRecord.lastPingStatus || 'Untested'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-medium">Roundtrip Latency</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono mt-0.5 block">
                      {modalPingStatus
                        ? `${modalPingStatus.latencyMs} ms`
                        : selectedIpRecord.lastPingLatencyMs
                        ? `${selectedIpRecord.lastPingLatencyMs} ms`
                        : '--'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-400 block font-medium">Last Probed</span>
                    <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 mt-0.5 block truncate">
                      {modalPingStatus
                        ? 'Just now'
                        : selectedIpRecord.lastPingAt
                        ? new Date(selectedIpRecord.lastPingAt).toLocaleTimeString()
                        : 'Never'}
                    </span>
                  </div>
                </div>

                {modalPingStatus?.message && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                    Diagnostic message: {modalPingStatus.message}
                  </p>
                )}
              </div>

              {/* Release Confirmation & Feedback */}
              {releaseStatusMsg && (
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-700 dark:text-blue-300">
                  {releaseStatusMsg}
                </div>
              )}

              {releaseConfirmOpen && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 space-y-3">
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Confirm Release of {selectedIpRecord.ip}</span>
                  </div>
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    Are you sure you want to release this allocation? The hostname, MAC binding, and owner assignments will be cleared.
                  </p>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setReleaseConfirmOpen(false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleReleaseIp}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs cursor-pointer"
                    >
                      Yes, Release Allocation
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer - Fixed at Bottom (No Overlap) */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#151515] shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {activeSubnet && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetAction = canEditSelectedIp
                        ? selectedIpRecord.status === 'available'
                          ? 'allocate'
                          : 'edit'
                        : 'view';
                      onSelectSubnet(activeSubnet.id, selectedIpRecord.ip, targetAction);
                      setSelectedIpRecord(null);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    {canEditSelectedIp ? (
                      selectedIpRecord.status === 'available' ? (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Allocate in Subnet Form</span>
                        </>
                      ) : (
                        <>
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Open &amp; Update in Subnet Form</span>
                        </>
                      )
                    ) : (
                      <>
                        <Network className="w-3.5 h-3.5" />
                        <span>Locate in Subnet Grid</span>
                      </>
                    )}
                    <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                  </button>
                )}

                {canReleaseSelectedIp && selectedIpRecord.status !== 'available' && !releaseConfirmOpen && (
                  <button
                    type="button"
                    onClick={() => setReleaseConfirmOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors cursor-pointer"
                  >
                    <span>Release IP</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedIpRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
