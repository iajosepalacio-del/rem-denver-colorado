# Despliegue en Netlify

La aplicación es Next.js 15 con Route Handlers de Node. En Netlify use el runtime de Next, no un sitio estático.

## Requisitos

- Node 22.
- `DATABASE_URL` de PostgreSQL, o la base de Netlify (`NETLIFY_DATABASE_URL`). En Neon u otro proveedor con conexión directa y con pool, defina también `DATABASE_URL_UNPOOLED` para las migraciones.
- `ADMIN_BOOTSTRAP_TOKEN` antes de crear el primer administrador. En producción no hay alta local sin ese token.

PGlite no sirve en Netlify: el disco de una función no conserva `.data/pglite`. Sin `DATABASE_URL` los registros se perderían entre invocaciones.

## Configuración

`netlify.toml` ya indica el comando `npm run build`. El plugin oficial `@netlify/plugin-nextjs` se instala desde la interfaz de Netlify o como dependencia de desarrollo:

```bash
npm install -D @netlify/plugin-nextjs
```

El build ejecuta `next build` y después `scripts/migrate.mjs`. Ese script no hace nada si `DATABASE_URL` está vacío. En Netlify debe estar definido en el entorno del build y del runtime.

Suba el límite del cuerpo si el plan lo permite. La aplicación rechaza archivos de más de 5 MB antes de guardarlos, y también rechaza un `Content-Length` muy por encima de ese tope.

## Variables

Copie los nombres de `.env.example`. No marque como públicas las de Google, SMTP, firma o el token de administración. Ninguna variable de esta aplicación usa el prefijo `NEXT_PUBLIC_`.

Después del primer despliegue:

1. Abra `/admin/ingresar` y active el responsable con el token.
2. En **Evento**, confirme fechas, lugar y precio. El precio no viene inventado.
3. Cargue el logotipo autorizado, el PDF del waiver y, si corresponde, el JSON del SEMÁFORO.
4. Compruebe `/api/salud`. `mail`, `drive` y `signatureApi` serán `false` hasta que esas variables existan.

## Correo y webhooks

El webhook de firma es `POST /api/webhooks/firma`. Exige el encabezado `x-rem-signature` con HMAC SHA-256 en hexadecimal del cuerpo, usando `SIGNATURE_WEBHOOK_SECRET`. No usa la comprobación de origen del navegador, porque el proveedor llama desde otro host.

## Limitación

Netlify ejecuta las rutas en funciones. Las sesiones están en Postgres, así que sobreviven. El límite de tasa también está en Postgres. Una función con poco tiempo de espera puede cortar una subida a Drive: el registro queda en la base con sincronización pendiente y se reintenta desde el panel. No trate un despliegue sin Drive como si los archivos ya estuvieran en la cuenta de Gmail.
