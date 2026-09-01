import React from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Bouton d'action. Trois variantes, pas davantage.
 *
 * Les classes .btn / .btn-primary / .btn-secondary / .btn-outline existent
 * déjà dans index.css et portent la forme (pastille, transition, ombre) ;
 * ce composant leur donne une interface typée et impose la seule chose que le
 * CSS ne peut pas garantir : aucune couleur écrite dans l'appelant.
 */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  icon?: LucideIcon;
  /** L'icône passe à droite du libellé (flèche de progression, par exemple). */
  iconTrailing?: boolean;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary', icon: Icon, iconTrailing = false, fullWidth = false,
  children, className = '', style, ...rest
}) => (
  <button
    className={`btn btn-${variant} ${className}`.trim()}
    style={{ width: fullWidth ? '100%' : undefined, ...style }}
    {...rest}
  >
    {Icon && !iconTrailing && <Icon size={17} />}
    {children}
    {Icon && iconTrailing && <Icon size={17} />}
  </button>
);
