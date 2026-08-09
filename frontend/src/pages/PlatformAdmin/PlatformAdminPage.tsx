import React, { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { NotificationsSection } from './NotificationsSection';
import SystemConfigSection from './sections/SystemConfigSection';
import SecuritySection from './sections/SecuritySection';
import ReportsSection from './sections/ReportsSection';
import { SkeletonCards, SkeletonPage } from '../../components/Skeleton';
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  Clock,
  LogOut,
  ArrowLeft,
  LifeBuoy,
  BarChart2,
  Shield,
  Settings as SettingsIcon,
  Activity,
  Megaphone,
  Plus,
  X
} from 'lucide-react';

// Date du jour en toutes lettres, comme le sous-titre de la maquette. Calculée
// à chaque rendu du module plutôt que figée : la console reste ouverte des
// heures, mais jamais au point de traverser deux jours sans rechargement.
const todayLabel = new Date().toLocaleDateString('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

interface NewClinicPayload {
  clinicName: string;
  adminName: string;
  email: string;
  password: string;
  phone: string;
}

interface ClinicOverview {
  id: number;
  name: string;
  address: string | null;
  plan: 'starter' | 'clinique' | 'hopital';
  status: 'active' | 'expired';
  unlimitedStaff: boolean;
  suspended: boolean;
  subscriptionExpiresAt: string | null;
  createdAt: string;
  practitioners: number;
  patients: number;
}

interface ActivityEntry {
  id: number;
  clinicName: string;
  action: string;
  details: string | null;
  createdAt: string;
}

interface Overview {
  stats: {
    clinicsActive: number;
    clinicsExpired: number;
    totalUsers: number;
    monthlyRevenue: number;
    currency: string;
    openTickets: number;
    // Variations sous chaque carte, comptées sur created_at / paid_at côté
    // serveur. `revenueDeltaPct` vaut null quand le mois précédent n'a rien
    // encaissé : un pourcentage à partir de zéro n'existe pas.
    clinicsNewThisMonth: number;
    usersNewThisMonth: number;
    lastMonthRevenue: number;
    revenueDeltaPct: number | null;
  };
  clinics: ClinicOverview[];
  expiringSoon: ClinicOverview[];
  recentActivity: ActivityEntry[];
  recentTickets: RecentTicket[];
}

interface PlatformUser {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
  clinicName: string;
  createdAt: string;
}

interface SubscriptionPayment {
  id: number;
  clinicName: string;
  months: number;
  amount: number;
  provider: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

interface SubscriptionsData {
  clinics: { id: number; name: string; subscriptionStatus: string; subscriptionExpiresAt: string | null }[];
  payments: SubscriptionPayment[];
}

interface SupportTicket {
  id: number;
  clinicId: number;
  clinicName: string;
  subject: string;
  category: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RecentTicket {
  id: number;
  clinicName: string;
  subject: string;
  status: string;
}

type Section = 'overview' | 'clinics' | 'users' | 'subscriptions' | 'tickets' | 'notifications' | 'reports' | 'security' | 'system';

const roleLabels: Record<string, string> = {
  admin: 'Administrateur',
  doctor: 'Médecin',
  secretary: 'Secrétaire',
  pharmacist: 'Pharmacien',
  lab_tech: 'Laborantin',
  manager: 'Gestionnaire',
  nurse: 'Infirmier(ère)'
};

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

interface PlatformAdminPageProps {
  onExit: () => void;
}

export const PlatformAdminPage: React.FC<PlatformAdminPageProps> = ({ onExit }) => {
  const { user, logout } = useAuth();
  const { showToast } = useNotifications();
  const [section, setSection] = useState<Section>('overview');

  const [overview, setOverview] = useState<Overview | null>(null);
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[] | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionsData | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [showNewClinic, setShowNewClinic] = useState<boolean>(false);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setLoading(true);
        const result = await api.get('/platform/overview');
        setOverview(result);
      } catch (err: any) {
        console.error(err);
        showToast('error', 'Erreur', err.error || "Impossible de charger le tableau de bord plateforme.");
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (section === 'users' && !platformUsers) {
      api.get('/platform/users')
        .then(setPlatformUsers)
        .catch((err: any) => showToast('error', 'Erreur', err.error || "Impossible de charger les utilisateurs."));
    }
    if (section === 'subscriptions' && !subscriptions) {
      api.get('/platform/subscriptions')
        .then(setSubscriptions)
        .catch((err: any) => showToast('error', 'Erreur', err.error || "Impossible de charger les abonnements."));
    }
    if (section === 'tickets') {
      const query = ticketStatusFilter ? `?status=${ticketStatusFilter}` : '';
      api.get(`/platform/tickets${query}`)
        .then(setTickets)
        .catch((err: any) => showToast('error', 'Erreur', err.error || "Impossible de charger les tickets."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, ticketStatusFilter]);

  const handleUpdateTicketStatus = async (ticketId: number, status: string, resolutionNote?: string) => {
    try {
      await api.put(`/platform/tickets/${ticketId}`, { status, resolutionNote });
      showToast('success', 'Ticket mis à jour', 'Le statut du ticket a été modifié.');
      const query = ticketStatusFilter ? `?status=${ticketStatusFilter}` : '';
      const updated = await api.get(`/platform/tickets${query}`);
      setTickets(updated);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', err.error || "Impossible de mettre à jour le ticket.");
    }
  };

  const handleCreateClinic = async (payload: NewClinicPayload) => {
    await api.post('/platform/clinics', payload);
    showToast('success', 'Clinique créée', `« ${payload.clinicName} » a été enregistrée avec son administrateur.`);
    setShowNewClinic(false);
    // La nouvelle clinique doit apparaître immédiatement dans la liste, et les
    // compteurs de la vue d'ensemble s'en trouvent changés : on relit la source
    // plutôt que d'insérer la ligne à la main dans l'état local.
    const result = await api.get('/platform/overview');
    setOverview(result);
    setPlatformUsers(null);
    setSection('clinics');
  };

  const handleToggleClinicOverride = async (clinicId: number, unlimited: boolean) => {
    try {
      await api.put(`/platform/clinics/${clinicId}/staff-override`, { unlimited });
      showToast('success', 'Mis à jour', unlimited ? 'Limite de personnel levée.' : 'Limite de personnel rétablie.');
      const result = await api.get('/platform/overview');
      setOverview(result);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', err.error || "Impossible de mettre à jour l'exception de personnel.");
    }
  };

  const handleToggleClinicSuspend = async (clinicId: number, suspended: boolean) => {
    if (suspended && !window.confirm("Suspendre cette clinique ? Tous ses utilisateurs perdront l'accès en écriture jusqu'à réactivation.")) {
      return;
    }
    try {
      await api.put(`/platform/clinics/${clinicId}/suspend`, { suspended });
      showToast('success', 'Mis à jour', suspended ? 'Clinique suspendue.' : 'Clinique réactivée.');
      const result = await api.get('/platform/overview');
      setOverview(result);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', err.error || "Impossible de mettre à jour le statut de la clinique.");
    }
  };

  const handleChangeClinicPlan = async (clinicId: number, plan: string) => {
    try {
      const result = await api.put(`/platform/clinics/${clinicId}/plan`, { plan });
      showToast('success', 'Plan mis à jour', result.message);
      const updated = await api.get('/platform/overview');
      setOverview(updated);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', err.error || "Impossible de changer le plan.");
    }
  };

  const handleToggleUserActive = async (userId: number, active: boolean) => {
    try {
      await api.put(`/platform/users/${userId}`, { active });
      showToast('success', 'Mis à jour', 'Le statut du compte a été modifié.');
      const updated = await api.get('/platform/users');
      setPlatformUsers(updated);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', err.error || "Impossible de mettre à jour le statut.");
    }
  };

  const handleSendNotification = async (payload: { title: string; body: string; targetAll: boolean; clinicIds?: number[] }) => {
    try {
      await api.post('/platform/notifications', payload);
      showToast('success', 'Notification envoyée', 'Les cliniques ciblées la verront dans leur cloche de notifications.');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', err.error || "Impossible d'envoyer la notification.");
      throw err;
    }
  };

  const navItems: { id: Section; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },
    { id: 'clinics', label: 'Cliniques', icon: Building2 },
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'subscriptions', label: 'Abonnements', icon: CreditCard },
    { id: 'tickets', label: 'Support', icon: LifeBuoy },
    { id: 'notifications', label: 'Notifications', icon: Megaphone },
    { id: 'reports', label: 'Rapports', icon: BarChart2 },
    { id: 'security', label: 'Sécurité', icon: Shield },
    { id: 'system', label: 'Config. système', icon: SettingsIcon }
  ];

  // Plus aucune section « Bientôt » : Rapports, Sécurité et Config. système
  // sont toutes implémentées (voir
  // docs/superpowers/specs/2026-08-06-platform-admin-sections-design.md).
  // Le tableau reste déclaré pour que le bloc de rendu ci-dessous, et son
  // style de nav désactivée, servent immédiatement à une éventuelle prochaine
  // section en préparation.
  const comingSoonItems: { label: string; icon: React.ElementType }[] = [];

  const sectionTitles: Record<Section, string> = {
    overview: "Vue d'ensemble",
    clinics: 'Cliniques enregistrées',
    users: 'Utilisateurs de la plateforme',
    subscriptions: 'Abonnements',
    tickets: 'Tickets support',
    notifications: 'Notifications aux cliniques',
    reports: 'Rapports',
    security: 'Sécurité de la plateforme',
    system: 'Configuration système'
  };

  return (
    <div className="platform-admin-shell" style={{ display: 'flex', minHeight: '100vh', width: '100%', backgroundColor: 'var(--bg-primary)' }}>
      {/* Dedicated admin sidebar — deliberately NOT the clinic Sidebar (no Patients/Rendez-vous/Ordonnances here) */}
      <aside className="platform-admin-sidebar" style={{
        width: '240px',
        minHeight: '100vh',
        backgroundColor: '#243333',
        color: '#E8EDEC',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div>
          <div className="platform-admin-sidebar-header" style={{ padding: '1.25rem 1.25rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src="/logo-icon.svg" alt="MediClinic" width={28} height={28} />
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#E8EDEC', fontFamily: "'DM Sans', sans-serif" }}>MediClinic</span>
            </div>
            <div style={{
              marginTop: '10px',
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: '6px',
              backgroundColor: 'rgba(61, 107, 94, 0.2)',
              color: '#5FA290',
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.04em'
            }}>
              Super Admin
            </div>
          </div>

          <nav className="platform-admin-sidebar-nav" style={{ padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = section === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: isActive ? '#E8EDEC' : 'rgba(232,237,236,0.6)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '0.875rem',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}

            <div className="platform-admin-sidebar-divider" style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '8px 4px' }} />

            {comingSoonItems.map(item => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="coming-soon-item"
                  title="Bientôt disponible"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    color: 'rgba(232,237,236,0.35)',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    cursor: 'not-allowed'
                  }}
                >
                  <Icon size={16} />
                  {item.label}
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255,255,255,0.06)'
                  }}>
                    Bientôt
                  </span>
                </div>
              );
            })}
          </nav>
        </div>

        <div className="platform-admin-sidebar-footer" style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button
            onClick={onExit}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: 'none', background: 'none', color: 'rgba(232,237,236,0.6)', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left' }}
          >
            <ArrowLeft size={15} />
            Retour à mon espace clinique
          </button>
          <button
            onClick={logout}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: 'none', background: 'none', color: 'rgba(232,237,236,0.6)', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left' }}
          >
            <LogOut size={15} />
            Se déconnecter
          </button>
          <div className="platform-admin-sidebar-username" style={{ padding: '10px 12px', fontSize: '0.75rem', color: 'rgba(232,237,236,0.5)' }}>{user?.name}</div>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Bandeau haut de la maquette Banani : titre + sous-titre à gauche,
            action à droite. La barre de recherche et la cloche de la maquette
            ne sont pas reprises — la recherche existe déjà dans chaque section
            qui en a une, et un compteur de notifications au niveau opérateur
            n'a aucune source. Même arbitrage que sur le TopBar de la partie
            clinique (voir .planning/banani/STATUS.md). */}
        <div className="platform-admin-main-header" style={{ padding: '1.25rem 2rem', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-secondary)', color: 'var(--text-primary)', margin: 0 }}>
              {sectionTitles[section]}
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {todayLabel} · Console d'administration
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewClinic(v => !v)}
            className="page-cta-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#3D6B5E', color: '#FFFFFF', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
          >
            {showNewClinic ? <X size={14} /> : <Plus size={14} />}
            {showNewClinic ? 'Fermer' : 'Nouvelle clinique'}
          </button>
        </div>

        <div className="platform-admin-main-body" style={{ padding: '1.5rem 2rem', flex: 1 }}>
          {/* Hors du bloc conditionnel ci-dessous : le formulaire doit rester
              accessible même si /platform/overview a échoué — créer une
              clinique ne dépend pas de la lecture du tableau de bord. */}
          {showNewClinic && (
            <NewClinicForm onSubmit={handleCreateClinic} onCancel={() => setShowNewClinic(false)} />
          )}
          {loading && !overview ? (
            <SkeletonPage cards={3} label="Chargement de la console…" />
          ) : (section === 'overview' || section === 'clinics') && !overview ? (
            <p style={{ color: 'var(--text-secondary)' }}>Aucune donnée disponible.</p>
          ) : (
            <>
              {section === 'overview' && overview && (
                <OverviewSection
                  overview={overview}
                  onViewTickets={() => setSection('tickets')}
                  onViewClinics={() => setSection('clinics')}
                />
              )}
              {section === 'clinics' && overview && (
                <ClinicsSection
                  onChangePlan={handleChangeClinicPlan}
                  clinics={overview.clinics}
                  onToggleOverride={handleToggleClinicOverride}
                  onToggleSuspend={handleToggleClinicSuspend}
                />
              )}
              {section === 'users' && (
                <UsersSection users={platformUsers} currentUserId={user?.id} onToggleActive={handleToggleUserActive} />
              )}
              {section === 'subscriptions' && <SubscriptionsSection data={subscriptions} />}
              {section === 'tickets' && (
                <TicketsSection
                  tickets={tickets}
                  statusFilter={ticketStatusFilter}
                  onStatusFilterChange={setTicketStatusFilter}
                  onUpdateStatus={handleUpdateTicketStatus}
                />
              )}
              {section === 'notifications' && (
                <NotificationsSection clinics={overview?.clinics.map(c => ({ id: c.id, name: c.name })) || []} onSend={handleSendNotification} />
              )}
              {section === 'reports' && <ReportsSection />}
              {section === 'security' && <SecuritySection />}
              {section === 'system' && <SystemConfigSection />}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Formulaire d'enrôlement d'une clinique par l'opérateur. Contrepartie de la
// page d'inscription publique : mêmes champs, mêmes règles côté serveur
// (POST /api/platform/clinics reprend celles de POST /auth/register). Le
// téléphone est le seul champ facultatif ici — l'opérateur enrôle parfois
// depuis un dossier papier incomplet.
const NewClinicForm: React.FC<{
  onSubmit: (payload: NewClinicPayload) => Promise<void>;
  onCancel: () => void;
}> = ({ onSubmit, onCancel }) => {
  const [form, setForm] = useState<NewClinicPayload>({
    clinicName: '', adminName: '', email: '', password: '', phone: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  const set = (key: keyof NewClinicPayload) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onSubmit(form);
    } catch (err: any) {
      // Le message du serveur est le plus précis (mot de passe trop court,
      // email déjà pris, téléphone invalide) : on l'affiche tel quel, dans le
      // formulaire, plutôt que de le réduire à un message générique.
      setError(err?.error || "La clinique n'a pas pu être créée.");
    } finally {
      setSubmitting(false);
    }
  };

  const field = (label: string, key: keyof NewClinicPayload, type = 'text', required = true, hint?: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}{!required && <span style={{ color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}> (facultatif)</span>}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={set(key)}
        required={required}
        style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem', width: '100%' }}
      />
      {hint && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{hint}</span>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Nouvelle clinique</h2>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
          Crée la clinique et son compte administrateur. Elle démarre sur le plan Starter, avec la durée d'essai réglée dans Config. système.
        </p>
      </div>

      <div className="new-clinic-fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
        {field('Nom de la clinique', 'clinicName')}
        {field("Nom de l'administrateur", 'adminName')}
        {field('Email', 'email', 'email')}
        {field('Mot de passe', 'password', 'password', true, 'Minimum 8 caractères')}
        {field('Téléphone', 'phone', 'tel', false)}
      </div>

      {error && (
        <p style={{ fontSize: '0.8rem', color: '#C0392B', margin: 0 }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="submit"
          disabled={submitting}
          style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#3D6B5E', color: '#FFFFFF', fontSize: '0.82rem', fontWeight: 700, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? 'Création…' : 'Créer la clinique'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
        >
          Annuler
        </button>
      </div>
    </form>
  );
};

// Réponse partielle de GET /api/platform/config — seuls les champs dont ce
// panneau a besoin. La section Config. système en lit une version complète.
interface HealthConfig {
  email: { channel: 'resend' | 'smtp' | 'console' };
  rateLimit: { backend: 'redis' | 'memory' };
  database: { connected: boolean };
}

type HealthLine = { label: string; status: string; ok: boolean };

// « Santé du système » de la maquette Banani, rendu à partir de mesures réelles.
// Banani en montre quatre lignes ; la quatrième, « Sauvegardes », n'a aucune
// source dans cette application — les sauvegardes Supabase ne sont pas visibles
// depuis l'API — donc elle n'est pas reprise plutôt qu'affichée en vert par
// défaut. Les trois autres sortent de GET /api/platform/config, plus la
// limitation de débit qui est une vraie information d'exploitation.
const SystemHealthPanel: React.FC = () => {
  const [config, setConfig] = useState<HealthConfig | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get<HealthConfig>('/platform/config')
      .then(data => { if (!cancelled) setConfig(data); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  const emailLabels: Record<HealthConfig['email']['channel'], HealthLine> = {
    resend: { label: 'E-mail', status: 'Opérationnel — Resend', ok: true },
    smtp: { label: 'E-mail', status: 'Opérationnel — SMTP', ok: true },
    // Aucun email ne part réellement dans ce mode : il est écrit dans les
    // journaux du serveur. C'est exactement l'état « Dégradé » de la maquette.
    console: { label: 'E-mail', status: 'Dégradé — journal console', ok: false }
  };

  const lines: HealthLine[] = config
    ? [
        // Cette réponse a voyagé par l'API : qu'elle soit là est la mesure.
        { label: 'API', status: 'Opérationnel', ok: true },
        {
          label: 'Base de données',
          status: config.database.connected ? 'Opérationnel' : 'Injoignable',
          ok: config.database.connected
        },
        emailLabels[config.email.channel],
        {
          label: 'Limitation de débit',
          status: config.rateLimit.backend === 'redis'
            ? 'Opérationnel — Redis'
            : 'Dégradé — mémoire locale',
          ok: config.rateLimit.backend === 'redis'
        }
      ]
    : [];

  return (
    <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Activity size={16} color="var(--text-muted)" />
        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Santé du système</h2>
      </div>

      {failed ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
          État indisponible — la configuration n'a pas pu être lue.
        </p>
      ) : !config ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Lecture de l'état…</p>
      ) : (
        lines.map(line => (
          // alignItems flex-start et pastille décalée d'un poil : sur une ligne
          // dont le statut passe à la ligne (colonne étroite, mobile), un
          // centrage vertical détachait la pastille du texte au lieu de la
          // poser en regard de sa première ligne.
          <div key={line.label} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', flexShrink: 0 }}>{line.label}</span>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', minWidth: 0 }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: line.ok ? '#3D8A6A' : '#D4813A',
                flexShrink: 0,
                marginTop: '5px'
              }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: line.ok ? '#3D8A6A' : '#D4813A', textAlign: 'right' }}>
                {line.status}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

const OverviewSection: React.FC<{
  overview: Overview;
  onViewTickets: () => void;
  onViewClinics: () => void;
}> = ({ overview, onViewTickets, onViewClinics }) => {
  const { stats, clinics, expiringSoon, recentActivity } = overview;

  // Quatre cartes, dans l'ordre de la maquette Banani. « Cliniques expirées »
  // a quitté cette rangée (choix utilisateur) — l'information reste lisible
  // dans l'onglet Cliniques, où chaque ligne porte son statut.
  //
  // Chaque `delta` décrit une mesure réelle ou l'absence de mesure. Aucune
  // formule ne produit ici de valeur qui ne vienne pas du serveur : la maquette
  // affiche « +3 ce mois » et « +8 % », mais ce sont des remplissages, et ce
  // projet a déjà eu à retirer des chiffres inventés du tableau de bord.
  const revenueDelta = stats.revenueDeltaPct !== null
    ? `${stats.revenueDeltaPct >= 0 ? '+' : ''}${stats.revenueDeltaPct} % vs mois dernier`
    : stats.lastMonthRevenue === 0
      ? 'Aucun encaissement le mois dernier'
      : '';

  const statCards = [
    {
      label: 'Cliniques actives',
      value: stats.clinicsActive.toLocaleString('fr-FR'),
      icon: Building2,
      delta: stats.clinicsNewThisMonth > 0 ? `+${stats.clinicsNewThisMonth} ce mois` : 'Aucune nouvelle ce mois'
    },
    {
      label: 'Utilisateurs totaux',
      value: stats.totalUsers.toLocaleString('fr-FR'),
      icon: Users,
      delta: stats.usersNewThisMonth > 0 ? `+${stats.usersNewThisMonth} ce mois` : 'Aucun nouveau ce mois'
    },
    {
      label: 'Revenu du mois',
      value: stats.monthlyRevenue.toLocaleString('fr-FR'),
      unit: 'FCFA',
      icon: TrendingUp,
      delta: revenueDelta
    },
    {
      label: 'Tickets support',
      value: stats.openTickets.toLocaleString('fr-FR'),
      icon: LifeBuoy,
      // Banani affiche « 3 urgents » ; support_tickets n'a pas de colonne de
      // priorité, donc cette ligne décrit l'état, elle ne le chiffre pas.
      delta: stats.openTickets > 0 ? 'En attente de traitement' : 'Aucun ticket ouvert'
    }
  ];

  return (
    <div>
      <div className="grid-cols-4">
        {statCards.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</span>
                <div className="stat-icon-box">
                  <Icon size={15} color="#3D6B5E" />
                </div>
              </div>
              {/* Valeur et unité séparées, comme dans la maquette : le montant
                  garde sa taille de titre, « FCFA » reste discret et aligné sur
                  la ligne de base. */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{s.value}</span>
                {s.unit && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', paddingBottom: '2px' }}>{s.unit}</span>}
              </div>
              {s.delta && (
                <span style={{ fontSize: '0.7rem', color: '#3D6B5E', fontWeight: 600 }}>{s.delta}</span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '1.25rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '2 1 480px', padding: 0, overflow: 'hidden', alignSelf: 'flex-start' }}>
          {/* « Voir toutes → » est dans la maquette et n'a rien de décoratif :
              ce tableau ne montre que les 5 premières cliniques sur
              {clinics.length}. Sans le lien, rien n'indique qu'il y en a
              d'autres ni où les trouver. */}
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Cliniques enregistrées</h2>
            {clinics.length > 5 && (
              <button
                type="button"
                onClick={onViewClinics}
                style={{ background: 'none', border: 'none', color: '#3D6B5E', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', padding: 0, flexShrink: 0 }}
              >
                Voir toutes ({clinics.length}) →
              </button>
            )}
          </div>
          <ClinicsTable clinics={clinics.slice(0, 5)} />
        </div>

        <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} color="var(--text-muted)" />
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Abonnements arrivant à expiration</h2>
            </div>
            {expiringSoon.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Aucun abonnement n'expire dans les 7 prochains jours.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {expiringSoon.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span>{c.name}</span>
                    <span style={{ color: 'var(--warning, #d4813a)', fontWeight: 600 }}>{formatDate(c.subscriptionExpiresAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LifeBuoy size={16} color="var(--text-muted)" />
                <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Tickets en cours</h2>
              </div>
              <span className="badge badge-warning">{overview.stats.openTickets}</span>
            </div>
            {overview.recentTickets.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Aucun ticket ouvert.</p>
            ) : (
              // Sujet au-dessus, clinique en dessous, comme dans la maquette :
              // côte à côte, les deux se disputaient la largeur de la colonne
              // droite et se coupaient tous les deux en deux lignes.
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {overview.recentTickets.map(t => (
                  <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.subject}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.clinicName}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={onViewTickets}
              style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#3D6B5E', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
            >
              Voir tous les tickets →
            </button>
          </div>

          <SystemHealthPanel />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: '1.25rem' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Journal d'activité récent</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {recentActivity.map(a => (
            // flexWrap et retrait du flexShrink:0 sur le nom de clinique : un
            // nom long refusait de se réduire, poussait le libellé hors de la
            // carte et le faisait couper net sur mobile, sans défilement pour
            // aller le lire. Seul l'horodatage reste insécable, il est court.
            <div key={a.id} style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.35rem 1rem', padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>{formatDateTime(a.createdAt)}</span>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600, minWidth: 0 }}>{a.clinicName}</span>
              <span style={{ color: 'var(--text-primary)', minWidth: 0, flex: '1 1 auto' }}>{a.details || a.action}</span>
            </div>
          ))}
          {recentActivity.length === 0 && (
            <p style={{ padding: '1.25rem', color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Aucune activité récente.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const planLabels: Record<string, string> = { starter: 'Starter', clinique: 'Clinique', hopital: 'Hôpital' };
const planBadges: Record<string, string> = { starter: 'badge-info', clinique: 'badge-warning', hopital: 'badge-success' };

const clinicStatusBadge = (c: { status: 'active' | 'expired'; suspended?: boolean }): { label: string; className: string } => {
  if (c.suspended) return { label: 'Suspendu', className: 'badge-danger' };
  return c.status === 'active'
    ? { label: 'Actif', className: 'badge-success' }
    : { label: 'Expiré', className: 'badge-danger' };
};

const ClinicsTable: React.FC<{ clinics: ClinicOverview[] }> = ({ clinics }) => (
  <div className="table-container">
    <table style={{ width: '100%' }}>
      <thead>
        <tr>
          <th>Clinique</th>
          <th>Plan</th>
          <th style={{ textAlign: 'center' }}>Prat.</th>
          <th style={{ textAlign: 'center' }}>Patients</th>
          <th>Statut</th>
          <th>Inscrite le</th>
        </tr>
      </thead>
      <tbody>
        {clinics.map(c => (
          <tr key={c.id}>
            <td>
              <strong>{c.name}</strong>
              {c.address && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.address}</div>}
            </td>
            <td>
              <span className={`badge ${planBadges[c.plan] || 'badge-info'}`}>{planLabels[c.plan] || c.plan}</span>
            </td>
            <td style={{ textAlign: 'center' }}>{c.practitioners}</td>
            <td style={{ textAlign: 'center' }}>{c.patients}</td>
            <td>
              <span className={`badge ${clinicStatusBadge(c).className}`}>{clinicStatusBadge(c).label}</span>
            </td>
            <td>{formatDate(c.createdAt)}</td>
          </tr>
        ))}
        {clinics.length === 0 && (
          <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>Aucune clinique enregistrée.</td></tr>
        )}
      </tbody>
    </table>
  </div>
);

const ClinicsSection: React.FC<{
  clinics: ClinicOverview[];
  onToggleOverride: (clinicId: number, unlimited: boolean) => void;
  onToggleSuspend: (clinicId: number, suspended: boolean) => void;
  onChangePlan: (clinicId: number, plan: string) => void;
}> = ({ clinics, onToggleOverride, onToggleSuspend, onChangePlan }) => {
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filterPills: { value: string; label: string }[] = [
    { value: '', label: 'Tous' },
    { value: 'active', label: 'Actif' },
    { value: 'expired', label: 'Expiré' },
    { value: 'suspended', label: 'Suspendu' }
  ];

  const filtered = clinics.filter(c => {
    const matchesSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      !statusFilter ||
      (statusFilter === 'suspended' ? c.suspended : (!c.suspended && c.status === statusFilter));
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une clinique..."
          className="input-control"
          style={{ maxWidth: '260px' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {filterPills.map(p => (
            <button
              key={p.value}
              onClick={() => setStatusFilter(p.value)}
              className="filter-pill"
              style={{
                padding: '6px 14px',
                border: '1px solid var(--border)',
                backgroundColor: statusFilter === p.value ? '#3D6B5E' : 'var(--bg-secondary)',
                color: statusFilter === p.value ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Clinique</th>
                <th>Plan</th>
                <th style={{ textAlign: 'center' }}>Prat.</th>
                <th style={{ textAlign: 'center' }}>Patients</th>
                <th>Statut</th>
                <th>Illimité</th>
                <th>Inscrite le</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const badge = clinicStatusBadge(c);
                return (
                  <React.Fragment key={`${c.id}-${c.suspended}-${c.unlimitedStaff}`}>
                    <tr>
                      <td>
                        <strong>{c.name}</strong>
                        {c.address && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.address}</div>}
                      </td>
                      <td><span className={`badge ${planBadges[c.plan] || 'badge-info'}`}>{planLabels[c.plan] || c.plan}</span></td>
                      <td style={{ textAlign: 'center' }}>{c.practitioners}</td>
                      <td style={{ textAlign: 'center' }}>{c.patients}</td>
                      <td><span className={`badge ${badge.className}`}>{badge.label}</span></td>
                      <td>{c.unlimitedStaff && <span className="badge badge-success">Illimité</span>}</td>
                      <td>{formatDate(c.createdAt)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                          className="btn btn-outline"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          {expandedId === c.id ? 'Fermer' : 'Gérer'}
                        </button>
                      </td>
                    </tr>
                    {expandedId === c.id && (
                      <tr>
                        <td colSpan={8} style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem 1.25rem' }}>
                          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              Plan :
                              <select
                                key={c.plan}
                                defaultValue={c.plan}
                                className="input-control"
                                style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                                onChange={(e) => {
                                  const nextPlan = e.target.value;
                                  if (nextPlan === c.plan) return;
                                  if (window.confirm(`Changer le plan de "${c.name}" vers ${planLabels[nextPlan] || nextPlan} ? Ceci ne modifie pas la facturation, seulement les limites/fonctionnalités appliquées.`)) {
                                    onChangePlan(c.id, nextPlan);
                                  } else {
                                    e.target.value = c.plan;
                                  }
                                }}
                              >
                                {Object.keys(planLabels).map(p => (
                                  <option key={p} value={p}>{planLabels[p]}</option>
                                ))}
                              </select>
                            </label>
                            <button
                              onClick={() => onToggleOverride(c.id, !c.unlimitedStaff)}
                              className="btn btn-outline"
                              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            >
                              {c.unlimitedStaff ? "Retirer l'illimité" : 'Rendre illimité'}
                            </button>
                            <button
                              onClick={() => onToggleSuspend(c.id, !c.suspended)}
                              className="btn btn-outline"
                              style={{
                                padding: '6px 12px',
                                fontSize: '0.8rem',
                                borderColor: c.suspended ? 'var(--success)' : 'var(--danger)',
                                color: c.suspended ? 'var(--success)' : 'var(--danger)'
                              }}
                            >
                              {c.suspended ? 'Réactiver' : 'Suspendre'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>Aucune clinique ne correspond aux filtres.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const UsersSection: React.FC<{
  users: PlatformUser[] | null;
  currentUserId?: number;
  onToggleActive: (userId: number, active: boolean) => void;
}> = ({ users, currentUserId, onToggleActive }) => {
  const [search, setSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  if (!users) return <SkeletonCards count={5} height={56} label="Chargement des utilisateurs…" />;

  const roleOptions = Array.from(new Set(users.map(u => u.role)));

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchesSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchesRole = !roleFilter || u.role === roleFilter;
    const matchesStatus = !statusFilter || (statusFilter === 'active' ? u.active : !u.active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher nom ou email..."
          className="input-control"
          style={{ maxWidth: '240px' }}
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input-control" style={{ maxWidth: '200px' }}>
          <option value="">Tous les rôles</option>
          {roleOptions.map(r => <option key={r} value={r}>{roleLabels[r] || r}</option>)}
        </select>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[{ value: '', label: 'Tous' }, { value: 'active', label: 'Actif' }, { value: 'inactive', label: 'Inactif' }].map(p => (
            <button
              key={p.value}
              onClick={() => setStatusFilter(p.value)}
              className="filter-pill"
              style={{
                padding: '6px 14px',
                border: '1px solid var(--border)',
                backgroundColor: statusFilter === p.value ? '#3D6B5E' : 'var(--bg-secondary)',
                color: statusFilter === p.value ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Clinique</th>
                <th>Statut</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.email}</td>
                  <td>{roleLabels[u.role] || u.role}</td>
                  <td>{u.clinicName}</td>
                  <td>
                    <span className={`badge ${u.active ? 'badge-success' : 'badge-danger'}`}>
                      {u.active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {u.id !== currentUserId && (
                      <button
                        onClick={() => onToggleActive(u.id, !u.active)}
                        className="btn btn-outline"
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          borderColor: u.active ? 'var(--danger)' : 'var(--success)',
                          color: u.active ? 'var(--danger)' : 'var(--success)'
                        }}
                      >
                        {u.active ? 'Désactiver' : 'Activer'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>Aucun utilisateur ne correspond aux filtres.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const SubscriptionsSection: React.FC<{ data: SubscriptionsData | null }> = ({ data }) => {
  const [statusFilter, setStatusFilter] = useState<string>('');

  if (!data) return <SkeletonCards count={5} height={56} label="Chargement des abonnements…" />;

  const statusLabels: Record<string, string> = { pending: 'En attente', paid: 'Payé', failed: 'Échoué' };
  const statusBadges: Record<string, string> = { pending: 'badge-warning', paid: 'badge-success', failed: 'badge-danger' };

  const filterPills: { value: string; label: string }[] = [
    { value: '', label: 'Tous' },
    { value: 'active', label: 'Actif' },
    { value: 'expired', label: 'Expiré' }
  ];
  const filteredClinics = data.clinics.filter(c =>
    !statusFilter || (statusFilter === 'expired' ? c.subscriptionStatus === 'expired' : c.subscriptionStatus !== 'expired')
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Statut d'abonnement par clinique</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {filterPills.map(p => (
              <button
                key={p.value}
                onClick={() => setStatusFilter(p.value)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '999px',
                  border: '1px solid var(--border)',
                  backgroundColor: statusFilter === p.value ? '#3D6B5E' : 'var(--bg-secondary)',
                  color: statusFilter === p.value ? '#ffffff' : 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="table-container">
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Clinique</th>
                <th>Statut</th>
                <th>Expire le</th>
              </tr>
            </thead>
            <tbody>
              {filteredClinics.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>
                    <span className={`badge ${c.subscriptionStatus === 'expired' ? 'badge-danger' : 'badge-success'}`}>
                      {c.subscriptionStatus === 'expired' ? 'Expiré' : 'Actif'}
                    </span>
                  </td>
                  <td>{formatDate(c.subscriptionExpiresAt)}</td>
                </tr>
              ))}
              {filteredClinics.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>Aucune clinique ne correspond au filtre.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Historique des paiements d'abonnement</h2>
        </div>
        <div className="table-container">
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Clinique</th>
                <th>Durée</th>
                <th>Montant</th>
                <th>Fournisseur</th>
                <th>Statut</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map(p => (
                <tr key={p.id}>
                  <td>{p.clinicName}</td>
                  <td>{p.months} mois</td>
                  <td>{p.amount.toLocaleString()} FCFA</td>
                  <td style={{ textTransform: 'capitalize' }}>{p.provider}</td>
                  <td><span className={`badge ${statusBadges[p.status] || 'badge-info'}`}>{statusLabels[p.status] || p.status}</span></td>
                  <td>{formatDate(p.paidAt || p.createdAt)}</td>
                </tr>
              ))}
              {data.payments.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>Aucun paiement d'abonnement enregistré.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ticketStatusLabels: Record<string, string> = { open: 'Ouvert', in_progress: 'En cours', resolved: 'Résolu', closed: 'Fermé' };
const ticketStatusBadges: Record<string, string> = { open: 'badge-warning', in_progress: 'badge-info', resolved: 'badge-success', closed: 'badge-danger' };
const ticketCategoryLabels: Record<string, string> = { facturation: 'Facturation', bug: 'Bug technique', general: 'Question générale', autre: 'Autre' };

const TicketsSection: React.FC<{
  tickets: SupportTicket[] | null;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onUpdateStatus: (ticketId: number, status: string, resolutionNote?: string) => void;
}> = ({ tickets, statusFilter, onStatusFilterChange, onUpdateStatus }) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');

  if (!tickets) return <SkeletonCards count={4} height={72} label="Chargement des tickets…" />;

  const filterPills: { value: string; label: string }[] = [
    { value: '', label: 'Tous' },
    { value: 'open', label: 'Ouvert' },
    { value: 'in_progress', label: 'En cours' },
    { value: 'resolved', label: 'Résolu' },
    { value: 'closed', label: 'Fermé' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {filterPills.map(p => (
          <button
            key={p.value}
            onClick={() => onStatusFilterChange(p.value)}
            className="filter-pill"
            style={{
              padding: '6px 14px',
              border: '1px solid var(--border)',
              backgroundColor: statusFilter === p.value ? '#3D6B5E' : 'var(--bg-secondary)',
              color: statusFilter === p.value ? '#ffffff' : 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Sujet</th>
                <th>Clinique</th>
                <th>Catégorie</th>
                <th>Statut</th>
                <th>Créé le</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* key includes status, not just id: the status <select> below is
                  an uncontrolled input (defaultValue), so changing status must
                  force a remount to show the right value after a refetch */}
              {tickets.map(t => (
                <React.Fragment key={`${t.id}-${t.status}`}>
                  <tr>
                    <td><strong>{t.subject}</strong></td>
                    <td>{t.clinicName}</td>
                    <td>{ticketCategoryLabels[t.category] || t.category}</td>
                    <td><span className={`badge ${ticketStatusBadges[t.status] || 'badge-info'}`}>{ticketStatusLabels[t.status] || t.status}</span></td>
                    <td>{formatDate(t.createdAt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => { setExpandedId(expandedId === t.id ? null : t.id); setNoteDraft(t.resolutionNote || ''); }}
                        className="btn btn-outline"
                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      >
                        {expandedId === t.id ? 'Fermer' : 'Gérer'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === t.id && (
                    <tr>
                      <td colSpan={6} style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem 1.25rem' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: '0 0 0.75rem 0' }}>{t.message}</p>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <div>
                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Statut</label>
                            <select
                              defaultValue={t.status}
                              onChange={(e) => onUpdateStatus(t.id, e.target.value, noteDraft)}
                              className="input-control"
                              style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                            >
                              <option value="open">Ouvert</option>
                              <option value="in_progress">En cours</option>
                              <option value="resolved">Résolu</option>
                              <option value="closed">Fermé</option>
                            </select>
                          </div>
                          <div style={{ flex: '1 1 240px' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Note de résolution (optionnel)</label>
                            <input
                              type="text"
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              className="input-control"
                              style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem' }}
                              placeholder="Envoyée par email à l'admin de la clinique"
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {tickets.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>Aucun ticket.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
