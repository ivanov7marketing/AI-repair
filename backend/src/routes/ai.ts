import express, { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../config/permissions';

const router = express.Router();

// Check AI generation limit before allowing generation
const checkAILimit = async (organizationId: string): Promise<{ allowed: boolean; remaining: number }> => {
  const result = await pool.query(
    `SELECT ai_generations_limit, ai_generations_used
     FROM organizations
     WHERE id = $1`,
    [organizationId]
  );

  if (result.rows.length === 0) {
    throw new Error('Organization not found');
  }

  const org = result.rows[0];
  const remaining = Math.max(0, org.ai_generations_limit - org.ai_generations_used);
  
  return {
    allowed: remaining > 0,
    remaining,
  };
};

// Increment AI generation usage
const incrementAIUsage = async (organizationId: string): Promise<void> => {
  await pool.query(
    `UPDATE organizations
     SET ai_generations_used = ai_generations_used + 1
     WHERE id = $1`,
    [organizationId]
  );
};

// Get AI limit info
router.get('/limit', authMiddleware, requirePermission(PERMISSIONS.USE_AI_GENERATION), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await pool.query(
      `SELECT ai_generations_limit, ai_generations_used
       FROM organizations
       WHERE id = $1`,
      [req.user.organizationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    const org = result.rows[0];
    const remaining = Math.max(0, org.ai_generations_limit - org.ai_generations_used);

    res.json({
      limit: org.ai_generations_limit,
      used: org.ai_generations_used,
      remaining,
    });
  } catch (error) {
    console.error('Get AI limit error:', error);
    res.status(500).json({ error: 'Failed to fetch AI limit' });
  }
});

// Middleware to check AI limit before generation
const checkAILimitMiddleware = async (req: Request, res: Response, next: express.NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const limitCheck = await checkAILimit(req.user.organizationId);
    
    if (!limitCheck.allowed) {
      res.status(403).json({ 
        error: 'AI generation limit exceeded',
        remaining: limitCheck.remaining,
      });
      return;
    }

    // Attach limit info to request for use in route handlers
    (req as any).aiLimit = limitCheck;
    next();
  } catch (error) {
    console.error('AI limit check error:', error);
    res.status(500).json({ error: 'Failed to check AI limit' });
  }
};

// Analyze floor plan endpoint (placeholder - will be implemented with actual AI service)
router.post('/analyze-plan', authMiddleware, requirePermission(PERMISSIONS.USE_AI_GENERATION), checkAILimitMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // TODO: Implement actual AI analysis here
    // For now, just increment usage
    await incrementAIUsage(req.user.organizationId);

    res.json({ 
      message: 'AI analysis endpoint - to be implemented',
      remaining: (req as any).aiLimit.remaining - 1,
    });
  } catch (error) {
    console.error('Analyze plan error:', error);
    res.status(500).json({ error: 'Failed to analyze plan' });
  }
});

// Generate room interior endpoint (placeholder)
router.post('/generate-room', authMiddleware, requirePermission(PERMISSIONS.USE_AI_GENERATION), checkAILimitMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // TODO: Implement actual AI generation here
    await incrementAIUsage(req.user.organizationId);

    res.json({ 
      message: 'AI room generation endpoint - to be implemented',
      remaining: (req as any).aiLimit.remaining - 1,
    });
  } catch (error) {
    console.error('Generate room error:', error);
    res.status(500).json({ error: 'Failed to generate room' });
  }
});

// Generate isometric view endpoint (placeholder)
router.post('/generate-isometric', authMiddleware, requirePermission(PERMISSIONS.USE_AI_GENERATION), checkAILimitMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // TODO: Implement actual AI generation here
    await incrementAIUsage(req.user.organizationId);

    res.json({ 
      message: 'AI isometric generation endpoint - to be implemented',
      remaining: (req as any).aiLimit.remaining - 1,
    });
  } catch (error) {
    console.error('Generate isometric error:', error);
    res.status(500).json({ error: 'Failed to generate isometric view' });
  }
});

export default router;

