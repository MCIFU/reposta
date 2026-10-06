# 05 · Plan maestro de REPOSTA

> «Cuánto cuesta, dónde cuesta menos, cuánto ha costado, cómo evoluciona y cuánto puedes ahorrar tú.»

## Conclusiones de la fase 0

1. **Los datos existen, son oficiales y son mejores de lo esperado.** MITECO publica en tiempo real unas 11.500 estaciones con 23 productos, **y un histórico diario por estación desde el 01/01/2007**. No hace falta scraping ni inventar nada.
2. **El histórico es el gran diferenciador.** Casi todas las apps del sector solo enseñan el precio de hoy. Con unos 260 millones de puntos podemos ser la referencia del análisis de precios en España.
3. **El reto técnico no es la cantidad de datos, sino servirlos bien.** Series mensuales empaquetadas y agregados precalculados en Postgres bastan, sin infraestructura exótica.
4. **«¿Me compensa?» es la función estrella**, y la cuenta ya demuestra su valor: en el ejemplo del briefing, la gasolinera más barata **no compensa** (−0,53 €).
5. **Coste de arranque: 0 €.** Lanzamiento: unos 50–60 €/mes.

## Fases

Cada fase termina con la **autocomprobación** (punto 23 del briefing): ejecución real, responsive (360/768/1280/1920), accesibilidad (teclado, contraste AA, lector de pantalla), estados de carga, vacío y error, rendimiento (Lighthouse ≥ 90 en móvil, LCP < 2,5 s) y revisión visual crítica en navegador, iterando hasta cumplir.

### Fase 0 · Investigación y arquitectura ✅ *(esta entrega)*
Fuentes verificadas · arquitectura · stack · modelo de datos validado · cálculo de ahorro con tests · identidad visual · plan.

### Fase 1 · MVP «Encuentra dónde repostar» ✅ *(ver [06-fase-1-mvp.md](06-fase-1-mvp.md))*
- Monorepo (`apps/web`, `packages/core`, `packages/tokens`, `services/ingest`).
- Ingestor de tiempo real (cada 30 min) → Postgres + R2.
- API: `/api/stations/nearby?lat&lng&fuel&radius&sort` y `/api/stations/:id`.
- Inicio: combustible (recordado) → ubicación / ciudad / CP (CartoCiudad) / mapa → lista de las más baratas con precio, distancia «≈», tiempo «≈», dirección, horario, «actualizado hace X min» y «Cómo llegar».
- Mapa MapLibre con estilo propio: marcadores con precio, color por precio relativo a la zona visible, clústeres «desde 1,389», radio, mi ubicación y filtros.
- Ficha de estación: precios de todos sus combustibles y gráfico de 30 días (con los datos del backfill parcial).
- «¿Me compensa?» integrado en la lista (comparando con la más cercana).
- PWA instalable. SEO: páginas `/precio/[combustible]/[provincia]/[municipio]`.
- **Hecho cuando** hay datos reales en producción, búsqueda → resultado en < 3 s en un 4G simulado y se supera la autocomprobación.

### Fase 2 · Histórico
- Backfill completo 2007 → hoy (reanudable) y la ingesta diaria del histórico.
- `territory_daily_stats` / `monthly` y la serie oficial de la UE.
- Explorador: España → CCAA → provincia → municipio → estación, con selector de periodo (7 d, 30 d, 3 m, 1 a, 5 a, todo, rango personalizado año/mes).
- Gráfico temporal (uPlot) con banda p10–p90, mínimo y máximo, y anotaciones de hitos (p. ej. la bonificación de 20 cts de 2022, con fuente oficial).
- **Hecho cuando** los datos cuadran con las instantáneas de origen (prueba automática de muestreo) y el gráfico 2007‑hoy carga en < 1 s.

### Fase 3 · Análisis
- «Precio hoy» (media, mínimo, máximo, Δ1d/7d/30d/interanual).
- Comparador (territorios × combustibles × periodos, superposición por día del año).
- Récords con fuente y fecha.
- Rankings informativos (CCAA y provincias, low‑cost frente a marcas tradicionales).
- Motor de rutas propio (OSRM con el extracto de España) para distancias reales y el modo «de camino».

### Fase 4 · Usuario
- Supabase Auth (enlace mágico + Google), migración de los datos locales a la cuenta.
- Mi coche (varios vehículos), Mis repostajes (alta en 10 s, con la estación sugerida por ubicación y el precio prefijado), estadísticas personales (consumo real, €/100 km, gasto mensual y ahorro frente a la media provincial).
- Exportar e importar CSV. Borrado de cuenta (RGPD).

### Fase 5 · Alertas
- Favoritas.
- Alertas: precio de estación < X, estación a < N km con precio < X, media territorial < X, variación de la media ≥ N % **respecto a la media de los 30 días anteriores** (hay que definir la base, ver abajo).
- Evaluación en cada ingesta. Entrega por Web Push y correo; FCM en la fase 6. Cooldown por alerta.

### Fase 6 · App Android
- Expo + MapLibre Native, reutilizando `core`, `api-client` y `tokens`. Misma cuenta (Supabase).
- Push FCM, ubicación en primer plano y widget «precio de mis favoritas».
- Publicación en Google Play (ficha, política de privacidad, prueba cerrada con 12 testers durante 14 días, requisito actual de Google para cuentas de desarrollador personales).

## Dónde propongo cambiar el briefing (y por qué)

| Briefing | Propuesta | Motivo |
|---|---|---|
| «Grandes botones/cards» de combustible en el inicio | **Selector compacto** recordado entre visitas. Las tarjetas grandes solo en la primera visita. | El 95 % de las visitas repite combustible. Cada visita ahorra un toque y la pantalla deja el protagonismo al resultado. |
| Precio sobre todos los marcadores | **Precio en los marcadores a partir de zoom de barrio; clústeres «desde X» por debajo** | 11.500 etiquetas a nivel España son ilegibles y lentas. |
| «Gasolina 95» | = **G95 E5**, con la variante (E10, Premium) visible en la ficha | La fuente distingue 5 productos 95. |
| «Avísame cuando Asturias baje un 5 %» | Definir la base: **frente a la media de los 30 días anteriores** (o al valor al crear la alerta) | Sin base, la alerta es ambigua o se dispara una y otra vez. |
| Electricidad como combustible | Preparado en el modelo (`unit = 'kWh'`), **pero con otra fuente y otra UX** (potencia, conectores) | Los puntos de recarga no están en el servicio de MITECO. |
| Registro para usar la app | **Sin cuenta hasta que aporte valor** | La cuenta solo se pide para sincronizar. Menos fricción, más retención. |
| Logos de marcas en las estaciones | **Nombres en texto**, sin logos de terceros | Riesgo de marcas registradas y coherencia visual. |

## Oportunidades que no estaban en el briefing

1. **Páginas SEO por municipio y provincia** («precio gasolina Gijón hoy»): canal de adquisición gratuito y enorme. Next.js con ISR las genera sin coste.
2. **«Mejor día de la semana para repostar»**: el histórico diario permite medir el efecto del día de la semana por zona, con datos y no con mitos.
3. **Precio real ajustado a la inflación** (IPC del INE): «el máximo de 2022 en euros de hoy».
4. **Desglose de impuestos** con el Weekly Oil Bulletin (con y sin impuestos): «de cada litro, X € son impuestos».
5. **Embeds y API pública de datos agregados** para medios: autoridad de marca y enlaces entrantes.
6. **Consumo real medido** desde los repostajes, más fiable que el homologado, que alimenta automáticamente «¿Me compensa?».

## Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| MITECO cambia o corta el servicio (sin SLA) | Media | Alto | Archivo crudo en R2, alertas de ingesta fallida, interfaz con la hora real del último dato, parser tolerante y tests de contrato diarios. |
| Bloqueo por volumen durante el backfill | Baja | Medio | Una petición cada 5–10 s, reanudable y de noche. Contacto previo con el Ministerio si hace falta. |
| Licencia de reutilización no explícita en el Geoportal | Baja | Alto | Confirmarla por escrito antes del lanzamiento público. Atribución visible siempre. |
| Errores en datos de origen (precios absurdos) | Alta | Medio | Reglas de calidad (`03`), medias recortadas y récords con la marca «precio individual». |
| OpenFreeMap sin SLA | Media | Medio | Estilo portable: cambio a PMTiles propios en R2 en menos de un día. |
| Coste de rutas reales | Media | Bajo | Estimación «≈» en listas y rutas reales solo bajo demanda. OSRM propio desde la fase 3. |
| Normalización de 3.584 rótulos | Alta | Bajo | Tabla de alias. Las 30 marcas principales cubren más del 80 % de las estaciones. |
| Mapeo municipio MITECO → INE | Media | Medio | Geocodificación inversa por coordenadas con CartoCiudad y cruce por nombre como respaldo. |
| Requisitos de Google Play (testers y política de ubicación) | Media | Medio | Planificar la prueba cerrada en paralelo a la fase 5. |

## Lo que necesito de ti para empezar la fase 1

1. **Cuentas** (crearlas debes hacerlo tú): Supabase, Vercel, Cloudflare (R2) y GitHub. Para el desarrollo local no hacen falta todavía.
2. **Docker Desktop** instalado, para Postgres + PostGIS en local (ahora mismo no está en el equipo).
3. **Validar las propuestas** de la tabla «Dónde propongo cambiar el briefing».
4. **Dominio** (p. ej. reposta.es o .app): comprobar disponibilidad y registrarlo.
