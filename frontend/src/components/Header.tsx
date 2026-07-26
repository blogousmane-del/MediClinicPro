import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useNotifications } from '../contexts/NotificationContext';
import { Sun, Moon, Bell, AlertTriangle, ShieldAlert, Menu, ChevronDown } from 'lucide-react';

interface HeaderProps {
  title: string;
  onToggleSidebar?: () => void;
}

const AVAILABILITY_OPTIONS: { value: 'available' | 'busy' | 'away'; label: string; color: string }[] = [
  { value: 'available', label: 'Disponible', color: 'var(--success, #16a34a)' },
  { value: 'busy', label: 'Occupé', color: '#f59e0b' },
  { value: 'away', label: 'Absent', color: '#94a3b8' }
];

export const Header: React.FC<HeaderProps> = ({ title, onToggleSidebar }) => {
  const { user, clinic, refreshProfile } = useAuth();
  const { showToast } = useNotifications();
  const [theme, setTheme] = useState<string>('light');
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [availabilityMenuOpen, setAvailabilityMenuOpen] = useState<boolean>(false);
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState<boolean>(false);

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

  const handleAvailabilityChange = async (status: 'available' | 'busy' | 'away') => {
    setAvailabilityMenuOpen(false);
    if (status === user?.availabilityStatus) return;
    setIsUpdatingAvailability(true);
    try {
      await api.put('/settings/availability', { status });
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', err.error || 'Impossible de mettre à jour votre statut de disponibilité.');
    } finally {
      setIsUpdatingAvailability(false);
    }
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

        {/* Doctor/Nurse Availability Status */}
        {(user?.role === 'doctor' || user?.role === 'nurse') && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setAvailabilityMenuOpen(o => !o)}
              disabled={isUpdatingAvailability}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: '1px solid var(--border)',
                padding: '6px 10px',
                borderRadius: '8px',
                cursor: isUpdatingAvailability ? 'default' : 'pointer',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              <span style={{
                width: '9px',
                height: '9px',
                borderRadius: '50%',
                backgroundColor: AVAILABILITY_OPTIONS.find(o => o.value === (user.availabilityStatus || 'available'))?.color,
                flexShrink: 0
              }} />
              <span className="header-availability-label">
                {AVAILABILITY_OPTIONS.find(o => o.value === (user.availabilityStatus || 'available'))?.label}
              </span>
              <ChevronDown size={14} />
            </button>

            {availabilityMenuOpen && (
              <>
                <div
                  onClick={() => setAvailabilityMenuOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 95 }}
                />
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  boxShadow: 'var(--shadow-md)',
                  minWidth: '160px',
                  zIndex: 96,
                  overflow: 'hidden'
                }}>
                  {AVAILABILITY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => handleAvailabilityChange(opt.value)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '9px 12px',
                        background: opt.value === (user.availabilityStatus || 'available') ? 'var(--bg-tertiary)' : 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                        fontSize: '0.825rem',
                        fontWeight: 600,
                        textAlign: 'left'
                      }}
                    >
                      <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: opt.color, flexShrink: 0 }} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
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
