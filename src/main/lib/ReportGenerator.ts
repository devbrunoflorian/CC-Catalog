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
                let allSets = db.select().from(ccSets).where(eq(ccSets.creatorId, creator.id)).all();
                if (targetSetIds !== null) {
                    allSets = allSets.filter(s => targetSetIds!.includes(s.id));
                }

                const renderSets = (parentId: string | null, level: number) => {
                    const children = allSets.filter(s => s.parentId === parentId);
                    children.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name));

                    children.forEach((set) => {
                        let links: string[] = [];
                        if (set.patreonUrl) links.push(`[Patreon](${set.patreonUrl})`);
                        if (set.websiteUrl) links.push(`[Website](${set.websiteUrl})`);
                        if (set.extraLinks) {
                            try {
                                const extra = JSON.parse(set.extraLinks);
                                if (Array.isArray(extra)) {
                                    extra.forEach((l: any) => {
                                        if (l.url) links.push(`[${l.type || 'Link'}](${l.url})`);
                                    });
                                }
                            } catch { }
                        }

                        let setName = set.name;
                        if (links.length > 0) {
                            setName = `**${setName}** (${links.join(', ')})`;
                        } else {
                            setName = `**${setName}**`;
                        }

                        const indent = '  '.repeat(level);
                        const headerPrefix = level === 0 ? '### ' : '#### '; // Use level to differentiate

                        report += `${headerPrefix} ${setName}\n`;

                        if (options.includeItems) {
                            let items = db.select().from(ccItems).where(eq(ccItems.ccSetId, set.id)).all();
                            if (targetItemNames !== null) {
                                items = items.filter(i => targetItemNames!.has(i.fileName));
                            }
                            items.sort((a, b) => a.fileName.localeCompare(b.fileName));

                            if (items.length > 0) {
                                items.forEach(item => {
                                    report += `- \`${item.fileName}\``;
                                    if (options.includeCategory && item.categoryId) {
                                        const cat = db.select().from(categories).where(eq(categories.id, item.categoryId)).get();
                                        if (cat) report += ` _[${cat.name}]_`;
                                    }
                                    report += `\n`;
                                });
                                report += `\n`;
                            }
                        } else {
                            report += `\n`;
                        }

                        // Recursively render children
                        renderSets(set.id, level + 1);
                    });
                };

                const rootSets = allSets.filter(s => !s.parentId);
                if (allSets.length > 0 && rootSets.length === 0 && targetSetIds) {
                    // If we filtered and only have children, show them as roots for the report
                    renderSets(null, options.includeCreators ? 1 : 0);
                } else {
                    renderSets(null, options.includeCreators ? 1 : 0);
                }

                if (allSets.length === 0 && options.includeCreators) {
                    report += `_No sets found._\n\n`;
                }
            }

            if (options.includeCreators) report += '---\n\n';
        });

        if (report === '# CC Catalog Report\n\n' || report === '# CC Catalog Scan Report\n\n') {
            return report + '_No data available._';
        }

        return report.trim();
    }
}
