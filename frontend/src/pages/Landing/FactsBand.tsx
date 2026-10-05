import { Banknote, CalendarCheck, MessageCircle, ShieldCheck } from 'lucide-react';

export const FactsBand = ({ trialDays }: { trialDays: number }) => {
  const facts = [
    { icon: CalendarCheck, title: `${trialDays} jours gratuits`, text: 'Sans carte bancaire ni engagement' },
    { icon: Banknote, title: 'Prix en FCFA', text: 'Abonnement payable par Mobile Money' },
    { icon: ShieldCheck, title: 'Données séparées', text: 'Chaque clinique ne voit que ses dossiers' },
    { icon: MessageCircle, title: 'Aide sur WhatsApp', text: 'On vous aide à démarrer, en français' },
  ];
  return (
    <section className="vt-facts" aria-label="En bref">
      <div className="vt-wrap">
        <ul>
          {facts.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
              <div><strong>{title}</strong><span>{text}</span></div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
