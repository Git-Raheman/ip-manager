import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './index';
import { Plus, Search, Filter, Grid, List, Map, Trash2, CheckSquare, Square, X, RefreshCw } from 'lucide-react';
import Login from './components/Login';
import Header from './components/Header';
import UserManagement from './components/UserManagement';
import LogsTab from './components/LogsTab';
import MonitorView from './components/MonitorView';
import EditModal from './components/EditModal';
import BackupModal from './components/BackupModal';
import PoolView from './components/PoolView';
import NetworkMap from './components/NetworkMap';
import ChangePasswordModal from './components/ChangePasswordModal';

const App = () => {
    const { user, logout, loading } = useAuth();
    const [theme, setTheme] = useState('dark');
    const [view, setView] = useState('ips');
    const [subView, setSubView] = useState('list');

    // Data States
    const [allIps, setAllIps] = useState([]);
    const [tabs, setTabs] = useState([]);
    const [activeTab, setActiveTab] = useState('all');
    const [monitorConfig, setMonitorConfig] = useState(null);

    // UI States
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0 });
    const [sortConfig, setSortConfig] = useState({ key: 'ip_address', direction: 'asc' });
    const [selectedIds, setSelectedIds] = useState([]);

    // Modals
    const [editingIp, setEditingIp] = useState(null);
    const [showTabModal, setShowTabModal] = useState(false);
    const [showBackupModal, setShowBackupModal] = useState(false);
    const [showMyAccount, setShowMyAccount] = useState(false);
    const [newTabName, setNewTabName] = useState('');

    // Forms
    const [form, setForm] = useState({ ip: '', hostname: '', ports: '', status: 'Available', note: '', tab_id: '', subnet: '', cidr: '' });

    // Theme Effect
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

    // Fetch Data
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
            if (pagination.currentPage !== data.pagination.currentPage) setSelectedIds([]);
        } else if (res.status === 401) {
            logout();
        }
    };

    const fetchMonitorStatus = async () => {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/monitor/status', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) setMonitorConfig(await res.json());
    };

    useEffect(() => {
        if (user) {
            fetchIps();
            fetchTabs();
            if (user.role === 'admin') fetchMonitorStatus();
        }
    }, [user, pagination.currentPage, debouncedSearch, activeTab, view, sortConfig]);

    // Handlers
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

    const handleAddTab = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const res = await fetch('/api/tabs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name: newTabName })
        });
        if (res.ok) {
            fetchTabs();
            setShowTabModal(false);
            setNewTabName('');
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

    const handleMyAccountPasswordReset = async ({ newPassword }) => {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/users/${user.id}/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ password: newPassword })
        });
        if (res.ok) {
            setShowMyAccount(false);
            alert('Password updated successfully');
        } else {
            alert('Failed to update password');
        }
    };

    if (loading) return <div className="loading">Loading...</div>;
    if (!user) return <Login />;

    return (
        <div className="container">
            <Header
                user={user}
                logout={logout}
                view={view}
                setView={setView}
                setShowBackupModal={setShowBackupModal}
                setShowMyAccount={setShowMyAccount}
                theme={theme}
                toggleTheme={toggleTheme}
            />

            <div className="main-nav">
                <div className="nav-tabs">
                    {tabs.map(tab => (
                        <div key={tab.id} className="tab-wrapper">
                            <button
                                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.name}
                            </button>
                            {tab.id !== 'all' && user.role === 'admin' && (
                                <button className="btn-tab-delete" onClick={() => handleDeleteTab(tab.id)}>×</button>
                            )}
                        </div>
                    ))}
                    {user.role === 'admin' && (
                        <button className="btn-add-tab" onClick={() => setShowTabModal(true)}><Plus size={14} /></button>
                    )}
                </div>
            </div>

            <main>
                {view === 'users' && user.role === 'admin' ? (
                    <UserManagement />
                ) : view === 'monitor' && user.role === 'admin' ? (
                    <MonitorView
                        monitorConfig={monitorConfig}
                        onConfigChange={handleMonitorConfig}
                        onPingAll={handlePingAll}
                    />
                ) : view === 'logs' && user.role === 'admin' ? (
                    <LogsTab />
                ) : (
                    <>
                        {user.role === 'admin' && (
                            <section className="card form-card">
                                <h2><Plus size={20} /> Add New IP</h2>
                                <form onSubmit={handleSubmit} className="add-ip-form">
                                    <div className="form-row">
                                        <input placeholder="IP Address" value={form.ip} onChange={e => setForm({ ...form, ip: e.target.value })} required />
                                        <input placeholder="Hostname" value={form.hostname} onChange={e => setForm({ ...form, hostname: e.target.value })} />
                                        <input placeholder="Subnet" value={form.subnet} onChange={e => setForm({ ...form, subnet: e.target.value })} />
                                        <input placeholder="CIDR" value={form.cidr} onChange={e => setForm({ ...form, cidr: e.target.value })} />
                                    </div>
                                    <div className="form-row">
                                        <input placeholder="Ports" value={form.ports} onChange={e => setForm({ ...form, ports: e.target.value })} />
                                        <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                                            <option value="Available">Available</option>
                                            <option value="Active">Active</option>
                                            <option value="Reserved">Reserved</option>
                                            <option value="Pending">Pending</option>
                                        </select>
                                        <input placeholder="Notes" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
                                        <select value={form.tab_id} onChange={e => setForm({ ...form, tab_id: e.target.value })}>
                                            <option value="">Unassigned</option>
                                            {tabs.filter(t => t.id !== 'all').map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                        <button type="submit" className="btn-primary">Add</button>
                                    </div>
                                </form>
                            </section>
                        )}

                        <section className="card list-card">
                            <div className="list-header">
                                <div className="search-bar">
                                    <Search size={18} />
                                    <input
                                        placeholder="Search IPs, Hostnames, Notes..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                    />
                                </div>
                                <div className="view-toggles">
                                    <button className={subView === 'list' ? 'active' : ''} onClick={() => setSubView('list')}><List size={18} /></button>
                                    <button className={subView === 'pool' ? 'active' : ''} onClick={() => setSubView('pool')}><Grid size={18} /></button>
                                    <button className={subView === 'map' ? 'active' : ''} onClick={() => setSubView('map')}><Map size={18} /></button>
                                </div>
                                {selectedIds.length > 0 && user.role === 'admin' && (
                                    <button onClick={handleBulkDelete} className="btn-danger">
                                        <Trash2 size={16} /> Delete ({selectedIds.length})
                                    </button>
                                )}
                            </div>

                            {subView === 'list' && (
                                <div className="table-responsive">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>
                                                    <button onClick={handleSelectAll} className="btn-icon">
                                                        {selectedIds.length === allIps.length && allIps.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                                                    </button>
                                                </th>
                                                <th onClick={() => handleSort('ip_address')}>IP Address</th>
                                                <th onClick={() => handleSort('hostname')}>Hostname</th>
                                                <th>Status</th>
                                                <th>Ports</th>
                                                <th>Subnet/CIDR</th>
                                                <th>Notes</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {allIps.map(ip => (
                                                <tr key={ip.id}>
                                                    <td>
                                                        <button onClick={() => handleSelectOne(ip.id)} className="btn-icon">
                                                            {selectedIds.includes(ip.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                                                        </button>
                                                    </td>
                                                    <td>{ip.ip}</td>
                                                    <td>{ip.hostname}</td>
                                                    <td><span className={`status-badge status-${ip.status ? ip.status.toLowerCase() : 'unknown'}`}>{ip.status}</span></td>
                                                    <td>{ip.ports}</td>
                                                    <td>{ip.subnet}{ip.cidr}</td>
                                                    <td>{ip.note}</td>
                                                    <td>
                                                        {user.role === 'admin' && (
                                                            <div className="actions">
                                                                <button onClick={() => setEditingIp(ip)} className="btn-edit">Edit</button>
                                                                <button onClick={() => handleDelete(ip.id)} className="btn-delete"><Trash2 size={16} /></button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {subView === 'pool' && <PoolView ips={allIps} />}
                            {subView === 'map' && <NetworkMap ips={allIps} />}

                            <div className="pagination">
                                <button
                                    disabled={pagination.currentPage === 1}
                                    onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage - 1 }))}
                                >
                                    Previous
                                </button>
                                <span>Page {pagination.currentPage} of {pagination.totalPages}</span>
                                <button
                                    disabled={pagination.currentPage === pagination.totalPages}
                                    onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage + 1 }))}
                                >
                                    Next
                                </button>
                            </div>
                        </section>
                    </>
                )}
            </main>

            {editingIp && (
                <EditModal
                    ip={editingIp}
                    tabs={tabs}
                    onClose={() => setEditingIp(null)}
                    onSave={handleEdit}
                />
            )}

            <BackupModal
                isOpen={showBackupModal}
                onClose={() => setShowBackupModal(false)}
            />

            <ChangePasswordModal
                isOpen={showMyAccount}
                onClose={() => setShowMyAccount(false)}
                onSave={handleMyAccountPasswordReset}
                title="My Account - Change Password"
            />

            {showTabModal && (
                <div className="modal-overlay" onClick={() => setShowTabModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Add New Tab</h3>
                            <button onClick={() => setShowTabModal(false)}><X size={24} /></button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleAddTab}>
                                <input
                                    value={newTabName}
                                    onChange={e => setNewTabName(e.target.value)}
                                    placeholder="Tab Name"
                                    required
                                />
                                <div className="modal-actions">
                                    <button type="submit" className="btn-save">Add Tab</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
