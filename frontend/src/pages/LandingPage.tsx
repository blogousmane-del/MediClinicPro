import React, { useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';
import { AppPreview } from '../components/AppPreview';
import { buildPlanFeatureRows } from '../utils/planFeatures';
import {
  ShieldCheck,
  Calendar,
  Users,
  FlaskConical,
  Pill,
  Receipt,
  BarChart3,
  ChevronRight,
  ArrowRight,
  Check,
  Menu,
  X,
  LayoutDashboard,
  FileText,
  Star,
  Zap,
  Clock,
  MonitorSmartphone
} from 'lucide-react';

const marqueeModules = [
  { icon: LayoutDashboard, label: 'Tableau de bord' },
  { icon: Users, label: 'Patients' },
  { icon: Calendar, label: 'Rendez-vous' },
  { icon: FileText, label: 'Ordonnances' },
  { icon: FlaskConical, label: 'Laboratoire' },
  { icon: Pill, label: 'Pharmacie' },
  { icon: Receipt, label: 'Comptabilité' }
];

const featurePills = [
  { icon: Calendar, label: 'Rendez-vous' },
  { icon: Users, label: 'Dossiers patients' },
  { icon: FlaskConical, label: 'Résultats labo' },
  { icon: Pill, label: 'Pharmacie' },
  { icon: Receipt, label: 'Facturation' },
  // « Rapports BI » annonçait un module de reporting qui n'existe pas côté
  // clinique : la seule page chiffrée est Comptabilité (Sidebar.tsx). Les
  // rapports d'analyse sont réservés à la console de l'exploitant.
  { icon: BarChart3, label: 'Recettes & dépenses' }
];

// Repli hors ligne du catalogue. Les vrais chiffres sont chargés au montage
// depuis GET /settings/public/plans, qui lit backend/utils/plans.js — seule
// source de vérité des prix. Ces valeurs ne servent que si l'API est
// injoignable : une page vitrine doit s'afficher même backend éteint, mais
// elle ne doit jamais être la référence. Seuls badge/ctaLabel/note/highlight
// sont réellement définis ici, ils n'existent pas côté backend.
const pricingPlans: {
  id: 'starter' | 'clinique' | 'hopital';
  name: string;
  price: number;
  period: string;
  staffLimit: number | null;
  allowedRoles: string[] | null;
  paymentMethods: string[];
  badge: string;
  highlight: boolean;
  ctaLabel: string;
  note: string;
}[] = [
  {
    id: 'starter', name: 'Starter', price: 0, period: '7 jours', staffLimit: 3,
    allowedRoles: ['admin', 'doctor', 'secretary'], paymentMethods: ['cash'],
    badge: 'Gratuit', highlight: false, ctaLabel: "Démarrer l'essai gratuit", note: 'Aucune carte bancaire requise'
  },
  {
    id: 'clinique', name: 'Clinique', price: 9000, period: '/ mois', staffLimit: 5,
    allowedRoles: null, paymentMethods: ['cash'],
    badge: 'Populaire', highlight: false, ctaLabel: 'Choisir Clinique', note: 'Renouvellement mensuel automatique'
  },
  {
    id: 'hopital', name: 'Hôpital', price: 14500, period: '/ mois', staffLimit: null,
    allowedRoles: null, paymentMethods: ['cash', 'wave', 'orange_money', 'mtn_momo'],
    badge: 'Tout inclus', highlight: true, ctaLabel: 'Choisir Hôpital', note: 'Idéal pour les cliniques multi-praticiens'
  }
];

// Same comparison shape as SettingsPage.tsx's billing tab — derived from real
// plan data (staffLimit/allowedRoles), not copy-pasted marketing strings, so
// les lignes ne peuvent pas diverger de ce qui est réellement appliqué.
// La ligne « Encaissements Mobile Money » a été retirée : elle annonçait un
// encaissement patient en ligne que le passage à Chariow supprime.
// Les lignes affichées ne gardent que ce qui DIFFÈRE d'un plan à l'autre.
// Quatre des cinq lignes précédentes étaient identiques sur les trois cartes :
// la grille occupait de la place sans aider personne à choisir. Ce qui est
// commun aux trois plans est écrit une seule fois, sous la grille.

interface LandingPageProps {
  onNavigate: (tab: 'login' | 'register' | 'terms') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Catalogue réel (prix, limites) chargé depuis le backend. Un échec est
  // silencieux et sans conséquence visible : on garde le repli ci-dessus
  // plutôt que d'afficher une page tarifs vide ou un message d'erreur à un
  // visiteur qui découvre le produit.
  const [catalog, setCatalog] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/settings/public/plans')
      .then(data => { if (!cancelled) setCatalog(data.plans || null); })
      .catch(() => { /* repli sur les valeurs statiques */ });
    return () => { cancelled = true; };
  }, []);

  const effectivePlans = pricingPlans.map(plan => {
    const live = catalog?.[plan.id];
    if (!live) return plan;
    return {
      ...plan,
      price: typeof live.price === 'number' ? live.price : plan.price,
      staffLimit: live.staffLimit === null || typeof live.staffLimit === 'number' ? live.staffLimit : plan.staffLimit,
      allowedRoles: live.allowedRoles === null || Array.isArray(live.allowedRoles) ? live.allowedRoles : plan.allowedRoles,
      paymentMethods: Array.isArray(live.paymentMethods) ? live.paymentMethods : plan.paymentMethods
    };
  });

  // Prix affiché dans la bannière « Un seul abonnement » du hero : celui du
  // plan le plus complet, jamais une constante recopiée.
  const fullAccessPrice = effectivePlans.find(p => p.id === 'hopital')?.price ?? 14500;

  // Scroll-reveal: fade/slide sections into view once as they enter the viewport
  useEffect(() => {
    const els = rootRef.current?.querySelectorAll<HTMLElement>('.landing-reveal');
    if (!els || els.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="landing-page" style={{
      fontFamily: 'var(--font-primary, sans-serif)',
      backgroundColor: 'var(--lp-bg-alt)',
      color: 'var(--lp-fg)',
      minHeight: '100vh',
      width: '100%',
      boxSizing: 'border-box',
      overflowX: 'hidden'
    }}>

      {/* 1. Header Navigation Bar */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--lp-border)',
        padding: '0.85rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Logo */}
        <div className="landing-logo-mark" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <img src="/logo-horizontal.svg" alt="MediClinic" style={{ height: '32px', width: 'auto', display: 'block' }} />
        </div>

        {/* Desktop Nav Links */}
        <nav className="landing-nav-desktop" style={{ fontSize: '0.925rem', fontWeight: 600 }}>
          <a href="#features" className="landing-link" style={{ color: 'var(--lp-fg)', textDecoration: 'none' }}>Fonctionnalités</a>
          <a href="#pricing" className="landing-link" style={{ color: 'var(--lp-fg)', textDecoration: 'none' }}>Tarifs</a>
        </nav>

        {/* Desktop Right Action Buttons */}
        <div className="landing-nav-actions-desktop">
          <button
            onClick={() => onNavigate('login')}
            className="landing-btn-lift landing-nav-link-btn"
          >
            Connexion
          </button>

          <button
            onClick={() => onNavigate('register')}
            className="landing-btn-lift landing-cta landing-cta-sm"
            style={{ width: 'auto' }}
          >
            Essai gratuit
          </button>
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <div className="landing-mobile-toggle">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              background: 'none',
              border: '1px solid var(--lp-border-strong)',
              borderRadius: '8px',
              padding: '6px',
              color: 'var(--lp-fg)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="Menu Mobile"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div style={{
          position: 'fixed',
          top: '60px',
          left: 0,
          right: 0,
          backgroundColor: 'var(--lp-bg)',
          borderBottom: '1px solid var(--lp-border)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          zIndex: 99,
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
        }}>
          <a href="#features" onClick={() => setMobileMenuOpen(false)} style={{ color: 'var(--lp-fg)', textDecoration: 'none', fontWeight: 600, fontSize: '1rem' }}>Fonctionnalités</a>
          <a href="#pricing" onClick={() => setMobileMenuOpen(false)} style={{ color: 'var(--lp-fg)', textDecoration: 'none', fontWeight: 600, fontSize: '1rem' }}>Tarifs</a>
          <div style={{ height: '1px', backgroundColor: 'var(--lp-border)', margin: '0.5rem 0' }} />
          <button
            onClick={() => { setMobileMenuOpen(false); onNavigate('login'); }}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: 'var(--lp-bg-alt)',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 700,
              color: 'var(--lp-fg)',
              fontSize: '0.95rem'
            }}
          >
            Connexion
          </button>
          <button
            onClick={() => { setMobileMenuOpen(false); onNavigate('register'); }}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: 'var(--lp-brand)',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 700,
              color: 'var(--lp-bg)',
              fontSize: '0.95rem'
            }}
          >
            Essai gratuit
          </button>
        </div>
      )}

      {/* 2. Hero Section with Handsome African Doctor Image */}
      <section style={{
        backgroundColor: 'var(--lp-bg)',
        padding: '3.5rem 1.5rem 4.5rem',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div className="landing-hero-grid" style={{
          maxWidth: '1200px',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)',
          gap: '3.5rem',
          alignItems: 'center'
        }}>
          {/* Left Hero Column */}
          <div className="landing-entrance">
            {/* Pill Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--lp-brand-soft)',
              border: '1px solid var(--lp-brand-line)',
              padding: '6px 16px',
              borderRadius: '9999px',
              color: 'var(--lp-brand)',
              fontSize: '0.85rem',
              fontWeight: 700,
              marginBottom: '1.25rem'
            }}>
              <ShieldCheck size={16} />
              <span>Solution fiable pour votre clinique</span>
            </div>

            {/* Title. Taille fluide et aucun <br /> manuel : le titre était
                figé à 3,25rem avec trois césures écrites à la main, qui
                cassaient dès qu'on changeait la largeur ou la taille de police
                du navigateur. */}
            <h1 className="landing-hero-title" style={{
              fontSize: 'clamp(2.25rem, 5vw, 3.25rem)',
              fontWeight: 800,
              lineHeight: 1.12,
              color: 'var(--lp-fg)',
              fontFamily: 'var(--font-secondary)',
              margin: '0 0 1.25rem 0',
              letterSpacing: '-0.02em',
              textWrap: 'balance',
              maxWidth: '22ch'
            }}>
              Une plateforme, une meilleure <span style={{ color: 'var(--lp-brand-ink)' }}>prise en charge</span>
            </h1>

            {/* Description */}
            <p style={{
              fontSize: '1.05rem',
              color: 'var(--lp-fg)',
              lineHeight: 1.6,
              maxWidth: '500px',
              margin: '0 0 2rem 0'
            }}>
              Dossiers patients, rendez-vous, ordonnances, pharmacie, laboratoire et caisse dans un seul outil, conçu pour les cliniques d'Abidjan et de toute la Côte d'Ivoire.
            </p>

            {/* CTA Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
              <button
                onClick={() => onNavigate('register')}
                className="landing-btn-lift landing-cta"
              >
                <span>Commencer l'essai gratuit</span>
              </button>

              <a
                href="#features"
                className="landing-btn-lift landing-cta-ghost"
              >
                <span>En savoir plus</span>
                <ChevronRight size={18} color="var(--lp-muted)" />
              </a>
            </div>

            {/* La ligne de réassurance « Essai gratuit de 7 jours, sans carte
                bancaire » vivait ici, en cinquième bloc de texte du héros. Elle
                est reprise telle quelle dans le bandeau de faits juste en
                dessous : le héros porte un message, pas une liste. */}
          </div>

          {/* Right Hero Handsome African Doctor Image Card */}
          <div className="landing-reveal landing-reveal-right" style={{ position: 'relative', width: '100%' }}>
            <div className="landing-img-zoom" style={{
              borderRadius: '28px',
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.08)',
              backgroundColor: 'var(--lp-border)',
              maxHeight: '520px',
              width: '100%'
            }}>
              {/* 606 Ko de PNG pour l'image la plus grande de la page, sur une
                  vitrine consultée en connexion mobile ivoirienne. En AVIF :
                  16 Ko. Le PNG reste en dernier repli et comme image de
                  partage. width/height portent le ratio réel de la source
                  (1024x1024) pour réserver la place et éviter le décalage au
                  chargement ; fetchPriority la hisse devant le reste. Les
                  variantes sont produites par npm run images. */}
              <picture>
                <source
                  type="image/avif"
                  srcSet="/optimized/doctor_hero-560.avif 560w, /optimized/doctor_hero-1120.avif 1120w"
                  sizes="(min-width: 992px) 45vw, 100vw"
                />
                <source
                  type="image/webp"
                  srcSet="/optimized/doctor_hero-560.webp 560w, /optimized/doctor_hero-1120.webp 1120w"
                  sizes="(min-width: 992px) 45vw, 100vw"
                />
                <img
                  src="/doctor_hero.png"
                  alt="Médecin utilisant MediClinic pour gérer sa clinique en Côte d'Ivoire"
                  width={1024}
                  height={1024}
                  fetchPriority="high"
                  decoding="async"
                  style={{
                    width: '100%',
                    height: '100%',
                    minHeight: '380px',
                    objectFit: 'cover',
                    objectPosition: 'top',
                    display: 'block'
                  }}
                />
              </picture>
            </div>

            {/* Le prix : une information réelle, qui était posée EN INCRUSTATION
                sur la photo. Elle est maintenant sous l'image, où elle se lit
                sans concurrencer le visage du médecin et sans dépendre de ce
                que la photo montre à cet endroit. */}
            <div style={{
              marginTop: '14px',
              backgroundColor: 'var(--lp-brand)',
              borderRadius: '16px',
              padding: '0.9rem 1.15rem',
              color: 'var(--lp-bg)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <ShieldCheck size={20} color="var(--lp-dark-accent)" />
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--lp-dark-accent)', fontWeight: 700, display: 'block' }}>
                  Un seul abonnement
                </span>
                <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--lp-bg-alt)', marginTop: '2px', display: 'block', lineHeight: 1.3 }}>
                  Accès complet à tous les modules, {fullAccessPrice.toLocaleString('fr-FR')} FCFA / mois
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2b + 3. Une seule section à la place de deux bandeaux génériques :
             le carrousel infini répétait les sept mots de la barre latérale
             sans rien apprendre, et la bande de quatre colonnes icône-libellé
             est le motif le plus recopié du web. Ici, les modules réels d'un
             côté, les faits vérifiables de l'autre. */}
      <section className="landing-facts">
        <div className="landing-facts-inner landing-reveal">
          <div>
            <h2 className="landing-facts-title">
              Sept modules, un seul dossier patient
            </h2>
            <p className="landing-facts-lead">
              Ce que votre secrétariat saisit à l'accueil, le médecin, la pharmacie et la caisse le retrouvent sans le ressaisir.
            </p>
            <ul className="landing-module-list">
              {marqueeModules.map(mod => {
                const Icon = mod.icon;
                return (
                  <li key={mod.label}>
                    <Icon size={15} aria-hidden="true" />
                    {mod.label}
                  </li>
                );
              })}
            </ul>
          </div>

          <ul className="landing-fact-list">
            {[
              { icon: ShieldCheck, text: 'Données isolées par clinique' },
              { icon: Clock, text: 'Essai 7 jours, sans carte bancaire' },
              { icon: Receipt, text: 'Tarifs en FCFA, sans conversion' },
              { icon: Users, text: 'Interface et assistance en français' }
            ].map(fact => {
              const Icon = fact.icon;
              return (
                <li key={fact.text}>
                  <Icon size={18} aria-hidden="true" />
                  <span>{fact.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* 4. Feature Showcase Section */}
      <section id="features" style={{
        backgroundColor: 'var(--lp-bg)',
        padding: '4.5rem 1.5rem',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div className="landing-showcase-grid" style={{
          maxWidth: '1200px',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)',
          gap: '3.5rem',
          alignItems: 'center'
        }}>
          {/* Left Laboratory Image */}
          <div className="landing-reveal landing-reveal-left landing-img-zoom" style={{
            borderRadius: '28px',
            overflow: 'hidden',
            boxShadow: '0 16px 36px rgba(0,0,0,0.06)',
            height: '380px',
            backgroundColor: 'var(--lp-border)'
          }}>
            {/* Sous la ligne de flottaison : chargement différé, contrairement
                à la photo du héros. */}
            <picture>
              <source
                type="image/avif"
                srcSet="/optimized/lab_showcase-570.avif 570w, /optimized/lab_showcase-1140.avif 1140w"
                sizes="(min-width: 992px) 45vw, 100vw"
              />
              <source
                type="image/webp"
                srcSet="/optimized/lab_showcase-570.webp 570w, /optimized/lab_showcase-1140.webp 1140w"
                sizes="(min-width: 992px) 45vw, 100vw"
              />
              <img
                src="/lab_showcase.png"
                alt="Paillasse de laboratoire d'analyses médicales"
                width={649}
                height={531}
                loading="lazy"
                decoding="async"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </picture>
          </div>

          {/* Right Showcase Content */}
          <div className="landing-reveal landing-reveal-right">
            <h2 style={{
              fontSize: '2.25rem',
              fontWeight: 800,
              color: 'var(--lp-fg)',
              fontFamily: 'var(--font-secondary)',
              margin: '0 0 1rem 0',
              lineHeight: 1.2
            }}>
              Un système pour tout votre <span style={{ color: 'var(--lp-brand-ink)' }}>flux de soins</span>
            </h2>

            <p style={{
              fontSize: '1rem',
              color: 'var(--lp-muted)',
              lineHeight: 1.6,
              margin: '0 0 2rem 0'
            }}>
              Le planning des praticiens, le stock de la pharmacie, les résultats du laboratoire et les encaissements du jour partagent le même dossier patient.
            </p>

            {/* Feature Pills */}
            <div className="landing-feature-pills" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              {featurePills.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} className="landing-pill-hover" style={{ backgroundColor: 'var(--lp-bg-alt)', border: '1px solid var(--lp-border)', borderRadius: '12px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--lp-fg)' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: 'var(--lp-brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={15} color="var(--lp-brand)" />
                    </div>
                    <span>{f.label}</span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => onNavigate('register')}
              className="landing-btn-lift landing-cta"
            >
              {/* Le libellé décrit l'action réelle : ce bouton ouvre le
                  formulaire d'inscription, il n'ouvre aucune page de
                  fonctionnalités. */}
              <span>Commencer l'essai gratuit</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* 5. Aperçu de l'interface — maquette statique, aucun appel API.
             Reproduction de l'écran Banani « Nouveau Rendez-vous ». La vraie
             page vit dans pages/Appointments/NewAppointmentPage.tsx et n'est
             pas touchée ici. */}
      <section id="apercu" style={{
        backgroundColor: 'var(--lp-bg-alt)',
        borderTop: '1px solid var(--lp-border)',
        padding: '4.5rem 1.5rem',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div style={{ maxWidth: '1200px', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '10px' }}>
              <MonitorSmartphone size={14} color="var(--lp-brand)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--lp-brand)' }}>
                Aperçu
              </span>
            </div>
            {/* overflowWrap : à 200 % de taille de police navigateur, ce titre
                passe à 72px et « l'interface » (360px) dépasse les 279px
                disponibles à 375px. Sans césure il était rogné par
                l'overflowX:hidden de la racine, donc invisible et sans barre
                de défilement pour le récupérer. */}
            <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--lp-fg)', fontFamily: 'var(--font-secondary)', margin: '0 0 1rem', overflowWrap: 'break-word' }}>
              Voyez l'interface avant de vous inscrire
            </h2>
            <p style={{ color: 'var(--lp-muted)', maxWidth: '620px', margin: '0 auto 1.25rem', fontSize: '1rem' }}>
              La prise de rendez-vous telle qu'elle se présente à votre secrétariat : recherche du patient, médecin, créneau, motif et priorité sur un seul écran.
            </p>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '5px 14px',
              borderRadius: '9999px',
              backgroundColor: 'var(--lp-warn-bg)',
              border: '1px solid #ffedd5',
              color: 'var(--lp-warn-fg)',
              fontSize: '0.78rem',
              fontWeight: 700
            }}>
              Données d'exemple — patients et médecins fictifs
            </span>
          </div>

          {/* Maquette inerte : aria-hidden + pointer-events:none, et aucun
              élément focusable à l'intérieur (que des div/span). */}
          <AppPreview />
        </div>
      </section>

      {/* 6. Pricing Section */}
      <section id="pricing" style={{
        backgroundColor: 'var(--lp-bg)',
        padding: '4.5rem 1.5rem',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div style={{ maxWidth: '1200px', width: '100%', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '10px' }}>
            <Star size={14} color="var(--lp-brand)" fill="var(--lp-brand)" />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--lp-brand)' }}>
              Nos formules
            </span>
          </div>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--lp-fg)', fontFamily: 'var(--font-secondary)', margin: '0 0 1rem' }}>
            Choisissez votre plan
          </h2>
          <p style={{ color: 'var(--lp-muted)', maxWidth: '600px', margin: '0 auto 3rem', fontSize: '1rem' }}>
            Commencez gratuitement, évoluez selon vos besoins. Sans engagement.
          </p>

          <div className="pricing-cards-grid" style={{ maxWidth: '960px', margin: '0 auto' }}>
            {effectivePlans.map(plan => {
              const featureRows = buildPlanFeatureRows({
                price: plan.price,
                staffLimit: plan.staffLimit,
                allowedRoles: plan.allowedRoles,
                trialLabel: plan.period
              });
              return (
                <div
                  key={plan.id}
                  className={`landing-reveal landing-card-lift landing-plan${plan.highlight ? ' landing-plan-on' : ''}`}
                >
                  <div className="landing-plan-head">
                    <span className="landing-plan-badge">{plan.badge}</span>
                    {plan.highlight && <Zap size={14} />}
                  </div>

                  <div>
                    <p className="landing-plan-name">{plan.name}</p>
                    <div className="landing-plan-price">
                      <span className="landing-plan-amount">
                        {plan.price === 0 ? '0' : plan.price.toLocaleString('fr-FR')}
                      </span>
                      <span className="landing-plan-unit">
                        <span>FCFA</span>
                        <span>{plan.period}</span>
                      </span>
                    </div>
                  </div>

                  <ul className="landing-plan-rows">
                    {featureRows.map((row, i) => (
                      <li key={i}>
                        <span className="landing-plan-check"><Check size={10} /></span>
                        <span>{row.label}</span>
                      </li>
                    ))}
                  </ul>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      onClick={() => onNavigate('register')}
                      className={`landing-btn-lift landing-cta-sm ${plan.highlight ? 'landing-cta' : 'landing-cta-ghost'}`}
                    >
                      {plan.ctaLabel}
                    </button>
                    <p style={{ fontSize: '0.72rem', color: 'var(--lp-muted)', textAlign: 'center', margin: 0 }}>{plan.note}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comparison note bar — softened vs. Banani's copy: dropped the "support
              email" claim (no support channel exists), same reasoning applied to
              this same screen's SettingsPage.tsx implementation. */}
          {/* Ce qui est commun aux trois plans, écrit une seule fois : les
              cartes ne gardent que ce qui les distingue. Le « nowrap » d'origine
              tenait parce que la phrase était courte ; elle ne l'est plus. */}
          <div className="landing-reveal landing-plans-note">
            <p>
              Les trois plans incluent <strong>tous les modules</strong> : patients illimités, rendez-vous,
              ordonnances, pharmacie, laboratoire, comptabilité et paiement en espèces. Utilisation sur
              ordinateur comme sur mobile, mises à jour comprises, changement de plan à tout moment.
            </p>
          </div>

          {/* Payment Providers Row — moyens de paiement de L'ABONNEMENT (ce que
              la clinique nous règle), pas de ce qu'elle encaisse auprès de ses
              patients. N'annoncer ici que des opérateurs réellement activés sur
              la boutique Chariow de l'exploitant : cette liste est une promesse
              faite au visiteur, pas une décoration. */}
          <div className="landing-reveal" style={{ marginTop: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--lp-muted)' }}>Abonnement payable par Mobile Money ou carte bancaire :</span>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontWeight: 700, fontSize: '0.85rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              {/* Quatre familles de couleur pour quatre pastilles, dont un
                  violet qui était le seul du produit : la ligne attirait plus
                  l'œil que le prix juste au-dessus. Une seule pastille neutre,
                  les noms des opérateurs suffisent à les identifier. */}
              {['Orange Money', 'MTN MoMo', 'Wave', 'Carte bancaire'].map(method => (
                <span key={method} className="landing-payment-badge">{method}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6b. Closing CTA Band */}
      <section className="landing-reveal landing-closing">
        <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          {/* Le surtitre « COMMENCER » et le titre « Prêt à transformer votre
              clinique ? » ne disaient rien : le premier répétait le bouton, le
              second est la formule de clôture par défaut de toute page de
              vente. Ici, ce que le visiteur obtient concrètement en cliquant. */}
          <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2rem)', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-secondary)', margin: 0, lineHeight: 1.25, textWrap: 'balance' }}>
            Ouvrez votre clinique dans MediClinic en quelques minutes
          </h2>
          <p style={{ color: 'var(--lp-dark-fg)', fontSize: '1rem', margin: 0 }}>
            Créez votre compte, ajoutez votre équipe, saisissez votre premier patient. Sept jours pour juger, sans carte bancaire.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
            {/* Même intention que le CTA du héros, donc même libellé : la page
                proposait « Commencer l'essai gratuit », « Démarrer
                gratuitement » et « Essai gratuit » pour un seul et même clic. */}
            <button
              onClick={() => onNavigate('register')}
              className="landing-btn-lift landing-cta"
            >
              Commencer l'essai gratuit
            </button>

            <a
              href="#pricing"
              className="landing-btn-lift landing-cta-ghost"
            >
              <span>Voir les tarifs</span>
              <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      {/* 7. Dark Footer */}
      <footer style={{
        backgroundColor: 'var(--lp-fg)',
        color: 'var(--lp-footer-fg)',
        padding: '2.5rem 1.5rem',
        borderTop: '1px solid rgba(226, 232, 240, 0.12)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo-icon.svg" alt="MediClinic" width={32} height={32} style={{ display: 'block', flexShrink: 0 }} />
            <span style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--lp-bg)' }}>MediClinic</span>
          </div>

          <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.85rem' }}>
            <a href="#features" className="landing-footer-link" style={{ color: 'var(--lp-footer-fg)', textDecoration: 'none' }}>Fonctionnalités</a>
            <a href="#pricing" className="landing-footer-link" style={{ color: 'var(--lp-footer-fg)', textDecoration: 'none' }}>Tarifs</a>
            <button
              type="button"
              onClick={() => onNavigate('terms')}
              className="landing-footer-link"
              style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--lp-footer-fg)', cursor: 'pointer' }}
            >
              Conditions d'utilisation
            </button>
          </div>

          <span style={{ fontSize: '0.85rem' }}>
            © 2026 MediClinic. Développé pour les cliniques et cabinets en Côte d'Ivoire.
          </span>
        </div>
      </footer>

    </div>
  );
};
