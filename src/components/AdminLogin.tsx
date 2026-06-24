import React, { useState } from 'react';
import { Shield, Lock, User, Eye, EyeOff, Map } from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess: () => void;
  onBackToClient: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onBackToClient }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Mock API call to simulate authentication
    setTimeout(() => {
      // Allow 'admin' / 'admin123' as default login credentials
      if (username.trim().toLowerCase() === 'admin' && password === 'admin123') {
        onLoginSuccess();
      } else {
        setError('Invalid username or password. Try admin / admin123');
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: '#0b0f19'
    }}>
      {/* Background Auras */}
      <div className="bg-aura bg-aura-primary"></div>
      <div className="bg-aura bg-aura-purple"></div>

      <div className="glass-panel animate-slide-up" style={{
        width: '100%',
        maxWidth: '440px',
        borderRadius: 'var(--border-radius-lg)',
        padding: '40px 30px',
        zIndex: 10,
        textAlign: 'center'
      }}>
        {/* App Logo */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, var(--color-primary) 0%, #a855f7 100%)',
          marginBottom: '20px',
          boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)'
        }}>
          <Shield size={32} color="#ffffff" />
        </div>

        <h2 style={{
          fontSize: '28px',
          fontWeight: 700,
          color: 'var(--text-main)',
          marginBottom: '8px'
        }}>
          Admin Portal
        </h2>
        <p style={{
          color: 'var(--text-muted)',
          fontSize: '15px',
          marginBottom: '32px'
        }}>
          Enter credentials to manage delivery zones
        </p>

        {error && (
          <div className="animate-fade-in" style={{
            backgroundColor: 'var(--color-danger-bg)',
            border: '1px solid var(--color-danger-border)',
            color: '#f87171',
            borderRadius: 'var(--border-radius-sm)',
            padding: '12px',
            fontSize: '14px',
            marginBottom: '20px',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Lock size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
            <label htmlFor="username" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-main)' }}>
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} color="var(--text-muted)" style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)'
              }} />
              <input
                id="username"
                type="text"
                className="glass-input"
                placeholder="Enter username (admin)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
                style={{ width: '100%', paddingLeft: '48px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
            <label htmlFor="password" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-main)' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="var(--text-muted)" style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)'
              }} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="glass-input"
                placeholder="Enter password (admin123)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                style={{ width: '100%', paddingLeft: '48px', paddingRight: '48px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={isLoading} style={{ width: '100%', marginTop: '8px' }}>
            {isLoading ? (
              <span className="loading-spinner"></span>
            ) : (
              'Access Dashboard'
            )}
          </button>
        </form>

        <button
          onClick={onBackToClient}
          className="btn-secondary"
          style={{
            width: '100%',
            marginTop: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Map size={18} />
          Back to Delivery Checker
        </button>
      </div>
    </div>
  );
};
