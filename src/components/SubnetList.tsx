import React, { useState, useMemo } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { Subnet } from '../types';
import { parseCIDR } from '../utils/ipUtils';
import {
  Network,
  Plus,
  Search,
  Filter,
  Layers,
  MapPin,
  Server,
  ArrowRight,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';

interface SubnetListProps {
  onSelectSubnet: (subnetId: string) => void;
  onOpenDeviceClassifications?: () => void;
}

export const SubnetList: React.FC<SubnetListProps> = ({ onSelectSubnet, onOpenDeviceClassifications }) => {
  const {
    subnets,
    ips,
    currentUser,
    createSubnet,
    updateSubnet,
    deleteSubnet,
    hasPermission,
  } = useIPAM();

  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubnet, setEditingSubnet] = useState<Subnet | null>(null);
  const [subnetToDelete, setSubnetToDelete] = useState<Subnet | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    cidr: '',
    vlanId: '',
    location: '',
    description: '',
    tags: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const canCreate = hasPermission('createSubnet');

  // Unique locations for filter
  const locations = useMemo(() => {
    return Array.from(new Set(subnets.map((s) => s.location).filter(Boolean)));
  }, [subnets]);

  // Subnet access filter based on user permissions (memoized)
  const accessibleSubnets = useMemo(() => {
    return subnets.filter((sub) => {
      if (!currentUser) return true;
      if (currentUser.role === 'super_admin') return true;
      const allowed = currentUser.permissions.allowedSubnetIds;
      if (!allowed || allowed.length === 0) return true;
      return allowed.includes(sub.id);
    });
  }, [subnets, currentUser]);

  // Filtered subnets (memoized for fast search typing)
  const filteredSubnets = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return accessibleSubnets.filter((sub) => {
      const matchesSearch =
        !q ||
        sub.name.toLowerCase().includes(q) ||
        sub.cidr.toLowerCase().includes(q) ||
        (sub.vlanId && sub.vlanId.toString().includes(q)) ||
        sub.location.toLowerCase().includes(q) ||
        (Array.isArray(sub.tags) && sub.tags.some((t) => t.toLowerCase().includes(q)));

      const matchesLocation = locationFilter === 'all' || sub.location === locationFilter;

      return matchesSearch && matchesLocation;
    });
  }, [accessibleSubnets, searchQuery, locationFilter]);

  // Pre-aggregate subnet stats in a single O(N) pass across all IPs
  const { subnetStatsMap, totalAllocatedIps } = useMemo(() => {
    const map = new Map<
      string,
      { total: number; allocated: number; reserved: number; dhcp: number; offline: number }
    >();
    let totalAllocated = 0;
    const accessibleSet = new Set(accessibleSubnets.map((s) => s.id));

    for (let i = 0; i < ips.length; i++) {
      const rec = ips[i];
      let stat = map.get(rec.subnetId);
      if (!stat) {
        stat = { total: 0, allocated: 0, reserved: 0, dhcp: 0, offline: 0 };
        map.set(rec.subnetId, stat);
      }
      stat.total++;
      if (rec.status === 'allocated') stat.allocated++;
      else if (rec.status === 'reserved') stat.reserved++;
      else if (rec.status === 'dhcp') stat.dhcp++;
      else if (rec.status === 'offline') stat.offline++;

      if (
        accessibleSet.has(rec.subnetId) &&
        (rec.status === 'allocated' || rec.status === 'reserved')
      ) {
        totalAllocated++;
      }
    }

    return { subnetStatsMap: map, totalAllocatedIps: totalAllocated };
  }, [ips, accessibleSubnets]);

  // Global utilization metrics
  const totalSubnets = accessibleSubnets.length;
  const totalIpsSpace = accessibleSubnets.reduce((acc, s) => acc + s.usableHosts, 0);
  const globalUtilization = totalIpsSpace > 0 ? Math.round((totalAllocatedIps / totalIpsSpace) * 100) : 0;

  // Form Handlers
  const openCreateModal = () => {
    setEditingSubnet(null);
    setFormData({
      name: '',
      cidr: '192.168.100.0/24',
      vlanId: '100',
      location: 'HQ Data Center',
      description: 'Application tier subnet',
      tags: 'Production, LAN',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (sub: Subnet, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSubnet(sub);
    setFormData({
      name: sub.name,
      cidr: sub.cidr,
      vlanId: sub.vlanId?.toString() || '',
      location: sub.location,
      description: sub.description,
      tags: sub.tags.join(', '),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleDelete = (sub: Subnet, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteError(null);
    setSubnetToDelete(sub);
  };

  const confirmDeleteSubnet = () => {
    if (!subnetToDelete) return;
    const res = deleteSubnet(subnetToDelete.id);
    if (!res.success) {
      setDeleteError(res.message);
      return;
    }
    setSubnetToDelete(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim() || !formData.cidr.trim()) {
      setFormError('Name and CIDR are required.');
      return;
    }

    const cidrInfo = parseCIDR(formData.cidr);
    if (!cidrInfo) {
      setFormError('Invalid CIDR format. Examples: 192.168.1.0/24, 10.0.0.0/22, 172.16.0.0/20');
      return;
    }

    const tagsArray = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const vlanNum = formData.vlanId ? parseInt(formData.vlanId, 10) : undefined;

    if (editingSubnet) {
      const res = updateSubnet(editingSubnet.id, {
        name: formData.name.trim(),
        cidr: formData.cidr.trim(),
        vlanId: isNaN(vlanNum as number) ? undefined : vlanNum,
        location: formData.location.trim(),
        description: formData.description.trim(),
        tags: tagsArray,
      });
      if (!res.success) {
        setFormError(res.message);
        return;
      }
    } else {
      const res = createSubnet({
        name: formData.name.trim(),
        cidr: formData.cidr.trim(),
        vlanId: isNaN(vlanNum as number) ? undefined : vlanNum,
        location: formData.location.trim() || 'Default Location',
        description: formData.description.trim(),
        tags: tagsArray,
      });
      if (!res.success) {
        setFormError(res.message);
        return;
      }
    }

    setModalOpen(false);
  };

  // Preview CIDR in form
  const cidrPreview = parseCIDR(formData.cidr);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#171717] dark:text-white tracking-tight">
              IP Subnets &amp; Address Ranges
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800 font-medium">
              IPv4 Management
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Browse allocated IP subnets, monitor utilization heatmaps, reserve static IP ranges, and configure VLAN scopes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onOpenDeviceClassifications && (
            <button
              onClick={onOpenDeviceClassifications}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 font-medium transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Device Classifications</span>
            </button>
          )}

          {canCreate ? (
            <button
              id="btn-create-subnet"
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs text-white font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Subnet</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-400">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Restricted by Role</span>
            </div>
          )}
        </div>
      </div>

      {/* Global IPAM Capacity Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-400">Managed Subnets</span>
          <p className="text-2xl font-bold text-[#171717] dark:text-white mt-1">{totalSubnets}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {currentUser?.permissions.allowedSubnetIds && currentUser.permissions.allowedSubnetIds.length > 0
              ? 'Restricted to assigned scopes'
              : 'Global enterprise scope'}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-400">Total Host Capacity</span>
          <p className="text-2xl font-bold text-slate-200 mt-1">{totalIpsSpace.toLocaleString()}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Usable IPv4 addresses</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-blue-400">Allocated / Reserved</span>
          <p className="text-2xl font-bold text-blue-300 mt-1">{totalAllocatedIps}</p>
          <p className="text-[11px] text-blue-500/80 mt-0.5">Active IP records</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-400">Utilization Rate</span>
            <span className="text-xs font-mono font-bold text-emerald-300">{globalUtilization}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                globalUtilization > 80
                  ? 'bg-rose-500'
                  : globalUtilization > 50
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(5, globalUtilization))}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            {(totalIpsSpace - totalAllocatedIps).toLocaleString()} IPs available
          </p>
        </div>
      </div>

      {/* Search & Location Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search subnets by CIDR, VLAN, name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-slate-400">Location:</span>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Locations</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Subnet Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {accessibleSubnets.length === 0 ? (
          <div className="col-span-full py-16 px-6 text-center bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Network className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold text-slate-100">Fresh System Ready for Subnets</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-2 leading-relaxed">
              Your IPAM database is completely clean and ready. Add your first IPv4 network subnet to start allocating IP addresses, tracking VLANs, and monitoring utilization.
            </p>
            {canCreate && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={openCreateModal}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-900/30 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Your First Subnet</span>
                </button>
              </div>
            )}
          </div>
        ) : filteredSubnets.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">
            <Network className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm">No subnets found matching your search.</p>
            {canCreate && (
              <button
                onClick={openCreateModal}
                className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
              >
                Create a new subnet now
              </button>
            )}
          </div>
        ) : (
          filteredSubnets.map((sub) => {
            const stats = subnetStatsMap.get(sub.id) || { total: 0, allocated: 0, reserved: 0, dhcp: 0, offline: 0 };
            const allocatedCount = stats.allocated;
            const reservedCount = stats.reserved;
            const dhcpCount = stats.dhcp;
            const offlineCount = stats.offline;
            const totalAssigned = allocatedCount + reservedCount + dhcpCount + offlineCount;
            const pct = Math.round((totalAssigned / sub.usableHosts) * 100);

            const canEdit = hasPermission('editSubnet', sub.id);
            const canDel = hasPermission('deleteSubnet', sub.id);

            return (
              <div
                key={sub.id}
                onClick={() => onSelectSubnet(sub.id)}
                className="group bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-5 shadow-sm transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Top line: Name & VLAN */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#171717] dark:text-white text-base group-hover:text-blue-400 transition-colors">
                          {sub.name}
                        </span>
                        {sub.vlanId && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono font-medium">
                            VLAN {sub.vlanId}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs font-semibold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/60">
                          {sub.cidr}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {sub.location}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-slate-400">
                      {canEdit && (
                        <button
                          onClick={(e) => openEditModal(sub, e)}
                          title="Edit subnet"
                          className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDel && (
                        <button
                          onClick={(e) => handleDelete(sub, e)}
                          title="Delete subnet"
                          className="p-1.5 rounded-lg hover:bg-rose-950/50 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 mt-2.5 line-clamp-1">{sub.description}</p>

                  {/* Network parameters */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-[11px]">
                    <div>
                      <span className="text-slate-500">Gateway:</span>{' '}
                      <span className="font-mono text-slate-300">{sub.gateway}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Netmask:</span>{' '}
                      <span className="font-mono text-slate-300">{sub.mask}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Usable Hosts:</span>{' '}
                      <span className="text-slate-300">{sub.usableHosts}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Allocated:</span>{' '}
                      <span className="text-slate-300 font-semibold">{totalAssigned} IPs</span>
                    </div>
                  </div>

                  {/* Utilization Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-slate-400">Utilization</span>
                      <span className="font-mono font-semibold text-slate-200">{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden flex">
                      {allocatedCount > 0 && (
                        <div
                          className="bg-emerald-500 h-full"
                          style={{ width: `${(allocatedCount / sub.usableHosts) * 100}%` }}
                          title={`Allocated: ${allocatedCount}`}
                        />
                      )}
                      {reservedCount > 0 && (
                        <div
                          className="bg-amber-500 h-full"
                          style={{ width: `${(reservedCount / sub.usableHosts) * 100}%` }}
                          title={`Reserved: ${reservedCount}`}
                        />
                      )}
                      {dhcpCount > 0 && (
                        <div
                          className="bg-sky-500 h-full"
                          style={{ width: `${(dhcpCount / sub.usableHosts) * 100}%` }}
                          title={`DHCP: ${dhcpCount}`}
                        />
                      )}
                      {offlineCount > 0 && (
                        <div
                          className="bg-rose-500 h-full"
                          style={{ width: `${(offlineCount / sub.usableHosts) * 100}%` }}
                          title={`Offline: ${offlineCount}`}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Card Footer */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex flex-wrap gap-1">
                    {(Array.isArray(sub.tags) ? sub.tags : []).slice(0, 3).map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                        {t}
                      </span>
                    ))}
                  </div>

                  <span className="flex items-center gap-1 text-blue-400 group-hover:translate-x-0.5 transition-transform font-medium">
                    <span>Manage IPs</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CREATE / EDIT SUBNET MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
            {/* Modal Header */}
            <div className="shrink-0 px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <Network className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#171717] dark:text-white">
                  {editingSubnet ? 'Edit Subnet Parameters' : 'Create New IP Subnet'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col justify-between">
              <div className="p-6 space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Subnet Name <span className="text-rose-400">*</span>
                  </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. DMZ Firewalls &amp; Edge"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Network CIDR <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.cidr}
                    onChange={(e) => setFormData({ ...formData, cidr: e.target.value })}
                    placeholder="e.g. 192.168.10.0/24"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    VLAN ID (Optional)
                  </label>
                  <input
                    type="number"
                    value={formData.vlanId}
                    onChange={(e) => setFormData({ ...formData, vlanId: e.target.value })}
                    placeholder="e.g. 100"
                    min={1}
                    max={4094}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Live CIDR preview */}
              {cidrPreview && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] space-y-1 font-mono">
                  <div className="text-slate-400">
                    Netmask: <span className="text-slate-200">{cidrPreview.subnetMask}</span> | Gateway:{' '}
                    <span className="text-blue-300">{cidrPreview.gateway}</span>
                  </div>
                  <div className="text-slate-400">
                    Usable Range:{' '}
                    <span className="text-emerald-400">
                      {cidrPreview.firstUsableIp} - {cidrPreview.lastUsableIp}
                    </span>{' '}
                    ({cidrPreview.usableHosts} usable hosts)
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Location / Site</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. US-East Ashburn DC"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Tags (Comma-separated)</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="e.g. Production, Web, Tier-1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description / Purpose</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Details on what systems operate in this IP range..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Modal Buttons (Sticky Footer) */}
            <div className="shrink-0 px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-900/95">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors border border-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
              >
                {editingSubnet ? 'Save Changes' : 'Create Subnet'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

      {/* DELETE SUBNET CONFIRMATION MODAL */}
      {subnetToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-4 border border-rose-500/20">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-[#171717] dark:text-white">
              Delete Subnet &quot;{subnetToDelete.name}&quot;?
            </h3>

            <div className="mt-2 p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between text-slate-400">
                <span>CIDR Range:</span>
                <span className="text-blue-400 font-semibold">{subnetToDelete.cidr}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Location:</span>
                <span className="text-slate-200">{subnetToDelete.location}</span>
              </div>
              {subnetToDelete.vlanId && (
                <div className="flex justify-between text-slate-400">
                  <span>VLAN:</span>
                  <span className="text-indigo-300">VLAN {subnetToDelete.vlanId}</span>
                </div>
              )}
            </div>

            {(() => {
              const subStats = subnetStatsMap.get(subnetToDelete.id);
              const ipsCount = subStats ? subStats.total : 0;
              const activeCount = subStats ? subStats.allocated + subStats.reserved : 0;
              return (
                <div className="mt-3 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <div className="leading-relaxed">
                    Deleting this subnet will permanently purge <strong>{ipsCount} associated IP records</strong>{' '}
                    ({activeCount} currently active/allocated). This action cannot be undone.
                  </div>
                </div>
              );
            })()}

            {deleteError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                {deleteError}
              </div>
            )}

            {!hasPermission('deleteSubnet', subnetToDelete.id) && (
              <div className="mt-3 p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Permission denied: You do not have permission to delete this subnet.</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setSubnetToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors border border-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!hasPermission('deleteSubnet', subnetToDelete.id)}
                onClick={confirmDeleteSubnet}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:hover:bg-rose-600 text-white shadow-sm transition-colors"
              >
                Delete Subnet &amp; IPs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
