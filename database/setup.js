import { readFile } from 'node:fs/promises';

import mysql from 'mysql2/promise';

const requiredVariables = ['DB_HOST', 'DB_USER', 'DB_PASSWORD'];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);
if (missingVariables.length) {
  throw new Error(`Missing database environment variables: ${missingVariables.join(', ')}`);
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  multipleStatements: true,
  charset: 'utf8mb4',
});

try {
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  const seed = await readFile(new URL('./seed.sql', import.meta.url), 'utf8');
  await connection.query(schema);
  await connection.query(seed);
  console.log('UniBasket database schema and 72-product seed completed.');
} finally {
  await connection.end();
}
