import React, { useEffect, useState } from 'react';
import { api } from '../../../utils/api';
import { useNotifications } from '../../../contexts/NotificationContext';
import { SkeletonCards } from '../../../components/Skeleton';
import ChariowConfigSection, { type ChariowConfig } from './ChariowConfigSection';

interface ConfigResponse {
  payments: { bictorys: boolean; paytech: boolean; paypal: boolean };
  paypal: { mode: string; modeRecognised: boolean; webhookConfigured: boolean; rateConfigured: boolean };
  email: { channel: 'resend' | 'smtp' | 'console' };
  rateLimit: { backend: 'redis' | 'memory' };
  google: { configured: boolean };
  cron: { configured: boolean };
  urls: { apiPublicUrl: string; appUrl: string };
  chariow?: ChariowConfig;
  database: { connected: boolean };
  plans: { id: string; name: string; price: number; staffLimit: number | null }[];
  settings: {
    values: { starter_trial_days: number; maintenance_message: string };
    tableMissing: boolean;
  };
}

const Status: React.FC<{ ok: boolean; okLabel?: string; koLabel?: string }> = ({
  ok,
  okLabel = 'Configuré',
  koLabel = 'Non configuré'
}) => (
  <span
    className="badge"
    style={{
      backgroundColor: ok ? 'hsl(145 55% 92%)' : 'hsl(0 70% 95%)',
      color: ok ? 'hsl(145 70% 24%)' : 'hsl(0 65% 40%)'
    }}
  >
    {ok ? okLabel : koLabel}
  </span>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '9px 0',
      borderBottom: '1px solid var(--border)',
      gap: '12px'
    }}
  >
    <span style={{ fontSize: '0.85rem' }}>{label}</span>
    <span style={{ fontSize: '0.8rem', textAlign: 'right' }}>{children}</span>
  </div>
);

export const SystemConfigSection: React.FC = () => {
  const { showToast } = useNotifications();
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [trialDays, setTrialDays] = useState('');
  const [maintenance, setMaintenance] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data: ConfigResponse = await api.get('/platform/config');
      setConfig(data);
      setTrialDays(String(data.settings.values.starter_trial_days));
      setMaintenance(data.settings.values.maintenance_message);
    } catch (err: any) {
      showToast('error', 'Erreur', err.error || 'Impossible de lire la configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/platform/config', {
        starter_trial_days: trialDays,
        maintenance_message: maintenance
      });
      showToast('success', 'Enregistré', 'Les réglages de la plateforme ont été mis à jour.');
      await load();
    } catch (err: any) {
      showToast('error', 'Échec', err.error || "Impossible d'enregistrer les réglages.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SkeletonCards count={5} height={88} label="Chargement de la configuration…" />;
  if (!config) return <p style={{ color: 'var(--text-secondary)' }}>Configuration indisponible.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {config.chariow && <ChariowConfigSection config={config.chariow} onSaved={load} />}

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>Anciens fournisseurs de paiement</h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>
          Plus aucun paiement n'est lancé par ces trois fournisseurs : l'abonnement passe par Chariow, les
          encaissements patients et les dépôts de garantie se font en espèces. Leur configuration reste lisible
          ici parce que leurs webhooks restent montés, pour créditer les paiements engagés avant la bascule.
        </p>
        <Row label="Bictorys (Mobile Money principal)"><Status ok={config.payments.bictorys} /></Row>
        <Row label="PayTech (Mobile Money secours)"><Status ok={config.payments.paytech} /></Row>
        <Row label="PayPal (abonnements uniquement)"><Status ok={config.payments.paypal} /></Row>
        <Row label="Mode PayPal">
          {config.paypal.modeRecognised ? (
            <Status ok={config.paypal.mode === 'live'} okLabel="live" koLabel="sandbox" />
          ) : (
            <Status ok={false} koLabel="PAYPAL_MODE non reconnu — repli sandbox" />
          )}
        </Row>
        <Row label="Webhook PayPal déclaré"><Status ok={config.paypal.webhookConfigured} /></Row>
        <Row label="Taux de conversion FCFA → USD"><Status ok={config.paypal.rateConfigured} /></Row>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Services</h3>
        <Row label="Envoi d'emails">
          <Status
            ok={config.email.channel !== 'console'}
            okLabel={config.email.channel === 'resend' ? 'Resend' : 'SMTP'}
            koLabel="Console — aucun email réel envoyé"
          />
        </Row>
        <Row label="Limitation de débit">
          <Status
            ok={config.rateLimit.backend === 'redis'}
            okLabel="Redis partagé"
            koLabel="Mémoire — inefficace en serverless"
          />
        </Row>
        <Row label="Google Sign-In"><Status ok={config.google.configured} /></Row>
        <Row label="Tâches planifiées (CRON_SECRET)"><Status ok={config.cron.configured} /></Row>
        <Row label="Base de données">
          <Status ok={config.database.connected} okLabel="Connectée" koLabel="Injoignable" />
        </Row>
        {/* Ces deux adresses étaient affichées en italique discret quand elles
            manquaient, à côté de badges rouges — donc lues comme une simple
            information. Or une APP_URL absente renvoie un acheteur qui vient de
            payer vers localhost, et une API_PUBLIC_URL absente rend l'URL de
            webhook inutilisable. Ce sont des pannes, elles se signalent comme
            telles. */}
        <Row label="API_PUBLIC_URL">
          {config.urls.apiPublicUrl || <Status ok={false} koLabel="Manquant — URL de webhook incomplète" />}
        </Row>
        <Row label="APP_URL">
          {config.urls.appUrl || <Status ok={false} koLabel="Manquant — paiement d'abonnement suspendu" />}
        </Row>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>Plans en vigueur</h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>
          Lecture seule. Les tarifs sont définis dans le code pour qu'une faute de saisie ne puisse pas casser
          la facturation de toutes les cliniques d'un coup.
        </p>
        {config.plans.map((plan) => (
          <Row key={plan.id} label={plan.name}>
            {plan.price.toLocaleString()} FCFA/mois —{' '}
            {plan.staffLimit === null ? 'personnel illimité' : `${plan.staffLimit} collaborateurs`}
          </Row>
        ))}
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Réglages modifiables</h3>
        {config.settings.tableMissing && (
          <p
            style={{
              fontSize: '0.8rem',
              color: 'hsl(0 65% 40%)',
              backgroundColor: 'hsl(0 70% 97%)',
              padding: '10px 12px',
              borderRadius: '8px',
              margin: '0 0 12px'
            }}
          >
            La table <code>platform_settings</code> est absente de la base. Exécutez la migration déclarée dans{' '}
            <code>backend/supabase_schema.sql</code> avant de modifier ces valeurs. En attendant, les valeurs
            par défaut s'appliquent.
          </p>
        )}

        <label style={{ display: 'block', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Durée de l'essai Starter (jours)
          </span>
          <input
            type="number"
            className="input-control"
            value={trialDays}
            onChange={(e) => setTrialDays(e.target.value)}
            style={{ maxWidth: '160px' }}
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
            Entre 1 et 90. Ne modifie jamais un essai déjà en cours.
          </span>
        </label>

        <label style={{ display: 'block', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Message de maintenance
          </span>
          <textarea
            className="input-control"
            value={maintenance}
            maxLength={280}
            rows={2}
            onChange={(e) => setMaintenance(e.target.value)}
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
            Affiché en bandeau à toutes les cliniques. Laisser vide pour ne rien afficher. {maintenance.length}/280
          </span>
        </label>

        <button className="btn btn-primary" disabled={saving || config.settings.tableMissing} onClick={save}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
};

export default SystemConfigSection;
