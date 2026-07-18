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
  WifiOff
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab }) => {
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
    <aside style={{
      width: 'var(--sidebar-width)',
      height: '100vh',
      backgroundColor: 'var(--secondary)',
      color: '#94a3b8',
      position: 'fixed',
      left: 0,
      top: 0,
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid var(--border)',
      zIndex: 100,
      boxShadow: '4px 0 10px rgba(0,0,0,0.1)'
    }}>
      {/* Brand Header */}
      <div style={{
        height: 'var(--header-height)',
        padding: '0 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        backgroundColor: '#090d16'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            backgroundColor: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '1.2rem'
          }}>M</div>
          <span style={{
            fontWeight: 700,
            fontSize: '1.15rem',
            color: 'white',
            fontFamily: 'var(--font-secondary)',
            letterSpacing: '0.5px'
          }}>MediClinic</span>
        </div>
        
        {/* Offline Badge indicator */}
        <div title={isOnline ? "En ligne" : "Hors ligne (mode déconnecté)"}>
          {isOnline ? (
            <Wifi size={16} color="var(--success)" />
          ) : (
            <WifiOff size={16} color="var(--danger)" />
          )}
        </div>
      </div>

      {/* Clinic title info */}
      <div style={{
        padding: '1rem 1.5rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        backgroundColor: '#0c121e'
      }}>
        <div style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'white',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>{clinic?.name || 'Ma Clinique'}</div>
        <div style={{
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          marginTop: '2px'
        }}>{clinic?.address || 'Abidjan, CI'}</div>
      </div>

      {/* Navigation list */}
      <nav style={{
        flexGrow: 1,
        padding: '1.5rem 0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
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
                padding: '10px 14px',
                borderRadius: '8px',
                border: 'none',
                background: isActive ? 'var(--primary-light)' : 'transparent',
                color: isActive ? 'white' : '#94a3b8',
                textAlign: 'left',
                width: '100%',
                cursor: 'pointer',
                transition: 'var(--transition)',
                fontWeight: isActive ? 600 : 400
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = '#94a3b8';
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
        padding: '1rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        backgroundColor: '#090d16',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 600,
            fontSize: '0.9rem'
          }}>
            {user.name.charAt(0)}
          </div>
          <div style={{ flexGrow: 1, overflow: 'hidden' }}>
            <div style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'white',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden'
            }}>{user.name}</div>
            <div style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)'
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
            padding: '8px',
            borderRadius: '6px',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            background: 'rgba(239, 68, 68, 0.05)',
            color: '#ef4444',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '0.85rem',
            width: '100%',
            transition: 'var(--transition)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
          }}
        >
          <LogOut size={16} />
          Se déconnecter
        </button>
      </div>
    </aside>
  );
};
