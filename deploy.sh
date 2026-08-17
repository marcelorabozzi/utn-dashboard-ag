#!/bin/bash
# ─────────────────────────────────────────
# Configuración — editá estos valores
# ─────────────────────────────────────────
REMOTE_USER="root"
REMOTE_HOST="66.97.40.135"
REMOTE_PATH="/var/www/utn-dashboard-ag"
REMOTE_PASS="2i_c3JyyyxQV/n"
SSH_KEY=""
SSH_PORT="5169"
# ─────────────────────────────────────────

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Archivos y carpetas a excluir
EXCLUDES=(
  ".git"
  ".DS_Store"
  "node_modules"
  "deploy.sh"
  "actualizar-carrousel.sh"
  "*.log"
)

# Construir argumentos de exclusión
EXCLUDE_ARGS=""
for item in "${EXCLUDES[@]}"; do
  EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude='$item'"
done

# Construir argumento de clave SSH
SSH_ARGS="-p $SSH_PORT"
if [ -n "$SSH_KEY" ]; then
  SSH_ARGS="$SSH_ARGS -i $SSH_KEY"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Deployando utn-dashboard-ag"
echo "  Destino: $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

eval sshpass -p "'$REMOTE_PASS'" rsync -avz --progress \
  $EXCLUDE_ARGS \
  -e "\"ssh $SSH_ARGS -o StrictHostKeyChecking=no\"" \
  "$PROJECT_DIR/" \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"

if [ $? -eq 0 ]; then
  echo ""
  echo "✓ Deploy completado exitosamente."
else
  echo ""
  echo "✗ Error durante el deploy."
  exit 1
fi
