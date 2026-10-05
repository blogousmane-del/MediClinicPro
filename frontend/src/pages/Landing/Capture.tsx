// Captures de l'application réelle (npm run captures), en AVIF et WebP à deux
// largeurs. Sous 640 px, la version téléphone remplace la capture de bureau :
// un écran de 1440 px réduit à 350 px ne se lit plus.
const DESKTOP_WIDTHS = [900, 1800];
const MOBILE_WIDTHS = [390, 780];
const RECEIPT_WIDTHS = [520, 1040];
const PHONE_QUERY = '(max-width: 640px)';

const srcSet = (name: string, widths: number[], ext: 'avif' | 'webp') =>
  widths.map((width) => `/captures/${name}-${width}.${ext} ${width}w`).join(', ');

interface CaptureProps {
  name: string;
  alt: string;
  sizes: string;
  phoneSizes?: string;
  priority?: boolean;
}

export const Capture = ({ name, alt, sizes, phoneSizes = '80vw', priority = false }: CaptureProps) => (
  <picture>
    <source media={PHONE_QUERY} type="image/avif" srcSet={srcSet(`${name}-mobile`, MOBILE_WIDTHS, 'avif')} sizes={phoneSizes} />
    <source media={PHONE_QUERY} type="image/webp" srcSet={srcSet(`${name}-mobile`, MOBILE_WIDTHS, 'webp')} sizes={phoneSizes} />
    <source type="image/avif" srcSet={srcSet(name, DESKTOP_WIDTHS, 'avif')} sizes={sizes} />
    <img
      src={`/captures/${name}-${DESKTOP_WIDTHS[0]}.webp`}
      srcSet={srcSet(name, DESKTOP_WIDTHS, 'webp')}
      sizes={sizes}
      alt={alt}
      width={1440}
      height={900}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
    />
  </picture>
);

// Capture téléphone seule, pour la cellule « Sur ordinateur comme sur téléphone ».
export const PhoneCapture = ({ name, alt, sizes }: { name: string; alt: string; sizes: string }) => (
  <picture>
    <source type="image/avif" srcSet={srcSet(`${name}-mobile`, MOBILE_WIDTHS, 'avif')} sizes={sizes} />
    <img
      src={`/captures/${name}-mobile-${MOBILE_WIDTHS[0]}.webp`}
      srcSet={srcSet(`${name}-mobile`, MOBILE_WIDTHS, 'webp')}
      sizes={sizes}
      alt={alt}
      width={390}
      height={844}
      loading="lazy"
      decoding="async"
    />
  </picture>
);

// Le reçu imprimé réel, photographié dans sa fenêtre d'impression.
export const ReceiptCapture = ({ alt }: { alt: string }) => (
  <picture>
    <source type="image/avif" srcSet={srcSet('receipt', RECEIPT_WIDTHS, 'avif')} sizes="(max-width: 1080px) 86vw, 412px" />
    <img
      src={`/captures/receipt-${RECEIPT_WIDTHS[0]}.webp`}
      srcSet={srcSet('receipt', RECEIPT_WIDTHS, 'webp')}
      sizes="(max-width: 1080px) 86vw, 412px"
      alt={alt}
      width={1640}
      height={2200}
      loading="lazy"
      decoding="async"
    />
  </picture>
);
