import React, { useState, useEffect, useRef } from 'react';
import { useIPAM } from '../context/IPAMContext';
import {
  LogIn,
  Network,
  Lock,
  User,
  AlertCircle,
  CheckCircle2,
  X,
  Eye,
  EyeOff,
  ShieldCheck,
  Clock,
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  fullScreen?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, fullScreen = false }) => {
  const { login, inactivityMessage, clearInactivityMessage } = useIPAM();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const usernameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setUsername('');
      setPassword('');
      setError(null);
      setSuccessMsg(null);
      const timer = setTimeout(() => {
        usernameInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState) {
      setCapsLockActive(e.getModifierState('CapsLock'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await login(username, password);
      if (res.success) {
        setSuccessMsg(res.message);
        setUsername('');
        setPassword('');
        setTimeout(() => {
          onClose();
          setSuccessMsg(null);
        }, 400);
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const formContent = (
    <div className="w-full max-w-md bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl p-7 sm:p-9 shadow-2xl text-slate-100 relative">
      {/* Close Button only in modal mode */}
      {!fullScreen && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-black overflow-hidden flex items-center justify-center mx-auto shadow-lg shadow-black/50 mb-4 ring-1 ring-white/10 p-1">
          <img src="/icon.png" alt="IP Manager Logo" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">IP Manager</h1>
        <p className="text-xs text-slate-400 mt-1">
          Enterprise IPAM &amp; Subnet Access Management
        </p>
      </div>

      {/* Inactivity Session Expiration Banner */}
      {inactivityMessage && !error && !successMsg && (
        <div className="mb-6 p-3.5 rounded-xl bg-amber-950/80 border border-amber-800/90 text-amber-300 text-xs flex items-center gap-2.5 animate-in fade-in">
          <Clock className="w-4 h-4 shrink-0 text-amber-400" />
          <span className="leading-relaxed">{inactivityMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-3.5 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* Success Alert */}
      {successMsg && (
        <div className="mb-6 p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Username or Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <User className="w-4 h-4" />
            </div>
            <input
              ref={usernameInputRef}
              type="text"
              name="ipam_login_user"
              required
              autoComplete="off"
              value={username}
              onChange={(e) => {
                clearInactivityMessage();
                setUsername(e.target.value);
              }}
              placeholder="e.g. admin or netadmin"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              name="ipam_login_pass"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                clearInactivityMessage();
                setPassword(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyDown}
              placeholder="Enter your password"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {capsLockActive && (
            <p className="text-[11px] text-amber-400 mt-1.5 flex items-center gap-1">
              <span>Caps Lock is ON</span>
            </p>
          )}
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer active:scale-[0.99]"
          >
            <LogIn className="w-4 h-4" />
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
          </button>
        </div>
      </form>

      {/* Security footer badge */}
      <div className="mt-7 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-500">
        <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
        <span>Role-Based Access Control (RBAC) Enforced</span>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-blue-600 selection:text-white">
        {/* Background ambient lighting */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-blue-600/15 to-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full flex flex-col items-center">
          {formContent}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative z-10 animate-in fade-in zoom-in-95">
        {formContent}
      </div>
    </div>
  );
};
