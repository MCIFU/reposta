# REPOSTA

**Tu combustible. Tu precio. Tus datos.**

Plataforma para consultar, comparar y entender los precios del combustible en España. Responde a cuánto cuesta, dónde cuesta menos, cuánto ha costado, cómo evoluciona y cuánto puedes ahorrar tú.

## Estado

- **Fase 0, investigación y arquitectura:** completada.
- **Fase 1, MVP «Encuentra dónde repostar»:** completada. Ver [docs/06-fase-1-mvp.md](docs/06-fase-1-mvp.md).

## Documentación

| Documento | Contenido |
|---|---|
| [docs/01-fuentes-de-datos.md](docs/01-fuentes-de-datos.md) | Fuentes oficiales verificadas (MITECO, CartoCiudad, Weekly Oil Bulletin), campos, frecuencia, limitaciones y licencias |
| [docs/02-arquitectura-y-stack.md](docs/02-arquitectura-y-stack.md) | Arquitectura, stack razonado, mapas, auth, despliegue, costes y Android |
| [docs/03-modelo-de-datos.md](docs/03-modelo-de-datos.md) | Entidades, estrategia para unos 260 M de puntos históricos, pipeline de ingesta y calidad del dato |
| [docs/04-calculos.md](docs/04-calculos.md) | Estadísticas, récords, «¿Me compensa?» y estadísticas personales |
| [docs/05-plan-maestro.md](docs/05-plan-maestro.md) | Fases 1–6, cambios propuestos al briefing, oportunidades y riesgos |
| [db/schema.sql](db/schema.sql) | Esquema PostgreSQL + PostGIS (validado) |
| [packages/core](packages/core) | Lógica compartida web/Android: cálculo de ahorro real y formatos (con tests) |
| [packages/tokens/tokens.css](packages/tokens/tokens.css) | Design tokens |
| [brand/index.html](brand/index.html) | Identidad visual «La coma» |
| [docs/06-fase-1-mvp.md](docs/06-fase-1-mvp.md) | Qué se construyó en la fase 1, resultados de la autocomprobación y limitaciones |
| [apps/web](apps/web) | Aplicación web (Next.js): buscador, mapa, ficha y API |

## Comandos

```bash
npm install
npm run dev                    # aplicación en http://localhost:3000
npm test                       # tests de dominio (Node ≥ 22.6)
npm run build                  # build de producción
npm run probe                  # verifica las fuentes oficiales en vivo
node tools/cdp-shot.mjs <url> <png> [ancho] [alto] [light|dark]   # capturas para revisión visual
```

## Reglas del proyecto

- Ningún dato inventado. Cada cifra muestra su fuente y su hora.
- Precio actual, precio histórico, media calculada por REPOSTA y media oficial externa se presentan siempre por separado.
- Si alguna vez se necesitan datos simulados, se marcan como **DATOS DE DEMOSTRACIÓN**.
