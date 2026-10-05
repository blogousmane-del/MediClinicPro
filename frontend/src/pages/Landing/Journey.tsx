import { useRef, useState, type KeyboardEvent } from 'react';
import { Check, FlaskConical, Pill, Receipt, Stethoscope, Users } from 'lucide-react';
import { Capture } from './Capture';

const STEPS = [
  {
    id: 'accueil', label: 'Accueil', icon: Users, capture: 'patients', alt: 'Registre des patients',
    title: 'Le registre des patients, toujours à jour.',
    points: ['Numéro de dossier attribué automatiquement', "Allergies visibles d'un coup d'œil", 'Rendez-vous et orientation vers le médecin disponible'],
  },
  {
    id: 'consultation', label: 'Consultation', icon: Stethoscope, capture: 'patient-detail', alt: 'Dossier patient et son historique',
    title: "Le médecin voit tout l'historique avant de consulter.",
    points: ['Constantes, diagnostic et notes dans le dossier', 'Ordonnance et analyses prescrites depuis la consultation', 'Résultats et factures dans la même chronologie'],
  },
  {
    id: 'labo', label: 'Laboratoire', icon: FlaskConical, capture: 'laboratory', alt: 'Analyses en attente au laboratoire',
    title: "Les demandes d'analyses arrivent directement au labo.",
    points: ['Chaque demande avec son heure, son patient et son médecin', 'Résultats saisis une fois, lus par le médecin', 'Plus de bon papier qui se perd entre deux bureaux'],
  },
  {
    id: 'pharmacie', label: 'Pharmacie', icon: Pill, capture: 'pharmacy', alt: 'Inventaire de la pharmacie',
    title: 'Un stock qui ne disparaît plus.',
    points: ['Alertes de stock bas et de péremption proche', "Délivrance liée à l'ordonnance\u00a0: le stock baisse tout seul", "Prix d'achat, prix de vente et marge par produit"],
  },
  {
    id: 'caisse', label: 'Caisse', icon: Receipt, capture: 'accounting', alt: 'Journal des recettes',
    title: 'Chaque franc encaissé a son reçu.',
    points: ["Reçu numéroté à l'en-tête de la clinique", 'Journal des recettes et total du jour', 'Le nom de la personne qui a encaissé, sur chaque ligne'],
  },
];

export const Journey = () => {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Onglets ARIA : flèches gauche et droite, Début et Fin ; la sélection suit le focus.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = STEPS.length - 1;
    const moves: Record<string, number> = {
      ArrowRight: active === last ? 0 : active + 1,
      ArrowLeft: active === 0 ? last : active - 1,
      Home: 0,
      End: last,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className="vt-section" id="fonctionnalites">
      <div className="vt-wrap vt-reveal">
        <h2>Un seul dossier patient, partagé par toute l'équipe.</h2>
        <p className="vt-lead">
          La secrétaire l'ouvre, le médecin le complète, le laboratoire et la pharmacie s'en servent, la caisse encaisse. Personne ne ressaisit.
        </p>
        <div className="vt-tabs" role="tablist" aria-label="Postes de la clinique" onKeyDown={onKeyDown}>
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <button
                key={step.id}
                ref={(element) => { tabRefs.current[index] = element; }}
                type="button"
                role="tab"
                id={`vt-tab-${step.id}`}
                aria-controls={`vt-panel-${step.id}`}
                aria-selected={index === active}
                tabIndex={index === active ? 0 : -1}
                className="vt-tab"
                onClick={() => setActive(index)}
              >
                <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
                {step.label}
              </button>
            );
          })}
        </div>
        {STEPS.map((step, index) => (
          <div
            key={step.id}
            className="vt-panel"
            role="tabpanel"
            id={`vt-panel-${step.id}`}
            aria-labelledby={`vt-tab-${step.id}`}
            hidden={index !== active}
          >
            <div>
              <h3>{step.title}</h3>
              <ul>
                {step.points.map((point) => (
                  <li key={point}><Check size={18} strokeWidth={1.75} aria-hidden="true" />{point}</li>
                ))}
              </ul>
            </div>
            <figure className="vt-shot">
              <div className="vt-shot-bar" aria-hidden="true"><span>mediclinicpro.com</span></div>
              <Capture name={step.capture} alt={step.alt} sizes="(max-width: 1080px) 92vw, 760px" phoneSizes="78vw" />
            </figure>
          </div>
        ))}
        <p className="vt-caption">Captures de l'application, avec des données d'exemple.</p>
      </div>
    </section>
  );
};
