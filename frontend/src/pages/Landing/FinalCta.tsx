import { WhatsAppLink } from './WhatsApp';

export const FinalCta = ({ trialDays, onRegister }: { trialDays: number; onRegister: () => void }) => (
  <section className="vt-section vt-section-tight">
    <div className="vt-wrap vt-reveal">
      <div className="vt-closing-panel">
        <div>
          <h2>Essayez MediClinic dans votre clinique cette semaine.</h2>
          <p className="vt-lead">{trialDays} jours gratuits, sans carte bancaire. Une question avant de commencer&nbsp;? On vous répond sur WhatsApp.</p>
        </div>
        <div className="vt-closing-ctas">
          <button type="button" className="vt-btn vt-btn-primary" onClick={onRegister}>Essayer gratuitement</button>
          <WhatsAppLink className="vt-btn vt-btn-ghost" />
        </div>
      </div>
    </div>
  </section>
);
