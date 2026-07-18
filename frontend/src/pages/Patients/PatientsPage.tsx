import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { Search, UserPlus, Eye, Archive, UserCheck } from 'lucide-react';

interface Patient {
  id: number;
  folder_number: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  allergies: string;
  antecedents: string;
  archived: number;
}

interface PatientsPageProps {
  onSelectPatient: (id: number) => void;
  triggerOpenModal?: boolean;
  onModalClosed?: () => void;
}

export const PatientsPage: React.FC<PatientsPageProps> = ({ onSelectPatient, triggerOpenModal = false, onModalClosed }) => {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState<string>('');
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // New Patient Form Modal States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [birthDate, setBirthDate] = useState<string>('');
  const [gender, setGender] = useState<string>('F');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [allergies, setAllergies] = useState<string>('');
  const [antecedents, setAntecedents] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchPatients = async (query = '', archived = false) => {
    try {
      setLoading(true);
      const data = await api.get(`/patients?q=${encodeURIComponent(query)}&showArchived=${archived}`);
      setPatients(data);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', 'Impossible de récupérer la liste des patients.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients(search, showArchived);
  }, [search, showArchived]);

  useEffect(() => {
    if (triggerOpenModal) {
      setIsModalOpen(true);
    }
  }, [triggerOpenModal]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Reset Form
    setFirstName('');
    setLastName('');
    setBirthDate('');
    setGender('F');
    setPhone('');
    setEmail('');
    setAddress('');
    setAllergies('');
    setAntecedents('');
    
    if (onModalClosed) {
      onModalClosed();
    }
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !birthDate || !phone) {
      showToast('error', 'Champs requis', 'Veuillez remplir les champs obligatoires.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        firstName,
        lastName,
        birthDate,
        gender,
        phone,
        email,
        address,
        allergies,
        antecedents
      };

      const newPatient = await api.post('/patients', payload);
      showToast('success', 'Patient créé', `Dossier ${newPatient.folder_number} généré avec succès.`);
      handleCloseModal();
      fetchPatients(search, showArchived);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Échec de création', err.error || 'Erreur lors de la création du dossier patient.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchivePatient = async (id: number) => {
    if (!window.confirm("Voulez-vous vraiment archiver ce dossier patient ?")) return;

    try {
      await api.delete(`/patients/${id}`);
      showToast('success', 'Patient archivé', 'Le patient a été déplacé dans les archives.');
      fetchPatients(search, showArchived);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur d\'archivage', err.error || 'Impossible d\'archiver le dossier.');
    }
  };

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Title & Top controls */}
      <div className="flex justify-between align-center" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-secondary)' }}>Répertoire des Patients</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Recherchez et gérez les dossiers médicaux de la clinique.</p>
        </div>

        {['admin', 'secretary', 'manager'].includes(user?.role || '') && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary"
            style={{ gap: '6px' }}
          >
            <UserPlus size={18} />
            <span>Nouveau Dossier Patient</span>
          </button>
        )}
      </div>

      {/* Filters & Search */}
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', padding: '1rem' }}>
        {/* Search */}
        <div style={{ position: 'relative', maxWidth: '350px', width: '100%' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Nom, prénom, n° de dossier..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-control w-full"
            style={{ paddingLeft: '38px' }}
          />
        </div>

        {/* Filter archive */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setShowArchived(false)}
            className={`btn ${!showArchived ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.875rem' }}
          >
            Actifs
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`btn ${showArchived ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.875rem' }}
          >
            Archives
          </button>
        </div>
      </div>

      {/* Patients Table */}
      <div className="table-container">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Chargement de la liste...
          </div>
        ) : patients.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Aucun dossier patient trouvé.
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>N° Dossier</th>
                <th>Nom & Prénoms</th>
                <th>Date naiss. (Sexe)</th>
                <th>Téléphone</th>
                <th>Allergies & Antécédents</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {patients.map(pat => (
                <tr key={pat.id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--primary)' }}>
                      {pat.folder_number}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {pat.last_name.toUpperCase()} {pat.first_name}
                  </td>
                  <td>
                    {new Date(pat.birth_date).toLocaleDateString('fr-FR')} ({pat.gender})
                  </td>
                  <td>{pat.phone}</td>
                  <td>
                    <div style={{ fontSize: '0.8rem', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pat.allergies && <span className="badge badge-danger" style={{ marginRight: '4px' }}>Allergie: {pat.allergies}</span>}
                      {pat.antecedents && <span className="badge badge-warning">ATCD: {pat.antecedents}</span>}
                      {!pat.allergies && !pat.antecedents && <span style={{ color: 'var(--text-muted)' }}>Aucun signalé</span>}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        onClick={() => onSelectPatient(pat.id)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px' }}
                        title="Consulter le dossier"
                      >
                        <Eye size={14} />
                        Consulter
                      </button>
                      
                      {!pat.archived && ['admin', 'secretary'].includes(user?.role || '') && (
                        <button
                          onClick={() => handleArchivePatient(pat.id)}
                          className="btn btn-outline"
                          style={{ padding: '6px 10px', fontSize: '0.8rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                          title="Archiver"
                        >
                          <Archive size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* NEW PATIENT FORM MODAL */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={handleCloseModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Créer un Dossier Patient</h3>
              <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <form onSubmit={handleCreatePatient}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Nom de famille *</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="input-control"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Prénom(s) *</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="input-control"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Date de naissance *</label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={e => setBirthDate(e.target.value)}
                    className="input-control"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Genre / Sexe *</label>
                  <select
                    value={gender}
                    onChange={e => setGender(e.target.value)}
                    className="input-control"
                    required
                  >
                    <option value="F">Féminin (F)</option>
                    <option value="M">Masculin (M)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Téléphone *</label>
                  <input
                    type="tel"
                    placeholder="Ex: +225 0707..."
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="input-control"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Adresse Email</label>
                  <input
                    type="email"
                    placeholder="optionnel"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input-control"
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Adresse d'habitation</label>
                  <input
                    type="text"
                    placeholder="Quartier, Commune..."
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="input-control"
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Allergies connues</label>
                  <input
                    type="text"
                    placeholder="Ex: Pénicilline, Sulfamides... (séparés par des virgules)"
                    value={allergies}
                    onChange={e => setAllergies(e.target.value)}
                    className="input-control"
                    style={{ borderColor: allergies ? 'var(--danger)' : 'var(--border)' }}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Antécédents médicaux majeurs</label>
                  <textarea
                    placeholder="Ex: Diabète Type 2, Hypertension artérielle..."
                    value={antecedents}
                    onChange={e => setAntecedents(e.target.value)}
                    className="input-control"
                    style={{ height: '60px', resize: 'none' }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={handleCloseModal} className="btn btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Enregistrement...' : 'Enregistrer le dossier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
