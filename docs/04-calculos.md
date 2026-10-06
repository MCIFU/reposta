# 04 · Cálculos: estadísticas y ahorro real

## A. Estadísticas territoriales (medias de REPOSTA)

Para cada `(territorio, combustible, día)`:

| Métrica | Definición |
|---|---|
| `station_count` | Estaciones con precio válido ese día. |
| `avg` | **Media recortada p2–p98** (descarta el 2 % de cada extremo: errores de introducción y estaciones restringidas). |
| `median`, `p10`, `p90` | Percentiles. El rango p10–p90 es la banda «precio habitual» de los gráficos. |
| `min`, `max` | Extremos **reales**, con la estación asociada. Se muestran con «precio individual» para no confundirlos con la media. |

- **No ponderada por ventas:** la fuente no publica volúmenes. Se dice explícitamente («media simple de estaciones») y se contrasta con la media oficial semanal de la UE, que sí pondera.
- **Variaciones:** `Δ1d`, `Δ7d`, `Δ30d` y `Δ interanual` = media(día) − media(día − n), en € y en %. Si falta el día exacto (falló una ingesta) se usa el último día anterior disponible **y se indica**.
- **Diferencia frente a España:** `avg(territorio) − avg(España)` el mismo día.
- **Agregación temporal** para periodos largos: los gráficos de más de 2 años usan la media semanal y los de más de 8 años la mensual. El selector lo indica («Media mensual»).
- **Comparación entre periodos** («2015 vs 2020 vs 2026»): se superponen series por día del año (eje enero‑diciembre).

## B. Récords

Se recalculan cada noche sobre `territory_daily_stats` y `price_month`:

| Récord | Cálculo | Se muestra con |
|---|---|---|
| Mínimo / máximo histórico de la **media** | min/max de `avg` (España) | Fecha · combustible · «Media REPOSTA» |
| Precio individual mínimo / máximo | min/max de `price_month`, sin valores sospechosos | Fecha · estación · municipio |
| Mayor subida / bajada diaria | max/min de `avg(d) − avg(d−1)` | Fecha · Δ € · Δ % |
| Día de mayor variación | max \|Δ\| | Fecha |
| CCAA / provincia más barata y más cara | ranking de la media del periodo elegido | Periodo · n estaciones |

Todos llevan `source_id` (MITECO o «calculado por REPOSTA a partir de MITECO»), periodo evaluado y fecha de cálculo. **Ningún récord se escribe a mano.**

## C. «¿Realmente me compensa?»

Implementado y probado en [`packages/core/src/savings.ts`](../packages/core/src/savings.ts) (8 tests en verde).

```
ahorro bruto        = cantidad × (precio_ref − precio_cand)
km extra            = ida y vuelta: 2 × (d_cand − d_ref) · de camino: desvío_cand − desvío_ref
combustible extra   = km extra × consumo / 100
coste desplazamiento= combustible extra × precio_cand
coste tiempo        = min extra / 60 × valor_tiempo (opcional, 0 por defecto)
ahorro neto         = ahorro bruto − coste desplazamiento − coste tiempo
litros mín. para compensar = (coste desplazamiento + coste tiempo) / (precio_ref − precio_cand)
km extra máx. que compensan = (ahorro bruto − coste tiempo) / (consumo/100 × precio_cand)
```

**Veredicto a tres bandas:** compensa (neto > 0,25 €) · da igual (±0,25 €) · no compensa. El umbral se puede configurar.

**El ejemplo del briefing, calculado:** A = 1,459 €/L a 8 km y B = 1,479 €/L a 1 km, con 40 L y 6,5 L/100 km:

| | |
|---|---|
| Ahorro bruto | 0,80 € |
| Km extra (ida y vuelta) | 14 km |
| Combustible para llegar | 0,91 L |
| Coste del desplazamiento | 1,33 € |
| **Ahorro neto** | **−0,53 € → No compensa** |
| Te compensaría a partir de | 66,4 L, o si A estuviera a menos de 8,4 km extra |

> **Observación de producto:** la intuición «2 céntimos más barata, voy» es casi siempre falsa para desplazamientos de ida y vuelta. Ese es justo el valor diferencial de REPOSTA, y el mensaje debería ser así de directo.

**Decisiones de diseño:**
- **Referencia por defecto = la gasolinera más cercana** que vende el combustible. El usuario puede fijar otra (su habitual).
- **Modo «de camino»**: imprescindible. Mucha gente reposta en un trayecto, no desde casa. En la fase 3, con un motor de rutas propio, el desvío se calcula de verdad.
- **Distancias:** en el listado, línea recta × factor (estimación etiquetada «≈»). En el cálculo detallado, distancia por carretera.
- **Consumo:** el del vehículo guardado (si hay repostajes con depósito lleno, el **consumo real** medido); sin coche, 6,5 L/100 km editable en el propio cálculo.

## D. Estadísticas personales (Mis repostajes)

| Métrica | Cálculo |
|---|---|
| Precio medio pagado | Σ importe / Σ litros (ponderado por litros, no media de precios) |
| Gasto mensual / anual | Σ importe por mes / año |
| Consumo real | Entre dos repostajes con **depósito lleno**: litros del segundo / km recorridos × 100 |
| Coste por 100 km | consumo real × precio medio pagado |
| Ahorro estimado | Σ litros × (media de la provincia ese día − precio pagado). La media de referencia se guarda al registrar el repostaje (`reference_price_milli`) |

El ahorro estimado se presenta como **«frente a la media de tu provincia ese día»**, nunca como ahorro absoluto.
