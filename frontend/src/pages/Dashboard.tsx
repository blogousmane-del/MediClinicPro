import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
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
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const [stats, setStats] = useState<Stats | null>(null);
  const [todayAppts, setTodayAppts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Calendar month state
  const today = new Date();
  const [calendarDate, setCalendarDate] = useState<Date>(today);

  const fetchDashboardData = async () => {
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

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const apptListToRender = (todayAppts || []).map((a: any) => ({
    id: a.id,
    time: new Date(a.date_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    name: `${a.patient_first_name || ''} ${a.patient_last_name || ''}`.trim() || 'Patient',
    detail: `Motif: ${a.motif} · ${a.practitioner_name || 'Praticien'}`,
    status: a.status === 'completed' ? 'completed' : a.status === 'cancelled' ? 'cancelled' : 'waiting'
  }));

  const totalPatientsCount = stats?.patientsTotal ?? 0;
  const confirmedRdvCount = todayAppts.length;
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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
        Chargement du tableau de bord...
      </div>
    );
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
            Bonjour, {user?.name?.split(' ')[0] || 'Docteur'} 👋
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
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Bell Icon — badge reflects real pharmacy alert count */}
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
            {activeAlertsCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                backgroundColor: '#ef4444',
                color: 'white',
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
            backgroundColor: '#1e4d40',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(30, 77, 64, 0.25)',
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
      </div>

      {/* 4 Stat Cards Row */}
      <div className="dashboard-stats-grid">
        {/* Card 1 */}
        <div 
          onClick={() => setCurrentTab('patients')}
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '1.25rem 1.5rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              PATIENTS AUJOURD'HUI
            </span>
            <div style={{
              backgroundColor: '#e6f4ea',
              padding: '10px',
              borderRadius: '12px',
              color: '#1e4d40',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users size={20} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
              {totalPatientsCount}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Dossiers actifs configurés
            </div>
          </div>
        </div>

        {/* Card 2 */}
        <div 
          onClick={() => setCurrentTab('appointments')}
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '1.25rem 1.5rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              RDV CONFIRMÉS
            </span>
            <div style={{
              backgroundColor: '#f1f5f9',
              padding: '10px',
              borderRadius: '12px',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CalendarIcon size={20} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
              {confirmedRdvCount}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Planifiés aujourd'hui
            </div>
          </div>
        </div>

        {/* Card 3 — real today's revenue (replaces a fully-fabricated "temps d'attente" card) */}
        <div
          onClick={() => ['admin', 'manager', 'secretary'].includes(user?.role || '') && setCurrentTab('accounting')}
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '1.25rem 1.5rem',
            cursor: ['admin', 'manager', 'secretary'].includes(user?.role || '') ? 'pointer' : 'default',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              RECETTES DU JOUR
            </span>
            <div style={{
              backgroundColor: '#e6f4ea',
              padding: '10px',
              borderRadius: '12px',
              color: '#1e4d40',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CreditCard size={20} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
              {(stats?.todayRevenue || 0).toLocaleString()} FCFA
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Paiements encaissés
            </div>
          </div>
        </div>

        {/* Card 4 */}
        <div 
          onClick={() => setCurrentTab('pharmacy')}
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '1.25rem 1.5rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              ALERTES ACTIVES
            </span>
            <div style={{
              backgroundColor: '#ffedd5',
              padding: '10px',
              borderRadius: '12px',
              color: '#ea580c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
              {activeAlertsCount}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              1 critique, 2 avertissements
            </div>
          </div>
        </div>
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
                {apptListToRender.length} rendez-vous planifiés
              </span>
            </div>

            {/* Status Legend */}
            <div className="dashboard-legend">
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#1e4d40' }} />
                <span>Terminé</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#475569' }} />
                <span>En cours</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#cbd5e1' }} />
                <span>En attente</span>
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
              let statusBadge = null;
              if (appt.status === 'completed') {
                statusBadge = (
                  <span style={{
                    backgroundColor: '#1e4d40',
                    color: '#ffffff',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}>
                    Terminé
                  </span>
                );
              } else if (appt.status === 'in_progress') {
                statusBadge = (
                  <span style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}>
                    En consultation
                  </span>
                );
              } else {
                statusBadge = (
                  <span style={{
                    backgroundColor: '#f1f5f9',
                    color: '#64748b',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}>
                    En attente
                  </span>
                );
              }

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
                      backgroundColor: '#cbd5e1',
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
                      backgroundColor: isSelected ? '#1e4d40' : 'transparent',
                      color: isSelected ? '#ffffff' : 'inherit',
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
                  backgroundColor: '#ef4444',
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
                        backgroundColor: '#fef2f2',
                        color: '#ef4444',
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
                        backgroundColor: '#fff7ed',
                        color: '#ea580c',
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
                color: '#1e4d40',
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
