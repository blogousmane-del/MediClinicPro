// Génère les variantes AVIF et WebP des captures de la vitrine, et l'image de
// partage. Les sources sont les PNG de scripts/.captures/, produits par
// capture-screens.mjs : npm run captures enchaîne les deux scripts.
//
// Chaque capture donne deux largeurs, celle du rendu et son double pour les
// écrans à haute densité, dans les deux formats. Les PNG restent hors de
// public/ : à 2880 px de large, ils pèseraient plusieurs mégaoctets chacun, sur
// une page servie le plus souvent en connexion mobile.
//
// Lancement seul : npm run images (sharp est une dépendance de développement,
// elle ne part pas dans le bundle).
import sharp from 'sharp';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sourceDir = join(here, '.captures');
const publicDir = join(here, '..', 'public');
const outDir = join(publicDir, 'captures');

// Largeurs choisies sur le rendu réel : 900 px pour la capture du héros, 390 px
// pour un téléphone, 412 px pour le reçu posé sur son panneau. Ce sont les
// largeurs que lit frontend/src/pages/Landing/Capture.tsx.
const SCREENS = ['dashboard', 'patients', 'patient-detail', 'laboratory', 'pharmacy', 'accounting'];
const SOURCES = [
  ...SCREENS.flatMap((name) => [
    { name, widths: [900, 1800] },
    { name: `${name}-mobile`, widths: [390, 780] },
  ]),
  { name: 'receipt', widths: [520, 1040] },
];

const kb = (bytes) => `${Math.round(bytes / 1024)} Ko`;

await mkdir(outDir, { recursive: true });

for (const { name, widths } of SOURCES) {
  const src = join(sourceDir, `${name}.png`);
  for (const width of widths) {
    const pipeline = sharp(src).resize({ width, withoutEnlargement: true });
    const avifPath = join(outDir, `${name}-${width}.avif`);
    await pipeline.clone().avif({ quality: 60, effort: 6 }).toFile(avifPath);
    const webpPath = join(outDir, `${name}-${width}.webp`);
    await pipeline.clone().webp({ quality: 76 }).toFile(webpPath);
    console.log(`${name}-${width}  avif ${kb((await stat(avifPath)).size)}  webp ${kb((await stat(webpPath)).size)}`);
  }
}

// Image de partage (WhatsApp, Facebook) : un PNG 1200 × 630, le format le mieux
// lu par les aperçus de lien.
const ogPath = join(publicDir, 'og-image.png');
await sharp(join(sourceDir, 'og-image.png')).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(ogPath);
console.log(`og-image.png  ${kb((await stat(ogPath)).size)}`);
