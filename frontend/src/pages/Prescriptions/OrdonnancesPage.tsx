import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { SkeletonCards } from '../../components/Skeleton';
import {
  Search,
  FilePlus,
  Printer,
  Edit3,
  Copy,
  MoreHorizontal,
  Check,
  AlertTriangle,
  Plus,
  Trash2
} from 'lucide-react';

// Le catalogue de médicaments et la liste de formes galéniques écrits en dur
// ici présentaient des produits que la clinique n'a pas forcément en stock, et
// une ligne ainsi prescrite n'était rattachée à aucun `medication_id` — donc
// sa délivrance ne pouvait pas décrémenter le stock. Le formulaire lit
// désormais le vrai catalogue via GET /pharmacy/medications.

const POSOLOGY_OPTIONS = [
  '1 comprimé',
  '2 comprimés',
  '1 gélule',
  '2 gélules',
  '1 cuillère à soupe (15ml)',
  '1 cuillère à café (5ml)',
  '1 sachet',
  '1 ampoule',
  '1 application',
  '5 gouttes'
];

const FREQUENCY_OPTIONS = [
  'x1/jour (Matin)',
  'x2/jour (Matin & Soir)',
  'x3/jour (Matin, Midi & Soir)',
  'x4/jour (Toutes les 6h)',
  'Toutes les 8 heures',
  'Si besoin (en cas de douleur)'
];

interface PrescriptionItem {
  id: number;
  medication_id: number | null;
  medication_name: string;
  dosage: string;
  duration: string;
  posology: string;
  frequency: string;
  quantity_prescribed: number;
  quantity_dispensed: number;
}

interface Prescription {
  id: number;
  patient_id: number;
  patient_name: string;
  patient_age?: string;
  doctor_id: number;
  doctor_name: string;
  date: string;
  diagnostic?: string;
  status: 'remise' | 'partielle' | 'validee';
  notes?: string;
  items: PrescriptionItem[];
}

export const OrdonnancesPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'validee' | 'remise' | 'partielle'>('all');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Real patients & prescribing doctors for the modal's selectors — fetched
  // from the clinic's own data instead of a hardcoded demo list, which was
  // showing made-up patients/doctors as if they were real clinic records.
  const [patients, setPatients] = useState<{ id: number; first_name: string; last_name: string; birth_date: string }[]>([]);
  const [doctors, setDoctors] = useState<{ id: number; name: string }[]>([]);
  // Le catalogue de médicaments est celui de la clinique, pas une liste écrite
  // en dur : c'est `medication_id` qui permet à la dispensation de décrémenter
  // le stock. Sans lui, une ordonnance se délivre sans mouvement de stock.
  const [catalog, setCatalog] = useState<{ id: number; name: string; dosage: string; form: string; stock_quantity: number }[]>([]);

  const calculateAge = (birthDateStr: string): number => {
    const birth = new Date(birthDateStr);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  // Une ligne d'ordonnance. `medication_id` est nul pour une saisie libre : le
// médicament n'est alors pas au catalogue de la clinique et la dispensation ne
// pourra pas bouger le stock.
interface MedicationLine {
  id: number;
  medication_id: number | null;
  custom_name: string;
  posology: string;
  frequency: string;
  duration: string;
  quantity: number;
}

// Une ligne neuve pointe sur le premier médicament du catalogue de la clinique
// quand il y en a un : par défaut sur « hors catalogue », toute ordonnance
// partait sans `medication_id`, donc sans mouvement de stock à la délivrance.
const blankLine = (id: number, medicationId: number | null = null): MedicationLine => ({
  id, medication_id: medicationId, custom_name: '', posology: '1 comprimé',
  frequency: 'x2/jour (Matin & Soir)', duration: '7 jours', quantity: 1
});

// New & Edit prescription modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingPrescriptionId, setEditingPrescriptionId] = useState<number | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [diagnostic, setDiagnostic] = useState<string>('');
  // Le motif de la consultation que l'ordonnance crée quand elle n'en prolonge
  // aucune : `consultations.motif` est NOT NULL.
  const [motif, setMotif] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Dynamic medication lines for prescription form
  const [medicationLines, setMedicationLines] = useState<MedicationLine[]>([blankLine(1)]);
  const firstCatalogId = catalog.length > 0 ? catalog[0].id : null;

  // Dispense modal state
  const [dispenseModalPresc, setDispenseModalPresc] = useState<Prescription | null>(null);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const data = await api.get('/pharmacy/prescriptions');
      if (Array.isArray(data)) {
        setPrescriptions(data.map((p: any) => ({
          id: p.id,
          patient_name: `${p.patient_first_name} ${p.patient_last_name}`,
          // Rien d'inventé ici : l'âge vient de la vraie date de naissance, et
          // le diagnostic comme les notes n'ont pas de colonne en base — ils
          // restent vides au lieu d'afficher « Consultation générale » et
          // « Prendre selon les indications » sur toutes les ordonnances.
          patient_age: p.patient_birth_date ? `${calculateAge(p.patient_birth_date)} ans` : undefined,
          patient_id: p.patient_id,
          doctor_id: p.doctor_id,
          doctor_name: p.doctor_name,
          date: new Date(p.date_time).toLocaleDateString('fr-FR'),
          diagnostic: p.diagnosis || undefined,
          notes: p.notes || undefined,
          status: p.status === 'dispensed' ? 'remise' : p.status === 'partial' ? 'partielle' : 'validee',
          items: p.items ? p.items.map((it: any) => ({
            id: it.id,
            medication_id: it.medication_id || null,
            medication_name: it.medication_name,
            dosage: it.dosage || '',
            duration: it.duration || '',
            // Les quantités retombaient sur 21 quand elles valaient 0 : une
            // ordonnance non délivrée s'affichait comme entièrement délivrée.
            posology: [it.dosage, it.frequency, it.duration].filter(Boolean).join(' — '),
            frequency: it.frequency || '',
            quantity_prescribed: it.quantity_prescribed ?? 0,
            quantity_dispensed: it.quantity_dispensed ?? 0
          })) : []
        })));
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrescriptions();
    api.get('/patients')
      .then((data) => setPatients(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err));
    api.get('/settings/users')
      .then((data) => setDoctors((Array.isArray(data) ? data : []).filter((u: any) => u.role === 'doctor' && u.active === 1)))
      .catch((err) => console.error(err));
    api.get('/pharmacy/medications')
      .then((data) => setCatalog(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err));
  }, []);

  const handleOpenNewModal = () => {
    setEditingPrescriptionId(null);
    setSelectedPatientId('');
    setSelectedDoctorId(user?.role === 'doctor' && user?.id ? String(user.id) : '');
    setDiagnostic('');
    setMotif('');
    setNotes('');
    // Une ligne vide : le formulaire pré-remplissait deux médicaments réels,
    // avec posologie et quantités, sur une ordonnance qui n'existait pas
    // encore. Un clic distrait sur « Enregistrer » prescrivait ces deux-là.
    setMedicationLines([blankLine(1, firstCatalogId)]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (presc: Prescription) => {
    setEditingPrescriptionId(presc.id);
    setSelectedPatientId(String(presc.patient_id));
    setSelectedDoctorId(String(presc.doctor_id));
    setDiagnostic(presc.diagnostic || '');
    setMotif('');
    setNotes(presc.notes || '');
    setMedicationLines(presc.items.map(it => ({
      id: it.id,
      medication_id: it.medication_id,
      custom_name: it.medication_id ? '' : it.medication_name,
      posology: it.dosage,
      frequency: it.frequency,
      duration: it.duration,
      quantity: it.quantity_prescribed
    })));
    setIsModalOpen(true);
  };

  const handleAddMedicationLine = () => {
    setMedicationLines([...medicationLines, blankLine(Date.now(), firstCatalogId)]);
  };

  // Le nom envoyé au serveur : celui du catalogue de la clinique quand la ligne
  // y est rattachée, sinon la saisie libre.
  const lineName = (line: MedicationLine): string => {
    if (line.medication_id) {
      const med = catalog.find(m => m.id === line.medication_id);
      return med ? `${med.name}${med.dosage ? ` ${med.dosage}` : ''}` : '';
    }
    return line.custom_name.trim();
  };

  const handleRemoveMedicationLine = (id: number) => {
    setMedicationLines(medicationLines.filter(l => l.id !== id));
  };

  const handleUpdateMedicationLine = (id: number, field: string, value: any) => {
    setMedicationLines(medicationLines.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  // L'ordonnance part au serveur et la liste est relue derrière : elle ne
  // vivait auparavant que dans le state React, donc « Ordonnance générée avec
  // succès » annonçait un dossier médical qui disparaissait au rechargement.
  const handleCreatePrescriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPatientId) {
      showToast('error', 'Champs requis', 'Veuillez sélectionner un patient.');
      return;
    }

    const emptyLine = medicationLines.find(l => !lineName(l));
    if (medicationLines.length === 0 || emptyLine) {
      showToast('error', 'Champs requis', 'Chaque ligne doit porter un médicament.');
      return;
    }

    const badQuantity = medicationLines.find(l => !Number.isInteger(l.quantity) || l.quantity <= 0);
    if (badQuantity) {
      showToast('error', 'Quantité invalide', `La quantité de « ${lineName(badQuantity)} » doit être un entier supérieur à zéro.`);
      return;
    }

    setIsSaving(true);
    try {
      const items = medicationLines.map(l => ({
        medicationId: l.medication_id || undefined,
        medicationName: lineName(l),
        dosage: l.posology,
        frequency: l.frequency,
        duration: l.duration,
        quantityPrescribed: l.quantity
      }));

      if (editingPrescriptionId) {
        await api.put(`/pharmacy/prescriptions/${editingPrescriptionId}`, {
          doctorId: selectedDoctorId ? Number(selectedDoctorId) : undefined,
          diagnosis: diagnostic,
          notes,
          items
        });
        showToast('success', 'Ordonnance modifiée', 'Les modifications ont été enregistrées.');
      } else {
        await api.post('/pharmacy/prescriptions', {
          patientId: Number(selectedPatientId),
          doctorId: selectedDoctorId ? Number(selectedDoctorId) : undefined,
          motif,
          diagnosis: diagnostic,
          notes,
          items
        });
        showToast('success', 'Ordonnance créée', "L'ordonnance a été enregistrée.");
      }

      setIsModalOpen(false);
      await fetchPrescriptions();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', err.error || "Impossible d'enregistrer l'ordonnance.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintPrescription = (presc: Prescription) => {
    const printContent = `
      <html>
        <head>
          <title>Ordonnance Médicale - ${presc.patient_name}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: var(--text-primary); }
            .header { border-bottom: 2px solid var(--brand-fill); padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; }
            .clinic-title { font-size: 1.4rem; font-weight: bold; color: var(--brand-fill); }
            .doctor-info { font-size: 0.9rem; color: var(--text-muted); margin-top: 4px; }
            .patient-box { background-color: var(--bg-primary); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; margin-bottom: 25px; }
            .rx-title { font-size: 1.2rem; font-weight: bold; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px; color: var(--brand-fill); }
            .item-row { border-bottom: 1px solid var(--bg-tertiary); padding: 10px 0; }
            .item-name { font-weight: bold; font-size: 1rem; color: var(--text-primary); }
            .item-posology { font-size: 0.875rem; color: var(--text-secondary); margin-top: 2px; }
            .footer { margin-top: 50px; text-align: right; font-weight: bold; border-top: 1px solid var(--border); padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="clinic-title">CLINIQUE MÉDICALE DE L'AVENIR</div>
              <div class="doctor-info">Cocody Boulevard de France, Abidjan · Tél: +225 0707080910</div>
            </div>
            <div style="text-align: right;">
              <div>Date: ${presc.date}</div>
              <div style="font-weight: bold; color: var(--brand-fill);">Prescripteur: ${presc.doctor_name}</div>
            </div>
          </div>

          <div class="patient-box">
            <div><strong>Patient :</strong> ${presc.patient_name}${presc.patient_age ? ` (${presc.patient_age})` : ''}</div>
            ${presc.diagnostic ? `<div><strong>Diagnostic :</strong> ${presc.diagnostic}</div>` : ''}
          </div>

          <div class="rx-title">ORDONNANCE MÉDICALE (Rx)</div>

          ${presc.items.map(it => `
            <div class="item-row">
              <div class="item-name">• ${it.medication_name}</div>
              <div class="item-posology">Posologie : ${it.posology} — Quantité : ${it.quantity_prescribed} unités</div>
            </div>
          `).join('')}

          ${presc.notes ? `<div style="margin-top: 20px; font-style: italic; color: var(--text-muted);"><strong>Notes :</strong> ${presc.notes}</div>` : ''}

          <div class="footer">
            Signature & Cachet du Médecin<br/><br/><br/>
            ${presc.doctor_name}
          </div>
        </body>
      </html>
    `;
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(printContent);
      printWin.document.close();
      printWin.print();
    }
    showToast('success', 'Impression', `Document d'ordonnance pour ${presc.patient_name} prêt.`);
  };

  // Le renouvellement crée une vraie ordonnance côté serveur. Il ajoutait
  // auparavant une copie au state React, datée du « 14 juil. 2025 » et au nom
  // de « <patient> (Copie) » : rien n'était enregistré, et le patient affiché
  // n'existait pas.
  const handleDuplicate = async (presc: Prescription) => {
    try {
      await api.post('/pharmacy/prescriptions', {
        patientId: presc.patient_id,
        doctorId: presc.doctor_id,
        motif: "Renouvellement d'ordonnance",
        diagnosis: presc.diagnostic || '',
        notes: presc.notes || '',
        items: presc.items.map(it => ({
          medicationId: it.medication_id || undefined,
          medicationName: it.medication_name,
          dosage: it.dosage,
          frequency: it.frequency,
          duration: it.duration,
          quantityPrescribed: it.quantity_prescribed
        }))
      });
      showToast('success', 'Ordonnance renouvelée', `Une nouvelle ordonnance a été créée pour ${presc.patient_name}.`);
      await fetchPrescriptions();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', err.error || "Impossible de renouveler l'ordonnance.");
    }
  };

  const handleConfirmDispense = async (presc: Prescription) => {
    const dispensations = presc.items
      .filter(it => it.quantity_dispensed < it.quantity_prescribed)
      .map(it => ({ itemId: it.id, qty: it.quantity_prescribed - it.quantity_dispensed }));

    if (dispensations.length === 0) {
      showToast('info', 'Rien à délivrer', 'Toutes les quantités ont déjà été délivrées pour cette ordonnance.');
      setDispenseModalPresc(null);
      return;
    }

    try {
      await api.post(`/pharmacy/dispense/${presc.id}`, { dispensations });
      showToast('success', 'Délivrance effectuée', `L'ordonnance de ${presc.patient_name} a été marquée comme délivrée et le stock a été décrémenté.`);
      setDispenseModalPresc(null);
      fetchPrescriptions();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Échec de la délivrance', err.error || 'Impossible de délivrer l\'ordonnance. Vérifiez le stock disponible.');
    }
  };

  const filteredItems = prescriptions.filter(p => {
    const haystack = `${p.patient_name} ${p.diagnostic || ''}`.toLowerCase();
    const matchesSearch = haystack.includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filterStatus === 'validee') return p.status === 'validee';
    if (filterStatus === 'remise') return p.status === 'remise';
    if (filterStatus === 'partielle') return p.status === 'partielle';
    return true;
  });

  const countValidees = prescriptions.filter(p => p.status === 'validee').length;
  const countRemises = prescriptions.filter(p => p.status === 'remise').length;
  const countPartielles = prescriptions.filter(p => p.status === 'partielle').length;
  const currentMonthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div className="app-page">

      {/* Main Title & Action Button — no page-local date/search/bell here:
          the real Header above already has a search box and (currently
          non-functional, tracked separately) notification bell; duplicating
          them here with a hardcoded date and an unwired search input was
          dead Banani-mockup chrome, not a second real feature. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-secondary)' }}>
            Ordonnances
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '2px', margin: 0 }}>
            {prescriptions.length} ordonnance{prescriptions.length > 1 ? 's' : ''} · {currentMonthLabel}
          </p>
        </div>

        <button
          onClick={handleOpenNewModal}
          className="page-cta-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            backgroundColor: 'var(--brand-fill)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '0.875rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(30, 77, 64, 0.25)',
            transition: 'var(--transition)'
          }}
        >
          <FilePlus size={18} />
          <span>Nouvelle ordonnance</span>
        </button>
      </div>

      {/* 3. Filter Pills & In-table Search Bar matching Image 1 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setFilterStatus('all')}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: filterStatus === 'all' ? 'var(--brand-fill)' : 'var(--bg-secondary)',
              color: filterStatus === 'all' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Tous ({prescriptions.length})
          </button>

          <button
            onClick={() => setFilterStatus('validee')}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: filterStatus === 'validee' ? 'var(--brand-fill)' : 'var(--bg-secondary)',
              color: filterStatus === 'validee' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Validées ({countValidees})
          </button>

          <button
            onClick={() => setFilterStatus('remise')}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: filterStatus === 'remise' ? 'var(--brand-fill)' : 'var(--bg-secondary)',
              color: filterStatus === 'remise' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Remises ({countRemises})
          </button>

          <button
            onClick={() => setFilterStatus('partielle')}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: filterStatus === 'partielle' ? 'var(--brand-fill)' : 'var(--bg-secondary)',
              color: filterStatus === 'partielle' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Partielles ({countPartielles})
          </button>
        </div>

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
              backgroundColor: 'var(--bg-secondary)',
              fontSize: '0.825rem',
              color: 'var(--text-primary)',
              
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* 4. Prescription Cards List Stack matching Image 1 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {loading && <SkeletonCards count={3} height={168} label="Chargement des ordonnances…" />}

        {!loading && filteredItems.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            {prescriptions.length === 0 ? 'Aucune ordonnance enregistrée.' : 'Aucune ordonnance ne correspond à ce filtre.'}
          </div>
        )}
        {filteredItems.map((presc) => {
          let statusPill = null;
          if (presc.status === 'remise') {
            statusPill = (
              <span style={{
                backgroundColor: 'var(--brand-soft)',
                color: 'var(--brand-soft-ink)',
                padding: '4px 12px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Check size={13} />
                Remise
              </span>
            );
          } else if (presc.status === 'partielle') {
            statusPill = (
              <span style={{
                backgroundColor: 'var(--warning-surface)',
                color: 'var(--warning-ink)',
                padding: '4px 12px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <AlertTriangle size={13} />
                Partielle
              </span>
            );
          } else {
            statusPill = (
              <span style={{
                backgroundColor: 'var(--success)',
                color: '#ffffff',
                padding: '4px 12px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Check size={13} />
                Validée
              </span>
            );
          }

          return (
            <div
              key={presc.id}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '1.5rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                transition: 'var(--transition)'
              }}
            >
              {/* Header: Patient Info & Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--border-strong)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '1rem',
                    flexShrink: 0
                  }}>
                    {presc.patient_name.charAt(0)}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        {presc.patient_name}
                      </h3>
                      {presc.patient_age && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {presc.patient_age}
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                      Prescrit par {presc.doctor_name} · {presc.date}
                    </p>

                    {presc.diagnostic && (
                      <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: '4px 0 0 0', fontWeight: 500 }}>
                        <strong>Diagnostic :</strong> {presc.diagnostic}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  {statusPill}
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {presc.status === 'remise'
                      ? 'Délivrée'
                      : presc.status === 'partielle'
                        ? 'Partiellement remise'
                        : 'En attente de délivrance'}
                  </div>
                </div>
              </div>

              {/* Prescribed Items Section */}
              <div>
                <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  MÉDICAMENTS
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {presc.items.map((it) => {
                    const ratio = it.quantity_dispensed / it.quantity_prescribed;
                    const barColor = ratio >= 1 ? 'var(--success)' : ratio > 0 ? 'var(--warning-ink)' : 'var(--border-strong)';

                    return (
                      <div
                        key={it.id}
                        style={{
                          backgroundColor: 'var(--bg-primary)',
                          border: '1px solid var(--border)',
                          borderRadius: '10px',
                          padding: '10px 14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '8px'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            {it.medication_name}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {it.posology}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                            {it.quantity_dispensed}/{it.quantity_prescribed}
                          </span>

                          <div style={{
                            width: '80px',
                            height: '6px',
                            backgroundColor: 'var(--border)',
                            borderRadius: '3px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${Math.min(ratio * 100, 100)}%`,
                              height: '100%',
                              backgroundColor: barColor,
                              borderRadius: '3px'
                            }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              {presc.notes && (
                <div style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  fontStyle: 'italic',
                  borderTop: '1px solid var(--border)',
                  paddingTop: '8px'
                }}>
                  Notes : {presc.notes}
                </div>
              )}

              {/* Bottom Actions Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => handlePrintPrescription(presc)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      backgroundColor: 'var(--brand-fill)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.825rem',
                      cursor: 'pointer'
                    }}
                  >
                    <Printer size={15} />
                    <span>Imprimer</span>
                  </button>

                  <button
                    onClick={() => handleOpenEditModal(presc)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.825rem',
                      cursor: 'pointer'
                    }}
                  >
                    <Edit3 size={15} color="var(--text-secondary)" />
                    <span>Modifier</span>
                  </button>

                  <button
                    onClick={() => handleDuplicate(presc)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.825rem',
                      cursor: 'pointer'
                    }}
                  >
                    <Copy size={15} color="var(--text-secondary)" />
                    <span>Renouveler</span>
                  </button>

                  {presc.status !== 'remise' && ['admin', 'pharmacist'].includes(user?.role || '') && (
                    <button
                      onClick={() => setDispenseModalPresc(presc)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        backgroundColor: 'var(--brand-soft)',
                        color: 'var(--brand-soft-ink)',
                        border: '1px solid var(--brand-line)',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.825rem',
                        cursor: 'pointer'
                      }}
                    >
                      <Check size={15} />
                      <span>Délivrer en pharmacie</span>
                    </button>
                  )}
                </div>

                <button style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}>
                  <MoreHorizontal size={16} />
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* CREATE / EDIT PRESCRIPTION MODAL */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '820px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {editingPrescriptionId ? 'Modifier l\'ordonnance' : 'Créer une nouvelle ordonnance'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <form onSubmit={handleCreatePrescriptionSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* Patient & Prescriber Doctor */}
                <div className="modal-grid" style={{ gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      SÉLECTIONNER LE PATIENT *
                    </label>
                    <select
                      value={selectedPatientId}
                      onChange={(e) => setSelectedPatientId(e.target.value)}
                      className="input-control"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                      disabled={editingPrescriptionId !== null}
                      required
                    >
                      <option value="" disabled>-- Choisir un patient --</option>
                      {patients.length === 0 && <option value="" disabled>Aucun patient enregistré.</option>}
                      {patients.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.first_name} {p.last_name}{p.birth_date ? ` (${calculateAge(p.birth_date)} ans)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      MÉDECIN PRESCRIPTEUR *
                    </label>
                    <select
                      value={selectedDoctorId}
                      onChange={(e) => setSelectedDoctorId(e.target.value)}
                      className="input-control"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                      required
                    >
                      <option value="" disabled>-- Choisir un médecin --</option>
                      {doctors.length === 0 && <option value="" disabled>Aucun médecin actif. Ajoutez-en un dans Paramètres.</option>}
                      {doctors.map((d) => (
                        <option key={d.id} value={String(d.id)}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Motif et diagnostic : ils sont enregistrés sur la
                    consultation que l'ordonnance crée. Le motif ne se saisit
                    qu'à la création, puisqu'une modification ne recrée pas la
                    consultation d'origine. */}
                <div className="modal-grid" style={{ gap: '1rem' }}>
                  {!editingPrescriptionId && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                        MOTIF DE CONSULTATION
                      </label>
                      <input
                        type="text"
                        placeholder="ex. : Fièvre et maux de gorge"
                        value={motif}
                        onChange={(e) => setMotif(e.target.value)}
                        className="input-control"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                      />
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      DIAGNOSTIC
                    </label>
                    <input
                      type="text"
                      placeholder="ex. : Angine bactérienne"
                      value={diagnostic}
                      onChange={(e) => setDiagnostic(e.target.value)}
                      className="input-control"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                    />
                  </div>
                </div>

                {/* Prescribed Medications Dynamic Lines with CATALOGUE & FORME GALÉNIQUE */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      MÉDICAMENTS PRESCRITS *
                    </label>
                    <button
                      type="button"
                      onClick={handleAddMedicationLine}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 12px',
                        backgroundColor: 'var(--brand-fill)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      <Plus size={14} />
                      <span>Ajouter un médicament</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {medicationLines.map((line) => {
                      const isCustom = line.medication_id === null;
                      const catalogEntry = line.medication_id ? catalog.find(m => m.id === line.medication_id) : null;

                      return (
                        <div
                          key={line.id}
                          style={{
                            backgroundColor: 'var(--bg-primary)',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          <div className="rx-med-line-grid">
                            {/* Le catalogue est celui de la clinique : c'est
                                ce rattachement qui permet à la dispensation de
                                décrémenter le stock. */}
                            <div>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                                MÉDICAMENT *
                              </span>
                              <select
                                value={line.medication_id === null ? 'custom' : String(line.medication_id)}
                                onChange={(e) => handleUpdateMedicationLine(line.id, 'medication_id', e.target.value === 'custom' ? null : Number(e.target.value))}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8rem', backgroundColor: 'var(--bg-secondary)' }}
                              >
                                {catalog.map((m) => (
                                  <option key={m.id} value={String(m.id)}>
                                    {m.name}{m.dosage ? ` ${m.dosage}` : ''}{m.form ? ` — ${m.form}` : ''}
                                  </option>
                                ))}
                                <option value="custom">Hors catalogue (saisie libre)</option>
                              </select>
                            </div>

                            {/* DURÉE */}
                            <div>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                                DURÉE
                              </span>
                              <input
                                type="text"
                                placeholder="ex. : 5 jours"
                                value={line.duration}
                                onChange={(e) => handleUpdateMedicationLine(line.id, 'duration', e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8rem', backgroundColor: 'var(--bg-secondary)' }}
                              />
                            </div>

                            {/* POSOLOGIE */}
                            <div>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                                POSOLOGIE
                              </span>
                              <select
                                value={line.posology}
                                onChange={(e) => handleUpdateMedicationLine(line.id, 'posology', e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8rem', backgroundColor: 'var(--bg-secondary)' }}
                              >
                                {POSOLOGY_OPTIONS.map((pos, idx) => (
                                  <option key={idx} value={pos}>{pos}</option>
                                ))}
                              </select>
                            </div>

                            {/* FRÉQUENCE */}
                            <div>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                                FRÉQUENCE
                              </span>
                              <select
                                value={line.frequency}
                                onChange={(e) => handleUpdateMedicationLine(line.id, 'frequency', e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8rem', backgroundColor: 'var(--bg-secondary)' }}
                              >
                                {FREQUENCY_OPTIONS.map((freq, idx) => (
                                  <option key={idx} value={freq}>{freq}</option>
                                ))}
                              </select>
                            </div>

                            {/* QUANTITÉ */}
                            <div>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                                QUANTITÉ
                              </span>
                              <input
                                type="number"
                                value={line.quantity || ''}
                                onChange={(e) => handleUpdateMedicationLine(line.id, 'quantity', e.target.value === '' ? 1 : parseInt(e.target.value) || 1)}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8rem' }}
                              />
                            </div>

                            {/* TRASH ICON */}
                            <button
                              type="button"
                              onClick={() => handleRemoveMedicationLine(line.id)}
                              className="rx-med-line-remove"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px' }}
                              title="Supprimer la ligne"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {isCustom ? (
                            <div style={{ marginTop: '4px' }}>
                              <input
                                type="text"
                                placeholder="Nom et dosage du médicament (ex. : Spasfon 80mg)..."
                                value={line.custom_name}
                                onChange={(e) => handleUpdateMedicationLine(line.id, 'custom_name', e.target.value)}
                                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--brand-line)', fontSize: '0.825rem', backgroundColor: 'var(--brand-soft)', color: 'var(--text-primary)' }}
                                required
                              />
                              <span style={{ display: 'block', marginTop: '4px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                Hors catalogue : la délivrance ne décrémentera aucun stock.
                              </span>
                            </div>
                          ) : catalogEntry && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Stock actuel : {catalogEntry.stock_quantity ?? 0}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    INSTRUCTIONS / NOTES AUX PATIENTS
                  </label>
                  <textarea
                    placeholder="ex. : À prendre avec de la nourriture. Éviter l'alcool."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', resize: 'none', fontSize: '0.85rem' }}
                  />
                </div>

              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ backgroundColor: 'var(--brand-fill)' }}>
                  {isSaving ? 'Enregistrement...' : '✓ Générer & Enregistrer l\'ordonnance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISPENSE PHARMACY MODAL */}
      {dispenseModalPresc && (
        <div className="modal-backdrop" onClick={() => setDispenseModalPresc(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Délivrance de l'ordonnance</h3>
              <button onClick={() => setDispenseModalPresc(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ backgroundColor: 'var(--bg-primary)', padding: '12px', borderRadius: '10px', fontSize: '0.85rem' }}>
                <strong>Patient :</strong> {dispenseModalPresc.patient_name}<br/>
                <strong>Prescripteur :</strong> {dispenseModalPresc.doctor_name}<br/>
                <strong>Diagnostic :</strong> {dispenseModalPresc.diagnostic || '—'}
              </div>

              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                Médicaments à délivrer :
              </div>
              {dispenseModalPresc.items.map(it => (
                <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.825rem' }}>
                  <span>• {it.medication_name}</span>
                  <span style={{ fontWeight: 700, color: 'var(--brand-soft-ink)' }}>{it.quantity_prescribed} unités</span>
                </div>
              ))}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
              <button type="button" onClick={() => setDispenseModalPresc(null)} className="btn btn-secondary">Annuler</button>
              <button onClick={() => handleConfirmDispense(dispenseModalPresc)} className="btn btn-primary" style={{ backgroundColor: 'var(--brand-fill)' }}>
                ✓ Confirmer la délivrance
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default OrdonnancesPage;
