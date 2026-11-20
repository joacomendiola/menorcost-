# Despliegue de Menorcost con Tailscale Funnel (Opción 1 - demo)

Guía operativa para ejecutar Menorcost en un servidor Ubuntu (ej. laptop) y exponerlo por HTTPS mediante **Tailscale Funnel**, sin IP pública ni puertos abiertos en el router.

- **FQDN de esta demo:** `https://menorcostserver.tail67d69c.ts.net`
- **Origen único:** frontend, API (`/api/*`) e imágenes (`/uploads/*`) bajo el mismo dominio (evita CORS).
- **Alcance (lean):** Dockerfiles + `docker-compose.yml` ampliado + `Caddyfile` + `.env.example`. No incluye scripts/timers de backup ni hardening avanzado.

---

## 1. Arquitectura

```
Navegador (cualquier red)
        │  HTTPS 443
        ▼
Relay de Tailscale  ──túnel cifrado──►  tailscaled (nodo)
                                              │  http://127.0.0.1:8081
                                              ▼
                                        ┌──────────┐
                                        │  Caddy   │  ruteo por path
                                        └────┬─────┘
                     /api/*  ────────────────┤──► backend:3000  (recorta /api)
                     /uploads/* ─────────────┴──► backend:3000  (imágenes)
                     resto ─────────────────────► frontend:80   (SPA)
```

- **TLS:** lo termina Tailscale (certificado válido). Caddy escucha HTTP interno en el puerto 80 del contenedor, publicado como `127.0.0.1:8081` en el host.
- **Vite:** `VITE_API_URL` se incrusta en el **build** del frontend. Cambiar la URL/FQDN requiere reconstruir la imagen del frontend.

## 2. Requisitos previos

- Ubuntu Server 22.04/24.04, Docker Engine + plugin Compose v2, Git.
- Cuenta Tailscale con el nodo registrado (`menorcostserver`).
- En la consola de Tailscale: **MagicDNS** y **HTTPS Certificates** habilitados; Funnel permitido según la política/cuenta.
- RAM suficiente para builds (recomendado 8 GB o swap si hay 4 GB).

## 3. Preparar el servidor

```bash
sudo apt update && sudo apt full-upgrade -y
sudo timedatectl set-timezone America/Argentina/Ushuaia
sudo apt install -y curl ca-certificates git ufw
```

> El cron de vencimiento de ofertas corre con zona `America/Argentina/Ushuaia`.

Instalar Docker (repositorio oficial) y Tailscale:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"

curl -fsSL https://tailscale.com/install.sh | sudo sh
sudo tailscale up --ssh --accept-dns=false
tailscale status --self --peers=false
```

Opcional (recomendado): cerrar entrada pública y permitir tailnet:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow in on tailscale0
sudo ufw allow OpenSSH
sudo ufw --force enable
```

## 4. Obtener el código y configurar variables

```bash
sudo mkdir -p /opt/menorcost && sudo chown "$USER":"$USER" /opt/menorcost
git clone https://github.com/joacomendiola/menorcost-.git /opt/menorcost
cd /opt/menorcost
git checkout main && git pull   # o la rama/tag de la demo
```

Crear `.env` a partir del ejemplo y completar valores (especialmente secretos y credenciales de prueba de Mercado Pago):

```bash
cp .env.example .env
$EDITOR .env
chmod 600 .env
```

Valores clave para esta demo (mismo origen):

```env
VITE_API_URL=https://menorcostserver.tail67d69c.ts.net/api
FRONTEND_URL=https://menorcostserver.tail67d69c.ts.net
CORS_ORIGIN=https://menorcostserver.tail67d69c.ts.net
MAIL_PROVIDER=console
```

**Mercado Pago (nombres usados por el backend):** configurar `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_REDIRECT_URI`, `MP_OAUTH_STATE_SECRET`, `MP_TOKENS_ENCRYPTION_KEY`, `MP_PKCE_ENABLED`, `MP_TIMEOUT_MS` y, si aplica al flujo, `MP_WEBHOOK_URL` / `MP_WEBHOOK_SECRET`.
- Callback OAuth público: `https://menorcostserver.tail67d69c.ts.net/api/mercadopago/oauth/callback`
- En la app/configuración de MP, la Redirect URI debe coincidir exactamente con `MP_REDIRECT_URI`.

> `VITE_API_URL` **debe** terminar en `/api` (Caddy recorta ese prefijo al reenviar al backend).
> No es necesario definir `DATABASE_URL` manualmente para el contenedor backend: `docker-compose` la inyecta apuntando al servicio `postgres`.

Archivos de referencia incluidos en el repo: `.env.example` (raíz), `backend_menorcost/.env.example`, `frontend/.env.example`.

## 5. Construir y levantar (Docker)

```bash
cd /opt/menorcost
docker compose up -d --build
docker compose ps
```

Servicios esperados: `menorcost_db` (healthy), `menorcost_backend`, `menorcost_frontend`, `menorcost_caddy`.

- El **backend** ejecuta `prisma migrate deploy` automáticamente al iniciar (idempotente) y luego levanta el servidor. Logs:
  ```bash
  docker compose logs -f backend
  ```
- **Seed (manual, recomendado solo sobre base vacía):**
  ```bash
  docker compose exec backend npm run seed
  # opcional: docker compose exec backend npm run seed:backoffice
  ```

### Verificación local (antes de exponer)

```bash
curl -sS -o /dev/null -w 'frontend %{http_code}\n' http://127.0.0.1:8081/
curl -sS -o /dev/null -w 'api      %{http_code}\n' -X POST \
  -H 'Content-Type: application/json' -d '{}' \
  http://127.0.0.1:8081/api/auth/login
```

- `frontend 200`: SPA servida correctamente.
- `api 400`: el backend respondió (body vacío rechazado). Si ves `404` HTML del SPA, revisar el ruteo/strip de `/api` en `Caddyfile`.

## 6. Publicar con Tailscale Funnel

Con el stack respondiendo en `127.0.0.1:8081`:

```bash
sudo tailscale funnel --bg 8081
sudo tailscale funnel status
```

Comprobar desde otra red (ej. datos móviles):

```bash
curl -I https://menorcostserver.tail67d69c.ts.net/
curl -sS -o /dev/null -w '%{http_code}\n' -X POST \
  -H 'Content-Type: application/json' -d '{}' \
  https://menorcostserver.tail67d69c.ts.net/api/auth/login
```

Esperado: `200` y `400` respectivamente.

## 7. Operación básica

```bash
# Logs
docker compose logs -f --tail=200 backend
docker compose logs -f --tail=200 caddy frontend

# Códigos de verificación (MAIL_PROVIDER=console)
docker compose logs --tail=100 backend | grep -A3 'CORREO (MODO LOCAL)'

# Desplegar cambios
git pull
docker compose up -d --build

# Si solo cambió VITE_API_URL u otras VITE_*: reconstruir frontend
docker compose up -d --build frontend

# Detener (conserva volúmenes)
docker compose down
# ⚠ Elimina BD y uploads:
# docker compose down -v
```

**Persistencia:** volúmenes `postgres_data` (BD) y `backend_uploads` (imágenes en `/app/uploads`).

## 8. Problemas frecuentes

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| `502` público | Caddy o frontend caídos | `docker compose ps`, `docker compose logs caddy frontend` |
| Llamadas a API en `404` / HTML | `VITE_API_URL` sin `/api` o front viejo | Ajustar `.env`, `docker compose up -d --build frontend` |
| Imágenes no cargan | Falla ruteo `/uploads/*` o volumen | Ver `Caddyfile`, probar `curl -I https://.../uploads/<archivo>` |
| `migrate deploy` falla | Credenciales/DB inconsistente | `docker compose logs backend`; revisar `DB_*` y estado del volumen |
| 401 tras cambiar `JWT_SECRET` | Firma distinta | Re-login de usuarios (esperado) |
| Funnel no disponible | MagicDNS/HTTPS o permisos | Revisar admin console y `tailscale funnel status` |

Diagnóstico rápido:

```bash
docker compose ps
docker compose logs --tail=50 backend
sudo tailscale status
sudo tailscale funnel status
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8081/
```

## 9. Checklist de demo

- [ ] `docker compose ps` con 4 servicios arriba y `menorcost_db` healthy.
- [ ] `http://127.0.0.1:8081/` responde `200` y `/api/auth/login` (POST vacío) responde `400`.
- [ ] `tailscale funnel status` apunta a `http://127.0.0.1:8081`.
- [ ] La URL pública abre desde otra red.
- [ ] Login/registro + verificación con código leído en logs (`MAIL_PROVIDER=console`).
- [ ] Subida y visualización de imágenes (ruteo `/uploads/*`).
- [ ] Deep-links de la SPA funcionan al recargar.
- [ ] (Si aplica) Flujo Mercado Pago con credenciales de prueba y `MP_REDIRECT_URI` correcta.

---

**Nota:** este despliegue es “lean” para demo. Para operación prolongada considerar backups de volúmenes, rotación de secretos, hardening de host y políticas de acceso de Tailscale.
