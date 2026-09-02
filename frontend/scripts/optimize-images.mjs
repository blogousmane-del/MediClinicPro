// Génère les variantes AVIF et WebP des photos de la vitrine.
//
// Les trois PNG d'origine pèsent 1,8 Mo à eux seuls, sur une page servie à des
// cliniques ivoiriennes le plus souvent en connexion mobile. Chaque source
// produit deux largeurs (celle du rendu et son double pour les écrans à haute
// densité) dans les deux formats. Les PNG d'origine restent en place : ils
// servent de dernier repli dans le <picture> et d'image de partage Open Graph.
//
// Lancement : npm run images  (sharp est une dépendance de développement, elle
// ne part pas dans le bundle).

import sharp from 'sharp';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');
const outDir = join(publicDir, 'optimized');

// Largeurs choisies sur le rendu réel : le héros occupe ~560px au maximum dans
// une grille limitée à 1200px, la photo du laboratoire ~570px.
const SOURCES = [
  { file: 'doctor_hero.png', widths: [560, 1120] },
  { file: 'lab_showcase.png', widths: [570, 1140] }
];

const kb = (bytes) => `${Math.round(bytes / 1024)} Ko`;

await mkdir(outDir, { recursive: true });

for (const { file, widths } of SOURCES) {
  const src = join(publicDir, file);
  const base = file.replace(/\.png$/, '');
  const original = await stat(src);
  console.log(`\n${file} — ${kb(original.size)} en PNG`);

  for (const width of widths) {
    const pipeline = sharp(src).resize({ width, withoutEnlargement: true });

    const avifPath = join(outDir, `${base}-${width}.avif`);
    await pipeline.clone().avif({ quality: 55, effort: 6 }).toFile(avifPath);
    console.log(`  ${base}-${width}.avif  ${kb((await stat(avifPath)).size)}`);

    const webpPath = join(outDir, `${base}-${width}.webp`);
    await pipeline.clone().webp({ quality: 72 }).toFile(webpPath);
    console.log(`  ${base}-${width}.webp  ${kb((await stat(webpPath)).size)}`);
  }
}

console.log('\nVariantes écrites dans public/optimized/.');
