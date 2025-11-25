import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';

const ChangePasswordModal = ({ isOpen, onClose, onSave, title }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError("Passwords don't match");
            return;
        }
        onSave({ newPassword });
        setNewPassword('');
        setConfirmPassword('');
        setError('');
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{title || 'Change Password'}</h3>
                    <button onClick={onClose}><X size={24} /></button>
                </div>
                <div className="modal-body">
                    {error && (
                        <div className="error-msg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>
                        <div className="form-group">
                            <label>Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>
                        <div className="modal-actions">
                            <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
                            <button type="submit" className="btn-save"><Save size={16} /> Update Password</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChangePasswordModal;
