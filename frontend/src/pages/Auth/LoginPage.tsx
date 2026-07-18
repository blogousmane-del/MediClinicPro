import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { KeyRound, Mail, ArrowLeft, Loader2 } from 'lucide-react';

interface LoginPageProps {
  onNavigate: (tab: 'landing' | 'register') => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login } = useAuth();
  const { showToast } = useNotifications();
  
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('error', 'Erreur de saisie', 'Veuillez saisir votre email et votre mot de passe.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      showToast('success', 'Connexion réussie', 'Ravi de vous revoir sur MediClinic !');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Échec de connexion', err.error || 'Identifiants incorrects ou compte inactif.');
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
      padding: '2rem',
      fontFamily: 'var(--font-primary)'
    }}>
      <div style={{
        backgroundColor: '#111827',
        border: '1px solid #1f2937',
        borderRadius: '16px',
        padding: '2.5rem',
        maxWidth: '450px',
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

        {/* Logo and Titles */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
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
            marginBottom: '1rem'
          }}>M</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white', fontFamily: 'var(--font-secondary)' }}>Connexion</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '4px' }}>
            Accédez à l'espace de votre clinique
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label style={{ color: '#94a3b8' }}>Adresse Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
              <input
                type="email"
                placeholder="Ex: docteur@gmail.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-control w-full"
                style={{ paddingLeft: '38px', backgroundColor: '#0b0f19', borderColor: '#1f2937' }}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ color: '#94a3b8' }}>Mot de passe</label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
              <input
                type="password"
                placeholder="Saisissez votre mot de passe"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-control w-full"
                style={{ paddingLeft: '38px', backgroundColor: '#0b0f19', borderColor: '#1f2937' }}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            style={{ padding: '0.75rem', borderRadius: '8px', fontSize: '1rem', fontWeight: 600 }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>Connexion en cours...</span>
              </>
            ) : (
              <span>Se connecter</span>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>
          Nouvelle clinique ?{' '}
          <button 
            onClick={() => onNavigate('register')}
            style={{ background: 'none', border: 'none', color: 'rgb(13, 148, 136)', cursor: 'pointer', fontWeight: 600, padding: 0 }}
          >
            Créer un compte
          </button>
        </div>

        {/* Demo Accounts Panel */}
        <div style={{
          marginTop: '2rem',
          backgroundColor: '#1f2937',
          borderRadius: '8px',
          padding: '1rem',
          fontSize: '0.8rem',
          color: '#e5e7eb',
          border: '1px solid #374151'
        }}>
          <div style={{ fontWeight: 600, marginBottom: '6px', color: 'white' }}>🔑 Comptes Démo (Seeding standard) :</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <li><strong>Admin</strong> : admin@mediclinic.com / adminpassword</li>
            <li><strong>Médecin</strong> : aminata@mediclinic.com / doctorpassword</li>
            <li><strong>Secrétaire</strong> : bernard@mediclinic.com / secretarypassword</li>
            <li><strong>Pharmacien</strong> : moussa@mediclinic.com / pharmacistpassword</li>
            <li><strong>Laborantin</strong> : fatou@mediclinic.com / labpassword</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
