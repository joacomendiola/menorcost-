-- AlterTable
ALTER TABLE "credenciales_mp" ADD COLUMN     "live_mode" BOOLEAN,
ADD COLUMN     "scope" VARCHAR(200);

-- CreateTable
CREATE TABLE "mp_oauth_state" (
    "id" UUID NOT NULL,
    "nonce" VARCHAR(64) NOT NULL,
    "usuario_id" UUID NOT NULL,
    "id_comercio" UUID NOT NULL,
    "code_verifier" VARCHAR(128),
    "expira_en" TIMESTAMP(3) NOT NULL,
    "usado_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mp_oauth_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mp_oauth_state_nonce_key" ON "mp_oauth_state"("nonce");

-- CreateIndex
CREATE INDEX "mp_oauth_state_expira_en_idx" ON "mp_oauth_state"("expira_en");
