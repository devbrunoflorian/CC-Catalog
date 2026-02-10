import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Categories table - stores CC categories like Furniture, Build Mode, CAS, etc.
 */
export const categories = sqliteTable('categories', {
    id: text('id').primaryKey(),
    name: text('name').unique().notNull(),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Creators table - stores CC creator information
 */
export const creators = sqliteTable('creators', {
    id: text('id').primaryKey(),
    name: text('name').unique().notNull(),
    patreonUrl: text('patreon_url'),
    websiteUrl: text('website_url'),
    socialLinks: text('social_links'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

/**
 * CC Sets table - stores collections/sets of custom content from creators
 */
export const ccSets = sqliteTable('cc_sets', {
    id: text('id').primaryKey(),
    creatorId: text('creator_id')
        .notNull()
        .references(() => creators.id),
    name: text('name').notNull(),
    patreonUrl: text('patreon_url'),
    websiteUrl: text('website_url'),
    releaseDate: text('release_date'),
    sortOrder: integer('sort_order').default(0),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

/**
 * Scan History table - stores logs of previous scans
 */
export const scanHistory = sqliteTable('scan_history', {
    id: text('id').primaryKey(),
    scanDate: text('scan_date').default(sql`CURRENT_TIMESTAMP`),
    fileName: text('file_name').notNull(),
    itemsFound: integer('items_found').default(0),
    creatorsFound: integer('creators_found').default(0),
    status: text('status').default('success'),
    scannedFiles: text('scanned_files'), // JSON string of file names
});

/**
 * CC Items table - stores individual custom content files
 */
export const ccItems = sqliteTable('cc_items', {
    id: text('id').primaryKey(),
    ccSetId: text('cc_set_id')
        .notNull()
        .references(() => ccSets.id),
    categoryId: text('category_id').references(() => categories.id),
    fileName: text('file_name').notNull(),
    displayName: text('display_name'),
    downloadUrl: text('download_url'),
    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Type exports for use in application code
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Creator = typeof creators.$inferSelect;
export type NewCreator = typeof creators.$inferInsert;

export type CcSet = typeof ccSets.$inferSelect;
export type NewCcSet = typeof ccSets.$inferInsert;

export type CcItem = typeof ccItems.$inferSelect;
export type NewCcItem = typeof ccItems.$inferInsert;
