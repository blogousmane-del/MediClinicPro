import React from 'react';

/**
 * Placeholders de chargement ("skeleton load").
 *
 * Zéro dépendance : tout repose sur la classe `.skeleton` d'index.css, qui
 * suit le thème clair/sombre et se fige d'elle-même sous
 * `prefers-reduced-motion`. Platform Admin et les pages cliniques partagent
 * le même bundle, souvent téléchargé en 3G — pas de librairie de skeleton.
 *
 * Accessibilité : les blocs gris sont `aria-hidden` (ils n'ont aucun contenu
 * à annoncer) et chaque groupe porte un `role="status"` avec un texte
 * « Chargement… » réservé aux lecteurs d'écran, pour remplacer le texte
 * visible qui existait avant.
 */

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** Un bloc gris animé. Brique de base de tous les composants ci-dessous. */
export const Skeleton: React.FC<SkeletonProps> = ({ width, height, radius, className, style }) => (
  <span
    aria-hidden="true"
    className={`skeleton ${className || ''}`.trim()}
    style={{ width, height, borderRadius: radius, ...style }}
  />
);

/** Texte lu par les lecteurs d'écran pendant qu'un skeleton s'affiche. */
const LoadingAnnounce: React.FC<{ label: string }> = ({ label }) => (
  <span className="sr-only">{label}</span>
);

interface SkeletonLinesProps {
  lines?: number;
  /** Largeur de chaque ligne ; la dernière est raccourcie si non précisé. */
  widths?: string[];
  gap?: string;
}

/** Quelques lignes de texte factices, pour un paragraphe ou une cellule. */
export const SkeletonLines: React.FC<SkeletonLinesProps> = ({ lines = 3, widths, gap = '0.5rem' }) => (
  <span style={{ display: 'flex', flexDirection: 'column', gap }}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className="skeleton-line"
        width={widths?.[i] || (i === lines - 1 ? '60%' : '100%')}
      />
    ))}
  </span>
);

interface SkeletonTableRowsProps {
  rows?: number;
  cols: number;
  /** Hauteur de cellule, alignée sur le padding des tableaux existants. */
  cellPadding?: string;
  label?: string;
}

/**
 * Lignes de tableau fantômes. À placer directement dans un `<tbody>` :
 * `{loading ? <SkeletonTableRows rows={5} cols={8} /> : data.map(...)}`
 */
export const SkeletonTableRows: React.FC<SkeletonTableRowsProps> = ({
  rows = 5,
  cols,
  cellPadding = '14px 16px',
  label = 'Chargement des données…',
}) => (
  <>
    {Array.from({ length: rows }).map((_, r) => (
      <tr key={r} style={{ borderBottom: '1px solid var(--border)' }}>
        {Array.from({ length: cols }).map((__, c) => (
          <td key={c} style={{ padding: cellPadding }}>
            {r === 0 && c === 0 && <LoadingAnnounce label={label} />}
            <Skeleton
              className="skeleton-line"
              /* Largeurs irrégulières : un tableau de barres identiques
                 ressemble à un bug d'affichage, pas à un chargement. */
              width={c === cols - 1 ? '40%' : `${55 + ((r * 7 + c * 13) % 40)}%`}
            />
          </td>
        ))}
      </tr>
    ))}
  </>
);

interface SkeletonCardsProps {
  count?: number;
  height?: number | string;
  /** Rendu en grille responsive plutôt qu'en pile verticale. */
  grid?: boolean;
  minWidth?: string;
  gap?: string;
  label?: string;
}

/** Cartes fantômes, pour les listes en cartes (Pharmacie, Ordonnances, Labo). */
export const SkeletonCards: React.FC<SkeletonCardsProps> = ({
  count = 4,
  height = 110,
  grid = false,
  minWidth = '200px',
  gap = '1rem',
  label = 'Chargement des données…',
}) => (
  <div
    role="status"
    style={
      grid
        ? { display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}, 1fr))`, gap }
        : { display: 'flex', flexDirection: 'column', gap }
    }
  >
    <LoadingAnnounce label={label} />
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} height={height} radius="14px" style={{ width: '100%' }} />
    ))}
  </div>
);

interface SkeletonPageProps {
  /** Nombre de cartes sous l'en-tête. */
  cards?: number;
  /** Bandeau de 4 tuiles de statistiques au-dessus des cartes. */
  stats?: boolean;
  label?: string;
}

/**
 * Page complète en chargement : en-tête + tuiles + liste. Utilisé là où la
 * page entière était remplacée par « Chargement… » centré.
 */
export const SkeletonPage: React.FC<SkeletonPageProps> = ({
  cards = 4,
  stats = true,
  label = 'Chargement de la page…',
}) => (
  <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
    <LoadingAnnounce label={label} />

    {/* En-tête : titre + sous-titre à gauche, actions à droite */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <Skeleton width="220px" height="1.4rem" />
        <Skeleton className="skeleton-line" width="150px" />
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <Skeleton width="180px" height="36px" radius="10px" />
        <Skeleton width="36px" height="36px" radius="10px" />
      </div>
    </div>

    {stats && (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={96} radius="14px" style={{ width: '100%' }} />
        ))}
      </div>
    )}

    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {Array.from({ length: cards }).map((_, i) => (
        <Skeleton key={i} height={110} radius="14px" style={{ width: '100%' }} />
      ))}
    </div>
  </div>
);

export default Skeleton;
