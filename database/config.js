import { resolve } from 'node:path';

export function databaseConfig(env = process.env) {
  const connectionString = env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('Set DATABASE_URL in .env to the Postgres connection string from your Supabase project.');
  }

  let url;
  try {
    url = new URL(connectionString);
  } catch {
    // Never include the supplied connection string: it contains a database password.
    throw new Error('DATABASE_URL must be a valid Supabase Postgres connection string.');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.pathname.slice(1)) {
    throw new Error('DATABASE_URL must include a Postgres host, username, and database name.');
  }

  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!local) url.searchParams.set('sslmode', 'verify-full');
  if (env.DATABASE_SSL_CA_FILE?.trim()) {
    url.searchParams.set('sslmode', 'verify-full');
    url.searchParams.set('sslrootcert', resolve(env.DATABASE_SSL_CA_FILE.trim()));
  }

  return {
    connectionString: url.toString(),
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  };
}
