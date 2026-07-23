import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { PhoneInput } from '../../components/PhoneInput';
import {
  Search,
  UserPlus,
  Eye,
  Pencil,
  Trash2,
  Bell,
  Check,
  X,
  User,
  Phone,
  FileText,
  Lightbulb,
  ChevronRight,
  ChevronLeft,
  Info
} from 'lucide-react';

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
  created_at?: string;
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
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState<boolean>(true);

  // View state: 'list' | 'create'
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Form States matching Image 1
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [birthDate, setBirthDate] = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [customFolderNum, setCustomFolderNum] = useState<string>('');
  const [allergies, setAllergies] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchPatients = async (query = '', filter = 'all') => {
    try {
      setLoading(true);
      const archivedParam = filter === 'inactive';
      const data = await api.get(`/patients?q=${encodeURIComponent(query)}&showArchived=${archivedParam}`);
      setPatients(data);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', 'Impossible de récupérer la liste des patients.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients(search, filterStatus);
  }, [search, filterStatus]);

  useEffect(() => {
    if (triggerOpenModal) {
      setIsCreating(true);
    }
  }, [triggerOpenModal]);

  const handleCancelCreate = () => {
    setIsCreating(false);
    setFirstName('');
    setLastName('');
    setBirthDate('');
    setGender('');
    setPhone('');
    setEmail('');
    setAddress('');
    setCustomFolderNum('');
    setAllergies('');
    setNotes('');
    
    if (onModalClosed) {
      onModalClosed();
    }
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !phone) {
      showToast('error', 'Champs requis', 'Veuillez remplir au moins le Nom, le Prénom et le Téléphone.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        firstName,
        lastName,
        birthDate: birthDate || '1990-01-01',
        gender: gender || 'M',
        phone,
        email,
        address,
        folder_number: customFolderNum || undefined,
        allergies,
        antecedents: notes
      };

      const newPatient = await api.post('/patients', payload);
      showToast('success', 'Patient créé', `Dossier ${newPatient.folder_number} enregistré avec succès.`);
      handleCancelCreate();
      fetchPatients(search, filterStatus);
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
      fetchPatients(search, filterStatus);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur d\'archivage', err.error || 'Impossible d\'archiver le dossier.');
    }
  };

  const calculateAge = (birthDateStr: string): string => {
    if (!birthDateStr) return '45 ans';
    const birth = new Date(birthDateStr);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return `${age > 0 ? age : 35} ans`;
  };

  const patientRowsToRender = (patients || []).map(p => ({
    id: p.id,
    folder_number: p.folder_number || `P00${p.id}`,
    first_name: p.first_name,
    last_name: p.last_name,
    age: calculateAge(p.birth_date),
    phone: p.phone,
    allergy: p.allergies || 'Aucune',
    status: p.archived ? 'Inactif' : 'Actif'
  }));

  // IF CREATING PATIENT: RENDER THE "Nouveau patient" VIEW
  if (isCreating) {
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
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-secondary)', color: 'var(--text-primary)', margin: 0 }}>
              Ajouter un patient
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
                className="input-control"
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-secondary)',
                  fontSize: '0.85rem'
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

        {/* Title Banner */}
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-secondary)' }}>
            Nouveau patient
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '2px' }}>
            Enregistrer un patient dans votre clinique
          </p>
        </div>

        {/* Info Alert Box */}
        <div style={{
          backgroundColor: '#e6f4ea',
          border: '1px solid #bbf7d0',
          borderRadius: '12px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#1e4d40',
          fontSize: '0.85rem',
          fontWeight: 500
        }}>
          <Info size={18} color="#1e4d40" style={{ flexShrink: 0 }} />
          <span>Les informations de base permettront à l'équipe de retrouver rapidement le patient et de gérer ses consultations.</span>
        </div>

        {/* Form & Sidebar Grid */}
        <form onSubmit={handleCreatePatient}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)',
            gap: '1.5rem',
            alignItems: 'start'
          }}>
            {/* LEFT FORM */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Identité */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
                  <User size={18} color="#1e4d40" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Identité</h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>PRÉNOM</label>
                    <input type="text" placeholder="ex. : Kouassi" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', fontSize: '0.9rem', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>NOM</label>
                    <input type="text" placeholder="ex. : Adjobi" value={lastName} onChange={(e) => setLastName(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', fontSize: '0.9rem', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} required />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>GENRE</label>
                    <select value={gender} onChange={(e) => setGender(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', fontSize: '0.9rem', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}>
                      <option value="">Sélectionner</option>
                      <option value="M">Masculin</option>
                      <option value="F">Féminin</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>DATE DE NAISSANCE</label>
                    <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', fontSize: '0.9rem', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
                  <Phone size={18} color="#1e4d40" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Contact</h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>TÉLÉPHONE</label>
                    <PhoneInput value={phone} onChange={setPhone} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>EMAIL (OPTIONNEL)</label>
                    <input type="email" placeholder="email@exemple.ci" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', fontSize: '0.9rem', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>ADRESSE</label>
                  <input type="text" placeholder="ex. : Abidjan, Cocody" value={address} onChange={(e) => setAddress(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', fontSize: '0.9rem', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              {/* Antécédents médicaux */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
                  <FileText size={18} color="#1e4d40" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Antécédents médicaux</h3>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>NUMÉRO DE DOSSIER (OPTIONNEL)</label>
                  <input type="text" placeholder="ex. : DOSS-2025-001" value={customFolderNum} onChange={(e) => setCustomFolderNum(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', fontSize: '0.9rem', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>ALLERGIES (OPTIONNEL)</label>
                  <textarea placeholder="Lister les allergies connues..." value={allergies} onChange={(e) => setAllergies(e.target.value)} rows={2} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', fontSize: '0.9rem', color: 'var(--text-primary)', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>NOTES (OPTIONNEL)</label>
                  <textarea placeholder="Autres informations importantes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)', fontSize: '0.9rem', color: 'var(--text-primary)', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: '#1e4d40',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px 24px',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(30, 77, 64, 0.25)'
                  }}
                >
                  <Check size={16} />
                  <span>{isSaving ? 'Enregistrement...' : 'Créer le patient'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCancelCreate}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '12px 24px',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  <X size={16} color="var(--text-secondary)" />
                  <span>Annuler</span>
                </button>
              </div>
            </div>

            {/* RIGHT SIDEBAR WIDGETS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Patients dans le système</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '0.75rem 0 4px 0' }}>
                  <span style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{patients.length}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>patients actifs</span>
                </div>
              </div>

              <div style={{ backgroundColor: '#e6f4ea', border: '1px solid #bbf7d0', borderRadius: '16px', padding: '1.5rem', color: '#1e4d40' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9rem', marginBottom: '8px' }}>
                  <Lightbulb size={18} color="#1e4d40" />
                  <span>Conseil</span>
                </div>
                <p style={{ fontSize: '0.825rem', lineHeight: 1.5, margin: 0, opacity: 0.9 }}>
                  Complétez au moins les champs Nom, Prénom et Téléphone. Les autres informations peuvent être ajoutées plus tard.
                </p>
              </div>

              <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '1rem' }}>Patients récents</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {patients.slice(0, 3).map((p) => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span>{p.first_name} {p.last_name}</span>
                      <ChevronRight size={14} color="var(--text-muted)" />
                    </div>
                  ))}
                  {patients.length === 0 && (
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>Aucun patient enregistré.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // REGISTRE DES PATIENTS TABLE VIEW MATCHING IMAGE 1
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
      
      {/* 1. Header / Breadcrumb matching Image 1 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h1 style={{
            fontSize: '1.35rem',
            fontWeight: 700,
            fontFamily: 'var(--font-secondary)',
            color: 'var(--text-primary)',
            margin: 0
          }}>
            Registre des patients
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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

      {/* 2. Main Page Title & Top Button matching Image 1 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-secondary)' }}>
            Registre des Patients
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '2px', margin: 0 }}>
            {patientRowsToRender.length} patients · Base de données centralisée
          </p>
        </div>

        {['admin', 'secretary', 'manager'].includes(user?.role || '') && (
          <button
            onClick={() => setIsCreating(true)}
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
              boxShadow: '0 2px 8px rgba(30, 77, 64, 0.25)',
              transition: 'var(--transition)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#163a30'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1e4d40'}
          >
            <UserPlus size={17} />
            <span>Ajouter un patient</span>
          </button>
        )}
      </div>

      {/* 3. Main Container with Filter Tabs & Table matching Image 1 */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '1.25rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem'
      }}>
        
        {/* Filter Tabs & In-table Search Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          {/* Filter Pills matching Image 1 */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setFilterStatus('all')}
              style={{
                padding: '6px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: filterStatus === 'all' ? '#1e4d40' : 'var(--bg-primary)',
                color: filterStatus === 'all' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
            >
              Tous ({patientRowsToRender.length})
            </button>

            <button
              onClick={() => setFilterStatus('active')}
              style={{
                padding: '6px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: filterStatus === 'active' ? '#1e4d40' : 'var(--bg-primary)',
                color: filterStatus === 'active' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
            >
              Actifs ({patientRowsToRender.filter(p => p.status === 'Actif').length})
            </button>

            <button
              onClick={() => setFilterStatus('inactive')}
              style={{
                padding: '6px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: filterStatus === 'inactive' ? '#1e4d40' : 'var(--bg-primary)',
                color: filterStatus === 'inactive' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
            >
              Inactifs ({patientRowsToRender.filter(p => p.status === 'Inactif').length})
            </button>
          </div>

          {/* In-table Search box */}
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 32px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-primary)',
                fontSize: '0.825rem',
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* 4. Table view matching Image 1 */}
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '0.875rem'
          }}>
            <thead>
              <tr style={{
                backgroundColor: 'var(--bg-primary)',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 700,
                textTransform: 'uppercase'
              }}>
                <th style={{ padding: '12px 16px' }}>ID</th>
                <th style={{ padding: '12px 16px' }}>Patient</th>
                <th style={{ padding: '12px 16px' }}>Âge</th>
                <th style={{ padding: '12px 16px' }}>Téléphone</th>
                <th style={{ padding: '12px 16px' }}>Allergies</th>
                <th style={{ padding: '12px 16px' }}>Dernière visite</th>
                <th style={{ padding: '12px 16px' }}>Statut</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {patientRowsToRender.map((pat, idx) => {
                const isAllergyNone = !pat.allergy || pat.allergy.toLowerCase() === 'aucune' || pat.allergy.toLowerCase() === 'aucun';

                return (
                  <tr 
                    key={pat.id || idx}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      transition: 'var(--transition)',
                      backgroundColor: idx % 2 === 1 ? 'rgba(0,0,0,0.01)' : 'transparent'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? 'rgba(0,0,0,0.01)' : 'transparent'}
                  >
                    {/* ID */}
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                      {pat.folder_number}
                    </td>

                    {/* Patient Name & Avatar */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: '#cbd5e1',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          flexShrink: 0
                        }}>
                          {pat.first_name.charAt(0)}
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {pat.first_name} {pat.last_name}
                        </span>
                      </div>
                    </td>

                    {/* Âge */}
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {pat.age}
                    </td>

                    {/* Téléphone */}
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {pat.phone}
                    </td>

                    {/* Allergies Pill matching Image 1 */}
                    <td style={{ padding: '12px 16px' }}>
                      {isAllergyNone ? (
                        <span style={{
                          backgroundColor: '#e6f4ea',
                          color: '#1e4d40',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}>
                          Aucune
                        </span>
                      ) : (
                        <span style={{
                          backgroundColor: '#ffedd5',
                          color: '#ea580c',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}>
                          {pat.allergy}
                        </span>
                      )}
                    </td>

                    {/* Dernière visite — pas de source de données réelle (nécessiterait une jointure consultations côté backend) */}
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
                      —
                    </td>

                    {/* Statut Pill */}
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        color: pat.status === 'Actif' ? '#0284c7' : '#94a3b8',
                        fontWeight: 600,
                        fontSize: '0.8rem'
                      }}>
                        {pat.status}
                      </span>
                    </td>

                    {/* Actions Icon Buttons matching Image 1 */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => onSelectPatient(pat.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            padding: '4px',
                            borderRadius: '4px'
                          }}
                          title="Consulter le dossier"
                        >
                          <Eye size={16} />
                        </button>

                        <button
                          onClick={() => onSelectPatient(pat.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            padding: '4px',
                            borderRadius: '4px'
                          }}
                          title="Modifier"
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          onClick={() => handleArchivePatient(pat.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            padding: '4px',
                            borderRadius: '4px'
                          }}
                          title="Archiver"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 5. Pagination Footer matching Image 1 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          paddingTop: '0.5rem'
        }}>
          <span>
            Affichage de 1 à {patientRowsToRender.length} sur {patientRowsToRender.length} patients
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}>
              <ChevronLeft size={16} />
            </button>

            <span style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: '#1e4d40',
              color: '#ffffff',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              1
            </span>

            <button style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '6px',
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

      </div>

    </div>
  );
};
