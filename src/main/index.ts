import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { initDatabase } from './db/database';
import { ZipScanner } from './lib/ZipScanner';
import { ReportGenerator } from './lib/ReportGenerator';

// Initialize DB before window creation
initDatabase();

ipcMain.handle('generate-report', async () => {
    return ReportGenerator.generateMarkdown();
});

ipcMain.handle('scan-zip', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
    });

    if (canceled || filePaths.length === 0) return null;

    try {
        const results = ZipScanner.scanZip(filePaths[0]);
        await ZipScanner.processScanResults(results);
        return results;
    } catch (error) {
        console.error('Scan failed:', error);
        throw error;
    }
});

ipcMain.handle('get-credits', async () => {
    // Basic query to get grouped credits for the UI
    const db = (await import('./db/database')).default;
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

function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 800,
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

app.whenReady().then(createWindow);

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
