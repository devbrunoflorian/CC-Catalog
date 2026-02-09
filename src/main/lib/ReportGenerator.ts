import db from '../db/database';

export class ReportGenerator {
    static generateMarkdown(): string {
        const creators = db.prepare('SELECT * FROM creators').all();
        let report = '';

        creators.forEach((creator: any) => {
            const sets = db.prepare('SELECT * FROM cc_sets WHERE creator_id = ?').all(creator.id);
            if (sets.length === 0) return;

            report += `${creator.name}:\n`;
            sets.forEach((set: any) => {
                report += `- ${set.name}\n`;
            });
            report += '\n';
        });

        return report.trim();
    }
}
