-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('CLIENTE', 'COMERCIANTE', 'ADMINISTRADOR');

-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('HABILITADO', 'PENDIENTE_VERIFICACION', 'SUSPENDIDO', 'SOLICITUD_BAJA_PENDIENTE', 'BAJO_INVESTIGACION', 'DOCUMENTACION_RECHAZADA');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "fechaNacimiento" TIMESTAMP(3) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'CLIENTE',
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'PENDIENTE_VERIFICACION',
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direcciones" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "calle" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "piso" TEXT,
    "localidad" TEXT NOT NULL,
    "descripcion" TEXT,
    "latitud" DECIMAL(9,6) NOT NULL,
    "longitud" DECIMAL(9,6) NOT NULL,
    "esPredeterminada" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "direcciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_dni_key" ON "usuarios"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "direcciones_usuarioId_idx" ON "direcciones"("usuarioId");

-- AddForeignKey
ALTER TABLE "direcciones" ADD CONSTRAINT "direcciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
