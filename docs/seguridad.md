# Seguridad

Estas notas describen lo que el código hace. No son un certificado de cumplimiento.

## Acceso

- La pareja entra con código público, correo de uno de los cónyuges y clave. La clave se guarda con scrypt. La sesión es un token aleatorio; en la base solo está su SHA-256. La cookie `rem_couple` es HttpOnly, SameSite=Lax y, en producción, Secure. Dura 14 días.
- El administrador usa `rem_admin`, 12 horas, con los mismos atributos. El rol limita cada acción. Ver la tabla en el README.
- El alta del primer administrador exige `ADMIN_BOOTSTRAP_TOKEN`, comparado en tiempo constante. Sin token, solo se permite en localhost, fuera de producción y sin `DATABASE_URL`, y únicamente si todavía no hay administradores.
- Un cónyuge no consulta la inscripción de otro. Las pruebas cubren ese caso.
- La pareja no puede rotar su clave desde el formulario público. Un responsable sí, y la nueva clave se muestra una vez.

## Entradas y archivos

- Zod valida los JSON. Los archivos se aceptan solo si los bytes son PDF, PNG o JPEG, hasta 5 MB. El logotipo no acepta SVG.
- Las descargas salen como adjunto, con `X-Content-Type-Options: nosniff`.
- Las peticiones que cambian datos, salvo el webhook de firma, exigen que el origen coincida con el host.
- Hay límite de tasa en la base para registro, acceso, SEMÁFORO y el panel.
- Los encabezados incluyen CSP, HSTS, `X-Frame-Options: DENY` y nosniff. En desarrollo la CSP permite `unsafe-eval` por el runtime de Next. En producción no.

## Datos

- El consentimiento de privacidad y el del cuestionario son casillas separadas y obligatorias.
- Las respuestas del SEMÁFORO no van en el correo ni en la ficha JSON que se sincroniza con Drive.
- La eliminación la pide la pareja y la ejecuta un responsable. Las copias que ya hayan llegado a Drive hay que borrarlas también allí. Las copias de seguridad dependen del proveedor de Postgres.
- La página de privacidad no afirma por sí sola el cumplimiento de una norma. El contacto configurado es `remdenvercolorado@gmail.com`.

## Secretos

No hay contraseñas, tokens ni refresh tokens en el código. `.env.example` solo tiene nombres. `.data/` está fuera de git.

## Lo que esta revisión no cubre

No se hizo una auditoría externa ni una prueba de penetración. El webhook confía en el HMAC y en el id de sobre que el proveedor devuelva. Conviene restringir ese endpoint en el perímetro cuando el proveedor esté elegido. El límite de tasa cuenta por IP reenviada; el proxy de producción debe sobrescribir `x-forwarded-for` y no dejar que el cliente lo fije.
