import { ZipScanner } from './src/main/lib/ZipScanner';
import * as path from 'path';

const zipPath = 'C:\\Users\\bruno\\Downloads\\Salt & Smoke Kitchen.zip';

console.log('Testing ZipScanner with:', zipPath);

try {
    const results = ZipScanner.scanZip(zipPath);
    console.log('Scan Results:');
    console.table(results);
} catch (error) {
    console.error('Error scanning zip:', error);
}
