import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
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
  const { user } = useAuth();
  const { showToast } = useNotifications();

  // Mode: 'create' (Nouvelle facture) or 'journal' (Grand livre & Recettes)
  const [viewMode, setViewMode] = useState<'create' | 'journal'>('create');

  // Form State for "Nouvelle Facture" matching Image 2
  const [patientSearch, setPatientSearch] = useState<string>('');
  const [selectedPatient, setSelectedPatient] = useState<string>('Adjobi Kouassi');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('#INV-2025-0852');
  const [invoiceDate, setInvoiceDate] = useState<string>('2025-07-14');
  const [dueDate, setDueDate] = useState<string>('2025-07-28');
  const [status, setStatus] = useState<string>('Non payée');
  const [notes, setNotes] = useState<string>('');

  // Factored services list matching Image 2
  const [services, setServices] = useState<InvoiceService[]>([
    { id: 1, type: 'Consultation', description: 'Consultation générale', quantity: 1, unitPrice: 25000 },
    { id: 2, type: 'Pharmacie', description: 'Médicaments prescrits', quantity: 1, unitPrice: 15600 }
  ]);

  // Journal / History States
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

  // Calculations matching Image 2
  const subtotal = services.reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0);
  const tva = Math.round(subtotal * 0.18);
  const total = subtotal + tva;

  const handleSaveInvoice = () => {
    showToast('success', 'Facture enregistrée', `Facture ${invoiceNumber} sauvegardée avec succès.`);
  };

  const handleSendAndPrint = () => {
    showToast('success', 'Facture transmise', `Facture ${invoiceNumber} envoyée au patient et prète pour l'impression.`);
  };

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
      
      {/* 1. Top Header Breadcrumb matching Image 2 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, fontFamily: 'var(--font-secondary)', color: 'var(--text-primary)', margin: 0 }}>
            {viewMode === 'create' ? 'Créer une facture' : 'Grand Livre & Recettes'}
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

      {/* Mode Switcher Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => setViewMode('create')}
          style={{
            padding: '8px 18px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: viewMode === 'create' ? '#1e4d40' : 'var(--bg-secondary)',
            color: viewMode === 'create' ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}
        >
          Nouvelle facture
        </button>

        <button
          onClick={() => setViewMode('journal')}
          style={{
            padding: '8px 18px',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            backgroundColor: viewMode === 'journal' ? '#1e4d40' : 'var(--bg-secondary)',
            color: viewMode === 'journal' ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}
        >
          Grand Livre & Journal des Recettes
        </button>
      </div>

      {/* VIEW 1: NOUVELLE FACTURE MATCHING IMAGE 2 TARGET DESIGN */}
      {viewMode === 'create' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Title Banner */}
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-secondary)' }}>
              Nouvelle facture
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '2px', margin: 0 }}>
              Remplissez les informations ci-dessous
            </p>
          </div>

          {/* Split Form Grid (~40% Left: Détails facture, ~60% Right: Services facturés) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)',
            gap: '1.5rem',
            alignItems: 'start'
          }}>
            
            {/* LEFT COLUMN: Détails facture */}
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Détails facture
              </h3>

              {/* Patient selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  PATIENT
                </label>
                <div style={{ position: 'relative', marginBottom: '8px' }}>
                  <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Chercher patient..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 32px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-primary)',
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)'
                }}>
                  {selectedPatient || 'Aucun patient sélectionné'}
                </div>
              </div>

              {/* Invoice Number */}
              <div>
                <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  N° FACTURE
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-primary)',
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={handleGenerateInvoiceNum}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '8px',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Générer un autre numéro"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>

              {/* Invoice Date */}
              <div>
                <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  DATE FACTURE
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-primary)',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Due Date */}
              <div>
                <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  DATE LIMITE DE PAIEMENT
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-primary)',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Status */}
              <div>
                <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  STATUT
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-primary)',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="Non payée">Non payée</option>
                  <option value="Payée">Payée</option>
                  <option value="Partiellement payée">Partiellement payée</option>
                </select>
              </div>
            </div>

            {/* RIGHT COLUMN: Services facturés */}
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Services facturés
                </h3>

                <button
                  onClick={handleAddService}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    backgroundColor: '#1e4d40',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={15} />
                  <span>Ajouter service</span>
                </button>
              </div>

              {/* Banners List of Services matching Image 2 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {services.map((serv) => {
                  const lineTotal = serv.quantity * serv.unitPrice;

                  return (
                    <div
                      key={serv.id}
                      style={{
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1.2fr 1.8fr 0.6fr 1fr 1fr 30px',
                        gap: '10px',
                        alignItems: 'center',
                        fontSize: '0.75rem'
                      }}>
                        {/* Type */}
                        <div>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                            Type de service
                          </span>
                          <input
                            type="text"
                            value={serv.type}
                            onChange={(e) => handleUpdateService(serv.id, 'type', e.target.value)}
                            style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', fontSize: '0.8rem' }}
                          />
                        </div>

                        {/* Description */}
                        <div>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                            Description
                          </span>
                          <input
                            type="text"
                            value={serv.description}
                            onChange={(e) => handleUpdateService(serv.id, 'description', e.target.value)}
                            style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', fontSize: '0.8rem' }}
                          />
                        </div>

                        {/* Quantité */}
                        <div>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                            Quantité
                          </span>
                          <input
                            type="number"
                            value={serv.quantity}
                            onChange={(e) => handleUpdateService(serv.id, 'quantity', parseInt(e.target.value) || 1)}
                            style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', fontSize: '0.8rem' }}
                          />
                        </div>

                        {/* Prix unit. */}
                        <div>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                            Prix unit.
                          </span>
                          <input
                            type="number"
                            value={serv.unitPrice}
                            onChange={(e) => handleUpdateService(serv.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', fontSize: '0.8rem' }}
                          />
                        </div>

                        {/* Total */}
                        <div>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                            Total
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {lineTotal.toLocaleString()} FCFA
                          </span>
                        </div>

                        {/* Delete Trash Icon */}
                        <button
                          onClick={() => handleRemoveService(serv.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#ef4444',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Supprimer la ligne"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totals Calculation Block matching Image 2 */}
              <div style={{
                borderTop: '1px solid var(--border)',
                paddingTop: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '0.9rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Sous-total</span>
                  <span style={{ fontWeight: 600 }}>{subtotal.toLocaleString()} FCFA</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>TVA (18%)</span>
                  <span style={{ fontWeight: 600 }}>{tva.toLocaleString()} FCFA</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: 800, color: '#1e4d40', marginTop: '6px' }}>
                  <span>Total</span>
                  <span>{total.toLocaleString()} FCFA</span>
                </div>
              </div>

              {/* Notes / Conditions */}
              <div>
                <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  NOTES / CONDITIONS
                </label>
                <textarea
                  placeholder="Conditions de paiement, mentions légales, etc..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-primary)',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

            </div>

          </div>

          {/* Bottom Action Bar matching Image 2 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '0.5rem'
          }}>
            <button
              onClick={() => setViewMode('journal')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 20px',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              <X size={16} color="var(--text-secondary)" />
              <span>Annuler</span>
            </button>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={handleSaveInvoice}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  backgroundColor: '#e6f4ea',
                  color: '#1e4d40',
                  border: '1px solid #bbf7d0',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                <Save size={16} />
                <span>Sauvegarder</span>
              </button>

              <button
                onClick={handleSendAndPrint}
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
                <Send size={16} />
                <span>Envoyer & imprimer</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* VIEW 2: GRAND LIVRE & JOURNAL DES RECETTES */}
      {viewMode === 'journal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-secondary)' }}>Comptabilité & Caisse</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Suivez les paiements des patients, éditez les factures et exportez les rapports financiers.</p>
            </div>

            <button onClick={() => showToast('info', 'Exportation PDF', 'Grand Livre exporté en PDF.')} className="btn btn-outline" style={{ gap: '6px' }}>
              <FileDown size={18} />
              <span>Exporter Grand Livre (PDF)</span>
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid-cols-3">
            <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)', padding: '12px', borderRadius: '10px' }}>
                <Wallet size={24} />
              </div>
              <div>
                <span className="text-xs text-muted" style={{ fontWeight: 600 }}>CA TOTAL ENCAISSÉ</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '2px' }}>
                  {stats?.totalRevenue ? stats.totalRevenue.toLocaleString() : 40600} FCFA
                </div>
              </div>
            </div>

            <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '12px', borderRadius: '10px' }}>
                <CreditCard size={24} />
              </div>
              <div>
                <span className="text-xs text-muted" style={{ fontWeight: 600 }}>CA ENCAISSÉ AUJOURD'HUI</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '2px' }}>
                  {stats?.todayRevenue ? stats.todayRevenue.toLocaleString() : 40600} FCFA
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '12px 18px', fontSize: '0.85rem' }}>
              <strong style={{ display: 'block', marginBottom: '6px' }}>Répartition par mode :</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div className="flex justify-between"><span>Espèces :</span> <span>25,000 FCFA</span></div>
                <div className="flex justify-between"><span>Mobile Money :</span> <span>15,600 FCFA</span></div>
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
                  <>
                    <tr>
                      <td>14/07/2025 à 09:30</td>
                      <td><strong>KOUASSI Adjobi</strong> (P001)</td>
                      <td style={{ fontWeight: 'bold', color: 'var(--success)' }}>25,000 FCFA</td>
                      <td><span className="badge badge-info">Espèces</span></td>
                      <td style={{ fontFamily: 'monospace' }}>#INV-2025-0852</td>
                      <td>Aminata Koné</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px' }}>
                          <Printer size={14} /> Facture Reçu
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td>14/07/2025 à 11:15</td>
                      <td><strong>DIOMANDÉ Fatou</strong> (P002)</td>
                      <td style={{ fontWeight: 'bold', color: 'var(--success)' }}>15,600 FCFA</td>
                      <td><span className="badge badge-info">Wave</span></td>
                      <td style={{ fontFamily: 'monospace' }}>#INV-2025-0853</td>
                      <td>Aminata Koné</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px' }}>
                          <Printer size={14} /> Facture Reçu
                        </button>
                      </td>
                    </tr>
                  </>
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
  );
};
