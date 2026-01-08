import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const getDatabaseUrl = (): string => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  // Fallback to separate variables
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const database = process.env.DB_NAME || 'interiorai';
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || '';
  
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
};

export const pool = new Pool({
  connectionString: getDatabaseUrl(),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Health check function
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    const result = await pool.query('SELECT 1');
    return result.rows.length > 0;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
};

