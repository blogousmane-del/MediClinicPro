import React from 'react';
import {
  Activity,
  FlaskConical,
  LayoutDashboard,
  Pill,
  Receipt,
  Users,
  ArrowLeft,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  Search,
  Settings,
  Stethoscope,
  User,
  UserPlus,
} from 'lucide-react';

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
  { label: 'Normal', dot: 'var(--ap-primary)' },
  { label: 'Urgent', dot: 'var(--lp-warn-fg)' },
  { label: 'Critique', dot: 'var(--danger)' }
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

// Modules de la barre latérale de la maquette. La vitrine a sa propre liste
// (section « Sept modules ») : les deux décrivent la même application mais ne
// vivent pas au même endroit, et la maquette doit rester autonome.
const previewModules = [
  { icon: LayoutDashboard, label: 'Tableau de bord' },
  { icon: Users, label: 'Patients' },
  { icon: Calendar, label: 'Rendez-vous' },
  { icon: FileText, label: 'Ordonnances' },
  { icon: FlaskConical, label: 'Laboratoire' },
  { icon: Pill, label: 'Pharmacie' },
  { icon: Receipt, label: 'Comptabilité' }
];

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

/**
 * Maquette inerte de l'écran « Nouveau rendez-vous », affichée sur la page
 * vitrine. Elle vivait dans LandingPage.tsx, où elle pesait environ 400 lignes
 * au milieu du contenu marketing.
 *
 * Rien n'y est focusable ni cliquable (que des div et des span), et le bloc
 * entier est aria-hidden : un lecteur d'écran ne doit pas lire un formulaire
 * qui n'existe pas. Ses couleurs viennent des tokens --ap-* d'index.css, qui
 * reproduisent la palette claire réelle de l'application.
 */
export const AppPreview: React.FC = () => (
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
              <Activity size={15} color="var(--lp-bg)" />
            </div>
            <span style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.01em' }}>MediClinic</span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--ap-sidebar-accent)', margin: '5px 0 0' }}>Votre clinique</p>
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', padding: '16px 12px' }}>
          {previewModules.map(mod => {
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
                  color: active ? 'var(--lp-bg)' : 'var(--ap-sidebar-fg)'
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
                    borderRadius: 'var(--ap-r-md)', backgroundColor: 'var(--lp-warn-bg)', color: 'var(--lp-warn-fg)'
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
);
