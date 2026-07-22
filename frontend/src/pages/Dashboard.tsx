import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Users,
  Calendar as CalendarIcon,
  Clock,
  AlertTriangle,
  UserPlus,
  FileText,
  FlaskConical,
  Search,
  Bell,
  ChevronRight,
  ChevronLeft,
  Info,
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
  const [calendarDate, setCalendarDate] = useState<Date>(new Date(2025, 6, 14));

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const defaultMockAppts = [
    { id: 1, time: '08:00', name: 'Adjobi Kouassi', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80', detail: 'Consultation générale · Dr. Yao Bernard', status: 'completed' },
    { id: 2, time: '08:45', name: 'Fatou Diomandé', avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&auto=format&fit=crop&q=80', detail: 'Suivi diabète · Dr. Soro Mariam', status: 'completed' },
    { id: 3, time: '09:30', name: 'Ange-Marie Koffi', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80', detail: 'Pédiatrie — 4 ans · Dr. Yao Bernard', status: 'in_progress' },
    { id: 4, time: '10:15', name: 'Brahima Ouattara', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80', detail: 'Cardiologie · Dr. Coulibaly A.', status: 'waiting' },
    { id: 5, time: '11:00', name: 'Raïssa Gnahore', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80', detail: 'Consultation générale · Dr. Soro Mariam', status: 'waiting' },
    { id: 6, time: '11:45', name: 'Serge-Patrick Bah', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80', detail: 'Bilan biologique · Dr. Yao Bernard', status: 'waiting' },
    { id: 7, time: '14:00', name: 'Natacha Yéo', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80', detail: 'Gynécologie · Dr. Coulibaly A.', status: 'waiting' },
  ];

  const apptListToRender = todayAppts && todayAppts.length > 0
    ? todayAppts.map((a: any) => ({
        id: a.id,
        time: new Date(a.date_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        name: `${a.patient_first_name || ''} ${a.patient_last_name || ''}`.trim() || 'Patient',
        avatar: null,
        detail: `Motif: ${a.motif} · ${a.practitioner_name || 'Dr. Koné'}`,
        status: a.status === 'completed' ? 'completed' : a.status === 'cancelled' ? 'cancelled' : 'waiting'
      }))
    : defaultMockAppts;

  const totalPatientsCount = (stats?.patientsTotal && stats.patientsTotal > 0) ? stats.patientsTotal : 27;
  const confirmedRdvCount = (todayAppts && todayAppts.length > 0) ? todayAppts.length : 19;
  const activeAlertsCount = (stats?.lowStockCount || 0) + (stats?.nearExpiryCount || 0) || 3;

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

  const activeSelectedDay = 14;

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
            Bonjour, {user?.name?.split(' ')[0] || 'Aminata'} 👋
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px', margin: 0 }}>
            Lundi 14 juillet 2025
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

          {/* Bell Icon with Badge 3 */}
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
              fontSize: '0.7rem',
              fontWeight: 700,
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--bg-primary)'
            }}>3</span>
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
              +4 par rapport à hier
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
              8 en attente de confirmation
            </div>
          </div>
        </div>

        {/* Card 3 */}
        <div 
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '1.25rem 1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              TEMPS D'ATTENTE MOYEN
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
              <Clock size={20} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
              18 min
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Objectif : moins de 20 min
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
                {apptListToRender.length} patients · 7 praticiens
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
                      {appt.avatar ? (
                        <img src={appt.avatar} alt={appt.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        appt.name.charAt(0)
                      )}
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
                const hasApptDot = [8, 14, 17, 21].includes(day);

                return (
                  <div 
                    key={`day-${day}`}
                    style={{
                      height: '32px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      backgroundColor: isSelected ? '#1e4d40' : 'transparent',
                      color: isSelected ? '#ffffff' : 'inherit',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                  >
                    <span>{day}</span>
                    {hasApptDot && !isSelected && (
                      <span style={{
                        position: 'absolute',
                        bottom: '3px',
                        width: '3px',
                        height: '3px',
                        borderRadius: '50%',
                        backgroundColor: '#1e4d40'
                      }} />
                    )}
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
              <span style={{
                backgroundColor: '#ef4444',
                color: 'white',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                3
              </span>
            </div>

            {/* Alert List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Alert 1 */}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Stock critique : Amoxicilline 500mg
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Il y a 5 min</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    8 unités restantes — commande urgente recommandée
                  </p>
                </div>
              </div>

              {/* Alert 2 */}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      RDV non confirmé — Kouamé Éric
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Il y a 22 min</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Rendez-vous 14h30 sans confirmation patient
                  </p>
                </div>
              </div>

              {/* Alert 3 */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{
                  backgroundColor: '#f0f9ff',
                  color: '#0284c7',
                  padding: '8px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Info size={18} />
                </div>
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Résultat labo disponible
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Il y a 1h</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    NFS — Fatou Diomandé · Dossier #00847
                  </p>
                </div>
              </div>
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
              Voir toutes les alertes →
            </button>
          </div>

          {/* WIDGET 3: Occupation des salles */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1rem 0' }}>
              Occupation des salles
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Salle 1 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-primary)' }}>Salle 1 — Consultation</span>
                  <span style={{ color: '#ea580c' }}>85%</span>
                </div>
                <div style={{ height: '6px', backgroundColor: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '85%', height: '100%', backgroundColor: '#ea580c', borderRadius: '3px' }} />
                </div>
              </div>

              {/* Salle 2 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-primary)' }}>Salle 2 — Pédiatrie</span>
                  <span style={{ color: '#1e4d40' }}>60%</span>
                </div>
                <div style={{ height: '6px', backgroundColor: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '60%', height: '100%', backgroundColor: '#1e4d40', borderRadius: '3px' }} />
                </div>
              </div>

              {/* Salle 3 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-primary)' }}>Salle 3 — Cardiologie</span>
                  <span style={{ color: 'var(--text-secondary)' }}>40%</span>
                </div>
                <div style={{ height: '6px', backgroundColor: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '40%', height: '100%', backgroundColor: '#94a3b8', borderRadius: '3px' }} />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
