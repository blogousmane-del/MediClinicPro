import React, { useState } from 'react';
import { api } from '../../../utils/api';
import { useNotifications } from '../../../contexts/NotificationContext';

export interface ChariowConfig {
  apiKey: 'set' | 'blank';
  webhookSecret: 'set' | 'blank';
  apiUrl: string;
  products: Record<string, string>;
  expectedProductKeys: string[];
  encryptionConfigured: boolean;
}

interface Props {
  config: ChariowConfig;
  onSaved: () => void;
}

const PLAN_LABELS: Record<string, string> = {
  clinique: 'Clinique',
  hopital: 'Hôpital'
};

// 'hopital_12' n'apprend rien à l'exploitant qui cherche le bon produit dans sa
// boutique : la clé technique reste affichée, mais doublée du libellé lisible.
const describeKey = (key: string) => {
  const [planId, months] = key.split('_');
  const plan = PLAN_LABELS[planId] || planId;
  return `${plan} — ${months} mois`;
};

export const ChariowConfigSection: React.FC<Props> = ({ config, onSaved }) => {
  const { showToast } = useNotifications();
  const [apiKey, setApiKey] = useState<string>('');
  const [products, setProducts] = useState<Record<string, string>>(config.products || {});
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const missing = config.expectedProductKeys.filter((key) => !(products[key] || '').trim());

  const save = async (payload: Record<string, unknown>) => {
    setSaving(true);
    try {
      const data = await api.put('/platform/config', payload);
      if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
      showToast('success', 'Configuration enregistrée', 'Chariow a été mis à jour.');
      onSaved();
    } catch (err: any) {
      showToast('error', 'Enregistrement refusé', err.error || 'Erreur inconnue.');
    } finally {
      setSaving(false);
    }
  };

  if (!config.encryptionConfigured) {
    return (
      <div className="card">
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Chariow — chiffrement non configuré</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
          La variable <code>CONFIG_ENCRYPTION_KEY</code> est absente. La clé API Chariow ne peut pas
          être enregistrée sans être chiffrée. Définissez-la dans les variables d'environnement du
          déploiement (64 caractères hexadécimaux), puis redéployez.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>Chariow — clé API</h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 10px' }}>
          État actuel : <strong>{config.apiKey === 'set' ? 'configurée' : 'absente'}</strong>. La clé
          n'est jamais réaffichée. Elle est vérifiée auprès de Chariow à l'enregistrement, et la
          boutique doit régler en XOF.
        </p>
        <input
          type="password"
          className="input-control"
          value={apiKey}
          placeholder="Coller la clé API Chariow"
          onChange={(e) => setApiKey(e.target.value)}
        />
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
          API : {config.apiUrl}
        </span>
        <button
          className="btn btn-primary"
          style={{ marginTop: '10px' }}
          disabled={saving || !apiKey.trim()}
          onClick={() => save({ chariow_api_key: apiKey.trim() })}
        >
          {saving ? 'Vérification...' : 'Enregistrer la clé'}
        </button>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>Chariow — produits par plan et durée</h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 10px' }}>
          Chariow débite le prix du produit, pas un montant transmis par MediClinic. Le prix de
          chaque produit doit correspondre exactement au plan multiplié par la durée, sinon le
          paiement est refusé au moment du checkout.
        </p>

        {missing.length > 0 && (
          <p
            style={{
              fontSize: '0.78rem',
              color: 'hsl(35 80% 30%)',
              backgroundColor: 'hsl(38 90% 96%)',
              padding: '9px 12px',
              borderRadius: '8px',
              margin: '0 0 12px'
            }}
          >
            {missing.length} combinaison{missing.length > 1 ? 's' : ''} sans produit :{' '}
            {missing.map(describeKey).join(', ')}. Ces durées ne peuvent pas être achetées.
          </p>
        )}

        {config.expectedProductKeys.map((key) => (
          <label key={key} style={{ display: 'block', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              {describeKey(key)} <code style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{key}</code>
            </span>
            <input
              className="input-control"
              value={products[key] || ''}
              placeholder="prod_…"
              onChange={(e) => setProducts({ ...products, [key]: e.target.value })}
            />
          </label>
        ))}

        <button
          className="btn btn-primary"
          disabled={saving}
          onClick={() => {
            // Les champs laissés vides sont retirés : le serveur refuse une
            // valeur vide, et une combinaison absente est un cas légitime tant
            // que le produit n'existe pas encore dans la boutique.
            const filled = Object.fromEntries(
              Object.entries(products).filter(([, value]) => value && value.trim())
            );
            save({ chariow_products: filled });
          }}
        >
          {saving ? 'Enregistrement...' : 'Enregistrer les produits'}
        </button>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>Chariow — webhook</h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 10px' }}>
          État actuel : <strong>{config.webhookSecret === 'set' ? 'configuré' : 'absent'}</strong>.
          L'URL complète n'est affichée qu'une seule fois, juste après la génération : copiez-la
          immédiatement dans le tableau de bord Chariow. Régénérer invalide l'ancienne.
        </p>

        {webhookUrl && (
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              backgroundColor: 'var(--bg-tertiary)',
              padding: '10px 12px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              margin: '0 0 10px'
            }}
          >
            {webhookUrl}
          </pre>
        )}

        <button
          className="btn btn-secondary"
          disabled={saving}
          onClick={() => save({ chariow_webhook_secret: '__generate__' })}
        >
          {config.webhookSecret === 'set' ? 'Régénérer le secret' : 'Générer le secret'}
        </button>
      </div>
    </>
  );
};

export default ChariowConfigSection;
