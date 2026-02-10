// Catch uncaught exceptions before they kill the process
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION:', reason);
});

console.log('[MAIN] starting app');

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, getDb, saveDatabase } from './db/database.js';
import { ZipScanner } from './lib/ZipScanner.js';
import { ReportGenerator } from './lib/ReportGenerator.js';
import { creators, ccSets, ccItems, scanHistory } from './db/schema.js';
import { eq, sql, desc, asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// ES module __dirname polyfill (required for "type": "module" in package.json)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let dbInitialized = false;



ipcMain.handle('get-history', async () => {
    if (!dbInitialized) throw new Error('Database not initialized');
    const db = getDb();
    return db.select().from(scanHistory).orderBy(desc(scanHistory.scanDate)).all();
});

ipcMain.handle('get-creators-list', async () => {
    if (!dbInitialized) throw new Error('Database not initialized');
    const db = getDb();

    // Get creators with their sets count
    const allCreators = db.select().from(creators).all();
    const result = [];

    for (const creator of allCreators) {
        const sets = db.select().from(ccSets).where(eq(ccSets.creatorId, creator.id)).all();
        result.push({
            ...creator,
            sets: sets.map(set => ({
                ...set,
                itemsCount: db.select({ count: sql`count(*)` }).from(ccItems).where(eq(ccItems.ccSetId, set.id)).get()?.count || 0
            }))
        });
    }

    return result;
});

ipcMain.handle('get-creator-details', async (_, id) => {
    if (!dbInitialized) throw new Error('Database not initialized');
    const db = getDb();

    const creator = db.select().from(creators).where(eq(creators.id, id)).get();
    if (!creator) return null;

    const sets = db.select()
        .from(ccSets)
        .where(eq(ccSets.creatorId, id))
        .orderBy(asc(ccSets.sortOrder), desc(ccSets.createdAt)) // Sort manually ordered first, then newest
        .all();

    // Get all items for these sets
    const setsWithItems = sets.map(set => {
        const items = db.select().from(ccItems).where(eq(ccItems.ccSetId, set.id)).all();
        return { ...set, items };
    });

    return { ...creator, sets: setsWithItems };
});

ipcMain.handle('create-set', async (_, { creatorId, name }) => {
    if (!dbInitialized) throw new Error('Database not initialized');
    const db = getDb();
    const newId = randomUUID();

    db.insert(ccSets).values({
        id: newId,
        creatorId,
        name,
        updatedAt: sql`CURRENT_TIMESTAMP`
    }).run();

    saveDatabase();
    return { id: newId, name, items: [] };
});

ipcMain.handle('delete-set', async (_, id) => {
    if (!dbInitialized) throw new Error('Database not initialized');
    const db = getDb();

    // Check if empty
    const result = db.select({ count: sql<number>`count(*)` }).from(ccItems).where(eq(ccItems.ccSetId, id)).get();
    const itemsCount = result ? Number(result.count) : 0;

    if (itemsCount > 0) {
        throw new Error('Cannot delete non-empty set. Move items first.');
    }

    db.delete(ccSets).where(eq(ccSets.id, id)).run();
    saveDatabase();
    return { success: true };
});

ipcMain.handle('move-items', async (_, { itemIds, targetSetId }) => {
    if (!dbInitialized) throw new Error('Database not initialized');
    const db = getDb();

    // Update all items
    for (const itemId of itemIds) {
        db.update(ccItems)
            .set({
                ccSetId: targetSetId,
                updatedAt: sql`CURRENT_TIMESTAMP`
            })
            .where(eq(ccItems.id, itemId))
            .run();
    }

    saveDatabase();
    return { success: true };
});

ipcMain.handle('update-set-link', async (_, { id, name, patreon_url, website_url }: any) => {
    if (!dbInitialized) throw new Error('Database not initialized');
    const db = getDb();

    const updateData: any = {
        updatedAt: sql`CURRENT_TIMESTAMP`,
    };

    if (name !== undefined) updateData.name = name;
    if (patreon_url !== undefined) updateData.patreonUrl = patreon_url;
    if (website_url !== undefined) updateData.websiteUrl = website_url;

    db.update(ccSets)
        .set(updateData)
        .where(eq(ccSets.id, id))
        .run();

    saveDatabase();
    return { success: true };
});

ipcMain.handle('update-creator', async (_, { id, patreon_url, website_url }: any) => {
    if (!dbInitialized) throw new Error('Database not initialized');
    const db = getDb();

    const updateData: any = {
        updatedAt: sql`CURRENT_TIMESTAMP`,
    };

    if (patreon_url !== undefined) updateData.patreonUrl = patreon_url;
    if (website_url !== undefined) updateData.websiteUrl = website_url;

    db.update(creators)
        .set(updateData)
        .where(eq(creators.id, id))
        .run();

    saveDatabase();
    return { success: true };
});



ipcMain.handle('scan-zip', async () => {
    if (!dbInitialized) throw new Error('Database not initialized');
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'ZIP Files', extensions: ['zip'] }],
    });

    if (canceled || filePaths.length === 0) return null;

    try {
        const analysis = await ZipScanner.scanZip(filePaths[0]);
        // Return file path too so we can log it later
        return { ...analysis, filePath: filePaths[0] };
    } catch (error) {
        console.error('Scan failed:', error);
        throw error;
    }
});

ipcMain.handle('confirm-scan', async (_, { results, matches, filePath }: any) => {
    if (!dbInitialized) throw new Error('Database not initialized');

    // Process results
    await ZipScanner.processScanResults(results, matches);

    // Log directly to DB here or pass filePath if needed
    // Let's extract filename from path if passed, or just "Unknown"
    const fileName = filePath ? basename(filePath, extname(filePath)) : "Unknown Scan";

    const db = getDb();
    db.insert(scanHistory).values({
        id: randomUUID(),
        fileName: fileName,
        itemsFound: results.length,
        creatorsFound: matches.filter((m: any) => m.similarity === 0 && !m.existingId).length, // New creators aprox.
        status: 'success',
        scannedFiles: JSON.stringify(results.map((r: any) => r.fileName))
    }).run();

    saveDatabase();
    return { success: true };
});


ipcMain.handle('export-csv', async () => {
    if (!dbInitialized) throw new Error('Database not initialized');
    const { canceled, filePath } = await dialog.showSaveDialog({
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
        defaultPath: 'cc-library.csv'
    });

    if (canceled || !filePath) return { success: false };

    const db = getDb();
    const allSets = db.select().from(ccSets).all();

    // Header
    let csvContent = "Creator Name,Creator Patreon,Creator Website,Set Name,Set Patreon,Set Website,Items (Pipe Separated)\n";

    for (const set of allSets) {
        const creator = db.select().from(creators).where(eq(creators.id, set.creatorId)).get();
        if (!creator) continue;

        const items = db.select().from(ccItems).where(eq(ccItems.ccSetId, set.id)).all();
        const itemsStr = items.map(i => i.fileName).join('|');

        // Helper to escape CSV fields
        const esc = (t: string | null | undefined) => {
            if (!t) return "";
            if (t.includes(',') || t.includes('"') || t.includes('\n')) {
                return `"${t.replace(/"/g, '""')}"`;
            }
            return t;
        };

        const line = [
            esc(creator.name),
            esc(creator.patreonUrl),
            esc(creator.websiteUrl),
            esc(set.name),
            esc(set.patreonUrl),
            esc(set.websiteUrl),
            esc(itemsStr)
        ].join(',');

        csvContent += line + "\n";
    }

    const fs = await import('fs/promises');
    await fs.writeFile(filePath, csvContent, 'utf-8');
    return { success: true };
});

ipcMain.handle('import-csv', async () => {
    if (!dbInitialized) throw new Error('Database not initialized');
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });

    if (canceled || filePaths.length === 0) return { success: false };

    const fs = await import('fs/promises');
    const content = await fs.readFile(filePaths[0], 'utf-8');
    const lines = content.split(/\r?\n/);

    const db = getDb();
    let updatedCount = 0;

    // Simple CSV parser helper
    const parseLine = (line: string) => {
        const res = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                res.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        res.push(current);
        return res;
    };

    // Skip header
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = parseLine(line);
        if (cols.length < 7) continue;

        const [cName, cPat, cWeb, sName, sPat, sWeb, itemsStr] = cols;

        if (!cName || !sName) continue;

        // 1. Process Creator
        let creatorId: string;
        let creator = db.select().from(creators).where(eq(creators.name, cName)).get();

        if (!creator) {
            creatorId = randomUUID();
            db.insert(creators).values({
                id: creatorId,
                name: cName,
                patreonUrl: cPat || null,
                websiteUrl: cWeb || null,
                updatedAt: sql`CURRENT_TIMESTAMP`
            }).run();
        } else {
            creatorId = creator.id;
            // Update links if provided and different
            if (cPat || cWeb) {
                db.update(creators).set({
                    patreonUrl: cPat || creator.patreonUrl,
                    websiteUrl: cWeb || creator.websiteUrl,
                    updatedAt: sql`CURRENT_TIMESTAMP`
                }).where(eq(creators.id, creatorId)).run();
            }
        }

        // 2. Process Set
        let setId: string;
        let set = db.select().from(ccSets).where(
            sql`${ccSets.creatorId} = ${creatorId} AND ${ccSets.name} = ${sName}`
        ).get();

        if (!set) {
            setId = randomUUID();
            db.insert(ccSets).values({
                id: setId,
                creatorId: creatorId,
                name: sName,
                patreonUrl: sPat || null,
                websiteUrl: sWeb || null,
                updatedAt: sql`CURRENT_TIMESTAMP`
            }).run();
        } else {
            setId = set.id;
            if (sPat || sWeb) {
                db.update(ccSets).set({
                    patreonUrl: sPat || set.patreonUrl,
                    websiteUrl: sWeb || set.websiteUrl,
                    updatedAt: sql`CURRENT_TIMESTAMP`
                }).where(eq(ccSets.id, setId)).run();
            }
        }

        // 3. Process Items
        if (itemsStr) {
            const fileNames = itemsStr.split('|');
            for (const fName of fileNames) {
                const cleanName = fName.trim();
                if (!cleanName) continue;

                // Find item by name - if duplicate names exist, this might pick any, 
                // but usually filenames are unique per scan context. 
                // We'll update ALL items with this filename to be safe/thorough? 
                // Or just the one not in a set? Assuming unique filenames for now.
                db.update(ccItems)
                    .set({ ccSetId: setId, updatedAt: sql`CURRENT_TIMESTAMP` })
                    .where(eq(ccItems.fileName, cleanName))
                    .run();
            }
        }
        updatedCount++;
    }

    saveDatabase();
    return { success: true, count: updatedCount };
});
// End of CSV handlers

ipcMain.handle('get-credits', async () => {
    if (!dbInitialized) throw new Error('Database not initialized');
    const db = getDb();
    const allCreators = db.select().from(creators).all();

    return allCreators.map((creator) => {
        const sets = db.select().from(ccSets).where(eq(ccSets.creatorId, creator.id)).all();
        return {
            ...creator,
            // Convert snake_case to camelCase for frontend compatibility
            patreon_url: creator.patreonUrl,
            website_url: creator.websiteUrl,
            social_links: creator.socialLinks,
            is_active: creator.isActive,
            created_at: creator.createdAt,
            updated_at: creator.updatedAt,
            sets: sets.map((set) => ({
                ...set,
                creator_id: set.creatorId,
                release_date: set.releaseDate,
                created_at: set.createdAt,
                updated_at: set.updatedAt,
                items: db.select().from(ccItems).where(eq(ccItems.ccSetId, set.id)).all().map((item) => ({
                    ...item,
                    cc_set_id: item.ccSetId,
                    category_id: item.categoryId,
                    file_name: item.fileName,
                    display_name: item.displayName,
                    download_url: item.downloadUrl,
                    created_at: item.createdAt,
                    updated_at: item.updatedAt,
                })),
            })),
        };
    });
});

process.env.DIST = join(__dirname, '../..');
process.env.VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'] || '';

let win: BrowserWindow | null = null;
let splashWin: BrowserWindow | null = null;

function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false, // Start hidden
        webPreferences: {
            preload: join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        title: 'CC Catalog',
        backgroundColor: '#00000000', // Fully transparent for acrylic to show through
        backgroundMaterial: 'acrylic',
        transparent: false, // Standard frame + acrylic usually requires transparent: false on Windows to avoid artifacts/crashes
    });

    console.log('[MAIN] VITE_DEV_SERVER_URL:', process.env.VITE_DEV_SERVER_URL);

    if (process.env.VITE_DEV_SERVER_URL) {
        console.log('[MAIN] Loading URL:', process.env.VITE_DEV_SERVER_URL);
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        const htmlPath = join(process.env.DIST!, 'renderer/index.html');
        console.log('[MAIN] Loading file:', htmlPath);
        win.loadFile(htmlPath);
    }

    // Show window when ready and close splash
    win.once('ready-to-show', () => {
        console.log('[MAIN] window ready to show');
        win?.show();
        if (splashWin && !splashWin.isDestroyed()) {
            splashWin.close();
        }
    });
}

function createSplashWindow() {
    splashWin = new BrowserWindow({
        width: 500,
        height: 500,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        webPreferences: {
            preload: join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    if (process.env.VITE_DEV_SERVER_URL) {
        splashWin.loadURL(`${process.env.VITE_DEV_SERVER_URL}splash.html`);
    } else {
        // In production, public files are copied to dist which is accessed as renderer
        splashWin.loadFile(join(process.env.DIST!, 'renderer/splash.html'));
    }

    splashWin.on('closed', () => (splashWin = null));
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        // Someone tried to run a second instance, we should focus our window.
        if (win) {
            if (win.isMinimized()) win.restore();
            win.focus();
        }
    });

    app.whenReady().then(async () => {
        console.log('[MAIN] app ready');

        try {
            console.log('[MAIN] initDatabase start');
            await initDatabase();

            // Basic Migration for scanned_files column
            try {
                const db = getDb();
                // Check if column exists, if not adds it.
                // SQLite doesn't support IF NOT EXISTS in ADD COLUMN well in all versions, 
                // but checking schema pragma or just try/catch is common lazy migration
                db.run(sql`ALTER TABLE scan_history ADD COLUMN scanned_files TEXT`);
            } catch (e) {
                // Column likely exists
            }

            try {
                const db = getDb();
                db.run(sql`ALTER TABLE cc_sets ADD COLUMN sort_order INTEGER DEFAULT 0`);
            } catch (e) {
                // Column likely exists
            }

            console.log('[MAIN] initDatabase OK');
            dbInitialized = true;
        } catch (err) {
            console.error('[MAIN] initDatabase FAILED', err);
            process.exit(1);
        }

        createSplashWindow();
        createWindow();
    });
}

ipcMain.handle('delete-history-item', async (_, id) => {
    if (!dbInitialized) throw new Error('Database not initialized');
    const db = getDb();
    db.delete(scanHistory).where(eq(scanHistory.id, id)).run();
    saveDatabase();
    return true;
});

ipcMain.handle('merge-sets', async (_, { sourceSetId, targetSetId }) => {
    if (!dbInitialized) throw new Error('Database not initialized');
    const db = getDb();

    // Check if target exists
    const target = db.select().from(ccSets).where(eq(ccSets.id, targetSetId)).get();
    if (!target) throw new Error('Target set not found');

    // Move items to target set
    db.update(ccItems)
        .set({ ccSetId: targetSetId, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(ccItems.ccSetId, sourceSetId))
        .run();

    // Delete source set
    db.delete(ccSets)
        .where(eq(ccSets.id, sourceSetId))
        .run();

    saveDatabase();
    return { success: true };
});

ipcMain.handle('reorder-sets', async (_, { setsOrder }) => {
    // setsOrder: Array<{ id: string, sortOrder: number }>
    if (!dbInitialized) throw new Error('Database not initialized');
    const db = getDb();

    for (const item of setsOrder) {
        db.update(ccSets)
            .set({ sortOrder: item.sortOrder })
            .where(eq(ccSets.id, item.id))
            .run();
    }

    saveDatabase();
    return { success: true };
});

ipcMain.handle('generate-report', async (_, options) => {
    if (!dbInitialized) throw new Error('Database not initialized');
    return ReportGenerator.generateMarkdown(options);
});

ipcMain.on('splash-finished', () => {
    if (splashWin) {
        splashWin.close();
    }
    if (win) {
        win.show();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
