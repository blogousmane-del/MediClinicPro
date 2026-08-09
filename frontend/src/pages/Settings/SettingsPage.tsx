import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { SkeletonCards, SkeletonTableRows } from '../../components/Skeleton';
import {
  Search,
  Bell,
  Check,
  X,
  Plus,
  Star,
  Zap
} from 'lucide-react';
import { PhoneInput } from '../../components/PhoneInput';
import { PaymentCheckoutModal } from '../../components/PaymentCheckoutModal';
import { PasswordChangeForm } from '../../components/PasswordChangeForm';

interface DaySchedule {
  day: number; // 0=Dimanche..6=Samedi (JS Date.getDay())
  off: boolean;
  start: string; // HH:MM, meaningless when off
  end: string;   // HH:MM, meaningless when off
}

interface StaffUser {
  id: number;
  name: string;
  email: string;
  role: string;
  active: number;
  work_schedule?: DaySchedule[] | null;
}

interface SupportTicket {
  id: number;
  subject: string;
  category: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  resolution_note: string | null;
  created_at: string;
}

const WEEKDAY_SHORT: Record<number, string> = { 0: 'Dim', 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Jeu', 5: 'Ven', 6: 'Sam' };
const ORDERED_WEEK = [1, 2, 3, 4, 5, 6, 0];
const DEFAULT_SCHEDULE: DaySchedule[] = ORDERED_WEEK.map(day => ({
  day,
  off: day === 0 || day === 6,
  start: '08:00',
  end: '17:00'
}));

function formatSchedule(st: StaffUser): string | null {
  if (!st.work_schedule || st.work_schedule.length === 0) return null;
  const byDay = new Map(st.work_schedule.map(e => [e.day, e]));
  const parts = ORDERED_WEEK
    .map(d => byDay.get(d))
    .filter((e): e is DaySchedule => !!e && !e.off)
    .map(e => `${WEEKDAY_SHORT[e.day]} ${e.start.slice(0, 5)}-${e.end.slice(0, 5)}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export const SettingsPage: React.FC = () => {
  const { user: currentUser, clinic, renewSubscription, pollSubscriptionStatus, activateFreePlan, refreshProfile } = useAuth();
  const { showToast } = useNotifications();

  const [activeSubTab, setActiveSubTab] = useState<'billing' | 'clinic' | 'users' | 'security' | 'support'>('billing');
  const [loading, setLoading] = useState<boolean>(true);

  // Clinic config form states
  const [clinicName, setClinicName] = useState<string>('');
  const [clinicAddress, setClinicAddress] = useState<string>('');
  const [clinicPhone, setClinicPhone] = useState<string>('');
  const [tariffs, setTariffs] = useState<any>({});
  const [isSavingClinic, setIsSavingClinic] = useState<boolean>(false);

  // Staff users states
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserPass, setNewUserPass] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<string>('doctor');
  const [newUserSchedule, setNewUserSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE);
  const [newUserSpecialty, setNewUserSpecialty] = useState<string>('');
  const [isSavingUser, setIsSavingUser] = useState<boolean>(false);

  // Billing & Subscription states
  const [paymentPhone, setPaymentPhone] = useState<string>('');
  const [renewMonths, setRenewMonths] = useState<number>(1);
  const [isRenewing, setIsRenewing] = useState<boolean>(false);
  const [activeCheckout, setActiveCheckout] = useState<{ checkoutUrl: string; subscriptionPaymentId: number; provider: string } | null>(null);
  // État du retour depuis la page Chariow (voir l'effet plus bas).
  const [returnState, setReturnState] = useState<'idle' | 'checking' | 'paid' | 'failed' | 'slow'>('idle');
  const [plansCatalog, setPlansCatalog] = useState<Record<string, any> | null>(null);
  // null (not a guessed default like 'hopital') until the real value loads —
  // a fake default here previously let the renewal form render with a
  // 0 FCFA price before/without a successful fetch (see fetchPlansData).
  const [currentPlanId, setCurrentPlanId] = useState<'starter' | 'clinique' | 'hopital' | null>(null);
  const [activeStaffCount, setActiveStaffCount] = useState<number>(0);
  const [selectedPaidPlan, setSelectedPaidPlan] = useState<'clinique' | 'hopital' | null>(null);
  const [isActivatingFree, setIsActivatingFree] = useState<boolean>(false);

  // Support ticket states
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketSubject, setTicketSubject] = useState<string>('');
  const [ticketCategory, setTicketCategory] = useState<string>('general');
  const [ticketMessage, setTicketMessage] = useState<string>('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState<boolean>(false);

  const renewalTargetPlanId: 'clinique' | 'hopital' | null =
    selectedPaidPlan || (currentPlanId === 'clinique' || currentPlanId === 'hopital' ? currentPlanId : null);
  const pricePerMonth = (renewalTargetPlanId && plansCatalog?.[renewalTargetPlanId]?.price) || 0;
  const trialDaysLeft = clinic?.subscription_expires_at
    ? Math.max(0, Math.ceil((new Date(clinic.subscription_expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  const fetchClinicDetails = async () => {
    try {
      setLoading(true);
      const data = await api.get('/settings/clinic');
      setClinicName(data.name);
      setClinicAddress(data.address || '');
      setClinicPhone(data.phone || '');
      setTariffs(data.settings?.tariffs || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffUsers = async () => {
    try {
      setLoading(true);
      const data = await api.get('/settings/users');
      setStaff(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlansData = async () => {
    try {
      setLoading(true);
      const data = await api.get('/settings/plans');
      setPlansCatalog(data.plans);
      setCurrentPlanId(data.currentPlan);
      setActiveStaffCount(data.activeStaffCount || 0);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur de chargement', err.error || "Impossible de charger les plans d'abonnement.");
    } finally {
      setLoading(false);
    }
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const data = await api.get('/settings/tickets');
      setTickets(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'clinic') {
      fetchClinicDetails();
    } else if (activeSubTab === 'users') {
      fetchStaffUsers();
    } else if (activeSubTab === 'billing') {
      fetchPlansData();
    } else if (activeSubTab === 'support') {
      fetchTickets();
    } else {
      setLoading(false);
    }
  }, [activeSubTab]);

  const handleUpdateClinicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingClinic(true);
    try {
      const payload = {
        name: clinicName,
        address: clinicAddress,
        phone: clinicPhone,
        settings: {
          ...clinic?.settings,
          tariffs
        }
      };

      await api.put('/settings/clinic', payload);
      showToast('success', 'Paramètres mis à jour', 'Les informations de la clinique ont été enregistrées.');
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur de sauvegarde', err.error || 'Impossible d\'enregistrer les modifications.');
    } finally {
      setIsSavingClinic(false);
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail || !newUserPass || !newUserRole) {
      showToast('error', 'Champs requis', 'Veuillez renseigner tous les champs obligatoires.');
      return;
    }

    const isSchedulable = newUserRole === 'doctor' || newUserRole === 'nurse';
    if (isSchedulable && newUserSchedule.every(d => d.off)) {
      showToast('error', 'Horaire requis', 'Sélectionnez au moins un jour de travail pour ce collaborateur.');
      return;
    }

    setIsSavingUser(true);
    try {
      const payload = {
        name: newUserName,
        email: newUserEmail,
        password: newUserPass,
        role: newUserRole,
        ...(newUserRole === 'doctor' ? { specialty: newUserSpecialty || undefined } : {}),
        ...(isSchedulable ? {
          workSchedule: newUserSchedule.map(d => d.off
            ? { day: d.day, off: true }
            : { day: d.day, off: false, start: d.start, end: d.end })
        } : {})
      };

      await api.post('/settings/users', payload);
      showToast('success', 'Compte créé', `Le compte de ${newUserName} a été configuré.`);
      setIsUserModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPass('');
      setNewUserSchedule(DEFAULT_SCHEDULE);
      setNewUserSpecialty('');
      fetchStaffUsers();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur de création', err.error || 'Impossible d\'ajouter l\'utilisateur.');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleToggleUserStatus = async (userId: number, currentActive: number) => {
    try {
      const nextActive = currentActive === 1 ? 0 : 1;
      await api.put(`/settings/users/${userId}`, { active: nextActive });
      showToast('success', 'Statut modifié', 'Le statut d\'accès a été mis à jour.');
      fetchStaffUsers();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', err.error || 'Impossible de modifier le statut.');
    }
  };

  const handleRenewSubmit = async () => {
    if (!renewalTargetPlanId) return;

    setIsRenewing(true);
    try {
      const result = await renewSubscription(paymentPhone || undefined, renewMonths, renewalTargetPlanId);
      setActiveCheckout(result);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Échec du paiement', err.error || 'Impossible d\'initialiser le renouvellement.');
    } finally {
      setIsRenewing(false);
    }
  };

  // Retour depuis la page Chariow : ?checkout=chariow&sub=<id>. Le paramètre
  // d'URL n'est JAMAIS une preuve de paiement — il ne sert qu'à savoir quelle
  // ligne faire vérifier par le serveur, seul juge. Utile quand l'acheteur a
  // fermé l'onglet de la fenêtre de suivi : sans ce rattrapage, il attendrait
  // le cron du lendemain.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') !== 'chariow') return;
    const subId = parseInt(params.get('sub') || '', 10);
    if (!Number.isInteger(subId)) return;

    // L'URL est nettoyée tout de suite : un rechargement ne doit pas relancer
    // une vérification déjà faite.
    window.history.replaceState({}, '', window.location.pathname);

    let cancelled = false;
    let attempts = 0;
    setReturnState('checking');

    const poll = async () => {
      attempts += 1;
      try {
        const { status } = await pollSubscriptionStatus(subId);
        if (cancelled) return;
        if (status === 'paid') {
          setReturnState('paid');
          showToast('success', 'Abonnement activé', 'Votre paiement a été confirmé.');
          fetchPlansData();
          return;
        }
        if (status === 'failed') {
          setReturnState('failed');
          return;
        }
      } catch {
        // Une erreur réseau ne prouve pas un échec de paiement : on retente.
      }
      if (attempts >= 15) { // ~45 s
        if (!cancelled) setReturnState('slow');
        return;
      }
      if (!cancelled) setTimeout(poll, 3000);
    };

    poll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleActivateFree = async () => {
    setIsActivatingFree(true);
    try {
      await activateFreePlan();
      showToast('success', 'Plan Starter activé', 'Vous bénéficiez de 7 jours d\'utilisation gratuite.');
      fetchPlansData();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', err.error || 'Impossible d\'activer ce plan.');
    } finally {
      setIsActivatingFree(false);
    }
  };

  const handleCreateTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject || !ticketMessage) {
      showToast('error', 'Champs requis', 'Veuillez renseigner le sujet et le message.');
      return;
    }

    setIsSubmittingTicket(true);
    try {
      await api.post('/settings/tickets', { subject: ticketSubject, category: ticketCategory, message: ticketMessage });
      showToast('success', 'Ticket envoyé', 'Votre demande a été transmise au support.');
      setTicketSubject('');
      setTicketMessage('');
      setTicketCategory('general');
      fetchTickets();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', err.error || "Impossible d'envoyer le ticket.");
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const PLAN_CARD_META: Record<'starter' | 'clinique' | 'hopital', { badge: string; note: string; ctaLabel: string }> = {
    starter: { badge: 'Gratuit', note: 'Aucune carte bancaire requise', ctaLabel: "Démarrer l'essai gratuit" },
    clinique: { badge: 'Populaire', note: 'Renouvellement mensuel automatique', ctaLabel: 'Choisir Clinique' },
    hopital: { badge: 'Tout inclus', note: 'Idéal pour les cliniques multi-praticiens', ctaLabel: 'Choisir Hôpital' }
  };

  // Comparison rows are derived from the real plan config (staffLimit/allowedRoles/
  // paymentMethods), never hardcoded, so the excluded/included markers can't drift
  // from what the backend actually enforces.
  const buildFeatureRows = (planData: any): { label: string; ok: boolean }[] => {
    const staffLabel = planData.staffLimit === null || planData.staffLimit === undefined
      ? "Utilisateurs & rôles illimités"
      : `${planData.staffLimit} utilisateurs${planData.allowedRoles ? ' & rôles restreints' : ' & rôles illimités'}`;
    return [
      { label: staffLabel, ok: true },
      { label: 'Patients & Dossiers illimités', ok: true },
      { label: 'Rendez-vous, Ordonnances & Pharmacie', ok: true },
      { label: 'Laboratoire & Comptabilité', ok: true },
      // « Encaissements Mobile Money » retiré ici comme dans LandingPage.tsx :
      // l'encaissement patient en ligne disparaît avec le passage à Chariow.
      { label: 'Paiement Espèces', ok: true }
    ];
  };

  const roleLabels: Record<string, string> = {
    admin: 'Administrateur',
    doctor: 'Médecin',
    secretary: 'Secrétaire',
    pharmacist: 'Pharmacien',
    lab_tech: 'Laborantin',
    manager: 'Gestionnaire',
    nurse: 'Infirmier(ère)'
  };

  const ticketCategoryLabels: Record<string, string> = { facturation: 'Facturation', bug: 'Bug technique', general: 'Question générale', autre: 'Autre' };
  const ticketStatusLabels: Record<string, string> = { open: 'Ouvert', in_progress: 'En cours', resolved: 'Résolu', closed: 'Fermé' };
  const ticketStatusBadges: Record<string, string> = { open: 'badge-warning', in_progress: 'badge-info', resolved: 'badge-success', closed: 'badge-danger' };

  const updateScheduleDay = (day: number, patch: Partial<DaySchedule>) => {
    setNewUserSchedule(newUserSchedule.map(d => d.day === day ? { ...d, ...patch } : d));
  };

  return (
    <>
      <style>{`
        .settings-page {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          padding: 1.25rem 1.5rem;
          background-color: var(--bg-primary);
          min-height: calc(100vh - var(--header-height));
          box-sizing: border-box;
        }

        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .settings-header-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .settings-search-box {
          position: relative;
          width: 220px;
        }
        .settings-search-box input {
          width: 100%;
          padding: 8px 12px 8px 34px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background-color: var(--bg-secondary);
          font-size: 0.85rem;
          outline: none;
          color: var(--text-primary);
        }

        .settings-nav-tabs {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          padding-bottom: 2px;
          -webkit-overflow-scrolling: touch;
        }

        .settings-tab-btn {
          padding: 8px 16px;
          border-radius: 10px;
          border: 1px solid var(--border);
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }
        .settings-tab-btn.active {
          background-color: #1e4d40;
          color: #ffffff;
          border-color: #1e4d40;
        }
        .settings-tab-btn.inactive {
          background-color: var(--bg-secondary);
          color: var(--text-secondary);
        }

        .settings-billing-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
          gap: 1.25rem;
          align-items: start;
        }

        .plan-cards-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }

        @media (min-width: 850px) {
          .plan-cards-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        .settings-form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        /* Mobile Adjustments (<= 850px) */
        @media (max-width: 850px) {
          .settings-billing-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .settings-page {
            padding: 1rem 0.875rem;
            gap: 1rem;
          }
          .settings-header {
            flex-direction: column;
            align-items: stretch;
          }
          .settings-header-right {
            justify-content: flex-end;
          }
          .settings-search-box {
            flex: 1;
            width: auto;
            max-width: 200px;
          }
          .settings-form-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="settings-page">
        
        {/* 1. Top Header */}
        <div className="settings-header">
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-secondary)', color: 'var(--text-primary)', margin: 0 }}>
              Gestion des abonnements
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '2px', margin: 0 }}>
              Lundi 14 juillet 2025
            </p>
          </div>

          <div className="settings-header-right">
            <div className="settings-search-box">
              <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Rechercher..."
                className="input-control"
              />
            </div>

            <div style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)'
              }}>
                <Bell size={18} />
              </div>
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                backgroundColor: '#ef4444',
                color: 'white',
                fontSize: '0.68rem',
                fontWeight: 700,
                width: '17px',
                height: '17px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--bg-primary)'
              }}>3</span>
            </div>
          </div>
        </div>

        {/* Subtab Navigation Pills */}
        <div className="settings-nav-tabs">
          <button
            onClick={() => setActiveSubTab('billing')}
            className={`settings-tab-btn ${activeSubTab === 'billing' ? 'active' : 'inactive'}`}
          >
            Abonnez-vous
          </button>

          <button
            onClick={() => setActiveSubTab('clinic')}
            className={`settings-tab-btn ${activeSubTab === 'clinic' ? 'active' : 'inactive'}`}
          >
            Informations Clinique
          </button>

          {currentUser?.role === 'admin' && (
            <button
              onClick={() => setActiveSubTab('users')}
              className={`settings-tab-btn ${activeSubTab === 'users' ? 'active' : 'inactive'}`}
            >
              Gestion des Utilisateurs
            </button>
          )}

          <button
            onClick={() => setActiveSubTab('security')}
            className={`settings-tab-btn ${activeSubTab === 'security' ? 'active' : 'inactive'}`}
          >
            Sécurité
          </button>

          <button
            onClick={() => setActiveSubTab('support')}
            className={`settings-tab-btn ${activeSubTab === 'support' ? 'active' : 'inactive'}`}
          >
            Support
          </button>
        </div>

        {/* TAB 1: ABONNEZ-VOUS — Choisir un plan */}
        {activeSubTab === 'billing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Header — centered eyebrow + title, matches Banani's "Abonnement — Choisir un plan" screen */}
            <div style={{ textAlign: 'center', maxWidth: '560px', margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '10px' }}>
                <Star size={14} color="#1e4d40" fill="#1e4d40" />
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e4d40', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Nos formules
                </span>
              </div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0', fontFamily: 'var(--font-secondary)' }}>
                Choisissez votre plan
              </h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>
                {clinic?.subscription_status === 'expired'
                  ? "Abonnement expiré — choisissez un plan ci-dessous pour réactiver l'écriture des données."
                  : 'Commencez gratuitement, évoluez selon vos besoins. Sans engagement.'}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '6px 0 0 0' }}>
                Plan {(currentPlanId && plansCatalog?.[currentPlanId]?.name) || ''}
                {clinic?.subscription_expires_at && ` · ${clinic.subscription_status === 'trial' ? "Essai jusqu'au" : 'Renouvellement le'} ${new Date(clinic.subscription_expires_at).toLocaleDateString('fr-FR')}`}
                {' · '}{activeStaffCount} collaborateur{activeStaffCount > 1 ? 's' : ''} actif{activeStaffCount > 1 ? 's' : ''}
              </p>
            </div>

            {/* Upgrade nudge for Starter (free-trial) users — points at Hôpital,
                the tier with no staff/role limits and Mobile Money enabled. */}
            {!loading && plansCatalog && currentPlanId === 'starter' && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
                backgroundColor: '#fff7e6', border: '1px solid #f0c987', borderRadius: '14px', padding: '1rem 1.25rem',
                maxWidth: '900px', margin: '0 auto', width: '100%', boxSizing: 'border-box'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Zap size={18} color="#b8860b" style={{ flexShrink: 0 }} />
                  <p style={{ fontWeight: 700, color: '#7a5b12', margin: 0, fontSize: '0.85rem' }}>
                    {trialDaysLeft !== null && `Il vous reste ${trialDaysLeft} jour${trialDaysLeft > 1 ? 's' : ''} d'essai. `}
                    Passez au plan Hôpital pour débloquer les utilisateurs et les rôles illimités.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPaidPlan('hopital')}
                  style={{ backgroundColor: '#1e4d40', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '9px 16px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  Passer au plan Hôpital
                </button>
              </div>
            )}

            {loading && (
              <SkeletonCards count={3} height={360} grid minWidth="260px" gap="1.25rem" label="Chargement des plans…" />
            )}

            {!loading && plansCatalog && (
              <div className="plan-cards-grid">
                {(['starter', 'clinique', 'hopital'] as const).map(planId => {
                  const planData = plansCatalog[planId];
                  if (!planData) return null;
                  const isCurrent = planId === currentPlanId;
                  const isSelectedForRenewal = planId !== 'starter' && renewalTargetPlanId === planId;
                  const isHighlighted = planId === 'hopital'; // permanent marketing highlight on the top tier, matches Banani, independent of what's actually subscribed
                  const meta = PLAN_CARD_META[planId];
                  const featureRows = buildFeatureRows(planData);

                  return (
                    <div
                      key={planId}
                      style={{
                        position: 'relative',
                        backgroundColor: isHighlighted ? '#e6f4ea' : 'var(--bg-secondary)',
                        border: isHighlighted ? '1px solid #1e4d40' : '1px solid var(--border)',
                        borderRadius: '16px',
                        padding: '1.5rem 1.25rem',
                        boxShadow: isHighlighted ? '0 4px 14px rgba(30, 77, 64, 0.1)' : '0 2px 8px rgba(0,0,0,0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.1rem'
                      }}
                    >
                      {isCurrent && (
                        <span style={{
                          position: 'absolute', top: '1.1rem', right: '1.1rem',
                          fontSize: '0.65rem', fontWeight: 800, color: '#1e4d40',
                          backgroundColor: '#bbf7d0', padding: '3px 9px', borderRadius: '999px',
                          textTransform: 'uppercase', letterSpacing: '0.03em'
                        }}>
                          Plan actuel
                        </span>
                      )}

                      {/* Badge row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: isCurrent ? '5.5rem' : 0 }}>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: '6px',
                          backgroundColor: isHighlighted ? '#1e4d40' : (planId === 'clinique' ? '#d4e0dc' : 'var(--bg-primary)'),
                          color: isHighlighted ? '#ffffff' : '#1e4d40'
                        }}>
                          {meta.badge}
                        </span>
                        {isHighlighted && <Zap size={14} color="#1e4d40" />}
                      </div>

                      {/* Price block */}
                      <div>
                        <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 4px 0' }}>
                          {planData.name}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
                          <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                            {planData.price === 0 ? '0' : planData.price.toLocaleString()}
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: '2px' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>FCFA</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {planData.price === 0 ? `${planData.trialDays} jours` : '/ mois'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border)' }} />

                      {/* Feature comparison rows — included and excluded both shown, matching Banani */}
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1 }}>
                        {featureRows.map((row, i) => (
                          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                            <span style={{
                              width: '16px', height: '16px', borderRadius: '999px', flexShrink: 0, marginTop: '1px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              backgroundColor: row.ok ? 'rgba(30, 77, 64, 0.12)' : 'var(--bg-primary)'
                            }}>
                              {row.ok ? <Check size={10} color="#1e4d40" /> : <X size={10} color="var(--text-muted)" />}
                            </span>
                            <span style={{
                              fontSize: '0.82rem', lineHeight: 1.25,
                              color: row.ok ? 'var(--text-primary)' : 'var(--text-muted)',
                              textDecoration: row.ok ? 'none' : 'line-through'
                            }}>
                              {row.label}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {/* CTA + note */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {isCurrent ? (
                          <div style={{ width: '100%', padding: '9px 14px', borderRadius: '10px', textAlign: 'center', fontWeight: 700, fontSize: '0.85rem', backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                            Plan actuel
                          </div>
                        ) : planId === 'starter' ? (
                          <button
                            type="button"
                            onClick={handleActivateFree}
                            disabled={isActivatingFree}
                            className="btn"
                            style={{ width: '100%', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '9px 14px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                          >
                            {isActivatingFree ? 'Activation...' : meta.ctaLabel}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedPaidPlan(planId as 'clinique' | 'hopital')}
                            className="btn"
                            style={{
                              width: '100%',
                              backgroundColor: isSelectedForRenewal ? '#1e4d40' : (isHighlighted ? '#1e4d40' : 'var(--bg-primary)'),
                              color: isSelectedForRenewal || isHighlighted ? '#ffffff' : 'var(--text-primary)',
                              border: isSelectedForRenewal || isHighlighted ? 'none' : '1px solid var(--border)',
                              borderRadius: '10px',
                              padding: '9px 14px',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              cursor: 'pointer'
                            }}
                          >
                            {isSelectedForRenewal ? 'Sélectionné ✓' : meta.ctaLabel}
                          </button>
                        )}
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
                          {meta.note}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Comparison note bar — softened vs. Banani's copy: dropped the "support email"
                claim (no support channel exists in this app, same reasoning that removed a
                fake WhatsApp link elsewhere), kept only verifiable claims. */}
            {!loading && plansCatalog && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
                <div style={{ flex: 1, borderTop: '1px solid var(--border)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Tous les plans incluent : accès web & mobile, mises à jour incluses, changement de plan à tout moment
                  </span>
                </div>
                <div style={{ flex: 1, borderTop: '1px solid var(--border)' }} />
              </div>
            )}

            {returnState !== 'idle' && (
              <div className="card" style={{ maxWidth: '900px', margin: '0 auto', width: '100%', padding: '1rem' }}>
                {returnState === 'checking' && 'Vérification du paiement en cours...'}
                {returnState === 'paid' && 'Paiement confirmé, votre abonnement est activé.'}
                {returnState === 'failed' && "Le paiement n'a pas abouti. Aucun montant n'a été prélevé par MediClinic."}
                {/* Ni succès ni échec annoncé : le paiement peut très bien être
                    réglé et la confirmation en retard. Le cron quotidien
                    finalisera, il ne faut surtout pas faire repayer. */}
                {returnState === 'slow' && "Paiement en cours de validation. Votre abonnement sera activé automatiquement dès confirmation — inutile de payer à nouveau."}
              </div>
            )}

            {/* Étape de paiement — apparaît une fois un plan payant sélectionné.
                Un seul canal depuis le passage à Chariow : sa page hébergée
                propose elle-même Mobile Money et carte bancaire. */}
            {!loading && renewalTargetPlanId && (
              <div className="card" style={{ maxWidth: '900px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>Régler l'abonnement {plansCatalog?.[renewalTargetPlanId]?.name}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Votre abonnement est activé dès la confirmation du paiement.
                  </p>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Durée</span>
                    <select
                      className="input-control"
                      value={renewMonths}
                      onChange={(e) => setRenewMonths(parseInt(e.target.value, 10))}
                    >
                      <option value={1}>1 mois</option>
                      <option value={3}>3 mois</option>
                      <option value={6}>6 mois</option>
                      <option value={12}>12 mois</option>
                    </select>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Téléphone Mobile Money (optionnel)</span>
                    {/* PhoneInput rend un E.164 ; AuthContext en dérive le pays
                        et le numéro national, que Chariow exige séparément. */}
                    <PhoneInput value={paymentPhone} onChange={setPaymentPhone} />
                  </label>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Total</span>
                    <strong style={{ fontSize: '1.2rem' }}>
                      {(renewMonths * pricePerMonth).toLocaleString()} FCFA
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isRenewing}
                    onClick={handleRenewSubmit}
                  >
                    {isRenewing ? 'Initialisation...' : 'Payer par Mobile Money ou carte'}
                  </button>
                </div>

                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
                  Le paiement se fait sur une page sécurisée où vous choisissez Mobile Money
                  (Orange Money, Wave, MTN) ou carte bancaire. Le montant est débité en FCFA.
                </p>
              </div>
            )}

          </div>
        )}

        {activeCheckout && (
          <PaymentCheckoutModal
            checkoutUrl={activeCheckout.checkoutUrl}
            provider={activeCheckout.provider}
            amountLabel={`${(renewMonths * pricePerMonth).toLocaleString()} FCFA`}
            // 'unknown' (montant suspect, fournisseur injoignable) est traité
            // comme 'pending' : ce n'est pas un échec prouvé, et afficher un
            // échec ferait repayer un client dont l'argent est peut-être déjà
            // parti. La fenêtre continue d'attendre, le cron finalisera.
            pollStatus={async () => {
              const { status } = await pollSubscriptionStatus(activeCheckout.subscriptionPaymentId);
              return { status: status === 'unknown' ? 'pending' : status };
            }}
            onSuccess={() => {
              showToast('success', 'Abonnement activé', `Votre plan a été activé/renouvelé pour ${renewMonths} mois.`);
              setActiveCheckout(null);
              setSelectedPaidPlan(null);
              fetchPlansData();
            }}
            onClose={() => setActiveCheckout(null)}
          />
        )}

        {/* TAB 2: INFORMATIONS CLINIQUE */}
        {activeSubTab === 'clinic' && loading && (
          <div style={{ maxWidth: '650px', width: '100%' }}>
            <SkeletonCards count={1} height={420} label="Chargement des informations de la clinique…" />
          </div>
        )}

        {activeSubTab === 'clinic' && !loading && (
          <form onSubmit={handleUpdateClinicSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '650px', width: '100%', boxSizing: 'border-box' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '8px', margin: 0 }}>Détails d'identification</h3>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Raison sociale / Nom de la clinique</label>
              <input type="text" value={clinicName} onChange={e => setClinicName(e.target.value)} className="input-control" required />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Adresse physique (Lieu géographique)</label>
              <input type="text" value={clinicAddress} onChange={e => setClinicAddress(e.target.value)} className="input-control" />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Téléphone professionnel</label>
              <PhoneInput value={clinicPhone} onChange={setClinicPhone} />
            </div>

            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginTop: '0.5rem', margin: 0 }}>Grille Tarifaire des Actes (FCFA)</h3>
            
            <div className="modal-grid">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Consultation Générale</label>
                <input
                  type="number"
                  value={tariffs.consultation_general || ''}
                  onChange={e => setTariffs({ ...tariffs, consultation_general: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                  className="input-control"
                />
              </div>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Consultation Spécialisée</label>
                <input
                  type="number"
                  value={tariffs.consultation_specialist || ''}
                  onChange={e => setTariffs({ ...tariffs, consultation_specialist: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                  className="input-control"
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', backgroundColor: '#1e4d40', borderRadius: '10px' }} disabled={isSavingClinic}>
              {isSavingClinic ? 'Sauvegarde...' : 'Enregistrer les paramètres'}
            </button>
          </form>
        )}

        {/* TAB 3: GESTION DES UTILISATEURS */}
        {activeSubTab === 'users' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
              <button onClick={() => setIsUserModalOpen(true)} className="btn btn-primary page-cta-btn" style={{ gap: '6px', backgroundColor: '#1e4d40', borderRadius: '10px' }}>
                <Plus size={16} />
                <span>Ajouter un collaborateur</span>
              </button>
            </div>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Nom Complet</th>
                    <th>Email d'identification</th>
                    <th>Poste / Rôle</th>
                    <th>Statut d'accès</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <SkeletonTableRows rows={4} cols={5} label="Chargement du personnel…" />}
                  {!loading && staff.map(st => (
                    <tr key={st.id} style={{ opacity: st.active === 0 ? 0.6 : 1 }}>
                      <td style={{ fontWeight: 600 }}>{st.name}</td>
                      <td>{st.email}</td>
                      <td>
                        <span className="badge badge-info">{roleLabels[st.role]}</span>
                        {formatSchedule(st) && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                            {formatSchedule(st)}
                          </div>
                        )}
                      </td>
                      <td>
                        {st.active === 1 ? (
                          <span className="badge badge-success">Actif</span>
                        ) : (
                          <span className="badge badge-danger">Désactivé</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {st.id !== currentUser?.id && (
                          <button
                            onClick={() => handleToggleUserStatus(st.id, st.active)}
                            className="btn btn-outline"
                            style={{ 
                              padding: '4px 8px', 
                              fontSize: '0.75rem',
                              borderColor: st.active === 1 ? 'var(--danger)' : 'var(--success)',
                              color: st.active === 1 ? 'var(--danger)' : 'var(--success)'
                            }}
                          >
                            {st.active === 1 ? 'Désactiver' : 'Activer'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* TAB 4: SÉCURITÉ */}
        {activeSubTab === 'security' && <PasswordChangeForm />}

        {/* TAB 5: SUPPORT */}
        {activeSubTab === 'support' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <form onSubmit={handleCreateTicketSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '520px', width: '100%', boxSizing: 'border-box' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '8px', margin: 0 }}>
                Contacter le support
              </h3>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Sujet *</label>
                <input type="text" value={ticketSubject} onChange={e => setTicketSubject(e.target.value)} className="input-control" required />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Catégorie *</label>
                <select value={ticketCategory} onChange={e => setTicketCategory(e.target.value)} className="input-control" required>
                  <option value="general">Question générale</option>
                  <option value="facturation">Facturation</option>
                  <option value="bug">Bug technique</option>
                  <option value="autre">Autre</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Message *</label>
                <textarea value={ticketMessage} onChange={e => setTicketMessage(e.target.value)} className="input-control" rows={4} required />
              </div>

              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', backgroundColor: '#1e4d40', borderRadius: '10px' }} disabled={isSubmittingTicket}>
                {isSubmittingTicket ? 'Envoi...' : 'Envoyer le ticket'}
              </button>
            </form>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Sujet</th>
                    <th>Catégorie</th>
                    <th>Statut</th>
                    <th>Créé le</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <SkeletonTableRows rows={3} cols={4} label="Chargement des tickets…" />}
                  {!loading && tickets.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 600 }}>
                        {t.subject}
                        {t.resolution_note && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                            {t.resolution_note}
                          </div>
                        )}
                      </td>
                      <td>{ticketCategoryLabels[t.category] || t.category}</td>
                      <td>
                        <span className={`badge ${ticketStatusBadges[t.status] || 'badge-info'}`}>
                          {ticketStatusLabels[t.status] || t.status}
                        </span>
                      </td>
                      <td>{new Date(t.created_at).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  ))}
                  {tickets.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>Aucun ticket envoyé.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CREATE STAFF USER MODAL */}
        {isUserModalOpen && (
          <div className="modal-backdrop" onClick={() => setIsUserModalOpen(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Nouveau Compte Collaborateur</h3>
                <button onClick={() => setIsUserModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
              </div>

              <form onSubmit={handleCreateUserSubmit}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group">
                    <label>Nom Complet *</label>
                    <input type="text" placeholder="Nom et Prénoms" value={newUserName} onChange={e => setNewUserName(e.target.value)} className="input-control" required />
                  </div>
                  
                  <div className="form-group">
                    <label>Email d'identification *</label>
                    <input type="email" placeholder="Ex: collaborateur@saintjean.ci" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} className="input-control" required />
                  </div>

                  <div className="form-group">
                    <label>Mot de passe initial *</label>
                    <input type="password" placeholder="Minimum 8 caractères" value={newUserPass} onChange={e => setNewUserPass(e.target.value)} className="input-control" required />
                  </div>

                  <div className="form-group">
                    <label>Rôle / Profil d'accès *</label>
                    <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} className="input-control" required>
                      <option value="doctor">Médecin / Praticien</option>
                      <option value="nurse">Infirmier(ère)</option>
                      <option value="secretary">Secrétaire / Accueil</option>
                      <option value="pharmacist">Pharmacien interne</option>
                      <option value="lab_tech">Technicien Laboratoire</option>
                      <option value="manager">Gestionnaire Financier</option>
                    </select>
                  </div>

                  {newUserRole === 'doctor' && (
                    <div className="form-group">
                      <label>Spécialité (optionnel)</label>
                      <input
                        type="text"
                        placeholder="Ex : Cardiologie, Pédiatrie, Médecine générale..."
                        value={newUserSpecialty}
                        onChange={e => setNewUserSpecialty(e.target.value)}
                        className="input-control"
                      />
                    </div>
                  )}

                  {(newUserRole === 'doctor' || newUserRole === 'nurse') && (
                    <div className="form-group">
                      <label>Horaire de travail *</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {ORDERED_WEEK.map(day => {
                          const entry = newUserSchedule.find(d => d.day === day)!;
                          return (
                            <div
                              key={day}
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 0',
                                borderBottom: '1px solid var(--border)'
                              }}
                            >
                              <span style={{ width: '38px', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                                {WEEKDAY_SHORT[day]}
                              </span>

                              <button
                                type="button"
                                onClick={() => updateScheduleDay(day, { off: !entry.off })}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '8px',
                                  border: `1px solid ${entry.off ? 'var(--border)' : 'var(--primary)'}`,
                                  backgroundColor: entry.off ? 'transparent' : 'var(--primary-light, #e6f4ea)',
                                  color: entry.off ? 'var(--text-muted)' : 'var(--primary)',
                                  fontWeight: 600,
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  flexShrink: 0
                                }}
                              >
                                {entry.off ? 'Absent' : 'Travaille'}
                              </button>

                              {!entry.off && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 190px', minWidth: '190px' }}>
                                  <input
                                    type="time"
                                    value={entry.start}
                                    onChange={e => updateScheduleDay(day, { start: e.target.value })}
                                    className="input-control"
                                    style={{ padding: '6px', flex: '1 1 85px', minWidth: '85px' }}
                                    required
                                  />
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', flexShrink: 0 }}>à</span>
                                  <input
                                    type="time"
                                    value={entry.end}
                                    onChange={e => updateScheduleDay(day, { end: e.target.value })}
                                    className="input-control"
                                    style={{ padding: '6px', flex: '1 1 85px', minWidth: '85px' }}
                                    required
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '8px 0 0' }}>
                        En dehors de ces jours/heures (ou un jour marqué "Absent"), ce collaborateur apparaîtra automatiquement "Absent" pour l'orientation des patients.
                      </p>
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <button type="button" onClick={() => setIsUserModalOpen(false)} className="btn btn-secondary">Annuler</button>
                  <button type="submit" className="btn btn-primary" disabled={isSavingUser} style={{ backgroundColor: '#1e4d40' }}>
                    {isSavingUser ? 'Création...' : 'Créer le compte'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default SettingsPage;
