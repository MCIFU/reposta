import type { Metadata } from 'next';
import { AppNav } from '@/components/AppNav';
import { TripPlanner } from '@/components/trip/TripPlanner';

export const metadata: Metadata = {
  title: 'Calculadora de viaje: combustible, kilómetros y coste',
  description: 'Calcula cuánto combustible gastarás y cuánto te costará un viaje por España con paradas, según tu coche y los precios de hoy.',
};

export default function TripPage() {
  return (
    <>
      <AppNav />
      <TripPlanner />
    </>
  );
}
