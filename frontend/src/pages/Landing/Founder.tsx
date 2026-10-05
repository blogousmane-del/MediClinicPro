import { SITE } from '../../config/site';
import { WhatsAppLink } from './WhatsApp';

// Bloc rendu seulement quand le propriétaire a fourni nom, photo et texte : un
// fondateur inventé serait pire qu'aucun.
export const Founder = () => {
  const founder = SITE.founder;
  if (!founder) return null;
  return (
    <section className="vt-section vt-founder">
      <div className="vt-wrap vt-founder-grid vt-reveal">
        <figure className="vt-portrait">
          <img src={founder.photo} alt={`${founder.name}, ${founder.role}`} width={600} height={750} loading="lazy" decoding="async" />
        </figure>
        <div>
          <blockquote>«&nbsp;{founder.quote}&nbsp;»</blockquote>
          <p className="vt-who"><strong>{founder.name}</strong>, {founder.role}</p>
          <WhatsAppLink className="vt-btn vt-btn-ghost" />
        </div>
      </div>
    </section>
  );
};
