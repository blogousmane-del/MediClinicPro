import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Users,
  Calendar,
  Receipt,
  AlertTriangle,
  UserPlus,
  Clock,
  Activity,
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

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch stats
      const statsData = await api.get('/financials/stats');
      setStats(statsData);

      // Fetch today's appointments
      const todayStr = new Date().toISOString().split('T')[0];
      const appts = await api.get(`/appointments?date=${todayStr}`);
      setTodayAppts(appts);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur de chargement', 'Impossible de récupérer les statistiques du tableau de bord.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
        Chargement des données en cours...
      </div>
    );
  }

  const stockAlerts = (stats?.lowStockCount || 0) + (stats?.nearExpiryCount || 0);

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      
      {/* Welcome Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.5rem',
        paddingBottom: '0.5rem',
        borderBottom: '1px solid var(--border)'
      }}>
        <div>
          <h2 style={{ 
            fontSize: '2rem', 
            fontWeight: 700, 
            fontFamily: 'var(--font-secondary)',
            letterSpacing: '-0.5px',
            background: 'linear-gradient(135deg, var(--text-primary), var(--text-secondary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Bonjour, {user?.name} 👋
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '4px' }}>
            Voici un aperçu de l'activité de votre clinique aujourd'hui.
          </p>
        </div>

        {/* Quick Actions Panel */}
        <div style={{ display: 'flex', gap: '0.85rem' }}>
          {['admin', 'secretary'].includes(user?.role || '') && (
            <>
              <button 
                onClick={() => onQuickAction('new_patient')}
                className="btn btn-primary"
                style={{ gap: '8px', padding: '0.75rem 1.5rem' }}
              >
                <UserPlus size={18} />
                <span>Nouveau Patient</span>
              </button>
              
              <button 
                onClick={() => onQuickAction('new_appt')}
                className="btn btn-secondary"
                style={{ gap: '8px', padding: '0.75rem 1.5rem', border: '1px solid var(--border)' }}
              >
                <Calendar size={18} />
                <span>Prendre RDV</span>
              </button>
            </>
          )}

          {['admin', 'doctor'].includes(user?.role || '') && (
            <button 
              onClick={() => setCurrentTab('patients')}
              className="btn btn-outline"
              style={{ gap: '8px', padding: '0.75rem 1.5rem' }}
            >
              <Activity size={18} />
              <span>Consultations</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid-cols-4">
        {/* Metric 1 */}
        <div className="card glass-card" onClick={() => setCurrentTab('patients')} style={{ cursor: 'pointer', padding: '1.75rem' }}>
          <div className="flex justify-between align-center" style={{ marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>TOTAL PATIENTS</span>
            <div style={{ 
              backgroundColor: 'var(--primary-light)', 
              padding: '10px', 
              borderRadius: '12px', 
              color: 'var(--primary)',
              boxShadow: '0 0 15px rgba(13, 148, 136, 0.15)'
            }}>
              <Users size={22} />
            </div>
          </div>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, fontFamily: 'var(--font-secondary)', color: 'var(--text-primary)', letterSpacing: '-0.75px' }}>
            {stats?.patientsTotal || 0}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--success)', marginTop: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--success)' }} />
            Dossiers actifs configurés
          </div>
        </div>

        {/* Metric 2 */}
        <div className="card glass-card" onClick={() => setCurrentTab('appointments')} style={{ cursor: 'pointer', padding: '1.75rem' }}>
          <div className="flex justify-between align-center" style={{ marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>RDV DU JOUR</span>
            <div style={{ 
              backgroundColor: 'var(--info-light)', 
              padding: '10px', 
              borderRadius: '12px', 
              color: 'var(--info)',
              boxShadow: '0 0 15px rgba(6, 182, 212, 0.15)'
            }}>
              <Calendar size={22} />
            </div>
          </div>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, fontFamily: 'var(--font-secondary)', color: 'var(--text-primary)', letterSpacing: '-0.75px' }}>
            {todayAppts.length}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--info)' }} />
            {stats?.appointmentsScheduled || 0} restants planifiés
          </div>
        </div>

        {/* Metric 3 */}
        <div className="card glass-card" onClick={() => ['admin', 'manager'].includes(user?.role || '') && setCurrentTab('accounting')} style={{ cursor: ['admin', 'manager'].includes(user?.role || '') ? 'pointer' : 'default', padding: '1.75rem' }}>
          <div className="flex justify-between align-center" style={{ marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>RECETTES DU JOUR</span>
            <div style={{ 
              backgroundColor: 'var(--success-light)', 
              padding: '10px', 
              borderRadius: '12px', 
              color: 'var(--success)',
              boxShadow: '0 0 15px rgba(16, 185, 129, 0.15)'
            }}>
              <Receipt size={22} />
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-secondary)', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            {(stats?.todayRevenue || 0).toLocaleString()} FCFA
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--success)', marginTop: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--success)' }} />
            Paiements encaissés
          </div>
        </div>

        {/* Metric 4 */}
        <div className="card glass-card" onClick={() => ['admin', 'pharmacist', 'manager'].includes(user?.role || '') && setCurrentTab('pharmacy')} style={{ cursor: ['admin', 'pharmacist', 'manager'].includes(user?.role || '') ? 'pointer' : 'default', padding: '1.75rem' }}>
          <div className="flex justify-between align-center" style={{ marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>ALERTES STOCK</span>
            <div style={{ 
              backgroundColor: stockAlerts > 0 ? 'var(--danger-light)' : 'var(--success-light)', 
              padding: '10px', 
              borderRadius: '12px', 
              color: stockAlerts > 0 ? 'var(--danger)' : 'var(--success)',
              boxShadow: stockAlerts > 0 ? '0 0 15px rgba(239, 68, 68, 0.15)' : '0 0 15px rgba(16, 185, 129, 0.15)'
            }}>
              <AlertTriangle size={22} />
            </div>
          </div>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, fontFamily: 'var(--font-secondary)', color: 'var(--text-primary)', letterSpacing: '-0.75px' }}>
            {stockAlerts}
          </div>
          <div style={{ 
            fontSize: '0.8rem', 
            color: stockAlerts > 0 ? 'var(--danger)' : 'var(--success)', 
            marginTop: '8px', 
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: stockAlerts > 0 ? 'var(--danger)' : 'var(--success)' }} />
            {stats?.lowStockCount || 0} stock bas · {stats?.nearExpiryCount || 0} péremptions
          </div>
        </div>
      </div>

      {/* Main Grid sections */}
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '2rem' }}>
        {/* Left Column: Today Appointments */}
        <div className="card glass-card" style={{ display: 'flex', flexDirection: 'column', padding: '2rem' }}>
          <div className="flex justify-between align-center" style={{ marginBottom: '1.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-secondary)' }}>Rendez-vous du jour</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Aujourd'hui, {todayAppts.length} patients planifiés</p>
            </div>
            <button 
              onClick={() => setCurrentTab('appointments')}
              className="btn btn-outline"
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', borderRadius: 'var(--radius-full)' }}
            >
              Voir l'agenda
            </button>
          </div>

          <div style={{ flexGrow: 1 }}>
            {todayAppts.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '240px',
                color: 'var(--text-muted)'
              }}>
                <Calendar size={36} style={{ marginBottom: '12px', opacity: 0.6 }} />
                <span style={{ fontSize: '0.95rem' }}>Aucun rendez-vous planifié aujourd'hui.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {todayAppts.map(appt => {
                  const hour = new Date(appt.date_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                  
                  const statusColors: Record<string, string> = {
                    scheduled: 'var(--info)',
                    completed: 'var(--success)',
                    cancelled: 'var(--danger)'
                  };
                  const statusLabels: Record<string, string> = {
                    scheduled: 'Planifié',
                    completed: 'Terminé',
                    cancelled: 'Annulé'
                  };

                  return (
                    <div
                      key={appt.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        border: '1px solid var(--border)',
                        borderLeft: `4px solid ${statusColors[appt.status]}`,
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-secondary)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                        transition: 'var(--transition)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateX(3px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.04)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                          backgroundColor: 'var(--bg-primary)',
                          border: '1px solid var(--border)',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          color: 'var(--primary)',
                          fontFamily: 'var(--font-secondary)',
                          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                        }}>
                          {hour}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                            {appt.patient_first_name} {appt.patient_last_name}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            Motif: <strong style={{ color: 'var(--text-primary)' }}>{appt.motif}</strong> · Avec: {appt.practitioner_name}
                          </div>
                        </div>
                      </div>
                      <span className="badge" style={{
                        backgroundColor: statusColors[appt.status] + '1a',
                        color: statusColors[appt.status],
                        border: `1px solid ${statusColors[appt.status]}25`,
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.72rem',
                        fontWeight: 700
                      }}>
                        {statusLabels[appt.status]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Activity Logs Journal with vertical timeline */}
        <div className="card glass-card" style={{ display: 'flex', flexDirection: 'column', padding: '2rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-secondary)' }}>Journal d'activités</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px', marginBottom: '1.75rem' }}>Flux d'événements cliniques en temps réel</p>
          </div>
          
          <div style={{ position: 'relative', flexGrow: 1 }}>
            {/* Timeline line */}
            {stats?.logs && stats.logs.length > 0 && (
              <div style={{
                position: 'absolute',
                left: '17px',
                top: '8px',
                bottom: '8px',
                width: '2px',
                backgroundColor: 'var(--border)',
                opacity: 0.8
              }} />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {(!stats?.logs || stats.logs.length === 0) ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '240px',
                  color: 'var(--text-muted)'
                }}>
                  <Clock size={36} style={{ marginBottom: '12px', opacity: 0.6 }} />
                  <span style={{ fontSize: '0.95rem' }}>Aucune activité enregistrée.</span>
                </div>
              ) : (
                stats.logs.map(log => {
                  const date = new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                  
                  return (
                    <div key={log.id} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                      {/* Timeline Dot with outer glow */}
                      <div style={{
                        width: '36px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        flexShrink: 0
                      }}>
                        <div style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--primary)',
                          border: '4px solid var(--bg-secondary)',
                          boxShadow: '0 0 0 3px rgba(13, 148, 136, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }} />
                      </div>

                      {/* Content */}
                      <div style={{ flexGrow: 1, padding: '4px 0' }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.4, fontWeight: 500 }}>
                          {log.details}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Par {log.user_name || 'Système'}</span>
                          <span>•</span>
                          <span>à {date}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
