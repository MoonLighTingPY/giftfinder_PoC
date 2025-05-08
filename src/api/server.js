import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import process from 'process';
import { translateToEnglish, getImageUrl } from '../services/pexelsService.js';
import { giftSelectionService } from '../services/giftSelectionService.js';
import { initDuplicateCleaner } from './duplicateCleaner.js';

// Ініціалізація змінних оточення
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware для обробки CORS та JSON
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://images.pexels.com; font-src 'self'; connect-src 'self' http://192.168.0.251:3001 ws://192.168.0.251:* http://localhost:3001 ws://localhost:*;"
  );
  next();
});

// Підключення до бази даних
export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gift_finder',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true // Прапорець, щоб повертати числа з плаваючою комою, а не текст з бд
});

// Middleware щоб верифікувати jwt токен
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Forbidden' });
    req.user = user;
    next();
  });
};

// Почати очищення дублікатів подарунків в базі даних
initDuplicateCleaner(pool);

// Ендпоінти
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'Користувач або емейл вже існує' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    res.status(201).json({ message: 'Успішна реєстрація!)' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Серверна помилка' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Неправильні дані' });
    }

    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Неправильні дані' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Успішний вхід!)',
      user: { id: user.id, username: user.username, email: user.email },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Серверна помилка' });
  }
});


const pendingAiSuggestions = new Map();

// Ендпоінт для отримання рекомендацій подарунків (результат пошуку) на базі запиту з AI
app.post('/api/gifts/recommend', authenticateToken, async (req, res) => {
  const requestId = Date.now().toString() + Math.random().toString(36).slice(2);

  try {
    const { age, gender, interests, profession, budget, occasion, useAi, aiGiftCount = 3 } = req.body;

    // Парсимо бюджет для використання в SQL запитах
    let budgetMin = 0;
    let budgetMax = 99999;

    // Якщо бюджет не вказано, використовуємо значення за замовчуванням
    if (budget && typeof budget === 'string' && budget !== 'any') {
      // Прибираємо символи валюти та пробіли
      const parts = budget.split('-').map(p => parseFloat(p.replace(/[^0-9.]/g, '')));
      if (parts.length === 1 && !isNaN(parts[0])) {
        budgetMax = parts[0]; // Якщо вказано лише верхню межу, встановлюємо її
      } else if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        // Якщо вказано обидві межі, використовуємо їх
        budgetMin = parts[0];
        budgetMax = parts[1];
      }
    }

    // Логування запиту
    console.log(`Processing request ${requestId} with budget range: $${budgetMin}-$${budgetMax}`);

    // 1. Отримуємо всі подарунки з бази даних, які підходять під бюджет
    const [allGifts] = await pool.query(`
      SELECT 
        id, name, name_en, description, price_range, 
        budget_min, budget_max, image_url, ai_generated
      FROM gifts
      WHERE budget_min <= ? AND budget_max >= ?
    `, [budgetMax, budgetMin]);

    console.log(`Found ${allGifts.length} gifts matching budget criteria`);

    if (allGifts.length === 0) {
      return res.json({
        gifts: [],
        aiStatus: useAi ? 'generating' : 'not_started',
        requestId: useAi ? requestId : null
      });
    }

    // 2. Використовуємо ШІ для вибору подарунків на основі характеристик користувача
    const selectedGifts = await giftSelectionService.selectGifts({
      userCriteria: { age, gender, interests, profession, occasion },
      gifts: allGifts,
      limit: 8
    });

    // 2.1 Додаємо зображення до подарунків
    const enrichedGifts = await enrichGiftsWithImages(selectedGifts);

    // 3. Якщо користувач ввімкнув генерацію подарунків ШІ, запускаємо її на фоні
    if (useAi) {
      pendingAiSuggestions.set(requestId, { status: 'generating' });

      generateAiGifts({
        age,
        gender,
        interests,
        profession,
        budget,
        occasion,
        existingGifts: enrichedGifts,
        requestId,
        giftCount: aiGiftCount
      }).catch(err => {
        console.error(`AI gift generation error: ${err.message}`);
        pendingAiSuggestions.set(requestId, {
          status: 'error',
          error: 'Failed to generate AI gifts'
        });
      });
    }

    // 4. Моментально повертаємо результати
    res.json({
      gifts: enrichedGifts,
      aiStatus: useAi ? 'generating' : 'not_started',
      requestId: useAi ? requestId : null
    });
  } catch (error) {
    console.error('Gift recommendation error:', error);
    if (requestId && pendingAiSuggestions.has(requestId)) {
      pendingAiSuggestions.set(requestId, {
        status: 'error',
        error: error.message || 'Server error'
      });
    }
    res.status(500).json({
      message: 'Помилка сервера під час отримання рекомендацій.',
      error: error.message
    });
  }
});

// Ендпоінт для отримання статусу AI генерації подарунків (щоб перевірити, чи завершено, і всі подарунки відображені)
app.get('/api/gifts/ai-status/:requestId', authenticateToken, async (req, res) => {
  const { requestId } = req.params;
  const aiResult = pendingAiSuggestions.get(requestId);

  if (!aiResult) {
    return res.json({ status: 'pending' });
  }

  // Завжди повертаємо результати, навіть якщо генерацію ще не завершено, щоб отримати подарунки, які вже згенеровані
  res.json(aiResult);

  // Тільки видаляємо з черги, якщо статус завершено або помилка
  if (aiResult.status === 'completed' || aiResult.status === 'error') {
    pendingAiSuggestions.delete(requestId);
  }
});

// Функція для генерації подарунків AI на основі характеристик користувача
async function generateAiGifts({ age, gender, interests, profession, budget, occasion, existingGifts, requestId, giftCount = 3 }) {
  console.log(`🧠 [${requestId}] Starting AI gift generation`);

  // Initialize with empty gifts array
  pendingAiSuggestions.set(requestId, {
    status: 'generating',
    gifts: [],
    total: giftCount,
    completed: 0
  });

  try {
    // 1. Гнереруємо нові подарунки на основі характеристик користувача
    const aiGiftSuggestions = await giftSelectionService.generateNewGifts({
      userCriteria: { age, gender, interests, profession, occasion, budget },
      existingGifts: existingGifts.map(g => g.name),
      count: giftCount
    });
    console.log(`🧠 [${requestId}] Generated ${aiGiftSuggestions.length} new gift suggestions`);

    // 2. Вставляємо нові подарунки в базу даних один за одним
    for (const gift of aiGiftSuggestions) {
      // Перевіряємо, чи вже існує подарунок в базі даних
      const [[exists]] = await pool.query(
        'SELECT id FROM gifts WHERE name = ?',
        [gift.name]
      );

      if (exists) {
        console.log(`⚠️ [${requestId}] Gift "${gift.name}" already exists, skipping`);
        continue;
      }

      // Трансляція назви подарунка на англійську, бо Pexels API погано шукає українською
      let name_en = null;
      try {
        name_en = await translateToEnglish(gift.name);
      } catch (err) {
        console.warn(`⚠️ [${requestId}] Translation failed for "${gift.name}": ${err.message}`);
      }

      // Отримуємо URL зображення для подарунка
      let image_url = null;
      try {
        const queryName = name_en || gift.name;
        image_url = await getImageUrl(queryName, Boolean(name_en));
      } catch (err) {
        console.warn(`⚠️ [${requestId}] Failed to get image for "${gift.name}": ${err.message}`);
      }

      // Парсимо ціновий діапазон
      let budget_min = 0;
      let budget_max = 999;
      if (gift.price_range) {
        // Витягуємо ціновий діапазон з рядка, прибираючи символи валюти, наприклад "$50-$100" або "$50"
        gift.price_range = gift.price_range.replace(/[^0-9$-]/g, '');
        const priceMatch = gift.price_range.match(/\$?(\d+)(?:\s*-\s*\$?(\d+))?/);
        if (priceMatch) {
          budget_min = parseInt(priceMatch[1]) || 0;
          budget_max = parseInt(priceMatch[2] || priceMatch[1]) || 999;
        }
      }

      // Вставляємо новий згенерований подарунок в базу даних з зображенням і прапорцем ai_generated = 1
      try {
        const [result] = await pool.query(
          `INSERT INTO gifts 
            (name, name_en, description, price_range, budget_min, budget_max, image_url, ai_generated) 
          VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
          [gift.name, name_en, gift.description, gift.price_range, budget_min, budget_max, image_url]
        );

        const newGiftId = result.insertId;
        const newGiftObject = {
          id: newGiftId,
          name: gift.name,
          name_en: name_en,
          description: gift.description,
          price_range: gift.price_range,
          budget_min: budget_min,
          budget_max: budget_max,
          image_url: image_url,
          ai_generated: true,
          ai_suggested: true
        };

        console.log(`✅ [${requestId}] Inserted gift "${gift.name}" with ID ${newGiftId}`);

        // Оновлюємо статус генерації подарунків
        const currentStatus = pendingAiSuggestions.get(requestId);
        pendingAiSuggestions.set(requestId, {
          status: 'generating',
          gifts: [...currentStatus.gifts, newGiftObject],
          total: giftCount,
          completed: currentStatus.completed + 1
        });

      } catch (err) {
        console.error(`❌ [${requestId}] Failed to insert gift "${gift.name}": ${err.message}`);
      }
    }

    // 3. Оновлюємо статус генерації подарунків
    const finalStatus = pendingAiSuggestions.get(requestId);
    pendingAiSuggestions.set(requestId, {
      status: 'completed',
      gifts: finalStatus.gifts
    });

    console.log(`✅ [${requestId}] AI gift generation completed with ${finalStatus.gifts.length} new gifts`);
  } catch (err) {
    console.error(`❌ [${requestId}] AI gift generation error:`, err);
    pendingAiSuggestions.set(requestId, {
      status: 'error',
      error: err.message || 'Unknown error during AI gift generation'
    });
  }
}

// Функція для збагачення подарунків зображеннями
async function enrichGiftsWithImages(gifts) {
  const enrichedGifts = [...gifts];

  for (let i = 0; i < enrichedGifts.length; i++) {
    const gift = enrichedGifts[i];

    // Пропускаємо подарунки, які вже мають зображення
    if (gift.image_url) continue;

    // Використовуємо назву англійською, якщо вона є
    const queryName = gift.name_en || gift.name;
    const isEnglish = Boolean(gift.name_en && gift.name_en.trim());

    try {
      const imageUrl = await getImageUrl(queryName, isEnglish);
      if (imageUrl) {
        enrichedGifts[i] = {
          ...gift,
          image_url: imageUrl
        };

        // Оновлюємо зображення в базі даних
        await pool.query(
          'UPDATE gifts SET image_url = ? WHERE id = ?',
          [imageUrl, gift.id]
        );
      }
    } catch (error) {
      console.error(`❌ Could not find image for "${queryName}":`, error.message);
    }
  }

  return enrichedGifts;
}

// Ендпоінт для оновлення зображень подарунків
app.get('/api/refresh-images', authenticateToken, async (req, res) => {
  const forceRefresh = req.query.force === 'true';

  try {
    const [giftsToUpdate] = await pool.query(
      forceRefresh
        ? 'SELECT id, name, name_en FROM gifts WHERE name IS NOT NULL AND name != ""'
        : 'SELECT id, name, name_en FROM gifts WHERE (image_url IS NULL OR image_url = "") AND name IS NOT NULL AND name != ""'
    );

    if (giftsToUpdate.length === 0) {
      return res.json({ message: 'No gifts require image refresh' });
    }

    res.json({
      message: `Image refresh started for ${giftsToUpdate.length} gifts`,
      count: giftsToUpdate.length
    });

    // Обробка зображень в фоновому режимі
    (async () => {
      let updatedCount = 0;
      let failedCount = 0;

      for (const gift of giftsToUpdate) {
        try {
          const queryName = gift.name_en || gift.name;
          const isEnglish = Boolean(gift.name_en && gift.name_en.trim());
          const imageUrl = await getImageUrl(queryName, isEnglish);

          if (imageUrl) {
            await pool.query(
              'UPDATE gifts SET image_url = ? WHERE id = ?',
              [imageUrl, gift.id]
            );
            updatedCount++;
            console.log(`✅ Added image for "${queryName}"`);
          } else {
            failedCount++;
            console.warn(`⚠️ No image found for "${queryName}"`);
          }
        } catch (err) {
          failedCount++;
          console.error(`❌ Error processing image for "${gift.name}":`, err.message);
        }

        // Затримка між запитами, щоб уникнути бану API
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      console.log(`✅ Image refresh complete. Updated: ${updatedCount}, Failed: ${failedCount}`);
    })().catch(err => {
      console.error('❌ Background image refresh error:', err);
    });
  } catch (error) {
    console.error('❌ Image refresh error:', error);
    res.status(500).json({ message: 'Error starting image refresh', error: error.message });
  }
});

// Функція для перевірки і оновлення подарунків без зображень
async function checkAndUpdateMissingImages() {
  try {
    // Отримуємо подарунки без зображень
    const [giftsWithoutImages] = await pool.query(
      'SELECT * FROM gifts WHERE image_url IS NULL OR image_url = ""'
    );

    const missingImagesCount = giftsWithoutImages.length;

    if (missingImagesCount > 0) {
      console.log(`⚠️ Found ${missingImagesCount} gifts without images. Starting enrichment...`);

      // Використовуємо існуючу функцію для збагачення подарунків зображеннями
      const enrichedGifts = await enrichGiftsWithImages(giftsWithoutImages);

      const updatedCount = enrichedGifts.filter(gift => gift.image_url).length;
      const failedCount = missingImagesCount - updatedCount;

      console.log(`✅ Image enrichment complete. Updated: ${updatedCount}, Failed: ${failedCount}`);
    } else {
      console.log('✅ All gifts have images');
    }
  } catch (err) {
    console.error('❌ Error checking/enriching missing images:', err);
  }
}

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  checkAndUpdateMissingImages();

  // Перевіряємо наявність подарунків без зображень, якщо такі є - оновлюємо їх
  const imageCheckIntervalMs = 15 * 60 * 1000;
  setInterval(() => {
    console.log('🔄 Running scheduled check for gifts without images');
    checkAndUpdateMissingImages();
  }, imageCheckIntervalMs);
});