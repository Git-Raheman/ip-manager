import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FolderGit2,
  Server,
  Layers,
  Network,
  Shield,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Copy,
  AlertCircle,
  Tag,
  Building2,
  CheckCircle2,
  Clock,
  Lock,
  RefreshCw,
  Check,
  X,
  UserCheck,
  FolderOpen,
  ArrowRight,
  Boxes,
  Activity,
  Archive,
  FileText,
  Radio,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  Laptop,
} from 'lucide-react';
import { useIPAM } from '../context/IPAMContext';
import { Project, IPRecord, IPStatus, DeviceType } from '../types';
import { isValidIPv4, formatMAC, isValidMAC, isIpInSubnet, parseCIDR } from '../utils/ipUtils';
import { AVAILABLE_ICONS, renderDeviceIcon } from '../utils/deviceIcons';
import { AVAILABLE_COLORS, getColorTheme } from '../utils/deviceColors';

export interface DeviceCategoryOption {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

export const DEVICE_CATEGORIES: DeviceCategoryOption[] = [
  { id: 'server', name: 'Server & Compute', icon: 'server', color: 'blue', description: 'Rack servers, blade chassis, and hypervisors' },
  { id: 'vm', name: 'Virtual Machine (VM)', icon: 'boxes', color: 'indigo', description: 'Guest VMs, compute pods, and virtual workloads' },
  { id: 'switch', name: 'Switch & LAN', icon: 'switch', color: 'emerald', description: 'Access switches, distribution, and core switches' },
  { id: 'router', name: 'Router & Gateway', icon: 'router', color: 'cyan', description: 'Edge routers, WAN gateways, and BGP peers' },
  { id: 'firewall', name: 'Firewall & Security', icon: 'shield', color: 'rose', description: 'UTM firewalls, IDS/IPS, and VPN gateways' },
  { id: 'cctv', name: 'CCTV & Surveillance', icon: 'cctv', color: 'amber', description: 'IP cameras, NVRs, and physical security feeds' },
  { id: 'database', name: 'Database Cluster', icon: 'database', color: 'purple', description: 'SQL/NoSQL database nodes, primary & replicas' },
  { id: 'storage', name: 'Storage & NAS/SAN', icon: 'layers', color: 'violet', description: 'Network attached storage and SAN arrays' },
  { id: 'ap', name: 'Wireless Access Point', icon: 'activity', color: 'teal', description: 'Wi-Fi access points and wireless controllers' },
  { id: 'cloud', name: 'Cloud & DevOps', icon: 'cloud', color: 'sky', description: 'AWS, Azure, GCP instances and container pods' },
  { id: 'workstation', name: 'Workstation & Office', icon: 'laptop', color: 'slate', description: 'Desktop PCs, laptops, and administrative terminals' },
  { id: 'other', name: 'Custom / Other Devices', icon: 'folder', color: 'indigo', description: 'General workload container or mixed infrastructure' },
];

export const ProjectsView: React.FC = () => {
  const {
    projects,
    createProject,
    updateProject,
    deleteProject,
    assignIpToProject,
    removeIpFromProject,
    currentUser,
    ips,
    subnets,
    setActiveTab,
    setSelectedSubnetId,
    allocateIP,
    updateIP,
    pingIP,
    batchPingIPs,
    hasPermission,
    deviceClassifications,
    openedProjectId,
    setOpenedProjectId,
  } = useIPAM();

  // Search & Filter State on Main Projects page
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'archived'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'ips' | 'category' | 'date'>('name');

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Modals UI State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // OPENED PROJECT BOX (Drilldown with 2 Mini Boxes: 1. IPs, 2. Notes)
  const [openedProject, setOpenedProject] = useState<Project | null>(null);
  const [quickAddIpInput, setQuickAddIpInput] = useState('');
  const [quickAddLabelInput, setQuickAddLabelInput] = useState('');
  const [boxNotesInput, setBoxNotesInput] = useState('');
  const [isPingingAll, setIsPingingAll] = useState(false);
  const [pingingIpId, setPingingIpId] = useState<string | null>(null);
  const [ipFilterQuery, setIpFilterQuery] = useState('');
  const [notesSaveStatus, setNotesSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');

  // Project Edit/Create Form State
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: 'Server & Compute',
    description: '',
    notes: '',
    icon: 'server',
    color: 'blue',
    status: 'active' as 'active' | 'archived',
    owner: '',
    department: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const canManage = hasPermission('manageProjects');

  const canAllocateOrEditIP =
    hasPermission('allocateIP') ||
    hasPermission('editIP') ||
    hasPermission('manageProjects');

  // Sync opened project if openedProjectId or projects list changes
  useEffect(() => {
    if (openedProjectId) {
      const match = projects.find((p) => p.id === openedProjectId);
      if (match) {
        setOpenedProject((prev) => {
          if (!prev || prev.id !== match.id) {
            setBoxNotesInput(match.notes || '');
          }
          return match;
        });
      }
    } else {
      setOpenedProject(null);
    }
  }, [openedProjectId, projects]);

  // Compute IP counts and IP records mapped to projects
  const { ipCountsByProjectId, ipsByProjectId } = useMemo(() => {
    const counts: Record<string, number> = {};
    const ipsMap: Record<string, IPRecord[]> = {};

    for (let i = 0; i < projects.length; i++) {
      counts[projects[i].id] = 0;
      ipsMap[projects[i].id] = [];
    }

    for (let i = 0; i < ips.length; i++) {
      const ip = ips[i];
      if (ip.projectId) {
        counts[ip.projectId] = (counts[ip.projectId] || 0) + 1;
        if (!ipsMap[ip.projectId]) ipsMap[ip.projectId] = [];
        ipsMap[ip.projectId].push(ip);
      }
    }

    return { ipCountsByProjectId: counts, ipsByProjectId: ipsMap };
  }, [ips, projects]);

  // Project Health Stats
  const projectStats = useMemo(() => {
    const map: Record<
      string,
      {
        total: number;
        online: number;
        offline: number;
        untested: number;
      }
    > = {};

    projects.forEach((p) => {
      const list = ipsByProjectId[p.id] || [];
      let online = 0;
      let offline = 0;
      let untested = 0;

      list.forEach((ip) => {
        if (ip.lastPingStatus === 'online') {
          online++;
        } else if (ip.lastPingStatus === 'unreachable' || ip.lastPingStatus === 'offline') {
          offline++;
        } else {
          untested++;
        }
      });

      map[p.id] = {
        total: list.length,
        online,
        offline,
        untested,
      };
    });

    return map;
  }, [projects, ipsByProjectId]);

  // Filtered & Sorted Projects
  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => {
        const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
        const matchesStatus = selectedStatus === 'all' || p.status === selectedStatus;
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          !searchTerm ||
          p.name.toLowerCase().includes(term) ||
          p.code.toLowerCase().includes(term) ||
          p.category.toLowerCase().includes(term) ||
          (p.owner && p.owner.toLowerCase().includes(term)) ||
          (p.department && p.department.toLowerCase().includes(term)) ||
          (p.description && p.description.toLowerCase().includes(term)) ||
          (p.notes && p.notes.toLowerCase().includes(term));
        return matchesCategory && matchesStatus && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'ips') {
          return (ipCountsByProjectId[b.id] || 0) - (ipCountsByProjectId[a.id] || 0);
        }
        if (sortBy === 'category') {
          return a.category.localeCompare(b.category);
        }
        if (sortBy === 'date') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return a.name.localeCompare(b.name);
      });
  }, [projects, selectedCategory, selectedStatus, searchTerm, sortBy, ipCountsByProjectId]);

  // Open a project box
  const openProjectBox = (p: Project) => {
    setOpenedProjectId(p.id);
    setOpenedProject(p);
    setBoxNotesInput(p.notes || '');
    setQuickAddIpInput('');
    setQuickAddLabelInput('');
    setIpFilterQuery('');
    setNotesSaveStatus('saved');
  };

  // Close opened project box
  const closeProjectBox = () => {
    setOpenedProjectId(null);
    setOpenedProject(null);
    setQuickAddIpInput('');
    setQuickAddLabelInput('');
    setIpFilterQuery('');
  };

  const openCreateModal = () => {
    setEditingProject(null);
    setFormData({
      name: '',
      code: '',
      category: 'Server & Compute',
      description: '',
      notes: '',
      icon: 'server',
      color: 'blue',
      status: 'active',
      owner: currentUser?.fullName || '',
      department: currentUser?.department || '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (p: Project) => {
    setEditingProject(p);
    setFormData({
      name: p.name,
      code: p.code,
      category: p.category || 'Server & Compute',
      description: p.description || '',
      notes: p.notes || '',
      icon: p.icon || 'server',
      color: p.color || 'blue',
      status: (p.status === 'archived' ? 'archived' : 'active') as 'active' | 'archived',
      owner: p.owner || '',
      department: p.department || '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleDuplicate = (p: Project) => {
    if (!canManage) return;
    const baseCode = `${p.code}-CPY`;
    let uniqueCode = baseCode;
    let counter = 1;
    while (projects.some((pr) => pr.code.toUpperCase() === uniqueCode.toUpperCase())) {
      uniqueCode = `${baseCode}${counter++}`;
    }

    createProject({
      name: `${p.name} (Copy)`,
      code: uniqueCode,
      category: p.category,
      description: p.description,
      notes: p.notes,
      icon: p.icon,
      color: p.color,
      status: 'active',
      owner: p.owner,
      department: p.department,
    });
    showToast(`Project box '${p.name}' duplicated as '${uniqueCode}'`, 'success');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Project box name is required.');
      return;
    }

    const cleanCode = (formData.code || formData.name.substring(0, 8)).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
    if (!cleanCode) {
      setFormError('Unique box code identifier is required.');
      return;
    }

    if (editingProject) {
      const result = updateProject(editingProject.id, {
        name: formData.name.trim(),
        code: cleanCode,
        category: formData.category,
        description: formData.description.trim(),
        notes: formData.notes.trim(),
        icon: formData.icon,
        color: formData.color,
        status: formData.status,
        owner: formData.owner.trim(),
        department: formData.department.trim(),
      });
      if (!result.success) {
        setFormError(result.message);
        return;
      }
      showToast(`Box '${formData.name}' updated successfully!`, 'success');
    } else {
      const result = createProject({
        name: formData.name.trim(),
        code: cleanCode,
        category: formData.category,
        description: formData.description.trim(),
        notes: formData.notes.trim(),
        icon: formData.icon,
        color: formData.color,
        status: formData.status,
        owner: formData.owner.trim(),
        department: formData.department.trim(),
      });
      if (!result.success) {
        setFormError(result.message);
        return;
      }
      showToast(`Box '${formData.name}' created successfully!`, 'success');
      if (result.project) {
        openProjectBox(result.project);
      }
    }

    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    const result = deleteProject(id);
    if (result.success) {
      showToast(result.message, 'info');
      setDeleteConfirmId(null);
      if (openedProject?.id === id || openedProjectId === id) {
        closeProjectBox();
      }
    } else {
      showToast(result.message, 'error');
    }
  };

  // ADD IP ANYWHERE TO CURRENT OPENED BOX
  const handleAddIpToBox = (e: React.FormEvent) => {
    e.preventDefault();
    if (!openedProject) return;

    const cleanIp = quickAddIpInput.trim();
    if (!cleanIp) {
      showToast('Please enter an IP address.', 'error');
      return;
    }

    if (!isValidIPv4(cleanIp)) {
      showToast(`'${cleanIp}' is not a valid IPv4 address (e.g. 192.168.1.10 or 8.8.8.8)`, 'error');
      return;
    }

    // Check if IP is already in this box
    const currentIps = ipsByProjectId[openedProject.id] || [];
    if (currentIps.some((i) => i.ip === cleanIp)) {
      showToast(`IP ${cleanIp} is already in this box.`, 'error');
      return;
    }

    // Check if an existing IP record exists in the system
    const existing = ips.find((i) => i.ip === cleanIp);
    if (existing) {
      const res = assignIpToProject(existing.id, openedProject.id);
      if (res.success) {
        if (quickAddLabelInput.trim()) {
          updateIP(existing.id, { hostname: quickAddLabelInput.trim() });
        }
        showToast(`Added ${cleanIp} to ${openedProject.name}`, 'success');
        setQuickAddIpInput('');
        setQuickAddLabelInput('');
        pingIP(existing.id).catch(() => {});
      } else {
        showToast(res.message, 'error');
      }
      return;
    }

    // Allocate new IP record (auto-detects subnet or falls back to standalone pool)
    const res = allocateIP({
      ip: cleanIp,
      hostname: quickAddLabelInput.trim() || undefined,
      projectId: openedProject.id,
      status: 'allocated',
      deviceType: 'server',
    });

    if (res.success) {
      showToast(`Added ${cleanIp} to ${openedProject.name}`, 'success');
      setQuickAddIpInput('');
      setQuickAddLabelInput('');
      if (res.record) {
        pingIP(res.record.id).catch(() => {});
      }
    } else {
      showToast(res.message, 'error');
    }
  };

  // REMOVE IP FROM OPENED BOX
  const handleRemoveIpFromBox = (ipRec: IPRecord) => {
    const res = removeIpFromProject(ipRec.id);
    if (res.success) {
      showToast(`Removed ${ipRec.ip} from ${openedProject?.name}`, 'info');
    } else {
      showToast(res.message, 'error');
    }
  };

  // SAVE BOX NOTES
  const handleSaveBoxNotes = () => {
    if (!openedProject) return;
    setNotesSaveStatus('saving');
    const res = updateProject(openedProject.id, { notes: boxNotesInput });
    if (res.success) {
      setNotesSaveStatus('saved');
      showToast('Notes saved successfully', 'success');
    } else {
      setNotesSaveStatus('dirty');
      showToast(res.message, 'error');
    }
  };

  // Auto-save notes on debounce (600ms) after typing stops
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!openedProject || notesSaveStatus !== 'dirty') return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      setNotesSaveStatus('saving');
      const res = updateProject(openedProject.id, { notes: boxNotesInput });
      if (res.success) {
        setNotesSaveStatus('saved');
      } else {
        setNotesSaveStatus('dirty');
      }
    }, 600);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [boxNotesInput, openedProject?.id, notesSaveStatus, updateProject]);

  // Save notes before page unload/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (openedProject && notesSaveStatus === 'dirty') {
        updateProject(openedProject.id, { notes: boxNotesInput });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [openedProject, boxNotesInput, notesSaveStatus, updateProject]);

  // PING SINGLE IP
  const handlePingSingleIp = async (ipRec: IPRecord) => {
    setPingingIpId(ipRec.id);
    try {
      const res = await pingIP(ipRec.id);
      if (res.online) {
        showToast(`IP ${ipRec.ip} is ONLINE (${res.latencyMs}ms)`, 'success');
      } else {
        showToast(`IP ${ipRec.ip} is UNREACHABLE`, 'info');
      }
    } catch {
      showToast(`Failed to ping ${ipRec.ip}`, 'error');
    } finally {
      setPingingIpId(null);
    }
  };

  // PING ALL IPS IN CURRENT OPENED BOX
  const handlePingAllInBox = async () => {
    if (!openedProject) return;
    const currentIps = ipsByProjectId[openedProject.id] || [];
    if (currentIps.length === 0) {
      showToast('No IPs in this box to ping. Add an IP first!', 'info');
      return;
    }

    setIsPingingAll(true);
    try {
      const ipStrings = currentIps.map((i) => i.ip);
      const res = await batchPingIPs(ipStrings);
      showToast(
        `Connectivity check complete: ${res.online} Online, ${res.offline} Unreachable`,
        res.online > 0 ? 'success' : 'info'
      );
    } catch {
      showToast('Network probe encountered an error.', 'error');
    } finally {
      setIsPingingAll(false);
    }
  };

  // Filtered IPs list in opened box
  const openedBoxIpsList = useMemo(() => {
    if (!openedProject) return [];
    const list = ipsByProjectId[openedProject.id] || [];
    const q = ipFilterQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (ip) =>
        ip.ip.includes(q) ||
        (ip.hostname && ip.hostname.toLowerCase().includes(q)) ||
        (ip.owner && ip.owner.toLowerCase().includes(q))
    );
  }, [openedProject, ipsByProjectId, ipFilterQuery]);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* VIEW A: OPENED PROJECT BOX (2 MINI BOXES: 1. IPs, 2. Notes)             */}
      {/* ========================================================================= */}
      {openedProject ? (
        <div className="space-y-5 animate-fade-in">
          {/* Top Navigation & Box Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={closeProjectBox}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
                title="Back to all project boxes"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>All Boxes</span>
              </button>

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />

              <div
                className={`w-10 h-10 rounded-xl ${getColorTheme(openedProject.color).bg} ${
                  getColorTheme(openedProject.color).text
                } border ${getColorTheme(openedProject.color).border} flex items-center justify-center shrink-0 shadow-xs`}
              >
                {renderDeviceIcon(openedProject.icon || 'server', 'w-5 h-5')}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {openedProject.name}
                  </h2>
                  <code className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-mono font-semibold border border-slate-200 dark:border-slate-800">
                    {openedProject.code}
                  </code>
                  <span
                    className={`text-[11px] px-2.5 py-0.5 rounded-full border font-medium flex items-center gap-1.5 ${
                      getColorTheme(openedProject.color).badge
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${getColorTheme(openedProject.color).dot}`} />
                    <span>{openedProject.category}</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {openedProject.description || 'Device category workload container'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canManage && (
                <button
                  type="button"
                  onClick={() => openEditModal(openedProject)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Box</span>
                </button>
              )}
              <button
                type="button"
                onClick={closeProjectBox}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Close Box"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* THE 2 MINI BOXES: SIDE-BY-SIDE GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
            {/* ------------------------------------------------------------- */}
            {/* MINI BOX 1: IP ADDRESSES                                      */}
            {/* ------------------------------------------------------------- */}
            <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                {/* Mini Box 1 Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800/60">
                      <Network className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>IP Addresses</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-mono font-semibold border border-indigo-200 dark:border-indigo-800/60">
                          {openedBoxIpsList.length}
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Add any IP directly without subnet restrictions.
                      </p>
                    </div>
                  </div>

                  {/* Ping All Button */}
                  {openedBoxIpsList.length > 0 && (
                    <button
                      type="button"
                      onClick={handlePingAllInBox}
                      disabled={isPingingAll}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                      title="Run live ping diagnostic check on all IPs in this box"
                    >
                      <Radio className={`w-3.5 h-3.5 ${isPingingAll ? 'animate-spin' : 'animate-pulse'}`} />
                      <span>{isPingingAll ? 'Pinging...' : 'Ping All'}</span>
                    </button>
                  )}
                </div>

                {/* Add IP Input Form */}
                {canAllocateOrEditIP && (
                  <form onSubmit={handleAddIpToBox} className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 space-y-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Add IP to Box</span>
                    </span>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        required
                        value={quickAddIpInput}
                        onChange={(e) => setQuickAddIpInput(e.target.value)}
                        placeholder="Enter IP (e.g. 192.168.1.100, 8.8.8.8)"
                        className="flex-1 bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                      <input
                        type="text"
                        value={quickAddLabelInput}
                        onChange={(e) => setQuickAddLabelInput(e.target.value)}
                        placeholder="Label / Hostname (optional)"
                        className="sm:w-44 bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-2xs shrink-0 flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* Filter search if more than 5 IPs */}
                {openedBoxIpsList.length > 5 && (
                  <div className="relative mt-3">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filter IPs..."
                      value={ipFilterQuery}
                      onChange={(e) => setIpFilterQuery(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                {/* IPs List Container */}
                <div className="mt-3.5 space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {openedBoxIpsList.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                      <Network className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2 opacity-50" />
                      <p className="font-medium text-slate-600 dark:text-slate-300">No IPs added yet</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Type any IP in the box above and click Add.
                      </p>
                    </div>
                  ) : (
                    openedBoxIpsList.map((ipRec) => {
                      const isProbing = pingingIpId === ipRec.id;

                      return (
                        <div
                          key={ipRec.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-100/80 dark:hover:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 transition-all text-xs"
                        >
                          <div className="flex items-center gap-3">
                            {/* Live status dot */}
                            <span
                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                ipRec.lastPingStatus === 'online'
                                  ? 'bg-emerald-500 animate-pulse'
                                  : ipRec.lastPingStatus === 'offline' || ipRec.lastPingStatus === 'unreachable'
                                  ? 'bg-rose-500'
                                  : 'bg-slate-300 dark:bg-slate-600'
                              }`}
                              title={`Status: ${ipRec.lastPingStatus || 'untested'}`}
                            />

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-900 dark:text-white text-[13px]">
                                  {ipRec.ip}
                                </span>
                                {ipRec.hostname && (
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                    ({ipRec.hostname})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                                {ipRec.lastPingStatus === 'online' ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                    Online {ipRec.lastPingLatencyMs ? `• ${ipRec.lastPingLatencyMs}ms` : ''}
                                  </span>
                                ) : ipRec.lastPingStatus === 'unreachable' || ipRec.lastPingStatus === 'offline' ? (
                                  <span className="text-rose-500 font-medium">Unreachable</span>
                                ) : (
                                  <span>Untested</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* IP Actions: Ping, Copy, Remove */}
                          <div className="flex items-center gap-1">
                            {/* Ping button */}
                            <button
                              type="button"
                              onClick={() => handlePingSingleIp(ipRec)}
                              disabled={isProbing}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Check ping status"
                            >
                              {isProbing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                              ) : (
                                <Radio className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Copy button */}
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(ipRec.ip);
                                showToast(`Copied ${ipRec.ip} to clipboard`, 'success');
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Copy IP"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            {/* Remove IP button */}
                            {canAllocateOrEditIP && (
                              <button
                                type="button"
                                onClick={() => handleRemoveIpFromBox(ipRec)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                                title="Remove IP from this box"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Mini Box 1 Footer */}
              <div className="pt-3 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>Total: {openedBoxIpsList.length} IP(s)</span>
                <span>Click trash icon to remove any IP</span>
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* MINI BOX 2: NOTES & REMARKS                                    */}
            {/* ------------------------------------------------------------- */}
            <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div className="flex flex-col flex-1">
                {/* Mini Box 2 Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800/60">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Notes &amp; Documentation</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Operational remarks, credentials reminder, server roles.
                      </p>
                    </div>
                  </div>

                  {/* Save Notes Button */}
                  <button
                    type="button"
                    onClick={handleSaveBoxNotes}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{notesSaveStatus === 'saving' ? 'Saving...' : 'Save Notes'}</span>
                  </button>
                </div>

                {/* Notes Textarea */}
                <div className="mt-4 flex-1 flex flex-col">
                  <textarea
                    rows={12}
                    value={boxNotesInput}
                    onChange={(e) => {
                      setBoxNotesInput(e.target.value);
                      setNotesSaveStatus('dirty');
                    }}
                    onBlur={handleSaveBoxNotes}
                    placeholder="Write project notes here...&#10;&#10;Examples:&#10;• Server cluster configuration&#10;• Primary database port: 5432&#10;• Maintenance window: Sundays 02:00 UTC&#10;• Contact: infrastructure@company.com"
                    className="w-full flex-1 min-h-[300px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-[#080808] focus:outline-none focus:border-amber-500 leading-relaxed font-sans"
                  />
                </div>
              </div>

              {/* Mini Box 2 Footer */}
              <div className="pt-3 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span>Auto-saves on blur or click "Save Notes"</span>
                </span>
                {notesSaveStatus === 'saved' && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">All changes saved</span>
                )}
                {notesSaveStatus === 'dirty' && (
                  <span className="text-amber-500 font-medium">Unsaved changes</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW B: MAIN PROJECT BOXES DIRECTORY CARDS                               */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-600/20 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <span>Projects &amp; Device Category Boxes</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Organize your infrastructure by device categories. Click any box to open its 2 mini-boxes for IP addresses and documentation notes.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {canManage ? (
                <button
                  id="btn-create-project"
                  onClick={openCreateModal}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Box</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
                  <Lock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  <span>Read-Only</span>
                </div>
              )}
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search boxes by name, code, device category, notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              {/* Category Filter */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                <Filter className="w-3.5 h-3.5" />
                <span>Device Category:</span>
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Device Categories</option>
                {DEVICE_CATEGORIES.map((dc) => (
                  <option key={dc.id} value={dc.name}>
                    {dc.name}
                  </option>
                ))}
                {Array.from(new Set(projects.map((p) => p.category)))
                  .filter((cat) => !DEVICE_CATEGORIES.some((d) => d.name === cat))
                  .map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as any)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="archived">Archived</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="name">Sort by Name</option>
                <option value="ips">Sort by IPs Count</option>
                <option value="category">Sort by Category</option>
                <option value="date">Sort by Date Created</option>
              </select>
            </div>
          </div>

          {/* Cards Grid */}
          {filteredProjects.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
              <Boxes className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No project boxes found</h3>
              <p className="text-xs text-slate-500 mt-1">Get started by creating your first device category workload box.</p>
              {canManage && (
                <button
                  onClick={openCreateModal}
                  className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm"
                >
                  Create Project Box
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredProjects.map((p) => {
                const theme = getColorTheme(p.color);
                const stats = projectStats[p.id] || { total: 0, online: 0, offline: 0, untested: 0 };

                return (
                  <div
                    key={p.id}
                    id={`card-project-${p.code}`}
                    className="group relative bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Bar: Icon, Name, Category & Actions */}
                      <div className="flex items-start justify-between gap-3">
                        <div
                          onClick={() => openProjectBox(p)}
                          className="flex items-center gap-3 cursor-pointer flex-1"
                        >
                          <div
                            className={`w-11 h-11 rounded-xl ${theme.bg} ${theme.text} border ${theme.border} flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform`}
                          >
                            {renderDeviceIcon(p.icon || 'server', 'w-5 h-5')}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {p.name}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <code className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 font-mono font-semibold">
                                {p.code}
                              </code>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium flex items-center gap-1 ${theme.badge}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
                                <span>{p.category}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        {canManage && (
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleDuplicate(p)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Duplicate Box"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEditModal(p)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Edit Box"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(p.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Delete Box"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Description */}
                      {p.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 line-clamp-2 leading-relaxed">
                          {p.description}
                        </p>
                      )}

                      {/* Notes Preview */}
                      {p.notes && (
                        <div className="mt-3 p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-[11px] text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed flex items-start gap-1.5">
                          <FileText className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                          <span className="truncate">{p.notes}</span>
                        </div>
                      )}

                      {/* Quick Status Bar */}
                      <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Network className="w-3.5 h-3.5 text-indigo-500" />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {stats.total} {stats.total === 1 ? 'IP' : 'IPs'}
                          </span>
                        </span>

                        <div className="flex items-center gap-2 text-[10px]">
                          {stats.online > 0 && (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>{stats.online} Online</span>
                            </span>
                          )}
                          {stats.offline > 0 && (
                            <span className="flex items-center gap-1 text-rose-500 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              <span>{stats.offline} Offline</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: OPEN BOX BUTTON */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => openProjectBox(p)}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white dark:hover:text-white border border-indigo-200 dark:border-indigo-800 hover:border-indigo-600 text-xs font-semibold transition-all cursor-pointer shadow-2xs group/btn"
                      >
                        <span>Open Box (IPs &amp; Notes)</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TOAST MESSAGE */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs shadow-lg border border-slate-700 animate-fade-in">
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
          {toastMessage.type === 'info' && <RefreshCw className="w-4 h-4 text-cyan-400" />}
          <span>{toastMessage.message}</span>
        </div>
      )}

      {/* CREATE / EDIT PROJECT BOX MODAL (WITH DEVICE CATEGORIES & THEMES) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/20">
                  <Boxes className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingProject ? `Edit Box: ${editingProject.name}` : 'Create New Project Box'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
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
                    Box Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Core Database Cluster"
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
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. PRJ-DB-01"
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
                    value={formData.category}
                    onChange={(e) => {
                      const cat = e.target.value;
                      const matched = DEVICE_CATEGORIES.find((d) => d.name === cat);
                      if (matched) {
                        setFormData({
                          ...formData,
                          category: cat,
                          icon: matched.icon,
                          color: matched.color,
                        });
                      } else {
                        setFormData({ ...formData, category: cat });
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
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#0c0c0c] focus:outline-none focus:border-indigo-500"
                  >
                    <option value="active">Active (Operational)</option>
                    <option value="archived">Archived (Decommissioned)</option>
                  </select>
                </div>
              </div>

              {/* COLOR THEME & ICON */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Theme Color
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                    {AVAILABLE_COLORS.map((c) => {
                      const isSelected = formData.color === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, color: c.id })}
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${c.bg} border-2 ${
                            isSelected ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent opacity-80 hover:opacity-100'
                          }`}
                          title={c.label}
                        >
                          {isSelected && <Check className={`w-3 h-3 ${c.text}`} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Icon Symbol
                  </label>
                  <select
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#0c0c0c] focus:outline-none focus:border-indigo-500"
                  >
                    <option value="server">Server</option>
                    <option value="cctv">CCTV Camera</option>
                    <option value="switch">Switch</option>
                    <option value="router">Router</option>
                    <option value="database">Database</option>
                    <option value="cloud">Cloud</option>
                    <option value="shield">Security / Firewall</option>
                    <option value="boxes">Workload Pod</option>
                    <option value="laptop">Workstation</option>
                    <option value="layers">Storage / SAN</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Purpose
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detail what this project workload box covers..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-[#0c0c0c] focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Initial Box Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-500" />
                  <span>Initial Documentation / Notes (Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add initial notes, port mappings, credentials reminder..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-[#0c0c0c] focus:outline-none focus:border-indigo-500"
                />
              </div>

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
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm"
                >
                  {editingProject ? 'Save Changes' : 'Create Project Box'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center border border-rose-200 dark:border-rose-800">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Project Box?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-4 leading-relaxed">
              Are you sure you want to delete this project box? Any IP addresses assigned to this box will be decoupled and retained in their respective subnets as unassigned endpoints.
            </p>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
