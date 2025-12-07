import React, { useState, useEffect } from 'react';
import { useAuth } from './index';
import {
    Search, Edit2, Trash2, Check, X, Activity, Plus, LogOut, Users,
    Server, RefreshCw, Save, AlertCircle, MoreVertical, CheckSquare, Square
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

const UserManagement = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [form, setForm] = useState({ username: '', password: '', role: 'readonly' });
    const [msg, setMsg] = useState('');

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
                        <span>{u.username} ({u.role})</span>
                        {u.username !== 'admin' && u.id !== user.id && (
                            <button className="btn-delete" onClick={() => handleDelete(u.id)}>
                                <Trash2 size={16} /> Remove
                            </button>
                        )}
                    </div>
                ))}
            </div>
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
        tab_id: ip.tab_id || ''
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

export default function App() {
    const { user, logout, loading } = useAuth();
    const [allIps, setAllIps] = useState([]);
    const [form, setForm] = useState({ ip: '', hostname: '', ports: '', status: 'active', note: '', tab_id: '' });
    const [pingResult, setPingResult] = useState(null);
    const [pinging, setPinging] = useState(false);
    const [view, setView] = useState('ips'); // 'ips' or 'users'
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [editingIp, setEditingIp] = useState(null);
    const [activeTab, setActiveTab] = useState('all');
    const [tabs, setTabs] = useState([]);

    useEffect(() => {
        if (user) {
            fetchIps();
            fetchTabs();
        }
    }, [user]);

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
            const res = await fetch('/api/ips', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAllIps(data);
            } else if (res.status === 401 || res.status === 403) {
                logout();
            }
        } catch (err) {
            console.error('Failed to fetch IPs', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
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
                setForm({ ip: '', hostname: '', ports: '', status: 'active', note: '', tab_id: '' });
                fetchIps();
            } else {
                const err = await res.json();
                alert(err.error);
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
        const ipsToExport = activeTab === 'all' ? filteredIps : filteredIps;

        // Create CSV content
        const headers = ['IP Address', 'Hostname', 'Ports', 'Status', 'Notes', 'Created At'];
        const rows = ipsToExport.map(ip => [
            ip.ip,
            ip.hostname || '',
            ip.ports || '',
            ip.status,
            ip.note || '',
            new Date(ip.created_at).toLocaleString()
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Create download link
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
            fetchIps(); // Refresh IPs to update tab_id
        } catch (err) {
            console.error(err);
        }
    };

    // Filter IPs based on search query and active tab
    const filteredIps = allIps.filter(ip => {
        // Tab Filter
        if (activeTab !== 'all') {
            if (ip.tab_id !== activeTab) return false;
        }

        // Search Filter
        const query = searchQuery.toLowerCase();
        return (
            ip.ip.toLowerCase().includes(query) ||
            (ip.hostname && ip.hostname.toLowerCase().includes(query)) ||
            (ip.note && ip.note.toLowerCase().includes(query)) ||
            ip.status.toLowerCase().includes(query)
        );
    });

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
                            <button onClick={() => setView(view === 'users' ? 'ips' : 'users')}>
                                {view === 'users' ? <Server size={16} /> : <Users size={16} />}
                                {view === 'users' ? ' Manage IPs' : ' Manage Users'}
                            </button>
                        )}
                        <button onClick={logout} className="btn-logout"><LogOut size={16} /> Logout</button>
                    </div>
                </div>
            </header>

            <main>
                {view === 'users' && user.role === 'admin' ? (
                    <UserManagement />
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
                                    <button type="submit"><Plus size={16} /> Add Entry</button>
                                </form>
                            </section>
                        )}

                        <section className="card list-card">
                            <div className="list-header">
                                <h2>Managed IPs</h2>
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

                            {/* Tabs */}
                            <div className="tabs-container">
                                <div className="tabs">
                                    {tabs.map(tab => (
                                        <div
                                            key={tab.id}
                                            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                                            onClick={() => setActiveTab(tab.id)}
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

                            {/* Bulk Actions */}
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
                                <div className="table-container">
                                    <table className="ip-table">
                                        <thead>
                                            <tr>
                                                {user.role === 'admin' && <th style={{ width: '40px' }}></th>}
                                                <th>#</th>
                                                <th>IP</th>
                                                <th>Hostname</th>
                                                <th>Ports</th>
                                                <th>Status</th>
                                                <th>Note</th>
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
                                                    <td>{item.hostname}</td>
                                                    <td>{item.ports}</td>
                                                    <td>
                                                        <span className={`status-badge ${item.status}`}>
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                    <td>{item.note}</td>
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
                        </section>
                    </>
                )}
            </main>

            {/* Ping Result Modal */}
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

            {/* Edit Modal */}
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
