process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgresql@localhost:5432/menorcost_test?schema=public';
process.env.JWT_SECRET = 'e2e-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.MAIL_PROVIDER = 'console';
process.env.MAIL_FROM = 'Menorcost <no-reply@menorcost.local>';
