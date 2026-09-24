import React, { useState, useMemo, useEffect } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { Subnet, IPRecord, IPStatus, DeviceType, DeviceClassification } from '../types';
import {
  parseCIDR,
  generateIPsForSubnet,
  formatMAC,
  isValidMAC,
  isValidIPv4,
  isIpInSubnet,
  getSubnetBlocks,
  SubnetBlock,
  ipToLong,
  longToIp,
} from '../utils/ipUtils';
import {
  ArrowLeft,
  Network,
  Plus,
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Server,
  Monitor,
  Router,
  Flame,
  Cpu,
  Printer,
  Shield,
  Trash2,
  Edit2,
  RefreshCw,
  Zap,
  Check,
  ChevronLeft,
  ChevronRight,
  Radar,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Laptop,
  HardDrive,
  Wifi,
  Database,
  Terminal,
  Smartphone,
  Tablet,
  Radio,
  Box,
  SlidersHorizontal,
  Tag,
  Eye,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { SubnetScannerModal } from './SubnetScannerModal';
import { SubnetBulkImportModal } from './SubnetBulkImportModal';
import { renderDeviceIcon as renderUnifiedDeviceIcon } from '../utils/deviceIcons';

import { CLASSIFICATION_COLOR_MAP, getColorTheme as getClassificationTheme } from '../utils/deviceColors';
export { CLASSIFICATION_COLOR_MAP, getClassificationTheme };

interface SubnetDetailViewProps {
  subnetId: string;
  onBack: () => void;
  targetIp?: string;
  initialAction?: 'view' | 'edit' | 'allocate';
}

export const SubnetDetailView: React.FC<SubnetDetailViewProps> = ({
  subnetId,
  onBack,
  targetIp,
  initialAction,
}) => {
  const {
    subnets,
    ips,
    currentUser,
    allocateIP,
    releaseIP,
    updateIP,
    deleteSubnet,
    pingIP,
    batchPingIPs,
    hasPermission,
    deviceClassifications,
    projects,
    isInitialLoadDone,
  } = useIPAM();

  const subnet = subnets.find((s) => s.id === subnetId);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [heatmapColorMode, setHeatmapColorMode] = useState<'status' | 'classification'>('classification');
  const [hoveredIp, setHoveredIp] = useState<string | null>(null);
  const [isProbingSubnet, setIsProbingSubnet] = useState(false);

  // Auto Arrange IP Sorting (In Order / Ascending vs De-order / Descending)
  const [ipSortOrder, setIpSortOrder] = useState<'asc' | 'desc'>(() => {
    try {
      const saved = localStorage.getItem('ipam_subnet_ip_sort_order');
      return saved === 'desc' ? 'desc' : 'asc';
    } catch (e) {
      return 'asc';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ipam_subnet_ip_sort_order', ipSortOrder);
    } catch (e) {}
  }, [ipSortOrder]);

  // Deletion States
  const [ipToDelete, setIpToDelete] = useState<IPRecord | null>(null);
  const [deleteIpError, setDeleteIpError] = useState<string | null>(null);
  const [isDeleteSubnetModalOpen, setIsDeleteSubnetModalOpen] = useState(false);
  const [deleteSubnetError, setDeleteSubnetError] = useState<string | null>(null);

  // Modal State for Allocate/Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIpRecord, setEditingIpRecord] = useState<IPRecord | null>(null);

  const [formData, setFormData] = useState<{
    ip: string;
    hostname: string;
    macAddress: string;
    status: IPStatus;
    deviceType: DeviceType;
    projectId: string;
    owner: string;
    department: string;
    notes: string;
  }>({
    ip: '',
    hostname: '',
    macAddress: '',
    status: 'allocated',
    deviceType: deviceClassifications[0]?.code || 'server',
    projectId: '',
    owner: '',
    department: '',
    notes: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Subnet Block Partitioning for large scopes (e.g. /16, /20, /22)
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem(`ipam_block_${subnetId}`);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch (e) {
      return 0;
    }
  });
  const [filterActiveBlocksOnly, setFilterActiveBlocksOnly] = useState(false);
  const [blockJumpSearch, setBlockJumpSearch] = useState('');

  // Persist selected block index in session
  useEffect(() => {
    try {
      sessionStorage.setItem(`ipam_block_${subnetId}`, selectedBlockIndex.toString());
    } catch (e) {}
  }, [subnetId, selectedBlockIndex]);

  // Dynamic device classification helper
  const getClassificationInfo = (type?: DeviceType): DeviceClassification | undefined => {
    if (!type) return undefined;
    const lower = type.toLowerCase().trim();
    return deviceClassifications.find(
      (dc) => dc.code.toLowerCase() === lower || dc.name.toLowerCase() === lower || dc.id === lower
    );
  };

  const renderDeviceIcon = (type?: DeviceType, customClassName?: string) => {
    const dc = getClassificationInfo(type);
    const theme = getClassificationTheme(dc?.color);
    const iconName = dc?.icon || type?.toLowerCase();
    const colorClass = theme.text;
    const cls = customClassName || `w-4 h-4 ${colorClass}`;
    return renderUnifiedDeviceIcon(iconName, cls);
  };

  if (!subnet) {
    if (!isInitialLoadDone) {
      return (
        <div className="py-24 text-center bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3 shadow-sm">
          <div className="w-9 h-9 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-300 text-sm font-semibold">Loading subnet metrics...</p>
          <p className="text-slate-500 text-xs font-mono">Syncing PostgreSQL data</p>
        </div>
      );
    }
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl">
        <p className="text-slate-400">Subnet not found or removed.</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors cursor-pointer">
          Return to Subnets
        </button>
      </div>
    );
  }

  // Check if current user has permission to access this specific subnet
  const isSubnetPermitted =
    !currentUser ||
    currentUser.role === 'super_admin' ||
    !currentUser.permissions?.allowedSubnetIds ||
    currentUser.permissions.allowedSubnetIds.length === 0 ||
    currentUser.permissions.allowedSubnetIds.includes(subnet.id);

  if (!isSubnetPermitted) {
    return (
      <div className="py-16 text-center bg-slate-900 border border-slate-800 rounded-2xl max-w-lg mx-auto p-8 shadow-sm my-12">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
          <Shield className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white">Subnet Access Restricted</h3>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          Your user account is restricted from accessing subnet <strong className="text-slate-200">{subnet.name} ({subnet.cidr})</strong> by administrator RBAC scoping policy.
        </p>
        <button
          onClick={onBack}
          className="mt-6 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors shadow-sm cursor-pointer"
        >
          Return to My Subnets
        </button>
      </div>
    );
  }

  const cidrInfo = parseCIDR(subnet.cidr);

  // All IP records associated with this subnet (memoized for fast rendering)
  const subnetIps = useMemo(() => {
    return ips.filter((i) => i.subnetId === subnet.id);
  }, [ips, subnet.id]);

  // Aggregated classification breakdown for this subnet
  const subnetClassificationBreakdown = useMemo(() => {
    const counts: Record<string, { count: number; classification: DeviceClassification | undefined }> = {};
    let totalWithClassification = 0;

    for (let i = 0; i < subnetIps.length; i++) {
      const rec = subnetIps[i];
      if (rec.status !== 'available' && rec.deviceType) {
        const dc = getClassificationInfo(rec.deviceType);
        const key = dc ? dc.code : rec.deviceType.toLowerCase();
        if (!counts[key]) {
          counts[key] = { count: 0, classification: dc };
        }
        counts[key].count++;
        totalWithClassification++;
      }
    }

    return { counts, totalWithClassification };
  }, [subnetIps, deviceClassifications]);

  // Partition into /24 blocks (256 hosts each)
  const allBlocks = useMemo(() => {
    return getSubnetBlocks(subnet.cidr, 256);
  }, [subnet.cidr]);

  // IP Map lookup (O(1))
  const ipMap = useMemo(() => {
    const map = new Map<string, IPRecord>();
    for (let i = 0; i < subnetIps.length; i++) {
      map.set(subnetIps[i].ip, subnetIps[i]);
    }
    return map;
  }, [subnetIps]);

  // Compute stats for each /24 block in a single O(N) linear pass
  const blocksWithStats = useMemo(() => {
    if (allBlocks.length === 0) return [];

    const stats = allBlocks.map((block) => ({
      ...block,
      allocatedInBlock: 0,
      reservedInBlock: 0,
      dhcpInBlock: 0,
      offlineInBlock: 0,
      totalActive: 0,
      utilization: 0,
    }));

    if (stats.length === 1) {
      const b = stats[0];
      for (let i = 0; i < subnetIps.length; i++) {
        const s = subnetIps[i].status;
        if (s === 'allocated') b.allocatedInBlock++;
        else if (s === 'reserved') b.reservedInBlock++;
        else if (s === 'dhcp') b.dhcpInBlock++;
        else if (s === 'offline') b.offlineInBlock++;
      }
      b.totalActive = b.allocatedInBlock + b.reservedInBlock + b.dhcpInBlock + b.offlineInBlock;
      b.utilization = Math.round((b.totalActive / b.hostCount) * 100);
      return stats;
    }

    const baseLong = allBlocks[0].startLong;
    const numBlocks = allBlocks.length;
    const blockSize = 256;

    for (let i = 0; i < subnetIps.length; i++) {
      const rec = subnetIps[i];
      const ipNum = ipToLong(rec.ip);
      const blockIdx = Math.floor((ipNum - baseLong) / blockSize);
      if (blockIdx >= 0 && blockIdx < numBlocks) {
        const b = stats[blockIdx];
        if (rec.status === 'allocated') b.allocatedInBlock++;
        else if (rec.status === 'reserved') b.reservedInBlock++;
        else if (rec.status === 'dhcp') b.dhcpInBlock++;
        else if (rec.status === 'offline') b.offlineInBlock++;
      }
    }

    for (let i = 0; i < stats.length; i++) {
      const b = stats[i];
      b.totalActive = b.allocatedInBlock + b.reservedInBlock + b.dhcpInBlock + b.offlineInBlock;
      b.utilization = Math.round((b.totalActive / b.hostCount) * 100);
    }

    return stats;
  }, [allBlocks, subnetIps]);

  // Filtered blocks for selector dropdown
  const displayedBlocks = useMemo(() => {
    if (filterActiveBlocksOnly) {
      const active = blocksWithStats.filter((b) => b.totalActive > 0);
      return active.length > 0 ? active : blocksWithStats;
    }
    return blocksWithStats;
  }, [blocksWithStats, filterActiveBlocksOnly]);

  // Current selected block
  const currentBlock = blocksWithStats[selectedBlockIndex] || blocksWithStats[0] || {
    blockIndex: 0,
    startIp: cidrInfo?.networkAddress || '0.0.0.0',
    endIp: cidrInfo?.broadcastAddress || '0.0.0.0',
    cidrLabel: subnet.cidr,
    hostCount: Math.min(256, cidrInfo?.totalHosts || 256),
    allocatedInBlock: 0,
    totalActive: 0,
    utilization: 0,
    startLong: 0,
    endLong: 0,
  };

  // Generate grid addresses for the SELECTED BLOCK (256 addresses)
  const gridIps = useMemo(() => {
    if (!currentBlock) return [];
    return generateIPsForSubnet(currentBlock.startIp, currentBlock.hostCount, 256);
  }, [currentBlock]);

  // Status counts computed in O(1) from blocks stats
  const { allocatedCount, reservedCount, dhcpCount, offlineCount } = useMemo(() => {
    let allocated = 0;
    let reserved = 0;
    let dhcp = 0;
    let offline = 0;

    for (let i = 0; i < blocksWithStats.length; i++) {
      const b = blocksWithStats[i];
      allocated += b.allocatedInBlock;
      reserved += b.reservedInBlock;
      dhcp += b.dhcpInBlock;
      offline += b.offlineInBlock;
    }

    return { allocatedCount: allocated, reservedCount: reserved, dhcpCount: dhcp, offlineCount: offline };
  }, [blocksWithStats]);

  const totalAssignedInSubnet = allocatedCount + reservedCount + dhcpCount + offlineCount;
  const freeCount = Math.max(0, subnet.usableHosts - totalAssignedInSubnet);
  const utilizationPct = Math.round((totalAssignedInSubnet / subnet.usableHosts) * 100);

  // Permissions
  const canAllocate = hasPermission('allocateIP', subnet.id);
  const canRelease = hasPermission('releaseIP', subnet.id);
  const canEdit = hasPermission('editIP', subnet.id);

  // Next free IP helper
  const getNextFreeIp = () => {
    const existing = new Set(subnetIps.map((i) => i.ip));
    for (const ip of gridIps) {
      if (
        !existing.has(ip) &&
        ip !== subnet.gateway &&
        ip !== cidrInfo?.networkAddress &&
        ip !== cidrInfo?.broadcastAddress
      ) {
        return ip;
      }
    }
    return null;
  };

  // Jump to IP / Block
  const handleJumpToIp = (input: string) => {
    const cleaned = input.trim();
    if (!cleaned) return;

    if (isValidIPv4(cleaned)) {
      const targetLong = ipToLong(cleaned);
      const foundIdx = blocksWithStats.findIndex(
        (b) => targetLong >= b.startLong && targetLong <= b.endLong
      );
      if (foundIdx !== -1) {
        setSelectedBlockIndex(foundIdx);
      }
    } else {
      const foundIdx = blocksWithStats.findIndex(
        (b) => b.cidrLabel.includes(cleaned) || b.startIp.startsWith(cleaned) || b.endIp.startsWith(cleaned)
      );
      if (foundIdx !== -1) {
        setSelectedBlockIndex(foundIdx);
      }
    }
  };

  // Open modal to allocate a specific IP or next free
  const handleOpenAllocate = (ipToAssign?: string) => {
    if (!canAllocate) return;
    const targetIp = ipToAssign || getNextFreeIp() || '';
    setEditingIpRecord(null);
    setFormData({
      ip: targetIp,
      hostname: '',
      macAddress: '',
      status: 'allocated',
      deviceType: deviceClassifications[0]?.code || 'server',
      projectId: '',
      owner: currentUser?.fullName || '',
      department: currentUser?.department || '',
      notes: '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  // Open modal to edit existing IP
  const handleOpenEdit = (record: IPRecord) => {
    if (!canEdit) return;
    setEditingIpRecord(record);
    setFormData({
      ip: record.ip,
      hostname: record.hostname || '',
      macAddress: record.macAddress || '',
      status: record.status,
      deviceType: record.deviceType || deviceClassifications[0]?.code || 'server',
      projectId: record.projectId || '',
      owner: record.owner || '',
      department: record.department || '',
      notes: record.notes || '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  // Target IP auto-focus & auto-open Allocate/Update form if navigated from Dashboard
  const hasAutoHandledTarget = React.useRef(false);
  useEffect(() => {
    if (!targetIp || !subnet || hasAutoHandledTarget.current) return;
    hasAutoHandledTarget.current = true;

    // Jump to the specific block that contains this IP
    handleJumpToIp(targetIp);
    setSearchQuery(targetIp);

    const existing = subnetIps.find((i) => i.ip === targetIp);

    if (initialAction === 'edit' || (initialAction !== 'allocate' && existing && existing.status !== 'available')) {
      if (existing) {
        handleOpenEdit(existing);
      }
    } else if (initialAction === 'allocate' || !existing || existing.status === 'available') {
      handleOpenAllocate(targetIp);
    }
  }, [targetIp, subnet, subnetIps, initialAction]);

  // Modal Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!isValidIPv4(formData.ip)) {
      setFormError('Invalid IPv4 address.');
      return;
    }

    if (!isIpInSubnet(formData.ip, subnet.cidr)) {
      setFormError(`IP ${formData.ip} does not belong to subnet range ${subnet.cidr}`);
      return;
    }

    if (formData.macAddress && !isValidMAC(formData.macAddress)) {
      setFormError('Invalid MAC address. Format: XX:XX:XX:XX:XX:XX');
      return;
    }

    if (editingIpRecord) {
      const res = updateIP(editingIpRecord.id, {
        hostname: formData.hostname.trim(),
        macAddress: formData.macAddress.trim(),
        status: formData.status,
        deviceType: formData.deviceType,
        projectId: formData.projectId ? formData.projectId : undefined,
        owner: formData.owner.trim(),
        department: formData.department.trim(),
        notes: formData.notes.trim(),
      });
      if (!res.success) {
        setFormError(res.message);
        return;
      }
    } else {
      const res = allocateIP({
        subnetId: subnet.id,
        ip: formData.ip.trim(),
        hostname: formData.hostname.trim(),
        macAddress: formData.macAddress.trim(),
        status: formData.status,
        deviceType: formData.deviceType,
        projectId: formData.projectId ? formData.projectId : undefined,
        owner: formData.owner.trim(),
        department: formData.department.trim(),
        notes: formData.notes.trim(),
      });
      if (!res.success) {
        setFormError(res.message);
        return;
      }
    }

    setModalOpen(false);
  };

  // Ping Check
  const handlePing = async (recordId: string) => {
    setPingingId(recordId);
    await pingIP(recordId);
    setPingingId(null);
  };

  // Pagination States for IP inventory table
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(50);

  // Filtered & Sorted IP table with Status + Device Classification filters + Auto Arrange
  const filteredTableIps = useMemo(() => {
    const rawQ = searchQuery.toLowerCase().trim();
    const normalizedQ = rawQ
      .replace(/\b(?:notes|note|description|desc)\s*:\s*/gi, 'notes ')
      .replace(/\b(?:ports|port)\s*:\s*/gi, 'port ');
    const tokens = normalizedQ.split(/\s+/).filter(Boolean);

    const result = subnetIps.filter((rec) => {
      const dc = getClassificationInfo(rec.deviceType);
      const hasNotes = Boolean(rec.notes && rec.notes.trim());
      const hasPorts = Boolean(dc?.defaultPorts);
      const notesHasPort = Boolean(rec.notes && /(?:port|ports|:\s*\d{2,5}|\b\d{2,5}\/(?:tcp|udp))\b/i.test(rec.notes));

      let matchSearch = true;
      const prj = projects.find((p) => p.id === rec.projectId);

      if (tokens.length > 0) {
        const combined = [
          rec.ip,
          rec.hostname,
          rec.macAddress,
          rec.owner,
          rec.department,
          rec.notes,
          hasNotes ? 'notes note documented' : '',
          rec.status,
          rec.deviceType,
          dc?.name,
          dc?.category,
          dc?.vendor,
          dc?.defaultPorts,
          prj?.name,
          prj?.code,
          prj?.category,
          hasPorts || notesHasPort ? `port ports defaultports ${dc?.defaultPorts || ''}` : '',
        ]
          .filter(Boolean)
          .map((f) => String(f).toLowerCase())
          .join(' ');

        matchSearch = tokens.every((tok) => combined.includes(tok));
      }

      const matchStatus = statusFilter === 'all' || rec.status === statusFilter;

      let matchClassification = true;
      if (classificationFilter !== 'all') {
        if (classificationFilter === 'unclassified') {
          matchClassification = !rec.deviceType || rec.deviceType === 'other';
        } else {
          const dc = getClassificationInfo(rec.deviceType);
          matchClassification = dc?.code === classificationFilter || rec.deviceType === classificationFilter;
        }
      }

      let matchProject = true;
      if (projectFilter !== 'all') {
        if (projectFilter === 'unassigned') {
          matchProject = !rec.projectId;
        } else {
          matchProject = rec.projectId === projectFilter;
        }
      }

      return matchSearch && matchStatus && matchClassification && matchProject;
    });

    // Auto arrange IP in order (Ascending) or de-order (Descending)
    return result.sort((a, b) => {
      const numA = ipToLong(a.ip);
      const numB = ipToLong(b.ip);
      return ipSortOrder === 'asc' ? numA - numB : numB - numA;
    });
  }, [subnetIps, searchQuery, statusFilter, classificationFilter, projectFilter, deviceClassifications, projects, ipSortOrder]);

  const totalTablePages = Math.ceil(filteredTableIps.length / tablePageSize) || 1;
  const pagedTableIps = useMemo(() => {
    const start = (tablePage - 1) * tablePageSize;
    return filteredTableIps.slice(start, start + tablePageSize);
  }, [filteredTableIps, tablePage, tablePageSize]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['IP Address', 'Status', 'Hostname', 'MAC Address', 'Device Type', 'Classification Name', 'Owner', 'Department', 'Notes'];
    const sorted = [...subnetIps].sort((a, b) => {
      const numA = ipToLong(a.ip);
      const numB = ipToLong(b.ip);
      return ipSortOrder === 'asc' ? numA - numB : numB - numA;
    });
    const rows = sorted.map((i) => {
      const dc = getClassificationInfo(i.deviceType);
      return [
        i.ip,
        i.status,
        i.hostname || '',
        i.macAddress || '',
        i.deviceType || '',
        dc?.name || '',
        i.owner || '',
        i.department || '',
        `"${(i.notes || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${subnet.name.replace(/[^a-z0-9]/gi, '_')}_${subnet.cidr.replace('/', '_')}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumbs & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer shadow-2xs"
            title="Back to subnets"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{subnet.name}</h2>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/80 dark:text-blue-400 dark:border-blue-800 font-semibold shadow-2xs">
                {subnet.cidr}
              </span>
              {subnet.vlanId && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800 font-mono font-semibold shadow-2xs">
                  VLAN {subnet.vlanId}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {subnet.location} • Gateway: <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">{subnet.gateway}</span> • Netmask: <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">{subnet.mask}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            id="btn-scan-subnet"
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-slate-800 text-xs text-blue-600 dark:text-blue-400 font-semibold transition-colors border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500/50 cursor-pointer shadow-2xs"
            title="Scan subnet for active responsive hosts and unmanaged IPs"
          >
            <Radar className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
            <span>Scan Subnet</span>
          </button>

          {canAllocate && (
            <button
              id="btn-bulk-import-ips"
              onClick={() => setIsBulkImportOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-slate-800 text-xs text-emerald-600 dark:text-emerald-400 font-semibold transition-colors border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/50 cursor-pointer shadow-2xs"
              title="Bulk import IPs from Excel (.xlsx) or CSV template"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Import IPs</span>
            </button>
          )}

          <button
            id="btn-export-subnet-csv"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 font-medium transition-colors border border-slate-200 dark:border-slate-800 cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {canAllocate && (
            <button
              id="btn-allocate-ip"
              onClick={() => handleOpenAllocate()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs text-white font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Allocate IP</span>
            </button>
          )}

          {hasPermission('deleteSubnet', subnet.id) && (
            <button
              id="btn-delete-subnet"
              onClick={() => {
                setDeleteSubnetError(null);
                setIsDeleteSubnetModalOpen(true);
              }}
              title="Delete Subnet"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-800 text-xs font-medium transition-colors cursor-pointer shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete Subnet</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackToast && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{feedbackToast.message}</span>
          </div>
          <button
            onClick={() => setFeedbackToast(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-white text-xs font-semibold px-2 py-0.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Utilization & Capacity Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Capacity</span>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tracking-tight">{subnet.usableHosts}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">/{cidrInfo?.prefix} Prefix</p>
        </div>

        <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Allocated IPs</span>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300 mt-1 tracking-tight">{allocatedCount}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">In active use</p>
        </div>

        <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Reserved IPs</span>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-300 mt-1 tracking-tight">{reservedCount}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Static reservations</p>
        </div>

        <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">DHCP / Dynamic</span>
          <p className="text-2xl font-bold text-sky-600 dark:text-sky-300 mt-1 tracking-tight">{dhcpCount}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Pool range</p>
        </div>

        <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 col-span-2 sm:col-span-1 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Available / Free</span>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-200 mt-1 tracking-tight">{freeCount}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{100 - utilizationPct}% free space</p>
        </div>
      </div>

      {/* HARDWARE TYPOLOGY & CLASSIFICATION BREAKDOWN BAR */}
      {subnetClassificationBreakdown.totalWithClassification > 0 && (
        <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-200">
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Subnet Hardware Typology &amp; Classification Breakdown</span>
            </div>
            <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
              {subnetClassificationBreakdown.totalWithClassification} Classified Hosts (
              {Math.round((subnetClassificationBreakdown.totalWithClassification / (allocatedCount || 1)) * 100)}% of active IPs)
            </span>
          </div>

          {/* Visual Multi-Segment Color Progress Bar */}
          <div className="w-full h-3 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden flex border border-slate-200 dark:border-slate-800">
            {(Object.entries(subnetClassificationBreakdown.counts) as [string, { count: number; classification?: DeviceClassification }][]).map(([key, item]) => {
              const theme = getClassificationTheme(item.classification?.color);
              const pct = (item.count / subnetClassificationBreakdown.totalWithClassification) * 100;
              return (
                <div
                  key={key}
                  style={{ width: `${pct}%` }}
                  className={`h-full ${theme.dot} transition-all relative group cursor-pointer`}
                  title={`${item.classification?.name || key}: ${item.count} IPs (${Math.round(pct)}%)`}
                />
              );
            })}
          </div>

          {/* Classification Legend Pills with Distinct Colors */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {(Object.entries(subnetClassificationBreakdown.counts) as [string, { count: number; classification?: DeviceClassification }][]).map(([key, item]) => {
              const theme = getClassificationTheme(item.classification?.color);
              const isSelected = classificationFilter === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setClassificationFilter(isSelected ? 'all' : key)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border flex items-center gap-1.5 font-medium transition-all cursor-pointer ${
                    theme.badge
                  } ${isSelected ? 'ring-2 ring-blue-500 dark:ring-blue-400 font-bold' : 'hover:opacity-90'}`}
                  title={`Filter table by ${item.classification?.name || key}`}
                >
                  <span className={`w-2 h-2 rounded-full ${theme.dot}`} />
                  <span>{item.classification?.name || key}</span>
                  <span className="opacity-75 font-mono font-semibold">({item.count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* INTERACTIVE MULTI-BLOCK HEATMAP VISUALIZER */}
      <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Interactive Subnet Heatmap Matrix</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 font-mono font-medium border">
                {currentBlock.startIp} - {currentBlock.endIp} ({gridIps.length} Addresses)
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Click any block to inspect details or allocate the next available IP address.
            </p>
          </div>

          {/* Color Mode Toggle & Legend */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Mode Switcher */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl gap-1 text-xs">
              <button
                type="button"
                onClick={() => setHeatmapColorMode('classification')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium text-[11px] flex items-center gap-1 ${
                  heatmapColorMode === 'classification'
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>By Classification</span>
              </button>
              <button
                type="button"
                onClick={() => setHeatmapColorMode('status')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium text-[11px] flex items-center gap-1 ${
                  heatmapColorMode === 'status'
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>By Status</span>
              </button>
            </div>

            {/* Dynamic Legend */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              {heatmapColorMode === 'classification' ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700" />
                    <span className="text-slate-600 dark:text-slate-400 text-[11px]">Free</span>
                  </div>
                  {deviceClassifications.slice(0, 5).map((dc) => {
                    const theme = getClassificationTheme(dc.color);
                    return (
                      <div key={dc.id} className="flex items-center gap-1.5">
                        <span className={`w-3 h-3 rounded ${theme.dot}`} />
                        <span className="text-slate-700 dark:text-slate-300 text-[11px]">{dc.name}</span>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-purple-600" />
                    <span className="text-slate-600 dark:text-slate-400 text-[11px]">GW/Net</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700" />
                    <span className="text-slate-600 dark:text-slate-400 text-[11px]">Free</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-emerald-500" />
                    <span className="text-slate-600 dark:text-slate-400 text-[11px]">Allocated</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-amber-500" />
                    <span className="text-slate-600 dark:text-slate-400 text-[11px]">Reserved</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-sky-500" />
                    <span className="text-slate-600 dark:text-slate-400 text-[11px]">DHCP</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-rose-500" />
                    <span className="text-slate-600 dark:text-slate-400 text-[11px]">Offline</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-purple-600" />
                    <span className="text-slate-600 dark:text-slate-400 text-[11px]">GW/Net</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Block / Range Selector Toolbar for large subnets (> 256 hosts) */}
        {allBlocks.length > 1 && (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />
                <span>Select /24 Range Block:</span>
              </span>

              {/* Range Block Dropdown */}
              <select
                value={selectedBlockIndex}
                onChange={(e) => setSelectedBlockIndex(Number(e.target.value))}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 font-mono font-medium cursor-pointer shadow-sm"
              >
                {displayedBlocks.map((b) => (
                  <option key={b.blockIndex} value={b.blockIndex}>
                    Block #{b.blockIndex}: {b.startIp} - {b.endIp} ({b.totalActive} IPs • {b.utilization}%)
                  </option>
                ))}
              </select>

              {/* Prev / Next Block Quick Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={selectedBlockIndex === 0}
                  onClick={() => setSelectedBlockIndex((idx) => Math.max(0, idx - 1))}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer font-medium text-[11px]"
                  title="Previous Range Block"
                >
                  &larr; Prev Block
                </button>
                <button
                  type="button"
                  disabled={selectedBlockIndex === allBlocks.length - 1}
                  onClick={() => setSelectedBlockIndex((idx) => Math.min(allBlocks.length - 1, idx + 1))}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer font-medium text-[11px]"
                  title="Next Range Block"
                >
                  Next Block &rarr;
                </button>
              </div>

              {/* Active Only Filter Checkbox */}
              <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer ml-2 text-[11px]">
                <input
                  type="checkbox"
                  checked={filterActiveBlocksOnly}
                  onChange={(e) => setFilterActiveBlocksOnly(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-blue-600 focus:ring-blue-500"
                />
                <span>Active Blocks Only</span>
              </label>
            </div>

            {/* Quick IP Address / Range Jump Search */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <input
                type="text"
                placeholder="Jump to IP in scope..."
                value={blockJumpSearch}
                onChange={(e) => setBlockJumpSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleJumpToIp(blockJumpSearch);
                  }
                }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500 w-36 shadow-sm"
              />
              <button
                type="button"
                onClick={() => handleJumpToIp(blockJumpSearch)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
              >
                Jump
              </button>
            </div>
          </div>
        )}

        {/* Heatmap Range Info */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 pt-1">
          <span>
            Viewing <strong className="text-slate-800 dark:text-slate-200">{currentBlock.cidrLabel}</strong> ({currentBlock.hostCount} Addresses)
          </span>
          <div className="flex items-center gap-3">
            <span>
              Active in Block: <strong className="text-emerald-600 dark:text-emerald-400">{currentBlock.totalActive}</strong> ({currentBlock.utilization}%)
            </span>
            {allBlocks.length > 1 && (
              <span className="text-slate-400 dark:text-slate-500 text-[11px] font-mono">
                Block {selectedBlockIndex + 1} of {allBlocks.length}
              </span>
            )}
          </div>
        </div>

        {/* Live Hover Inspector Bar */}
        <div className="h-9 my-3 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
          {hoveredIp ? (
            (() => {
              const rec = ipMap.get(hoveredIp);
              const isGw = hoveredIp === subnet.gateway;
              const isNet = hoveredIp === cidrInfo?.networkAddress;
              const isBcast = hoveredIp === cidrInfo?.broadcastAddress;
              const dc = rec?.deviceType ? getClassificationInfo(rec.deviceType) : undefined;
              const theme = getClassificationTheme(dc?.color);

              return (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-slate-900 dark:text-white">{hoveredIp}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-sans uppercase font-bold border ${
                        isNet || isBcast
                          ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800'
                          : isGw
                          ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800'
                          : rec?.status === 'allocated'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                          : rec?.status === 'reserved'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                          : rec?.status === 'dhcp'
                          ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800'
                          : rec?.status === 'offline'
                          ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
                          : 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                      }`}
                    >
                      {isNet ? 'Network' : isBcast ? 'Broadcast' : isGw ? 'Default Gateway' : rec?.status || 'Free / Available'}
                    </span>

                    {/* Classification Badge on Hover */}
                    {dc && (
                      <span className={`text-[10px] px-2 py-0.5 rounded font-sans font-semibold border flex items-center gap-1 ${theme.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
                        <span>{dc.name}</span>
                      </span>
                    )}

                    {rec?.hostname && (
                      <span className="text-slate-700 dark:text-slate-300 font-sans truncate max-w-xs">{rec.hostname}</span>
                    )}
                    {rec?.macAddress && <span className="text-slate-400 dark:text-slate-500">{rec.macAddress}</span>}
                  </div>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-sans font-medium">
                    {rec ? 'Click to inspect / edit' : canAllocate ? 'Click to allocate this IP' : 'Available'}
                  </span>
                </div>
              );
            })()
          ) : (
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-sans">
              Hover over any IP block to inspect network status, or click to allocate.
            </span>
          )}
        </div>

        {/* Heatmap Grid of Blocks */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(34px,1fr))] gap-1.5 p-2 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800/80 max-h-80 overflow-y-auto">
          {gridIps.map((ip) => {
            const rec = ipMap.get(ip);
            const isGw = ip === subnet.gateway;
            const isNet = ip === cidrInfo?.networkAddress;
            const isBcast = ip === cidrInfo?.broadcastAddress;
            const lastOctet = ip.split('.')[3];

            let bgClass = 'bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700/50 shadow-xs';

            if (isNet || isBcast || isGw) {
              bgClass = 'bg-purple-600/90 text-white font-bold hover:bg-purple-500 border-purple-400/50 shadow-sm';
            } else if (rec) {
              if (heatmapColorMode === 'classification' && rec.deviceType) {
                const dc = getClassificationInfo(rec.deviceType);
                if (dc) {
                  const theme = getClassificationTheme(dc.color);
                  bgClass = theme.heatmapBg;
                } else if (rec.status === 'allocated') {
                  bgClass = 'bg-emerald-500 text-white font-medium hover:bg-emerald-400 border-emerald-400/50';
                } else if (rec.status === 'reserved') {
                  bgClass = 'bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 border-amber-400/50';
                } else if (rec.status === 'dhcp') {
                  bgClass = 'bg-sky-500 text-white font-medium hover:bg-sky-400 border-sky-400/50';
                } else if (rec.status === 'offline') {
                  bgClass = 'bg-rose-500 text-white font-medium hover:bg-rose-400 border-rose-400/50';
                }
              } else if (rec.status === 'allocated') {
                bgClass = 'bg-emerald-500 text-white font-medium hover:bg-emerald-400 border-emerald-400/50';
              } else if (rec.status === 'reserved') {
                bgClass = 'bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 border-amber-400/50';
              } else if (rec.status === 'dhcp') {
                bgClass = 'bg-sky-500 text-white font-medium hover:bg-sky-400 border-sky-400/50';
              } else if (rec.status === 'offline') {
                bgClass = 'bg-rose-500 text-white font-medium hover:bg-rose-400 border-rose-400/50';
              }
            }

            return (
              <button
                key={ip}
                type="button"
                onMouseEnter={() => setHoveredIp(ip)}
                onMouseLeave={() => setHoveredIp(null)}
                onClick={() => {
                  if (rec) {
                    handleOpenEdit(rec);
                  } else if (canAllocate && !isNet && !isBcast) {
                    handleOpenAllocate(ip);
                  }
                }}
                className={`h-7 rounded text-[10px] font-mono flex items-center justify-center border transition-all cursor-pointer ${bgClass}`}
                title={`${ip} (${rec ? rec.status : 'Available'})`}
              >
                {lastOctet}
              </button>
            );
          })}
        </div>
      </div>

      {/* IP Inventory Table & Search Filter */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter IPs, hostnames, MACs, owners..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setTablePage(1);
              }}
              className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-sans"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            {/* Classification Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Class:</span>
              <select
                value={classificationFilter}
                onChange={(e) => {
                  setClassificationFilter(e.target.value);
                  setTablePage(1);
                }}
                className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
              >
                <option value="all">All Classifications</option>
                {deviceClassifications.map((dc) => {
                  const count = subnetIps.filter((i) => {
                    const matched = getClassificationInfo(i.deviceType);
                    return matched?.code === dc.code;
                  }).length;
                  return (
                    <option key={dc.id} value={dc.code}>
                      {dc.name} ({count})
                    </option>
                  );
                })}
                <option value="unclassified">Unclassified</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setTablePage(1);
                }}
                className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
              >
                <option value="all">All Statuses ({subnetIps.length})</option>
                <option value="allocated">Allocated ({allocatedCount})</option>
                <option value="reserved">Reserved ({reservedCount})</option>
                <option value="dhcp">DHCP Pool ({dhcpCount})</option>
                <option value="offline">Offline ({offlineCount})</option>
              </select>
            </div>

            {/* Project Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Project:</span>
              <select
                value={projectFilter}
                onChange={(e) => {
                  setProjectFilter(e.target.value);
                  setTablePage(1);
                }}
                className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
              >
                <option value="all">All Projects</option>
                {projects.map((p) => {
                  const count = subnetIps.filter((i) => i.projectId === p.id).length;
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} ({count})
                    </option>
                  );
                })}
                <option value="unassigned">No Project</option>
              </select>
            </div>

            {/* Check Subnet Health Button */}
            <button
              type="button"
              disabled={isProbingSubnet}
              onClick={async () => {
                const activeIps = subnetIps.filter((i) => i.status !== 'available').map((i) => i.ip);
                if (activeIps.length === 0) return;
                setIsProbingSubnet(true);
                try {
                  await batchPingIPs(activeIps);
                } finally {
                  setIsProbingSubnet(false);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-600/20 hover:bg-blue-100 dark:hover:bg-blue-600/30 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-200 dark:border-blue-500/30 transition-colors cursor-pointer disabled:opacity-40"
              title="Probe ping reachability of all assigned IPs in this subnet"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProbingSubnet ? 'animate-spin' : ''}`} />
              <span>{isProbingSubnet ? 'Checking Health...' : 'Check Subnet Health'}</span>
            </button>
          </div>
        </div>

        {/* IPs Table */}
        <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th
                    className="py-3.5 px-4 min-w-[160px] cursor-pointer select-none group hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    onClick={() => {
                      setIpSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                      setTablePage(1);
                    }}
                    title={`Click to sort IPs (${ipSortOrder === 'asc' ? 'Ascending / Low to High' : 'Descending / High to Low'})`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>IP Address</span>
                      {ipSortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                  </th>
                  <th className="py-3.5 px-4 min-w-[110px]">Status</th>
                  <th className="py-3.5 px-4 min-w-[220px]">Device &amp; Hostname</th>
                  <th className="py-3.5 px-4 min-w-[150px]">MAC Address</th>
                  <th className="py-3.5 px-4 min-w-[160px]">Owner / Unit</th>
                  <th className="py-3.5 px-4 min-w-[140px]">Ping Health</th>
                  <th className="py-3.5 px-4 min-w-[120px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredTableIps.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500">
                      No active IP allocations match your query.
                    </td>
                  </tr>
                ) : (
                  pagedTableIps.map((rec) => {
                    const isGw = rec.ip === subnet.gateway;
                    const matchedClassification = getClassificationInfo(rec.deviceType);
                    const theme = getClassificationTheme(matchedClassification?.color);

                    return (
                      <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        {/* IP */}
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            <span>{rec.ip}</span>
                            {isGw && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800 font-sans font-bold border">
                                Gateway
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold capitalize border ${
                              rec.status === 'allocated'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                                : rec.status === 'reserved'
                                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                                : rec.status === 'dhcp'
                                ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800'
                                : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>

                        {/* Hostname & Distinct Color Device Classification Badge */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-lg ${theme.bg} ${theme.border} border flex items-center justify-center shrink-0`}>
                              {renderDeviceIcon(rec.deviceType, `w-4 h-4 ${theme.text}`)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-slate-900 dark:text-slate-100">{rec.hostname || '—'}</p>
                                {matchedClassification ? (
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1.5 font-medium shadow-sm ${theme.badge}`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${theme.dot}`} />
                                    <span>{matchedClassification.name}</span>
                                  </span>
                                ) : rec.deviceType ? (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                                    {rec.deviceType}
                                  </span>
                                ) : null}
                                {(() => {
                                  const prj = projects.find((p) => p.id === rec.projectId);
                                  if (!prj) return null;
                                  const prjTheme = getClassificationTheme(prj.color);
                                  return (
                                    <span
                                      className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1.5 font-semibold shadow-2xs ${prjTheme.badge}`}
                                      title={`Project: ${prj.name} (${prj.code})`}
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${prjTheme.dot}`} />
                                      <span>{prj.code}</span>
                                    </span>
                                  );
                                })()}
                              </div>
                              {rec.notes && <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-xs mt-0.5">{rec.notes}</p>}
                            </div>
                          </div>
                        </td>

                        {/* MAC */}
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {rec.macAddress || '—'}
                        </td>

                        {/* Owner */}
                        <td className="py-3 px-4">
                          <p className="text-slate-800 dark:text-slate-200">{rec.owner || '—'}</p>
                          {rec.department && <p className="text-[10px] text-slate-400 dark:text-slate-500">{rec.department}</p>}
                        </td>

                        {/* Ping Health */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                rec.lastPingStatus === 'online'
                                  ? 'bg-emerald-500'
                                  : rec.lastPingStatus === 'unreachable' || rec.lastPingStatus === 'offline'
                                  ? 'bg-rose-500'
                                  : 'bg-amber-500'
                              }`}
                            />
                            <span
                              className={`text-[11px] capitalize font-medium ${
                                rec.lastPingStatus === 'online'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : rec.lastPingStatus === 'unreachable' || rec.lastPingStatus === 'offline'
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {rec.lastPingStatus === 'unreachable'
                                ? 'Offline'
                                : rec.lastPingStatus || 'Unknown'}
                            </span>
                            <button
                              disabled={pingingId === rec.id}
                              onClick={() => handlePing(rec.id)}
                              title="Check ping reachability"
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                            >
                              <RefreshCw className={`w-3 h-3 ${pingingId === rec.id ? 'animate-spin text-blue-500' : ''}`} />
                            </button>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canEdit && (
                              <button
                                onClick={() => handleOpenEdit(rec)}
                                title="Edit IP details"
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {canRelease && (
                              <button
                                onClick={() => {
                                  setDeleteIpError(null);
                                  setIpToDelete(rec);
                                }}
                                title="Release / Delete IP"
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-800 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Bar */}
          {filteredTableIps.length > 0 && (
            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span>
                  Showing{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {(tablePage - 1) * tablePageSize + 1} - {Math.min(tablePage * tablePageSize, filteredTableIps.length).toLocaleString()}
                  </strong>{' '}
                  of <strong className="text-slate-800 dark:text-slate-200">{filteredTableIps.length.toLocaleString()}</strong> allocated IP records
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span>Per page:</span>
                  <select
                    value={tablePageSize}
                    onChange={(e) => {
                      setTablePageSize(Number(e.target.value));
                      setTablePage(1);
                    }}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                  </select>
                </div>

                {totalTablePages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={tablePage === 1}
                      onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                      className="p-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 text-slate-700 dark:text-slate-300 font-mono text-xs">
                      Page {tablePage} of {totalTablePages}
                    </span>
                    <button
                      type="button"
                      disabled={tablePage === totalTablePages}
                      onClick={() => setTablePage((p) => Math.min(totalTablePages, p + 1))}
                      className="p-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                      title="Next Page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ALLOCATE / EDIT IP MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-500/20">
                  <Network className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingIpRecord ? `Edit IP: ${editingIpRecord.ip}` : 'Allocate IP Address'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    IP Address <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingIpRecord}
                    value={formData.ip}
                    onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                    placeholder="e.g. 192.168.10.25"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Allocation Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as IPStatus })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="allocated">Allocated (Active Device)</option>
                    <option value="reserved">Reserved (Static Plan)</option>
                    <option value="dhcp">DHCP Pool Range</option>
                    <option value="offline">Offline (Decommissioned)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Hostname / FQDN</label>
                  <input
                    type="text"
                    value={formData.hostname}
                    onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                    placeholder="e.g. srv-app01.corp.internal"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">MAC Address</label>
                  <input
                    type="text"
                    value={formData.macAddress}
                    onChange={(e) => setFormData({ ...formData, macAddress: formatMAC(e.target.value) })}
                    placeholder="e.g. 00:1A:2B:3C:4D:5E"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Device Classification <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.deviceType}
                    onChange={(e) => setFormData({ ...formData, deviceType: e.target.value as DeviceType })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    {deviceClassifications && deviceClassifications.length > 0 ? (
                      deviceClassifications.map((dc) => (
                        <option key={dc.id} value={dc.code}>
                          {dc.name} ({dc.category}) — [{dc.code}]
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="server">Server / Bare-Metal</option>
                        <option value="vm">Virtual Machine / Pod</option>
                        <option value="router">Core Router</option>
                        <option value="switch">PoE Switch</option>
                        <option value="firewall">Firewall / Security Appliance</option>
                        <option value="workstation">Workstation / Desktop</option>
                      </>
                    )}
                    <option value="other">Other / Unclassified</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Project Workload
                  </label>
                  <select
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">No Project (Unassigned Workload)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code}) — [{p.category}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Owner / Assignee</label>
                  <input
                    type="text"
                    value={formData.owner}
                    onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                    placeholder="e.g. Platform Team"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="e.g. IT Operations"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Notes / Description</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional metadata, rack number, port..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors cursor-pointer"
                >
                  {editingIpRecord ? 'Update IP Record' : 'Allocate IP Address'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RELEASE / DELETE IP CONFIRMATION MODAL */}
      {ipToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 border border-rose-200 dark:border-rose-500/20">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-white">Release IP: {ipToDelete.ip}?</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              Are you sure you want to release and unassign IP{' '}
              <strong className="text-slate-900 dark:text-white font-mono">{ipToDelete.ip}</strong>?
              {ipToDelete.hostname && (
                <span>
                  {' '}
                  Associated with host <strong className="text-slate-800 dark:text-slate-200">{ipToDelete.hostname}</strong>.
                </span>
              )}
            </p>

            {deleteIpError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteIpError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setIpToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = releaseIP(ipToDelete.id);
                  if (!res.success) {
                    setDeleteIpError(res.message);
                    return;
                  }
                  setIpToDelete(null);
                  setFeedbackToast({ message: `Successfully released IP ${ipToDelete.ip}.`, type: 'info' });
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-colors cursor-pointer"
              >
                Release IP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE SUBNET CONFIRMATION MODAL */}
      {isDeleteSubnetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 border border-rose-200 dark:border-rose-500/20">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Subnet: {subnet.name}?</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              Are you sure you want to permanently delete subnet{' '}
              <strong className="text-slate-900 dark:text-white font-mono">{subnet.cidr}</strong>? All associated IP allocations and
              metadata will be purged.
            </p>

            {deleteSubnetError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteSubnetError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setIsDeleteSubnetModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = deleteSubnet(subnet.id);
                  if (!res.success) {
                    setDeleteSubnetError(res.message);
                    return;
                  }
                  setIsDeleteSubnetModalOpen(false);
                  onBack();
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-colors cursor-pointer"
              >
                Delete Subnet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBNET SCANNER MODAL */}
      <SubnetScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        subnet={subnet}
        onImportSuccess={(count) => {
          setFeedbackToast({
            message: `Discovery Complete: Successfully imported and synchronized ${count} IP endpoints.`,
            type: 'success',
          });
        }}
      />

      {/* SUBNET BULK IMPORT MODAL */}
      <SubnetBulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        subnet={subnet}
        onImportSuccess={(count) => {
          setFeedbackToast({
            message: `Bulk Import Complete: Successfully imported ${count} IP records into ${subnet.name}.`,
            type: 'success',
          });
        }}
      />
    </div>
  );
};
