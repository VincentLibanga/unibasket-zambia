import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { databaseConfig } from './config.js';

let client;
try {
  client = new pg.Client(databaseConfig());
  await client.connect();
  await client.query(await readFile(new URL('./payments.sql', import.meta.url), 'utf8'));
  console.log('Payment storage is ready. Existing catalogue data was retained.');
} catch (error) {
  console.error('[payments] Database setup failed:', error.code || 'CONFIGURATION_ERROR');
  process.exitCode = 1;
} finally {
  if (client) await client.end();
}
