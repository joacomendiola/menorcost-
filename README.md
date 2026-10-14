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

- **Frontend:** React + Vite, TypeScript, Mantine UI, OpenStreetMap (CartoDB Tiles).
* **Backend:** Node.js, NestJS (Modular Monolith, Arquitectura en capas), TypeScript, JWT.
* **Persistencia y ORM:** PostgreSQL (vía Docker) y Prisma ORM.
* **Integraciones Externas:** Mercado Pago Checkout & Split Payment API (OAuth), Google Places API (validación geográfica), Nodemailer / Gmail API.
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
├── package.json
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
Crea un tercer archivo llamado .env y pega lo siguiente (esto conecta React con la API de NestJS):

VITE_API_URL=http://localhost:3000

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

5. Ejecutar el Proyecto
Una vez instaladas las dependencias y con la base de datos corriendo, podés iniciar los servidores de desarrollo:

Frontend (Vite): npm run dev (dentro de la carpeta /frontend)
Backend (NestJS): npm run start:dev (dentro de la carpeta /backend_menorcost)

*El frontend estará disponible en tu navegador en:* `http://localhost:5173`

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
