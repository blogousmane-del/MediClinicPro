import React, { useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';
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
  Zap
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
  { icon: BarChart3, label: 'Rapports BI' }
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
const buildPricingFeatureRows = (plan: (typeof pricingPlans)[number]): { label: string; ok: boolean }[] => {
  const staffLabel = plan.staffLimit === null
    ? 'Utilisateurs & rôles illimités'
    : `${plan.staffLimit} utilisateurs${plan.allowedRoles ? ' & rôles restreints' : ' & rôles illimités'}`;
  return [
    { label: staffLabel, ok: true },
    { label: 'Patients & Dossiers illimités', ok: true },
    { label: 'Rendez-vous, Ordonnances & Pharmacie', ok: true },
    { label: 'Laboratoire & Comptabilité', ok: true },
    { label: 'Paiement Espèces', ok: true }
  ];
};

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
    <div ref={rootRef} style={{
      fontFamily: 'var(--font-primary, sans-serif)',
      backgroundColor: '#f8fafc',
      color: '#0f172a',
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
        borderBottom: '1px solid #e2e8f0',
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
          <a href="#features" className="landing-link" style={{ color: '#475569', textDecoration: 'none' }}>Fonctionnalités</a>
          <a href="#pricing" className="landing-link" style={{ color: '#475569', textDecoration: 'none' }}>Tarifs</a>
        </nav>

        {/* Desktop Right Action Buttons */}
        <div className="landing-nav-actions-desktop">
          <button
            onClick={() => onNavigate('login')}
            className="landing-btn-lift"
            style={{
              background: 'none',
              border: 'none',
              color: '#0f172a',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              padding: '8px 16px'
            }}
          >
            Connexion
          </button>

          <button
            onClick={() => onNavigate('register')}
            className="landing-btn-lift"
            style={{
              backgroundColor: '#1e4d40',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 20px',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(30, 77, 64, 0.2)',
              transition: 'all 0.2s ease'
            }}
          >
            Prendre un rendez-vous
          </button>
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <div className="landing-mobile-toggle">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              background: 'none',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '6px',
              color: '#0f172a',
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
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          zIndex: 99,
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
        }}>
          <a href="#features" onClick={() => setMobileMenuOpen(false)} style={{ color: '#0f172a', textDecoration: 'none', fontWeight: 600, fontSize: '1rem' }}>Fonctionnalités</a>
          <a href="#pricing" onClick={() => setMobileMenuOpen(false)} style={{ color: '#0f172a', textDecoration: 'none', fontWeight: 600, fontSize: '1rem' }}>Tarifs</a>
          <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '0.5rem 0' }} />
          <button
            onClick={() => { setMobileMenuOpen(false); onNavigate('login'); }}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#f1f5f9',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 700,
              color: '#0f172a',
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
              backgroundColor: '#1e4d40',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 700,
              color: '#ffffff',
              fontSize: '0.95rem'
            }}
          >
            Prendre un rendez-vous
          </button>
        </div>
      )}

      {/* 2. Hero Section with Handsome African Doctor Image */}
      <section style={{
        backgroundColor: '#ffffff',
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
              backgroundColor: '#e6f4ea',
              border: '1px solid #bbf7d0',
              padding: '6px 16px',
              borderRadius: '9999px',
              color: '#1e4d40',
              fontSize: '0.85rem',
              fontWeight: 700,
              marginBottom: '1.25rem'
            }}>
              <ShieldCheck size={16} />
              <span>Solution fiable pour votre clinique</span>
            </div>

            {/* Title */}
            <h1 className="landing-hero-title" style={{
              fontSize: '3.25rem',
              fontWeight: 800,
              lineHeight: 1.15,
              color: '#0f172a',
              fontFamily: 'var(--font-secondary)',
              margin: '0 0 1.25rem 0',
              letterSpacing: '-1px'
            }}>
              Une plateforme,<br />
              une meilleure prise<br />
              <span style={{ color: '#0d9488' }}>en charge</span>
            </h1>

            {/* Description */}
            <p style={{
              fontSize: '1.05rem',
              color: '#475569',
              lineHeight: 1.6,
              maxWidth: '500px',
              margin: '0 0 2rem 0'
            }}>
              Du soin quotidien aux insights de santé avancés, notre plateforme est conçue pour les cliniques d'Abidjan et de toute la Côte d'Ivoire.
            </p>

            {/* CTA Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
              <button
                onClick={() => onNavigate('register')}
                className="landing-btn-lift"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#1e4d40',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px 28px',
                  fontWeight: 700,
                  fontSize: '0.975rem',
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(30, 77, 64, 0.25)'
                }}
              >
                <span>Commencer l'essai gratuit</span>
              </button>

              <a
                href="#features"
                className="landing-btn-lift"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  padding: '14px 24px',
                  fontWeight: 700,
                  fontSize: '0.975rem',
                  textDecoration: 'none'
                }}
              >
                <span>En savoir plus</span>
                <ChevronRight size={18} color="#64748b" />
              </a>
            </div>

            {/* Trust line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldCheck size={18} color="#0d9488" />
              <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#64748b', maxWidth: '320px' }}>
                Essai gratuit de 7 jours, sans engagement, sans carte bancaire
              </span>
            </div>
          </div>

          {/* Right Hero Handsome African Doctor Image Card */}
          <div className="landing-reveal landing-reveal-right" style={{ position: 'relative', width: '100%' }}>
            <div className="landing-img-zoom" style={{
              borderRadius: '28px',
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.08)',
              backgroundColor: '#e2e8f0',
              maxHeight: '520px',
              width: '100%'
            }}>
              <img
                src="/doctor_hero.png"
                alt="Médecin utilisant MediClinic pour gérer sa clinique en Côte d'Ivoire"
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '380px',
                  objectFit: 'cover',
                  objectPosition: 'top',
                  display: 'block'
                }}
              />
            </div>

            {/* Overlay Badge: real subscription fact */}
            <div style={{
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              right: '16px',
              backgroundColor: 'rgba(30, 77, 64, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              padding: '0.9rem 1.15rem',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
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
                <ShieldCheck size={20} color="#5eead4" />
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#99f6e4', fontWeight: 700, display: 'block' }}>
                  Un seul abonnement
                </span>
                <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px', display: 'block', lineHeight: 1.3 }}>
                  Accès complet à tous les modules, {fullAccessPrice.toLocaleString('fr-FR')} FCFA / mois
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2b. Infinite Scrolling Module Marquee */}
      <section style={{
        backgroundColor: '#f8fafc',
        borderTop: '1px solid #e2e8f0',
        borderBottom: '1px solid #e2e8f0',
        padding: '1.75rem 0'
      }}>
        <div className="landing-marquee-wrapper">
          <div className="landing-marquee-track">
            {[...marqueeModules, ...marqueeModules].map((mod, i) => {
              const Icon = mod.icon;
              return (
                <div
                  key={i}
                  className="landing-marquee-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '0.9rem 1.4rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                    flexShrink: 0
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '9px',
                    backgroundColor: '#e6f4ea',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Icon size={17} color="#1e4d40" />
                  </div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                    {mod.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. Dark Stat Banner Bar */}
      <section style={{
        backgroundColor: '#162a26',
        color: '#ffffff',
        padding: '2.5rem 1.5rem'
      }}>
        <div className="landing-stats-grid landing-reveal" style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '2rem',
          textAlign: 'center'
        }}>
          <div className="landing-highlight">
            <ShieldCheck size={22} color="#5eead4" style={{ marginBottom: '6px' }} />
            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>Données isolées par clinique</div>
          </div>

          <div className="landing-highlight">
            <LayoutDashboard size={22} color="#5eead4" style={{ marginBottom: '6px' }} />
            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>Tous les modules inclus</div>
          </div>

          <div className="landing-highlight">
            <Receipt size={22} color="#5eead4" style={{ marginBottom: '6px' }} />
            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>Abonnement par Mobile Money ou carte</div>
          </div>

          <div className="landing-highlight">
            <Users size={22} color="#5eead4" style={{ marginBottom: '6px' }} />
            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>Support en français</div>
          </div>
        </div>
      </section>

      {/* 4. Feature Showcase Section */}
      <section id="features" style={{
        backgroundColor: '#ffffff',
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
            backgroundColor: '#e2e8f0'
          }}>
            <img
              src="/lab_showcase.png"
              alt="Laboratoire médical MediClinic"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          </div>

          {/* Right Showcase Content */}
          <div className="landing-reveal landing-reveal-right">
            <h2 style={{
              fontSize: '2.25rem',
              fontWeight: 800,
              color: '#0f172a',
              fontFamily: 'var(--font-secondary)',
              margin: '0 0 1rem 0',
              lineHeight: 1.2
            }}>
              Un système pour tout votre <span style={{ color: '#0d9488' }}>flux de soins</span>
            </h2>

            <p style={{
              fontSize: '1rem',
              color: '#64748b',
              lineHeight: 1.6,
              margin: '0 0 2rem 0'
            }}>
              Réduisez les attentes, automatisez les plannings, suivez les médicaments, réduisez les erreurs et envoyez des ordonnances en un instant.
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
                  <div key={i} className="landing-pill-hover" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#e6f4ea', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={15} color="#1e4d40" />
                    </div>
                    <span>{f.label}</span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => onNavigate('register')}
              className="landing-btn-lift"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#1e4d40',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 24px',
                fontWeight: 700,
                fontSize: '0.925rem',
                cursor: 'pointer'
              }}
            >
              <span>Toutes les fonctionnalités</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* 6. Pricing Section */}
      <section id="pricing" style={{
        backgroundColor: '#ffffff',
        padding: '4.5rem 1.5rem',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div style={{ maxWidth: '1200px', width: '100%', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '10px' }}>
            <Star size={14} color="#1e4d40" fill="#1e4d40" />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#1e4d40' }}>
              Nos formules
            </span>
          </div>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-secondary)', margin: '0 0 1rem' }}>
            Choisissez votre plan
          </h2>
          <p style={{ color: '#64748b', maxWidth: '600px', margin: '0 auto 3rem', fontSize: '1rem' }}>
            Commencez gratuitement, évoluez selon vos besoins. Sans engagement.
          </p>

          <div className="pricing-cards-grid" style={{ maxWidth: '960px', margin: '0 auto' }}>
            {effectivePlans.map(plan => {
              const featureRows = buildPricingFeatureRows(plan);
              return (
                <div
                  key={plan.id}
                  className="landing-reveal landing-card-lift"
                  style={{
                    position: 'relative',
                    backgroundColor: plan.highlight ? '#e6f4ea' : '#ffffff',
                    border: plan.highlight ? '2px solid #1e4d40' : '1px solid #e2e8f0',
                    borderRadius: '20px',
                    padding: '2rem 1.75rem',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.1rem',
                    boxShadow: plan.highlight ? '0 12px 32px rgba(30, 77, 64, 0.12)' : '0 2px 8px rgba(0,0,0,0.03)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: '6px',
                      backgroundColor: plan.highlight ? '#1e4d40' : '#f1f5f9',
                      color: plan.highlight ? '#ffffff' : '#1e4d40'
                    }}>
                      {plan.badge}
                    </span>
                    {plan.highlight && <Zap size={14} color="#1e4d40" />}
                  </div>

                  <div>
                    <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b', margin: '0 0 4px 0' }}>{plan.name}</p>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
                      <span style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                        {plan.price === 0 ? '0' : plan.price.toLocaleString()}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: '2px' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>FCFA</span>
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{plan.period}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #e2e8f0' }} />

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1 }}>
                    {featureRows.map((row, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                        <span style={{
                          width: '16px', height: '16px', borderRadius: '999px', flexShrink: 0, marginTop: '1px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: row.ok ? 'rgba(30, 77, 64, 0.12)' : '#f1f5f9'
                        }}>
                          {row.ok ? <Check size={10} color="#1e4d40" /> : <X size={10} color="#94a3b8" />}
                        </span>
                        <span style={{
                          fontSize: '0.82rem', lineHeight: 1.25,
                          color: row.ok ? '#334155' : '#94a3b8',
                          textDecoration: row.ok ? 'none' : 'line-through'
                        }}>
                          {row.label}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      onClick={() => onNavigate('register')}
                      className="landing-btn-lift"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        backgroundColor: plan.highlight ? '#1e4d40' : '#ffffff',
                        color: plan.highlight ? '#ffffff' : '#0f172a',
                        border: plan.highlight ? 'none' : '1px solid #e2e8f0',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        boxShadow: plan.highlight ? '0 4px 12px rgba(30, 77, 64, 0.25)' : 'none'
                      }}
                    >
                      {plan.ctaLabel}
                    </button>
                    <p style={{ fontSize: '0.72rem', color: '#64748b', textAlign: 'center', margin: 0 }}>{plan.note}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comparison note bar — softened vs. Banani's copy: dropped the "support
              email" claim (no support channel exists), same reasoning applied to
              this same screen's SettingsPage.tsx implementation. */}
          <div className="landing-reveal" style={{ display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '960px', margin: '2.5rem auto 0' }}>
            <div style={{ flex: 1, borderTop: '1px solid #e2e8f0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Tous les plans incluent : accès web & mobile, mises à jour incluses, changement de plan à tout moment
              </span>
            </div>
            <div style={{ flex: 1, borderTop: '1px solid #e2e8f0' }} />
          </div>

          {/* Payment Providers Row — moyens de paiement de L'ABONNEMENT (ce que
              la clinique nous règle), pas de ce qu'elle encaisse auprès de ses
              patients. N'annoncer ici que des opérateurs réellement activés sur
              la boutique Chariow de l'exploitant : cette liste est une promesse
              faite au visiteur, pas une décoration. */}
          <div className="landing-reveal" style={{ marginTop: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Abonnement payable par Mobile Money ou carte bancaire :</span>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontWeight: 700, fontSize: '0.85rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span className="landing-payment-badge" style={{ backgroundColor: '#fff7ed', color: '#ea580c', padding: '5px 12px', borderRadius: '20px', border: '1px solid #ffedd5' }}>Orange Money</span>
              <span className="landing-payment-badge" style={{ backgroundColor: '#fefce8', color: '#ca8a04', padding: '5px 12px', borderRadius: '20px', border: '1px solid #fef08a' }}>MTN MoMo</span>
              <span className="landing-payment-badge" style={{ backgroundColor: '#f0f9ff', color: '#0284c7', padding: '5px 12px', borderRadius: '20px', border: '1px solid #e0f2fe' }}>Wave</span>
              <span className="landing-payment-badge" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed', padding: '5px 12px', borderRadius: '20px', border: '1px solid #ede9fe' }}>Carte bancaire</span>
            </div>
          </div>
        </div>
      </section>

      {/* 6b. Closing CTA Band */}
      <section className="landing-reveal" style={{
        backgroundColor: '#162a26',
        padding: '4rem 1.5rem',
        display: 'flex',
        justifyContent: 'center',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#5eead4' }}>
            COMMENCER
          </span>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-secondary)', margin: 0, lineHeight: 1.25 }}>
            Prêt à transformer votre clinique ?
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '1rem', margin: 0 }}>
            Simplifiez la gestion quotidienne de votre clinique avec une plateforme pensée pour Abidjan et la Côte d'Ivoire.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
            <button
              onClick={() => onNavigate('register')}
              className="landing-btn-lift"
              style={{
                backgroundColor: '#1e4d40',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '14px 28px',
                fontWeight: 700,
                fontSize: '0.975rem',
                cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(30, 77, 64, 0.35)'
              }}
            >
              Démarrer gratuitement
            </button>

            <a
              href="#pricing"
              className="landing-btn-lift"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'transparent',
                color: '#ffffff',
                border: '1px solid #334155',
                borderRadius: '12px',
                padding: '14px 24px',
                fontWeight: 700,
                fontSize: '0.975rem',
                textDecoration: 'none'
              }}
            >
              <span>Voir les tarifs</span>
              <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      {/* 7. Dark Footer */}
      <footer style={{
        backgroundColor: '#0f172a',
        color: '#94a3b8',
        padding: '2.5rem 1.5rem',
        borderTop: '1px solid #1e293b'
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
            <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#ffffff' }}>MediClinic</span>
          </div>

          <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.85rem' }}>
            <a href="#features" className="landing-footer-link" style={{ color: '#94a3b8', textDecoration: 'none' }}>Fonctionnalités</a>
            <a href="#pricing" className="landing-footer-link" style={{ color: '#94a3b8', textDecoration: 'none' }}>Tarifs</a>
            <span onClick={() => onNavigate('terms')} className="landing-footer-link" style={{ color: '#94a3b8', cursor: 'pointer' }}>Conditions d'utilisation</span>
          </div>

          <span style={{ fontSize: '0.85rem' }}>
            © 2026 MediClinic. Développé pour les cliniques et cabinets en Côte d'Ivoire.
          </span>
        </div>
      </footer>

    </div>
  );
};
