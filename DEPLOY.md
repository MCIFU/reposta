# Publicar REPOSTA

## 1. Subir el código a GitHub

1. Crea un repositorio **privado** vacío en https://github.com/new (por ejemplo `reposta`), sin README.
2. En esta carpeta:

```bash
git remote add origin https://github.com/TU_USUARIO/reposta.git
```
```bash
git push -u origin main
```

## 2. Desplegar en Railway

1. Entra en https://railway.com, inicia sesión con GitHub y elige **New Project → Deploy from GitHub repo → reposta**.
2. Railway lee `railway.json`: instala, ejecuta `npm run build` y arranca con `npm start`. La comprobación de salud es `/api/health`.
3. En **Variables**, añade:

| Variable | Valor |
|---|---|
| `ORS_API_KEY` | Tu clave gratuita de https://openrouteservice.org/dev/#/signup (rutas de la pestaña Viaje) |
| `NEXT_PUBLIC_SITE_URL` | `https://tu-dominio.es` |
| `NEXT_PUBLIC_OWNER_NAME` | Tu nombre o el de tu empresa (aparece en la política de privacidad) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Correo de contacto (aparece en la política de privacidad) |
| `REPOSTA_DATA_DIR` | `/data` si añades un volumen (opcional, ver abajo) |

4. **Settings → Networking → Generate Domain** te da una URL `*.up.railway.app`. Para usar tu dominio: **Custom Domain**, y en tu proveedor de dominio crea el registro CNAME que te indique Railway (el certificado HTTPS es automático).
5. *Opcional:* añade un **Volume** montado en `/data` y pon `REPOSTA_DATA_DIR=/data`. Así las copias de los precios sobreviven a los reinicios y el arranque es instantáneo. Sin volumen funciona igual: tras cada despliegue tarda unos 4 s en descargar los precios del Ministerio.

Coste orientativo: unos 5 $/mes (plan Hobby).

## 3. App Android con PWABuilder

1. Con la web ya publicada en tu dominio, ve a https://www.pwabuilder.com e introduce la URL.
2. Revisa la puntuación del manifest y del service worker; los iconos, capturas y atajos ya están incluidos.
3. **Package for stores → Android**. Usa un identificador de paquete propio (por ejemplo `es.reposta.app`). Descarga el ZIP y **guarda la clave de firma (`signing.keystore`) y sus contraseñas en un lugar seguro**: sin ellas no podrás actualizar la app.
4. PWABuilder genera un `assetlinks.json` con una huella SHA-256. Ponla en Railway:
   - `ANDROID_PACKAGE` = `es.reposta.app`
   - `ANDROID_SHA256` = la huella de PWABuilder **y**, tras subir la app a Google Play, también la de *Play App Signing* (Play Console → Configuración → Integridad de la app), separadas por coma.

   Comprueba que `https://tu-dominio.es/.well-known/assetlinks.json` las muestra. Si no coinciden, la app se abrirá con la barra del navegador.
5. En **Google Play Console** (cuenta de desarrollador, 25 $ en un único pago):
   - Crea la app y sube el `.aab`.
   - Política de privacidad: `https://tu-dominio.es/privacidad`.
   - Ficha: icono de 512 px (`apps/web/public/icons/icon-512.png`), capturas de móvil (`apps/web/public/screenshots/*-movil.png`) y una imagen destacada de 1024×500 (no incluida).
   - Formulario de seguridad de los datos: ubicación aproximada y precisa, opcional y no compartida; no se recogen otros datos.
   - Las cuentas personales nuevas deben hacer una **prueba cerrada con al menos 12 testers durante 14 días** antes de publicar en producción.

## Comprobaciones antes de publicar

```bash
npm test
```
```bash
npm run build
```

Después de desplegar, abre `/api/health`: debe mostrar `"stale": false` y unas 11.500 estaciones.
