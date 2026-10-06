#!/usr/bin/env node
// Genera los iconos PNG (PWA, Android/TWA, Apple, favicon) a partir de la coma de REPOSTA.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const OUT = new URL('../apps/web/public/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });
// La coma ocupa x 22–90, y 4–118 en su viewBox: se centra su caja en el lienzo de 512.
const centered = (s) => comma(256 - 56 * s, 256 - 61 * s, s);
const comma = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="56" cy="38" r="34" fill="#F5B21B"/><path d="M90 38 C90 78 66 104 26 118 C46 100 55 86 57 72 Z" fill="#F5B21B"/></g>`;
// «any»: esquinas redondeadas. «maskable»: fondo completo y la coma dentro de la zona segura (80 % central).
const any = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="116" fill="#12306B"/>${centered(2.5)}</svg>`;
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#12306B"/>${centered(1.75)}</svg>`;

const jobs = [
  [any, 'icon-192.png', 192], [any, 'icon-512.png', 512],
  [maskable, 'maskable-192.png', 192], [maskable, 'maskable-512.png', 512],
  [maskable, 'apple-touch-icon.png', 180], [any, 'favicon-32.png', 32],
];
for (const [svg, name, size] of jobs) await sharp(Buffer.from(svg)).resize(size, size).png().toFile(new URL(name, OUT).pathname.replace(/^\/([A-Z]:)/, '$1'));
console.log('iconos generados:', jobs.map((j) => j[1]).join(', '));
