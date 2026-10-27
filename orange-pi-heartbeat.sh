#!/bin/sh

# Cambia TU-DOMINIO por el dominio real donde esta publicada la pagina.
SITE_URL="https://TU-DOMINIO/api.php"
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

# El token se lee de config.env (no se sube al repositorio) o de la variable de entorno.
if [ -f "$SCRIPT_DIR/config.env" ]; then
  . "$SCRIPT_DIR/config.env"
fi
TOKEN="${CODEXIFY_HEARTBEAT_TOKEN:-}"
IP="100.91.255.18"

while true; do
  curl -fsS -X POST "$SITE_URL" \
    -d "action=heartbeat" \
    -d "token=$TOKEN" \
    -d "ip=$IP" >/dev/null 2>&1

  sleep 60
done
