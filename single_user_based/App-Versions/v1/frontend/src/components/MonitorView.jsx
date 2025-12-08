import React, { useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';

/**
 * MonitorView Component
 * Controls for automatic monitoring and ping tools.
 */
const MonitorView = ({ monitorConfig, onConfigChange, onPingAll, onPingOne }) => {
    const [specificIp, setSpecificIp] = useState('');

    const handleIntervalChange = (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val)) val = 60;
        if (val < 1) val = 1;
        if (val > 5000) val = 5000;
        onConfigChange(val, monitorConfig.enabled);
    };

    return (
        <div className="card monitor-card">
            <h2><Activity size={20} style={{ marginRight: '10px' }} /> Live Column Settings</h2>
            <div className="monitor-settings">
                <div className="setting-group">
                    <h3>Automatic Monitoring</h3>
                    <div className="setting-row">
                        <label>Feature Status:</label>
                        <button
                            className={`btn-toggle ${monitorConfig.enabled ? 'active' : 'inactive'}`}
                            onClick={() => onConfigChange(monitorConfig.interval, !monitorConfig.enabled)}
                        >
                            {monitorConfig.enabled ? 'ON' : 'OFF'}
                        </button>
                    </div>
                    <div className="setting-row">
                        <label>Routine Check Time (Minutes):</label>
                        <input
                            type="number"
                            min="1"
                            max="5000"
                            value={monitorConfig.interval}
                            onChange={handleIntervalChange}
                            className="interval-input modern-input"
                        />
                    </div>
                </div>

                <div className="setting-group">
                    <h3>Update Mode</h3>
                    <div className="setting-row">
                        <label>Update All IPs:</label>
                        <button onClick={onPingAll} className="btn-primary"><RefreshCw size={16} /> Run Check Now</button>
                    </div>
                    <div className="setting-row">
                        <label>Update Specific IP:</label>
                        <div className="input-group">
                            <input
                                placeholder="Enter IP Address"
                                value={specificIp}
                                onChange={e => setSpecificIp(e.target.value)}
                                className="modern-input"
                            />
                            <button onClick={() => onPingOne(specificIp)} className="btn-secondary" disabled={!specificIp}>
                                <Activity size={16} /> Check
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="monitor-info">
                <p>Last Run: {monitorConfig.lastRun ? new Date(monitorConfig.lastRun).toLocaleString() : 'Never'}</p>
                <p>Next Run: {monitorConfig.nextRun ? new Date(monitorConfig.nextRun).toLocaleString() : 'Not Scheduled'}</p>
            </div>
        </div>
    );
};

export default MonitorView;
