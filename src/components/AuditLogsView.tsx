import React, { useState } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { AuditSeverity } from '../types';
import {
  Search,
  Download,
  Shield,
  Server,
  Lock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Clock,
  RotateCw,
  Trash2,
  Sliders,
  Pause,
  Play,
  Calendar,
  Archive,
  RefreshCw,
  X,
} from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const {
    auditLogs,
    auditSettings,
    currentUser,
    hasPermission,
    updateAuditSettings,
    clearAllAuditLogs,
    clearAuditLogsOlderThan,
    rotateAuditLogs,
  } = useIPAM();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // Modals & Feedback state
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: 'success' | 'info' | 'warning' | 'error' } | null>(null);

  // Form states for settings modal
  const [tempLoggingEnabled, setTempLoggingEnabled] = useState(auditSettings.loggingEnabled);
  const [tempRetentionPolicyEnabled, setTempRetentionPolicyEnabled] = useState(auditSettings.retentionPolicyEnabled);
  const [tempRetentionDays, setTempRetentionDays] = useState<number>(auditSettings.retentionDays || 30);
  const [tempAutoRotateOnStartup, setTempAutoRotateOnStartup] = useState(auditSettings.autoRotateOnStartup ?? true);

  // Form states for clear modal
  const [clearMode, setClearMode] = useState<'all' | 'older_than'>('all');
  const [clearOlderThanDays, setClearOlderThanDays] = useState<number>(30);
  const [exportBeforePurge, setExportBeforePurge] = useState(true);

  // Permissions
  const canViewAudit =
    currentUser?.role === 'super_admin' ||
    hasPermission('viewAuditLogs');
  const canManageAuditSettings =
    currentUser?.role === 'super_admin' ||
    hasPermission('manageAuditSettings');
  const canClearAuditLogs =
    currentUser?.role === 'super_admin' ||
    hasPermission('clearAuditLogs');

  const showNotification = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    setActionFeedback({ message, type });
    setTimeout(() => {
      setActionFeedback(null);
    }, 4500);
  };

  // Filter logs
  const filteredLogs = auditLogs.filter((log) => {
    const matchSearch =
      log.actorUsername.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase());

    const matchCategory = categoryFilter === 'all' || log.category === categoryFilter;
    const matchSeverity = severityFilter === 'all' || log.severity === severityFilter;

    return matchSearch && matchCategory && matchSeverity;
  });

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Actor', 'Auth Type', 'Role', 'Category', 'Action', 'Target', 'Severity', 'Details'];
    const rows = filteredLogs.map((l) => [
      l.timestamp,
      l.actorUsername,
      l.actorAuthType,
      l.actorRole,
      l.category,
      l.action,
      l.target,
      l.severity,
      `"${l.details.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `IPAM_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Exported audit records as CSV successfully.', 'info');
  };

  // Export JSON
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `IPAM_Audit_Logs_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Exported audit records as JSON successfully.', 'info');
  };

  // Quick toggle logging directly from header
  const handleQuickToggleLogging = () => {
    if (!canManageAuditSettings) return;
    const nextState = !auditSettings.loggingEnabled;
    const res = updateAuditSettings({ loggingEnabled: nextState });
    if (res.success) {
      showNotification(
        nextState ? 'Audit logging stream has been ENABLED.' : 'Audit logging stream has been PAUSED.',
        nextState ? 'success' : 'warning'
      );
    }
  };

  // Open Settings Modal
  const handleOpenSettings = () => {
    setTempLoggingEnabled(auditSettings.loggingEnabled);
    setTempRetentionPolicyEnabled(auditSettings.retentionPolicyEnabled);
    setTempRetentionDays(auditSettings.retentionDays || 30);
    setTempAutoRotateOnStartup(auditSettings.autoRotateOnStartup ?? true);
    setIsSettingsModalOpen(true);
  };

  // Save Settings Modal
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempRetentionDays < 1) {
      showNotification('Retention days must be at least 1 day.', 'error');
      return;
    }
    const res = updateAuditSettings({
      loggingEnabled: tempLoggingEnabled,
      retentionPolicyEnabled: tempRetentionPolicyEnabled,
      retentionDays: Number(tempRetentionDays),
      autoRotateOnStartup: tempAutoRotateOnStartup,
    });
    if (res.success) {
      showNotification('Audit logging & auto-rotation policy updated.', 'success');
      setIsSettingsModalOpen(false);
    } else {
      showNotification(res.message, 'error');
    }
  };

  // Trigger immediate rotation
  const handleRunRotationNow = () => {
    const res = rotateAuditLogs();
    if (res.success) {
      showNotification(res.message, 'success');
    } else {
      showNotification(res.message, 'error');
    }
  };

  // Handle Clear execution
  const handleExecuteClear = () => {
    if (!canClearAuditLogs) return;

    if (exportBeforePurge) {
      handleExportJSON();
    }

    if (clearMode === 'all') {
      const res = clearAllAuditLogs();
      if (res.success) {
        showNotification(res.message, 'warning');
        setIsClearModalOpen(false);
      } else {
        showNotification(res.message, 'error');
      }
    } else {
      if (clearOlderThanDays < 1) {
        showNotification('Days threshold must be at least 1 day.', 'error');
        return;
      }
      const res = clearAuditLogsOlderThan(clearOlderThanDays);
      if (res.success) {
        showNotification(res.message, 'warning');
        setIsClearModalOpen(false);
      } else {
        showNotification(res.message, 'error');
      }
    }
  };

  // Helper for severity badge
  const getSeverityBadge = (severity: AuditSeverity) => {
    switch (severity) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-medium">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Success
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-medium">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            Warning
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-medium">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            Alert
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">
            <Info className="w-3 h-3 text-slate-400" />
            Info
          </span>
        );
    }
  };

  // Preview counts for modals
  const previewCutoffTime = Date.now() - (tempRetentionDays || 30) * 86400000;
  const logsOlderThanTempRetention = auditLogs.filter(
    (l) => new Date(l.timestamp).getTime() < previewCutoffTime
  ).length;

  const clearCutoffTime = Date.now() - (clearOlderThanDays || 30) * 86400000;
  const countToPurgeInClearModal =
    clearMode === 'all'
      ? auditLogs.length
      : auditLogs.filter((l) => new Date(l.timestamp).getTime() < clearCutoffTime).length;

  if (!canViewAudit) {
    return (
      <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl">
        <Shield className="w-8 h-8 text-amber-400 mx-auto mb-2" />
        <h3 className="text-base font-bold text-white">Access Denied</h3>
        <p className="text-xs text-slate-400 mt-1">
          Your account ({currentUser?.role}) does not have the &apos;viewAuditLogs&apos; permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {actionFeedback && (
        <div
          className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border text-xs font-medium transition-all ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-800 text-emerald-200'
              : actionFeedback.type === 'warning'
              ? 'bg-amber-950/90 border-amber-800 text-amber-200'
              : actionFeedback.type === 'error'
              ? 'bg-rose-950/90 border-rose-800 text-rose-200'
              : 'bg-blue-950/90 border-blue-800 text-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {actionFeedback.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
            {actionFeedback.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400" />}
            {actionFeedback.type === 'info' && <Info className="w-4 h-4 text-blue-400" />}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header with Admin Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Security &amp; Operations Audit Trail</h2>

            {/* Logging status badge */}
            {auditSettings.loggingEnabled ? (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Logging Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Logging Paused
              </span>
            )}

            {/* Auto-Clean / Retention badge */}
            {auditSettings.retentionPolicyEnabled ? (
              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-800 font-medium">
                <RotateCw className="w-3 h-3 text-blue-400" />
                Auto-Clean: {auditSettings.retentionDays} Days
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700 font-medium">
                <RotateCw className="w-3 h-3 text-slate-500" />
                Auto-Clean: Off
              </span>
            )}

            {auditSettings.totalPurgedCount > 0 && (
              <span
                title="Total records rotated / purged historically"
                className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono"
              >
                Pruned: {auditSettings.totalPurgedCount.toLocaleString()}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Compliance logging of administrator actions, LDAP/AD authentication, IP allocations, subnet operations, and security role modifications.
          </p>
        </div>

        {/* Action Controls Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Toggle Logging (Admin only) */}
          {canManageAuditSettings && (
            <button
              id="btn-quick-toggle-logging"
              onClick={handleQuickToggleLogging}
              title={auditSettings.loggingEnabled ? 'Click to pause logging' : 'Click to resume logging'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                auditSettings.loggingEnabled
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  : 'bg-amber-600 hover:bg-amber-500 border-amber-500 text-white shadow-sm'
              }`}
            >
              {auditSettings.loggingEnabled ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                  <span>Pause Logs</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-white" />
                  <span>Resume Logs</span>
                </>
              )}
            </button>
          )}

          {/* Retention & Rotation Policy Modal Trigger (Admin only) */}
          {canManageAuditSettings && (
            <button
              id="btn-audit-settings"
              onClick={handleOpenSettings}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 font-medium transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              <span>Retention &amp; Policy</span>
            </button>
          )}

          {/* Clear Logs Button (Admin only) */}
          {canClearAuditLogs && (
            <button
              id="btn-clear-logs"
              onClick={() => setIsClearModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/80 text-xs text-rose-300 font-medium transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear Logs</span>
            </button>
          )}

          {/* Export Buttons */}
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition-colors border border-slate-700"
          >
            <span>JSON</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition-colors border border-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Paused Warning Banner */}
      {!auditSettings.loggingEnabled && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-950/40 border border-amber-700/60 rounded-xl p-3.5 text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold">Audit Logging is Currently Paused / Disabled</p>
              <p className="text-[11px] text-amber-300/80">
                New user logins, IP allocations, subnet changes, and security updates are not being recorded.
              </p>
            </div>
          </div>
          {canManageAuditSettings && (
            <button
              onClick={handleQuickToggleLogging}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white shadow transition-colors shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Re-enable Logging Stream</span>
            </button>
          )}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-slate-400">Total Active Logs</span>
          <p className="text-2xl font-bold text-white mt-1">{auditLogs.length}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Stored database records</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-blue-400">Authentication</span>
          <p className="text-2xl font-bold text-blue-300 mt-1">
            {auditLogs.filter((l) => l.category === 'auth').length}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Local &amp; AD binds</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-emerald-400">IP Operations</span>
          <p className="text-2xl font-bold text-emerald-300 mt-1">
            {auditLogs.filter((l) => l.category === 'ip').length}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Allocations &amp; releases</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs font-medium text-purple-400">Retention Policy</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold text-purple-300">
              {auditSettings.retentionPolicyEnabled ? `${auditSettings.retentionDays}d` : 'Off'}
            </span>
            {auditSettings.retentionPolicyEnabled && (
              <span className="text-[11px] text-purple-400/80">auto-rotation</span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {auditSettings.lastRotatedAt
              ? `Last rotated ${new Date(auditSettings.lastRotatedAt).toLocaleDateString()}`
              : 'Auto clean enabled'}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search action, target, actor, details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Categories</option>
            <option value="auth">Authentication</option>
            <option value="ip">IP Allocations</option>
            <option value="subnet">Subnet Architecture</option>
            <option value="user">User Management</option>
            <option value="device">Device Classification</option>
            <option value="system">System &amp; Audit Engine</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Severities</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="error">Alert / Error</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[10px]">Timestamp</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[10px]">Actor / Identity</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[10px]">Action &amp; Target</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[10px]">Details</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[10px] text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <Archive className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                    <p className="font-medium text-slate-400">No audit records found</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {auditLogs.length === 0
                        ? 'All audit logs have been cleared or pruned by the retention policy.'
                        : 'No records match the active search and filter criteria.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const dateObj = new Date(log.timestamp);
                  const formattedDate = dateObj.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
                  const formattedTime = dateObj.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Timestamp */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>
                            {formattedDate} {formattedTime}
                          </span>
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-200">
                            {log.actorUsername.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-[#171717] dark:text-white">{log.actorUsername}</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              {log.actorAuthType === 'ldap_ad' ? (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-blue-950 text-blue-400 border border-blue-800 flex items-center gap-0.5">
                                  <Server className="w-2.5 h-2.5" />
                                  Active Directory
                                </span>
                              ) : (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-0.5">
                                  <Lock className="w-2.5 h-2.5" />
                                  Local DB
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Action & Target */}
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-bold text-blue-400 bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-900/60">
                          {log.action}
                        </span>
                        <p className="text-[11px] font-mono text-slate-300 mt-1 font-semibold">{log.target}</p>
                      </td>

                      {/* Details */}
                      <td className="py-3 px-4 text-slate-300 max-w-md leading-relaxed">{log.details}</td>

                      {/* Severity */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">{getSeverityBadge(log.severity)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================== */}
      {/* MODAL 1: AUDIT LOGGING SETTINGS & RETENTION POLICY         */}
      {/* ========================================================== */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">Audit Logging &amp; Auto-Rotation Policy</h3>
                  <p className="text-xs text-slate-400">Configure log capture engine and automatic pruning cycles</p>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="p-6 space-y-6 text-slate-200">
              {/* Section 1: Enable/Disable Logs */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-white block">Audit Capture Engine</label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Toggle active capture of all admin operations, IP assignments, and logins
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTempLoggingEnabled(!tempLoggingEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      tempLoggingEnabled ? 'bg-blue-600' : 'bg-slate-800'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        tempLoggingEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-900 flex items-center gap-2 text-[11px]">
                  <span className="text-slate-400">Current state:</span>
                  {tempLoggingEnabled ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Logging Enabled (All events captured)
                    </span>
                  ) : (
                    <span className="text-amber-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      Logging Paused (No new records created)
                    </span>
                  )}
                </div>
              </div>

              {/* Section 2: Auto Clean & Custom Days */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-white block">Automatic Log Rotation &amp; Pruning</label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Automatically purge logs older than the specified custom retention days
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTempRetentionPolicyEnabled(!tempRetentionPolicyEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      tempRetentionPolicyEnabled ? 'bg-blue-600' : 'bg-slate-800'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        tempRetentionPolicyEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {tempRetentionPolicyEnabled && (
                  <div className="space-y-3 pt-3 border-t border-slate-900">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-300">
                          Custom Retention Window (Days) *
                        </label>
                        <span className="text-xs font-mono text-blue-400 font-bold">{tempRetentionDays} Days</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                          <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="number"
                            min="1"
                            max="3650"
                            value={tempRetentionDays}
                            onChange={(e) => setTempRetentionDays(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-blue-500"
                            placeholder="Enter custom days (e.g. 30)"
                          />
                        </div>
                        <span className="text-xs text-slate-400 shrink-0">days</span>
                      </div>

                      {/* Quick preset chips */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Presets:</span>
                        {[7, 14, 30, 60, 90, 180, 365].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setTempRetentionDays(preset)}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                              tempRetentionDays === preset
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                            }`}
                          >
                            {preset}d
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Dynamic Cutoff preview */}
                    <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-3 text-[11px] space-y-1 text-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Rotation Cutoff Date:</span>
                        <span className="font-mono text-[#171717] dark:text-white font-semibold">
                          {new Date(previewCutoffTime).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Records Exceeding Threshold:</span>
                        <span
                          className={`font-mono font-bold ${
                            logsOlderThanTempRetention > 0 ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          {logsOlderThanTempRetention} of {auditLogs.length} records
                        </span>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={tempAutoRotateOnStartup}
                        onChange={(e) => setTempAutoRotateOnStartup(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span>Automatically rotate and prune expired logs when application loads</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Section 3: Manual Execution & Prune Now */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white">Manual Rotation Trigger</p>
                  <p className="text-[10px] text-slate-400">
                    Prune records older than {auditSettings.retentionDays} days right now
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRunRotationNow}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-blue-300 font-medium transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Prune Expired Now</span>
                </button>
              </div>

              {/* Modal Footer */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow transition-colors"
                >
                  Save Policy Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL 2: CLEAR AUDIT LOGS (ADMIN USER RIGHT)               */}
      {/* ========================================================== */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative bg-slate-900 border border-rose-900/60 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-rose-950/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-600/20 text-rose-400 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">Clear Audit Logs</h3>
                  <p className="text-xs text-rose-300/80">Purge and clear compliance records from store</p>
                </div>
              </div>
              <button
                onClick={() => setIsClearModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-slate-200">
              {/* Caution Callout */}
              <div className="flex items-start gap-3 bg-rose-950/30 border border-rose-800/60 rounded-xl p-3.5 text-xs text-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-white">Irreversible Action</p>
                  <p className="text-[11px] text-rose-200/80 leading-relaxed">
                    Purging audit logs permanently deletes compliance records from active storage.
                  </p>
                </div>
              </div>

              {/* Mode Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">Select Clearance Scope</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setClearMode('all')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      clearMode === 'all'
                        ? 'bg-rose-50 text-rose-700 border-rose-500 dark:bg-rose-950/60 dark:text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/40'
                    }`}
                  >
                    <p className="font-semibold text-xs">Purge ALL Logs</p>
                    <p className="text-[10px] text-slate-400 mt-1">Wipes entire history ({auditLogs.length} records)</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setClearMode('older_than')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      clearMode === 'older_than'
                        ? 'bg-rose-50 text-rose-700 border-rose-500 dark:bg-rose-950/60 dark:text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/40'
                    }`}
                  >
                    <p className="font-semibold text-xs">Purge Older Than X Days</p>
                    <p className="text-[10px] text-slate-400 mt-1">Select custom age cutoff window</p>
                  </button>
                </div>
              </div>

              {/* Custom days input if older_than mode */}
              {clearMode === 'older_than' && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Purge logs older than:
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="3650"
                      value={clearOlderThanDays}
                      onChange={(e) => setClearOlderThanDays(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-28 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-rose-500"
                    />
                    <span className="text-xs text-slate-400">days</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {[7, 14, 30, 60, 90, 180, 365].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setClearOlderThanDays(d)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                          clearOlderThanDays === d
                            ? 'bg-rose-900/80 text-rose-200 border border-rose-700'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Will purge records dated before{' '}
                    <span className="text-[#171717] dark:text-white font-medium font-mono">
                      {new Date(clearCutoffTime).toLocaleDateString()}
                    </span>{' '}
                    ({countToPurgeInClearModal} records affected).
                  </p>
                </div>
              )}

              {/* Backup Option */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
                <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportBeforePurge}
                    onChange={(e) => setExportBeforePurge(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <div>
                    <span className="font-semibold block text-[#171717] dark:text-white">Download backup archive (JSON)</span>
                    <span className="text-[11px] text-slate-400">
                      Saves an offline snapshot to your computer before permanently deleting
                    </span>
                  </div>
                </label>
              </div>

              {/* Summary Counter */}
              <div className="flex items-center justify-between text-xs py-1 border-t border-slate-800 text-slate-400">
                <span>Total records to be removed:</span>
                <span className="text-sm font-bold text-rose-400 font-mono">
                  {countToPurgeInClearModal} records
                </span>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsClearModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteClear}
                  disabled={countToPurgeInClearModal === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-white shadow transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Purge {countToPurgeInClearModal} Records</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
