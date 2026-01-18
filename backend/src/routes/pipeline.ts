import express, { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../config/permissions';
import { PipelineStage } from '../types/deals';

const router = express.Router();

const createStageSchema = z.object({
  name: z.string().min(1).max(50),
  orderIndex: z.number().int().min(0),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  stageType: z.enum(['active', 'won', 'lost', 'system']),
});

const updateStageSchema = createStageSchema.partial();

// Helper function to map database row to PipelineStage
const mapStageRow = (row: any): PipelineStage => ({
  id: row.id,
  organizationId: row.organization_id,
  name: row.name,
  orderIndex: row.order_index,
  color: row.color,
  stageType: row.stage_type,
  isDefault: row.is_default,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// GET /pipeline/stages - Get all pipeline stages for organization
router.get('/stages', authMiddleware, requirePermission(PERMISSIONS.VIEW_SALES), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let result = await pool.query(
      `SELECT * FROM pipeline_stages 
       WHERE organization_id = $1 
       ORDER BY order_index ASC`,
      [req.user.organizationId]
    );

    // If no stages exist, create default ones
    if (result.rows.length === 0) {
      await pool.query(
        `INSERT INTO pipeline_stages (organization_id, name, order_index, color, stage_type, is_default) VALUES
         ($1, 'Квалифицировать', 1, '#3B82F6', 'active', true),
         ($1, 'Записать на замер', 2, '#06B6D4', 'active', true),
         ($1, 'Провести замер', 3, '#14B8A6', 'active', true),
         ($1, 'Подготовить смету', 4, '#10B981', 'active', true),
         ($1, 'Презентовать КП', 5, '#84CC16', 'active', true),
         ($1, 'Дожать в договор', 6, '#F59E0B', 'active', true),
         ($1, 'Договор подписан', 7, '#059669', 'won', true),
         ($1, 'Нереализованные', 8, '#6B7280', 'lost', true)`,
        [req.user.organizationId]
      );

      // Fetch again after creation
      result = await pool.query(
        `SELECT * FROM pipeline_stages 
         WHERE organization_id = $1 
         ORDER BY order_index ASC`,
        [req.user.organizationId]
      );
    }

    const stages = result.rows.map(mapStageRow);
    res.json(stages);
  } catch (error) {
    console.error('Get pipeline stages error:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline stages' });
  }
});

// POST /pipeline/stages - Create new stage (admin only)
router.post('/stages', authMiddleware, requirePermission(PERMISSIONS.MANAGE_PIPELINE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const validatedData = createStageSchema.parse(req.body);

    const result = await pool.query(
      `INSERT INTO pipeline_stages (organization_id, name, order_index, color, stage_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        req.user.organizationId,
        validatedData.name,
        validatedData.orderIndex,
        validatedData.color,
        validatedData.stageType,
      ]
    );

    const stage = mapStageRow(result.rows[0]);
    res.status(201).json(stage);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Create pipeline stage error:', error);
    res.status(500).json({ error: 'Failed to create pipeline stage' });
  }
});

// PUT /pipeline/stages/:id - Update stage
router.put('/stages/:id', authMiddleware, requirePermission(PERMISSIONS.MANAGE_PIPELINE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const stageId = req.params.id;
    const validatedData = updateStageSchema.parse(req.body);

    // Check if stage exists
    const checkResult = await pool.query(
      'SELECT * FROM pipeline_stages WHERE id = $1 AND organization_id = $2',
      [stageId, req.user.organizationId]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Stage not found' });
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

    if (validatedData.orderIndex !== undefined) {
      updateFields.push(`order_index = $${paramIndex}`);
      updateValues.push(validatedData.orderIndex);
      paramIndex++;
    }

    if (validatedData.color !== undefined) {
      updateFields.push(`color = $${paramIndex}`);
      updateValues.push(validatedData.color);
      paramIndex++;
    }

    if (validatedData.stageType !== undefined) {
      updateFields.push(`stage_type = $${paramIndex}`);
      updateValues.push(validatedData.stageType);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(stageId, req.user.organizationId);

    const updateQuery = `
      UPDATE pipeline_stages 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex} AND organization_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, updateValues);
    const stage = mapStageRow(result.rows[0]);

    res.json(stage);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Update pipeline stage error:', error);
    res.status(500).json({ error: 'Failed to update pipeline stage' });
  }
});

// PUT /pipeline/stages/reorder - Reorder stages (for drag & drop)
router.put('/stages/reorder', authMiddleware, requirePermission(PERMISSIONS.MANAGE_PIPELINE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { stageOrders } = z.object({
      stageOrders: z.array(z.object({
        id: z.string().uuid(),
        orderIndex: z.number().int(),
      })),
    }).parse(req.body);

    // Update all stages in a transaction
    await pool.query('BEGIN');

    try {
      for (const { id, orderIndex } of stageOrders) {
        await pool.query(
          `UPDATE pipeline_stages 
           SET order_index = $1, updated_at = NOW()
           WHERE id = $2 AND organization_id = $3`,
          [orderIndex, id, req.user.organizationId]
        );
      }

      await pool.query('COMMIT');

      // Return updated stages
      const result = await pool.query(
        `SELECT * FROM pipeline_stages 
         WHERE organization_id = $1 
         ORDER BY order_index ASC`,
        [req.user.organizationId]
      );

      const stages = result.rows.map(mapStageRow);
      res.json(stages);
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Reorder pipeline stages error:', error);
    res.status(500).json({ error: 'Failed to reorder pipeline stages' });
  }
});

// DELETE /pipeline/stages/:id - Delete stage
router.delete('/stages/:id', authMiddleware, requirePermission(PERMISSIONS.MANAGE_PIPELINE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const stageId = req.params.id;

    // Check if stage exists and is not default
    const checkResult = await pool.query(
      'SELECT * FROM pipeline_stages WHERE id = $1 AND organization_id = $2',
      [stageId, req.user.organizationId]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Stage not found' });
      return;
    }

    if (checkResult.rows[0].is_default) {
      res.status(400).json({ error: 'Cannot delete default stage' });
      return;
    }

    // Check if there are deals on this stage
    const dealsResult = await pool.query(
      'SELECT COUNT(*) FROM deals WHERE stage_id = $1 AND deleted_at IS NULL',
      [stageId]
    );

    if (parseInt(dealsResult.rows[0].count) > 0) {
      res.status(400).json({ error: 'Cannot delete stage with active deals' });
      return;
    }

    await pool.query(
      'DELETE FROM pipeline_stages WHERE id = $1 AND organization_id = $2',
      [stageId, req.user.organizationId]
    );

    res.json({ message: 'Stage deleted successfully' });
  } catch (error) {
    console.error('Delete pipeline stage error:', error);
    res.status(500).json({ error: 'Failed to delete pipeline stage' });
  }
});

// POST /pipeline/stages/reset-defaults - Reset to default stages
router.post('/stages/reset-defaults', authMiddleware, requirePermission(PERMISSIONS.MANAGE_PIPELINE), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Delete all non-default stages
    await pool.query(
      `DELETE FROM pipeline_stages 
       WHERE organization_id = $1 AND is_default = false`,
      [req.user.organizationId]
    );

    // Reset default stages to original order and values
    await pool.query(
      `UPDATE pipeline_stages SET 
        name = CASE order_index
          WHEN 1 THEN 'Квалифицировать'
          WHEN 2 THEN 'Записать на замер'
          WHEN 3 THEN 'Провести замер'
          WHEN 4 THEN 'Подготовить смету'
          WHEN 5 THEN 'Презентовать КП'
          WHEN 6 THEN 'Дожать в договор'
          WHEN 7 THEN 'Договор подписан'
          WHEN 8 THEN 'Нереализованные'
        END,
        color = CASE order_index
          WHEN 1 THEN '#3B82F6'
          WHEN 2 THEN '#06B6D4'
          WHEN 3 THEN '#14B8A6'
          WHEN 4 THEN '#10B981'
          WHEN 5 THEN '#84CC16'
          WHEN 6 THEN '#F59E0B'
          WHEN 7 THEN '#059669'
          WHEN 8 THEN '#6B7280'
        END,
        stage_type = CASE order_index
          WHEN 7 THEN 'won'
          WHEN 8 THEN 'lost'
          ELSE 'active'
        END,
        updated_at = NOW()
       WHERE organization_id = $1 AND is_default = true`,
      [req.user.organizationId]
    );

    // Return updated stages
    const result = await pool.query(
      `SELECT * FROM pipeline_stages 
       WHERE organization_id = $1 
       ORDER BY order_index ASC`,
      [req.user.organizationId]
    );

    const stages = result.rows.map(mapStageRow);
    res.json(stages);
  } catch (error) {
    console.error('Reset default stages error:', error);
    res.status(500).json({ error: 'Failed to reset default stages' });
  }
});

export default router;
