import { execSync } from 'node:child_process';
import { Client } from 'pg';

const ADMIN_URL =
  process.env.TEST_ADMIN_DATABASE_URL ??
  'postgresql://postgres:postgresql@localhost:5432/postgres';
const TEST_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgresql@localhost:5432/menorcost_test?schema=public';

const TEST_DB_NAME = 'menorcost_test';

export default async function globalSetup(): Promise<void> {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();

  const existente = await admin.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [TEST_DB_NAME],
  );

  if (existente.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  }

  await admin.end();

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_URL },
  });

  const testDb = new Client({ connectionString: TEST_URL });
  await testDb.connect();

  const { rows } = await testDb.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
  );

  if (rows.length > 0) {
    const tablas = rows
      .map((fila) => `"public"."${fila.tablename}"`)
      .join(', ');
    await testDb.query(`TRUNCATE TABLE ${tablas} RESTART IDENTITY CASCADE`);
  }

  await testDb.end();
}
