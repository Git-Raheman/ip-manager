import React, { useState, useEffect } from 'react';
import { Users, Plus, Power, Key, Trash2 } from 'lucide-react';
import { useAuth } from '../index';
import ChangePasswordModal from './ChangePasswordModal';

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
            setTimeout(() => setMsg(''), 3000);
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
            {msg && <p className="info-msg">{msg}</p>}
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
                            {u.username !== 'admin' && user && u.id !== user.id && (
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

export default UserManagement;
