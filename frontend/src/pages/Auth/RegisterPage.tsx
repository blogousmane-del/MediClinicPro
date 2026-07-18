import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { Mail, KeyRound, Building2, User, Phone, ArrowLeft, Loader2 } from 'lucide-react';

interface RegisterPageProps {
  onNavigate: (tab: 'landing' | 'login') => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const { register } = useAuth();
  const { showToast } = useNotifications();

  const [clinicName, setClinicName] = useState<string>('');
  const [adminName, setAdminName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicName || !adminName || !email || !password || !phone) {
      showToast('error', 'Formulaire incomplet', 'Veuillez renseigner tous les champs obligatoires.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(clinicName, adminName, email, password, phone);
      showToast('success', 'Bienvenue !', 'Votre compte clinique a été créé avec succès.');
    } catch (err: any) {
      console.error(err);
      showToast('error', "Échec de l'inscription", err.error || "Une erreur est survenue lors de l'inscription.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      backgroundColor: '#0b0f19',
      color: '#f9fafb',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
      fontFamily: 'var(--font-primary)'
    }}>
      <div style={{
        backgroundColor: '#111827',
        border: '1px solid #1f2937',
        borderRadius: '16px',
        padding: '2.5rem',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)'
      }}>
        {/* Back Link */}
        <button 
          onClick={() => onNavigate('landing')}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.9rem',
            marginBottom: '1.5rem',
            padding: 0
          }}
        >
          <ArrowLeft size={16} />
          Retour à l'accueil
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            backgroundColor: 'rgb(13, 148, 136)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '1.5rem',
            marginBottom: '0.75rem'
          }}>M</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white', fontFamily: 'var(--font-secondary)' }}>Créer un compte clinique</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '4px' }}>
            Bénéficiez de 14 jours d'essai gratuit
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Clinic Name */}
          <div className="form-group">
            <label style={{ color: '#94a3b8' }}>Nom de la Clinique / Cabinet *</label>
            <div style={{ position: 'relative' }}>
              <Building2 size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
              <input
                type="text"
                placeholder="Ex: Cabinet Médical Saint-Jean"
                value={clinicName}
                onChange={e => setClinicName(e.target.value)}
                className="input-control w-full"
                style={{ paddingLeft: '38px', backgroundColor: '#0b0f19', borderColor: '#1f2937' }}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Admin Name */}
          <div className="form-group">
            <label style={{ color: '#94a3b8' }}>Nom du Responsable *</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
              <input
                type="text"
                placeholder="Ex: Dr. Koné Aminata"
                value={adminName}
                onChange={e => setAdminName(e.target.value)}
                className="input-control w-full"
                style={{ paddingLeft: '38px', backgroundColor: '#0b0f19', borderColor: '#1f2937' }}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="form-group">
            <label style={{ color: '#94a3b8' }}>Adresse Email *</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
              <input
                type="email"
                placeholder="Ex: contact@saintjean.ci"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-control w-full"
                style={{ paddingLeft: '38px', backgroundColor: '#0b0f19', borderColor: '#1f2937' }}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Phone */}
          <div className="form-group">
            <label style={{ color: '#94a3b8' }}>Téléphone du Responsable (Mobile Money) *</label>
            <div style={{ position: 'relative' }}>
              <Phone size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
              <input
                type="tel"
                placeholder="Ex: +225 0707070707"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="input-control w-full"
                style={{ paddingLeft: '38px', backgroundColor: '#0b0f19', borderColor: '#1f2937' }}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group" style={{ marginBottom: '1.75rem' }}>
            <label style={{ color: '#94a3b8' }}>Mot de passe *</label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
              <input
                type="password"
                placeholder="Minimum 6 caractères"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-control w-full"
                style={{ paddingLeft: '38px', backgroundColor: '#0b0f19', borderColor: '#1f2937' }}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary w-full"
            style={{ padding: '0.75rem', borderRadius: '8px', fontSize: '1rem', fontWeight: 600 }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>Création en cours...</span>
              </>
            ) : (
              <span>S'inscrire et commencer</span>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>
          Déjà un compte ?{' '}
          <button 
            onClick={() => onNavigate('login')}
            style={{ background: 'none', border: 'none', color: 'rgb(13, 148, 136)', cursor: 'pointer', fontWeight: 600, padding: 0 }}
          >
            Se connecter
          </button>
        </div>
      </div>
    </div>
  );
};
