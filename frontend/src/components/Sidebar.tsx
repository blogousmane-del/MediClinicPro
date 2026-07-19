import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Pill, 
  FlaskConical, 
  CreditCard, 
  Settings as SettingsIcon, 
  LogOut,
  Wifi,
  WifiOff,
  X
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, isOpen, onClose }) => {
  const { user, clinic, logout } = useAuth();
  const { isOnline } = useOffline();

  if (!user) return null;

  // Filter tabs by role
  const menuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['admin', 'doctor', 'secretary', 'pharmacist', 'lab_tech', 'manager'] },
    { id: 'appointments', label: 'Rendez-vous', icon: Calendar, roles: ['admin', 'doctor', 'secretary', 'manager'] },
    { id: 'patients', label: 'Patients', icon: Users, roles: ['admin', 'doctor', 'secretary', 'pharmacist', 'lab_tech', 'manager'] },
    { id: 'pharmacy', label: 'Pharmacie', icon: Pill, roles: ['admin', 'pharmacist', 'manager'] },
    { id: 'laboratory', label: 'Laboratoire', icon: FlaskConical, roles: ['admin', 'lab_tech', 'manager'] },
    { id: 'accounting', label: 'Comptabilité', icon: CreditCard, roles: ['admin', 'secretary', 'manager'] },
    { id: 'settings', label: 'Paramètres', icon: SettingsIcon, roles: ['admin', 'manager'] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user.role));

  const roleLabels: Record<string, string> = {
    admin: 'Administrateur',
    doctor: 'Médecin',
    secretary: 'Secrétaire',
    pharmacist: 'Pharmacien',
    lab_tech: 'Laborantin',
    manager: 'Gestionnaire'
  };

  return (
    <>
      {/* Backdrop overlay for mobile screens */}
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(3px)',
            zIndex: 99
          }}
        />
      )}
      <aside 
        className={`sidebar ${isOpen ? 'open' : ''}`}
        style={{
          width: 'var(--sidebar-width)',
          height: '100vh',
          backgroundColor: 'rgba(12, 18, 30, 0.95)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          color: '#94a3b8',
          position: 'fixed',
          left: 0,
          top: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
          zIndex: 100,
          boxShadow: '8px 0 32px rgba(0,0,0,0.25)'
        }}
      >
        {/* Brand Header */}
        <div style={{
          height: 'var(--header-height)',
          padding: '0 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          backgroundColor: 'rgba(9, 13, 22, 0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: '1.25rem',
              boxShadow: '0 0 12px rgba(13, 148, 136, 0.4)'
            }}>M</div>
            <span style={{
              fontWeight: 700,
              fontSize: '1.2rem',
              color: 'white',
              fontFamily: 'var(--font-secondary)',
              letterSpacing: '0.75px',
              background: 'linear-gradient(135deg, #ffffff, #94a3b8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>MediClinic</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Offline Badge indicator */}
            <div title={isOnline ? "En ligne" : "Hors ligne (mode déconnecté)"} style={{ display: 'flex', alignItems: 'center' }}>
              {isOnline ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }} />
                  <span style={{ position: 'absolute', width: '14px', height: '14px', borderRadius: '50%', border: '2px solid var(--success)', animation: 'ping 1.5s infinite', opacity: 0.5 }} />
                </div>
              ) : (
                <WifiOff size={16} color="var(--danger)" />
              )}
            </div>
            
            {/* Mobile Close Button */}
            <button
              onClick={onClose}
              className="sidebar-close-btn"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

      {/* Clinic title info */}
      <div style={{
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        backgroundColor: 'rgba(12, 18, 30, 0.2)'
      }}>
        <div style={{
          fontSize: '0.9rem',
          fontWeight: 600,
          color: 'white',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>{clinic?.name || 'Ma Clinique'}</div>
        <div style={{
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          marginTop: '4px'
        }}>{clinic?.address || 'Abidjan, CI'}</div>
      </div>

      {/* Navigation list */}
      <nav style={{
        flexGrow: 1,
        padding: '1.5rem 0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        overflowY: 'auto'
      }}>
        {filteredItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                paddingLeft: isActive ? '11px' : '14px',
                borderRadius: '12px',
                border: 'none',
                borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                background: isActive ? 'rgba(13, 148, 136, 0.12)' : 'transparent',
                color: isActive ? 'white' : '#94a3b8',
                textAlign: 'left',
                width: '100%',
                cursor: 'pointer',
                transition: 'var(--transition)',
                fontWeight: isActive ? 600 : 500
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = 'white';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = '#94a3b8';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Icon size={20} color={isActive ? 'var(--primary)' : 'inherit'} />
              <span style={{ fontSize: '0.9375rem' }}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User profile footer */}
      <div style={{
        padding: '1.25rem 1rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        backgroundColor: 'rgba(9, 13, 22, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 600,
            fontSize: '0.95rem'
          }}>
            {user.name.charAt(0)}
          </div>
          <div style={{ flexGrow: 1, overflow: 'hidden' }}>
            <div style={{
              fontSize: '0.9rem',
              fontWeight: 600,
              color: 'white',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden'
            }}>{user.name}</div>
            <div style={{
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              marginTop: '1px'
            }}>{roleLabels[user.role]}</div>
          </div>
        </div>

        <button
          onClick={logout}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            background: 'rgba(239, 68, 68, 0.05)',
            color: '#ff5a5a',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.85rem',
            width: '100%',
            transition: 'var(--transition)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <LogOut size={16} />
          Se déconnecter
        </button>
      </div>
    </aside>
  </>
);
};
