import { getDb } from '../db/database';
import { creators, ccSets } from '../db/schema';
import { eq } from 'drizzle-orm';

export class ReportGenerator {
    static generateMarkdown(): string {
        const db = getDb();
        const allCreators = db.select().from(creators).all();
        let report = '';

        allCreators.forEach((creator) => {
            const sets = db.select().from(ccSets).where(eq(ccSets.creatorId, creator.id)).all();
            if (sets.length === 0) return;

            report += `${creator.name}:\n`;
            sets.forEach((set) => {
                report += `- ${set.name}\n`;
            });
            report += '\n';
        });

        return report.trim();
    }
}
