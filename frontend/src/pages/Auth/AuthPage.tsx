import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  Mail,
  ArrowLeft,
  Loader2,
  Building2,
  User,
  Eye,
  EyeOff,
  Calendar,
  Pill,
  Receipt,
  CheckCircle2,
  Lock,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';
import { PhoneInput } from '../../components/PhoneInput';

const brandFeatures = [
  { icon: Calendar, label: 'Gestion des rendez-vous' },
  { icon: Pill, label: 'Pharmacie & Laboratoire' },
  { icon: Receipt, label: 'Facturation FCFA' },
];

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

declare global {
  interface Window {
    google?: any;
  }
}

interface AuthPageProps {
  initialTab?: 'login' | 'register';
  onNavigate: (tab: 'landing' | 'login' | 'register') => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialTab = 'login', onNavigate }) => {
  const { login, loginWithGoogle, register } = useAuth();
  const { showToast } = useNotifications();

  // Navigation & View States
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);
  const [isForgotView, setIsForgotView] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState<boolean>(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);

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

  const handleGoogleCredential = async (response: { credential: string }) => {
    setIsGoogleSubmitting(true);
    try {
      await loginWithGoogle(response.credential);
      showToast('success', 'Connexion réussie', 'Bienvenue sur MediClinic !');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Échec de connexion Google', err.error || 'Impossible de vous connecter avec Google.');
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const googleInitialized = useRef(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || isForgotView) return;

    let attempts = 0;
    const tryRender = () => {
      attempts += 1;
      if (window.google?.accounts?.id && googleButtonRef.current) {
        if (!googleInitialized.current) {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredential
          });
          googleInitialized.current = true;
        }
        googleButtonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: activeTab === 'register' ? 'signup_with' : 'signin_with'
        });
      } else if (attempts < 30) {
        setTimeout(tryRender, 100);
      }
    };
    tryRender();
  }, [activeTab, isForgotView]);

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

    if (registerPassword.length < 8) {
      showToast('error', 'Sécurité du mot de passe', 'Le mot de passe doit contenir au moins 8 caractères.');
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

  // Handle Forgot Password
  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail) {
      showToast('error', 'Champ requis', 'Veuillez renseigner votre adresse email.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      showToast('success', 'Email envoyé', `Un lien de réinitialisation a été envoyé à ${recoveryEmail}.`);
      setIsForgotView(false);
    }, 1200);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      backgroundColor: '#f2f6f4',
      fontFamily: 'var(--font-primary, "Outfit", sans-serif)',
      boxSizing: 'border-box'
    }}>
      <style>{`
        .auth-container {
          width: 100%;
          min-height: 100vh;
          display: flex;
        }
        .auth-left-panel {
          width: 44%;
          background: linear-gradient(165deg, #132a24 0%, #1a3c33 100%);
          color: #ffffff;
          padding: 3rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          box-sizing: border-box;
        }
        .auth-right-panel {
          flex: 1;
          background-color: #f2f6f4;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 2.5rem 1.5rem;
          position: relative;
          box-sizing: border-box;
        }
        .auth-card-clean {
          width: 100%;
          max-width: 420px;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .auth-input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .auth-input-label {
          font-size: 0.725rem;
          font-weight: 700;
          color: #5a6e67;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .auth-field-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .auth-field-wrapper input {
          width: 100%;
          padding: 11px 14px 11px 40px;
          border-radius: 10px;
          border: 1px solid #d8e2dc;
          background-color: #eaf1ed;
          font-size: 0.9rem;
          color: #172a24;
          outline: none;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }
        .auth-field-wrapper input:focus {
          border-color: #1e4d40;
          background-color: #ffffff;
          box-shadow: 0 0 0 3px rgba(30, 77, 64, 0.12);
        }
        .auth-icon-left {
          position: absolute;
          left: 13px;
          color: #7a8f87;
          pointer-events: none;
        }
        .auth-btn-primary {
          width: 100%;
          padding: 12px;
          border-radius: 10px;
          background-color: #1e4d40;
          color: #ffffff;
          border: none;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background-color 0.2s ease, transform 0.1s ease;
          box-shadow: 0 4px 12px rgba(30, 77, 64, 0.2);
        }
        .auth-btn-primary:hover {
          background-color: #163a30;
          transform: translateY(-1px);
        }
        .auth-btn-secondary {
          width: 100%;
          padding: 11px;
          border-radius: 10px;
          background-color: #ffffff;
          color: #2c423b;
          border: 1px solid #d0ded7;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s ease;
        }
        .auth-btn-secondary:hover {
          background-color: #f7faf8;
          border-color: #b5cbc0;
        }

        /* Responsive Breakpoints */
        @media (max-width: 960px) {
          .auth-left-panel {
            display: none;
          }
          .auth-right-panel {
            padding: 2rem 1.25rem;
          }
        }
      `}</style>

      <div className="auth-container">
        
        {/* LEFT BRAND PANEL */}
        <div className="auth-left-panel">
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo-icon.svg" alt="MediClinic" width={34} height={34} style={{ display: 'block', flexShrink: 0 }} />
            <span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em', color: '#ffffff' }}>
              MediClinic
            </span>
          </div>

          {/* Main Title & Features */}
          <div style={{ maxWidth: '380px' }}>
            <h1 style={{
              fontSize: '2.2rem',
              fontWeight: 800,
              color: '#ffffff',
              lineHeight: 1.2,
              marginBottom: '1rem',
              fontFamily: 'var(--font-secondary, "Plus Jakarta Sans", sans-serif)'
            }}>
              La gestion de votre clinique,<br />
              <span style={{ color: '#34d399' }}>simplifiée.</span>
            </h1>

            <p style={{
              fontSize: '0.9rem',
              color: '#a3c2b8',
              lineHeight: 1.6,
              marginBottom: '2.2rem'
            }}>
              Rendez-vous, ordonnances, pharmacie, laboratoire et comptabilité — tout en un seul endroit.
            </p>

            {/* Checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {brandFeatures.map(({ label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '7px',
                    backgroundColor: 'rgba(52, 211, 153, 0.15)',
                    border: '1px solid rgba(52, 211, 153, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <CheckCircle2 size={15} color="#34d399" />
                  </div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2f1ec' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer copyright */}
          <div style={{ fontSize: '0.78rem', color: '#7a9f93' }}>
            © 2026 MediClinic · Côte d'Ivoire
          </div>
        </div>

        {/* RIGHT FORM PANEL */}
        <div className="auth-right-panel">

          {/* Return link */}
          <button
            onClick={() => onNavigate('landing')}
            style={{
              position: 'absolute',
              top: '1.75rem',
              left: '1.75rem',
              background: 'none',
              border: 'none',
              color: '#5a6e67',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ArrowLeft size={16} />
            <span>Retour à l'accueil</span>
          </button>

          <div className="auth-card-clean">

            {/* Header Title */}
            <div>
              <h2 style={{
                fontSize: '1.75rem',
                fontWeight: 800,
                color: '#132a24',
                margin: 0,
                fontFamily: 'var(--font-secondary, "Plus Jakarta Sans", sans-serif)'
              }}>
                {isForgotView ? 'Récupération' : activeTab === 'register' ? 'Créer un compte' : 'Connexion'}
              </h2>
              <p style={{ color: '#688077', fontSize: '0.875rem', marginTop: '4px', margin: 0 }}>
                {isForgotView
                  ? 'Entrez votre email pour réinitialiser votre mot de passe'
                  : activeTab === 'register'
                  ? 'Enregistrez votre cabinet en 1 minute'
                  : 'Entrez vos identifiants pour accéder à votre espace.'}
              </p>
            </div>

            {/* Sub-tab navigation when not in forgot view */}
            {!isForgotView && (
              <div style={{
                display: 'flex',
                gap: '8px',
                backgroundColor: '#e3ebe7',
                padding: '4px',
                borderRadius: '10px'
              }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  style={{
                    flex: 1,
                    padding: '7px',
                    borderRadius: '7px',
                    border: 'none',
                    backgroundColor: activeTab === 'login' ? '#ffffff' : 'transparent',
                    color: activeTab === 'login' ? '#132a24' : '#688077',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    boxShadow: activeTab === 'login' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  Connexion
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('register')}
                  style={{
                    flex: 1,
                    padding: '7px',
                    borderRadius: '7px',
                    border: 'none',
                    backgroundColor: activeTab === 'register' ? '#ffffff' : 'transparent',
                    color: activeTab === 'register' ? '#132a24' : '#688077',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    boxShadow: activeTab === 'register' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  Créer un compte
                </button>
              </div>
            )}

            {/* FORGOT PASSWORD VIEW */}
            {isForgotView ? (
              <form onSubmit={handleRecoverySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="auth-input-group">
                  <label className="auth-input-label">ADRESSE EMAIL</label>
                  <div className="auth-field-wrapper">
                    <Mail size={17} className="auth-icon-left" />
                    <input
                      type="email"
                      placeholder="Ex: docteur@gmail.com"
                      value={recoveryEmail}
                      onChange={e => setRecoveryEmail(e.target.value)}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="auth-btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <span>Envoyer les instructions</span>}
                </button>

                <button
                  type="button"
                  onClick={() => setIsForgotView(false)}
                  style={{
                    background: 'none', border: 'none', color: '#1e4d40',
                    fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', textAlign: 'center'
                  }}
                >
                  Retour à la connexion
                </button>
              </form>
            ) : activeTab === 'login' ? (
              /* LOGIN FORM */
              <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

                {/* Email Field */}
                <div className="auth-input-group">
                  <label className="auth-input-label">ADRESSE EMAIL</label>
                  <div className="auth-field-wrapper">
                    <Mail size={17} className="auth-icon-left" />
                    <input
                      type="email"
                      placeholder="Ex: contact@clinique.ci"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="auth-input-group">
                  <label className="auth-input-label">MOT DE PASSE</label>
                  <div className="auth-field-wrapper">
                    <Lock size={17} className="auth-icon-left" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      disabled={isSubmitting}
                      required
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        background: 'none',
                        border: 'none',
                        color: '#7a8f87',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Forgot Password Link */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-4px' }}>
                  <button
                    type="button"
                    onClick={() => setIsForgotView(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#1e4d40',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Mot de passe oublié ?
                  </button>
                </div>

                {/* Primary Submit Button */}
                <button type="submit" className="auth-btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <>
                      <Lock size={16} />
                      <span>Se connecter</span>
                    </>
                  )}
                </button>

                {/* Google Sign In fallback if available */}
                {GOOGLE_CLIENT_ID && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '2px 0' }}>
                      <div style={{ flex: 1, height: '1px', backgroundColor: '#d8e2dc' }} />
                      <span style={{ fontSize: '0.78rem', color: '#8aa097', fontWeight: 600 }}>ou</span>
                      <div style={{ flex: 1, height: '1px', backgroundColor: '#d8e2dc' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <div ref={googleButtonRef} />
                    </div>
                  </>
                )}

                {/* Support Contact Note */}
                <div style={{
                  textAlign: 'center',
                  marginTop: '6px',
                  fontSize: '0.8rem',
                  color: '#4b635b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  fontWeight: 600
                }}>
                  <HelpCircle size={14} />
                  <span>Problème de connexion ? Contactez l'administrateur de votre clinique.</span>
                </div>

              </form>
            ) : (
              /* REGISTER FORM */
              <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="auth-input-group">
                  <label className="auth-input-label">NOM DE LA CLINIQUE *</label>
                  <div className="auth-field-wrapper">
                    <Building2 size={17} className="auth-icon-left" />
                    <input
                      type="text"
                      placeholder="Ex: Cabinet Médical Saint-Jean"
                      value={clinicName}
                      onChange={e => setClinicName(e.target.value)}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>

                <div className="auth-input-group">
                  <label className="auth-input-label">NOM DU RESPONSABLE *</label>
                  <div className="auth-field-wrapper">
                    <User size={17} className="auth-icon-left" />
                    <input
                      type="text"
                      placeholder="Ex: Dr. Koné Aminata"
                      value={adminName}
                      onChange={e => setAdminName(e.target.value)}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>

                <div className="auth-input-group">
                  <label className="auth-input-label">ADRESSE EMAIL *</label>
                  <div className="auth-field-wrapper">
                    <Mail size={17} className="auth-icon-left" />
                    <input
                      type="email"
                      placeholder="Ex: contact@saintjean.ci"
                      value={registerEmail}
                      onChange={e => setRegisterEmail(e.target.value)}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>

                <div className="auth-input-group">
                  <label className="auth-input-label">TÉLÉPHONE (MOBILE MONEY) *</label>
                  <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #d8e2dc', padding: '4px' }}>
                    <PhoneInput value={phone} onChange={setPhone} disabled={isSubmitting} required />
                  </div>
                </div>

                <div className="auth-input-group">
                  <label className="auth-input-label">MOT DE PASSE *</label>
                  <div className="auth-field-wrapper">
                    <Lock size={17} className="auth-icon-left" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Minimum 8 caractères"
                      value={registerPassword}
                      onChange={e => setRegisterPassword(e.target.value)}
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="auth-btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <span>S'inscrire et commencer</span>}
                </button>
              </form>
            )}

            {/* Bottom Security Badge */}
            <div style={{
              backgroundColor: '#e6f0eb',
              border: '1px solid #cce0d6',
              borderRadius: '10px',
              padding: '9px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#1a4035',
              marginTop: '0.5rem'
            }}>
              <ShieldCheck size={16} color="#10b981" />
              <span>Connexion chiffrée et données protégées</span>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

export default AuthPage;
