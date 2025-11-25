import React, { useState, useEffect } from 'react';
import { useAuth } from './index';
import ForceGraph2D from 'react-force-graph-2d';
import {
    Search, Edit2, Trash2, Check, X, Activity, Plus, LogOut, Users,
    Server, RefreshCw, Save, AlertCircle, MoreVertical, CheckSquare, Square,
    Lock, Shield, Power, Key, LayoutGrid, List, Network
} from 'lucide-react';

const Login = () => {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

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
            <div className="card login-card">
                <h2>Login</h2>
                {error && <div className="error-msg">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />
                    <button type="submit">Sign In</button>
                </form>
            </div>
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
                            <span className={!u.is_active ? 'disabled-user' : ''}>{u.username} ({u.role})</span>
                            {!u.is_active && <span className="badge-disabled">Disabled</span>}
                        </div>
                        <div className="user-actions">
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

// Edit Modal Component
const EditModal = ({ ip, tabs, onClose, onSave }) => {
    const [form, setForm] = useState({
        ip: ip.ip,
        hostname: ip.hostname || '',
        ports: ip.ports || '',
        status: ip.status || 'active',
        note: ip.note || '',
        tab_id: ip.tab_id || '',
        subnet: ip.subnet || '',
        cidr: ip.cidr || ''
    });
    const [pinging, setPinging] = useState(false);
    const [pingResult, setPingResult] = useState(null);

    const handlePing = async (autoUpdate = false) => {
        setPinging(true);
        setPingResult(null);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/ping', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ip: form.ip })
            });
            const data = await res.json();
            setPingResult(data);

            if (autoUpdate) {
                setForm(prev => ({
                    ...prev,
                    status: data.alive ? 'active' : 'inactive'
                }));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setPinging(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Validation
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (form.subnet && !ipRegex.test(form.subnet)) {
            alert('Invalid Subnet format');
            return;
        }
        if (form.cidr) {
            const cidrRegex = /^\/([0-9]|[1-2][0-9]|3[0-2])$/;
            if (!cidrRegex.test(form.cidr)) {
                alert('Invalid CIDR format (e.g. /24)');
                return;
            }
        }
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
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="reserved">Reserved</option>
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
                        <div className="form-group ping-section">
                            <div className="ping-controls">
                                <button type="button" onClick={() => handlePing(false)} disabled={pinging} className="btn-ping">
                                    {pinging ? <RefreshCw className="spin" size={16} /> : <Activity size={16} />} Test Ping
                                </button>
                                <button type="button" onClick={() => handlePing(true)} disabled={pinging} className="btn-ping-auto">
                                    {pinging ? <RefreshCw className="spin" size={16} /> : <CheckSquare size={16} />} Check & Update Status
                                </button>
                            </div>
                            {pingResult && (
                                <div className={`ping-status ${pingResult.alive ? 'alive' : 'dead'}`}>
                                    {pingResult.alive ? <Check size={16} /> : <AlertCircle size={16} />}
                                    {pingResult.alive ? ' Host is Up' : ' Host is Down'}
                                    {pingResult.avgLatencyMs && ` (${pingResult.avgLatencyMs}ms)`}
                                </div>
                            )}
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

// Backup Modal Component
const BackupModal = ({ isOpen, onClose }) => {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [mode, setMode] = useState('merge'); // merge | replace
    const [msg, setMsg] = useState('');

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
            console.error(err);
            setMsg('Export failed');
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    setPreview({
                        users: data.users?.length || 0,
                        ips: data.ips?.length || 0,
                        tabs: data.tabs?.length || 0,
                        settings: data.settings?.length || 0,
                        timestamp: data.timestamp
                    });
                } catch (err) {
                    setMsg('Invalid JSON file');
                }
            };
            reader.readAsText(selectedFile);
        }
    };

    const handleImport = async () => {
        if (!file || !preview) return;
        if (mode === 'replace' && !confirm('WARNING: This will replace ALL existing data. Are you sure?')) return;

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
                    body: JSON.stringify({ data, mode })
                });
                if (res.ok) {
                    setMsg('Import successful! Please refresh.');
                    setTimeout(() => window.location.reload(), 2000);
                } else {
                    const err = await res.json();
                    setMsg('Import failed: ' + err.error);
                }
            } catch (err) {
                setMsg('Import failed');
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>System Backup</h3>
                    <button onClick={onClose}><X size={24} /></button>
                </div>
                <div className="modal-body">
                    {msg && <div className="info-msg">{msg}</div>}

                    <div className="backup-section">
                        <h4>Export</h4>
                        <p>Download a full backup of Users, IPs, Tabs, and Settings.</p>
                        <button onClick={handleExport} className="btn-save"><Save size={16} /> Export Backup</button>
                    </div>

                    <div className="backup-section">
                        <h4>Import</h4>
                        <input type="file" accept=".json" onChange={handleFileChange} />

                        {preview && (
                            <div className="import-preview">
                                <p><strong>Backup Date:</strong> {new Date(preview.timestamp).toLocaleString()}</p>
                                <p>Contains: {preview.users} Users, {preview.ips} IPs, {preview.tabs} Tabs</p>

                                <div className="import-options">
                                    <label>
                                        <input
                                            type="radio"
                                            name="mode"
                                            value="merge"
                                            checked={mode === 'merge'}
                                            onChange={e => setMode(e.target.value)}
                                        /> Merge (Update existing, add new)
                                    </label>
                                    <label>
                                        <input
                                            type="radio"
                                            name="mode"
                                            value="replace"
                                            checked={mode === 'replace'}
                                            onChange={e => setMode(e.target.value)}
                                        /> Full Replace (Delete all current data)
                                    </label>
                                </div>

                                <button onClick={handleImport} className="btn-delete">
                                    <RefreshCw size={16} /> Restore Backup
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// State Monitoring Tab Component
const StateTab = ({ allIps, onRefresh }) => {
    const [status, setStatus] = useState({ interval: 3, enabled: false, lastRun: null, nextRun: null });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/monitor/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setStatus(await res.json());
        } catch (err) {
            console.error(err);
        }
    };

    const handleConfigUpdate = async (newInterval, newEnabled) => {
        const token = localStorage.getItem('token');
        try {
            await fetch('/api/monitor/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ interval: newInterval, enabled: newEnabled })
            });
            fetchStatus();
        } catch (err) {
            console.error(err);
        }
    };

    const handlePingAll = async () => {
        const token = localStorage.getItem('token');
        try {
            await fetch('/api/monitor/ping-all', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            alert('Background ping job started.');
        } catch (err) {
            console.error(err);
        }
    };

    const handlePingOne = async (id) => {
        const token = localStorage.getItem('token');
        try {
            await fetch(`/api/monitor/ping/${id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            onRefresh(); // Refresh parent list to show new status
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="state-tab">
            <div className="state-controls card">
                <h3>Monitor Settings</h3>
                <div className="controls-row">
                    <div className="control-group">
                        <label>Auto-Ping Interval (Hours):</label>
                        <select
                            value={status.interval}
                            onChange={e => handleConfigUpdate(parseInt(e.target.value), status.enabled)}
                        >
                            {[1, 2, 3, 4, 6, 8, 12].map(h => (
                                <option key={h} value={h}>{h} Hours</option>
                            ))}
                        </select>
                    </div>
                    <div className="control-group">
                        <label>Live Update:</label>
                        <button
                            className={`btn-toggle ${status.enabled ? 'active' : 'inactive'}`}
                            onClick={() => handleConfigUpdate(status.interval, !status.enabled)}
                        >
                            {status.enabled ? 'ON' : 'OFF'}
                        </button>
                    </div>
                    <div className="control-group">
                        <button onClick={handlePingAll} className="btn-ping-all">
                            <Activity size={16} /> Ping All Now
                        </button>
                    </div>
                </div>
                <div className="status-info">
                    <span>Last Update: {status.lastRun ? new Date(status.lastRun).toLocaleString() : 'Never'}</span>
                    {status.enabled && <span>Next Update: {status.nextRun ? new Date(status.nextRun).toLocaleString() : 'Calculating...'}</span>}
                </div>
            </div>

            <div className="ip-grid">
                {allIps.map(ip => (
                    <div key={ip.id} className={`ip-card ${ip.last_status === 'UP' ? 'status-up' : ip.last_status === 'DOWN' ? 'status-down' : 'status-unknown'}`}>
                        <div className="ip-header">
                            <span className="ip-addr">{ip.ip}</span>
                            <span className={`badge ${ip.last_status === 'UP' ? 'badge-success' : 'badge-danger'}`}>
                                {ip.last_status || 'UNKNOWN'}
                            </span>
                        </div>
                        <div className="ip-details">
                            <small>{ip.hostname}</small>
                            <small>Last Checked: {ip.last_checked ? new Date(ip.last_checked).toLocaleTimeString() : 'Never'}</small>
                        </div>
                        <button onClick={() => handlePingOne(ip.id)} className="btn-icon-small" title="Ping Now">
                            <RefreshCw size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const PoolView = ({ ips, onEdit }) => {
    return (
        <div className="ip-grid">
            {ips.map(ip => (
                <div
                    key={ip.id}
                    className={`ip-card status-${ip.status === 'active' ? 'active' : ip.status === 'inactive' ? 'inactive' : 'unknown'}`}
                    onClick={() => onEdit(ip)}
                    style={{ cursor: 'pointer' }}
                >
                    <div className="ip-card-header">
                        <span className="ip-address">{ip.ip}</span>
                        <span className={`status-dot ${ip.status === 'active' ? 'active' : ip.status === 'inactive' ? 'inactive' : 'unknown'}`}></span>
                    </div>
                    <div className="ip-hostname">{ip.hostname || 'No Hostname'}</div>
                    <div className="ip-meta">
                        <span>{ip.note || 'No notes'}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

const NetworkMap = ({ ips }) => {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });

    useEffect(() => {
        const nodes = ips.map(ip => ({
            id: ip.ip,
            group: ip.status === 'active' ? 1 : 2,
            val: 5,
            name: ip.hostname || ip.ip,
            status: ip.status
        }));

        const links = [];
        // Connect all to a central gateway for now
        nodes.push({ id: 'Gateway', group: 0, val: 10, name: 'Network Gateway', status: 'active' });

        ips.forEach(ip => {
            links.push({ source: 'Gateway', target: ip.ip });
        });

        setGraphData({ nodes, links });
    }, [ips]);

    return (
        <div className="network-map-container">
            <div className="map-controls">
                <small style={{ color: '#94a3b8' }}>Scroll to Zoom • Drag to Pan</small>
            </div>
            <ForceGraph2D
                graphData={graphData}
                nodeLabel="name"
                nodeColor={node => node.status === 'active' ? '#22c55e' : node.status === 'inactive' ? '#ef4444' : '#94a3b8'}
                linkColor={() => '#334155'}
                backgroundColor="#000510"
                nodeRelSize={6}
            />
        </div>
    );
};

export default function App() {
    const { user, logout, loading } = useAuth();
    const [allIps, setAllIps] = useState([]);
    const [form, setForm] = useState({ ip: '', hostname: '', ports: '', status: 'active', note: '', tab_id: '', subnet: '', cidr: '' });
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [pingResult, setPingResult] = useState(null);
    const [pinging, setPinging] = useState(false);
    const [view, setView] = useState('ips'); // 'ips' or 'users' or 'state'
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [editingIp, setEditingIp] = useState(null);
    const [activeTab, setActiveTab] = useState('all');
    const [tabs, setTabs] = useState([{ id: 'all', name: 'All IPs' }]);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0 });
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [showMyAccount, setShowMyAccount] = useState(false);
    const [showBackupModal, setShowBackupModal] = useState(false);
    const [displayMode, setDisplayMode] = useState('list'); // list, pool, map

    const handleUpdateOwnPassword = async ({ oldPassword, newPassword }) => {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/profile/password', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ oldPassword, newPassword })
        });
        const data = await res.json();
        if (res.ok) {
            setShowMyAccount(false);
            alert('Password updated successfully');
        } else {
            alert(data.error || 'Failed to update password');
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPagination(prev => ({ ...prev, currentPage: 1 }));
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        if (user) {
            fetchIps();
            fetchTabs();
        }
    }, [user, pagination.currentPage, debouncedSearch, activeTab, view]);

    const fetchTabs = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/tabs', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setTabs([{ id: 'all', name: 'All IPs' }, ...data]);
            }
        } catch (err) {
            console.error('Failed to fetch tabs', err);
        }
    };

    const fetchIps = async () => {
        const token = localStorage.getItem('token');
        try {
            const queryParams = new URLSearchParams({
                page: pagination.currentPage,
                limit: 50,
                search: debouncedSearch,
                tab_id: activeTab
            });
            const res = await fetch(`/api/ips?${queryParams}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAllIps(data.data);
                setPagination(prev => ({ ...prev, ...data.pagination }));
            } else if (res.status === 401 || res.status === 403) {
                logout();
            }
        } catch (err) {
            console.error('Failed to fetch IPs', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (form.subnet && !ipRegex.test(form.subnet)) {
            alert('Invalid Subnet format');
            return;
        }
        if (form.cidr) {
            const cidrRegex = /^\/([0-9]|[1-2][0-9]|3[0-2])$/;
            if (!cidrRegex.test(form.cidr)) {
                alert('Invalid CIDR format (e.g. /24)');
                return;
            }
        }
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/ips', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(form)
            });
            if (res.ok) {
                setForm({ ip: '', hostname: '', ports: '', status: 'active', note: '', tab_id: '', subnet: '', cidr: '' });
                setShowAdvanced(false);
                fetchIps();
            } else {
                const err = await res.json();
                if (res.status === 409) {
                    if (confirm("This IP already exists. Do you want to add an entry for a specific subnet/CIDR?")) {
                        setShowAdvanced(true);
                    }
                } else {
                    alert(err.error);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure?')) return;
        const token = localStorage.getItem('token');
        try {
            await fetch(`/api/ips/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchIps();
        } catch (err) {
            console.error(err);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) {
            alert('Please select at least one IP to delete');
            return;
        }
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} IP(s)?`)) return;

        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/ips/bulk-delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ids: selectedIds })
            });
            if (res.ok) {
                setSelectedIds([]);
                fetchIps();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleEdit = async (updatedData) => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/ips/${editingIp.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updatedData)
            });
            if (res.ok) {
                setEditingIp(null);
                fetchIps();
            } else {
                const err = await res.json();
                alert(err.error);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handlePing = async (ip) => {
        setPinging(true);
        setPingResult(null);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/ping', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ip })
            });
            const data = await res.json();
            setPingResult(data);
        } catch (err) {
            console.error(err);
        } finally {
            setPinging(false);
        }
    };

    const handleSelectAll = (checked) => {
        if (checked) {
            setSelectedIds(filteredIps.map(ip => ip.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id, checked) => {
        if (checked) {
            setSelectedIds([...selectedIds, id]);
        } else {
            setSelectedIds(selectedIds.filter(sid => sid !== id));
        }
    };

    const exportToExcel = () => {
        const ipsToExport = filteredIps;
        const headers = ['IP Address', 'Subnet', 'CIDR', 'Hostname', 'Ports', 'Status', 'Notes', 'Tab Assigned', 'Last Updated By', 'Created At'];
        const rows = ipsToExport.map(ip => [
            ip.ip,
            ip.subnet || '',
            ip.cidr || '',
            ip.hostname || '',
            ip.ports || '',
            ip.status,
            ip.note || '',
            tabs.find(t => t.id === ip.tab_id)?.name || 'Unassigned',
            ip.last_updated_by || ip.created_by || 'System',
            new Date(ip.created_at).toLocaleString()
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `ip-manager-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const addNewTab = async () => {
        const tabName = prompt('Enter tab name:');
        if (tabName) {
            const token = localStorage.getItem('token');
            try {
                const res = await fetch('/api/tabs', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ name: tabName })
                });
                if (res.ok) {
                    fetchTabs();
                } else {
                    alert('Failed to add tab');
                }
            } catch (err) {
                console.error(err);
            }
        }
    };

    const removeTab = async (tabId) => {
        if (tabId === 'all') return;
        if (!confirm('Remove this tab? IPs will become unassigned.')) return;

        const token = localStorage.getItem('token');
        try {
            await fetch(`/api/tabs/${tabId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchTabs();
            if (activeTab === tabId) setActiveTab('all');
            fetchIps();
        } catch (err) {
            console.error(err);
        }
    };

    const filteredIps = allIps;

    if (loading) return <div className="loading"><RefreshCw className="spin" size={48} /></div>;
    if (!user) return <Login />;

    return (
        <div className="container">
            <header>
                <div className="header-top">
                    <h1><Server size={32} style={{ marginRight: '10px', verticalAlign: 'middle' }} /> IP Manager</h1>
                    <div className="user-controls">
                        <span>{user.username} ({user.role})</span>
                        {user.role === 'admin' && (
                            <>
                                <button onClick={() => setView(view === 'users' ? 'ips' : 'users')}>
                                    {view === 'users' ? <Server size={16} /> : <Users size={16} />}
                                    {view === 'users' ? ' Manage IPs' : ' Manage Users'}
                                </button>
                                <button onClick={() => setShowBackupModal(true)} className="btn-backup">
                                    <Save size={16} /> Backup
                                </button>
                            </>
                        )}
                        <button onClick={() => setShowMyAccount(true)} className="btn-account">
                            <Shield size={16} /> My Account
                        </button>
                        <button onClick={logout} className="btn-logout"><LogOut size={16} /> Logout</button>
                    </div>
                </div>
            </header>

            <div className="main-nav">
                <button className={view === 'ips' ? 'active' : ''} onClick={() => setView('ips')}>IP Management</button>
                <button className={view === 'state' ? 'active' : ''} onClick={() => setView('state')}>State Monitor</button>
            </div>

            <ChangePasswordModal
                isOpen={showMyAccount}
                onClose={() => setShowMyAccount(false)}
                onSave={handleUpdateOwnPassword}
                title="Change My Password"
                requireOldPassword={true}
            />

            <BackupModal
                isOpen={showBackupModal}
                onClose={() => setShowBackupModal(false)}
            />

            <main>
                {view === 'users' ? (
                    <UserManagement />
                ) : view === 'state' ? (
                    <StateTab allIps={allIps} onRefresh={fetchIps} />
                ) : (
                    <>
                        {user.role === 'admin' && (
                            <section className="card form-card">
                                <h2><Plus size={20} /> Add New IP</h2>
                                <form onSubmit={handleSubmit}>
                                    <div className="form-row">
                                        <input
                                            type="text"
                                            placeholder="IP Address (e.g. 192.168.1.1)"
                                            value={form.ip}
                                            onChange={e => setForm({ ...form, ip: e.target.value })}
                                            required
                                        />
                                        <input
                                            type="text"
                                            placeholder="Hostname"
                                            value={form.hostname}
                                            onChange={e => setForm({ ...form, hostname: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-row">
                                        <input
                                            type="text"
                                            placeholder="Ports (e.g. 80, 443)"
                                            value={form.ports}
                                            onChange={e => setForm({ ...form, ports: e.target.value })}
                                        />
                                        <select
                                            value={form.status}
                                            onChange={e => setForm({ ...form, status: e.target.value })}
                                        >
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                            <option value="reserved">Reserved</option>
                                        </select>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Note"
                                        value={form.note}
                                        onChange={e => setForm({ ...form, note: e.target.value })}
                                    />
                                    <select
                                        value={form.tab_id}
                                        onChange={e => setForm({ ...form, tab_id: e.target.value })}
                                        style={{ marginLeft: '10px' }}
                                    >
                                        <option value="">Select Tab (Optional)</option>
                                        {tabs.filter(t => t.id !== 'all').map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                    <div style={{ marginTop: '10px' }}>
                                        <button type="button" className="btn-link" onClick={() => setShowAdvanced(!showAdvanced)} style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                                            {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options (Subnet/CIDR)'}
                                        </button>
                                    </div>
                                    {showAdvanced && (
                                        <div className="form-row" style={{ marginTop: '10px' }}>
                                            <input
                                                type="text"
                                                placeholder="Subnet (e.g. 255.255.255.0)"
                                                value={form.subnet}
                                                onChange={e => setForm({ ...form, subnet: e.target.value })}
                                            />
                                            <input
                                                type="text"
                                                placeholder="CIDR (e.g. /24)"
                                                value={form.cidr}
                                                onChange={e => setForm({ ...form, cidr: e.target.value })}
                                            />
                                        </div>
                                    )}
                                    <button type="submit" style={{ marginTop: '10px' }}><Plus size={16} /> Add Entry</button>
                                </form>
                            </section>
                        )}

                        <section className="card list-card">
                            <div className="list-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <h2>Managed IPs</h2>
                                    <div className="view-toggle">
                                        <button className={`view-btn ${displayMode === 'list' ? 'active' : ''}`} onClick={() => setDisplayMode('list')} title="List View"><List size={16} /> List</button>
                                        <button className={`view-btn ${displayMode === 'pool' ? 'active' : ''}`} onClick={() => setDisplayMode('pool')} title="Pool View"><LayoutGrid size={16} /> Pool</button>
                                        <button className={`view-btn ${displayMode === 'map' ? 'active' : ''}`} onClick={() => setDisplayMode('map')} title="Network Map"><Network size={16} /> Map</button>
                                    </div>
                                </div>
                                <div className="search-box">
                                    <Search className="search-icon" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search by IP, hostname, notes, or status..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="search-input"
                                    />
                                </div>
                            </div>

                            <div className="tabs-container">
                                <div className="tabs">
                                    {tabs.map(tab => (
                                        <div
                                            key={tab.id}
                                            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                                            onClick={() => {
                                                setActiveTab(tab.id);
                                                setPagination(prev => ({ ...prev, currentPage: 1 }));
                                            }}
                                        >
                                            {tab.name}
                                            {tab.id !== 'all' && (
                                                <button
                                                    className="tab-close"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeTab(tab.id);
                                                    }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {user.role === 'admin' && (
                                        <button className="tab-add" onClick={addNewTab}><Plus size={14} /> Add Tab</button>
                                    )}
                                </div>
                                <button className="btn-export" onClick={exportToExcel}>
                                    📊 Export to Excel
                                </button>
                            </div>

                            {user.role === 'admin' && filteredIps.length > 0 && (
                                <div className="bulk-actions">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === filteredIps.length && filteredIps.length > 0}
                                            onChange={e => handleSelectAll(e.target.checked)}
                                        />
                                        <span>Select All</span>
                                    </label>
                                    {selectedIds.length > 0 && (
                                        <button className="btn-delete-bulk" onClick={handleBulkDelete}>
                                            <Trash2 size={16} /> Delete Selected ({selectedIds.length})
                                        </button>
                                    )}
                                </div>
                            )}

                            {filteredIps.length === 0 ? (
                                <p className="empty-state">
                                    {searchQuery ? 'No IPs match your search.' : 'No IPs added yet.'}
                                </p>
                            ) : (
                                <>
                                    {displayMode === 'pool' && <PoolView ips={filteredIps} onEdit={setEditingIp} />}
                                    {displayMode === 'map' && <NetworkMap ips={filteredIps} />}
                                    {displayMode === 'list' && (
                                        <div className="table-container">
                                            <table className="ip-table">
                                                <thead>
                                                    <tr>
                                                        {user.role === 'admin' && <th style={{ width: '40px' }}></th>}
                                                        <th>#</th>
                                                        <th>IP</th>
                                                        <th>Subnet</th>
                                                        <th>CIDR</th>
                                                        <th>Hostname</th>
                                                        <th>Ports</th>
                                                        <th>Status</th>
                                                        <th>Note</th>
                                                        {activeTab === 'all' && <th>Tab Assigned</th>}
                                                        <th>Last Updated By</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredIps.map((item, index) => (
                                                        <tr key={item.id} className={selectedIds.includes(item.id) ? 'selected' : ''}>
                                                            {user.role === 'admin' && (
                                                                <td>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedIds.includes(item.id)}
                                                                        onChange={e => handleSelectOne(item.id, e.target.checked)}
                                                                    />
                                                                </td>
                                                            )}
                                                            <td>{index + 1}</td>
                                                            <td>{item.ip}</td>
                                                            <td>{item.subnet}</td>
                                                            <td>{item.cidr}</td>
                                                            <td>{item.hostname}</td>
                                                            <td>{item.ports}</td>
                                                            <td>
                                                                <span className={`status-badge ${item.status}`}>
                                                                    {item.status}
                                                                </span>
                                                            </td>
                                                            <td>{item.note}</td>
                                                            {activeTab === 'all' && (
                                                                <td>
                                                                    <span className="tab-badge">
                                                                        {tabs.find(t => t.id === item.tab_id)?.name || 'Unassigned'}
                                                                    </span>
                                                                </td>
                                                            )}
                                                            <td>{item.last_updated_by || item.created_by || '-'}</td>
                                                            <td>
                                                                <div className="actions">
                                                                    <button
                                                                        className="btn-ping"
                                                                        onClick={() => handlePing(item.ip)}
                                                                        disabled={pinging}
                                                                        title="Ping Host"
                                                                    >
                                                                        <Activity size={16} />
                                                                    </button>
                                                                    {user.role === 'admin' && (
                                                                        <>
                                                                            <button
                                                                                className="btn-edit"
                                                                                onClick={() => setEditingIp(item)}
                                                                                title="Edit"
                                                                            >
                                                                                <Edit2 size={16} />
                                                                            </button>
                                                                            <button
                                                                                className="btn-delete"
                                                                                onClick={() => handleDelete(item.id)}
                                                                                title="Delete"
                                                                            >
                                                                                <Trash2 size={16} />
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            )}
                        </section>
                        <div className="pagination">
                            <button
                                disabled={pagination.currentPage === 1}
                                onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
                            >
                                Previous
                            </button>
                            <span>Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalItems} items)</span>
                            <button
                                disabled={pagination.currentPage === pagination.totalPages}
                                onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                            >
                                Next
                            </button>
                        </div>
                    </>
                )}
            </main>

            {pingResult && (
                <div className="modal-overlay" onClick={() => setPingResult(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Ping Result: {pingResult.ip}</h3>
                            <button onClick={() => setPingResult(null)}><X size={24} /></button>
                        </div>
                        <div className="modal-body">
                            <div className={`status ${pingResult.alive ? 'alive' : 'dead'}`}>
                                {pingResult.alive ? <Check size={24} /> : <AlertCircle size={24} />}
                                {pingResult.alive ? ' Host is Up' : ' Host is Down'}
                            </div>
                            <div className="metrics">
                                <div className="metric">
                                    <span className="label">Packet Loss</span>
                                    <span className="value">{pingResult.packetLoss}%</span>
                                </div>
                                <div className="metric">
                                    <span className="label">Avg Latency</span>
                                    <span className="value">{pingResult.avgLatencyMs ? `${pingResult.avgLatencyMs} ms` : 'N/A'}</span>
                                </div>
                            </div>
                            <pre className="raw-output">{pingResult.raw}</pre>
                        </div>
                    </div>
                </div>
            )}

            {editingIp && (
                <EditModal
                    ip={editingIp}
                    tabs={tabs}
                    onClose={() => setEditingIp(null)}
                    onSave={handleEdit}
                />
            )}
        </div>
    );
}
