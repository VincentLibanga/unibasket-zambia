import { Router } from 'express';

import { queryDatabase } from '../db.js';

export function createCategoriesRouter({ query = queryDatabase } = {}) {
  const router = Router();

  router.get('/', async (_request, response, next) => {
    try {
      const { rows } = await query(`
        SELECT
          c.id,
          c.name,
          c.slug,
          c.description,
          c.display_order,
          COUNT(p.id) AS product_count
        FROM public.categories AS c
        LEFT JOIN public.products AS p
          ON p.category_id = c.id
         AND p.is_active = TRUE
        GROUP BY c.id, c.name, c.slug, c.description, c.display_order
        ORDER BY c.display_order, c.name
      `);

      response.json({
        data: rows.map((row) => ({
          id: Number(row.id),
          name: row.name,
          slug: row.slug,
          description: row.description,
          displayOrder: Number(row.display_order),
          productCount: Number(row.product_count),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createCategoriesRouter();
