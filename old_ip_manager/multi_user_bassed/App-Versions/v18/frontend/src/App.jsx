import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './index';
import ForceGraph2D from 'react-force-graph-2d';
import { motion } from 'framer-motion';
import {
    Search, Edit2, Trash2, Check, X, Activity, Plus, LogOut, Users,
    Server, RefreshCw, Save, AlertCircle, MoreVertical, CheckSquare, Square,
    Lock, Shield, Power, Key, LayoutGrid, List, Network, FileText, Upload, Download,
    CheckCircle, XCircle, Settings
} from 'lucide-react';

const Login = () => {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [capsLock, setCapsLock] = useState(false);

    const checkCapsLock = (e) => {
        if (e.getModifierState("CapsLock")) {
            setCapsLock(true);
        } else {
            setCapsLock(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (res.ok) {
                login(data.token, { username: data.username, role: data.role });
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Login failed');
        }
    };

    return (
        <div className="login-container">
            <div className="animated-bg">
                <motion.div 
                    className="bg-shape shape-1" 
                    animate={{ 
                        rotate: 360, 
                        scale: [1, 1.2, 1],
                        x: [0, 50, 0],
                        y: [0, 30, 0]
                    }} 
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }} 
                />
                <motion.div 
                    className="bg-shape shape-2" 
                    animate={{ 
                        rotate: -360,
                        scale: [1, 1.5, 1],
                        x: [0, -30, 0],
                        y: [0, 50, 0]
                    }} 
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }} 
                />
            </div>
            
            <motion.div 
                className="card login-card glass-effect"
                initial={{ opacity: 0, y: 30, rotateX: 10 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 0.8, type: "spring" }}
            >
                <div className="login-header">
                    <div className="logo-icon">
                        <Shield size={40} color="#3b82f6" />
                    </div>
                    <h2>Welcome Back</h2>
                    <p>Sign in to IP Manager</p>
                </div>

                {error && (
                    <motion.div 
                        className="error-msg"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <AlertCircle size={16} /> {error}
                    </motion.div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <div className="input-icon"><Users size={18} /></div>
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            className="modern-input"
                        />
                    </div>
                    <div className="input-group">
                        <div className="input-icon"><Lock size={18} /></div>
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            onKeyUp={checkCapsLock}
                            className="modern-input"
                        />
                    </div>
                    
                    {capsLock && (
                        <motion.div 
                            className="caps-warning"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                        >
                            <AlertCircle size={14} /> Caps Lock is ON
                        </motion.div>
                    )}

                    <motion.button 
                        type="submit" 
                        className="btn-login"
                        whileHover={{ scale: 1.05, boxShadow: "0px 0px 15px rgba(59, 130, 246, 0.5)" }}
                        whileTap={{ scale: 0.95 }}
                    >
                        Log In
                    </motion.button>
                </form>
            </motion.div>
        </div>
    );
};

const ChangePasswordModal = ({ isOpen, onClose, onSave, title, requireOldPassword }) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        onSave({ oldPassword, newPassword });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{title || 'Change Password'}</h3>
                    <button onClick={onClose}><X size={24} /></button>
                </div>
                <div className="modal-body">
                    {error && <div className="error-msg">{error}</div>}
                    <form onSubmit={handleSubmit}>
                        {requireOldPassword && (
                            <div className="form-group">
                                <label>Old Password</label>
                                <input
                                    type="password"
                                    value={oldPassword}
                                    onChange={e => setOldPassword(e.target.value)}
                                    required
                                />
                            </div>
                        )}
                        <div className="form-group">
                            <label>New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="modal-actions">
                            <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
                            <button type="submit" className="btn-save"><Save size={16} /> Update Password</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

const UserManagement = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [form, setForm] = useState({ username: '', password: '', role: 'readonly' });
    const [msg, setMsg] = useState('');
    const [passwordModalUser, setPasswordModalUser] = useState(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) setUsers(await res.json());
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(form)
        });
        if (res.ok) {
            setForm({ username: '', password: '', role: 'readonly' });
            fetchUsers();
            setMsg('User added');
        } else {
            setMsg('Failed to add user');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete user?')) return;
        const token = localStorage.getItem('token');
        await fetch(`/api/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchUsers();
    };

    const handleToggleStatus = async (id, currentStatus) => {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/users/${id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ is_active: !currentStatus })
        });
        if (res.ok) fetchUsers();
    };

    const handleRoleChange = async (id, newRole) => {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/users/${id}/role`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ role: newRole })
        });
        if (res.ok) fetchUsers();
    };

    const handlePasswordReset = async ({ newPassword }) => {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/users/${passwordModalUser.id}/password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ password: newPassword })
        });
        if (res.ok) {
            setPasswordModalUser(null);
            alert('Password updated successfully');
        } else {
            alert('Failed to update password');
        }
    };

    return (
        <div className="card">
            <h2><Users size={20} style={{ marginRight: '10px' }} /> User Management</h2>
            {msg && <p>{msg}</p>}
            <form onSubmit={handleAdd} className="user-form">
                <input
                    placeholder="Username"
                    value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value })}
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    required
                />
                <select
                    value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}
                >
                    <option value="readonly">Readonly</option>
                    <option value="admin">Admin</option>
                </select>
                <button type="submit"><Plus size={16} /> Create User</button>
            </form>
            <div className="user-list">
                {users.map(u => (
                    <div key={u.id} className="user-item">
                        <div className="user-info">
                            <span className={!u.is_active ? 'disabled-user' : ''}>{u.username}</span>
                            {!u.is_active && <span className="badge-disabled">Disabled</span>}
                        </div>
                        <div className="user-actions">
                            <select
                                value={u.role}
                                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                disabled={u.username === 'admin'}
                                className="role-select"
                            >
                                <option value="admin">Admin</option>
                                <option value="readonly">Readonly</option>
                            </select>
                            {u.username !== 'admin' && u.id !== user.id && (
                                <>
                                    <button
                                        className={`btn-toggle ${u.is_active ? 'active' : 'inactive'}`}
                                        onClick={() => handleToggleStatus(u.id, u.is_active)}
                                        title={u.is_active ? "Disable Login" : "Enable Login"}
                                    >
                                        <Power size={16} />
                                    </button>
                                    <button
                                        className="btn-edit"
                                        onClick={() => setPasswordModalUser(u)}
                                        title="Change Password"
                                    >
                                        <Key size={16} />
                                    </button>
                                    <button className="btn-delete" onClick={() => handleDelete(u.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <ChangePasswordModal
                isOpen={!!passwordModalUser}
                onClose={() => setPasswordModalUser(null)}
                onSave={handlePasswordReset}
                title={`Reset Password for ${passwordModalUser?.username}`}
            />
        </div>
    );
};

const EditModal = ({ ip, tabs, onClose, onSave }) => {
    const [form, setForm] = useState({
        ip: ip.ip,
        hostname: ip.hostname || '',
        ports: ip.ports || '',
        status: ip.status || 'Available',
        note: ip.note || '',
        tab_id: ip.tab_id || '',
        subnet: ip.subnet || '',
        cidr: ip.cidr || ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        await onSave(form);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal edit-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Edit IP Record</h3>
                    <button onClick={onClose}><X size={24} /></button>
                </div>
                <div className="modal-body">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>IP Address</label>
                            <input
                                type="text"
                                value={form.ip}
                                onChange={e => setForm({ ...form, ip: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Hostname</label>
                            <input
                                type="text"
                                value={form.hostname}
                                onChange={e => setForm({ ...form, hostname: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label>Ports</label>
                            <input
                                type="text"
                                value={form.ports}
                                onChange={e => setForm({ ...form, ports: e.target.value })}
                                placeholder="e.g. 80, 443"
                            />
                        </div>
                        <div className="form-group">
                            <label>Status</label>
                            <select
                                value={form.status}
                                onChange={e => setForm({ ...form, status: e.target.value })}
                            >
                                <option value="Up">Up</option>
                                <option value="Down">Down</option>
                                <option value="Available">Available</option>
                                <option value="Reserved">Reserved</option>
                                <option value="Pending">Pending</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Notes</label>
                            <textarea
                                value={form.note}
                                onChange={e => setForm({ ...form, note: e.target.value })}
                                rows="3"
                            />
                        </div>
                        <div className="form-group">
                            <label>Subnet (Optional)</label>
                            <input
                                type="text"
                                value={form.subnet}
                                onChange={e => setForm({ ...form, subnet: e.target.value })}
                                placeholder="e.g. 255.255.255.0"
                            />
                        </div>
                        <div className="form-group">
                            <label>CIDR (Optional)</label>
                            <input
                                type="text"
                                value={form.cidr}
                                onChange={e => setForm({ ...form, cidr: e.target.value })}
                                placeholder="e.g. /24"
                            />
                        </div>
                        <div className="form-group">
                            <label>Tab</label>
                            <select
                                value={form.tab_id}
                                onChange={e => setForm({ ...form, tab_id: e.target.value })}
                            >
                                <option value="">Unassigned</option>
                                {tabs.filter(t => t.id !== 'all').map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="modal-actions">
                            <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
                            <button type="submit" className="btn-save"><Save size={16} /> Save Changes</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

const BackupModal = ({ isOpen, onClose }) => {
    const [file, setFile] = useState(null);
    const [excelFile, setExcelFile] = useState(null);
    const [msg, setMsg] = useState('');
    const [tab, setTab] = useState('json');
    const [importMode, setImportMode] = useState('replace');

    if (!isOpen) return null;

    const handleExport = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/backup/export', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setMsg('Export successful');
            } else {
                setMsg('Export failed');
            }
        } catch (err) {
            setMsg('Export failed');
        }
    };

    const handleImportJson = async () => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const data = JSON.parse(e.target.result);
            const token = localStorage.getItem('token');
            try {
                const res = await fetch('/api/backup/import', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ data, mode: importMode })
                });
                if (res.ok) {
                    setMsg('Import successful! Refreshing...');
                    setTimeout(() => window.location.reload(), 2000);
                } else {
                    setMsg('Import failed');
                }
            } catch (err) {
                setMsg('Import failed');
            }
        };
        reader.readAsText(file);
    };

    const handleImportExcel = async () => {
        if (!excelFile) return;
        const formData = new FormData();
        formData.append('file', excelFile);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/backup/import-excel', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                let message = `${data.message}\n\nSummary:\n- Processed: ${data.summary.processed}\n- Created: ${data.summary.created}\n- Errors: ${data.summary.errorCount}`;
                if (data.errors && data.errors.length > 0) {
                    message += '\n\nErrors:\n' + data.errors.join('\n');
                }
                alert(message);
                setMsg('Import successful! Refreshing...');
                setTimeout(() => window.location.reload(), 2000);
            } else {
                setMsg('Import failed: ' + data.error);
            }
        } catch (err) {
            setMsg('Import failed');
        }
    };

    const downloadTemplate = async () => {
        window.open('/api/backup/template', '_blank');
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>System Backup & Import</h3>
                    <button onClick={onClose}><X size={24} /></button>
                </div>
                <div className="modal-body">
                    <div className="backup-tabs">
                        <button className={tab === 'json' ? 'active' : ''} onClick={() => setTab('json')}>JSON Backup</button>
                        <button className={tab === 'excel' ? 'active' : ''} onClick={() => setTab('excel')}>Excel Import</button>
                    </div>

                    {msg && <div className="info-msg">{msg}</div>}

                    {tab === 'json' && (
                        <div className="backup-section">
                            <h4>Full System Backup</h4>
                            <div className="action-row">
                                <button onClick={handleExport} className="btn-save"><Download size={16} /> Export JSON</button>
                            </div>
                            <div className="action-row">
                                <div className="import-controls">
                                    <select value={importMode} onChange={e => setImportMode(e.target.value)} className="mode-select">
                                        <option value="replace">Replace (Overwrite All)</option>
                                        <option value="merge">Merge (Keep Existing)</option>
                                    </select>
                                    <input type="file" accept=".json" onChange={e => setFile(e.target.files[0])} />
                                    <button onClick={handleImportJson} className="btn-primary"><Upload size={16} /> Restore JSON</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'excel' && (
                        <div className="backup-section">
                            <h4>Bulk Import IPs</h4>
                            <p>Upload an Excel file to add multiple IPs at once.</p>
                            <div className="action-row">
                                <button onClick={downloadTemplate} className="btn-link"><FileText size={16} /> Download Template</button>
                            </div>
                            <div className="action-row">
                                <input type="file" accept=".xlsx, .xls" onChange={e => setExcelFile(e.target.files[0])} />
                                <button onClick={handleImportExcel} className="btn-primary"><Upload size={16} /> Import Excel</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

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
        <div className="card logs-card">
            <div className="logs-header">
                <h3><FileText size={20} /> System Logs ({logs.length})</h3>
                <div className="logs-actions">
                    <button onClick={() => setShowConfig(!showConfig)} className="btn-secondary">
                        <Settings size={16} /> Configure
                    </button>
                    <button onClick={handleExport} className="btn-primary">
                        <Download size={16} /> Export
                    </button>
                    <button onClick={handleClearAll} className="btn-delete">
                        <Trash2 size={16} /> Clear All
                    </button>
                </div>
            </div>

            {showConfig && (
                <div className="logs-config-panel">
                    <h4>Logs Configuration</h4>
                    <div className="config-row">
                        <label>
                            <input
                                type="checkbox"
                                checked={autoDeleteConfig.logsEnabled}
                                onChange={(e) => setAutoDeleteConfig({ ...autoDeleteConfig, logsEnabled: e.target.checked })}
                            />
                            Enable System Logs
                        </label>
                    </div>
                    <div className="config-row">
                        <label>
                            <input
                                type="checkbox"
                                checked={autoDeleteConfig.enabled}
                                onChange={(e) => setAutoDeleteConfig({ ...autoDeleteConfig, enabled: e.target.checked })}
                            />
                            Enable Auto-Delete
                        </label>
                    </div>
                    <div className="config-row">
                        <label>Delete logs older than:</label>
                        <input
                            type="number"
                            min="1"
                            max="8760"
                            value={configHours}
                            onChange={(e) => setConfigHours(parseInt(e.target.value) || 24)}
                            style={{ width: '100px' }}
                        />
                        <span>hours</span>
                    </div>
                    <div className="config-actions">
                        <button onClick={handleSaveAutoDelete} className="btn-save">
                            <Save size={16} /> Save Configuration
                        </button>
                        <button onClick={handleRunAutoDelete} className="btn-secondary">
                            <RefreshCw size={16} /> Run Now
                        </button>
                    </div>
                </div>
            )}

            <div className="table-container">
                <table className="logs-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Type</th>
                            <th>Message</th>
                            <th>User ID</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => (
                            <tr key={log.id}>
                                <td>{new Date(log.created_at).toLocaleString()}</td>
                                <td><span className="badge">{log.type}</span></td>
                                <td>{log.message}</td>
                                <td>{log.user_id || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const PoolView = ({ ips, onEdit }) => {
    return (
        <div className="pool-grid">
            {ips.map(ip => (
                <div
                    key={ip.id}
                    className={`pool-card ${ip.last_status === 'UP' ? 'status-up' : 'status-down'}`}
                    onClick={() => onEdit(ip)}
                >
                    <div className="pool-header">
                        <span className="pool-ip">{ip.ip}</span>
                        <div className={`status-indicator ${ip.last_status === 'UP' ? 'up' : 'down'}`}></div>
                    </div>
                    <div className="pool-details">
                        <span className="pool-host">{ip.hostname || 'No Hostname'}</span>
                        <span className="pool-status-text">{ip.status}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};



const NetworkMap = ({ ips, tabs }) => {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });

    useEffect(() => {
        const nodes = [];
        const links = [];

        // Create Tab Nodes (Hubs)
        tabs.forEach(tab => {
            nodes.push({ id: `tab-${tab.id}`, name: tab.name, type: 'tab', val: 15 });
        });
        // Create Gateway Node
        nodes.push({ id: 'gateway', name: 'Gateway', type: 'gateway', val: 20 });

        // Create IP Nodes
        ips.forEach(ip => {
            nodes.push({
                id: ip.ip,
                name: ip.hostname || ip.ip,
                type: 'ip',
                status: ip.last_status,
                val: 5
            });

            // Link to Tab or Gateway
            if (ip.tab_id) {
                links.push({ source: `tab-${ip.tab_id}`, target: ip.ip });
            } else {
                links.push({ source: 'gateway', target: ip.ip });
            }
        });

        // Link Tabs to Gateway
        tabs.forEach(tab => {
            links.push({ source: 'gateway', target: `tab-${tab.id}` });
        });

        setGraphData({ nodes, links });
    }, [ips, tabs]);

    return (
        <div className="network-map-container card">
            <ForceGraph2D
                graphData={graphData}
                nodeLabel="name"
                nodeColor={node => {
                    if (node.type === 'gateway') return '#f59e0b';
                    if (node.type === 'tab') return '#3b82f6';
                    return node.status === 'UP' ? '#22c55e' : '#ef4444';
                }}
                linkColor={() => '#334155'}
                backgroundColor="#0f172a"
                nodeRelSize={6}
            />
        </div>
    );
};

const MonitorView = ({ monitorConfig, onConfigChange, onPingAll, onPingOne }) => {
    const [specificIp, setSpecificIp] = useState('');

    const handleIntervalChange = (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val)) val = 60;
        if (val < 1) val = 1;
        if (val > 5000) val = 5000;
        onConfigChange(val, monitorConfig.enabled);
    };

    return (
        <div className="card monitor-card">
            <h2><Activity size={20} style={{ marginRight: '10px' }} /> Live Column Settings</h2>
            <div className="monitor-settings">
                <div className="setting-group">
                    <h3>Automatic Monitoring</h3>
                    <div className="setting-row">
                        <label>Feature Status:</label>
                        <button
                            className={`btn-toggle ${monitorConfig.enabled ? 'active' : 'inactive'}`}
                            onClick={() => onConfigChange(monitorConfig.interval, !monitorConfig.enabled)}
                        >
                            {monitorConfig.enabled ? 'ON' : 'OFF'}
                        </button>
                    </div>
                    <div className="setting-row">
                        <label>Routine Check Time (Minutes):</label>
                        <input
                            type="number"
                            min="1"
                            max="5000"
                            value={monitorConfig.interval}
                            onChange={handleIntervalChange}
                            className="interval-input"
                        />
                    </div>
                </div>

                <div className="setting-group">
                    <h3>Update Mode</h3>
                    <div className="setting-row">
                        <label>Update All IPs:</label>
                        <button onClick={onPingAll} className="btn-primary"><RefreshCw size={16} /> Run Check Now</button>
                    </div>
                    <div className="setting-row">
                        <label>Update Specific IP:</label>
                        <div className="input-group">
                            <input
                                placeholder="Enter IP Address"
                                value={specificIp}
                                onChange={e => setSpecificIp(e.target.value)}
                            />
                            <button onClick={() => onPingOne(specificIp)} className="btn-secondary" disabled={!specificIp}>
                                <Activity size={16} /> Check
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="monitor-info">
                <p>Last Run: {monitorConfig.lastRun ? new Date(monitorConfig.lastRun).toLocaleString() : 'Never'}</p>
                <p>Next Run: {monitorConfig.nextRun ? new Date(monitorConfig.nextRun).toLocaleString() : 'Not Scheduled'}</p>
            </div>
        </div>
    );
};

const PingStatusModal = ({ isOpen, onClose, ipData, onRefresh }) => {
    const [pinging, setPinging] = useState(false);
    const [result, setResult] = useState(null);

    const handlePing = async () => {
        setPinging(true);
        setResult(null);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/monitor/ping-one', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ ip: ipData.ip })
            });
            if (res.ok) {
                const data = await res.json();
                setResult(data);
                onRefresh();
            } else {
                setResult({ error: 'Ping failed' });
            }
        } catch (err) {
            setResult({ error: 'Network error' });
        } finally {
            setPinging(false);
        }
    };

    useEffect(() => {
        if (isOpen && ipData) {
            handlePing();
        }
    }, [isOpen, ipData]);

    // Auto-close after 4 seconds when result is available
    useEffect(() => {
        if (result && !pinging) {
            const timer = setTimeout(() => {
                onClose();
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [result, pinging, onClose]);

    if (!isOpen || !ipData) return null;

    return (
        <div className="ping-popup">
            <div className="ping-popup-header">
                <h4><Activity size={16} /> Status Check: {ipData.ip}</h4>
                <button onClick={onClose} className="ping-popup-close"><X size={16} /></button>
            </div>
            <div className="ping-popup-body">
                {pinging ? (
                    <div className="ping-loading-small">
                        <div className="spinner-small"></div>
                        <span>Pinging host...</span>
                    </div>
                ) : result ? (
                    result.error ? (
                        <div className="ping-result-small error">
                            <XCircle size={20} color="#ef4444" />
                            <span>{result.error}</span>
                        </div>
                    ) : (
                        <>
                            <div className={`ping-status-badge ${result.status === 'UP' ? 'up' : 'down'}`}>
                                {result.status === 'UP' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                Host is {result.status}
                            </div>

                            {result.details && (
                                <>
                                    <div className="ping-detail-row">
                                        <span className="ping-detail-label">Packets Sent</span>
                                        <span className="ping-detail-value">{result.details.sent}</span>
                                    </div>
                                    <div className="ping-detail-row">
                                        <span className="ping-detail-label">Packets Received</span>
                                        <span className="ping-detail-value">{result.details.received}</span>
                                    </div>
                                    <div className="ping-detail-row">
                                        <span className="ping-detail-label">Packet Loss</span>
                                        <span className="ping-detail-value">{result.details.packetLoss}%</span>
                                    </div>
                                    <div className="ping-detail-row">
                                        <span className="ping-detail-label">Latency (Avg)</span>
                                        <span className="ping-detail-value">{result.details.avgLatencyMs ? `${result.details.avgLatencyMs} ms` : '-'}</span>
                                    </div>
                                    <div className="ping-command">
                                        {result.details.command}
                                    </div>
                                </>
                            )}
                        </>
                    )
                ) : null}
            </div>
        </div>
    );
};

const TabModal = ({ isOpen, onClose, onSave }) => {
    const [name, setName] = useState('');
    if (!isOpen) return null;
    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(name);
        setName('');
    };
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Add New Tab</h3>
                    <button onClick={onClose}><X size={24} /></button>
                </div>
                <div className="modal-body">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Tab Name</label>
                            <input value={name} onChange={e => setName(e.target.value)} required autoFocus />
                        </div>
                        <div className="modal-actions">
                            <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
                            <button type="submit" className="btn-save"><Plus size={16} /> Create Tab</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default function App() {
    const { user, logout, loading } = useAuth();
    const [allIps, setAllIps] = useState([]);
    const [form, setForm] = useState({ ip: '', hostname: '', ports: '', status: 'Available', note: '', tab_id: '', subnet: '', cidr: '' });
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [view, setView] = useState('ips');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [editingIp, setEditingIp] = useState(null);
    const [activeTab, setActiveTab] = useState('all');
    const [tabs, setTabs] = useState([{ id: 'all', name: 'All IPs' }]);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0 });
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [showMyAccount, setShowMyAccount] = useState(false);
    const [showBackupModal, setShowBackupModal] = useState(false);
    const [showTabModal, setShowTabModal] = useState(false);
    const [pingModalData, setPingModalData] = useState(null);

    const [displayMode, setDisplayMode] = useState('list');
    const [monitorConfig, setMonitorConfig] = useState({ interval: 180, enabled: false });
    const [sortConfig, setSortConfig] = useState({ key: 'ip', direction: 'asc' });

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        if (user) {
            fetchIps();
            fetchTabs();
            if (user.username === 'admin') fetchMonitorStatus();
        }
    }, [user, pagination.currentPage, debouncedSearch, activeTab, view, sortConfig]);

    const fetchTabs = async () => {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/tabs', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) setTabs([{ id: 'all', name: 'All IPs' }, ...(await res.json())]);
    };

    const fetchIps = async () => {
        const token = localStorage.getItem('token');
        const queryParams = new URLSearchParams({
            page: pagination.currentPage,
            limit: 50,
            search: debouncedSearch,
            tab_id: activeTab,
            sort: sortConfig.key,
            order: sortConfig.direction
        });
        const res = await fetch(`/api/ips?${queryParams}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            const data = await res.json();
            setAllIps(data.data);
            setPagination(prev => ({ ...prev, ...data.pagination }));
            // Clear selection on refresh/page change to avoid stale IDs
            if (pagination.currentPage !== data.pagination.currentPage) setSelectedIds([]);
        } else if (res.status === 401) logout();
    };

    const fetchMonitorStatus = async () => {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/monitor/status', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) setMonitorConfig(await res.json());
    };

    const handleMonitorConfig = async (newInterval, newEnabled) => {
        const token = localStorage.getItem('token');
        await fetch('/api/monitor/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ interval: newInterval, enabled: newEnabled })
        });
        fetchMonitorStatus();
    };

    const handlePingAll = async () => {
        const token = localStorage.getItem('token');
        await fetch('/api/monitor/ping-all', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        alert('Ping job started in background');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const res = await fetch('/api/ips', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(form)
        });
        if (res.ok) {
            setForm({ ip: '', hostname: '', ports: '', status: 'Available', note: '', tab_id: '', subnet: '', cidr: '' });
            fetchIps();
        } else {
            const err = await res.json();
            if (res.status === 409) {
                alert("IP already exists — add subnet/CIDR instead");
            } else {
                alert(err.error);
            }
        }
    };

    const handleStatusChange = async (id, newStatus) => {
        const token = localStorage.getItem('token');
        await fetch(`/api/ips/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ status: newStatus })
        });
        fetchIps();
    };

    const handleEdit = async (data) => {
        const token = localStorage.getItem('token');
        await fetch(`/api/ips/${editingIp.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        setEditingIp(null);
        fetchIps();
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete IP?')) return;
        const token = localStorage.getItem('token');
        await fetch(`/api/ips/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        fetchIps();
    };

    const handleAddTab = async (name) => {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/tabs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name })
        });
        if (res.ok) {
            fetchTabs();
            setShowTabModal(false);
        } else {
            alert('Failed to add tab');
        }
    };

    const handleDeleteTab = async (id) => {
        if (!confirm('Delete tab? IPs in this tab will remain but become unassigned.')) return;
        const token = localStorage.getItem('token');
        await fetch(`/api/tabs/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (activeTab === id) setActiveTab('all');
        fetchTabs();
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(allIps.map(ip => ip.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(sid => sid !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} IPs?`)) return;

        const token = localStorage.getItem('token');
        const res = await fetch('/api/ips/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ ids: selectedIds })
        });

        if (res.ok) {
            const data = await res.json();
            alert(data.message);
            setSelectedIds([]);
            fetchIps();
        } else {
            alert('Bulk delete failed');
        }
    };

    const handleCheckStatus = async (ip) => {
        setPingModalData(ip);
    };

    const handleExportExcel = async () => {
        const token = localStorage.getItem('token');
        const queryParams = new URLSearchParams({
            search: debouncedSearch,
            tab_id: activeTab
        });
        try {
            const res = await fetch(`/api/ips/export-excel?${queryParams}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ips_export_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
            } else {
                alert('Export failed');
            }
        } catch (err) {
            alert('Export failed');
        }
    };

    if (loading) return <div className="loading">Loading...</div>;
    if (!user) return <Login />;

    return (
        <div className="container">
            <header>
                <div className="header-top">
                    <h1><Server size={32} /> IP Manager</h1>
                    <div className="user-controls">
                        <span>{user.username} ({user.role})</span>
                        {user.role === 'admin' && (
                            <>
                                {user.username === 'admin' && (
                                    <>
                                        <button onClick={() => setView(view === 'users' ? 'ips' : 'users')}>
                                            <Users size={16} /> Users
                                        </button>
                                        <button onClick={() => setView(view === 'monitor' ? 'ips' : 'monitor')}>
                                            <Activity size={16} /> Monitor
                                        </button>
                                        <button onClick={() => setView(view === 'logs' ? 'ips' : 'logs')}>
                                            <FileText size={16} /> Logs
                                        </button>
                                    </>
                                )}
                                <button onClick={() => setShowBackupModal(true)} className="btn-backup">
                                    <Save size={16} /> Backup
                                </button>
                            </>
                        )}
                        <button onClick={() => setShowMyAccount(true)} className="btn-account">
                            <Shield size={16} /> Account
                        </button>
                        <button onClick={logout} className="btn-logout"><LogOut size={16} /> Logout</button>
                    </div>
                </div>
            </header>

            <div className="main-nav">
                <button className={view === 'ips' ? 'active' : ''} onClick={() => setView('ips')}>IP Management</button>
            </div>

            <main>
                {view === 'users' && user.username === 'admin' ? (
                    <UserManagement />
                ) : view === 'monitor' && user.username === 'admin' ? (
                    <MonitorView
                        monitorConfig={monitorConfig}
                        onConfigChange={handleMonitorConfig}
                        onPingAll={handlePingAll}
                        onPingOne={async (ip) => {
                            const token = localStorage.getItem('token');
                            const res = await fetch('/api/monitor/ping-one', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                body: JSON.stringify({ ip })
                            });
                            if (res.ok) {
                                alert('Ping check completed');
                                fetchIps();
                            } else {
                                alert('Ping check failed');
                            }
                        }}
                    />
                ) : view === 'logs' && user.username === 'admin' ? (
                    <LogsTab />
                ) : (
                    <>
                        {user.role === 'admin' && (
                            <section className="card form-card">
                                <h2><Plus size={20} /> Add New IP</h2>
                                <form onSubmit={handleSubmit}>
                                    <div className="form-row">
                                        <input placeholder="IP Address" value={form.ip} onChange={e => setForm({ ...form, ip: e.target.value })} required />
                                        <input placeholder="Hostname" value={form.hostname} onChange={e => setForm({ ...form, hostname: e.target.value })} />
                                        <input placeholder="Subnet (Optional)" value={form.subnet} onChange={e => setForm({ ...form, subnet: e.target.value })} />
                                        <input placeholder="CIDR (Optional)" value={form.cidr} onChange={e => setForm({ ...form, cidr: e.target.value })} />
                                    </div>
                                    <div className="form-row">
                                        <input placeholder="Ports" value={form.ports} onChange={e => setForm({ ...form, ports: e.target.value })} />
                                        <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                                            <option value="Up">Up</option>
                                            <option value="Down">Down</option>
                                            <option value="Available">Available</option>
                                            <option value="Reserved">Reserved</option>
                                            <option value="Pending">Pending</option>
                                        </select>
                                        <select value={form.tab_id} onChange={e => setForm({ ...form, tab_id: e.target.value })}>
                                            <option value="">Unassigned</option>
                                            {tabs.filter(t => t.id !== 'all').map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button type="submit"><Plus size={16} /> Add Entry</button>
                                </form>
                            </section>
                        )}

                        <section className="card list-card">
                            <div className="list-header">
                                <div className="view-toggle">
                                    <button className={displayMode === 'list' ? 'active' : ''} onClick={() => setDisplayMode('list')}><List size={16} /></button>
                                    <button className={displayMode === 'pool' ? 'active' : ''} onClick={() => setDisplayMode('pool')}><LayoutGrid size={16} /></button>
                                    <button className={displayMode === 'map' ? 'active' : ''} onClick={() => setDisplayMode('map')}><Network size={16} /></button>
                                </div>
                                {selectedIds.length > 0 && user.role === 'admin' && (
                                    <button className="btn-delete-selected" onClick={handleBulkDelete}>
                                        <Trash2 size={16} /> Delete {selectedIds.length} Selected
                                    </button>
                                )}
                                <div className="search-box">
                                    <Search className="search-icon" size={18} />
                                    <input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="search-input" />
                                </div>
                                <button onClick={handleExportExcel} className="btn-secondary" title="Export current view to Excel">
                                    <Download size={16} /> Export Excel
                                </button>
                            </div>

                            <div className="tabs-container">
                                <div className="tabs">
                                    {tabs.map(tab => (
                                        <div key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                                            {tab.name}
                                            {tab.id !== 'all' && user.role === 'admin' && (
                                                <button className="btn-tab-delete" onClick={(e) => { e.stopPropagation(); handleDeleteTab(tab.id); }}>
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {user.role === 'admin' && (
                                        <button className="btn-add-tab" onClick={() => setShowTabModal(true)} title="Add New Tab">
                                            <Plus size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {displayMode === 'pool' && <PoolView ips={allIps} onEdit={setEditingIp} />}
                            {displayMode === 'map' && <NetworkMap ips={allIps} tabs={tabs} />}
                            {displayMode === 'list' && (
                                <div className="table-container">
                                    <table className="ip-table">
                                        <thead>
                                            <tr>
                                                <th>
                                                    <input
                                                        type="checkbox"
                                                        onChange={handleSelectAll}
                                                        checked={allIps.length > 0 && selectedIds.length === allIps.length}
                                                    />
                                                </th>
                                                <th onClick={() => handleSort('ip')} className="sortable">IP {sortConfig.key === 'ip' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                                <th onClick={() => handleSort('hostname')} className="sortable">Hostname {sortConfig.key === 'hostname' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                                <th onClick={() => handleSort('cidr')} className="sortable">CIDR {sortConfig.key === 'cidr' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                                <th>Live</th>
                                                <th onClick={() => handleSort('status')} className="sortable">Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                                {activeTab === 'all' && <th>Tab</th>}
                                                <th onClick={() => handleSort('last_updated_by')} className="sortable">Last Updated By {sortConfig.key === 'last_updated_by' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {allIps.map(ip => (
                                                <tr key={ip.id} className={selectedIds.includes(ip.id) ? 'selected-row' : ''}>
                                                    <td>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.includes(ip.id)}
                                                            onChange={() => handleSelectOne(ip.id)}
                                                        />
                                                    </td>
                                                    <td>{ip.ip}</td>
                                                    <td>{ip.hostname}</td>
                                                    <td>{ip.cidr || '-'}</td>
                                                    <td>
                                                        <div className="live-cell">
                                                            <div className={`status-dot ${ip.last_status === 'UP' ? 'up' : 'down'}`}></div>
                                                            <span>
                                                                {ip.last_status === 'UP' ? 'Up' :
                                                                    ip.last_status === 'RESERVED' ? 'Reserved' : 'Down'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <select
                                                            value={ip.status}
                                                            onChange={(e) => handleStatusChange(ip.id, e.target.value)}
                                                            className={`status-select ${ip.status}`}
                                                        >
                                                            <option value="Up">Up</option>
                                                            <option value="Down">Down</option>
                                                            <option value="Available">Available</option>
                                                            <option value="Reserved">Reserved</option>
                                                            <option value="Pending">Pending</option>
                                                        </select>
                                                    </td>
                                                    {activeTab === 'all' && (
                                                        <td>
                                                            {tabs.find(t => t.id === ip.tab_id)?.name || '-'}
                                                        </td>
                                                    )}
                                                    <td>{ip.last_updated_by || '-'}</td>
                                                    <td>
                                                        <button className="btn-edit" onClick={() => setEditingIp(ip)} title="Edit IP"><Edit2 size={16} /></button>
                                                        <button className="btn-primary" onClick={() => handleCheckStatus(ip)} title="Check Status"><Activity size={16} /></button>
                                                        <button className="btn-delete" onClick={() => handleDelete(ip.id)} title="Delete IP"><Trash2 size={16} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    </>
                )}
            </main >

            <ChangePasswordModal isOpen={showMyAccount} onClose={() => setShowMyAccount(false)} onSave={() => { }} title="My Account" />
            <BackupModal isOpen={showBackupModal} onClose={() => setShowBackupModal(false)} />
            <TabModal isOpen={showTabModal} onClose={() => setShowTabModal(false)} onSave={handleAddTab} />
            <PingStatusModal isOpen={!!pingModalData} onClose={() => setPingModalData(null)} ipData={pingModalData} onRefresh={fetchIps} />
            {editingIp && <EditModal ip={editingIp} tabs={tabs} onClose={() => setEditingIp(null)} onSave={handleEdit} />}
        </div >
    );
}
