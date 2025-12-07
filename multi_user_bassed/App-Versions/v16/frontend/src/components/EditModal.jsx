import React, { useState } from 'react';
import { Save } from 'lucide-react';

const EditModal = ({ ip, tabs, onClose, onSave }) => {
    const [form, setForm] = useState({
        ip: ip.ip,
        hostname: ip.hostname || '',
        ports: ip.ports || '',
        status: ip.status || 'Available',
        note: ip.note || '',
        tab_id: ip.tab_id || '',
        subnet: ip.subnet || '',
        cidr: ip.cidr || ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(form);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Edit IP: {ip.ip}</h3>
                    <button onClick={onClose} className="btn-close">×</button>
                </div>
                <div className="modal-body">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Hostname</label>
                            <input
                                type="text"
                                value={form.hostname}
                                onChange={e => setForm({ ...form, hostname: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label>Ports (comma separated)</label>
                            <input
                                type="text"
                                value={form.ports}
                                onChange={e => setForm({ ...form, ports: e.target.value })}
                                placeholder="80, 443, 22"
                            />
                        </div>
                        <div className="form-group">
                            <label>Status</label>
                            <select
                                value={form.status}
                                onChange={e => setForm({ ...form, status: e.target.value })}
                            >
                                <option value="Available">Available</option>
                                <option value="Active">Active</option>
                                <option value="Reserved">Reserved</option>
                                <option value="Pending">Pending</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Notes</label>
                            <textarea
                                value={form.note}
                                onChange={e => setForm({ ...form, note: e.target.value })}
                                rows="3"
                            />
                        </div>
                        <div className="form-group">
                            <label>Subnet (Optional)</label>
                            <input
                                type="text"
                                value={form.subnet}
                                onChange={e => setForm({ ...form, subnet: e.target.value })}
                                placeholder="e.g. 255.255.255.0"
                            />
                        </div>
                        <div className="form-group">
                            <label>CIDR (Optional)</label>
                            <input
                                type="text"
                                value={form.cidr}
                                onChange={e => setForm({ ...form, cidr: e.target.value })}
                                placeholder="e.g. /24"
                            />
                        </div>
                        <div className="form-group">
                            <label>Tab</label>
                            <select
                                value={form.tab_id}
                                onChange={e => setForm({ ...form, tab_id: e.target.value })}
                            >
                                <option value="">Unassigned</option>
                                {tabs.filter(t => t.id !== 'all').map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
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
