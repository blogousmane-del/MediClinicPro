import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { SkeletonPage } from '../components/Skeleton';
import { SubscriptionLockScreen } from '../components/SubscriptionLockScreen';
import { daysUntilExpiry } from '../utils/subscription';
import {
  Users,
  Calendar as CalendarIcon,
  CreditCard,
  AlertTriangle,
  UserPlus,
  FileText,
  FlaskConical,
  Search,
  Bell,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface Stats {
  totalRevenue: number;
  todayRevenue: number;
  patientsTotal: number;
  appointmentsScheduled: number;
  lowStockCount: number;
  nearExpiryCount: number;
  logs: any[];
}

interface DashboardProps {
  setCurrentTab: (tab: string) => void;
  onQuickAction: (action: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setCurrentTab, onQuickAction }) => {
  const { user, clinic, subscription, suspended } = useAuth();
  const isLockedOut = subscription.locked || suspended;
  const { showToast } = useNotifications();
  const [stats, setStats] = useState<Stats | null>(null);
  const [todayAppts, setTodayAppts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Calendar month state
  const today = new Date();
  const [calendarDate, setCalendarDate] = useState<Date>(today);

  const fetchDashboardData = async () => {
    // Verrouillé, ces deux routes répondent 403 : les appeler ne produirait
    // qu'un toast d'erreur au chargement. Le tableau de bord reste ouvert mais
    // affiche l'invitation à payer à la place de ses chiffres.
    if (isLockedOut) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const statsData = await api.get('/financials/stats');
      setStats(statsData);

      const todayStr = new Date().toISOString().split('T')[0];
      const appts = await api.get(`/appointments?date=${todayStr}`);
      setTodayAppts(appts);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur de chargement', 'Impossible de récupérer les données du tableau de bord.');
    } finally {
      setLoading(false);
    }
  };

  // `isLockedOut` fait partie des dépendances : le chargement est sauté tant que
  // la clinique est verrouillée, et sans ce déclencheur le tableau de bord
  // restait vide APRÈS le paiement — l'écran de verrou disparaissait, mais rien
  // ne relançait la requête sautée, et il fallait recharger la page à la main.
  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLockedOut]);

  const apptListToRender = (todayAppts || []).map((a: any) => ({
    id: a.id,
    time: new Date(a.date_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    name: `${a.patient_first_name || ''} ${a.patient_last_name || ''}`.trim() || 'Patient',
    detail: `Motif: ${a.motif} · ${a.practitioner_name || 'Praticien'}`,
    // Les trois seuls statuts du domaine (supabase_schema.sql:80). Un quatrième
    // état « in_progress » était rendu ici alors que rien ne peut le produire :
    // la pastille correspondante était morte, et un RDV annulé tombait dans la
    // branche par défaut, donc s'affichait « En attente ».
    status: a.status === 'completed' ? 'completed' : a.status === 'cancelled' ? 'cancelled' : 'scheduled'
  }));

  const totalPatientsCount = stats?.patientsTotal ?? 0;
  // Les annulés sont exclus : les compter revenait à annoncer une journée plus
  // chargée qu'elle ne l'est, alors que le créneau est justement libéré.
  const todayRdvCount = todayAppts.filter((a: any) => a.status !== 'cancelled').length;
  const activeAlertsCount = (stats?.lowStockCount || 0) + (stats?.nearExpiryCount || 0);

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const monthName = monthNames[month];

  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarDays = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const activeSelectedDay = isCurrentMonth ? today.getDate() : null;

  // Trial countdown — Starter is the only free/trial tier (7 days, see
  // backend/utils/plans.js). Le décompte vient du helper partagé, alimenté par
  // l'état que le serveur a calculé : trois formules parallèles pouvaient
  // afficher trois nombres différents le jour de l'échéance.
  const trialDaysRemaining = daysUntilExpiry(subscription);
  const showTrialBanner = user?.role === 'admin' && clinic?.plan === 'starter' && trialDaysRemaining !== null && trialDaysRemaining > 0;

  if (loading) {
    return (
      <div className="dashboard-container">
        <SkeletonPage cards={3} label="Chargement du tableau de bord…" />
      </div>
    );
  }

  // Le tableau de bord reste accessible pour ne pas jeter l'utilisateur contre
  // un mur dès la connexion, mais il n'a plus de chiffres à montrer : ils
  // viennent tous de routes fermées.
  if (isLockedOut) {
    return <SubscriptionLockScreen tabLabel="Tableau de bord" onGoToBilling={() => setCurrentTab('settings')} />;
  }

  return (
    <div className="dashboard-container">

      {/* Top Header / Greeting & Search Bar Row */}
      <div className="dashboard-top-bar">
        {/* Left Greeting */}
        <div>
          <h1 style={{ 
            fontSize: '1.75rem', 
            fontWeight: 700, 
            fontFamily: 'var(--font-secondary)',
            color: 'var(--text-primary)',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            Bonjour, {user?.name?.split(' ')[0] || 'Docteur'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px', margin: 0, textTransform: 'capitalize' }}>
            {today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Right Search & Notification */}
        <div className="dashboard-top-right">
          {/* Patient Search Input */}
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text"
              placeholder="Rechercher un patient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  setCurrentTab('patients');
                }
              }}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-secondary)',
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
                
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Bell Icon — badge reflects real pharmacy alert count.
              C'était un <div> cliquable : ni tabulable, ni activable au
              clavier, et sans nom pour un lecteur d'écran. */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setCurrentTab('pharmacy')}
              aria-label={activeAlertsCount > 0
                ? `Alertes de stock : ${activeAlertsCount}. Ouvrir la pharmacie.`
                : 'Aucune alerte de stock. Ouvrir la pharmacie.'}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: 0
              }}>
              <Bell size={18} />
            </button>
            {activeAlertsCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                backgroundColor: 'var(--danger)',
                color: '#ffffff',
                fontSize: '0.7rem',
                fontWeight: 700,
                minWidth: '18px',
                height: '18px',
                borderRadius: '9999px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--bg-primary)',
                padding: '0 3px'
              }}>{activeAlertsCount}</span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="dashboard-quick-actions">
        <button 
          onClick={() => onQuickAction('new_patient')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            backgroundColor: 'var(--brand-fill)',
            color: 'var(--brand-fill-fg)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            transition: 'var(--transition)'
          }}
        >
          <UserPlus size={17} />
          <span>Nouveau patient</span>
        </button>

        <button 
          onClick={() => onQuickAction('new_appt')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            transition: 'var(--transition)'
          }}
        >
          <CalendarIcon size={17} color="var(--text-secondary)" />
          <span>Prendre un RDV</span>
        </button>

        <button 
          onClick={() => setCurrentTab('prescriptions')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            transition: 'var(--transition)'
          }}
        >
          <FileText size={17} color="var(--text-secondary)" />
          <span>Nouvelle ordonnance</span>
        </button>

        <button 
          onClick={() => setCurrentTab('laboratory')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            transition: 'var(--transition)'
          }}
        >
          <FlaskConical size={17} color="var(--text-secondary)" />
          <span>Demande labo</span>
        </button>

        {/* Trial countdown badge — Starter plan only (free, 7-day trial), admin only
            (billing actions live in Paramètres, which non-admin roles can't reach) */}
        {showTrialBanner && (
          <button
            onClick={() => setCurrentTab('settings')}
            className="dashboard-trial-badge"
            title="Souscrivez avant la fin de votre essai pour continuer à utiliser MediClinic sans interruption."
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginLeft: 'auto',
              padding: '8px 14px',
              /* Le dégradé orange était la seule surface dégradée de
                 l'application, et son blanc sur orange clair passait sous le
                 seuil AA. Fond teinté + encre foncée, comme toute alerte. */
              backgroundColor: 'var(--warning-surface)',
              border: '1px solid var(--warning)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--warning-ink)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Sparkles size={15} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
              Essai : {trialDaysRemaining} jour{(trialDaysRemaining as number) > 1 ? 's' : ''} restant{(trialDaysRemaining as number) > 1 ? 's' : ''}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, opacity: 0.95, whiteSpace: 'nowrap' }}>
              Choisir un forfait
              <ArrowRight size={13} />
            </span>
          </button>
        )}
      </div>

      {/* 4 Stat Cards Row */}
      {/* Les quatre cartes passent par <StatCard> : elles étaient quatre blocs
          de style recopiés, chacun avec sa pastille d'icône codée en dur
          (#e6f4ea, #f1f5f9, #ffedd5), qui restait claire en thème sombre. */}
      <div className="dashboard-stats-grid">
        <StatCard
          label="PATIENTS ACTIFS"
          value={totalPatientsCount}
          hint="Dossiers non archivés"
          icon={Users}
          tone="brand"
          onClick={() => setCurrentTab('patients')}
        />

        <StatCard
          label="RDV DU JOUR"
          value={todayRdvCount}
          hint="Hors rendez-vous annulés"
          icon={CalendarIcon}
          tone="neutral"
          onClick={() => setCurrentTab('appointments')}
        />

        {/* Card 3 — real today's revenue (replaces a fully-fabricated "temps d'attente" card) */}
        <StatCard
          label="RECETTES DU JOUR"
          value={stats?.todayRevenue || 0}
          hint="Paiements encaissés"
          icon={CreditCard}
          tone="brand"
          formatter={(n) => `${n.toLocaleString('fr-FR')} FCFA`}
          onClick={
            ['admin', 'manager', 'secretary'].includes(user?.role || '')
              ? () => setCurrentTab('accounting')
              : undefined
          }
        />

        <StatCard
          label="ALERTES ACTIVES"
          value={activeAlertsCount}
          hint={activeAlertsCount === 0
            ? 'Aucune alerte active'
            : `${stats?.lowStockCount || 0} stock bas, ${stats?.nearExpiryCount || 0} péremption proche`}
          icon={AlertTriangle}
          tone={activeAlertsCount === 0 ? 'neutral' : 'warning'}
          onClick={() => setCurrentTab('pharmacy')}
        />
      </div>

      {/* Main Split Content Section */}
      <div className="dashboard-main-grid">
        
        {/* LEFT COLUMN: Rendez-vous du jour */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          {/* Section Header */}
          <div className="dashboard-appt-header">
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Rendez-vous du jour
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                {todayRdvCount} rendez-vous, hors annulations
              </span>
            </div>

            {/* Status Legend */}
            <div className="dashboard-legend">
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--brand-fill)' }} />
                <span>Terminé</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--border-strong)' }} />
                <span>Planifié</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--text-secondary)' }} />
                <span>Annulé</span>
              </div>
            </div>
          </div>

          {/* Appointments List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {apptListToRender.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '160px', color: 'var(--text-muted)' }}>
                <CalendarIcon size={32} style={{ marginBottom: '10px', opacity: 0.6 }} />
                <span style={{ fontSize: '0.9rem' }}>Aucun rendez-vous planifié aujourd'hui.</span>
              </div>
            )}
            {apptListToRender.map((appt) => {
              const statusBadge = appt.status === 'completed'
                ? <StatusBadge tone="brand">Terminé</StatusBadge>
                : appt.status === 'cancelled'
                  ? <StatusBadge struck>Annulé</StatusBadge>
                  : <StatusBadge tone="neutral">Planifié</StatusBadge>;

              return (
                <div 
                  key={appt.id}
                  className="dashboard-appt-row"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: 0 }}>
                    {/* Time */}
                    <span style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: 'var(--text-secondary)',
                      minWidth: '45px',
                      flexShrink: 0
                    }}>
                      {appt.time}
                    </span>

                    {/* Avatar */}
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--border-strong)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      flexShrink: 0
                    }}>
                      {appt.name.charAt(0)}
                    </div>

                    {/* Patient info */}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {appt.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {appt.detail}
                      </div>
                    </div>
                  </div>

                  {/* Right side Badge & Chevron */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {statusBadge}
                    <button style={{
                      background: 'none',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      cursor: 'pointer'
                    }}>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Sidebar Widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* WIDGET 1: Mini Calendar */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            {/* Month Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {monthName} {year}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '4px',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)'
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button 
                  onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '4px',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)'
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Days header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              textAlign: 'center',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              marginBottom: '0.5rem'
            }}>
              <span>Lu</span>
              <span>Ma</span>
              <span>Me</span>
              <span>Je</span>
              <span>Ve</span>
              <span>Sa</span>
              <span>Di</span>
            </div>

            {/* Calendar Days Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              textAlign: 'center',
              gap: '4px',
              fontSize: '0.8rem',
              color: 'var(--text-primary)'
            }}>
              {calendarDays.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} />;
                const isSelected = day === activeSelectedDay;

                return (
                  <div
                    key={`day-${day}`}
                    style={{
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      backgroundColor: isSelected ? 'var(--brand-fill)' : 'transparent',
                      color: isSelected ? 'var(--brand-fill-fg)' : 'inherit',
                      fontWeight: isSelected ? 700 : 500
                    }}
                  >
                    <span>{day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* WIDGET 2: Alertes Widget */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Alertes
              </h3>
              {activeAlertsCount > 0 && (
                <span style={{
                  backgroundColor: 'var(--danger)',
                  color: 'white',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  {activeAlertsCount}
                </span>
              )}
            </div>

            {/* Alert List — driven by real stats.lowStockCount / nearExpiryCount */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(stats?.lowStockCount || 0) === 0 && (stats?.nearExpiryCount || 0) === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Aucune alerte de stock active.</p>
              ) : (
                <>
                  {(stats?.lowStockCount || 0) > 0 && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div style={{
                        backgroundColor: 'var(--danger-surface)',
                        color: 'var(--danger-ink)',
                        padding: '8px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <AlertTriangle size={18} />
                      </div>
                      <div style={{ flexGrow: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {stats?.lowStockCount} médicament{(stats?.lowStockCount || 0) > 1 ? 's' : ''} en stock bas
                        </span>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                          Vérifiez la pharmacie pour réapprovisionner.
                        </p>
                      </div>
                    </div>
                  )}
                  {(stats?.nearExpiryCount || 0) > 0 && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div style={{
                        backgroundColor: 'var(--warning-surface)',
                        color: 'var(--warning-ink)',
                        padding: '8px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <AlertTriangle size={18} />
                      </div>
                      <div style={{ flexGrow: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {stats?.nearExpiryCount} médicament{(stats?.nearExpiryCount || 0) > 1 ? 's' : ''} proche{(stats?.nearExpiryCount || 0) > 1 ? 's' : ''} de péremption
                        </span>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                          Péremption sous 30 jours.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <button
              onClick={() => setCurrentTab('pharmacy')}
              style={{
                width: '100%',
                marginTop: '1rem',
                padding: '8px',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              Voir la pharmacie →
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
