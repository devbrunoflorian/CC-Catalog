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
        let report = options.filterFileNames ? 'Scan Report\n\n' : 'Library Report\n\n';

        // 1. Filter Logic
        let targetCreatorIds: string[] | null = null;
        let targetSetIds: string[] | null = null;
        let targetItemNames: Set<string> | null = null;

        if (options.filterFileNames && options.filterFileNames.length > 0) {
            // Find items matching the filenames
            // SQLite limit for IN clause is usually high
            const foundItems = db.select().from(ccItems).where(inArray(ccItems.fileName, options.filterFileNames)).all();

            if (foundItems.length === 0) {
                return 'Scan Report\n\n_No matching items found in library for this scan._';
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
            let creatorLine = '';
            if (options.includeCreators) {
                let creatorName = creator.name;
                if (creator.patreonUrl) creatorName = `[${creatorName}](${creator.patreonUrl})`;
                else if (creator.websiteUrl) creatorName = `[${creatorName}](${creator.websiteUrl})`;
                creatorLine = creatorName;
            }

            if (options.includeSets) {
                let allSets = db.select().from(ccSets).where(eq(ccSets.creatorId, creator.id)).all();
                if (targetSetIds !== null) {
                    allSets = allSets.filter(s => targetSetIds!.includes(s.id));
                }

                const setEntries: string[] = [];
                const seenSets = new Set<string>();

                const collectSets = (parentId: string | null) => {
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

                        let setLabel = set.name;
                        const setKey = `${set.name}|${links.join(',')}`;

                        if (!seenSets.has(setKey)) {
                            let setNameWithLinks = setLabel;
                            if (links.length > 0) {
                                setNameWithLinks = `${setLabel} (${links.join(', ')})`;
                            }
                            setEntries.push(setNameWithLinks);
                            seenSets.add(setKey);
                        }

                        // Recursively collect children
                        collectSets(set.id);
                    });
                };

                collectSets(null);

                if (setEntries.length > 0) {
                    if (creatorLine) {
                        report += `- ${creatorLine}: ${setEntries.join(', ')}\n`;
                    } else {
                        report += `${setEntries.join(', ')}\n`;
                    }
                } else if (creatorLine) {
                    report += `- ${creatorLine}\n`;
                }

                if (options.includeItems) {
                    // If items are included, we'll list them as before but more compactly
                    allSets.forEach(set => {
                        let items = db.select().from(ccItems).where(eq(ccItems.ccSetId, set.id)).all();
                        if (targetItemNames !== null) {
                            items = items.filter(i => targetItemNames!.has(i.fileName));
                        }
                        if (items.length > 0) {
                            items.sort((a, b) => a.fileName.localeCompare(b.fileName));
                            items.forEach(item => {
                                report += `- ${item.fileName}`;
                                if (options.includeCategory && item.categoryId) {
                                    const cat = db.select().from(categories).where(eq(categories.id, item.categoryId)).get();
                                    if (cat) report += ` [${cat.name}]`;
                                }
                                report += `\n`;
                            });
                        }
                    });
                }
            } else if (creatorLine) {
                report += `${creatorLine}\n`;
            }
        });

        if (report === 'Library Report\n\n' || report === 'Scan Report\n\n') {
            return report + '_No data available._';
        }

        return report.trim();
    }

    static generateHTML(options: ReportOptions = {
        includeCreators: true,
        includeSets: true,
        includeItems: true,
        includeCategory: true
    }): string {
        const db = getDb();
        let html = '';

        // 1. Filter Logic
        let targetCreatorIds: string[] | null = null;
        let targetSetIds: string[] | null = null;
        let targetItemNames: Set<string> | null = null;

        if (options.filterFileNames && options.filterFileNames.length > 0) {
            const foundItems = db.select().from(ccItems).where(inArray(ccItems.fileName, options.filterFileNames)).all();

            if (foundItems.length === 0) {
                return '<p><em>No matching items found in library for this scan.</em></p>';
            }

            targetSetIds = [...new Set(foundItems.map(i => i.ccSetId).filter(id => id !== null) as string[])];
            targetItemNames = new Set(options.filterFileNames);

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

        allCreators.sort((a, b) => a.name.localeCompare(b.name));

        allCreators.forEach((creator) => {
            let creatorHtml = '';
            if (options.includeCreators) {
                let creatorName = creator.name;
                const linkUrl = creator.patreonUrl || creator.websiteUrl;
                if (linkUrl) {
                    creatorName = `<a href="${linkUrl}">${creatorName}</a>`;
                }
                creatorHtml = creatorName;
            }

            if (options.includeSets) {
                let allSets = db.select().from(ccSets).where(eq(ccSets.creatorId, creator.id)).all();
                if (targetSetIds !== null) {
                    allSets = allSets.filter(s => targetSetIds!.includes(s.id));
                }

                const setEntries: string[] = [];
                const seenSets = new Set<string>();

                const collectSets = (parentId: string | null) => {
                    const children = allSets.filter(s => s.parentId === parentId);
                    children.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name));

                    children.forEach((set) => {
                        let setName = set.name;
                        let linkUrl = set.patreonUrl || set.websiteUrl;

                        if (!linkUrl && set.extraLinks) {
                            try {
                                const extra = JSON.parse(set.extraLinks);
                                if (Array.isArray(extra) && extra.length > 0) {
                                    linkUrl = extra[0].url;
                                }
                            } catch { }
                        }

                        const setKey = `${set.name}|${linkUrl || ''}`;
                        if (!seenSets.has(setKey)) {
                            let setTag = setName;
                            if (linkUrl) {
                                setTag = `<a href="${linkUrl}">${setName}</a>`;
                            }
                            setEntries.push(setTag);
                            seenSets.add(setKey);
                        }

                        collectSets(set.id);
                    });
                };

                collectSets(null);

                if (setEntries.length > 0) {
                    if (creatorHtml) {
                        html += `<div>• ${creatorHtml}: ${setEntries.join(', ')}</div>\n`;
                    } else {
                        html += `<div>${setEntries.join(', ')}</div>\n`;
                    }
                } else if (creatorHtml) {
                    html += `<div>• ${creatorHtml}</div>\n`;
                }

                if (options.includeItems) {
                    allSets.forEach(set => {
                        let items = db.select().from(ccItems).where(eq(ccItems.ccSetId, set.id)).all();
                        if (targetItemNames !== null) {
                            items = items.filter(i => targetItemNames!.has(i.fileName));
                        }
                        if (items.length > 0) {
                            items.sort((a, b) => a.fileName.localeCompare(b.fileName));
                            html += `<ul>\n`;
                            items.forEach(item => {
                                let itemText = item.fileName;
                                if (options.includeCategory && item.categoryId) {
                                    const cat = db.select().from(categories).where(eq(categories.id, item.categoryId)).get();
                                    if (cat) itemText += ` <em>[${cat.name}]</em>`;
                                }
                                html += `<li>${itemText}</li>\n`;
                            });
                            html += `</ul>\n`;
                        }
                    });
                }
            } else if (creatorHtml) {
                html += `<div>${creatorHtml}</div>\n`;
            }
        });

        if (html === '') return '<p><em>No data available.</em></p>';
        return html;
    }
}
