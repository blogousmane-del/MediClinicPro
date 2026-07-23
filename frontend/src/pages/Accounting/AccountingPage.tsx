import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  Search,
  Bell,
  Plus,
  Trash2,
  RefreshCw,
  Send,
  Save,
  X,
  FileDown,
  Printer,
  CreditCard,
  Wallet
} from 'lucide-react';

interface InvoiceService {
  id: number;
  type: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export const AccountingPage: React.FC = () => {
  const { showToast } = useNotifications();

  const [viewMode, setViewMode] = useState<'create' | 'journal'>('create');

  const todayISO = new Date().toISOString().split('T')[0];
  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 14);

  const [patientSearch, setPatientSearch] = useState<string>('');
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [showPatientDropdown, setShowPatientDropdown] = useState<boolean>(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<string>(() => `#INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [invoiceDate, setInvoiceDate] = useState<string>(todayISO);
  const [dueDate, setDueDate] = useState<string>(defaultDueDate.toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState<boolean>(false);

  const [services, setServices] = useState<InvoiceService[]>([
    { id: 1, type: 'Consultation', description: 'Consultation générale', quantity: 1, unitPrice: 25000 },
    { id: 2, type: 'Pharmacie', description: 'Médicaments prescrits', quantity: 1, unitPrice: 15600 }
  ]);

  const [payments, setPayments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchJournalData = async () => {
    try {
      setLoading(true);
      const data = await api.get('/financials/payments');
      setPayments(data);
      const statsData = await api.get('/financials/stats');
      setStats(statsData);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'journal') {
      fetchJournalData();
    }
  }, [viewMode]);

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

  const handleSelectPatient = (patient: any) => {
    setSelectedPatient(patient);
    setPatientSearch('');
    setPatientResults([]);
    setShowPatientDropdown(false);
  };

  const handleAddService = () => {
    const newService: InvoiceService = {
      id: Date.now(),
      type: 'Consultation',
      description: 'Nouveau soin',
      quantity: 1,
      unitPrice: 5000
    };
    setServices([...services, newService]);
  };

  const handleRemoveService = (id: number) => {
    setServices(services.filter(s => s.id !== id));
  };

  const handleUpdateService = (id: number, field: keyof InvoiceService, value: any) => {
    setServices(services.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleGenerateInvoiceNum = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setInvoiceNumber(`#INV-2025-${randomNum}`);
    showToast('info', 'Numéro généré', 'Un nouveau numéro de facture a été attribué.');
  };

  const subtotal = services.reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0);
  const tva = Math.round(subtotal * 0.18);
  const total = subtotal + tva;

  const resetInvoiceForm = () => {
    setSelectedPatient(null);
    setPatientSearch('');
    setServices([{ id: Date.now(), type: 'Consultation', description: 'Consultation générale', quantity: 1, unitPrice: 10000 }]);
    setNotes('');
    setReferenceNumber('');
    setPaymentMethod('cash');
    setInvoiceNumber(`#INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  };

  const submitInvoice = async (): Promise<boolean> => {
    if (!selectedPatient) {
      showToast('error', 'Patient requis', 'Veuillez sélectionner un patient pour cette facture.');
      return false;
    }
    if (services.length === 0 || total <= 0) {
      showToast('error', 'Facture vide', 'Ajoutez au moins un service facturé.');
      return false;
    }
    if (paymentMethod !== 'cash' && !referenceNumber.trim()) {
      showToast('error', 'Référence requise', 'Indiquez le numéro de transaction pour ce mode de paiement.');
      return false;
    }

    setIsSubmittingInvoice(true);
    try {
      await api.post('/financials/checkout', {
        patientId: selectedPatient.id,
        amountTotal: total,
        paymentMethod,
        referenceNumber: referenceNumber || `${invoiceNumber}`,
        items: services.map(s => ({ type: s.type, name: s.description, cost: s.quantity * s.unitPrice }))
      });
      return true;
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Échec de l\'enregistrement', err.error || 'Impossible d\'enregistrer la facture.');
      return false;
    } finally {
      setIsSubmittingInvoice(false);
    }
  };

  const handleSaveInvoice = async () => {
    const ok = await submitInvoice();
    if (!ok) return;
    showToast('success', 'Facture enregistrée', `Facture ${invoiceNumber} sauvegardée et encaissée avec succès.`);
    resetInvoiceForm();
    setViewMode('journal');
  };

  const buildInvoiceReceiptHtml = () => {
    const rows = services.map(s => `
      <tr>
        <td>${s.type}</td>
        <td>${s.description}</td>
        <td style="text-align:center;">${s.quantity}</td>
        <td style="text-align:right;">${s.unitPrice.toLocaleString()} FCFA</td>
        <td style="text-align:right;">${(s.quantity * s.unitPrice).toLocaleString()} FCFA</td>
      </tr>
    `).join('');

    return `
      <html>
        <head>
          <title>Facture ${invoiceNumber}</title>
          <style>
            body { font-family: sans-serif; padding: 30px; color: #333; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #0d9488; padding-bottom: 15px; margin-bottom: 20px; }
            .title { font-size: 1.5rem; font-weight: bold; color: #0d9488; }
            .patient-box { background: #f3f4f6; padding: 12px; border-radius: 8px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 0.9rem; }
            th { background: #f3f4f6; text-align: left; }
            .totals { margin-left: auto; width: 280px; }
            .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
            .grand-total { font-weight: bold; font-size: 1.1rem; border-top: 1px solid #333; margin-top: 6px; padding-top: 8px; }
            .footer { text-align: center; margin-top: 40px; font-size: 0.8rem; color: #888; border-top: 1px solid #e5e7eb; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">CLINIQUE MÉDICALE DE L'AVENIR</div>
            <div>Facture ${invoiceNumber}</div>
          </div>
          <div class="patient-box">
            <strong>Patient :</strong> ${selectedPatient.last_name.toUpperCase()} ${selectedPatient.first_name}<br>
            <strong>Date facture :</strong> ${new Date(invoiceDate).toLocaleDateString('fr-FR')} |
            <strong>Échéance :</strong> ${new Date(dueDate).toLocaleDateString('fr-FR')}<br>
            <strong>Mode de paiement :</strong> ${paymentMethod.toUpperCase()}
          </div>
          <table>
            <thead>
              <tr><th>Type</th><th>Description</th><th>Qté</th><th>Prix unit.</th><th>Total</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="totals">
            <div><span>Sous-total</span><span>${subtotal.toLocaleString()} FCFA</span></div>
            <div><span>TVA (18%)</span><span>${tva.toLocaleString()} FCFA</span></div>
            <div class="grand-total"><span>Total</span><span>${total.toLocaleString()} FCFA</span></div>
          </div>
          ${notes ? `<p><strong>Notes :</strong> ${notes}</p>` : ''}
          <div class="footer">Document généré automatiquement via MediClinic.</div>
        </body>
      </html>
    `;
  };

  const handleSendAndPrint = async () => {
    const ok = await submitInvoice();
    if (!ok) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(buildInvoiceReceiptHtml());
      printWindow.document.close();
      printWindow.print();
    }
    showToast('success', 'Facture transmise', `Facture ${invoiceNumber} encaissée et prête pour l'impression.`);
    resetInvoiceForm();
    setViewMode('journal');
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

  return (
    <>
      {/* Responsive styles injected inline via <style> */}
      <style>{`
        .acc-page {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          padding: 1.25rem 1.5rem;
          background-color: var(--bg-primary);
          min-height: calc(100vh - var(--header-height));
          box-sizing: border-box;
        }

        /* Top header */
        .acc-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .acc-header-search {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .acc-search-box {
          position: relative;
          width: 220px;
        }
        .acc-search-box input {
          width: 100%;
          padding: 8px 12px 8px 34px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background-color: var(--bg-secondary);
          font-size: 0.85rem;
          outline: none;
          color: var(--text-primary);
        }
        .acc-search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
        }

        /* Tabs */
        .acc-tabs {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .acc-tab {
          padding: 8px 16px;
          border-radius: 10px;
          border: 1px solid var(--border);
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.2s, color 0.2s;
        }
        .acc-tab.active {
          background-color: #1e4d40;
          color: #fff;
          border-color: #1e4d40;
        }
        .acc-tab.inactive {
          background-color: var(--bg-secondary);
          color: var(--text-secondary);
        }

        /* Form grid (2 cols → 1 col on mobile) */
        .acc-form-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
          gap: 1.25rem;
          align-items: start;
        }

        /* Service card fields (6 cols → 2×3 on mobile) */
        .acc-service-fields {
          display: grid;
          grid-template-columns: 1.2fr 1.8fr 0.6fr 1fr 1fr 28px;
          gap: 8px;
          align-items: end;
          font-size: 0.78rem;
        }

        /* Bottom action bar */
        .acc-action-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 0.25rem;
        }
        .acc-action-buttons {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        /* Panel shared */
        .acc-panel {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 1.25rem;
          box-shadow: 0 2px 8px rgba(0,0,0,0.02);
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
        }

        /* === RESPONSIVE BREAKPOINTS === */

        /* Tablet (≤900px): form grid → 1 col */
        @media (max-width: 900px) {
          .acc-form-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Mobile (≤640px) */
        @media (max-width: 640px) {
          .acc-page {
            padding: 1rem 0.875rem;
            gap: 1rem;
          }

          /* Hide search bar on very small screens, keep bell */
          .acc-search-box {
            width: 100%;
          }
          .acc-header {
            flex-direction: column;
            align-items: stretch;
          }
          .acc-header-search {
            flex-direction: row;
            justify-content: flex-end;
          }
          .acc-search-box {
            flex: 1;
            width: auto;
            max-width: 200px;
          }

          /* Service fields → stacked 2 per row */
          .acc-service-fields {
            grid-template-columns: 1fr 1fr;
            gap: 6px;
          }
          /* Delete button spans full width */
          .acc-service-delete {
            grid-column: 1 / -1;
            display: flex;
            justify-content: flex-end;
          }

          /* Action bar: full-width buttons */
          .acc-action-bar {
            flex-direction: column;
            align-items: stretch;
          }
          .acc-action-bar > button,
          .acc-action-buttons {
            width: 100%;
          }
          .acc-action-buttons {
            flex-direction: column;
          }
          .acc-action-buttons > button {
            width: 100%;
            justify-content: center;
          }
          .acc-action-bar > button {
            justify-content: center;
          }
        }

        @media (max-width: 420px) {
          .acc-service-fields {
            grid-template-columns: 1fr;
          }
          .acc-service-delete {
            grid-column: 1;
          }
        }
      `}</style>

      <div className="acc-page">

        {/* 1. Top Header */}
        <div className="acc-header">
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-secondary)', color: 'var(--text-primary)', margin: 0 }}>
              {viewMode === 'create' ? 'Créer une facture' : 'Grand Livre & Recettes'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '2px' }}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          <div className="acc-header-search">
            <div className="acc-search-box">
              <Search size={15} color="var(--text-muted)" className="acc-search-icon" />
              <input type="text" placeholder="Rechercher un patient..." />
            </div>
            <div style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                border: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-secondary)'
              }}>
                <Bell size={18} />
              </div>
              <span style={{
                position: 'absolute', top: '-4px', right: '-4px',
                backgroundColor: '#ef4444', color: 'white', fontSize: '0.68rem',
                fontWeight: 700, width: '17px', height: '17px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid var(--bg-primary)'
              }}>3</span>
            </div>
          </div>
        </div>

        {/* 2. Tab Switcher */}
        <div className="acc-tabs">
          <button
            className={`acc-tab ${viewMode === 'create' ? 'active' : 'inactive'}`}
            onClick={() => setViewMode('create')}
          >
            Nouvelle facture
          </button>
          <button
            className={`acc-tab ${viewMode === 'journal' ? 'active' : 'inactive'}`}
            onClick={() => setViewMode('journal')}
          >
            Grand Livre & Journal des Recettes
          </button>
        </div>

        {/* VIEW 1: NOUVELLE FACTURE */}
        {viewMode === 'create' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            <div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-secondary)' }}>
                Nouvelle facture
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '2px' }}>
                Remplissez les informations ci-dessous
              </p>
            </div>

            {/* 2-column grid (collapses to 1 on tablet/mobile) */}
            <div className="acc-form-grid">

              {/* LEFT: Détails facture */}
              <div className="acc-panel">
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Détails facture
                </h3>

                {/* Patient */}
                <div>
                  <label style={labelStyle}>PATIENT</label>
                  <div style={{ position: 'relative', marginBottom: '8px' }}>
                    <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      placeholder="Chercher patient..."
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
                  <div style={{
                    backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)',
                    borderRadius: '8px', padding: '9px 12px',
                    fontSize: '0.85rem', fontWeight: 600, color: selectedPatient ? 'var(--text-primary)' : 'var(--text-muted)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <span>{selectedPatient ? `${selectedPatient.last_name} ${selectedPatient.first_name}` : 'Aucun patient sélectionné'}</span>
                    {selectedPatient && (
                      <button
                        onClick={() => setSelectedPatient(null)}
                        title="Changer de patient"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* N° Facture */}
                <div>
                  <label style={labelStyle}>N° FACTURE</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      style={{ ...inputStyle, fontFamily: 'monospace', fontWeight: 700 }}
                    />
                    <button
                      onClick={handleGenerateInvoiceNum}
                      title="Générer un autre numéro"
                      style={{
                        flexShrink: 0, background: 'none', border: '1px solid var(--border)',
                        borderRadius: '8px', padding: '8px', color: 'var(--text-secondary)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>
                </div>

                {/* Date Facture */}
                <div>
                  <label style={labelStyle}>DATE FACTURE</label>
                  <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} style={inputStyle} />
                </div>

                {/* Date Limite */}
                <div>
                  <label style={labelStyle}>DATE LIMITE DE PAIEMENT</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
                </div>

                {/* Mode de paiement */}
                <div>
                  <label style={labelStyle}>MODE DE PAIEMENT</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={inputStyle}>
                    <option value="cash">Espèces</option>
                    <option value="wave">Wave Mobile Money</option>
                    <option value="orange_money">Orange Money</option>
                    <option value="mtn_momo">MTN Mobile Money</option>
                  </select>
                </div>

                {paymentMethod !== 'cash' && (
                  <div>
                    <label style={labelStyle}>N° TRANSACTION / RÉFÉRENCE</label>
                    <input
                      type="text"
                      placeholder="Ex: W-8910-..."
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                )}
              </div>

              {/* RIGHT: Services facturés */}
              <div className="acc-panel">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Services facturés
                  </h3>
                  <button
                    onClick={handleAddService}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '7px 12px', backgroundColor: '#1e4d40', color: '#ffffff',
                      border: 'none', borderRadius: '8px', fontWeight: 700,
                      fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap'
                    }}
                  >
                    <Plus size={14} />
                    <span>Ajouter service</span>
                  </button>
                </div>

                {/* Services list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {services.map((serv) => {
                    const lineTotal = serv.quantity * serv.unitPrice;
                    return (
                      <div
                        key={serv.id}
                        style={{
                          backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)',
                          borderRadius: '12px', padding: '12px 14px'
                        }}
                      >
                        <div className="acc-service-fields">
                          {/* Type de service */}
                          <div>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                              Type
                            </span>
                            <input
                              type="text"
                              value={serv.type}
                              onChange={(e) => handleUpdateService(serv.id, 'type', e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', fontSize: '0.8rem', boxSizing: 'border-box' }}
                            />
                          </div>

                          {/* Description */}
                          <div>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                              Description
                            </span>
                            <input
                              type="text"
                              value={serv.description}
                              onChange={(e) => handleUpdateService(serv.id, 'description', e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', fontSize: '0.8rem', boxSizing: 'border-box' }}
                            />
                          </div>

                          {/* Quantité */}
                          <div>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                              Qté
                            </span>
                            <input
                              type="number"
                              value={serv.quantity}
                              onChange={(e) => handleUpdateService(serv.id, 'quantity', parseInt(e.target.value) || 1)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', fontSize: '0.8rem', boxSizing: 'border-box' }}
                            />
                          </div>

                          {/* Prix unit. */}
                          <div>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                              Prix unit.
                            </span>
                            <input
                              type="number"
                              value={serv.unitPrice}
                              onChange={(e) => handleUpdateService(serv.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', fontSize: '0.8rem', boxSizing: 'border-box' }}
                            />
                          </div>

                          {/* Total */}
                          <div>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                              Total
                            </span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', paddingTop: '4px' }}>
                              {lineTotal.toLocaleString()} FCFA
                            </span>
                          </div>

                          {/* Delete */}
                          <div className="acc-service-delete" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleRemoveService(serv.id)}
                              title="Supprimer"
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: '#ef4444', padding: '6px', display: 'flex',
                                alignItems: 'center', justifyContent: 'center'
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Totals */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Sous-total</span>
                    <span style={{ fontWeight: 600 }}>{subtotal.toLocaleString()} FCFA</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>TVA (18%)</span>
                    <span style={{ fontWeight: 600 }}>{tva.toLocaleString()} FCFA</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800, color: '#1e4d40', marginTop: '4px' }}>
                    <span>Total</span>
                    <span>{total.toLocaleString()} FCFA</span>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label style={labelStyle}>NOTES / CONDITIONS</label>
                  <textarea
                    placeholder="Conditions de paiement, mentions légales, etc..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '10px',
                      border: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)',
                      fontSize: '0.85rem', color: 'var(--text-primary)',
                      outline: 'none', resize: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Bottom action bar */}
            <div className="acc-action-bar">
              <button
                onClick={() => setViewMode('journal')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '10px 18px', backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', border: '1px solid var(--border)',
                  borderRadius: '10px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer'
                }}
              >
                <X size={15} color="var(--text-secondary)" />
                <span>Annuler</span>
              </button>

              <div className="acc-action-buttons">
                <button
                  onClick={handleSaveInvoice}
                  disabled={isSubmittingInvoice}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                    padding: '10px 18px', backgroundColor: '#e6f4ea', color: '#1e4d40',
                    border: '1px solid #bbf7d0', borderRadius: '10px',
                    fontWeight: 700, fontSize: '0.875rem', cursor: isSubmittingInvoice ? 'not-allowed' : 'pointer',
                    opacity: isSubmittingInvoice ? 0.6 : 1
                  }}
                >
                  <Save size={15} />
                  <span>Sauvegarder</span>
                </button>

                <button
                  onClick={handleSendAndPrint}
                  disabled={isSubmittingInvoice}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                    padding: '10px 22px', backgroundColor: '#1e4d40', color: '#ffffff',
                    border: 'none', borderRadius: '10px', fontWeight: 700,
                    fontSize: '0.875rem', cursor: isSubmittingInvoice ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(30,77,64,0.25)',
                    opacity: isSubmittingInvoice ? 0.6 : 1
                  }}
                >
                  <Send size={15} />
                  <span>Envoyer & imprimer</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: GRAND LIVRE & JOURNAL DES RECETTES */}
        {viewMode === 'journal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-secondary)' }}>Comptabilité & Caisse</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Suivez les paiements, éditez les factures et exportez les rapports financiers.</p>
              </div>
              <button onClick={() => showToast('info', 'Exportation PDF', 'Grand Livre exporté en PDF.')} className="btn btn-outline" style={{ gap: '6px', whiteSpace: 'nowrap' }}>
                <FileDown size={18} />
                <span>Exporter PDF</span>
              </button>
            </div>

            {/* Stats Cards */}
            <div className="grid-cols-3">
              <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)', padding: '12px', borderRadius: '10px', flexShrink: 0 }}>
                  <Wallet size={24} />
                </div>
                <div>
                  <span className="text-xs text-muted" style={{ fontWeight: 600 }}>CA TOTAL ENCAISSÉ</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '2px' }}>
                    {stats ? stats.totalRevenue.toLocaleString() : '—'} FCFA
                  </div>
                </div>
              </div>

              <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '12px', borderRadius: '10px', flexShrink: 0 }}>
                  <CreditCard size={24} />
                </div>
                <div>
                  <span className="text-xs text-muted" style={{ fontWeight: 600 }}>AUJOURD'HUI</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '2px' }}>
                    {stats ? stats.todayRevenue.toLocaleString() : '—'} FCFA
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: '14px 18px', fontSize: '0.875rem' }}>
                <strong style={{ display: 'block', marginBottom: '8px' }}>Répartition :</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {!stats || !stats.distribution || stats.distribution.length === 0 ? (
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>Aucun paiement enregistré.</span>
                  ) : (
                    stats.distribution.map((d: any) => (
                      <div key={d.method} className="flex justify-between">
                        <span style={{ textTransform: 'capitalize' }}>{d.method} :</span>
                        <span>{d.total.toLocaleString()} FCFA</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Date & Heure</th>
                    <th>Patient</th>
                    <th>Montant</th>
                    <th>Règlement</th>
                    <th>Référence</th>
                    <th>Caissier</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        Aucune transaction enregistrée.
                      </td>
                    </tr>
                  ) : (
                    payments.map(pay => (
                      <tr key={pay.id}>
                        <td>{new Date(pay.created_at).toLocaleDateString('fr-FR')}</td>
                        <td>{pay.patient_last_name} {pay.patient_first_name}</td>
                        <td style={{ fontWeight: 'bold', color: 'var(--success)' }}>{pay.amount_total.toLocaleString()} FCFA</td>
                        <td><span className="badge badge-info">{pay.payment_method}</span></td>
                        <td style={{ fontFamily: 'monospace' }}>{pay.reference_number || 'N/A'}</td>
                        <td>{pay.cashier_name}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px' }}>
                            <Printer size={14} /> Reçu
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </>
  );
};
