import React from 'react';

const PoolView = ({ ips }) => {
    return (
        <div className="pool-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem', padding: '1rem' }}>
            {ips.map(ip => (
                <div key={ip.id} className={`pool-card status-${ip.status ? ip.status.toLowerCase() : 'unknown'}`}
                    style={{
                        padding: '1rem',
                        borderRadius: '8px',
                        background: 'var(--bg-card)',
                        border: 'var(--glass-border)',
                        textAlign: 'center'
                    }}>
                    <div className="ip-address" style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{ip.ip}</div>
                    <div className="hostname" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{ip.hostname || '-'}</div>
                    <div className={`status-badge status-${ip.status ? ip.status.toLowerCase() : 'unknown'}`} style={{ marginTop: '0.5rem', display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem' }}>
                        {ip.status}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default PoolView;
