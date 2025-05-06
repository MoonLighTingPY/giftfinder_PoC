// src/services/giftSelectionService.js

import { generateCompletion, formatMistralPrompt } from './aiService.js';

export const giftSelectionService = {
    /**
     * Select the best matching gifts from the database using AI
     */
    async selectGifts({ userCriteria, gifts, limit = 8 }) {
        const { age, gender, interests, profession, occasion } = userCriteria;

        // If no gifts or simple case (just a few gifts), return all
        if (!gifts || gifts.length <= limit) {
            return gifts || [];
        }

        // Format the user criteria in a way the AI can understand
        const userDescription = [
            age ? `Вік: ${age}` : null,
            gender ? `Стать: ${gender === 'male' ? 'чоловіча' : 'жіноча'}` : null,
            interests ? `Інтереси: ${interests}` : null,
            profession ? `Професія: ${profession}` : null,
            occasion && occasion !== 'any' ? `Привід: ${occasion}` : null
        ].filter(Boolean).join(', ');

        // Create a simplified version of gifts for the prompt (to save tokens)
        const giftOptions = gifts.map((gift) => ({
            id: gift.id,
            name: gift.name,
            description: gift.description ? gift.description.substring(0, 100) : '',
            price: gift.price_range
        }));

        const systemPrompt = `
      Ви - експерт з підбору подарунків. Вам надано список подарунків та інформацію про людину, 
      яка шукає подарунок. Ваше завдання - вибрати ${limit} найбільш підходящих варіантів, 
      що відповідають параметрам людини. 
      
      Відповідайте ЛИШЕ масивом ID обраних подарунків у форматі JSON, наприклад [1, 15, 7, 22, 9, 31, 42, 18].
      Нічого, крім цього масиву чисел, у відповіді бути не повинно!
    `;

        const userPrompt = `
      Людина: ${userDescription}
      
      Доступні подарунки:
      ${giftOptions.map(g => `${g.id}: ${g.name} (${g.price})`).join('\n')}
      
      Оберіть ${limit} найбільш підходящих подарунків, враховуючи всі характеристики людини, і важливо щоб подарунки були більш-менш унікальні.
      Поверніть тільки масив ID!
    `;

        try {
            const formattedPrompt = formatMistralPrompt(systemPrompt, userPrompt);
            const result = await generateCompletion(formattedPrompt, {
                temperature: 0.5,
                maxTokens: 250
            });
            // Extract JSON array from response
            const match = result.match(/\[[\d,\s]+\]/);
            if (!match) {
                console.warn('Failed to extract gift IDs from AI response:', result);
                return gifts.slice(0, limit);
            }

            const selectedIds = JSON.parse(match[0]);

            // Map selected IDs back to full gift objects
            const selectedGifts = selectedIds
                .map(id => gifts.find(g => g.id === id))
                .filter(Boolean);

            // If we don't have enough, fill with random ones
            if (selectedGifts.length < limit) {
                const remainingGifts = gifts.filter(g => !selectedIds.includes(g.id));
                const additionalGifts = remainingGifts
                    .sort(() => 0.5 - Math.random())
                    .slice(0, limit - selectedGifts.length);

                return [...selectedGifts, ...additionalGifts];
            }

            return selectedGifts;
        } catch (error) {
            console.error('Error selecting gifts with AI:', error);
            // Fallback to random selection
            return gifts
                .sort(() => 0.5 - Math.random())
                .slice(0, limit);
        }
    },

    /**
     * Generate new gift suggestions based on user criteria
     */
    async generateNewGifts({ userCriteria, existingGifts = [], count = 3 }) {
        const { age, gender, interests, profession, occasion, budget } = userCriteria;

        const formattedBudget = budget && budget !== 'any'
            ? budget.replace('500+', '500-1000') // Format the high-end budget range
            : 'будь-який';

        const systemPrompt = `
      Ви - експерт з підбору подарунків, що пропонує унікальні ідеї українською мовою.
      Подаруйте ${count} конкретні, оригінальні ідеї подарунків, які ще не згадувалися.
      Формат JSON для кожного подарунка:
      {
        "name": "Назва подарунка",
        "description": "Детальний опис, чому подарунок підходить цій людині",
        "price_range": "$X-$Y" (у форматі цінового діапазону, наприклад "$50-$100")
      }
      
      Відповідайте ТІЛЬКИ JSON-масивом з ${count} подарунками, без додаткового тексту.
    `;

        const userPrompt = `
      Мені потрібні ідеї подарунків для людини:
      ${age ? `Вік: ${age}` : ''}
      ${gender ? `Стать: ${gender === 'male' ? 'чоловіча' : 'жіноча'}` : ''}
      ${interests ? `Інтереси/Хобі: ${interests}` : ''}
      ${profession ? `Професія: ${profession}` : ''}
      ${occasion && occasion !== 'any' ? `Привід: ${occasion}` : 'Привід: будь-який'}
      Бюджет: ${formattedBudget}
      
      Подарунки, які вже запропоновані (створіть щось інше):
      ${existingGifts.join(', ')}
      
      Запропонуйте ${count} унікальні подарунки, які точно відповідають указаним характеристикам та бюджету, 
      у вигляді JSON-масиву. Ціновий діапазон має відповідати зазначеному бюджету.
    `;

        try {
            const formattedPrompt = formatMistralPrompt(systemPrompt, userPrompt);
            const result = await generateCompletion(formattedPrompt, {
                temperature: 0.7,
                maxTokens: 2000
            });

            // Extract and parse the JSON array
            const match = result.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (!match) {
                // Fallback: try to find individual gift objects
                const objMatches = result.match(/\{[\s\S]*?\}/g) || [];
                if (objMatches.length > 0) {
                    return objMatches
                        .map(objStr => {
                            try {
                                return JSON.parse(objStr);
                            } catch {
                                return null;
                            }
                        })
                        .filter(Boolean);
                }

                console.error('Failed to extract gift JSON from AI response:', result);
                return [];
            }

            return JSON.parse(match[0]);
        } catch (error) {
            console.error('Error generating gifts with AI:', error);
            return [];
        }
    }
};