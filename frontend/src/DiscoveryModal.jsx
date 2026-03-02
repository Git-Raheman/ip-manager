import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Search, Loader2, Network, CheckSquare, Square, Download,
    AlertCircle, Filter, Server, Laptop, StopCircle, Wifi,
    RefreshCw, Globe, Shield, Zap, Clock, CheckCircle,
    XCircle, Monitor, Cpu
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

const getDeviceIcon = (hostname) => {
    if (!hostname) return Laptop;
    const h = hostname.toLowerCase();
    if (h.includes('router') || h.includes('gateway') || h.includes('gw')) return Globe;
    if (h.includes('server') || h.includes('srv') || h.includes('nas') || h.includes('storage')) return Server;
    if (h.includes('switch') || h.includes('ap') || h.includes('access') || h.includes('wifi')) return Wifi;
    if (h.includes('pc') || h.includes('desktop') || h.includes('workstation')) return Monitor;
    if (h.includes('pi') || h.includes('raspberry') || h.includes('arduino')) return Cpu;
    return Laptop;
};

const formatDuration = (s) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
};

const QUICK_RANGES = [
    { label: '192.168.1.x', value: '192.168.1.0/24' },
    { label: '192.168.0.x', value: '192.168.0.0/24' },
    { label: '10.0.0.x', value: '10.0.0.0/24' },
    { label: '172.16.0.x', value: '172.16.0.0/24' },
];

// ── Component ─────────────────────────────────────────────────────────────────

const DiscoveryModal = ({ isOpen, onClose, tabs, onImport }) => {
    /* ── State (unchanged names, same API calls) ── */
    const [range, setRange] = useState('192.168.1.0/24');
    const [rangeType, setRangeType] = useState('quick');
    const [devices, setDevices] = useState([]);
    const [jobId, setJobId] = useState(null);
    const [status, setStatus] = useState('idle');
    const [phase, setPhase] = useState('');
    const [selectedIps, setSelectedIps] = useState(new Set());
    const [error, setError] = useState('');
    const [targetTab, setTargetTab] = useState('');
    const [filterNew, setFilterNew] = useState(true);
    const [existingIps, setExistingIps] = useState(new Set());
    const [scanningProgress, setScanningProgress] = useState(0);

    /* ── New UI-only state ── */
    const [searchFilter, setSearchFilter] = useState('');
    const [scanDuration, setScanDuration] = useState(0);
    const scanTimerRef = useRef(null);

    /* ── Fetch existing IPs to mark NEW badges ── */
    const fetchExistingIps = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/ips?limit=10000', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setExistingIps(new Set(data.data.map(ip => ip.ip)));
        } catch (err) {
            console.error('Failed to fetch existing IPs', err);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchExistingIps();
            resetScan();
        }
        return () => { if (scanTimerRef.current) clearInterval(scanTimerRef.current); };
    }, [isOpen, fetchExistingIps]);

    const resetScan = () => {
        setDevices([]);
        setJobId(null);
        setStatus('idle');
        setPhase('');
        setSelectedIps(new Set());
        setError('');
        setScanningProgress(0);
        setSearchFilter('');
        setScanDuration(0);
        if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    };

    /* ── Polling (unchanged logic) ── */
    useEffect(() => {
        let interval;
        if (jobId && status === 'scanning') {
            interval = setInterval(async () => {
                try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(`/api/discovery/status/${jobId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (res.ok) {
                        setDevices(data.devices);
                        setStatus(data.status);
                        setPhase(data.phase || '');
                        if (data.status === 'completed') {
                            setScanningProgress(100);
                            clearInterval(interval);
                            if (scanTimerRef.current) clearInterval(scanTimerRef.current);
                        } else if (data.status === 'scanning') {
                            setScanningProgress(data.progress || 0);
                        } else {
                            clearInterval(interval);
                            if (scanTimerRef.current) clearInterval(scanTimerRef.current);
                        }
                    } else {
                        setStatus('failed');
                        setError(data.error || 'Failed to get job status');
                        clearInterval(interval);
                    }
                } catch (err) {
                    setError('Connection error while polling status');
                    clearInterval(interval);
                }
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [jobId, status]);

    /* ── Start Scan (unchanged API call) ── */
    const handleStartScan = async () => {
        setStatus('scanning');
        setError('');
        setScanningProgress(0);
        setPhase('Initializing…');
        setDevices([]);
        setSelectedIps(new Set());
        setScanDuration(0);
        scanTimerRef.current = setInterval(() => setScanDuration(d => d + 1), 1000);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/discovery/start', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ range })
            });
            const data = await res.json();
            if (res.ok) {
                setJobId(data.jobId);
            } else {
                setStatus('failed');
                setError(data.error || 'Failed to start scan');
                clearInterval(scanTimerRef.current);
            }
        } catch {
            setStatus('failed');
            setError('Failed to connect to server');
            clearInterval(scanTimerRef.current);
        }
    };

    /* ── Stop Scan (unchanged API call) ── */
    const handleStopScan = async () => {
        if (!jobId) return;
        if (scanTimerRef.current) clearInterval(scanTimerRef.current);
        try {
            const token = localStorage.getItem('token');
            await fetch(`/api/discovery/stop/${jobId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (err) {
            console.error('Stop request failed', err);
        }
    };

    /* ── Range toggles ── */
    const toggleRangeType = (type) => {
        setRangeType(type);
        if (type === 'quick') setRange(prev => prev.includes('.') ? prev.split('.').slice(0, 3).join('.') + '.0/24' : '192.168.1.0/24');
        else if (type === 'full') setRange(prev => prev.includes('.') ? prev.split('.').slice(0, 2).join('.') + '.0.0/16' : '192.168.0.0/16');
    };

    /* ── Filtered device list ── */
    const filteredDevices = devices.filter(d => {
        const matchNew = !filterNew || !existingIps.has(d.ip);
        const matchSearch = !searchFilter || d.ip.includes(searchFilter) ||
            (d.hostname && d.hostname.toLowerCase().includes(searchFilter.toLowerCase()));
        return matchNew && matchSearch;
    });

    /* ── Selection helpers ── */
    const toggleSelect = (ip) => { const s = new Set(selectedIps); s.has(ip) ? s.delete(ip) : s.add(ip); setSelectedIps(s); };
    const selectAll = () => setSelectedIps(new Set(filteredDevices.map(d => d.ip)));
    const deselectAll = () => setSelectedIps(new Set());

    /* ── Bulk import (unchanged API call) ── */
    const handleBulkAdd = async () => {
        const selectedNewDevices = devices.filter(d => selectedIps.has(d.ip) && !existingIps.has(d.ip));
        if (selectedNewDevices.length === 0) return;
        setStatus('importing');
        try {
            const token = localStorage.getItem('token');
            const payload = selectedNewDevices.map(d => ({ ip: d.ip, hostname: d.hostname, status: 'Active', tab_id: targetTab }));
            const res = await fetch('/api/ips/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ ips: payload, tab_id: targetTab })
            });
            if (res.ok) {
                const result = await res.json();
                onImport(result.message);
                onClose();
            } else {
                const data = await res.json();
                setError(data.error || 'Import failed');
                setStatus('completed');
            }
        } catch {
            setError('Import failed due to network error');
            setStatus('completed');
        }
    };

    /* ── Derived values ── */
    if (!isOpen) return null;
    const selectedNewCount = Array.from(selectedIps).filter(ip => !existingIps.has(ip)).length;
    const newDeviceCount = devices.filter(d => !existingIps.has(d.ip)).length;
    const existingCount = devices.filter(d => existingIps.has(d.ip)).length;
    const scanDone = status === 'completed' || status === 'stopped';

    /* ── Render ── */
    return (
        <AnimatePresence>
            <div className="disc-overlay" onClick={onClose}>
                <motion.div
                    className="disc-modal"
                    onClick={e => e.stopPropagation()}
                    initial={{ opacity: 0, scale: 0.94, y: 32 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: 32 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                >
                    {/* ══ HEADER ══ */}
                    <div className="disc-header">
                        <div className="disc-header-left">
                            <div className={`disc-icon-wrap ${status === 'scanning' ? 'disc-icon-pulse' : ''}`}>
                                <Network size={20} />
                            </div>
                            <div>
                                <h2 className="disc-title">Network Auto-Discovery</h2>
                                <p className="disc-subtitle">
                                    {status === 'idle' && 'Scan your network and import discovered hosts'}
                                    {status === 'scanning' && `Scanning ${range} · ${devices.length} hosts found`}
                                    {status === 'completed' && `Scan complete · ${devices.length} hosts discovered in ${formatDuration(scanDuration)}`}
                                    {status === 'stopped' && `Scan stopped · ${devices.length} hosts found so far`}
                                    {status === 'failed' && 'Scan failed — check the error below'}
                                    {status === 'importing' && 'Saving selected hosts to database…'}
                                </p>
                            </div>
                        </div>
                        <div className="disc-header-actions">
                            {scanDone && devices.length > 0 && (
                                <button className="disc-btn-ghost" onClick={resetScan}>
                                    <RefreshCw size={14} /> New Scan
                                </button>
                            )}
                            <button className="disc-close-btn" onClick={onClose}><X size={18} /></button>
                        </div>
                    </div>

                    {/* ══ CONFIGURATION PANEL ══ */}
                    <div className={`disc-config ${status !== 'idle' && status !== 'failed' ? 'disc-config-compact' : ''}`}>

                        {/* Scan Type Selector */}
                        <div className="disc-type-row">
                            {[
                                { key: 'quick', label: 'Subnet /24', badge: '256 hosts' },
                                { key: 'full', label: 'Network /16', badge: '65k hosts' },
                                { key: 'custom', label: 'Custom Range', badge: 'Any target' },
                            ].map(t => (
                                <button
                                    key={t.key}
                                    className={`disc-type-btn ${rangeType === t.key ? 'disc-type-active' : ''}`}
                                    onClick={() => toggleRangeType(t.key)}
                                    disabled={status === 'scanning'}
                                >
                                    <span className="disc-type-label">{t.label}</span>
                                    <span className="disc-type-badge">{t.badge}</span>
                                </button>
                            ))}
                        </div>

                        {/* Quick range chips — only when idle */}
                        {(status === 'idle' || status === 'failed') && (
                            <div className="disc-quick-row">
                                <span className="disc-quick-label">Quick ranges:</span>
                                {QUICK_RANGES.map(r => (
                                    <button
                                        key={r.value}
                                        className={`disc-chip ${range === r.value ? 'disc-chip-active' : ''}`}
                                        onClick={() => { setRange(r.value); setRangeType('quick'); }}
                                    >
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Target input + action button */}
                        <div className="disc-input-row">
                            <div className="disc-input-wrap">
                                <Globe size={15} className="disc-input-icon" />
                                <input
                                    type="text"
                                    value={range}
                                    onChange={e => setRange(e.target.value)}
                                    placeholder={rangeType === 'custom' ? 'e.g. 10.1.1.1-255 or 10.1.1.1,5,10-20' : 'e.g. 192.168.1.0/24'}
                                    disabled={status === 'scanning'}
                                    className="disc-range-input"
                                    onKeyDown={e => e.key === 'Enter' && status === 'idle' && handleStartScan()}
                                />
                            </div>
                            {status === 'scanning' ? (
                                <button onClick={handleStopScan} className="disc-stop-btn">
                                    <StopCircle size={16} /> Stop Scan
                                </button>
                            ) : (
                                <button
                                    onClick={handleStartScan}
                                    disabled={!range || status === 'importing'}
                                    className="disc-start-btn"
                                >
                                    <Zap size={16} /> Start Scan
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ══ PROGRESS BAR ══ */}
                    {status === 'scanning' && (
                        <div className="disc-progress-section">
                            <div className="disc-progress-meta">
                                <div className="disc-progress-phase">
                                    <Loader2 size={13} className="disc-spin" />
                                    <span>{phase || 'Scanning…'}</span>
                                </div>
                                <div className="disc-progress-stats">
                                    <span className="disc-found-pill">{devices.length} found</span>
                                    <span className="disc-pct-text">{scanningProgress.toFixed(0)}%</span>
                                    <span className="disc-timer-text"><Clock size={11} /> {formatDuration(scanDuration)}</span>
                                </div>
                            </div>
                            <div className="disc-progress-track">
                                <motion.div
                                    className="disc-progress-fill"
                                    animate={{ width: `${scanningProgress}%` }}
                                    transition={{ duration: 0.4, ease: 'easeOut' }}
                                />
                            </div>
                        </div>
                    )}

                    {/* ══ ERROR BANNER ══ */}
                    {error && (
                        <div className="disc-error-banner">
                            <AlertCircle size={15} />
                            <span>{error}</span>
                            <button className="disc-error-dismiss" onClick={() => setError('')}><X size={13} /></button>
                        </div>
                    )}

                    {/* ══ POST-SCAN SUMMARY ══ */}
                    {scanDone && devices.length > 0 && (
                        <motion.div
                            className="disc-summary"
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <div className="disc-stat disc-stat-total">
                                <span className="disc-stat-num">{devices.length}</span>
                                <span className="disc-stat-lbl">Total Found</span>
                            </div>
                            <div className="disc-stat-div" />
                            <div className="disc-stat disc-stat-new">
                                <span className="disc-stat-num">{newDeviceCount}</span>
                                <span className="disc-stat-lbl">New Hosts</span>
                            </div>
                            <div className="disc-stat-div" />
                            <div className="disc-stat disc-stat-tracked">
                                <span className="disc-stat-num">{existingCount}</span>
                                <span className="disc-stat-lbl">Already Tracked</span>
                            </div>
                            <div className="disc-stat-div" />
                            <div className="disc-stat">
                                <span className="disc-stat-num">{formatDuration(scanDuration)}</span>
                                <span className="disc-stat-lbl">Duration</span>
                            </div>
                            {status === 'stopped' && (
                                <>
                                    <div className="disc-stat-div" />
                                    <div className="disc-stat disc-stat-warn">
                                        <StopCircle size={15} />
                                        <span className="disc-stat-lbl">Stopped Early</span>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    )}

                    {/* ══ RESULTS AREA ══ */}
                    <div className="disc-results-section">

                        {/* Results toolbar */}
                        <div className="disc-results-toolbar">
                            <div className="disc-toolbar-left">
                                {filteredDevices.length > 0 && (
                                    <span className="disc-visible-count">{filteredDevices.length} visible</span>
                                )}
                                {selectedNewCount > 0 && (
                                    <span className="disc-selected-pill">{selectedNewCount} selected</span>
                                )}
                            </div>
                            <div className="disc-toolbar-right">
                                {devices.length > 3 && (
                                    <div className="disc-search-wrap">
                                        <Search size={12} className="disc-search-icon" />
                                        <input
                                            type="text"
                                            value={searchFilter}
                                            onChange={e => setSearchFilter(e.target.value)}
                                            placeholder="Filter…"
                                            className="disc-search-input"
                                        />
                                    </div>
                                )}
                                <button
                                    className={`disc-filter-btn ${filterNew ? 'disc-filter-on' : ''}`}
                                    onClick={() => setFilterNew(f => !f)}
                                    title="Show only IPs not already in database"
                                >
                                    <Filter size={12} /> Only New
                                </button>
                                <div className="disc-toolbar-sep" />
                                <button className="disc-text-btn" onClick={selectAll} disabled={filteredDevices.length === 0}>All</button>
                                <button className="disc-text-btn" onClick={deselectAll} disabled={selectedIps.size === 0}>Clear</button>
                            </div>
                        </div>

                        {/* Device list */}
                        <div className="disc-device-list">

                            {/* Empty: Idle */}
                            {status === 'idle' && filteredDevices.length === 0 && (
                                <div className="disc-empty">
                                    <div className="disc-empty-icon"><Network size={38} /></div>
                                    <p className="disc-empty-title">Ready to scan</p>
                                    <p className="disc-empty-sub">Configure a target range above and press <strong>Start Scan</strong></p>
                                </div>
                            )}

                            {/* Empty: Scanning (radar animation) */}
                            {status === 'scanning' && devices.length === 0 && (
                                <div className="disc-empty">
                                    <div className="disc-radar-wrap">
                                        <div className="disc-radar-ring ring1" />
                                        <div className="disc-radar-ring ring2" />
                                        <div className="disc-radar-ring ring3" />
                                        <Network size={20} className="disc-radar-center" />
                                    </div>
                                    <p className="disc-empty-title">Scanning network…</p>
                                    <p className="disc-empty-sub">Hosts will appear as they are discovered</p>
                                </div>
                            )}

                            {/* Empty: Done but filter hides everything */}
                            {scanDone && devices.length > 0 && filteredDevices.length === 0 && (
                                <div className="disc-empty">
                                    <div className="disc-empty-icon"><Shield size={38} /></div>
                                    <p className="disc-empty-title">All hosts already tracked</p>
                                    <p className="disc-empty-sub">Disable <strong>Only New</strong> to see all discovered hosts</p>
                                </div>
                            )}

                            {/* Device rows */}
                            {filteredDevices.map((device, idx) => {
                                const isNew = !existingIps.has(device.ip);
                                const isSelected = selectedIps.has(device.ip);
                                const DevIcon = getDeviceIcon(device.hostname);
                                const isUp = device.status === 'Up';

                                return (
                                    <motion.div
                                        key={device.ip}
                                        className={`disc-device-row ${isSelected ? 'disc-row-selected' : ''} ${!isNew ? 'disc-row-existing' : ''}`}
                                        onClick={() => toggleSelect(device.ip)}
                                        initial={{ opacity: 0, x: -12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: Math.min(idx * 0.025, 0.25), duration: 0.2 }}
                                    >
                                        {/* Checkbox */}
                                        <div className="disc-row-check">
                                            {isSelected
                                                ? <CheckSquare size={16} className="disc-check-on" />
                                                : <Square size={16} className="disc-check-off" />}
                                        </div>

                                        {/* Device icon */}
                                        <div className="disc-row-device-icon">
                                            <DevIcon size={14} />
                                        </div>

                                        {/* IP + NEW badge */}
                                        <div className="disc-row-ip-col">
                                            <span className="disc-ip-text">{device.ip}</span>
                                            {isNew && <span className="disc-new-badge">NEW</span>}
                                        </div>

                                        {/* Hostname */}
                                        <div className="disc-row-host-col">
                                            {device.hostname
                                                ? <span className="disc-hostname-text">{device.hostname}</span>
                                                : <span className="disc-no-host">No hostname</span>
                                            }
                                        </div>

                                        {/* Status pill */}
                                        <div className="disc-row-status-col">
                                            <span className={`disc-status-pill ${isUp ? 'disc-pill-up' : 'disc-pill-other'}`}>
                                                {isUp ? <CheckCircle size={10} /> : <XCircle size={10} />}
                                                {device.status}
                                            </span>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ══ FOOTER ══ */}
                    <div className="disc-footer">
                        <div className="disc-footer-left">
                            <label className="disc-tab-label">Assign to tab:</label>
                            <select
                                value={targetTab}
                                onChange={e => setTargetTab(e.target.value)}
                                className="disc-tab-select"
                                disabled={status === 'scanning' || status === 'importing'}
                            >
                                <option value="">Unassigned</option>
                                {tabs.filter(t => t.id !== 'all').map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="disc-footer-right">
                            <button className="disc-cancel-btn" onClick={onClose}>Cancel</button>
                            <button
                                className="disc-import-btn"
                                onClick={handleBulkAdd}
                                disabled={selectedNewCount === 0 || status === 'scanning' || status === 'importing'}
                            >
                                {status === 'importing'
                                    ? <><Loader2 size={15} className="disc-spin" /> Importing…</>
                                    : <><Download size={15} /> Import {selectedNewCount > 0 ? `${selectedNewCount} Host${selectedNewCount > 1 ? 's' : ''}` : 'Selected'}</>
                                }
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default DiscoveryModal;
