import React, { useState, useRef, useMemo } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { IPAMBackupData, RestoreOptions } from '../types';
import {
  Database,
  Download,
  Upload,
  FileJson,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Network,
  Users,
  Server,
  Layers,
  FileText,
  Copy,
  Check,
  RotateCcw,
  Sliders,
  Archive,
  Info,
} from 'lucide-react';

export const BackupRestoreView: React.FC = () => {
  const {
    currentUser,
    subnets,
    ips,
    users,
    ldapConfig,
    deviceClassifications,
    projects,
    auditLogs,
    auditSettings,
    createBackupPackage,
    exportBackupToFile,
    restoreFromBackup,
    resetData,
    hasPermission,
  } = useIPAM();

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const canExport = isSuperAdmin || currentUser?.role === 'network_admin' || hasPermission('exportData');

  // Export State
  const [includeAuditInExport, setIncludeAuditInExport] = useState(true);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);

  // Import State
  const [uploadedBackup, setUploadedBackup] = useState<IPAMBackupData | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [rawJsonInput, setRawJsonInput] = useState<string>('');
  const [activeImportMode, setActiveImportMode] = useState<'file' | 'paste'>('file');

  // Restore Options
  const [restoreOptions, setRestoreOptions] = useState<RestoreOptions>({
    restoreSubnets: true,
    restoreIPs: true,
    restoreUsers: true,
    restoreLdap: true,
    restoreDeviceClasses: true,
    restoreProjects: true,
    restoreAuditLogs: true,
    restoreAuditSettings: true,
    restoreSnmpConfig: true,
    mode: 'overwrite',
  });
  const [createSafetyBackupFirst, setCreateSafetyBackupFirst] = useState(true);

  // Status & Modal States
  const [confirmRestoreModalOpen, setConfirmRestoreModalOpen] = useState(false);
  const [restoreSuccessResult, setRestoreSuccessResult] = useState<string | null>(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live backup package preview (only computed on-demand when preview is open)
  const liveBackup = useMemo(() => {
    if (!showExportPreview) return null;
    return createBackupPackage(includeAuditInExport);
  }, [showExportPreview, includeAuditInExport, createBackupPackage]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFileName(file.name);
    setValidationError(null);
    setRestoreSuccessResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        parseAndValidateJson(text);
      } catch (err: any) {
        setValidationError(`Failed to read file: ${err.message || 'Unknown error'}`);
        setUploadedBackup(null);
      }
    };
    reader.readAsText(file);
  };

  const handlePasteParse = () => {
    if (!rawJsonInput.trim()) {
      setValidationError('Please paste valid backup JSON text.');
      return;
    }
    setUploadFileName('Pasted JSON Payload');
    setValidationError(null);
    setRestoreSuccessResult(null);
    parseAndValidateJson(rawJsonInput);
  };

  const parseAndValidateJson = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Root JSON payload must be an object.');
      }

      // Check schema properties
      if (!parsed.data && !parsed.subnets) {
        throw new Error('Unrecognized backup structure: Missing "data" or "subnets" container.');
      }

      // Normalize if standard or legacy format
      const rawClasses = parsed.data?.deviceClassifications || parsed.deviceClassifications || [];
      const normalizedClasses = Array.isArray(rawClasses)
        ? rawClasses
            .filter((d: any) => d && typeof d === 'object' && (d.name || d.code))
            .map((d: any) => ({
              id: d.id || `devclass-${(d.code || d.name || 'custom').toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              name: String(d.name || 'Unnamed Classification'),
              code: String(d.code || d.name || 'custom').toLowerCase().trim(),
              category: String(d.category || 'Custom Appliance'),
              description: String(d.description || ''),
              icon: String(d.icon || 'server'),
              color: String(d.color || 'blue'),
              vendor: String(d.vendor || ''),
              defaultPorts: String(d.defaultPorts || ''),
              snmpEnabled: d.snmpEnabled !== false,
              createdAt: d.createdAt || new Date().toISOString(),
              updatedAt: d.updatedAt || new Date().toISOString(),
            }))
        : [];

      const rawProjects = parsed.data?.projects || parsed.projects || [];
      const normalizedProjects = Array.isArray(rawProjects)
        ? rawProjects
            .filter((p: any) => p && typeof p === 'object' && (p.name || p.code))
            .map((p: any) => ({
              id: p.id || `prj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              name: String(p.name || 'Unnamed Project'),
              code: String(p.code || 'PRJ').toUpperCase().trim(),
              category: String(p.category || 'General'),
              description: String(p.description || ''),
              notes: String(p.notes || ''),
              tags: Array.isArray(p.tags) ? p.tags : [],
              icon: String(p.icon || 'folder'),
              color: String(p.color || 'indigo'),
              status: p.status === 'archived' ? ('archived' as const) : ('active' as const),
              owner: String(p.owner || 'admin'),
              department: String(p.department || 'IT'),
              createdAt: p.createdAt || new Date().toISOString(),
              updatedAt: p.updatedAt || new Date().toISOString(),
            }))
        : [];

      const rawSnmp = parsed.data?.snmpConfig || parsed.snmpConfig;

      const normalizedData: IPAMBackupData = {
        version: parsed.version || '2.0.0',
        timestamp: parsed.timestamp || new Date().toISOString(),
        exportedBy: parsed.exportedBy || {
          username: 'imported-file',
          fullName: 'External Backup',
          role: 'admin',
        },
        metadata: parsed.metadata || {
          appName: 'Enterprise IPAM',
          totalSubnets: (parsed.data?.subnets || parsed.subnets || []).length,
          totalIPs: (parsed.data?.ips || parsed.ips || []).length,
          totalUsers: (parsed.data?.users || parsed.users || []).length,
          totalDeviceClassifications: normalizedClasses.length,
          totalProjects: normalizedProjects.length,
          totalAuditLogs: (parsed.data?.auditLogs || parsed.auditLogs || []).length,
          ldapConfigured: !!(parsed.data?.ldapConfig?.enabled || parsed.ldapConfig?.enabled),
          hasSnmpConfig: !!rawSnmp,
        },
        data: {
          subnets: Array.isArray(parsed.data?.subnets) ? parsed.data.subnets : Array.isArray(parsed.subnets) ? parsed.subnets : [],
          ips: Array.isArray(parsed.data?.ips) ? parsed.data.ips : Array.isArray(parsed.ips) ? parsed.ips : [],
          users: Array.isArray(parsed.data?.users) ? parsed.data.users : Array.isArray(parsed.users) ? parsed.users : [],
          ldapConfig: parsed.data?.ldapConfig || parsed.ldapConfig || ldapConfig,
          deviceClassifications: normalizedClasses,
          projects: normalizedProjects,
          auditLogs: Array.isArray(parsed.data?.auditLogs) ? parsed.data.auditLogs : Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
          auditSettings: parsed.data?.auditSettings || parsed.auditSettings || auditSettings,
          snmpConfig: rawSnmp && typeof rawSnmp === 'object' ? rawSnmp : undefined,
        },
      };

      setUploadedBackup(normalizedData);
      setValidationError(null);
    } catch (err: any) {
      setValidationError(`JSON Validation Failed: ${err.message}`);
      setUploadedBackup(null);
    }
  };

  const handleCopyBackup = () => {
    const pkg = liveBackup || createBackupPackage(includeAuditInExport);
    navigator.clipboard.writeText(JSON.stringify(pkg, null, 2));
    setCopiedBackup(true);
    setTimeout(() => setCopiedBackup(false), 2500);
  };

  const executeRestore = () => {
    if (!uploadedBackup) return;

    if (createSafetyBackupFirst) {
      // Trigger a silent export of current state before restoring
      exportBackupToFile(true);
    }

    const res = restoreFromBackup(uploadedBackup, restoreOptions);
    setConfirmRestoreModalOpen(false);
    if (res.success) {
      setRestoreSuccessResult(res.message);
      // Clean up file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } else {
      setValidationError(res.message);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header Banner */}
      <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-cyan-500/10 dark:bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-cyan-900/20">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">System Backup &amp; Disaster Recovery</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Export complete snapshots of subnets, IPs, users, Active Directory/LDAP settings, and device classifications
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 text-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">Subnets</span>
              <span className="text-lg font-bold text-cyan-600 dark:text-cyan-400">{subnets.length}</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 text-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">Allocated IPs</span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{ips.length}</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 text-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">Projects</span>
              <span className="text-lg font-bold text-violet-600 dark:text-violet-400">{projects.length}</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 text-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">User Accounts</span>
              <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{users.length}</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 text-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">AD / LDAP</span>
              <span className={`text-xs font-bold inline-flex items-center gap-1 mt-1 ${ldapConfig.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                {ldapConfig.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Restore Success Toast / Banner */}
      {restoreSuccessResult && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-4 flex items-start justify-between gap-3 text-emerald-800 dark:text-emerald-200 animate-in fade-in">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">System Restored Successfully</h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-300/90 mt-0.5">{restoreSuccessResult}</p>
            </div>
          </div>
          <button
            onClick={() => setRestoreSuccessResult(null)}
            className="text-xs text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 font-medium underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Two Columns: Backup (Export) & Restore (Import) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ========================================================= */}
        {/* COLUMN 1: BACKUP (EXPORT EVERYTHING) */}
        {/* ========================================================= */}
        <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Export Full Backup</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Download complete system state as a verifiable JSON package</p>
                </div>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono">
                JSON v1.4
              </span>
            </div>

            {/* Included in Backup Checklist */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                Included in Backup Archive
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-200">
                  <Network className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                  <div className="truncate">
                    <span className="font-semibold text-slate-900 dark:text-white">{subnets.length}</span> Subnets &amp; VLANs
                  </div>
                </div>
                <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-200">
                  <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div className="truncate">
                    <span className="font-semibold text-slate-900 dark:text-white">{ips.length}</span> IP Allocations
                  </div>
                </div>
                <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-200">
                  <Archive className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                  <div className="truncate">
                    <span className="font-semibold text-slate-900 dark:text-white">{projects.length}</span> Projects &amp; Workloads
                  </div>
                </div>
                <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-200">
                  <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <div className="truncate">
                    <span className="font-semibold text-slate-900 dark:text-white">{users.length}</span> User Accounts &amp; Roles
                  </div>
                </div>
                <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-200">
                  <Server className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="truncate">
                    Active Directory / LDAP Config
                  </div>
                </div>
                <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-200">
                  <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  <div className="truncate">
                    <span className="font-semibold text-slate-900 dark:text-white">{deviceClassifications.length}</span> Device Classes
                  </div>
                </div>
                <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-200">
                  <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="truncate">
                    <span className="font-semibold text-slate-900 dark:text-white">{auditLogs.length}</span> Security Audit Logs
                  </div>
                </div>
              </div>
            </div>

            {/* Export Configuration Option */}
            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5 space-y-2">
              <label className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span className="font-medium">Include Security Audit Trail in backup</span>
                </span>
                <input
                  type="checkbox"
                  checked={includeAuditInExport}
                  onChange={(e) => setIncludeAuditInExport(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:ring-blue-500"
                />
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-6">
                Uncheck to produce a smaller file containing only infrastructure and configuration data.
              </p>
            </div>

            {/* Manifest Quick Details */}
            <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/60 rounded-xl p-3.5 text-xs text-slate-600 dark:text-slate-400 space-y-1 font-mono">
              <div className="flex justify-between">
                <span>Backup Format:</span>
                <span className="text-slate-900 dark:text-slate-300 font-medium">JSON (Universal IPAM Snapshot)</span>
              </div>
              <div className="flex justify-between">
                <span>Generated By:</span>
                <span className="text-slate-900 dark:text-slate-300 font-medium">@{currentUser?.username || 'system'}</span>
              </div>
              <div className="flex justify-between">
                <span>Timestamp:</span>
                <span className="text-slate-900 dark:text-slate-300 font-medium">{new Date().toLocaleString()}</span>
              </div>
            </div>

            {/* Live Manifest Preview Toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowExportPreview(!showExportPreview)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>{showExportPreview ? 'Hide JSON Manifest Preview' : 'Inspect JSON Manifest Payload'}</span>
              </button>

              {showExportPreview && (
                <div className="mt-3 relative">
                  <div className="max-h-56 overflow-auto bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-[11px] font-mono text-slate-800 dark:text-slate-300">
                    <pre>{JSON.stringify(liveBackup, null, 2)}</pre>
                  </div>
                  <button
                    onClick={handleCopyBackup}
                    className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700 text-[10px] font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                  >
                    {copiedBackup ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-slate-400" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Export Action Buttons */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              id="btn-download-full-backup"
              disabled={!canExport}
              onClick={() => exportBackupToFile(includeAuditInExport)}
              className={`w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm shadow-xs transition-all ${
                canExport
                  ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer active:scale-[0.99]'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'
              }`}
            >
              {canExport ? <Download className="w-4 h-4" /> : <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
              <span>{canExport ? 'Download Full System Backup (.json)' : 'Export Data Locked (exportData required)'}</span>
            </button>

            {canExport && (
              <button
                onClick={handleCopyBackup}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                {copiedBackup ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedBackup ? 'Copied to Clipboard' : 'Copy Backup JSON to Clipboard'}</span>
              </button>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* COLUMN 2: RESTORE (IMPORT EVERYTHING) */}
        {/* ========================================================= */}
        <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Restore Everything</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Restore subnets, IPs, users, and settings from a backup file</p>
                </div>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono">
                Disaster Recovery
              </span>
            </div>

            {/* Input Mode Selector: Upload File vs Paste JSON */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setActiveImportMode('file')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeImportMode === 'file' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File (.json)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveImportMode('paste')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeImportMode === 'paste' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>Paste JSON</span>
              </button>
            </div>

            {/* Mode 1: File Upload */}
            {activeImportMode === 'file' && (
              <div className="space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                  id="backup-file-input"
                />
                <label
                  htmlFor="backup-file-input"
                  className="border-2 border-dashed border-slate-300 hover:border-blue-500/60 dark:border-slate-700 dark:hover:border-blue-500/60 bg-slate-50/50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-950/80 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-600/10 dark:group-hover:bg-blue-600/20 text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center justify-center mb-3 transition-colors">
                    <FileJson className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-semibold text-slate-800 group-hover:text-slate-900 dark:text-slate-200 dark:group-hover:text-white">
                    {uploadFileName || 'Select or Drag & Drop Backup File'}
                  </span>
                  <span className="text-xs text-slate-500 mt-1">Supports JSON backup files generated by IP Manager</span>
                </label>
              </div>
            )}

            {/* Mode 2: Paste JSON */}
            {activeImportMode === 'paste' && (
              <div className="space-y-2">
                <textarea
                  rows={5}
                  value={rawJsonInput}
                  onChange={(e) => setRawJsonInput(e.target.value)}
                  placeholder="Paste raw IPAM backup JSON payload here..."
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={handlePasteParse}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Parse &amp; Inspect JSON
                </button>
              </div>
            )}

            {/* Validation Error Message */}
            {validationError && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl p-3 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Pre-Restore Inspection Manifest */}
            {uploadedBackup && (
              <div className="bg-slate-50 dark:bg-slate-950/70 border border-emerald-500/30 rounded-xl p-4 space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Backup Verified: {uploadedBackup.metadata?.appName || 'Enterprise IPAM'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    Exported {new Date(uploadedBackup.timestamp).toLocaleDateString()}
                  </span>
                </div>

                {/* Inspect detected items */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-center">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Subnets</span>
                    <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400">
                      {uploadedBackup.data.subnets?.length || 0}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-center">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">IP Records</span>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      {uploadedBackup.data.ips?.length || 0}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-center">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Projects</span>
                    <span className="text-sm font-bold text-violet-600 dark:text-violet-400">
                      {uploadedBackup.data.projects?.length || 0}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-center">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Users</span>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      {uploadedBackup.data.users?.length || 0}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-center">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Device Classes</span>
                    <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                      {uploadedBackup.data.deviceClassifications?.length || 0}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-center">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Audit Entries</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {uploadedBackup.data.auditLogs?.length || 0}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-center">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">LDAP Status</span>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block mt-0.5">
                      {uploadedBackup.data.ldapConfig?.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                </div>

                {/* Granular Restore Options */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Restore Components
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="restoreMode"
                          checked={restoreOptions.mode === 'overwrite'}
                          onChange={() => setRestoreOptions({ ...restoreOptions, mode: 'overwrite' })}
                          className="text-blue-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                        />
                        <span>Complete Overwrite (Clean Slate)</span>
                      </label>
                      <label className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="restoreMode"
                          checked={restoreOptions.mode === 'merge'}
                          onChange={() => setRestoreOptions({ ...restoreOptions, mode: 'merge' })}
                          className="text-blue-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                        />
                        <span>Merge &amp; Update</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restoreOptions.restoreSubnets}
                        onChange={(e) => setRestoreOptions({ ...restoreOptions, restoreSubnets: e.target.checked })}
                        className="rounded text-blue-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                      />
                      <span>Subnets &amp; Ranges</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restoreOptions.restoreIPs}
                        onChange={(e) => setRestoreOptions({ ...restoreOptions, restoreIPs: e.target.checked })}
                        className="rounded text-blue-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                      />
                      <span>IP Allocations</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restoreOptions.restoreProjects !== false}
                        onChange={(e) => setRestoreOptions({ ...restoreOptions, restoreProjects: e.target.checked })}
                        className="rounded text-blue-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                      />
                      <span>Projects &amp; Workloads</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restoreOptions.restoreUsers}
                        onChange={(e) => setRestoreOptions({ ...restoreOptions, restoreUsers: e.target.checked })}
                        className="rounded text-blue-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                      />
                      <span>User Accounts &amp; RBAC</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restoreOptions.restoreLdap}
                        onChange={(e) => setRestoreOptions({ ...restoreOptions, restoreLdap: e.target.checked })}
                        className="rounded text-blue-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                      />
                      <span>Active Directory / LDAP</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restoreOptions.restoreDeviceClasses}
                        onChange={(e) => setRestoreOptions({ ...restoreOptions, restoreDeviceClasses: e.target.checked })}
                        className="rounded text-blue-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                      />
                      <span>Device Classifications</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restoreOptions.restoreAuditLogs}
                        onChange={(e) => setRestoreOptions({ ...restoreOptions, restoreAuditLogs: e.target.checked })}
                        className="rounded text-blue-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                      />
                      <span>Security Audit Logs</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restoreOptions.restoreSnmpConfig !== false}
                        onChange={(e) => setRestoreOptions({ ...restoreOptions, restoreSnmpConfig: e.target.checked })}
                        className="rounded text-blue-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                      />
                      <span>SNMP &amp; Telemetry Config</span>
                    </label>
                  </div>

                  {/* Safety Guard Option */}
                  <label className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300/90 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createSafetyBackupFirst}
                      onChange={(e) => setCreateSafetyBackupFirst(e.target.checked)}
                      className="rounded text-amber-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                    />
                    <span>Automatically download a safety backup before applying restore</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Restore Action Buttons */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            {!isSuperAdmin && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Restoration and Disaster Recovery require System Administrator (super_admin) credentials.</span>
              </div>
            )}

            <button
              id="btn-trigger-restore"
              disabled={!isSuperAdmin || !uploadedBackup}
              onClick={() => setConfirmRestoreModalOpen(true)}
              className={`w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm shadow-xs transition-all ${
                isSuperAdmin && uploadedBackup
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-[0.99]'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 cursor-not-allowed border border-slate-200 dark:border-slate-700'
              }`}
            >
              {isSuperAdmin ? <RotateCcw className="w-4 h-4" /> : <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
              <span>
                {!isSuperAdmin
                  ? 'Restore Locked (Super Admin Required)'
                  : uploadedBackup
                  ? `Restore Selected Everything (${uploadedBackup.data.subnets?.length || 0} Subnets, ${uploadedBackup.data.ips?.length || 0} IPs)`
                  : 'Select a Backup File to Restore'}
              </span>
            </button>

            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Looking for default baseline database?</span>
              {isSuperAdmin ? (
                <button
                  onClick={() => setResetModalOpen(true)}
                  className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 underline font-medium cursor-pointer"
                >
                  Reset to Default System State
                </button>
              ) : (
                <span className="text-slate-500 font-mono text-[11px] flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Super Admin Only
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Restore */}
      {confirmRestoreModalOpen && uploadedBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl text-slate-900 dark:text-slate-100 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Confirm System Restore</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  You are about to restore everything from backup ({uploadFileName || 'Selected Archive'})
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs space-y-2 text-slate-700 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-white">The following datasets will be applied:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
                {restoreOptions.restoreSubnets && (
                  <li>
                    <strong className="text-slate-900 dark:text-slate-200">{uploadedBackup.data.subnets?.length || 0} Subnets</strong>{' '}
                    ({restoreOptions.mode === 'overwrite' ? 'replacing existing subnets' : 'merging with current'})
                  </li>
                )}
                {restoreOptions.restoreIPs && (
                  <li>
                    <strong className="text-slate-900 dark:text-slate-200">{uploadedBackup.data.ips?.length || 0} IP Allocations</strong>
                  </li>
                )}
                {restoreOptions.restoreProjects && (
                  <li>
                    <strong className="text-slate-900 dark:text-slate-200">
                      {uploadedBackup.data.projects?.length || 0} Projects &amp; Workload Containers
                    </strong>
                  </li>
                )}
                {restoreOptions.restoreUsers && (
                  <li>
                    <strong className="text-slate-900 dark:text-slate-200">{uploadedBackup.data.users?.length || 0} User Accounts</strong>{' '}
                    and assigned permission matrices
                  </li>
                )}
                {restoreOptions.restoreLdap && (
                  <li>
                    <strong className="text-slate-900 dark:text-slate-200">Active Directory / LDAP Config</strong>{' '}
                    (Status: {uploadedBackup.data.ldapConfig?.enabled ? 'Active' : 'Disabled'})
                  </li>
                )}
                {restoreOptions.restoreDeviceClasses && (
                  <li>
                    <strong className="text-slate-900 dark:text-slate-200">
                      {uploadedBackup.data.deviceClassifications?.length || 0} Device Classification Rules
                    </strong>
                  </li>
                )}
                {restoreOptions.restoreAuditLogs && (
                  <li>
                    <strong className="text-slate-900 dark:text-slate-200">
                      {uploadedBackup.data.auditLogs?.length || 0} Historical Audit Log Entries
                    </strong>
                  </li>
                )}
              </ul>
              {createSafetyBackupFirst && (
                <div className="pt-2 text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>A safety backup of current state will download automatically before restore.</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRestoreModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeRestore}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer"
              >
                Yes, Restore Everything Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Reset to Factory Demo */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#0c0c0c] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Reset to Default System State?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              This will reset the system configuration and restore initial enterprise subnets, IP ranges, system accounts, and default settings.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setResetModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  resetData();
                  setResetModalOpen(false);
                  setRestoreSuccessResult('Restored baseline system database.');
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
