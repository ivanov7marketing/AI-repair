import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { User, JWTPayload, UserRole, Permission } from '../types/auth';
import { DEFAULT_ROLE_PERMISSIONS } from '../config/permissions';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;
    
    if (!secret) {
      res.status(500).json({ error: 'JWT secret not configured' });
      return;
    }

    const decoded = jwt.verify(token, secret) as JWTPayload;
    
    // Load user from database
    const result = await pool.query(
      'SELECT id, email, name, organization_id, role, created_at, created_by FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const userRow = result.rows[0];
    req.user = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      organizationId: userRow.organization_id,
      role: userRow.role,
      createdAt: userRow.created_at,
      createdBy: userRow.created_by,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

export const requirePermission = (permission: Permission) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Check custom permissions from database
    const customPermResult = await pool.query(
      `SELECT allowed FROM permissions 
       WHERE organization_id = $1 AND role = $2 AND permission = $3`,
      [req.user.organizationId, req.user.role, permission]
    );

    let hasPermission = false;

    if (customPermResult.rows.length > 0) {
      // Use custom permission if exists
      hasPermission = customPermResult.rows[0].allowed;
    } else {
      // Use default permission for role
      const defaultPerms = DEFAULT_ROLE_PERMISSIONS[req.user.role] || [];
      hasPermission = defaultPerms.includes(permission);
    }

    if (!hasPermission) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

