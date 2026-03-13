import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './index';
import DiscoveryModal from './DiscoveryModal';
import ForceGraph2D from 'react-force-graph-2d';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Edit2, Trash2, Check, X, Activity, Plus, LogOut, Users,
    Server, RefreshCw, Save, AlertCircle, MoreVertical, CheckSquare, Square,
    Lock, Shield, Power, Key, LayoutGrid, List, Network, FileText, Upload, Download,
    CheckCircle, XCircle, Settings, Clock, Calendar, Globe, Eye, EyeOff, Share2,
    ChevronLeft, ChevronRight, PenLine
} from 'lucide-react';

// ─── Public Tab Viewer Modal ──────────────────────────────────────────────────
const PublicTabViewer = ({ tab, onClose }) => {
    const [ips, setIps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [total, setTotal] = useState(0);
    const [error, setError] = useState('');

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 400);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        if (!tab) return;
        setLoading(true);
        setError('');
        fetch(`/api/public/tab/${tab.share_token}?search=${encodeURIComponent(debouncedSearch)}&limit=200`)
            .then(r => r.json())
            .then(data => {
                if (data.error) { setError(data.error); setIps([]); }
                else { setIps(data.ips || []); setTotal(data.total || 0); }
            })
            .catch(() => setError('Failed to load data'))
            .finally(() => setLoading(false));
    }, [tab, debouncedSearch]);

    if (!tab) return null;

    const statusColor = (s) => {
        if (s === 'UP') return '#22c55e';
        if (s === 'DOWN') return '#ef4444';
        return '#64748b';
    };

    return (
        <div className="pub-viewer-overlay" onClick={onClose}>
            <motion.div
                className="pub-viewer-modal"
                onClick={e => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 20 }}
                transition={{ duration: 0.3, type: 'spring' }}
            >
                <div className="pub-viewer-header">
                    <div className="pub-viewer-title">
                        <div className="pub-viewer-icon"><Globe size={20} /></div>
                        <div>
                            <h3>{tab.name}</h3>
                            <span className="pub-viewer-sub">{total} IP records · Public View</span>
                        </div>
                    </div>
                    <button className="pub-viewer-close" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="pub-viewer-search">
                    <Search size={15} />
                    <input
                        placeholder="Search IPs, hostname, note..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        autoFocus
                    />
                    {search && <button onClick={() => setSearch('')}><X size={13} /></button>}
                </div>

                <div className="pub-viewer-body">
                    {loading ? (
                        <div className="pub-viewer-loading">
                            <div className="pub-spinner"></div>
                            <p>Loading public data...</p>
                        </div>
                    ) : error ? (
                        <div className="pub-viewer-error">
                            <XCircle size={32} />
                            <p>{error}</p>
                        </div>
                    ) : ips.length === 0 ? (
                        <div className="pub-viewer-empty">
                            <Globe size={36} />
                            <p>{search ? 'No matching records' : 'No IP records in this shared tab yet'}</p>
                        </div>
                    ) : (
                        <div className="pub-viewer-table-wrap">
                            <table className="pub-viewer-table">
                                <thead>
                                    <tr>
                                        <th>IP Address</th>
                                        <th>Hostname</th>
                                        <th>Status</th>
                                        <th>Live</th>
                                        <th>Ports</th>
                                        <th>Note</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ips.map((ip, i) => (
                                        <tr key={i}>
                                            <td className="pub-ip-cell">{ip.ip}{ip.cidr && <span className="pub-cidr">{ip.cidr}</span>}</td>
                                            <td>{ip.hostname || '—'}</td>
                                            <td><span className={`pub-status-badge ${ip.status?.toLowerCase()}`}>{ip.status}</span></td>
                                            <td>
                                                <div className="pub-live-dot-wrap">
                                                    <span className="pub-live-dot" style={{ background: statusColor(ip.last_status) }}></span>
                                                    <span>{ip.last_status || '—'}</span>
                                                </div>
                                            </td>
                                            <td>{ip.ports || '—'}</td>
                                            <td className="pub-note-cell">{ip.note || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

// ─── Public Shares Panel (shown on login page) ────────────────────────────────
const PublicSharesPanel = ({ onClose }) => {
    const [tabs, setTabs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTab, setSelectedTab] = useState(null);

    useEffect(() => {
        fetch('/api/public/tabs')
            .then(r => r.json())
            .then(data => { setTabs(Array.isArray(data) ? data : []); })
            .catch(() => setTabs([]))
            .finally(() => setLoading(false));
    }, []);

    return (
        <>
            <AnimatePresence>
                <motion.div
                    className="pub-panel"
                    initial={{ opacity: 0, x: 60 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 60 }}
                    transition={{ duration: 0.35, type: 'spring' }}
                >
                    <div className="pub-panel-header">
                        <div className="pub-panel-title">
                            <Globe size={18} />
                            <span>Public Shares</span>
                        </div>
                        <button className="pub-panel-close" onClick={onClose}><X size={18} /></button>
                    </div>
                    <div className="pub-panel-body">
                        {loading ? (
                            <div className="pub-panel-loading">
                                <div className="pub-spinner-sm"></div>
                                <p>Loading...</p>
                            </div>
                        ) : tabs.length === 0 ? (
                            <div className="pub-panel-empty">
                                <Globe size={28} />
                                <p>No public shares available</p>
                                <span>Admins can enable public sharing on tabs</span>
                            </div>
                        ) : (
                            <div className="pub-panel-list">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        className={`pub-panel-item ${tab.is_default_public ? 'pub-panel-item-default' : ''}`}
                                        onClick={() => setSelectedTab(tab)}
                                    >
                                        <div className="pub-panel-item-icon">
                                            {tab.is_default_public ? <Share2 size={16} /> : <Globe size={16} />}
                                        </div>
                                        <div className="pub-panel-item-info">
                                            <span className="pub-panel-item-name">{tab.name}</span>
                                            {tab.is_default_public && <span className="pub-panel-item-badge">Default</span>}
                                        </div>
                                        <Eye size={14} className="pub-panel-item-eye" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="pub-panel-footer">
                        <Lock size={12} />
                        <span>Read-only · No login required</span>
                    </div>
                </motion.div>
            </AnimatePresence>
            {selectedTab && (
                <PublicTabViewer tab={selectedTab} onClose={() => setSelectedTab(null)} />
            )}
        </>
    );
};

const Login = () => {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [capsLock, setCapsLock] = useState(false);
    const [showPublicPanel, setShowPublicPanel] = useState(false);

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
            {/* Public Shares Button — top right */}
            <motion.button
                className="login-public-shares-btn"
                onClick={() => setShowPublicPanel(p => !p)}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                <Globe size={16} />
                Public Shares
            </motion.button>

            {/* Right-side Panel */}
            <AnimatePresence>
                {showPublicPanel && (
                    <PublicSharesPanel onClose={() => setShowPublicPanel(false)} />
                )}
            </AnimatePresence>

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
        <div className="card user-mgmt-card">
            <div className="user-mgmt-header">
                <h2><Users size={20} /> User Management</h2>
                {msg && <span className="status-msg">{msg}</span>}
            </div>

            <div className="user-creation-bar">
                <form onSubmit={handleAdd} className="inline-user-form">
                    <div className="input-with-icon">
                        <Users size={16} />
                        <input
                            placeholder="Username"
                            value={form.username}
                            onChange={e => setForm({ ...form, username: e.target.value })}
                            required
                        />
                    </div>
                    <div className="input-with-icon">
                        <Lock size={16} />
                        <input
                            type="password"
                            placeholder="Password"
                            value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })}
                            required
                        />
                    </div>
                    <select
                        value={form.role}
                        onChange={e => setForm({ ...form, role: e.target.value })}
                        className="role-pill-select"
                    >
                        <option value="readonly">Readonly</option>
                        <option value="admin">Admin</option>
                    </select>
                    <button type="submit" className="btn-create-user"><Plus size={16} /> Create User</button>
                </form>
            </div>

            <div className="user-directory">
                <div className="directory-header">
                    <span className="col-user">Username</span>
                    <span className="col-role">System Role</span>
                    <span className="col-actions">Actions</span>
                </div>
                {users.map(u => (
                    <div key={u.id} className="directory-row">
                        <div className="col-user user-id-cell">
                            <span className={`username-text ${!u.is_active ? 'disabled-user' : ''}`}>{u.username}</span>
                            {!u.is_active && <span className="badge-disabled">Disabled</span>}
                        </div>
                        <div className="col-role">
                            <select
                                value={u.role}
                                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                disabled={u.username === 'admin'}
                                className={`role-pill-select ${u.role}`}
                            >
                                <option value="admin">Admin</option>
                                <option value="readonly">Readonly</option>
                            </select>
                        </div>
                        <div className="col-actions">
                            <div className="table-actions">
                                {u.username !== 'admin' && u.id !== user.id && (
                                    <>
                                        <button
                                            className={`btn-table-action btn-status ${u.is_active ? 'active' : 'inactive'}`}
                                            onClick={() => handleToggleStatus(u.id, u.is_active)}
                                            title={u.is_active ? "Disable Login" : "Enable Login"}
                                        >
                                            <Power size={14} />
                                        </button>
                                        <button
                                            className="btn-table-action btn-pwd-reset"
                                            onClick={() => setPasswordModalUser(u)}
                                            title="Change Password"
                                        >
                                            <Key size={14} />
                                        </button>
                                        <button className="btn-table-action btn-row-delete" onClick={() => handleDelete(u.id)} title="Delete User">
                                            <Trash2 size={14} />
                                        </button>
                                    </>
                                )}
                            </div>
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
    const [tab, setTab] = useState('backup');
    const [jsonFile, setJsonFile] = useState(null);
    const [excelFile, setExcelFile] = useState(null);
    const [importMode, setImportMode] = useState('replace');
    const [loading, setLoading] = useState(false);
    const [loadingAction, setLoadingAction] = useState('');
    const [result, setResult] = useState(null); // { type: 'success'|'error', title, details, summary }
    const [dragOver, setDragOver] = useState(false);
    const [confirmReplace, setConfirmReplace] = useState(false);
    const jsonInputRef = useRef(null);
    const excelInputRef = useRef(null);

    if (!isOpen) return null;

    const resetState = () => {
        setResult(null);
        setConfirmReplace(false);
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    };

    const downloadFile = (blob, filename) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    };

    // --- JSON Export ---
    const handleJsonExport = async () => {
        resetState();
        setLoading(true);
        setLoadingAction('Exporting full system backup...');
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/backup/export', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const blob = await res.blob();
                const dateStr = new Date().toISOString().split('T')[0];
                downloadFile(blob, `ip-manager-backup-${dateStr}.json`);
                setResult({ type: 'success', title: 'Backup Exported', details: `File saved as ip-manager-backup-${dateStr}.json (${formatFileSize(blob.size)})` });
            } else {
                const err = await res.json().catch(() => ({}));
                setResult({ type: 'error', title: 'Export Failed', details: err.error || 'Server returned an error' });
            }
        } catch (err) {
            setResult({ type: 'error', title: 'Export Failed', details: err.message || 'Network error' });
        } finally {
            setLoading(false);
            setLoadingAction('');
        }
    };

    // --- JSON Import ---
    const handleJsonImport = async () => {
        if (!jsonFile) return;
        if (importMode === 'replace' && !confirmReplace) {
            setConfirmReplace(true);
            return;
        }
        resetState();
        setLoading(true);
        setLoadingAction('Reading backup file...');

        try {
            const text = await jsonFile.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (parseErr) {
                setResult({ type: 'error', title: 'Invalid File', details: 'This file is not valid JSON. Please select a proper backup file.' });
                setLoading(false);
                return;
            }

            // Validate it looks like a backup
            if (!data.tabs && !data.ips && !data.users && !data.settings) {
                setResult({ type: 'error', title: 'Invalid Backup', details: 'This JSON file doesn\'t contain any recognizable backup data (no users, tabs, ips, or settings found).' });
                setLoading(false);
                return;
            }

            setLoadingAction(`Importing ${importMode === 'replace' ? '(replacing all data)' : '(merging with existing)'}...`);
            const token = localStorage.getItem('token');
            const res = await fetch('/api/backup/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ data, mode: importMode })
            });

            const resData = await res.json().catch(() => ({}));
            if (res.ok) {
                setResult({
                    type: 'success',
                    title: 'Backup Restored Successfully',
                    details: `Mode: ${importMode === 'replace' ? 'Full Replace' : 'Merge'}`,
                    summary: resData.summary || null,
                    refresh: true
                });
            } else {
                setResult({ type: 'error', title: 'Import Failed', details: resData.error || 'Server returned an error' });
            }
        } catch (err) {
            setResult({ type: 'error', title: 'Import Failed', details: err.message || 'Network or parsing error' });
        } finally {
            setLoading(false);
            setLoadingAction('');
        }
    };

    // --- Excel Export ---
    const handleExcelExport = async () => {
        resetState();
        setLoading(true);
        setLoadingAction('Exporting IP records to Excel...');
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/backup/export-excel', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const blob = await res.blob();
                const dateStr = new Date().toISOString().split('T')[0];
                downloadFile(blob, `ip-records-${dateStr}.xlsx`);
                setResult({ type: 'success', title: 'Excel Exported', details: `File saved as ip-records-${dateStr}.xlsx (${formatFileSize(blob.size)})` });
            } else {
                const err = await res.json().catch(() => ({}));
                setResult({ type: 'error', title: 'Excel Export Failed', details: err.error || 'Server error' });
            }
        } catch (err) {
            setResult({ type: 'error', title: 'Export Failed', details: err.message });
        } finally {
            setLoading(false);
            setLoadingAction('');
        }
    };

    // --- Excel Import ---
    const handleExcelImport = async () => {
        if (!excelFile) return;
        resetState();
        setLoading(true);
        setLoadingAction('Uploading and processing spreadsheet...');
        const formData = new FormData();
        formData.append('file', excelFile);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/backup/import-excel', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setResult({
                    type: 'success',
                    title: data.message || 'Import Successful',
                    summary: data.summary || null,
                    errors: data.errors || [],
                    refresh: true
                });
            } else {
                setResult({ type: 'error', title: 'Excel Import Failed', details: data.error || 'Server error' });
            }
        } catch (err) {
            setResult({ type: 'error', title: 'Import Failed', details: err.message });
        } finally {
            setLoading(false);
            setLoadingAction('');
        }
    };

    const downloadTemplate = () => window.open('/api/backup/template', '_blank');

    // Drag & drop handlers
    const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
    const handleDragLeave = () => setDragOver(false);
    const handleDropJson = (e) => {
        e.preventDefault(); setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f && f.name.endsWith('.json')) { setJsonFile(f); resetState(); }
    };
    const handleDropExcel = (e) => {
        e.preventDefault(); setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.csv'))) { setExcelFile(f); resetState(); }
    };

    const handleRefresh = () => window.location.reload();

    const tabs = [
        { id: 'backup', label: 'System Backup', icon: <Save size={15} /> },
        { id: 'excel', label: 'Excel', icon: <FileText size={15} /> }
    ];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal backup-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="backup-modal-header">
                    <div className="backup-header-left">
                        <div className="backup-header-icon">
                            <Save size={20} />
                        </div>
                        <div>
                            <h3>System Backup & Import</h3>
                            <span className="backup-subtitle">Export, restore, and manage your data</span>
                        </div>
                    </div>
                    <button className="backup-close-btn" onClick={onClose}><X size={20} /></button>
                </div>

                {/* Tabs */}
                <div className="backup-tab-bar">
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            className={`backup-tab-btn ${tab === t.id ? 'active' : ''}`}
                            onClick={() => { setTab(t.id); resetState(); }}
                        >
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="backup-modal-body">
                    {/* Loading overlay */}
                    {loading && (
                        <div className="backup-loading-overlay">
                            <div className="backup-spinner"></div>
                            <p>{loadingAction}</p>
                        </div>
                    )}

                    {/* Result banner */}
                    {result && (
                        <div className={`backup-result ${result.type}`}>
                            <div className="backup-result-icon">
                                {result.type === 'success' ? <CheckCircle size={22} /> : <XCircle size={22} />}
                            </div>
                            <div className="backup-result-content">
                                <strong>{result.title}</strong>
                                {result.details && <p>{result.details}</p>}
                                {result.summary && (
                                    <div className="backup-result-summary">
                                        {result.summary.users !== undefined && <span>👤 Users: {result.summary.users}</span>}
                                        {result.summary.tabs !== undefined && <span>📁 Tabs: {result.summary.tabs}</span>}
                                        {result.summary.ips !== undefined && <span>🌐 IPs: {result.summary.ips}</span>}
                                        {result.summary.settings !== undefined && <span>⚙️ Settings: {result.summary.settings}</span>}
                                        {result.summary.processed !== undefined && <span>📊 Processed: {result.summary.processed}</span>}
                                        {result.summary.created !== undefined && <span>✅ Created: {result.summary.created}</span>}
                                        {result.summary.duplicates !== undefined && result.summary.duplicates > 0 && <span>🔄 Duplicates: {result.summary.duplicates}</span>}
                                        {result.summary.errorCount !== undefined && result.summary.errorCount > 0 && <span>⚠️ Errors: {result.summary.errorCount}</span>}
                                    </div>
                                )}
                                {result.errors && result.errors.length > 0 && (
                                    <details className="backup-errors-list">
                                        <summary>View {result.errors.length} error(s)</summary>
                                        <ul>{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                                    </details>
                                )}
                                {result.refresh && (
                                    <button className="backup-refresh-btn" onClick={handleRefresh}>
                                        <RefreshCw size={14} /> Reload Page to See Changes
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Confirm Replace Dialog */}
                    {confirmReplace && (
                        <div className="backup-confirm-dialog">
                            <AlertCircle size={20} />
                            <div>
                                <strong>Replace All Data?</strong>
                                <p>This will <b>permanently delete</b> all current IPs, tabs, users, and settings, then import the backup file. This cannot be undone.</p>
                            </div>
                            <div className="backup-confirm-actions">
                                <button className="btn-cancel" onClick={() => setConfirmReplace(false)}>Cancel</button>
                                <button className="backup-btn-danger" onClick={handleJsonImport}>Yes, Replace Everything</button>
                            </div>
                        </div>
                    )}

                    {/* === BACKUP TAB === */}
                    {tab === 'backup' && !loading && (
                        <div className="backup-content-grid">
                            {/* Export Card */}
                            <div className="backup-card">
                                <div className="backup-card-header export">
                                    <Download size={18} />
                                    <span>Export Backup</span>
                                </div>
                                <p className="backup-card-desc">Download a full JSON backup of all your data including IPs, tabs, users, and settings.</p>
                                <button className="backup-action-btn export" onClick={handleJsonExport}>
                                    <Download size={16} /> Download Backup (.json)
                                </button>
                            </div>

                            {/* Import Card */}
                            <div className="backup-card">
                                <div className="backup-card-header import">
                                    <Upload size={18} />
                                    <span>Restore Backup</span>
                                </div>
                                <p className="backup-card-desc">Upload a previously exported JSON backup file to restore your system data.</p>

                                {/* Mode selector */}
                                <div className="backup-mode-selector">
                                    <button
                                        className={`backup-mode-btn ${importMode === 'replace' ? 'active danger' : ''}`}
                                        onClick={() => { setImportMode('replace'); setConfirmReplace(false); }}
                                    >
                                        <AlertCircle size={14} /> Replace All
                                    </button>
                                    <button
                                        className={`backup-mode-btn ${importMode === 'merge' ? 'active safe' : ''}`}
                                        onClick={() => { setImportMode('merge'); setConfirmReplace(false); }}
                                    >
                                        <RefreshCw size={14} /> Merge
                                    </button>
                                </div>
                                <span className="backup-mode-hint">
                                    {importMode === 'replace' ? '⚠️ Deletes all existing data before importing' : '✅ Keeps existing data, adds/updates from backup'}
                                </span>

                                {/* Drop zone */}
                                <div
                                    className={`backup-dropzone ${dragOver ? 'drag-over' : ''} ${jsonFile ? 'has-file' : ''}`}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDropJson}
                                    onClick={() => jsonInputRef.current?.click()}
                                >
                                    <input
                                        ref={jsonInputRef}
                                        type="file"
                                        accept=".json"
                                        style={{ display: 'none' }}
                                        onChange={e => { setJsonFile(e.target.files[0]); resetState(); }}
                                    />
                                    {jsonFile ? (
                                        <div className="backup-file-preview">
                                            <FileText size={22} />
                                            <div>
                                                <strong>{jsonFile.name}</strong>
                                                <span>{formatFileSize(jsonFile.size)}</span>
                                            </div>
                                            <button className="backup-file-remove" onClick={(e) => { e.stopPropagation(); setJsonFile(null); resetState(); }}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="backup-dropzone-content">
                                            <Upload size={24} />
                                            <span>Drop .json file here or <b>click to browse</b></span>
                                        </div>
                                    )}
                                </div>

                                <button
                                    className="backup-action-btn import"
                                    onClick={handleJsonImport}
                                    disabled={!jsonFile}
                                >
                                    <Upload size={16} /> Restore Backup
                                </button>
                            </div>
                        </div>
                    )}

                    {/* === EXCEL TAB === */}
                    {tab === 'excel' && !loading && (
                        <div className="backup-content-grid">
                            {/* Excel Export */}
                            <div className="backup-card">
                                <div className="backup-card-header export">
                                    <Download size={18} />
                                    <span>Export to Excel</span>
                                </div>
                                <p className="backup-card-desc">Download all your IP records as an Excel spreadsheet for analysis or reporting.</p>
                                <button className="backup-action-btn export" onClick={handleExcelExport}>
                                    <Download size={16} /> Download Excel (.xlsx)
                                </button>
                                <button className="backup-template-btn" onClick={downloadTemplate}>
                                    <FileText size={14} /> Download Import Template
                                </button>
                            </div>

                            {/* Excel Import */}
                            <div className="backup-card">
                                <div className="backup-card-header import">
                                    <Upload size={18} />
                                    <span>Import from Excel</span>
                                </div>
                                <p className="backup-card-desc">Upload an Excel or CSV file to bulk-add IP records. Download the template to see the expected format.</p>

                                <div
                                    className={`backup-dropzone ${dragOver ? 'drag-over' : ''} ${excelFile ? 'has-file' : ''}`}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDropExcel}
                                    onClick={() => excelInputRef.current?.click()}
                                >
                                    <input
                                        ref={excelInputRef}
                                        type="file"
                                        accept=".xlsx,.xls,.csv"
                                        style={{ display: 'none' }}
                                        onChange={e => { setExcelFile(e.target.files[0]); resetState(); }}
                                    />
                                    {excelFile ? (
                                        <div className="backup-file-preview">
                                            <FileText size={22} />
                                            <div>
                                                <strong>{excelFile.name}</strong>
                                                <span>{formatFileSize(excelFile.size)}</span>
                                            </div>
                                            <button className="backup-file-remove" onClick={(e) => { e.stopPropagation(); setExcelFile(null); resetState(); }}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="backup-dropzone-content">
                                            <Upload size={24} />
                                            <span>Drop .xlsx / .csv file here or <b>click to browse</b></span>
                                        </div>
                                    )}
                                </div>

                                <button
                                    className="backup-action-btn import"
                                    onClick={handleExcelImport}
                                    disabled={!excelFile}
                                >
                                    <Upload size={16} /> Import Records
                                </button>
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
    const [loading, setLoading] = useState(true);
    const [autoDeleteConfig, setAutoDeleteConfig] = useState({ enabled: false, hours: 24, logsEnabled: true });
    const [showConfig, setShowConfig] = useState(false);
    const [configHours, setConfigHours] = useState(24);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [visibleCount, setVisibleCount] = useState(50);
    const [toast, setToast] = useState(null); // { type: 'success'|'error', message }
    const [actionLoading, setActionLoading] = useState('');
    const [configSaved, setConfigSaved] = useState(false);

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    const fetchLogs = async (showLoader = true) => {
        if (showLoader) setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/logs', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
            }
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAutoDeleteConfig = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/logs/auto-delete-config', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const config = await res.json();
                setAutoDeleteConfig({ enabled: config.enabled, hours: config.hours, logsEnabled: config.logsEnabled });
                setConfigHours(config.hours);
            }
        } catch (err) {
            console.error('Failed to fetch config:', err);
        }
    };

    useEffect(() => {
        fetchLogs();
        fetchAutoDeleteConfig();
    }, []);

    const handleClearAll = async () => {
        if (!confirm('Are you sure you want to clear ALL logs? This action cannot be undone.')) return;
        setActionLoading('clear');
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/logs/clear', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                showToast('success', `Cleared ${data.count} log entries`);
                fetchLogs(false);
            } else {
                showToast('error', 'Failed to clear logs');
            }
        } catch (err) {
            showToast('error', 'Network error');
        } finally {
            setActionLoading('');
        }
    };

    const handleExport = async () => {
        setActionLoading('export');
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/logs/export', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const dateStr = new Date().toISOString().split('T')[0];
                a.download = `system-logs-${dateStr}.json`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
                showToast('success', `Exported ${logs.length} log entries`);
            } else {
                showToast('error', 'Failed to export logs');
            }
        } catch (err) {
            showToast('error', 'Export failed');
        } finally {
            setActionLoading('');
        }
    };

    const handleSaveAutoDelete = async () => {
        setActionLoading('config');
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/logs/auto-delete-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ enabled: autoDeleteConfig.enabled, hours: configHours, logsEnabled: autoDeleteConfig.logsEnabled })
            });
            if (res.ok) {
                showToast('success', 'Configuration saved');
                setConfigSaved(true);
                setTimeout(() => setConfigSaved(false), 2000);
                fetchAutoDeleteConfig();
            } else {
                showToast('error', 'Failed to save configuration');
            }
        } catch (err) {
            showToast('error', 'Network error');
        } finally {
            setActionLoading('');
        }
    };

    const handleRunAutoDelete = async () => {
        if (!confirm(`Delete all logs older than ${autoDeleteConfig.hours} hours?`)) return;
        setActionLoading('run');
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/logs/auto-delete-run', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                showToast('success', `Deleted ${data.count} old entries (older than ${data.hours}h)`);
                fetchLogs(false);
            } else {
                showToast('error', 'Auto-delete failed');
            }
        } catch (err) {
            showToast('error', 'Network error');
        } finally {
            setActionLoading('');
        }
    };

    // Relative time display
    const relativeTime = (dateStr) => {
        const now = new Date();
        const date = new Date(dateStr);
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return date.toLocaleDateString();
    };

    // Get all unique log types
    const logTypes = ['ALL', ...new Set(logs.map(l => l.type).filter(Boolean))];

    // Filter logs
    const filteredLogs = logs.filter(log => {
        const matchesSearch = !searchQuery ||
            log.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.type?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = typeFilter === 'ALL' || log.type === typeFilter;
        return matchesSearch && matchesType;
    });

    const visibleLogs = filteredLogs.slice(0, visibleCount);
    const hasMore = filteredLogs.length > visibleCount;

    // Type badge color mapping
    const typeBadgeClass = (type) => {
        switch (type) {
            case 'AUTH': return 'logs-badge-auth';
            case 'BACKUP': return 'logs-badge-backup';
            case 'IMPORT': return 'logs-badge-import';
            case 'EXPORT': return 'logs-badge-export';
            case 'MONITOR': return 'logs-badge-monitor';
            case 'SYSTEM': return 'logs-badge-system';
            case 'LOGS': return 'logs-badge-logs';
            case 'IP': return 'logs-badge-ip';
            case 'TAB': return 'logs-badge-tab';
            default: return 'logs-badge-default';
        }
    };

    return (
        <div className="logs-redesign">
            {/* Header */}
            <div className="logs-page-header">
                <div className="logs-header-left">
                    <div className="logs-header-icon">
                        <FileText size={22} />
                    </div>
                    <div>
                        <h2>System Logs</h2>
                        <span className="logs-header-count">
                            {loading ? 'Loading...' : `${filteredLogs.length} entries`}
                            {typeFilter !== 'ALL' && ` (filtered from ${logs.length})`}
                        </span>
                    </div>
                </div>
                <div className="logs-header-actions">
                    <button
                        onClick={() => setShowConfig(!showConfig)}
                        className={`logs-action-btn config ${showConfig ? 'active' : ''}`}
                    >
                        <Settings size={15} />
                    </button>
                    <button
                        onClick={() => fetchLogs(false)}
                        className="logs-action-btn refresh"
                        disabled={!!actionLoading}
                    >
                        <RefreshCw size={15} className={loading ? 'spin-anim' : ''} />
                    </button>
                    <button
                        onClick={handleExport}
                        className="logs-action-btn export"
                        disabled={!!actionLoading || logs.length === 0}
                    >
                        <Download size={15} /> Export
                    </button>
                    <button
                        onClick={handleClearAll}
                        className="logs-action-btn danger"
                        disabled={!!actionLoading || logs.length === 0}
                    >
                        <Trash2 size={15} /> Clear
                    </button>
                </div>
            </div>

            {/* Toast notification */}
            {toast && (
                <div className={`logs-toast ${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    <span>{toast.message}</span>
                    <button onClick={() => setToast(null)} className="logs-toast-close"><X size={14} /></button>
                </div>
            )}

            {/* Configuration Panel */}
            {showConfig && (
                <div className="logs-config-panel-new">
                    <div className="logs-config-header">
                        <Settings size={18} />
                        <span>Logs Configuration</span>
                    </div>
                    <div className="logs-config-grid">
                        <div className="logs-config-item">
                            <div className="logs-config-label">
                                <span>System Logging</span>
                                <p>Enable or disable logging for all system events</p>
                            </div>
                            <button
                                className={`logs-toggle-btn ${autoDeleteConfig.logsEnabled ? 'on' : 'off'}`}
                                onClick={() => setAutoDeleteConfig({ ...autoDeleteConfig, logsEnabled: !autoDeleteConfig.logsEnabled })}
                            >
                                <span className="logs-toggle-knob"></span>
                                <span className="logs-toggle-text">{autoDeleteConfig.logsEnabled ? 'ON' : 'OFF'}</span>
                            </button>
                        </div>
                        <div className="logs-config-item">
                            <div className="logs-config-label">
                                <span>Auto-Delete</span>
                                <p>Automatically remove old log entries</p>
                            </div>
                            <button
                                className={`logs-toggle-btn ${autoDeleteConfig.enabled ? 'on' : 'off'}`}
                                onClick={() => setAutoDeleteConfig({ ...autoDeleteConfig, enabled: !autoDeleteConfig.enabled })}
                            >
                                <span className="logs-toggle-knob"></span>
                                <span className="logs-toggle-text">{autoDeleteConfig.enabled ? 'ON' : 'OFF'}</span>
                            </button>
                        </div>
                        <div className="logs-config-item retention">
                            <div className="logs-config-label">
                                <span>Retention Period</span>
                                <p>Delete logs older than this duration</p>
                            </div>
                            <div className="logs-retention-input">
                                <input
                                    type="number"
                                    min="1"
                                    max="8760"
                                    value={configHours}
                                    onChange={(e) => setConfigHours(parseInt(e.target.value) || 24)}
                                />
                                <span>hours</span>
                            </div>
                        </div>
                    </div>
                    <div className="logs-config-footer">
                        <button
                            onClick={handleSaveAutoDelete}
                            className="logs-config-save-btn"
                            disabled={actionLoading === 'config'}
                        >
                            {actionLoading === 'config' ? (
                                <><div className="logs-btn-spinner"></div> Saving...</>
                            ) : configSaved ? (
                                <><CheckCircle size={15} /> Saved!</>
                            ) : (
                                <><Save size={15} /> Save Configuration</>
                            )}
                        </button>
                        <button
                            onClick={handleRunAutoDelete}
                            className="logs-config-run-btn"
                            disabled={!!actionLoading}
                        >
                            {actionLoading === 'run' ? (
                                <><div className="logs-btn-spinner"></div> Running...</>
                            ) : (
                                <><Trash2 size={15} /> Clean Now</>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Search & Filter Bar */}
            <div className="logs-filter-bar">
                <div className="logs-search-box">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search logs..."
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setVisibleCount(50); }}
                    />
                    {searchQuery && (
                        <button className="logs-search-clear" onClick={() => setSearchQuery('')}>
                            <X size={14} />
                        </button>
                    )}
                </div>
                <div className="logs-type-pills">
                    {logTypes.map(type => (
                        <button
                            key={type}
                            className={`logs-type-pill ${typeFilter === type ? 'active' : ''} ${type !== 'ALL' ? typeBadgeClass(type) : ''}`}
                            onClick={() => { setTypeFilter(type); setVisibleCount(50); }}
                        >
                            {type === 'ALL' ? 'All' : type}
                            {type !== 'ALL' && (
                                <span className="logs-type-count">
                                    {logs.filter(l => l.type === type).length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Logs Table */}
            <div className="logs-table-container">
                {loading ? (
                    <div className="logs-loading">
                        <div className="backup-spinner"></div>
                        <p>Loading system logs...</p>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="logs-empty">
                        <FileText size={40} />
                        <h4>{searchQuery || typeFilter !== 'ALL' ? 'No matching logs found' : 'No logs yet'}</h4>
                        <p>{searchQuery || typeFilter !== 'ALL'
                            ? 'Try adjusting your search or filter criteria'
                            : 'System events will appear here as they occur'
                        }</p>
                    </div>
                ) : (
                    <>
                        <table className="logs-table-new">
                            <thead>
                                <tr>
                                    <th style={{ width: '130px' }}>Time</th>
                                    <th style={{ width: '100px' }}>Type</th>
                                    <th>Message</th>
                                    <th style={{ width: '80px' }}>User</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleLogs.map(log => (
                                    <tr key={log.id} className="logs-row">
                                        <td className="logs-time-cell">
                                            <span className="logs-time-relative">{relativeTime(log.created_at)}</span>
                                            <span className="logs-time-full">{new Date(log.created_at).toLocaleString()}</span>
                                        </td>
                                        <td>
                                            <span className={`logs-type-badge ${typeBadgeClass(log.type)}`}>
                                                {log.type}
                                            </span>
                                        </td>
                                        <td className="logs-message-cell">{log.message}</td>
                                        <td className="logs-user-cell">{log.user_id || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {hasMore && (
                            <div className="logs-load-more">
                                <button onClick={() => setVisibleCount(v => v + 50)}>
                                    Load more ({filteredLogs.length - visibleCount} remaining)
                                </button>
                            </div>
                        )}
                        <div className="logs-table-footer">
                            Showing {visibleLogs.length} of {filteredLogs.length} entries
                        </div>
                    </>
                )}
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
    const [ipError, setIpError] = useState('');
    const [localInterval, setLocalInterval] = useState(monitorConfig.interval);
    const [intervalDirty, setIntervalDirty] = useState(false);
    const [pingAllLoading, setPingAllLoading] = useState(false);
    const [pingOneLoading, setPingOneLoading] = useState(false);
    const [pingAllFeedback, setPingAllFeedback] = useState('');
    const [pingResult, setPingResult] = useState(null); // { ip, status, details, error }

    const IP_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

    // Sync localInterval when monitorConfig changes from outside
    React.useEffect(() => {
        setLocalInterval(monitorConfig.interval);
        setIntervalDirty(false);
    }, [monitorConfig.interval]);

    const handleLocalIntervalChange = (e) => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        const val = raw === '' ? '' : Math.min(5000, Math.max(1, parseInt(raw)));
        setLocalInterval(val);
        setIntervalDirty(String(val) !== String(monitorConfig.interval));
    };

    const handleSaveInterval = () => {
        const val = parseInt(localInterval);
        if (!isNaN(val) && val >= 1 && val <= 5000) {
            onConfigChange(val, monitorConfig.enabled);
            setIntervalDirty(false);
        }
    };

    const handleToggle = () => {
        onConfigChange(parseInt(localInterval) || monitorConfig.interval, !monitorConfig.enabled);
    };

    const handlePingAll = async () => {
        setPingAllLoading(true);
        setPingAllFeedback('');
        try {
            await onPingAll();
            setPingAllFeedback('Job dispatched! IPs are being checked in the background.');
        } catch {
            setPingAllFeedback('Failed to start ping job.');
        } finally {
            setPingAllLoading(false);
            setTimeout(() => setPingAllFeedback(''), 5000);
        }
    };

    const handlePingOne = async () => {
        if (!specificIp) return;
        if (!IP_REGEX.test(specificIp)) {
            setIpError('Invalid IP address format (e.g. 192.168.1.1)');
            return;
        }
        setIpError('');
        setPingResult(null);
        setPingOneLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/monitor/ping-one', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ ip: specificIp })
            });
            const data = await res.json();
            if (res.ok) {
                setPingResult({ ip: specificIp, status: data.status, details: data.details });
                // Side-effect: refresh the IP table list
                onPingOne(specificIp).catch(() => { });
            } else {
                setPingResult({ ip: specificIp, error: data.error || 'Ping check failed' });
            }
        } catch (err) {
            setPingResult({ ip: specificIp, error: 'Network error — could not reach server' });
        } finally {
            setPingOneLoading(false);
        }
    };

    const isActive = monitorConfig.enabled;
    const lastRunStr = monitorConfig.lastRun ? new Date(monitorConfig.lastRun).toLocaleString() : 'Never';
    const nextRunStr = monitorConfig.nextRun ? new Date(monitorConfig.nextRun).toLocaleString() : 'Not Scheduled';

    return (
        <div className="monitor-page">
            {/* ── Hero Status Card ── */}
            <div className="mcard mcard-hero">
                <div className="mcard-hero-left">
                    <div className={`msystem-badge ${isActive ? 'msystem-active' : 'msystem-inactive'}`}>
                        <span className={`mpulse-dot ${isActive ? 'mpulse-green' : 'mpulse-red'}`}></span>
                        {isActive ? 'System Active' : 'System Inactive'}
                    </div>
                    <p className="mcard-hero-sub">
                        {isActive
                            ? 'Automatic monitoring is running. IPs are being checked on schedule.'
                            : 'Automatic monitoring is disabled. Enable it below to start scheduled checks.'}
                    </p>
                </div>
                <div className="mcard-hero-right">
                    <div className="mtime-block">
                        <span className="mtime-label"><Clock size={14} /> Last Run</span>
                        <span className="mtime-value">{lastRunStr}</span>
                    </div>
                    <div className="mtime-divider"></div>
                    <div className="mtime-block">
                        <span className="mtime-label"><Calendar size={14} /> Next Run</span>
                        <span className={`mtime-value ${!monitorConfig.nextRun ? 'mtime-dim' : ''}`}>{nextRunStr}</span>
                    </div>
                </div>
            </div>

            {/* ── Two-column grid ── */}
            <div className="monitor-grid">
                {/* Automatic Monitoring Card */}
                <div className="mcard">
                    <div className="mcard-header">
                        <div className="mcard-icon-wrap mcard-icon-blue">
                            <Activity size={18} />
                        </div>
                        <div>
                            <h3 className="mcard-title">Automatic Monitoring</h3>
                            <p className="mcard-desc">Schedule recurring health checks for all tracked IPs.</p>
                        </div>
                    </div>

                    <div className="mcard-body">
                        <div className="msetting-row">
                            <span className="msetting-label">Feature Status</span>
                            <button
                                className={`mtoggle-btn ${isActive ? 'mtoggle-on' : 'mtoggle-off'}`}
                                onClick={handleToggle}
                            >
                                <span className="mtoggle-thumb"></span>
                                <span className="mtoggle-text">{isActive ? 'ON' : 'OFF'}</span>
                            </button>
                        </div>

                        <div className="msetting-row msetting-interval">
                            <span className="msetting-label">Check Interval (Minutes)</span>
                            <div className="mintval-control">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={localInterval}
                                    onChange={handleLocalIntervalChange}
                                    className="mintval-input"
                                    placeholder="e.g. 180"
                                />
                                <button
                                    className={`mintval-save ${intervalDirty ? 'mintval-save-active' : ''}`}
                                    onClick={handleSaveInterval}
                                    disabled={!intervalDirty}
                                    title={intervalDirty ? 'Save new interval' : 'No changes'}
                                >
                                    <Save size={14} />
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions Card */}
                <div className="mcard">
                    <div className="mcard-header">
                        <div className="mcard-icon-wrap mcard-icon-purple">
                            <RefreshCw size={18} />
                        </div>
                        <div>
                            <h3 className="mcard-title">Quick Actions</h3>
                            <p className="mcard-desc">Manually trigger a full ping sweep across all recorded IPs.</p>
                        </div>
                    </div>
                    <div className="mcard-body">
                        <button
                            className={`mrun-btn ${pingAllLoading ? 'mrun-btn-loading' : ''}`}
                            onClick={handlePingAll}
                            disabled={pingAllLoading}
                        >
                            {pingAllLoading ? (
                                <>
                                    <span className="mspinner"></span>
                                    Scanning…
                                </>
                            ) : (
                                <>
                                    <RefreshCw size={16} />
                                    Run Check Now
                                </>
                            )}
                        </button>
                        {pingAllFeedback && (
                            <div className="mfeedback">
                                <CheckCircle size={14} />
                                {pingAllFeedback}
                            </div>
                        )}
                    </div>
                </div>

                {/* Individual IP Check Card — spans full width */}
                <div className="mcard mcard-full">
                    <div className="mcard-header">
                        <div className="mcard-icon-wrap mcard-icon-teal">
                            <Server size={18} />
                        </div>
                        <div>
                            <h3 className="mcard-title">Individual IP Check</h3>
                            <p className="mcard-desc">Run a live ping against a single IP to instantly update its status column.</p>
                        </div>
                    </div>
                    <div className="mcard-body">
                        <div className="mip-row">
                            <div className="mip-input-wrap">
                                <Server size={15} className="mip-icon" />
                                <input
                                    type="text"
                                    placeholder="e.g. 192.168.1.1"
                                    value={specificIp}
                                    onChange={e => {
                                        setSpecificIp(e.target.value);
                                        if (ipError) setIpError('');
                                    }}
                                    className={`mip-input ${ipError ? 'mip-input-error' : ''}`}
                                    onKeyDown={e => e.key === 'Enter' && handlePingOne()}
                                />
                            </div>
                            <button
                                className={`mcheck-btn ${pingOneLoading ? 'mrun-btn-loading' : ''}`}
                                onClick={handlePingOne}
                                disabled={!specificIp || pingOneLoading}
                            >
                                {pingOneLoading ? (
                                    <>
                                        <span className="mspinner"></span>
                                        Checking…
                                    </>
                                ) : (
                                    <>
                                        <Activity size={16} />
                                        Check IP
                                    </>
                                )}
                            </button>
                        </div>
                        {ipError && <p className="mip-error"><AlertCircle size={13} /> {ipError}</p>}

                        {/* ── Ping Result Panel ── */}
                        {pingResult && (
                            <div className={`mping-result ${pingResult.error ? 'mping-error' : pingResult.status === 'UP' ? 'mping-up' : 'mping-down'}`}>
                                <div className="mping-result-header">
                                    <div className="mping-result-status">
                                        {pingResult.error ? (
                                            <><XCircle size={22} /><span>Check Failed</span></>
                                        ) : pingResult.status === 'UP' ? (
                                            <><CheckCircle size={22} /><span>Host is UP</span></>
                                        ) : pingResult.status === 'RESERVED' ? (
                                            <><AlertCircle size={22} /><span>Host is Reserved / Not Responding</span></>
                                        ) : (
                                            <><XCircle size={22} /><span>Host is DOWN</span></>
                                        )}
                                    </div>
                                    <div className="mping-result-meta">
                                        <span className="mping-ip-label">{pingResult.ip}</span>
                                        <button className="mping-dismiss" onClick={() => setPingResult(null)} title="Dismiss"><X size={14} /></button>
                                    </div>
                                </div>

                                {pingResult.error ? (
                                    <p className="mping-error-msg">{pingResult.error}</p>
                                ) : pingResult.details && (
                                    <div className="mping-stats">
                                        <div className="mping-stat">
                                            <span className="mping-stat-label">Packets Sent</span>
                                            <span className="mping-stat-value">{pingResult.details.sent ?? 3}</span>
                                        </div>
                                        <div className="mping-stat">
                                            <span className="mping-stat-label">Received</span>
                                            <span className="mping-stat-value">{pingResult.details.received ?? (pingResult.status === 'UP' ? 3 : 0)}</span>
                                        </div>
                                        <div className="mping-stat">
                                            <span className="mping-stat-label">Packet Loss</span>
                                            <span className={`mping-stat-value ${pingResult.details.packetLoss > 0 ? 'mping-stat-warn' : 'mping-stat-ok'}`}>
                                                {pingResult.details.packetLoss ?? 0}%
                                            </span>
                                        </div>
                                        <div className="mping-stat">
                                            <span className="mping-stat-label">Avg Latency</span>
                                            <span className="mping-stat-value">
                                                {pingResult.details.avgLatencyMs != null
                                                    ? `${pingResult.details.avgLatencyMs} ms`
                                                    : '—'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
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

// ─── Tab Create / Rename Modal ───────────────────────────────────────────────
const TabModal = ({ isOpen, onClose, onSave, editTab }) => {
    const isRename = !!editTab;
    const [name, setName] = useState('');
    const [isPublic, setIsPublic] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setName(editTab ? editTab.name : '');
            setIsPublic(editTab ? !!editTab.is_public : false);
        }
    }, [isOpen, editTab]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave(name.trim(), isPublic, editTab?.id);
        setName('');
        setIsPublic(false);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{isRename ? 'Rename Tab' : 'Add New Tab'}</h3>
                    <button onClick={onClose}><X size={24} /></button>
                </div>
                <div className="modal-body">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Tab Name</label>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                                autoFocus
                                placeholder="e.g. Production Servers"
                            />
                        </div>
                        {!isRename && (
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <span>Enable Public Sharing</span>
                                    <button
                                        type="button"
                                        className={`tab-share-toggle ${isPublic ? 'on' : 'off'}`}
                                        onClick={() => setIsPublic(p => !p)}
                                    >
                                        <span className="tab-share-toggle-knob"></span>
                                        <Globe size={12} style={{ position: 'absolute', right: '8px', opacity: isPublic ? 1 : 0, transition: 'opacity 0.2s' }} />
                                    </button>
                                </label>
                                {isPublic && (
                                    <p style={{ fontSize: '12px', color: '#22c55e', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <Globe size={12} /> This tab will be publicly accessible without login
                                    </p>
                                )}
                            </div>
                        )}
                        <div className="modal-actions">
                            <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
                            <button type="submit" className="btn-save">
                                {isRename ? <><Check size={16} /> Save Name</> : <><Plus size={16} /> Create Tab</>}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

// ─── Smart Tab Bar  ───────────────────────────────────────────────────────────
const TabBar = ({ tabs, activeTab, onSelect, onDelete, onRename, onToggleSharing, onPreview, onAdd, userRole, sharingTogglingId }) => {
    const scrollRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 4);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }, []);

    useEffect(() => {
        checkScroll();
        const el = scrollRef.current;
        if (!el) return;
        el.addEventListener('scroll', checkScroll);
        const ro = new ResizeObserver(checkScroll);
        ro.observe(el);
        return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect(); };
    }, [tabs, checkScroll]);

    // Scroll active tab into view when it changes
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const activeEl = el.querySelector('.tab.active');
        if (activeEl) {
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }, [activeTab]);

    const scroll = (dir) => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollBy({ left: dir * 200, behavior: 'smooth' });
    };

    return (
        <div className="tabs-wrapper">
            {canScrollLeft && (
                <button className="tab-scroll-btn tab-scroll-left" onClick={() => scroll(-1)} title="Scroll left">
                    <ChevronLeft size={16} />
                </button>
            )}
            <div className="tabs-container" ref={scrollRef}>
                <div className="tabs">
                    {tabs.map(tab => (
                        <div
                            key={tab.id}
                            className={`tab ${activeTab === tab.id ? 'active' : ''} ${tab.is_default_public ? 'tab-default-public' : ''} ${tab.is_public && tab.id !== 'all' ? 'tab-public' : ''}`}
                            onClick={() => onSelect(tab.id)}
                            title={tab.name}
                        >
                            {tab.id === 'all' ? <LayoutGrid size={16} /> : tab.is_default_public ? <Share2 size={15} /> : tab.is_public ? <Globe size={15} /> : <FileText size={16} />}
                            <span className="tab-name-text">{tab.name}</span>
                            {tab.id !== 'all' && userRole === 'admin' && (
                                <div className="tab-action-group" onClick={e => e.stopPropagation()}>
                                    {/* Rename */}
                                    <button
                                        className="btn-tab-action btn-tab-rename"
                                        onClick={(e) => { e.stopPropagation(); onRename(tab); }}
                                        title="Rename Tab"
                                    >
                                        <PenLine size={12} />
                                    </button>
                                    {/* Public share toggle */}
                                    <button
                                        className={`btn-tab-action btn-tab-share ${tab.is_public ? 'sharing-on' : 'sharing-off'} ${tab.is_default_public ? 'sharing-locked' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (tab.is_default_public) return;
                                            onToggleSharing(tab);
                                        }}
                                        title={tab.is_default_public ? 'Default public tab (always shared)' : tab.is_public ? 'Disable public sharing' : 'Enable public sharing'}
                                        disabled={sharingTogglingId === tab.id}
                                    >
                                        {sharingTogglingId === tab.id ? (
                                            <span className="tab-share-spinner"></span>
                                        ) : tab.is_default_public ? (
                                            <Lock size={12} />
                                        ) : tab.is_public ? (
                                            <Globe size={12} />
                                        ) : (
                                            <EyeOff size={12} />
                                        )}
                                    </button>
                                    {/* Preview public tab */}
                                    {tab.is_public && (
                                        <button
                                            className="btn-tab-action btn-tab-preview"
                                            onClick={(e) => { e.stopPropagation(); onPreview(tab); }}
                                            title="Preview public view"
                                        >
                                            <Eye size={12} />
                                        </button>
                                    )}
                                    {/* Delete tab */}
                                    {!tab.is_default_public && (
                                        <button
                                            className="btn-tab-action btn-tab-delete"
                                            onClick={(e) => { e.stopPropagation(); onDelete(tab.id); }}
                                            title="Delete Tab"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            {canScrollRight && (
                <button className="tab-scroll-btn tab-scroll-right" onClick={() => scroll(1)} title="Scroll right">
                    <ChevronRight size={16} />
                </button>
            )}
            {userRole === 'admin' && (
                <button
                    className="btn-add-tab"
                    onClick={onAdd}
                    title="Add New Tab"
                >
                    <Plus size={18} />
                </button>
            )}
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
    const [itemsPerPage, setItemsPerPage] = useState(100);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [showMyAccount, setShowMyAccount] = useState(false);
    const [showBackupModal, setShowBackupModal] = useState(false);
    const [showTabModal, setShowTabModal] = useState(false);
    const [renamingTab, setRenamingTab] = useState(null); // tab object being renamed
    const [pingModalData, setPingModalData] = useState(null);
    const [sharingTogglingId, setSharingTogglingId] = useState(null);
    const [publicViewTab, setPublicViewTab] = useState(null);

    const [displayMode, setDisplayMode] = useState('list');
    const [showDiscovery, setShowDiscovery] = useState(false);
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
    }, [user, pagination.currentPage, debouncedSearch, activeTab, view, sortConfig, itemsPerPage]);

    const fetchTabs = async () => {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/tabs', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) setTabs([{ id: 'all', name: 'All IPs' }, ...(await res.json())]);
    };

    const fetchIps = async () => {
        const token = localStorage.getItem('token');
        const queryParams = new URLSearchParams({
            page: pagination.currentPage,
            limit: itemsPerPage,
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

    const handleAddTab = async (name, isPublic, tabId) => {
        const token = localStorage.getItem('token');
        if (tabId) {
            // Rename existing tab
            const res = await fetch(`/api/tabs/${tabId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name })
            });
            if (res.ok) {
                // Only update tabs state — no IP re-fetch needed
                setTabs(prev => prev.map(t => t.id === tabId ? { ...t, name } : t));
                setRenamingTab(null);
            } else {
                const err = await res.json().catch(() => ({}));
                alert(err.error || 'Failed to rename tab');
            }
        } else {
            // Create new tab
            const res = await fetch('/api/tabs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name, is_public: !!isPublic })
            });
            if (res.ok) {
                fetchTabs(); // Only refreshes tabs, not IPs
                setShowTabModal(false);
            } else {
                alert('Failed to add tab');
            }
        }
    };

    const handleDeleteTab = async (id) => {
        if (!confirm('Delete tab? IPs in this tab will remain but become unassigned.')) return;
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/tabs/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            if (activeTab === id) setActiveTab('all');
            fetchTabs();
        } else {
            const err = await res.json().catch(() => ({}));
            alert(err.error || 'Delete failed');
        }
    };

    const handleToggleTabSharing = async (tab) => {
        setSharingTogglingId(tab.id);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/tabs/${tab.id}/sharing`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ is_public: !tab.is_public })
            });
            if (res.ok) {
                fetchTabs();
            } else {
                const err = await res.json().catch(() => ({}));
                alert(err.error || 'Failed to toggle sharing');
            }
        } catch (e) {
            alert('Network error');
        } finally {
            setSharingTogglingId(null);
        }
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

    const handleMyPasswordUpdate = async ({ oldPassword, newPassword }) => {
        const token = localStorage.getItem('token');
        try {
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
                alert('Password updated successfully! Please login again with your new password.');
                logout();
            } else {
                alert(data.error || 'Failed to update password');
            }
        } catch (err) {
            alert('Failed to update password');
        }
    };

    if (loading) return <div className="loading">Loading...</div>;
    if (!user) return <Login />;

    return (
        <div className="container">
            <header className="main-header">
                <div className="header-left">
                    <h1 className="brand"><Server size={28} /> IP Manager</h1>
                    <nav className="nav-menu">
                        <button className={view === 'ips' ? 'nav-item active' : 'nav-item'} onClick={() => setView('ips')}>
                            <List size={18} /> IP Management
                        </button>
                        {user.username === 'admin' && (
                            <>
                                <button className={view === 'users' ? 'nav-item active' : 'nav-item'} onClick={() => setView('users')}>
                                    <Users size={18} /> Users
                                </button>
                                <button className={view === 'monitor' ? 'nav-item active' : 'nav-item'} onClick={() => setView('monitor')}>
                                    <Activity size={18} /> Monitor
                                </button>
                                <button className={view === 'logs' ? 'nav-item active' : 'nav-item'} onClick={() => setView('logs')}>
                                    <FileText size={18} /> Logs
                                </button>
                            </>
                        )}
                    </nav>
                </div>

                <div className="header-right">
                    <div className="system-actions">
                        {user.role === 'admin' && (
                            <>
                                <button onClick={() => setShowDiscovery(true)} className="icon-btn" title="Network Discovery">
                                    <Network size={18} />
                                </button>
                                <button onClick={() => setShowBackupModal(true)} className="icon-btn" title="Backup">
                                    <Save size={18} />
                                </button>
                            </>
                        )}
                        <button onClick={() => setShowMyAccount(true)} className="icon-btn" title="Account Settings">
                            <Shield size={18} />
                        </button>
                    </div>
                    <div className="user-identity">
                        <div className="user-badge">
                            <span className="username">{user.username}</span>
                            <span className="role">{user.role}</span>
                        </div>
                        <button onClick={logout} className="logout-button" title="Sign Out">
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </header>

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
                                <div className="toolbar-group">
                                    <div className="view-toggle">
                                        <button className={displayMode === 'list' ? 'active' : ''} onClick={() => setDisplayMode('list')} title="List View"><List size={16} /></button>
                                        <button className={displayMode === 'pool' ? 'active' : ''} onClick={() => setDisplayMode('pool')} title="Grid View"><LayoutGrid size={16} /></button>
                                        <button className={displayMode === 'map' ? 'active' : ''} onClick={() => setDisplayMode('map')} title="Network Map"><Network size={16} /></button>
                                    </div>
                                    {selectedIds.length > 0 && user.role === 'admin' && (
                                        <button className="btn-delete-selected" onClick={handleBulkDelete}>
                                            <Trash2 size={16} /> Delete {selectedIds.length} Selected
                                        </button>
                                    )}
                                </div>

                                <div className="search-box">
                                    <Search className="search-icon" size={16} />
                                    <input placeholder="Search records..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="search-input" />
                                </div>

                                <div className="toolbar-actions">
                                    <button onClick={handleExportExcel} className="btn-toolbar" title="Export current view to Excel">
                                        <Download size={16} /> Export
                                    </button>
                                    <div className="items-per-page">
                                        <span>Show:</span>
                                        <select
                                            value={itemsPerPage}
                                            onChange={(e) => {
                                                setItemsPerPage(Number(e.target.value));
                                                setPagination(prev => ({ ...prev, currentPage: 1 }));
                                            }}
                                        >
                                            <option value={100}>100</option>
                                            <option value={200}>200</option>
                                            <option value={300}>300</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <TabBar
                                tabs={tabs}
                                activeTab={activeTab}
                                onSelect={setActiveTab}
                                onDelete={handleDeleteTab}
                                onRename={(tab) => setRenamingTab(tab)}
                                onToggleSharing={handleToggleTabSharing}
                                onPreview={(tab) => setPublicViewTab(tab)}
                                onAdd={() => setShowTabModal(true)}
                                userRole={user.role}
                                sharingTogglingId={sharingTogglingId}
                            />

                            {displayMode === 'pool' && <PoolView ips={allIps} onEdit={setEditingIp} />}
                            {displayMode === 'map' && <NetworkMap ips={allIps} tabs={tabs} />}
                            {displayMode === 'list' && (
                                <>
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
                                                            <div className="table-actions">
                                                                <button className="btn-table-action btn-monitor" onClick={() => handleCheckStatus(ip)} title="Check Status"><Activity size={16} /></button>
                                                                <button className="btn-table-action btn-edit" onClick={() => setEditingIp(ip)} title="Edit IP"><Edit2 size={16} /></button>
                                                                <button className="btn-table-action btn-delete" onClick={() => handleDelete(ip.id)} title="Delete IP"><Trash2 size={16} /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {pagination.totalPages > 1 && (
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '16px 20px',
                                            borderTop: '1px solid #334155'
                                        }}>
                                            <div style={{ fontSize: '14px', color: '#94a3b8' }}>
                                                Showing {((pagination.currentPage - 1) * itemsPerPage) + 1} to {Math.min(pagination.currentPage * itemsPerPage, pagination.totalItems)} of {pagination.totalItems} IPs
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <button
                                                    onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
                                                    disabled={pagination.currentPage === 1}
                                                    style={{
                                                        padding: '6px 12px',
                                                        borderRadius: '6px',
                                                        border: '1px solid #334155',
                                                        backgroundColor: pagination.currentPage === 1 ? '#1e293b' : '#334155',
                                                        color: pagination.currentPage === 1 ? '#64748b' : '#e2e8f0',
                                                        fontSize: '14px',
                                                        cursor: pagination.currentPage === 1 ? 'not-allowed' : 'pointer',
                                                        opacity: pagination.currentPage === 1 ? 0.5 : 1
                                                    }}
                                                >
                                                    Previous
                                                </button>
                                                {(() => {
                                                    const pages = [];
                                                    const maxPagesToShow = 5;
                                                    let startPage = Math.max(1, pagination.currentPage - Math.floor(maxPagesToShow / 2));
                                                    let endPage = Math.min(pagination.totalPages, startPage + maxPagesToShow - 1);

                                                    if (endPage - startPage + 1 < maxPagesToShow) {
                                                        startPage = Math.max(1, endPage - maxPagesToShow + 1);
                                                    }

                                                    if (startPage > 1) {
                                                        pages.push(
                                                            <button
                                                                key={1}
                                                                onClick={() => setPagination(prev => ({ ...prev, currentPage: 1 }))}
                                                                style={{
                                                                    padding: '6px 12px',
                                                                    borderRadius: '6px',
                                                                    border: '1px solid #334155',
                                                                    backgroundColor: '#334155',
                                                                    color: '#e2e8f0',
                                                                    fontSize: '14px',
                                                                    cursor: 'pointer',
                                                                    minWidth: '40px'
                                                                }}
                                                            >
                                                                1
                                                            </button>
                                                        );
                                                        if (startPage > 2) {
                                                            pages.push(<span key="ellipsis1" style={{ color: '#64748b', padding: '0 8px' }}>...</span>);
                                                        }
                                                    }

                                                    for (let i = startPage; i <= endPage; i++) {
                                                        pages.push(
                                                            <button
                                                                key={i}
                                                                onClick={() => setPagination(prev => ({ ...prev, currentPage: i }))}
                                                                style={{
                                                                    padding: '6px 12px',
                                                                    borderRadius: '6px',
                                                                    border: '1px solid #334155',
                                                                    backgroundColor: pagination.currentPage === i ? '#3b82f6' : '#334155',
                                                                    color: '#e2e8f0',
                                                                    fontSize: '14px',
                                                                    cursor: 'pointer',
                                                                    minWidth: '40px',
                                                                    fontWeight: pagination.currentPage === i ? 'bold' : 'normal'
                                                                }}
                                                            >
                                                                {i}
                                                            </button>
                                                        );
                                                    }

                                                    if (endPage < pagination.totalPages) {
                                                        if (endPage < pagination.totalPages - 1) {
                                                            pages.push(<span key="ellipsis2" style={{ color: '#64748b', padding: '0 8px' }}>...</span>);
                                                        }
                                                        pages.push(
                                                            <button
                                                                key={pagination.totalPages}
                                                                onClick={() => setPagination(prev => ({ ...prev, currentPage: pagination.totalPages }))}
                                                                style={{
                                                                    padding: '6px 12px',
                                                                    borderRadius: '6px',
                                                                    border: '1px solid #334155',
                                                                    backgroundColor: '#334155',
                                                                    color: '#e2e8f0',
                                                                    fontSize: '14px',
                                                                    cursor: 'pointer',
                                                                    minWidth: '40px'
                                                                }}
                                                            >
                                                                {pagination.totalPages}
                                                            </button>
                                                        );
                                                    }

                                                    return pages;
                                                })()}
                                                <button
                                                    onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                                                    disabled={pagination.currentPage === pagination.totalPages}
                                                    style={{
                                                        padding: '6px 12px',
                                                        borderRadius: '6px',
                                                        border: '1px solid #334155',
                                                        backgroundColor: pagination.currentPage === pagination.totalPages ? '#1e293b' : '#334155',
                                                        color: pagination.currentPage === pagination.totalPages ? '#64748b' : '#e2e8f0',
                                                        fontSize: '14px',
                                                        cursor: pagination.currentPage === pagination.totalPages ? 'not-allowed' : 'pointer',
                                                        opacity: pagination.currentPage === pagination.totalPages ? 0.5 : 1
                                                    }}
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </section>
                    </>
                )}
            </main >

            <ChangePasswordModal isOpen={showMyAccount} onClose={() => setShowMyAccount(false)} onSave={handleMyPasswordUpdate} title="My Account - Change Password" requireOldPassword={true} />
            <BackupModal isOpen={showBackupModal} onClose={() => setShowBackupModal(false)} />
            <TabModal isOpen={showTabModal} onClose={() => setShowTabModal(false)} onSave={handleAddTab} />
            <TabModal isOpen={!!renamingTab} onClose={() => setRenamingTab(null)} onSave={handleAddTab} editTab={renamingTab} />
            <PingStatusModal isOpen={!!pingModalData} onClose={() => setPingModalData(null)} ipData={pingModalData} onRefresh={fetchIps} />
            {editingIp && <EditModal ip={editingIp} tabs={tabs} onClose={() => setEditingIp(null)} onSave={handleEdit} />}
            {publicViewTab && <PublicTabViewer tab={publicViewTab} onClose={() => setPublicViewTab(null)} />}
            <DiscoveryModal
                isOpen={showDiscovery}
                onClose={() => setShowDiscovery(false)}
                tabs={tabs}
                onImport={(msg) => { alert(msg); fetchIps(); }}
            />
        </div >
    );
}
