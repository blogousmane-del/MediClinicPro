import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sun, Moon, Bell, AlertTriangle, ShieldAlert, Menu } from 'lucide-react';

interface HeaderProps {
  title: string;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, onToggleSidebar }) => {
  const { clinic } = useAuth();
  const [theme, setTheme] = useState<string>('light');
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    // Theme setup
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Calculate subscription remaining days
    if (clinic && clinic.subscription_expires_at) {
      const expires = new Date(clinic.subscription_expires_at);
      const today = new Date();
      const diffTime = expires.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setDaysRemaining(diffDays);
    }
  }, [clinic]);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 3;
  const isExpired = clinic?.subscription_status === 'expired' || (daysRemaining !== null && daysRemaining <= 0);

  return (
    <header className="app-header" style={{
      height: 'var(--header-height)',
      backgroundColor: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      padding: '0 1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 90,
      boxShadow: 'var(--shadow-sm)',
      transition: 'background-color 0.3s ease, border-color 0.3s ease',
      width: '100%',
      maxWidth: '100vw',
      boxSizing: 'border-box'
    }}>
      {/* Left side title and menu button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1, marginRight: '10px' }}>
        <button
          onClick={onToggleSidebar}
          className="sidebar-toggle-btn"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            display: 'none', // Overridden in media query in index.css
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px',
            flexShrink: 0
          }}
          aria-label="Menu principal"
        >
          <Menu size={22} />
        </button>
        <h1 
          className="truncate-text" 
          style={{
            fontSize: '1.15rem',
            fontWeight: 600,
            textTransform: 'capitalize',
            fontFamily: 'var(--font-secondary)',
            margin: 0
          }}
          title={title}
        >
          {title}
        </h1>
      </div>

      {/* Right side controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
        
        {/* Subscription Warn Banners */}
        {isExpired && (
          <div className="header-sub-banner" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--danger-light)',
            color: 'var(--danger)',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 600
          }}>
            <ShieldAlert size={16} />
            <span style={{ whiteSpace: 'nowrap' }}>Abonnement Expiré</span>
          </div>
        )}

        {isExpiringSoon && (
          <div className="header-sub-banner" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--warning-light)',
            color: 'var(--warning)',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 600
          }}>
            <AlertTriangle size={16} />
            <span style={{ whiteSpace: 'nowrap' }}>{daysRemaining} j. restants</span>
          </div>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            padding: '7px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            transition: 'var(--transition)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          title={theme === 'light' ? 'Mode sombre' : 'Mode clair'}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* Notification Bell */}
        <div style={{ position: 'relative' }}>
          <button
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              padding: '7px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)'
            }}
          >
            <Bell size={18} />
          </button>
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'var(--danger)'
          }} />
        </div>
      </div>
    </header>
  );
};
