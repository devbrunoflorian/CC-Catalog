import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { drizzle } from 'drizzle-orm/sql-js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { app } from 'electron';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { categories, creators, ccSets, ccItems } from './schema';
import { sql } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(app.getPath('userData'), 'sims-cc.db');

let sqlJsDb: SqlJsDatabase;
let db: ReturnType<typeof drizzle>;

/**
 * Initialize the database with sql.js and Drizzle ORM
 */
export async function initDatabase() {
  console.log('[DB] __dirname:', __dirname);
  console.log('[DB] cwd:', process.cwd());

  // Load WASM binary from filesystem (works with ESM __dirname polyfill)
  const wasmPath = join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm');
  console.log('[DB] Loading WASM from:', wasmPath);

  const wasmBinary = new Uint8Array(readFileSync(wasmPath));
  const SQL = await initSqlJs({ wasmBinary: wasmBinary as any });

  // Load existing database or create new one
  if (existsSync(dbPath)) {
    console.log('Loading existing database from:', dbPath);
    const buffer = readFileSync(dbPath);
    sqlJsDb = new SQL.Database(buffer);
  } else {
    // Check for bundled database in resources
    // In production: resources/sims-cc.db
    // In dev: public/sims-cc.db or similar
    const bundledDbPath = app.isPackaged
      ? join(process.resourcesPath, 'sims-cc.db')
      : join(__dirname, '../../public/sims-cc.db'); // Adjust dev path as needed

    console.log('Checking for bundled database at:', bundledDbPath);

    if (existsSync(bundledDbPath)) {
      console.log('Found bundled database, copying to userData...');
      const buffer = readFileSync(bundledDbPath);
      writeFileSync(dbPath, buffer);
      sqlJsDb = new SQL.Database(buffer);
    } else {
      console.log('No bundled database found, creating new empty database at:', dbPath);
      sqlJsDb = new SQL.Database();
    }
  }

  // Create Drizzle instance
  db = drizzle(sqlJsDb);

  // Create tables if they don't exist
  sqlJsDb.run(`
        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS creators (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            patreon_url TEXT,
            website_url TEXT,
            social_links TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS cc_sets (
            id TEXT PRIMARY KEY,
            creator_id TEXT NOT NULL,
            name TEXT NOT NULL,
            release_date TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (creator_id) REFERENCES creators (id),
            UNIQUE(creator_id, name)
        );

        CREATE TABLE IF NOT EXISTS cc_items (
            id TEXT PRIMARY KEY,
            cc_set_id TEXT NOT NULL,
            category_id TEXT,
            file_name TEXT NOT NULL,
            display_name TEXT,
            download_url TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cc_set_id) REFERENCES cc_sets (id),
            FOREIGN KEY (category_id) REFERENCES categories (id),
            UNIQUE(cc_set_id, file_name)
        );

        CREATE TABLE IF NOT EXISTS scan_history (
            id TEXT PRIMARY KEY,
            scan_date TEXT DEFAULT CURRENT_TIMESTAMP,
            file_name TEXT NOT NULL,
            items_found INTEGER DEFAULT 0,
            creators_found INTEGER DEFAULT 0,
            status TEXT DEFAULT 'success'
        );
    `);

  // Migration: Add new columns to cc_sets if they don't exist
  try {
    sqlJsDb.run(`ALTER TABLE cc_sets ADD COLUMN patreon_url TEXT;`);
  } catch (e) {
    // Column likely exists, ignore
  }
  try {
    sqlJsDb.run(`ALTER TABLE cc_sets ADD COLUMN website_url TEXT;`);
  } catch (e) {
    // Column likely exists, ignore
  }

  // Seed default categories
  const defaultCategories = ['Furniture', 'Build Mode', 'CAS', 'Script Mods', 'Landscaping'];

  for (const categoryName of defaultCategories) {
    sqlJsDb.run(
      'INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)',
      [randomUUID(), categoryName]
    );
  }

  // Save to disk after initialization
  saveDatabase();

  console.log('Database initialized successfully at:', dbPath);
}

/**
 * Save the in-memory database to disk
 */
export function saveDatabase(): void {
  if (!sqlJsDb) {
    console.warn('Database not initialized, cannot save');
    return;
  }

  const data = sqlJsDb.export();
  writeFileSync(dbPath, Buffer.from(data));
}

/**
 * Get the Drizzle database instance
 */
export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Get the raw sql.js database instance (for direct SQL queries if needed)
 */
export function getRawDb() {
  if (!sqlJsDb) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return sqlJsDb;
}

// Export for backward compatibility
export default {
  getDb,
  getRawDb,
  saveDatabase,
};
