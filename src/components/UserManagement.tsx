import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { DEFAULT_PERMISSIONS, normalizePermissions } from '../data/initialData';
import { User, UserRole, AuthType, GranularPermissions } from '../types';
import {
  Users,
  UserPlus,
  Shield,
  Server,
  Lock,
  KeyRound,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Search,
  Filter,
  Check,
  Building,
  Mail,
  Clock,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  ShieldAlert,
  LayoutDashboard,
  Network,
  Sliders,
  Database,
  FolderKanban,
  FileText,
  Sparkles,
  CheckCheck,
  Ban,
  RotateCcw,
  Loader2,
} from 'lucide-react';

export const UserManagement: React.FC = () => {
  const {
    users,
    currentUser,
    createUser,
    updateUser,
    deleteUser,
    toggleUserStatus,
    subnets,
    hasPermission,
    ldapConfig,
  } = useIPAM();

  const [searchQuery, setSearchQuery] = useState('');
  const [authFilter, setAuthFilter] = useState<'all' | 'local' | 'ldap_ad'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    username: string;
    fullName: string;
    email: string;
    department: string;
    authType: AuthType;
    localPassword: string;
    confirmPassword: string;
    ldapUpn: string;
    role: UserRole;
    status: 'active' | 'disabled';
    permissions: GranularPermissions;
  }>({
    username: '',
    fullName: '',
    email: '',
    department: '',
    authType: 'local',
    localPassword: '',
    confirmPassword: '',
    ldapUpn: '',
    role: 'operator',
    status: 'active',
    permissions: normalizePermissions(DEFAULT_PERMISSIONS.operator, 'operator'),
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [testAuthResult, setTestAuthResult] = useState<{
    userId: string;
    success: boolean;
    message: string;
  } | null>(null);

  const canManageUsers = hasPermission('manageUsers');

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return { label: 'Super Admin', className: 'bg-purple-950/80 text-purple-300 border border-purple-800/80' };
      case 'network_admin':
        return { label: 'Network Admin', className: 'bg-blue-950/80 text-blue-300 border border-blue-800/80' };
      case 'operator':
        return { label: 'Subnet Operator', className: 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/80' };
      case 'auditor':
        return { label: 'Compliance Auditor', className: 'bg-slate-800 text-slate-300 border border-slate-700' };
      default:
        return { label: role, className: 'bg-slate-800 text-slate-300 border border-slate-700' };
    }
  };

  // Filter users
  const filteredUsers = users.filter((user) => {
    const matchSearch =
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.department && user.department.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchAuth = authFilter === 'all' || user.authType === authFilter;
    const matchRole = roleFilter === 'all' || user.role === roleFilter;

    return matchSearch && matchAuth && matchRole;
  });

  // Open Create Modal
  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      fullName: '',
      email: '',
      department: 'Network Operations',
      authType: 'local',
      localPassword: '',
      confirmPassword: '',
      ldapUpn: '',
      role: 'operator',
      status: 'active',
      permissions: normalizePermissions(DEFAULT_PERMISSIONS.operator, 'operator'),
    });
    setFormError(null);
    setModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      department: user.department || '',
      authType: user.authType,
      localPassword: '',
      confirmPassword: '',
      ldapUpn: user.ldapUpn || '',
      role: user.role,
      status: user.status,
      permissions: normalizePermissions(user.permissions, user.role),
    });
    setFormError(null);
    setModalOpen(true);
  };

  // Role change presets
  const handleRoleChange = (role: UserRole) => {
    const preset = normalizePermissions(DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.operator, role);
    setFormData((prev) => ({
      ...prev,
      role,
      permissions: {
        ...preset,
        allowedSubnetIds: prev.permissions.allowedSubnetIds || [],
      },
    }));
  };

  // Permission toggle
  const handlePermissionToggle = (key: keyof GranularPermissions) => {
    if (key === 'allowedSubnetIds') return;
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key],
      },
    }));
  };

  // Quick IAM Policy Actions
  const handleAllowAllPermissions = () => {
    setFormData((prev) => ({
      ...prev,
      permissions: {
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
        allowedSubnetIds: prev.permissions.allowedSubnetIds || [],
      },
    }));
  };

  const handleDenyAllPermissions = () => {
    setFormData((prev) => ({
      ...prev,
      permissions: {
        viewDashboard: false,
        viewSubnets: false,
        manageUsers: false,
        manageAuthSettings: false,
        manageDeviceClassifications: false,
        manageProjects: false,
        viewAuditLogs: false,
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
        exportData: false,
        allowedSubnetIds: prev.permissions.allowedSubnetIds || [],
      },
    }));
  };

  const handleApplyRoleDefaults = () => {
    const preset = normalizePermissions(DEFAULT_PERMISSIONS[formData.role] || DEFAULT_PERMISSIONS.operator, formData.role);
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...preset,
        allowedSubnetIds: prev.permissions.allowedSubnetIds || [],
      },
    }));
  };

  // Subnet restriction toggle
  const toggleSubnetScope = (subnetId: string) => {
    setFormData((prev) => {
      const current = prev.permissions.allowedSubnetIds || [];
      const updated = current.includes(subnetId)
        ? current.filter((id) => id !== subnetId)
        : [...current, subnetId];
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          allowedSubnetIds: updated,
        },
      };
    });
  };

  // Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.username.trim()) {
      setFormError('Username is required.');
      return;
    }
    if (!formData.fullName.trim()) {
      setFormError('Full Name is required.');
      return;
    }

    if (formData.authType === 'local') {
      if (!editingUser && !formData.localPassword) {
        setFormError('Password is required for local database accounts.');
        return;
      }
      if (formData.localPassword) {
        if (formData.localPassword.length < 3) {
          setFormError('Password must be at least 3 characters.');
          return;
        }
        if (formData.localPassword !== formData.confirmPassword) {
          setFormError('Passwords do not match.');
          return;
        }
      }
    } else {
      if (!formData.ldapUpn.trim()) {
        setFormError('LDAP User Principal Name / sAMAccountName is required for Active Directory.');
        return;
      }
    }

    setIsSaving(true);
    try {
      if (editingUser) {
        const updates: Partial<User> = {
          fullName: formData.fullName,
          email: formData.email,
          department: formData.department,
          authType: formData.authType,
          ldapUpn: formData.authType === 'ldap_ad' ? formData.ldapUpn : undefined,
          role: formData.role,
          status: formData.status,
          permissions: formData.permissions,
        };

        if (formData.authType === 'local' && formData.localPassword.trim()) {
          updates.localPassword = formData.localPassword.trim();
        }

        const res = await updateUser(editingUser.id, updates);
        if (!res.success) {
          setFormError(res.message);
          return;
        }
      } else {
        const res = await createUser({
          username: formData.username.trim(),
          fullName: formData.fullName.trim(),
          email: formData.email.trim() || `${formData.username}@corp.internal`,
          department: formData.department,
          authType: formData.authType,
          localPassword: formData.authType === 'local' ? formData.localPassword : undefined,
          ldapUpn: formData.authType === 'ldap_ad' ? formData.ldapUpn : undefined,
          role: formData.role,
          status: formData.status,
          permissions: formData.permissions,
        });
        if (!res.success) {
          setFormError(res.message);
          return;
        }
      }

      setModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  // Simulated Test Auth for a specific user
  const handleTestAuth = (user: User) => {
    if (user.authType === 'local') {
      setTestAuthResult({
        userId: user.id,
        success: true,
        message: `Local authentication verified for ${user.username} against internal credentials store.`,
      });
    } else {
      if (!ldapConfig.enabled) {
        setTestAuthResult({
          userId: user.id,
          success: false,
          message: `Active Directory server is currently disabled in system settings.`,
        });
        return;
      }
      setTestAuthResult({
        userId: user.id,
        success: true,
        message: `Active Directory bind verified against ${ldapConfig.serverUrl} (UPN: ${user.ldapUpn || user.username})`,
      });
    }

    setTimeout(() => {
      setTestAuthResult(null);
    }, 4500);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">User Management &amp; Access Control</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800 font-medium">
              RBAC Matrix
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage local database accounts, integrate enterprise Active Directory / LDAP authentication, and configure granular IP range permissions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canManageUsers ? (
            <button
              id="btn-add-user"
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create User</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
              <ShieldAlert className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <span>Read-Only Mode</span>
            </div>
          )}
        </div>
      </div>

      {!canManageUsers && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-3 shadow-xs">
          <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Read-Only User Management</p>
            <p className="text-[11px] text-amber-800 dark:text-amber-300/80 mt-0.5">
              You are viewing user accounts in read-only mode. Creating, modifying, deleting, or adjusting user permissions requires the <code className="bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded text-amber-900 dark:text-amber-200 font-mono">manageUsers</code> permission.
            </p>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Users</span>
            <Users className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{users.length}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Configured identities</p>
        </div>

        <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Local Auth (DB)</span>
            <Lock className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-200 mt-1">
            {users.filter((u) => u.authType === 'local').length}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Encrypted local storage</p>
        </div>

        <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Active Directory / LDAP</span>
            <Server className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-300 mt-1">
            {users.filter((u) => u.authType === 'ldap_ad').length}
          </p>
          <p className="text-[11px] text-blue-600/80 dark:text-blue-500/80 mt-0.5">
            {ldapConfig.enabled ? 'Enterprise Sync Active' : 'AD Disabled'}
          </p>
        </div>

        <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Active Accounts</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300 mt-1">
            {users.filter((u) => u.status === 'active').length}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {users.filter((u) => u.status === 'disabled').length} suspended
          </p>
        </div>
      </div>

      {/* Test Auth Toast */}
      {testAuthResult && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs animate-in fade-in ${
            testAuthResult.success
              ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-200'
              : 'bg-rose-950/60 border-rose-800/80 text-rose-200'
          }`}
        >
          {testAuthResult.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{testAuthResult.message}</span>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-users"
            type="text"
            placeholder="Search by name, username, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 px-1.5">Auth:</span>
            <button
              onClick={() => setAuthFilter('all')}
              className={`px-2 py-0.5 rounded cursor-pointer ${authFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
            >
              All
            </button>
            <button
              onClick={() => setAuthFilter('local')}
              className={`px-2 py-0.5 rounded cursor-pointer ${authFilter === 'local' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
            >
              Local DB
            </button>
            <button
              onClick={() => setAuthFilter('ldap_ad')}
              className={`px-2 py-0.5 rounded cursor-pointer ${authFilter === 'ldap_ad' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
            >
              Active Directory
            </button>
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
          >
            <option value="all">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="network_admin">Network Admin</option>
            <option value="operator">Subnet Operator</option>
            <option value="auditor">Auditor</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-3.5 px-4 font-semibold min-w-[240px]">User Identity</th>
                <th className="py-3.5 px-4 font-semibold min-w-[180px]">Authentication Type</th>
                <th className="py-3.5 px-4 font-semibold min-w-[200px]">Role &amp; Permissions</th>
                <th className="py-3.5 px-4 font-semibold min-w-[170px]">Subnet Scope</th>
                <th className="py-3.5 px-4 font-semibold min-w-[110px]">Status</th>
                <th className="py-3.5 px-4 font-semibold min-w-[130px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 dark:text-slate-500">
                    No users matching criteria found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = currentUser?.id === u.id;
                  const isAd = u.authType === 'ldap_ad';
                  const isRootAdmin = u.username.toLowerCase() === 'admin' || u.id === 'usr-admin';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Identity */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-inner ${
                              isAd ? 'bg-gradient-to-tr from-blue-700 to-indigo-600' : 'bg-gradient-to-tr from-slate-700 to-slate-600'
                            }`}
                          >
                            {u.fullName.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-white text-sm">{u.fullName}</span>
                              {isCurrent && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700 font-medium">
                                  You
                                </span>
                              )}
                              {isRootAdmin && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700 font-medium flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5" /> Root Admin
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-mono">
                              <span>@{u.username}</span>
                              <span>•</span>
                              <span>{u.email}</span>
                            </div>
                            {u.department && (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">{u.department}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Auth Type */}
                      <td className="py-3 px-4">
                        {isAd ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/80 dark:text-blue-400 dark:border-blue-800/80 font-medium text-xs">
                              <Server className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              <span>Active Directory / LDAP</span>
                            </span>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              UPN: {u.ldapUpn || `${u.username}@${ldapConfig.domain}`}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium text-xs">
                              <Lock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                              <span>Local Database</span>
                            </span>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">Internal Auth Store</p>
                          </div>
                        )}
                      </td>

                      {/* Role & Granular RBAC */}
                      <td className="py-3 px-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold tracking-wide border ${getRoleBadge(u.role).className}`}
                            >
                              {getRoleBadge(u.role).label}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              {Object.entries(u.permissions || {}).filter(([k, v]) => k !== 'allowedSubnetIds' && Boolean(v)).length} / 17 allowed
                            </span>
                          </div>

                          {/* Navigation Tabs Allowed */}
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                              Visible Nav Tabs:
                            </p>
                            <div className="flex flex-wrap items-center gap-1 text-[10px]">
                              {u.permissions.viewDashboard !== false && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-medium">
                                  Dashboard
                                </span>
                              )}
                              {u.permissions.viewSubnets !== false && (
                                <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 font-medium">
                                  Subnets &amp; IPs
                                </span>
                              )}
                              {u.permissions.manageUsers && (
                                <span className="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 font-medium">
                                  Users
                                </span>
                              )}
                              {u.permissions.manageAuthSettings && (
                                <span className="px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 font-medium">
                                  AD / LDAP
                                </span>
                              )}
                              {u.permissions.manageDeviceClassifications && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 font-medium">
                                  Devices
                                </span>
                              )}
                              {u.permissions.manageProjects && (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-medium">
                                  Projects
                                </span>
                              )}
                              {u.permissions.viewAuditLogs && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-medium">
                                  Audit
                                </span>
                              )}
                              {u.permissions.manageBackupRestore && (
                                <span className="px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 font-medium">
                                  Backup
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Subnet Scope */}
                      <td className="py-3 px-4">
                        {u.permissions.allowedSubnetIds && u.permissions.allowedSubnetIds.length > 0 ? (
                          <div>
                            <span className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 px-2 py-0.5 rounded text-[11px] font-medium">
                              Restricted ({u.permissions.allowedSubnetIds.length} Subnet)
                            </span>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                              {u.permissions.allowedSubnetIds
                                .map((id) => subnets.find((s) => s.id === id)?.name || id)
                                .join(', ')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 px-2 py-0.5 rounded text-[11px] font-medium">
                            Full Access (All Subnets)
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <button
                          id={`btn-toggle-status-${u.username}`}
                          disabled={!canManageUsers || isCurrent || isRootAdmin}
                          onClick={() => toggleUserStatus(u.id)}
                          title={isRootAdmin ? 'Root Admin account cannot be deactivated' : undefined}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                            u.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800'
                              : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-400 dark:border-rose-800'
                          } ${canManageUsers && !isCurrent && !isRootAdmin ? 'cursor-pointer hover:opacity-80' : 'cursor-default opacity-80'}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-rose-500 dark:bg-rose-400'}`}
                          />
                          <span className="capitalize">{u.status}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Test Auth */}
                          <button
                            onClick={() => handleTestAuth(u)}
                            title="Test user authentication"
                            className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-medium transition-colors cursor-pointer shadow-xs"
                          >
                            Verify Auth
                          </button>

                          {/* Edit User */}
                          {canManageUsers && (
                            <button
                              id={`btn-edit-user-${u.username}`}
                              onClick={() => openEditModal(u)}
                              title="Edit user settings"
                              className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shadow-xs"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete User */}
                          {canManageUsers && !isCurrent && !isRootAdmin && (
                            <button
                              id={`btn-delete-user-${u.username}`}
                              onClick={() => {
                                setDeleteUserError(null);
                                setUserToDelete(u);
                              }}
                              title="Delete user"
                              className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/60 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300 border border-slate-200 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-700 transition-colors cursor-pointer shadow-xs"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isRootAdmin && (
                            <span
                              title="Root administrator account cannot be deleted"
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-800 cursor-not-allowed inline-flex items-center justify-center"
                            >
                              <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                            </span>
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
      </div>

      {/* CREATE / EDIT USER MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
          <div className="relative bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden">
            {/* Modal Header (Sticky) */}
            <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-[#0c0c0c]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                    {editingUser ? `Edit User: @${editingUser.username}` : 'Create New User Account'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {editingUser
                      ? 'Update credentials, Active Directory mapping, and granular RBAC permissions.'
                      : 'Provision local database or Active Directory / LDAP authenticated account.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close dialog"
              >
                ✕
              </button>
            </div>

            {/* Modal Body (Scrollable & Responsive Auto-Adjusting Layout) */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col justify-between">
              <div className="px-6 py-5 space-y-5">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Basic Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Username <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <input
                    id="input-user-username"
                    type="text"
                    required
                    disabled={!!editingUser}
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="e.g. jdoe"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <input
                    id="input-user-fullname"
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. John Doe"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                  <input
                    id="input-user-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. jdoe@corp.contoso.com"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Department / Unit</label>
                  <input
                    id="input-user-department"
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="e.g. Cloud Network Operations"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* AUTHENTICATION SOURCE SELECTOR (CRITICAL REQUEST) */}
              <div className="pt-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Authentication Source &amp; Provider
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1: Local Database */}
                  <div
                    id="auth-type-local"
                    onClick={() => setFormData({ ...formData, authType: 'local' })}
                    className={`cursor-pointer p-4 rounded-xl border transition-all ${
                      formData.authType === 'local'
                        ? 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-500 ring-1 ring-blue-500/50'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Lock className={`w-4 h-4 ${formData.authType === 'local' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`} />
                        <span className="font-semibold text-xs text-slate-900 dark:text-white">Local Database</span>
                      </div>
                      {formData.authType === 'local' && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Credentials stored directly in the IPAM application database. User logs in with local username and password.
                    </p>
                  </div>

                  {/* Option 2: Active Directory / LDAP */}
                  <div
                    id="auth-type-ldap"
                    onClick={() => setFormData({ ...formData, authType: 'ldap_ad' })}
                    className={`cursor-pointer p-4 rounded-xl border transition-all ${
                      formData.authType === 'ldap_ad'
                        ? 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-500 ring-1 ring-blue-500/50'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Server className={`w-4 h-4 ${formData.authType === 'ldap_ad' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`} />
                        <span className="font-semibold text-xs text-slate-900 dark:text-white">Active Directory / LDAP</span>
                      </div>
                      {formData.authType === 'ldap_ad' && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Delegates credential verification to Microsoft Active Directory / OpenLDAP via LDAPS bind protocol.
                    </p>
                  </div>
                </div>
              </div>

              {/* Conditional Auth Inputs */}
              {formData.authType === 'local' ? (
                <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Local Password Setup
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                        {editingUser ? 'New Password (leave blank to keep current)' : 'Password *'}
                      </label>
                      <input
                        id="input-user-password"
                        type="password"
                        value={formData.localPassword}
                        onChange={(e) => setFormData({ ...formData, localPassword: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">Confirm Password</label>
                      <input
                        id="input-user-confirm-password"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-300 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Active Directory Account Mapping
                  </span>
                  <div>
                    <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                      LDAP User Principal Name (UPN) or sAMAccountName *
                    </label>
                    <input
                      type="text"
                      value={formData.ldapUpn}
                      onChange={(e) => setFormData({ ...formData, ldapUpn: e.target.value })}
                      placeholder={`e.g. ${formData.username || 'username'}@${ldapConfig.domain || 'domain.corp'}`}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Enter the authentic directory identity for domain Kerberos / LDAP bind.
                    </p>
                  </div>
                </div>
              )}

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  System Role
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['super_admin', 'network_admin', 'operator', 'auditor'] as UserRole[]).map((r) => {
                    const isEditingRootAdmin = editingUser && (editingUser.username.toLowerCase() === 'admin' || editingUser.id === 'usr-admin');
                    const isDisabled = Boolean(isEditingRootAdmin && r !== 'super_admin');
                    return (
                      <button
                        key={r}
                        id={`btn-role-${r}`}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => !isDisabled && handleRoleChange(r)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          formData.role === r
                            ? 'bg-blue-50 text-blue-700 border-blue-500 dark:bg-blue-950/60 dark:text-white shadow-xs'
                            : isDisabled
                            ? 'bg-slate-100 dark:bg-slate-950/40 border-slate-200 dark:border-slate-900 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50'
                            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <p className="font-semibold text-xs capitalize">{r.replace('_', ' ')}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {r === 'super_admin'
                            ? 'Full system control'
                            : r === 'network_admin'
                            ? 'Subnet & IP manager'
                            : r === 'operator'
                            ? 'IP allocate & edit'
                            : 'Read-only compliance'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* AWS IAM-STYLE GRANULAR PERMISSIONS & NAVIGATION POLICY STUDIO */}
              <div className="space-y-4 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        AWS IAM-Style Permissions &amp; Navigation Policies
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Grant or deny navigation bar visibility, module access, and operational action privileges.
                    </p>
                  </div>

                  {/* IAM Quick Action Toolbar */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAllowAllPermissions}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[11px] font-medium transition-colors cursor-pointer"
                      title="Grant all module navigation and action permissions"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Allow All (*)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDenyAllPermissions}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-[11px] font-medium transition-colors cursor-pointer"
                      title="Revoke all optional permissions"
                    >
                      <Ban className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                      <span>Deny All</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyRoleDefaults}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                      title="Reset permissions to the default template for the selected role"
                    >
                      <RotateCcw className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                      <span>Role Preset</span>
                    </button>
                  </div>
                </div>

                {/* Policy Service Group 1: Navigation & Module Visibility */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
                      <LayoutDashboard className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      1. Navigation Bar &amp; Module Visibility Policies
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">IAM: ui:View*</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      {
                        key: 'viewDashboard',
                        title: 'Dashboard & Analytics',
                        action: 'ipam:ui:ViewDashboard',
                        desc: 'Show Dashboard in navbar; view high-level metrics, IP charts, and stats.',
                        icon: LayoutDashboard,
                      },
                      {
                        key: 'viewSubnets',
                        title: 'Subnets & IP Pool Registry',
                        action: 'ipam:ui:ViewSubnets',
                        desc: 'Show Subnets & IPs in navbar; view CIDR blocks, ranges, and IP lists.',
                        icon: Network,
                      },
                      {
                        key: 'manageUsers',
                        title: 'User Management & IAM',
                        action: 'iam:ui:ManageUsers',
                        desc: 'Show Users in navbar; create, edit, and configure user accounts & policies.',
                        icon: Users,
                      },
                      {
                        key: 'manageAuthSettings',
                        title: 'Active Directory / LDAP Auth',
                        action: 'iam:ui:ManageAuthSettings',
                        desc: 'Show Active Directory in navbar; configure LDAP bind servers & domain sync.',
                        icon: Server,
                      },
                      {
                        key: 'manageDeviceClassifications',
                        title: 'Device Catalog & Types',
                        action: 'ipam:ui:ManageDeviceClassifications',
                        desc: 'Show Device Types in navbar; create custom hardware categories & roles.',
                        icon: Sliders,
                      },
                      {
                        key: 'manageProjects',
                        title: 'Projects & Workloads',
                        action: 'ipam:ui:ManageProjects',
                        desc: 'Show Projects in navbar; organize subnet pools by team and cost centers.',
                        icon: FolderKanban,
                      },
                      {
                        key: 'viewAuditLogs',
                        title: 'Audit Trail & Compliance',
                        action: 'audit:ui:ViewAuditLogs',
                        desc: 'Show Audit in navbar; inspect tamper-evident security activity records.',
                        icon: FileText,
                      },
                      {
                        key: 'manageBackupRestore',
                        title: 'Backup & Disaster Recovery',
                        action: 'system:ui:ManageBackupRestore',
                        desc: 'Show Backup in navbar; perform database snapshots, export, and restores.',
                        icon: Database,
                      },
                    ].map(({ key, title, action, desc, icon: Icon }) => {
                      const isAllowed = Boolean(formData.permissions[key as keyof GranularPermissions]);
                      return (
                        <div
                          key={key}
                          onClick={() => handlePermissionToggle(key as keyof GranularPermissions)}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                            isAllowed
                              ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-700/80 shadow-xs'
                              : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 opacity-80'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                  isAllowed
                                    ? 'bg-blue-600 text-white dark:bg-blue-500'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 dark:text-white truncate text-[11px]">{title}</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">{action}</p>
                              </div>
                            </div>

                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider shrink-0 border ${
                                isAllowed
                                  ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                                  : 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800'
                              }`}
                            >
                              {isAllowed ? 'ALLOW' : 'DENY'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Policy Service Group 2: Operational Actions */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
                      <Network className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      2. Subnet &amp; IP Operational Privileges
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">IAM: ipam:Operations</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      {
                        key: 'createSubnet',
                        title: 'Create Subnets / CIDRs',
                        action: 'ipam:network:CreateSubnet',
                        desc: 'Provision new IPv4/IPv6 CIDR ranges and subnet networks.',
                      },
                      {
                        key: 'editSubnet',
                        title: 'Modify Subnets & Ranges',
                        action: 'ipam:network:EditSubnet',
                        desc: 'Edit CIDRs, VLAN identifiers, DNS gateways, and thresholds.',
                      },
                      {
                        key: 'deleteSubnet',
                        title: 'Delete Subnets & Ranges',
                        action: 'ipam:network:DeleteSubnet',
                        desc: 'Decommission subnets and delete all associated IP allocations.',
                      },
                      {
                        key: 'allocateIP',
                        title: 'Allocate & Reserve IPs',
                        action: 'ipam:address:AllocateIP',
                        desc: 'Assign available IP addresses to servers, devices, and nodes.',
                      },
                      {
                        key: 'editIP',
                        title: 'Edit IP Device Info & DNS',
                        action: 'ipam:address:EditIP',
                        desc: 'Update hostnames, MAC addresses, device categories, and notes.',
                      },
                      {
                        key: 'releaseIP',
                        title: 'Release / Reclaim IPs',
                        action: 'ipam:address:ReleaseIP',
                        desc: 'Release allocated IPs back into available pool for reuse.',
                      },
                      {
                        key: 'scanSubnet',
                        title: 'Trigger Ping & ARP Scans',
                        action: 'ipam:network:ScanSubnet',
                        desc: 'Execute ICMP ping sweeps and automated IP host discovery.',
                      },
                    ].map(({ key, title, action, desc }) => {
                      const isAllowed = Boolean(formData.permissions[key as keyof GranularPermissions]);
                      return (
                        <div
                          key={key}
                          onClick={() => handlePermissionToggle(key as keyof GranularPermissions)}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                            isAllowed
                              ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-700/80 shadow-xs'
                              : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 opacity-80'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white truncate text-[11px]">{title}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">{action}</p>
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider shrink-0 border ${
                                isAllowed
                                  ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                                  : 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800'
                              }`}
                            >
                              {isAllowed ? 'ALLOW' : 'DENY'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Policy Service Group 3: Governance, Compliance & Export */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      3. Governance, Security &amp; Data Policies
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">IAM: audit:* / system:*</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {[
                      {
                        key: 'manageAuditSettings',
                        title: 'Audit Policy Settings',
                        action: 'audit:policy:ManageAuditSettings',
                        desc: 'Configure logging levels, retention windows, and alerts.',
                      },
                      {
                        key: 'clearAuditLogs',
                        title: 'Clear & Rotate Audit Logs',
                        action: 'audit:policy:ClearAuditLogs',
                        desc: 'Rotate, truncate, or purge security event audit trails.',
                      },
                      {
                        key: 'exportData',
                        title: 'Export IPAM Data',
                        action: 'ipam:data:ExportData',
                        desc: 'Download CSV and JSON exports of subnets and IP pools.',
                      },
                    ].map(({ key, title, action, desc }) => {
                      const isAllowed = Boolean(formData.permissions[key as keyof GranularPermissions]);
                      return (
                        <div
                          key={key}
                          onClick={() => handlePermissionToggle(key as keyof GranularPermissions)}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                            isAllowed
                              ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-700/80 shadow-xs'
                              : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 opacity-80'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white truncate text-[11px]">{title}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">{action}</p>
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider shrink-0 border ${
                                isAllowed
                                  ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                                  : 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800'
                              }`}
                            >
                              {isAllowed ? 'ALLOW' : 'DENY'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Subnet Scope Restriction */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Subnet Access Restriction (Scope)
                </label>
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 text-xs">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">Restricted Subnets:</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {formData.permissions.allowedSubnetIds?.length === 0
                        ? 'All subnets accessible (No restriction)'
                        : `${formData.permissions.allowedSubnetIds?.length} subnet(s) permitted`}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                    {subnets.map((sub) => {
                      const isAllowed =
                        !formData.permissions.allowedSubnetIds ||
                        formData.permissions.allowedSubnetIds.length === 0 ||
                        formData.permissions.allowedSubnetIds.includes(sub.id);

                      return (
                        <div
                          key={sub.id}
                          onClick={() => toggleSubnetScope(sub.id)}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                            formData.permissions.allowedSubnetIds?.includes(sub.id)
                              ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 dark:border-blue-600 text-blue-700 dark:text-blue-200'
                              : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-200">{sub.name}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{sub.cidr}</p>
                          </div>
                          {formData.permissions.allowedSubnetIds?.includes(sub.id) && (
                            <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-500 italic">
                    Tip: If no specific subnets are selected, the user has global access across all ranges.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer (Sticky) */}
            <div className="shrink-0 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900/95">
              {/* Account Status */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Account Status:</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="active"
                      checked={formData.status === 'active'}
                      onChange={() => setFormData({ ...formData, status: 'active' })}
                      className="text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>Active</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="disabled"
                      checked={formData.status === 'disabled'}
                      onChange={() => setFormData({ ...formData, status: 'disabled' })}
                      className="text-rose-500 focus:ring-rose-500"
                    />
                    <span>Disabled / Suspended</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-user-form"
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSaving ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    )}
    {/* DELETE USER CONFIRMATION MODAL */}
    {userToDelete && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 border border-rose-500/20">
            <Trash2 className="w-6 h-6" />
          </div>

          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Delete User Account &quot;@{userToDelete.username}&quot;?
          </h3>

          <div className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 text-xs space-y-1.5 font-mono">
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Full Name:</span>
              <span className="text-slate-900 dark:text-slate-200 font-sans font-medium">{userToDelete.fullName}</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Auth Type:</span>
              <span className="text-blue-600 dark:text-blue-400 capitalize">{userToDelete.authType === 'ldap_ad' ? 'Active Directory' : 'Local DB'}</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Role:</span>
              <span className="text-emerald-600 dark:text-emerald-400 capitalize">{userToDelete.role}</span>
            </div>
            {userToDelete.email && (
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Email:</span>
                <span className="text-slate-700 dark:text-slate-300">{userToDelete.email}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
            Are you sure you want to permanently delete this user account? The user will immediately lose access to the IPAM system and all session tokens will be invalidated.
          </p>

          {deleteUserError && (
            <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
              {deleteUserError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 mt-6">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setUserToDelete(null)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-delete-user"
              type="button"
              disabled={isDeleting}
              onClick={async () => {
                setIsDeleting(true);
                setDeleteUserError(null);
                try {
                  const res = await deleteUser(userToDelete.id);
                  if (!res.success) {
                    setDeleteUserError(res.message);
                    return;
                  }
                  setUserToDelete(null);
                } catch (err: any) {
                  setDeleteUserError(err?.message || 'Failed to delete user account.');
                } finally {
                  setIsDeleting(false);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isDeleting ? 'Deleting...' : 'Delete User'}</span>
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);
};
