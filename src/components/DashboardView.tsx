import React, { useState, useMemo } from 'react';
import { useIPAM, NavigationTab } from '../context/IPAMContext';
import { IPRecord, Subnet, DeviceClassification, Project } from '../types';
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
  Sparkles,
  FolderGit2,
  Boxes,
} from 'lucide-react';
import { renderDeviceIcon } from '../utils/deviceIcons';
import { getClassificationTheme, AVAILABLE_COLORS, getColorTheme } from '../utils/deviceColors';
import { DEVICE_CATEGORIES } from './ProjectsView';
import { isValidIPv4, isIpInSubnet, parseCIDR } from '../utils/ipUtils';

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
    projects,
    auditLogs,
    ldapConfig,
    hasPermission,
    pingIP,
    releaseIP,
    updateIP,
    createProject,
    setOpenedProjectId,
  } = useIPAM();

  // Search state
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchCategory, setSearchCategory] = useState<'all' | 'subnets' | 'ips' | 'projects' | 'devices' | 'users' | 'audit'>('all');

  // Create Project Modal state on Dashboard
  const [createProjectModalOpen, setCreateProjectModalOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({
    name: '',
    code: '',
    category: 'Server & Compute',
    description: '',
    notes: '',
    icon: 'server',
    color: 'blue',
    status: 'active' as 'active' | 'planning' | 'maintenance' | 'archived',
    owner: '',
    department: '',
  });
  const [projectFormError, setProjectFormError] = useState<string | null>(null);
  const [projectToast, setProjectToast] = useState<{ message: string; projectId?: string } | null>(null);

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
  const canSeeProjects = Boolean(
    isSuperAdmin ||
      currentUser?.permissions?.manageProjects ||
      currentUser?.role === 'network_admin' ||
      currentUser?.role === 'operator' ||
      currentUser?.role === 'auditor'
  );
  const canManageProjects = hasPermission('manageProjects');
  const canSeeAudit = Boolean(isSuperAdmin || currentUser?.permissions?.viewAuditLogs);
  const canCreateSubnet = hasPermission('createSubnet');
  const isReaderOnly = isAuditor || (!currentUser?.permissions?.createSubnet && !currentUser?.permissions?.allocateIP && !currentUser?.permissions?.editIP);

  // Compute Network KPIs strictly on accessible scope
  const totalSubnets = accessibleSubnets.length;
  const totalUsers = users.length;
  const totalClassifications = deviceClassifications.length;
  const totalProjects = projects.length;
  const activeProjectsCount = useMemo(() => {
    return projects.filter((p) => p.status === 'active').length;
  }, [projects]);
  const totalProjectIpsCount = useMemo(() => {
    return accessibleIps.filter((i) => Boolean(i.projectId)).length;
  }, [accessibleIps]);

  // Project summaries sorted with mapped IP counts
  const projectSummaries = useMemo(() => {
    return projects
      .map((p) => {
        const assignedIps = accessibleIps.filter((i) => i.projectId === p.id);
        const onlineIps = assignedIps.filter((i) => i.lastPingStatus === 'online');
        return {
          ...p,
          assignedCount: assignedIps.length,
          onlineCount: onlineIps.length,
        };
      })
      .sort((a, b) => b.assignedCount - a.assignedCount || a.name.localeCompare(b.name));
  }, [projects, accessibleIps]);

  const handleOpenCreateProject = () => {
    setProjectForm({
      name: '',
      code: '',
      category: 'Server & Compute',
      description: '',
      notes: '',
      icon: 'server',
      color: 'blue',
      status: 'active',
      owner: currentUser?.fullName || currentUser?.username || '',
      department: currentUser?.department || '',
    });
    setProjectFormError(null);
    setCreateProjectModalOpen(true);
  };

  const handleCreateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProjectFormError(null);

    if (!projectForm.name.trim()) {
      setProjectFormError('Project box name is required.');
      return;
    }

    const cleanCode = (projectForm.code || projectForm.name.substring(0, 8))
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '_');
    if (!cleanCode) {
      setProjectFormError('Unique box code identifier is required.');
      return;
    }

    if (projects.some((p) => p.code.toUpperCase() === cleanCode)) {
      setProjectFormError(`A project with code '${cleanCode}' already exists.`);
      return;
    }

    const result = createProject({
      name: projectForm.name.trim(),
      code: cleanCode,
      category: projectForm.category,
      description: projectForm.description.trim(),
      notes: projectForm.notes.trim(),
      icon: projectForm.icon,
      color: projectForm.color,
      status: projectForm.status,
      owner: projectForm.owner.trim(),
      department: projectForm.department.trim(),
    });

    if (!result.success) {
      setProjectFormError(result.message);
      return;
    }

    setCreateProjectModalOpen(false);
    setProjectToast({
      message: `Project box '${projectForm.name}' created successfully!`,
      projectId: result.project?.id,
    });
    setTimeout(() => setProjectToast(null), 5000);
  };

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

  // Autocomplete / Quick IP Suggestions based on prefix, suffix (last two octets), or hostname
  const autoCompleteSuggestions = useMemo(() => {
    const raw = globalSearch.trim().toLowerCase();
    if (!raw || raw.length < 2) return [];

    const isTwoOct = /^\.?\d{1,3}\.\d{1,3}\.?$/.test(raw);
    const cleanOct = raw.replace(/^\.|\.$/g, '');

    const suggestions: { key: string; displayIp: string; hostname?: string; query: string; ipRecord: IPRecord }[] = [];
    const seen = new Set<string>();

    for (const ip of accessibleIps) {
      if (suggestions.length >= 6) break;

      const matchesSuffix = isTwoOct && (ip.ip.endsWith('.' + cleanOct) || ip.ip.split('.').slice(2).join('.') === cleanOct);
      const matchesPrefix = ip.ip.startsWith(cleanOct) || ip.ip.startsWith(raw);
      const matchesContains = ip.ip.includes(cleanOct) || ip.ip.includes(raw);

      if (matchesSuffix || matchesPrefix || matchesContains) {
        if (!seen.has(ip.ip)) {
          seen.add(ip.ip);
          suggestions.push({
            key: ip.id,
            displayIp: ip.ip,
            hostname: ip.hostname,
            query: ip.ip,
            ipRecord: ip,
          });
        }
      }
    }

    return suggestions;
  }, [globalSearch, accessibleIps]);

  // Comprehensive "Search Everything" Engine
  // Searches across all fields, tokens, tags, network properties, ports, notes, and records
  // Strictly filtered to permitted scope (no unauthorized subnets, IPs, users, or audit logs)
  const searchResults = useMemo(() => {
    const rawQ = globalSearch.trim().toLowerCase();
    if (!rawQ) return null;

    // 1. Exact IPv4 Address typed (e.g. "192.168.10.1")
    if (isValidIPv4(rawQ)) {
      const exactIp = accessibleIps.find((i) => i.ip === rawQ);
      const parentSubnet = accessibleSubnets.find((s) => (exactIp ? s.id === exactIp.subnetId : isIpInSubnet(rawQ, s.cidr)));

      if (exactIp) {
        return {
          exactIpMatch: exactIp,
          unallocatedSubnetMatch: null,
          subnets: parentSubnet ? [parentSubnet] : [],
          ips: [exactIp],
          projects: [],
          categories: [],
          users: [],
          audit: [],
          totalCount: 1,
        };
      }

      // Check if IP belongs to any authorized subnet (even if not yet allocated)
      if (parentSubnet) {
        return {
          exactIpMatch: null,
          unallocatedSubnetMatch: {
            ip: rawQ,
            subnet: parentSubnet,
            isGateway: rawQ === parentSubnet.gateway,
          },
          subnets: [parentSubnet],
          ips: [],
          projects: [],
          categories: [],
          users: [],
          audit: [],
          totalCount: 1,
        };
      }
    }

    // 2. Identify two-octet prefix/suffix pattern (e.g. "192.168", "10.1", ".10.1", "240.3")
    const isTwoOctet = /^\.?\d{1,3}\.\d{1,3}\.?$/.test(rawQ);
    const cleanTwoOctet = rawQ.replace(/^\.|\.$/g, '');

    // Normalize query (handle "notes: xxx", "note: xxx", "port: 80", "ports: 80, 443", etc.)
    const normalizedQ = rawQ
      .replace(/\b(?:notes|note|description|desc)\s*:\s*/gi, 'notes ')
      .replace(/\b(?:ports|port)\s*:\s*/gi, 'port ');

    const tokens = normalizedQ.split(/\s+/).filter(Boolean);

    // Helper: item matches if EVERY token matches at least one candidate string in the item
    const matchesAllTokens = (fields: (string | number | undefined | null)[]) => {
      const combined = fields
        .filter((f): f is string | number => f !== undefined && f !== null && f !== '')
        .map((f) => String(f).toLowerCase())
        .join(' ');
      return tokens.every((tok) => combined.includes(tok));
    };

    // Subnets (Permitted scope only)
    const matchedSubnets = accessibleSubnets.filter((s) => {
      const hasNotes = Boolean(s.description && s.description.trim());
      return matchesAllTokens([
        s.name,
        s.cidr,
        s.location,
        s.vlanId ? `vlan ${s.vlanId} vlan${s.vlanId}` : '',
        s.description,
        hasNotes ? 'notes note description documented' : '',
        s.gateway,
        s.networkAddress,
        s.broadcastAddress,
        s.mask,
        s.vrf,
        (s.tags || []).join(' '),
        (s.dnsServers || []).join(' '),
      ]);
    });

    // IP Records (Permitted scope only)
    const matchedIps = accessibleIps.filter((i) => {
      const parent = accessibleSubnets.find((s) => s.id === i.subnetId);
      const dc = deviceClassifications.find(
        (d) =>
          d.code.toLowerCase() === i.deviceType?.toLowerCase() ||
          d.name.toLowerCase() === i.deviceType?.toLowerCase() ||
          d.id === i.deviceType
      );

      const hasNotes = Boolean(i.notes && i.notes.trim());
      const hasPorts = Boolean(dc?.defaultPorts);
      const notesHasPort = Boolean(i.notes && /(?:port|ports|:\s*\d{2,5}|\b\d{2,5}\/(?:tcp|udp))\b/i.test(i.notes));

      const prj = projects.find((p) => p.id === i.projectId);

      return matchesAllTokens([
        i.ip,
        i.hostname,
        i.macAddress,
        i.owner,
        i.department,
        i.notes,
        hasNotes ? 'notes note documented' : '',
        i.status,
        i.deviceType,
        dc?.name,
        dc?.category,
        dc?.vendor,
        dc?.defaultPorts,
        prj?.name,
        prj?.code,
        prj?.category,
        hasPorts || notesHasPort ? `port ports defaultports ${dc?.defaultPorts || ''}` : '',
        i.allocatedBy,
        i.lastPingStatus,
        parent?.name,
        parent?.cidr,
        parent?.location,
        parent?.vlanId ? `vlan ${parent.vlanId}` : '',
      ]);
    });

    // If two-octet pattern had matches, prioritize exact suffix and prefix matches first
    if (isTwoOctet) {
      matchedIps.sort((a, b) => {
        const aExactSuffix = a.ip.endsWith('.' + cleanTwoOctet) || a.ip.split('.').slice(2).join('.') === cleanTwoOctet;
        const bExactSuffix = b.ip.endsWith('.' + cleanTwoOctet) || b.ip.split('.').slice(2).join('.') === cleanTwoOctet;
        if (aExactSuffix && !bExactSuffix) return -1;
        if (!aExactSuffix && bExactSuffix) return 1;

        const aPrefix = a.ip.startsWith(cleanTwoOctet + '.');
        const bPrefix = b.ip.startsWith(cleanTwoOctet + '.');
        if (aPrefix && !bPrefix) return -1;
        if (!aPrefix && bPrefix) return 1;

        return 0;
      });
    }

    // Projects (only if permitted)
    const matchedProjects = canSeeProjects
      ? projects.filter((p) => {
          const hasNotes = Boolean(p.notes && p.notes.trim());
          return matchesAllTokens([
            p.name,
            p.code,
            p.category,
            p.description,
            p.owner,
            p.department,
            p.notes,
            hasNotes ? 'notes note description' : '',
            p.status,
            `project prj ${p.code}`,
          ]);
        })
      : [];

    // Categories / Device Types (only if permitted)
    const matchedCategories = canSeeDeviceTypes
      ? deviceClassifications.filter((c) => {
          const hasPorts = Boolean(c.defaultPorts);
          return matchesAllTokens([
            c.name,
            c.code,
            c.category,
            c.vendor,
            c.description,
            c.defaultPorts,
            hasPorts ? `port ports defaultports ${c.defaultPorts}` : '',
            c.icon,
          ]);
        })
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

    // Check if an exact single IP match should be featured
    const topExact =
      matchedIps.length === 1
        ? matchedIps[0]
        : isTwoOctet
        ? matchedIps.find(
            (i) =>
              (i.ip.endsWith('.' + cleanTwoOctet) || i.ip.split('.').slice(2).join('.') === cleanTwoOctet) &&
              matchedIps.filter((x) => x.ip.endsWith('.' + cleanTwoOctet) || x.ip.split('.').slice(2).join('.') === cleanTwoOctet).length === 1
          ) || null
        : null;

    let unallocatedMatch: { ip: string; subnet: Subnet; isGateway: boolean } | null = null;
    if (matchedIps.length === 0 && isTwoOctet) {
      for (const sub of accessibleSubnets) {
        const info = parseCIDR(sub.cidr);
        if (info && info.prefix <= 16) {
          const netParts = info.networkAddress.split('.');
          const candidateIp = `${netParts[0]}.${netParts[1]}.${cleanTwoOctet}`;
          if (isValidIPv4(candidateIp) && isIpInSubnet(candidateIp, sub.cidr)) {
            unallocatedMatch = {
              ip: candidateIp,
              subnet: sub,
              isGateway: candidateIp === sub.gateway,
            };
            break;
          }
        }
      }
    }

    return {
      exactIpMatch: topExact,
      unallocatedSubnetMatch: unallocatedMatch,
      subnets: matchedSubnets,
      ips: matchedIps,
      projects: matchedProjects,
      categories: matchedCategories,
      users: matchedUsers,
      audit: matchedAudit,
      totalCount:
        matchedSubnets.length +
        matchedIps.length +
        matchedProjects.length +
        matchedCategories.length +
        matchedUsers.length +
        matchedAudit.length,
    };
  }, [
    globalSearch,
    accessibleSubnets,
    accessibleIps,
    projects,
    deviceClassifications,
    users,
    auditLogs,
    canSeeProjects,
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

              {/* Action Buttons: Subnet & Project Management */}
              {canManageProjects ? (
                <button
                  id="dashboard-header-add-project-btn"
                  onClick={handleOpenCreateProject}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Project</span>
                </button>
              ) : canSeeProjects ? (
                <button
                  onClick={() => onNavigateTab('projects')}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 shadow-xs transition-colors cursor-pointer"
                >
                  <FolderGit2 className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Browse Projects</span>
                </button>
              ) : null}

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
                placeholder="Search everything: IPs, subnets, VLANs, hostnames, MACs, owners, ports, notes, device types..."
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

            {/* Quick Autocomplete Suggestions Chips */}
            {autoCompleteSuggestions.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-2 px-1">
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-blue-500" />
                  <span>Suggestions:</span>
                </span>
                {autoCompleteSuggestions.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setGlobalSearch(item.query);
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:hover:bg-blue-900/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <span className="font-bold">{item.displayIp}</span>
                    {item.hostname && <span className="text-slate-500 dark:text-slate-400 font-sans text-[11px]">({item.hostname})</span>}
                  </button>
                ))}
              </div>
            )}

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
                      All ({searchResults.totalCount || 0})
                    </button>
                    <button
                      onClick={() => setSearchCategory('subnets')}
                      className={`text-[11px] px-2.5 py-1 rounded-lg capitalize transition-colors cursor-pointer ${
                        searchCategory === 'subnets'
                          ? 'bg-blue-600 text-white font-semibold shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      Subnets ({(searchResults.subnets || []).length})
                    </button>
                    <button
                      onClick={() => setSearchCategory('ips')}
                      className={`text-[11px] px-2.5 py-1 rounded-lg capitalize transition-colors cursor-pointer ${
                        searchCategory === 'ips'
                          ? 'bg-blue-600 text-white font-semibold shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      IPs ({(searchResults.ips || []).length})
                    </button>
                    {canSeeProjects && (
                      <button
                        onClick={() => setSearchCategory('projects')}
                        className={`text-[11px] px-2.5 py-1 rounded-lg capitalize transition-colors cursor-pointer ${
                          searchCategory === 'projects'
                            ? 'bg-blue-600 text-white font-semibold shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        Projects ({(searchResults.projects || []).length})
                      </button>
                    )}
                    {canSeeDeviceTypes && (
                      <button
                        onClick={() => setSearchCategory('devices')}
                        className={`text-[11px] px-2.5 py-1 rounded-lg capitalize transition-colors cursor-pointer ${
                          searchCategory === 'devices'
                            ? 'bg-blue-600 text-white font-semibold shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        Categories ({(searchResults.categories || []).length})
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
                        Users ({(searchResults.users || []).length})
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
                        Audit ({(searchResults.audit || []).length})
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
                    {/* FEATURED SPECIFIC IP RECORD DETAILS PANEL */}
                    {searchResults.exactIpMatch && (() => {
                      const ip = searchResults.exactIpMatch;
                      const parentSubnet = accessibleSubnets.find((s) => s.id === ip.subnetId);
                      const dc = deviceClassifications.find(
                        (d) =>
                          d.code.toLowerCase() === ip.deviceType?.toLowerCase() ||
                          d.name.toLowerCase() === ip.deviceType?.toLowerCase() ||
                          d.id === ip.deviceType
                      );
                      const theme = dc ? getClassificationTheme(dc.color) : null;
                      const isGw = parentSubnet && ip.ip === parentSubnet.gateway;

                      return (
                        <div className="bg-gradient-to-br from-blue-50/70 via-slate-50 to-indigo-50/50 dark:from-blue-950/30 dark:via-[#131722] dark:to-indigo-950/20 border-2 border-blue-500/40 rounded-2xl p-5 shadow-lg space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-blue-200/50 dark:border-blue-900/40 gap-3">
                            <div className="flex items-center gap-3">
                              {dc && theme ? (
                                <div className={`w-11 h-11 rounded-xl ${theme.bg} ${theme.border} border flex items-center justify-center shrink-0 shadow-sm`}>
                                  {renderDeviceIcon(dc.icon, `w-5 h-5 ${theme.text}`)}
                                </div>
                              ) : (
                                <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400 border border-blue-300 dark:border-blue-800 flex items-center justify-center shrink-0">
                                  <Network className="w-5 h-5" />
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                                    {ip.ip}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(ip.ip);
                                      setCopiedField('exact-ip');
                                      setTimeout(() => setCopiedField(null), 1500);
                                    }}
                                    className="p-1 rounded hover:bg-white/80 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                                    title="Copy IP"
                                  >
                                    {copiedField === 'exact-ip' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                  <span
                                    className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider border ${
                                      ip.status === 'allocated'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800'
                                        : ip.status === 'reserved'
                                        ? 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                                    }`}
                                  >
                                    {ip.status}
                                  </span>
                                  {isGw && (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-bold border border-purple-300 dark:border-purple-800">
                                      Gateway
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  Specific IP Record Match • Subnet: <strong className="text-slate-700 dark:text-slate-300">{parentSubnet?.name || 'Unknown'}</strong> ({parentSubnet?.cidr})
                                </p>
                              </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="flex items-center gap-2">
                              {parentSubnet && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectSubnet(parentSubnet.id, ip.ip, 'view');
                                    onNavigateTab('subnets');
                                  }}
                                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>View in Subnet</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedIpRecord(ip);
                                  setModalPingStatus(null);
                                  setReleaseStatusMsg(null);
                                  setReleaseConfirmOpen(false);
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Full Details</span>
                              </button>
                            </div>
                          </div>

                          {/* Grid of Key Properties */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                            {/* Hostname & Classification */}
                            <div className="p-3 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
                              <span className="text-[10px] uppercase font-bold text-slate-400">Device &amp; Hostname</span>
                              <p className="font-semibold text-slate-900 dark:text-white truncate">{ip.hostname || '—'}</p>
                              {dc && (
                                <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                                  {dc.name} {dc.vendor ? `(${dc.vendor})` : ''}
                                </p>
                              )}
                            </div>

                            {/* MAC Address & Ports */}
                            <div className="p-3 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
                              <span className="text-[10px] uppercase font-bold text-slate-400">MAC &amp; Ports</span>
                              <p className="font-mono text-slate-700 dark:text-slate-300">{ip.macAddress || 'No MAC recorded'}</p>
                              {dc?.defaultPorts && (
                                <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800">
                                  Ports: {dc.defaultPorts}
                                </span>
                              )}
                            </div>

                            {/* Owner & Department */}
                            <div className="p-3 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
                              <span className="text-[10px] uppercase font-bold text-slate-400">Owner / Unit</span>
                              <p className="font-medium text-slate-800 dark:text-slate-200">{ip.owner || '—'}</p>
                              {ip.department && <p className="text-[11px] text-slate-500 dark:text-slate-400">{ip.department}</p>}
                            </div>

                            {/* Live Reachability */}
                            <div className="p-3 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1">
                              <span className="text-[10px] uppercase font-bold text-slate-400">Ping Reachability</span>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-2.5 h-2.5 rounded-full ${
                                    ip.lastPingStatus === 'online'
                                      ? 'bg-emerald-500'
                                      : ip.lastPingStatus === 'offline' || ip.lastPingStatus === 'unreachable'
                                      ? 'bg-rose-500'
                                      : 'bg-amber-500'
                                  }`}
                                />
                                <span className="capitalize font-semibold text-slate-800 dark:text-slate-200">
                                  {ip.lastPingStatus || 'Unknown'}
                                </span>
                              </div>
                              {ip.lastPingAt && (
                                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                  Checked: {new Date(ip.lastPingAt).toLocaleTimeString()}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Administrative Notes Box */}
                          {ip.notes && (
                            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/40 text-xs">
                              <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300 mb-1">
                                <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                <span>Administrative Notes</span>
                              </div>
                              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{ip.notes}</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* UNALLOCATED / AVAILABLE IP SUBMITTED */}
                    {searchResults.unallocatedSubnetMatch && (() => {
                      const match = searchResults.unallocatedSubnetMatch;
                      return (
                        <div className="bg-gradient-to-br from-emerald-50/70 via-slate-50 to-teal-50/50 dark:from-emerald-950/30 dark:via-[#131722] dark:to-teal-950/20 border-2 border-emerald-500/40 rounded-2xl p-5 shadow-lg space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-emerald-200/50 dark:border-emerald-900/40 gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center shrink-0">
                                <Network className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                                    {match.ip}
                                  </span>
                                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                    {match.isGateway ? 'Default Gateway' : 'Available / Free'}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  Subnet: <strong className="text-slate-700 dark:text-slate-300">{match.subnet.name}</strong> ({match.subnet.cidr})
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectSubnet(match.subnet.id, match.ip, 'allocate');
                                  onNavigateTab('subnets');
                                }}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Allocate This IP</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectSubnet(match.subnet.id, match.ip, 'view');
                                  onNavigateTab('subnets');
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>View Subnet Heatmap</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    {/* Matching IP Records - CLICK OPENS IP PROPERTIES MODAL */}
                    {(searchCategory === 'all' || searchCategory === 'ips') &&
                      (searchResults.ips || []).length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              IP Addresses ({(searchResults.ips || []).length})
                            </p>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                              Click any IP to inspect properties &amp; diagnostics
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(searchResults.ips || []).slice(0, 12).map((ip) => {
                              const parentSubnet = accessibleSubnets.find((s) => s.id === ip.subnetId);
                              const dc = deviceClassifications.find(
                                (d) =>
                                  d.code.toLowerCase() === ip.deviceType?.toLowerCase() ||
                                  d.name.toLowerCase() === ip.deviceType?.toLowerCase() ||
                                  d.id === ip.deviceType
                              );
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
                                        {dc?.defaultPorts && (
                                          <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
                                            Port: {dc.defaultPorts}
                                          </span>
                                        )}
                                        {ip.lastPingStatus === 'online' && (
                                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Online" />
                                        )}
                                      </div>
                                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                        {ip.hostname || 'No hostname'}
                                        {ip.owner ? ` • ${ip.owner}` : ''}
                                        {parentSubnet ? ` • ${parentSubnet.name}` : ''}
                                      </p>
                                      {ip.notes && (
                                        <div className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-300 truncate mt-1 bg-amber-50/70 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-800/40 font-sans">
                                          <FileText className="w-3 h-3 text-amber-500 shrink-0" />
                                          <span className="truncate">{ip.notes}</span>
                                        </div>
                                      )}
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
                      (searchResults.subnets || []).length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Subnets ({(searchResults.subnets || []).length})
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(searchResults.subnets || []).map((sub) => (
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

                    {/* Matching Workload Projects */}
                    {(searchCategory === 'all' || searchCategory === 'projects') &&
                      canSeeProjects &&
                      (searchResults.projects || []).length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Workload Projects ({(searchResults.projects || []).length})
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(searchResults.projects || []).map((p) => {
                              const theme = getColorTheme(p.color);
                              const mappedIpsCount = accessibleIps.filter((i) => i.projectId === p.id).length;
                              return (
                                <button
                                  key={p.id}
                                  onClick={() => {
                                    setOpenedProjectId(p.id);
                                    onNavigateTab('projects');
                                  }}
                                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/60 bg-slate-50/60 dark:bg-slate-950/60 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 text-left transition-all cursor-pointer group shadow-2xs"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className={`w-7 h-7 rounded-lg ${theme.bg} ${theme.border} border flex items-center justify-center shrink-0`}
                                    >
                                      {renderDeviceIcon(p.icon || 'server', `w-3.5 h-3.5 ${theme.text}`)}
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                        {p.name}
                                      </p>
                                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                        [{p.code}] • {p.category} • {mappedIpsCount} IPs mapped
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

                    {/* Matching Device Categories */}
                    {(searchCategory === 'all' || searchCategory === 'devices') &&
                      canSeeDeviceTypes &&
                      (searchResults.categories || []).length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Device Classifications ({(searchResults.categories || []).length})
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(searchResults.categories || []).map((cat) => {
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
                                        {cat.defaultPorts ? ` • Ports: ${cat.defaultPorts}` : ''}
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
                      (searchResults.users || []).length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Users ({(searchResults.users || []).length})
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(searchResults.users || []).map((usr) => (
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
                      (searchResults.audit || []).length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Audit Records ({(searchResults.audit || []).length})
                          </p>
                          <div className="space-y-1.5">
                            {(searchResults.audit || []).slice(0, 5).map((log) => (
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

      {/* CORE KPI METRIC CARDS (Total Subnets, IP Utilization, Workload Projects, Categories, and Users) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
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
                {isRestrictedScope ? `of ${subnets.length} permitted` : 'active'}
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

        {/* CARD 2: IP UTILIZATION & CAPACITY */}
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
              <span>{allocatedIpsCount} Allocated</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {onlineIpsCount} Online
              </span>
            </p>
          </div>
        </div>

        {/* CARD 3: TOTAL WORKLOAD PROJECTS */}
        {canSeeProjects && (
          <div
            onClick={() => onNavigateTab('projects')}
            className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group hover:border-indigo-500/50"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Workload Projects
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FolderGit2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {totalProjects}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {activeProjectsCount} active
                  </span>
                </div>
                {canManageProjects && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenCreateProject();
                    }}
                    className="p-1 px-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:hover:bg-indigo-900 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Add New Project"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
                <span>{totalProjectIpsCount} IPs mapped</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 text-[11px]">
                  Explore <ArrowRight className="w-3 h-3" />
                </span>
              </p>
            </div>
          </div>
        )}

        {/* CARD 4: TOTAL CATEGORIES & DEVICE TYPES */}
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
              <span>Servers, CCTV, Routers...</span>
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

        {/* CARD 5: TOTAL USERS */}
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

      {/* PROJECTS & WORKLOAD ALLOCATION OVERVIEW WIDGET */}
      {canSeeProjects && (
        <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center font-bold text-xs shrink-0">
                <FolderGit2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Projects &amp; Workload Allocation
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Infrastructure containers, workload groupings, and assigned host pools
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canManageProjects && (
                <button
                  type="button"
                  id="dashboard-widget-add-project-btn"
                  onClick={handleOpenCreateProject}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Project</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigateTab('projects')}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View All Projects</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {projectSummaries.length === 0 ? (
            <div className="py-8 text-center bg-slate-50/50 dark:bg-slate-950/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
              <FolderGit2 className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                No workload projects configured yet.
              </p>
              {canManageProjects && (
                <button
                  type="button"
                  onClick={handleOpenCreateProject}
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Your First Project</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {projectSummaries.slice(0, 6).map((p) => {
                const theme = getColorTheme(p.color);
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setOpenedProjectId(p.id);
                      onNavigateTab('projects');
                    }}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 bg-slate-50/40 dark:bg-slate-950/40 hover:bg-slate-100/60 dark:hover:bg-slate-900/60 transition-all cursor-pointer group shadow-2xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-xl ${theme.bg} ${theme.border} border flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}
                          >
                            {renderDeviceIcon(p.icon || 'server', `w-4 h-4 ${theme.text}`)}
                          </div>
                          <div>
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {p.name}
                            </h3>
                            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                              {p.code}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                            p.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800'
                              : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>

                      {p.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-2 leading-relaxed">
                          {p.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[11px] px-2 py-0.5 rounded-lg font-mono font-bold border ${theme.badge}`}>
                          {p.assignedCount} IPs
                        </span>
                        {p.onlineCount > 0 && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {p.onlineCount} online
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                        Open <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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

      {/* CREATE NEW PROJECT MODAL */}
      {createProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/20">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Create New Project Box
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Group and allocate IP addresses to a dedicated workload
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateProjectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {projectFormError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{projectFormError}</span>
              </div>
            )}

            <form onSubmit={handleCreateProjectSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Project Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={projectForm.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      const autoCode = val.substring(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '_');
                      setProjectForm((prev) => ({
                        ...prev,
                        name: val,
                        code: prev.code ? prev.code : autoCode ? `PRJ-${autoCode}` : '',
                      }));
                    }}
                    placeholder="e.g. Kubernetes Dev Cluster"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-[#0c0c0c] focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Box Code Identifier <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={projectForm.code}
                    onChange={(e) =>
                      setProjectForm({
                        ...projectForm,
                        code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '_'),
                      })
                    }
                    placeholder="e.g. PRJ-K8S-01"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-mono uppercase focus:bg-white dark:focus:bg-[#0c0c0c] focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* DEVICE CATEGORY THEME SELECTOR */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Device Category Theme
                  </label>
                  <select
                    value={projectForm.category}
                    onChange={(e) => {
                      const cat = e.target.value;
                      const matched = DEVICE_CATEGORIES.find((d) => d.name === cat);
                      if (matched) {
                        setProjectForm({
                          ...projectForm,
                          category: cat,
                          icon: matched.icon,
                          color: matched.color,
                        });
                      } else {
                        setProjectForm({ ...projectForm, category: cat });
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#0c0c0c] focus:outline-none focus:border-indigo-500"
                  >
                    {DEVICE_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                    {deviceClassifications.map((dc) => (
                      <option key={dc.id} value={dc.name}>
                        {dc.name} (Custom)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Operational Status
                  </label>
                  <select
                    value={projectForm.status}
                    onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#0c0c0c] focus:outline-none focus:border-indigo-500"
                  >
                    <option value="active">Active (Operational)</option>
                    <option value="planning">Planning (Staging)</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="archived">Archived (Decommissioned)</option>
                  </select>
                </div>
              </div>

              {/* COLOR THEME SELECTOR */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Theme Color
                </label>
                <div className="flex items-center gap-1.5 flex-wrap p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                  {AVAILABLE_COLORS.map((c) => {
                    const isSelected = projectForm.color === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setProjectForm({ ...projectForm, color: c.id })}
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${c.swatch} border-2 ${
                          isSelected
                            ? 'border-slate-900 dark:border-white scale-110'
                            : 'border-transparent opacity-80 hover:opacity-100'
                        }`}
                        title={c.label}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* OWNER & DEPARTMENT */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Owner / Lead Engineer
                  </label>
                  <input
                    type="text"
                    value={projectForm.owner}
                    onChange={(e) => setProjectForm({ ...projectForm, owner: e.target.value })}
                    placeholder="e.g. John Doe / Cloud Team"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-[#0c0c0c] focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Department / Unit
                  </label>
                  <input
                    type="text"
                    value={projectForm.department}
                    onChange={(e) => setProjectForm({ ...projectForm, department: e.target.value })}
                    placeholder="e.g. IT Operations, DevOps"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-[#0c0c0c] focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* DESCRIPTION */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  placeholder="Summary of project workload scope..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-[#0c0c0c] focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* NOTES */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Documentation &amp; Notes
                </label>
                <textarea
                  rows={2}
                  value={projectForm.notes}
                  onChange={(e) => setProjectForm({ ...projectForm, notes: e.target.value })}
                  placeholder="Architecture notes, ticket references, SLA..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-[#0c0c0c] focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* FORM ACTIONS */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateProjectModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
                >
                  Create Project Box
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROJECT TOAST NOTIFICATION */}
      {projectToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900 dark:bg-slate-900 text-white text-xs shadow-xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{projectToast.message}</span>
          {projectToast.projectId && (
            <button
              type="button"
              onClick={() => {
                setOpenedProjectId(projectToast.projectId!);
                onNavigateTab('projects');
                setProjectToast(null);
              }}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors cursor-pointer"
            >
              Open Project
            </button>
          )}
          <button
            type="button"
            onClick={() => setProjectToast(null)}
            className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
