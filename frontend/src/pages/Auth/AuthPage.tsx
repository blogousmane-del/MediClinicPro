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
  CalendarCheck,
  Lock,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';
import '@fontsource-variable/geist';
import '../../styles/site.css';
import { PhoneInput } from '../../components/PhoneInput';
import { SITE, whatsappUrl } from '../../config/site';
import { trialDaysOf } from '../../utils/publicPlans';
import { usePublicCatalog } from '../Landing/usePublicCatalog';
import { Capture } from '../Landing/Capture';

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
  const trialDays = trialDaysOf(usePublicCatalog());

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
      const { passwordReset } = await loginWithGoogle(response.credential);
      if (passwordReset) {
        showToast(
          'info',
          'Compte sécurisé',
          "Votre connexion Google protège désormais ce compte. L'ancien mot de passe a été désactivé : définissez-en un nouveau depuis votre profil si vous en avez besoin."
        );
      } else {
        showToast('success', 'Connexion réussie', 'Bienvenue sur MediClinic !');
      }
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
        // Largeur du formulaire, plafonnée à 320 : sur un écran de 320 px, un
        // bouton fixe de 320 élargissait la carte au-delà de la page.
        const availableWidth = googleButtonRef.current.parentElement?.clientWidth || 320;
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          width: Math.min(320, availableWidth),
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

  // La réinitialisation par e-mail n'existe pas encore. Ce formulaire annonçait
  // « Un lien de réinitialisation a été envoyé » après une attente simulée, sans
  // aucun appel au serveur (audit du 2026-10-05) : la personne attendait un
  // e-mail qui ne partirait jamais. La demande part donc sur WhatsApp, avec
  // l'adresse du compte déjà écrite ; l'exploitant la traite depuis Platform
  // Admin (mot de passe temporaire).
  const handleRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const email = recoveryEmail.trim();
    const text = email
      ? `Bonjour, j'ai oublié le mot de passe de mon compte MediClinic (${email}).`
      : "Bonjour, j'ai oublié le mot de passe de mon compte MediClinic.";
    window.open(whatsappUrl(text), '_blank', 'noopener');
  };

  return (
    <div className="site vt-auth">
      <aside className="vt-auth-aside">
        <img className="vt-auth-logo" src="/logo-horizontal.svg" alt="MediClinic" width={103} height={28} />
        <div>
          <h1>Toute votre clinique, de l'accueil à la caisse.</h1>
          <p className="vt-auth-trial">
            <CalendarCheck size={18} strokeWidth={1.75} aria-hidden="true" />
            {trialDays} jours gratuits, sans carte bancaire
          </p>
        </div>
        <figure className="vt-shot vt-auth-shot">
          <div className="vt-shot-bar" aria-hidden="true"><span>mediclinicpro.com</span></div>
          <Capture name="dashboard" alt="Tableau de bord MediClinic" sizes="720px" />
        </figure>
      </aside>

      <main className="vt-auth-main">
        <button type="button" className="vt-auth-back" onClick={() => onNavigate('landing')}>
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          Retour à l'accueil
        </button>

        <div className="vt-auth-card">
          <div>
            <h2>{isForgotView ? 'Récupération' : activeTab === 'register' ? 'Créer un compte' : 'Connexion'}</h2>
            <p className="vt-auth-sub">
              {isForgotView
                ? 'Nous réinitialisons votre accès sur WhatsApp, après vérification.'
                : activeTab === 'register'
                ? 'Enregistrez votre cabinet en 1 minute'
                : 'Entrez vos identifiants pour accéder à votre espace.'}
            </p>
          </div>

          {!isForgotView && (
            <div className="vt-auth-switch" role="group" aria-label="Connexion ou création de compte">
              <button type="button" aria-pressed={activeTab === 'login'} onClick={() => setActiveTab('login')}>Connexion</button>
              <button type="button" aria-pressed={activeTab === 'register'} onClick={() => setActiveTab('register')}>Créer un compte</button>
            </div>
          )}

          {/* Une clé par formulaire : sans elle, React réutilise le même <form> et
              ses boutons d'une vue à l'autre. « Mot de passe oublié ? » devenait le
              bouton d'envoi pendant son propre clic, et le navigateur soumettait
              le formulaire de récupération, vide (bulle « Veuillez renseigner ce
              champ ») ; « Retour à la connexion » soumettait la connexion. */}
          {isForgotView ? (
            <form key="recovery" onSubmit={handleRecoverySubmit} className="vt-form">
              <div className="vt-field">
                <label className="vt-field-label" htmlFor="vt-recovery-email">Adresse e-mail</label>
                <div className="vt-field-control">
                  <Mail size={17} strokeWidth={1.75} aria-hidden="true" />
                  <input
                    id="vt-recovery-email"
                    type="email"
                    autoComplete="email"
                    placeholder="Ex : docteur@gmail.com"
                    value={recoveryEmail}
                    onChange={e => setRecoveryEmail(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>
              <p className="vt-auth-text">
                La réinitialisation par e-mail n'est pas encore disponible. Envoyez-nous votre demande sur
                WhatsApp au <span className="vt-nowrap">{SITE.whatsapp.display}</span>&nbsp;: nous vérifions votre identité, puis vous transmettons
                un mot de passe temporaire.
              </p>
              <button type="submit" className="vt-btn vt-btn-primary vt-btn-block">Demander sur WhatsApp</button>
              <button type="button" className="vt-link vt-link-center" onClick={() => setIsForgotView(false)}>
                Retour à la connexion
              </button>
            </form>
          ) : activeTab === 'login' ? (
            <form key="login" onSubmit={handleLoginSubmit} className="vt-form">
              <div className="vt-field">
                <label className="vt-field-label" htmlFor="vt-login-email">Adresse e-mail</label>
                <div className="vt-field-control">
                  <Mail size={17} strokeWidth={1.75} aria-hidden="true" />
                  <input
                    id="vt-login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="Ex : contact@clinique.ci"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              <div className="vt-field">
                <label className="vt-field-label" htmlFor="vt-login-password">Mot de passe</label>
                <div className="vt-field-control">
                  <Lock size={17} strokeWidth={1.75} aria-hidden="true" />
                  <input
                    id="vt-login-password"
                    className="vt-has-toggle"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                  <button
                    type="button"
                    className="vt-field-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword
                      ? <EyeOff size={16} strokeWidth={1.75} aria-hidden="true" />
                      : <Eye size={16} strokeWidth={1.75} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <button type="button" className="vt-link" onClick={() => setIsForgotView(true)}>Mot de passe oublié&nbsp;?</button>

              <button type="submit" className="vt-btn vt-btn-primary vt-btn-block" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={18} aria-label="Connexion en cours" />
                ) : (
                  <>
                    <Lock size={16} strokeWidth={1.75} aria-hidden="true" />
                    Se connecter
                  </>
                )}
              </button>

              {GOOGLE_CLIENT_ID && (
                <>
                  <p className="vt-or">ou</p>
                  <div className="vt-google"><div ref={googleButtonRef} /></div>
                </>
              )}

              <p className="vt-auth-note">
                <HelpCircle size={14} strokeWidth={1.75} aria-hidden="true" />
                Problème de connexion&nbsp;? Contactez l'administrateur de votre clinique.
              </p>
            </form>
          ) : (
            <form key="register" onSubmit={handleRegisterSubmit} className="vt-form">
              <div className="vt-field">
                <label className="vt-field-label" htmlFor="vt-register-clinic">Nom de la clinique *</label>
                <div className="vt-field-control">
                  <Building2 size={17} strokeWidth={1.75} aria-hidden="true" />
                  <input
                    id="vt-register-clinic"
                    type="text"
                    autoComplete="organization"
                    placeholder="Ex : Cabinet Médical Saint-Jean"
                    value={clinicName}
                    onChange={e => setClinicName(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              <div className="vt-field">
                <label className="vt-field-label" htmlFor="vt-register-admin">Nom du responsable *</label>
                <div className="vt-field-control">
                  <User size={17} strokeWidth={1.75} aria-hidden="true" />
                  <input
                    id="vt-register-admin"
                    type="text"
                    autoComplete="name"
                    placeholder="Ex : Dr Koné Aminata"
                    value={adminName}
                    onChange={e => setAdminName(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              <div className="vt-field">
                <label className="vt-field-label" htmlFor="vt-register-email">Adresse e-mail *</label>
                <div className="vt-field-control">
                  <Mail size={17} strokeWidth={1.75} aria-hidden="true" />
                  <input
                    id="vt-register-email"
                    type="email"
                    autoComplete="email"
                    placeholder="Ex : contact@saintjean.ci"
                    value={registerEmail}
                    onChange={e => setRegisterEmail(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              {/* PhoneInput ne transmet pas d'id à son champ : le groupe porte le libellé. */}
              <div className="vt-field" role="group" aria-labelledby="vt-register-phone-label">
                <span className="vt-field-label" id="vt-register-phone-label">Téléphone (Mobile Money) *</span>
                <div className="vt-field-phone">
                  <PhoneInput value={phone} onChange={setPhone} disabled={isSubmitting} required />
                </div>
              </div>

              <div className="vt-field">
                <label className="vt-field-label" htmlFor="vt-register-password">Mot de passe *</label>
                <div className="vt-field-control">
                  <Lock size={17} strokeWidth={1.75} aria-hidden="true" />
                  <input
                    id="vt-register-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Minimum 8 caractères"
                    value={registerPassword}
                    onChange={e => setRegisterPassword(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="vt-btn vt-btn-primary vt-btn-block" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" size={18} aria-label="Inscription en cours" /> : "S'inscrire et commencer"}
              </button>
            </form>
          )}

          <p className="vt-auth-secure">
            <ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" />
            Connexion chiffrée et données protégées
          </p>
          <p className="vt-auth-help">
            Besoin d'aide&nbsp;? <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">Écrivez-nous sur WhatsApp</a>
          </p>
        </div>
      </main>
    </div>
  );
};

export default AuthPage;
