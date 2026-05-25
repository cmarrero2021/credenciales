# minaamp-electoral-auth
Backend de autorización y seguridad

## Carga masiva de fotos

Se añadió un endpoint protegido para subir múltiples fotos en una sola petición:

- Ruta: `POST /cargar_fotos_masivas`
- Autenticación: `authenticate` (Bearer token)
- Permiso requerido: `update_servidor`
- Campo multipart: `fotos` (varios archivos)

Ejemplo `curl` (Linux/macOS):

```bash
curl -v -X POST 'https://tu-servidor.example.com/cargar_fotos_masivas' \
	-H 'Authorization: Bearer <TU_TOKEN>' \
	-F "fotos=@/ruta/a/12345678.jpg" \
	-F "fotos=@/ruta/a/87654321.png"
```

Notas:

- El handler intentará derivar la cédula desde el nombre de cada archivo (p.ej. `12345678.jpg` -> `12345678`).
- Si el servidor con esa cédula no existe, el archivo será rechazado.
- Se devuelven listas de `insertadas`, `actualizadas` y `rechazadas` en la respuesta JSON.
- Ajusta el límite de archivos en `routes.js` (`upload.array('fotos', 200)`) según tus necesidades.

