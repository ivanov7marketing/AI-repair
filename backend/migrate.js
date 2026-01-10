const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 
      `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'interiorai'}`,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Create migrations table to track applied migrations
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Get list of migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    // Check which migrations have been applied
    const appliedResult = await client.query('SELECT name FROM migrations ORDER BY id');
    const appliedMigrations = new Set(appliedResult.rows.map(row => row.name));

    // Apply pending migrations
    for (const file of files) {
      if (appliedMigrations.has(file)) {
        console.log(`Skipping already applied migration: ${file}`);
        continue;
      }

      console.log(`Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✓ Applied migration: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.log('All migrations applied successfully');
    
    // Initialize superadmin and default prices after migrations
    console.log('Initializing superadmin and default prices...');
    try {
      // Import and run the init function directly instead of spawning a subprocess
      const initSuperadmin = require('./scripts/init-superadmin-inline.js');
      await initSuperadmin(client); // Reuse existing connection
      console.log('Superadmin initialization completed');
    } catch (error) {
      console.warn('Failed to initialize superadmin (may already exist):', error.message);
    }
    console.log('Migration script completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
    await client.end().catch(() => {});
    throw error; // Re-throw to signal failure
  }
  
  // Close connection
  await client.end();
  console.log('Database connection closed');
}

// Run migrations
migrate()
  .then(() => {
    console.log('Migration script finished successfully');
    process.exit(0); // Exit with success code - allows && chain to continue
  })
  .catch((err) => {
    console.error('Fatal migration error:', err);
    process.exit(1); // Exit with error code
  });

