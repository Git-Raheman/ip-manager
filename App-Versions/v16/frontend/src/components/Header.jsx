import React from 'react';
import { Server, Users, Activity, FileText, Save, Shield, LogOut, Sun, Moon } from 'lucide-react';

const Header = ({ user, logout, view, setView, setShowBackupModal, setShowMyAccount, theme, toggleTheme }) => {
    return (
        <header>
            <div className="header-top">
                <h1><Server size={32} /> IP Manager</h1>
                <div className="user-controls">
                    <button onClick={toggleTheme} className="btn-theme-toggle" title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}>
                        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                    <span>{user.username} ({user.role})</span>
                    {user.role === 'admin' && (
                        <>
                            {user.username === 'admin' && (
                                <>
                                    <button onClick={() => setView(view === 'users' ? 'ips' : 'users')} className={view === 'users' ? 'active' : ''}>
                                        <Users size={16} /> Users
                                    </button>
                                    <button onClick={() => setView(view === 'monitor' ? 'ips' : 'monitor')} className={view === 'monitor' ? 'active' : ''}>
                                        <Activity size={16} /> Monitor
                                    </button>
                                    <button onClick={() => setView(view === 'logs' ? 'ips' : 'logs')} className={view === 'logs' ? 'active' : ''}>
                                        <FileText size={16} /> Logs
                                    </button>
                                </>
                            )}
                            <button onClick={() => setShowBackupModal(true)} className="btn-backup">
                                <Save size={16} /> Backup
                            </button>
                        </>
                    )}
                    <button onClick={() => setShowMyAccount(true)} className="btn-account">
                        <Shield size={16} /> Account
                    </button>
                    <button onClick={logout} className="btn-logout"><LogOut size={16} /> Logout</button>
                </div>
            </div>
        </header>
    );
};

export default Header;
