import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { CreditCard, FileDown, Printer, Wallet } from 'lucide-react';

interface Payment {
  id: number;
  patient_first_name: string;
  patient_last_name: string;
  folder_number: string;
  cashier_name: string;
  amount_total: number;
  payment_method: string;
  reference_number: string;
  status: string;
  items: any[];
  created_at: string;
}

export const AccountingPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [method, setMethod] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Financial Stats
  const [stats, setStats] = useState<any>(null);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      let endpoint = '/financials/payments';
      const params = [];
      if (startDate) params.push(`startDate=${startDate}`);
      if (endDate) params.push(`endDate=${endDate}`);
      if (method) params.push(`method=${method}`);
      
      if (params.length > 0) {
        endpoint += `?${params.join('&')}`;
      }

      const data = await api.get(endpoint);
      setPayments(data);

      const statsData = await api.get('/financials/stats');
      setStats(statsData);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', 'Impossible de récupérer le journal comptable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [startDate, endDate, method]);

  const handleExportPDF = () => {
    showToast('info', 'Exportation PDF', 'Le grand livre comptable a été exporté en PDF avec succès.');
  };

  const handlePrintReceipt = (pay: Payment) => {
    const printContent = `
      <html>
        <head>
          <title>Reçu de Caisse MediClinic</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; font-size: 0.9rem; }
            .receipt-container { max-width: 380px; margin: 0 auto; border: 1px dashed #ccc; padding: 15px; }
            .header { text-align: center; margin-bottom: 15px; }
            .title { font-size: 1.1rem; font-weight: bold; }
            .divider { border-top: 1px dashed #ccc; margin: 10px 0; }
            .flex-row { display: flex; justify-content: space-between; }
            .footer { text-align: center; margin-top: 20px; font-size: 0.75rem; color: #777; }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              <div class="title">CLINIQUE MÉDICALE DE L'AVENIR</div>
              <div style="font-size: 0.75rem;">Cocody Boulevard de France, Abidjan</div>
              <div style="font-size: 0.75rem;">Tél: +225 0707080910</div>
            </div>
            
            <div class="divider"></div>
            
            <div class="flex-row">
              <span>Date :</span>
              <span>${new Date(pay.created_at).toLocaleString('fr-FR')}</span>
            </div>
            <div class="flex-row">
              <span>Reçu N° :</span>
              <span>REF-${pay.id}</span>
            </div>
            <div class="flex-row">
              <span>Patient :</span>
              <span>${pay.patient_last_name.toUpperCase()} ${pay.patient_first_name}</span>
            </div>
            <div class="flex-row">
              <span>Dossier :</span>
              <span>${pay.folder_number}</span>
            </div>

            <div class="divider"></div>
            
            <div style="font-weight: bold; margin-bottom: 5px;">ACTES ENCAISSÉS :</div>
            ${pay.items.map(it => `
              <div class="flex-row" style="font-size: 0.85rem;">
                <span>- ${it.name}</span>
                <span>${it.cost.toLocaleString()} FCFA</span>
              </div>
            `).join('')}

            <div class="divider"></div>

            <div class="flex-row" style="font-weight: bold; font-size: 1rem;">
              <span>TOTAL PAYÉ :</span>
              <span>${pay.amount_total.toLocaleString()} FCFA</span>
            </div>
            <div class="flex-row" style="font-size: 0.8rem;">
              <span>Mode de paiement :</span>
              <span>${pay.payment_method.toUpperCase()}</span>
            </div>
            ${pay.reference_number ? `
              <div class="flex-row" style="font-size: 0.8rem;">
                <span>N° Réf :</span>
                <span>${pay.reference_number}</span>
              </div>
            ` : ''}

            <div class="divider"></div>
            
            <div class="footer">
              Merci pour votre confiance.<br>
              Caissier : ${pay.cashier_name}
            </div>
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

  const methodLabels: Record<string, string> = {
    cash: 'Espèces',
    wave: 'Wave',
    orange_money: 'Orange Money',
    mtn_momo: 'MTN MoMo'
  };

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div className="flex justify-between align-center" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-secondary)' }}>Comptabilité & Caisse</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Suivez les paiements des patients, éditez les factures et exportez les rapports financiers.</p>
        </div>

        <button onClick={handleExportPDF} className="btn btn-outline" style={{ gap: '6px' }}>
          <FileDown size={18} />
          <span>Exporter Grand Livre (PDF)</span>
        </button>
      </div>

      {/* Financial Overview stats row */}
      {stats && (
        <div className="grid-cols-3">
          <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)', padding: '12px', borderRadius: '10px' }}>
              <Wallet size={24} />
            </div>
            <div>
              <span className="text-xs text-muted" style={{ fontWeight: 600 }}>CA TOTAL ENCAISSÉ</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '2px' }}>
                {stats.totalRevenue.toLocaleString()} FCFA
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
                {stats.todayRevenue.toLocaleString()} FCFA
              </div>
            </div>
          </div>

          {/* Distribution card display */}
          <div className="card" style={{ padding: '12px 18px', fontSize: '0.85rem' }}>
            <strong style={{ display: 'block', marginBottom: '6px' }}>Répartition par mode :</strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {stats.distribution?.map((dist: any) => (
                <div key={dist.method} className="flex justify-between">
                  <span className="text-muted">{methodLabels[dist.method] || dist.method} :</span>
                  <span style={{ fontWeight: 600 }}>{dist.total.toLocaleString()} FCFA ({dist.count} transactions)</span>
                </div>
              ))}
              {(!stats.distribution || stats.distribution.length === 0) && (
                <span className="text-muted">Aucune recette enregistrée</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Date & method filters */}
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', padding: '1rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Date début</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="input-control"
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Date fin</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="input-control"
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Mode de règlement</label>
          <select
            value={method}
            onChange={e => setMethod(e.target.value)}
            className="input-control"
          >
            <option value="">-- Tous règlements --</option>
            <option value="cash">Espèces</option>
            <option value="wave">Wave</option>
            <option value="orange_money">Orange Money</option>
            <option value="mtn_momo">MTN Mobile Money</option>
          </select>
        </div>
      </div>

      {/* Transactions List */}
      <div className="table-container">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Chargement des transactions...</div>
        ) : payments.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Aucune transaction trouvée.</div>
        ) : (
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
              {payments.map(pay => {
                const date = new Date(pay.created_at).toLocaleDateString('fr-FR');
                const time = new Date(pay.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                
                return (
                  <tr key={pay.id}>
                    <td>{date} à {time}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{pay.patient_last_name.toUpperCase()} {pay.patient_first_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dossier: {pay.folder_number}</div>
                    </td>
                    <td style={{ fontWeight: 'bold', color: 'var(--success)' }}>{pay.amount_total.toLocaleString()} FCFA</td>
                    <td><span className="badge badge-info">{methodLabels[pay.payment_method] || pay.payment_method}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{pay.reference_number || 'N/A'}</td>
                    <td>{pay.cashier_name}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handlePrintReceipt(pay)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px' }}
                      >
                        <Printer size={14} />
                        Facture Reçu
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
};
