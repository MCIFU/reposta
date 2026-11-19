# REPOSTA

**Tu combustible. Tu precio. Tus datos.**

Web y app (PWA) con los precios oficiales de las gasolineras de España.

- **Precios:** mapa y lista de las gasolineras más baratas cerca de ti, actualizados cada 30 minutos con datos del Ministerio (MITECO), con la respuesta a «¿de verdad me compensa ir hasta allí?».
- **Histórico:** evolución semanal del precio medio oficial en España desde 2005 (Comisión Europea), con y sin impuestos.
- **Viaje:** coste, litros, kilómetros y tiempo de un viaje con paradas, según el consumo oficial WLTP de tu coche (catálogo de la Agencia Europea de Medio Ambiente), y las gasolineras más baratas de la ruta.
- **Alertas:** aviso cuando cambia el precio de una gasolinera o de la más barata de tu zona.
- **Datos:** fuentes, licencias y cómo se calcula cada cifra.

No hay cuentas ni cookies: las preferencias y alertas se guardan en el dispositivo.

## Estructura

```
apps/web          Aplicación Next.js (páginas, API y PWA)
packages/core     Lógica compartida y probada: combustibles, horarios, normalización MITECO, ahorro real
packages/tokens   Colores, tipografía y espaciado
brand/            Identidad visual, iconos e imagen destacada para Google Play
tools/            Verificación de fuentes, catálogo de coches, iconos y capturas
docs/             Fuentes de datos, arquitectura y cálculos
```

## Desarrollo

Requiere Node 22.12 o superior.

```bash
npm install
```
```bash
npm run dev
```

Abre http://localhost:3000. Las variables de entorno están documentadas en `apps/web/.env.example`.

```bash
npm test
```
```bash
npm run build
```

Otras tareas: `npm run probe` (comprueba las fuentes oficiales), `npm run vehicles` (regenera el catálogo de coches) y `npm run icons` (regenera los iconos).

## Publicar

Los pasos para Railway, el dominio, PWABuilder y Google Play están en [DEPLOY.md](DEPLOY.md).

## Fuentes y licencias de los datos

- Precios y gasolineras: Ministerio para la Transición Ecológica y el Reto Demográfico (MITECO).
- Histórico nacional: Comisión Europea, Weekly Oil Bulletin (CC BY 4.0).
- Consumo de los coches: Agencia Europea de Medio Ambiente (CC BY 4.0).
- Direcciones: CartoCiudad, © Instituto Geográfico Nacional (CC BY 4.0).
- Mapa y rutas: © colaboradores de OpenStreetMap (ODbL), vía OpenFreeMap y OpenRouteService/OSRM.

## Usarlo en el PC, sin Vercel

Doble clic en `Iniciar.bat` → se abre en http://localhost:3002. Necesita [Node.js](https://nodejs.org) 22 o superior y Git.
Cada vez que lo abres se actualiza desde GitHub, instala y compila solo si hay cambios (la primera vez tarda unos minutos) y abre el navegador. Opcional: para las rutas de la pestaña Viaje, pon tu clave de openrouteservice.org en `Iniciar.bat` (`set ORS_API_KEY=…`). Las cachés se guardan en `data/`.

