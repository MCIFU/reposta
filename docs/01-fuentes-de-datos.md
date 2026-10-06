# 01 · Fuentes de datos

> Fase 0 · Investigación verificada el **02/10/2026** contra los servicios reales.
> Las cifras se reproducen con `node tools/probe-sources.mjs`.

## Resumen

| Necesidad | Fuente elegida | Estado |
|---|---|---|
| Precios actuales por estación | MITECO · Servicio REST de carburantes | ✅ Verificado |
| Gasolineras, coordenadas, horario, rótulo | MITECO · mismo servicio | ✅ Verificado |
| Histórico diario por estación | MITECO · `EstacionesTerrestresHist/{fecha}` | ✅ Verificado desde 01/01/2007 |
| Catálogo de combustibles | MITECO · `Listados/ProductosPetroliferos` | ✅ 30 productos |
| CCAA / provincias / municipios | MITECO · `Listados/*` + códigos INE vía CartoCiudad | ✅ (requiere mapeo) |
| Geocodificación (ciudad, CP, dirección) | IGN · CartoCiudad | ✅ Verificado |
| Serie semanal nacional y comparación UE | Comisión Europea · Weekly Oil Bulletin | ✅ Desde 2005 |
| Mapa base | OpenFreeMap (OSM) + MapLibre | ✅ Verificado |
| Rutas / tiempos | Enlace profundo a Google Maps/Waze; motor propio más adelante | ⚠️ Ver limitaciones |

---

## 1. MITECO · Servicio REST de precios de carburantes (fuente principal)

- **Organismo:** Ministerio para la Transición Ecológica y el Reto Demográfico (MITECO). Es el servicio que alimenta el *Geoportal de Gasolineras*.
- **URL base:** `https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/`
- **Documentación:** `…/PreciosCarburantes/help`
- **Catálogo nacional:** [datos.gob.es · Precio de carburantes en las gasolineras españolas](https://datos.gob.es/en/catalogo/e05068001-precio-de-carburantes-en-las-gasolineras-espanolas)
- **Formato:** JSON (cabecera `Accept: application/json`) o XML. Sin clave de API ni registro.
- **Origen legal del dato:** las estaciones están obligadas a comunicar sus precios al Ministerio cuando los cambian (art. 5 del RDL 6/2000 y Orden ITC/2308/2007). La CNMC sanciona los retrasos en esa comunicación.

### Endpoints (todos GET)

| Grupo | Ruta |
|---|---|
| Actual | `EstacionesTerrestres/` · `/FiltroCCAA/{IDCCAA}` · `/FiltroProvincia/{IDProvincia}` · `/FiltroMunicipio/{IDMunicipio}` · `/FiltroProducto/{IDProducto}` · combinaciones `…Producto/{id}/{IDProducto}` |
| Histórico | `EstacionesTerrestresHist/{dd-mm-aaaa}` y los mismos filtros con `{FECHA}` delante |
| Listados | `Listados/ComunidadesAutonomas/` · `Listados/Provincias/` · `Listados/ProvinciasPorComunidad/{IDCCAA}` · `Listados/Municipios/` · `Listados/MunicipiosPorProvincia/{IDProvincia}` · `Listados/ProductosPetroliferos/` |
| Marítimo | `PostesMaritimos/…`: fuera del alcance del MVP |

### Campos de cada estación (verificado)

`IDEESS` (id estable de estación) · `Rótulo` (marca comercial, texto libre) · `Dirección` · `C.P.` · `Localidad` · `Municipio` · `Provincia` · `IDMunicipio` · `IDProvincia` · `IDCCAA` · `Latitud` / `Longitud (WGS84)` (**con coma decimal**) · `Horario` (texto libre, p. ej. `L-D: 07:00-22:00`) · `Margen` (D/I respecto a la vía) · `Remisión` · `Tipo Venta` (P = público, R = restringido) · `% BioEtanol` · `% Éster metílico` · 23 columnas `Precio <producto>` (cadena vacía si no lo vende).

### Lo que medimos

| Métrica | Valor |
|---|---|
| Estaciones hoy | **11.471** |
| Tamaño de la respuesta completa | **12,1 MB** (sin gzip: el servidor no comprime) |
| Latencia | ~3 s |
| Marca de tiempo del dato | campo `Fecha` (`02/10/2026 19:03:08`): se regenera aproximadamente cada 30 min |
| Combustibles con precio hoy | G95 E5: 10.900 · Gasóleo A: 11.256 · G98 E5: 5.486 · GLP: 998 · AdBlue: 2.946 · Diésel renovable: 1.617 · Hidrógeno: 2… |
| Rótulos distintos | **3.584** (REPSOL 2.739, MOEVE 592, CEPSA 565, GALP 450, BALLENOIL 420…) |
| Precios que cambian de un día a otro | **54,7 %** (30/09 → 01/10/2026, 42.860 pares estación-combustible) |

### Histórico: lo que existe realmente

`EstacionesTerrestresHist/{fecha}` devuelve **una instantánea diaria completa por estación** (a las 00:00):

| Fecha | Estaciones | Media G95 | Media Gasóleo A |
|---|---|---|---|
| 01/01/2006 | **0 (sin datos)** | n/d | n/d |
| 01/01/2007 | 7.202 | 0,956 € | 0,901 € |
| 01/01/2015 | 9.238 | 1,153 € | 1,106 € |
| 01/01/2020 | 10.305 | 1,314 € | 1,241 € |
| 01/10/2026 | 11.484 | 1,820 € | n/d |

**Conclusión:** existe un histórico diario por estación desde el **1 de enero de 2007**, unos 7.200 días. Es la base de la parte de datos de REPOSTA y es mucho más rico de lo que suele creerse.

> Nota: en estas filas «Media» es una **media simple calculada por REPOSTA** sobre todas las estaciones, no ponderada por ventas. No es una cifra oficial y se etiquetará así en el producto.

### Limitaciones y trampas detectadas

1. **Sin gzip y 12 MB por llamada.** Se debe consultar desde nuestro backend, nunca desde el cliente. Las apps de usuario jamás llaman al Ministerio.
2. **Números con coma decimal** y coordenadas como texto. Hay que normalizarlos al ingerir.
3. **Unidades distintas por producto.** Hidrógeno, GNC, GNL y biogás se venden **por kg** (de ahí los 17,45 € de media del hidrógeno). El resto, por litro. `FuelType` necesita un campo `unit`.
4. **El Gasóleo B es agrícola** (no apto para turismos). Se excluye de las búsquedas de usuario aunque se almacene.
5. **«Gasolina 95» son en realidad 4 productos:** E5, E10, E25 y E85. El MVP usará `G95 E5` como «Gasolina 95», con la variante visible en la ficha.
6. **Valores atípicos reales** (gasóleo a 0,583 € en 2007, AdBlue a 3,41 €). Las estadísticas deben recortar extremos (ver `04-calculos.md`) y mostrar los récords individuales con advertencia.
7. **`IDMunicipio` es un id interno del Ministerio, no el código INE.** Se mapea por geocodificación inversa de la estación con CartoCiudad, y por provincia + nombre normalizado como respaldo.
8. **El histórico refleja metadatos actuales.** La instantánea de 2007 muestra direcciones y rótulos que no tienen por qué ser los de entonces (las marcas cambian: CEPSA → MOEVE). Guardaremos la marca observada en cada ingesta diaria a partir de ahora.
9. **El histórico es diario (00:00), no intradía.** A partir de nuestra puesta en marcha capturaremos además cada actualización de ~30 min.
10. **Sin SLA ni límites de uso publicados.** Haremos la descarga histórica de forma pausada (1 petición cada pocos segundos) y una sola vez. Ver riesgos.
11. **El rótulo es texto libre.** Hay que normalizar marcas (`REPSOL`, `Repsol`, `E.S. REPSOL`…) con una tabla de alias.

### Licencia

Es un dato publicado por la Administración General del Estado, sujeto al régimen general de reutilización de la información del sector público (Ley 37/2007 y RD 1495/2011): se permite la reutilización, incluida la comercial, **citando la fuente y la fecha de actualización** y sin desnaturalizar el dato. El catálogo de datos.gob.es lo publica como dato abierto.
**Pendiente antes del lanzamiento público:** confirmar por escrito el texto exacto del aviso legal del Geoportal. Mientras tanto, cada pantalla mostrará «Fuente: MITECO · actualizado dd/mm hh:mm».

---

## 2. IGN · CartoCiudad (geocodificación oficial)

- **URL:** `https://www.cartociudad.es/geocoder/api/geocoder/`
- **Operaciones verificadas:**
  - `candidates?q=gijon&limit=5`: autocompletado (municipios, poblaciones, viales, CP…). Devuelve código INE (`muniCode` 33024) pero **sin coordenadas**.
  - `find?q=33201&type=Codpost`: coordenadas del código postal (verificado: 43.5444, −5.6623). Con `type=Municipio` devuelve el **polígono** del municipio.
  - `reverseGeocode?lon=…&lat=…`: dirección más cercana, municipio y código INE (verificado: «CABRALES · Gijón (33024)»).
- **Formato:** JSON. Sin clave. **Coste:** gratuito.
- **Licencia:** datos del IGN/CNIG bajo CC BY 4.0 (atribución «© Instituto Geográfico Nacional»).
- **Uso en REPOSTA:** buscador «ciudad / código postal / dirección», mapeo de estaciones a código INE y polígonos para el mapa de municipios.
- **Limitación:** es un servicio público sin SLA. Cachearemos agresivamente: CP y municipios cambian muy poco.

## 3. Comisión Europea · Weekly Oil Bulletin

- **URL:** [energy.ec.europa.eu · Weekly Oil Bulletin](https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en) · [Histórico .xlsx desde 2005](https://energy.ec.europa.eu/document/download/906e60ca-8b6a-44e7-8589-652854d2fd3f_en?filename=Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx) (4,5 MB, verificado)
- **Contenido:** precio medio **nacional semanal** (con y sin impuestos) de Euro‑super 95, gasóleo de automoción y GLP, para España (`ES_price_with_tax_euro95`…) y el resto de la UE, en €/1000 L. Último dato verificado: 28/09/2026, España G95 = 1.939,7 €/1000 L.
- **Licencia:** política de reutilización de la Comisión (Decisión 2011/833/UE, CC BY 4.0).
- **Uso:** (a) serie oficial ponderada para contrastar nuestras medias calculadas; (b) 2005‑2006, antes del histórico MITECO; (c) a futuro, la comparativa «España vs UE». Siempre etiquetada como **«Media oficial semanal (UE)»**, separada de las medias que calcula REPOSTA.

## 4. Mapas

| Opción | Coste | Veredicto |
|---|---|---|
| **MapLibre GL JS + OpenFreeMap** | 0 €, sin clave, uso comercial permitido, sin límite de visitas | ✅ **Elegida para el MVP** |
| Protomaps (PMTiles de España en Cloudflare R2) | ~0–5 €/mes | ✅ Plan B y autoalojamiento si OpenFreeMap falla |
| Mapbox | De pago por cargas de mapa | ❌ Coste variable y dependencia |
| Google Maps JS | De pago, estilo poco personalizable | ❌ |
| IGN (WMTS raster) | Gratis | Solo como capa ortofoto opcional |

MapLibre permite un **estilo propio** (clave para la identidad visual), marcadores con precio pintados en WebGL (11.000 puntos sin problema gracias a capas *symbol* y *clustering*) y tiene SDK nativo para Android con la misma especificación de estilo.

OpenFreeMap **no** ofrece geocodificación ni rutas. Para eso usamos CartoCiudad y lo indicado a continuación.

## 5. Rutas y tiempos

- **Botón «Cómo llegar»:** enlace profundo a Google Maps (`https://www.google.com/maps/dir/?api=1&destination=lat,lng`), Apple Maps o Waze. Gratis, sin API y con la mejor navegación posible para el usuario.
- **Distancia y tiempo en listados:** distancia en línea recta × factor de tortuosidad (≈1,3 urbano / 1,2 interurbano) y velocidad media por tipo de vía. Se etiqueta como **«≈ estimado»**.
- **Distancia real para «¿Me compensa?»** (solo las 5 mejores opciones): el servidor público de OSRM (`router.project-osrm.org`) funciona (verificado), pero **su política prohíbe el uso en producción**. Opciones:
  - OpenRouteService: clave gratuita con cupo diario limitado, válido para la beta.
  - **OSRM autoalojado con el extracto de España de OSM** (~2–4 GB de RAM, ~10–20 €/mes): la recomendación a partir de la fase 3.

## 6. Fuentes descartadas o secundarias

- **Scraping de webs comerciales de comparadores:** descartado. Existe fuente oficial.
- **CNMC (informes de supervisión de carburantes):** útil como contexto editorial (márgenes, informes), no como serie. Se citará en los textos.
- **INE (IPC de carburantes):** índices, no precios. Opcional para «precio real ajustado por inflación» en la fase 3.
- **Datos de electricidad (puntos de recarga):** no forman parte de este servicio. La arquitectura `FuelType` lo admite. Fuente candidata a investigar en su momento: el Punto de Acceso Nacional de tráfico (NAP/DGT) para puntos de recarga.
