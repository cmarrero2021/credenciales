Checklist de verificación NGINX -> Backend (/auth)

1) Bloque server relevante (ejemplo):

server {
    listen 443 ssl;
    server_name credenciales.minaamp.gob.ve;

    # certificados, etc...

    location /auth/ {
        proxy_pass http://127.0.0.1:3001/auth/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Authorization $http_authorization;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    # Asegúrese de no tener otro location más arriba que capture /auth
}

2) Verifique que el proxy_pass incluye la barra final si desea preservar el prefijo /auth.
   - Si usa `proxy_pass http://127.0.0.1:3001/;` y una `location /auth/` sin `proxy_set_header Host`, la ruta real puede perder el prefijo.

3) Pruebas rápidas en servidor (ejecutar en el servidor donde corre NGINX):

curl -i -H "Host: credenciales.minaamp.gob.ve" https://127.0.0.1/auth/cargos
# o desde fuera
curl -i https://credenciales.minaamp.gob.ve/auth/cargos

4) Logs útiles:
- NGINX: /var/log/nginx/error.log  y access.log
- Backend (pm2): pm2 logs <app>
- Backend (systemd): sudo journalctl -u credenciales -f
- Docker: docker logs -f <container>

5) Causa frecuente de 404s en /auth:
- Backend no fue reiniciado después de una edición crítica y está corriendo con stubs.
- NGINX está reescribiendo la ruta o tiene un `location` que hace `try_files` y responde 404 antes de proxy.
- El proceso Node falló al iniciar y NGINX apunta a un puerto sin servicio.

6) Si encuentra 404 con encabezado "X-Powered-By: Express"
- Significa que la petición llegó al Node/Express pero Express devolvió 404 (rutas no registradas o stubs). Reinicie el backend.

