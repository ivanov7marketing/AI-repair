import express, { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../config/permissions';
import { upload, getUploadsDir } from '../config/upload';
import path from 'path';
import fs from 'fs';

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
      global3dImages: row.global_3d_images ? (typeof row.global_3d_images === 'string' ? JSON.parse(row.global_3d_images) : row.global_3d_images) : [],
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
      global3dImages: row.global_3d_images ? (typeof row.global_3d_images === 'string' ? JSON.parse(row.global_3d_images) : row.global_3d_images) : [],
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

    if (req.body.global3dImages !== undefined) {
      updates.push(`global_3d_images = $${paramIndex++}`);
      values.push(JSON.stringify(req.body.global3dImages));
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
       RETURNING id, name, created_at, created_by, thumbnail, plan_preview, analysis_data, global_3d_images, room_images`,
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
      analysisData: row.analysis_data || null, // JSONB is already parsed by pg
      global3dImages: row.global_3d_images ? (typeof row.global_3d_images === 'string' ? JSON.parse(row.global_3d_images) : row.global_3d_images) : [],
      roomImages: row.room_images || {}, // JSONB is already parsed by pg
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Helper function to check project access
const checkProjectAccess = async (projectId: string, userId: string, organizationId: string, canViewAll: boolean) => {
  let accessCheck: any;
  if (canViewAll) {
    accessCheck = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [projectId, organizationId]
    );
  } else {
    accessCheck = await pool.query(
      `SELECT p.id FROM projects p
       INNER JOIN project_assignments pa ON p.id = pa.project_id
       WHERE p.id = $1 AND p.organization_id = $2 AND pa.user_id = $3 AND p.deleted_at IS NULL`,
      [projectId, organizationId, userId]
    );
  }
  return accessCheck.rows.length > 0;
};

// Helper function to delete old image file
const deleteImageFile = (imageUrl: string | null | undefined) => {
  if (!imageUrl) return;
  
  try {
    // Если это URL файла на сервере (начинается с /uploads/images)
    if (imageUrl.startsWith('/uploads/images/')) {
      const filename = path.basename(imageUrl);
      const filePath = path.join(getUploadsDir(), filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    console.error('Error deleting image file:', error);
  }
};

// Upload image file
router.post('/:id/upload-image', authMiddleware, upload.single('image'), async (req: Request & { file?: Express.Multer.File }, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const projectId = req.params.id;
    const imageType = req.body.imageType as 'planPreview' | 'global3dImage' | 'roomImage' | 'propertyPhoto';
    const roomId = req.body.roomId as string | undefined;

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Check access
    const canViewAll = req.user.role === 'admin' || req.user.role === 'manager';
    const hasAccess = await checkProjectAccess(projectId, req.user.id, req.user.organizationId, canViewAll);
    
    if (!hasAccess) {
      // Delete uploaded file if access denied
      fs.unlinkSync(req.file.path);
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Get current project
    const projectResult = await pool.query(
      'SELECT plan_preview, global_3d_images, room_images FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      fs.unlinkSync(req.file.path);
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const project = projectResult.rows[0];
    const imageUrl = `/uploads/images/${req.file.filename}`;
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Update database
    if (imageType === 'planPreview') {
      deleteImageFile(project.plan_preview);
      updates.push(`plan_preview = $${paramIndex++}`);
      values.push(imageUrl);
    } else if (imageType === 'global3dImage') {
      // НЕ удаляем старые изображения - добавляем новое в начало массива (лимит 10)
      const currentImages = project.global_3d_images 
        ? (typeof project.global_3d_images === 'string' 
            ? JSON.parse(project.global_3d_images) 
            : project.global_3d_images)
        : [];
      const updatedImages = [imageUrl, ...currentImages].slice(0, 10); // Лимит 10 изображений
      updates.push(`global_3d_images = $${paramIndex++}`);
      values.push(JSON.stringify(updatedImages));
    } else if (imageType === 'roomImage' && roomId) {
      const roomImages = project.room_images || {};
      // Получаем текущий массив изображений для комнаты (миграция данных)
      const currentImages = roomImages[roomId]
        ? (Array.isArray(roomImages[roomId]) ? roomImages[roomId] : [roomImages[roomId]])
        : [];
      // Добавляем новое изображение в начало массива (лимит 10)
      const updatedImages = [imageUrl, ...currentImages].slice(0, 10);
      roomImages[roomId] = updatedImages;
      updates.push(`room_images = $${paramIndex++}`);
      values.push(JSON.stringify(roomImages));
    } else if (imageType === 'propertyPhoto') {
      // Property photos are stored in analysis_data
      const analysisData = project.analysis_data || {};
      const propertyPhotos = analysisData.propertyPhotos || [];
      propertyPhotos.push(imageUrl);
      analysisData.propertyPhotos = propertyPhotos;
      updates.push(`analysis_data = $${paramIndex++}`);
      values.push(JSON.stringify(analysisData));
    } else {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Invalid image type or missing roomId' });
      return;
    }

    values.push(projectId, req.user.organizationId);

    await pool.query(
      `UPDATE projects 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex++} AND deleted_at IS NULL`,
      values
    );

    res.json({ url: imageUrl });
  } catch (error) {
    console.error('Upload image error:', error);
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('Error deleting uploaded file:', e);
      }
    }
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Upload base64 image (for generated images)
router.post('/:id/upload-base64-image', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const projectId = req.params.id;
    const { imageData, imageType, roomId } = req.body;

    if (!imageData || !imageType) {
      res.status(400).json({ error: 'Missing imageData or imageType' });
      return;
    }

    // Check access
    const canViewAll = req.user.role === 'admin' || req.user.role === 'manager';
    const hasAccess = await checkProjectAccess(projectId, req.user.id, req.user.organizationId, canViewAll);
    
    if (!hasAccess) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Parse base64 data
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Determine file extension from mime type
    const mimeMatch = imageData.match(/^data:image\/(\w+);base64,/);
    const ext = mimeMatch ? mimeMatch[1] : 'png';
    const filename = `image-${Date.now()}-${Math.round(Math.random() * 1E9)}.${ext}`;
    const filePath = path.join(getUploadsDir(), filename);

    // Save file
    fs.writeFileSync(filePath, buffer);
    const imageUrl = `/uploads/images/${filename}`;

    // Get current project
    const projectResult = await pool.query(
      'SELECT plan_preview, global_3d_images, room_images, analysis_data FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      fs.unlinkSync(filePath);
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const project = projectResult.rows[0];
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Delete old image and update database
    if (imageType === 'planPreview') {
      deleteImageFile(project.plan_preview);
      updates.push(`plan_preview = $${paramIndex++}`);
      values.push(imageUrl);
    } else if (imageType === 'global3dImage') {
      // НЕ удаляем старые изображения - добавляем новое в начало массива (лимит 10)
      const currentImages = project.global_3d_images 
        ? (typeof project.global_3d_images === 'string' 
            ? JSON.parse(project.global_3d_images) 
            : project.global_3d_images)
        : [];
      const updatedImages = [imageUrl, ...currentImages].slice(0, 10); // Лимит 10 изображений
      updates.push(`global_3d_images = $${paramIndex++}`);
      values.push(JSON.stringify(updatedImages));
    } else if (imageType === 'roomImage' && roomId) {
      const roomImages = project.room_images || {};
      // Получаем текущий массив изображений для комнаты (миграция данных)
      const currentImages = roomImages[roomId]
        ? (Array.isArray(roomImages[roomId]) ? roomImages[roomId] : [roomImages[roomId]])
        : [];
      // Добавляем новое изображение в начало массива (лимит 10)
      const updatedImages = [imageUrl, ...currentImages].slice(0, 10);
      roomImages[roomId] = updatedImages;
      updates.push(`room_images = $${paramIndex++}`);
      values.push(JSON.stringify(roomImages));
    } else if (imageType === 'propertyPhoto') {
      const analysisData = project.analysis_data || {};
      const propertyPhotos = analysisData.propertyPhotos || [];
      propertyPhotos.push(imageUrl);
      analysisData.propertyPhotos = propertyPhotos;
      updates.push(`analysis_data = $${paramIndex++}`);
      values.push(JSON.stringify(analysisData));
    } else {
      fs.unlinkSync(filePath);
      res.status(400).json({ error: 'Invalid image type or missing roomId' });
      return;
    }

    values.push(projectId, req.user.organizationId);

    await pool.query(
      `UPDATE projects 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex++} AND deleted_at IS NULL`,
      values
    );

    res.json({ url: imageUrl });
  } catch (error) {
    console.error('Upload base64 image error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Delete image
router.delete('/:id/image', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const projectId = req.params.id;
    const { imageType, roomId, photoIndex } = req.body;

    if (!imageType) {
      res.status(400).json({ error: 'Missing imageType' });
      return;
    }

    // Check access
    const canViewAll = req.user.role === 'admin' || req.user.role === 'manager';
    const hasAccess = await checkProjectAccess(projectId, req.user.id, req.user.organizationId, canViewAll);
    
    if (!hasAccess) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Get current project
    const projectResult = await pool.query(
      'SELECT plan_preview, global_3d_images, room_images, analysis_data FROM projects WHERE id = $1',
      [projectId]
    );
    
    if (projectResult.rows.length === 0) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const project = projectResult.rows[0];
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Delete image file and update database
    if (imageType === 'planPreview') {
      deleteImageFile(project.plan_preview);
      updates.push(`plan_preview = $${paramIndex++}`);
      values.push(null);
    } else if (imageType === 'global3dImage' && typeof photoIndex === 'number') {
      // Удаляем конкретное изображение из массива по индексу
      const currentImages = project.global_3d_images 
        ? (typeof project.global_3d_images === 'string' 
            ? JSON.parse(project.global_3d_images) 
            : project.global_3d_images)
        : [];
      if (photoIndex >= 0 && photoIndex < currentImages.length) {
        deleteImageFile(currentImages[photoIndex]);
        const updatedImages = currentImages.filter((_: string, i: number) => i !== photoIndex);
        updates.push(`global_3d_images = $${paramIndex++}`);
        values.push(JSON.stringify(updatedImages));
      } else {
        res.status(400).json({ error: 'Invalid image index' });
        return;
      }
    } else if (imageType === 'roomImage' && roomId && typeof photoIndex === 'number') {
      const roomImages = project.room_images || {};
      const currentImages = roomImages[roomId]
        ? (Array.isArray(roomImages[roomId]) ? roomImages[roomId] : [roomImages[roomId]])
        : [];
      if (photoIndex >= 0 && photoIndex < currentImages.length) {
        deleteImageFile(currentImages[photoIndex]);
        const updatedImages = currentImages.filter((_: string, i: number) => i !== photoIndex);
        if (updatedImages.length === 0) {
          delete roomImages[roomId];
        } else {
          roomImages[roomId] = updatedImages;
        }
        updates.push(`room_images = $${paramIndex++}`);
        values.push(JSON.stringify(roomImages));
      } else {
        res.status(400).json({ error: 'Invalid image index' });
        return;
      }
    } else if (imageType === 'propertyPhoto' && typeof photoIndex === 'number') {
      const analysisData = project.analysis_data || {};
      const propertyPhotos = analysisData.propertyPhotos || [];
      if (propertyPhotos[photoIndex]) {
        deleteImageFile(propertyPhotos[photoIndex]);
        propertyPhotos.splice(photoIndex, 1);
        analysisData.propertyPhotos = propertyPhotos;
        updates.push(`analysis_data = $${paramIndex++}`);
        values.push(JSON.stringify(analysisData));
      }
    } else {
      res.status(400).json({ error: 'Invalid image type or missing parameters' });
      return;
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No image to delete' });
      return;
    }

    values.push(projectId, req.user.organizationId);

    await pool.query(
      `UPDATE projects 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex++} AND deleted_at IS NULL`,
      values
    );

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Delete project (soft delete)
router.delete('/:id', authMiddleware, requirePermission(PERMISSIONS.DELETE_PROJECTS), async (req: Request, res: Response) => {
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

    // Soft delete: set deleted_at timestamp
    await pool.query(
      `UPDATE projects 
       SET deleted_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [projectId, req.user.organizationId]
    );

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;

