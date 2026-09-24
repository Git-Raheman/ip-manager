import React, { useState, useEffect, useRef } from 'react';
import { useIPAM } from '../context/IPAMContext';
import { useTheme } from '../context/ThemeContext';
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
  Sun,
  Moon,
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  fullScreen?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, fullScreen = false }) => {
  const { login, inactivityMessage, clearInactivityMessage } = useIPAM();
  const { theme, toggleTheme } = useTheme();

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
    console.log('[LoginModal] handleSubmit triggered with:', { username, hasPass: !!password });
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
    <div className="w-full max-w-md bg-white/95 dark:bg-[#0c0c0c]/95 backdrop-blur-2xl border border-slate-200/90 dark:border-[#262626] rounded-3xl p-7 sm:p-9 shadow-2xl dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)] text-[#171717] dark:text-[#ededed] relative transition-colors duration-200 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
      {/* Top Controls: Theme Toggle & Close Button */}
      <div className="absolute top-5 right-5 flex items-center gap-1.5 z-20">
        <button
          id="btn-login-theme-toggle"
          type="button"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          aria-label="Toggle Theme"
          className="p-2 rounded-xl border border-slate-200 dark:border-[#262626] bg-slate-50 dark:bg-[#141414] text-slate-700 dark:text-[#ededed] hover:bg-slate-100 dark:hover:bg-[#1c1c1c] transition-all cursor-pointer shadow-xs active:scale-95"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {!fullScreen && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border border-slate-200 dark:border-[#262626] bg-slate-50 dark:bg-[#141414] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1c1c1c] transition-colors cursor-pointer active:scale-95"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-[#000000] border border-slate-200 dark:border-[#262626] overflow-hidden flex items-center justify-center mx-auto shadow-lg shadow-black/20 dark:shadow-black/60 mb-4 ring-1 ring-black/5 dark:ring-white/10 p-2">
          <img src="/icon.png" alt="IP Manager Logo" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">IP Manager</h1>
        <p className="text-xs text-slate-500 dark:text-[#888888] mt-1 font-medium">
          Enterprise IPAM &amp; Subnet Access Management
        </p>
      </div>

      {/* Inactivity Session Expiration Banner */}
      {inactivityMessage && !error && !successMsg && (
        <div className="mb-6 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2.5 animate-in fade-in">
          <Clock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="leading-relaxed">{inactivityMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* Success Alert */}
      {successMsg && (
        <div className="mb-6 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Login Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(e);
        }}
        action="javascript:void(0);"
        className="space-y-4"
        autoComplete="off"
      >
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-[#a1a1a1] mb-1.5">
            Username or Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-[#666666]">
              <User className="w-4 h-4" />
            </div>
            <input
              ref={usernameInputRef}
              id="login-username-input"
              type="text"
              name="ipam_login_user"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => {
                clearInactivityMessage();
                setUsername(e.target.value);
              }}
              onKeyDown={(e) => {
                handleKeyDown(e);
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit(e as any);
                }
              }}
              placeholder="admin or user@network.local"
              className="w-full bg-slate-50 dark:bg-[#141414] border border-slate-300/80 dark:border-[#262626] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 dark:text-[#ededed] placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-[#0070f3] dark:focus:border-[#0070f3] focus:ring-1 focus:ring-[#0070f3] transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-[#a1a1a1] mb-1.5">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-[#666666]">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="login-password-input"
              type={showPassword ? 'text' : 'password'}
              name="ipam_login_pass"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                clearInactivityMessage();
                setPassword(e.target.value);
              }}
              onKeyDown={(e) => {
                handleKeyDown(e);
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit(e as any);
                }
              }}
              onKeyUp={handleKeyDown}
              placeholder="Enter your password"
              className="w-full bg-slate-50 dark:bg-[#141414] border border-slate-300/80 dark:border-[#262626] rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 dark:text-[#ededed] placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-[#0070f3] dark:focus:border-[#0070f3] focus:ring-1 focus:ring-[#0070f3] transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 dark:text-[#666666] dark:hover:text-[#a1a1a1] transition-colors cursor-pointer"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {capsLockActive && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
              <span>Caps Lock is ON</span>
            </p>
          )}
        </div>

        <div className="pt-2">
          <button
            id="btn-login-submit"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleSubmit(e as any);
            }}
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 dark:from-blue-600 dark:to-cyan-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/25 dark:shadow-blue-900/40 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer active:scale-[0.99]"
          >
            <LogIn className="w-4 h-4" />
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
          </button>
        </div>
      </form>

      {/* Security footer badge */}
      <div className="mt-7 pt-4 border-t border-slate-200/80 dark:border-[#222222] flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-[#888888]">
        <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        <span>Role-Based Access Control (RBAC) Enforced</span>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#000000] text-[#171717] dark:text-[#ededed] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-[#0070f3] selection:text-white transition-colors duration-200">
        {/* Subtle background grid pattern matching app aesthetic */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

        {/* Ambient glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-blue-600/10 to-cyan-500/10 dark:from-blue-600/15 dark:to-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] bg-cyan-600/5 dark:bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-[400px] h-[400px] bg-blue-600/5 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full flex flex-col items-center">
          {formContent}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative z-10 animate-in fade-in zoom-in-95">
        {formContent}
      </div>
    </div>
  );
};
