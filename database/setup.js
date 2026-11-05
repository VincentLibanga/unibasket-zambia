import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import pg from 'pg';

import { databaseConfig } from './config.js';

export async function setupDatabase(client) {
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  const seed = await readFile(new URL('./seed.sql', import.meta.url), 'utf8');

  await client.query('BEGIN');
  try {
    await client.query(schema);
    await client.query(seed);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let client;
  try {
    client = new pg.Client(databaseConfig());
    await client.connect();
    await setupDatabase(client);
    console.log('Supabase Postgres schema, five categories and 72 products are ready.');
  } catch (error) {
    console.error('[db] Supabase setup failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (client) await client.end();
  }
}
