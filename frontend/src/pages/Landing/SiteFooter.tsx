import { SITE, whatsappUrl } from '../../config/site';
import { SECTION_LINKS } from './sectionLinks';

interface SiteFooterProps {
  onLogin: () => void;
  onRegister: () => void;
  onTerms: () => void;
}

export const SiteFooter = ({ onLogin, onRegister, onTerms }: SiteFooterProps) => {
  const year = new Date().getFullYear();
  // La raison sociale et le RCCM ne s'affichent qu'une fois renseignés dans SITE.
  const legal = SITE.legal ? `${SITE.legal.name}. RCCM ${SITE.legal.rccm}.` : 'MediClinic.';
  return (
    <footer className="vt-footer">
      <div className="vt-wrap">
        <div className="vt-footer-grid">
          <div className="vt-footer-brand">
            <img src="/logo-horizontal.svg" alt="MediClinic" width={96} height={26} />
            <p>Logiciel de gestion de clinique pour la Côte d'Ivoire.</p>
          </div>
          <div>
            <h2 className="vt-footer-title">Produit</h2>
            <ul>{SECTION_LINKS.map((link) => <li key={link.href}><a href={link.href}>{link.label}</a></li>)}</ul>
          </div>
          <div>
            <h2 className="vt-footer-title">Compte</h2>
            <ul>
              <li><button type="button" onClick={onLogin}>Connexion</button></li>
              <li><button type="button" onClick={onRegister}>Essayer gratuitement</button></li>
            </ul>
          </div>
          <div>
            <h2 className="vt-footer-title">Contact</h2>
            <ul>
              <li><a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">WhatsApp&nbsp;: <span className="vt-nowrap">{SITE.whatsapp.display}</span></a></li>
              <li><button type="button" onClick={onTerms}>Conditions d'utilisation</button></li>
            </ul>
          </div>
        </div>
        <div className="vt-footer-legal">
          <span>© {year} {legal}</span>
          <span>Côte d'Ivoire</span>
        </div>
      </div>
    </footer>
  );
};
