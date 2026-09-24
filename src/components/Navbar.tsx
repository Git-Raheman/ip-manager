import React, { useState, useRef, useEffect } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard,
  Network,
  Users,
  Server,
  Layers,
  FolderGit2,
  FileText,
  LogOut,
  LogIn,
  ChevronDown,
  Lock,
  Database,
  KeyRound,
  Sun,
  Moon,
  Menu,
  X,
} from 'lucide-react';

interface NavbarProps {
  onOpenLogin: () => void;
  onOpenChangePassword?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenLogin,
  onOpenChangePassword,
}) => {
  const {
    currentUser,
    activeTab,
    setActiveTab,
    setSelectedSubnetId,
    logout,
    subnets,
    ldapConfig,
    deviceClassifications,
    projects,
  } = useIPAM();

  const { theme, toggleTheme } = useTheme();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Auto-close mobile menu on tab change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activeTab]);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('#btn-mobile-menu-toggle')
      ) {
        setMobileMenuOpen(false);
      }
    };

    if (userMenuOpen || mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen, mobileMenuOpen]);

  // Granular Tab Permissions based on AWS IAM style policies & explicitly assigned user permissions
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const canSeeDashboard = Boolean(isSuperAdmin || currentUser?.permissions?.viewDashboard !== false);
  const canSeeSubnets = Boolean(isSuperAdmin || currentUser?.permissions?.viewSubnets !== false);
  const canSeeUsers = Boolean(isSuperAdmin || currentUser?.permissions?.manageUsers);
  const canSeeLdap = Boolean(isSuperAdmin || currentUser?.permissions?.manageAuthSettings);
  const canSeeDeviceTypes = Boolean(isSuperAdmin || currentUser?.permissions?.manageDeviceClassifications);
  const canSeeProjects = Boolean(isSuperAdmin || currentUser?.permissions?.manageProjects);
  const canSeeAudit = Boolean(isSuperAdmin || currentUser?.permissions?.viewAuditLogs);
  const canSeeBackup = Boolean(isSuperAdmin || currentUser?.permissions?.manageBackupRestore);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return {
          label: 'Super Admin',
          bg: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800',
        };
      case 'network_admin':
        return {
          label: 'Network Admin',
          bg: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800',
        };
      case 'operator':
        return {
          label: 'Subnet Operator',
          bg: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/80 dark:text-cyan-300 dark:border-cyan-800',
        };
      case 'auditor':
        return {
          label: 'Compliance Auditor',
          bg: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800',
        };
      default:
        return {
          label: role,
          bg: 'bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700',
        };
    }
  };

  const roleInfo = currentUser ? getRoleBadge(currentUser.role) : null;
  const isRestrictedScope =
    currentUser &&
    currentUser.role !== 'super_admin' &&
    currentUser.permissions?.allowedSubnetIds &&
    currentUser.permissions.allowedSubnetIds.length > 0;

  return (
    <header className="sticky top-0 z-50 bg-[#fafafa]/95 dark:bg-[#000000]/95 backdrop-blur-md border-b border-[#ebebeb] dark:border-[#262626] text-[#171717] dark:text-[#ededed] shadow-xs transition-colors">
      <div className="w-full max-w-[1720px] mx-auto px-3 sm:px-5 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-3 min-w-0">
          {/* Brand Logo & Name */}
          <div
            onClick={() => {
              setActiveTab('dashboard');
              setSelectedSubnetId(null);
            }}
            className="flex items-center gap-2 sm:gap-2.5 shrink-0 cursor-pointer group select-none"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform bg-black shrink-0">
              <img src="/icon.png" alt="IP Manager Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-semibold text-sm sm:text-base tracking-tight text-[#171717] dark:text-[#ededed] whitespace-nowrap group-hover:opacity-80 transition-opacity">
              IP Manager
            </span>
          </div>

          {/* Center Navigation Tabs: Auto-adjusting for Desktop, Laptop & Tablet */}
          <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 bg-[#f4f4f5] dark:bg-[#111111] p-1 rounded-xl border border-[#ebebeb] dark:border-[#262626] shadow-xs overflow-x-auto scrollbar-none min-w-0 max-w-full">
            {canSeeDashboard && (
              <button
                id="nav-tab-dashboard"
                onClick={() => {
                  setActiveTab('dashboard');
                  setSelectedSubnetId(null);
                }}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                    : 'text-[#666666] dark:text-[#a1a1a1] hover:text-[#171717] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
                <span>Dashboard</span>
              </button>
            )}

            {canSeeSubnets && (
              <button
                id="nav-tab-subnets"
                onClick={() => {
                  setActiveTab('subnets');
                  setSelectedSubnetId(null);
                }}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'subnets'
                    ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                    : 'text-[#666666] dark:text-[#a1a1a1] hover:text-[#171717] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <Network className="w-3.5 h-3.5 shrink-0" />
                <span>Subnets<span className="hidden xl:inline"> &amp; IPs</span></span>
                <span
                  className={`text-[10px] sm:text-[11px] px-1.5 py-0.2 rounded-full font-mono font-medium ${
                    activeTab === 'subnets'
                      ? 'bg-neutral-800 text-neutral-100 dark:bg-neutral-200 dark:text-neutral-900'
                      : 'bg-black/5 dark:bg-white/10 text-[#666666] dark:text-[#a1a1a1]'
                  }`}
                >
                  {subnets.length}
                </span>
              </button>
            )}

            {canSeeUsers && (
              <button
                id="nav-tab-users"
                onClick={() => setActiveTab('users')}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                    : 'text-[#666666] dark:text-[#a1a1a1] hover:text-[#171717] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>Users</span>
              </button>
            )}

            {canSeeLdap && (
              <button
                id="nav-tab-ldap"
                onClick={() => setActiveTab('ldap_settings')}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'ldap_settings'
                    ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                    : 'text-[#666666] dark:text-[#a1a1a1] hover:text-[#171717] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <Server className="w-3.5 h-3.5 shrink-0" />
                <span><span className="hidden xl:inline">Active </span>Directory</span>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    ldapConfig.enabled ? 'bg-emerald-500' : 'bg-neutral-400 dark:bg-neutral-600'
                  }`}
                  title={ldapConfig.enabled ? 'LDAP Active' : 'LDAP Disabled'}
                />
              </button>
            )}

            {canSeeDeviceTypes && (
              <button
                id="nav-tab-device-classifications"
                onClick={() => setActiveTab('device_classifications')}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'device_classifications'
                    ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                    : 'text-[#666666] dark:text-[#a1a1a1] hover:text-[#171717] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span><span className="hidden xl:inline">Device </span>Types</span>
                <span
                  className={`text-[10px] sm:text-[11px] px-1.5 py-0.2 rounded-full font-mono font-medium ${
                    activeTab === 'device_classifications'
                      ? 'bg-neutral-800 text-neutral-100 dark:bg-neutral-200 dark:text-neutral-900'
                      : 'bg-black/5 dark:bg-white/10 text-[#666666] dark:text-[#a1a1a1]'
                  }`}
                >
                  {deviceClassifications.length}
                </span>
              </button>
            )}

            {canSeeProjects && (
              <button
                id="nav-tab-projects"
                onClick={() => setActiveTab('projects')}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'projects'
                    ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                    : 'text-[#666666] dark:text-[#a1a1a1] hover:text-[#171717] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <FolderGit2 className="w-3.5 h-3.5 shrink-0" />
                <span>Projects</span>
                <span
                  className={`text-[10px] sm:text-[11px] px-1.5 py-0.2 rounded-full font-mono font-medium ${
                    activeTab === 'projects'
                      ? 'bg-neutral-800 text-neutral-100 dark:bg-neutral-200 dark:text-neutral-900'
                      : 'bg-black/5 dark:bg-white/10 text-[#666666] dark:text-[#a1a1a1]'
                  }`}
                >
                  {projects.length}
                </span>
              </button>
            )}

            {canSeeAudit && (
              <button
                id="nav-tab-audit"
                onClick={() => setActiveTab('audit')}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'audit'
                    ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                    : 'text-[#666666] dark:text-[#a1a1a1] hover:text-[#171717] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>Audit</span>
              </button>
            )}

            {canSeeBackup && (
              <button
                id="nav-tab-backup-restore"
                onClick={() => setActiveTab('backup_restore')}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'backup_restore'
                    ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                    : 'text-[#666666] dark:text-[#a1a1a1] hover:text-[#171717] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <Database className="w-3.5 h-3.5 shrink-0" />
                <span>Backup<span className="hidden xl:inline"> &amp; Restore</span></span>
              </button>
            )}
          </nav>

          {/* Right User & Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Dark / Light Mode Toggle */}
            <button
              id="btn-theme-toggle"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              aria-label="Toggle theme"
              className="p-1.5 sm:p-2 rounded-lg border border-[#ebebeb] dark:border-[#262626] bg-white dark:bg-[#111111] text-[#171717] dark:text-[#ededed] hover:bg-[#f4f4f5] dark:hover:bg-[#1c1c1c] transition-colors cursor-pointer shadow-xs"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-[#4d4d4d]" />
              )}
            </button>

            {currentUser ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  id="user-menu-button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#111111] hover:bg-[#f4f4f5] dark:hover:bg-[#1c1c1c] border border-[#ebebeb] dark:border-[#262626] text-left transition-all shadow-xs cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-md bg-[#171717] text-white dark:bg-[#ededed] dark:text-black flex items-center justify-center font-bold text-xs shrink-0">
                    {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="hidden xl:flex flex-col text-left">
                    <span className="text-xs font-medium text-[#171717] dark:text-[#ededed] truncate max-w-[110px]">
                      {currentUser.fullName || currentUser.username}
                    </span>
                    <span className="text-[10px] text-[#8f8f8f] dark:text-[#737373] leading-none">
                      {roleInfo?.label || currentUser.role}
                    </span>
                  </div>
                  {currentUser.authType === 'ldap_ad' ? (
                    <span className="hidden 2xl:flex text-[10px] px-1 py-0.2 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-medium items-center gap-0.5 shrink-0">
                      <Server className="w-2.5 h-2.5" />
                      AD
                    </span>
                  ) : (
                    <span className="hidden 2xl:flex text-[10px] px-1 py-0.2 rounded bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 font-medium items-center gap-0.5 shrink-0">
                      <Lock className="w-2.5 h-2.5" />
                      Local
                    </span>
                  )}
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[#8f8f8f] dark:text-[#737373] shrink-0 transition-transform duration-200 ${
                      userMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>


                {/* User Profile Popover */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#0c0c0c] border border-[#ebebeb] dark:border-[#262626] rounded-xl shadow-xl p-4 z-50 text-[#171717] dark:text-[#ededed]">
                    {/* User Identity Header */}
                    <div className="flex items-center gap-3 pb-3 border-b border-[#ebebeb] dark:border-[#262626]">
                      <div className="w-10 h-10 rounded-xl bg-[#171717] text-white dark:bg-[#ededed] dark:text-black flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                        {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#171717] dark:text-[#ededed] truncate">
                          {currentUser.fullName}
                        </p>
                        <p className="text-xs text-[#8f8f8f] dark:text-[#737373] font-mono truncate">
                          @{currentUser.username}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${roleInfo?.bg}`}>
                            {roleInfo?.label}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 font-mono">
                            {currentUser.authType === 'ldap_ad' ? 'LDAP/AD' : 'Local'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Account Details */}
                    <div className="py-3 space-y-1.5 text-xs border-b border-[#ebebeb] dark:border-[#262626]">
                      {currentUser.department && (
                        <div className="flex items-center justify-between text-[#666666] dark:text-[#a1a1a1]">
                          <span>Department:</span>
                          <span className="text-[#171717] dark:text-[#ededed] font-medium">{currentUser.department}</span>
                        </div>
                      )}
                      {currentUser.email && (
                        <div className="flex items-center justify-between text-[#666666] dark:text-[#a1a1a1]">
                          <span>Email:</span>
                          <span className="text-[#171717] dark:text-[#ededed] font-medium truncate max-w-[170px]">
                            {currentUser.email}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[#666666] dark:text-[#a1a1a1]">
                        <span>Access Scope:</span>
                        <span
                          className={`font-medium ${
                            isRestrictedScope ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isRestrictedScope
                            ? `${currentUser.permissions.allowedSubnetIds.length} Subnet(s) Restricted`
                            : 'Global Enterprise Scope'}
                        </span>
                      </div>
                    </div>

                    {/* Profile Actions */}
                    <div className="pt-3 space-y-2">
                      {currentUser.authType === 'local' && (
                        <button
                          id="btn-open-change-password"
                          onClick={() => {
                            setUserMenuOpen(false);
                            if (onOpenChangePassword) {
                              onOpenChangePassword();
                            }
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-[#171717] dark:text-[#ededed] bg-[#f4f4f5] dark:bg-[#171717] hover:bg-[#e4e4e7] dark:hover:bg-[#222222] border border-[#ebebeb] dark:border-[#262626] rounded-lg transition-all cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-[#0070f3]" />
                          <span>Change Password</span>
                        </button>
                      )}

                      <button
                        id="btn-sign-out"
                        onClick={() => {
                          logout();
                          setUserMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 rounded-lg transition-all cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out of Session</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                id="btn-sign-in"
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#171717] text-white dark:bg-[#ededed] dark:text-black hover:opacity-90 text-xs font-medium shadow-xs transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}

            {/* Mobile Menu Hamburger Toggle Button */}
            <button
              type="button"
              id="btn-mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 sm:p-2 rounded-lg border border-[#ebebeb] dark:border-[#262626] bg-white dark:bg-[#111111] text-[#171717] dark:text-[#ededed] hover:bg-[#f4f4f5] dark:hover:bg-[#1c1c1c] transition-colors cursor-pointer shadow-xs"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile / Small Screen Auto-adjusting horizontal scrollable strip (shown on screens < md) */}
        <div className="md:hidden flex items-center gap-1.5 overflow-x-auto py-2 px-1 border-t border-[#ebebeb] dark:border-[#262626] scrollbar-none">
          <button
            onClick={() => {
              setActiveTab('dashboard');
              setSelectedSubnetId(null);
            }}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors shrink-0 ${
              activeTab === 'dashboard'
                ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                : 'text-[#666666] dark:text-[#a1a1a1] hover:text-[#171717] dark:hover:text-white bg-black/5 dark:bg-white/5'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('subnets');
              setSelectedSubnetId(null);
            }}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors shrink-0 ${
              activeTab === 'subnets'
                ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                : 'text-[#666666] dark:text-[#a1a1a1] hover:text-[#171717] dark:hover:text-white bg-black/5 dark:bg-white/5'
            }`}
          >
            <Network className="w-3.5 h-3.5 shrink-0" />
            <span>Subnets</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium ${
                activeTab === 'subnets'
                  ? 'bg-neutral-800 text-neutral-100 dark:bg-neutral-200 dark:text-neutral-900'
                  : 'bg-black/10 dark:bg-white/10 text-[#666666] dark:text-[#a1a1a1]'
              }`}
            >
              {subnets.length}
            </span>
          </button>

          {canSeeUsers && (
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors shrink-0 ${
                activeTab === 'users'
                  ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                  : 'text-[#666666] dark:text-[#a1a1a1] hover:text-[#171717] dark:hover:text-white bg-black/5 dark:bg-white/5'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>Users</span>
            </button>
          )}

          {canSeeLdap && (
            <button
              onClick={() => setActiveTab('ldap_settings')}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors shrink-0 ${
                activeTab === 'ldap_settings'
                  ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                  : 'text-[#666666] dark:text-[#a1a1a1] hover:text-[#171717] dark:hover:text-white bg-black/5 dark:bg-white/5'
              }`}
            >
              <Server className="w-3.5 h-3.5 shrink-0" />
              <span>AD / LDAP</span>
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  ldapConfig.enabled ? 'bg-emerald-500' : 'bg-neutral-400 dark:bg-neutral-600'
                }`}
              />
            </button>
          )}

          {canSeeDeviceTypes && (
            <button
              onClick={() => setActiveTab('device_classifications')}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors shrink-0 ${
                activeTab === 'device_classifications'
                  ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                  : 'text-[#666666] dark:text-[#a1a1a1] hover:text-[#171717] dark:hover:text-white bg-black/5 dark:bg-white/5'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>Devices</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium ${
                  activeTab === 'device_classifications'
                    ? 'bg-neutral-800 text-neutral-100 dark:bg-neutral-200 dark:text-neutral-900'
                    : 'bg-black/10 dark:bg-white/10 text-[#666666] dark:text-[#a1a1a1]'
                }`}
              >
                {deviceClassifications.length}
              </span>
            </button>
          )}

          {canSeeProjects && (
            <button
              onClick={() => setActiveTab('projects')}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors shrink-0 ${
                activeTab === 'projects'
                  ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                  : 'text-[#666666] dark:text-[#a1a1a1] hover:text-[#171717] dark:hover:text-white bg-black/5 dark:bg-white/5'
              }`}
            >
              <FolderGit2 className="w-3.5 h-3.5 shrink-0" />
              <span>Projects</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium ${
                  activeTab === 'projects'
                    ? 'bg-neutral-800 text-neutral-100 dark:bg-neutral-200 dark:text-neutral-900'
                    : 'bg-black/10 dark:bg-white/10 text-[#666666] dark:text-[#a1a1a1]'
                }`}
              >
                {projects.length}
              </span>
            </button>
          )}

          {canSeeAudit && (
            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors shrink-0 ${
                activeTab === 'audit'
                  ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                  : 'text-[#666666] dark:text-[#a1a1a1] hover:text-[#171717] dark:hover:text-white bg-black/5 dark:bg-white/5'
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>Audit</span>
            </button>
          )}

          {canSeeBackup && (
            <button
              onClick={() => setActiveTab('backup_restore')}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors shrink-0 ${
                activeTab === 'backup_restore'
                  ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                  : 'text-[#666666] dark:text-[#a1a1a1] hover:text-[#171717] dark:hover:text-white bg-black/5 dark:bg-white/5'
              }`}
            >
              <Database className="w-3.5 h-3.5 shrink-0" />
              <span>Backup</span>
            </button>
          )}
        </div>

        {/* Mobile Dropdown Menu Drawer (when hamburger clicked) */}
        {mobileMenuOpen && (
          <div
            ref={mobileMenuRef}
            className="md:hidden border-t border-[#ebebeb] dark:border-[#262626] py-3 space-y-1 bg-white dark:bg-[#0c0c0c] animate-in fade-in slide-in-from-top-2 duration-150"
          >
            <div className="grid grid-cols-2 gap-1.5 pb-2">
              {canSeeDashboard && (
                <button
                  onClick={() => {
                    setActiveTab('dashboard');
                    setSelectedSubnetId(null);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium transition-colors ${
                    activeTab === 'dashboard'
                      ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#666666] dark:text-[#a1a1a1] border border-transparent hover:border-[#ebebeb] dark:hover:border-[#262626]'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  <span>Dashboard</span>
                </button>
              )}

              {canSeeSubnets && (
                <button
                  onClick={() => {
                    setActiveTab('subnets');
                    setSelectedSubnetId(null);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-colors ${
                    activeTab === 'subnets'
                      ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#666666] dark:text-[#a1a1a1] border border-transparent hover:border-[#ebebeb] dark:hover:border-[#262626]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Network className="w-4 h-4 shrink-0" />
                    <span>Subnets</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-black/10 dark:bg-white/10">
                    {subnets.length}
                  </span>
                </button>
              )}

              {canSeeUsers && (
                <button
                  onClick={() => {
                    setActiveTab('users');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium transition-colors ${
                    activeTab === 'users'
                      ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#666666] dark:text-[#a1a1a1] border border-transparent hover:border-[#ebebeb] dark:hover:border-[#262626]'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Users</span>
                </button>
              )}

              {canSeeLdap && (
                <button
                  onClick={() => {
                    setActiveTab('ldap_settings');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-colors ${
                    activeTab === 'ldap_settings'
                      ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#666666] dark:text-[#a1a1a1] border border-transparent hover:border-[#ebebeb] dark:hover:border-[#262626]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 shrink-0" />
                    <span>Active Directory</span>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      ldapConfig.enabled ? 'bg-emerald-500' : 'bg-neutral-400'
                    }`}
                  />
                </button>
              )}

              {canSeeDeviceTypes && (
                <button
                  onClick={() => {
                    setActiveTab('device_classifications');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-colors ${
                    activeTab === 'device_classifications'
                      ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#666666] dark:text-[#a1a1a1] border border-transparent hover:border-[#ebebeb] dark:hover:border-[#262626]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 shrink-0" />
                    <span>Device Types</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-black/10 dark:bg-white/10">
                    {deviceClassifications.length}
                  </span>
                </button>
              )}

              {canSeeProjects && (
                <button
                  onClick={() => {
                    setActiveTab('projects');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition-colors ${
                    activeTab === 'projects'
                      ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#666666] dark:text-[#a1a1a1] border border-transparent hover:border-[#ebebeb] dark:hover:border-[#262626]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FolderGit2 className="w-4 h-4 shrink-0" />
                    <span>Projects</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-black/10 dark:bg-white/10">
                    {projects.length}
                  </span>
                </button>
              )}

              {canSeeAudit && (
                <button
                  onClick={() => {
                    setActiveTab('audit');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium transition-colors ${
                    activeTab === 'audit'
                      ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#666666] dark:text-[#a1a1a1] border border-transparent hover:border-[#ebebeb] dark:hover:border-[#262626]'
                  }`}
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span>Audit Logs</span>
                </button>
              )}

              {canSeeBackup && (
                <button
                  onClick={() => {
                    setActiveTab('backup_restore');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium transition-colors ${
                    activeTab === 'backup_restore'
                      ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#666666] dark:text-[#a1a1a1] border border-transparent hover:border-[#ebebeb] dark:hover:border-[#262626]'
                  }`}
                >
                  <Database className="w-4 h-4 shrink-0" />
                  <span>Backup &amp; Restore</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
