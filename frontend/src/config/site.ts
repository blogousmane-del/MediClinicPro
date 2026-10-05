// Coordonnées et identité publiques de MediClinic : seule source pour la
// vitrine, la page de connexion et les CGU. Un bloc dont la donnée vaut null
// n'est pas affiché : rien n'est inventé en attendant que le propriétaire la
// fournisse.
export interface Founder {
  name: string;
  role: string; // « fondateur de MediClinic »
  photo: string; // chemin sous public/, portrait 4:5
  quote: string; // deux ou trois phrases à la première personne
}

export interface Legal {
  name: string; // raison sociale
  rccm: string;
}

export interface FieldPhoto {
  src: string;
  alt: string;
}

export const SITE = {
  url: 'https://mediclinicpro.com',
  whatsapp: {
    display: '+225 07 88 81 81 18',
    e164: '2250788818118',
    message: 'Bonjour, je souhaite en savoir plus sur MediClinic.',
  },
  // Moyens de paiement de l'abonnement, tels que les accepte la boutique
  // Chariow : la vitrine les affiche tels quels, à tenir identiques.
  subscriptionPaymentMethods: ['Orange Money', 'MTN MoMo', 'Wave', 'carte bancaire'] as readonly string[],
  founder: null as Founder | null,
  legal: null as Legal | null,
  fieldPhoto: null as FieldPhoto | null,
};

export const whatsappUrl = (text: string = SITE.whatsapp.message): string =>
  `https://wa.me/${SITE.whatsapp.e164}?text=${encodeURIComponent(text)}`;
