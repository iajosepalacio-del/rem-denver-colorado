# Lista de aceptación

Estado de esta entrega. Una fila «comprobado» corresponde a una prueba automática o a un recorrido ejecutado contra el servidor. Una fila «pendiente de configuración» existe en el código y no se presenta como conectada.

| Requisito | Estado |
| --- | --- |
| Portada en español, eslogan, fechas y lugar configurables | El HTML de inicio incluye el eslogan, el subtítulo, Denver y los dos botones del hero |
| Logotipo oficial y letras de hielo | La cabecera usa el isotipo publicado en matrimoniosrem.com. El lema usa letras de hielo. La portada incluye imágenes de referencia del invierno en Denver |
| Nieve con respeto a `prefers-reduced-motion` | La animación está en CSS y se apaga con esa preferencia |
| Inscripción por pareja, código público distinto del id interno | Prueba automática y recorrido HTTP: se creó `REM-2027-0005` con correos `@example.com` |
| Una pareja no lee datos de otra | Prueba automática. El acceso con un correo ajeno y la clave correcta respondió 401 |
| Casilla de pago no reduce el saldo | Prueba automática y recorrido HTTP: un pago de 150 USD quedó en 0 hasta verificarlo |
| Sin precio oficial el pago no queda completo | Prueba automática. El alta deja `priceConfigured` en falso |
| Carta «no» cuenta como no aplica | Prueba automática y recorrido HTTP: el estado quedó `no_aplica` |
| Archivos que no son PDF, JPG o PNG se rechazan | Prueba automática. Un PNG mínimo sí se adjuntó al pago |
| Waiver sin PDF | `GET /api/waiver` respondió 404. No se firmó nada |
| SEMÁFORO externo, sin preguntas inventadas | Abrir el enlace dejó el estado en `en_proceso`, no en completado |
| SEMÁFORO interno y clave por cónyuge | La prueba automática impide que una clave lea las respuestas del otro. Falta el JSON oficial |
| Maleta y constancia | La confirmación de la lista y `GET /api/constancia` devolvieron el estado y un PDF |
| Panel, CSV y verificación | Con un administrador local se fijó un precio de prueba de 500 USD, se verificó el pago ficticio (saldo 350 USD) y el CSV incluyó el nombre. Ese precio de prueba no es el valor oficial del evento y no viaja al publicar |
| Google Drive, Sheets, SMTP y firma | `/api/salud` reportó los tres en falso. Pendiente de configuración |
| Correo de confirmación | El alta quedó en `pendiente_configuracion`. El texto preparado no incluye respuestas del cuestionario |
| Registro completado | No se marcó completado: faltan waiver, verificación del SEMÁFORO y el precio oficial |
| Despliegue | Instrucciones en `docs/netlify.md`. La publicación la confirma el responsable en Cursor |

Los datos de demostración se llaman Ejemplo, Prueba y Demostración, usan `@example.com` y están marcados como ficticios. No hay pagos verificados, firmas ni respuestas de cuestionario en esa semilla.
