#!/usr/bin/env bash
set -euo pipefail
# Uso: sudo ./restart_and_check.sh [--pm2-name NAME]
# Intenta reiniciar el backend usando pm2, systemd o docker-compose y luego verifica endpoints.
PM2_NAME="credenciales"
if [ "$1" = "--pm2-name" ] && [ -n "${2-:-}" ]; then
  PM2_NAME="$2"
fi

echo "Detectando gestor de procesos..."
if command -v pm2 >/dev/null 2>&1; then
  echo "pm2 detectado. Reiniciando proceso: $PM2_NAME"
  pm2 restart "$PM2_NAME" || pm2 restart all
  echo "Esperando 3s para estabilizar..."; sleep 3
elif systemctl >/dev/null 2>&1; then
  echo "systemd detectado. Reiniciando servicio 'credenciales' (si existe)..."
  sudo systemctl restart credenciales || echo "service credenciales no existe o falla al reiniciar"
  echo "Esperando 3s para estabilizar..."; sleep 3
elif [ -f docker-compose.yml ] || [ -f docker-compose.yaml ]; then
  echo "docker-compose detectado en pwd. Reiniciando servicio 'back' o contenedores..."
  docker-compose restart || echo "docker-compose restart falló"
  echo "Esperando 3s para estabilizar..."; sleep 3
else
  echo "No se detectó pm2/systemd/docker-compose. Por favor reinicie manualmente el proceso Node." >&2
fi

# Endpoints a verificar
BASE_URL=${BASE_URL:-"http://localhost:3001"}
echo "Usando base URL: $BASE_URL"

echo "Comprobando /list-endpoints ..."
curl -sS --fail "$BASE_URL/list-endpoints" | head -n 50 || { echo "Fallo: /list-endpoints"; }

echo "Comprobando endpoint público /auth/cargos ..."
curl -sS --fail "$BASE_URL/auth/cargos" | head -n 20 || { echo "Fallo: /auth/cargos"; }

echo "Comprobando endpoint protegido /auth/credencial/historico (requiere token)." 
if [ -n "${TEST_TOKEN-}" ]; then
  curl -sS -H "Authorization: Bearer $TEST_TOKEN" --fail "$BASE_URL/auth/credencial/historico" | head -n 20 || { echo "Fallo: /auth/credencial/historico"; }
else
  echo "No hay TEST_TOKEN definido. Para comprobar endpoints protegidos exporte TEST_TOKEN con un JWT válido y vuelva a ejecutar.";
fi

echo "Hecho. Si algunos checks fallaron, consulte los logs del proceso (pm2 logs, journalctl -u credenciales, o docker logs)."
