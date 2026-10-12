import { Router } from 'express';

import { pool } from '../db.js';

const router = Router();
const SORTS = {
  name_asc: 'p.name ASC',
  price_asc: 'p.price ASC, p.name ASC',
  price_desc: 'p.price DESC, p.name ASC',
};

function productJson(row) {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    stockQuantity: row.stock_quantity,
    shortCode: row.short_code,
    badge: row.badge,
    artClass: row.art_class,
    imageUrl: row.image_url,
    category: {
      id: row.category_id,
      name: row.category_name,
      slug: row.category_slug,
    },
  };
}

function positiveInteger(value, fallback, maximum) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) return null;
  return parsed;
}

router.get('/', async (request, response, next) => {
  const search = String(request.query.search || '').trim();
  const category = String(request.query.category || '').trim();
  const sort = String(request.query.sort || 'name_asc');
  const page = positiveInteger(request.query.page, 1, 100000);
  const limit = positiveInteger(request.query.limit, 100, 100);

  if (page === null || limit === null || !Object.hasOwn(SORTS, sort)) {
    return response.status(400).json({
      error: {
        code: 'INVALID_QUERY',
        message: 'Use a positive page, a limit from 1 to 100, and a supported sort value.',
      },
    });
  }

  const clauses = ['p.is_active = TRUE'];
  const parameters = [];

  if (search) {
    clauses.push('(p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)');
    const term = `%${search}%`;
    parameters.push(term, term, term);
  }

  if (category) {
    clauses.push('(c.slug = ? OR c.name = ?)');
    parameters.push(category, category);
  }

  const where = `WHERE ${clauses.join(' AND ')}`;
  const offset = (page - 1) * limit;

  try {
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM products AS p
       INNER JOIN categories AS c ON c.id = p.category_id
       ${where}`,
      parameters,
    );

    const [rows] = await pool.execute(
      `SELECT
         p.id, p.sku, p.name, p.description, p.price, p.stock_quantity,
         p.short_code, p.badge, p.art_class, p.image_url,
         c.id AS category_id, c.name AS category_name, c.slug AS category_slug
       FROM products AS p
       INNER JOIN categories AS c ON c.id = p.category_id
       ${where}
       ORDER BY ${SORTS[sort]}
       LIMIT ? OFFSET ?`,
      [...parameters, limit, offset],
    );

    const total = Number(countRows[0].total);
    response.json({
      data: rows.map(productJson),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (request, response, next) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return response.status(400).json({
      error: { code: 'INVALID_PRODUCT_ID', message: 'The product ID must be a positive integer.' },
    });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT
         p.id, p.sku, p.name, p.description, p.price, p.stock_quantity,
         p.short_code, p.badge, p.art_class, p.image_url,
         c.id AS category_id, c.name AS category_name, c.slug AS category_slug
       FROM products AS p
       INNER JOIN categories AS c ON c.id = p.category_id
       WHERE p.id = ? AND p.is_active = TRUE`,
      [id],
    );

    if (!rows.length) {
      return response.status(404).json({
        error: { code: 'PRODUCT_NOT_FOUND', message: 'The requested product was not found.' },
      });
    }

    response.json({ data: productJson(rows[0]) });
  } catch (error) {
    next(error);
  }
});

export default router;
