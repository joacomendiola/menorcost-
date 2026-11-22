#!/bin/sh
set -e

echo "[backend] Ejecutando migraciones (prisma migrate deploy)..."
npx prisma migrate deploy

echo "[backend] Iniciando servidor..."
exec "$@"
