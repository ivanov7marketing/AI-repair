import express, { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../config/permissions';

const router = express.Router();

const createMaterialSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  unit: z.string().min(1),
  photo: z.string().url().optional().nullable(),
  averagePrice: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  minStockLevel: z.number().min(0).optional().nullable(),
});

const updateMaterialSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional().nullable(),
  unit: z.string().min(1).optional(),
  photo: z.string().url().optional().nullable(),
  averagePrice: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  minStockLevel: z.number().min(0).optional().nullable(),
});

// Get all materials (with filters)
router.get('/', authMiddleware, requirePermission(PERMISSIONS.VIEW_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { category, search } = req.query;
    const organizationId = req.user.organizationId;

    let query = `
      SELECT id, organization_id, name, category, unit, photo, average_price, notes, min_stock_level, created_at, updated_at, deleted_at
      FROM materials_catalog
      WHERE organization_id = $1 AND deleted_at IS NULL
    `;
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(category);
    }

    if (search) {
      query += ` AND (name ILIKE $${paramIndex++} OR category ILIKE $${paramIndex})`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
      paramIndex++;
    }

    query += ` ORDER BY name ASC`;

    const result = await pool.query(query, params);

    res.json(result.rows.map(row => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      category: row.category,
      unit: row.unit,
      photo: row.photo,
      averagePrice: row.average_price ? parseFloat(row.average_price) : null,
      notes: row.notes,
      minStockLevel: row.min_stock_level ? parseFloat(row.min_stock_level) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    })));
  } catch (error) {
    console.error('Get materials error:', error);
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

// Get single material
router.get('/:id', authMiddleware, requirePermission(PERMISSIONS.VIEW_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const materialId = req.params.id;
    const organizationId = req.user.organizationId;

    const result = await pool.query(
      `SELECT id, organization_id, name, category, unit, photo, average_price, notes, min_stock_level, created_at, updated_at, deleted_at
       FROM materials_catalog
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [materialId, organizationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Material not found' });
      return;
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      category: row.category,
      unit: row.unit,
      photo: row.photo,
      averagePrice: row.average_price ? parseFloat(row.average_price) : null,
      notes: row.notes,
      minStockLevel: row.min_stock_level ? parseFloat(row.min_stock_level) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    });
  } catch (error) {
    console.error('Get material error:', error);
    res.status(500).json({ error: 'Failed to fetch material' });
  }
});

// Create material
router.post('/', authMiddleware, requirePermission(PERMISSIONS.MANAGE_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = createMaterialSchema.parse(req.body);
    const organizationId = req.user.organizationId;

    const result = await pool.query(
      `INSERT INTO materials_catalog (organization_id, name, category, unit, photo, average_price, notes, min_stock_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, organization_id, name, category, unit, photo, average_price, notes, min_stock_level, created_at, updated_at`,
      [
        organizationId,
        body.name,
        body.category || null,
        body.unit,
        body.photo || null,
        body.averagePrice || null,
        body.notes || null,
        body.minStockLevel || null,
      ]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      category: row.category,
      unit: row.unit,
      photo: row.photo,
      averagePrice: row.average_price ? parseFloat(row.average_price) : null,
      notes: row.notes,
      minStockLevel: row.min_stock_level ? parseFloat(row.min_stock_level) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Create material error:', error);
    res.status(500).json({ error: 'Failed to create material' });
  }
});

// Update material
router.patch('/:id', authMiddleware, requirePermission(PERMISSIONS.MANAGE_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const materialId = req.params.id;
    const organizationId = req.user.organizationId;
    const body = updateMaterialSchema.parse(req.body);

    // Check if material exists and belongs to organization
    const checkResult = await pool.query(
      'SELECT id FROM materials_catalog WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [materialId, organizationId]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Material not found' });
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
    if (body.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(body.category);
    }
    if (body.unit !== undefined) {
      updates.push(`unit = $${paramIndex++}`);
      values.push(body.unit);
    }
    if (body.photo !== undefined) {
      updates.push(`photo = $${paramIndex++}`);
      values.push(body.photo);
    }
    if (body.averagePrice !== undefined) {
      updates.push(`average_price = $${paramIndex++}`);
      values.push(body.averagePrice);
    }
    if (body.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(body.notes);
    }
    if (body.minStockLevel !== undefined) {
      updates.push(`min_stock_level = $${paramIndex++}`);
      values.push(body.minStockLevel);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(materialId, organizationId);

    const result = await pool.query(
      `UPDATE materials_catalog 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex++} AND deleted_at IS NULL
       RETURNING id, organization_id, name, category, unit, photo, average_price, notes, min_stock_level, created_at, updated_at`,
      values
    );

    const row = result.rows[0];
    res.json({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      category: row.category,
      unit: row.unit,
      photo: row.photo,
      averagePrice: row.average_price ? parseFloat(row.average_price) : null,
      notes: row.notes,
      minStockLevel: row.min_stock_level ? parseFloat(row.min_stock_level) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Update material error:', error);
    res.status(500).json({ error: 'Failed to update material' });
  }
});

// Delete material (soft delete)
router.delete('/:id', authMiddleware, requirePermission(PERMISSIONS.MANAGE_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const materialId = req.params.id;
    const organizationId = req.user.organizationId;

    const result = await pool.query(
      `UPDATE materials_catalog 
       SET deleted_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [materialId, organizationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Material not found' });
      return;
    }

    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ error: 'Failed to delete material' });
  }
});

export default router;
