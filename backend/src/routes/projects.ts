import express, { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../config/permissions';

const router = express.Router();

const createProjectSchema = z.object({
  name: z.string().min(1),
});

// Get all projects (filtered by permissions)
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check if user can view all projects
    const canViewAll = req.user.role === 'admin' || req.user.role === 'manager';
    
    let query: string;
    let params: any[];

    if (canViewAll) {
      // Admin/Manager sees all projects in organization
      query = `
        SELECT p.*, u.email as created_by_email
        FROM projects p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.organization_id = $1 AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC
      `;
      params = [req.user.organizationId];
    } else {
      // Other users see only assigned projects
      query = `
        SELECT DISTINCT p.*, u.email as created_by_email
        FROM projects p
        LEFT JOIN users u ON p.created_by = u.id
        INNER JOIN project_assignments pa ON p.id = pa.project_id
        WHERE p.organization_id = $1 
          AND pa.user_id = $2 
          AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC
      `;
      params = [req.user.organizationId, req.user.id];
    }

    const result = await pool.query(query, params);

    res.json(result.rows.map(row => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      createdBy: row.created_by,
      createdByEmail: row.created_by_email,
      thumbnail: row.thumbnail,
      planFileName: row.plan_file_name,
      planPreview: row.plan_preview,
      analysisData: row.analysis_data || null, // JSONB is already parsed by pg
      global3dImage: row.global_3d_image,
      roomImages: row.room_images || {}, // JSONB is already parsed by pg
    })));
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const projectId = req.params.id;

    // Check access: admin/manager or assigned user
    const canViewAll = req.user.role === 'admin' || req.user.role === 'manager';
    
    let query: string;
    let params: any[];

    if (canViewAll) {
      query = `
        SELECT p.*, u.email as created_by_email
        FROM projects p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.id = $1 AND p.organization_id = $2 AND p.deleted_at IS NULL
      `;
      params = [projectId, req.user.organizationId];
    } else {
      query = `
        SELECT p.*, u.email as created_by_email
        FROM projects p
        LEFT JOIN users u ON p.created_by = u.id
        INNER JOIN project_assignments pa ON p.id = pa.project_id
        WHERE p.id = $1 AND p.organization_id = $2 AND pa.user_id = $3 AND p.deleted_at IS NULL
      `;
      params = [projectId, req.user.organizationId, req.user.id];
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      createdBy: row.created_by,
      createdByEmail: row.created_by_email,
      thumbnail: row.thumbnail,
      planFileName: row.plan_file_name,
      planPreview: row.plan_preview,
      analysisData: row.analysis_data || null, // JSONB is already parsed by pg
      global3dImage: row.global_3d_image,
      roomImages: row.room_images || {}, // JSONB is already parsed by pg
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create project
router.post('/', authMiddleware, requirePermission(PERMISSIONS.CREATE_PROJECTS), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = createProjectSchema.parse(req.body);

    const result = await pool.query(
      `INSERT INTO projects (name, organization_id, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, name, created_at, created_by`,
      [body.name, req.user.organizationId, req.user.id]
    );

    const project = result.rows[0];

    // Auto-assign creator to project
    await pool.query(
      `INSERT INTO project_assignments (project_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [project.id, req.user.id]
    );

    res.status(201).json({
      id: project.id,
      name: project.name,
      createdAt: project.created_at,
      createdBy: project.created_by,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
router.patch('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const projectId = req.params.id;

    // Check access
    const canViewAll = req.user.role === 'admin' || req.user.role === 'manager';
    let accessCheck: any;

    if (canViewAll) {
      accessCheck = await pool.query(
        'SELECT id FROM projects WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
        [projectId, req.user.organizationId]
      );
    } else {
      accessCheck = await pool.query(
        `SELECT p.id FROM projects p
         INNER JOIN project_assignments pa ON p.id = pa.project_id
         WHERE p.id = $1 AND p.organization_id = $2 AND pa.user_id = $3 AND p.deleted_at IS NULL`,
        [projectId, req.user.organizationId, req.user.id]
      );
    }

    if (accessCheck.rows.length === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (req.body.name) {
      updates.push(`name = $${paramIndex++}`);
      values.push(req.body.name);
    }

    if (req.body.analysisData !== undefined) {
      updates.push(`analysis_data = $${paramIndex++}`);
      values.push(JSON.stringify(req.body.analysisData));
    }

    if (req.body.thumbnail !== undefined) {
      updates.push(`thumbnail = $${paramIndex++}`);
      values.push(req.body.thumbnail);
    }

    if (req.body.planPreview !== undefined) {
      updates.push(`plan_preview = $${paramIndex++}`);
      values.push(req.body.planPreview);
    }

    if (req.body.global3dImage !== undefined) {
      updates.push(`global_3d_image = $${paramIndex++}`);
      values.push(req.body.global3dImage);
    }

    if (req.body.roomImages !== undefined) {
      updates.push(`room_images = $${paramIndex++}`);
      values.push(JSON.stringify(req.body.roomImages));
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(projectId, req.user.organizationId);

    const result = await pool.query(
      `UPDATE projects 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex++} AND deleted_at IS NULL
       RETURNING id, name, created_at, created_by, thumbnail, plan_preview, analysis_data, global_3d_image, room_images`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      createdBy: row.created_by,
      thumbnail: row.thumbnail,
      planPreview: row.plan_preview,
      analysisData: row.analysis_data,
      global3dImage: row.global_3d_image,
      roomImages: row.room_images,
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

export default router;

