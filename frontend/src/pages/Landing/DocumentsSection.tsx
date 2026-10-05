import { ReceiptCapture } from './Capture';

export const DocumentsSection = () => (
  <section className="vt-section vt-docs">
    <div className="vt-wrap vt-docs-grid vt-reveal">
      <div>
        <h2>Vos patients repartent avec un reçu à votre nom.</h2>
        <p className="vt-lead">
          Chaque encaissement produit un reçu numéroté, imprimé à l'en-tête de votre clinique. Les ordonnances aussi.
        </p>
        <dl className="vt-docs-points">
          <div>
            <dt>L'en-tête de votre clinique</dt>
            <dd>Nom, adresse et téléphone, repris de vos paramètres.</dd>
          </div>
          <div>
            <dt>Un numéro unique</dt>
            <dd>
              <span className="vt-mono">FAC-{new Date().getFullYear()}-00042</span> est attribué par le système&nbsp;: deux reçus ne peuvent pas porter le même.
            </dd>
          </div>
          <div>
            <dt>Qui a encaissé</dt>
            <dd>Le nom de la personne à la caisse figure sur chaque reçu.</dd>
          </div>
        </dl>
      </div>
      <div>
        <div className="vt-paper-stage">
          <figure className="vt-paper">
            <ReceiptCapture alt="Exemple de reçu imprimé par MediClinic, à l'en-tête d'une clinique fictive" />
          </figure>
        </div>
        <p className="vt-caption">Reçu d'exemple, au nom d'une clinique fictive.</p>
      </div>
    </div>
  </section>
);
