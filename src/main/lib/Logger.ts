import { app } from 'electron';
import { join } from 'path';
import { appendFileSync, mkdirSync, existsSync } from 'fs';

export class Logger {
    private static logDir = join(app.getPath('userData'), 'logs');

    static init() {
        if (!existsSync(this.logDir)) {
            mkdirSync(this.logDir, { recursive: true });
        }
        this.info('Logger initialized');
    }

    private static getLogPath() {
        const date = new Date().toISOString().split('T')[0];
        return join(this.logDir, `crash-${date}.log`);
    }

    private static log(level: 'INFO' | 'ERROR' | 'WARN', message: string, detail?: any) {
        const timestamp = new Date().toISOString();
        let logEntry = `[${timestamp}] [${level}] ${message}`;

        if (detail) {
            if (detail instanceof Error) {
                logEntry += `\nStack: ${detail.stack}`;
            } else if (typeof detail === 'object') {
                logEntry += `\nDetail: ${JSON.stringify(detail, null, 2)}`;
            } else {
                logEntry += `\nDetail: ${detail}`;
            }
        }

        logEntry += '\n' + '-'.repeat(80) + '\n';

        try {
            const logPath = this.getLogPath();
            appendFileSync(logPath, logEntry, 'utf8');
            console.log(logEntry); // Also log to console for dev
        } catch (err) {
            console.error('Failed to write to log file:', err);
        }
    }

    static info(message: string, detail?: any) {
        this.log('INFO', message, detail);
    }

    static warn(message: string, detail?: any) {
        this.log('WARN', message, detail);
    }

    static error(message: string, detail?: any) {
        this.log('ERROR', message, detail);
    }

    static getLogFilePath() {
        return this.getLogPath();
    }
}
