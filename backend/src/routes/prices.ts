import express, { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../config/permissions';

const router = express.Router();

const createPriceItemSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  price: z.number().positive(),
  category: z.string().min(1),
  subcategory: z.string().optional(),
  type: z.enum(['work', 'rough', 'finish']),
});

const updatePriceItemSchema = z.object({
  name: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  category: z.string().min(1).optional(),
  subcategory: z.string().optional(),
  type: z.enum(['work', 'rough', 'finish']).optional(),
});

// Get all price items for organization
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await pool.query(
      `SELECT id, name, unit, price, category, subcategory, type, created_at, updated_at
       FROM price_items
       WHERE organization_id = $1 AND deleted_at IS NULL
       ORDER BY category, subcategory, name`,
      [req.user.organizationId]
    );

    res.json(result.rows.map(row => ({
      id: row.id,
      name: row.name,
      unit: row.unit,
      price: parseFloat(row.price),
      category: row.category,
      subcategory: row.subcategory || undefined,
      type: row.type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })));
  } catch (error) {
    console.error('Get price items error:', error);
    res.status(500).json({ error: 'Failed to fetch price items' });
  }
});

// Create price item (admin only, requires EDIT_PRICES permission)
router.post('/', authMiddleware, requirePermission(PERMISSIONS.EDIT_PRICES), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = createPriceItemSchema.parse(req.body);

    const result = await pool.query(
      `INSERT INTO price_items (organization_id, name, unit, price, category, subcategory, type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, unit, price, category, subcategory, type, created_at, updated_at`,
      [req.user.organizationId, body.name, body.unit, body.price, body.category, body.subcategory || null, body.type]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      name: row.name,
      unit: row.unit,
      price: parseFloat(row.price),
      category: row.category,
      subcategory: row.subcategory || undefined,
      type: row.type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Create price item error:', error);
    res.status(500).json({ error: 'Failed to create price item' });
  }
});

// Update price item
router.patch('/:id', authMiddleware, requirePermission(PERMISSIONS.EDIT_PRICES), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const priceItemId = req.params.id;
    const body = updatePriceItemSchema.parse(req.body);

    // Check if price item belongs to organization
    const checkResult = await pool.query(
      'SELECT id FROM price_items WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [priceItemId, req.user.organizationId]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Price item not found' });
      return;
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (body.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(body.name);
    }
    if (body.unit !== undefined) {
      updates.push(`unit = $${paramIndex++}`);
      values.push(body.unit);
    }
    if (body.price !== undefined) {
      updates.push(`price = $${paramIndex++}`);
      values.push(body.price);
    }
    if (body.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(body.category);
    }
    if (body.subcategory !== undefined) {
      updates.push(`subcategory = $${paramIndex++}`);
      values.push(body.subcategory || null);
    }
    if (body.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      values.push(body.type);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(priceItemId, req.user.organizationId);

    const result = await pool.query(
      `UPDATE price_items 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex++} AND deleted_at IS NULL
       RETURNING id, name, unit, price, category, subcategory, type, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Price item not found' });
      return;
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      unit: row.unit,
      price: parseFloat(row.price),
      category: row.category,
      subcategory: row.subcategory || undefined,
      type: row.type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Update price item error:', error);
    res.status(500).json({ error: 'Failed to update price item' });
  }
});

// Delete price item (soft delete)
router.delete('/:id', authMiddleware, requirePermission(PERMISSIONS.EDIT_PRICES), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const priceItemId = req.params.id;

    const result = await pool.query(
      `UPDATE price_items 
       SET deleted_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [priceItemId, req.user.organizationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Price item not found' });
      return;
    }

    res.json({ message: 'Price item deleted successfully' });
  } catch (error) {
    console.error('Delete price item error:', error);
    res.status(500).json({ error: 'Failed to delete price item' });
  }
});

export default router;

