import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../../utils/api';
import { useNotifications } from '../../../contexts/NotificationContext';
import BarChart from '../components/BarChart';
import DonutChart from '../components/DonutChart';

type Tab = 'revenus' | 'adoption';
type SortKey = 'patients' | 'consultations' | 'lastActivityAt';

interface Pair { label: string; value: number }

interface RevenueResponse {
  monthlyRevenue: Pair[];
  mrr: number;
  collectedThisMonth: number;
  planDistribution: Pair[];
  renewalsDue: { clinicId: number; clinicName: string; plan: string; expiresAt: string }[];
  expiredNotRenewed: { clinicId: number; clinicName: string; plan: string; expiresAt: string }[];
  stuckPayments: { id: number; clinicId: number; clinicName: string; amount: number; provider: string; createdAt: string }[];
  failedThisMonth: number;
  providerMix: Pair[];
}

interface AdoptionResponse {
  activeClinics: number;
  dormantClinics: number;
  perClinic: {
    clinicId: number; clinicName: string; plan: string;
    patients: number; consultations: number; activeUsers: number; lastActivityAt: string | null;
  }[];
  newClinicsPerMonth: Pair[];
  rolesFilled: Pair[];
  ticketsByCategory: Pair[];
  ticketsByStatus: Pair[];
}

const fcfa = (n: number) => `${n.toLocaleString()} FCFA`;
const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—');

const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
    {children}
  </p>
);

const Warn: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{
    fontSize: '0.8rem', color: 'hsl(0 65% 40%)', backgroundColor: 'hsl(0 70% 97%)',
    padding: '10px 12px', borderRadius: '8px', margin: '0 0 12px', lineHeight: 1.5
  }}>
    {children}
  </p>
);

const Th: React.FC<{ children: React.ReactNode; onClick?: () => void }> = ({ children, onClick }) => (
  <th
    onClick={onClick}
    style={{ padding: '6px 8px', textAlign: 'left', cursor: onClick ? 'pointer' : 'default' }}
  >
    {children}
  </th>
);

export const ReportsSection: React.FC = () => {
  const { showToast } = useNotifications();
  const [tab, setTab] = useState<Tab>('revenus');
  const [revenue, setRevenue] = useState<RevenueResponse | null>(null);
  const [adoption, setAdoption] = useState<AdoptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('patients');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [revenueData, adoptionData] = await Promise.all([
          api.get('/platform/reports/revenue'),
          api.get('/platform/reports/adoption')
        ]);
        setRevenue(revenueData);
        setAdoption(adoptionData);
      } catch (err: any) {
        showToast('error', 'Erreur', err.error || 'Impossible de charger les rapports.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedClinics = useMemo(() => {
    if (!adoption) return [];
    return [...adoption.perClinic].sort((a, b) => {
      if (sortKey === 'lastActivityAt') {
        return new Date(b.lastActivityAt || 0).getTime() - new Date(a.lastActivityAt || 0).getTime();
      }
      return b[sortKey] - a[sortKey];
    });
  }, [adoption, sortKey]);

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Chargement des rapports...</p>;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'revenus', label: 'Revenus' },
    { id: 'adoption', label: 'Adoption' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'btn btn-primary' : 'btn'}
            style={tab === item.id ? undefined : { border: '1px solid var(--border)' }}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'revenus' && revenue && (
        <>
          <div className="card">
            <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>
                  Revenu récurrent mensuel
                </span>
                <strong style={{ fontSize: '1.5rem' }}>{fcfa(revenue.mrr)}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>
                  Encaissé ce mois-ci
                </span>
                <strong style={{ fontSize: '1.5rem' }}>{fcfa(revenue.collectedThisMonth)}</strong>
              </div>
            </div>
            <Note>
              Le récurrent est calculé depuis les cliniques actives et leur plan. L'encaissé correspond aux
              règlements du mois : les abonnements se paient d'avance sur 1 à 12 mois, les deux chiffres
              diffèrent donc normalement.
            </Note>
          </div>

          {revenue.stuckPayments.length > 0 && (
            <div className="card">
              <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Paiements bloqués — webhook jamais reçu</h3>
              <Warn>
                L'argent a pu être débité sans que l'abonnement soit crédité. Vérifiez chez le fournisseur
                avant de rembourser.
              </Warn>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)' }}>
                      <Th>Clinique</Th><Th>Montant</Th><Th>Fournisseur</Th><Th>Initié le</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenue.stuckPayments.map((row) => (
                      <tr key={row.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 8px' }}>{row.clinicName}</td>
                        <td style={{ padding: '6px 8px' }}>{fcfa(row.amount)}</td>
                        <td style={{ padding: '6px 8px' }}>{row.provider}</td>
                        <td style={{ padding: '6px 8px' }}>{formatDate(row.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card">
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Revenu encaissé, 12 derniers mois</h3>
            <BarChart data={revenue.monthlyRevenue} formatValue={fcfa} />
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div className="card" style={{ flex: '1 1 300px' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: '1rem' }}>Répartition des plans</h3>
              <DonutChart data={revenue.planDistribution} />
            </div>
            <div className="card" style={{ flex: '1 1 300px' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: '1rem' }}>Fournisseurs de paiement</h3>
              <DonutChart data={revenue.providerMix} />
            </div>
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Renouvellements dans les 30 jours</h3>
            {revenue.renewalsDue.length === 0 ? (
              <Note>Aucun renouvellement à venir sur la période.</Note>
            ) : (
              revenue.renewalsDue.map((row) => (
                <div key={row.clinicId} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                  borderBottom: '1px solid var(--border)', fontSize: '0.85rem'
                }}>
                  <span>{row.clinicName} — {row.plan}</span>
                  <span>{formatDate(row.expiresAt)}</span>
                </div>
              ))
            )}
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Expirées, non renouvelées</h3>
            {revenue.expiredNotRenewed.length === 0 ? (
              <Note>Aucune.</Note>
            ) : (
              revenue.expiredNotRenewed.map((row) => (
                <div key={row.clinicId} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                  borderBottom: '1px solid var(--border)', fontSize: '0.85rem'
                }}>
                  <span>{row.clinicName} — {row.plan}</span>
                  <span>expiré le {formatDate(row.expiresAt)}</span>
                </div>
              ))
            )}
            <Note>Paiements en échec ce mois-ci : {revenue.failedThisMonth}</Note>
          </div>
        </>
      )}

      {tab === 'adoption' && adoption && (
        <>
          <div className="card">
            <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>
                  Cliniques actives
                </span>
                <strong style={{ fontSize: '1.5rem' }}>{adoption.activeClinics}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block' }}>
                  Dormantes
                </span>
                <strong style={{ fontSize: '1.5rem' }}>{adoption.dormantClinics}</strong>
              </div>
            </div>
            <Note>Active = au moins une action enregistrée sur les 30 derniers jours.</Note>
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Activité par clinique</h3>
            <Note>
              Cliquez sur un en-tête pour trier. Les consultations sont datées du rendez-vous, pas de la saisie.
            </Note>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)' }}>
                    <Th>Clinique</Th>
                    <Th>Plan</Th>
                    <Th onClick={() => setSortKey('patients')}>Patients</Th>
                    <Th onClick={() => setSortKey('consultations')}>Consultations</Th>
                    <Th>Personnel actif</Th>
                    <Th onClick={() => setSortKey('lastActivityAt')}>Dernière activité</Th>
                  </tr>
                </thead>
                <tbody>
                  {sortedClinics.map((row) => (
                    <tr key={row.clinicId} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 8px' }}>{row.clinicName}</td>
                      <td style={{ padding: '6px 8px' }}>{row.plan}</td>
                      <td style={{ padding: '6px 8px' }}>{row.patients}</td>
                      <td style={{ padding: '6px 8px' }}>{row.consultations}</td>
                      <td style={{ padding: '6px 8px' }}>{row.activeUsers}</td>
                      <td style={{ padding: '6px 8px' }}>{formatDate(row.lastActivityAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Nouvelles cliniques, 12 derniers mois</h3>
            <BarChart data={adoption.newClinicsPerMonth} />
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>Rôles pourvus</h3>
            <Warn>
              Indice, pas mesure : rien ne trace l'usage par module dans cette application. Un compte
              pharmacien actif suggère que la pharmacie sert, sans le prouver.
            </Warn>
            <DonutChart data={adoption.rolesFilled} />
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div className="card" style={{ flex: '1 1 300px' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: '1rem' }}>Tickets par catégorie</h3>
              <DonutChart data={adoption.ticketsByCategory} />
            </div>
            <div className="card" style={{ flex: '1 1 300px' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: '1rem' }}>Tickets par statut</h3>
              <DonutChart data={adoption.ticketsByStatus} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportsSection;
