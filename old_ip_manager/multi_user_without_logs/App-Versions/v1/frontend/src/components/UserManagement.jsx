import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, Plus, Power, Key, Trash2, Shield } from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';
import PermissionsModal from './PermissionsModal';

/**
 * UserManagement Component
 * Admin interface for managing users, roles, and statuses.
 */
const UserManagement = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [form, setForm] = useState({ username: '', password: '', role: 'readonly' });
    const [msg, setMsg] = useState('');
    const [loading, setLoading] = useState(true);
    const [passwordModalUser, setPasswordModalUser] = useState(null);
    const [permissionsModalUser, setPermissionsModalUser] = useState(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    /**
     * Fetches all users from the backend.
     */
    const fetchUsers = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setUsers(await res.json());
            } else {
                console.error("Failed to fetch users");
            }
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Handles creating a new user.
     */
    const handleAdd = async (e) => {
        e.preventDefault();
        try {
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
                setMsg('User added successfully');
                setTimeout(() => setMsg(''), 3000);
            } else {
                const data = await res.json().catch(() => ({}));
                setMsg(data.error || 'Failed to add user');
            }
        } catch (error) {
            setMsg('Error adding user');
        }
    };

    /**
     * Deletes a user by ID.
     */
    const handleDelete = async (id) => {
        if (!process.browser && !window.confirm('Delete user?')) return;
        // Note: process.browser check is not standard in clear React, removed in cleanup or handled by browser env.
        // Standard window.confirm is fine.

        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/users/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchUsers();
        } catch (error) {
            console.error("Error deleting user:", error);
        }
    };

    /**
     * Toggles user active status (enable/disable login).
     */
    const handleToggleStatus = async (id, currentStatus) => {
        try {
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
        } catch (error) {
            console.error("Error toggling status:", error);
        }
    };

    /**
     * Updates user role.
     */
    const handleRoleChange = async (id, newRole) => {
        try {
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
        } catch (error) {
            console.error("Error changing role:", error);
        }
    };

    /**
     * Handles password reset for a specific user.
     */
    const handlePasswordReset = async ({ newPassword }) => {
        try {
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
        } catch (error) {
            alert('Error updating password');
        }
    };

    /**
     * Updates user tab permissions.
     */
    const handlePermissionsSave = async (userId, allowedTabs) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/users/${userId}/tabs`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ allowed_tabs: allowedTabs })
            });
            if (res.ok) {
                setPermissionsModalUser(null);
                fetchUsers(); // Refresh to show updated state if needed (though invisible in list)
                alert('Permissions updated successfully');
            } else {
                alert('Failed to update permissions');
            }
        } catch (error) {
            alert('Error updating permissions');
        }
    };

    return (
        <div className="card">
            <h2><Users size={20} style={{ marginRight: '10px' }} /> User Management</h2>
            {msg && <p className="success-msg">{msg}</p>}

            <form onSubmit={handleAdd} className="user-form">
                <input
                    placeholder="Username"
                    value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value })}
                    required
                    className="modern-input"
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    required
                    className="modern-input"
                />
                <select
                    value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}
                    className="modern-select"
                >
                    <option value="readonly">Readonly</option>
                    <option value="admin">Admin</option>
                </select>
                <button type="submit" className="btn-primary"><Plus size={16} /> Create User</button>
            </form>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                    <div className="spinner"></div>
                </div>
            ) : (
                <div className="table-responsive">
                    <table className="modern-table user-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Role</th>
                                <th>Access</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontWeight: 500, color: !u.is_active ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                                                {u.username}
                                            </span>
                                            {u.username === 'admin' && <Shield size={14} color="var(--accent)" />}
                                        </div>
                                    </td>
                                    <td>
                                        <select
                                            value={u.role}
                                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                            disabled={u.username === 'admin'}
                                            className="role-select modern-select compact"
                                        >
                                            <option value="admin">Admin</option>
                                            <option value="readonly">Readonly</option>
                                        </select>
                                    </td>
                                    <td>
                                        <div
                                            onClick={() => u.username !== 'admin' && setPermissionsModalUser(u)}
                                            style={{
                                                cursor: u.username !== 'admin' ? 'pointer' : 'default',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                fontSize: '0.85rem',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.1)'
                                            }}
                                        >
                                            {u.username === 'admin' ? (
                                                <span style={{ color: 'var(--success)' }}>Full Access</span>
                                            ) : (
                                                <>
                                                    {(!u.allowed_tabs || u.allowed_tabs.length === 0) ? (
                                                        <span style={{ color: 'var(--text-secondary)' }}>All Tabs</span>
                                                    ) : (
                                                        <span style={{ color: 'var(--accent)' }}>{u.allowed_tabs.length} Tabs</span>
                                                    )}
                                                    <Shield size={12} style={{ opacity: 0.5 }} />
                                                </>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`status-badge ${u.is_active ? 'status-up' : 'status-down'}`}>
                                            {u.is_active ? 'Active' : 'Disabled'}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {u.username !== 'admin' && u.id !== user.id && (
                                            <div style={{ display: 'inline-flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                <button
                                                    className={`btn-icon ${u.is_active ? 'text-success' : 'text-danger'}`}
                                                    onClick={() => handleToggleStatus(u.id, u.is_active)}
                                                    title={u.is_active ? "Disable Account" : "Enable Account"}
                                                >
                                                    <Power size={16} />
                                                </button>
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => setPasswordModalUser(u)}
                                                    title="Change Password"
                                                >
                                                    <Key size={16} />
                                                </button>
                                                <button
                                                    className="btn-icon text-danger"
                                                    onClick={() => handleDelete(u.id)}
                                                    title="Delete User"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <ChangePasswordModal
                isOpen={!!passwordModalUser}
                onClose={() => setPasswordModalUser(null)}
                onSave={handlePasswordReset}
                title={`Reset Password for ${passwordModalUser?.username}`}
            />

            <PermissionsModal
                isOpen={!!permissionsModalUser}
                user={permissionsModalUser}
                onClose={() => setPermissionsModalUser(null)}
                onSave={handlePermissionsSave}
            />
        </div>
    );
};

export default UserManagement;
