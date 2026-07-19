import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { KeyRound, Mail, ArrowLeft, Loader2, Building2, User, Phone, Eye, EyeOff } from 'lucide-react';

interface AuthPageProps {
  initialTab?: 'login' | 'register';
  onNavigate: (tab: 'landing' | 'login' | 'register') => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialTab = 'login', onNavigate }) => {
  const { login, register } = useAuth();
  const { showToast } = useNotifications();

  // Navigation states
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);
  const [isForgotView, setIsForgotView] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Form states
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  
  const [clinicName, setClinicName] = useState<string>('');
  const [adminName, setAdminName] = useState<string>('');
  const [registerEmail, setRegisterEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [registerPassword, setRegisterPassword] = useState<string>('');

  const [recoveryEmail, setRecoveryEmail] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
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

  // Handle Register
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicName || !adminName || !registerEmail || !registerPassword || !phone) {
      showToast('error', 'Formulaire incomplet', 'Veuillez renseigner tous les champs obligatoires.');
      return;
    }

    if (registerPassword.length < 6) {
      showToast('error', 'Sécurité du mot de passe', 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(clinicName, adminName, registerEmail, registerPassword, phone);
      showToast('success', 'Bienvenue !', 'Votre compte clinique a été créé avec succès.');
    } catch (err: any) {
      console.error(err);
      showToast('error', "Échec de l'inscription", err.error || "Une erreur est survenue lors de l'inscription.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Forgot Password (Simulated recovery)
  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail) {
      showToast('error', 'Champ requis', 'Veuillez renseigner votre adresse email.');
      return;
    }

    setIsSubmitting(true);
    // Simulate API delay
    setTimeout(() => {
      setIsSubmitting(false);
      showToast('success', 'Email envoyé', `Un code de réinitialisation temporaire a été envoyé à ${recoveryEmail}.`);
      setIsForgotView(false);
    }, 1500);
  };

  return (
    <div style={{
      backgroundColor: '#05080f',
      backgroundImage: 'radial-gradient(circle at 50% 120%, rgba(13, 148, 136, 0.15), rgba(5, 8, 15, 0))',
      color: '#f9fafb',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
      fontFamily: 'var(--font-primary)'
    }}>
      <div className="glass-card" style={{
        maxWidth: '480px',
        width: '100%',
        padding: '2.5rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        position: 'relative'
      }}>
        {/* Back to Home Link */}
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
            padding: 0,
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#14b8a6'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
        >
          <ArrowLeft size={16} />
          Retour à l'accueil
        </button>

        {/* Brand / Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #0d9488, #0f766e)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '1.6rem',
            boxShadow: '0 0 15px rgba(13, 148, 136, 0.4)',
            marginBottom: '0.75rem'
          }}>M</div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'white', letterSpacing: '-0.025em' }}>MediClinic Pro</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '4px' }}>
            Gestion clinique & financière moderne pour la Côte d'Ivoire
          </p>
        </div>

        {/* PASSWORD RECOVERY VIEW */}
        {isForgotView ? (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>Mot de passe oublié ?</h2>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '4px' }}>
                Saisissez votre adresse email pour recevoir vos instructions de récupération.
              </p>
            </div>

            <form onSubmit={handleRecoverySubmit}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ color: '#94a3b8' }}>Adresse Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
                  <input
                    type="email"
                    placeholder="Ex: docteur@gmail.com"
                    value={recoveryEmail}
                    onChange={e => setRecoveryEmail(e.target.value)}
                    className="input-control w-full"
                    style={{ paddingLeft: '38px', backgroundColor: '#090d16', borderColor: '#1e293b' }}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                style={{ padding: '0.75rem', borderRadius: '8px', fontWeight: 600 }}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Envoi en cours...</span>
                  </div>
                ) : (
                  <span>Envoyer les instructions</span>
                )}
              </button>
            </form>

            <button
              onClick={() => setIsForgotView(false)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                color: 'rgb(13, 148, 136)',
                fontWeight: 600,
                fontSize: '0.9rem',
                marginTop: '1rem',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              Retour à la connexion
            </button>
          </div>
        ) : (
          /* REGULAR AUTH VIEWS (TABS) */
          <div>
            {/* Navigation Tabs */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid #1e293b',
              marginBottom: '2rem',
              gap: '20px'
            }}>
              <button
                onClick={() => { setActiveTab('login'); }}
                style={{
                  paddingBottom: '0.75rem',
                  color: activeTab === 'login' ? '#14b8a6' : '#94a3b8',
                  borderBottom: activeTab === 'login' ? '2px solid #14b8a6' : 'none',
                  background: 'none',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  fontSize: '1rem',
                  fontWeight: activeTab === 'login' ? 700 : 500,
                  cursor: 'pointer',
                  flex: 1,
                  textAlign: 'center',
                  transition: 'all 0.2s'
                }}
              >
                Connexion
              </button>
              <button
                onClick={() => { setActiveTab('register'); }}
                style={{
                  paddingBottom: '0.75rem',
                  color: activeTab === 'register' ? '#14b8a6' : '#94a3b8',
                  borderBottom: activeTab === 'register' ? '2px solid #14b8a6' : 'none',
                  background: 'none',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  fontSize: '1rem',
                  fontWeight: activeTab === 'register' ? 700 : 500,
                  cursor: 'pointer',
                  flex: 1,
                  textAlign: 'center',
                  transition: 'all 0.2s'
                }}
              >
                Créer un compte
              </button>
            </div>

            {/* TAB 1: LOGIN FORM */}
            {activeTab === 'login' && (
              <form onSubmit={handleLoginSubmit}>
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
                      style={{ paddingLeft: '38px', backgroundColor: '#090d16', borderColor: '#1e293b' }}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ color: '#94a3b8', marginBottom: 0 }}>Mot de passe</label>
                    <button
                      type="button"
                      onClick={() => setIsForgotView(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgb(13, 148, 136)',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        fontWeight: 600,
                        padding: 0
                      }}
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Saisissez votre mot de passe"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="input-control w-full"
                      style={{ paddingLeft: '38px', paddingRight: '40px', backgroundColor: '#090d16', borderColor: '#1e293b' }}
                      disabled={isSubmitting}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#6b7280',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  style={{ padding: '0.75rem', borderRadius: '8px', fontSize: '1rem', fontWeight: 600, marginTop: '1.5rem' }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <Loader2 className="animate-spin" size={18} />
                      <span>Connexion en cours...</span>
                    </div>
                  ) : (
                    <span>Se connecter</span>
                  )}
                </button>

                <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>
                  Pas encore de compte ?{' '}
                  <button 
                    type="button"
                    onClick={() => { setActiveTab('register'); }}
                    style={{ background: 'none', border: 'none', color: 'rgb(13, 148, 136)', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                  >
                    Créer un compte
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: REGISTER FORM */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegisterSubmit}>
                {/* Clinic Name */}
                <div className="form-group">
                  <label style={{ color: '#94a3b8' }}>Nom de la Clinique *</label>
                  <div style={{ position: 'relative' }}>
                    <Building2 size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
                    <input
                      type="text"
                      placeholder="Ex: Cabinet Médical Saint-Jean"
                      value={clinicName}
                      onChange={e => setClinicName(e.target.value)}
                      className="input-control w-full"
                      style={{ paddingLeft: '38px', backgroundColor: '#090d16', borderColor: '#1e293b' }}
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
                      style={{ paddingLeft: '38px', backgroundColor: '#090d16', borderColor: '#1e293b' }}
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
                      value={registerEmail}
                      onChange={e => setRegisterEmail(e.target.value)}
                      className="input-control w-full"
                      style={{ paddingLeft: '38px', backgroundColor: '#090d16', borderColor: '#1e293b' }}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="form-group">
                  <label style={{ color: '#94a3b8' }}>Téléphone (Mobile Money) *</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
                    <input
                      type="tel"
                      placeholder="Ex: +225 0707070707"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="input-control w-full"
                      style={{ paddingLeft: '38px', backgroundColor: '#090d16', borderColor: '#1e293b' }}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label style={{ color: '#94a3b8' }}>Mot de passe *</label>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Minimum 6 caractères"
                      value={registerPassword}
                      onChange={e => setRegisterPassword(e.target.value)}
                      className="input-control w-full"
                      style={{ paddingLeft: '38px', paddingRight: '40px', backgroundColor: '#090d16', borderColor: '#1e293b' }}
                      disabled={isSubmitting}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#6b7280',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  style={{ padding: '0.75rem', borderRadius: '8px', fontSize: '1rem', fontWeight: 600 }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <Loader2 className="animate-spin" size={18} />
                      <span>Création du compte...</span>
                    </div>
                  ) : (
                    <span>S'inscrire et commencer</span>
                  )}
                </button>

                <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>
                  Déjà inscrit ?{' '}
                  <button 
                    type="button"
                    onClick={() => { setActiveTab('login'); }}
                    style={{ background: 'none', border: 'none', color: 'rgb(13, 148, 136)', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                  >
                    Se connecter
                  </button>
                </div>
              </form>
            )}

            {/* Demo Accounts Quick Seeder (For easier testing) */}
            {activeTab === 'login' && (
              <div style={{
                marginTop: '2rem',
                backgroundColor: '#0f172a',
                borderRadius: '10px',
                padding: '1rem',
                fontSize: '0.8rem',
                color: '#94a3b8',
                border: '1px solid #1e293b',
                boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.2)'
              }}>
                <div style={{ fontWeight: 600, marginBottom: '8px', color: 'white' }}>🔑 Comptes Démo (Cliquer pour remplir) :</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {[
                    { label: 'Administrateur', email: 'admin@mediclinic.com', pass: 'adminpassword' },
                    { label: 'Médecin', email: 'aminata@mediclinic.com', pass: 'doctorpassword' },
                    { label: 'Secrétaire', email: 'bernard@mediclinic.com', pass: 'secretarypassword' },
                    { label: 'Pharmacien', email: 'moussa@mediclinic.com', pass: 'pharmacistpassword' }
                  ].map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => {
                        setEmail(acc.email);
                        setPassword(acc.pass);
                        showToast('info', 'Compte sélectionné', `${acc.label} pré-rempli.`);
                      }}
                      style={{
                        padding: '6px',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        textAlign: 'left',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#334155'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
                    >
                      <strong>{acc.label}</strong>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default AuthPage;
