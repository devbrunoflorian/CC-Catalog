import Database from 'better-sqlite3';
import { join } from 'path';
import { app } from 'electron';
import { randomUUID } from 'crypto';

const dbPath = join(app.getPath('userData'), 'sims-cc.db');
const db = new Database(dbPath);

export function initDatabase() {
    db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS creators (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE,
      patreon_url TEXT,
      website_url TEXT,
      social_links TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cc_sets (
      id TEXT PRIMARY KEY,
      creator_id TEXT,
      name TEXT,
      release_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_id) REFERENCES creators (id),
      UNIQUE(creator_id, name)
    );

    CREATE TABLE IF NOT EXISTS cc_items (
      id TEXT PRIMARY KEY,
      cc_set_id TEXT,
      category_id TEXT,
      file_name TEXT,
      display_name TEXT,
      download_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cc_set_id) REFERENCES cc_sets (id),
      FOREIGN KEY (category_id) REFERENCES categories (id),
      UNIQUE(cc_set_id, file_name)
    );
  `);

    // Seed default categories
    const categories = ['Furniture', 'Build Mode', 'CAS', 'Script Mods', 'Landscaping'];
    const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)');

    categories.forEach(cat => {
        insertCategory.run(randomUUID(), cat);
    });

    console.log('Database initialized at:', dbPath);
}

export default db;
