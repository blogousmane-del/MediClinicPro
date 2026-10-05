import { SITE } from '../../config/site';

// Photo réelle d'une clinique ou de l'équipe, fournie par le propriétaire. Sans
// elle, rien n'est ajouté : aucune image générée ne la remplace.
export const FieldPhotoBand = () => {
  const photo = SITE.fieldPhoto;
  if (!photo) return null;
  return (
    <figure className="vt-field-photo">
      <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" />
    </figure>
  );
};
