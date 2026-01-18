import express, { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../config/permissions';
import { DealSource } from '../types/deals';

const router = express.Router();

const createSourceSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().max(50).optional().nullable(),
  isActive: z.boolean().optional(),
  leadCost: z.number().positive().optional().nullable(),
});

const updateSourceSchema = createSourceSchema.partial();

// Helper function to map database row to DealSource
const mapSourceRow = (row: any): DealSource => ({
  id: row.id,
  organizationId: row.organization_id,
  name: row.name,
  icon: row.icon,
  isActive: row.is_active,
  leadCost: row.lead_cost ? parseFloat(row.lead_cost) : null,
  createdAt: row.created_at,
});

// GET /deal-sources - Get all deal sources for organization
router.get('/', authMiddleware, requirePermission(PERMISSIONS.VIEW_SALES), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await pool.query(
      `SELECT * FROM deal_sources 
       WHERE organization_id = $1 
       ORDER BY created_at ASC`,
      [req.user.organizationId]
    );

    const sources = result.rows.map(mapSourceRow);
    res.json(sources);
  } catch (error) {
    console.error('Get deal sources error:', error);
    res.status(500).json({ error: 'Failed to fetch deal sources' });
  }
});

// POST /deal-sources - Create new source (admin only)
router.post('/', authMiddleware, requirePermission(PERMISSIONS.MANAGE_PIPELINE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const validatedData = createSourceSchema.parse(req.body);

    const result = await pool.query(
      `INSERT INTO deal_sources (organization_id, name, icon, is_active, lead_cost)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        req.user.organizationId,
        validatedData.name,
        validatedData.icon || null,
        validatedData.isActive !== undefined ? validatedData.isActive : true,
        validatedData.leadCost || null,
      ]
    );

    const source = mapSourceRow(result.rows[0]);
    res.status(201).json(source);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Create deal source error:', error);
    res.status(500).json({ error: 'Failed to create deal source' });
  }
});

// PUT /deal-sources/:id - Update source
router.put('/:id', authMiddleware, requirePermission(PERMISSIONS.MANAGE_PIPELINE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const sourceId = req.params.id;
    const validatedData = updateSourceSchema.parse(req.body);

    // Check if source exists
    const checkResult = await pool.query(
      'SELECT * FROM deal_sources WHERE id = $1 AND organization_id = $2',
      [sourceId, req.user.organizationId]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Source not found' });
      return;
    }

    // Build update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (validatedData.name !== undefined) {
      updateFields.push(`name = $${paramIndex}`);
      updateValues.push(validatedData.name);
      paramIndex++;
    }

    if (validatedData.icon !== undefined) {
      updateFields.push(`icon = $${paramIndex}`);
      updateValues.push(validatedData.icon);
      paramIndex++;
    }

    if (validatedData.isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex}`);
      updateValues.push(validatedData.isActive);
      paramIndex++;
    }

    if (validatedData.leadCost !== undefined) {
      updateFields.push(`lead_cost = $${paramIndex}`);
      updateValues.push(validatedData.leadCost);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    updateValues.push(sourceId, req.user.organizationId);

    const updateQuery = `
      UPDATE deal_sources 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex} AND organization_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, updateValues);
    const source = mapSourceRow(result.rows[0]);

    res.json(source);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Update deal source error:', error);
    res.status(500).json({ error: 'Failed to update deal source' });
  }
});

// DELETE /deal-sources/:id - Deactivate source (soft delete)
router.delete('/:id', authMiddleware, requirePermission(PERMISSIONS.MANAGE_PIPELINE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const sourceId = req.params.id;

    // Check if source exists
    const checkResult = await pool.query(
      'SELECT * FROM deal_sources WHERE id = $1 AND organization_id = $2',
      [sourceId, req.user.organizationId]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Source not found' });
      return;
    }

    // Deactivate instead of deleting to preserve history
    await pool.query(
      `UPDATE deal_sources 
       SET is_active = false 
       WHERE id = $1 AND organization_id = $2`,
      [sourceId, req.user.organizationId]
    );

    res.json({ message: 'Source deactivated successfully' });
  } catch (error) {
    console.error('Delete deal source error:', error);
    res.status(500).json({ error: 'Failed to deactivate deal source' });
  }
});

export default router;
