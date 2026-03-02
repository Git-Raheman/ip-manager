import React from 'react';

/**
 * PoolView Component
 * Grid view of IP addresses visualizing their status.
 * 
 * Props:
 * - ips: array - List of IPs
 * - onEdit: function - Handler when clicking an IP card
 */
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

export default PoolView;
