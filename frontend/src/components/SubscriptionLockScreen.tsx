import React, { useEffect, useState } from 'react';
import { Lock, ShieldAlert, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { formatDate } from '../utils/subscription';

interface SubscriptionLockScreenProps {
  /** Onglet demandé, affiché dans le titre pour que l'utilisateur sache ce qui est fermé. */
  tabLabel?: string;
  /** Bascule vers Paramètres > Abonnez-vous, où vit le tunnel de paiement. */
  onGoToBilling: () => void;
}

interface PlanCard {
  id: string;
  name: string;
  price: number;
  tagline: string;
  features: string[];
}

/**
 * Écran affiché à la place d'un module fermé par l'expiration de l'abonnement.
 *
 * Trois variantes, décidées ici plutôt que par l'appelant :
 * - suspension plateforme → appel au support, aucun plan (payer ne lève pas une
 *   suspension) ;
 * - administrateur → plans et bouton de paiement ;
 * - tout autre rôle → même écran sans bouton. POST /financials/subscription/checkout
 *   est réservé aux administrateurs : afficher un bouton que le serveur refusera
 *   enfermerait un pharmacien dans une impasse.
 */
export const SubscriptionLockScreen: React.FC<SubscriptionLockScreenProps> = ({ tabLabel, onGoToBilling }) => {
  const { user, subscription, suspended } = useAuth();
  const [plans, setPlans] = useState<PlanCard[]>([]);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (suspended || !isAdmin) return;
    // /api/settings reste ouvert pendant le verrou : les prix viennent donc du
    // catalogue serveur (utils/plans.js), jamais d'une copie écrite ici — un
    // tarif codé en dur dans l'interface finit toujours par mentir.
    let cancelled = false;
    api.get('/settings/plans')
      .then(data => {
        if (cancelled) return;
        const paid = Object.values(data.plans as Record<string, PlanCard>).filter(p => p.price > 0);
        setPlans(paid);
      })
      .catch(() => { /* sans catalogue, l'écran garde son message et son bouton */ });
    return () => { cancelled = true; };
  }, [suspended, isAdmin]);

  const title = suspended ? 'Compte suspendu' : 'Abonnement expiré';
  const Icon = suspended ? ShieldAlert : Lock;

  const description = suspended
    ? "Ce compte a été suspendu par l'administrateur de la plateforme. Contactez le support pour rétablir l'accès — un paiement ne lève pas une suspension."
    : isAdmin
      ? `Votre abonnement a pris fin le ${formatDate(subscription.expiresAt)}. Choisissez un plan pour rouvrir ${tabLabel ? `« ${tabLabel} »` : 'votre clinique'} et retrouver vos dossiers.`
      : `L'abonnement de votre clinique a pris fin le ${formatDate(subscription.expiresAt)}. Prévenez l'administrateur de votre clinique : lui seul peut choisir un plan et rouvrir l'accès.`;

  return (
    <div className="app-page" style={{ display: 'flex', justifyContent: 'center' }}>
      <div
        className="card"
        style={{
          maxWidth: '760px',
          width: '100%',
          padding: '2.5rem 1.75rem',
          textAlign: 'center',
          marginTop: '1.5rem'
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            margin: '0 auto 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--danger-light, hsl(0 84% 95%))',
            color: 'var(--danger, hsl(0 72% 45%))'
          }}
        >
          <Icon size={30} />
        </div>

        <h2 style={{ margin: '0 0 0.6rem', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          {title}
        </h2>

        <p style={{ margin: '0 auto 1.75rem', maxWidth: '520px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          {description}
        </p>

        {plans.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`,
              gap: '1rem',
              marginBottom: '1.75rem',
              textAlign: 'left'
            }}
          >
            {plans.map(plan => (
              <div
                key={plan.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '1.1rem',
                  backgroundColor: 'var(--bg-primary)'
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{plan.name}</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.35rem 0' }}>
                  {plan.price.toLocaleString('fr-FR')} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>FCFA/mois</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>{plan.tagline}</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.35rem' }}>
                  {plan.features.slice(0, 3).map(feature => (
                    <li key={feature} style={{ display: 'flex', gap: '0.45rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <Check size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {!suspended && isAdmin && (
          <button className="btn btn-primary" onClick={onGoToBilling} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            Choisir un plan
            <ArrowRight size={17} />
          </button>
        )}

        {!suspended && !isAdmin && (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Vos données ne sont pas perdues : elles redeviennent accessibles dès la réactivation.
          </div>
        )}
      </div>
    </div>
  );
};
