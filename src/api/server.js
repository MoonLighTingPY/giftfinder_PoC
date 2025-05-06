// src/api/server.js
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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://images.pexels.com; font-src 'self'; connect-src 'self' http://192.168.0.251:3001 ws://192.168.0.251:* http://localhost:3001 ws://localhost:*;"
  );
  next();
});

// Database connection
export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gift_finder',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true // Ensure decimals are returned as numbers
});

// Middleware to verify JWT
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

// Start the duplicate‐cleanup job
initDuplicateCleaner(pool);

// --- Auth Routes ---
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

// --- Gift Recommendation API ---
const pendingAiSuggestions = new Map();

// Gift recommendation endpoint (complete rewrite)
app.post('/api/gifts/recommend', authenticateToken, async (req, res) => {
  const requestId = Date.now().toString() + Math.random().toString(36).slice(2);

  try {
    const { age, gender, interests, profession, budget, occasion, useAi, aiGiftCount = 3 } = req.body;

    // Parse budget into min/max values
    let budgetMin = 0;
    let budgetMax = 99999;

    if (budget && typeof budget === 'string' && budget !== 'any') {
      const parts = budget.split('-').map(p => parseFloat(p.replace(/[^0-9.]/g, '')));
      if (parts.length === 1 && !isNaN(parts[0])) {
        budgetMax = parts[0]; // If only one value, treat as max budget
      } else if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        budgetMin = parts[0];
        budgetMax = parts[1];
      }
    }

    console.log(`Processing request ${requestId} with budget range: $${budgetMin}-$${budgetMax}`);

    // 1. Get all gifts from database (only necessary fields)
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

    // 2. Use AI to select the best matching gifts from the database
    const selectedGifts = await giftSelectionService.selectGifts({
      userCriteria: { age, gender, interests, profession, occasion },
      gifts: allGifts,
      limit: 8
    });

    // Add image URLs to any gift without one
    const enrichedGifts = await enrichGiftsWithImages(selectedGifts);

    // 3. Start background AI gift generation if requested
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

    // 4. Return selected gifts immediately
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

// Endpoint to check AI gift status
app.get('/api/gifts/ai-status/:requestId', authenticateToken, async (req, res) => {
  const { requestId } = req.params;
  const aiResult = pendingAiSuggestions.get(requestId);

  if (!aiResult) {
    return res.json({ status: 'pending' });
  }

  // Always return the full result including partial gifts
  res.json(aiResult);

  // Only clean up from the map if complete or error
  if (aiResult.status === 'completed' || aiResult.status === 'error') {
    pendingAiSuggestions.delete(requestId);
  }
});

// Background AI gift generation function (complete rewrite)
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
    // 1. Generate new gift suggestions based on user criteria
    const aiGiftSuggestions = await giftSelectionService.generateNewGifts({
      userCriteria: { age, gender, interests, profession, occasion, budget },
      existingGifts: existingGifts.map(g => g.name),
      count: giftCount
    });
    console.log(`🧠 [${requestId}] Generated ${aiGiftSuggestions.length} new gift suggestions`);

    // 2. Insert new gifts into database one by one and update status after each
    for (const gift of aiGiftSuggestions) {
      // Check if gift with this name already exists
      const [[exists]] = await pool.query(
        'SELECT id FROM gifts WHERE name = ?',
        [gift.name]
      );

      if (exists) {
        console.log(`⚠️ [${requestId}] Gift "${gift.name}" already exists, skipping`);
        continue;
      }

      // Translate name to English for image search
      let name_en = null;
      try {
        name_en = await translateToEnglish(gift.name);
      } catch (err) {
        console.warn(`⚠️ [${requestId}] Translation failed for "${gift.name}": ${err.message}`);
      }

      // Get image
      let image_url = null;
      try {
        const queryName = name_en || gift.name;
        image_url = await getImageUrl(queryName, Boolean(name_en));
      } catch (err) {
        console.warn(`⚠️ [${requestId}] Failed to get image for "${gift.name}": ${err.message}`);
      }

      // Parse price range
      let budget_min = 0;
      let budget_max = 999;
      if (gift.price_range) {
        const priceMatch = gift.price_range.match(/\$?(\d+)(?:\s*-\s*\$?(\d+))?/);
        if (priceMatch) {
          budget_min = parseInt(priceMatch[1]) || 0;
          budget_max = parseInt(priceMatch[2] || priceMatch[1]) || 999;
        }
      }

      // Insert new gift
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

        // Update pending suggestions with the newly inserted gift
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

    // 3. Update pending suggestions with completed status
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

// Helper function to add images to gifts
async function enrichGiftsWithImages(gifts) {
  const enrichedGifts = [...gifts];

  for (let i = 0; i < enrichedGifts.length; i++) {
    const gift = enrichedGifts[i];

    // Skip if already has an image
    if (gift.image_url) continue;

    // Prefer English name when available
    const queryName = gift.name_en || gift.name;
    const isEnglish = Boolean(gift.name_en && gift.name_en.trim());

    try {
      const imageUrl = await getImageUrl(queryName, isEnglish);
      if (imageUrl) {
        enrichedGifts[i] = {
          ...gift,
          image_url: imageUrl
        };

        // Update database with the new image URL
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

// Image refresh endpoint
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

    // Process images in background
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

        // Delay to avoid rate limits
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // Check for missing images on startup
  (async () => {
    try {
      const [giftsWithoutImages] = await pool.query(
        'SELECT COUNT(*) as count FROM gifts WHERE image_url IS NULL OR image_url = ""'
      );

      const missingImagesCount = giftsWithoutImages[0].count;

      if (missingImagesCount > 0) {
        console.log(`⚠️ Found ${missingImagesCount} gifts without images`);
      } else {
        console.log('✅ All gifts have images');
      }
    } catch (err) {
      console.error('❌ Error checking for missing images:', err);
    }
  })();
});