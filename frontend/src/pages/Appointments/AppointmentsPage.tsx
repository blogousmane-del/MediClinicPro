import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { Clock, User, Plus, X, Check, Phone } from 'lucide-react';

interface Patient {
  id: number;
  first_name: string;
  last_name: string;
  folder_number: string;
  phone: string;
}

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
  practitioner_id: number;
  practitioner_name: string;
  date_time: string;
  duration: number;
  motif: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

interface AppointmentsPageProps {
  triggerOpenModal?: boolean;
  onModalClosed?: () => void;
}

export const AppointmentsPage: React.FC<AppointmentsPageProps> = ({ triggerOpenModal = false, onModalClosed }) => {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [selectedPractitioner, setSelectedPractitioner] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Booking Modal Form states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearch, setPatientSearch] = useState<string>('');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [bookingPractitionerId, setBookingPractitionerId] = useState<string>('');
  const [bookingDate, setBookingDate] = useState<string>('');
  const [bookingTime, setBookingTime] = useState<string>('');
  const [bookingDuration, setBookingDuration] = useState<number>(30);
  const [bookingMotif, setBookingMotif] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
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
      // Fallback in case settings is restricted
      setPractitioners([
        { id: 2, name: 'Dr. Aminata Koné' },
        { id: 3, name: 'Dr. Ibrahim Traoré' }
      ]);
    }
  };

  const searchPatients = async (query: string) => {
    if (!query) {
      setPatients([]);
      return;
    }
    try {
      const data = await api.get(`/patients?q=${encodeURIComponent(query)}`);
      setPatients(data);
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
    const delayDebounce = setTimeout(() => {
      searchPatients(patientSearch);
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [patientSearch]);

  useEffect(() => {
    if (triggerOpenModal) {
      setIsModalOpen(true);
    }
  }, [triggerOpenModal]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPatientId('');
    setPatientSearch('');
    setBookingPractitionerId('');
    setBookingDate('');
    setBookingTime('');
    setBookingDuration(30);
    setBookingMotif('');
    
    if (onModalClosed) {
      onModalClosed();
    }
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !bookingPractitionerId || !bookingDate || !bookingTime || !bookingMotif) {
      showToast('error', 'Formulaire incomplet', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }

    setIsSubmitting(true);
    try {
      const dateTime = `${bookingDate}T${bookingTime}:00`;
      const payload = {
        patientId: parseInt(selectedPatientId),
        practitionerId: parseInt(bookingPractitionerId),
        dateTime,
        duration: bookingDuration,
        motif: bookingMotif
      };

      const response = await api.post('/appointments', payload);
      showToast('success', 'Rendez-vous planifié', 'Le rendez-vous a été enregistré.');
      
      // Save SMS details to display verification popup
      if (response.smsSimulated) {
        setSmsPopup(response.smsSimulated);
      }

      handleCloseModal();
      fetchAppointments();
    } catch (err: any) {
      console.error(err);
      if (err.conflict) {
        showToast('error', 'Conflit d\'horaire', err.error);
      } else {
        showToast('error', 'Échec de planification', err.error || 'Erreur lors de la prise de rendez-vous.');
      }
    } finally {
      setIsSubmitting(false);
    }
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

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div className="flex justify-between align-center" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-secondary)' }}>Gestion de l'Agenda</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Planifiez et gérez les consultations et visites des patients.</p>
        </div>

        {['admin', 'secretary'].includes(user?.role || '') && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary"
            style={{ gap: '6px' }}
          >
            <Plus size={18} />
            <span>Prendre un Rendez-vous</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', padding: '1rem' }}>
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

      {/* CSS Styles for responsive calendar list */}
      <style>{`
        .appointments-wrapper {
          width: 100%;
        }
        
        .grid-responsive-2col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        
        .grid-responsive-1to2col {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 10px;
        }
        
        .appointment-card {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 10px;
          box-shadow: var(--shadow-sm);
          transition: var(--transition);
        }
        
        .appointment-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow);
          border-color: var(--primary);
        }
        
        /* Desktop & Mobile display switching */
        @media (max-width: 768px) {
          .desktop-table-container {
            display: none !important;
          }
          .mobile-cards-container {
            display: flex !important;
            flex-direction: column;
            gap: 12px;
          }
        }
        
        @media (min-width: 769px) {
          .desktop-table-container {
            display: block !important;
          }
          .mobile-cards-container {
            display: none !important;
          }
        }
        
        @media (max-width: 500px) {
          .grid-responsive-2col,
          .grid-responsive-1to2col {
            grid-template-columns: 1fr !important;
          }
          .modal-content {
            width: 95% !important;
            margin: 10px !important;
          }
        }
      `}</style>

      {/* Appointments List */}
      <div className="appointments-wrapper">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Chargement des créneaux...
          </div>
        ) : appointments.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Aucun rendez-vous enregistré à cette date.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="table-container desktop-table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Heure</th>
                    <th>Patient</th>
                    <th>Téléphone</th>
                    <th>Praticien</th>
                    <th>Motif de visite</th>
                    <th>Durée</th>
                    <th>Statut</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map(appt => {
                    const hour = new Date(appt.date_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <tr key={appt.id}>
                        <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{hour}</td>
                        <td style={{ fontWeight: 600 }}>{appt.patient_last_name.toUpperCase()} {appt.patient_first_name}</td>
                        <td>{appt.patient_phone}</td>
                        <td>{appt.practitioner_name}</td>
                        <td style={{ fontSize: '0.9rem' }}>{appt.motif}</td>
                        <td>{appt.duration} min</td>
                        <td>
                          <span className={`badge ${statusBadges[appt.status]}`}>
                            {statusLabels[appt.status]}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {appt.status === 'scheduled' && ['admin', 'secretary'].includes(user?.role || '') && (
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
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
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="mobile-cards-container">
              {appointments.map(appt => {
                const hour = new Date(appt.date_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={appt.id} className="appointment-card">
                    {/* Time & Status Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: 'var(--primary)' }}>
                        <Clock size={16} />
                        <span>{hour}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>({appt.duration} min)</span>
                      </div>
                      <span className={`badge ${statusBadges[appt.status]}`}>
                        {statusLabels[appt.status]}
                      </span>
                    </div>

                    {/* Patient & Phone */}
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                        {appt.patient_last_name.toUpperCase()} {appt.patient_first_name}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        <Phone size={14} style={{ color: 'var(--text-muted)' }} />
                        <span>{appt.patient_phone}</span>
                      </div>
                    </div>

                    {/* Practitioner Name */}
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <User size={14} style={{ color: 'var(--text-muted)' }} />
                      <span>{appt.practitioner_name}</span>
                    </div>

                    {/* Motif */}
                    <div style={{ fontSize: '0.85rem', padding: '8px 10px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '0.8rem' }}>Motif : </strong>
                      {appt.motif}
                    </div>

                    {/* Mobile Actions */}
                    {appt.status === 'scheduled' && ['admin', 'secretary'].includes(user?.role || '') && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                        <button
                          onClick={() => handleUpdateStatus(appt.id, 'completed')}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.75rem', color: 'var(--success)', borderColor: 'var(--success)', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Check size={14} />
                          <span>Confirmer</span>
                        </button>
                        
                        <button
                          onClick={() => handleUpdateStatus(appt.id, 'cancelled')}
                          className="btn btn-outline"
                          style={{ padding: '6px 12px', fontSize: '0.75rem', borderColor: 'var(--danger)', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <X size={14} />
                          <span>Annuler</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* BOOKING MODAL */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={handleCloseModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Planifier un Rendez-vous</h3>
              <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <form onSubmit={handleBookingSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {/* Search Patient */}
                <div className="form-group" style={{ position: 'relative' }}>
                  <label>Rechercher le patient *</label>
                  <input
                    type="text"
                    placeholder="Tapez le nom du patient..."
                    value={patientSearch}
                    onChange={e => setPatientSearch(e.target.value)}
                    className="input-control"
                  />
                  {/* Result Box */}
                  {patients.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      boxShadow: 'var(--shadow-md)',
                      maxHeight: '150px',
                      overflowY: 'auto',
                      zIndex: 110,
                      marginTop: '4px'
                    }}>
                      {patients.map(p => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedPatientId(p.id.toString());
                            setPatientSearch(`${p.last_name.toUpperCase()} ${p.first_name}`);
                            setPatients([]);
                          }}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border)',
                            fontSize: '0.85rem'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <strong>{p.last_name.toUpperCase()} {p.first_name}</strong> ({p.folder_number})
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Practitioner */}
                <div className="form-group">
                  <label>Médecin / Praticien *</label>
                  <select
                    value={bookingPractitionerId}
                    onChange={e => setBookingPractitionerId(e.target.value)}
                    className="input-control"
                    required
                  >
                    <option value="">-- Sélectionner le médecin --</option>
                    {practitioners.map(doc => (
                      <option key={doc.id} value={doc.id}>{doc.name}</option>
                    ))}
                  </select>
                </div>

                {/* Date & Time */}
                <div className="grid-responsive-2col">
                  <div className="form-group">
                    <label>Date du RDV *</label>
                    <input
                      type="date"
                      value={bookingDate}
                      onChange={e => setBookingDate(e.target.value)}
                      className="input-control"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Heure du RDV *</label>
                    <input
                      type="time"
                      value={bookingTime}
                      onChange={e => setBookingTime(e.target.value)}
                      className="input-control"
                      required
                    />
                  </div>
                </div>

                {/* Duration & Motif */}
                <div className="grid-responsive-1to2col">
                  <div className="form-group">
                    <label>Durée (min)</label>
                    <input
                      type="number"
                      value={bookingDuration}
                      onChange={e => setBookingDuration(parseInt(e.target.value) || 30)}
                      className="input-control"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Motif de visite *</label>
                    <input
                      type="text"
                      placeholder="Ex: Fièvre, Bilan sanguin"
                      value={bookingMotif}
                      onChange={e => setBookingMotif(e.target.value)}
                      className="input-control"
                      required
                    />
                  </div>
                </div>

              </div>

              <div className="modal-footer">
                <button type="button" onClick={handleCloseModal} className="btn btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Planification...' : 'Planifier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
