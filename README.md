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

* **Frontend:** React + Vite, TypeScript, CSS / Tailwind CSS, OpenStreetMap (CartoDB Tiles).
* **Backend:** Node.js, NestJS (Modular Monolith, Arquitectura en capas), TypeScript, JWT.
* **Persistencia y ORM:** PostgreSQL (vía Docker) y Prisma ORM.
* **Integraciones Externas:** Mercado Pago Checkout & Split Payment API (OAuth), Google Places API (validación geográfica), Nodemailer / Gmail API.
* **Infraestructura Local:** Docker & Docker Compose.

---

## 📂 Estructura del Repositorio (Monorepo)

```text
menorcost/
├── backend/                  # Servidor API REST con NestJS y Prisma ORM
│   ├── src/                  # Módulos: auth, shops, products, orders, payments, moderation
│   ├── prisma/               # Esquema relacional (schema.prisma) y migraciones
│   ├── .env.example          # Plantilla de variables de entorno del backend
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                 # Aplicación Web SPA (React + Vite)
│   ├── src/                  # Vistas (comercio, cliente, admin), componentes, servicios HTTP
│   ├── .env.example          # Plantilla de variables de entorno del frontend
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── docker-compose.yml        # Orquestación del contenedor local de PostgreSQL
├── .gitignore
└── README.md
```

---

## 🚀 Guía de Instalación y Puesta en Marcha

Sigue estos pasos en orden para levantar todo el entorno de desarrollo local:

### 1. Prerrequisitos
Asegúrate de tener instalado en tu computadora:
* [Node.js](https://nodejs.org/) (versión 18 LTS o superior)
* [Git](https://git-scm.com/)
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) (abierto y en ejecución)

---

### 2. Clonar el repositorio
```bash
git clone <URL_DEL_REPOSITORIO>
cd menorcost
```

---

### 3. Levantar la Base de Datos (Docker)
En la raíz del proyecto, ejecuta:
```bash
docker compose up -d
```
> *Esto descargará y levantará el contenedor de PostgreSQL en segundo plano en el puerto `8432`.*  
> *Para detener la base de datos en cualquier momento usa: `docker compose down`.*

---

### 4. Configurar y Levantar el Backend (NestJS)

1. **Ingresar a la carpeta del backend e instalar dependencias:**
   ```bash
   cd backend
   npm install
   ```

2. **Configurar variables de entorno:**
   Copia el archivo de ejemplo a `.env`:
   ```bash
   cp .env.example .env
   ```
   *Verifica que la variable `DATABASE_URL` apunte a la base de datos de Docker:*
   ```env
   PORT=3000
   DATABASE_URL="postgresql://menorcost_user:menorcost_secret@localhost:8432/menorcost_db?schema=public"
   JWT_SECRET="tu_clave_secreta_jwt_desarrollo"
   GOOGLE_PLACES_API_KEY="tu_clave_de_google_places"
   MP_ACCESS_TOKEN="tu_token_de_prueba_mercadopago"
   ```

3. **Ejecutar migraciones y generar el cliente de Prisma:**
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Iniciar el servidor en modo desarrollo:**
   ```bash
   npm run start:dev
   ```
   *El backend estará escuchando en:* `http://localhost:3000/api`

---

### 5. Configurar y Levantar el Frontend (React + Vite)

Abre **otra terminal**, sitúate en la raíz del proyecto y realiza:

1. **Ingresar a la carpeta del frontend e instalar dependencias:**
   ```bash
   cd frontend
   npm install
   ```

2. **Configurar variables de entorno:**
   Copia el archivo de ejemplo a `.env`:
   ```bash
   cp .env.example .env
   ```
   *Contenido de `.env` en el frontend:*
   ```env
   VITE_API_BASE_URL="http://localhost:3000/api"
   ```

3. **Iniciar el servidor de desarrollo de Vite:**
   ```bash
   npm run dev
   ```
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

---

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
