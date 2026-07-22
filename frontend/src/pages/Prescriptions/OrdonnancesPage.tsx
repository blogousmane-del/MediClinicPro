import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { FileText } from 'lucide-react';

interface PrescriptionItem {
  id: number;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity_prescribed: number;
  quantity_dispensed: number;
}

interface Prescription {
  id: number;
  patient_first_name: string;
  patient_last_name: string;
  folder_number: string;
  doctor_name: string;
  date_time: string;
  status: 'pending' | 'partial' | 'dispensed';
  items: PrescriptionItem[];
}

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  partial: 'Partiellement délivrée',
  dispensed: 'Délivrée'
};

const statusBadges: Record<string, string> = {
  pending: 'badge-warning',
  partial: 'badge-info',
  dispensed: 'badge-success'
};

export const OrdonnancesPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const [selectedPresc, setSelectedPresc] = useState<Prescription | null>(null);
  const [dispenseQuantities, setDispenseQuantities] = useState<Record<number, number>>({});
  const [isDispensing, setIsDispensing] = useState<boolean>(false);

  const canDispense = ['admin', 'pharmacist'].includes(user?.role || '');

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const endpoint = statusFilter ? `/pharmacy/prescriptions?status=${statusFilter}` : '/pharmacy/prescriptions';
      const data = await api.get(endpoint);
      setPrescriptions(data);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', 'Impossible de charger les ordonnances.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrescriptions();
  }, [statusFilter]);

  const handleOpenDispense = (presc: Prescription) => {
    setSelectedPresc(presc);
    const initialQtys: Record<number, number> = {};
    presc.items.forEach(it => {
      initialQtys[it.id] = it.quantity_prescribed - it.quantity_dispensed;
    });
    setDispenseQuantities(initialQtys);
  };

  const handleQtyChange = (itemId: number, value: string) => {
    const parsed = parseInt(value) || 0;
    setDispenseQuantities(prev => ({ ...prev, [itemId]: parsed }));
  };

  const handleConfirmDispensation = async () => {
    if (!selectedPresc) return;

    setIsDispensing(true);
    try {
      const dispensations = Object.keys(dispenseQuantities)
        .map(idStr => ({ itemId: parseInt(idStr), qty: dispenseQuantities[parseInt(idStr)] }))
        .filter(d => d.qty > 0);

      await api.post(`/pharmacy/dispense/${selectedPresc.id}`, { dispensations });
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

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Title & Filter */}
      <div className="flex justify-between align-center" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-secondary)' }}>Gestion des Ordonnances</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Suivez et délivrez les ordonnances prescrites aux patients.</p>
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="input-control"
          style={{ width: 'auto', minWidth: '200px' }}
        >
          <option value="">Toutes les ordonnances</option>
          <option value="pending">En attente</option>
          <option value="partial">Partiellement délivrées</option>
          <option value="dispensed">Délivrées</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-container">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Chargement des ordonnances...</div>
        ) : prescriptions.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <FileText size={32} style={{ opacity: 0.5 }} />
            <span>Aucune ordonnance trouvée pour ce filtre.</span>
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>N° Dossier</th>
                <th>Patient</th>
                <th>Médecin prescripteur</th>
                <th>Produits prescrits</th>
                <th>Statut</th>
                {canDispense && <th style={{ textAlign: 'right' }}>Action</th>}
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
                      {presc.items.map(it => `${it.medication_name} (${it.quantity_prescribed - it.quantity_dispensed} u restantes)`).join(', ')}
                    </td>
                    <td>
                      <span className={`badge ${statusBadges[presc.status]}`}>{statusLabels[presc.status]}</span>
                    </td>
                    {canDispense && (
                      <td style={{ textAlign: 'right' }}>
                        {presc.status !== 'dispensed' && (
                          <button
                            onClick={() => handleOpenDispense(presc)}
                            className="btn btn-primary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          >
                            Délivrer
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

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
                <strong>Patient :</strong> {selectedPresc.patient_last_name.toUpperCase()} {selectedPresc.patient_first_name} ({selectedPresc.folder_number})<br />
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
                      Restant : <strong>{it.quantity_prescribed - it.quantity_dispensed} u</strong>
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
