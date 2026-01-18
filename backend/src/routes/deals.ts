import express, { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../config/permissions';
import { Deal, DealTimelineEvent } from '../types/deals';

const router = express.Router();

// Zod schemas for validation
const createDealSchema = z.object({
  leadName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().nullable(),
  telegram: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  sourceId: z.string().uuid().optional().nullable(),
  responsibleManagerId: z.string().uuid().optional().nullable(),
  leadTemperature: z.enum(['hot', 'warm', 'cold']).optional(),
  address: z.string().optional().nullable(),
  buildingType: z.string().optional().nullable(),
  area: z.number().positive().optional().nullable(),
  roomsCount: z.string().optional().nullable(),
  bathroomType: z.string().optional().nullable(),
  ceilingHeight: z.number().positive().optional().nullable(),
  hasElevator: z.boolean().optional(),
  repairType: z.string().optional().nullable(),
  objectCondition: z.string().optional().nullable(),
  budgetFrom: z.number().positive().optional().nullable(),
  budgetTo: z.number().positive().optional().nullable(),
  needsDesign: z.boolean().optional(),
  needsDemolition: z.boolean().optional(),
  materialPurchaseType: z.string().optional().nullable(),
  desiredStartDate: z.string().optional().nullable(),
  urgency: z.string().optional().nullable(),
  measurementNotes: z.string().optional().nullable(),
});

const updateDealSchema = createDealSchema.partial();

const moveDealSchema = z.object({
  stageId: z.string().uuid(),
});

const addCommentSchema = z.object({
  content: z.string().min(1),
});

// Helper function to map database row to Deal object
const mapDealRow = (row: any): Deal => ({
  id: row.id,
  organizationId: row.organization_id,
  stageId: row.stage_id,
  sourceId: row.source_id,
  projectId: row.project_id,
  objectId: row.object_id,
  leadName: row.lead_name,
  phone: row.phone,
  email: row.email,
  telegram: row.telegram,
  whatsapp: row.whatsapp,
  address: row.address,
  buildingType: row.building_type,
  area: row.area ? parseFloat(row.area) : null,
  roomsCount: row.rooms_count,
  bathroomType: row.bathroom_type,
  ceilingHeight: row.ceiling_height ? parseFloat(row.ceiling_height) : null,
  hasElevator: row.has_elevator || false,
  repairType: row.repair_type,
  objectCondition: row.object_condition,
  budgetFrom: row.budget_from ? parseFloat(row.budget_from) : null,
  budgetTo: row.budget_to ? parseFloat(row.budget_to) : null,
  needsDesign: row.needs_design || false,
  needsDemolition: row.needs_demolition || false,
  materialPurchaseType: row.material_purchase_type,
  desiredStartDate: row.desired_start_date,
  urgency: row.urgency,
  responsibleManagerId: row.responsible_manager_id,
  leadTemperature: row.lead_temperature || 'warm',
  daysOnStage: row.days_on_stage || 0,
  stageEnteredAt: row.stage_entered_at,
  measurerId: row.measurer_id,
  measurementDate: row.measurement_date,
  measurementTime: row.measurement_time,
  measurementCompleted: row.measurement_completed || false,
  measurementNotes: row.measurement_notes,
  contractFileUrl: row.contract_file_url,
  contractSignedDate: row.contract_signed_date,
  prepaymentAmount: row.prepayment_amount ? parseFloat(row.prepayment_amount) : null,
  prepaymentDate: row.prepayment_date,
  isRealized: row.is_realized || false,
  isClosed: row.is_closed || false,
  closedReason: row.closed_reason,
  closedAt: row.closed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
  stage: row.stage_name ? {
    id: row.stage_id,
    organizationId: row.organization_id,
    name: row.stage_name,
    orderIndex: row.stage_order_index,
    color: row.stage_color,
    stageType: row.stage_type,
    isDefault: row.stage_is_default,
    createdAt: row.stage_created_at,
    updatedAt: row.stage_updated_at,
  } : undefined,
  source: row.source_name ? {
    id: row.source_id,
    organizationId: row.organization_id,
    name: row.source_name,
    icon: row.source_icon,
    isActive: row.source_is_active,
    leadCost: row.source_lead_cost ? parseFloat(row.source_lead_cost) : null,
    createdAt: row.source_created_at,
  } : undefined,
  responsibleManager: row.manager_name ? {
    id: row.responsible_manager_id,
    name: row.manager_name,
    email: row.manager_email,
  } : undefined,
});

// GET /deals - List all deals with filters
router.get('/', authMiddleware, requirePermission(PERMISSIONS.VIEW_SALES), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      stage_id,
      manager_id,
      source_id,
      search,
      lead_temperature,
      budget_from,
      budget_to,
      limit = '100',
      offset = '0',
    } = req.query;

    // Check if user can view all deals
    const canViewAll = req.user.role === 'admin';

    let query = `
      SELECT 
        d.*,
        ps.name as stage_name,
        ps.order_index as stage_order_index,
        ps.color as stage_color,
        ps.stage_type as stage_type,
        ps.is_default as stage_is_default,
        ps.created_at as stage_created_at,
        ps.updated_at as stage_updated_at,
        ds.name as source_name,
        ds.icon as source_icon,
        ds.is_active as source_is_active,
        ds.lead_cost as source_lead_cost,
        ds.created_at as source_created_at,
        u.name as manager_name,
        u.email as manager_email
      FROM deals d
      LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id
      LEFT JOIN deal_sources ds ON d.source_id = ds.id
      LEFT JOIN users u ON d.responsible_manager_id = u.id
      WHERE d.organization_id = $1 AND d.deleted_at IS NULL
    `;

    const params: any[] = [req.user.organizationId];
    let paramIndex = 2;

    // Apply permission-based filtering
    if (!canViewAll && req.user.role === 'manager') {
      query += ` AND d.responsible_manager_id = $${paramIndex}`;
      params.push(req.user.id);
      paramIndex++;
    } else if (req.user.role === 'measurer') {
      query += ` AND d.measurer_id = $${paramIndex}`;
      params.push(req.user.id);
      paramIndex++;
    }

    // Apply filters
    if (stage_id) {
      query += ` AND d.stage_id = $${paramIndex}`;
      params.push(stage_id);
      paramIndex++;
    }

    if (manager_id) {
      query += ` AND d.responsible_manager_id = $${paramIndex}`;
      params.push(manager_id);
      paramIndex++;
    }

    if (source_id) {
      query += ` AND d.source_id = $${paramIndex}`;
      params.push(source_id);
      paramIndex++;
    }

    if (lead_temperature) {
      query += ` AND d.lead_temperature = $${paramIndex}`;
      params.push(lead_temperature);
      paramIndex++;
    }

    if (budget_from) {
      query += ` AND (d.budget_from >= $${paramIndex} OR d.budget_to >= $${paramIndex})`;
      params.push(budget_from);
      paramIndex++;
    }

    if (budget_to) {
      query += ` AND (d.budget_from <= $${paramIndex} OR d.budget_to <= $${paramIndex})`;
      params.push(budget_to);
      paramIndex++;
    }

    if (search) {
      query += ` AND (
        d.lead_name ILIKE $${paramIndex} OR 
        d.phone ILIKE $${paramIndex} OR 
        d.address ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY d.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await pool.query(query, params);
    const deals = result.rows.map(mapDealRow);

    res.json(deals);
  } catch (error) {
    console.error('Get deals error:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

// GET /deals/:id - Get single deal
router.get('/:id', authMiddleware, requirePermission(PERMISSIONS.VIEW_SALES), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const dealId = req.params.id;

    const query = `
      SELECT 
        d.*,
        ps.name as stage_name,
        ps.order_index as stage_order_index,
        ps.color as stage_color,
        ps.stage_type as stage_type,
        ps.is_default as stage_is_default,
        ps.created_at as stage_created_at,
        ps.updated_at as stage_updated_at,
        ds.name as source_name,
        ds.icon as source_icon,
        ds.is_active as source_is_active,
        ds.lead_cost as source_lead_cost,
        ds.created_at as source_created_at,
        u.name as manager_name,
        u.email as manager_email
      FROM deals d
      LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id
      LEFT JOIN deal_sources ds ON d.source_id = ds.id
      LEFT JOIN users u ON d.responsible_manager_id = u.id
      WHERE d.id = $1 AND d.organization_id = $2 AND d.deleted_at IS NULL
    `;

    const result = await pool.query(query, [dealId, req.user.organizationId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }

    // Check permissions for non-admin users
    if (req.user.role === 'manager' && result.rows[0].responsible_manager_id !== req.user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (req.user.role === 'measurer' && result.rows[0].measurer_id !== req.user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const deal = mapDealRow(result.rows[0]);
    res.json(deal);
  } catch (error) {
    console.error('Get deal error:', error);
    res.status(500).json({ error: 'Failed to fetch deal' });
  }
});

// POST /deals - Create new deal
router.post('/', authMiddleware, requirePermission(PERMISSIONS.CREATE_DEALS), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const validatedData = createDealSchema.parse(req.body);

    // Get first stage (lowest order_index) for the organization
    const stageResult = await pool.query(
      `SELECT id FROM pipeline_stages 
       WHERE organization_id = $1 AND stage_type = 'active' 
       ORDER BY order_index ASC LIMIT 1`,
      [req.user.organizationId]
    );

    if (stageResult.rows.length === 0) {
      res.status(400).json({ error: 'No pipeline stages configured' });
      return;
    }

    const firstStageId = stageResult.rows[0].id;

    // Insert deal
    const insertQuery = `
      INSERT INTO deals (
        organization_id, stage_id, source_id, lead_name, phone, email, telegram, whatsapp,
        responsible_manager_id, lead_temperature, address, building_type, area, rooms_count,
        bathroom_type, ceiling_height, has_elevator, repair_type, object_condition,
        budget_from, budget_to, needs_design, needs_demolition, material_purchase_type,
        desired_start_date, urgency, stage_entered_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26, NOW()
      ) RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      req.user.organizationId,
      firstStageId,
      validatedData.sourceId || null,
      validatedData.leadName,
      validatedData.phone,
      validatedData.email || null,
      validatedData.telegram || null,
      validatedData.whatsapp || null,
      validatedData.responsibleManagerId || req.user.id,
      validatedData.leadTemperature || 'warm',
      validatedData.address || null,
      validatedData.buildingType || null,
      validatedData.area || null,
      validatedData.roomsCount || null,
      validatedData.bathroomType || null,
      validatedData.ceilingHeight || null,
      validatedData.hasElevator || false,
      validatedData.repairType || null,
      validatedData.objectCondition || null,
      validatedData.budgetFrom || null,
      validatedData.budgetTo || null,
      validatedData.needsDesign || false,
      validatedData.needsDemolition || false,
      validatedData.materialPurchaseType || null,
      validatedData.desiredStartDate || null,
      validatedData.urgency || null,
    ]);

    const deal = mapDealRow(result.rows[0]);

    // Create timeline event
    await pool.query(
      `INSERT INTO deal_timeline (deal_id, event_type, user_id, content) 
       VALUES ($1, 'deal_created', $2, $3)`,
      [deal.id, req.user.id, `Сделка создана`]
    );

    res.status(201).json(deal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Create deal error:', error);
    res.status(500).json({ error: 'Failed to create deal' });
  }
});

// PUT /deals/:id - Update deal
router.put('/:id', authMiddleware, requirePermission(PERMISSIONS.EDIT_DEALS), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const dealId = req.params.id;
    const validatedData = updateDealSchema.parse(req.body);

    // Check if deal exists and user has access
    const checkResult = await pool.query(
      'SELECT * FROM deals WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [dealId, req.user.organizationId]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }

    const oldDeal = checkResult.rows[0];

    // Check permissions
    if (req.user.role === 'manager' && oldDeal.responsible_manager_id !== req.user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    const fieldMapping: Record<string, string> = {
      leadName: 'lead_name',
      phone: 'phone',
      email: 'email',
      telegram: 'telegram',
      whatsapp: 'whatsapp',
      sourceId: 'source_id',
      responsibleManagerId: 'responsible_manager_id',
      leadTemperature: 'lead_temperature',
      address: 'address',
      buildingType: 'building_type',
      area: 'area',
      roomsCount: 'rooms_count',
      bathroomType: 'bathroom_type',
      ceilingHeight: 'ceiling_height',
      hasElevator: 'has_elevator',
      repairType: 'repair_type',
      objectCondition: 'object_condition',
      budgetFrom: 'budget_from',
      budgetTo: 'budget_to',
      needsDesign: 'needs_design',
      needsDemolition: 'needs_demolition',
      materialPurchaseType: 'material_purchase_type',
      desiredStartDate: 'desired_start_date',
      urgency: 'urgency',
      measurementNotes: 'measurement_notes',
    };

    for (const [key, value] of Object.entries(validatedData)) {
      if (value !== undefined && fieldMapping[key]) {
        updateFields.push(`${fieldMapping[key]} = $${paramIndex}`);
        updateValues.push(value);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(dealId, req.user.organizationId);

    const updateQuery = `
      UPDATE deals 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex} AND organization_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, updateValues);
    const updatedDeal = mapDealRow(result.rows[0]);

    // Log field changes in timeline
    for (const [key, newValue] of Object.entries(validatedData)) {
      const dbField = fieldMapping[key];
      if (dbField && oldDeal[dbField] !== newValue) {
        await pool.query(
          `INSERT INTO deal_timeline (deal_id, event_type, user_id, content, metadata)
           VALUES ($1, 'field_change', $2, $3, $4)`,
          [
            dealId,
            req.user.id,
            `Изменено поле: ${key}`,
            JSON.stringify({
              field: key,
              oldValue: oldDeal[dbField],
              newValue: newValue,
            }),
          ]
        );
      }
    }

    res.json(updatedDeal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Update deal error:', error);
    res.status(500).json({ error: 'Failed to update deal' });
  }
});

// DELETE /deals/:id - Soft delete deal
router.delete('/:id', authMiddleware, requirePermission(PERMISSIONS.DELETE_DEALS), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const dealId = req.params.id;

    const result = await pool.query(
      `UPDATE deals 
       SET deleted_at = NOW() 
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [dealId, req.user.organizationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }

    res.json({ message: 'Deal deleted successfully' });
  } catch (error) {
    console.error('Delete deal error:', error);
    res.status(500).json({ error: 'Failed to delete deal' });
  }
});

// POST /deals/:id/move - Move deal to another stage
router.post('/:id/move', authMiddleware, requirePermission(PERMISSIONS.EDIT_DEALS), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const dealId = req.params.id;
    const { stageId } = moveDealSchema.parse(req.body);

    // Check if deal exists
    const dealResult = await pool.query(
      'SELECT * FROM deals WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [dealId, req.user.organizationId]
    );

    if (dealResult.rows.length === 0) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }

    const oldStageId = dealResult.rows[0].stage_id;

    // Check if stage exists and belongs to organization
    const stageResult = await pool.query(
      'SELECT * FROM pipeline_stages WHERE id = $1 AND organization_id = $2',
      [stageId, req.user.organizationId]
    );

    if (stageResult.rows.length === 0) {
      res.status(404).json({ error: 'Stage not found' });
      return;
    }

    // Get old stage name for timeline
    const oldStageResult = await pool.query(
      'SELECT name FROM pipeline_stages WHERE id = $1',
      [oldStageId]
    );
    const oldStageName = oldStageResult.rows[0]?.name || 'Unknown';
    const newStageName = stageResult.rows[0].name;

    // Calculate days on old stage
    const daysOnStage = Math.floor(
      (Date.now() - new Date(dealResult.rows[0].stage_entered_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Update deal
    const updateResult = await pool.query(
      `UPDATE deals 
       SET stage_id = $1, stage_entered_at = NOW(), days_on_stage = 0, updated_at = NOW()
       WHERE id = $2 AND organization_id = $3
       RETURNING *`,
      [stageId, dealId, req.user.organizationId]
    );

    const updatedDeal = mapDealRow(updateResult.rows[0]);

    // Create timeline event
    await pool.query(
      `INSERT INTO deal_timeline (deal_id, event_type, user_id, content, metadata)
       VALUES ($1, 'stage_change', $2, $3, $4)`,
      [
        dealId,
        req.user.id,
        `Перемещено с этапа "${oldStageName}" на "${newStageName}"`,
        JSON.stringify({
          oldStageId,
          newStageId: stageId,
          oldStageName,
          newStageName,
          daysOnOldStage: daysOnStage,
        }),
      ]
    );

    res.json(updatedDeal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Move deal error:', error);
    res.status(500).json({ error: 'Failed to move deal' });
  }
});

// GET /deals/:id/timeline - Get deal timeline
router.get('/:id/timeline', authMiddleware, requirePermission(PERMISSIONS.VIEW_SALES), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const dealId = req.params.id;
    const { event_type } = req.query;

    // Check if deal exists and user has access
    const dealCheck = await pool.query(
      'SELECT * FROM deals WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [dealId, req.user.organizationId]
    );

    if (dealCheck.rows.length === 0) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }

    let query = `
      SELECT 
        dt.*,
        u.name as user_name,
        u.email as user_email
      FROM deal_timeline dt
      LEFT JOIN users u ON dt.user_id = u.id
      WHERE dt.deal_id = $1
    `;

    const params: any[] = [dealId];

    if (event_type) {
      query += ` AND dt.event_type = $2`;
      params.push(event_type);
    }

    query += ` ORDER BY dt.created_at DESC`;

    const result = await pool.query(query, params);

    const timeline: DealTimelineEvent[] = result.rows.map((row) => ({
      id: row.id,
      dealId: row.deal_id,
      eventType: row.event_type,
      userId: row.user_id,
      content: row.content,
      metadata: row.metadata,
      createdAt: row.created_at,
      user: row.user_name ? {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email,
      } : undefined,
    }));

    res.json(timeline);
  } catch (error) {
    console.error('Get timeline error:', error);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

// POST /deals/:id/timeline - Add comment to timeline
router.post('/:id/timeline', authMiddleware, requirePermission(PERMISSIONS.EDIT_DEALS), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const dealId = req.params.id;
    const { content } = addCommentSchema.parse(req.body);

    // Check if deal exists
    const dealCheck = await pool.query(
      'SELECT * FROM deals WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [dealId, req.user.organizationId]
    );

    if (dealCheck.rows.length === 0) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }

    // Parse @mentions from content
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }

    const result = await pool.query(
      `INSERT INTO deal_timeline (deal_id, event_type, user_id, content, metadata)
       VALUES ($1, 'comment', $2, $3, $4)
       RETURNING *`,
      [
        dealId,
        req.user.id,
        content,
        mentions.length > 0 ? JSON.stringify({ mentions }) : null,
      ]
    );

    const event: DealTimelineEvent = {
      id: result.rows[0].id,
      dealId: result.rows[0].deal_id,
      eventType: result.rows[0].event_type,
      userId: result.rows[0].user_id,
      content: result.rows[0].content,
      metadata: result.rows[0].metadata,
      createdAt: result.rows[0].created_at,
      user: {
        id: req.user.id,
        name: req.user.name || '',
        email: req.user.email,
      },
    };

    res.status(201).json(event);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

export default router;
