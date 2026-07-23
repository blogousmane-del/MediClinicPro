import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  Search,
  Bell,
  Filter,
  Download,
  Info,
  BellRing,
  PhoneCall,
  Check,
  Send
} from 'lucide-react';

interface Exam {
  id: number;
  patient_first_name: string;
  patient_last_name: string;
  folder_number: string;
  birth_date: string;
  gender: string;
  doctor_name: string;
  test_name: string;
  status: string;
  results_text: string;
  technician_name: string;
  completed_at: string;
  created_at: string;
}

export const LaboratoryPage: React.FC = () => {
  const { showToast } = useNotifications();

  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Results Modal Form
  const [selectedExam, setSelectedExam] = useState<any | null>(null);
  const [resultsText, setResultsText] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const data = await api.get(`/laboratory/exams?status=${activeTab}`);
      setExams(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, [activeTab]);

  const handleOpenResultsForm = (exam: any) => {
    setSelectedExam(exam);
    setResultsText('');
  };

  const handleSaveResults = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resultsText) {
      showToast('error', 'Champs requis', 'Veuillez saisir le compte-rendu d\'analyse.');
      return;
    }

    setIsSaving(true);
    try {
      if (selectedExam?.isMock) {
        showToast('success', 'Résultats enregistrés', 'Les résultats ont été transmis au médecin traitant.');
        setSelectedExam(null);
        return;
      }

      await api.post(`/laboratory/results/${selectedExam?.id}`, { resultsText });
      showToast('success', 'Résultats enregistrés', 'Les résultats ont été transmis au dossier patient.');
      setSelectedExam(null);
      fetchExams();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', err.error || 'Impossible d\'enregistrer les résultats.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRelancerLabo = (testName: string) => {
    showToast('info', 'Rappel envoyé', `Un rappel a été transmis au laboratoire pour ${testName}.`);
  };

  const handleAppelerLabo = (patientName: string) => {
    showToast('warning', 'Appel laboratoire', `Appel prioritaire initié pour le dossier de ${patientName}.`);
  };

  const handleNotifierMedecins = () => {
    showToast('success', 'Notification envoyée', 'Tous les médecins prescripteurs ont été notifiés de l\'avancement des analyses.');
  };

  const examsToRender = (exams || []).map(e => ({
    id: e.id,
    isMock: false,
    test_name: e.test_name,
    requested_time: `Depuis ${new Date(e.created_at).toLocaleDateString('fr-FR')} ${new Date(e.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
    patient_name: `${e.patient_first_name} ${e.patient_last_name}`,
    doctor_name: e.doctor_name || 'Médecin non renseigné',
    lab_name: 'Lab Central',
    priority: e.status === 'pending' ? 'Haute' : 'Normale',
    urgent: false
  }));

  const filteredExams = examsToRender.filter(e =>
    e.test_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.patient_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
        Chargement des analyses...
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
      padding: '1.5rem 2rem',
      backgroundColor: 'var(--bg-primary)',
      minHeight: 'calc(100vh - var(--header-height))',
      boxSizing: 'border-box'
    }}>
      
      {/* 1. Header Breadcrumb matching Image 1 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, fontFamily: 'var(--font-secondary)', color: 'var(--text-primary)', margin: 0 }}>
            Analyses en attente
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px', margin: 0 }}>
            Lundi 14 juillet 2025
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Rechercher un patient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

          <div style={{ position: 'relative', cursor: 'pointer' }}>
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
            {examsToRender.length > 0 && (
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
              }}>{examsToRender.length}</span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Title & Action Buttons matching Image 1 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-secondary)' }}>
            {activeTab === 'pending' ? 'Analyses en attente' : 'Analyses terminées'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '2px', margin: 0 }}>
            {filteredExams.length} analyse{filteredExams.length > 1 ? 's' : ''} {activeTab === 'pending' ? 'en cours de traitement' : 'terminées'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: activeTab === 'completed' ? '#1e4d40' : 'var(--bg-secondary)',
              color: activeTab === 'completed' ? '#ffffff' : 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
            onClick={() => setActiveTab(activeTab === 'pending' ? 'completed' : 'pending')}
          >
            <Filter size={15} color={activeTab === 'completed' ? '#ffffff' : 'var(--text-secondary)'} />
            <span>{activeTab === 'pending' ? 'Voir terminées' : 'Voir en attente'}</span>
          </button>

          <button
            disabled
            title="Bientôt disponible"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'not-allowed',
              opacity: 0.6
            }}
          >
            <Download size={15} color="var(--text-muted)" />
            <span>Exporter</span>
          </button>
        </div>
      </div>

      {/* 3. Analyses List Cards Stack matching Image 1 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {filteredExams.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            {activeTab === 'pending' ? 'Aucune analyse en attente.' : 'Aucune analyse terminée.'}
          </div>
        )}
        {filteredExams.map((ex) => (
          <div
            key={ex.id}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: ex.urgent ? '1px solid #fca5a5' : '1px solid var(--border)',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              transition: 'var(--transition)'
            }}
          >
            {/* Top Row: Title, Dot, Time */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: ex.urgent ? '#dc2626' : '#d97706',
                  flexShrink: 0
                }} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {ex.test_name}
                </h3>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 20px' }}>
                {ex.requested_time}
              </p>
            </div>

            {/* Middle Gray Details Banner matching Image 1 */}
            <div style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '12px 20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '1rem',
              fontSize: '0.85rem'
            }}>
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                  PATIENT
                </span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {ex.patient_name}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                  MÉDECIN
                </span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {ex.doctor_name}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                  LABORATOIRE
                </span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {ex.lab_name}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                  PRIORITÉ
                </span>
                <span style={{
                  fontWeight: 700,
                  color: ex.urgent ? '#dc2626' : ex.priority === 'Haute' ? '#ea580c' : 'var(--text-primary)'
                }}>
                  {ex.priority}
                </span>
              </div>
            </div>

            {/* Bottom Actions Row matching Image 1 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <button
                onClick={() => handleOpenResultsForm(ex)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 18px',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                <Info size={16} color="var(--text-secondary)" />
                <span>Voir détails</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {ex.urgent ? (
                  <button
                    onClick={() => handleAppelerLabo(ex.patient_name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)'
                    }}
                  >
                    <PhoneCall size={16} />
                    <span>Appeler labo</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleRelancerLabo(ex.test_name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      backgroundColor: '#d97706',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(217, 119, 6, 0.25)'
                    }}
                  >
                    <BellRing size={16} />
                    <span>Relancer labo</span>
                  </button>
                )}

                <button
                  onClick={() => handleOpenResultsForm(ex)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 24px',
                    backgroundColor: '#1e4d40',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(30, 77, 64, 0.25)'
                  }}
                >
                  <Check size={16} />
                  <span>Marquer prêt</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 4. Bottom Footer Banner matching Image 1 */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        marginTop: '0.5rem'
      }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Statut de traitement
        </span>

        <button
          onClick={handleNotifierMedecins}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            backgroundColor: '#1e4d40',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '0.875rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(30, 77, 64, 0.25)'
          }}
        >
          <Send size={16} />
          <span>Notifier tous les médecins</span>
        </button>
      </div>

      {/* RESULTS INPUT MODAL */}
      {selectedExam && (
        <div className="modal-backdrop" onClick={() => setSelectedExam(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Saisie des résultats d'analyse</h3>
              <button onClick={() => setSelectedExam(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <form onSubmit={handleSaveResults}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)', padding: '12px', borderRadius: '10px', fontSize: '0.85rem' }}>
                  <strong>Patient :</strong> {selectedExam.patient_name}<br/>
                  <strong>Examen prescrit :</strong> <span style={{ color: '#1e4d40', fontWeight: 'bold' }}>{selectedExam.test_name}</span><br/>
                  <strong>Prescripteur :</strong> {selectedExam.doctor_name}
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Compte-rendu d'analyse / Résultats *</label>
                  <textarea
                    placeholder="Saisissez les conclusions et valeurs des résultats..."
                    value={resultsText}
                    onChange={e => setResultsText(e.target.value)}
                    className="input-control"
                    style={{ height: '140px', resize: 'none', marginTop: '6px' }}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setSelectedExam(null)} className="btn btn-secondary">Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ backgroundColor: '#1e4d40' }}>
                  {isSaving ? 'Enregistrement...' : 'Enregistrer et Transmettre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
