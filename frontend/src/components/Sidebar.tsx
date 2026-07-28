import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Pill,
  FlaskConical,
  FileText,
  Receipt,
  ShieldCheck,
  Settings as SettingsIcon,
  LogOut,
  X,
  Building2
} from 'lucide-react';

// Client-side hint only — the real access boundary is the backend's
// SUPER_ADMIN_EMAILS allowlist (superAdminOnly middleware). Hiding this entry
// for everyone else is UX, not security.
const PLATFORM_ADMIN_EMAILS = ['blog.ousmane@gmail.com'];

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, isOpen, onClose }) => {
  const { user, clinic, logout } = useAuth();
  const { isOnline } = useOffline();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);

  if (!user) return null;

  const menuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['admin', 'doctor', 'secretary', 'pharmacist', 'lab_tech', 'manager', 'nurse'] },
    { id: 'patients', label: 'Patients', icon: Users, roles: ['admin', 'doctor', 'secretary', 'pharmacist', 'lab_tech', 'manager', 'nurse'] },
    { id: 'appointments', label: 'Rendez-vous', icon: Calendar, roles: ['admin', 'doctor', 'secretary', 'manager', 'nurse'] },
    { id: 'prescriptions', label: 'Ordonnances', icon: FileText, roles: ['admin', 'doctor', 'pharmacist', 'manager'] },
    { id: 'laboratory', label: 'Laboratoire', icon: FlaskConical, roles: ['admin', 'lab_tech', 'manager'] },
    { id: 'pharmacy', label: 'Pharmacie', icon: Pill, roles: ['admin', 'pharmacist', 'manager'] },
    { id: 'accounting', label: 'Comptabilité', icon: Receipt, roles: ['admin', 'secretary', 'manager'] },
    { id: 'deposits', label: 'Dépôts de garantie', icon: ShieldCheck, roles: ['admin', 'secretary', 'manager'] },
    { id: 'settings', label: 'Paramètres', icon: SettingsIcon, roles: ['admin', 'manager'] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user.role));
  if (PLATFORM_ADMIN_EMAILS.includes(user.email)) {
    filteredItems.push({ id: 'platform-admin', label: 'Administration plateforme', icon: Building2, roles: [] });
  }

  const roleLabels: Record<string, string> = {
    admin: 'Administrateur',
    doctor: 'Médecin',
    secretary: 'Secrétaire',
    pharmacist: 'Pharmacien',
    lab_tech: 'Laborantin',
    manager: 'Gestionnaire',
    nurse: 'Infirmier(ère)'
  };

  const formattedClinicName = (clinic?.name || 'Ma Clinique').toUpperCase();
  const formattedClinicAddress = (clinic?.address || 'Abidjan, CI').toUpperCase();

  return (
    <>
      {/* Mobile Backdrop */}
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
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 99
          }}
        />
      )}

      <aside 
        className={`sidebar ${isOpen ? 'open' : ''}`}
        style={{
          width: 'var(--sidebar-width, 240px)',
          height: '100vh',
          backgroundColor: '#162a26',
          color: '#9bb0a9',
          position: 'fixed',
          left: 0,
          top: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid rgba(255, 255, 255, 0.05)',
          zIndex: 100,
          boxSizing: 'border-box',
          boxShadow: '4px 0 24px rgba(0,0,0,0.3)',
          overflow: 'hidden'
        }}
      >
        <div style={{ flexShrink: 0 }}>
          {/* Top Brand Header */}
          <div style={{
            padding: '1.25rem 1.25rem 0.75rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div
              role="button"
              tabIndex={0}
              onClick={onClose}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); } }}
              title="Fermer le menu"
              style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
            >
              <img src="/logo-icon.svg" alt="MediClinic" width={34} height={34} style={{ display: 'block', flexShrink: 0 }} />
              <span style={{
                fontWeight: 700,
                fontSize: '1.25rem',
                color: '#ffffff',
                fontFamily: 'var(--font-secondary, "Plus Jakarta Sans", sans-serif)',
                letterSpacing: '-0.02em'
              }}>
                MediClinic
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Green online ring indicator */}
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                border: '2px solid #10b981',
                backgroundColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              </div>

              {/* Mobile Close Button */}
              <button
                onClick={onClose}
                className="sidebar-close-btn"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9bb0a9',
                  display: 'none',
                  padding: '4px'
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Clinic Section Subheader */}
          <div style={{
            padding: '0.75rem 1.25rem 1rem 1.25rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.07)'
          }}>
            <div style={{
              fontSize: '0.85rem',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '0.04em',
              textTransform: 'uppercase'
            }}>
              {formattedClinicName}
            </div>
            <div style={{
              fontSize: '0.725rem',
              fontWeight: 500,
              color: '#6b8078',
              marginTop: '2px',
              letterSpacing: '0.03em',
              textTransform: 'uppercase'
            }}>
              {formattedClinicAddress}
            </div>
          </div>
        </div>

        {/* Navigation Items — its own scroll area, independent of the
            fixed header above and the footer below, so a taller menu
            (e.g. the extra "Administration plateforme" entry) never pushes
            the profile/logout footer off-screen with no way to reach it */}
        <nav style={{
          padding: '1.25rem 0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto'
        }}>
            {filteredItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '11px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: isActive ? '#1c4436' : 'transparent',
                    color: isActive ? '#ffffff' : '#9bb0a9',
                    textAlign: 'left',
                    width: '100%',
                    cursor: 'pointer',
                    fontSize: '0.925rem',
                    fontWeight: isActive ? 700 : 500,
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = '#ffffff';
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = '#9bb0a9';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {/* Show icon when item is active or settings */}
                  {isActive && <Icon size={18} color="#ffffff" />}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

        {/* User Profile Footer — always pinned below the scrollable nav, never pushed off-screen */}
        <div style={{
          flexShrink: 0,
          padding: '1rem 1.25rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => { setCurrentTab('profile'); onClose(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCurrentTab('profile'); onClose(); } }}
            title="Mon profil"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1, cursor: 'pointer' }}
          >
            {/* Avatar Circle */}
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#1f3a33',
              border: '1.5px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.875rem',
              flexShrink: 0
            }}>
              {user.name.charAt(0).toUpperCase()}
            </div>

            {/* Name and Role */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: '0.85rem',
                fontWeight: 800,
                color: '#ffffff',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {user.name.toUpperCase()}
              </div>
              <div style={{
                fontSize: '0.725rem',
                color: '#6b8078',
                marginTop: '1px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {roleLabels[user.role] || user.role}
              </div>
            </div>
          </div>

          {/* Logout Icon */}
          <button
            onClick={() => setShowLogoutConfirm(true)}
            title="Se déconnecter"
            style={{
              background: 'none',
              border: 'none',
              color: '#6b8078',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              flexShrink: 0
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#6b8078'}
          >
            <LogOut size={16} />
          </button>
        </div>

      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="modal-backdrop" onClick={() => setShowLogoutConfirm(false)}>
          <div className="modal-content" style={{ maxWidth: '380px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Se déconnecter</h3>
              <button onClick={() => setShowLogoutConfirm(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                Voulez-vous vous déconnecter ?
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowLogoutConfirm(false)} className="btn btn-secondary">Annuler</button>
              <button
                onClick={() => { setShowLogoutConfirm(false); logout(); }}
                className="btn btn-primary"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
