# MENORCOST
> **Plataforma de Comercialización de Productos Próximos a Vencer**  
> Laboratorio de Desarrollo de Software | UNTDF - 2026

---

## 👥 Integrantes del Equipo
* Gastón Mendiola
* Nehuen Hervías
* Alexis Chambi
* Joaquín Mendiola
* Gabriel Guitian

---

## 📌 Descripción del Proyecto
MENORCOST es una plataforma web orientada al comercio minorista de cercanía (kioscos, almacenes y minimercados) y a consumidores locales. Permite a los comerciantes publicar lotes de productos próximos a vencer o de baja rotación con descuentos significativos, reduciendo pérdidas económicas y el desperdicio de alimentos. Los clientes pueden explorar ofertas georreferenciadas por proximidad a su dirección predeterminada, gestionar canastas independientes por negocio, abonar de forma digital mediante Checkout con Split Payment de Mercado Pago y retirar sus pedidos en mostrador mediante código QR dinámico.

---

## 🛠️ Stack Tecnológico

- **Frontend:** React + Vite, TypeScript, Mantine UI, MapLibre GL JS.
* **Backend:** Node.js, NestJS (Modular Monolith, Arquitectura en capas), TypeScript, JWT.
* **Persistencia y ORM:** PostgreSQL (vía Docker) y Prisma ORM.
* **Integraciones Externas:** Mercado Pago Checkout & Split Payment API (OAuth), OpenStreetMap / Photon (mapas y geocodificación), Nodemailer / Gmail API.
* **Infraestructura Local:** Docker & Docker Compose.

---

## 📂 Estructura del Repositorio (Monorepo)

```text
menorcost/
├── backend_menorcost/
│   ├── src/
│   ├── prisma/
│   ├── package.json
│   ├── prisma7.config.ts
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── docker-compose.yml
└── README.md
```

---
Para ejecutar este proyecto, necesitás tener instalado:
Node.js (Se recomienda versión 22 o superior 24 LTS )
Docker Desktop (Debe estar abierto y corriendo de fondo)
Git

🚀 Guía de Inicio Rápido
Seguí estos pasos en orden para levantar el entorno de desarrollo local.

---

1. Clonar el repositorio
Abrí tu terminal y ejecutá:

git clone <URL_DEL_REPOSITORIO>
cd menorcost-

---

2. Configurar Variables de Entorno 
Por seguridad, no subimos credenciales al repositorio. Debes crear tres archivos .env manualmente en tu computadora:

A. En la carpeta raíz (/menorcost-):
Crea un archivo llamado .env y pega lo siguiente (esto configura el contenedor de Docker):

DB_USER=postgres
DB_PASSWORD=menorcostpassword
DB_NAME=menorcost
DB_LOCAL_PORT=5433

B. En la carpeta del backend (/backend_menorcost):
Crea otro archivo llamado .env y pega lo siguiente (esto conecta Prisma con la base de datos):

DATABASE_URL="postgresql://postgres:menorcostpassword@localhost:5433/menorcost?schema=public"

C. En la carpeta del frontend (/frontend):
Crea un archivo `frontend/.env.local` para conectar React con NestJS:

```env
VITE_API_URL=http://localhost:3000
```

Los mapas usan MapLibre GL JS con tiles de OpenFreeMap y geocodificación de Photon (OpenStreetMap), por lo que no requieren API key. Vite expone las variables `VITE_*` al navegador; no publiques secretos en el repositorio. `frontend/.env.local` está excluido de Git.

Después de crear o modificar este archivo, reiniciá el frontend (`npm run dev` dentro de `/frontend`) para que Vite vuelva a cargar las variables.

---

3. Levantar la Base de Datos
Desde la carpeta raíz, ejecuta el siguiente comando para encender el contenedor de PostgreSQL:

docker compose up -d
*(Nota: Usamos el puerto 5433 para evitar conflictos si ya tenés un PostgreSQL nativo corriendo en el puerto 5432).*

---

4. Instalar Dependencias
Vas a necesitar instalar las librerías en ambas carpetas.
Para el Backend:

cd backend_menorcost
npm install
Para el Frontend:

cd ../frontend
npm install

---

5. Preparar la Base de Datos
Con PostgreSQL corriendo, aplicá las migraciones y generá el cliente de Prisma desde la carpeta del backend:

```powershell
cd backend_menorcost
npx prisma migrate dev
npx prisma generate
npm run seed
```

Si la base ya está migrada y solo cambiaste el schema, alcanza con `npx prisma generate`. Para verificar el estado de las migraciones usá `npx prisma migrate status`.

6. Ejecutar el Proyecto
Una vez instaladas las dependencias, aplicadas las migraciones y con la base de datos corriendo, podés iniciar los servidores de desarrollo:

Frontend (Vite): npm run dev (dentro de la carpeta /frontend)
Backend (NestJS): npm run start:dev (dentro de la carpeta /backend_menorcost)

*El frontend estará disponible en tu navegador en:* `http://localhost:5173`

## ⏰ CU-2.07: Depuración automática de ofertas vencida

El backend ejecuta diariamente, a las 00:00, una tarea programada con la zona horaria:

America/Argentina/Ushuaia

La tarea busca ofertas en estado `ACTIVO` cuya fecha de vencimiento sea anterior al día actual, por lo que siguen vigentes durante todo el día indicado como vencimiento. Luego:

- Cambia el estado a `VENCIDO_ELIMINADO`.
- Registra la operación en `auditoria_vencimiento_oferta`.
- Crea una notificación persistente para el comerciante.
- Retira la oferta del catálogo público.
- Conserva los pedidos, pagos y códigos QR existentes.

### Ejecutar manualmente la depuración

Desde la carpeta del backend:

```powershell
cd backend_menorcost
npm run vencimiento:ofertas
```

Este comando utiliza el mismo servicio que ejecuta el cron automático y muestra la cantidad de ofertas procesadas.

### Datos de prueba del CU-2.07

La seed general crea las categorías y todos los datos de prueba, incluido el caso de CU-2.07. Para prepararlos y ejecutar la depuración:

```powershell
cd backend_menorcost
npm run seed
npm run vencimiento:ofertas
```

Credenciales de prueba:

```text
Usuario: comerciante-cu207@test.com
Contraseña: Password123
```

La notificación puede consultarse desde la campana del panel del comerciante.


### Datos de prueba del backoffice

Además de la seed general, el backend incluye una seed específica para probar el panel de administración: altas de comercios, solicitudes de baja y denuncias.

Desde la carpeta del backend:

```powershell
cd backend_menorcost
npm run seed
npm run seed:backoffice
```

La seed de backoffice es idempotente: vuelve a crear únicamente sus datos de prueba y no modifica el resto de la base. Requiere que `npm run seed` se haya ejecutado antes. Para restaurar los datos a su estado inicial, volvé a ejecutar `npm run seed:backoffice`.

Datos que genera:

- 2 altas pendientes, 1 rechazada y 2 aprobadas.
- 3 bajas pendientes (una bloqueada por un pedido en curso), 1 aprobada y 1 rechazada.
- 7 denuncias: 5 abiertas, 1 resuelta y 1 desestimada.
- 16 usuarios de prueba.

Credenciales:

```text
Administrador: admin@test.com / Password123
Usuarios de backoffice: bo.*@test.com / Password123
```

Los usuarios de backoffice usan correos ficticios `@test.com`; no son cuentas de Gmail. El detalle de cada usuario y sus datos asociados está en `backend_menorcost/prisma/seed-backoffice.ts`.

CU-1.02 no almacena documentación: el comerciante la envía a `menorcost@gmail.com` y la revisión es externa. El Backoffice registra únicamente la resolución del alta: administrador, fecha y motivo de rechazo (CU-5.03).

Estos datos son solo para desarrollo local.

---

## 🌿 Flujo de Trabajo en Git para el Equipo

Para evitar colisiones y conflictos de código entre los 5 integrantes:

1. **Rama `main`:** Código estable y probado para entregas.
2. **Rama `develop`:** Rama de integración continua del equipo.
3. **Ramas por funcionalidad / caso de uso:**
   * Crea siempre una rama a partir de `develop`:
     ```bash
     git checkout develop
     git pull origin develop
     git checkout -b feature/cu-1.02-registro-comercio
     ```
   * Una vez terminada la tarea, sube la rama y abre un **Pull Request (PR)** hacia `develop` para que otro compañero la revise antes de fusionar.

## 📋 Comandos Útiles

| Tarea | Directorio | Comando |
| :--- | :--- | :--- |
| Levantar PostgreSQL en Docker | `/` (raíz) | `docker compose up -d` |
| Frenar PostgreSQL en Docker | `/` (raíz) | `docker compose down` |
| Abrir Prisma Studio (explorador visual de BD) | `/backend` | `npx prisma studio` |
| Correr nuevas migraciones de Prisma | `/backend` | `npx prisma migrate dev` |
| Correr Backend en desarrollo | `/backend` | `npm run start:dev` |
| Correr Frontend en desarrollo | `/frontend` | `npm run dev` |
| Compilar Frontend para producción (Vite build) | `/frontend` | `npm run build` |
