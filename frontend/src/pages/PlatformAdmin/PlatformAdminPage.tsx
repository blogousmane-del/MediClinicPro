import React, { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  Clock,
  LogOut,
  ArrowLeft,
  LifeBuoy,
  BarChart2,
  Shield,
  Settings as SettingsIcon,
  Activity
} from 'lucide-react';

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

type Section = 'overview' | 'clinics' | 'users' | 'subscriptions' | 'tickets';

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

  const navItems: { id: Section; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },
    { id: 'clinics', label: 'Cliniques', icon: Building2 },
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'subscriptions', label: 'Abonnements', icon: CreditCard },
    { id: 'tickets', label: 'Support', icon: LifeBuoy }
  ];

  // Shown in the sidebar to match the full admin-console layout, but not yet
  // functional — no reporting, security, or system-config backend exists.
  // Disabled + "Bientôt" rather than silently omitted.
  const comingSoonItems: { label: string; icon: React.ElementType }[] = [
    { label: 'Rapports', icon: BarChart2 },
    { label: 'Sécurité', icon: Shield },
    { label: 'Config. système', icon: SettingsIcon }
  ];

  const sectionTitles: Record<Section, string> = {
    overview: "Vue d'ensemble",
    clinics: 'Cliniques enregistrées',
    users: 'Utilisateurs de la plateforme',
    subscriptions: 'Abonnements',
    tickets: 'Tickets support'
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', backgroundColor: 'var(--bg-secondary, #f4f3f0)' }}>
      {/* Dedicated admin sidebar — deliberately NOT the clinic Sidebar (no Patients/Rendez-vous/Ordonnances here) */}
      <aside style={{
        width: '240px',
        minHeight: '100vh',
        backgroundColor: '#14201d',
        color: '#a9b8b4',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div>
          <div style={{ padding: '1.25rem 1.25rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src="/logo-icon.svg" alt="MediClinic" width={28} height={28} />
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#ffffff' }}>MediClinic</span>
            </div>
            <div style={{
              marginTop: '10px',
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: '999px',
              backgroundColor: 'rgba(212, 164, 90, 0.18)',
              color: '#d4a45a',
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase'
            }}>
              Super Admin
            </div>
          </div>

          <nav style={{ padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                    backgroundColor: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                    color: isActive ? '#ffffff' : '#8fa19c',
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

            <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.08)', margin: '8px 4px' }} />

            {comingSoonItems.map(item => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  title="Bientôt disponible"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    color: '#57655f',
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
                    borderRadius: '999px',
                    backgroundColor: 'rgba(255,255,255,0.06)'
                  }}>
                    Bientôt
                  </span>
                </div>
              );
            })}
          </nav>
        </div>

        <div style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button
            onClick={onExit}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: 'none', background: 'none', color: '#8fa19c', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left' }}
          >
            <ArrowLeft size={15} />
            Retour à mon espace clinique
          </button>
          <button
            onClick={logout}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: 'none', background: 'none', color: '#8fa19c', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left' }}
          >
            <LogOut size={15} />
            Se déconnecter
          </button>
          <div style={{ padding: '10px 12px', fontSize: '0.75rem', color: '#5f716c' }}>{user?.name}</div>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-primary, #fff)' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-secondary)', color: 'var(--text-primary)', margin: 0 }}>
            {sectionTitles[section]}
          </h1>
        </div>

        <div style={{ padding: '1.5rem 2rem', flex: 1 }}>
          {loading && !overview ? (
            <p style={{ color: 'var(--text-secondary)' }}>Chargement...</p>
          ) : !overview ? (
            <p style={{ color: 'var(--text-secondary)' }}>Aucune donnée disponible.</p>
          ) : (
            <>
              {section === 'overview' && <OverviewSection overview={overview} onViewTickets={() => setSection('tickets')} />}
              {section === 'clinics' && (
                <ClinicsSection
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const OverviewSection: React.FC<{ overview: Overview; onViewTickets: () => void }> = ({ overview, onViewTickets }) => {
  const { stats, clinics, expiringSoon, recentActivity } = overview;
  const statCards = [
    { label: 'Cliniques actives', value: stats.clinicsActive, icon: Building2 },
    { label: 'Cliniques expirées', value: stats.clinicsExpired, icon: AlertTriangle },
    { label: 'Utilisateurs totaux', value: stats.totalUsers, icon: Users },
    { label: 'Revenu du mois', value: `${stats.monthlyRevenue.toLocaleString()} FCFA`, icon: TrendingUp }
  ];

  return (
    <div>
      <div className="grid-cols-4">
        {statCards.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="card" style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</span>
                <Icon size={16} color="var(--text-muted)" />
              </div>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>{s.value}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '1.25rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '2 1 480px', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Cliniques enregistrées</h2>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {overview.recentTickets.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span>{t.subject}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{t.clinicName}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={onViewTickets}
              style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#1e4d40', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
            >
              Voir tous les tickets →
            </button>
          </div>

          {/* Placeholder — no real uptime/health-check infrastructure exists yet */}
          <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={16} color="var(--text-muted)" />
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Santé du système</h2>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Supervision de l'infrastructure — bientôt disponible.</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: '1.25rem' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Journal d'activité récent</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {recentActivity.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>{formatDateTime(a.createdAt)}</span>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600, flexShrink: 0 }}>{a.clinicName}</span>
              <span style={{ color: 'var(--text-primary)' }}>{a.details || a.action}</span>
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
}> = ({ clinics, onToggleOverride, onToggleSuspend }) => {
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
              style={{
                padding: '6px 14px',
                borderRadius: '999px',
                border: '1px solid var(--border)',
                backgroundColor: statusFilter === p.value ? '#1e4d40' : 'var(--bg-secondary)',
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
                          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
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

  if (!users) return <p style={{ color: 'var(--text-secondary)' }}>Chargement...</p>;

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
              style={{
                padding: '6px 14px',
                borderRadius: '999px',
                border: '1px solid var(--border)',
                backgroundColor: statusFilter === p.value ? '#1e4d40' : 'var(--bg-secondary)',
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
  if (!data) return <p style={{ color: 'var(--text-secondary)' }}>Chargement...</p>;

  const statusLabels: Record<string, string> = { pending: 'En attente', paid: 'Payé', failed: 'Échoué' };
  const statusBadges: Record<string, string> = { pending: 'badge-warning', paid: 'badge-success', failed: 'badge-danger' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Statut d'abonnement par clinique</h2>
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
              {data.clinics.map(c => (
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

  if (!tickets) return <p style={{ color: 'var(--text-secondary)' }}>Chargement...</p>;

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
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              border: '1px solid var(--border)',
              backgroundColor: statusFilter === p.value ? '#1e4d40' : 'var(--bg-secondary)',
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
