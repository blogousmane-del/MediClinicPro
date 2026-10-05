import { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { FALLBACK_CATALOG, mergeCatalog, type PublicCatalog } from '../../utils/publicPlans';

// Catalogue réel, chargé une fois. Un échec est silencieux : le repli reste
// affiché plutôt qu'une page tarifs vide ou une erreur montrée à un visiteur.
export const usePublicCatalog = (): PublicCatalog => {
  const [catalog, setCatalog] = useState<PublicCatalog>(FALLBACK_CATALOG);
  useEffect(() => {
    let cancelled = false;
    api.get('/settings/public/plans')
      .then((data: { plans?: unknown }) => { if (!cancelled) setCatalog(mergeCatalog(data?.plans)); })
      .catch(() => { /* repli sur FALLBACK_CATALOG */ });
    return () => { cancelled = true; };
  }, []);
  return catalog;
};
