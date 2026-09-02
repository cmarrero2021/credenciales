# DESPLIEGUE - Solución de los TOGGLES en PRODUCCIÓN

## Diagnóstico (confirmado por HTTP directo contra producción)
El backend de producción es la VERSIÓN VIEJA de `controllers.js`:
- GET /auth/session-settings/global devuelve `{"timeout":120}` (sin los campos nuevos)
- PATCH con `{habilitarImpresionFranja:true}` -> 400
- PATCH con `{omitirRegla3Meses:true}` -> 400
- PATCH con `{timeout:120}` -> 200 (el viejo solo acepta timeout)

Por eso los toggles "no se mueven": el frontend envía los campos nuevos, el backend viejo
los rechaza con 400, y el toggle revierte.

## SOLUCIÓN: 3 pasos

### PASO 1 - Actualizar el backend (crítico)
En el servidor de producción, reemplazar el archivo `controllers.js`
(está en la misma carpeta que `routes_fix_for_production.js`) con la versión
ACTUALIZADA del repositorio: `back/src/controllers.js`

Ese archivo contiene ya la función `updateGlobalSessionTimeout` corregida que acepta:
- `timeout`
- `omitirRegla3Meses`
- `habilitarImpresionFranja`

Reiniciar el backend:
  pm2 restart credenciales     # o systemctl restart credenciales

### PASO 2 - Ejecutar la migración SQL en la BD de producción
Ejecutar el archivo `00_migracion_produccion.sql` (incluido en esta carpeta)
o el siguiente SQL en la BD del servidor:

  ALTER TABLE public.session_settings
      ADD COLUMN IF NOT EXISTS omitir_regla_3_meses boolean NOT NULL DEFAULT false;
  ALTER TABLE public.session_settings
      ADD COLUMN IF NOT EXISTS habilitar_impresion_franja boolean NOT NULL DEFAULT true;

Si el backend nuevo responde con error "column does not exist", es porque este
PASO 2 no se ejecutó.

### PASO 3 - (Opcional) Recompilar y subir el frontend
El frontend ya envía los campos correctos. Si los toggles no aparecen o el
frontend está viejo, recompilar `front/dist/spa` (npx quasar build en front/)
y servirlo.

## VERIFICACIÓN
Después del deploy, hacer (desde el navegador o curl):
  GET /auth/session-settings/global
debe devolver algo como: {"timeout":120,"omitirRegla3Meses":false,"habilitarImpresionFranja":true}

Y
  PATCH /auth/session-settings/global  {"habilitarImpresionFranja":false}
debe devolver 200, y el GET posterior debe reflejar habilitarImpresionFranja:false

## IMPORTANTE
El problema NO es del frontend ni de la BD: es que el backend de producción
corre una versión vieja de controllers.js que solo acepta `timeout`.
