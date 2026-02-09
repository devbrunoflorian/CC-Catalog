import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import db, { initDatabase } from './db/database.js';
import { ZipScanner } from './lib/ZipScanner.js';
import { ReportGenerator } from './lib/ReportGenerator.js';

// Initialize DB before window creation
initDatabase();

ipcMain.handle('generate-report', async () => {
    return ReportGenerator.generateMarkdown();
});

ipcMain.handle('update-creator', async (_, { id, patreon_url, website_url }: any) => {
    db.prepare('UPDATE creators SET patreon_url = ?, website_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(patreon_url, website_url, id);
    return { success: true };
});

ipcMain.handle('scan-zip', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
    });

    if (canceled || filePaths.length === 0) return null;

    try {
        const analysis = ZipScanner.scanZip(filePaths[0]);
        return analysis;
    } catch (error) {
        console.error('Scan failed:', error);
        throw error;
    }
});

ipcMain.handle('confirm-scan', async (_, { results, matches }: any) => {
    try {
        await ZipScanner.processScanResults(results, matches);
        return { success: true };
    } catch (error) {
        console.error('Confirmation failed:', error);
        throw error;
    }
});


ipcMain.handle('get-credits', async () => {
    // Basic query to get grouped credits for the UI
    const creators = db.prepare('SELECT * FROM creators').all();

    return creators.map((creator: any) => {
        const sets = db.prepare('SELECT * FROM cc_sets WHERE creator_id = ?').all(creator.id);
        return {
            ...creator,
            sets: sets.map((set: any) => ({
                ...set,
                items: db.prepare('SELECT * FROM cc_items WHERE cc_set_id = ?').all(set.id)
            }))
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
        title: 'Sims 4 CC Credit Generator',
        backgroundColor: '#1e1e1e',
    });

    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        win.loadFile(join(process.env.DIST!, 'renderer/index.html'));
    }
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

app.whenReady().then(() => {
    createSplashWindow();
    createWindow();
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
