/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { IPAMProvider, useIPAM } from './context/IPAMContext';
import { Navbar } from './components/Navbar';
import { SubnetList } from './components/SubnetList';
import { SubnetDetailView } from './components/SubnetDetailView';
import { UserManagement } from './components/UserManagement';
import { LdapSettingsView } from './components/LdapSettingsModal';
import { DeviceClassificationView } from './components/DeviceClassificationView';
import { AuditLogsView } from './components/AuditLogsView';
import { BackupRestoreView } from './components/BackupRestoreView';
import { LoginModal } from './components/LoginModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { IPAMChatbot } from './components/IPAMChatbot';
import { Shield } from 'lucide-react';

const IPAMAppContent: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    selectedSubnetId,
    setSelectedSubnetId,
    currentUser,
    subnets,
  } = useIPAM();

  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [chatbotOpen, setChatbotOpen] = useState(false);

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

  // Auto-redirect away from unauthorized tabs
  React.useEffect(() => {
    if (!currentUser) return;
    if (activeTab === 'users' && !canSeeUsers) {
      setActiveTab('subnets');
    } else if (activeTab === 'ldap_settings' && !canSeeLdap) {
      setActiveTab('subnets');
    } else if (activeTab === 'device_classifications' && !canSeeDeviceTypes) {
      setActiveTab('subnets');
    } else if (activeTab === 'audit' && !canSeeAudit) {
      setActiveTab('subnets');
    } else if (activeTab === 'backup_restore' && !canSeeBackup) {
      setActiveTab('subnets');
    }
  }, [currentUser?.role, activeTab, canSeeUsers, canSeeLdap, canSeeDeviceTypes, canSeeAudit, canSeeBackup, setActiveTab]);

  // If user is not authenticated, render the dedicated full-screen login portal
  if (!currentUser) {
    return <LoginModal isOpen={true} onClose={() => {}} fullScreen={true} />;
  }

  // If user is restricted to specific subnets, show a friendly banner
  const isRestricted =
    currentUser &&
    currentUser.permissions.allowedSubnetIds &&
    currentUser.permissions.allowedSubnetIds.length > 0;

  return (
    <div className="min-h-screen w-full bg-[#fafafa] text-[#171717] dark:bg-[#000000] dark:text-[#ededed] flex flex-col font-sans selection:bg-[#0070f3] selection:text-white overflow-x-hidden transition-colors">
      {/* Top Navigation */}
      <Navbar
        onOpenLogin={() => setLoginModalOpen(true)}
        onOpenChangePassword={() => setChangePasswordModalOpen(true)}
        onToggleChatbot={() => setChatbotOpen((prev) => !prev)}
        isChatbotOpen={chatbotOpen}
      />

      {/* Role / Scope Notice Banner */}
      {isRestricted && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 px-4 py-2 text-xs text-amber-900 dark:text-amber-300">
          <div className="w-full max-w-[1720px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Restricted Role Access:</strong> Your account is scoped to{' '}
                {currentUser.permissions.allowedSubnetIds.length} specific subnet range(s) (
                {currentUser.permissions.allowedSubnetIds
                  .map((id) => subnets.find((s) => s.id === id)?.name || id)
                  .join(', ')}
                ).
              </span>
            </div>
            <span className="text-[11px] font-mono text-amber-700 dark:text-amber-400/80">RBAC Enforced</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'subnets' && (
          selectedSubnetId ? (
            <SubnetDetailView
              subnetId={selectedSubnetId}
              onBack={() => setSelectedSubnetId(null)}
            />
          ) : (
            <SubnetList
              onSelectSubnet={(id) => setSelectedSubnetId(id)}
              onOpenDeviceClassifications={() => setActiveTab('device_classifications')}
            />
          )
        )}

        {activeTab === 'users' && (canSeeUsers ? <UserManagement /> : <AccessDenied tabName="User Accounts" />)}

        {activeTab === 'ldap_settings' && (canSeeLdap ? <LdapSettingsView /> : <AccessDenied tabName="Active Directory / LDAP Settings" />)}

        {activeTab === 'device_classifications' && (canSeeDeviceTypes ? <DeviceClassificationView /> : <AccessDenied tabName="Device Types & Classifications" />)}

        {activeTab === 'audit' && (canSeeAudit ? <AuditLogsView /> : <AccessDenied tabName="Security Audit Logs" />)}
        {activeTab === 'backup_restore' && (canSeeBackup ? <BackupRestoreView /> : <AccessDenied tabName="Backup & Restore" />)}
      </main>


      {/* Switch / Relogin Modal */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        fullScreen={false}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={changePasswordModalOpen}
        onClose={() => setChangePasswordModalOpen(false)}
      />

      {/* Local Assistant Chatbot */}
      <IPAMChatbot
        isOpen={chatbotOpen}
        onToggle={() => setChatbotOpen((prev) => !prev)}
      />
    </div>
  );
};

const AccessDenied: React.FC<{ tabName: string }> = ({ tabName }) => {
  const { setActiveTab } = useIPAM();
  return (
    <div className="py-16 text-center bg-white dark:bg-[#0c0c0c] border border-[#ebebeb] dark:border-[#262626] rounded-2xl max-w-md mx-auto p-8 shadow-xs my-12 text-[#171717] dark:text-[#ededed]">
      <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-500/20">
        <Shield className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-semibold text-[#171717] dark:text-white">Access Restricted</h3>
      <p className="text-xs text-[#666666] dark:text-[#a1a1a1] mt-2 leading-relaxed">
        Your role permissions do not permit viewing <strong>{tabName}</strong>. This module is reserved for system administrators.
      </p>
      <button
        onClick={() => setActiveTab('subnets')}
        className="mt-6 px-4 py-2 rounded-lg bg-[#171717] hover:opacity-90 dark:bg-[#ededed] dark:text-black dark:hover:bg-white text-xs font-medium text-white transition-colors shadow-xs"
      >
        Return to Subnets &amp; IPs
      </button>
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <IPAMProvider>
        <IPAMAppContent />
      </IPAMProvider>
    </ThemeProvider>
  );
}
