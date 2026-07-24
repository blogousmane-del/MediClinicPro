import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { PaymentCheckoutModal } from '../../components/PaymentCheckoutModal';
import {
  Search,
  Plus,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Banknote,
  CreditCard,
  X,
  Clock
} from 'lucide-react';

interface DepositItem {
  id: number;
  description: string;
  cost: number;
}

const computeAge = (birthDate?: string | null): number | null => {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const statusLabels: Record<string, string> = {
  held: 'En cours',
  refunded: 'Remboursé',
  deducted: 'Déduit'
};
const statusBadges: Record<string, string> = {
  held: 'badge-info',
  refunded: 'badge-success',
  deducted: 'badge-warning'
};

export const DepositsPage: React.FC = () => {
  const { showToast } = useNotifications();

  const [viewMode, setViewMode] = useState<'create' | 'registry'>('create');

  // Patient search / selection
  const [patientSearch, setPatientSearch] = useState<string>('');
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [showPatientDropdown, setShowPatientDropdown] = useState<boolean>(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientHistory, setPatientHistory] = useState<any[]>([]);

  // Deposit form
  const [items, setItems] = useState<DepositItem[]>([{ id: Date.now(), description: '', cost: 0 }]);
  const [reason, setReason] = useState<string>('');
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [amountTouched, setAmountTouched] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [pendingCheckout, setPendingCheckout] = useState<{ checkoutUrl: string; depositId: number; provider: string; amount: number; patientName: string } | null>(null);

  // Registry
  const [allDeposits, setAllDeposits] = useState<any[]>([]);
  const [loadingRegistry, setLoadingRegistry] = useState<boolean>(false);

  const estimatedTotal = items.reduce((sum, it) => sum + (Number(it.cost) || 0), 0);
  const suggestedDeposit = Math.round(estimatedTotal * 0.5);

  useEffect(() => {
    if (!amountTouched) {
      setDepositAmount(suggestedDeposit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimatedTotal]);

  useEffect(() => {
    if (!patientSearch.trim()) {
      setPatientResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await api.get(`/patients?q=${encodeURIComponent(patientSearch)}`);
        setPatientResults(data);
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  const fetchPatientHistory = async (patientId: number) => {
    try {
      const data = await api.get(`/deposits?patientId=${patientId}`);
      setPatientHistory(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRegistry = async () => {
    try {
      setLoadingRegistry(true);
      const data = await api.get('/deposits');
      setAllDeposits(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRegistry(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'registry') {
      fetchRegistry();
    }
  }, [viewMode]);

  const handleSelectPatient = (patient: any) => {
    setSelectedPatient(patient);
    setPatientSearch('');
    setPatientResults([]);
    setShowPatientDropdown(false);
    fetchPatientHistory(patient.id);
  };

  const handleAddItem = () => {
    setItems([...items, { id: Date.now(), description: '', cost: 0 }]);
  };
  const handleRemoveItem = (id: number) => {
    setItems(items.filter(it => it.id !== id));
  };
  const handleUpdateItem = (id: number, field: keyof DepositItem, value: any) => {
    setItems(items.map(it => it.id === id ? { ...it, [field]: value } : it));
  };

  const resetForm = () => {
    setSelectedPatient(null);
    setPatientHistory([]);
    setItems([{ id: Date.now(), description: '', cost: 0 }]);
    setReason('');
    setDepositAmount(0);
    setAmountTouched(false);
    setPaymentMethod('cash');
    setReferenceNumber('');
  };

  const handleSubmit = async () => {
    if (!selectedPatient) {
      showToast('error', 'Patient requis', 'Veuillez sélectionner un patient.');
      return;
    }
    if (!depositAmount || depositAmount <= 0) {
      showToast('error', 'Montant requis', 'Veuillez saisir un montant de dépôt supérieur à 0.');
      return;
    }
    if (paymentMethod !== 'cash' && !referenceNumber.trim()) {
      showToast('error', 'Référence requise', 'Indiquez le numéro de transaction pour ce mode de paiement.');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await api.post('/deposits', {
        patientId: selectedPatient.id,
        amount: depositAmount,
        paymentMethod,
        referenceNumber: referenceNumber || undefined,
        reason: reason || undefined,
        items: items.filter(it => it.description.trim()).map(it => ({ description: it.description, cost: Number(it.cost) || 0 }))
      });

      if (data.pending) {
        setPendingCheckout({
          checkoutUrl: data.checkoutUrl,
          depositId: data.deposit.id,
          provider: data.provider,
          amount: depositAmount,
          patientName: `${selectedPatient.first_name} ${selectedPatient.last_name}`
        });
        return;
      }

      showToast('success', 'Dépôt enregistré', `Dépôt de garantie de ${depositAmount.toLocaleString('fr-FR')} FCFA enregistré pour ${selectedPatient.first_name} ${selectedPatient.last_name}.`);
      resetForm();
      setViewMode('registry');
    } catch (err: any) {
      console.error(err);
      showToast('error', "Échec de l'enregistrement", err.error || 'Impossible d\'enregistrer le dépôt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async (depositId: number, status: 'refunded' | 'deducted') => {
    try {
      await api.put(`/deposits/${depositId}`, { status });
      showToast('success', 'Dépôt mis à jour', `Le dépôt a été marqué comme ${status === 'refunded' ? 'remboursé' : 'déduit'}.`);
      fetchRegistry();
      if (selectedPatient) fetchPatientHistory(selectedPatient.id);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', err.error || 'Impossible de mettre à jour le dépôt.');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-primary)',
    fontSize: '0.85rem',
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box'
  };
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.725rem',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    marginBottom: '6px'
  };

  const age = computeAge(selectedPatient?.birth_date);

  return (
    <>
      <style>{`
        .dep-page {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          padding: 1.25rem 1.5rem;
          background-color: var(--bg-primary);
          min-height: calc(100vh - var(--header-height));
          box-sizing: border-box;
        }
        .dep-tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .dep-tab {
          padding: 8px 16px;
          border-radius: 10px;
          border: 1px solid var(--border);
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          white-space: nowrap;
        }
        .dep-tab.active { background-color: #1e4d40; color: #fff; border-color: #1e4d40; }
        .dep-tab.inactive { background-color: var(--bg-secondary); color: var(--text-secondary); }

        .dep-form-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
          gap: 1.25rem;
          align-items: start;
        }
        @media (max-width: 900px) {
          .dep-form-grid { grid-template-columns: 1fr; }
        }

        .dep-panel {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
        }

        .dep-item-row {
          display: grid;
          grid-template-columns: 2fr 1fr 28px;
          gap: 8px;
          align-items: end;
        }
        @media (max-width: 480px) {
          .dep-item-row { grid-template-columns: 1fr; }
        }

        .dep-quick-amounts { display: flex; gap: 8px; flex-wrap: wrap; }
        .dep-quick-amount-btn {
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background-color: var(--bg-tertiary);
          color: var(--text-secondary);
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
        }

        .dep-payment-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
        .dep-payment-option {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background-color: var(--bg-tertiary);
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
        }
        .dep-payment-option.active {
          border-color: var(--primary);
          background-color: var(--primary-light, #e6f4ea);
          color: var(--primary);
        }
      `}</style>

      <div className="dep-page">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-secondary)', color: 'var(--text-primary)', margin: 0 }}>
              Dépôts de garantie
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
              Enregistrez et suivez les dépôts de garantie demandés avant certains soins.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="dep-tabs">
          <button className={`dep-tab ${viewMode === 'create' ? 'active' : 'inactive'}`} onClick={() => setViewMode('create')}>
            Nouveau dépôt
          </button>
          <button className={`dep-tab ${viewMode === 'registry' ? 'active' : 'inactive'}`} onClick={() => setViewMode('registry')}>
            Registre des dépôts
          </button>
        </div>

        {/* CREATE VIEW */}
        {viewMode === 'create' && (
          <div className="dep-form-grid">

            {/* LEFT: patient + services */}
            <div className="dep-panel">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Patient</h3>

              <div style={{ position: 'relative' }}>
                <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Chercher un patient..."
                  value={patientSearch}
                  onChange={(e) => { setPatientSearch(e.target.value); setShowPatientDropdown(true); }}
                  onFocus={() => setShowPatientDropdown(true)}
                  onBlur={() => setTimeout(() => setShowPatientDropdown(false), 150)}
                  style={{ ...inputStyle, paddingLeft: '32px' }}
                />
                {showPatientDropdown && patientResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 10,
                    backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    maxHeight: '220px', overflowY: 'auto'
                  }}>
                    {patientResults.map((p: any) => (
                      <div
                        key={p.id}
                        onMouseDown={() => handleSelectPatient(p)}
                        style={{ padding: '9px 12px', fontSize: '0.85rem', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                      >
                        <strong>{p.last_name} {p.first_name}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.folder_number} · {p.phone}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedPatient ? (
                <div style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {selectedPatient.last_name.toUpperCase()} {selectedPatient.first_name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {age !== null ? `${age} ans · ` : ''}{selectedPatient.folder_number}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{selectedPatient.phone}</div>
                    </div>
                    <button onClick={() => setSelectedPatient(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} title="Changer de patient">
                      <X size={16} />
                    </button>
                  </div>
                  {(selectedPatient.antecedents || selectedPatient.allergies) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                      {selectedPatient.antecedents && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#ea580c', backgroundColor: '#fff7ed', padding: '3px 8px', borderRadius: '6px' }}>
                          {selectedPatient.antecedents}
                        </span>
                      )}
                      {selectedPatient.allergies && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#dc2626', backgroundColor: '#fef2f2', padding: '3px 8px', borderRadius: '6px' }}>
                          Allergie : {selectedPatient.allergies}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '10px 0' }}>
                  Aucun patient sélectionné.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Actes / soins prévus</h3>
                <button
                  onClick={handleAddItem}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', backgroundColor: '#1e4d40', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  <Plus size={13} />
                  <span>Ajouter</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {items.map(item => (
                  <div key={item.id} className="dep-item-row">
                    <div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Acte / description</span>
                      <input
                        type="text"
                        placeholder="Ex: Chirurgie d'urgence"
                        value={item.description}
                        onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                        style={{ ...inputStyle, fontSize: '0.8rem' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Coût estimé</span>
                      <input
                        type="number"
                        value={item.cost}
                        onChange={(e) => handleUpdateItem(item.id, 'cost', parseFloat(e.target.value) || 0)}
                        style={{ ...inputStyle, fontSize: '0.8rem' }}
                      />
                    </div>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Supprimer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '10px', fontSize: '0.9rem', fontWeight: 700 }}>
                <span>Total estimé</span>
                <span>{estimatedTotal.toLocaleString('fr-FR')} FCFA</span>
              </div>

              <div>
                <label style={labelStyle}>Motif / contexte (optionnel)</label>
                <input
                  type="text"
                  placeholder="Ex: Prise en charge urgence"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {patientHistory.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} />
                    Historique des dépôts — {selectedPatient?.first_name}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {patientHistory.map((dep: any) => (
                      <div key={dep.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', fontSize: '0.78rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{new Date(dep.created_at).toLocaleDateString('fr-FR')} · {dep.reason || 'Sans motif'}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong>{dep.amount.toLocaleString('fr-FR')} FCFA</strong>
                          <span className={`badge ${statusBadges[dep.status]}`} style={{ fontSize: '0.68rem' }}>{statusLabels[dep.status]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: deposit amount + payment */}
            <div className="dep-panel">
              <div style={{ backgroundColor: '#162a26', borderRadius: '14px', padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Dépôt suggéré (50% du total)</span>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff' }}>
                  {suggestedDeposit.toLocaleString('fr-FR')} <span style={{ fontSize: '1rem', fontWeight: 600, color: '#94a3b8' }}>FCFA</span>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Montant du dépôt (FCFA)</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => { setDepositAmount(parseFloat(e.target.value) || 0); setAmountTouched(true); }}
                  style={{ ...inputStyle, fontWeight: 700, fontSize: '1rem' }}
                />
                <div className="dep-quick-amounts" style={{ marginTop: '8px' }}>
                  {[0.5, 0.75, 1].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      className="dep-quick-amount-btn"
                      onClick={() => { setDepositAmount(Math.round(estimatedTotal * pct)); setAmountTouched(true); }}
                    >
                      {Math.round(estimatedTotal * pct).toLocaleString('fr-FR')} ({pct * 100}%)
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Mode de paiement</label>
                <div className="dep-payment-grid">
                  {[
                    { id: 'cash', label: 'Espèces', icon: Banknote },
                    { id: 'wave', label: 'Wave', icon: CreditCard },
                    { id: 'orange_money', label: 'Orange Money', icon: CreditCard },
                    { id: 'mtn_momo', label: 'MTN MoMo', icon: CreditCard }
                  ].map(pm => {
                    const Icon = pm.icon;
                    return (
                      <div
                        key={pm.id}
                        onClick={() => setPaymentMethod(pm.id)}
                        className={`dep-payment-option ${paymentMethod === pm.id ? 'active' : ''}`}
                      >
                        <Icon size={14} />
                        <span>{pm.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {paymentMethod !== 'cash' && (
                <div>
                  <label style={labelStyle}>N° Transaction / Référence</label>
                  <input
                    type="text"
                    placeholder="Ex: W-8910-..."
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', backgroundColor: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '10px', padding: '10px 12px' }}>
                <AlertTriangle size={15} color="#ea580c" style={{ flexShrink: 0, marginTop: '1px' }} />
                <p style={{ fontSize: '0.78rem', color: '#9a3412', margin: 0, lineHeight: 1.4 }}>
                  Le dépôt ne couvre pas nécessairement la totalité des frais. Le solde sera réglé via un encaissement classique (Comptabilité).
                </p>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '12px 18px', backgroundColor: '#1e4d40', color: '#fff',
                  border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.6 : 1
                }}
              >
                <ShieldCheck size={16} />
                <span>{isSubmitting ? 'Enregistrement...' : 'Enregistrer le dépôt de garantie'}</span>
              </button>
            </div>
          </div>
        )}

        {/* REGISTRY VIEW */}
        {viewMode === 'registry' && (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Patient</th>
                  <th>Montant</th>
                  <th>Mode</th>
                  <th>Motif</th>
                  <th>Collecté par</th>
                  <th>Statut</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingRegistry ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Chargement...</td></tr>
                ) : allDeposits.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Aucun dépôt de garantie enregistré.</td></tr>
                ) : (
                  allDeposits.map((dep: any) => (
                    <tr key={dep.id}>
                      <td>{new Date(dep.created_at).toLocaleDateString('fr-FR')}</td>
                      <td style={{ fontWeight: 600 }}>{dep.patient_last_name} {dep.patient_first_name}</td>
                      <td style={{ fontWeight: 'bold', color: 'var(--success)' }}>{dep.amount.toLocaleString('fr-FR')} FCFA</td>
                      <td><span className="badge badge-info">{dep.payment_method}</span></td>
                      <td style={{ fontSize: '0.85rem' }}>{dep.reason || '—'}</td>
                      <td>{dep.cashier_name}</td>
                      <td>
                        <span className={`badge ${statusBadges[dep.status]}`}>{statusLabels[dep.status]}</span>
                        {dep.payment_status === 'pending' && (
                          <span className="badge badge-warning" style={{ marginLeft: '4px', fontSize: '0.68rem' }}>Paiement en attente</span>
                        )}
                        {dep.payment_status === 'failed' && (
                          <span className="badge badge-danger" style={{ marginLeft: '4px', fontSize: '0.68rem' }}>Paiement échoué</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {dep.status === 'held' && (dep.payment_status === 'paid' || dep.payment_status === undefined) && (
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              onClick={() => handleResolve(dep.id, 'refunded')}
                              className="btn btn-secondary"
                              style={{ padding: '5px 9px', fontSize: '0.72rem' }}
                            >
                              Rembourser
                            </button>
                            <button
                              onClick={() => handleResolve(dep.id, 'deducted')}
                              className="btn btn-outline"
                              style={{ padding: '5px 9px', fontSize: '0.72rem' }}
                            >
                              Déduire
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pendingCheckout && (
        <PaymentCheckoutModal
          checkoutUrl={pendingCheckout.checkoutUrl}
          provider={pendingCheckout.provider}
          amountLabel={`${pendingCheckout.amount.toLocaleString('fr-FR')} FCFA`}
          pollStatus={() => api.get(`/deposits/${pendingCheckout.depositId}/status`)}
          onSuccess={() => {
            showToast('success', 'Dépôt confirmé', `Dépôt de garantie de ${pendingCheckout.amount.toLocaleString('fr-FR')} FCFA confirmé pour ${pendingCheckout.patientName}.`);
            setPendingCheckout(null);
            resetForm();
            setViewMode('registry');
          }}
          onClose={() => setPendingCheckout(null)}
        />
      )}
    </>
  );
};

export default DepositsPage;
