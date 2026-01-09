import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const createPriceItemSchema = z.object({
  name: z.string(), // Allow empty string for new items that will be edited later
  unit: z.string().min(1),
  price: z.number().min(0), // Allow 0 for new items that will be edited later
  category: z.string().min(1),
  subcategory: z.string().optional(),
  type: z.enum(['work', 'rough', 'finish']),
  sort_order: z.number().optional(),
  supplier_url: z.string().url().optional().or(z.literal('')),
  supplier_name: z.string().optional(),
  auto_price_update: z.boolean().optional(),
});

const updatePriceItemSchema = z.object({
  name: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  price: z.number().min(0).optional(), // Allow 0 for editing
  category: z.string().min(1).optional(),
  subcategory: z.string().optional(),
  type: z.enum(['work', 'rough', 'finish']).optional(),
  sort_order: z.number().optional(),
  supplier_url: z.string().url().optional().or(z.literal('')),
  supplier_name: z.string().optional(),
  last_price_update: z.string().optional(),
  auto_price_update: z.boolean().optional(),
});

// Middleware to check superadmin authentication
export const superadminAuthMiddleware = async (req: Request, res: Response, next: any) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { superadminId: string };
    const result = await pool.query('SELECT id FROM superadmins WHERE id = $1', [decoded.superadminId]);
    
    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    (req as any).superadminId = decoded.superadminId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Login as superadmin
router.post('/login', async (req: Request, res: Response) => {
  try {
    const body = loginSchema.parse(req.body);

    const result = await pool.query(
      'SELECT id, username, password_hash FROM superadmins WHERE username = $1',
      [body.username]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const superadmin = result.rows[0];
    const isValidPassword = await bcrypt.compare(body.password, superadmin.password_hash);

    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign({ superadminId: superadmin.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      username: superadmin.username,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Superadmin login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Change password
router.post('/change-password', superadminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const body = changePasswordSchema.parse(req.body);
    const superadminId = (req as any).superadminId;

    // Verify current password
    const result = await pool.query(
      'SELECT password_hash FROM superadmins WHERE id = $1',
      [superadminId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Superadmin not found' });
      return;
    }

    const isValidPassword = await bcrypt.compare(body.currentPassword, result.rows[0].password_hash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Update password
    const newPasswordHash = await bcrypt.hash(body.newPassword, 10);
    await pool.query(
      'UPDATE superadmins SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, superadminId]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Get all default price items
router.get('/default-prices', superadminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, name, unit, price, category, subcategory, type, sort_order, 
              supplier_url, supplier_name, last_price_update, auto_price_update,
              created_at, updated_at
       FROM default_price_items
       ORDER BY sort_order, category, subcategory, name`
    );

    res.json(result.rows.map(row => ({
      id: row.id,
      name: row.name,
      unit: row.unit,
      price: parseFloat(row.price),
      category: row.category,
      subcategory: row.subcategory || undefined,
      type: row.type,
      sortOrder: row.sort_order,
      supplierUrl: row.supplier_url || undefined,
      supplierName: row.supplier_name || undefined,
      lastPriceUpdate: row.last_price_update || undefined,
      autoPriceUpdate: row.auto_price_update || false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })));
  } catch (error) {
    console.error('Get default prices error:', error);
    res.status(500).json({ error: 'Failed to fetch default prices' });
  }
});

// Create default price item
router.post('/default-prices', superadminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const body = createPriceItemSchema.parse(req.body);

    // Get max sort_order for this category/type
    const maxSortResult = await pool.query(
      `SELECT COALESCE(MAX(sort_order), 0) as max_sort
       FROM default_price_items
       WHERE category = $1 AND type = $2`,
      [body.category, body.type]
    );
    const sortOrder = body.sort_order || (parseInt(maxSortResult.rows[0].max_sort) + 1);

    const result = await pool.query(
      `INSERT INTO default_price_items (name, unit, price, category, subcategory, type, sort_order, supplier_url, supplier_name, auto_price_update)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, name, unit, price, category, subcategory, type, sort_order, 
                  supplier_url, supplier_name, last_price_update, auto_price_update,
                  created_at, updated_at`,
      [
        body.name || '', 
        body.unit, 
        body.price, 
        body.category, 
        body.subcategory || null, 
        body.type, 
        sortOrder,
        body.supplier_url || null,
        body.supplier_name || null,
        body.auto_price_update || false
      ]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      name: row.name,
      unit: row.unit,
      price: parseFloat(row.price),
      category: row.category,
      subcategory: row.subcategory || undefined,
      type: row.type,
      sortOrder: row.sort_order,
      supplierUrl: row.supplier_url || undefined,
      supplierName: row.supplier_name || undefined,
      lastPriceUpdate: row.last_price_update || undefined,
      autoPriceUpdate: row.auto_price_update || false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Create default price error:', error);
    res.status(500).json({ error: 'Failed to create default price' });
  }
});

// Update default price item
router.patch('/default-prices/:id', superadminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const priceItemId = req.params.id;
    const body = updatePriceItemSchema.parse(req.body);

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (body.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(body.name);
    }
    if (body.unit !== undefined) {
      updates.push(`unit = $${paramIndex++}`);
      values.push(body.unit);
    }
    if (body.price !== undefined) {
      updates.push(`price = $${paramIndex++}`);
      values.push(body.price);
    }
    if (body.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(body.category);
    }
    if (body.subcategory !== undefined) {
      updates.push(`subcategory = $${paramIndex++}`);
      values.push(body.subcategory || null);
    }
    if (body.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      values.push(body.type);
    }
    if (body.sort_order !== undefined) {
      updates.push(`sort_order = $${paramIndex++}`);
      values.push(body.sort_order);
    }
    if (body.supplier_url !== undefined) {
      updates.push(`supplier_url = $${paramIndex++}`);
      values.push(body.supplier_url || null);
    }
    if (body.supplier_name !== undefined) {
      updates.push(`supplier_name = $${paramIndex++}`);
      values.push(body.supplier_name || null);
    }
    if (body.last_price_update !== undefined) {
      updates.push(`last_price_update = $${paramIndex++}`);
      values.push(body.last_price_update ? new Date(body.last_price_update) : null);
    }
    if (body.auto_price_update !== undefined) {
      updates.push(`auto_price_update = $${paramIndex++}`);
      values.push(body.auto_price_update);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    values.push(priceItemId);

    const result = await pool.query(
      `UPDATE default_price_items 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++}
       RETURNING id, name, unit, price, category, subcategory, type, sort_order, 
                  supplier_url, supplier_name, last_price_update, auto_price_update,
                  created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Price item not found' });
      return;
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      unit: row.unit,
      price: parseFloat(row.price),
      category: row.category,
      subcategory: row.subcategory || undefined,
      type: row.type,
      sortOrder: row.sort_order,
      supplierUrl: row.supplier_url || undefined,
      supplierName: row.supplier_name || undefined,
      lastPriceUpdate: row.last_price_update || undefined,
      autoPriceUpdate: row.auto_price_update || false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Update default price error:', error);
    res.status(500).json({ error: 'Failed to update default price' });
  }
});

// Delete default price item
router.delete('/default-prices/:id', superadminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const priceItemId = req.params.id;

    const result = await pool.query(
      'DELETE FROM default_price_items WHERE id = $1 RETURNING id',
      [priceItemId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Price item not found' });
      return;
    }

    res.json({ message: 'Price item deleted successfully' });
  } catch (error) {
    console.error('Delete default price error:', error);
    res.status(500).json({ error: 'Failed to delete price item' });
  }
});

export default router;

