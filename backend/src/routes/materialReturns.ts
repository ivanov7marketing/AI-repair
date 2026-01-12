import express, { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../config/permissions';

const router = express.Router();

const createReturnSchema = z.object({
  projectId: z.string().uuid(),
  materialId: z.string().uuid(),
  quantity: z.number().min(0.01),
  returnAmount: z.number().min(0).optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  reason: z.string().optional().nullable(),
  plannedDate: z.string().optional().nullable(),
  responsiblePerson: z.string().uuid().optional().nullable(),
});

const updateReturnSchema = z.object({
  actualDate: z.string().optional().nullable(),
  documentUrl: z.string().url().optional().nullable(),
  returnAmount: z.number().min(0).optional().nullable(),
  status: z.enum(['planned', 'returned', 'money_received']).optional(),
});

// Get all returns
router.get('/', authMiddleware, requirePermission(PERMISSIONS.VIEW_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { status, projectId } = req.query;
    const organizationId = req.user.organizationId;

    let query = `
      SELECT mr.*, 
             p.name as project_name,
             mc.name as material_name,
             s.name as supplier_name,
             u.name as initiated_by_name,
             rp.name as responsible_person_name
      FROM material_returns mr
      LEFT JOIN projects p ON mr.project_id = p.id
      LEFT JOIN materials_catalog mc ON mr.material_id = mc.id
      LEFT JOIN suppliers s ON mr.supplier_id = s.id
      LEFT JOIN users u ON mr.initiated_by = u.id
      LEFT JOIN users rp ON mr.responsible_person = rp.id
      WHERE mr.organization_id = $1
    `;
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (status) {
      query += ` AND mr.status = $${paramIndex++}`;
      params.push(status);
    }

    if (projectId) {
      query += ` AND mr.project_id = $${paramIndex++}`;
      params.push(projectId);
    }

    query += ` ORDER BY mr.created_at DESC`;

    const result = await pool.query(query, params);

    res.json(result.rows.map(row => ({
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      projectName: row.project_name,
      materialId: row.material_id,
      materialName: row.material_name,
      quantity: parseFloat(row.quantity),
      returnAmount: row.return_amount ? parseFloat(row.return_amount) : null,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      status: row.status,
      reason: row.reason,
      plannedDate: row.planned_date,
      actualDate: row.actual_date,
      documentUrl: row.document_url,
      initiatedBy: row.initiated_by,
      initiatedByName: row.initiated_by_name,
      responsiblePerson: row.responsible_person,
      responsiblePersonName: row.responsible_person_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })));
  } catch (error) {
    console.error('Get returns error:', error);
    res.status(500).json({ error: 'Failed to fetch returns' });
  }
});

// Get single return
router.get('/:id', authMiddleware, requirePermission(PERMISSIONS.VIEW_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const returnId = req.params.id;
    const organizationId = req.user.organizationId;

    const result = await pool.query(
      `SELECT mr.*, 
              p.name as project_name,
              mc.name as material_name,
              s.name as supplier_name,
              u.name as initiated_by_name,
              rp.name as responsible_person_name
       FROM material_returns mr
       LEFT JOIN projects p ON mr.project_id = p.id
       LEFT JOIN materials_catalog mc ON mr.material_id = mc.id
       LEFT JOIN suppliers s ON mr.supplier_id = s.id
       LEFT JOIN users u ON mr.initiated_by = u.id
       LEFT JOIN users rp ON mr.responsible_person = rp.id
       WHERE mr.id = $1 AND mr.organization_id = $2`,
      [returnId, organizationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Return not found' });
      return;
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      projectName: row.project_name,
      materialId: row.material_id,
      materialName: row.material_name,
      quantity: parseFloat(row.quantity),
      returnAmount: row.return_amount ? parseFloat(row.return_amount) : null,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      status: row.status,
      reason: row.reason,
      plannedDate: row.planned_date,
      actualDate: row.actual_date,
      documentUrl: row.document_url,
      initiatedBy: row.initiated_by,
      initiatedByName: row.initiated_by_name,
      responsiblePerson: row.responsible_person,
      responsiblePersonName: row.responsible_person_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('Get return error:', error);
    res.status(500).json({ error: 'Failed to fetch return' });
  }
});

// Create return
router.post('/', authMiddleware, requirePermission(PERMISSIONS.MANAGE_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = createReturnSchema.parse(req.body);
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

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

    // Check material availability on project
    const materialResult = await pool.query(
      `SELECT quantity_on_site FROM project_materials 
       WHERE project_id = $1 AND material_id = $2 AND organization_id = $3`,
      [body.projectId, body.materialId, organizationId]
    );

    if (materialResult.rows.length === 0) {
      res.status(404).json({ error: 'Material not found on project' });
      return;
    }

    const availableQuantity = parseFloat(materialResult.rows[0].quantity_on_site);
    if (availableQuantity < body.quantity) {
      res.status(400).json({ error: 'Insufficient quantity on project' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create return
      const result = await client.query(
        `INSERT INTO material_returns 
         (organization_id, project_id, material_id, quantity, return_amount, supplier_id, reason, planned_date, initiated_by, responsible_person)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, created_at`,
        [
          organizationId,
          body.projectId,
          body.materialId,
          body.quantity,
          body.returnAmount || null,
          body.supplierId || null,
          body.reason || null,
          body.plannedDate || null,
          userId,
          body.responsiblePerson || null,
        ]
      );

      const returnId = result.rows[0].id;

      // Update project material quantity
      await client.query(
        `UPDATE project_materials 
         SET quantity_on_site = quantity_on_site - $1
         WHERE project_id = $2 AND material_id = $3 AND organization_id = $4`,
        [body.quantity, body.projectId, body.materialId, organizationId]
      );

      // Log material movement
      await client.query(
        `INSERT INTO material_movements 
         (organization_id, project_id, material_id, movement_type, quantity, from_location, to_location, performed_by, comment)
         VALUES ($1, $2, $3, 'return', $4, $5, $6, $7, $8)`,
        [
          organizationId,
          body.projectId,
          body.materialId,
          body.quantity,
          `project_${body.projectId}`,
          'supplier',
          userId,
          body.reason || null,
        ]
      );

      // Log warehouse operation
      await client.query(
        `INSERT INTO warehouse_operations 
         (organization_id, operation_type, project_id, material_id, quantity, from_location, to_location, performed_by, comment)
         VALUES ($1, 'return', $2, $3, $4, $5, $6, $7, $8)`,
        [
          organizationId,
          body.projectId,
          body.materialId,
          body.quantity,
          `project_${body.projectId}`,
          'supplier',
          userId,
          body.reason || null,
        ]
      );

      await client.query('COMMIT');

      res.status(201).json({
        id: returnId,
        createdAt: result.rows[0].created_at,
      });
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
    console.error('Create return error:', error);
    res.status(500).json({ error: 'Failed to create return' });
  }
});

// Update return
router.patch('/:id', authMiddleware, requirePermission(PERMISSIONS.MANAGE_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const returnId = req.params.id;
    const organizationId = req.user.organizationId;
    const body = updateReturnSchema.parse(req.body);

    // Check if return exists
    const checkResult = await pool.query(
      'SELECT id FROM material_returns WHERE id = $1 AND organization_id = $2',
      [returnId, organizationId]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Return not found' });
      return;
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (body.actualDate !== undefined) {
      updates.push(`actual_date = $${paramIndex++}`);
      values.push(body.actualDate);
    }

    if (body.documentUrl !== undefined) {
      updates.push(`document_url = $${paramIndex++}`);
      values.push(body.documentUrl);
    }

    if (body.returnAmount !== undefined) {
      updates.push(`return_amount = $${paramIndex++}`);
      values.push(body.returnAmount);
    }

    if (body.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(body.status);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(returnId, organizationId);

    await pool.query(
      `UPDATE material_returns 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex++}`,
      values
    );

    res.json({ message: 'Return updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Update return error:', error);
    res.status(500).json({ error: 'Failed to update return' });
  }
});

export default router;
