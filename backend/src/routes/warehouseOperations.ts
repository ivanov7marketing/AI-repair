import express, { Request, Response } from 'express';
import { pool } from '../db';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../config/permissions';

const router = express.Router();

// Get all warehouse operations
router.get('/', authMiddleware, requirePermission(PERMISSIONS.VIEW_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { operationType, dateFrom, dateTo, projectId, employeeId, materialId, toolId } = req.query;
    const organizationId = req.user.organizationId;

    let query = `
      SELECT wo.*, 
             p.name as project_name,
             mc.name as material_name,
             t.name as tool_name, t.inventory_number as tool_inventory_number,
             u.name as performed_by_name, u.email as performed_by_email
      FROM warehouse_operations wo
      LEFT JOIN projects p ON wo.project_id = p.id
      LEFT JOIN materials_catalog mc ON wo.material_id = mc.id
      LEFT JOIN tools t ON wo.tool_id = t.id
      LEFT JOIN users u ON wo.performed_by = u.id
      WHERE wo.organization_id = $1
    `;
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (operationType) {
      query += ` AND wo.operation_type = $${paramIndex++}`;
      params.push(operationType);
    }

    if (dateFrom) {
      query += ` AND wo.created_at >= $${paramIndex++}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ` AND wo.created_at <= $${paramIndex++}`;
      params.push(dateTo);
    }

    if (projectId) {
      query += ` AND wo.project_id = $${paramIndex++}`;
      params.push(projectId);
    }

    if (employeeId) {
      query += ` AND wo.performed_by = $${paramIndex++}`;
      params.push(employeeId);
    }

    if (materialId) {
      query += ` AND wo.material_id = $${paramIndex++}`;
      params.push(materialId);
    }

    if (toolId) {
      query += ` AND wo.tool_id = $${paramIndex++}`;
      params.push(toolId);
    }

    query += ` ORDER BY wo.created_at DESC LIMIT 1000`;

    const result = await pool.query(query, params);

    res.json(result.rows.map(row => ({
      id: row.id,
      organizationId: row.organization_id,
      operationType: row.operation_type,
      projectId: row.project_id,
      projectName: row.project_name,
      materialId: row.material_id,
      materialName: row.material_name,
      toolId: row.tool_id,
      toolName: row.tool_name,
      toolInventoryNumber: row.tool_inventory_number,
      quantity: row.quantity ? parseFloat(row.quantity) : null,
      fromLocation: row.from_location,
      toLocation: row.to_location,
      performedBy: row.performed_by,
      performedByName: row.performed_by_name,
      performedByEmail: row.performed_by_email,
      documentUrl: row.document_url,
      comment: row.comment,
      createdAt: row.created_at,
    })));
  } catch (error) {
    console.error('Get warehouse operations error:', error);
    res.status(500).json({ error: 'Failed to fetch warehouse operations' });
  }
});

export default router;
