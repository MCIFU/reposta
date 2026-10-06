# 06 · Fase 1: MVP «Encuentra dónde repostar»

Estado: **completada** (06/10/2026). Todos los datos que muestra la aplicación son reales (MITECO, CartoCiudad/IGN y OpenStreetMap). No hay datos de demostración.

## Qué hay

| Función | Detalle |
|---|---|
| Combustible | 95, 98, Diésel y GLP en el selector principal, más 10 combustibles en «Otros» (AdBlue, HVO, GNC/GNL por kg, hidrógeno…). Se recuerda entre visitas. |
| Ubicación | Mi ubicación (GPS + nombre de calle por geocodificación inversa), búsqueda de ciudad, código postal o dirección (CartoCiudad, con teclado completo) y «Buscar en esta zona» desde el mapa. El último lugar se recuerda en el dispositivo. |
| Resultados | La más barata en grande con la coma de marca, veredicto «¿Me compensa?» frente a la más cercana, resumen del rango de precios del radio, orden por precio o distancia, radio de 3 a 50 km y filtro «Abiertas ahora» (horario interpretado en el 100 % de las 11.471 estaciones). |
| Cada fila | Marca normalizada, dirección legible, distancia y tiempo estimados (≈), estado de apertura, veredicto de ahorro y «Cómo llegar» (Google Maps). |
| Mapa | MapLibre con estilo propio (claro y oscuro). Todas las estaciones son puntos coloreados por precio relativo a lo que se ve en pantalla. Las etiquetas de precio colisionan dando prioridad a la más barata, los grupos muestran «desde X» y la más barata del radio lleva siempre el anillo ámbar. |
| Ficha | Panel (hoja inferior en móvil, lateral en escritorio) y página compartible `/estacion/[id]` con metadatos SEO: precio frente a la media de España, todos los combustibles, **histórico oficial de 30 días** (gráfico propio interactivo), horario semanal y fuente. |
| Ajustes | Litros y consumo para «¿Me compensa?», guardados en el dispositivo. |
| Estados | Esqueletos de carga, vacío útil (propone el radio que incluye la gasolinera más cercana), error con reintento, mapa degradable (si falla, la lista sigue funcionando) y aviso de dato no actualizado. |
| Confianza | «Precios oficiales hace X min» en cada vista y página «Sobre los datos» con fuentes y metodología. |
| PWA | Manifiesto e iconos: instalable en Android desde el navegador. |

## Arquitectura implementada

- `packages/core`: catálogo de combustibles, normalización MITECO, horarios, geografía, estadísticas y ahorro. Sin DOM (se reutilizará en Android). **18 tests.**
- `apps/web/src/server/repository.ts`: **la única interfaz de datos** que conoce la aplicación. Su implementación actual es en memoria sobre la instantánea de MITECO (rejilla espacial de unos 11 km, consultas cercanas en milisegundos) y se sustituirá por PostgreSQL + PostGIS sin tocar la interfaz.
- `snapshot.ts`: refresco cada 30 min sin bloquear (stale-while-revalidate), arranque en frío desde disco y copia comprimida de cada descarga en `data/snapshots/` (auditoría y semilla del histórico intradía).
- `history.ts`: histórico de 30 días bajo demanda, desde el endpoint oficial por municipio, con caché en disco.
- API: `/api/stations/nearby`, `/api/stations/:id`, `/api/stations/:id/history`, `/api/map/points`, `/api/geocode` (+`/find`, `/reverse`), `/api/summary` y `/api/health`.

## Autocomprobación (resultados medidos)

| Comprobación | Resultado |
|---|---|
| Tests de dominio | 18/18 |
| TypeScript estricto y build de producción | Sin errores |
| Accesibilidad (axe-core 4.10): inicio, resultados, ficha y «Sobre los datos», en claro y oscuro | **0 violaciones** |
| Lighthouse móvil: inicio / resultados / ficha | Rendimiento 97 / 97 / 97 · Accesibilidad 100 · Buenas prácticas 100 · SEO 100 |
| Lighthouse escritorio: resultados con mapa | Rendimiento 100 (LCP 0,6 s, TBT 30 ms, CLS 0,007) |
| Respuesta de la API cercana (servidor caliente) | ~7–180 ms |
| Puntos del mapa | 120 KB comprimidos (antes 327 KB) |
| Dato cruzado con la fuente | Histórico de la estación 962 comprobado directamente contra MITECO (27/09: 2,069 · 30/09: 2,059 · 01/10: 1,869) |

### Errores encontrados y corregidos durante la revisión

1. El *worker* de MapLibre 6 no cargaba con Turbopack: ahora se sirve desde `/public` con `setWorkerUrl`.
2. Las capas de precio no se creaban por umbrales `step` no crecientes en el primer render.
3. Las etiquetas se amontonaban en Madrid (209 estaciones) o, al revés, desaparecían, incluida la más barata. Se rediseñó en dos niveles: puntos siempre visibles y etiquetas con prioridad a la más barata en una sola capa.
4. Los grupos salían siempre verdes a escala nacional: ahora tienen sus propios terciles.
5. El encuadre se cancelaba si el contenedor cambiaba de tamaño durante la animación: ahora es un encuadre «vivo» que se respeta salvo que el usuario mueva el mapa.
6. Contraste AA insuficiente del verde y del rojo en texto pequeño: se crearon tokens `--ok-ink` y `--bad-ink`.
7. 3,1 s de bloqueo del hilo principal en móvil: el mapa ahora se monta solo cuando hace falta (rendimiento de 66 a 97).
8. Calidad del dato: localidades en mayúsculas sin tildes («GIJON» → «Gijón»), carreteras («As -2» → «AS-2») y restos como «(gasolinera)» en las direcciones.
9. Una expresión regular con caracteres de control invisibles impedía la compresión gzip.

## Limitaciones conocidas (honestas)

- **Distancias y tiempos estimados** (línea recta × factor). Se marcan con «≈». Rutas reales: fase 3 (OSRM propio).
- **Sin base de datos todavía:** la instantánea vive en memoria y en `data/`. En un despliegue *serverless* cada instancia descargaría la suya, así que hace falta PostgreSQL (fase 2) antes de producción.
- **Histórico de la ficha limitado a 30 días** y calculado bajo demanda: la primera apertura de un municipio tarda 1–3 s; después sale de la caché.
- **Páginas SEO por municipio:** pendientes. Las fichas de estación ya tienen metadatos.
- Probado en Edge/Chromium. Falta probar en Safari iOS y Firefox, y en un Android real.

## Cómo ejecutarlo

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # tests de dominio
npm run build      # build de producción
```

## Añadido el 06/10/2026: sección «Histórico» (`/historico`)

Muestra la evolución semanal del precio medio oficial en España desde enero de 2005 (Comisión Europea, Weekly Oil Bulletin) para gasolina 95, diésel y GLP, con y sin impuestos. Incluye:

- Periodos de 3 meses, 1 año, 5 años y todo el histórico, o un rango de años elegido («desde» y «hasta»).
- Varios combustibles en el mismo eje.
- Cursor con el valor de cada semana; también se recorre con el teclado.
- Resumen del periodo: último, media, mínimo y máximo con fecha, y variación.
- Tabla de medias anuales.

Paleta de series validada para daltonismo y contraste en ambos temas. axe: 0 violaciones. El boletín se descarga una vez al día y se guarda en `data/oil-bulletin.json`.

## Añadido el 06/10/2026: navegación por pestañas, Viaje y Datos

- **Pestañas:** Precios, Histórico, Viaje y Datos, más el botón de tema. En escritorio van en la cabecera; en móvil, en una barra inferior con iconos.
- **Precios:** el mapa con precios es la pantalla principal también en móvil (con dos dedos se mueve el mapa y con uno se desplaza la página). Arriba se muestra la fecha del día y la hora de la última publicación oficial. El selector de combustible tiene 5 casillas idénticas (95, 98, Diésel, GLP y Otros).
- **Viaje** (`/viaje`): origen y destino, hasta 8 paradas, invertir e ida y vuelta.
  - Ruta real por carretera con OSRM (configurable con `REPOSTA_ROUTING_URL`).
  - Resultado: coste, km, tiempo, litros, coste cada 100 km, coste por persona, autonomía y repostajes según el depósito, y desglose por tramos.
  - Las 5 gasolineras más baratas a menos de 2 km de la ruta, con su punto kilométrico.
  - **Tu coche:** marca, modelo y versión de un catálogo oficial de 3.559 versiones (EEA, matriculadas en España entre 2021 y 2024) con consumo WLTP, motor, masa y unidades matriculadas. Se genera con `node tools/build-vehicles.mjs`.
  - La ruta queda en la URL para compartirla.
- **Datos** (`/datos`): sustituye a «Sobre los datos», que redirige a esta página. Muestra el estado en vivo de cada fuente, sus licencias y la metodología.
- **Verificación:** axe sin violaciones en las 4 pestañas (escritorio y móvil, claro y oscuro), build de producción correcto y prueba funcional del selector de coche (SEAT Ibiza 1.0 de 110 CV: 4,9 L/100 km; Gijón–León–Madrid, 481 km, 42,78 €).

**Pendiente:** OSRM propio antes de producción, ya que el servidor público no admite uso intensivo. La capacidad del depósito no está en la fuente oficial, así que la indica el usuario.

## Añadido: alertas de cambio de precio (sin cuenta)

- **Campana en la cabecera** con el número de avisos sin leer y un panel con los cambios recientes y las alertas activas.
- **Tipos de alerta:**
  - una gasolinera concreta («Avisarme si cambia», desde su ficha);
  - la más barata de tu zona (último lugar buscado, radio de 5 a 30 km), cuando cambie o cuando baje de un precio.
- **Funcionamiento:** las alertas se guardan en el dispositivo (`localStorage`) y se comprueban al abrir REPOSTA, cada 15 minutos y al volver a la pestaña, a través de `POST /api/alerts/check`. Avisan con un mensaje dentro de la app y, si el usuario lo permite, con una notificación del sistema mientras la pestaña está abierta.
- **Limitación:** con la app cerrada no llegan avisos. Para eso harían falta notificaciones push desde un servidor con las alertas guardadas.
