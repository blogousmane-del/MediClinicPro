import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Users, 
  Calendar, 
  CreditCard, 
  AlertTriangle, 
  Plus, 
  UserPlus, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  Activity,
  FileText
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
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Welcome Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'var(--font-secondary)' }}>
            Bonjour, {user?.name}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Voici un aperçu de l'activité de votre clinique aujourd'hui.
          </p>
        </div>

        {/* Quick Actions Panel */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {['admin', 'secretary'].includes(user?.role || '') && (
            <>
              <button 
                onClick={() => onQuickAction('new_patient')}
                className="btn btn-primary"
                style={{ gap: '6px' }}
              >
                <UserPlus size={18} />
                <span>Nouveau Patient</span>
              </button>
              
              <button 
                onClick={() => onQuickAction('new_appt')}
                className="btn btn-secondary"
                style={{ gap: '6px' }}
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
              style={{ gap: '6px' }}
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
        <div className="card" onClick={() => setCurrentTab('patients')} style={{ cursor: 'pointer' }}>
          <div className="flex justify-between align-center" style={{ marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>TOTAL PATIENTS</span>
            <div style={{ backgroundColor: 'var(--primary-light)', padding: '8px', borderRadius: '8px', color: 'var(--primary)' }}>
              <Users size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{stats?.patientsTotal || 0}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--success)', marginTop: '4px', fontWeight: 500 }}>
            Dossiers actifs configurés
          </div>
        </div>

        {/* Metric 2 */}
        <div className="card" onClick={() => setCurrentTab('appointments')} style={{ cursor: 'pointer' }}>
          <div className="flex justify-between align-center" style={{ marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>RDV DU JOUR</span>
            <div style={{ backgroundColor: 'var(--info-light)', padding: '8px', borderRadius: '8px', color: 'var(--info)' }}>
              <Calendar size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{todayAppts.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: 500 }}>
            {stats?.appointmentsScheduled || 0} restants planifiés
          </div>
        </div>

        {/* Metric 3 */}
        <div className="card" onClick={() => ['admin', 'manager'].includes(user?.role || '') && setCurrentTab('accounting')} style={{ cursor: ['admin', 'manager'].includes(user?.role || '') ? 'pointer' : 'default' }}>
          <div className="flex justify-between align-center" style={{ marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>RECETTES DU JOUR</span>
            <div style={{ backgroundColor: 'var(--success-light)', padding: '8px', borderRadius: '8px', color: 'var(--success)' }}>
              <CreditCard size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{(stats?.todayRevenue || 0).toLocaleString()} FCFA</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--success)', marginTop: '4px', fontWeight: 500 }}>
            Paiements encaissés aujourd'hui
          </div>
        </div>

        {/* Metric 4 */}
        <div className="card" onClick={() => ['admin', 'pharmacist', 'manager'].includes(user?.role || '') && setCurrentTab('pharmacy')} style={{ cursor: ['admin', 'pharmacist', 'manager'].includes(user?.role || '') ? 'pointer' : 'default' }}>
          <div className="flex justify-between align-center" style={{ marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>ALERTES STOCK</span>
            <div style={{ 
              backgroundColor: stockAlerts > 0 ? 'var(--danger-light)' : 'var(--success-light)', 
              padding: '8px', 
              borderRadius: '8px', 
              color: stockAlerts > 0 ? 'var(--danger)' : 'var(--success)' 
            }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{stockAlerts}</div>
          <div style={{ 
            fontSize: '0.8rem', 
            color: stockAlerts > 0 ? 'var(--danger)' : 'var(--success)', 
            marginTop: '4px', 
            fontWeight: 500 
          }}>
            {stats?.lowStockCount || 0} stock bas · {stats?.nearExpiryCount || 0} péremptions
          </div>
        </div>
      </div>

      {/* Main Grid sections */}
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '1.5rem' }}>
        {/* Left Column: Today Appointments */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="flex justify-between align-center" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Rendez-vous du jour ({todayAppts.length})</h3>
            <button 
              onClick={() => setCurrentTab('appointments')}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
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
                height: '200px',
                color: 'var(--text-muted)'
              }}>
                <Calendar size={32} style={{ marginBottom: '8px' }} />
                <span>Aucun rendez-vous planifié aujourd'hui.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                        padding: '12px',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-tertiary)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          fontSize: '0.9rem',
                          color: 'var(--primary)'
                        }}>
                          {hour}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                            {appt.patient_first_name} {appt.patient_last_name}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            Motif: {appt.motif} · Avec: {appt.practitioner_name}
                          </div>
                        </div>
                      </div>
                      <span className="badge" style={{
                        backgroundColor: statusColors[appt.status] + '22',
                        color: statusColors[appt.status]
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

        {/* Right Column: Activity Logs Journal */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem' }}>Journal d'activités</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flexGrow: 1 }}>
            {(!stats?.logs || stats.logs.length === 0) ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: 'var(--text-muted)'
              }}>
                <Clock size={32} style={{ marginBottom: '8px' }} />
                <span>Aucune activité enregistrée.</span>
              </div>
            ) : (
              stats.logs.map(log => {
                const date = new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                
                return (
                  <div key={log.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary)',
                      marginTop: '6px',
                      flexShrink: 0
                    }} />
                    <div style={{ flexGrow: 1 }}>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                        {log.details}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Par {log.user_name || 'Système'} à {date}
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
  );
};
