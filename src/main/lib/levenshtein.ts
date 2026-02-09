/**
 * Computes the Levenshtein distance between two strings.
 * This measures the minimum number of single-character edits (insertions, deletions or substitutions)
 * required to change one word into the other.
 */
export function getLevenshteinDistance(a: string, b: string): number {
    const matrix = Array.from({ length: a.length + 1 }, () =>
        Array.from({ length: b.length + 1 }, (_, i) => i)
    );

    for (let i = 0; i <= a.length; i++) {
        matrix[i][0] = i;
    }

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return matrix[a.length][b.length];
}

/**
 * Calculates a similarity score between 0 and 1.
 * 1 means identical strings, 0 means completely different.
 */
export function getSimilarity(a: string, b: string): number {
    const distance = getLevenshteinDistance(a.toLowerCase(), b.toLowerCase());
    const longerLength = Math.max(a.length, b.length);
    if (longerLength === 0) return 1.0;
    return (longerLength - distance) / longerLength;
}
