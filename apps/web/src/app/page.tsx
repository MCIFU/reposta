import { Finder } from '@/components/finder/Finder';

// La portada no espera a los precios: se sirve al instante (estática, desde la CDN)
// y el resumen nacional se pide desde el navegador.
export default function Home() {
  return <Finder summary={null} />;
}
