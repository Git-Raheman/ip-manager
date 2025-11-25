import React, { useState, useEffect } from 'react';
import { FileText, Trash2, Download, Settings, Save } from 'lucide-react';

const LogsTab = () => {
    const [logs, setLogs] = useState([]);
    const [autoDeleteConfig, setAutoDeleteConfig] = useState({ enabled: false, hours: 24, logsEnabled: true });
    const [showConfig, setShowConfig] = useState(false);
    const [configHours, setConfigHours] = useState(24);

    const fetchLogs = async () => {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/logs', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) setLogs(await res.json());
    };

    const fetchAutoDeleteConfig = async () => {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/logs/auto-delete-config', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const config = await res.json();
            setAutoDeleteConfig({ enabled: config.enabled, hours: config.hours, logsEnabled: config.logsEnabled });
            setConfigHours(config.hours);
        }
    };

    useEffect(() => {
        fetchLogs();
        fetchAutoDeleteConfig();
    }, []);

    const handleClearAll = async () => {
        if (!confirm('Are you sure you want to clear ALL logs? This action cannot be undone.')) return;

        const token = localStorage.getItem('token');
        const res = await fetch('/api/logs/clear', {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            alert(data.message);
            fetchLogs();
        } else {
            alert('Failed to clear logs');
        }
    };

    const handleExport = async () => {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/logs/export', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `system-logs-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            alert('Failed to export logs');
        }
    };

    const handleSaveAutoDelete = async () => {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/logs/auto-delete-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ enabled: autoDeleteConfig.enabled, hours: configHours, logsEnabled: autoDeleteConfig.logsEnabled })
        });

        if (res.ok) {
            alert('Auto-delete configuration saved');
            fetchAutoDeleteConfig();
            setShowConfig(false);
        } else {
            alert('Failed to save configuration');
        }
    };

    const handleRunAutoDelete = async () => {
        if (!confirm(`Delete all logs older than ${autoDeleteConfig.hours} hours?`)) return;

        const token = localStorage.getItem('token');
        const res = await fetch('/api/logs/auto-delete-run', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const data = await res.json();
            alert(data.message);
            fetchLogs();
        } else {
            alert('Auto-delete failed');
        }
    };

    return (
        <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', margin: 0 }}><FileText size={20} style={{ marginRight: '10px' }} /> System Logs</h2>
                <div className="card-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={handleClearAll} className="btn-delete"><Trash2 size={16} /> Clear All</button>
                    <button onClick={handleExport} className="btn-secondary"><Download size={16} /> Export</button>
                    <button onClick={() => setShowConfig(!showConfig)} className="btn-secondary"><Settings size={16} /> Config</button>
                </div>
            </div>

            {showConfig && (
                <div className="config-panel" style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginBottom: '1rem' }}>
                    <h3>Auto-Delete Configuration</h3>
                    <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                                type="checkbox"
                                checked={autoDeleteConfig.enabled}
                                onChange={e => setAutoDeleteConfig({ ...autoDeleteConfig, enabled: e.target.checked })}
                            />
                            Enable Auto-Delete
                        </label>
                    </div>
                    <div className="form-group">
                        <label>Delete logs older than (hours):</label>
                        <input
                            type="number"
                            value={configHours}
                            onChange={e => setConfigHours(parseInt(e.target.value))}
                            min="1"
                            style={{ marginLeft: '0.5rem', width: '80px' }}
                        />
                    </div>
                    <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                                type="checkbox"
                                checked={autoDeleteConfig.logsEnabled}
                                onChange={e => setAutoDeleteConfig({ ...autoDeleteConfig, logsEnabled: e.target.checked })}
                            />
                            Enable Logging
                        </label>
                    </div>
                    <div className="action-row" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                        <button onClick={handleSaveAutoDelete} className="btn-save"><Save size={16} /> Save Config</button>
                        <button onClick={handleRunAutoDelete} className="btn-warning"><Trash2 size={16} /> Run Now</button>
                    </div>
                </div>
            )}

            <div className="logs-list">
                {logs.length === 0 ? (
                    <p className="no-data">No logs found.</p>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>Level</th>
                                <th>Message</th>
                                <th>User</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log, index) => (
                                <tr key={index}>
                                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                                    <td><span className={`badge badge-${log.level ? log.level.toLowerCase() : 'info'}`}>{log.level}</span></td>
                                    <td>{log.message}</td>
                                    <td>{log.username || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default LogsTab;
