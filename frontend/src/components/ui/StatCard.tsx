import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { AnimatedNumber } from '../AnimatedNumber';

/**
 * Carte de statistique du tableau de bord.
 *
 * Elle existe pour une raison précise : les quatre cartes du tableau de bord
 * étaient quatre blocs de style inline recopiés, chacun avec sa pastille
 * d'icône codée en dur (#e6f4ea, #f1f5f9, #ffedd5). Ces valeurs claires
 * survivaient au thème sombre et posaient des taches lumineuses sur les
 * cartes sombres. Ici, le ton de la pastille passe par les tokens
 * sémantiques, redéfinis dans les deux thèmes.
 */
export type StatTone = 'brand' | 'neutral' | 'warning' | 'danger' | 'success';

const TONES: Record<StatTone, { surface: string; ink: string }> = {
  brand: { surface: 'var(--brand-soft)', ink: 'var(--brand-soft-ink)' },
  neutral: { surface: 'var(--bg-tertiary)', ink: 'var(--text-secondary)' },
  warning: { surface: 'var(--warning-surface)', ink: 'var(--warning-ink)' },
  danger: { surface: 'var(--danger-surface)', ink: 'var(--danger-ink)' },
  success: { surface: 'var(--success-surface)', ink: 'var(--success-ink)' }
};

interface StatCardProps {
  label: string;
  value: number;
  /** Ligne d'explication sous le chiffre. Elle doit décrire ce que le chiffre
   *  compte vraiment : deux cartes annonçaient autre chose que leur valeur. */
  hint: string;
  icon: LucideIcon;
  tone?: StatTone;
  onClick?: () => void;
  /** Formatage du chiffre pendant le comptage (montants en FCFA, par exemple). */
  formatter?: (value: number) => string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label, value, hint, icon: Icon, tone = 'neutral', onClick, formatter
}) => {
  const { surface, ink } = TONES[tone];
  const interactive = typeof onClick === 'function';

  return (
    <div
      onClick={onClick}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick!(); } } : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      className="stat-card-animate"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem 1.5rem',
        cursor: interactive ? 'pointer' : 'default',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
          {label}
        </span>
        <div style={{
          backgroundColor: surface,
          padding: '10px',
          borderRadius: 'var(--radius-sm)',
          color: ink,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Icon size={20} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: formatter ? '1.6rem' : '2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
          <AnimatedNumber value={value} formatter={formatter} />
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          {hint}
        </div>
      </div>
    </div>
  );
};
