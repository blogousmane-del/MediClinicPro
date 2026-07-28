import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { PasswordChangeForm } from '../../components/PasswordChangeForm';

const roleLabels: Record<string, string> = {
  admin: 'Administrateur',
  doctor: 'Médecin',
  secretary: 'Secrétaire',
  pharmacist: 'Pharmacien',
  lab_tech: 'Laborantin',
  manager: 'Gestionnaire',
  nurse: 'Infirmier(ère)'
};

export const ProfilePage: React.FC = () => {
  const { user, clinic } = useAuth();

  if (!user) return null;

  return (
    <div className="app-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '480px' }}>
      <div>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, fontFamily: 'var(--font-secondary)', color: 'var(--text-primary)', margin: 0 }}>
          Mon profil
        </h1>
      </div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '1.25rem' }}>
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          backgroundColor: '#1f3a33',
          border: '1.5px solid rgba(30, 77, 64, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: 700,
          fontSize: '1.2rem',
          flexShrink: 0
        }}>
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{user.name}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{user.email}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {roleLabels[user.role] || user.role} · {clinic?.name || 'Ma Clinique'}
          </div>
        </div>
      </div>

      <PasswordChangeForm />
    </div>
  );
};

export default ProfilePage;
