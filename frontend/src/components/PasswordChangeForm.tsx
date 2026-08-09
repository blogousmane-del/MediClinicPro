import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { ShieldCheck } from 'lucide-react';

// Self-contained password-change form: owns its state, calls PUT /auth/password
// (via AuthContext.setPassword) directly. Used by SettingsPage's "Sécurité" tab
// (admin/manager only) and ProfilePage (every role) — extracted so both stay
// in sync instead of drifting into two copies of the same logic.
export const PasswordChangeForm: React.FC = () => {
  const { user: currentUser, setPassword } = useAuth();
  const { showToast } = useNotifications();

  const [currentPasswordInput, setCurrentPasswordInput] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');
  const [isSavingPassword, setIsSavingPassword] = useState<boolean>(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPasswordInput.length < 8) {
      showToast('error', 'Mot de passe trop court', 'Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      showToast('error', 'Les mots de passe ne correspondent pas', 'Veuillez confirmer le même mot de passe.');
      return;
    }
    if (currentUser?.passwordSet && !currentPasswordInput) {
      showToast('error', 'Mot de passe actuel requis', 'Veuillez saisir votre mot de passe actuel.');
      return;
    }

    setIsSavingPassword(true);
    try {
      await setPassword(currentPasswordInput, newPasswordInput);
      showToast(
        'success',
        currentUser?.passwordSet ? 'Mot de passe modifié' : 'Mot de passe défini',
        currentUser?.passwordSet
          ? 'Votre mot de passe a été mis à jour.'
          : 'Vous pouvez désormais vous connecter avec votre email et ce mot de passe, en plus de Google.'
      );
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', err.error || 'Impossible de mettre à jour le mot de passe.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <form onSubmit={handlePasswordSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', maxWidth: '480px', width: '100%', boxSizing: 'border-box' }}>
      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '8px', margin: 0 }}>
        {currentUser?.passwordSet ? 'Changer le mot de passe' : 'Définir un mot de passe'}
      </h3>

      {!currentUser?.passwordSet && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          backgroundColor: 'var(--primary-light, #e6f4ea)', border: '1px solid #bbf7d0',
          borderRadius: '10px', padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#1e4d40'
        }}>
          <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>
            Votre compte a été créé via Google et n'a pas encore de mot de passe. Définissez-en un
            ci-dessous pour pouvoir aussi vous connecter avec votre email et ce mot de passe.
          </span>
        </div>
      )}

      {currentUser?.passwordSet && (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Mot de passe actuel</label>
          <input
            type="password"
            value={currentPasswordInput}
            onChange={e => setCurrentPasswordInput(e.target.value)}
            className="input-control"
            required
          />
        </div>
      )}

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Nouveau mot de passe</label>
        <input
          type="password"
          placeholder="Minimum 8 caractères"
          value={newPasswordInput}
          onChange={e => setNewPasswordInput(e.target.value)}
          className="input-control"
          required
        />
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Confirmer le nouveau mot de passe</label>
        <input
          type="password"
          value={confirmPasswordInput}
          onChange={e => setConfirmPasswordInput(e.target.value)}
          className="input-control"
          required
        />
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        style={{ alignSelf: 'flex-start', backgroundColor: '#1e4d40', borderRadius: '10px' }}
        disabled={isSavingPassword}
      >
        {isSavingPassword ? 'Enregistrement...' : (currentUser?.passwordSet ? 'Mettre à jour le mot de passe' : 'Définir le mot de passe')}
      </button>
    </form>
  );
};

export default PasswordChangeForm;
