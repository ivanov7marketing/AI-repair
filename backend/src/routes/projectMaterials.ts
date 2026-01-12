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
  fromLocation: z.string().optional().nullable(),
});

const writeoffSchema = z.object({
  materialId: z.string().uuid(),
  quantity: z.number().min(0.01),
  workStage: z.string().optional().nullable(),
  comment: z.string().optional().nullable(),
});

const returnSchema = z.object({
  materialId: z.string().uuid(),
  quantity: z.number().min(0.01),
  reason: z.string().optional().nullable(),
});

// Calculate material status
const calculateStatus = (planned: number, onSite: number): 'excess' | 'normal' | 'low' => {
  if (planned === 0) return 'normal';
  const ratio = onSite / planned;
  if (ratio > 1.2) return 'excess';
  if (ratio < 0.5) return 'low';
  return 'normal';
};

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

// Get materials for project
router.get('/:projectId/materials', authMiddleware, requirePermission(PERMISSIONS.VIEW_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const projectId = req.params.projectId;
    const organizationId = req.user.organizationId;

    // Check project access
    const canViewAll = req.user.role === 'admin' || req.user.role === 'manager';
    let projectQuery = 'SELECT id FROM projects WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL';
    let projectParams: any[] = [projectId, organizationId];
    if (!canViewAll) {
      projectQuery += ' AND id IN (SELECT project_id FROM project_assignments WHERE user_id = $3)';
      projectParams.push(req.user.id);
    }

    const projectResult = await pool.query(projectQuery, projectParams);
    if (projectResult.rows.length === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const materialsResult = await pool.query(
      `SELECT pm.*, mc.name as material_name, mc.unit as material_unit, mc.category as material_category
       FROM project_materials pm
       LEFT JOIN materials_catalog mc ON pm.material_id = mc.id
       WHERE pm.project_id = $1 AND pm.organization_id = $2
       ORDER BY mc.name`,
      [projectId, organizationId]
    );

    res.json(materialsResult.rows.map(row => ({
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      materialId: row.material_id,
      material: {
        id: row.material_id,
        name: row.material_name,
        unit: row.material_unit,
        category: row.material_category,
      },
      quantityPlanned: parseFloat(row.quantity_planned),
      quantityPurchased: parseFloat(row.quantity_purchased),
      quantityOnSite: parseFloat(row.quantity_on_site),
      quantityUsed: parseFloat(row.quantity_used),
      status: row.status,
      lastMovementDate: row.last_movement_date,
    })));
  } catch (error) {
    console.error('Get project materials error:', error);
    res.status(500).json({ error: 'Failed to fetch project materials' });
  }
});

// Material arrival on project
router.post('/:projectId/materials/arrival', authMiddleware, requirePermission(PERMISSIONS.MANAGE_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const projectId = req.params.projectId;
    const organizationId = req.user.organizationId;
    const userId = req.user.id;
    const body = arrivalSchema.parse(req.body);

    // Check project access
    const canViewAll = req.user.role === 'admin' || req.user.role === 'manager';
    let projectQuery = 'SELECT id FROM projects WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL';
    let projectParams: any[] = [projectId, organizationId];
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

      // Get or create project material
      const pmResult = await client.query(
        `SELECT id, quantity_on_site FROM project_materials 
         WHERE project_id = $1 AND material_id = $2 AND organization_id = $3`,
        [projectId, body.materialId, organizationId]
      );

      let projectMaterialId: string;
      let currentQuantity = 0;

      if (pmResult.rows.length > 0) {
        projectMaterialId = pmResult.rows[0].id;
        currentQuantity = parseFloat(pmResult.rows[0].quantity_on_site);
      } else {
        const insertResult = await client.query(
          `INSERT INTO project_materials (organization_id, project_id, material_id, quantity_on_site)
           VALUES ($1, $2, $3, 0)
           RETURNING id`,
          [organizationId, projectId, body.materialId]
        );
        projectMaterialId = insertResult.rows[0].id;
      }

      // Update quantity
      const newQuantity = currentQuantity + body.quantity;
      await client.query(
        `UPDATE project_materials 
         SET quantity_on_site = $1, last_movement_date = NOW()
         WHERE id = $2`,
        [newQuantity, projectMaterialId]
      );

      // Recalculate status
      const pmData = await client.query(
        'SELECT quantity_planned, quantity_on_site FROM project_materials WHERE id = $1',
        [projectMaterialId]
      );
      const planned = parseFloat(pmData.rows[0].quantity_planned);
      const onSite = parseFloat(pmData.rows[0].quantity_on_site);
      const status = calculateStatus(planned, onSite);
      await client.query(
        'UPDATE project_materials SET status = $1 WHERE id = $2',
        [status, projectMaterialId]
      );

      // Log material movement
      await client.query(
        `INSERT INTO material_movements 
         (organization_id, project_id, material_id, movement_type, quantity, from_location, to_location, performed_by, document_url, comment)
         VALUES ($1, $2, $3, 'arrival', $4, $5, $6, $7, $8, $9)`,
        [
          organizationId,
          projectId,
          body.materialId,
          body.quantity,
          body.fromLocation || 'warehouse',
          `project_${projectId}`,
          userId,
          body.documentUrl || null,
          body.comment || null,
        ]
      );

      // Log warehouse operation
      await logWarehouseOperation(
        organizationId,
        'arrival',
        projectId,
        body.materialId,
        body.quantity,
        body.fromLocation || 'warehouse',
        `project_${projectId}`,
        userId,
        body.documentUrl || null,
        body.comment || null
      );

      await client.query('COMMIT');

      res.json({ message: 'Material arrived successfully' });
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
    console.error('Material arrival error:', error);
    res.status(500).json({ error: 'Failed to record material arrival' });
  }
});

// Material writeoff
router.post('/:projectId/materials/writeoff', authMiddleware, requirePermission(PERMISSIONS.MANAGE_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const projectId = req.params.projectId;
    const organizationId = req.user.organizationId;
    const userId = req.user.id;
    const body = writeoffSchema.parse(req.body);

    // Check project access
    const canViewAll = req.user.role === 'admin' || req.user.role === 'manager';
    let projectQuery = 'SELECT id FROM projects WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL';
    let projectParams: any[] = [projectId, organizationId];
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

      // Get project material
      const pmResult = await client.query(
        `SELECT id, quantity_on_site, quantity_used FROM project_materials 
         WHERE project_id = $1 AND material_id = $2 AND organization_id = $3`,
        [projectId, body.materialId, organizationId]
      );

      if (pmResult.rows.length === 0) {
        res.status(404).json({ error: 'Material not found on project' });
        return;
      }

      const projectMaterialId = pmResult.rows[0].id;
      const currentOnSite = parseFloat(pmResult.rows[0].quantity_on_site);
      const currentUsed = parseFloat(pmResult.rows[0].quantity_used);

      if (currentOnSite < body.quantity) {
        res.status(400).json({ error: 'Insufficient quantity on site' });
        return;
      }

      // Update quantities
      const newOnSite = currentOnSite - body.quantity;
      const newUsed = currentUsed + body.quantity;

      await client.query(
        `UPDATE project_materials 
         SET quantity_on_site = $1, quantity_used = $2, last_movement_date = NOW()
         WHERE id = $3`,
        [newOnSite, newUsed, projectMaterialId]
      );

      // Recalculate status
      const pmData = await client.query(
        'SELECT quantity_planned, quantity_on_site FROM project_materials WHERE id = $1',
        [projectMaterialId]
      );
      const planned = parseFloat(pmData.rows[0].quantity_planned);
      const onSite = parseFloat(pmData.rows[0].quantity_on_site);
      const status = calculateStatus(planned, onSite);
      await client.query(
        'UPDATE project_materials SET status = $1 WHERE id = $2',
        [status, projectMaterialId]
      );

      // Log material movement
      await client.query(
        `INSERT INTO material_movements 
         (organization_id, project_id, material_id, movement_type, quantity, from_location, to_location, performed_by, comment, work_stage)
         VALUES ($1, $2, $3, 'writeoff', $4, $5, $6, $7, $8, $9)`,
        [
          organizationId,
          projectId,
          body.materialId,
          body.quantity,
          `project_${projectId}`,
          'work',
          userId,
          body.comment || null,
          body.workStage || null,
        ]
      );

      // Log warehouse operation
      await logWarehouseOperation(
        organizationId,
        'writeoff',
        projectId,
        body.materialId,
        body.quantity,
        `project_${projectId}`,
        'work',
        userId,
        null,
        body.comment || null
      );

      await client.query('COMMIT');

      res.json({ message: 'Material written off successfully' });
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
    console.error('Material writeoff error:', error);
    res.status(500).json({ error: 'Failed to write off material' });
  }
});

// Material return
router.post('/:projectId/materials/return', authMiddleware, requirePermission(PERMISSIONS.MANAGE_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const projectId = req.params.projectId;
    const organizationId = req.user.organizationId;
    const userId = req.user.id;
    const body = returnSchema.parse(req.body);

    // Check project access
    const canViewAll = req.user.role === 'admin' || req.user.role === 'manager';
    let projectQuery = 'SELECT id FROM projects WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL';
    let projectParams: any[] = [projectId, organizationId];
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

      // Get project material
      const pmResult = await client.query(
        `SELECT id, quantity_on_site FROM project_materials 
         WHERE project_id = $1 AND material_id = $2 AND organization_id = $3`,
        [projectId, body.materialId, organizationId]
      );

      if (pmResult.rows.length === 0) {
        res.status(404).json({ error: 'Material not found on project' });
        return;
      }

      const projectMaterialId = pmResult.rows[0].id;
      const currentOnSite = parseFloat(pmResult.rows[0].quantity_on_site);

      if (currentOnSite < body.quantity) {
        res.status(400).json({ error: 'Insufficient quantity on site' });
        return;
      }

      // Update quantity
      const newOnSite = currentOnSite - body.quantity;
      await client.query(
        `UPDATE project_materials 
         SET quantity_on_site = $1, last_movement_date = NOW()
         WHERE id = $2`,
        [newOnSite, projectMaterialId]
      );

      // Recalculate status
      const pmData = await client.query(
        'SELECT quantity_planned, quantity_on_site FROM project_materials WHERE id = $1',
        [projectMaterialId]
      );
      const planned = parseFloat(pmData.rows[0].quantity_planned);
      const onSite = parseFloat(pmData.rows[0].quantity_on_site);
      const status = calculateStatus(planned, onSite);
      await client.query(
        'UPDATE project_materials SET status = $1 WHERE id = $2',
        [status, projectMaterialId]
      );

      // Log material movement
      await client.query(
        `INSERT INTO material_movements 
         (organization_id, project_id, material_id, movement_type, quantity, from_location, to_location, performed_by, comment)
         VALUES ($1, $2, $3, 'return', $4, $5, $6, $7, $8)`,
        [
          organizationId,
          projectId,
          body.materialId,
          body.quantity,
          `project_${projectId}`,
          'warehouse',
          userId,
          body.reason || null,
        ]
      );

      // Log warehouse operation
      await logWarehouseOperation(
        organizationId,
        'return',
        projectId,
        body.materialId,
        body.quantity,
        `project_${projectId}`,
        'warehouse',
        userId,
        null,
        body.reason || null
      );

      await client.query('COMMIT');

      res.json({ message: 'Material returned successfully' });
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
    console.error('Material return error:', error);
    res.status(500).json({ error: 'Failed to return material' });
  }
});

export default router;
