import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { LdapConfig } from '../types';
import {
  Server,
  ShieldCheck,
  Zap,
  CheckCircle2,
  RefreshCw,
  Terminal,
  Lock,
  Users,
  Shield,
  Layers,
} from 'lucide-react';

export const LdapSettingsView: React.FC = () => {
  const {
    ldapConfig,
    updateLdapConfig,
    testLdapConnection,
    hasPermission,
    users,
  } = useIPAM();

  const [config, setConfig] = useState<LdapConfig>({ ...ldapConfig });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    diagnostics: string[];
    responseTimeMs: number;
    error?: string;
  } | null>(null);

  const [savedSuccess, setSavedSuccess] = useState(false);

  const canManageAuth = hasPermission('manageAuthSettings');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageAuth) return;

    updateLdapConfig(config);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testLdapConnection(config);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        diagnostics: ['[!] Exception occurred during connection attempt: ' + err.message],
        responseTimeMs: 0,
        error: err.message,
      });
    } finally {
      setTesting(false);
    }
  };

  const registeredAdUsers = users.filter((u) => u.authType === 'ldap_ad');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Active Directory / LDAP Authentication
            </h2>
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium flex items-center gap-1 ${
                config.enabled
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800'
                  : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${config.enabled ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-slate-400 dark:bg-slate-500'}`}
              />
              {config.enabled ? 'Integration Active' : 'Disabled'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Delegate user authentication and group authorization to Microsoft Active Directory (AD DS), Azure AD Domain Services, or OpenLDAP.
          </p>
        </div>

        {canManageAuth && (
          <div className="flex items-center gap-3">
            <button
              onClick={runTest}
              disabled={testing || !config.serverUrl}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Zap className={`w-3.5 h-3.5 text-amber-300 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Testing Connection...' : 'Test Connection'}</span>
            </button>
          </div>
        )}
      </div>

      {!canManageAuth && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-3 shadow-xs">
          <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Read-Only Configuration Mode</p>
            <p className="text-[11px] text-amber-800 dark:text-amber-300/80 mt-0.5">
              Your account lacks the <code className="bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded text-amber-900 dark:text-amber-200 font-mono">manageAuthSettings</code> permission required to modify Active Directory / LDAP parameters.
            </p>
          </div>
        </div>
      )}

      {savedSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Active Directory settings updated successfully.</span>
        </div>
      )}

      {/* Main Form & Terminal Diagnostics Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: LDAP Server Configuration */}
        <div className="lg:col-span-7 bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <form onSubmit={handleSave} className="space-y-5">
            {/* Enable switch */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="font-semibold text-slate-900 dark:text-white text-sm">
                  Enable Active Directory / LDAP Integration
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Allow users with &quot;LDAP / Active Directory&quot; auth type to bind and authenticate.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canManageAuth}
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Server Connection Parameters */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Directory Controller &amp; Domain
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Server URL (LDAP / LDAPS)
                  </label>
                  <input
                    type="text"
                    disabled={!canManageAuth}
                    value={config.serverUrl}
                    onChange={(e) => setConfig({ ...config, serverUrl: e.target.value })}
                    placeholder="ldaps://dc01.corp.domain.com:636"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-mono focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Port 636 for LDAPS (SSL/TLS) or 389 for StartTLS
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Active Directory Domain (FQDN)
                  </label>
                  <input
                    type="text"
                    disabled={!canManageAuth}
                    value={config.domain}
                    onChange={(e) => setConfig({ ...config, domain: e.target.value })}
                    placeholder="CORP.DOMAIN.COM"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-mono focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Kerberos realm &amp; forest root
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    NetBIOS Domain Name
                  </label>
                  <input
                    type="text"
                    disabled={!canManageAuth}
                    value={config.adNetbiosDomain || ''}
                    onChange={(e) => setConfig({ ...config, adNetbiosDomain: e.target.value })}
                    placeholder="CORP"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Base Search DN
                  </label>
                  <input
                    type="text"
                    disabled={!canManageAuth}
                    value={config.baseDn}
                    onChange={(e) => setConfig({ ...config, baseDn: e.target.value })}
                    placeholder="DC=corp,DC=domain,DC=com"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Service Account Bind Credentials */}
            <div className="space-y-4 pt-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Service Account (Search / Bind Identity)
              </h4>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bind Distinguished Name (DN)
                </label>
                <input
                  type="text"
                  disabled={!canManageAuth}
                  value={config.bindDn}
                  onChange={(e) => setConfig({ ...config, bindDn: e.target.value })}
                  placeholder="CN=ipam-svc,OU=ServiceAccounts,DC=corp,DC=domain,DC=com"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bind Account Password
                  </label>
                  <input
                    type="password"
                    disabled={!canManageAuth}
                    value={config.bindPassword}
                    onChange={(e) => setConfig({ ...config, bindPassword: e.target.value })}
                    placeholder="••••••••••••••••"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    User Search Filter
                  </label>
                  <input
                    type="text"
                    disabled={!canManageAuth}
                    value={config.userSearchFilter}
                    onChange={(e) => setConfig({ ...config, userSearchFilter: e.target.value })}
                    placeholder="(&(objectCategory=person)(sAMAccountName={username}))"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* TLS Options */}
            <div className="pt-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canManageAuth}
                  checked={config.useTls}
                  onChange={(e) => setConfig({ ...config, useTls: e.target.checked })}
                  className="rounded border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span>Enforce LDAPS TLS 1.3 Encryption &amp; Certificate Check</span>
              </label>

              <span className="text-[11px] text-slate-500">
                Timeout: {config.timeoutMs}ms
              </span>
            </div>

            {/* Submit */}
            {canManageAuth && (
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-colors cursor-pointer"
                >
                  Save Active Directory Settings
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Right Column: Connection Diagnostics & Group Policy Mappings */}
        <div className="lg:col-span-5 space-y-6">
          {/* Diagnostic Console Box */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs shadow-inner">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-slate-400">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-400" />
                <span className="font-semibold text-slate-200">LDAP Diagnostic Stream</span>
              </div>
              {testResult && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    testResult.success
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}
                >
                  {testResult.success ? `PASS (${testResult.responseTimeMs}ms)` : 'FAIL'}
                </span>
              )}
            </div>

            <div className="py-3 space-y-1.5 min-h-[140px] text-[11px] text-slate-300 overflow-y-auto max-h-52">
              {testing ? (
                <div className="flex items-center gap-2 text-amber-400 py-4 justify-center">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Negotiating TLS socket connection with {config.serverUrl}...</span>
                </div>
              ) : testResult ? (
                testResult.diagnostics.map((line, idx) => (
                  <div
                    key={idx}
                    className={
                      line.startsWith('[+]')
                        ? 'text-emerald-400'
                        : line.startsWith('[-]')
                        ? 'text-rose-400'
                        : line.startsWith('[!]')
                        ? 'text-amber-400'
                        : 'text-slate-400'
                    }
                  >
                    {line}
                  </div>
                ))
              ) : (
                <div className="text-slate-500 py-8 text-center italic">
                  Click &quot;Test Connection&quot; above to execute real DNS resolution and TCP socket diagnostics against the configured directory controller.
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
              <span>Target: {config.serverUrl || 'Not configured'}</span>
              <span>Realm: {config.domain || 'Not configured'}</span>
            </div>
          </div>

          {/* Active Directory Group Role Policy */}
          <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  AD Security Group Role Mapping
                </h4>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">RBAC Policy</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-200">Domain Admins</span>
                  <p className="text-[10px] text-slate-500 font-mono">CN=IPAM-SuperAdmins,OU=Groups</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800 text-[10px] font-medium">
                  Super Admin
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-200">Network Engineers</span>
                  <p className="text-[10px] text-slate-500 font-mono">CN=IPAM-NetworkAdmins,OU=Groups</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 text-[10px] font-medium">
                  Network Admin
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-200">NOC Operators</span>
                  <p className="text-[10px] text-slate-500 font-mono">CN=IPAM-Operators,OU=Groups</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 text-[10px] font-medium">
                  Operator
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-200">Compliance Auditors</span>
                  <p className="text-[10px] text-slate-500 font-mono">CN=IPAM-Auditors,OU=Groups</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800 text-[10px] font-medium">
                  Auditor
                </span>
              </div>
            </div>
          </div>

          {/* Registered Directory Users in IPAM */}
          <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Registered Directory Users ({registeredAdUsers.length})
                </h4>
              </div>
              <span className="text-[10px] text-slate-500">Active Directory Auth</span>
            </div>

            {registeredAdUsers.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No Active Directory users registered yet. You can create and assign Active Directory accounts from the Users tab.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {registeredAdUsers.map((u) => (
                  <div
                    key={u.id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">{u.fullName || u.username}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{u.ldapUpn || u.email || u.username}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] capitalize">
                      {u.role.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
