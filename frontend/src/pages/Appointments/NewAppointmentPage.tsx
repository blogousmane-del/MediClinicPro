import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  ArrowLeft, Search, UserPlus, Stethoscope, FileText, Clock, Calendar,
  ChevronLeft, ChevronRight, Check, CheckCircle2, MapPin, User as UserIcon
} from 'lucide-react';

interface Patient {
  id: number;
  first_name: string;
  last_name: string;
  folder_number: string;
  phone: string;
  birth_date: string;
  allergies?: string;
  created_at?: string;
}

interface DaySchedule {
  day: number; // 0=Dimanche..6=Samedi (JS Date.getDay())
  off: boolean;
  start: string; // HH:MM
  end: string;
}

interface Doctor {
  id: number;
  name: string;
  specialty?: string | null;
  work_schedule?: DaySchedule[] | null;
}

interface DayAppointment {
  date_time: string;
  status: string;
}

const MOTIF_SUGGESTIONS = [
  'Consultation générale',
  'Suivi / Contrôle',
  'Fièvre',
  'Douleur',
  'Bilan sanguin',
  'Vaccination'
];

const PRIORITIES: { value: 'normal' | 'urgent' | 'critical'; label: string; color: string; bgLight: string }[] = [
  { value: 'normal', label: 'Normal', color: 'var(--primary)', bgLight: 'var(--primary-light)' },
  { value: 'urgent', label: 'Urgent', color: 'var(--warning)', bgLight: 'var(--warning-light)' },
  { value: 'critical', label: 'Critique', color: 'var(--danger)', bgLight: 'var(--danger-light)' }
];

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

const toISODate = (d: Date) => d.toISOString().split('T')[0];

const timeToMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const minutesToTime = (mins: number) => {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

const generateSlots = (start: string, end: string, stepMin = 30): string[] => {
  const slots: string[] = [];
  for (let t = timeToMinutes(start); t < timeToMinutes(end); t += stepMin) {
    slots.push(minutesToTime(t));
  }
  return slots;
};

const WEEKDAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

interface NewAppointmentPageProps {
  onCancel: () => void;
  onBooked: (smsSimulated: any) => void;
}

export const NewAppointmentPage: React.FC<NewAppointmentPageProps> = ({ onCancel, onBooked }) => {
  const { showToast } = useNotifications();

  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');

  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(toISODate(new Date()));
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [dayAppointments, setDayAppointments] = useState<DayAppointment[]>([]);

  const [motif, setMotif] = useState<string>('');
  const [room, setRoom] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [priority, setPriority] = useState<'normal' | 'urgent' | 'critical'>('normal');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    api.get('/patients').then((data: Patient[]) => {
      const sorted = [...(data || [])].sort((a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      setRecentPatients(sorted.slice(0, 3));
    }).catch(err => console.error(err));

    api.get('/settings/users').then((data: any[]) => {
      setDoctors((data || []).filter(u => u.role === 'doctor' && u.active === 1));
    }).catch(err => console.error(err));
  }, []);

  useEffect(() => {
    const delay = setTimeout(() => {
      if (!searchQuery) {
        setSearchResults([]);
        return;
      }
      api.get(`/patients?q=${encodeURIComponent(searchQuery)}`)
        .then(data => setSearchResults(data || []))
        .catch(err => console.error(err));
    }, 300);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  useEffect(() => {
    if (!selectedDoctorId || !selectedDate) {
      setDayAppointments([]);
      return;
    }
    api.get(`/appointments?date=${selectedDate}&practitionerId=${selectedDoctorId}`)
      .then(data => setDayAppointments(data || []))
      .catch(err => console.error(err));
  }, [selectedDoctorId, selectedDate]);

  const selectedDoctor = useMemo(
    () => doctors.find(d => String(d.id) === selectedDoctorId) || null,
    [doctors, selectedDoctorId]
  );

  const scheduleForSelectedDate = useMemo(() => {
    if (!selectedDoctor?.work_schedule) return null;
    const dow = new Date(`${selectedDate}T00:00:00`).getDay();
    return selectedDoctor.work_schedule.find(d => d.day === dow) || null;
  }, [selectedDoctor, selectedDate]);

  const isClosedDay = scheduleForSelectedDate?.off === true;

  const timeSlots = useMemo(() => {
    if (isClosedDay) return [];
    const start = scheduleForSelectedDate?.start || '08:00';
    const end = scheduleForSelectedDate?.end || '18:00';
    return generateSlots(start, end);
  }, [scheduleForSelectedDate, isClosedDay]);

  const takenTimes = useMemo(() => {
    const set = new Set<string>();
    dayAppointments
      .filter(a => a.status === 'scheduled')
      .forEach(a => set.add(new Date(a.date_time).toTimeString().slice(0, 5)));
    return set;
  }, [dayAppointments]);

  // Calendar grid for the visible month
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayISO = toISODate(new Date());
    const cells: { iso: string; day: number; isOff: boolean; isPast: boolean } [] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null as any);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const iso = toISODate(dateObj);
      const dow = dateObj.getDay();
      const scheduleEntry = selectedDoctor?.work_schedule?.find(s => s.day === dow);
      cells.push({
        iso,
        day: d,
        isOff: scheduleEntry ? scheduleEntry.off : false,
        isPast: iso < todayISO
      });
    }
    return cells;
  }, [calendarMonth, selectedDoctor]);

  const selectPatient = (p: Patient) => {
    setSelectedPatient(p);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !selectedDoctorId || !selectedDate || !selectedTime || !motif.trim()) {
      showToast('error', 'Formulaire incomplet', 'Sélectionnez un patient, un médecin, une date, une heure et un motif.');
      return;
    }

    setIsSubmitting(true);
    try {
      const dateTime = `${selectedDate}T${selectedTime}:00`;
      const response = await api.post('/appointments', {
        patientId: selectedPatient.id,
        practitionerId: parseInt(selectedDoctorId),
        dateTime,
        duration: 30,
        motif: motif.trim(),
        room: room || undefined,
        notes: notes || undefined,
        priority
      });
      showToast('success', 'Rendez-vous planifié', 'Le rendez-vous a été enregistré.');
      onBooked(response.smsSimulated);
    } catch (err: any) {
      console.error(err);
      if (err.conflict) {
        showToast('error', "Conflit d'horaire", err.error);
      } else {
        showToast('error', 'Échec de planification', err.error || 'Erreur lors de la prise de rendez-vous.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedDoctorLabel = selectedDoctor?.name || '';
  const selectedDateLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="page-container new-rdv-page">
      <style>{`
        .new-rdv-page { display: flex; flex-direction: column; gap: 1.25rem; }
        .new-rdv-layout {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        @media (min-width: 1024px) {
          .new-rdv-layout {
            flex-direction: row;
            align-items: flex-start;
          }
          .new-rdv-form-col { flex: 1; min-width: 0; }
          .new-rdv-side-col { width: 300px; flex-shrink: 0; display: flex; flex-direction: column; gap: 1.25rem; }
        }
        .new-rdv-section {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          overflow: hidden;
          margin-bottom: 1.25rem;
        }
        .new-rdv-section-header {
          padding: 0.85rem 1.1rem;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          font-size: 0.9rem;
          color: var(--text-primary);
        }
        .new-rdv-section-body { padding: 1.1rem; display: flex; flex-direction: column; gap: 1rem; }
        .new-rdv-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background-color: var(--bg-tertiary);
          font-size: 0.8rem;
          cursor: pointer;
          white-space: nowrap;
        }
        .new-rdv-chip.selected { border-color: var(--primary); background-color: var(--primary-light, rgba(13,148,136,0.1)); color: var(--primary); }
        .new-rdv-doctor-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        @media (min-width: 1024px) {
          .new-rdv-doctor-grid { grid-template-columns: repeat(4, 1fr); }
        }
        .new-rdv-doctor-card {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          padding: 10px; border-radius: 8px; border: 1px solid var(--border);
          background-color: var(--bg-tertiary); text-align: center; cursor: pointer;
        }
        .new-rdv-doctor-card.selected { border-color: var(--primary); background-color: var(--primary-light, rgba(13,148,136,0.1)); }
        .new-rdv-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background-color: var(--primary-light, rgba(13,148,136,0.15)); color: var(--primary);
          display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; flex-shrink: 0;
        }
        .new-rdv-priority-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .new-rdv-priority-btn {
          display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px;
          border: 1px solid var(--border); background-color: var(--bg-tertiary); font-size: 0.8rem; font-weight: 600; cursor: pointer;
        }
        .new-rdv-priority-btn.selected { border-color: currentColor; }
        .new-rdv-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; text-align: center; }
        .new-rdv-cal-cell {
          aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
          border-radius: 6px; font-size: 0.75rem; border: 1px solid var(--border); background-color: var(--bg-tertiary); cursor: pointer;
        }
        .new-rdv-cal-cell.today { border-color: var(--primary); }
        .new-rdv-cal-cell.selected { background-color: var(--primary); border-color: var(--primary); color: #fff; font-weight: 700; }
        .new-rdv-cal-cell.disabled { opacity: 0.35; cursor: not-allowed; }
        .new-rdv-slot-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
        .new-rdv-slot {
          padding: 6px 4px; border-radius: 8px; text-align: center; font-size: 0.75rem; font-weight: 600;
          border: 1px solid var(--border); background-color: var(--bg-tertiary); cursor: pointer;
        }
        .new-rdv-slot.taken { opacity: 0.35; cursor: not-allowed; text-decoration: line-through; }
        .new-rdv-slot.selected { background-color: var(--primary); border-color: var(--primary); color: #fff; }
        .new-rdv-summary-box {
          background-color: var(--text-primary); color: var(--bg-secondary);
          border-radius: var(--radius-md); padding: 1rem; display: flex; flex-direction: column; gap: 8px;
        }
        .new-rdv-summary-row { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; opacity: 0.9; }
      `}</style>

      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-secondary"
              style={{ padding: '8px', borderRadius: '8px' }}
              aria-label="Retour"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-secondary)', color: 'var(--text-primary)', margin: 0 }}>
                Nouveau rendez-vous
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                Remplissez les informations ci-dessous pour planifier la consultation
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ gap: '6px' }}>
              <CheckCircle2 size={15} />
              {isSubmitting ? 'Enregistrement...' : 'Confirmer le rendez-vous'}
            </button>
          </div>
        </div>

        <div className="new-rdv-layout">
        {/* LEFT: form */}
        <div className="new-rdv-form-col">

          {/* Patient */}
          <div className="new-rdv-section">
            <div className="new-rdv-section-header"><UserIcon size={14} color="var(--primary)" /> Patient</div>
            <div className="new-rdv-section-body">
              <div className="form-group" style={{ position: 'relative', marginBottom: 0 }}>
                <label>Rechercher un patient existant *</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Nom, prénom ou numéro de dossier…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="input-control"
                    style={{ paddingLeft: '32px' }}
                  />
                </div>
                {searchResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                    backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: '8px', boxShadow: 'var(--shadow-md)', maxHeight: '160px', overflowY: 'auto', marginTop: '4px'
                  }}>
                    {searchResults.map(p => (
                      <div
                        key={p.id}
                        onClick={() => selectPatient(p)}
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}
                      >
                        <strong>{p.last_name.toUpperCase()} {p.first_name}</strong> ({p.folder_number})
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {recentPatients.length > 0 && (
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Patients récents</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {recentPatients.map(p => (
                      <div
                        key={p.id}
                        onClick={() => selectPatient(p)}
                        className={`new-rdv-chip ${selectedPatient?.id === p.id ? 'selected' : ''}`}
                      >
                        <div className="new-rdv-avatar" style={{ width: '22px', height: '22px', fontSize: '0.65rem' }}>
                          {p.first_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700 }}>{p.first_name} {p.last_name}</div>
                          <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{p.folder_number}</div>
                        </div>
                        {selectedPatient?.id === p.id && <Check size={12} />}
                      </div>
                    ))}
                    <div
                      className="new-rdv-chip"
                      title="Créez le patient depuis l'onglet Patients d'abord"
                      style={{ opacity: 0.5, cursor: 'not-allowed', borderStyle: 'dashed' }}
                    >
                      <UserPlus size={13} /> Nouveau patient
                    </div>
                  </div>
                </div>
              )}

              {selectedPatient && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px',
                  backgroundColor: 'var(--primary-light, rgba(13,148,136,0.08))', borderRadius: '8px',
                  border: '1px solid var(--border)'
                }}>
                  <div className="new-rdv-avatar" style={{ width: '38px', height: '38px' }}>
                    {selectedPatient.first_name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: 0, color: 'var(--text-primary)' }}>
                      {selectedPatient.first_name} {selectedPatient.last_name}
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                      {computeAge(selectedPatient.birth_date)} ans · {selectedPatient.folder_number} · {selectedPatient.phone}
                    </p>
                  </div>
                  {selectedPatient.allergies && (
                    <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>{selectedPatient.allergies}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Type & médecin */}
          <div className="new-rdv-section">
            <div className="new-rdv-section-header"><Stethoscope size={14} color="var(--primary)" /> Médecin assigné</div>
            <div className="new-rdv-section-body">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Salle / Espace (optionnel)</label>
                <input
                  type="text"
                  placeholder="Ex : Salle 1"
                  value={room}
                  onChange={e => setRoom(e.target.value)}
                  className="input-control"
                />
              </div>

              {doctors.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Aucun médecin actif. Ajoutez-en un dans Paramètres.
                </p>
              ) : (
                <div className="new-rdv-doctor-grid">
                  {doctors.map(doc => (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDoctorId(String(doc.id))}
                      className={`new-rdv-doctor-card ${selectedDoctorId === String(doc.id) ? 'selected' : ''}`}
                    >
                      <div className="new-rdv-avatar">{doc.name.charAt(0).toUpperCase()}</div>
                      <p style={{ fontSize: '0.75rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{doc.name}</p>
                      {doc.specialty && (
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>{doc.specialty}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="new-rdv-section">
            <div className="new-rdv-section-header"><FileText size={14} color="var(--primary)" /> Notes & motif de consultation</div>
            <div className="new-rdv-section-body">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Motif *</label>
                <input
                  type="text"
                  placeholder="Ex : Suivi tension artérielle"
                  value={motif}
                  onChange={e => setMotif(e.target.value)}
                  className="input-control"
                  required
                />
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {MOTIF_SUGGESTIONS.map(s => (
                    <span
                      key={s}
                      onClick={() => setMotif(s)}
                      className={`new-rdv-chip ${motif === s ? 'selected' : ''}`}
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Notes complémentaires (optionnel)</label>
                <textarea
                  placeholder="Informations supplémentaires…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="input-control"
                  rows={3}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Priorité</label>
                <div className="new-rdv-priority-row" style={{ marginTop: '6px' }}>
                  {PRIORITIES.map(p => (
                    <button
                      type="button"
                      key={p.value}
                      onClick={() => setPriority(p.value)}
                      className={`new-rdv-priority-btn ${priority === p.value ? 'selected' : ''}`}
                      style={{
                        color: priority === p.value ? p.color : 'var(--text-secondary)',
                        backgroundColor: priority === p.value ? p.bgLight : 'var(--bg-tertiary)'
                      }}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: p.color }} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: calendar + slots + summary */}
        <div className="new-rdv-side-col">
          <div className="new-rdv-section" style={{ margin: 0 }}>
            <div className="new-rdv-section-header" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <ChevronLeft size={16} />
              </button>
              <span>{calendarMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
              <button
                type="button"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="new-rdv-section-body">
              <div className="new-rdv-cal-grid">
                {WEEKDAY_LETTERS.map((l, i) => (
                  <span key={i} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{l}</span>
                ))}
                {calendarDays.map((cell, i) => {
                  if (!cell) return <div key={i} />;
                  const disabled = cell.isPast || cell.isOff;
                  const isToday = cell.iso === toISODate(new Date());
                  const isSelected = cell.iso === selectedDate;
                  return (
                    <div
                      key={cell.iso}
                      onClick={() => !disabled && setSelectedDate(cell.iso)}
                      className={`new-rdv-cal-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                    >
                      {cell.day}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="new-rdv-section" style={{ margin: 0 }}>
            <div className="new-rdv-section-header"><Clock size={13} color="var(--primary)" /> Créneaux disponibles</div>
            <div className="new-rdv-section-body">
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, textTransform: 'capitalize' }}>{selectedDateLabel}</p>
              {isClosedDay ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Médecin non disponible ce jour-là.</p>
              ) : !selectedDoctorId ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Choisissez un médecin pour voir ses créneaux.</p>
              ) : (
                <div className="new-rdv-slot-grid">
                  {timeSlots.map(slot => {
                    const taken = takenTimes.has(slot);
                    const selected = selectedTime === slot;
                    return (
                      <div
                        key={slot}
                        onClick={() => !taken && setSelectedTime(slot)}
                        className={`new-rdv-slot ${taken ? 'taken' : ''} ${selected ? 'selected' : ''}`}
                      >
                        {slot}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="new-rdv-summary-box">
            <p style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Récapitulatif</p>
            <div className="new-rdv-summary-row"><UserIcon size={12} /> {selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name}` : '—'}</div>
            <div className="new-rdv-summary-row"><Stethoscope size={12} /> {selectedDoctorLabel || '—'}</div>
            <div className="new-rdv-summary-row"><Calendar size={12} /> <span style={{ textTransform: 'capitalize' }}>{selectedDateLabel}</span></div>
            <div className="new-rdv-summary-row"><Clock size={12} /> {selectedTime || '—'}</div>
            {room && <div className="new-rdv-summary-row"><MapPin size={12} /> {room}</div>}

            <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} />
              {isSubmitting ? 'Enregistrement...' : 'Confirmer'}
            </button>
          </div>
        </div>
        </div>
      </form>
    </div>
  );
};

export default NewAppointmentPage;
