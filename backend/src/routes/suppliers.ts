import express, { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { parsePrice } from '../services/priceParser';
import { bulkSearchPrices, searchMaterialPrice } from '../services/supplierSearch';
import { superadminAuthMiddleware } from './superadmin';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../config/permissions';

const router = express.Router();

const parsePriceSchema = z.object({
  url: z.string().url(),
});

const bulkSearchSchema = z.object({
  supplierUrls: z.array(z.string().url()).min(1),
  materialType: z.enum(['rough', 'finish']),
});

const bulkUpdateSchema = z.object({
  updates: z.array(z.object({
    id: z.string().uuid(),
    price: z.number().min(0),
    supplierUrl: z.string().url().optional(),
    supplierName: z.string().optional(),
  })).min(1),
});

/**
 * Парсинг цены по прямой ссылке на товар (для суперадминов)
 */
router.post('/parse-price', superadminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const body = parsePriceSchema.parse(req.body);

    const parsedPrice = await parsePrice(body.url);

    res.json({
      success: true,
      price: parsedPrice.price,
      currency: parsedPrice.currency,
      supplierName: parsedPrice.supplierName,
      url: body.url,
    });
  } catch (error: any) {
    console.error('Parse price error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to parse price',
    });
  }
});

/**
 * Парсинг цены по прямой ссылке на товар (для обычных пользователей с правами EDIT_PRICES)
 */
router.post('/user/parse-price', authMiddleware, requirePermission(PERMISSIONS.EDIT_PRICES), async (req: Request, res: Response) => {
  try {
    const body = parsePriceSchema.parse(req.body);

    const parsedPrice = await parsePrice(body.url);

    res.json({
      success: true,
      price: parsedPrice.price,
      currency: parsedPrice.currency,
      supplierName: parsedPrice.supplierName,
      url: body.url,
    });
  } catch (error: any) {
    console.error('Parse price error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to parse price',
    });
  }
});

/**
 * Массовый поиск цен через ИИ для всех материалов указанного типа (для суперадминов)
 */
router.post('/bulk-search', superadminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const body = bulkSearchSchema.parse(req.body);

    // Получаем все материалы указанного типа из default_price_items
    const materialsResult = await pool.query(
      `SELECT id, name FROM default_price_items 
       WHERE type = $1
       ORDER BY name`,
      [body.materialType]
    );

    const materials = materialsResult.rows.map(row => ({
      id: row.id,
      name: row.name,
    }));

    if (materials.length === 0) {
      res.json({
        success: true,
        results: [],
        total: 0,
        completed: 0,
      });
      return;
    }

    // Запускаем массовый поиск
    const results = await bulkSearchPrices(
      materials,
      body.supplierUrls,
      (current, total) => {
        // Логируем только каждые 5 материалов, чтобы не превысить лимит Railway
        if (current % 5 === 0 || current === total) {
          console.log(`Progress: ${current}/${total}`);
        }
      }
    );

    res.json({
      success: true,
      results: results.map(r => ({
        materialId: r.materialId,
        materialName: r.materialName,
        results: r.results,
        bestPrice: r.bestPrice,
      })),
      total: materials.length,
      completed: results.length,
    });
  } catch (error: any) {
    console.error('Bulk search error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to perform bulk search',
    });
  }
});

/**
 * Массовый поиск цен для обычных пользователей с правами EDIT_PRICES
 * Использует price_items вместо default_price_items
 */
router.post('/user/bulk-search', authMiddleware, requirePermission(PERMISSIONS.EDIT_PRICES), async (req: Request, res: Response) => {
  try {
    const body = bulkSearchSchema.parse(req.body);
    const userId = req.user!.id;
    const organizationId = req.user!.organizationId;

    // Получаем материалы из price_items пользователя
    const materialsResult = await pool.query(
      `SELECT id, name FROM price_items 
       WHERE type = $1 AND organization_id = $2 AND deleted_at IS NULL
       ORDER BY name`,
      [body.materialType, organizationId]
    );

    const materials = materialsResult.rows.map(row => ({
      id: row.id,
      name: row.name,
    }));

    if (materials.length === 0) {
      res.json({
        success: true,
        results: [],
        total: 0,
        completed: 0,
      });
      return;
    }

    // Запускаем массовый поиск
    const results = await bulkSearchPrices(
      materials,
      body.supplierUrls,
      (current, total) => {
        console.log(`Progress: ${current}/${total}`);
      }
    );

    res.json({
      success: true,
      results: results.map(r => ({
        materialId: r.materialId,
        materialName: r.materialName,
        results: r.results,
        bestPrice: r.bestPrice,
      })),
      total: materials.length,
      completed: results.length,
    });
  } catch (error: any) {
    console.error('Bulk search error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to perform bulk search',
    });
  }
});

/**
 * Массовое обновление цен в базе данных (для суперадминов)
 */
router.post('/bulk-update', superadminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const body = bulkUpdateSchema.parse(req.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const updated: string[] = [];
      const errors: Array<{ id: string; error: string }> = [];

      for (const update of body.updates) {
        try {
          const updateFields: string[] = ['price = $1', 'last_price_update = NOW()'];
          const values: any[] = [update.price];
          let paramIndex = 2;

          if (update.supplierUrl) {
            updateFields.push(`supplier_url = $${paramIndex++}`);
            values.push(update.supplierUrl);
          }
          if (update.supplierName) {
            updateFields.push(`supplier_name = $${paramIndex++}`);
            values.push(update.supplierName);
          }

          values.push(update.id);

          const result = await client.query(
            `UPDATE default_price_items 
             SET ${updateFields.join(', ')}
             WHERE id = $${paramIndex++}
             RETURNING id`,
            values
          );

          if (result.rows.length > 0) {
            updated.push(update.id);
          } else {
            errors.push({ id: update.id, error: 'Price item not found' });
          }
        } catch (err: any) {
          errors.push({ id: update.id, error: err.message || 'Update failed' });
        }
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        updated: updated.length,
        errors: errors.length,
        updatedIds: updated,
        errorDetails: errors,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Bulk update error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update prices',
    });
  }
});

/**
 * Массовое обновление цен для обычных пользователей (обновляет price_items)
 */
router.post('/user/bulk-update', authMiddleware, requirePermission(PERMISSIONS.EDIT_PRICES), async (req: Request, res: Response) => {
  try {
    const body = bulkUpdateSchema.parse(req.body);
    const userId = req.user!.id;
    const organizationId = req.user!.organizationId;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const updated: string[] = [];
      const errors: Array<{ id: string; error: string }> = [];

      for (const update of body.updates) {
        try {
          const updateFields: string[] = ['price = $1', 'last_price_update = NOW()'];
          const values: any[] = [update.price];
          let paramIndex = 2;

          if (update.supplierUrl) {
            updateFields.push(`supplier_url = $${paramIndex++}`);
            values.push(update.supplierUrl);
          }
          if (update.supplierName) {
            updateFields.push(`supplier_name = $${paramIndex++}`);
            values.push(update.supplierName);
          }

          values.push(update.id, organizationId);

          const result = await client.query(
            `UPDATE price_items 
             SET ${updateFields.join(', ')}
             WHERE id = $${paramIndex++} AND organization_id = $${paramIndex++} AND deleted_at IS NULL
             RETURNING id`,
            values
          );

          if (result.rows.length > 0) {
            updated.push(update.id);
          } else {
            errors.push({ id: update.id, error: 'Price item not found' });
          }
        } catch (err: any) {
          errors.push({ id: update.id, error: err.message || 'Update failed' });
        }
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        updated: updated.length,
        errors: errors.length,
        updatedIds: updated,
        errorDetails: errors,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Bulk update error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update prices',
    });
  }
});

/**
 * Поиск цены для одного материала (для суперадминов)
 */
router.post('/search-material', superadminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const body = z.object({
      materialName: z.string().min(1),
      supplierUrls: z.array(z.string().url()).min(1),
    }).parse(req.body);

    const results = await searchMaterialPrice(body.materialName, body.supplierUrls);

    res.json({
      success: true,
      results,
      bestPrice: results.length > 0
        ? results.reduce((best, current) => 
            current.price < best.price ? current : best
          )
        : null,
    });
  } catch (error: any) {
    console.error('Search material error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search material',
    });
  }
});

export default router;

