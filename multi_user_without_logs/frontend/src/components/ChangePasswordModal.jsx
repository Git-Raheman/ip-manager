import React, { useState } from 'react';
import { X, Save } from 'lucide-react';

/**
 * ChangePasswordModal Component
 * Handles user password updates with validation.
 * 
 * Props:
 * - isOpen: boolean - Visibility state
 * - onClose: function - Handler to close modal
 * - onSave: function - Handler to save password ({ oldPassword, newPassword })
 * - title: string - Modal title
 * - requireOldPassword: boolean - Whether to ask for old password
 */
const ChangePasswordModal = ({ isOpen, onClose, onSave, title, requireOldPassword }) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    /**
     * Handles form submission.
     * Validates password match and length before calling onSave.
     */
    const handleSubmit = (e) => {
        e.preventDefault();

        // Reset error
        setError('');

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        // Pass data back to parent
        onSave({ oldPassword, newPassword });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{title || 'Change Password'}</h3>
                    <button onClick={onClose}><X size={24} /></button>
                </div>
                <div className="modal-body">
                    {error && <div className="error-msg">{error}</div>}
                    <form onSubmit={handleSubmit}>
                        {requireOldPassword && (
                            <div className="form-group">
                                <label>Old Password</label>
                                <input
                                    type="password"
                                    value={oldPassword}
                                    onChange={e => setOldPassword(e.target.value)}
                                    required
                                    className="modern-input"
                                />
                            </div>
                        )}
                        <div className="form-group">
                            <label>New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                required
                                className="modern-input"
                            />
                        </div>
                        <div className="form-group">
                            <label>Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                                className="modern-input"
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
