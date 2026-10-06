// Etiquetas de precio dibujadas en canvas (con la tipografía de la marca) y registradas como imágenes del mapa.
// id de imagen: «pin|<milli>|<band 0-2>|<theme>[|s]»  ·  «cl|<min milli>|<count>|<theme>»
import type { Map as MlMap } from 'maplibre-gl';
import { price } from '@/lib/format';

const COLORS = {
  light: { band: ['#0f8a6c', '#ffffff', '#c9472e'], bandInk: ['#ffffff', '#0f1f40', '#ffffff'], cluster: '#12306b', ring: '#f5b21b', border: '#d6dbe4' },
  dark: { band: ['#20a885', '#2a4170', '#e0603f'], bandInk: ['#ffffff', '#e8edf6', '#ffffff'], cluster: '#24448a', ring: '#f5b21b', border: '#3a5182' },
};

function fontFamily() {
  return getComputedStyle(document.body).fontFamily || 'system-ui';
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function draw(parts: Array<{ text: string; weight: number; size: number; alpha?: number }>, bg: string, ink: string, opts: { ring?: string; border?: string }) {
  const pr = Math.min(2, window.devicePixelRatio || 1);
  const fam = fontFamily();
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  const padX = 9, h = 24, tail = 6, shadow = 6, ringW = opts.ring ? 3 : 0;
  let textW = 0;
  for (const p of parts) {
    ctx.font = `${p.weight} ${p.size}px ${fam}`;
    textW += ctx.measureText(p.text).width;
  }
  textW += (parts.length - 1) * 4;
  const w = Math.ceil(textW + padX * 2);
  const W = w + (shadow + ringW) * 2, H = h + tail + (shadow + ringW) * 2;
  c.width = W * pr; c.height = H * pr;
  ctx.scale(pr, pr);
  const x = shadow + ringW, y = shadow + ringW;

  ctx.save();
  ctx.shadowColor = 'rgba(10,22,48,0.32)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.moveTo(x + w / 2 - 5, y + h - 0.5); ctx.lineTo(x + w / 2, y + h + tail); ctx.lineTo(x + w / 2 + 5, y + h - 0.5);
  ctx.fillStyle = bg; ctx.fill();
  ctx.restore();
  if (opts.border) { ctx.lineWidth = 1; ctx.strokeStyle = opts.border; roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, (h - 1) / 2); ctx.stroke(); }
  if (opts.ring) { ctx.lineWidth = ringW; ctx.strokeStyle = opts.ring; roundRect(ctx, x - ringW / 2, y - ringW / 2, w + ringW, h + ringW, (h + ringW) / 2); ctx.stroke(); }

  let cx = x + padX;
  ctx.textBaseline = 'middle';
  for (const p of parts) {
    ctx.font = `${p.weight} ${p.size}px ${fam}`;
    ctx.fillStyle = ink; ctx.globalAlpha = p.alpha ?? 1;
    ctx.fillText(p.text, cx, y + h / 2 + 0.5);
    cx += ctx.measureText(p.text).width + 4;
  }
  ctx.globalAlpha = 1;
  return { width: c.width, height: c.height, data: new Uint8Array(ctx.getImageData(0, 0, c.width, c.height).data.buffer), pixelRatio: pr };
}

export function installPinFactory(map: MlMap) {
  map.on('styleimagemissing', (e) => {
    const id = e.id;
    if (map.hasImage(id)) return;
    const [kind, a, b, theme, sel] = id.split('|');
    const t = COLORS[(theme as 'light' | 'dark') ?? 'light'] ?? COLORS.light;
    let img;
    if (kind === 'pin') {
      const band = Number(b) as 0 | 1 | 2;
      img = draw([{ text: price(Number(a)), weight: 750, size: 13.5 }], t.band[band], t.bandInk[band], {
        ring: sel ? t.ring : undefined, border: band === 1 ? t.border : undefined,
      });
    } else if (kind === 'cl') {
      // Grupo: color según lo barato que sea su mínimo; los de precio habitual, en azul de marca.
      const band = Number(sel ?? 1) as 0 | 1 | 2;
      const bg = band === 1 ? t.cluster : t.band[band];
      img = draw([{ text: `${b}`, weight: 500, size: 11.5, alpha: 0.75 }, { text: `desde ${price(Number(a))}`, weight: 700, size: 13 }], bg, '#ffffff', {});
    } else return;
    map.addImage(id, { width: img.width, height: img.height, data: img.data }, { pixelRatio: img.pixelRatio });
  });
}
