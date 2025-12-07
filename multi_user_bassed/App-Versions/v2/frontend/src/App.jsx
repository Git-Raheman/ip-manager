import React, { useState, useEffect } from 'react';
import { useAuth } from './index';

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
            <h2>User Management</h2>
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
                <button type="submit">Create User</button>
            </form>
            <div className="user-list">
                {users.map(u => (
                    <div key={u.id} className="user-item">
                        <span>{u.username} ({u.role})</span>
                        {u.username !== 'admin' && u.id !== user.id && (
                            <button className="btn-delete" onClick={() => handleDelete(u.id)}>Remove</button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default function App() {
    const { user, logout, loading } = useAuth();
    const [ips, setIps] = useState([]);
    const [form, setForm] = useState({ ip: '', hostname: '', ports: '', status: 'active', note: '' });
    const [pingResult, setPingResult] = useState(null);
    const [pinging, setPinging] = useState(false);
    const [view, setView] = useState('ips'); // 'ips' or 'users'

    useEffect(() => {
        if (user) fetchIps();
    }, [user]);

    const fetchIps = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/ips', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setIps(data);
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
                setForm({ ip: '', hostname: '', ports: '', status: 'active', note: '' });
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

    if (loading) return <div className="loading">Loading...</div>;
    if (!user) return <Login />;

    return (
        <div className="container">
            <header>
                <div className="header-top">
                    <h1>IP Manager</h1>
                    <div className="user-controls">
                        <span>{user.username} ({user.role})</span>
                        {user.role === 'admin' && (
                            <button onClick={() => setView(view === 'users' ? 'ips' : 'users')}>
                                {view === 'users' ? 'Manage IPs' : 'Manage Users'}
                            </button>
                        )}
                        <button onClick={logout} className="btn-logout">Logout</button>
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
                                <h2>Add New IP</h2>
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
                                    <button type="submit">Add Entry</button>
                                </form>
                            </section>
                        )}

                        <section className="card list-card">
                            <h2>Managed IPs</h2>
                            {ips.length === 0 ? (
                                <p className="empty-state">No IPs added yet.</p>
                            ) : (
                                <div className="table-container">
                                    <table className="ip-table">
                                        <thead>
                                            <tr>
                                                <th>IP</th>
                                                <th>Hostname</th>
                                                <th>Ports</th>
                                                <th>Status</th>
                                                <th>Note</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ips.map(item => (
                                                <tr key={item.id}>
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
                                                            >
                                                                Ping
                                                            </button>
                                                            {user.role === 'admin' && (
                                                                <button
                                                                    className="btn-delete"
                                                                    onClick={() => handleDelete(item.id)}
                                                                >
                                                                    Delete
                                                                </button>
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

            {pingResult && (
                <div className="modal-overlay" onClick={() => setPingResult(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Ping Result: {pingResult.ip}</h3>
                            <button onClick={() => setPingResult(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className={`status ${pingResult.alive ? 'alive' : 'dead'}`}>
                                {pingResult.alive ? 'Host is Up' : 'Host is Down'}
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
        </div>
    );
}
