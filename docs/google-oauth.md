# Google Drive y Sheets

La cuenta de destino del organizador es `remdenvercolorado@gmail.com`. Las credenciales viven solo en el servidor. El navegador nunca pide ni guarda una contraseña de Google.

Hay dos modos. Si están los tres valores de OAuth, se usa OAuth. Si no, y están el correo y la llave de la cuenta de servicio, se usa esa cuenta. Si no hay ninguno, Drive queda en `no_configurado`: la base conserva el archivo y la pantalla no dice que se guardó en Drive.

## Alcances

- `https://www.googleapis.com/auth/drive.file` para crear y actualizar los archivos de esta aplicación.
- `https://www.googleapis.com/auth/spreadsheets` solo si se define `GOOGLE_SHEETS_ID`.

No se piden permisos de todo el Drive. No se crean enlaces públicos. Las respuestas del SEMÁFORO no van en el JSON de la ficha; se suben aparte, y solo después de que ese cónyuge envía su cuestionario.

## OAuth de la cuenta organizadora

1. En Google Cloud, cree un proyecto y active Google Drive API y Google Sheets API.
2. Configure la pantalla de consentimiento para uso interno o de prueba, con los dos alcances anteriores.
3. Cree un cliente OAuth de tipo aplicación web.
4. Obtenga un refresh token de `remdenvercolorado@gmail.com` con esos alcances. Puede usar el flujo de OAuth Playground o el cliente que ya use el equipo. El refresh token es un secreto.
5. Defina `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` y `GOOGLE_OAUTH_REFRESH_TOKEN`.

## Cuenta de servicio

1. Cree una cuenta de servicio con los mismos alcances.
2. Defina `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`. En el entorno, los saltos de línea de la llave pueden ir como `\n`.
3. La primera sincronización comparte la carpeta raíz con `remdenvercolorado@gmail.com` como escritor. No comparte con «cualquiera con el enlace».

Si la carpeta raíz ya existe, ponga su id en `GOOGLE_DRIVE_ROOT_FOLDER_ID`. Si no, la aplicación crea `REM DENVER COLORADO 2027` y, dentro, `REGISTROS`, `DOCUMENTOS-OFICIALES`, `REPORTES` y `PLANTILLAS`. Cada pareja queda en `REGISTROS/REM-2027-0001/` con `comprobantes`, `waiver`, `invitacion`, `semaforo` y `confirmacion`. La búsqueda por nombre evita carpetas duplicadas y los ids quedan en `drive_folders` y `drive_files`.

Un archivo se reintenta hasta cinco veces. El botón **Reintentar Drive** del administrador vuelve a enviar la ficha. Si Drive falla, el estado queda `pendiente` o `error` y la base sigue siendo la fuente de verdad.

## Sheets

`GOOGLE_SHEETS_ID` debe coincidir con `^[a-zA-Z0-9_-]+$`. Si es válido, cada ficha se anexa a la hoja. No reemplace la base de datos: la hoja es un índice operativo.

## Auditoría

Cada subida registra fecha, tipo, operación, resultado y responsable en `audit_logs` y el id de Drive en `drive_files`.
