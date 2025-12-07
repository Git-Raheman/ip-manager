import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';

/**
 * TabModal Component
 * Modal to create a new tab for organizing IPs.
 */
const TabModal = ({ isOpen, onClose, onSave }) => {
    const [name, setName] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(name);
        setName('');
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Add New Tab</h3>
                    <button onClick={onClose}><X size={24} /></button>
                </div>
                <div className="modal-body">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Tab Name</label>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                                autoFocus
                                className="modern-input"
                            />
                        </div>
                        <div className="modal-actions">
                            <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
                            <button type="submit" className="btn-save"><Plus size={16} /> Create Tab</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default TabModal;
