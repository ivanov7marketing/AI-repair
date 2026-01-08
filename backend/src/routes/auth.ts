import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db';
import { RegisterAdminRequest, LoginRequest, LoginResponse, JWTPayload } from '../types/auth';

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  organizationName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Register first admin and create organization
router.post('/register-admin', async (req: Request, res: Response) => {
  try {
    const body = registerSchema.parse(req.body) as RegisterAdminRequest;

    // Check if email already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [body.email]);
    if (existingUser.rows.length > 0) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    // Start transaction
    await pool.query('BEGIN');

    try {
      // Create organization
      const orgResult = await pool.query(
        `INSERT INTO organizations (name, ai_generations_limit, ai_generations_used)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [body.organizationName, 100, 0]
      );
      const organizationId = orgResult.rows[0].id;

      // Hash password
      const passwordHash = await bcrypt.hash(body.password, 10);

      // Create admin user
      const userResult = await pool.query(
        `INSERT INTO users (email, password_hash, name, organization_id, role, created_by)
         VALUES ($1, $2, $3, $4, $5, NULL)
         RETURNING id, email, name, organization_id, role`,
        [body.email, passwordHash, body.name, organizationId, 'admin']
      );

      const user = userResult.rows[0];

      // Commit transaction
      await pool.query('COMMIT');

      // Generate JWT token
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_SECRET not configured');
      }

      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          organizationId: user.organization_id,
          role: user.role,
        } as JWTPayload,
        secret,
        { expiresIn: '7d' }
      );

      const response: LoginResponse = {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organization_id,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Register admin error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const body = loginSchema.parse(req.body) as LoginRequest;

    // Find user
    const userResult = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.name, u.organization_id, u.role
       FROM users u
       WHERE u.email = $1`,
      [body.email]
    );

    if (userResult.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = userResult.rows[0];

    // Verify password
    const passwordMatch = await bcrypt.compare(body.password, user.password_hash);
    if (!passwordMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Generate JWT token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ error: 'JWT_SECRET not configured' });
      return;
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        organizationId: user.organization_id,
        role: user.role,
      } as JWTPayload,
      secret,
      { expiresIn: '7d' }
    );

    const response: LoginResponse = {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organization_id,
      },
    };

    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;

