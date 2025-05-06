// Instead of importing pool directly, export an initialization function
let poolInstance = null;

/**
 * Every 15 minutes, find name‐based duplicates via LLM and delete the oldest entries.
 */
async function cleanDuplicateGifts() {
    if (!poolInstance) {
        console.error('[duplicateCleaner] Database pool not initialized');
        return;
    }

    const [rows] = await poolInstance.query('SELECT id, name, created_at FROM gifts');
    if (rows.length < 2) return;

    // Find duplicate gifts using string similarity instead of LLM
    const duplicateGroups = [];
    const processedIds = new Set();

    for (let i = 0; i < rows.length; i++) {
        if (processedIds.has(rows[i].id)) continue;

        const currentName = rows[i].name.toLowerCase();
        const group = [rows[i].id];

        for (let j = i + 1; j < rows.length; j++) {
            if (processedIds.has(rows[j].id)) continue;

            const targetName = rows[j].name.toLowerCase();

            // Check for exact duplicates or very close matches
            if (currentName === targetName ||
                (currentName.includes(targetName) && targetName.length > 5) ||
                (targetName.includes(currentName) && currentName.length > 5) ||
                levenshteinDistance(currentName, targetName) <= 3) {

                group.push(rows[j].id);
                processedIds.add(rows[j].id);
            }
        }

        if (group.length > 1) {
            duplicateGroups.push(group);
            processedIds.add(rows[i].id);
        }
    }

    // Handle each duplicate group
    for (const group of duplicateGroups) {
        // Find the newest gift by ID (assuming higher ID = newer)
        group.sort((a, b) => a - b);
        const toDelete = group.slice(0, -1);
        const keptId = group[group.length - 1];

        // Find gift names for logging
        const deletedGifts = toDelete.map(id => {
            const gift = rows.find(r => Number(r.id) === Number(id));
            return gift ? `${id} (${gift.name})` : `${id} (unknown)`;
        });

        const keptGift = rows.find(r => Number(r.id) === Number(keptId));
        const keptName = keptGift ? keptGift.name : 'unknown';

        await poolInstance.query('DELETE FROM gifts WHERE id IN (?)', [toDelete]);
        console.log(`[duplicateCleaner] Deleted duplicates: ${deletedGifts.join(', ')}, kept: ${keptId} (${keptName})`);
    }
}

// Levenshtein distance function to measure string similarity
function levenshteinDistance(str1, str2) {
    const track = Array(str2.length + 1).fill(null).map(() =>
        Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i += 1) {
        track[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j += 1) {
        track[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j += 1) {
        for (let i = 1; i <= str1.length; i += 1) {
            const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
            track[j][i] = Math.min(
                track[j][i - 1] + 1, // deletion
                track[j - 1][i] + 1, // insertion
                track[j - 1][i - 1] + indicator, // substitution
            );
        }
    }

    return track[str2.length][str1.length];
}

// Export an initialization function instead
export function initDuplicateCleaner(pool) {
    poolInstance = pool;

    // Run immediately on server start
    console.log('[duplicateCleaner] Running initial duplicate cleanup on server start');
    cleanDuplicateGifts().catch(err => {
        console.error('[duplicateCleaner] Initial cleanup error:', err);
    });

    // Then run every 15 minutes (15 * 60 * 1000 = 900000 milliseconds)
    const intervalMs = 15 * 60 * 1000;
    setInterval(() => {
        console.log('[duplicateCleaner] Running scheduled duplicate cleanup');
        cleanDuplicateGifts().catch(console.error);
    }, intervalMs);
}