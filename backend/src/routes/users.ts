import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { pool } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { UserRole } from '../types/auth';

const router = express.Router();

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['manager', 'measurer', 'foreman', 'master', 'client']),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().optional(),
  role: z.enum(['admin', 'manager', 'measurer', 'foreman', 'master', 'client']).optional(),
});

// Create user (admin only)
router.post('/', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = createUserSchema.parse(req.body);

    // Check if email already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [body.email]);
    if (existingUser.rows.length > 0) {
      res.status(400).json({ error: 'Email already exists' });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, 10);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, organization_id, role, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, name, organization_id, role, created_at`,
      [body.email, passwordHash, body.name, req.user.organizationId, body.role, req.user.id]
    );

    const user = result.rows[0];
    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organization_id,
      createdAt: user.created_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Get all users in organization (admin/manager)
router.get('/', authMiddleware, requireRole('admin', 'manager'), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await pool.query(
      `SELECT id, email, name, role, created_at, created_by
       FROM users
       WHERE organization_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [req.user.organizationId]
    );

    res.json(result.rows.map(row => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      createdAt: row.created_at,
      createdBy: row.created_by,
    })));
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user
router.patch('/:id', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userId = req.params.id;
    const body = updateUserSchema.parse(req.body);

    // Check if user exists and belongs to same organization
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [userId, req.user.organizationId]
    );

    if (userCheck.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (body.email) {
      // Check if email already exists (excluding current user)
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [body.email, userId]
      );
      if (emailCheck.rows.length > 0) {
        res.status(400).json({ error: 'Email already exists' });
        return;
      }
      updates.push(`email = $${paramIndex++}`);
      values.push(body.email);
    }

    if (body.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(body.name);
    }

    if (body.role) {
      updates.push(`role = $${paramIndex++}`);
      values.push(body.role);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(userId, req.user.organizationId);

    const result = await pool.query(
      `UPDATE users 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND organization_id = $${paramIndex++} AND deleted_at IS NULL
       RETURNING id, email, name, role, organization_id, created_at`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organization_id,
      createdAt: user.created_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (soft delete)
router.delete('/:id', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userId = req.params.id;

    // Prevent self-deletion
    if (userId === req.user.id) {
      res.status(400).json({ error: 'Cannot delete yourself' });
      return;
    }

    const result = await pool.query(
      `UPDATE users 
       SET deleted_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [userId, req.user.organizationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;

