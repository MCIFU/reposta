import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import { RegisterSW } from '@/components/pwa/RegisterSW';
import './globals.css';

const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'REPOSTA, el precio del combustible en España', template: '%s · REPOSTA' },
  description: 'Encuentra la gasolinera más barata cerca de ti con precios oficiales actualizados y descubre si de verdad compensa ir hasta ella.',
  applicationName: 'REPOSTA',
  openGraph: { siteName: 'REPOSTA', locale: 'es_ES', type: 'website' },
  icons: {
    icon: [{ url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' }, { url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: { capable: true, title: 'REPOSTA', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eef1f5' },
    { media: '(prefers-color-scheme: dark)', color: '#0a1630' },
  ],
};

// Aplica el tema guardado antes del primer pintado (sin destello).
const themeScript = `try{var t=localStorage.getItem('rp-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={archivo.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
