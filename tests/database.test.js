import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

import { PGlite } from '@electric-sql/pglite';
import express from 'express';
import pg from 'pg';

import { databaseConfig } from '../database/config.js';
import { setupDatabase } from '../database/setup.js';
import { createCategoriesRouter } from '../routes/categories.js';
import { createProductsRouter } from '../routes/products.js';

test('database configuration selects the requested database and verifies remote TLS', () => {
  const config = databaseConfig({
    DATABASE_URL: 'postgresql://postgres.project:secret%40value@pooler.supabase.com:5432/catalogue?sslmode=disable',
  });
  const url = new URL(config.connectionString);
  assert.equal(url.pathname, '/catalogue');
  assert.equal(url.password, 'secret%40value');
  assert.equal(url.searchParams.get('sslmode'), 'verify-full');
  const client = new pg.Client(config);
  assert.ok(client.connectionParameters.ssl);
  assert.notEqual(client.connectionParameters.ssl.rejectUnauthorized, false);
  assert.equal(client.connectionParameters.database, 'catalogue');
  assert.equal(databaseConfig({ DATABASE_URL: 'postgresql://postgres@localhost:5432/test' }).connectionTimeoutMillis, 5000);
});

test('missing and invalid database configuration never reveals a supplied password', () => {
  assert.throws(() => databaseConfig({}), /Set DATABASE_URL/);
  for (const value of ['not-a-url-secret-password', 'https://user:secret-password@example.test/postgres']) {
    assert.throws(() => databaseConfig({ DATABASE_URL: value }), error => {
      assert.match(error.message, /DATABASE_URL/);
      assert.equal(error.message.includes('secret-password'), false);
      return true;
    });
  }
});

test('Supabase PostgreSQL schema and catalogue API', async t => {
  const database = new PGlite();
  t.after(() => database.close());
  // pg accepts multi-statement schema files through query(); PGlite calls it exec().
  const setupClient = { query: sql => database.exec(sql) };
  await setupDatabase(setupClient);

  const query = (sql, parameters) => database.query(sql, parameters);
  const app = express();
  app.use('/api/categories', createCategoriesRouter({ query }));
  app.use('/api/products', createProductsRouter({ query }));
  app.use((error, _request, response, _next) => {
    response.status(500).json({ error: error.message });
  });
  const server = createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async path => {
    const response = await fetch(base + path);
    return { status: response.status, ...await response.json() };
  };

  await t.test('setup can run twice and retains all five categories and 72 products', async () => {
    await setupDatabase(setupClient);
    const categories = await get('/api/categories');
    assert.equal(categories.status, 200);
    assert.equal(categories.data.length, 5);
    assert.deepEqual(categories.data.map(category => category.displayOrder), [1, 2, 3, 4, 5]);
    assert.equal(categories.data.reduce((sum, category) => sum + category.productCount, 0), 72);
    assert.equal(typeof categories.data[0].id, 'number');
    const products = await get('/api/products');
    assert.equal(products.status, 200);
    assert.equal(products.data.length, 72);
    assert.deepEqual(products.meta, { page: 1, limit: 100, total: 72, totalPages: 1 });
    for (const product of products.data) {
      assert.equal(typeof product.id, 'number');
      assert.equal(typeof product.category.id, 'number');
      assert.equal(typeof product.price, 'number');
      assert.equal(typeof product.stockQuantity, 'number');
    }
  });

  await t.test('search and category filtering remain case-insensitive and work together', async () => {
    const oats = await get('/api/products?search=OATS&category=ESSENTIAL-GROCERIES&sort=price_asc&limit=1');
    assert.equal(oats.status, 200);
    assert.equal(oats.meta.total, 1);
    assert.equal(oats.data[0].id, 58);
    const namedCategory = await get('/api/products?category=essential%20groceries');
    assert.equal(namedCategory.meta.total, 20);
    const sku = await get('/api/products?search=ub-a4-001');
    assert.deepEqual(sku.data.map(product => product.id), [1]);
  });

  await t.test('price sorting and pagination keep the public response contract', async () => {
    const all = await get('/api/products?sort=price_asc');
    const second = await get('/api/products?sort=price_asc&limit=5&page=2');
    assert.deepEqual(second.data, all.data.slice(5, 10));
    assert.deepEqual(second.meta, { page: 2, limit: 5, total: 72, totalPages: 15 });
    assert.equal(all.data[0].price, 18);
    const descending = await get('/api/products?sort=price_desc&limit=1');
    assert.equal(descending.data[0].price, 449);
  });

  await t.test('single-product results use numeric stable IDs and preserve missing-ID errors', async () => {
    const product = await get('/api/products/1');
    assert.equal(product.status, 200);
    assert.equal(product.data.name, 'Campus Classic A4 Notebook');
    assert.equal(product.data.id, 1);
    assert.equal(product.data.category.id, 1);
    assert.equal(product.data.price, 65);
    assert.equal((await get('/api/products/99999')).status, 404);
    assert.equal((await get('/api/products/not-an-id')).status, 400);
  });

  await t.test('SQL-like filter input stays data and invalid query controls are rejected', async () => {
    for (const key of ['search', 'category']) {
      const result = await get(`/api/products?${key}=${encodeURIComponent("' OR TRUE --")}`);
      assert.equal(result.status, 200);
      assert.equal(result.meta.total, 0);
    }
    for (const suffix of ['limit=101', 'page=0', 'sort=price_asc;DROP%20TABLE%20products']) {
      assert.equal((await get('/api/products?' + suffix)).status, 400);
    }
  });

  await t.test('inactive products are excluded from lists, details and category counts', async () => {
    await query('UPDATE public.products SET is_active = FALSE WHERE id = 72');
    try {
      assert.equal((await get('/api/products')).meta.total, 71);
      assert.equal((await get('/api/products/72')).status, 404);
      const categories = await get('/api/categories');
      assert.equal(categories.data.find(category => category.id === 5).productCount, 19);
    } finally {
      await query('UPDATE public.products SET is_active = TRUE WHERE id = 72');
    }
  });

  await t.test('Postgres enforces catalogue constraints and refreshes updated_at', async () => {
    await assert.rejects(query('UPDATE public.products SET price = -1 WHERE id = 1'), { code: '23514' });
    await assert.rejects(query('UPDATE public.products SET stock_quantity = -1 WHERE id = 1'), { code: '23514' });
    await assert.rejects(query('UPDATE public.products SET category_id = 99999 WHERE id = 1'), { code: '23503' });
    await assert.rejects(query('UPDATE public.products SET sku = $1 WHERE id = 2', ['UB-A4-001']), { code: '23505' });
    const updated = await query("UPDATE public.products SET updated_at = '2000-01-01' WHERE id = 1 RETURNING updated_at");
    assert.ok(new Date(updated.rows[0].updated_at).getFullYear() > 2000);
  });

  await t.test('row level security denies catalogue reads to an unprivileged role', async () => {
    await database.exec('CREATE ROLE catalogue_reader; GRANT USAGE ON SCHEMA public TO catalogue_reader; GRANT SELECT ON public.categories, public.products TO catalogue_reader; SET ROLE catalogue_reader;');
    try {
      assert.equal(Number((await query('SELECT COUNT(*) AS count FROM public.categories')).rows[0].count), 0);
      assert.equal(Number((await query('SELECT COUNT(*) AS count FROM public.products')).rows[0].count), 0);
    } finally {
      await database.exec('RESET ROLE;');
    }
  });

  await t.test('generated IDs advance past the explicit seed IDs', async () => {
    await query('BEGIN');
    try {
      const category = await query("INSERT INTO public.categories (name, slug, description) VALUES ('New category', 'new-category', 'Test category') RETURNING id");
      assert.equal(Number(category.rows[0].id), 6);
      const product = await query("INSERT INTO public.products (category_id, sku, name, description, price, stock_quantity, short_code, badge, art_class) SELECT category_id, 'UB-NEW-073', 'New item', description, price, stock_quantity, short_code, badge, art_class FROM public.products WHERE id = 1 RETURNING id");
      assert.equal(Number(product.rows[0].id), 73);
    } finally {
      await query('ROLLBACK');
    }
  });

  await t.test('a failed seed rolls back schema and category changes as one transaction', async () => {
    await query("UPDATE public.categories SET description = 'Keep this description' WHERE id = 1");
    await query('ALTER TABLE public.products ADD CONSTRAINT reject_test_seed CHECK (stock_quantity < 0) NOT VALID');
    try {
      await assert.rejects(setupDatabase(setupClient), { code: '23514' });
      const category = await query('SELECT description FROM public.categories WHERE id = 1');
      assert.equal(category.rows[0].description, 'Keep this description');
    } finally {
      await query('ALTER TABLE public.products DROP CONSTRAINT reject_test_seed');
    }
  });
});
