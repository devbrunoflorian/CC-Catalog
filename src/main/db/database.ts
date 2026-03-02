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

const customDbPath = join(app.getPath('userData'), 'sims-cc.db');

let sqlJsDbCustom: SqlJsDatabase;
let sqlJsDbOfficial: SqlJsDatabase | null = null;
let dbCustom: ReturnType<typeof drizzle>;
let dbOfficial: ReturnType<typeof drizzle> | null = null;

let activeDbType: 'custom' | 'official' = 'custom';

function initSchema(database: SqlJsDatabase) {
  // Create tables if they don't exist
  database.run(`
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
            FOREIGN KEY (creator_id) REFERENCES creators (id)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_sets_hierarchy ON cc_sets(creator_id, name, IFNULL(parent_id, ''));

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
    database.run(`ALTER TABLE cc_sets ADD COLUMN patreon_url TEXT;`);
  } catch (e) {
    // Column likely exists, ignore
  }
  try {
    database.run(`ALTER TABLE cc_sets ADD COLUMN website_url TEXT;`);
  } catch (e) {
    // Column likely exists, ignore
  }

  // Seed default categories
  const defaultCategories = ['Furniture', 'Build Mode', 'CAS', 'Script Mods', 'Landscaping'];

  for (const categoryName of defaultCategories) {
    database.run(
      'INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)',
      [randomUUID(), categoryName]
    );
  }
}

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

  // 1. Initialize Custom Database
  if (existsSync(customDbPath)) {
    console.log('Loading existing custom database from:', customDbPath);
    const buffer = readFileSync(customDbPath);
    sqlJsDbCustom = new SQL.Database(buffer);
  } else {
    // Check for bundled database in resources
    const bundledDbPath = app.isPackaged
      ? join(process.resourcesPath, 'sims-cc.db')
      : join(__dirname, '../../public/sims-cc.db');

    if (existsSync(bundledDbPath)) {
      console.log('Found bundled database, copying to userData for custom db...');
      const buffer = readFileSync(bundledDbPath);
      writeFileSync(customDbPath, buffer);
      sqlJsDbCustom = new SQL.Database(buffer);
    } else {
      console.log('No bundled database found, creating new empty custom database at:', customDbPath);
      sqlJsDbCustom = new SQL.Database();
    }
  }

  dbCustom = drizzle(sqlJsDbCustom);
  initSchema(sqlJsDbCustom);

  // Save to disk after initialization
  saveDatabase();

  console.log('Custom Database initialized successfully at:', customDbPath);

  // 2. Initialize Official Database
  const officialDbPath = app.isPackaged
    ? join(process.resourcesPath, 'sims-cc.db')
    : join(__dirname, '../../public/sims-cc.db');

  if (existsSync(officialDbPath)) {
    console.log('Loading official database from:', officialDbPath);
    const buffer = readFileSync(officialDbPath);
    sqlJsDbOfficial = new SQL.Database(buffer);
    dbOfficial = drizzle(sqlJsDbOfficial);
    initSchema(sqlJsDbOfficial);
  } else {
    console.warn('Official database not found at:', officialDbPath);
  }
}

/**
 * Save the in-memory custom database to disk
 */
export function saveDatabase(): void {
  // We only ever save the custom DB. The official DB is read-only.
  if (!sqlJsDbCustom) {
    console.warn('Custom Database not initialized, cannot save');
    return;
  }

  const data = sqlJsDbCustom.export();
  writeFileSync(customDbPath, Buffer.from(data));
}

export function setActiveDb(type: 'custom' | 'official') {
  activeDbType = type;
  console.log('[DB] Active database switched to:', type);
}

export function getActiveDbType() {
  return activeDbType;
}

/**
 * Get the active Drizzle database instance
 */
export function getDb() {
  if (activeDbType === 'official') {
    if (!dbOfficial) {
      throw new Error('Official Database not initialized or not found. Cannot perform query.');
    }
    return dbOfficial;
  }

  if (!dbCustom) {
    throw new Error('Custom Database not initialized. Call initDatabase() first.');
  }
  return dbCustom;
}

/**
 * Get the active raw sql.js database instance (for direct SQL queries if needed)
 */
export function getRawDb() {
  if (activeDbType === 'official') {
    if (!sqlJsDbOfficial) {
      throw new Error('Official Database not initialized or not found. Cannot perform query.');
    }
    return sqlJsDbOfficial;
  }

  if (!sqlJsDbCustom) {
    throw new Error('Custom Database not initialized. Call initDatabase() first.');
  }
  return sqlJsDbCustom;
}

// Export for backward compatibility
export default {
  getDb,
  getRawDb,
  saveDatabase,
  setActiveDb,
  getActiveDbType
};
