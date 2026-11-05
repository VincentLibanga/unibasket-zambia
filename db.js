import pg from 'pg';

import { databaseConfig } from './database/config.js';

let pool;

export async function queryDatabase(text, parameters) {
  // Connect lazily so the static preview can still run before Supabase is configured.
  if (!pool) {
    pool = new pg.Pool(databaseConfig());
    pool.on('error', error => {
      console.error('[db] Supabase idle connection error:', error.code || 'CONNECTION_ERROR');
    });
  }
  return pool.query(text, parameters);
}

export async function verifyDatabase() {
  // Verify the application tables as well as the connection.
  await queryDatabase('SELECT id FROM public.categories LIMIT 1');
  await queryDatabase('SELECT id FROM public.products LIMIT 1');
}

export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
