# REM DENVER COLORADO 2027

Plataforma de inscripción del **REM — Reto de Empoderamiento Matrimonial** en Denver, Colorado. El eslogan es **AMOR A PRUEBA DE HIELO** y el subtítulo **PRIMER REM EN LA NIEVE**. Las fechas iniciales son el 23 y el 24 de enero de 2027. El año, las fechas, el lugar y el precio se cambian en el panel, sin alterar el significado de la marca.

El idioma principal es español. El botón de idioma guarda la cookie `rem_lang` y muestra la versión en inglés ya escrita en `src/i18n/messages.ts`.

Sitio de referencia: [matrimoniosrem.com](https://matrimoniosrem.com).

## Qué puede hacer una pareja

1. Crear su inscripción y recibir un código `REM-2027-0001` y una clave de acceso. La clave se muestra una vez.
2. Volver a entrar en **Consultar mi inscripción** con el código, el correo de uno de los cónyuges y la clave.
3. Completar datos, declarar pagos y subir comprobantes PDF, JPG o PNG.
4. Decidir si necesita carta de invitación del organizador. Responder **NO** cuenta como «No aplica» y no bloquea el registro.
5. Abrir el waiver cuando el organizador haya cargado el PDF. Sin PDF aparece «Documento pendiente de configuración».
6. Abrir el SEMÁFORO oficial o, si el organizador cargó las preguntas, responderlas con una clave propia de cada cónyuge.
7. Marcar la maleta de invierno y descargar la lista y la constancia.

Una pareja no puede leer la inscripción de otra. Las respuestas del SEMÁFORO no se muestran al otro cónyuge ni salen en el correo de confirmación.

## Qué puede hacer el equipo

La ruta privada es `/admin`.

| Rol | Puede |
| --- | --- |
| owner | Todo, incluido el equipo, el buzón, las claves y la eliminación |
| payments | Ver y verificar pagos |
| documents | Ver y gestionar carta y waiver |
| questionnaire | Ver, cargar preguntas y exportar respuestas |
| viewer | Ver el resumen, sin editar |

El precio oficial empieza sin configurar (`price_configured = false`). Un administrador lo define. Marcar «Pago total realizado» no verifica el pago: el saldo es el valor oficial menos la suma de pagos en estado **verificado**.

## Arranque local

Requiere Node.js 22.

```bash
npm install
npm run dev
```

El servidor de desarrollo escucha en el puerto **3847**. `npm run dev` activa `SEED_DEMO=1` solo si no hay `DATABASE_URL` y no es producción. Crea tres parejas ficticias con correos `@example.com` y escribe sus claves en `.data/demo-credentials.txt`, con permisos restringidos. Ese archivo no se versiona.

```bash
npm test
npm run build
npm start
```

Sin `DATABASE_URL`, la base local es PGlite en `.data/pglite`. En el entorno publicado la base es PostgreSQL y es la fuente de verdad. Google Drive, si se configura, es el repositorio documental.

## Identidad visual

La cabecera usa el isotipo y el logotipo publicados en [matrimoniosrem.com](https://matrimoniosrem.com). El lema del evento usa letras de hielo, en el estilo de los afiches entregados para Denver. Las fotografías de la portada son imágenes de referencia del invierno en Denver y sus montañas; no son fotos del lugar exacto del encuentro. La interfaz usa Montserrat y Outfit, ambas con licencia SIL Open Font License. El organizador puede sustituir el logotipo desde `/admin/documentos` si entrega otro archivo autorizado.

## Lo que queda pendiente de configuración

Estas piezas no se simulan. La pantalla y `/api/salud` dicen si están conectadas.

- **Precio oficial del evento.** Lo define un administrador. Hasta entonces el pago no puede quedar completo.
- **PDF oficial del waiver.** Sin él no hay firma.
- **Proveedor de firma.** Hacen falta `SIGNATURE_PROVIDER_NAME`, `SIGNATURE_API_BASE` (https) y `SIGNATURE_API_KEY` para enviar un sobre. Un trazo dibujado sobre el PDF no se trata como firma válida. Si solo existe el nombre del proveedor, un administrador puede archivar el PDF que ese proveedor devolvió, con su referencia.
- **Las 50 preguntas del SEMÁFORO.** No están inventadas ni copiadas. La modalidad inicial abre [el formulario oficial](https://matrimoniosrem.com/semaforo-rem-paso-1/) y aclara que abrirlo no equivale a terminarlo. La modalidad interna se carga con el JSON del organizador. Ver `docs/cuestionario.md`.
- **Correo.** Sin SMTP el mensaje queda en el buzón interno con estado `pendiente_configuracion`.
- **Google Drive y Sheets.** Sin credenciales el estado es `no_configurado`. Ver `docs/google-oauth.md`.
- **Reenvío de la clave por la pareja.** No existe, para evitar que alguien con el código y un correo tome la cuenta. Un responsable (`owner`) puede rotar la clave; la nueva se muestra una sola vez.

La carta que entrega el organizador se identifica como carta del organizador. Esta plataforma no genera documentos migratorios.

## Documentación

- [Variables de entorno](.env.example)
- [Google Drive y OAuth](docs/google-oauth.md)
- [Despliegue en Netlify](docs/netlify.md)
- [Cuestionario SEMÁFORO](docs/cuestionario.md)
- [Seguridad](docs/seguridad.md)
- [Lista de aceptación](docs/aceptacion.md)
