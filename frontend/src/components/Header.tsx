import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { useNotifications } from '../contexts/NotificationContext';
import { Sun, Moon, Bell, AlertTriangle, ShieldAlert, Menu, ChevronDown, Inbox, CheckCheck } from 'lucide-react';

interface HeaderProps {
  title: string;
  onToggleSidebar?: () => void;
}

const AVAILABILITY_OPTIONS: { value: 'available' | 'busy' | 'away'; label: string; color: string }[] = [
  { value: 'available', label: 'Disponible', color: 'var(--success, #16a34a)' },
  { value: 'busy', label: 'Occupé', color: '#f59e0b' },
  { value: 'away', label: 'Absent', color: '#94a3b8' }
];

interface NotificationItem {
  id: string;
  type: 'broadcast' | 'system';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export const Header: React.FC<HeaderProps> = ({ title, onToggleSidebar }) => {
  const { user, clinic, maintenanceMessage, refreshProfile } = useAuth();
  const { showToast } = useNotifications();
  const [theme, setTheme] = useState<string>('light');
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [availabilityMenuOpen, setAvailabilityMenuOpen] = useState<boolean>(false);
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notificationsMenuOpen, setNotificationsMenuOpen] = useState<boolean>(false);

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

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const result = await api.get('/notifications');
        setNotifications(result.items);
        setUnreadCount(result.unreadCount);
      } catch (err) {
        console.error(err);
      }
    };
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

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

  const handleMarkRead = async (id: string) => {
    const wasUnread = !notifications.find(n => n.id === id)?.read;
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await api.post(`/notifications/${id}/read`, {});
    } catch (err) {
      console.error(err);
      // Roll back the optimistic update — otherwise the item shows as read
      // until the next 60s poll silently reverts it with no user feedback.
      if (wasUnread) {
        setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: false } : n)));
        setUnreadCount(prev => prev + 1);
      }
    }
  };

  const handleMarkAllRead = async () => {
    const ids = notifications.filter(n => !n.read).map(n => n.id);
    if (ids.length === 0) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await api.post('/notifications/read-all', { ids });
    } catch (err) {
      console.error(err);
      // Roll back — restore the previously-unread items and count so a
      // failed call doesn't silently mark everything read in the UI.
      const idSet = new Set(ids);
      setNotifications(prev => prev.map(n => (idSet.has(n.id) ? { ...n, read: false } : n)));
      setUnreadCount(ids.length);
    }
  };

  const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 3;
  const isExpired = clinic?.subscription_status === 'expired' || (daysRemaining !== null && daysRemaining <= 0);

  return (
    <>
    {/* Bandeau de maintenance piloté depuis Platform Admin > Config. système.
        Placé au-dessus du header (qui est sticky et de hauteur fixe) plutôt
        que dedans : un message peut faire jusqu'à 280 caractères, il ne tient
        pas dans les pastilles d'abonnement. Rendu en texte brut — jamais en
        HTML, la valeur vient d'un champ libre. */}
    {maintenanceMessage && (
      <div style={{
        backgroundColor: 'var(--warning-light, hsl(38 92% 92%))',
        color: 'var(--warning-dark, hsl(30 80% 25%))',
        padding: '8px 1.25rem',
        fontSize: '0.82rem',
        lineHeight: 1.4,
        textAlign: 'center',
        borderBottom: '1px solid var(--border)'
      }}>
        {maintenanceMessage}
      </div>
    )}
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
            onClick={() => setNotificationsMenuOpen(o => !o)}
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
            aria-label="Notifications"
          >
            <Bell size={18} />
          </button>
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--danger)'
            }} />
          )}

          {notificationsMenuOpen && (
            <>
              <div
                onClick={() => setNotificationsMenuOpen(false)}
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
                width: '320px',
                maxHeight: '400px',
                overflowY: 'auto',
                zIndex: 96
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--border)'
                }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600 }}
                    >
                      <CheckCheck size={13} /> Tout marquer comme lu
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Inbox size={22} style={{ marginBottom: '6px' }} />
                    <p style={{ fontSize: '0.8rem', margin: 0 }}>Aucune notification.</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <button
                      key={n.id}
                      onClick={() => handleMarkRead(n.id)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        border: 'none',
                        borderBottom: '1px solid var(--border)',
                        background: n.read ? 'none' : 'var(--bg-tertiary)',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        {n.type === 'system' ? <AlertTriangle size={13} color="var(--warning)" /> : <Bell size={13} color="var(--primary)" />}
                        <span style={{ fontSize: '0.8rem', fontWeight: n.read ? 500 : 700, color: 'var(--text-primary)' }}>{n.title}</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{n.body}</p>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
    </>
  );
};
