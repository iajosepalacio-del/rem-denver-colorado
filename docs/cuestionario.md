# Cuestionario SEMÁFORO

La plataforma no incluye las 50 preguntas. No se redactaron ni se copiaron desde [matrimoniosrem.com/semaforo-rem-paso-1/](https://matrimoniosrem.com/semaforo-rem-paso-1/).

## Modalidad externa

Es la modalidad inicial. El botón abre ese enlace. El texto advierte que abrirlo no demuestra que el cuestionario terminó. Cada cónyuge puede registrar que lo abrió. Solo un administrador con permiso de cuestionario puede marcarlo como `verificado_externo`. Hasta entonces el requisito sigue pendiente.

## Modalidad interna

En `/admin/configuracion` cambie la modalidad a interna y, en `/admin/cuestionario`, cargue el JSON oficial. Al publicar una versión nueva, los envíos de una versión anterior pasan a `requiere_revision`.

```json
{
  "version": "2027-oficial-1",
  "title": "SEMÁFORO REM",
  "questions": [
    { "prompt": "Texto entregado por la organización.", "help": "Aclaración opcional.", "required": true }
  ]
}
```

El archivo admite de 1 a 80 preguntas. El grupo por pantalla sale de la configuración del evento. Cada cónyuge crea su propia clave de respuestas la primera vez. Esa clave no es la clave de la pareja. Las respuestas se guardan y solo las lee quien presenta la clave de ese cónyuge, o un administrador con permiso `sensitive`, y esa exportación queda en la auditoría.

No hay puntajes, colores diagnósticos ni textos clínicos. La constancia y el correo de confirmación no incluyen respuestas.
