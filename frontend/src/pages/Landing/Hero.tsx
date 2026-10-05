import type { CSSProperties } from 'react';
import { Capture } from './Capture';
import { WhatsAppLink } from './WhatsApp';

// Ordre d'entrée du héros (.vt-rise dans site.css) : surtitre, titre, texte, boutons.
const step = (index: number) => ({ '--i': index }) as CSSProperties;

export const Hero = ({ onRegister }: { onRegister: () => void }) => (
  <section className="vt-hero" id="top">
    <div className="vt-wrap vt-hero-grid">
      <div className="vt-hero-copy">
        <p className="vt-hero-eyebrow vt-rise" style={step(0)}>Logiciel de gestion de clinique</p>
        <h1 className="vt-rise" style={step(1)}>Toute votre clinique, de l'accueil à la caisse.</h1>
        <p className="vt-lead vt-rise" style={step(2)}>
          Dossiers patients, rendez-vous, ordonnances, pharmacie, laboratoire et encaissements, pensés pour les cliniques de Côte d'Ivoire.
        </p>
        <div className="vt-hero-ctas vt-rise" style={step(3)}>
          <button type="button" className="vt-btn vt-btn-primary" onClick={onRegister}>Essayer gratuitement</button>
          <WhatsAppLink className="vt-btn vt-btn-ghost" />
        </div>
      </div>
      {/* La capture n'a pas d'animation d'entrée : c'est l'image LCP. */}
      <figure className="vt-shot vt-hero-shot">
        <div className="vt-shot-bar" aria-hidden="true"><span>mediclinicpro.com</span></div>
        <Capture
          name="dashboard"
          alt="Tableau de bord MediClinic : rendez-vous du jour, recettes et alertes de stock"
          sizes="(max-width: 1080px) 92vw, 900px"
          phoneSizes="86vw"
          priority
        />
      </figure>
    </div>
  </section>
);
