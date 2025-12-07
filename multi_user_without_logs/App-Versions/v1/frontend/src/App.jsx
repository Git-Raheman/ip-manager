import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import {
    Server, Users, Activity, FileText, Save, Shield, LogOut,
    Plus, List, LayoutGrid, Network, Search, Trash2, Download, Edit2, X
} from 'lucide-react';

// Components
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import MonitorView from './components/MonitorView';

import PoolView from './components/PoolView';
import NetworkMap from './components/NetworkMap';
import EditModal from './components/EditModal';
import BackupModal from './components/BackupModal';
import TabModal from './components/TabModal';
import PingStatusModal from './components/PingStatusModal';
import ChangePasswordModal from './components/ChangePasswordModal';

export default function App() {
    const { user, logout, loading } = useAuth();

    // IP Data State
    const [allIps, setAllIps] = useState([]);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0 });
    const [itemsPerPage, setItemsPerPage] = useState(100);

    // UI State
    const [view, setView] = useState('ips'); // ips, users, monitor, logs
    const [displayMode, setDisplayMode] = useState('list'); // list, pool, map
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Selection & Editing
    const [selectedIds, setSelectedIds] = useState([]);
    const [editingIp, setEditingIp] = useState(null);
    const [pingModalData, setPingModalData] = useState(null);

    // Tabs & Sorting
    const [activeTab, setActiveTab] = useState('all');
    const [tabs, setTabs] = useState([{ id: 'all', name: 'All IPs' }]);
    const [sortConfig, setSortConfig] = useState({ key: 'ip', direction: 'asc' });

    // Modals
    const [showMyAccount, setShowMyAccount] = useState(false);
    const [showBackupModal, setShowBackupModal] = useState(false);
    const [showTabModal, setShowTabModal] = useState(false);

    // Forms
    const [form, setForm] = useState({ ip: '', hostname: '', ports: '', status: 'Available', note: '', tab_id: '', subnet: '', cidr: '' });

    // Monitor Config
    const [monitorConfig, setMonitorConfig] = useState({ interval: 180, enabled: false });

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Initial Data Fetch
    useEffect(() => {
        if (user) {
            fetchTabs();
            if (user.username === 'admin') fetchMonitorStatus();
        }
    }, [user]);

    // Fetch IPs when relevant state changes
    useEffect(() => {
        if (user && (view === 'ips')) {
            fetchIps();
        }
    }, [user, pagination.currentPage, debouncedSearch, activeTab, view, sortConfig, itemsPerPage]);

    const fetchTabs = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/tabs', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) {
                let data = await res.json();

                // Permission Filtering
                if (user && user.role !== 'admin' && Array.isArray(user.allowed_tabs) && user.allowed_tabs.length > 0) {
                    const allowedIds = user.allowed_tabs.map(id => parseInt(id));
                    data = data.filter(t => allowedIds.includes(t.id));
                    setTabs(data); // No 'All IPs' tab

                    // Ensure activeTab is valid
                    if (activeTab === 'all' || !allowedIds.includes(parseInt(activeTab))) {
                        if (data.length > 0) setActiveTab(data[0].id);
                        else setActiveTab('');
                    }
                } else {
                    setTabs([{ id: 'all', name: 'All IPs' }, ...data]);
                }
            }
        } catch (e) { console.error("Failed to fetch tabs", e); }
    };

    const fetchIps = async () => {
        try {
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
                if (pagination.currentPage !== data.pagination.currentPage) setSelectedIds([]);
            } else if (res.status === 401) {
                logout();
            }
        } catch (e) { console.error("Failed to fetch IPs", e); }
    };

    const fetchMonitorStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/monitor/status', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setMonitorConfig(await res.json());
        } catch (e) { console.error("Failed to fetch monitor status", e); }
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
        try {
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
                alert(res.status === 409 ? "IP already exists — add subnet/CIDR instead" : err.error);
            }
        } catch (e) { alert("Failed to add IP"); }
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
        if (!window.confirm('Delete IP?')) return;
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
        if (!window.confirm('Delete tab? IPs in this tab will remain but become unassigned.')) return;
        const token = localStorage.getItem('token');
        await fetch(`/api/tabs/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (activeTab === id) setActiveTab('all');
        fetchTabs();
    };

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleSelectAll = (e) => {
        setSelectedIds(e.target.checked ? allIps.map(ip => ip.id) : []);
    };

    const handleSelectOne = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]);
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} IPs?`)) return;

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

    const handleExportExcel = async () => {
        const token = localStorage.getItem('token');
        const queryParams = new URLSearchParams({ search: debouncedSearch, tab_id: activeTab });
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

    // Conditional Rendering
    if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;
    if (!user) return <Login />;

    return (
        <div className="container fade-in">
            <header>
                <div className="header-top glass-effect">
                    <h1><Server size={32} className="text-accent" /> IP Manager</h1>
                    <div className="user-controls">
                        <span className="user-badge">{user.username} <small>({user.role})</small></span>
                        {user.role === 'admin' && (
                            <>
                                <nav className="nav-buttons">
                                    <button onClick={() => setView('ips')} className={view === 'ips' ? 'active' : ''}>
                                        <List size={16} /> IPs
                                    </button>
                                    <button onClick={() => setView('users')} className={view === 'users' ? 'active' : ''}>
                                        <Users size={16} /> Users
                                    </button>
                                    <button onClick={() => setView('monitor')} className={view === 'monitor' ? 'active' : ''}>
                                        <Activity size={16} /> Monitor
                                    </button>

                                </nav>
                                <button onClick={() => setShowBackupModal(true)} className="btn-backup" title="Backup System">
                                    <Save size={16} />
                                </button>
                            </>
                        )}
                        <button onClick={() => setShowMyAccount(true)} className="btn-account" title="Account Settings">
                            <Shield size={16} />
                        </button>
                        <button onClick={logout} className="btn-logout" title="Logout"><LogOut size={16} /></button>
                    </div>
                </div>
            </header>

            <main>
                {/* Users View */}
                {view === 'users' && user.username === 'admin' && <UserManagement />}

                {/* Monitor View */}
                {view === 'monitor' && user.username === 'admin' && (
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
                )}

                {/* Logs View */}


                {/* IPs View (Default) */}
                {view === 'ips' && (
                    <>
                        {user.role === 'admin' && (
                            <section className="card form-card">
                                <h2><Plus size={20} /> Add New IP</h2>
                                <form onSubmit={handleSubmit}>
                                    <div className="form-row">
                                        <input placeholder="IP Address" value={form.ip} onChange={e => setForm({ ...form, ip: e.target.value })} required className="modern-input" />
                                        <input placeholder="Hostname" value={form.hostname} onChange={e => setForm({ ...form, hostname: e.target.value })} className="modern-input" />
                                        <input placeholder="Subnet (Optional)" value={form.subnet} onChange={e => setForm({ ...form, subnet: e.target.value })} className="modern-input" />
                                        <input placeholder="CIDR (Optional)" value={form.cidr} onChange={e => setForm({ ...form, cidr: e.target.value })} className="modern-input" />
                                    </div>
                                    <div className="form-row">
                                        <input placeholder="Ports" value={form.ports} onChange={e => setForm({ ...form, ports: e.target.value })} className="modern-input" />
                                        <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="modern-select">
                                            <option value="Up">Up</option>
                                            <option value="Down">Down</option>
                                            <option value="Available">Available</option>
                                            <option value="Reserved">Reserved</option>
                                            <option value="Pending">Pending</option>
                                        </select>
                                        <select value={form.tab_id} onChange={e => setForm({ ...form, tab_id: e.target.value })} className="modern-select">
                                            <option value="Unassigned">Unassigned</option>
                                            {tabs.filter(t => t.id !== 'all').map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button type="submit" className="btn-primary"><Plus size={16} /> Add Entry</button>
                                </form>
                            </section>
                        )}

                        <section className="card list-card">
                            <div className="list-header">
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
                                <div className="search-box">
                                    <Search className="search-icon" size={18} />
                                    <input
                                        placeholder="Search by IP, Hostname..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="search-input"
                                    />
                                </div>
                                <button onClick={handleExportExcel} className="btn-secondary" title="Export current view to Excel">
                                    <Download size={16} /> Export Excel
                                </button>
                                <div className="pagination-controls">
                                    <label>Show:</label>
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => {
                                            setItemsPerPage(Number(e.target.value));
                                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                                        }}
                                        className="modern-select small"
                                    >
                                        <option value={100}>100</option>
                                        <option value={200}>200</option>
                                        <option value={300}>300</option>
                                    </select>
                                </div>
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

                            {/* MAIN VIEWS */}
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
                                                            <div className="action-buttons">
                                                                <button className="btn-edit-icon" onClick={() => setEditingIp(ip)} title="Edit IP"><Edit2 size={16} /></button>
                                                                <button className="btn-ping-icon" onClick={() => setPingModalData(ip)} title="Check Status"><Activity size={16} /></button>
                                                                <button className="btn-delete-icon" onClick={() => handleDelete(ip.id)} title="Delete IP"><Trash2 size={16} /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {/* Pagination (Simplified for brevity but functional) */}
                                    <div className="pagination-bar">
                                        <span>Showing {((pagination.currentPage - 1) * itemsPerPage) + 1} to {Math.min(pagination.currentPage * itemsPerPage, pagination.totalItems)} of {pagination.totalItems} IPs</span>
                                        <div className="pagination-buttons">
                                            <button
                                                disabled={pagination.currentPage === 1}
                                                onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
                                                className="btn-secondary"
                                            >
                                                Previous
                                            </button>
                                            <button
                                                disabled={pagination.currentPage === pagination.totalPages}
                                                onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                                                className="btn-secondary"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </section>
                    </>
                )}
            </main>

            {/* Modals */}
            <ChangePasswordModal
                isOpen={showMyAccount}
                onClose={() => setShowMyAccount(false)}
                onSave={handleMyPasswordUpdate}
                title="My Account - Change Password"
                requireOldPassword={true}
            />
            <BackupModal isOpen={showBackupModal} onClose={() => setShowBackupModal(false)} />
            <TabModal isOpen={showTabModal} onClose={() => setShowTabModal(false)} onSave={handleAddTab} />
            <PingStatusModal isOpen={!!pingModalData} onClose={() => setPingModalData(null)} ipData={pingModalData} onRefresh={fetchIps} />
            {editingIp && <EditModal ip={editingIp} tabs={tabs} onClose={() => setEditingIp(null)} onSave={handleEdit} />}
        </div>
    );
}
