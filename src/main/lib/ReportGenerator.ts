import { getDb } from '../db/database';
import { creators, ccSets, ccItems, categories } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';

interface ReportOptions {
    includeCreators: boolean;
    includeSets: boolean;
    includeItems: boolean;
    includeCategory: boolean;
    filterFileNames?: string[];
}

export class ReportGenerator {
    static generateMarkdown(options: ReportOptions = {
        includeCreators: true,
        includeSets: true,
        includeItems: true,
        includeCategory: true
    }): string {
        const db = getDb();
        let report = options.filterFileNames ? '# CC Catalog Scan Report\n\n' : '# CC Catalog Report\n\n';

        // 1. Filter Logic
        let targetCreatorIds: string[] | null = null;
        let targetSetIds: string[] | null = null;
        let targetItemNames: Set<string> | null = null;

        if (options.filterFileNames && options.filterFileNames.length > 0) {
            // Find items matching the filenames
            // SQLite limit for IN clause is usually high
            const foundItems = db.select().from(ccItems).where(inArray(ccItems.fileName, options.filterFileNames)).all();

            if (foundItems.length === 0) {
                return '# CC Catalog Scan Report\n\n_No matching items found in library for this scan._';
            }

            targetSetIds = [...new Set(foundItems.map(i => i.ccSetId).filter(id => id !== null) as string[])];
            targetItemNames = new Set(options.filterFileNames);

            // Get sets to find creators
            if (targetSetIds.length > 0) {
                const foundSets = db.select().from(ccSets).where(inArray(ccSets.id, targetSetIds)).all();
                targetCreatorIds = [...new Set(foundSets.map(s => s.creatorId))];
            } else {
                targetCreatorIds = [];
            }
        }

        // 2. Fetch Creators
        let allCreators = db.select().from(creators).all();
        if (targetCreatorIds !== null) {
            allCreators = allCreators.filter(c => targetCreatorIds!.includes(c.id));
        }

        // Sort by name
        allCreators.sort((a, b) => a.name.localeCompare(b.name));

        allCreators.forEach((creator) => {
            if (options.includeCreators) {
                let creatorName = creator.name;
                if (creator.patreonUrl) creatorName = `[${creatorName}](${creator.patreonUrl})`;
                else if (creator.websiteUrl) creatorName = `[${creatorName}](${creator.websiteUrl})`;
                report += `## ${creatorName}\n\n`;
            }

            if (options.includeSets) {
                let sets = db.select().from(ccSets).where(eq(ccSets.creatorId, creator.id)).all();
                if (targetSetIds !== null) {
                    sets = sets.filter(s => targetSetIds!.includes(s.id));
                }
                sets.sort((a, b) => a.name.localeCompare(b.name));

                if (sets.length === 0 && options.includeCreators) {
                    report += `_No sets found._\n\n`;
                }

                sets.forEach((set) => {
                    let setName = set.name;
                    if (set.patreonUrl) setName = `[${setName}](${set.patreonUrl})`;
                    else if (set.websiteUrl) setName = `[${setName}](${set.websiteUrl})`;

                    const prefix = options.includeCreators ? '###' : '##';
                    report += `${prefix} ${setName}\n`;

                    if (options.includeItems) {
                        let items = db.select().from(ccItems).where(eq(ccItems.ccSetId, set.id)).all();
                        if (targetItemNames !== null) {
                            items = items.filter(i => targetItemNames!.has(i.fileName));
                        }
                        items.sort((a, b) => a.fileName.localeCompare(b.fileName));

                        if (items.length > 0) report += `\n`;

                        items.forEach(item => {
                            let itemStr = `- ${item.fileName}`;
                            if (options.includeCategory && item.categoryId) {
                                const cat = db.select().from(categories).where(eq(categories.id, item.categoryId)).get();
                                if (cat) {
                                    itemStr += ` _(${cat.name})_`;
                                }
                            }
                            report += `${itemStr}\n`;
                        });
                        report += `\n`;
                    } else {
                        report += `\n`;
                    }
                });
            }

            if (options.includeCreators) report += '---\n\n';
        });

        if (report === '# CC Catalog Report\n\n' || report === '# CC Catalog Scan Report\n\n') {
            return report + '_No data available._';
        }

        return report.trim();
    }
}
