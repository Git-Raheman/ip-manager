import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, Settings } from 'lucide-react';

const MonitorView = ({ monitorConfig, onConfigChange, onPingAll, onPingOne }) => {
    const [interval, setInterval] = useState(monitorConfig?.interval || 60);
    const [enabled, setEnabled] = useState(monitorConfig?.enabled || false);

    useEffect(() => {
        if (monitorConfig) {
            setInterval(monitorConfig.interval);
            setEnabled(monitorConfig.enabled);
        }
    }, [monitorConfig]);

    const handleSave = () => {
        onConfigChange(interval, enabled);
    };

    const handleToggle = () => {
        const newEnabled = !enabled;
        setEnabled(newEnabled);
        onConfigChange(interval, newEnabled);
    };

    return (
        <div className="card">
            <h2><Activity size={20} style={{ marginRight: '10px' }} /> Network Monitor</h2>
            <div className="monitor-controls" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="control-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <label>Monitoring Status:</label>
                    <button
                        className={`btn-toggle ${enabled ? 'active' : 'inactive'}`}
                        onClick={handleToggle}
                        style={{
                            background: enabled ? 'var(--accent-primary)' : '#64748b',
                            color: 'white',
                            padding: '0.5rem 1rem',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        {enabled ? 'Enabled' : 'Disabled'}
                    </button>
                </div>
                <div className="control-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <label>Interval (seconds):</label>
                    <input
                        type="number"
                        value={interval}
                        onChange={e => setInterval(parseInt(e.target.value))}
                        min="10"
                        style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', width: '100px' }}
                    />
                    <button onClick={handleSave} className="btn-save"><Settings size={16} /> Update Interval</button>
                </div>
                <div className="control-group">
                    <button onClick={onPingAll} className="btn-primary"><RefreshCw size={16} /> Ping All Now</button>
                </div>
            </div>
        </div>
    );
};

export default MonitorView;
