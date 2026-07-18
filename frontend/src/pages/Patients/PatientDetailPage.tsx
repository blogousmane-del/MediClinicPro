import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { 
  ArrowLeft, 
  User, 
  Activity, 
  FileText, 
  FlaskConical, 
  CreditCard, 
  Plus, 
  Trash2,
  Calendar,
  AlertTriangle,
  Printer
} from 'lucide-react';

interface PatientDetailPageProps {
  patientId: number;
  onBack: () => void;
}

export const PatientDetailPage: React.FC<PatientDetailPageProps> = ({ patientId, onBack }) => {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const [patient, setPatient] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Consultations Medications Catalog cache
  const [medicationsCatalog, setMedicationsCatalog] = useState<any[]>([]);

  // Form Consultation States (for Doctors / Admins)
  const [motif, setMotif] = useState<string>('');
  const [symptoms, setSymptoms] = useState<string>('');
  const [diag, setDiag] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  // Constants
  const [tension, setTension] = useState<string>('');
  const [temp, setTemp] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [heartRate, setHeartRate] = useState<string>('');
  // Prescription builder
  const [prescItems, setPrescItems] = useState<any[]>([]);
  // Lab exams list
  const [requestedExams, setRequestedExams] = useState<string>('');
  
  const [isSubmittingConsult, setIsSubmittingConsult] = useState<boolean>(false);

  // Billing Form States (for Secretaries / Managers)
  const [billItems, setBillItems] = useState<any[]>([
    { type: 'consultation', name: 'Consultation Générale', cost: 10000 }
  ]);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [refNum, setRefNum] = useState<string>('');
  const [isSubmittingBill, setIsSubmittingBill] = useState<boolean>(false);

  // Pharmacy / Lab Queue lists
  const [pendingPrescriptions, setPendingPrescriptions] = useState<any[]>([]);
  const [pendingExams, setPendingExams] = useState<any[]>([]);

  const fetchPatientDetails = async () => {
    try {
      setLoading(true);
      const data = await api.get(`/patients/${patientId}`);
      setPatient(data.patient);
      setTimeline(data.timeline);
      
      // Filter patient prescriptions and exams
      setPendingPrescriptions(data.prescriptions.filter((p: any) => p.status !== 'dispensed'));
      setPendingExams(data.labExams.filter((e: any) => e.status !== 'completed'));

      if (['admin', 'doctor'].includes(user?.role || '')) {
        const meds = await api.get('/pharmacy/medications');
        setMedicationsCatalog(meds);
      }
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur de chargement', 'Impossible de récupérer le dossier du patient.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientDetails();
  }, [patientId]);

  // Handle Add line in prescription builder
  const handleAddPrescLine = () => {
    setPrescItems([...prescItems, {
      medicationId: '',
      medicationName: '',
      dosage: '',
      frequency: '',
      duration: '',
      quantityPrescribed: 1
    }]);
  };

  const handleRemovePrescLine = (idx: number) => {
    setPrescItems(prescItems.filter((_, i) => i !== idx));
  };

  const handlePrescItemChange = (idx: number, field: string, value: any) => {
    const updated = [...prescItems];
    if (field === 'medicationId') {
      const selectedMed = medicationsCatalog.find(m => m.id === parseInt(value));
      updated[idx].medicationId = value;
      updated[idx].medicationName = selectedMed ? selectedMed.name : '';
      updated[idx].dosage = selectedMed ? selectedMed.dosage : '';
    } else {
      updated[idx][field] = value;
    }
    setPrescItems(updated);
  };

  // Submit Consultation Form
  const handleSubmitConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motif) {
      showToast('error', 'Champs requis', 'Le motif de consultation est obligatoire.');
      return;
    }

    setIsSubmittingConsult(true);
    try {
      // Split lab exams by comma
      const examsList = requestedExams.split(',').map(s => s.trim()).filter(s => s.length > 0);

      const payload = {
        patientId,
        motif,
        symptoms,
        constants: {
          tension,
          temp,
          weight,
          heartRate
        },
        diagnosis: diag,
        notes,
        prescriptionItems: prescItems,
        labExams: examsList
      };

      await api.post('/consultations', payload);
      showToast('success', 'Consultation enregistrée', 'Les observations cliniques et ordonnances ont été ajoutées.');
      
      // Reset Consultation Form
      setMotif('');
      setSymptoms('');
      setDiag('');
      setNotes('');
      setTension('');
      setTemp('');
      setWeight('');
      setHeartRate('');
      setPrescItems([]);
      setRequestedExams('');

      fetchPatientDetails();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Échec d\'enregistrement', err.error || 'Erreur de consultation.');
    } finally {
      setIsSubmittingConsult(false);
    }
  };

  // Checkout Bill Submit
  const handleAddBillLine = () => {
    setBillItems([...billItems, { type: 'pharmacy', name: 'Médicament', cost: 0 }]);
  };

  const handleRemoveBillLine = (idx: number) => {
    setBillItems(billItems.filter((_, i) => i !== idx));
  };

  const handleBillItemChange = (idx: number, field: string, value: any) => {
    const updated = [...billItems];
    if (field === 'cost') {
      updated[idx][field] = parseFloat(value) || 0;
    } else {
      updated[idx][field] = value;
    }
    setBillItems(updated);
  };

  const handleProcessCheckout = async () => {
    const total = billItems.reduce((sum, item) => sum + item.cost, 0);
    if (total <= 0) {
      showToast('error', 'Facture vide', 'Le montant total de la facture doit être supérieur à 0.');
      return;
    }

    setIsSubmittingBill(true);
    try {
      const payload = {
        patientId,
        amountTotal: total,
        paymentMethod,
        referenceNumber: refNum,
        items: billItems
      };

      await api.post('/financials/checkout', payload);
      showToast('success', 'Paiement encaissé', `Recette de ${total} FCFA validée avec succès.`);
      
      // Reset Billing form
      setBillItems([{ type: 'consultation', name: 'Consultation Générale', cost: 10000 }]);
      setRefNum('');
      
      fetchPatientDetails();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Échec du paiement', err.error || 'Erreur lors de l\'encaissement.');
    } finally {
      setIsSubmittingBill(false);
    }
  };

  // Lab Technician: Enter Results Form State
  const [activeLabExamId, setActiveLabExamId] = useState<number | null>(null);
  const [resultsText, setResultsText] = useState<string>('');
  const [isSavingLab, setIsSavingLab] = useState<boolean>(false);

  const handleSubmitLabResults = async () => {
    if (!resultsText) {
      showToast('error', 'Résultats obligatoires', 'Veuillez saisir le compte rendu de l\'analyse.');
      return;
    }
    setIsSavingLab(true);
    try {
      await api.post(`/laboratory/results/${activeLabExamId}`, { resultsText });
      showToast('success', 'Résultats saisis', 'L\'examen a été complété et classé dans le dossier.');
      setActiveLabExamId(null);
      setResultsText('');
      fetchPatientDetails();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', err.error || 'Impossible d\'enregistrer les résultats.');
    } finally {
      setIsSavingLab(false);
    }
  };

  // Print function
  const handlePrintTimelineItem = (item: any) => {
    const printContent = `
      <html>
        <head>
          <title>Impression MediClinic</title>
          <style>
            body { font-family: sans-serif; padding: 30px; color: #333; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #0d9488; padding-bottom: 15px; margin-bottom: 20px; }
            .title { font-size: 1.5rem; font-weight: bold; color: #0d9488; }
            .patient-box { background: #f3f4f6; padding: 12px; border-radius: 8px; margin-bottom: 20px; }
            .details { border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .footer { text-align: center; margin-top: 50px; font-size: 0.8rem; color: #888; border-top: 1px solid #e5e7eb; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">CLINIQUE MÉDICALE DE L'AVENIR</div>
            <div>Cocody Boulevard de France, Abidjan | Tél: +225 0707080910</div>
          </div>
          
          <div class="patient-box">
            <strong>Patient :</strong> ${patient.last_name.toUpperCase()} ${patient.first_name}<br>
            <strong>N° Dossier :</strong> ${patient.folder_number} | <strong>Tél :</strong> ${patient.phone}<br>
            <strong>Date :</strong> ${new Date(item.date).toLocaleDateString('fr-FR')}
          </div>

          <div class="details">
            <h3>${item.title}</h3>
            <p><strong>Détails / Description :</strong></p>
            ${item.type === 'consultation' ? `
              <p>Motif: ${item.details.motif}</p>
              <p>Observations: ${item.details.symptoms || 'Néant'}</p>
              <p>Diagnostic: ${item.details.diagnosis || 'Non spécifié'}</p>
              <p>Notes médicales: ${item.details.notes || 'Néant'}</p>
            ` : ''}
            ${item.type === 'prescription' ? `
              <ul>
                ${item.details.items.map((line: any) => `
                  <li><strong>${line.medication_name}</strong> - Posologie: ${line.dosage} | Freq: ${line.frequency} | Durée: ${line.duration} (Qté: ${line.quantity_prescribed})</li>
                `).join('')}
              </ul>
            ` : ''}
            ${item.type === 'lab' ? `
              <p>Examen: ${item.details.test_name}</p>
              <p>Compte-rendu: ${item.details.results_text || 'En attente'}</p>
            ` : ''}
            ${item.type === 'payment' ? `
              <p>Montant payé: ${item.details.amount_total} FCFA</p>
              <p>Méthode: ${item.details.payment_method.toUpperCase()}</p>
              <p>Référence: ${item.details.reference_number}</p>
            ` : ''}
          </div>

          <div class="footer">
            Document généré automatiquement via MediClinic.
          </div>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
        Chargement du dossier patient...
      </div>
    );
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Back Button & Patient Header */}
      <div className="flex align-center gap-3">
        <button onClick={onBack} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-secondary)' }}>
            {patient.last_name.toUpperCase()} {patient.first_name}
          </h2>
          <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--primary)' }}>
            N° Dossier: {patient.folder_number}
          </span>
        </div>
      </div>

      {/* Patient Core Summary Panel */}
      <div className="card grid-cols-4" style={{ backgroundColor: 'var(--bg-tertiary)', border: 'none' }}>
        <div>
          <span className="text-xs text-muted" style={{ fontWeight: 600 }}>TÉLÉPHONE</span>
          <div style={{ fontWeight: 'bold', fontSize: '1.05rem', marginTop: '2px' }}>{patient.phone}</div>
        </div>
        <div>
          <span className="text-xs text-muted" style={{ fontWeight: 600 }}>ÂGE & GENRE</span>
          <div style={{ fontWeight: 'bold', fontSize: '1.05rem', marginTop: '2px' }}>
            {new Date().getFullYear() - new Date(patient.birth_date).getFullYear()} ans ({patient.gender === 'M' ? 'Masculin' : 'Féminin'})
          </div>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <span className="text-xs text-muted" style={{ fontWeight: 600 }}>ALLERGIES & ATCD</span>
          <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {patient.allergies ? (
              <span className="badge badge-danger">Allergie : {patient.allergies}</span>
            ) : (
              <span className="badge badge-success">Aucune allergie</span>
            )}
            {patient.antecedents ? (
              <span className="badge badge-warning">ATCD : {patient.antecedents}</span>
            ) : (
              <span className="badge badge-info">Aucun ATCD</span>
            )}
          </div>
        </div>
      </div>

      {/* Split details layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Timeline */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            Historique Médical & Financier
          </h3>
          
          {timeline.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Aucun événement dans l'historique de ce patient.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
              
              {timeline.map((item, idx) => {
                const date = new Date(item.date).toLocaleDateString('fr-FR', { dateStyle: 'medium' });
                const time = new Date(item.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

                const icons = {
                  consultation: { i: Activity, bg: 'var(--primary-light)', color: 'var(--primary)' },
                  prescription: { i: FileText, bg: 'var(--info-light)', color: 'var(--info)' },
                  lab: { i: FlaskConical, bg: 'var(--warning-light)', color: 'var(--warning)' },
                  payment: { i: CreditCard, bg: 'var(--success-light)', color: 'var(--success)' }
                }[item.type as 'consultation'|'prescription'|'lab'|'payment'];

                const Icon = icons.i;

                return (
                  <div key={item.id} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    {/* Left vertical timeline line connector */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        backgroundColor: icons.bg,
                        color: icons.color,
                        padding: '10px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <Icon size={18} />
                      </div>
                      {idx < timeline.length - 1 && (
                        <div style={{
                          width: '2px',
                          height: '50px',
                          backgroundColor: 'var(--border)',
                          margin: '4px 0'
                        }} />
                      )}
                    </div>

                    {/* Timeline Item body content */}
                    <div style={{ flexGrow: 1, backgroundColor: 'var(--bg-primary)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div className="flex justify-between align-center">
                        <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                          {item.title}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {date} à {time}
                          </span>
                          <button
                            onClick={() => handlePrintTimelineItem(item)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                            title="Imprimer"
                          >
                            <Printer size={14} />
                          </button>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        {item.subtitle}
                      </div>

                      {/* Timeline specifics */}
                      {item.type === 'consultation' && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {item.details.constants && (
                            <div style={{ fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--primary)' }}>
                              Constantes : {JSON.parse(item.details.constants).tension ? `Tension: ${JSON.parse(item.details.constants).tension} · ` : ''}
                              {JSON.parse(item.details.constants).temp ? `Temp: ${JSON.parse(item.details.constants).temp}°C · ` : ''}
                              {JSON.parse(item.details.constants).weight ? `Poids: ${JSON.parse(item.details.constants).weight}kg` : ''}
                            </div>
                          )}
                          <div><strong>Diagnostic :</strong> {item.details.diagnosis || 'Non spécifié'}</div>
                          {item.details.symptoms && <div><strong>Observations :</strong> {item.details.symptoms}</div>}
                          {item.details.notes && <div><strong>Notes :</strong> {item.details.notes}</div>}
                        </div>
                      )}

                      {item.type === 'prescription' && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <ul style={{ paddingLeft: '20px', margin: '4px 0 0 0' }}>
                            {item.details.items?.map((li: any) => (
                              <li key={li.id}>
                                {li.medication_name} {li.dosage} ({li.frequency} - {li.duration}) 
                                {li.quantity_dispensed > 0 && <span style={{ color: 'var(--success)' }}> (Délivré: {li.quantity_dispensed}/{li.quantity_prescribed})</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {item.type === 'lab' && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <div><strong>Examen :</strong> {item.details.test_name}</div>
                          {item.details.status === 'completed' ? (
                            <div style={{ backgroundColor: 'var(--success-light)', borderLeft: '3px solid var(--success)', padding: '6px 10px', borderRadius: '4px', marginTop: '6px', fontSize: '0.8rem' }}>
                              <strong>Résultats :</strong> {item.details.results_text}
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Saisi par : {item.details.technician_name}</div>
                            </div>
                          ) : (
                            <div style={{ color: 'var(--warning)', fontStyle: 'italic', fontSize: '0.8rem', marginTop: '4px' }}>
                              En attente de réalisation
                            </div>
                          )}
                        </div>
                      )}

                      {item.type === 'payment' && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <div>Réf: {item.details.reference_number}</div>
                          <ul style={{ paddingLeft: '20px', fontSize: '0.8rem', margin: '4px 0' }}>
                            {item.details.items?.map((bit: any, bidx: number) => (
                              <li key={bidx}>{bit.name} : {bit.cost.toLocaleString()} FCFA</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}

            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Role-based Action Widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* 1. DOCTOR/ADMIN: New Consultation Widget */}
          {['admin', 'doctor'].includes(user?.role || '') && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Enregistrer une Consultation</h3>
              
              <form onSubmit={handleSubmitConsultation} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Motif de visite *</label>
                  <input
                    type="text"
                    placeholder="Ex: Fièvre persistante, maux de tête"
                    value={motif}
                    onChange={e => setMotif(e.target.value)}
                    className="input-control"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Observations cliniques / Symptômes</label>
                  <textarea
                    placeholder="Constats du médecin..."
                    value={symptoms}
                    onChange={e => setSymptoms(e.target.value)}
                    className="input-control"
                    style={{ height: '60px', resize: 'none' }}
                  />
                </div>

                {/* Constants row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.75rem' }}>Tension</label>
                    <input type="text" placeholder="12/8" value={tension} onChange={e => setTension(e.target.value)} className="input-control" style={{ padding: '6px' }} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.75rem' }}>Temp (°C)</label>
                    <input type="text" placeholder="37" value={temp} onChange={e => setTemp(e.target.value)} className="input-control" style={{ padding: '6px' }} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.75rem' }}>Poids (kg)</label>
                    <input type="text" placeholder="70" value={weight} onChange={e => setWeight(e.target.value)} className="input-control" style={{ padding: '6px' }} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.75rem' }}>Puls. (/min)</label>
                    <input type="text" placeholder="80" value={heartRate} onChange={e => setHeartRate(e.target.value)} className="input-control" style={{ padding: '6px' }} />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Diagnostic</label>
                  <input
                    type="text"
                    placeholder="Ex: Paludisme simple"
                    value={diag}
                    onChange={e => setDiag(e.target.value)}
                    className="input-control"
                  />
                </div>

                {/* Prescription Builder */}
                <div style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '10px' }}>
                  <div className="flex justify-between align-center" style={{ marginBottom: '8px' }}>
                    <strong style={{ fontSize: '0.85rem' }}>Ordonnance</strong>
                    <button
                      type="button"
                      onClick={handleAddPrescLine}
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    >
                      + Médicament
                    </button>
                  </div>
                  
                  {prescItems.length === 0 ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>
                      Aucun produit prescrit.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {prescItems.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px dashed var(--border)', paddingBottom: '6px' }}>
                          <div className="flex align-center gap-1">
                            <select
                              value={item.medicationId}
                              onChange={e => handlePrescItemChange(idx, 'medicationId', e.target.value)}
                              className="input-control w-full"
                              style={{ padding: '4px', fontSize: '0.8rem' }}
                            >
                              <option value="">-- Catalog --</option>
                              {medicationsCatalog.map(m => (
                                <option key={m.id} value={m.id}>{m.name} {m.dosage} (Stk: {m.stock_quantity})</option>
                              ))}
                            </select>
                            
                            <button
                              type="button"
                              onClick={() => handleRemovePrescLine(idx)}
                              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            <input
                              type="text"
                              placeholder="Posol. (ex: 1compr)"
                              value={item.dosage}
                              onChange={e => handlePrescItemChange(idx, 'dosage', e.target.value)}
                              className="input-control"
                              style={{ padding: '4px', fontSize: '0.75rem' }}
                            />
                            <input
                              type="text"
                              placeholder="Fréq. (ex: 3x/j)"
                              value={item.frequency}
                              onChange={e => handlePrescItemChange(idx, 'frequency', e.target.value)}
                              className="input-control"
                              style={{ padding: '4px', fontSize: '0.75rem' }}
                            />
                            <input
                              type="text"
                              placeholder="Durée (ex: 5j)"
                              value={item.duration}
                              onChange={e => handlePrescItemChange(idx, 'duration', e.target.value)}
                              className="input-control"
                              style={{ padding: '4px', fontSize: '0.75rem' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Lab Order */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Prescription examens labo</label>
                  <input
                    type="text"
                    placeholder="Ex: NFS, Paludisme (séparer par virgules)"
                    value={requestedExams}
                    onChange={e => setRequestedExams(e.target.value)}
                    className="input-control"
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={isSubmittingConsult}
                  style={{ marginTop: '8px' }}
                >
                  {isSubmittingConsult ? 'Enregistrement...' : 'Enregistrer la consultation'}
                </button>
              </form>
            </div>
          )}

          {/* 2. SECRETARY/MANAGER: Checkout widget */}
          {['admin', 'secretary', 'manager'].includes(user?.role || '') && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Encaisser un paiement</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '10px' }}>
                  <div className="flex justify-between align-center" style={{ marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Actes facturés</span>
                    <button
                      onClick={handleAddBillLine}
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    >
                      + Ligne
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {billItems.map((bit, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <select
                          value={bit.type}
                          onChange={e => handleBillItemChange(idx, 'type', e.target.value)}
                          className="input-control"
                          style={{ padding: '4px', fontSize: '0.8rem', width: '90px' }}
                        >
                          <option value="consultation">Consult.</option>
                          <option value="pharmacy">Pharmacie</option>
                          <option value="laboratory">Labo</option>
                          <option value="other">Autre</option>
                        </select>
                        
                        <input
                          type="text"
                          placeholder="Nom de l'acte"
                          value={bit.name}
                          onChange={e => handleBillItemChange(idx, 'name', e.target.value)}
                          className="input-control"
                          style={{ padding: '4px', fontSize: '0.8rem', flexGrow: 1 }}
                        />

                        <input
                          type="number"
                          placeholder="Coût"
                          value={bit.cost}
                          onChange={e => handleBillItemChange(idx, 'cost', e.target.value)}
                          className="input-control"
                          style={{ padding: '4px', fontSize: '0.8rem', width: '80px' }}
                        />

                        {billItems.length > 1 && (
                          <button
                            onClick={() => handleRemoveBillLine(idx)}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Mode de paiement</label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="input-control"
                  >
                    <option value="cash">Espèces</option>
                    <option value="wave">Wave Mobile Money</option>
                    <option value="orange_money">Orange Money</option>
                    <option value="mtn_momo">MTN Mobile Money</option>
                  </select>
                </div>

                {paymentMethod !== 'cash' && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>N° Transaction / Référence</label>
                    <input
                      type="text"
                      placeholder="Ex: W-8910-..."
                      value={refNum}
                      onChange={e => setRefNum(e.target.value)}
                      className="input-control"
                    />
                  </div>
                )}

                <div style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  padding: '12px',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 'bold',
                  fontSize: '1rem'
                }}>
                  <span>TOTAL :</span>
                  <span style={{ color: 'var(--primary)' }}>
                    {billItems.reduce((sum, item) => sum + item.cost, 0).toLocaleString()} FCFA
                  </span>
                </div>

                <button
                  onClick={handleProcessCheckout}
                  className="btn btn-primary w-full"
                  disabled={isSubmittingBill}
                >
                  {isSubmittingBill ? 'Validation...' : 'Valider l\'encaissement'}
                </button>
              </div>
            </div>
          )}

          {/* 3. LAB TECH: Saisie résultats direct shortcuts */}
          {user?.role === 'lab_tech' && pendingExams.length > 0 && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Saisir des résultats labo</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pendingExams.map(ex => (
                  <div key={ex.id} style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', backgroundColor: 'var(--bg-primary)' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{ex.test_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Prescrit par : {ex.doctor_name}
                    </div>
                    {activeLabExamId === ex.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <textarea
                          placeholder="Saisissez les résultats..."
                          value={resultsText}
                          onChange={e => setResultsText(e.target.value)}
                          className="input-control"
                          style={{ height: '50px', fontSize: '0.8rem', resize: 'none' }}
                        />
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                          <button onClick={() => setActiveLabExamId(null)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.7rem' }}>
                            Annuler
                          </button>
                          <button onClick={handleSubmitLabResults} className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.7rem' }} disabled={isSavingLab}>
                            Valider
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setActiveLabExamId(ex.id);
                          setResultsText('');
                        }}
                        className="btn btn-primary"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      >
                        Saisir résultats
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
