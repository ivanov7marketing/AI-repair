import express, { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../config/permissions';

const router = express.Router();

const arrivalSchema = z.object({
  materialId: z.string().uuid(),
  quantity: z.number().min(0.01),
  documentUrl: z.string().url().optional().nullable(),
  comment: z.string().optional().nullable(),
});

const transferSchema = z.object({
  materialId: z.string().uuid(),
  quantity: z.number().min(0.01),
  projectId: z.string().uuid(),
  comment: z.string().optional().nullable(),
});

// Log warehouse operation
const logWarehouseOperation = async (
  organizationId: string,
  operationType: string,
  projectId: string | null,
  materialId: string | null,
  quantity: number | null,
  fromLocation: string | null,
  toLocation: string | null,
  performedBy: string,
  documentUrl: string | null,
  comment: string | null
) => {
  await pool.query(
    `INSERT INTO warehouse_operations 
     (organization_id, operation_type, project_id, material_id, quantity, from_location, to_location, performed_by, document_url, comment)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [organizationId, operationType, projectId, materialId, quantity, fromLocation, toLocation, performedBy, documentUrl, comment]
  );
};

// Get warehouse stock
router.get('/stock', authMiddleware, requirePermission(PERMISSIONS.VIEW_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const organizationId = req.user.organizationId;
    const { category, search } = req.query;

    let query = `
      SELECT ws.*, mc.name as material_name, mc.unit as material_unit, mc.category as material_category, mc.min_stock_level
      FROM warehouse_stock ws
      LEFT JOIN materials_catalog mc ON ws.material_id = mc.id
      WHERE ws.organization_id = $1 AND mc.deleted_at IS NULL
    `;
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (category) {
      query += ` AND mc.category = $${paramIndex++}`;
      params.push(category);
    }

    if (search) {
      query += ` AND mc.name ILIKE $${paramIndex++}`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY mc.name ASC`;

    const result = await pool.query(query, params);

    res.json(result.rows.map(row => ({
      id: row.id,
      organizationId: row.organization_id,
      materialId: row.material_id,
      material: {
        id: row.material_id,
        name: row.material_name,
        unit: row.material_unit,
        category: row.material_category,
        minStockLevel: row.min_stock_level ? parseFloat(row.min_stock_level) : null,
      },
      quantity: parseFloat(row.quantity),
      lastUpdated: row.last_updated,
    })));
  } catch (error) {
    console.error('Get warehouse stock error:', error);
    res.status(500).json({ error: 'Failed to fetch warehouse stock' });
  }
});

// Get low stock materials
router.get('/stock/low', authMiddleware, requirePermission(PERMISSIONS.VIEW_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const organizationId = req.user.organizationId;

    const result = await pool.query(
      `SELECT ws.*, mc.name as material_name, mc.unit as material_unit, mc.category as material_category, mc.min_stock_level
       FROM warehouse_stock ws
       LEFT JOIN materials_catalog mc ON ws.material_id = mc.id
       WHERE ws.organization_id = $1 
         AND mc.deleted_at IS NULL
         AND mc.min_stock_level IS NOT NULL
         AND ws.quantity <= mc.min_stock_level
       ORDER BY (ws.quantity / NULLIF(mc.min_stock_level, 0)) ASC, mc.name ASC`,
      [organizationId]
    );

    res.json(result.rows.map(row => ({
      id: row.id,
      organizationId: row.organization_id,
      materialId: row.material_id,
      material: {
        id: row.material_id,
        name: row.material_name,
        unit: row.material_unit,
        category: row.material_category,
        minStockLevel: row.min_stock_level ? parseFloat(row.min_stock_level) : null,
      },
      quantity: parseFloat(row.quantity),
      lastUpdated: row.last_updated,
    })));
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({ error: 'Failed to fetch low stock materials' });
  }
});

// Material arrival to warehouse
router.post('/stock/arrival', authMiddleware, requirePermission(PERMISSIONS.MANAGE_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const organizationId = req.user.organizationId;
    const userId = req.user.id;
    const body = arrivalSchema.parse(req.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get or create warehouse stock
      const stockResult = await client.query(
        `SELECT id, quantity FROM warehouse_stock 
         WHERE organization_id = $1 AND material_id = $2`,
        [organizationId, body.materialId]
      );

      let stockId: string;
      let currentQuantity = 0;

      if (stockResult.rows.length > 0) {
        stockId = stockResult.rows[0].id;
        currentQuantity = parseFloat(stockResult.rows[0].quantity);
      } else {
        const insertResult = await client.query(
          `INSERT INTO warehouse_stock (organization_id, material_id, quantity)
           VALUES ($1, $2, 0)
           RETURNING id`,
          [organizationId, body.materialId]
        );
        stockId = insertResult.rows[0].id;
      }

      // Update quantity
      const newQuantity = currentQuantity + body.quantity;
      await client.query(
        `UPDATE warehouse_stock 
         SET quantity = $1, last_updated = NOW()
         WHERE id = $2`,
        [newQuantity, stockId]
      );

      // Log warehouse operation
      await logWarehouseOperation(
        organizationId,
        'purchase',
        null,
        body.materialId,
        body.quantity,
        'supplier',
        'warehouse',
        userId,
        body.documentUrl || null,
        body.comment || null
      );

      await client.query('COMMIT');

      res.json({ message: 'Material arrived to warehouse successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Warehouse arrival error:', error);
    res.status(500).json({ error: 'Failed to record warehouse arrival' });
  }
});

// Transfer from warehouse to project
router.post('/stock/transfer', authMiddleware, requirePermission(PERMISSIONS.MANAGE_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const organizationId = req.user.organizationId;
    const userId = req.user.id;
    const body = transferSchema.parse(req.body);

    // Check project access
    const canViewAll = req.user.role === 'admin' || req.user.role === 'manager';
    let projectQuery = 'SELECT id FROM projects WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL';
    let projectParams: any[] = [body.projectId, organizationId];
    if (!canViewAll) {
      projectQuery += ' AND id IN (SELECT project_id FROM project_assignments WHERE user_id = $3)';
      projectParams.push(userId);
    }

    const projectResult = await pool.query(projectQuery, projectParams);
    if (projectResult.rows.length === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check warehouse stock
      const stockResult = await client.query(
        `SELECT id, quantity FROM warehouse_stock 
         WHERE organization_id = $1 AND material_id = $2`,
        [organizationId, body.materialId]
      );

      if (stockResult.rows.length === 0) {
        res.status(404).json({ error: 'Material not found in warehouse' });
        return;
      }

      const stockId = stockResult.rows[0].id;
      const currentQuantity = parseFloat(stockResult.rows[0].quantity);

      if (currentQuantity < body.quantity) {
        res.status(400).json({ error: 'Insufficient quantity in warehouse' });
        return;
      }

      // Update warehouse stock
      const newQuantity = currentQuantity - body.quantity;
      await client.query(
        `UPDATE warehouse_stock 
         SET quantity = $1, last_updated = NOW()
         WHERE id = $2`,
        [newQuantity, stockId]
      );

      // Get or create project material
      const pmResult = await client.query(
        `SELECT id, quantity_on_site FROM project_materials 
         WHERE project_id = $1 AND material_id = $2 AND organization_id = $3`,
        [body.projectId, body.materialId, organizationId]
      );

      let projectMaterialId: string;
      let currentOnSite = 0;

      if (pmResult.rows.length > 0) {
        projectMaterialId = pmResult.rows[0].id;
        currentOnSite = parseFloat(pmResult.rows[0].quantity_on_site);
      } else {
        const insertResult = await client.query(
          `INSERT INTO project_materials (organization_id, project_id, material_id, quantity_on_site)
           VALUES ($1, $2, $3, 0)
           RETURNING id`,
          [organizationId, body.projectId, body.materialId]
        );
        projectMaterialId = insertResult.rows[0].id;
      }

      // Update project material
      const newOnSite = currentOnSite + body.quantity;
      await client.query(
        `UPDATE project_materials 
         SET quantity_on_site = $1, last_movement_date = NOW()
         WHERE id = $2`,
        [newOnSite, projectMaterialId]
      );

      // Log material movement
      await client.query(
        `INSERT INTO material_movements 
         (organization_id, project_id, material_id, movement_type, quantity, from_location, to_location, performed_by, comment)
         VALUES ($1, $2, $3, 'transfer', $4, $5, $6, $7, $8)`,
        [
          organizationId,
          body.projectId,
          body.materialId,
          body.quantity,
          'warehouse',
          `project_${body.projectId}`,
          userId,
          body.comment || null,
        ]
      );

      // Log warehouse operation
      await logWarehouseOperation(
        organizationId,
        'transfer',
        body.projectId,
        body.materialId,
        body.quantity,
        'warehouse',
        `project_${body.projectId}`,
        userId,
        null,
        body.comment || null
      );

      await client.query('COMMIT');

      res.json({ message: 'Material transferred successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Transfer error:', error);
    res.status(500).json({ error: 'Failed to transfer material' });
  }
});

export default router;
