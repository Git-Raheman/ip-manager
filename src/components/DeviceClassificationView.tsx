import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Layers,
  Server,
  Router,
  Network,
  Shield,
  Laptop,
  Cpu,
  HardDrive,
  Wifi,
  Database,
  Terminal,
  Smartphone,
  Tablet,
  Radio,
  Printer,
  Box,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Copy,
  AlertCircle,
  Activity,
  Tag,
  Building2,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  Lock,
  Zap,
  Settings,
  Play,
  Pause,
  RefreshCw,
  Sliders,
  Check,
  X,
  Gauge,
  Sparkles,
  Info,
  ExternalLink,
  Link,
  Unlink,
  ChevronRight,
  UserCheck,
  FolderOpen,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';
import { useIPAM } from '../context/IPAMContext';
import { DeviceClassification, IPRecord, IPStatus, DeviceType, SnmpMonitoringConfig } from '../types';
import { INITIAL_SNMP_CONFIG as DEFAULT_SNMP_CONFIG } from '../data/initialData';
import { isValidIPv4, formatMAC, isValidMAC, isIpInSubnet, parseCIDR } from '../utils/ipUtils';
import {
  AVAILABLE_ICONS,
  ICON_CATEGORIES,
  IconCategory,
  renderDeviceIcon as renderUnifiedDeviceIcon,
  getDeviceIconComponent,
} from '../utils/deviceIcons';

function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

const CATEGORIES = [
  'Compute & Servers',
  'Network Infrastructure',
  'Security & Perimeter',
  'Storage & Backup',
  'End-User Devices',
  'IoT & Telemetry',
  'Custom Appliance',
];

import { AVAILABLE_COLORS, getColorTheme, ClassificationColorTheme } from '../utils/deviceColors';

export { AVAILABLE_ICONS, AVAILABLE_COLORS, getColorTheme };

export function matchClassification(
  deviceType: string | undefined,
  classifications: DeviceClassification[]
): DeviceClassification | undefined {
  if (!deviceType) return undefined;
  const lower = deviceType.toLowerCase().trim();
  return classifications.find(
    (dc) => dc.code.toLowerCase() === lower || dc.name.toLowerCase() === lower || dc.id === lower
  );
}

export const DeviceClassificationView: React.FC = () => {
  const {
    deviceClassifications,
    createDeviceClassification,
    updateDeviceClassification,
    deleteDeviceClassification,
    currentUser,
    ips,
    subnets,
    setActiveTab,
    setSelectedSubnetId,
    logAudit,
    allocateIP,
    updateIP,
    releaseIP,
    pingIP,
    batchPingIPs,
    hasPermission,
    snmpConfig,
    updateSnmpConfig,
    triggerServerSnmpProbe,
  } = useIPAM();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'ips' | 'category'>('name');

  // SNMP Monitoring & Telemetry UI State
  const [countdown, setCountdown] = useState<number>(snmpConfig.intervalSeconds);
  const [isPolling, setIsPolling] = useState(false);
  const [isSnmpSettingsModalOpen, setIsSnmpSettingsModalOpen] = useState(false);
  const [tempConfig, setTempConfig] = useState<SnmpMonitoringConfig>({ ...snmpConfig });
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Keep countdown in sync when server reports a probe completion or interval changes
  useEffect(() => {
    setCountdown(snmpConfig.intervalSeconds);
  }, [snmpConfig.lastPolledAt, snmpConfig.intervalSeconds]);

  // Smooth live countdown ticker effect for UI
  useEffect(() => {
    if (!snmpConfig.enabled) {
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? snmpConfig.intervalSeconds : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [snmpConfig.enabled, snmpConfig.intervalSeconds]);

  // Modal states for Create/Edit/Delete Classification
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClassification, setEditingClassification] = useState<DeviceClassification | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [iconSearchQuery, setIconSearchQuery] = useState('');
  const [selectedIconCategory, setSelectedIconCategory] = useState<IconCategory>('All');

  const filteredModalIcons = useMemo(() => {
    let list = AVAILABLE_ICONS;
    if (selectedIconCategory !== 'All') {
      list = list.filter((i) => i.category === selectedIconCategory);
    }
    if (iconSearchQuery.trim()) {
      const q = iconSearchQuery.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.id.toLowerCase().includes(q) ||
          i.label.toLowerCase().includes(q) ||
          i.keywords.some((k) => k.toLowerCase().includes(q))
      );
    }
    return list;
  }, [iconSearchQuery, selectedIconCategory]);

  // Modal states for Assigned IPs inspection & Quick Assignment
  const [assignedIpsModalClassification, setAssignedIpsModalClassification] = useState<DeviceClassification | null>(null);
  const [assignedIpSearch, setAssignedIpSearch] = useState('');
  const [assignedIpSubnetFilter, setAssignedIpSubnetFilter] = useState('all');
  const [pingingIpId, setPingingIpId] = useState<string | null>(null);
  const [isProbingCategory, setIsProbingCategory] = useState(false);

  // Quick Assign / Allocate Modal State
  const [quickAssignModalClassification, setQuickAssignModalClassification] = useState<DeviceClassification | null>(null);
  const [assignMode, setAssignMode] = useState<'existing' | 'new'>('existing');
  const [selectedSubnetForAssign, setSelectedSubnetForAssign] = useState<string>('');
  const [selectedExistingIpId, setSelectedExistingIpId] = useState<string>('');
  const [existingIpFilterSearch, setExistingIpFilterSearch] = useState('');
  
  // Allocate New IP Form inside Classification
  const [newIpForm, setNewIpForm] = useState<{
    ip: string;
    hostname: string;
    macAddress: string;
    status: IPStatus;
    owner: string;
    department: string;
    notes: string;
  }>({
    ip: '',
    hostname: '',
    macAddress: '',
    status: 'allocated',
    owner: '',
    department: '',
    notes: '',
  });
  const [quickAssignError, setQuickAssignError] = useState<string | null>(null);

  // Classification Edit Form states
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: 'Compute & Servers',
    description: '',
    icon: 'server',
    color: 'blue',
    vendor: '',
    defaultPorts: '',
    snmpEnabled: true,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const canManage =
    currentUser?.role === 'super_admin' ||
    currentUser?.role === 'network_admin' ||
    hasPermission('manageDeviceClassifications');

  // Compute IP count, first subnet, and assigned IPs per device classification in a single linear pass
  const { ipCountsByCode, firstSubnetByCode, ipsByClassificationCode } = useMemo(() => {
    const counts: Record<string, number> = {};
    const firstSubnet: Record<string, string> = {};
    const ipsByCode: Record<string, IPRecord[]> = {};

    for (let i = 0; i < deviceClassifications.length; i++) {
      const code = deviceClassifications[i].code;
      counts[code] = 0;
      ipsByCode[code] = [];
    }

    for (let i = 0; i < ips.length; i++) {
      const ip = ips[i];
      if (ip.deviceType) {
        const matched = matchClassification(ip.deviceType, deviceClassifications);
        if (matched) {
          counts[matched.code] = (counts[matched.code] || 0) + 1;
          if (!ipsByCode[matched.code]) ipsByCode[matched.code] = [];
          ipsByCode[matched.code].push(ip);
          if (!firstSubnet[matched.code]) {
            firstSubnet[matched.code] = ip.subnetId;
          }
        } else {
          const key = ip.deviceType.toLowerCase();
          counts[key] = (counts[key] || 0) + 1;
          if (!ipsByCode[key]) ipsByCode[key] = [];
          ipsByCode[key].push(ip);
        }
      }
    }
    return { ipCountsByCode: counts, firstSubnetByCode: firstSubnet, ipsByClassificationCode: ipsByCode };
  }, [ips, deviceClassifications]);

  // Filtered & sorted classifications
  const filteredClassifications = useMemo(() => {
    return deviceClassifications
      .filter((dc) => {
        const matchesCategory = selectedCategory === 'all' || dc.category === selectedCategory;
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          !searchTerm ||
          dc.name.toLowerCase().includes(term) ||
          dc.code.toLowerCase().includes(term) ||
          dc.category.toLowerCase().includes(term) ||
          (dc.vendor && dc.vendor.toLowerCase().includes(term)) ||
          (dc.description && dc.description.toLowerCase().includes(term)) ||
          (dc.defaultPorts && dc.defaultPorts.toLowerCase().includes(term));
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'ips') {
          return (ipCountsByCode[b.code] || 0) - (ipCountsByCode[a.code] || 0);
        }
        if (sortBy === 'category') {
          return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
      });
  }, [deviceClassifications, selectedCategory, searchTerm, sortBy, ipCountsByCode]);

  const openCreateModal = () => {
    setEditingClassification(null);
    setFormData({
      name: '',
      code: '',
      category: 'Compute & Servers',
      description: '',
      icon: 'server',
      color: 'blue',
      vendor: '',
      defaultPorts: '',
      snmpEnabled: true,
    });
    setFormError(null);
    setIconSearchQuery('');
    setSelectedIconCategory('All');
    setModalOpen(true);
  };

  const openEditModal = (dc: DeviceClassification) => {
    setEditingClassification(dc);
    setFormData({
      name: dc.name,
      code: dc.code,
      category: dc.category,
      description: dc.description || '',
      icon: dc.icon || 'server',
      color: dc.color || 'blue',
      vendor: dc.vendor || '',
      defaultPorts: dc.defaultPorts || '',
      snmpEnabled: dc.snmpEnabled ?? true,
    });
    setFormError(null);
    setIconSearchQuery('');
    setSelectedIconCategory('All');
    setModalOpen(true);
  };

  const handleDuplicate = (dc: DeviceClassification) => {
    if (!canManage) return;
    const baseCode = `${dc.code}_copy`;
    let uniqueCode = baseCode;
    let counter = 1;
    while (deviceClassifications.some((d) => d.code === uniqueCode)) {
      uniqueCode = `${baseCode}${counter++}`;
    }

    createDeviceClassification({
      name: `${dc.name} (Copy)`,
      code: uniqueCode,
      category: dc.category,
      description: dc.description,
      icon: dc.icon,
      color: dc.color,
      vendor: dc.vendor,
      defaultPorts: dc.defaultPorts,
      snmpEnabled: dc.snmpEnabled,
    });
    showToast(`Classification '${dc.name}' duplicated as '${uniqueCode}'`, 'success');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Classification name is required.');
      return;
    }

    const cleanCode = (formData.code || formData.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')).trim().toLowerCase();
    if (!cleanCode) {
      setFormError('Unique classification code identifier is required.');
      return;
    }

    if (editingClassification) {
      const result = updateDeviceClassification(editingClassification.id, {
        name: formData.name.trim(),
        code: cleanCode,
        category: formData.category,
        description: formData.description.trim(),
        icon: formData.icon,
        color: formData.color,
        vendor: formData.vendor.trim(),
        defaultPorts: formData.defaultPorts.trim(),
        snmpEnabled: formData.snmpEnabled,
      });

      if (!result.success) {
        setFormError(result.message);
        return;
      }
      showToast(`Updated classification '${formData.name}' successfully.`, 'success');
    } else {
      const result = createDeviceClassification({
        name: formData.name.trim(),
        code: cleanCode,
        category: formData.category,
        description: formData.description.trim(),
        icon: formData.icon,
        color: formData.color,
        vendor: formData.vendor.trim(),
        defaultPorts: formData.defaultPorts.trim(),
        snmpEnabled: formData.snmpEnabled,
      });

      if (!result.success) {
        setFormError(result.message);
        return;
      }
      showToast(`Created classification '${formData.name}' (${cleanCode}) successfully.`, 'success');
    }

    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteDeviceClassification(id);
    setDeleteConfirmId(null);
    showToast('Classification removed successfully.', 'info');
  };

  const renderIcon = (iconName: string, className = 'w-5 h-5') => {
    return renderUnifiedDeviceIcon(iconName, className);
  };

  const targetDeleteClassification = deviceClassifications.find((dc) => dc.id === deleteConfirmId);
  const deleteAffectedIpCount = targetDeleteClassification ? (ipCountsByCode[targetDeleteClassification.code] || 0) : 0;

  // Monitored profiles & IP calculation
  const monitoredProfiles = useMemo(() => {
    return deviceClassifications.filter((d) => d.snmpEnabled);
  }, [deviceClassifications]);

  const monitoredProfilesCount = monitoredProfiles.length;

  const monitoredIpCount = useMemo(() => {
    let count = 0;
    for (const p of monitoredProfiles) {
      count += ipCountsByCode[p.code] || 0;
    }
    return count;
  }, [monitoredProfiles, ipCountsByCode]);

  const canAllocateOrEditIP =
    currentUser?.role === 'super_admin' ||
    hasPermission('allocateIP') ||
    hasPermission('editIP');

  // Accessible subnets respect user's allowedSubnetIds
  const accessibleSubnets = useMemo(() => {
    return subnets.filter((sub) => {
      if (!currentUser) return true;
      if (currentUser.role === 'super_admin') return true;
      const allowed = currentUser.permissions?.allowedSubnetIds;
      if (!allowed || allowed.length === 0) return true;
      return allowed.includes(sub.id);
    });
  }, [subnets, currentUser]);

  // Toggle SNMP Engine ON / OFF
  const toggleSnmpMonitoring = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!canManage) {
      showToast('Permission denied: Administrator rights required to toggle SNMP telemetry polling.', 'error');
      return;
    }
    const nextState = !snmpConfig.enabled;
    const res = await updateSnmpConfig({ enabled: nextState });
    if (nextState) {
      setCountdown(res.config.intervalSeconds);
      showToast(`SNMP Telemetry Polling Started (Every ${formatInterval(res.config.intervalSeconds)})`, 'success');
      logAudit(
        'Started SNMP telemetry monitoring polling',
        'system',
        'SNMP Engine',
        `Interval: ${formatInterval(res.config.intervalSeconds)}`
      );
    } else {
      showToast('SNMP Telemetry Polling Paused', 'info');
      logAudit('Paused SNMP telemetry monitoring polling', 'system', 'SNMP Engine', 'User paused telemetry');
    }
  };

  // Instant Manual Probe (Triggers immediate probe on the Server)
  const handleInstantPoll = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!canManage) {
      showToast('Permission denied: Administrator rights required to execute telemetry probe.', 'error');
      return;
    }
    if (isPolling) return;
    setIsPolling(true);
    try {
      const res = await triggerServerSnmpProbe();
      if (res.success) {
        showToast('Server executed telemetry probe cycle', 'success');
      } else {
        showToast('Probe completed with warnings', 'info');
      }
    } catch (err: any) {
      showToast('Telemetry probe error: ' + (err.message || 'Probe failed'), 'error');
    } finally {
      setIsPolling(false);
    }
  };

  const openSnmpSettingsModal = () => {
    if (!canManage) {
      showToast('Permission denied: Administrator rights required to modify SNMP telemetry settings.', 'error');
      return;
    }
    setTempConfig({ ...snmpConfig });
    setIsSnmpSettingsModalOpen(true);
  };

  const saveSnmpSettings = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canManage) {
      showToast('Permission denied: Administrator rights required to save SNMP configuration.', 'error');
      return;
    }
    const res = await updateSnmpConfig({ ...tempConfig });
    setCountdown(res.config.intervalSeconds);
    setIsSnmpSettingsModalOpen(false);
    showToast(
      `SNMP Configuration Saved! Background server polling running every ${formatInterval(res.config.intervalSeconds)}.`,
      'success'
    );
    logAudit(
      'Updated SNMP monitoring settings',
      'system',
      'SNMP Engine',
      `Enabled: ${tempConfig.enabled}, Interval: ${formatInterval(tempConfig.intervalSeconds)}, Version: ${tempConfig.snmpVersion}`
    );
  };

  // Open Quick Assign Modal for a specific classification
  const openQuickAssignModal = (dc: DeviceClassification) => {
    setQuickAssignModalClassification(dc);
    setSelectedSubnetForAssign(accessibleSubnets[0]?.id || '');
    setSelectedExistingIpId('');
    setExistingIpFilterSearch('');
    setQuickAssignError(null);
    setNewIpForm({
      ip: '',
      hostname: '',
      macAddress: '',
      status: 'allocated',
      owner: currentUser?.fullName || '',
      department: currentUser?.department || '',
      notes: '',
    });
  };

  // Helper to suggest next free IP in a chosen subnet
  const suggestNextFreeIp = (subnetId: string) => {
    const targetSubnet = subnets.find((s) => s.id === subnetId);
    if (!targetSubnet) return;
    const cidrInfo = parseCIDR(targetSubnet.cidr);
    if (!cidrInfo) return;

    const existingSet = new Set(ips.filter((i) => i.subnetId === subnetId).map((i) => i.ip));
    existingSet.add(targetSubnet.gateway);
    existingSet.add(cidrInfo.networkAddress);
    existingSet.add(cidrInfo.broadcastAddress);

    const parts = cidrInfo.networkAddress.split('.').map(Number);
    // Try simple linear probe in /24 or range
    for (let host = 1; host < 254; host++) {
      const candidate = `${parts[0]}.${parts[1]}.${parts[2]}.${host}`;
      if (!existingSet.has(candidate)) {
        setNewIpForm((prev) => ({ ...prev, ip: candidate }));
        return;
      }
    }
  };

  // Handle Quick Assign Existing IP
  const handleAssignExistingIp = (e: React.FormEvent) => {
    e.preventDefault();
    setQuickAssignError(null);
    if (!quickAssignModalClassification) return;

    if (!selectedExistingIpId) {
      setQuickAssignError('Please select an IP record from the list to assign.');
      return;
    }

    const targetIpRecord = ips.find((i) => i.id === selectedExistingIpId);
    if (!targetIpRecord) {
      setQuickAssignError('Selected IP record could not be found.');
      return;
    }

    const res = updateIP(targetIpRecord.id, {
      deviceType: quickAssignModalClassification.code,
    });

    if (!res.success) {
      setQuickAssignError(res.message);
      return;
    }

    showToast(
      `Assigned ${targetIpRecord.ip} (${targetIpRecord.hostname || 'No Host'}) to ${quickAssignModalClassification.name}!`,
      'success'
    );
    setQuickAssignModalClassification(null);
  };

  // Handle Quick Allocate New IP with this Classification
  const handleAllocateNewIpForClassification = (e: React.FormEvent) => {
    e.preventDefault();
    setQuickAssignError(null);
    if (!quickAssignModalClassification) return;

    const targetSubnet = subnets.find((s) => s.id === selectedSubnetForAssign);
    if (!targetSubnet) {
      setQuickAssignError('Please select a valid subnet.');
      return;
    }

    if (!isValidIPv4(newIpForm.ip)) {
      setQuickAssignError('Invalid IPv4 address format.');
      return;
    }

    if (!isIpInSubnet(newIpForm.ip, targetSubnet.cidr)) {
      setQuickAssignError(`IP ${newIpForm.ip} does not belong to subnet range ${targetSubnet.cidr}`);
      return;
    }

    if (newIpForm.macAddress && !isValidMAC(newIpForm.macAddress)) {
      setQuickAssignError('Invalid MAC address format (XX:XX:XX:XX:XX:XX).');
      return;
    }

    const res = allocateIP({
      subnetId: targetSubnet.id,
      ip: newIpForm.ip.trim(),
      hostname: newIpForm.hostname.trim(),
      macAddress: newIpForm.macAddress.trim(),
      status: newIpForm.status,
      deviceType: quickAssignModalClassification.code,
      owner: newIpForm.owner.trim(),
      department: newIpForm.department.trim(),
      notes: newIpForm.notes.trim(),
    });

    if (!res.success) {
      setQuickAssignError(res.message);
      return;
    }

    showToast(
      `Allocated & Assigned ${newIpForm.ip} to ${quickAssignModalClassification.name} successfully!`,
      'success'
    );
    setQuickAssignModalClassification(null);
  };

  // Handle Unassigning an IP from a Classification
  const handleUnassignIp = (ipRecord: IPRecord) => {
    const res = updateIP(ipRecord.id, { deviceType: 'other' });
    if (res.success) {
      showToast(`Removed classification from IP ${ipRecord.ip}`, 'info');
    }
  };

  // Handle Reassigning IP to a different Classification
  const handleReassignIp = (ipRecord: IPRecord, newClassificationCode: string) => {
    const res = updateIP(ipRecord.id, { deviceType: newClassificationCode });
    if (res.success) {
      const targetDc = deviceClassifications.find((d) => d.code === newClassificationCode);
      showToast(`Reassigned IP ${ipRecord.ip} to ${targetDc?.name || newClassificationCode}`, 'success');
    }
  };

  // Filtered assigned IPs for the Assigned IPs modal
  const assignedIpsList = useMemo(() => {
    if (!assignedIpsModalClassification) return [];
    const rawList = ipsByClassificationCode[assignedIpsModalClassification.code] || [];
    const q = assignedIpSearch.toLowerCase().trim();

    return rawList.filter((ip) => {
      const matchSubnet = assignedIpSubnetFilter === 'all' || ip.subnetId === assignedIpSubnetFilter;
      const sub = subnets.find((s) => s.id === ip.subnetId);
      const matchSearch =
        !q ||
        ip.ip.includes(q) ||
        (ip.hostname && ip.hostname.toLowerCase().includes(q)) ||
        (ip.macAddress && ip.macAddress.toLowerCase().includes(q)) ||
        (ip.owner && ip.owner.toLowerCase().includes(q)) ||
        (ip.notes && ip.notes.toLowerCase().includes(q)) ||
        (sub && sub.name.toLowerCase().includes(q)) ||
        (sub && sub.cidr.includes(q));

      return matchSubnet && matchSearch;
    });
  }, [assignedIpsModalClassification, ipsByClassificationCode, assignedIpSearch, assignedIpSubnetFilter, subnets]);

  // Available existing IPs in selected subnet for Quick Assign
  const availableIpsInSubnet = useMemo(() => {
    if (!selectedSubnetForAssign) return [];
    const list = ips.filter((i) => i.subnetId === selectedSubnetForAssign);
    const q = existingIpFilterSearch.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (i) =>
        i.ip.includes(q) ||
        (i.hostname && i.hostname.toLowerCase().includes(q)) ||
        (i.owner && i.owner.toLowerCase().includes(q)) ||
        (i.deviceType && i.deviceType.toLowerCase().includes(q))
    );
  }, [ips, selectedSubnetForAssign, existingIpFilterSearch]);

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-600/20 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Device Classifications &amp; Hardware Typology</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Define network equipment models, server archetypes, perimeter firewalls, and custom device categories mapped to IP records.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canManage ? (
            <button
              id="btn-create-device-classification"
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Device Classification</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
              <Lock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>Read-Only (Requires Admin Privileges)</span>
            </div>
          )}
        </div>
      </div>

      {/* METRICS OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
              <span>Total Classifications</span>
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {deviceClassifications.length}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Configured hardware profiles</p>
        </div>

        <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
              <span>Assigned IP Endpoints</span>
              <Network className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {Object.values(ipCountsByCode).reduce((acc: number, v: number) => acc + v, 0).toLocaleString()}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Active classified IP records</p>
        </div>

        <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
              <span>Functional Categories</span>
              <Tag className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {new Set(deviceClassifications.map((d) => d.category)).size}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Network taxonomy groups</p>
        </div>

        {/* 4TH CARD: INTERACTIVE SNMP MONITORING & TELEMETRY CONTROLS */}
        <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700/80 transition-all flex flex-col justify-between relative overflow-hidden group">
          {/* Card Top: Title, Quick Settings & Master ON/OFF Switch */}
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-800 dark:text-slate-200">SNMP Monitored</span>
              {canManage ? (
                <button
                  type="button"
                  onClick={openSnmpSettingsModal}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                  title="Configure custom polling time & SNMP options"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              ) : (
                <span title="Settings locked: Admin rights required">
                  <Lock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                </span>
              )}
            </div>

            {/* Functional ON / OFF Toggle Switch */}
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                  snmpConfig.enabled
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-400 dark:border-emerald-800/80'
                    : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                }`}
              >
                {snmpConfig.enabled ? 'ON' : 'OFF'}
              </span>
              <button
                type="button"
                role="switch"
                disabled={!canManage}
                aria-checked={snmpConfig.enabled}
                onClick={toggleSnmpMonitoring}
                title={canManage ? (snmpConfig.enabled ? 'Click to Pause Monitoring' : 'Click to Turn ON Monitoring') : 'Requires Administrator Rights'}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  !canManage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                } ${
                  snmpConfig.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    snmpConfig.enabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Card Middle: Status, Monitored Profiles & Realtime Countdown */}
          <div className="space-y-1.5 mt-0.5">
            <div className="flex items-baseline justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    snmpConfig.enabled ? (isPolling ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse') : 'bg-slate-400 dark:bg-slate-600'
                  }`}
                />
                <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {monitoredProfilesCount}{' '}
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                    / {deviceClassifications.length} Profiles
                  </span>
                </span>
              </div>
              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                {monitoredIpCount.toLocaleString()} Endpoints
              </span>
            </div>

            {/* Live Polling Info & Countdown Bar */}
            <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 rounded-lg p-2 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <Clock className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
                <span>Interval: <strong className="text-slate-900 dark:text-white">{formatInterval(snmpConfig.intervalSeconds)}</strong></span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                {snmpConfig.enabled ? (
                  isPolling ? (
                    <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Probing...
                    </span>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">
                      Next: <strong className="text-blue-600 dark:text-blue-400">{countdown}s</strong>
                    </span>
                  )
                ) : (
                  <span className="text-slate-500 font-sans">Engine Paused</span>
                )}
              </div>
            </div>
          </div>

          {/* Card Bottom: Quick Actions (Instant Poll & Config) */}
          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <button
              type="button"
              onClick={handleInstantPoll}
              disabled={!canManage || isPolling}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/80 hover:bg-blue-100 dark:hover:bg-blue-900/80 text-blue-700 dark:text-blue-200 text-[11px] font-semibold border border-blue-200 dark:border-blue-800 transition-colors disabled:opacity-40 ${
                !canManage ? 'cursor-not-allowed' : 'cursor-pointer'
              }`}
              title={canManage ? "Execute an immediate telemetry probe cycle across all monitored devices" : "Requires Administrator Rights"}
            >
              <RefreshCw className={`w-3 h-3 ${isPolling ? 'animate-spin' : ''}`} />
              <span>{isPolling ? 'Probing...' : 'Probe Now'}</span>
            </button>

            {canManage ? (
              <button
                type="button"
                onClick={openSnmpSettingsModal}
                className="py-1 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                title="Set custom time interval & SNMP options"
              >
                <Sliders className="w-3 h-3" />
                <span>Settings</span>
              </button>
            ) : (
              <div className="flex items-center gap-1 text-[10px] text-slate-500 py-1 px-1.5 font-mono">
                <Lock className="w-3 h-3 text-amber-500/80" />
                <span>Locked</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTER CONTROLS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search classification name, code, vendor, category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>Category:</span>
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Categories ({deviceClassifications.length})</option>
            {CATEGORIES.map((cat) => {
              const count = deviceClassifications.filter((d) => d.category === cat).length;
              return (
                <option key={cat} value={cat}>
                  {cat} ({count})
                </option>
              );
            })}
          </select>

          {/* Sort By */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 shrink-0 ml-2">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Sort:</span>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
          >
            <option value="name">Name (A-Z)</option>
            <option value="ips">Assigned IPs (High to Low)</option>
            <option value="category">Category</option>
          </select>
        </div>
      </div>

      {/* CLASSIFICATION CARDS GRID */}
      {filteredClassifications.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No device classifications found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm || selectedCategory !== 'all'
              ? 'No classifications match the selected filters. Try clearing your search parameters.'
              : 'Get started by creating your first device classification.'}
          </p>
          {canManage && (
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              Create Classification
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredClassifications.map((dc) => {
            const theme = getColorTheme(dc.color);
            const assignedCount = ipCountsByCode[dc.code] || 0;

            return (
              <div
                key={dc.id}
                id={`card-classification-${dc.code}`}
                className="group relative bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Icon, Name, Category & Actions */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl ${theme.bg} ${theme.text} border ${theme.border} flex items-center justify-center shrink-0`}>
                        {renderIcon(dc.icon, 'w-5 h-5')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {dc.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 font-mono">
                            {dc.code}
                          </code>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${theme.badge}`}>
                            {dc.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    {canManage && (
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleDuplicate(dc)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Duplicate Classification"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(dc)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Edit Classification"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(dc.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Delete Classification"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {dc.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-3.5 line-clamp-2 leading-relaxed">
                      {dc.description}
                    </p>
                  )}

                  {/* Spec metadata pills */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2 text-xs">
                    {dc.vendor && (
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5 text-[11px]">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                          <span>Vendor / OEM:</span>
                        </span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium text-[11px] truncate max-w-[180px]">
                          {dc.vendor}
                        </span>
                      </div>
                    )}

                    {dc.defaultPorts && (
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5 text-[11px]">
                          <Terminal className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                          <span>Default Ports:</span>
                        </span>
                        <span className="text-slate-700 dark:text-slate-300 font-mono text-[11px] truncate max-w-[180px]">
                          {dc.defaultPorts}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1.5 text-[11px]">
                        <Activity className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        <span>SNMP Polling:</span>
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                          dc.snmpEnabled
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/50'
                            : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}
                      >
                        {dc.snmpEnabled ? 'Active Telemetry' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: IP Allocation count, Manage IPs & Quick Assign */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setAssignedIpsModalClassification(dc)}
                      className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer text-left"
                      title="Click to view and manage assigned IP addresses"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                      <span className="text-xs text-slate-800 dark:text-slate-200 font-semibold hover:text-blue-600 dark:hover:text-blue-400">
                        {assignedCount} {assignedCount === 1 ? 'Assigned IP' : 'Assigned IPs'}
                      </span>
                    </button>

                    {canAllocateOrEditIP ? (
                      <button
                        type="button"
                        onClick={() => openQuickAssignModal(dc)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/80 hover:bg-blue-100 dark:hover:bg-blue-900/80 text-blue-700 dark:text-blue-200 hover:text-blue-800 dark:hover:text-white text-[11px] font-semibold border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                        title="Assign an existing or new IP to this classification"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Assign IP</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                        <Lock className="w-2.5 h-2.5 text-slate-400 dark:text-slate-600" />
                        <span>Read Only</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                    <button
                      type="button"
                      onClick={() => setAssignedIpsModalClassification(dc)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <FolderOpen className="w-3 h-3" />
                      <span>Manage Assigned IPs</span>
                    </button>

                    {assignedCount > 0 && (
                      <button
                        onClick={() => {
                          const targetSubnetId = firstSubnetByCode[dc.code];
                          if (targetSubnetId) {
                            setSelectedSubnetId(targetSubnetId);
                            setActiveTab('subnets');
                          }
                        }}
                        className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>Subnet View</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ASSIGNED IPS INSPECTION & MANAGEMENT MODAL */}
      {assignedIpsModalClassification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
          <div className="relative bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-[#121212]">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl ${getColorTheme(assignedIpsModalClassification.color).bg} ${
                    getColorTheme(assignedIpsModalClassification.color).text
                  } border ${getColorTheme(assignedIpsModalClassification.color).border} flex items-center justify-center`}
                >
                  {renderIcon(assignedIpsModalClassification.icon, 'w-5 h-5')}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      Assigned IP Endpoints: {assignedIpsModalClassification.name}
                    </h3>
                    <code className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 font-mono">
                      {assignedIpsModalClassification.code}
                    </code>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Viewing all IP records classified under {assignedIpsModalClassification.name} ({assignedIpsList.length} endpoints matching)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isProbingCategory}
                  onClick={async () => {
                    if (!assignedIpsModalClassification) return;
                    const categoryIps = (ipsByClassificationCode[assignedIpsModalClassification.code] || []).map((i) => i.ip);
                    if (categoryIps.length === 0) {
                      showToast('No assigned IPs to probe in this category.', 'info');
                      return;
                    }
                    setIsProbingCategory(true);
                    try {
                      const res = await batchPingIPs(categoryIps);
                      showToast(
                        `Probed ${res.total} ${assignedIpsModalClassification.name} IP(s): ${res.online} Online, ${res.offline} Offline/Unreachable`,
                        res.online > 0 ? 'success' : 'info'
                      );
                    } finally {
                      setIsProbingCategory(false);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-600/20 hover:bg-emerald-100 dark:hover:bg-emerald-600/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200 dark:border-emerald-500/30 transition-colors cursor-pointer disabled:opacity-40"
                  title="Probe ping reachability for all IPs in this category"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isProbingCategory ? 'animate-spin' : ''}`} />
                  <span>{isProbingCategory ? 'Probing...' : 'Probe Category Health'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openQuickAssignModal(assignedIpsModalClassification)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-sm transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Assign IP</span>
                </button>
                <button
                  onClick={() => setAssignedIpsModalClassification(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="shrink-0 p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter IPs, hostnames, MACs, subnets..."
                  value={assignedIpSearch}
                  onChange={(e) => setAssignedIpSearch(e.target.value)}
                  className="w-full bg-white dark:bg-[#121212] border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <span className="text-xs text-slate-500 dark:text-slate-400">Subnet:</span>
                <select
                  value={assignedIpSubnetFilter}
                  onChange={(e) => setAssignedIpSubnetFilter(e.target.value)}
                  className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All Subnets</option>
                  {subnets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.cidr})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* IP Table */}
            <div className="flex-1 overflow-y-auto p-4">
              {assignedIpsList.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <Network className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">No IP records assigned to this classification</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                    {assignedIpSearch || assignedIpSubnetFilter !== 'all'
                      ? 'No assigned IPs match your filter criteria.'
                      : `No endpoints currently have the classification code '${assignedIpsModalClassification.code}'. You can assign an existing IP or allocate a new one below.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => openQuickAssignModal(assignedIpsModalClassification)}
                    className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Assign First IP Address</span>
                  </button>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-sm bg-white dark:bg-[#0c0c0c]">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 min-w-[980px]">
                    <thead className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold sticky top-0 z-10">
                      <tr>
                        <th className="py-3 px-4 min-w-[140px]">IP Address</th>
                        <th className="py-3 px-4 min-w-[160px]">Subnet Range</th>
                        <th className="py-3 px-4 min-w-[180px]">Hostname &amp; MAC</th>
                        <th className="py-3 px-4 min-w-[100px]">Status</th>
                        <th className="py-3 px-4 min-w-[120px]">Health Probe</th>
                        <th className="py-3 px-4 min-w-[140px]">Owner / Dept</th>
                        <th className="py-3 px-4 min-w-[170px] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {assignedIpsList.map((rec) => {
                        const targetSubnet = subnets.find((s) => s.id === rec.subnetId);

                        return (
                          <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            {/* IP */}
                            <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                              <div className="flex items-center gap-1.5">
                                <span>{rec.ip}</span>
                                {rec.ip === targetSubnet?.gateway && (
                                  <span className="text-[10px] px-1 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-sans font-medium">
                                    GW
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Subnet */}
                            <td className="py-3 px-4">
                              {targetSubnet ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAssignedIpsModalClassification(null);
                                    setSelectedSubnetId(targetSubnet.id);
                                    setActiveTab('subnets');
                                  }}
                                  className="text-left text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline flex flex-col cursor-pointer"
                                  title="Jump to Subnet View"
                                >
                                  <span className="font-medium text-slate-800 dark:text-slate-200">{targetSubnet.name}</span>
                                  <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">{targetSubnet.cidr}</span>
                                </button>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500">—</span>
                              )}
                            </td>

                            {/* Hostname & MAC */}
                            <td className="py-3 px-4">
                              <p className="font-medium text-slate-900 dark:text-slate-100">{rec.hostname || '—'}</p>
                              <p className="font-mono text-[10px] text-slate-400 dark:text-slate-500">{rec.macAddress || 'No MAC'}</p>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-4">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${
                                  rec.status === 'allocated'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                                    : rec.status === 'reserved'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                                    : rec.status === 'dhcp'
                                    ? 'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
                                }`}
                              >
                                {rec.status}
                              </span>
                            </td>

                            {/* Health */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    rec.lastPingStatus === 'online'
                                      ? 'bg-emerald-500 dark:bg-emerald-400'
                                      : rec.lastPingStatus === 'unreachable' || rec.lastPingStatus === 'offline'
                                      ? 'bg-rose-500 dark:bg-rose-400'
                                      : 'bg-amber-500 dark:bg-amber-400'
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
                                  type="button"
                                  disabled={pingingIpId === rec.id}
                                  onClick={async () => {
                                    setPingingIpId(rec.id);
                                    await pingIP(rec.id);
                                    setPingingIpId(null);
                                  }}
                                  title="Probe ping reachability"
                                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                                >
                                  <RefreshCw className={`w-3 h-3 ${pingingIpId === rec.id ? 'animate-spin text-blue-500 dark:text-blue-400' : ''}`} />
                                </button>
                              </div>
                            </td>

                            {/* Owner */}
                            <td className="py-3 px-4">
                              <p className="text-slate-800 dark:text-slate-200">{rec.owner || '—'}</p>
                              {rec.department && <p className="text-[10px] text-slate-500">{rec.department}</p>}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Reassign Select Dropdown */}
                                <select
                                  value={rec.deviceType}
                                  onChange={(e) => handleReassignIp(rec, e.target.value)}
                                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                                  title="Reassign to another classification"
                                >
                                  {deviceClassifications.map((d) => (
                                    <option key={d.id} value={d.code}>
                                      {d.name}
                                    </option>
                                  ))}
                                  <option value="other">Other / Unclassified</option>
                                </select>

                                {/* Unassign Button */}
                                <button
                                  type="button"
                                  onClick={() => handleUnassignIp(rec)}
                                  title="Unassign classification from this IP"
                                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-300 dark:bg-slate-800 dark:hover:bg-rose-950/60 dark:text-slate-400 dark:hover:text-rose-300 dark:border-slate-700 dark:hover:border-rose-800 transition-colors cursor-pointer"
                                >
                                  <Unlink className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Total classified endpoints: <strong className="text-slate-900 dark:text-white">{assignedIpsList.length}</strong>
              </span>
              <button
                type="button"
                onClick={() => setAssignedIpsModalClassification(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ASSIGN / ALLOCATE IP MODAL */}
      {quickAssignModalClassification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col my-8 text-slate-900 dark:text-slate-100">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-[#121212]">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl ${getColorTheme(quickAssignModalClassification.color).bg} ${
                    getColorTheme(quickAssignModalClassification.color).text
                  } border ${getColorTheme(quickAssignModalClassification.color).border} flex items-center justify-center`}
                >
                  {renderIcon(quickAssignModalClassification.icon, 'w-5 h-5')}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Assign IP to: {quickAssignModalClassification.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Target classification code: <code className="font-mono text-blue-600 dark:text-blue-400 font-semibold">{quickAssignModalClassification.code}</code>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuickAssignModalClassification(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-1.5 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setAssignMode('existing');
                  setQuickAssignError(null);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  assignMode === 'existing'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <Link className="w-3.5 h-3.5" />
                <span>Assign Existing IP Record</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAssignMode('new');
                  setQuickAssignError(null);
                  if (selectedSubnetForAssign) {
                    suggestNextFreeIp(selectedSubnetForAssign);
                  }
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  assignMode === 'new'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Allocate New IP</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {quickAssignError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{quickAssignError}</span>
                </div>
              )}

              {/* Subnet Selector (Used in both modes) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Subnet <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <select
                  value={selectedSubnetForAssign}
                  onChange={(e) => {
                    setSelectedSubnetForAssign(e.target.value);
                    setSelectedExistingIpId('');
                    if (assignMode === 'new') {
                      suggestNextFreeIp(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  {subnets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.cidr} ({s.location})
                    </option>
                  ))}
                </select>
              </div>

              {assignMode === 'existing' ? (
                /* TAB 1: ASSIGN EXISTING IP */
                <form onSubmit={handleAssignExistingIp} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Select IP Record to Assign <span className="text-rose-500 dark:text-rose-400">*</span>
                      </label>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {availableIpsInSubnet.length} allocated in subnet
                      </span>
                    </div>

                    <div className="relative mb-2">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search IP, hostname, owner in this subnet..."
                        value={existingIpFilterSearch}
                        onChange={(e) => setExistingIpFilterSearch(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="max-h-52 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800/60 bg-slate-50 dark:bg-slate-950">
                      {availableIpsInSubnet.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">
                          No active IP records found in this subnet. Use &quot;Allocate New IP&quot; to create one.
                        </div>
                      ) : (
                        availableIpsInSubnet.map((ipRec) => {
                          const isSelected = selectedExistingIpId === ipRec.id;
                          const isAlreadyThisClass =
                            ipRec.deviceType?.toLowerCase() === quickAssignModalClassification.code.toLowerCase();

                          return (
                            <button
                              key={ipRec.id}
                              type="button"
                              onClick={() => setSelectedExistingIpId(ipRec.id)}
                              className={`w-full p-3 text-left transition-colors flex items-center justify-between cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-50 dark:bg-blue-600/20 border-l-4 border-blue-500'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-900'
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">{ipRec.ip}</span>
                                  {ipRec.hostname && (
                                    <span className="text-slate-700 dark:text-slate-300 text-xs font-medium">({ipRec.hostname})</span>
                                  )}
                                  {isAlreadyThisClass && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                                      Current
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  Type: <span className="font-mono text-slate-700 dark:text-slate-300">{ipRec.deviceType || 'other'}</span> • Status: <span className="capitalize">{ipRec.status}</span> • Owner: {ipRec.owner || '—'}
                                </div>
                              </div>

                              <div className="shrink-0 pl-2">
                                <div
                                  className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                    isSelected
                                      ? 'border-blue-500 bg-blue-600 text-white'
                                      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-transparent'
                                  }`}
                                >
                                  <Check className="w-3 h-3" />
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Submit button */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setQuickAssignModalClassification(null)}
                      className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!selectedExistingIpId}
                      className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>Assign to {quickAssignModalClassification.name}</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* TAB 2: ALLOCATE NEW IP */
                <form onSubmit={handleAllocateNewIpForClassification} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          IP Address <span className="text-rose-500 dark:text-rose-400">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => suggestNextFreeIp(selectedSubnetForAssign)}
                          className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Auto-Pick Next Free
                        </button>
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 192.168.10.50"
                        value={newIpForm.ip}
                        onChange={(e) => setNewIpForm({ ...newIpForm, ip: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Allocation Status
                      </label>
                      <select
                        value={newIpForm.status}
                        onChange={(e) => setNewIpForm({ ...newIpForm, status: e.target.value as IPStatus })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="allocated">Allocated (Active Device)</option>
                        <option value="reserved">Reserved (Static Plan)</option>
                        <option value="dhcp">DHCP Pool Range</option>
                        <option value="offline">Offline</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Hostname / FQDN
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. srv-core01.corp.internal"
                        value={newIpForm.hostname}
                        onChange={(e) => setNewIpForm({ ...newIpForm, hostname: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        MAC Address
                      </label>
                      <input
                        type="text"
                        placeholder="00:1A:2B:3C:4D:5E"
                        value={newIpForm.macAddress}
                        onChange={(e) => setNewIpForm({ ...newIpForm, macAddress: formatMAC(e.target.value) })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Owner / System Custodian
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Infrastructure Operations"
                        value={newIpForm.owner}
                        onChange={(e) => setNewIpForm({ ...newIpForm, owner: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Department / Unit
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Core Engineering"
                        value={newIpForm.department}
                        onChange={(e) => setNewIpForm({ ...newIpForm, department: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Notes &amp; Operational Details
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Additional metadata, rack position, switchport, etc."
                      value={newIpForm.notes}
                      onChange={(e) => setNewIpForm({ ...newIpForm, notes: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Submit button */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setQuickAssignModalClassification(null)}
                      className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Allocate &amp; Assign to {quickAssignModalClassification.name}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT CLASSIFICATION MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
          <div className="relative bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden">
            {/* Modal Header (Sticky) */}
            <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-[#121212]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-600/20 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                    {editingClassification ? `Edit Device Classification: ${editingClassification.name}` : 'Create New Device Classification'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {editingClassification
                      ? 'Update typology name, unique slug, hardware category, vendor mapping, and ports.'
                      : 'Define a new asset classification for network endpoints, physical hosts, or virtual machines.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close dialog"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col justify-between">
              <div className="px-6 py-5 space-y-5">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Row 1: Name and Code */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Classification Name <span className="text-rose-500 dark:text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Core Distribution Switch"
                      value={formData.name}
                      onChange={(e) => {
                        const newName = e.target.value;
                        if (!editingClassification && (!formData.code || formData.code === formData.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))) {
                          setFormData({
                            ...formData,
                            name: newName,
                            code: newName.toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
                          });
                        } else {
                          setFormData({ ...formData, name: newName });
                        }
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Unique Code Identifier <span className="text-rose-500 dark:text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. core_switch"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_') })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Internal slug used in IP records and API calls
                    </span>
                  </div>
                </div>

                {/* Row 2: Category and Vendor */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Hardware Category <span className="text-rose-500 dark:text-rose-400">*</span>
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Hardware Vendor / OEM
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Cisco Systems, Dell EMC, Palo Alto"
                      value={formData.vendor}
                      onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Row 3: Default Ports and SNMP */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Default Service Ports
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 22, 443, 8080, 161"
                      value={formData.defaultPorts}
                      onChange={(e) => setFormData({ ...formData, defaultPorts: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-6">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={formData.snmpEnabled}
                        onChange={(e) => setFormData({ ...formData, snmpEnabled: e.target.checked })}
                        className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Enable SNMP / Telemetry Monitoring</span>
                    </label>
                  </div>
                </div>

                {/* Row 4: Description */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Description &amp; Operational Role
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter details on the hardware role, placement topology, or standard operating specifications..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* Row 5: Icon Picker */}
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Visual Icon Representation
                    </label>
                    {/* Selected Icon Badge Preview */}
                    {(() => {
                      const selectedDef = AVAILABLE_ICONS.find((i) => i.id === formData.icon);
                      const colorTheme = getColorTheme(formData.color);
                      return (
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${colorTheme.bg} ${colorTheme.border} ${colorTheme.text}`}>
                          <span className="text-[10px] opacity-70 font-normal">Active:</span>
                          {renderIcon(formData.icon, 'w-3.5 h-3.5')}
                          <span className="font-semibold">{selectedDef?.label || formData.icon}</span>
                          <span className="text-[10px] opacity-70 font-mono">({formData.icon})</span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Icon Search & Filter Controls */}
                  <div className="space-y-2 mb-2.5">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search 45+ icons (e.g., cctv, camera, server, wifi, ups, phone, db)..."
                        value={iconSearchQuery}
                        onChange={(e) => setIconSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-8 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                      {iconSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setIconSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                      {ICON_CATEGORIES.map((cat) => {
                        const isCatActive = selectedIconCategory === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setSelectedIconCategory(cat)}
                            className={`px-2 py-1 rounded-lg text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
                              isCatActive
                                ? 'bg-blue-600 text-white font-medium shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Icon Grid */}
                  <div className="max-h-56 overflow-y-auto pr-1 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 p-2.5 scrollbar-thin">
                    {filteredModalIcons.length === 0 ? (
                      <div className="py-6 text-center text-slate-500 text-xs">
                        No icons match "{iconSearchQuery}". Try another keyword or category.
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
                        {filteredModalIcons.map((item) => {
                          const IconComponent = item.icon;
                          const isSelected = formData.icon === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setFormData({ ...formData, icon: item.id })}
                              className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all text-xs cursor-pointer group ${
                                isSelected
                                  ? 'bg-blue-50 dark:bg-blue-600/20 border-blue-500 text-blue-600 dark:text-blue-400 font-semibold shadow-sm ring-1 ring-blue-500/50'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:border-slate-300 dark:hover:border-slate-700'
                              }`}
                              title={`${item.label} (${item.category})`}
                            >
                              <IconComponent className={`w-4 h-4 transition-transform group-hover:scale-110 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-300'}`} />
                              <span className="text-[10px] truncate max-w-full text-center leading-tight">
                                {item.label.split('/')[0].trim()}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 px-1">
                    <span>Showing {filteredModalIcons.length} of {AVAILABLE_ICONS.length} available icons</span>
                    <span>Includes CCTV, cameras, servers, network, IoT &amp; more</span>
                  </div>
                </div>

                {/* Row 6: Color Theme Picker */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Color Accent Theme
                    </label>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {AVAILABLE_COLORS.length} Accessible Themes (Light &amp; Dark)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto pr-1 p-2 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 scrollbar-thin">
                    {AVAILABLE_COLORS.map((col) => {
                      const isSelected = formData.color === col.id;
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, color: col.id })}
                          className={`p-2 rounded-xl border flex items-center gap-2 transition-all text-xs cursor-pointer ${
                            isSelected
                              ? `${col.bg} ${col.border} ${col.text} font-bold ring-2 ring-blue-500/60 shadow-sm`
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded-full shrink-0 shadow-xs ${col.swatch}`} />
                          <span className="text-[11px] truncate capitalize">{col.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer (Sticky) */}
              <div className="shrink-0 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50 dark:bg-slate-900/95">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors border border-slate-300 dark:border-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors cursor-pointer"
                >
                  {editingClassification ? 'Save Changes' : 'Create Classification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && targetDeleteClassification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 border border-rose-500/20">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Delete Classification &quot;{targetDeleteClassification.name}&quot;?
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              Are you sure you want to permanently remove this device classification? This action cannot be undone.
            </p>

            {deleteAffectedIpCount > 0 && (
              <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  Notice: <strong>{deleteAffectedIpCount}</strong> active allocated IP(s) currently use this classification. They will be migrated to &quot;other&quot;.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(targetDeleteClassification.id)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-colors cursor-pointer"
              >
                Delete Classification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SNMP TELEMETRY & MONITORING SETTINGS MODAL */}
      {isSnmpSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col my-8 animate-in fade-in zoom-in duration-200 text-slate-900 dark:text-slate-100">
            {/* Modal Header */}
            <div className="shrink-0 px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-[#121212]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    SNMP Monitoring &amp; Telemetry Configurator
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Configure automated health polling, custom time intervals, and SNMP protocol options.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSnmpSettingsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={saveSnmpSettings} className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
              {/* Section 1: Power ON / OFF Switch */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Zap className={`w-4 h-4 ${tempConfig.enabled ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`} />
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">Automated SNMP Telemetry Polling</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tempConfig.enabled
                      ? 'Telemetry polling engine is actively probing classified endpoints.'
                      : 'Telemetry polling is currently paused. No automated probes will run.'}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      tempConfig.enabled
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800'
                        : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                    }`}
                  >
                    {tempConfig.enabled ? 'Active (ON)' : 'Paused (OFF)'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={tempConfig.enabled}
                    onClick={() => setTempConfig({ ...tempConfig, enabled: !tempConfig.enabled })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      tempConfig.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        tempConfig.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Section 2: Polling Interval Selection & Custom Time */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                    <span>Polling Frequency &amp; Custom Interval</span>
                  </label>
                  <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 px-2 py-0.5 rounded">
                    Active: {formatInterval(tempConfig.intervalSeconds)} ({tempConfig.intervalSeconds}s)
                  </span>
                </div>

                {/* Preset Buttons Grid */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '5s (Fastest)', seconds: 5, val: 5, unit: 'seconds' as const },
                    { label: '10s (Fast)', seconds: 10, val: 10, unit: 'seconds' as const },
                    { label: '30s (Default)', seconds: 30, val: 30, unit: 'seconds' as const },
                    { label: '1 min (60s)', seconds: 60, val: 1, unit: 'minutes' as const },
                    { label: '5 min (300s)', seconds: 300, val: 5, unit: 'minutes' as const },
                    { label: '15 min (900s)', seconds: 900, val: 15, unit: 'minutes' as const },
                  ].map((preset) => {
                    const isSelected = tempConfig.intervalSeconds === preset.seconds;
                    return (
                      <button
                        key={preset.seconds}
                        type="button"
                        onClick={() =>
                          setTempConfig({
                            ...tempConfig,
                            intervalSeconds: preset.seconds,
                            customValue: preset.val,
                            customUnit: preset.unit,
                          })
                        }
                        className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border text-center cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-600/20 border-blue-500 text-blue-600 dark:text-blue-300 font-bold ring-2 ring-blue-500/30'
                            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Time Input Box */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 font-medium">
                    <span>Set Custom Polling Interval:</span>
                    <span className="text-[11px] text-slate-500">Min 3s • Max 24h</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min={3}
                        max={86400}
                        value={tempConfig.customValue}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                          const mult =
                            tempConfig.customUnit === 'hours' ? 3600 : tempConfig.customUnit === 'minutes' ? 60 : 1;
                          setTempConfig({
                            ...tempConfig,
                            customValue: val,
                            intervalSeconds: Math.max(3, val * mult),
                          });
                        }}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500"
                        placeholder="e.g. 5"
                      />
                    </div>

                    <select
                      value={tempConfig.customUnit}
                      onChange={(e) => {
                        const unit = e.target.value as 'seconds' | 'minutes' | 'hours';
                        const mult = unit === 'hours' ? 3600 : unit === 'minutes' ? 60 : 1;
                        setTempConfig({
                          ...tempConfig,
                          customUnit: unit,
                          intervalSeconds: Math.max(5, tempConfig.customValue * mult),
                        });
                      }}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="seconds">Seconds (s)</option>
                      <option value="minutes">Minutes (m)</option>
                      <option value="hours">Hours (h)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>
                      Computed rate:{' '}
                      <strong className="text-slate-900 dark:text-white">
                        {Math.max(1, Math.round(3600 / tempConfig.intervalSeconds))} cycles/hour
                      </strong>
                    </span>
                    <span>
                      Frequency: <strong className="text-blue-600 dark:text-blue-400">{formatInterval(tempConfig.intervalSeconds)}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 3: Protocol Version & Community String */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SNMP Protocol Version
                  </label>
                  <select
                    value={tempConfig.snmpVersion}
                    onChange={(e) => setTempConfig({ ...tempConfig, snmpVersion: e.target.value as 'v2c' | 'v3' })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="v2c">SNMPv2c (Community-Based)</option>
                    <option value="v3">SNMPv3 (USM / AuthPriv Security)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Community String / Auth Context
                  </label>
                  <input
                    type="text"
                    value={tempConfig.communityString}
                    onChange={(e) => setTempConfig({ ...tempConfig, communityString: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    placeholder="public"
                  />
                </div>
              </div>

              {/* Section 4: Live Fleet Diagnostics & Test Probe */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <Gauge className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Fleet Health &amp; Telemetry Status</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleInstantPoll}
                    disabled={isPolling}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-[11px] font-semibold text-white shadow-sm transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isPolling ? 'animate-spin' : ''}`} />
                    <span>{isPolling ? 'Probing...' : 'Probe Fleet Now'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-medium">Monitored Profiles</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{monitoredProfilesCount}</div>
                  </div>
                  <div className="bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-medium">Monitored IPs</div>
                    <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{monitoredIpCount.toLocaleString()}</div>
                  </div>
                  <div className="bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-medium">Cycles Executed</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{snmpConfig.totalPollCycles}</div>
                  </div>
                  <div className="bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-medium">Avg Latency</div>
                    <div className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5">{snmpConfig.lastLatencyMs} ms</div>
                  </div>
                </div>

                {snmpConfig.lastPolledAt && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center font-mono">
                    Last probe executed at: <strong>{snmpConfig.lastPolledAt}</strong> (100% OK)
                  </p>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsSnmpSettingsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Save &amp; Apply Settings</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FLOATING ACTION TOAST BANNER */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div
            className={`px-4 py-3 rounded-2xl border shadow-xl flex items-center gap-3 text-xs max-w-md ${
              toastMessage.type === 'success'
                ? 'bg-slate-900/95 border-emerald-500/40 text-slate-100 shadow-emerald-950/40'
                : toastMessage.type === 'error'
                ? 'bg-slate-900/95 border-rose-500/40 text-slate-100 shadow-rose-950/40'
                : 'bg-slate-900/95 border-blue-500/40 text-slate-100 shadow-blue-950/40'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : toastMessage.type === 'error'
                  ? 'bg-rose-500/20 text-rose-400'
                  : 'bg-blue-500/20 text-blue-400'
              }`}
            >
              {toastMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : toastMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4" />
              ) : (
                <Info className="w-4 h-4" />
              )}
            </div>
            <p className="flex-1 font-medium leading-relaxed">{toastMessage.message}</p>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
