import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search,
  Bell,
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

// Comprehensive catalog of pharmacy medications in CIV & West Africa
const MEDICATION_CATALOG = [
  'Amoxicilline 500mg',
  'Amoxicilline 1g',
  'Amoxicilline + Acide Clavulanique (Augmentin) 1g',
  'Paracétamol 500mg',
  'Paracétamol (Doliprane) 1000mg',
  'Paracétamol Sirop 125ml',
  'Ibuprofène 400mg',
  'Ibuprofène Sirop 100ml',
  'Artéméther + Luméfantrine (Coartem) 20/120mg',
  'Métformine 850mg',
  'Métformine 500mg',
  'Lisinopril 10mg',
  'Amlodipine 5mg',
  'Oméprazole 20mg',
  'Dompéridone 10mg',
  'Spasfon (Phloroglucinol) 80mg',
  'Smecta (Diosmectite) Sachet',
  'Sels de réhydratation orale (SRO)',
  'Ciprofloxacine 500mg',
  'Azithromycine 500mg',
  'Flagyl (Métronidazole) 500mg',
  'Fer + Acide Folique (Fumafer)',
  'Vitamine C 1000mg Effervescent',
  'Diclofénac 50mg',
  'Tramadol 50mg',
  'Linagliptine 5mg',
  'Losartan 50mg',
  'Autre (Saisir manuellement)'
];

const GALENIC_FORMS = [
  'Comprimé',
  'Gélule',
  'Sirop',
  'Injectable',
  'Sachet',
  'Pommade / Crème',
  'Gouttes',
  'Suppositoire',
  'Autre'
];

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
  medication_name: string;
  form: string;
  posology: string;
  frequency: string;
  durationDays: number;
  quantity_prescribed: number;
  quantity_dispensed: number;
}

interface Prescription {
  id: number;
  patient_name: string;
  patient_age: string;
  doctor_name: string;
  date: string;
  diagnostic: string;
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

  // New & Edit prescription modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingPrescriptionId, setEditingPrescriptionId] = useState<number | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string>('Adjobi Kouassi (67 ans)');
  const [doctorName, setDoctorName] = useState<string>('Dr. Aminata Koné');
  const [diagnostic, setDiagnostic] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Dynamic medication lines for prescription form
  const [medicationLines, setMedicationLines] = useState<Array<{
    id: number;
    medication_name: string;
    custom_name?: string;
    form: string;
    posology: string;
    frequency: string;
    durationDays: number;
    quantity: number;
  }>>([
    {
      id: 1,
      medication_name: 'Amoxicilline 500mg',
      custom_name: '',
      form: 'Comprimé',
      posology: '1 comprimé',
      frequency: 'x2/jour (Matin & Soir)',
      durationDays: 7,
      quantity: 21
    },
    {
      id: 2,
      medication_name: 'Paracétamol 500mg',
      custom_name: '',
      form: 'Comprimé',
      posology: '1 comprimé',
      frequency: 'x2/jour (Matin & Soir)',
      durationDays: 8,
      quantity: 10
    }
  ]);

  // Dispense modal state
  const [dispenseModalPresc, setDispenseModalPresc] = useState<Prescription | null>(null);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const data = await api.get('/pharmacy/prescriptions');
      if (Array.isArray(data) && data.length > 0) {
        setPrescriptions(data.map((p: any) => ({
          id: p.id,
          patient_name: `${p.patient_first_name} ${p.patient_last_name}`,
          patient_age: '45 ans',
          doctor_name: p.doctor_name || 'Dr. Aminata Koné',
          date: p.date_time ? new Date(p.date_time).toLocaleDateString('fr-FR') : '14 juil. 2025',
          diagnostic: 'Consultation générale',
          status: p.status === 'dispensed' ? 'remise' : p.status === 'partial' ? 'partielle' : 'validee',
          notes: 'Prendre selon les indications.',
          items: p.items ? p.items.map((it: any) => ({
            id: it.id,
            medication_name: it.medication_name,
            form: it.form || 'Comprimé',
            posology: it.dosage || '1 comprimé',
            frequency: it.frequency || 'x2/jour',
            durationDays: 7,
            quantity_prescribed: it.quantity_prescribed || 21,
            quantity_dispensed: it.quantity_dispensed || 21
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
  }, []);

  const handleOpenNewModal = () => {
    setEditingPrescriptionId(null);
    setSelectedPatientName('Adjobi Kouassi (67 ans)');
    setDoctorName('Dr. Aminata Koné');
    setDiagnostic('');
    setNotes('');
    setMedicationLines([
      {
        id: 1,
        medication_name: 'Amoxicilline 500mg',
        custom_name: '',
        form: 'Comprimé',
        posology: '1 comprimé',
        frequency: 'x2/jour (Matin & Soir)',
        durationDays: 7,
        quantity: 21
      },
      {
        id: 2,
        medication_name: 'Paracétamol 500mg',
        custom_name: '',
        form: 'Comprimé',
        posology: '1 comprimé',
        frequency: 'x2/jour (Matin & Soir)',
        durationDays: 8,
        quantity: 10
      }
    ]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (presc: Prescription) => {
    setEditingPrescriptionId(presc.id);
    setSelectedPatientName(`${presc.patient_name} (${presc.patient_age})`);
    setDoctorName(presc.doctor_name);
    setDiagnostic(presc.diagnostic);
    setNotes(presc.notes || '');
    setMedicationLines(presc.items.map(it => ({
      id: it.id,
      medication_name: MEDICATION_CATALOG.includes(it.medication_name) ? it.medication_name : 'Autre (Saisir manuellement)',
      custom_name: MEDICATION_CATALOG.includes(it.medication_name) ? '' : it.medication_name,
      form: it.form || 'Comprimé',
      posology: it.posology.split(' - ')[0] || '1 comprimé',
      frequency: it.frequency || 'x2/jour (Matin & Soir)',
      durationDays: 7,
      quantity: it.quantity_prescribed
    })));
    setIsModalOpen(true);
  };

  const handleAddMedicationLine = () => {
    const newLine = {
      id: Date.now(),
      medication_name: 'Métformine 850mg',
      custom_name: '',
      form: 'Comprimé',
      posology: '1 comprimé',
      frequency: 'x2/jour (Matin & Soir)',
      durationDays: 30,
      quantity: 60
    };
    setMedicationLines([...medicationLines, newLine]);
  };

  const handleRemoveMedicationLine = (id: number) => {
    setMedicationLines(medicationLines.filter(l => l.id !== id));
  };

  const handleUpdateMedicationLine = (id: number, field: string, value: any) => {
    setMedicationLines(medicationLines.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const handleCreatePrescriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientName || medicationLines.length === 0) {
      showToast('error', 'Champs requis', 'Veuillez sélectionner un patient et ajouter au moins un médicament.');
      return;
    }

    setIsSaving(true);
    try {
      const formattedItems = medicationLines.map(l => {
        const finalName = l.medication_name === 'Autre (Saisir manuellement)' ? (l.custom_name || 'Médicament spécial') : l.medication_name;
        return {
          id: l.id,
          medication_name: finalName,
          form: l.form,
          posology: `${l.posology} - ${l.frequency} - ${l.durationDays} jours`,
          frequency: l.frequency,
          durationDays: l.durationDays,
          quantity_prescribed: l.quantity,
          quantity_dispensed: 0
        };
      });

      if (editingPrescriptionId) {
        // Edit existing
        setPrescriptions(itemsToRender.map(p => p.id === editingPrescriptionId ? {
          ...p,
          patient_name: selectedPatientName.split(' (')[0],
          doctor_name: doctorName,
          diagnostic: diagnostic || 'Consultation générale',
          notes,
          items: formattedItems
        } : p));
        showToast('success', 'Ordonnance modifiée', `Modification enregistrée pour ${selectedPatientName}.`);
      } else {
        // Create new
        const newPresc: Prescription = {
          id: Date.now(),
          patient_name: selectedPatientName.split(' (')[0],
          patient_age: selectedPatientName.includes('(') ? selectedPatientName.split('(')[1].replace(')', '') : '45 ans',
          doctor_name: doctorName,
          date: '14 juil. 2025',
          diagnostic: diagnostic || 'Consultation générale',
          status: 'validee',
          notes: notes || undefined,
          items: formattedItems
        };
        setPrescriptions([newPresc, ...itemsToRender]);
        showToast('success', 'Ordonnance créée', `Ordonnance générée avec succès pour ${selectedPatientName}.`);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', 'Impossible d\'enregistrer l\'ordonnance.');
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
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1e293b; }
            .header { border-bottom: 2px solid #1e4d40; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; }
            .clinic-title { font-size: 1.4rem; font-weight: bold; color: #1e4d40; }
            .doctor-info { font-size: 0.9rem; color: #64748b; margin-top: 4px; }
            .patient-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 25px; }
            .rx-title { font-size: 1.2rem; font-weight: bold; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px; color: #1e4d40; }
            .item-row { border-bottom: 1px solid #f1f5f9; padding: 10px 0; }
            .item-name { font-weight: bold; font-size: 1rem; color: #0f172a; }
            .item-posology { font-size: 0.875rem; color: #475569; margin-top: 2px; }
            .footer { margin-top: 50px; text-align: right; font-weight: bold; border-top: 1px solid #e2e8f0; padding-top: 20px; }
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
              <div style="font-weight: bold; color: #1e4d40;">Prescripteur: ${presc.doctor_name}</div>
            </div>
          </div>

          <div class="patient-box">
            <div><strong>Patient :</strong> ${presc.patient_name} (${presc.patient_age})</div>
            <div><strong>Diagnostic :</strong> ${presc.diagnostic}</div>
          </div>

          <div class="rx-title">ORDONNANCE MÉDICALE (Rx)</div>

          ${presc.items.map(it => `
            <div class="item-row">
              <div class="item-name">• ${it.medication_name} (${it.form || 'Comprimé'})</div>
              <div class="item-posology">Posologie : ${it.posology} — Quantité : ${it.quantity_prescribed} unités</div>
            </div>
          `).join('')}

          ${presc.notes ? `<div style="margin-top: 20px; font-style: italic; color: #64748b;"><strong>Notes :</strong> ${presc.notes}</div>` : ''}

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

  const handleDuplicate = (presc: Prescription) => {
    const duplicatedPresc: Prescription = {
      ...presc,
      id: Date.now(),
      date: '14 juil. 2025',
      status: 'validee',
      patient_name: `${presc.patient_name} (Copie)`
    };
    setPrescriptions([duplicatedPresc, ...itemsToRender]);
    showToast('info', 'Duplication', `Ordonnance de ${presc.patient_name} dupliquée.`);
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

  // Default sample prescriptions data matching Image 1 exact UI wireframe
  const defaultMockPrescriptions: Prescription[] = [
    {
      id: 1,
      patient_name: 'Adjobi Kouassi',
      patient_age: '67 ans',
      doctor_name: 'Dr. Yao Bernard',
      date: '14 juil. 2025',
      diagnostic: 'Infection des voies respiratoires supérieures',
      status: 'remise',
      notes: "À prendre avec de la nourriture. Éviter l'alcool.",
      items: [
        { id: 101, medication_name: 'Amoxicilline 500mg', form: 'Comprimé', posology: '1 comprimé - x2/jour - 7 jours', frequency: 'x2/jour (Matin & Soir)', durationDays: 7, quantity_prescribed: 21, quantity_dispensed: 21 },
        { id: 102, medication_name: 'Paracétamol 500mg', form: 'Comprimé', posology: '1 comprimé - x2/jour - 8 jours', frequency: 'x2/jour (Matin & Soir)', durationDays: 8, quantity_prescribed: 10, quantity_dispensed: 10 }
      ]
    },
    {
      id: 2,
      patient_name: 'Fatou Diomandé',
      patient_age: '48 ans',
      doctor_name: 'Dr. Soro Mariam',
      date: '14 juil. 2025',
      diagnostic: 'Suivi Diabète type 2',
      status: 'remise',
      items: [
        { id: 201, medication_name: 'Métformine 850mg', form: 'Comprimé', posology: '1 comprimé - x2/jour - 30 jours', frequency: 'x2/jour (Matin & Soir)', durationDays: 30, quantity_prescribed: 60, quantity_dispensed: 48 },
        { id: 202, medication_name: 'Linagliptine 5mg', form: 'Comprimé', posology: '1 comprimé - x1/jour - 30 jours', frequency: 'x1/jour (Matin)', durationDays: 30, quantity_prescribed: 30, quantity_dispensed: 30 }
      ]
    },
    {
      id: 3,
      patient_name: 'Brahima Ouattara',
      patient_age: '52 ans',
      doctor_name: 'Dr. Coulibaly A.',
      date: '13 juil. 2025',
      diagnostic: 'Hypertension artérielle',
      status: 'partielle',
      notes: 'Vérifier la tension tous les 3 jours.',
      items: [
        { id: 301, medication_name: 'Lisinopril 10mg', form: 'Comprimé', posology: '1 comprimé - x1/jour - 30 jours', frequency: 'x1/jour (Matin)', durationDays: 30, quantity_prescribed: 30, quantity_dispensed: 18 },
        { id: 302, medication_name: 'Amlodipine 5mg', form: 'Comprimé', posology: '1 comprimé - x1/jour - 30 jours', frequency: 'x1/jour (Matin)', durationDays: 30, quantity_prescribed: 30, quantity_dispensed: 30 }
      ]
    },
    {
      id: 4,
      patient_name: 'Raïssa Gnahore',
      patient_age: '31 ans',
      doctor_name: 'Dr. Soro Mariam',
      date: '12 juil. 2025',
      diagnostic: 'Gastrite aiguë',
      status: 'validee',
      items: [
        { id: 401, medication_name: 'Oméprazole 20mg', form: 'Gélule', posology: '1 comprimé - x1/jour - 14 jours', frequency: 'x1/jour (Matin)', durationDays: 14, quantity_prescribed: 14, quantity_dispensed: 0 },
        { id: 402, medication_name: 'Dompéridone 10mg', form: 'Comprimé', posology: '1 comprimé - x3/jour - 7 jours', frequency: 'x3/jour (Matin, Midi & Soir)', durationDays: 7, quantity_prescribed: 21, quantity_dispensed: 0 },
        { id: 403, medication_name: 'Sels de réhydratation', form: 'Sachet', posology: '1 sachet - x2/jour - 3 jours', frequency: 'x2/jour (Matin & Soir)', durationDays: 3, quantity_prescribed: 6, quantity_dispensed: 0 }
      ]
    }
  ];

  const itemsToRender = (prescriptions && prescriptions.length > 0) ? prescriptions : defaultMockPrescriptions;

  const filteredItems = itemsToRender.filter(p => {
    const matchesSearch = p.patient_name.toLowerCase().includes(search.toLowerCase()) || p.diagnostic.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filterStatus === 'validee') return p.status === 'validee';
    if (filterStatus === 'remise') return p.status === 'remise';
    if (filterStatus === 'partielle') return p.status === 'partielle';
    return true;
  });

  const countValidees = itemsToRender.filter(p => p.status === 'validee').length || 1;
  const countRemises = itemsToRender.filter(p => p.status === 'remise').length || 2;
  const countPartielles = itemsToRender.filter(p => p.status === 'partielle').length || 1;

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
            Gestion des ordonnances
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

      {/* 2. Main Title & Action Button matching Image 1 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-secondary)' }}>
            Ordonnances
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '2px', margin: 0 }}>
            {itemsToRender.length} ordonnances · Juillet 2025
          </p>
        </div>

        <button
          onClick={handleOpenNewModal}
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
              backgroundColor: filterStatus === 'all' ? '#1e4d40' : 'var(--bg-secondary)',
              color: filterStatus === 'all' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Tous ({itemsToRender.length})
          </button>

          <button
            onClick={() => setFilterStatus('validee')}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: filterStatus === 'validee' ? '#1e4d40' : 'var(--bg-secondary)',
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
              backgroundColor: filterStatus === 'remise' ? '#1e4d40' : 'var(--bg-secondary)',
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
              backgroundColor: filterStatus === 'partielle' ? '#1e4d40' : 'var(--bg-secondary)',
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
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* 4. Prescription Cards List Stack matching Image 1 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {filteredItems.map((presc) => {
          let statusPill = null;
          if (presc.status === 'remise') {
            statusPill = (
              <span style={{
                backgroundColor: '#e6f4ea',
                color: '#1e4d40',
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
                backgroundColor: '#ffedd5',
                color: '#ea580c',
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
                backgroundColor: '#10b981',
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
                    backgroundColor: '#cbd5e1',
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
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {presc.patient_age}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                      Prescrit par {presc.doctor_name} · {presc.date}
                    </p>

                    <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: '4px 0 0 0', fontWeight: 500 }}>
                      <strong>Diagnostic :</strong> {presc.diagnostic}
                    </p>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  {statusPill}
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {presc.status === 'partielle' ? 'Partiellement remise' : 'Délivrée'}
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
                    const barColor = ratio >= 1 ? '#10b981' : ratio > 0 ? '#ea580c' : '#cbd5e1';

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
                            {it.medication_name} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>({it.form || 'Comprimé'})</span>
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
                      backgroundColor: '#1e4d40',
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
                    <span>Dupliquer</span>
                  </button>

                  {presc.status !== 'remise' && ['admin', 'pharmacist'].includes(user?.role || '') && (
                    <button
                      onClick={() => setDispenseModalPresc(presc)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        backgroundColor: '#e6f4ea',
                        color: '#1e4d40',
                        border: '1px solid #bbf7d0',
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      SÉLECTIONNER LE PATIENT *
                    </label>
                    <select
                      value={selectedPatientName}
                      onChange={(e) => setSelectedPatientName(e.target.value)}
                      className="input-control"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                      required
                    >
                      <option value="Adjobi Kouassi (67 ans)">Adjobi Kouassi (67 ans)</option>
                      <option value="Fatou Diomandé (48 ans)">Fatou Diomandé (48 ans)</option>
                      <option value="Brahima Ouattara (52 ans)">Brahima Ouattara (52 ans)</option>
                      <option value="Raïssa Gnahore (31 ans)">Raïssa Gnahore (31 ans)</option>
                      <option value="Mamadou Coulibaly (45 ans)">Mamadou Coulibaly (45 ans)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      MÉDECIN PRESCRIPTEUR *
                    </label>
                    <select
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      className="input-control"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                      required
                    >
                      <option value="Dr. Aminata Koné">Dr. Aminata Koné</option>
                      <option value="Dr. Yao Bernard">Dr. Yao Bernard</option>
                      <option value="Dr. Soro Mariam">Dr. Soro Mariam</option>
                      <option value="Dr. Coulibaly A.">Dr. Coulibaly A.</option>
                    </select>
                  </div>
                </div>

                {/* Diagnostic */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    DIAGNOSTIC / MOTIF DE PRESCRIPTION
                  </label>
                  <input
                    type="text"
                    placeholder="ex. : Infection des voies respiratoires supérieures"
                    value={diagnostic}
                    onChange={(e) => setDiagnostic(e.target.value)}
                    className="input-control"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px' }}
                  />
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
                        backgroundColor: '#1e4d40',
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
                      const isCustom = line.medication_name === 'Autre (Saisir manuellement)';

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
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1.2fr 1.2fr 1.2fr 0.8fr 30px',
                            gap: '8px',
                            alignItems: 'center'
                          }}>
                            {/* NOM DÉROULANT OU AUTRE */}
                            <div>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                                NOM DU MÉDICAMENT *
                              </span>
                              <select
                                value={line.medication_name}
                                onChange={(e) => handleUpdateMedicationLine(line.id, 'medication_name', e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8rem', backgroundColor: 'var(--bg-secondary)' }}
                              >
                                {MEDICATION_CATALOG.map((m, idx) => (
                                  <option key={idx} value={m}>{m}</option>
                                ))}
                              </select>
                            </div>

                            {/* FORME GALÉNIQUE */}
                            <div>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                                FORME GALÉNIQUE
                              </span>
                              <select
                                value={line.form}
                                onChange={(e) => handleUpdateMedicationLine(line.id, 'form', e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8rem', backgroundColor: 'var(--bg-secondary)' }}
                              >
                                {GALENIC_FORMS.map((f, idx) => (
                                  <option key={idx} value={f}>{f}</option>
                                ))}
                              </select>
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
                                value={line.quantity}
                                onChange={(e) => handleUpdateMedicationLine(line.id, 'quantity', parseInt(e.target.value) || 1)}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8rem' }}
                              />
                            </div>

                            {/* TRASH ICON */}
                            <button
                              type="button"
                              onClick={() => handleRemoveMedicationLine(line.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                              title="Supprimer la ligne"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {/* IF "AUTRE" IS SELECTED: SHOW MANUAL TEXT INPUT */}
                          {isCustom && (
                            <div style={{ marginTop: '4px' }}>
                              <input
                                type="text"
                                placeholder="Saisir le nom spécifique du médicament (ex: Spasfon 80mg, Rocephine 1g)..."
                                value={line.custom_name || ''}
                                onChange={(e) => handleUpdateMedicationLine(line.id, 'custom_name', e.target.value)}
                                style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #1e4d40', fontSize: '0.825rem', backgroundColor: '#e6f4ea' }}
                                required
                              />
                            </div>
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
                <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ backgroundColor: '#1e4d40' }}>
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
                <strong>Diagnostic :</strong> {dispenseModalPresc.diagnostic}
              </div>

              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                Médicaments à délivrer :
              </div>
              {dispenseModalPresc.items.map(it => (
                <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.825rem' }}>
                  <span>• {it.medication_name} ({it.form || 'Comprimé'})</span>
                  <span style={{ fontWeight: 700, color: '#1e4d40' }}>{it.quantity_prescribed} unités</span>
                </div>
              ))}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
              <button type="button" onClick={() => setDispenseModalPresc(null)} className="btn btn-secondary">Annuler</button>
              <button onClick={() => handleConfirmDispense(dispenseModalPresc)} className="btn btn-primary" style={{ backgroundColor: '#1e4d40' }}>
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
