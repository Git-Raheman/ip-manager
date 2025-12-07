import React, { useState, useEffect } from 'react';
import { Activity, X, XCircle, CheckCircle } from 'lucide-react';

/**
 * PingStatusModal Component
 * Small popup to show ping results for a specific IP.
 */
const PingStatusModal = ({ isOpen, onClose, ipData, onRefresh }) => {
    const [pinging, setPinging] = useState(false);
    const [result, setResult] = useState(null);

    const handlePing = async () => {
        setPinging(true);
        setResult(null);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/monitor/ping-one', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ ip: ipData.ip })
            });
            if (res.ok) {
                const data = await res.json();
                setResult(data);
                onRefresh();
            } else {
                setResult({ error: 'Ping failed' });
            }
        } catch (err) {
            setResult({ error: 'Network error' });
        } finally {
            setPinging(false);
        }
    };

    useEffect(() => {
        if (isOpen && ipData) {
            handlePing();
        }
    }, [isOpen, ipData]);

    // Auto-close after 4 seconds when result is available
    useEffect(() => {
        if (result && !pinging) {
            const timer = setTimeout(() => {
                onClose();
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [result, pinging, onClose]);

    if (!isOpen || !ipData) return null;

    return (
        <div className="ping-popup">
            <div className="ping-popup-header">
                <h4><Activity size={16} /> Status Check: {ipData.ip}</h4>
                <button onClick={onClose} className="ping-popup-close"><X size={16} /></button>
            </div>
            <div className="ping-popup-body">
                {pinging ? (
                    <div className="ping-loading-small">
                        <div className="spinner-small"></div>
                        <span>Pinging host...</span>
                    </div>
                ) : result ? (
                    result.error ? (
                        <div className="ping-result-small error">
                            <XCircle size={20} color="#ef4444" />
                            <span>{result.error}</span>
                        </div>
                    ) : (
                        <>
                            <div className={`ping-status-badge ${result.status === 'UP' ? 'up' : 'down'}`}>
                                {result.status === 'UP' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                Host is {result.status}
                            </div>

                            {result.details && (
                                <>
                                    <div className="ping-detail-row">
                                        <span className="ping-detail-label">Packets Sent</span>
                                        <span className="ping-detail-value">{result.details.sent}</span>
                                    </div>
                                    <div className="ping-detail-row">
                                        <span className="ping-detail-label">Packets Received</span>
                                        <span className="ping-detail-value">{result.details.received}</span>
                                    </div>
                                    <div className="ping-detail-row">
                                        <span className="ping-detail-label">Packet Loss</span>
                                        <span className="ping-detail-value">{result.details.packetLoss}%</span>
                                    </div>
                                    <div className="ping-detail-row">
                                        <span className="ping-detail-label">Latency (Avg)</span>
                                        <span className="ping-detail-value">{result.details.avgLatencyMs ? `${result.details.avgLatencyMs} ms` : '-'}</span>
                                    </div>
                                    <div className="ping-command">
                                        {result.details.command}
                                    </div>
                                </>
                            )}
                        </>
                    )
                ) : null}
            </div>
        </div>
    );
};

export default PingStatusModal;
