import AdmZip from 'adm-zip';
import { randomUUID } from 'crypto';
import db from '../db/database';
import { getSimilarity } from './levenshtein';

export interface ScanResult {
    creatorName: string;
    setName: string;
    fileName: string;
}

export interface CreatorMatch {
    foundName: string;
    existingName?: string;
    existingId?: string;
    similarity: number;
    needsConfirmation: boolean;
}

export interface ScanAnalysis {
    results: ScanResult[];
    matches: CreatorMatch[];
}

export class ZipScanner {
    static scanZip(filePath: string): ScanAnalysis {
        const zip = new AdmZip(filePath);
        const zipEntries = zip.getEntries();
        const results: ScanResult[] = [];
        const uniqueCreators = new Set<string>();

        zipEntries.forEach((entry) => {
            if (entry.isDirectory || !entry.entryName.endsWith('.package')) return;

            const pathParts = entry.entryName.split('/');
            let creatorName = 'Unknown';
            let setName = 'General';
            const fileName = pathParts[pathParts.length - 1];

            if (pathParts.length >= 2) {
                creatorName = pathParts[0] === 'Mods' ? pathParts[1] : pathParts[0];

                if (pathParts.length >= 3 && pathParts[0] === 'Mods') {
                    setName = pathParts[2];
                } else if (pathParts.length >= 2 && pathParts[0] !== 'Mods') {
                    setName = pathParts[1].endsWith('.package') ? 'General' : pathParts[1];
                }
            }

            results.push({ creatorName, setName, fileName });
            uniqueCreators.add(creatorName);
        });

        // Fuzzy Matching Logic
        const existingCreators = db.prepare('SELECT id, name FROM creators').all() as { id: string, name: string }[];
        const matches: CreatorMatch[] = [];

        uniqueCreators.forEach(creatorName => {
            if (creatorName === 'Unknown') return;

            const exactMatch = existingCreators.find(c => c.name.toLowerCase() === creatorName.toLowerCase());
            if (exactMatch) {
                matches.push({
                    foundName: creatorName,
                    existingName: exactMatch.name,
                    existingId: exactMatch.id,
                    similarity: 1,
                    needsConfirmation: false
                });
                return;
            }

            // Find potential fuzzy matches
            let bestMatch: { id: string, name: string, score: number } | null = null;
            for (const existing of existingCreators) {
                const score = getSimilarity(creatorName, existing.name);
                if (score > 0.7 && (!bestMatch || score > bestMatch.score)) {
                    bestMatch = { ...existing, score };
                }
            }

            if (bestMatch && bestMatch.score > 0.7) {
                matches.push({
                    foundName: creatorName,
                    existingName: bestMatch.name,
                    existingId: bestMatch.id,
                    similarity: bestMatch.score,
                    needsConfirmation: true
                });
            } else {
                matches.push({
                    foundName: creatorName,
                    similarity: 0,
                    needsConfirmation: true // New creator
                });
            }
        });

        return { results, matches };
    }

    static async processScanResults(results: ScanResult[], confirmedMatches: CreatorMatch[]) {
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

        const transaction = db.transaction((data: { results: ScanResult[], matches: CreatorMatch[] }) => {
            const creatorMap = new Map<string, string>();

            // Map each creator name from the scan to a database creator ID
            for (const match of data.matches) {
                if (match.existingId) {
                    creatorMap.set(match.foundName, match.existingId);
                } else {
                    const res = upsertCreator.get(randomUUID(), match.foundName) as { id: string };
                    creatorMap.set(match.foundName, res.id);
                }
            }

            for (const item of data.results) {
                let creatorId = creatorMap.get(item.creatorName);

                if (!creatorId) {
                    // Fallback for creators that weren't in the matches list for some reason
                    const res = upsertCreator.get(randomUUID(), item.creatorName) as { id: string };
                    creatorId = res.id;
                    creatorMap.set(item.creatorName, creatorId);
                }

                upsertSet.run(randomUUID(), creatorId, item.setName);
                const set = getSetId.get(creatorId, item.setName) as { id: string };
                const setId = set.id;

                upsertItem.run(randomUUID(), setId, item.fileName);
            }
        });

        transaction({ results, matches: confirmedMatches });
    }
}

