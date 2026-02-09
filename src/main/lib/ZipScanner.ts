import yauzl from 'yauzl';
import { randomUUID } from 'crypto';
import { getDb, getRawDb, saveDatabase } from '../db/database.js';
import { creators, ccSets, ccItems } from '../db/schema.js';
import { getSimilarity } from './levenshtein.js';
import { eq, sql } from 'drizzle-orm';

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
    static scanZip(filePath: string): Promise<ScanAnalysis> {
        return new Promise((resolve, reject) => {
            const results: ScanResult[] = [];
            const uniqueCreators = new Set<string>();

            yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
                if (err) return reject(err);
                if (!zipfile) return reject(new Error('Failed to open zip file'));

                zipfile.readEntry();

                zipfile.on('entry', (entry) => {
                    if (/\/$/.test(entry.fileName) || !entry.fileName.endsWith('.package')) {
                        // Directory or not a .package file, skip
                        zipfile.readEntry();
                        return;
                    }

                    const pathParts = entry.fileName.split('/');
                    let creatorName = 'Unknown';
                    let setName = 'General';
                    const fileName = pathParts[pathParts.length - 1];

                    if (pathParts.length >= 2) {
                        creatorName = pathParts[0] === 'Mods' ? (pathParts[1] || 'Unknown') : pathParts[0];

                        if (pathParts.length >= 3 && pathParts[0] === 'Mods') {
                            setName = pathParts[2];
                        } else if (pathParts.length >= 2 && pathParts[0] !== 'Mods') {
                            setName = pathParts[1].endsWith('.package') ? 'General' : pathParts[1];
                        }
                    }

                    results.push({ creatorName, setName, fileName });
                    uniqueCreators.add(creatorName);

                    // Read next entry
                    zipfile.readEntry();
                });

                zipfile.on('end', () => {
                    // Fuzzy Matching Logic (Moved inside the promise resolution)
                    const db = getDb();
                    const existingCreators = db.select({ id: creators.id, name: creators.name }).from(creators).all();
                    const matches: CreatorMatch[] = [];

                    uniqueCreators.forEach((creatorName) => {
                        if (creatorName === 'Unknown') return;

                        const exactMatch = existingCreators.find((c) => c.name.toLowerCase() === creatorName.toLowerCase());
                        if (exactMatch) {
                            matches.push({
                                foundName: creatorName,
                                existingName: exactMatch.name,
                                existingId: exactMatch.id,
                                similarity: 1,
                                needsConfirmation: false,
                            });
                            return;
                        }

                        // Find potential fuzzy matches
                        let bestMatch: { id: string; name: string; score: number } | null = null;
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
                                needsConfirmation: true,
                            });
                        } else {
                            matches.push({
                                foundName: creatorName,
                                similarity: 0,
                                needsConfirmation: true, // New creator
                            });
                        }
                    });

                    resolve({ results, matches });
                });

                zipfile.on('error', (err) => {
                    reject(err);
                });
            });
        });
    }

    static async processScanResults(results: ScanResult[], confirmedMatches: CreatorMatch[]) {
        const db = getDb();
        const rawDb = getRawDb();
        const creatorMap = new Map<string, string>();

        // Map each creator name from the scan to a database creator ID
        for (const match of confirmedMatches) {
            if (match.existingId) {
                // If the user chose an existing creator, map the found name to the existing ID
                creatorMap.set(match.foundName, match.existingId);
            } else {
                // Insert new creator
                const newId = randomUUID();
                // Check if creator already exists by name before inserting (race condition safety)
                const existing = db.select({ id: creators.id }).from(creators).where(eq(creators.name, match.foundName)).get();

                if (existing) {
                    creatorMap.set(match.foundName, existing.id);
                } else {
                    db.insert(creators)
                        .values({
                            id: newId,
                            name: match.foundName,
                        })
                        .onConflictDoUpdate({
                            target: creators.name,
                            set: { updatedAt: sql`CURRENT_TIMESTAMP` },
                        })
                        .run();
                    creatorMap.set(match.foundName, newId);
                }
            }
        }

        // Process each item
        const processedSets = new Set<string>();

        // Use a transaction for better performance if possible, but Drizzle SQLite sync driver handles direct queries fine for now.
        // We will batch operations logically to avoid too many small queries if needed, but current approach is fine for SQLite local.

        for (const item of results) {
            let creatorId = creatorMap.get(item.creatorName);

            if (!creatorId) {
                // Fallback for creators that weren't in the matches list (e.g. Unknown or strict matches missed)
                // Try to find or creating on the fly
                const existing = db.select({ id: creators.id }).from(creators).where(eq(creators.name, item.creatorName)).get();
                if (existing) {
                    creatorId = existing.id;
                } else {
                    const newId = randomUUID();
                    db.insert(creators).values({ id: newId, name: item.creatorName }).onConflictDoNothing().run();
                    creatorId = newId;
                }
                creatorMap.set(item.creatorName, creatorId);
            }

            // Insert Set
            // Composite key logical check to avoid spamming DB
            const setKey = `${creatorId}-${item.setName}`;
            let setId: string | undefined;

            // Optimization: In a real large import, we would cache sets too. 
            // For now, let's just do the insert.

            // Try to find set
            let setResult = db
                .select({ id: ccSets.id })
                .from(ccSets)
                .where(sql`${ccSets.creatorId} = ${creatorId} AND ${ccSets.name} = ${item.setName}`)
                .get();

            if (!setResult) {
                const newSetId = randomUUID();
                db.insert(ccSets)
                    .values({
                        id: newSetId,
                        creatorId: creatorId,
                        name: item.setName,
                    })
                    .onConflictDoNothing()
                    .run();
                setResult = { id: newSetId };
            }

            // Insert Item
            db.insert(ccItems)
                .values({
                    id: randomUUID(),
                    ccSetId: setResult.id,
                    fileName: item.fileName,
                })
                .onConflictDoUpdate({
                    target: [ccItems.ccSetId, ccItems.fileName],
                    set: { updatedAt: sql`CURRENT_TIMESTAMP` },
                })
                .run();
        }

        // Save database to disk after all mutations
        saveDatabase();
    }
}
