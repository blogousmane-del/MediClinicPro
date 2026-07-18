import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';

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
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Results Modal Form
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [resultsText, setResultsText] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const data = await api.get(`/laboratory/exams?status=${activeTab}`);
      setExams(data);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', 'Impossible de récupérer la file d\'attente des examens.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, [activeTab]);

  const handleOpenResultsForm = (exam: Exam) => {
    setSelectedExam(exam);
    setResultsText('');
  };

  const handleSaveResults = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resultsText) {
      showToast('error', 'Champs requis', 'Veuillez saisir le compte rendu de l\'analyse.');
      return;
    }

    setIsSaving(true);
    try {
      await api.post(`/laboratory/results/${selectedExam?.id}`, { resultsText });
      showToast('success', 'Résultats enregistrés', 'Les résultats d\'analyses ont été transmis au dossier patient.');
      setSelectedExam(null);
      fetchExams();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', err.error || 'Impossible d\'enregistrer les résultats.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-secondary)' }}>Laboratoire d'analyses</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Consultez la file d'attente des examens prescrits et saisissez les résultats.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('pending')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 6px',
            color: activeTab === 'pending' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'pending' ? 600 : 400,
            borderBottom: activeTab === 'pending' ? '3px solid var(--primary)' : 'none',
            cursor: 'pointer',
            fontSize: '0.95rem'
          }}
        >
          Examens en attente
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 6px',
            color: activeTab === 'completed' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'completed' ? 600 : 400,
            borderBottom: activeTab === 'completed' ? '3px solid var(--primary)' : 'none',
            cursor: 'pointer',
            fontSize: '0.95rem'
          }}
        >
          Résultats saisis (Historique)
        </button>
      </div>

      {/* Grid List */}
      <div className="table-container">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Chargement des examens...</div>
        ) : exams.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Aucun examen enregistré.</div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date prescription</th>
                <th>N° Dossier</th>
                <th>Patient</th>
                <th>Examen demandé</th>
                <th>Médecin prescripteur</th>
                {activeTab === 'completed' && <th>Résultat / Conclusion</th>}
                {activeTab === 'completed' && <th>Laborantin</th>}
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {exams.map(ex => {
                const date = new Date(ex.created_at).toLocaleDateString('fr-FR');
                const time = new Date(ex.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                
                return (
                  <tr key={ex.id}>
                    <td>{date} à {time}</td>
                    <td style={{ fontFamily: 'monospace' }}>{ex.folder_number}</td>
                    <td style={{ fontWeight: 600 }}>{ex.patient_last_name.toUpperCase()} {ex.patient_first_name}</td>
                    <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{ex.test_name}</td>
                    <td>{ex.doctor_name}</td>
                    {activeTab === 'completed' && (
                      <td style={{ fontSize: '0.85rem', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ex.results_text}
                      </td>
                    )}
                    {activeTab === 'completed' && <td style={{ fontSize: '0.85rem' }}>{ex.technician_name}</td>}
                    <td style={{ textAlign: 'right' }}>
                      {ex.status === 'pending' && ['admin', 'lab_tech'].includes(user?.role || '') && (
                        <button
                          onClick={() => handleOpenResultsForm(ex)}
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        >
                          Saisir Résultats
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* RESULTS INPUT MODAL */}
      {selectedExam && (
        <div className="modal-backdrop" onClick={() => setSelectedExam(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Saisie des résultats d'analyse</h3>
              <button onClick={() => setSelectedExam(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <form onSubmit={handleSaveResults}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '10px', borderRadius: '6px', fontSize: '0.85rem' }}>
                  <strong>Patient :</strong> {selectedExam.patient_last_name.toUpperCase()} {selectedExam.patient_first_name} ({selectedExam.folder_number})<br/>
                  <strong>Examen prescrit :</strong> <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{selectedExam.test_name}</span><br/>
                  <strong>Prescripteur :</strong> {selectedExam.doctor_name}
                </div>

                <div className="form-group">
                  <label>Compte-rendu d'analyse / Résultats *</label>
                  <textarea
                    placeholder="Saisissez les conclusions de l'examen (ex: NFS normaux, Frottis positif pour P. falciparum, etc.)..."
                    value={resultsText}
                    onChange={e => setResultsText(e.target.value)}
                    className="input-control"
                    style={{ height: '140px', resize: 'none' }}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setSelectedExam(null)} className="btn btn-secondary">Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
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
