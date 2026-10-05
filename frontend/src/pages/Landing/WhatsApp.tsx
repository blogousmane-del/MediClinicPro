import { whatsappUrl } from '../../config/site';

// Logo officiel (public/brand/whatsapp.svg) appliqué en masque CSS : sa
// couleur suit celle du bouton qui le porte.
export const WhatsAppIcon = () => <span className="vt-wa" aria-hidden="true" />;

interface WhatsAppLinkProps {
  className?: string;
  label?: string;
  message?: string;
  onClick?: () => void;
}

// Tous les liens WhatsApp ouvrent wa.me dans un nouvel onglet, message prérempli.
export const WhatsAppLink = ({ className, label = 'Écrire sur WhatsApp', message, onClick }: WhatsAppLinkProps) => (
  <a className={className} href={whatsappUrl(message)} target="_blank" rel="noopener noreferrer" onClick={onClick}>
    <WhatsAppIcon />
    {label}
  </a>
);
