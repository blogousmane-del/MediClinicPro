import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { WhatsAppLink } from './WhatsApp';
import { SECTION_LINKS } from './sectionLinks';

interface SiteNavProps {
  onLogin: () => void;
  onRegister: () => void;
}

export const SiteNav = ({ onLogin, onRegister }: SiteNavProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  // Échap ferme le menu du téléphone.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <header className="vt-nav">
      <div className="vt-wrap vt-nav-bar">
        <a className="vt-nav-logo" href="#top">
          <img src="/logo-horizontal.svg" alt="MediClinic" width={103} height={28} />
        </a>
        <nav className="vt-nav-links" aria-label="Sections">
          {SECTION_LINKS.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
        </nav>
        <div className="vt-nav-right">
          <button type="button" className="vt-nav-login" onClick={onLogin}>Connexion</button>
          <button type="button" className="vt-btn vt-btn-primary vt-btn-sm" onClick={onRegister}>Essayer gratuitement</button>
          <button
            type="button"
            className="vt-nav-burger"
            aria-expanded={menuOpen}
            aria-controls="vt-menu"
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} strokeWidth={1.75} aria-hidden="true" /> : <Menu size={20} strokeWidth={1.75} aria-hidden="true" />}
          </button>
        </div>
      </div>
      <div id="vt-menu" className="vt-menu" hidden={!menuOpen}>
        <nav className="vt-wrap" aria-label="Menu">
          {SECTION_LINKS.map((link) => <a key={link.href} href={link.href} onClick={closeMenu}>{link.label}</a>)}
          <button type="button" onClick={() => { closeMenu(); onLogin(); }}>Connexion</button>
          <WhatsAppLink onClick={closeMenu} />
        </nav>
      </div>
    </header>
  );
};
