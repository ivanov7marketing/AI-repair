import express, { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../config/permissions';

const router = express.Router();

const createToolSchema = z.object({
  inventoryNumber: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  category: z.enum(['электроинструмент', 'ручной', 'измерительный']).optional().nullable(),
  photo: z.union([z.string().url(), z.literal('')]).optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchasePrice: z.number().min(0).optional().nullable(),
});

const updateToolSchema = z.object({
  name: z.string().min(1).optional(),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  category: z.enum(['электроинструмент', 'ручной', 'измерительный']).optional().nullable(),
  photo: z.union([z.string().url(), z.literal('')]).optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchasePrice: z.number().min(0).optional().nullable(),
  condition: z.enum(['working', 'repair', 'disposed']).optional(),
});

const issueToolSchema = z.object({
  employeeId: z.string().uuid(),
  projectId: z.string().uuid().optional().nullable(),
  plannedReturnDate: z.string().optional().nullable(),
  photoOnIssue: z.string().url().optional().nullable(),
  comment: z.string().optional().nullable(),
});

const returnToolSchema = z.object({
  conditionOnReturn: z.enum(['working', 'repair', 'disposed']).optional().nullable(),
  photoOnReturn: z.string().url().optional().nullable(),
  comment: z.string().optional().nullable(),
});

// Log warehouse operation
const logWarehouseOperation = async (
  organizationId: string,
  operationType: string,
  projectId: string | null,
  toolId: string | null,
  performedBy: string,
  comment: string | null
) => {
  await pool.query(
    `INSERT INTO warehouse_operations 
     (organization_id, operation_type, project_id, tool_id, performed_by, comment)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [organizationId, operationType, projectId, toolId, performedBy, comment]
  );
};

// Get all tools
router.get('/', authMiddleware, requirePermission(PERMISSIONS.VIEW_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { category, status, employeeId, projectId } = req.query;
    const organizationId = req.user.organizationId;

    let query = `
      SELECT t.*, 
             p.name as project_name,
             u.name as employee_name,
             u.email as employee_email
      FROM tools t
      LEFT JOIN projects p ON t.current_project_id = p.id
      LEFT JOIN users u ON t.current_employee_id = u.id
      WHERE t.organization_id = $1 AND t.deleted_at IS NULL
    `;
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (category) {
      query += ` AND t.category = $${paramIndex++}`;
      params.push(category);
    }

    if (status) {
      if (status === 'free') {
        query += ` AND t.current_location = 'base'`;
      } else if (status === 'occupied') {
        query += ` AND t.current_location != 'base'`;
      }
    }

    if (employeeId) {
      query += ` AND t.current_employee_id = $${paramIndex++}`;
      params.push(employeeId);
    }

    if (projectId) {
      query += ` AND t.current_project_id = $${paramIndex++}`;
      params.push(projectId);
    }

    query += ` ORDER BY t.name ASC`;

    const result = await pool.query(query, params);

    res.json(result.rows.map(row => ({
      id: row.id,
      organizationId: row.organization_id,
      inventoryNumber: row.inventory_number,
      name: row.name,
      brand: row.brand,
      model: row.model,
      category: row.category,
      photo: row.photo,
      purchaseDate: row.purchase_date,
      purchasePrice: row.purchase_price ? parseFloat(row.purchase_price) : null,
      condition: row.condition,
      currentLocation: row.current_location,
      currentProjectId: row.current_project_id,
      currentProjectName: row.project_name,
      currentEmployeeId: row.current_employee_id,
      currentEmployeeName: row.employee_name,
      currentEmployeeEmail: row.employee_email,
      assignedSince: row.assigned_since,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })));
  } catch (error) {
    console.error('Get tools error:', error);
    res.status(500).json({ error: 'Failed to fetch tools' });
  }
});

// Get single tool
router.get('/:id', authMiddleware, requirePermission(PERMISSIONS.VIEW_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const toolId = req.params.id;
    const organizationId = req.user.organizationId;

    const result = await pool.query(
      `SELECT t.*, 
              p.name as project_name,
              u.name as employee_name,
              u.email as employee_email
       FROM tools t
       LEFT JOIN projects p ON t.current_project_id = p.id
       LEFT JOIN users u ON t.current_employee_id = u.id
       WHERE t.id = $1 AND t.organization_id = $2 AND t.deleted_at IS NULL`,
      [toolId, organizationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Tool not found' });
      return;
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      organizationId: row.organization_id,
      inventoryNumber: row.inventory_number,
      name: row.name,
      brand: row.brand,
      model: row.model,
      category: row.category,
      photo: row.photo,
      purchaseDate: row.purchase_date,
      purchasePrice: row.purchase_price ? parseFloat(row.purchase_price) : null,
      condition: row.condition,
      currentLocation: row.current_location,
      currentProjectId: row.current_project_id,
      currentProjectName: row.project_name,
      currentEmployeeId: row.current_employee_id,
      currentEmployeeName: row.employee_name,
      currentEmployeeEmail: row.employee_email,
      assignedSince: row.assigned_since,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('Get tool error:', error);
    res.status(500).json({ error: 'Failed to fetch tool' });
  }
});

// Create tool
router.post('/', authMiddleware, requirePermission(PERMISSIONS.MANAGE_TOOLS), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = createToolSchema.parse(req.body);
    const organizationId = req.user.organizationId;

    // Check if inventory number is unique
    const checkResult = await pool.query(
      'SELECT id FROM tools WHERE organization_id = $1 AND inventory_number = $2 AND deleted_at IS NULL',
      [organizationId, body.inventoryNumber]
    );

    if (checkResult.rows.length > 0) {
      res.status(400).json({ error: 'Inventory number already exists' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO tools (organization_id, inventory_number, name, brand, model, category, photo, purchase_date, purchase_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, created_at`,
      [
        organizationId,
        body.inventoryNumber,
        body.name,
        body.brand || null,
        body.model || null,
        body.category || null,
        (body.photo && body.photo.trim()) || null,
        body.purchaseDate || null,
        body.purchasePrice || null,
      ]
    );

    res.status(201).json({
      id: result.rows[0].id,
      createdAt: result.rows[0].created_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Create tool error:', error);
    res.status(500).json({ error: 'Failed to create tool' });
  }
});

// Update tool
router.patch('/:id', authMiddleware, requirePermission(PERMISSIONS.MANAGE_TOOLS), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const toolId = req.params.id;
    const organizationId = req.user.organizationId;
    const body = updateToolSchema.parse(req.body);

    // Check if tool exists
    const checkResult = await pool.query(
      'SELECT id FROM tools WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [toolId, organizationId]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Tool not found' });
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
    if (body.brand !== undefined) {
      updates.push(`brand = $${paramIndex++}`);
      values.push(body.brand);
    }
    if (body.model !== undefined) {
      updates.push(`model = $${paramIndex++}`);
      values.push(body.model);
    }
    if (body.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(body.category);
    }
    if (body.photo !== undefined) {
      updates.push(`photo = $${paramIndex++}`);
      values.push(body.photo);
    }
    if (body.purchaseDate !== undefined) {
      updates.push(`purchase_date = $${paramIndex++}`);
      values.push(body.purchaseDate);
    }
    if (body.purchasePrice !== undefined) {
      updates.push(`purchase_price = $${paramIndex++}`);
      values.push(body.purchasePrice);
    }
    if (body.condition !== undefined) {
      updates.push(`condition = $${paramIndex++}`);
      values.push(body.condition);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(toolId, organizationId);

    await pool.query(
      `UPDATE tools 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex++} AND deleted_at IS NULL`,
      values
    );

    res.json({ message: 'Tool updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Update tool error:', error);
    res.status(500).json({ error: 'Failed to update tool' });
  }
});

// Issue tool
router.post('/:id/issue', authMiddleware, requirePermission(PERMISSIONS.MANAGE_TOOLS), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const toolId = req.params.id;
    const organizationId = req.user.organizationId;
    const userId = req.user.id;
    const body = issueToolSchema.parse(req.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get tool
      const toolResult = await client.query(
        'SELECT id, current_location FROM tools WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
        [toolId, organizationId]
      );

      if (toolResult.rows.length === 0) {
        res.status(404).json({ error: 'Tool not found' });
        return;
      }

      if (toolResult.rows[0].current_location !== 'base') {
        res.status(400).json({ error: 'Tool is not available' });
        return;
      }

      // Update tool
      const location = body.projectId ? 'project' : 'employee';
      await client.query(
        `UPDATE tools 
         SET current_location = $1, current_project_id = $2, current_employee_id = $3, assigned_since = NOW()
         WHERE id = $4`,
        [location, body.projectId || null, body.employeeId, toolId]
      );

      // Create movement record
      await client.query(
        `INSERT INTO tool_movements 
         (tool_id, movement_type, employee_id, project_id, issued_by, issued_at, planned_return_date, photo_on_issue, comment)
         VALUES ($1, 'issue', $2, $3, $4, NOW(), $5, $6, $7)`,
        [
          toolId,
          body.employeeId,
          body.projectId || null,
          userId,
          body.plannedReturnDate || null,
          body.photoOnIssue || null,
          body.comment || null,
        ]
      );

      // Log warehouse operation
      await logWarehouseOperation(
        organizationId,
        'tool_issue',
        body.projectId || null,
        toolId,
        userId,
        body.comment || null
      );

      await client.query('COMMIT');

      res.json({ message: 'Tool issued successfully' });
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
    console.error('Issue tool error:', error);
    res.status(500).json({ error: 'Failed to issue tool' });
  }
});

// Return tool
router.post('/:id/return', authMiddleware, requirePermission(PERMISSIONS.MANAGE_TOOLS), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const toolId = req.params.id;
    const organizationId = req.user.organizationId;
    const userId = req.user.id;
    const body = returnToolSchema.parse(req.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get tool
      const toolResult = await client.query(
        'SELECT id, current_location, current_employee_id FROM tools WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
        [toolId, organizationId]
      );

      if (toolResult.rows.length === 0) {
        res.status(404).json({ error: 'Tool not found' });
        return;
      }

      if (toolResult.rows[0].current_location === 'base') {
        res.status(400).json({ error: 'Tool is already at base' });
        return;
      }

      const employeeId = toolResult.rows[0].current_employee_id;

      // Update tool
      await client.query(
        `UPDATE tools 
         SET current_location = 'base', current_project_id = NULL, current_employee_id = NULL, assigned_since = NULL
         WHERE id = $1`,
        [toolId]
      );

      // Update condition if provided
      if (body.conditionOnReturn) {
        await client.query(
          'UPDATE tools SET condition = $1 WHERE id = $2',
          [body.conditionOnReturn, toolId]
        );
      }

      // Find latest issue movement
      const movementResult = await client.query(
        `SELECT id FROM tool_movements 
         WHERE tool_id = $1 AND movement_type = 'issue' AND returned_at IS NULL
         ORDER BY issued_at DESC LIMIT 1`,
        [toolId]
      );

      if (movementResult.rows.length > 0) {
        // Update existing movement
        await client.query(
          `UPDATE tool_movements 
           SET returned_at = NOW(), returned_by = $1, condition_on_return = $2, photo_on_return = $3, comment = $4
           WHERE id = $5`,
          [
            userId,
            body.conditionOnReturn || null,
            body.photoOnReturn || null,
            body.comment || null,
            movementResult.rows[0].id,
          ]
        );
      } else {
        // Create new return movement
        await client.query(
          `INSERT INTO tool_movements 
           (tool_id, movement_type, employee_id, returned_by, returned_at, condition_on_return, photo_on_return, comment)
           VALUES ($1, 'return', $2, $3, NOW(), $4, $5, $6)`,
          [
            toolId,
            employeeId,
            userId,
            body.conditionOnReturn || null,
            body.photoOnReturn || null,
            body.comment || null,
          ]
        );
      }

      // Log warehouse operation
      await logWarehouseOperation(
        organizationId,
        'tool_return',
        null,
        toolId,
        userId,
        body.comment || null
      );

      await client.query('COMMIT');

      res.json({ message: 'Tool returned successfully' });
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
    console.error('Return tool error:', error);
    res.status(500).json({ error: 'Failed to return tool' });
  }
});

// Delete tool
router.delete('/:id', authMiddleware, requirePermission(PERMISSIONS.MANAGE_TOOLS), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const toolId = req.params.id;
    const organizationId = req.user.organizationId;

    // Check if tool exists
    const checkResult = await pool.query(
      'SELECT id, current_location FROM tools WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [toolId, organizationId]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Tool not found' });
      return;
    }

    // Check if tool is currently in use
    if (checkResult.rows[0].current_location !== 'base') {
      res.status(400).json({ error: 'Cannot delete tool that is currently in use' });
      return;
    }

    // Soft delete
    await pool.query(
      'UPDATE tools SET deleted_at = NOW() WHERE id = $1',
      [toolId]
    );

    res.json({ message: 'Tool deleted successfully' });
  } catch (error) {
    console.error('Delete tool error:', error);
    res.status(500).json({ error: 'Failed to delete tool' });
  }
});

// Get tool movements
router.get('/:id/movements', authMiddleware, requirePermission(PERMISSIONS.VIEW_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const toolId = req.params.id;
    const organizationId = req.user.organizationId;

    // Check tool access
    const toolResult = await pool.query(
      'SELECT id FROM tools WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [toolId, organizationId]
    );

    if (toolResult.rows.length === 0) {
      res.status(404).json({ error: 'Tool not found' });
      return;
    }

    const movementsResult = await pool.query(
      `SELECT tm.*, 
              e.name as employee_name, e.email as employee_email,
              p.name as project_name,
              ib.name as issued_by_name, ib.email as issued_by_email,
              rb.name as returned_by_name, rb.email as returned_by_email
       FROM tool_movements tm
       LEFT JOIN users e ON tm.employee_id = e.id
       LEFT JOIN projects p ON tm.project_id = p.id
       LEFT JOIN users ib ON tm.issued_by = ib.id
       LEFT JOIN users rb ON tm.returned_by = rb.id
       WHERE tm.tool_id = $1
       ORDER BY tm.created_at DESC`,
      [toolId]
    );

    res.json(movementsResult.rows.map(row => ({
      id: row.id,
      toolId: row.tool_id,
      movementType: row.movement_type,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      employeeEmail: row.employee_email,
      projectId: row.project_id,
      projectName: row.project_name,
      issuedBy: row.issued_by,
      issuedByName: row.issued_by_name,
      issuedByEmail: row.issued_by_email,
      returnedBy: row.returned_by,
      returnedByName: row.returned_by_name,
      returnedByEmail: row.returned_by_email,
      issuedAt: row.issued_at,
      returnedAt: row.returned_at,
      plannedReturnDate: row.planned_return_date,
      conditionOnReturn: row.condition_on_return,
      photoOnIssue: row.photo_on_issue,
      photoOnReturn: row.photo_on_return,
      comment: row.comment,
      createdAt: row.created_at,
    })));
  } catch (error) {
    console.error('Get tool movements error:', error);
    res.status(500).json({ error: 'Failed to fetch tool movements' });
  }
});

export default router;
