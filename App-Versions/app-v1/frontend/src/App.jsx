import React, { useState, useEffect } from 'react';

export default function App() {
    const [ips, setIps] = useState([]);
    const [form, setForm] = useState({ ip: '', label: '' });
    const [pingResult, setPingResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [pinging, setPinging] = useState(false);

    useEffect(() => {
        fetchIps();
    }, []);

    const fetchIps = async () => {
        try {
            const res = await fetch('/api/ips');
            const data = await res.json();
            setIps(data);
        } catch (err) {
            console.error('Failed to fetch IPs', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/ips', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            if (res.ok) {
                setForm({ ip: '', label: '' });
                fetchIps();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure?')) return;
        try {
            await fetch(`/api/ips/${id}`, { method: 'DELETE' });
            fetchIps();
        } catch (err) {
            console.error(err);
        }
    };

    const handlePing = async (ip) => {
        setPinging(true);
        setPingResult(null);
        try {
            const res = await fetch('/api/ping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

    return (
        <div className="container">
            <header>
                <h1>IP Manager</h1>
                <p>Manage and monitor your network endpoints</p>
            </header>

            <main>
                <section className="card form-card">
                    <h2>Add New IP</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <input
                                type="text"
                                placeholder="IP Address or Hostname"
                                value={form.ip}
                                onChange={e => setForm({ ...form, ip: e.target.value })}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <input
                                type="text"
                                placeholder="Label (Optional)"
                                value={form.label}
                                onChange={e => setForm({ ...form, label: e.target.value })}
                            />
                        </div>
                        <button type="submit" disabled={loading}>
                            {loading ? 'Adding...' : 'Add Entry'}
                        </button>
                    </form>
                </section>

                <section className="card list-card">
                    <h2>Managed IPs</h2>
                    {ips.length === 0 ? (
                        <p className="empty-state">No IPs added yet.</p>
                    ) : (
                        <div className="ip-list">
                            {ips.map(item => (
                                <div key={item.id} className="ip-item">
                                    <div className="ip-info">
                                        <h3>{item.ip}</h3>
                                        {item.label && <span className="label">{item.label}</span>}
                                    </div>
                                    <div className="ip-actions">
                                        <button
                                            className="btn-ping"
                                            onClick={() => handlePing(item.ip)}
                                            disabled={pinging}
                                        >
                                            Ping
                                        </button>
                                        <button
                                            className="btn-delete"
                                            onClick={() => handleDelete(item.id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
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
