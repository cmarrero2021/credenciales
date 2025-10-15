# Configuración de Electron para Credenciales MINAAMP

## Resumen de cambios

Se ha configurado la aplicación para funcionar como una aplicación de escritorio usando Electron. Esto permite acceder a las APIs nativas del sistema operativo para detectar con precisión si el usuario imprimió o canceló la impresión de credenciales.

## Archivos creados/modificados

### Nuevos archivos:
- `src-electron/electron-main.js` - Proceso principal de Electron con manejo de impresión
- `src-electron/electron-preload.js` - Script de preload con IPC para comunicación segura

### Archivos modificados:
- `quasar.config.js` - Habilitado soporte para Electron
- `package.json` - Agregados scripts para ejecutar en modo Electron
- `src/pages/CredencialPage.vue` - Función de impresión adaptada para Electron y Web

## Instalación

1. Instalar las dependencias de Electron:
```bash
npm install --save-dev electron electron-packager
```

## Ejecución

### Modo desarrollo (Electron):
```bash
npm run dev:electron
```

### Modo desarrollo (Web tradicional):
```bash
npm run dev
```

### Build para producción (Electron):
```bash
npm run build:electron
```

## Cómo funciona

### En modo Web (navegador):
- Usa `window.matchMedia('print')` para intentar detectar impresión vs cancelación
- Limitación: No es 100% confiable debido a restricciones del navegador

### En modo Electron (aplicación de escritorio):
- Usa la API nativa `webContents.print()` de Electron
- Retorna `true` si el usuario imprimió, `false` si canceló
- **Detección precisa y confiable**

## Flujo de impresión en Electron

1. Usuario hace clic en "Imprimir"
2. La función `imprimirCredencial()` detecta que está en Electron
3. Llama a `window.electronAPI.printCredential()` (IPC)
4. El proceso principal de Electron abre el diálogo de impresión nativo
5. Electron retorna el resultado (impreso o cancelado)
6. Se muestra notificación verde (impreso) o roja (cancelado)
7. Si se imprimió, se puede guardar el registro en la base de datos

## Ventajas de usar Electron

✅ Detección precisa de impresión vs cancelación
✅ Acceso a APIs nativas del sistema operativo
✅ Control total sobre el proceso de impresión
✅ Misma base de código para web y escritorio
✅ Mejor integración con el sistema operativo

## Próximos pasos

1. Instalar dependencias de Electron
2. Probar la aplicación con `npm run dev:electron`
3. Verificar que la detección de impresión funciona correctamente
4. Implementar el guardado en base de datos cuando se confirme la impresión
5. Crear instaladores para Windows/Linux/Mac si es necesario

## Notas importantes

- La aplicación sigue funcionando en modo web sin cambios
- El backend (Node.js + Express + PostgreSQL) no requiere modificaciones
- Los usuarios finales necesitarán instalar la aplicación de escritorio
- La aplicación Electron puede empaquetarse como .exe (Windows), .dmg (Mac), o .deb/.AppImage (Linux)
