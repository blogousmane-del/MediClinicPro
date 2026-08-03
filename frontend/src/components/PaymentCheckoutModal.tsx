import React, { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';

type PollResult = { status: 'pending' | 'paid' | 'failed'; [key: string]: any };

interface PaymentCheckoutModalProps {
  checkoutUrl: string;
  provider?: string;
  amountLabel?: string;
  pollStatus: () => Promise<PollResult>;
  onSuccess: (result: PollResult) => void;
  onClose: () => void;
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;
// PayPal : connexion au compte + 2FA éventuelle + approbation + capture +
// livraison du webhook dépassent régulièrement les 3 minutes calibrées pour le
// Mobile Money, ce qui afficherait « Délai d'attente dépassé » sur des
// paiements qui aboutissent quelques instants plus tard.
const PAYPAL_POLL_TIMEOUT_MS = 10 * 60 * 1000;

// Shared "pay via a hosted Mobile Money page, then wait for webhook
// confirmation" UX — used by subscription renewal, Accounting checkout and
// Deposits. No equivalent existed before this was built for real online
// payments (Bictorys/PayTech); everything used to resolve synchronously.
export const PaymentCheckoutModal: React.FC<PaymentCheckoutModalProps> = ({
  checkoutUrl,
  provider,
  amountLabel,
  pollStatus,
  onSuccess,
  onClose
}) => {
  const [state, setState] = useState<'pending' | 'paid' | 'failed' | 'timeout'>('pending');
  const openedRef = useRef(false);
  const stoppedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!openedRef.current) {
      openedRef.current = true;
      window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
    }

    const startedAt = Date.now();
    const timeoutMs = provider === 'paypal' ? PAYPAL_POLL_TIMEOUT_MS : POLL_TIMEOUT_MS;

    const tick = async () => {
      if (stoppedRef.current) return;
      try {
        const result = await pollStatus();
        if (stoppedRef.current) return;

        if (result.status === 'paid') {
          stoppedRef.current = true;
          setState('paid');
          onSuccess(result);
          return;
        }
        if (result.status === 'failed') {
          stoppedRef.current = true;
          setState('failed');
          return;
        }
      } catch (err) {
        console.error('Erreur de vérification du paiement:', err);
      }

      if (Date.now() - startedAt > timeoutMs) {
        stoppedRef.current = true;
        setState('timeout');
        return;
      }

      timerRef.current = window.setTimeout(tick, POLL_INTERVAL_MS);
    };

    timerRef.current = window.setTimeout(tick, POLL_INTERVAL_MS);

    return () => {
      stoppedRef.current = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutUrl]);

  const isPaypal = provider === 'paypal';
  const providerLabel = isPaypal ? 'PayPal' : provider === 'paytech' ? 'PayTech' : 'Bictorys';

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{isPaypal ? 'Paiement PayPal' : 'Paiement Mobile Money'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
        </div>
        <div className="modal-body" style={{ textAlign: 'center', padding: '1.5rem 1.25rem' }}>
          {state === 'pending' && (
            <>
              <Loader2 size={40} className="animate-spin" style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
              <p style={{ fontWeight: 700, marginBottom: '0.5rem' }}>
                En attente de confirmation{amountLabel ? ` — ${amountLabel}` : ''}
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {isPaypal
                  ? "Un onglet s'est ouvert vers la page de paiement sécurisée PayPal. Confirmez le paiement sur cette page. Cette fenêtre se mettra à jour automatiquement."
                  : `Un onglet s'est ouvert vers la page de paiement sécurisée (${providerLabel}). Choisissez Wave, Orange Money ou MTN MoMo et confirmez sur votre téléphone. Cette fenêtre se mettra à jour automatiquement.`}
              </p>
              {isPaypal && (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: '0.5rem' }}>
                  Le montant est converti en dollars américains (USD) pour le paiement PayPal.
                </p>
              )}
              <button
                type="button"
                onClick={() => window.open(checkoutUrl, '_blank', 'noopener,noreferrer')}
                className="btn btn-secondary"
                style={{ marginTop: '1.25rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <ExternalLink size={15} /> Rouvrir la page de paiement
              </button>
            </>
          )}
          {state === 'paid' && (
            <>
              <CheckCircle2 size={40} style={{ color: 'var(--success, #10b981)', marginBottom: '1rem' }} />
              <p style={{ fontWeight: 700 }}>Paiement confirmé</p>
            </>
          )}
          {(state === 'failed' || state === 'timeout') && (
            <>
              <XCircle size={40} style={{ color: 'var(--danger)', marginBottom: '1rem' }} />
              <p style={{ fontWeight: 700, marginBottom: '0.5rem' }}>
                {state === 'failed' ? 'Le paiement a échoué ou a été annulé.' : "Délai d'attente dépassé."}
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Vous pouvez réessayer depuis le formulaire.
              </p>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">
            {state === 'pending' ? 'Annuler' : 'Fermer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentCheckoutModal;
