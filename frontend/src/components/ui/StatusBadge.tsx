import React from 'react';

/**
 * Pastille de statut. Un seul rayon, un seul jeu de tons, et des couleurs qui
 * viennent des tokens sémantiques : les pastilles étaient jusqu'ici écrites à
 * la main dans chaque page, avec des fonds clairs codés en dur qui restaient
 * clairs en thème sombre.
 */
export type BadgeTone = 'brand' | 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<BadgeTone, { bg: string; fg: string; border: string }> = {
  brand: { bg: 'var(--brand-fill)', fg: 'var(--brand-fill-fg)', border: 'transparent' },
  neutral: { bg: 'var(--bg-tertiary)', fg: 'var(--text-secondary)', border: 'transparent' },
  success: { bg: 'var(--success-surface)', fg: 'var(--success-ink)', border: 'transparent' },
  warning: { bg: 'var(--warning-surface)', fg: 'var(--warning-ink)', border: 'transparent' },
  danger: { bg: 'var(--danger-surface)', fg: 'var(--danger-ink)', border: 'transparent' },
  info: { bg: 'var(--info-surface)', fg: 'var(--info-ink)', border: 'transparent' }
};

interface StatusBadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  /** Statut annulé ou obsolète : texte barré, contour au lieu d'un fond. */
  struck?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ children, tone = 'neutral', struck = false }) => {
  const { bg, fg } = TONES[tone];
  return (
    <span style={{
      backgroundColor: struck ? 'transparent' : bg,
      border: struck ? '1px solid var(--border-strong)' : '1px solid transparent',
      color: struck ? 'var(--text-muted)' : fg,
      padding: '4px 12px',
      borderRadius: 'var(--radius-full)',
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      whiteSpace: 'nowrap',
      textDecoration: struck ? 'line-through' : 'none'
    }}>
      {children}
    </span>
  );
};
