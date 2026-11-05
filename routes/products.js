import { Router } from 'express';

import { queryDatabase } from '../db.js';

const SORTS = {
  name_asc: 'p.name ASC',
  price_asc: 'p.price ASC, p.name ASC',
  price_desc: 'p.price DESC, p.name ASC',
};

function productJson(row) {
  return {
    id: Number(row.id),
    sku: row.sku,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    stockQuantity: Number(row.stock_quantity),
    shortCode: row.short_code,
    badge: row.badge,
    artClass: row.art_class,
    imageUrl: row.image_url,
    category: {
      id: Number(row.category_id),
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

export function createProductsRouter({ query = queryDatabase } = {}) {
  const router = Router();

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
      const term = `%${search}%`;
      parameters.push(term);
      const parameter = `$${parameters.length}`;
      clauses.push(`(p.name ILIKE ${parameter} OR p.description ILIKE ${parameter} OR p.sku ILIKE ${parameter})`);
    }

    if (category) {
      parameters.push(category);
      const parameter = `$${parameters.length}`;
      clauses.push(`(LOWER(c.slug) = LOWER(${parameter}) OR LOWER(c.name) = LOWER(${parameter}))`);
    }

    const where = `WHERE ${clauses.join(' AND ')}`;
    const offset = (page - 1) * limit;

    try {
      const { rows: countRows } = await query(
        `SELECT COUNT(*) AS total
         FROM public.products AS p
         INNER JOIN public.categories AS c ON c.id = p.category_id
         ${where}`,
        parameters,
      );

      const { rows } = await query(
        `SELECT
           p.id, p.sku, p.name, p.description, p.price, p.stock_quantity,
           p.short_code, p.badge, p.art_class, p.image_url,
           c.id AS category_id, c.name AS category_name, c.slug AS category_slug
         FROM public.products AS p
         INNER JOIN public.categories AS c ON c.id = p.category_id
         ${where}
         ORDER BY ${SORTS[sort]}
         LIMIT $${parameters.length + 1} OFFSET $${parameters.length + 2}`,
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
    if (!Number.isSafeInteger(id) || id < 1) {
      return response.status(400).json({
        error: { code: 'INVALID_PRODUCT_ID', message: 'The product ID must be a positive integer.' },
      });
    }

    try {
      const { rows } = await query(
        `SELECT
           p.id, p.sku, p.name, p.description, p.price, p.stock_quantity,
           p.short_code, p.badge, p.art_class, p.image_url,
           c.id AS category_id, c.name AS category_name, c.slug AS category_slug
         FROM public.products AS p
         INNER JOIN public.categories AS c ON c.id = p.category_id
         WHERE p.id = $1 AND p.is_active = TRUE`,
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

  return router;
}

export default createProductsRouter();
