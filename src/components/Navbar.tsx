import React, { useState, useRef, useEffect } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { useTheme } from '../context/ThemeContext';
import {
  Network,
  Users,
  Server,
  Layers,
  FileText,
  LogOut,
  LogIn,
  ChevronDown,
  Lock,
  Database,
  KeyRound,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';

interface NavbarProps {
  onOpenLogin: () => void;
  onOpenChangePassword?: () => void;
  onToggleChatbot?: () => void;
  isChatbotOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenLogin,
  onOpenChangePassword,
  onToggleChatbot,
  isChatbotOpen,
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
  } = useIPAM();

  const { theme, toggleTheme } = useTheme();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  // Granular Tab Permissions based on RBAC matrix & explicitly assigned user permissions
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const canSeeUsers = Boolean(isSuperAdmin || currentUser?.permissions?.manageUsers);
  const canSeeLdap = Boolean(isSuperAdmin || currentUser?.permissions?.manageAuthSettings);
  const canSeeDeviceTypes = Boolean(
    isSuperAdmin ||
      (currentUser?.permissions?.manageDeviceClassifications && currentUser?.role !== 'auditor') ||
      (currentUser?.role === 'network_admin' && currentUser?.permissions?.manageDeviceClassifications !== false)
  );
  const canSeeAudit = Boolean(
    isSuperAdmin ||
      currentUser?.permissions?.viewAuditLogs
  );
  const canSeeBackup = Boolean(isSuperAdmin);

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
    <header className="sticky top-0 z-40 bg-[#fafafa]/90 dark:bg-[#000000]/90 backdrop-blur-md border-b border-[#ebebeb] dark:border-[#262626] text-[#171717] dark:text-[#ededed] shadow-xs transition-colors">
      <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand Logo & Name (Geist Developer Platform Styling) */}
          <div
            onClick={() => {
              setActiveTab('subnets');
              setSelectedSubnetId(null);
            }}
            className="flex items-center gap-2.5 shrink-0 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform bg-black shrink-0">
              <img src="/icon.png" alt="IP Manager Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-semibold text-base tracking-tight text-[#171717] dark:text-[#ededed] whitespace-nowrap group-hover:opacity-80 transition-opacity">
              IP Manager
            </span>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1 bg-[#f4f4f5] dark:bg-[#111111] p-1 rounded-xl border border-[#ebebeb] dark:border-[#262626] shadow-xs">
            <button
              id="nav-tab-subnets"
              onClick={() => {
                setActiveTab('subnets');
                setSelectedSubnetId(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'subnets'
                  ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                  : 'text-[#666666] dark:text-[#a1a1a1] hover:text-[#171717] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <Network className="w-3.5 h-3.5 shrink-0" />
              <span>Subnets &amp; IPs</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === 'subnets'
                    ? 'bg-white/20 text-current'
                    : 'bg-black/5 dark:bg-white/10 text-[#666666] dark:text-[#a1a1a1]'
                }`}
              >
                {subnets.length}
              </span>
            </button>

            {canSeeUsers && (
              <button
                id="nav-tab-users"
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'ldap_settings'
                    ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                    : 'text-[#666666] dark:text-[#a1a1a1] hover:text-[#171717] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <Server className="w-3.5 h-3.5 shrink-0" />
                <span>Active Directory</span>
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'device_classifications'
                    ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                    : 'text-[#666666] dark:text-[#a1a1a1] hover:text-[#171717] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span>Device Types</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                    activeTab === 'device_classifications'
                      ? 'bg-white/20 text-current'
                      : 'bg-black/5 dark:bg-white/10 text-[#666666] dark:text-[#a1a1a1]'
                  }`}
                >
                  {deviceClassifications.length}
                </span>
              </button>
            )}

            {canSeeAudit && (
              <button
                id="nav-tab-audit"
                onClick={() => setActiveTab('audit')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'backup_restore'
                    ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black shadow-xs'
                    : 'text-[#666666] dark:text-[#a1a1a1] hover:text-[#171717] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <Database className="w-3.5 h-3.5 shrink-0" />
                <span>Backup &amp; Restore</span>
              </button>
            )}
          </nav>

          {/* Right User & Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Dark / Light Mode Toggle */}
            <button
              id="btn-theme-toggle"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              aria-label="Toggle theme"
              className="p-2 rounded-lg border border-[#ebebeb] dark:border-[#262626] bg-white dark:bg-[#111111] text-[#171717] dark:text-[#ededed] hover:bg-[#f4f4f5] dark:hover:bg-[#1c1c1c] transition-colors cursor-pointer shadow-xs"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-[#4d4d4d]" />
              )}
            </button>

            {/* Assistant Action Button */}
            {currentUser && onToggleChatbot && (
              <button
                id="btn-navbar-chatbot"
                onClick={onToggleChatbot}
                title="Open IPAM Assistant (Ctrl+J)"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer shadow-xs ${
                  isChatbotOpen
                    ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black border-transparent'
                    : 'bg-white dark:bg-[#111111] text-[#171717] dark:text-[#ededed] border-[#ebebeb] dark:border-[#262626] hover:bg-[#f4f4f5] dark:hover:bg-[#1c1c1c]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#0070f3]" />
                <span className="hidden md:inline">Assistant</span>
              </button>
            )}

            {currentUser ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  id="user-menu-button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#111111] hover:bg-[#f4f4f5] dark:hover:bg-[#1c1c1c] border border-[#ebebeb] dark:border-[#262626] text-left transition-all shadow-xs cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-md bg-[#171717] text-white dark:bg-[#ededed] dark:text-black flex items-center justify-center font-bold text-xs shrink-0">
                    {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-medium text-[#171717] dark:text-[#ededed] truncate max-w-[120px]">
                      {currentUser.fullName || currentUser.username}
                    </span>
                    <span className="text-[10px] text-[#8f8f8f] dark:text-[#737373] leading-none">
                      {roleInfo?.label || currentUser.role}
                    </span>
                  </div>
                  {currentUser.authType === 'ldap_ad' ? (
                    <span className="text-[10px] px-1 py-0.2 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-medium flex items-center gap-0.5 shrink-0">
                      <Server className="w-2.5 h-2.5" />
                      AD
                    </span>
                  ) : (
                    <span className="text-[10px] px-1 py-0.2 rounded bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 font-medium flex items-center gap-0.5 shrink-0">
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
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="lg:hidden flex items-center gap-1 overflow-x-auto py-2 border-t border-[#ebebeb] dark:border-[#262626] scrollbar-none">
          <button
            onClick={() => {
              setActiveTab('subnets');
              setSelectedSubnetId(null);
            }}
            className={`text-xs px-2.5 py-1 rounded-md whitespace-nowrap font-medium transition-colors ${
              activeTab === 'subnets'
                ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black'
                : 'text-[#666666] dark:text-[#a1a1a1]'
            }`}
          >
            Subnets
          </button>
          {canSeeUsers && (
            <button
              onClick={() => setActiveTab('users')}
              className={`text-xs px-2.5 py-1 rounded-md whitespace-nowrap font-medium transition-colors ${
                activeTab === 'users'
                  ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black'
                  : 'text-[#666666] dark:text-[#a1a1a1]'
              }`}
            >
              Users
            </button>
          )}
          {canSeeLdap && (
            <button
              onClick={() => setActiveTab('ldap_settings')}
              className={`text-xs px-2.5 py-1 rounded-md whitespace-nowrap font-medium transition-colors ${
                activeTab === 'ldap_settings'
                  ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black'
                  : 'text-[#666666] dark:text-[#a1a1a1]'
              }`}
            >
              Active Directory
            </button>
          )}
          {canSeeDeviceTypes && (
            <button
              onClick={() => setActiveTab('device_classifications')}
              className={`text-xs px-2.5 py-1 rounded-md whitespace-nowrap font-medium transition-colors ${
                activeTab === 'device_classifications'
                  ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black'
                  : 'text-[#666666] dark:text-[#a1a1a1]'
              }`}
            >
              Device Types
            </button>
          )}
          {canSeeAudit && (
            <button
              onClick={() => setActiveTab('audit')}
              className={`text-xs px-2.5 py-1 rounded-md whitespace-nowrap font-medium transition-colors ${
                activeTab === 'audit'
                  ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black'
                  : 'text-[#666666] dark:text-[#a1a1a1]'
              }`}
            >
              Audit
            </button>
          )}
          {canSeeBackup && (
            <button
              onClick={() => setActiveTab('backup_restore')}
              className={`text-xs px-2.5 py-1 rounded-md whitespace-nowrap font-medium transition-colors ${
                activeTab === 'backup_restore'
                  ? 'bg-[#171717] text-white dark:bg-[#ededed] dark:text-black'
                  : 'text-[#666666] dark:text-[#a1a1a1]'
              }`}
            >
              Backup
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
