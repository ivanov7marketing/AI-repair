// Polyfill for File API (Node.js 18 compatibility)
// File API is required by undici (used by axios) but only available in Node.js 20+
if (typeof globalThis.File === 'undefined') {
  // @ts-ignore
  globalThis.File = class File {
    constructor(parts: any[], name: string, options?: any) {
      this.parts = parts;
      this.name = name;
      this.options = options;
    }
    parts: any[];
    name: string;
    options?: any;
  };
}

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { checkDatabaseConnection } from './db';
import { getUploadsDir } from './config/upload';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import permissionRoutes from './routes/permissions';
import projectRoutes from './routes/projects';
import aiRoutes from './routes/ai';
import priceRoutes from './routes/prices';
import superadminRoutes from './routes/superadmin';
import supplierRoutes from './routes/suppliers';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Middleware
app.use(cors({
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow requests from frontend URL or any Railway subdomain
    if (origin === FRONTEND_URL || 
        origin.includes('.railway.app') || 
        origin.includes('.up.railway.app')) {
      return callback(null, true);
    }
    
    // In development, allow localhost
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

// Serve static files from uploads directory
const imagesDir = getUploadsDir();
app.use('/uploads/images', express.static(imagesDir));

// Request logging middleware
app.use((req: Request, res: Response, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  const dbConnected = await checkDatabaseConnection();
  res.json({
    status: 'ok',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/permissions', permissionRoutes);
app.use('/projects', projectRoutes);
app.use('/ai', aiRoutes);
app.use('/prices', priceRoutes);
app.use('/superadmin', superadminRoutes);
app.use('/superadmin/suppliers', supplierRoutes);
app.use('/suppliers', supplierRoutes);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: express.NextFunction): void => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

