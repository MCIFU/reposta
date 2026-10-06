import Link from 'next/link';
import styles from './Brand.module.css';
import { priceParts } from '@/lib/format';

/** La coma de REPOSTA: cabeza (lugar) + cola (trayecto). */
export function Comma({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 100 120" className={className} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <circle cx="56" cy="38" r="34" />
      <path d="M90 38 C90 78 66 104 26 118 C46 100 55 86 57 72 Z" />
    </svg>
  );
}

export function Wordmark({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className={styles.wordmark} aria-label="REPOSTA, inicio">
      REPOSTA<Comma className={styles.wmComma} />
    </Link>
  );
}

/** Precio con la coma de marca. size: 'hero' | 'lg' */
export function BrandPrice({ milli, unit = 'L', size = 'hero' }: { milli: number; unit?: string; size?: 'hero' | 'lg' }) {
  const { int, dec } = priceParts(milli);
  return (
    <span className={`${styles.price} ${styles[size]} num`}>
      <span className="sr-only">{`${int},${dec} euros por ${unit === 'L' ? 'litro' : unit}`}</span>
      <span aria-hidden="true">{int}</span>
      <Comma className={styles.priceComma} />
      <span aria-hidden="true">{dec}</span>
      <span className={styles.unit} aria-hidden="true">€/{unit}</span>
    </span>
  );
}
