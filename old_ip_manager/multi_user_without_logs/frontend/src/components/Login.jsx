import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Shield, AlertCircle, Users, Lock } from 'lucide-react';

const Login = () => {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [capsLock, setCapsLock] = useState(false);

    const checkCapsLock = (e) => {
        if (e.getModifierState("CapsLock")) {
            setCapsLock(true);
        } else {
            setCapsLock(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (res.ok) {
                login(data.token, { username: data.username, role: data.role, allowed_tabs: data.allowed_tabs, id: data.id });
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Login failed');
        }
    };

    return (
        <div className="login-container">
            <div className="animated-bg">
                <motion.div
                    className="bg-shape shape-1"
                    animate={{
                        rotate: 360,
                        scale: [1, 1.2, 1],
                        x: [0, 50, 0],
                        y: [0, 30, 0]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                />
                <motion.div
                    className="bg-shape shape-2"
                    animate={{
                        rotate: -360,
                        scale: [1, 1.5, 1],
                        x: [0, -30, 0],
                        y: [0, 50, 0]
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                />
            </div>

            <motion.div
                className="card login-card glass-effect"
                initial={{ opacity: 0, y: 30, rotateX: 10 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 0.8, type: "spring" }}
            >
                <div className="login-header">
                    <div className="logo-icon">
                        <Shield size={40} color="#3b82f6" />
                    </div>
                    <h2>Welcome Back</h2>
                    <p>Sign in to IP Manager</p>
                </div>

                {error && (
                    <motion.div
                        className="error-msg"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <AlertCircle size={16} /> {error}
                    </motion.div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <div className="input-icon"><Users size={18} /></div>
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            className="modern-input"
                        />
                    </div>
                    <div className="input-group">
                        <div className="input-icon"><Lock size={18} /></div>
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            onKeyUp={checkCapsLock}
                            className="modern-input"
                        />
                    </div>

                    {capsLock && (
                        <motion.div
                            className="caps-warning"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                        >
                            <AlertCircle size={14} /> Caps Lock is ON
                        </motion.div>
                    )}

                    <motion.button
                        type="submit"
                        className="btn-login"
                        whileHover={{ scale: 1.05, boxShadow: "0px 0px 15px rgba(59, 130, 246, 0.5)" }}
                        whileTap={{ scale: 0.95 }}
                    >
                        Log In
                    </motion.button>
                </form>
            </motion.div>
        </div>
    );
};

export default Login;
