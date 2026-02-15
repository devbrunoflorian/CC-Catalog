import yauzl from 'yauzl';
import { randomUUID } from 'crypto';
import { getDb, getRawDb, saveDatabase } from '../db/database.js';
import { creators, ccSets, ccItems } from '../db/schema.js';
import { getSimilarity } from './levenshtein.js';
import { eq, sql } from 'drizzle-orm';

export interface ScanResult {
    creatorName: string;
    setHierarchy: string[]; // ["RootSet", "SubSet", "LeafSet"]
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

            console.log(`[Scan] Scanning: ${filePath}`);

            yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
                if (err) return reject(err);
                if (!zipfile) return reject(new Error('Failed to open zip file'));

                zipfile.readEntry();

                const zipFileName = filePath.split(/[\\/]/).pop() || '';
                const zipBaseName = zipFileName.replace(/\.zip$/i, '');

                const zipParts = zipBaseName.split(/[-_ ]/);
                const zipCreatorHint = zipParts[0];

                zipfile.on('entry', (entry) => {
                    if (/\/$/.test(entry.fileName) || !entry.fileName.endsWith('.package')) {
                        zipfile.readEntry();
                        return;
                    }

                    const pathParts = entry.fileName.split('/');
                    let creatorName = 'Unknown';
                    let setHierarchy: string[] = [];
                    const fileName = pathParts[pathParts.length - 1];

                    // Heuristic: First folder is creator, subsequent are sets
                    if (pathParts.length >= 2) {
                        if (pathParts[0] === 'Mods') {
                            // Structure: Mods/Creator/Set... or Mods/Item.package
                            if (pathParts.length > 2) {
                                creatorName = pathParts[1];
                                // Sets are from index 2 to end-1
                                setHierarchy = pathParts.slice(2, pathParts.length - 1);
                            } else {
                                // Mods/Item.package -> Unknown creator? Or maybe "Mods" is the creator? 
                                // Actually usually Mods bucket is generic. Let's try zip hint.
                                creatorName = 'Unknown';
                            }
                        } else {
                            // Structure: Creator/Set/Item... or Creator/Item...
                            creatorName = pathParts[0];
                            setHierarchy = pathParts.slice(1, pathParts.length - 1);
                        }
                    }

                    // Fallback to Zip Hints if Unknown
                    if (creatorName === 'Unknown' || pathParts.length < 2) {
                        if (zipCreatorHint && zipCreatorHint.length > 2) {
                            creatorName = zipCreatorHint;

                            // Check if zip name contains set info
                            if (zipBaseName.toLowerCase().includes(zipCreatorHint.toLowerCase())) {
                                const potentialSet = zipBaseName.replace(new RegExp(zipCreatorHint, 'i'), '').trim();
                                const cleanSet = potentialSet.replace(/^[-_ ]+/, '');
                                if (cleanSet) {
                                    // If we rely on zip name for set, it's a root set
                                    setHierarchy = [cleanSet];

                                    // But if we have subfolders in the zip (even without creator folder), append them?
                                    // Example: Zip "Artsy - LivingRoom.zip" contains "Chairs/Chair.package"
                                    // Creator: Artsy, RootSet: LivingRoom.
                                    // Should it be LivingRoom/Chairs? Yes.
                                    const internalDirs = pathParts.slice(0, pathParts.length - 1);
                                    if (internalDirs.length > 0 && internalDirs[0] !== 'Mods') {
                                        setHierarchy.push(...internalDirs);
                                    }
                                } else {
                                    // Zip is just "Creator.zip"? Then internal dirs are sets.
                                    const internalDirs = pathParts.slice(0, pathParts.length - 1);
                                    if (internalDirs.length > 0) {
                                        setHierarchy = internalDirs;
                                    } else {
                                        setHierarchy = ['General'];
                                    }
                                }
                            }
                        }
                    }

                    // Final cleanup
                    if (setHierarchy.length === 0) setHierarchy = ['Unsorted'];

                    // Filter out "Mods" if it snuck in
                    setHierarchy = setHierarchy.filter(s => s !== 'Mods');

                    results.push({ creatorName, setHierarchy, fileName });
                    uniqueCreators.add(creatorName);

                    zipfile.readEntry();
                });

                zipfile.on('end', () => {
                    const db = getDb();
                    const existingCreators = db.select({ id: creators.id, name: creators.name }).from(creators).all();
                    const matches: CreatorMatch[] = [];

                    uniqueCreators.forEach((creatorName) => {
                        if (creatorName === 'Unknown') return;

                        const nameLower = creatorName.toLowerCase();
                        const exactMatch = existingCreators.find((c) => c.name.toLowerCase() === nameLower);

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

                        let bestMatch: { id: string; name: string; score: number } | null = null;

                        for (const existing of existingCreators) {
                            const existingLower = existing.name.toLowerCase();
                            let score = getSimilarity(creatorName, existing.name);

                            if (nameLower.includes(existingLower) || existingLower.includes(nameLower)) {
                                score = Math.max(score, 0.9);
                            }

                            if (nameLower.startsWith(existingLower) || existingLower.startsWith(nameLower)) {
                                score = Math.max(score, 0.95);
                            }

                            if (score > 0.6 && (!bestMatch || score > bestMatch.score)) {
                                bestMatch = { ...existing, score };
                            }
                        }

                        if (bestMatch && bestMatch.score > 0.6) {
                            matches.push({
                                foundName: creatorName,
                                existingName: bestMatch.name,
                                existingId: bestMatch.id,
                                similarity: bestMatch.score,
                                needsConfirmation: bestMatch.score < 0.95,
                            });
                        } else {
                            matches.push({
                                foundName: creatorName,
                                similarity: 0,
                                needsConfirmation: true,
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
        const creatorMap = new Map<string, string>();

        // 1. Resolve Creators
        for (const match of confirmedMatches) {
            if (match.existingId) {
                creatorMap.set(match.foundName, match.existingId);
            } else {
                const existing = db.select({ id: creators.id }).from(creators).where(eq(creators.name, match.foundName)).get();
                if (existing) {
                    creatorMap.set(match.foundName, existing.id);
                } else {
                    const newId = randomUUID();
                    db.insert(creators).values({ id: newId, name: match.foundName }).run();
                    creatorMap.set(match.foundName, newId);
                }
            }
        }

        // Cache sets to minimize DB hits: creatorId:parentSetId:setName -> setId
        // Using a simple Map key strategy
        const setCache = new Map<string, string>();

        for (const item of results) {
            let creatorId = creatorMap.get(item.creatorName);

            if (!creatorId) {
                // Fallback create
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

            // Resolve Set Hierarchy
            let currentParentId: string | null = null;
            let currentSetId: string | undefined;

            const hierarchy = Array.isArray(item.setHierarchy) ? item.setHierarchy : [];

            for (const setName of hierarchy) {
                const cacheKey: string = `${creatorId}:${currentParentId}:${setName.toLowerCase()}`;

                if (setCache.has(cacheKey)) {
                    currentParentId = setCache.get(cacheKey)!;
                    currentSetId = currentParentId;
                    continue;
                }

                // DB Lookup
                let setQuery = sql`${ccSets.creatorId} = ${creatorId} AND lower(${ccSets.name}) = lower(${setName})`;
                if (currentParentId) {
                    setQuery = sql`${setQuery} AND ${ccSets.parentId} = ${currentParentId}`;
                } else {
                    setQuery = sql`${setQuery} AND (${ccSets.parentId} IS NULL OR ${ccSets.parentId} = '')`;
                }

                let set = db.select({ id: ccSets.id }).from(ccSets).where(setQuery).get();

                if (!set) {
                    const newSetId = randomUUID();
                    db.insert(ccSets).values({
                        id: newSetId,
                        creatorId: creatorId,
                        name: setName,
                        parentId: currentParentId
                    }).run();
                    set = { id: newSetId };
                }

                currentParentId = set.id;
                currentSetId = set.id;
                setCache.set(cacheKey, set.id);
            }

            if (!currentSetId) continue; // Should not happen

            // Insert Item
            const itemExists = db.select({ id: ccItems.id })
                .from(ccItems)
                .where(sql`${ccItems.ccSetId} = ${currentSetId} AND lower(${ccItems.fileName}) = lower(${item.fileName})`)
                .get();

            if (!itemExists) {
                db.insert(ccItems).values({
                    id: randomUUID(),
                    ccSetId: currentSetId,
                    fileName: item.fileName
                }).run();
            }
        }

        saveDatabase();
    }
}
