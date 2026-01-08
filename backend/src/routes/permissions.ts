import express, { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { PERMISSIONS, Permission } from '../config/permissions';

const router = express.Router();

const updatePermissionSchema = z.object({
  role: z.enum(['admin', 'manager', 'measurer', 'foreman', 'master', 'client']),
  permission: z.string(),
  allowed: z.boolean(),
});

// Get all permissions for organization
router.get('/', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await pool.query(
      `SELECT role, permission, allowed
       FROM permissions
       WHERE organization_id = $1
       ORDER BY role, permission`,
      [req.user.organizationId]
    );

    // Group by role
    const permissionsByRole: Record<string, Record<string, boolean>> = {};
    
    result.rows.forEach(row => {
      if (!permissionsByRole[row.role]) {
        permissionsByRole[row.role] = {};
      }
      permissionsByRole[row.role][row.permission] = row.allowed;
    });

    res.json(permissionsByRole);
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Update permission
router.patch('/', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = updatePermissionSchema.parse(req.body);

    // Validate permission exists
    const validPermissions = Object.values(PERMISSIONS);
    if (!validPermissions.includes(body.permission as Permission)) {
      res.status(400).json({ error: 'Invalid permission' });
      return;
    }

    // Upsert permission
    await pool.query(
      `INSERT INTO permissions (organization_id, role, permission, allowed)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id, role, permission)
       DO UPDATE SET allowed = $4`,
      [req.user.organizationId, body.role, body.permission, body.allowed]
    );

    res.json({ message: 'Permission updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Update permission error:', error);
    res.status(500).json({ error: 'Failed to update permission' });
  }
});

export default router;

