// Імпорт стану ініціалізації бази даних, щоб уникнути спроби видалення дублікатів до того, як база даних буде готова
let poolInstance = null;

// Функція для очищення дублікатів подарунків у базі даних
// Знаходить і видаляє подібні подарунки, залишаючи тільки найновіші версії
async function cleanDuplicateGifts() {
    if (!poolInstance) {
        console.error('[duplicateCleaner] Database pool not initialized');
        return;
    }

    const [rows] = await poolInstance.query('SELECT id, name, created_at FROM gifts');
    if (rows.length < 2) return;


    const duplicateGroups = [];
    const processedIds = new Set();

    for (let i = 0; i < rows.length; i++) {
        if (processedIds.has(rows[i].id)) continue;

        const currentName = rows[i].name.toLowerCase();
        const group = [rows[i].id];

        for (let j = i + 1; j < rows.length; j++) {
            if (processedIds.has(rows[j].id)) continue;

            const targetName = rows[j].name.toLowerCase();

            // Перевірка на точні дублікати або дуже схожі назви
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

    // Обробка кожної групи дублікатів
    for (const group of duplicateGroups) {
        // Знаходимо найновіший подарунок за ID (припускаємо, що більший ID = новіший)
        group.sort((a, b) => a - b);
        const toDelete = group.slice(0, -1);
        const keptId = group[group.length - 1];

        // Знаходимо назви подарунків для журналювання
        const deletedGifts = toDelete.map(id => {
            const gift = rows.find(r => Number(r.id) === Number(id));
            return gift ? `${id} (${gift.name})` : `${id} (невідомо)`;
        });

        const keptGift = rows.find(r => Number(r.id) === Number(keptId));
        const keptName = keptGift ? keptGift.name : 'невідомо';

        await poolInstance.query('DELETE FROM gifts WHERE id IN (?)', [toDelete]);
        console.log(`[duplicateCleaner] Видалено дублікати: ${deletedGifts.join(', ')}, залишено: ${keptId} (${keptName})`);
    }
}

// Функція відстані Левенштейна для вимірювання подібності рядків
// Повертає кількість операцій (вставка, видалення, заміна), необхідних для перетворення одного рядка в інший
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
                track[j][i - 1] + 1, // видалення символу
                track[j - 1][i] + 1, // вставка символу
                track[j - 1][i - 1] + indicator, // заміна символу
            );
        }
    }

    return track[str2.length][str1.length];
}

// Експортуємо функцію ініціалізації, яка запускає процес очищення
export function initDuplicateCleaner(pool) {
    poolInstance = pool;

    // Запускаємо одразу при старті сервера
    console.log('[duplicateCleaner] Запуск початкового очищення дублікатів при старті сервера');
    cleanDuplicateGifts().catch(err => {
        console.error('[duplicateCleaner] Помилка початкового очищення:', err);
    });

    // Потім запускаємо кожні 15 хвилин (15 * 60 * 1000 = 900000 мілісекунд)
    const intervalMs = 15 * 60 * 1000;
    setInterval(() => {
        console.log('[duplicateCleaner] Запуск планового очищення дублікатів');
        cleanDuplicateGifts().catch(console.error);
    }, intervalMs);
}