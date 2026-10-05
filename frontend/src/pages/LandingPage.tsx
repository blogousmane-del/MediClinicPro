import { useEffect, useRef } from 'react';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '../styles/site.css';
import { trialDaysOf } from '../utils/publicPlans';
import { usePublicCatalog } from './Landing/usePublicCatalog';
import { SiteNav } from './Landing/SiteNav';
import { Hero } from './Landing/Hero';
import { FactsBand } from './Landing/FactsBand';
import { Journey } from './Landing/Journey';
import { DocumentsSection } from './Landing/DocumentsSection';
import { FieldPhotoBand } from './Landing/FieldPhotoBand';
import { LocalFit } from './Landing/LocalFit';
import { Pricing } from './Landing/Pricing';
import { Founder } from './Landing/Founder';
import { Faq } from './Landing/Faq';
import { FinalCta } from './Landing/FinalCta';
import { SiteFooter } from './Landing/SiteFooter';

interface LandingPageProps {
  onNavigate: (tab: 'login' | 'register' | 'terms') => void;
}

// Vitrine publique : un assemblage de sections (pages/Landing/, une par
// fichier) sur le système visuel de styles/site.css. Conception et textes :
// docs/superpowers/specs/2026-10-05-vitrine-refonte-design.md.
export const LandingPage = ({ onNavigate }: LandingPageProps) => {
  const catalog = usePublicCatalog();
  const rootRef = useRef<HTMLDivElement>(null);
  const trialDays = trialDaysOf(catalog);
  const onLogin = () => onNavigate('login');
  const onRegister = () => onNavigate('register');

  // Apparition au défilement, une fois par bloc. La classe vt-js n'est posée
  // qu'ici : sans JavaScript, ou sans IntersectionObserver, tout reste visible.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !('IntersectionObserver' in window)) return;
    root.classList.add('vt-js');
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12 });
    root.querySelectorAll('.vt-reveal').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="site">
      <a className="vt-skip" href="#contenu">Aller au contenu</a>
      <SiteNav onLogin={onLogin} onRegister={onRegister} />
      <main id="contenu" tabIndex={-1}>
        <Hero onRegister={onRegister} />
        <FactsBand trialDays={trialDays} />
        <Journey />
        <DocumentsSection />
        <FieldPhotoBand />
        <LocalFit cliniquePrice={catalog.clinique.price} />
        <Pricing catalog={catalog} onRegister={onRegister} />
        <Founder />
        <Faq catalog={catalog} />
        <FinalCta trialDays={trialDays} onRegister={onRegister} />
      </main>
      <SiteFooter onLogin={onLogin} onRegister={onRegister} onTerms={() => onNavigate('terms')} />
    </div>
  );
};
