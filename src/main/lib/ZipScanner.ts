import AdmZip from 'adm-zip';
import { randomUUID } from 'crypto';
import db from '../db/database';

export interface ScanResult {
    creatorName: string;
    setName: string;
    fileName: string;
}

export class ZipScanner {
    static scanZip(filePath: string): ScanResult[] {
        const zip = new AdmZip(filePath);
        const zipEntries = zip.getEntries();
        const results: ScanResult[] = [];

        zipEntries.forEach((entry) => {
            if (entry.isDirectory || !entry.entryName.endsWith('.package')) return;

            // Logic: Mods/Creator/SetName/Item.package or Creator/Item.package
            const pathParts = entry.entryName.split('/');
            let creatorName = 'Unknown';
            let setName = 'General';
            const fileName = pathParts[pathParts.length - 1];

            if (pathParts.length >= 2) {
                // If it's something like "Felixandre/Chateau/item.package"
                // or just "Felixandre/item.package"
                creatorName = pathParts[0] === 'Mods' ? pathParts[1] : pathParts[0];

                if (pathParts.length >= 3 && pathParts[0] === 'Mods') {
                    setName = pathParts[2];
                } else if (pathParts.length >= 2 && pathParts[0] !== 'Mods') {
                    setName = pathParts[1].endsWith('.package') ? 'General' : pathParts[1];
                }
            }

            results.push({ creatorName, setName, fileName });
        });

        return results;
    }

    static async processScanResults(results: ScanResult[]) {
        const upsertCreator = db.prepare(`
      INSERT INTO creators (id, name)
      VALUES (?, ?)
      ON CONFLICT(name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `);

        const upsertSet = db.prepare(`
      INSERT INTO cc_sets (id, creator_id, name)
      VALUES (?, ?, ?)
      ON CONFLICT(creator_id, name) DO NOTHING
    `);

        const getSetId = db.prepare(`
      SELECT id FROM cc_sets WHERE creator_id = ? AND name = ?
    `);

        const upsertItem = db.prepare(`
      INSERT INTO cc_items (id, cc_set_id, file_name)
      VALUES (?, ?, ?)
      ON CONFLICT(cc_set_id, file_name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
    `);

        // We should use a transaction for performance
        const transaction = db.transaction((scanData: ScanResult[]) => {
            for (const item of scanData) {
                // 1. Creator
                const creator = upsertCreator.get(randomUUID(), item.creatorName) as { id: string };
                const creatorId = creator.id;

                // 2. Set
                upsertSet.run(randomUUID(), creatorId, item.setName);
                const set = getSetId.get(creatorId, item.setName) as { id: string };
                const setId = set.id;

                // 3. Item
                upsertItem.run(randomUUID(), setId, item.fileName);
            }
        });

        transaction(results);
    }
}
