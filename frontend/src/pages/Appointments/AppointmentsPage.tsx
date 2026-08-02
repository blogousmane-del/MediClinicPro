import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { Clock, User, Plus, X, Check, Phone, CalendarCheck, Download, DoorOpen, Stethoscope } from 'lucide-react';
import { NewAppointmentPage } from './NewAppointmentPage';

interface Practitioner {
  id: number;
  name: string;
}

interface Appointment {
  id: number;
  patient_id: number;
  patient_first_name: string;
  patient_last_name: string;
  patient_phone: string;
  patient_birth_date: string | null;
  practitioner_id: number;
  practitioner_name: string;
  date_time: string;
  duration: number;
  motif: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  room: string | null;
  notes: string | null;
}

interface AppointmentsPageProps {
  triggerOpenModal?: boolean;
  onModalClosed?: () => void;
  onViewPatient?: (patientId: number) => void;
}

const computeAge = (birthDate: string | null): number | null => {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const todayISO = () => new Date().toISOString().split('T')[0];

export const AppointmentsPage: React.FC<AppointmentsPageProps> = ({ triggerOpenModal = false, onModalClosed, onViewPatient }) => {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filterDate, setFilterDate] = useState<string>(todayISO());
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [selectedPractitioner, setSelectedPractitioner] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'completed' | 'cancelled'>('all');
  const [loading, setLoading] = useState<boolean>(true);

  // 'new' shows the full-page NewAppointmentPage (Banani "Nouveau Rendez-vous")
  // in place of the list, instead of the small modal this used to be.
  const [view, setView] = useState<'list' | 'new'>('list');
  const [smsPopup, setSmsPopup] = useState<any | null>(null);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      let endpoint = `/appointments?date=${filterDate}`;
      if (selectedPractitioner) {
        endpoint += `&practitionerId=${selectedPractitioner}`;
      }
      const data = await api.get(endpoint);
      setAppointments(data);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur de chargement', 'Impossible de récupérer les rendez-vous.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPractitioners = async () => {
    try {
      const data = await api.get('/settings/users');
      const docs = data.filter((u: any) => u.role === 'doctor' && u.active === 1);
      setPractitioners(docs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [filterDate, selectedPractitioner]);

  useEffect(() => {
    fetchPractitioners();
  }, []);

  useEffect(() => {
    if (triggerOpenModal) {
      setView('new');
    }
  }, [triggerOpenModal]);

  useEffect(() => {
    // Reset the status filter whenever the underlying appointment set changes
    // (new date/practitioner) so a stale filter doesn't hide everything.
    setStatusFilter('all');
  }, [filterDate, selectedPractitioner]);

  const handleCloseNewAppointment = () => {
    setView('list');
    if (onModalClosed) {
      onModalClosed();
    }
  };

  const handleAppointmentBooked = (smsSimulated: any) => {
    if (smsSimulated) {
      setSmsPopup(smsSimulated);
    }
    setView('list');
    if (onModalClosed) {
      onModalClosed();
    }
    fetchAppointments();
  };

  const handleUpdateStatus = async (apptId: number, status: 'completed' | 'cancelled') => {
    try {
      await api.put(`/appointments/${apptId}`, { status });
      showToast('success', 'RDV mis à jour', `Le rendez-vous a été marqué comme ${status === 'completed' ? 'terminé' : 'annulé'}.`);
      fetchAppointments();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur de modification', err.error || 'Impossible de mettre à jour le statut.');
    }
  };

  const statusLabels: Record<string, string> = {
    scheduled: 'Planifié',
    completed: 'Terminé',
    cancelled: 'Annulé'
  };

  const statusBadges: Record<string, string> = {
    scheduled: 'badge-info',
    completed: 'badge-success',
    cancelled: 'badge-danger'
  };

  const statusChips: { id: 'all' | 'scheduled' | 'completed' | 'cancelled'; label: string }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'scheduled', label: 'Planifiés' },
    { id: 'completed', label: 'Terminés' },
    { id: 'cancelled', label: 'Annulés' }
  ];

  const statusCounts = appointments.reduce((acc: Record<string, number>, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  const visibleAppointments = statusFilter === 'all'
    ? appointments
    : appointments.filter(a => a.status === statusFilter);

  const uniquePractitionerCount = new Set(appointments.map(a => a.practitioner_id)).size;
  const isTodaySelected = filterDate === todayISO();
  const formattedFilterDate = new Date(`${filterDate}T00:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  if (view === 'new') {
    return <NewAppointmentPage onCancel={handleCloseNewAppointment} onBooked={handleAppointmentBooked} />;
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* CSS Styles */}
      <style>{`
        .rdv-header-row {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }
        @media (min-width: 700px) {
          .rdv-header-row {
            flex-direction: row;
            align-items: flex-start;
            justify-content: space-between;
          }
        }

        .rdv-filter-bar {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }
        .rdv-filter-inputs {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 0.75rem;
        }
        .rdv-chip-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }
        .rdv-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .rdv-chip {
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background-color: var(--bg-tertiary);
          color: var(--text-secondary);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .rdv-chip.active {
          background-color: var(--primary);
          border-color: var(--primary);
          color: #ffffff;
        }
        .rdv-quick-actions {
          display: flex;
          gap: 0.5rem;
        }

        .rdv-card {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 1.1rem 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
          box-shadow: var(--shadow-sm);
          transition: var(--transition);
        }
        .rdv-card:hover {
          border-color: var(--primary);
          box-shadow: var(--shadow);
        }
        @media (min-width: 700px) {
          .rdv-card {
            flex-direction: row;
            align-items: flex-start;
          }
          .rdv-card-side {
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 0.6rem;
            min-width: 130px;
          }
        }

        @media (max-width: 500px) {
          .modal-content {
            width: 95% !important;
            margin: 10px !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="rdv-header-row">
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-secondary)', color: 'var(--text-primary)', margin: 0 }}>
            {isTodaySelected ? "Rendez-vous du jour" : 'Rendez-vous'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px', textTransform: 'capitalize' }}>
            {formattedFilterDate} · {appointments.length} rendez-vous
            {uniquePractitionerCount > 0 ? ` · ${uniquePractitionerCount} praticien${uniquePractitionerCount > 1 ? 's' : ''}` : ''}
          </p>
        </div>

        {['admin', 'secretary'].includes(user?.role || '') && (
          <button
            onClick={() => setView('new')}
            className="btn btn-primary page-cta-btn"
            style={{ gap: '6px', flexShrink: 0 }}
          >
            <Plus size={18} />
            <span>Ajouter un RDV</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card rdv-filter-bar" style={{ padding: '1rem' }}>
        <div className="rdv-filter-inputs">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Filtrer par date</label>
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="input-control"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Filtrer par médecin</label>
            <select
              value={selectedPractitioner}
              onChange={e => setSelectedPractitioner(e.target.value)}
              className="input-control"
            >
              <option value="">-- Tous les médecins --</option>
              {practitioners.map(doc => (
                <option key={doc.id} value={doc.id}>{doc.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="rdv-chip-row">
          <div className="rdv-chips">
            {statusChips.map(chip => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setStatusFilter(chip.id)}
                className={`rdv-chip ${statusFilter === chip.id ? 'active' : ''}`}
              >
                {chip.label} ({chip.id === 'all' ? appointments.length : (statusCounts[chip.id] || 0)})
              </button>
            ))}
          </div>

          <div className="rdv-quick-actions">
            <button
              type="button"
              onClick={() => setFilterDate(todayISO())}
              className="btn btn-secondary"
              style={{ gap: '6px', padding: '7px 12px', fontSize: '0.8rem' }}
            >
              <CalendarCheck size={14} />
              <span>Aujourd'hui</span>
            </button>
            <button
              type="button"
              disabled
              title="Bientôt disponible"
              className="btn btn-secondary"
              style={{ gap: '6px', padding: '7px 12px', fontSize: '0.8rem', opacity: 0.6, cursor: 'not-allowed' }}
            >
              <Download size={14} />
              <span>Exporter</span>
            </button>
          </div>
        </div>
      </div>

      {/* Appointments List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Chargement des créneaux...
          </div>
        ) : visibleAppointments.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            {appointments.length === 0 ? 'Aucun rendez-vous enregistré à cette date.' : 'Aucun rendez-vous ne correspond à ce filtre.'}
          </div>
        ) : (
          visibleAppointments.map(appt => {
            const hour = new Date(appt.date_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const age = computeAge(appt.patient_birth_date);
            const canManage = appt.status === 'scheduled' && ['admin', 'secretary'].includes(user?.role || '');

            return (
              <div key={appt.id} className="rdv-card">
                {/* Avatar */}
                <div style={{
                  width: '48px', height: '48px', borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary-light, #e6f4ea)', color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '1.1rem', flexShrink: 0
                }}>
                  {appt.patient_first_name.charAt(0).toUpperCase()}
                </div>

                {/* Main content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      {appt.patient_last_name.toUpperCase()} {appt.patient_first_name}
                    </h3>
                    {age !== null && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{age} ans</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                    <span>{appt.patient_phone}</span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '8px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>
                      <Stethoscope size={12} />
                      {appt.motif}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '8px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>
                      <User size={12} />
                      {appt.practitioner_name}
                    </span>
                    {appt.room && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '8px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>
                        <DoorOpen size={12} />
                        {appt.room}
                      </span>
                    )}
                  </div>

                  {appt.notes && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Notes : </strong>
                      {appt.notes}
                    </div>
                  )}
                </div>

                {/* Side: time, status, actions */}
                <div className="rdv-card-side">
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end', fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)' }}>
                      <Clock size={15} />
                      <span>{hour}</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{appt.duration} min</span>
                    <div style={{ marginTop: '4px' }}>
                      <span className={`badge ${statusBadges[appt.status]}`}>{statusLabels[appt.status]}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {onViewPatient && (
                      <button
                        onClick={() => onViewPatient(appt.patient_id)}
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.75rem', gap: '5px' }}
                        title="Ouvrir le dossier patient"
                      >
                        <User size={13} />
                        <span>Consulter</span>
                      </button>
                    )}
                    {canManage && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(appt.id, 'completed')}
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '0.75rem', color: 'var(--success)', borderColor: 'var(--success)', backgroundColor: 'transparent' }}
                          title="Marquer comme honoré"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(appt.id, 'cancelled')}
                          className="btn btn-outline"
                          style={{ padding: '6px 10px', fontSize: '0.75rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                          title="Annuler"
                        >
                          <X size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* SMS CONFIRMATION POPUP BANNER */}
      {smsPopup && (
        <div className="modal-backdrop" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '400px', padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ color: 'var(--success)', display: 'inline-flex', padding: '12px', borderRadius: '50%', backgroundColor: 'var(--success-light)', marginBottom: '1rem' }}>
              <Check size={28} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'white', marginBottom: '8px' }}>Rappel SMS Envoyé (Simulation)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.4 }}>
              MediClinic a simulé l'envoi d'un SMS de confirmation au patient.
            </p>
            <div style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '10px 14px',
              textAlign: 'left',
              fontSize: '0.8rem',
              color: 'var(--text-primary)',
              fontStyle: 'italic',
              marginBottom: '1.5rem'
            }}>
              <strong>Destinataire :</strong> {smsPopup.to}<br />
              <strong>Message :</strong> "{smsPopup.message}"
            </div>
            <button onClick={() => setSmsPopup(null)} className="btn btn-primary w-full">
              D'accord
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
export default AppointmentsPage;
