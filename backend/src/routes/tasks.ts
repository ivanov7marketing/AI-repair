import express, { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// Zod schemas for validation
const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  taskType: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  // status is now auto-determined from dueDate, but can be manually set for moving tasks
  status: z.enum(['today', 'tomorrow', 'week', 'overdue', 'future']).optional(),
});

const updateTaskSchema = createTaskSchema.partial().extend({
  completed: z.boolean().optional(),
  // When updating, if dueDate changes, we should recalculate status
  // But allow manual status override for moving tasks
});

const moveTaskSchema = z.object({
  status: z.enum(['today', 'tomorrow', 'week', 'overdue', 'future']),
});

// Helper function to determine status based on due date
function determineStatusFromDate(dueDate: string | null | undefined): 'today' | 'tomorrow' | 'week' | 'overdue' | 'future' {
  if (!dueDate) {
    return 'today'; // Default to today if no date
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Overdue: date is in the past
  if (diffDays < 0) {
    return 'overdue';
  }
  
  // Today: date is today
  if (diffDays === 0) {
    return 'today';
  }
  
  // Tomorrow: date is tomorrow
  if (diffDays === 1) {
    return 'tomorrow';
  }
  
  // Week: date is within this week (2-7 days)
  if (diffDays >= 2 && diffDays <= 7) {
    return 'week';
  }
  
  // Future: date is more than a week away
  return 'future';
}

// Helper function to map database row to Task object
const mapTaskRow = (row: any) => ({
  id: row.id,
  organizationId: row.organization_id,
  title: row.title,
  description: row.description,
  assignedTo: row.assigned_to,
  priority: row.priority,
  taskType: row.task_type,
  dueDate: row.due_date,
  status: row.status,
  completed: row.completed,
  completedAt: row.completed_at,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  assignedToUser: row.assigned_to_user ? {
    id: row.assigned_to_user.id,
    name: row.assigned_to_user.name,
    email: row.assigned_to_user.email,
  } : undefined,
  createdByUser: row.created_by_user ? {
    id: row.created_by_user.id,
    name: row.created_by_user.name,
    email: row.created_by_user.email,
  } : undefined,
});

// Get all tasks for organization
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const organizationId = (req as any).user.organizationId;

    const result = await pool.query(`
      SELECT 
        t.*,
        json_build_object(
          'id', u1.id,
          'name', u1.name,
          'email', u1.email
        ) as assigned_to_user,
        json_build_object(
          'id', u2.id,
          'name', u2.name,
          'email', u2.email
        ) as created_by_user
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      WHERE t.organization_id = $1
      ORDER BY 
        CASE t.priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        t.due_date ASC NULLS LAST,
        t.created_at DESC
    `, [organizationId]);

    const tasks = result.rows.map(mapTaskRow);
    res.json(tasks);
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create new task
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const organizationId = (req as any).user.organizationId;

    const data = createTaskSchema.parse(req.body);

    // Automatically determine status from dueDate if not provided
    const status = data.status || determineStatusFromDate(data.dueDate);

    const result = await pool.query(`
      INSERT INTO tasks (
        organization_id, title, description, assigned_to, priority, 
        task_type, due_date, status, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      organizationId,
      data.title,
      data.description || null,
      data.assignedTo || null,
      data.priority || 'medium',
      data.taskType || null,
      data.dueDate || null,
      status,
      userId,
    ]);

    const task = mapTaskRow(result.rows[0]);

    // Fetch user info
    if (task.assignedTo) {
      const userResult = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [task.assignedTo]);
      if (userResult.rows.length > 0) {
        task.assignedToUser = userResult.rows[0];
      }
    }

    const creatorResult = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [userId]);
    if (creatorResult.rows.length > 0) {
      task.createdByUser = creatorResult.rows[0];
    }

    res.status(201).json(task);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const organizationId = (req as any).user.organizationId;
    const taskId = req.params.id;

    const data = updateTaskSchema.parse(req.body);

    // Check if task exists and belongs to organization
    const checkResult = await pool.query(
      'SELECT id FROM tasks WHERE id = $1 AND organization_id = $2',
      [taskId, organizationId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.assignedTo !== undefined) {
      updates.push(`assigned_to = $${paramIndex++}`);
      values.push(data.assignedTo);
    }
    if (data.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      values.push(data.priority);
    }
    if (data.taskType !== undefined) {
      updates.push(`task_type = $${paramIndex++}`);
      values.push(data.taskType);
    }
    // If dueDate changes and status is not explicitly set, recalculate status
    let finalStatus = data.status;
    if (data.dueDate !== undefined) {
      updates.push(`due_date = $${paramIndex++}`);
      values.push(data.dueDate);
      // Recalculate status if not explicitly provided
      if (data.status === undefined) {
        finalStatus = determineStatusFromDate(data.dueDate);
        updates.push(`status = $${paramIndex++}`);
        values.push(finalStatus);
      }
    }
    if (data.status !== undefined && data.dueDate === undefined) {
      // Only update status if dueDate is not being updated
      updates.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }
    if (data.completed !== undefined) {
      updates.push(`completed = $${paramIndex++}`);
      values.push(data.completed);
      if (data.completed) {
        updates.push(`completed_at = NOW()`);
      } else {
        updates.push(`completed_at = NULL`);
      }
    }

    updates.push(`updated_at = NOW()`);
    values.push(taskId, organizationId);

    const result = await pool.query(`
      UPDATE tasks
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex++} AND organization_id = $${paramIndex++}
      RETURNING *
    `, values);

    const task = mapTaskRow(result.rows[0]);

    // Fetch user info
    if (task.assignedTo) {
      const userResult = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [task.assignedTo]);
      if (userResult.rows.length > 0) {
        task.assignedToUser = userResult.rows[0];
      }
    }

    const creatorResult = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [task.createdBy]);
    if (creatorResult.rows.length > 0) {
      task.createdByUser = creatorResult.rows[0];
    }

    res.json(task);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Move task to different status (column)
router.patch('/:id/move', authMiddleware, async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user.organizationId;
    const taskId = req.params.id;

    const data = moveTaskSchema.parse(req.body);

    const result = await pool.query(`
      UPDATE tasks
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND organization_id = $3
      RETURNING *
    `, [data.status, taskId, organizationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = mapTaskRow(result.rows[0]);

    // Fetch user info
    if (task.assignedTo) {
      const userResult = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [task.assignedTo]);
      if (userResult.rows.length > 0) {
        task.assignedToUser = userResult.rows[0];
      }
    }

    const creatorResult = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [task.createdBy]);
    if (creatorResult.rows.length > 0) {
      task.createdByUser = creatorResult.rows[0];
    }

    res.json(task);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error moving task:', error);
    res.status(500).json({ error: 'Failed to move task' });
  }
});

// Delete task
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user.organizationId;
    const taskId = req.params.id;

    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND organization_id = $2 RETURNING id',
      [taskId, organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
