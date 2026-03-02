import React, { useState, useEffect } from 'react';
import { X, Save, Shield, Check } from 'lucide-react';

const PermissionsModal = ({ user, isOpen, onClose, onSave }) => {
    const [tabs, setTabs] = useState([]);
    const [isRestricted, setIsRestricted] = useState(false);
    const [selectedTabs, setSelectedTabs] = useState([]);

    useEffect(() => {
        if (isOpen && user) {
            fetchTabs();
            // If allowed_tabs is null, it means Full Access (not restricted)
            // If it is an array (even empty), it is restricted.
            if (user.allowed_tabs === null || user.allowed_tabs === undefined) {
                setIsRestricted(false);
                setSelectedTabs([]);
            } else {
                setIsRestricted(true);
                setSelectedTabs(user.allowed_tabs);
            }
        }
    }, [isOpen, user]);

    const fetchTabs = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/tabs', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                // Filter out 'all' pseudo-tab if present
                setTabs(data.filter(t => t.id !== 'all'));
            }
        } catch (error) {
            console.error("Error fetching tabs", error);
        }
    };

    const handleToggleTab = (id) => {
        if (!isRestricted) return; // Should not happen if disabled

        let newSelection = [...selectedTabs];
        if (newSelection.includes(id)) {
            newSelection = newSelection.filter(tid => tid !== id);
        } else {
            newSelection.push(id);
        }
        setSelectedTabs(newSelection);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Return null if not restricted, otherwise array
        const payload = isRestricted ? selectedTabs : null;
        onSave(user.id, payload);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3><Shield size={20} className="mr-2" /> Permissions: {user?.username}</h3>
                    <button onClick={onClose}><X size={24} /></button>
                </div>
                <div className="modal-body">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="checkbox-label" style={{ fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="checkbox"
                                    checked={isRestricted}
                                    onChange={e => setIsRestricted(e.target.checked)}
                                    style={{ width: 'auto' }}
                                />
                                Limit Access to Specific Tabs
                            </label>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                                If unchecked, user can view ALL tabs. If checked, user can only view selected tabs.
                            </p>
                        </div>

                        {isRestricted && (
                            <div className="tabs-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                                {tabs.map(tab => (
                                    <label key={tab.id} className={`tab-checkbox ${selectedTabs.includes(tab.id) ? 'active' : ''}`} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.5rem',
                                        background: selectedTabs.includes(tab.id) ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)',
                                        border: selectedTabs.includes(tab.id) ? '1px solid var(--accent)' : '1px solid transparent',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedTabs.includes(tab.id)}
                                            onChange={() => handleToggleTab(tab.id)}
                                            style={{ display: 'none' }}
                                        />
                                        <div style={{
                                            width: '16px',
                                            height: '16px',
                                            borderRadius: '4px',
                                            border: '1px solid rgba(255,255,255,0.3)',
                                            background: selectedTabs.includes(tab.id) ? 'var(--accent)' : 'transparent',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {selectedTabs.includes(tab.id) && <Check size={12} color="white" />}
                                        </div>
                                        <span style={{ fontSize: '0.9rem' }}>{tab.name}</span>
                                    </label>
                                ))}
                                {tabs.length === 0 && <p>No tabs found.</p>}
                            </div>
                        )}

                        <div className="modal-actions">
                            <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
                            <button type="submit" className="btn-save"><Save size={16} /> Save Permissions</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default PermissionsModal;
