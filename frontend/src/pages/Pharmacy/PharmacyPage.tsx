import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { Pill, AlertTriangle, ArrowUpRight, Search, Plus, Check } from 'lucide-react';

interface Medication {
  id: number;
  name: string;
  form: string;
  dosage: string;
  stock_quantity: number;
  min_stock_threshold: number;
  price_purchase: number;
  price_sale: number;
  expiry_date: string;
  batch_number: string;
  supplier: string;
  isLowStock: boolean;
  isNearExpiry: boolean;
  isExpired: boolean;
}

interface Prescription {
  id: number;
  patient_first_name: string;
  patient_last_name: string;
  folder_number: string;
  doctor_name: string;
  date_time: string;
  status: string;
  items: any[];
}

export const PharmacyPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const [activeSubTab, setActiveSubTab] = useState<'inventory' | 'prescriptions'>('inventory');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Replenishment form modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [form, setForm] = useState<string>('comprimé');
  const [dosage, setDosage] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [pricePurchase, setPricePurchase] = useState<string>('');
  const [priceSale, setPriceSale] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [batchNumber, setBatchNumber] = useState<string>('');
  const [supplier, setSupplier] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Dispensation modal states
  const [selectedPresc, setSelectedPresc] = useState<Prescription | null>(null);
  const [dispenseQuantities, setDispenseQuantities] = useState<Record<number, number>>({});
  const [isDispensing, setIsDispensing] = useState<boolean>(false);

  const fetchMedications = async () => {
    try {
      setLoading(true);
      const data = await api.get('/pharmacy/medications');
      setMedications(data);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', 'Impossible de récupérer le stock de pharmacie.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const data = await api.get('/pharmacy/prescriptions?status=pending');
      setPrescriptions(data);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', 'Impossible de charger la file d\'attente des ordonnances.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'inventory') {
      fetchMedications();
    } else {
      fetchPrescriptions();
    }
  }, [activeSubTab]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setName('');
    setForm('comprimé');
    setDosage('');
    setQuantity('');
    setPricePurchase('');
    setPriceSale('');
    setExpiryDate('');
    setBatchNumber('');
    setSupplier('');
  };

  const handleReplenishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !dosage || !quantity || !pricePurchase || !priceSale) {
      showToast('error', 'Champs obligatoires', 'Veuillez remplir toutes les informations financières.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name,
        form,
        dosage,
        quantity: parseInt(quantity),
        pricePurchase: parseFloat(pricePurchase),
        priceSale: parseFloat(priceSale),
        expiryDate,
        batchNumber,
        supplier
      };

      await api.post('/pharmacy/replenish', payload);
      showToast('success', 'Stock approvisionné', `Le médicament ${name} a été enregistré.`);
      handleCloseModal();
      fetchMedications();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Échec d\'approvisionnement', err.error || 'Erreur lors de la mise à jour des stocks.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDispense = (presc: Prescription) => {
    setSelectedPresc(presc);
    // Initialize dispense quantities to prescribed values
    const initialQtys: Record<number, number> = {};
    presc.items.forEach(it => {
      initialQtys[it.id] = it.quantity_prescribed - it.quantity_dispensed;
    });
    setDispenseQuantities(initialQtys);
  };

  const handleQtyChange = (itemId: number, value: string) => {
    const parsed = parseInt(value) || 0;
    setDispenseQuantities(prev => ({
      ...prev,
      [itemId]: parsed
    }));
  };

  const handleConfirmDispensation = async () => {
    if (!selectedPresc) return;

    setIsDispensing(true);
    try {
      const itemsPayload = Object.keys(dispenseQuantities).map(idStr => ({
        itemId: parseInt(idStr),
        quantityDispensed: dispenseQuantities[parseInt(idStr)]
      }));

      await api.post(`/pharmacy/dispense/${selectedPresc.id}`, { items: itemsPayload });
      showToast('success', 'Ordonnance délivrée', 'La délivrance a été enregistrée et le stock décrémenté.');
      setSelectedPresc(null);
      fetchPrescriptions();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Échec de délivrance', err.error || 'Stock insuffisant ou erreur interne.');
    } finally {
      setIsDispensing(false);
    }
  };

  // Filter list
  const filteredMeds = medications.filter(med => 
    med.name.toLowerCase().includes(search.toLowerCase()) || 
    med.batch_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Title & Top controls */}
      <div className="flex justify-between align-center" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-secondary)' }}>Pharmacie & Pharmacopée</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Suivez le stock de médicaments et servez les ordonnances des patients.</p>
        </div>

        {activeSubTab === 'inventory' && ['admin', 'pharmacist', 'manager'].includes(user?.role || '') && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary"
            style={{ gap: '6px' }}
          >
            <Plus size={18} />
            <span>Approvisionner Stock</span>
          </button>
        )}
      </div>

      {/* Sub Tabs Toggle */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '1.5rem' }}>
        <button
          onClick={() => setActiveSubTab('inventory')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 6px',
            color: activeSubTab === 'inventory' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeSubTab === 'inventory' ? 600 : 400,
            borderBottom: activeSubTab === 'inventory' ? '3px solid var(--primary)' : 'none',
            cursor: 'pointer',
            fontSize: '0.95rem'
          }}
        >
          Inventaire du stock
        </button>
        <button
          onClick={() => setActiveSubTab('prescriptions')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 6px',
            color: activeSubTab === 'prescriptions' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeSubTab === 'prescriptions' ? 600 : 400,
            borderBottom: activeSubTab === 'prescriptions' ? '3px solid var(--primary)' : 'none',
            cursor: 'pointer',
            fontSize: '0.95rem'
          }}
        >
          Ordonnances à délivrer
        </button>
      </div>

      {/* TAB 1: Inventory stock */}
      {activeSubTab === 'inventory' && (
        <>
          {/* Search bar */}
          <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={18} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Rechercher par nom de médicament, numéro de lot..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-control w-full"
            />
          </div>

          {/* Table */}
          <div className="table-container">
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Chargement du catalogue...</div>
            ) : filteredMeds.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Aucun médicament trouvé.</div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Médicament</th>
                    <th>Forme & Dosage</th>
                    <th>Quantité Stock</th>
                    <th>Prix Achat</th>
                    <th>Prix Vente</th>
                    <th>N° de lot</th>
                    <th>Date d'expiration</th>
                    <th>Fournisseur</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMeds.map(med => {
                    const expiry = med.expiry_date ? new Date(med.expiry_date).toLocaleDateString('fr-FR') : 'N/A';
                    
                    return (
                      <tr key={med.id}>
                        <td style={{ fontWeight: 600 }}>{med.name}</td>
                        <td style={{ textTransform: 'capitalize' }}>{med.form} - {med.dosage}</td>
                        <td style={{ fontWeight: 'bold' }}>
                          <span style={{ color: med.isLowStock ? 'var(--danger)' : 'inherit' }}>
                            {med.stock_quantity}
                          </span>
                          {med.isLowStock && (
                            <span className="badge badge-danger" style={{ marginLeft: '8px', fontSize: '0.65rem', padding: '2px 6px' }}>Stock Bas</span>
                          )}
                        </td>
                        <td>{med.price_purchase.toLocaleString()} FCFA</td>
                        <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{med.price_sale.toLocaleString()} FCFA</td>
                        <td><span style={{ fontFamily: 'monospace' }}>{med.batch_number || 'N/A'}</span></td>
                        <td>
                          <span style={{ color: (med.isExpired || med.isNearExpiry) ? 'var(--danger)' : 'inherit' }}>
                            {expiry}
                          </span>
                          {med.isNearExpiry && (
                            <span className="badge badge-warning" style={{ marginLeft: '8px', fontSize: '0.65rem', padding: '2px 6px' }}>Proche</span>
                          )}
                          {med.isExpired && (
                            <span className="badge badge-danger" style={{ marginLeft: '8px', fontSize: '0.65rem', padding: '2px 6px' }}>Périmé</span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{med.supplier || 'N/A'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* TAB 2: Prescriptions file */}
      {activeSubTab === 'prescriptions' && (
        <div className="table-container">
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Chargement des ordonnances...</div>
          ) : prescriptions.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Aucune ordonnance en attente de dispensation.</div>
          ) : (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>N° Dossier</th>
                  <th>Patient</th>
                  <th>Médecin prescripteur</th>
                  <th>Produits prescrits</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {prescriptions.map(presc => {
                  const date = new Date(presc.date_time).toLocaleDateString('fr-FR');
                  const time = new Date(presc.date_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                  
                  return (
                    <tr key={presc.id}>
                      <td>{date} à {time}</td>
                      <td style={{ fontFamily: 'monospace' }}>{presc.folder_number}</td>
                      <td style={{ fontWeight: 600 }}>{presc.patient_last_name.toUpperCase()} {presc.patient_first_name}</td>
                      <td>{presc.doctor_name}</td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {presc.items.map(it => `${it.medication_name} (${it.quantity_prescribed - it.quantity_dispensed} u)`).join(', ')}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => handleOpenDispense(presc)}
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        >
                          Délivrer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* REPLENISHMENT FORM MODAL */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={handleCloseModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Approvisionnement de Stock</h3>
              <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <form onSubmit={handleReplenishSubmit}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Nom du médicament *</label>
                  <input type="text" placeholder="Ex: Paracétamol" value={name} onChange={e => setName(e.target.value)} className="input-control" required />
                </div>
                <div className="form-group">
                  <label>Dosage *</label>
                  <input type="text" placeholder="Ex: 500mg, 100ml" value={dosage} onChange={e => setDosage(e.target.value)} className="input-control" required />
                </div>
                <div className="form-group">
                  <label>Forme galénique *</label>
                  <select value={form} onChange={e => setForm(e.target.value)} className="input-control">
                    <option value="comprimé">Comprimé</option>
                    <option value="gélule">Gélule</option>
                    <option value="sirop">Sirop / Liquide</option>
                    <option value="sachet">Sachet</option>
                    <option value="injectable">Injectable</option>
                    <option value="pommade">Pommade / Gel</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Quantité reçue *</label>
                  <input type="number" placeholder="Ex: 100" value={quantity} onChange={e => setQuantity(e.target.value)} className="input-control" required />
                </div>
                <div className="form-group">
                  <label>Prix d'achat unitaire (FCFA) *</label>
                  <input type="number" value={pricePurchase} onChange={e => setPricePurchase(e.target.value)} className="input-control" required />
                </div>
                <div className="form-group">
                  <label>Prix de vente unitaire (FCFA) *</label>
                  <input type="number" value={priceSale} onChange={e => setPriceSale(e.target.value)} className="input-control" required />
                </div>
                <div className="form-group">
                  <label>Numéro de lot</label>
                  <input type="text" placeholder="Ex: B-2026-X" value={batchNumber} onChange={e => setBatchNumber(e.target.value)} className="input-control" />
                </div>
                <div className="form-group">
                  <label>Date d'expiration</label>
                  <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="input-control" />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Fournisseur</label>
                  <input type="text" placeholder="Nom du grossiste..." value={supplier} onChange={e => setSupplier(e.target.value)} className="input-control" />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={handleCloseModal} className="btn btn-secondary">Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Enregistrement...' : 'Enregistrer Approvisionnement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISPENSATION MODAL */}
      {selectedPresc && (
        <div className="modal-backdrop" onClick={() => setSelectedPresc(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Délivrance de l'ordonnance</h3>
              <button onClick={() => setSelectedPresc(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '10px', borderRadius: '6px', fontSize: '0.85rem' }}>
                <strong>Patient :</strong> {selectedPresc.patient_last_name.toUpperCase()} {selectedPresc.patient_first_name} ({selectedPresc.folder_number})<br/>
                <strong>Prescrit par :</strong> {selectedPresc.doctor_name}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <strong style={{ fontSize: '0.9rem' }}>Lignes d'ordonnance :</strong>
                {selectedPresc.items.map(it => (
                  <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr', gap: '8px', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{it.medication_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Posologie: {it.dosage} | Fréq: {it.frequency} | Durée: {it.duration}</div>
                    </div>
                    <div style={{ fontSize: '0.8rem', textAlign: 'center' }}>
                      Prescrit : <strong>{it.quantity_prescribed - it.quantity_dispensed} u</strong>
                    </div>
                    <div>
                      <input
                        type="number"
                        min="0"
                        max={it.quantity_prescribed - it.quantity_dispensed}
                        value={dispenseQuantities[it.id] || 0}
                        onChange={e => handleQtyChange(it.id, e.target.value)}
                        className="input-control"
                        style={{ padding: '6px', fontSize: '0.85rem', textAlign: 'center' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={() => setSelectedPresc(null)} className="btn btn-secondary">Annuler</button>
              <button onClick={handleConfirmDispensation} className="btn btn-primary" disabled={isDispensing}>
                {isDispensing ? 'Traitement...' : 'Confirmer la délivrance'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
