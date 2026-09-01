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
  Zap,
  Activity,
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock,
  MapPin,
  MonitorSmartphone,
  Search,
  Settings,
  Stethoscope,
  User,
  UserPlus
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

// ---------------------------------------------------------------------------
// Aperçu de l'interface — contenu de la maquette statique reproduisant l'écran
// Banani « Nouveau Rendez-vous » (new_screen11.jsx + NewAppointmentMobile.jsx).
// Plan : .planning/banani/landing-app-preview.md
//
// Ces noms viennent du mock Banani : ce sont des personnes INVENTÉES. Le bloc
// affiche un badge « Données d'exemple » visible, dans le flux du texte — sans
// lui, un visiteur lirait ces lignes comme de vrais dossiers patients.
// ---------------------------------------------------------------------------
const previewDoctors = [
  { name: 'Dr. Yao Bernard', specialty: 'Médecine générale' },
  { name: 'Dr. Soro Mariam', specialty: 'Pédiatrie' },
  { name: 'Dr. Coulibaly A.', specialty: 'Cardiologie' },
  { name: 'Dr. Koné Inès', specialty: 'Gynécologie' }
];

const previewRecentPatients = [
  { name: 'Brahima Ouattara', folder: 'P003' },
  { name: 'Fatou Diomandé', folder: 'P018' },
  { name: 'Raïssa Gnahore', folder: 'P031' }
];

const previewSlots = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '14:00', '14:30', '15:00', '15:30'
];
const PREVIEW_TAKEN_SLOTS = [0, 2, 5];
const PREVIEW_SELECTED_SLOT = 8;
const PREVIEW_SELECTED_DOCTOR = 2;

// Juillet 2025, semaines commençant le lundi — repris tel quel du mock.
const previewCalendarWeeks: (number | null)[][] = [
  [null, 1, 2, 3, 4, 5, 6],
  [7, 8, 9, 10, 11, 12, 13],
  [14, 15, 16, 17, 18, 19, 20],
  [21, 22, 23, 24, 25, 26, 27],
  [28, 29, 30, 31, null, null, null]
];
const PREVIEW_CAL_SELECTED = 14;
const PREVIEW_CAL_OFF = 9;

const previewPriorities = [
  { label: 'Normal', dot: '#3D6B5E' },
  { label: 'Urgent', dot: '#fb923c' },
  { label: 'Critique', dot: '#ef4444' }
];

const previewRecap = [
  { icon: User, value: 'Brahima Ouattara' },
  { icon: Stethoscope, value: 'Dr. Coulibaly A.' },
  { icon: Calendar, value: 'Lun 14 juillet 2025' },
  { icon: Clock, value: '14:00' },
  { icon: MapPin, value: 'Salle 3' }
];

// Les deux maquettes Banani n'écrivent pas les mêmes libellés (le mobile
// abrège : « Récents » au lieu de « Patients récents »). Chacune est suivie à
// sa propre largeur ; la bascule est en CSS (.ap-t-m / .ap-t-d) faute de
// pouvoir remplacer du texte autrement.
const PreviewLabel: React.FC<{ mobile: string; desktop: string }> = ({ mobile, desktop }) => (
  <>
    <span className="ap-t-m">{mobile}</span>
    <span className="ap-t-d">{desktop}</span>
  </>
);

// Initiales dans un rond — pattern établi dans ce dépôt, en remplacement des
// photos générées des maquettes Banani.
const previewInitials = (name: string): string =>
  name
    .replace(/^Dr\.\s*/, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toUpperCase();

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
            Essai gratuit
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
            Essai gratuit
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
              Dossiers patients, rendez-vous, ordonnances, pharmacie, laboratoire et caisse dans un seul outil, conçu pour les cliniques d'Abidjan et de toute la Côte d'Ivoire.
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

          {/* Quatre faits vérifiables dans le code, et rien d'autre. Ce
              bandeau portait « Tous les modules inclus » et « Support en
              français » (du remplissage), plus « Abonnement par Mobile Money
              ou carte » : une promesse que ce dépôt ne peut pas tenir seul,
              puisqu'elle dépend des moyens réellement activés sur la boutique
              Chariow de l'exploitant. */}
          <div className="landing-highlight">
            <Clock size={22} color="#5eead4" style={{ marginBottom: '6px' }} />
            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>Essai 7 jours, sans carte bancaire</div>
          </div>

          <div className="landing-highlight">
            <Receipt size={22} color="#5eead4" style={{ marginBottom: '6px' }} />
            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>Tarifs en FCFA, sans conversion</div>
          </div>

          <div className="landing-highlight">
            <Users size={22} color="#5eead4" style={{ marginBottom: '6px' }} />
            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>Interface et assistance en français</div>
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
        backgroundColor: '#f8fafc',
        borderTop: '1px solid #e2e8f0',
        padding: '4.5rem 1.5rem',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div style={{ maxWidth: '1200px', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '10px' }}>
              <MonitorSmartphone size={14} color="#1e4d40" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#1e4d40' }}>
                Aperçu
              </span>
            </div>
            {/* overflowWrap : à 200 % de taille de police navigateur, ce titre
                passe à 72px et « l'interface » (360px) dépasse les 279px
                disponibles à 375px. Sans césure il était rogné par
                l'overflowX:hidden de la racine, donc invisible et sans barre
                de défilement pour le récupérer. */}
            <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-secondary)', margin: '0 0 1rem', overflowWrap: 'break-word' }}>
              Voyez l'interface avant de vous inscrire
            </h2>
            <p style={{ color: '#64748b', maxWidth: '620px', margin: '0 auto 1.25rem', fontSize: '1rem' }}>
              La prise de rendez-vous telle qu'elle se présente à votre secrétariat : recherche du patient, médecin, créneau, motif et priorité sur un seul écran.
            </p>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '5px 14px',
              borderRadius: '9999px',
              backgroundColor: '#fff7ed',
              border: '1px solid #ffedd5',
              color: '#9a3412',
              fontSize: '0.78rem',
              fontWeight: 700
            }}>
              Données d'exemple — patients et médecins fictifs
            </span>
          </div>

          {/* Maquette inerte : aria-hidden + pointer-events:none, et aucun
              élément focusable à l'intérieur (que des div/span). */}
          <div className="app-preview landing-reveal" aria-hidden="true">

            {/* Barre latérale (desktop uniquement) */}
            <div className="ap-sidebar">
              <div style={{ padding: '20px 20px 18px', borderBottom: '1px solid var(--ap-sidebar-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: 'var(--ap-r-md)',
                    backgroundColor: 'var(--ap-sidebar-accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <Activity size={15} color="#ffffff" />
                  </div>
                  <span style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.01em' }}>MediClinic</span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--ap-sidebar-accent)', margin: '5px 0 0' }}>Votre clinique</p>
              </div>

              <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', padding: '16px 12px' }}>
                {marqueeModules.map(mod => {
                  const Icon = mod.icon;
                  const active = mod.label === 'Rendez-vous';
                  return (
                    <span
                      key={mod.label}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 12px', borderRadius: 'var(--ap-r-md)',
                        fontSize: '13px', fontWeight: 500,
                        backgroundColor: active ? 'var(--ap-sidebar-accent)' : 'transparent',
                        color: active ? '#ffffff' : 'var(--ap-sidebar-fg)'
                      }}
                    >
                      <Icon size={16} />
                      {mod.label}
                    </span>
                  );
                })}
              </nav>

              <div style={{ padding: '12px 12px 20px', borderTop: '1px solid var(--ap-sidebar-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', fontSize: '13px' }}>
                  <Settings size={16} />
                  Paramètres
                </span>
              </div>
            </div>

            <div className="ap-main">

              {/* Barre du haut (desktop) */}
              <div className="ap-topbar ap-desktop-only">
                <div>
                  <p style={{ fontSize: '22px', fontWeight: 600, margin: 0 }}>Nouveau rendez-vous</p>
                  <p style={{ fontSize: '13px', color: 'var(--ap-muted-fg)', margin: '2px 0 0' }}>Lundi 14 juillet 2025</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px', width: '256px',
                    padding: '8px 12px', backgroundColor: 'var(--ap-input)',
                    border: '1px solid var(--ap-border)', borderRadius: 'var(--ap-r-md)'
                  }}>
                    <Search size={15} color="var(--ap-muted-fg)" />
                    <span style={{ fontSize: '13px', color: 'var(--ap-muted-fg)' }}>Rechercher un patient…</span>
                  </div>
                  <div style={{
                    width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'var(--ap-input)', border: '1px solid var(--ap-border)', borderRadius: 'var(--ap-r-md)'
                  }}>
                    <Bell size={16} />
                  </div>
                </div>
              </div>

              {/* En-tête mobile */}
              <div className="ap-mobile-header ap-mobile-only">
                <ArrowLeft size={18} />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Nouveau RDV</span>
                <span style={{ width: '18px' }} />
              </div>

              <div className="ap-body">

                {/* Colonne formulaire */}
                <div className="ap-form-col">

                  {/* Titre + CTA (desktop) */}
                  <div className="ap-desktop-only ap-page-head" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Nouveau rendez-vous</p>
                      <p style={{ fontSize: '13px', color: 'var(--ap-muted-fg)', margin: '2px 0 0' }}>
                        Remplissez les informations ci-dessous pour planifier la consultation
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span className="ap-btn ap-btn-ghost">Annuler</span>
                      <span className="ap-btn"><Check size={14} />Confirmer le rendez-vous</span>
                    </div>
                  </div>

                  {/* Carte Patient */}
                  <div className="ap-card">
                    <div className="ap-card-head">
                      <User size={14} color="var(--ap-primary)" />
                      <h3 className="ap-card-title">Patient</h3>
                    </div>
                    <div className="ap-card-body">
                      <div className="ap-group">
                        <span className="ap-label">
                          <PreviewLabel mobile="Rechercher" desktop="Rechercher un patient existant" />
                        </span>
                        <div className="ap-field">
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ap-muted-fg)', minWidth: 0 }}>
                            <Search size={13} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <PreviewLabel mobile="Nom ou dossier…" desktop="Nom, prénom ou numéro de dossier…" />
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="ap-group">
                        <span className="ap-label-plain">
                          <PreviewLabel mobile="Récents" desktop="Patients récents" />
                        </span>
                        <div className="ap-recent">
                          {previewRecentPatients.map((p, i) => (
                            <span key={p.folder} className={i === 0 ? 'ap-chip ap-chip-on' : 'ap-chip'}>
                              <span className="ap-avatar" style={{ width: '24px', height: '24px', fontSize: '9px' }}>
                                {previewInitials(p.name)}
                              </span>
                              <span style={{ minWidth: 0 }}>
                                <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {p.name}
                                </span>
                                <span style={{ display: 'block', color: 'var(--ap-muted-fg)' }}>{p.folder}</span>
                              </span>
                              {i === 0 && <Check size={12} style={{ flexShrink: 0 }} />}
                            </span>
                          ))}
                          <span className="ap-chip ap-chip-new">
                            <UserPlus size={13} />
                            Nouveau patient
                          </span>
                        </div>
                      </div>

                      <div className="ap-selected-patient">
                        <span className="ap-avatar" style={{ width: '38px', height: '38px', fontSize: '13px' }}>BO</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: '13px', fontWeight: 700 }}>Brahima Ouattara</span>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--ap-muted-fg)' }}>
                            <PreviewLabel mobile="52 ans · P003" desktop="52 ans · P003 · +225 06 XX XX XX" />
                          </span>
                        </span>
                        <span style={{
                          flexShrink: 0, fontSize: '11px', fontWeight: 500, padding: '2px 8px',
                          borderRadius: 'var(--ap-r-md)', backgroundColor: '#ffedd5', color: '#c2410c'
                        }}>
                          HTA
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Carte Type & Médecin */}
                  <div className="ap-card">
                    <div className="ap-card-head">
                      <Stethoscope size={14} color="var(--ap-primary)" />
                      <h3 className="ap-card-title">
                        <PreviewLabel mobile="Consultation" desktop="Type de consultation & Médecin" />
                      </h3>
                    </div>
                    <div className="ap-card-body">
                      <div className="ap-group">
                        <span className="ap-label">
                          <PreviewLabel mobile="Type" desktop="Type de consultation" />
                        </span>
                        <div className="ap-field">
                          <span>Cardiologie</span>
                          <ChevronDown size={13} color="var(--ap-muted-fg)" />
                        </div>
                      </div>
                      <div className="ap-group">
                        <span className="ap-label">
                          <PreviewLabel mobile="Salle" desktop="Salle / Espace" />
                        </span>
                        <div className="ap-field">
                          <span>Salle 3</span>
                          <ChevronDown size={13} color="var(--ap-muted-fg)" />
                        </div>
                      </div>
                      <div className="ap-group">
                        <span className="ap-label">
                          <PreviewLabel mobile="Médecin" desktop="Médecin assigné" />
                        </span>
                        <div className="ap-doctors">
                          {previewDoctors.map((doc, i) => {
                            const on = i === PREVIEW_SELECTED_DOCTOR;
                            return (
                              <span key={doc.name} className={on ? 'ap-doctor ap-doctor-on' : 'ap-doctor'}>
                                <span className="ap-avatar" style={{ width: '30px', height: '30px', fontSize: '11px' }}>
                                  {previewInitials(doc.name)}
                                </span>
                                <span style={{ fontSize: '11px', fontWeight: 600, lineHeight: 1.2, color: on ? 'var(--ap-primary)' : 'inherit' }}>
                                  {doc.name}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--ap-muted-fg)' }}>{doc.specialty}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Carte Date & Heure — mobile uniquement (le desktop a le
                      calendrier dans le rail, conformément aux deux mocks) */}
                  <div className="ap-card ap-mobile-only">
                    <div className="ap-card-head">
                      <Calendar size={14} color="var(--ap-primary)" />
                      <h3 className="ap-card-title">Date &amp; Heure</h3>
                    </div>
                    <div className="ap-card-body">
                      <div className="ap-group">
                        <span className="ap-label">Date</span>
                        <div className="ap-field">
                          <span>Lun 14 juillet 2025</span>
                          <ChevronDown size={12} color="var(--ap-muted-fg)" />
                        </div>
                      </div>
                      <div className="ap-group">
                        <span className="ap-label-plain">Heure disponible</span>
                        <div className="ap-slots">
                          {previewSlots.map((slot, i) => (
                            <span
                              key={slot}
                              className={
                                i === PREVIEW_SELECTED_SLOT ? 'ap-slot ap-slot-on'
                                  : PREVIEW_TAKEN_SLOTS.includes(i) ? 'ap-slot ap-slot-off'
                                    : 'ap-slot'
                              }
                            >
                              {slot}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Carte Notes */}
                  <div className="ap-card">
                    <div className="ap-card-head">
                      <FileText size={14} color="var(--ap-primary)" />
                      <h3 className="ap-card-title">
                        <PreviewLabel mobile="Notes" desktop="Notes & motif de consultation" />
                      </h3>
                    </div>
                    <div className="ap-card-body">
                      <div className="ap-group">
                        <span className="ap-label">Motif</span>
                        <div className="ap-field"><span>Suivi tension artérielle</span></div>
                      </div>
                      <div className="ap-group">
                        <span className="ap-label">
                          <PreviewLabel mobile="Complémentaires" desktop="Notes complémentaires" />
                        </span>
                        <div className="ap-field ap-field-tall">
                          <span style={{ color: 'var(--ap-muted-fg)' }}>
                            <PreviewLabel mobile="Détails…" desktop="Informations supplémentaires…" />
                          </span>
                        </div>
                      </div>
                      <div className="ap-group ap-group-priority">
                        <span className="ap-label">Priorité</span>
                        <div className="ap-priorities">
                          {previewPriorities.map((p, i) => (
                            <span key={p.label} className={i === 0 ? 'ap-priority ap-priority-on' : 'ap-priority'}>
                              <span className="ap-dot" style={{ backgroundColor: p.dot }} />
                              {p.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rail : calendrier (desktop), créneaux, récapitulatif */}
                <div className="ap-rail">

                  <div className="ap-card ap-desktop-only" style={{ flexDirection: 'column' }}>
                    <div className="ap-card-head" style={{ justifyContent: 'space-between' }}>
                      <span style={{
                        width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: 'var(--ap-input)', border: '1px solid var(--ap-border)', borderRadius: 'var(--ap-r-md)'
                      }}>
                        <ChevronLeft size={12} />
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>Juillet 2025</span>
                      <span style={{
                        width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: 'var(--ap-input)', border: '1px solid var(--ap-border)', borderRadius: 'var(--ap-r-md)'
                      }}>
                        <ChevronRight size={12} />
                      </span>
                    </div>
                    <div className="ap-card-body">
                      <div className="ap-cal-grid">
                        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                          <span key={i} style={{ fontSize: '11px', fontWeight: 500, color: 'var(--ap-muted-fg)', padding: '4px 0' }}>{d}</span>
                        ))}
                        {previewCalendarWeeks.flat().map((day, i) => {
                          if (day === null) return <span key={i} className="ap-cal-day ap-cal-day-empty" />;
                          const cls = day === PREVIEW_CAL_SELECTED ? 'ap-cal-day ap-cal-day-on'
                            : day === PREVIEW_CAL_OFF ? 'ap-cal-day ap-cal-day-off'
                              : 'ap-cal-day';
                          return (
                            <span key={i} className={cls} style={i < 7 ? { color: 'var(--ap-muted-fg)' } : undefined}>
                              {day}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="ap-card ap-desktop-only" style={{ flexDirection: 'column' }}>
                    <div className="ap-card-head">
                      <Clock size={13} color="var(--ap-primary)" />
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>Créneaux disponibles</span>
                    </div>
                    <div className="ap-card-body" style={{ gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--ap-muted-fg)' }}>Lundi 14 juillet 2025</span>
                      <div className="ap-slots">
                        {previewSlots.map((slot, i) => (
                          <span
                            key={slot}
                            className={
                              i === PREVIEW_SELECTED_SLOT ? 'ap-slot ap-slot-on'
                                : PREVIEW_TAKEN_SLOTS.includes(i) ? 'ap-slot ap-slot-off'
                                  : 'ap-slot'
                            }
                          >
                            {slot}
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--ap-muted-fg)' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: 'var(--ap-primary)' }} />
                          Sélectionné
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--ap-muted-fg)' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: 'var(--ap-input)', border: '1px solid var(--ap-border)', opacity: 0.4 }} />
                          Occupé
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="ap-recap">
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--ap-bg)', opacity: 0.6 }}>
                      Récapitulatif
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {previewRecap.map(row => {
                        const Icon = row.icon;
                        return (
                          <span key={row.value} className="ap-recap-row">
                            <Icon size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
                            {row.value}
                          </span>
                        );
                      })}
                    </div>
                    <span className="ap-btn ap-desktop-only" style={{ fontSize: '12px', marginTop: '2px' }}>
                      <CheckCircle2 size={13} />
                      Confirmer
                    </span>
                  </div>

                  {/* CTA empilés — mobile uniquement */}
                  <div className="ap-ctas ap-mobile-only" style={{ flexDirection: 'column' }}>
                    <span className="ap-btn"><CheckCircle2 size={14} />Confirmer le RDV</span>
                    <span className="ap-btn ap-btn-ghost">Annuler</span>
                  </div>
                </div>
              </div>
            </div>
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
                Tous les plans incluent : utilisation sur ordinateur et sur mobile, mises à jour incluses, changement de plan à tout moment
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
