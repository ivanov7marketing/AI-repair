import express, { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../config/permissions';

const router = express.Router();

const createPurchaseRequestSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  urgency: z.enum(['normal', 'urgent']).default('normal'),
  estimateProjectId: z.string().uuid().optional().nullable(),
  items: z.array(z.object({
    materialId: z.string().uuid().optional().nullable(),
    materialName: z.string().optional().nullable(), // For custom materials
    quantityRequested: z.number().min(0.01),
    unitPrice: z.number().min(0).optional().nullable(),
    note: z.string().optional().nullable(),
    fromEstimate: z.boolean().default(false),
    estimateItemId: z.string().optional().nullable(),
    estimateRoomId: z.string().optional().nullable(),
    estimateItemPath: z.string().optional().nullable(),
  })).min(1),
});

const updatePurchaseRequestSchema = z.object({
  urgency: z.enum(['normal', 'urgent']).optional(),
  items: z.array(z.object({
    id: z.string().uuid().optional(),
    materialId: z.string().uuid().optional().nullable(),
    materialName: z.string().optional().nullable(), // For custom materials
    quantityRequested: z.number().min(0.01),
    quantityApproved: z.number().min(0).optional().nullable(),
    unitPrice: z.number().min(0).optional().nullable(),
    note: z.string().optional().nullable(),
    fromEstimate: z.boolean().optional(),
    estimateItemId: z.string().optional().nullable(),
    estimateRoomId: z.string().optional().nullable(),
    estimateItemPath: z.string().optional().nullable(),
  })).optional(),
});

// Generate request number
const generateRequestNumber = async (organizationId: string): Promise<string> => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `PR-${dateStr}-`;

  // Get count of requests for today
  const countResult = await pool.query(
    `SELECT COUNT(*) as count FROM purchase_requests 
     WHERE organization_id = $1 AND request_number LIKE $2`,
    [organizationId, `${prefix}%`]
  );

  const count = parseInt(countResult.rows[0].count) + 1;
  return `${prefix}${count.toString().padStart(3, '0')}`;
};

// Log action
const logAction = async (
  requestId: string,
  action: string,
  performedBy: string,
  oldStatus?: string,
  newStatus?: string,
  comment?: string
) => {
  await pool.query(
    `INSERT INTO purchase_request_log (request_id, action, performed_by, old_status, new_status, comment)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [requestId, action, performedBy, oldStatus || null, newStatus || null, comment || null]
  );
};

// Get all purchase requests
router.get('/', authMiddleware, requirePermission(PERMISSIONS.VIEW_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { status, projectId, dateFrom, dateTo, createdBy } = req.query;
    const organizationId = req.user.organizationId;
    const canViewAll = req.user.role === 'admin' || req.user.role === 'manager';

    let query = `
      SELECT pr.*, 
             p.name as project_name,
             u.name as created_by_name,
             u.email as created_by_email
      FROM purchase_requests pr
      LEFT JOIN projects p ON pr.project_id = p.id
      LEFT JOIN users u ON pr.created_by = u.id
      WHERE pr.organization_id = $1
    `;
    const params: any[] = [organizationId];
    let paramIndex = 2;

    // Filter by role - foreman/master see only their requests
    if (!canViewAll) {
      query += ` AND pr.created_by = $${paramIndex++}`;
      params.push(req.user.id);
    }

    if (status) {
      query += ` AND pr.status = $${paramIndex++}`;
      params.push(status);
    }

    if (projectId) {
      query += ` AND pr.project_id = $${paramIndex++}`;
      params.push(projectId);
    }

    if (dateFrom) {
      query += ` AND pr.created_at >= $${paramIndex++}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ` AND pr.created_at <= $${paramIndex++}`;
      params.push(dateTo);
    }

    if (createdBy) {
      query += ` AND pr.created_by = $${paramIndex++}`;
      params.push(createdBy);
    }

    query += ` ORDER BY pr.created_at DESC`;

    const result = await pool.query(query, params);

    res.json(result.rows.map(row => ({
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      projectName: row.project_name,
      requestNumber: row.request_number,
      status: row.status,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdByEmail: row.created_by_email,
      createdAt: row.created_at,
      urgency: row.urgency,
      totalAmount: row.total_amount ? parseFloat(row.total_amount) : 0,
      estimateProjectId: row.estimate_project_id,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      rejectedReason: row.rejected_reason,
      needsReorder: row.needs_reorder,
    })));
  } catch (error) {
    console.error('Get purchase requests error:', error);
    res.status(500).json({ error: 'Failed to fetch purchase requests' });
  }
});

// Get single purchase request
router.get('/:id', authMiddleware, requirePermission(PERMISSIONS.VIEW_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const requestId = req.params.id;
    const organizationId = req.user.organizationId;
    const canViewAll = req.user.role === 'admin' || req.user.role === 'manager';

    // Get request
    let query = `
      SELECT pr.*, 
             p.name as project_name,
             u.name as created_by_name,
             u.email as created_by_email
      FROM purchase_requests pr
      LEFT JOIN projects p ON pr.project_id = p.id
      LEFT JOIN users u ON pr.created_by = u.id
      WHERE pr.id = $1 AND pr.organization_id = $2
    `;
    const params: any[] = [requestId, organizationId];

    if (!canViewAll) {
      query += ` AND pr.created_by = $3`;
      params.push(req.user.id);
    }

    const requestResult = await pool.query(query, params);

    if (requestResult.rows.length === 0) {
      res.status(404).json({ error: 'Purchase request not found' });
      return;
    }

    const requestRow = requestResult.rows[0];

    // Get items
    const itemsResult = await pool.query(
      `SELECT pri.*, 
              COALESCE(pri.material_name, mc.name) as material_name, 
              mc.unit as material_unit
       FROM purchase_request_items pri
       LEFT JOIN materials_catalog mc ON pri.material_id = mc.id
       WHERE pri.request_id = $1
       ORDER BY pri.id`,
      [requestId]
    );

    // Get purchase info
    const purchaseInfoResult = await pool.query(
      `SELECT pi.*, s.name as supplier_name
       FROM purchase_info pi
       LEFT JOIN suppliers s ON pi.supplier_id = s.id
       WHERE pi.request_id = $1`,
      [requestId]
    );

    res.json({
      id: requestRow.id,
      organizationId: requestRow.organization_id,
      projectId: requestRow.project_id,
      projectName: requestRow.project_name,
      requestNumber: requestRow.request_number,
      status: requestRow.status,
      createdBy: requestRow.created_by,
      createdByName: requestRow.created_by_name,
      createdByEmail: requestRow.created_by_email,
      createdAt: requestRow.created_at,
      urgency: requestRow.urgency,
      totalAmount: requestRow.total_amount ? parseFloat(requestRow.total_amount) : 0,
      estimateProjectId: requestRow.estimate_project_id,
      approvedBy: requestRow.approved_by,
      approvedAt: requestRow.approved_at,
      rejectedReason: requestRow.rejected_reason,
      needsReorder: requestRow.needs_reorder,
      items: itemsResult.rows.map(item => ({
        id: item.id,
        requestId: item.request_id,
        materialId: item.material_id,
        materialName: item.material_name,
        materialUnit: item.material_unit,
        quantityRequested: parseFloat(item.quantity_requested),
        quantityApproved: item.quantity_approved ? parseFloat(item.quantity_approved) : null,
        quantityPurchased: parseFloat(item.quantity_purchased),
        unitPrice: item.unit_price ? parseFloat(item.unit_price) : null,
        note: item.note,
        fromEstimate: item.from_estimate,
        estimateItemId: item.estimate_item_id,
        estimateProjectId: item.estimate_project_id,
        estimateRoomId: item.estimate_room_id,
        estimateItemPath: item.estimate_item_path,
      })),
      purchaseInfo: purchaseInfoResult.rows.length > 0 ? {
        id: purchaseInfoResult.rows[0].id,
        requestId: purchaseInfoResult.rows[0].request_id,
        supplierId: purchaseInfoResult.rows[0].supplier_id,
        supplierName: purchaseInfoResult.rows[0].supplier_name,
        responsiblePerson: purchaseInfoResult.rows[0].responsible_person,
        plannedDate: purchaseInfoResult.rows[0].planned_date,
        actualDate: purchaseInfoResult.rows[0].actual_date,
        documentUrl: purchaseInfoResult.rows[0].document_url,
        createdAt: purchaseInfoResult.rows[0].created_at,
        updatedAt: purchaseInfoResult.rows[0].updated_at,
      } : null,
    });
  } catch (error) {
    console.error('Get purchase request error:', error);
    res.status(500).json({ error: 'Failed to fetch purchase request' });
  }
});

// Create purchase request
router.post('/', authMiddleware, requirePermission(PERMISSIONS.CREATE_PURCHASE_REQUESTS), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = createPurchaseRequestSchema.parse(req.body);
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Generate request number
      const requestNumber = await generateRequestNumber(organizationId);

      // Calculate total amount
      const totalAmount = body.items.reduce((sum, item) => {
        return sum + (item.quantityRequested * (item.unitPrice || 0));
      }, 0);

      // Create request
      const requestResult = await client.query(
        `INSERT INTO purchase_requests (organization_id, project_id, request_number, status, created_by, urgency, total_amount, estimate_project_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, created_at`,
        [
          organizationId,
          body.projectId || null,
          requestNumber,
          'new',
          userId,
          body.urgency,
          totalAmount,
          body.estimateProjectId || null,
        ]
      );

      const requestId = requestResult.rows[0].id;

      // Create items
      for (const item of body.items) {
        await client.query(
          `INSERT INTO purchase_request_items 
           (request_id, material_id, material_name, quantity_requested, unit_price, note, from_estimate, estimate_item_id, estimate_project_id, estimate_room_id, estimate_item_path)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            requestId,
            item.materialId || null,
            item.materialName || null,
            item.quantityRequested,
            item.unitPrice || null,
            item.note || null,
            item.fromEstimate,
            item.estimateItemId || null,
            body.estimateProjectId || null,
            item.estimateRoomId || null,
            item.estimateItemPath || null,
          ]
        );
      }

      // Log creation
      await logAction(requestId, 'created', userId, undefined, 'new', 'Заявка создана');

      await client.query('COMMIT');

      res.status(201).json({
        id: requestId,
        requestNumber,
        createdAt: requestResult.rows[0].created_at,
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
    console.error('Create purchase request error:', error);
    res.status(500).json({ error: 'Failed to create purchase request' });
  }
});

// Update purchase request
router.patch('/:id', authMiddleware, requirePermission(PERMISSIONS.CREATE_PURCHASE_REQUESTS), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const requestId = req.params.id;
    const organizationId = req.user.organizationId;
    const userId = req.user.id;
    const body = updatePurchaseRequestSchema.parse(req.body);

    // Check access
    const canViewAll = req.user.role === 'admin' || req.user.role === 'manager';
    let checkQuery = 'SELECT id, status FROM purchase_requests WHERE id = $1 AND organization_id = $2';
    let checkParams: any[] = [requestId, organizationId];
    if (!canViewAll) {
      checkQuery += ' AND created_by = $3';
      checkParams.push(userId);
    }

    const checkResult = await pool.query(checkQuery, checkParams);
    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Purchase request not found' });
      return;
    }

    const oldStatus = checkResult.rows[0].status;
    if (oldStatus !== 'new' && oldStatus !== 'in_progress') {
      res.status(400).json({ error: 'Cannot edit request in this status' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update request
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (body.urgency) {
        updates.push(`urgency = $${paramIndex++}`);
        values.push(body.urgency);
      }

      if (updates.length > 0) {
        values.push(requestId, organizationId);
        await client.query(
          `UPDATE purchase_requests SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND organization_id = $${paramIndex++}`,
          values
        );
      }

      // Update items if provided
      if (body.items) {
        // Delete existing items
        await client.query('DELETE FROM purchase_request_items WHERE request_id = $1', [requestId]);

        // Calculate new total
        const totalAmount = body.items.reduce((sum, item) => {
          return sum + (item.quantityRequested * (item.unitPrice || 0));
        }, 0);

        // Update total amount
        await client.query(
          'UPDATE purchase_requests SET total_amount = $1 WHERE id = $2',
          [totalAmount, requestId]
        );

        // Insert new items
        for (const item of body.items) {
          await client.query(
            `INSERT INTO purchase_request_items 
             (request_id, material_id, material_name, quantity_requested, quantity_approved, unit_price, note, from_estimate, estimate_item_id, estimate_room_id, estimate_item_path)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              requestId,
              item.materialId || null,
              item.materialName || null,
              item.quantityRequested,
              item.quantityApproved || null,
              item.unitPrice || null,
              item.note || null,
              item.fromEstimate || false,
              item.estimateItemId || null,
              item.estimateRoomId || null,
              item.estimateItemPath || null,
            ]
          );
        }
      }

      // Log update
      await logAction(requestId, 'updated', userId, oldStatus, oldStatus, 'Заявка обновлена');

      await client.query('COMMIT');

      res.json({ message: 'Purchase request updated successfully' });
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
    console.error('Update purchase request error:', error);
    res.status(500).json({ error: 'Failed to update purchase request' });
  }
});

// Approve purchase request
router.post('/:id/approve', authMiddleware, requirePermission(PERMISSIONS.APPROVE_PURCHASE_REQUESTS), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const requestId = req.params.id;
    const organizationId = req.user.organizationId;
    const userId = req.user.id;
    const { items } = req.body; // Optional: items with approved quantities

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get request
      const requestResult = await client.query(
        'SELECT id, status FROM purchase_requests WHERE id = $1 AND organization_id = $2',
        [requestId, organizationId]
      );

      if (requestResult.rows.length === 0) {
        res.status(404).json({ error: 'Purchase request not found' });
        return;
      }

      const oldStatus = requestResult.rows[0].status;
      if (oldStatus !== 'new' && oldStatus !== 'in_progress') {
        res.status(400).json({ error: 'Cannot approve request in this status' });
        return;
      }

      // Update approved quantities if provided
      if (items && Array.isArray(items)) {
        for (const item of items) {
          if (item.id && item.quantityApproved !== undefined) {
            await client.query(
              'UPDATE purchase_request_items SET quantity_approved = $1 WHERE id = $2 AND request_id = $3',
              [item.quantityApproved, item.id, requestId]
            );
          }
        }
      }

      // Update request status
      await client.query(
        `UPDATE purchase_requests 
         SET status = 'approved', approved_by = $1, approved_at = NOW()
         WHERE id = $2`,
        [userId, requestId]
      );

      // Log approval
      await logAction(requestId, 'approved', userId, oldStatus, 'approved', 'Заявка одобрена');

      await client.query('COMMIT');

      res.json({ message: 'Purchase request approved successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Approve purchase request error:', error);
    res.status(500).json({ error: 'Failed to approve purchase request' });
  }
});

// Reject purchase request
router.post('/:id/reject', authMiddleware, requirePermission(PERMISSIONS.APPROVE_PURCHASE_REQUESTS), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const requestId = req.params.id;
    const organizationId = req.user.organizationId;
    const userId = req.user.id;
    const { reason } = req.body;

    const requestResult = await pool.query(
      'SELECT id, status FROM purchase_requests WHERE id = $1 AND organization_id = $2',
      [requestId, organizationId]
    );

    if (requestResult.rows.length === 0) {
      res.status(404).json({ error: 'Purchase request not found' });
      return;
    }

    const oldStatus = requestResult.rows[0].status;
    if (oldStatus === 'rejected' || oldStatus === 'purchased') {
      res.status(400).json({ error: 'Cannot reject request in this status' });
      return;
    }

    await pool.query(
      `UPDATE purchase_requests 
       SET status = 'rejected', rejected_reason = $1
       WHERE id = $2`,
      [reason || null, requestId]
    );

    await logAction(requestId, 'rejected', userId, oldStatus, 'rejected', reason || 'Заявка отклонена');

    res.json({ message: 'Purchase request rejected successfully' });
  } catch (error) {
    console.error('Reject purchase request error:', error);
    res.status(500).json({ error: 'Failed to reject purchase request' });
  }
});

// Move to purchase
router.post('/:id/to-purchase', authMiddleware, requirePermission(PERMISSIONS.APPROVE_PURCHASE_REQUESTS), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const requestId = req.params.id;
    const organizationId = req.user.organizationId;
    const { supplierId, responsiblePerson, plannedDate, items } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get request
      const requestResult = await client.query(
        'SELECT id, status FROM purchase_requests WHERE id = $1 AND organization_id = $2',
        [requestId, organizationId]
      );

      if (requestResult.rows.length === 0) {
        res.status(404).json({ error: 'Purchase request not found' });
        return;
      }

      const oldStatus = requestResult.rows[0].status;
      if (oldStatus !== 'approved') {
        res.status(400).json({ error: 'Request must be approved first' });
        return;
      }

      // Update purchased quantities if provided
      if (items && Array.isArray(items)) {
        let needsReorder = false;
        for (const item of items) {
          if (item.id && item.quantityPurchased !== undefined) {
            await client.query(
              'UPDATE purchase_request_items SET quantity_purchased = $1 WHERE id = $2 AND request_id = $3',
              [item.quantityPurchased, item.id, requestId]
            );

            // Check if partial purchase
            const itemResult = await client.query(
              'SELECT quantity_approved, quantity_purchased FROM purchase_request_items WHERE id = $1',
              [item.id]
            );
            if (itemResult.rows.length > 0) {
              const approved = parseFloat(itemResult.rows[0].quantity_approved || '0');
              const purchased = parseFloat(itemResult.rows[0].quantity_purchased || '0');
              if (purchased < approved) {
                needsReorder = true;
              }
            }
          }
        }

        // Update needs_reorder flag
        await client.query(
          'UPDATE purchase_requests SET needs_reorder = $1 WHERE id = $2',
          [needsReorder, requestId]
        );
      }

      // Update status
      await client.query(
        `UPDATE purchase_requests SET status = 'purchased' WHERE id = $1`,
        [requestId]
      );

      // Create or update purchase info
      const infoResult = await client.query(
        `SELECT id FROM purchase_info WHERE request_id = $1`,
        [requestId]
      );

      if (infoResult.rows.length > 0) {
        await client.query(
          `UPDATE purchase_info 
           SET supplier_id = $1, responsible_person = $2, planned_date = $3, updated_at = NOW()
           WHERE request_id = $4`,
          [supplierId || null, responsiblePerson || null, plannedDate || null, requestId]
        );
      } else {
        await client.query(
          `INSERT INTO purchase_info (request_id, supplier_id, responsible_person, planned_date)
           VALUES ($1, $2, $3, $4)`,
          [requestId, supplierId || null, responsiblePerson || null, plannedDate || null]
        );
      }

      await logAction(requestId, 'moved_to_purchase', req.user.id, oldStatus, 'purchased', 'Переведено в закупку');

      await client.query('COMMIT');

      res.json({ message: 'Purchase request moved to purchase successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Move to purchase error:', error);
    res.status(500).json({ error: 'Failed to move request to purchase' });
  }
});

// Get request log
router.get('/:id/log', authMiddleware, requirePermission(PERMISSIONS.VIEW_WAREHOUSE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const requestId = req.params.id;
    const organizationId = req.user.organizationId;

    // Check access
    const canViewAll = req.user.role === 'admin' || req.user.role === 'manager';
    let checkQuery = 'SELECT id FROM purchase_requests WHERE id = $1 AND organization_id = $2';
    let checkParams: any[] = [requestId, organizationId];
    if (!canViewAll) {
      checkQuery += ' AND created_by = $3';
      checkParams.push(req.user.id);
    }

    const checkResult = await pool.query(checkQuery, checkParams);
    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Purchase request not found' });
      return;
    }

    const logResult = await pool.query(
      `SELECT pl.*, u.name as performed_by_name, u.email as performed_by_email
       FROM purchase_request_log pl
       LEFT JOIN users u ON pl.performed_by = u.id
       WHERE pl.request_id = $1
       ORDER BY pl.performed_at DESC`,
      [requestId]
    );

    res.json(logResult.rows.map(row => ({
      id: row.id,
      requestId: row.request_id,
      action: row.action,
      performedBy: row.performed_by,
      performedByName: row.performed_by_name,
      performedByEmail: row.performed_by_email,
      performedAt: row.performed_at,
      comment: row.comment,
      oldStatus: row.old_status,
      newStatus: row.new_status,
    })));
  } catch (error) {
    console.error('Get request log error:', error);
    res.status(500).json({ error: 'Failed to fetch request log' });
  }
});

export default router;
