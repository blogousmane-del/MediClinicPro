// Coordonnées publiques de MediClinic : seule source du numéro WhatsApp pour
// la page de connexion (et, au chantier vitrine, pour la landing et les CGU).
export const SITE = {
  url: 'https://mediclinicpro.com',
  whatsapp: {
    display: '+225 07 88 81 81 18',
    e164: '2250788818118',
    message: 'Bonjour, je souhaite en savoir plus sur MediClinic.',
  },
};

export const whatsappUrl = (text: string = SITE.whatsapp.message): string =>
  `https://wa.me/${SITE.whatsapp.e164}?text=${encodeURIComponent(text)}`;
