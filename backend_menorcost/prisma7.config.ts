import { defineConfig } from "prisma/config";

// Load .env when available without requiring the dotenv package in containers.
try {
  process.loadEnvFile?.();
} catch {
  // Ignore: rely on environment variables already provided.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
