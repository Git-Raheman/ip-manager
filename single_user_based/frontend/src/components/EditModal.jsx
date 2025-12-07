import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

/**
 * EditModal Component
 * Modal for editing IP record details.
 * 
 * Props:
 * - ip: object - The IP record to edit
 * - tabs: array - List of available tabs
 * - onClose: function - Close handler
 * - onSave: function - Save handler
 */
const EditModal = ({ ip, tabs, onClose, onSave }) => {
    const [form, setForm] = useState({
        ip: '',
        hostname: '',
        ports: '',
        status: 'Available',
        note: '',
        tab_id: '',
        subnet: '',
        cidr: ''
    });

    // Update form when 'ip' prop changes. 
    // This fixes the bug where modal might show stale data if reused.
    useEffect(() => {
        if (ip) {
            setForm({
                ip: ip.ip || '',
                hostname: ip.hostname || '',
                ports: ip.ports || '',
                status: ip.status || 'Available',
                note: ip.note || '',
                tab_id: ip.tab_id || '',
                subnet: ip.subnet || '',
                cidr: ip.cidr || ''
            });
        }
    }, [ip]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        await onSave(form);
    };

    if (!ip) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal edit-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Edit IP Record</h3>
                    <button onClick={onClose}><X size={24} /></button>
                </div>
                <div className="modal-body">
                    <form onSubmit={handleSubmit}>
                        <div className="edit-form-grid">
                            <div className="form-group">
                                <label>IP Address</label>
                                <input
                                    type="text"
                                    value={form.ip}
                                    onChange={e => setForm({ ...form, ip: e.target.value })}
                                    required
                                    className="modern-input"
                                />
                            </div>
                            <div className="form-group">
                                <label>Hostname</label>
                                <input
                                    type="text"
                                    value={form.hostname}
                                    onChange={e => setForm({ ...form, hostname: e.target.value })}
                                    className="modern-input"
                                />
                            </div>
                            <div className="form-group">
                                <label>Ports</label>
                                <input
                                    type="text"
                                    value={form.ports}
                                    onChange={e => setForm({ ...form, ports: e.target.value })}
                                    placeholder="e.g. 80, 443"
                                    className="modern-input"
                                />
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <select
                                    value={form.status}
                                    onChange={e => setForm({ ...form, status: e.target.value })}
                                    className="modern-select"
                                >
                                    <option value="Up">Up</option>
                                    <option value="Down">Down</option>
                                    <option value="Available">Available</option>
                                    <option value="Reserved">Reserved</option>
                                    <option value="Pending">Pending</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Subnet (Optional)</label>
                                <input
                                    type="text"
                                    value={form.subnet}
                                    onChange={e => setForm({ ...form, subnet: e.target.value })}
                                    placeholder="e.g. 255.255.255.0"
                                    className="modern-input"
                                />
                            </div>
                            <div className="form-group">
                                <label>CIDR (Optional)</label>
                                <input
                                    type="text"
                                    value={form.cidr}
                                    onChange={e => setForm({ ...form, cidr: e.target.value })}
                                    placeholder="e.g. /24"
                                    className="modern-input"
                                />
                            </div>
                            <div className="form-group">
                                <label>Tab</label>
                                <select
                                    value={form.tab_id}
                                    onChange={e => setForm({ ...form, tab_id: e.target.value })}
                                    className="modern-select"
                                >
                                    <option value="">Unassigned</option>
                                    {tabs && tabs.filter(t => t.id !== 'all').map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="form-group full-width">
                            <label>Notes</label>
                            <textarea
                                value={form.note}
                                onChange={e => setForm({ ...form, note: e.target.value })}
                                rows="3"
                                className="modern-textarea"
                            />
                        </div>
                        <div className="modal-actions">
                            <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
                            <button type="submit" className="btn-save"><Save size={16} /> Save Changes</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EditModal;
