import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import process from 'process';
import { generateCompletion, formatMistralPrompt } from '../services/llamaService.js';
import { translateToEnglish, getImageUrl } from '../services/pexelsService.js'

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
const pool = mysql.createPool({
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
    // eslint-disable-next-line no-unused-vars
    const [_] = await pool.query(
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

// --- Gift Recommendation ---
const pendingAiSuggestions = new Map();

// Gift recommendation endpoint (Updated)
app.post('/api/gifts/recommend', authenticateToken, async (req, res) => {
  let requestId = null;

  try {
    // Destructure new fields: budget, occasion
    const { age, gender, interests, profession, budget, occasion, useAi } = req.body;
    const requestId = Date.now().toString() + Math.random().toString(36).slice(2);

    // --- Start Background AI Gift Generation Immediately (Updated) ---
    // -----------------------------------------------------

    // 1. Analyze user input (Updated)
    const aiTags = await analyzeUserInput({ age, gender, interests, profession, occasion }); // Pass occasion
    console.log('LLM suggested tags:', aiTags);

    // 2. Query database (Updated with budget and occasion)
    let dbGifts = [];
    const allSuggestedTags = [
      ...(aiTags.ageTags || []),
      ...(aiTags.genderTags || []),
      ...(aiTags.interestTags || []),
      ...(aiTags.professionTags || []),
      ...(aiTags.occasionTags || []) // Include occasion tags
    ].filter(tag => tag);

    // Budget parsing
    let budgetMin = 0;
    let budgetMax = 99999; // Default large max
    if (budget && typeof budget === 'string') {
      const parts = budget.split('-').map(p => parseFloat(p.replace(/[^0-9.]/g, '')));
      if (parts.length === 1 && !isNaN(parts[0])) {
        budgetMax = parts[0]; // If only one value, treat as max budget
      } else if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        budgetMin = parts[0];
        budgetMax = parts[1];
      } else if (budget.toLowerCase() === 'any') {
        // Keep defaults if 'any'
      }
    }
    console.log(`Budget range: ${budgetMin} - ${budgetMax}`);


    if (allSuggestedTags.length > 0) {
      // Updated Query with Budget Filter
      const query = `
        SELECT
          g.*,
          COUNT(DISTINCT t.id) as match_count
        FROM
          gifts g
        JOIN
          gift_tags gt ON g.id = gt.gift_id
        JOIN
          tags t ON gt.tag_id = t.id
        WHERE
          t.name IN (?) -- Match any relevant tag
          AND g.budget_min <= ? -- Budget max filter
          AND g.budget_max >= ? -- Budget min filter
        GROUP BY
          g.id
        HAVING -- Ensure at least one occasion tag matches if specified, OR 'any' tag exists
          SUM(CASE WHEN t.category = 'occasion' AND t.name IN (?) THEN 1 ELSE 0 END) > 0
          OR SUM(CASE WHEN t.category = 'occasion' AND t.name = 'any' THEN 1 ELSE 0 END) > 0
        ORDER BY
          match_count DESC, g.id
        LIMIT 8
      `;
      // Prepare params: all tags, budgetMax, budgetMin, occasion tags (or 'any' if none specific)
      const occasionQueryTags = aiTags.occasionTags && aiTags.occasionTags.length > 0 ? aiTags.occasionTags : ['any'];
      const queryParams = [allSuggestedTags, budgetMax, budgetMin, occasionQueryTags];

      try {
        // console.log('SQL query:', query);
        // console.log('Query params:', queryParams);
        [dbGifts] = await pool.query(query, queryParams);
        console.log(`Found ${dbGifts.length} gifts from database matching criteria`);
      } catch (sqlError) {
        console.error('SQL Error executing recommendation query:', sqlError);
        dbGifts = [];
      }
    } else {
      console.log('No valid tags suggested by LLM or extracted.');
      // Optionally query only by budget if no tags
      const budgetOnlyQuery = `SELECT *, 0 as match_count FROM gifts WHERE budget_min <= ? AND budget_max >= ? ORDER BY RAND() LIMIT 8`;
      try {
        [dbGifts] = await pool.query(budgetOnlyQuery, [budgetMax, budgetMin]);
        console.log(`Found ${dbGifts.length} gifts from database matching budget only`);
      } catch (sqlError) {
        console.error('SQL Error executing budget-only query:', sqlError);
        dbGifts = [];
      }
    }


    // 3. Return database gifts immediately
    console.log(`Sending initial response for ${requestId} with ${dbGifts.length} DB gifts.`);
    enrichGiftsWithImages(dbGifts.map(g => ({ ...g, ai_suggested: false })))
      .catch(err => console.error('Async image enrichment failed:', err))

    if (useAi) {
      pendingAiSuggestions.set(requestId, { status: 'generating' });
      generateAiGifts(age, gender, interests, profession, budget, occasion, requestId)
        .catch(() => { });
    }

    res.json({
      gifts: dbGifts.map(g => ({ ...g, ai_suggested: false })),
      aiStatus: useAi ? 'generating' : 'not_started',
      requestId: useAi ? requestId : null
    });


  } catch (error) {
    console.error('Gift recommendation initial request error:', error.message);
    if (requestId && pendingAiSuggestions.has(requestId)) {
      pendingAiSuggestions.set(requestId, { status: 'error', error: error.message || 'Initial request processing error' });
    }
    res.status(500).json({ message: 'Помилка сервера під час отримання рекомендацій.' });
  }
});

// Endpoint to check AI gift status
app.get('/api/gifts/ai-status/:requestId', authenticateToken, async (req, res) => {
  const { requestId } = req.params;
  const aiResult = pendingAiSuggestions.get(requestId);

  if (!aiResult) {
    return res.json({ status: 'pending' });
  }

  if (aiResult.status === 'completed' || aiResult.status === 'error') {
    res.json(aiResult);
    pendingAiSuggestions.delete(requestId);
  } else {
    res.json({ status: aiResult.status });
  }
});

// Background AI gift generation function (Updated)
async function generateAiGifts(age, gender, interests, profession, budget, occasion, requestId) {
  // mark as in‐progress
  pendingAiSuggestions.set(requestId, { status: 'generating' });
  console.log(`🧠 [${requestId}] Starting background AI generation (Budget: ${budget}, Occasion: ${occasion})`);

  try {
    // 1) Analyze input → tags
    const aiTags = await analyzeUserInput({ age, gender, interests, profession, occasion });
    const allTags = [
      ...(aiTags.ageTags || []),
      ...(aiTags.genderTags || []),
      ...(aiTags.interestTags || []),
      ...(aiTags.professionTags || []),
      ...(aiTags.occasionTags || [])
    ].filter(Boolean);
    console.log(`[${requestId}] LLM suggested tags:`, aiTags);
    // Updated System Prompt
    const systemPrompt = `
       Ви — експерт із підбору подарунків, що враховує бюджет та привід.
       Будь ласка, надавайте відповіді українською мовою.
     `.trim();

    // Updated User Prompt
    const userPrompt = `
       Мені потрібен ідеальний подарунок для людини з такими характеристиками:

       Вік: ${age || 'не вказано'}
       Стать: ${gender === 'male' ? 'чоловіча' : gender === 'female' ? 'жіноча' : 'не вказано'}
       Інтереси/Хобі: ${interests || 'не вказано'}
       Професія: ${profession || 'не вказано'}
       Привід: ${occasion || 'будь-який'}
       Бюджет: ${budget || 'будь-який'}

       Використовуйте українську мову. Запропонуйте 3 КОНКРЕТНІ, УНІКАЛЬНІ ідеї подарунків з описами та приблизним ціновим діапазоном, що ВІДПОВІДАЮТЬ вказаному бюджету та приводу.
       Кожен подарунок має бути представлений у такому форматі JSON:

       {
         "name": "Назва подарунка",
         "description": "Детальний опис, чому цей подарунок підходить для цього приводу та людини",
         "price_range": "$XX-$YY"
       }

       Поверніть відповідь ТІЛЬКИ як валідний JSON-масив, завжди українською мовою і без ДОДАТКОВОГО тексту, у такому і ТІЛЬКИ ТАКОМУ форматі (не забувай про [ ] на початку та в кінці):
       [
         { gift 1 },
         { gift 2 },
         { gift 3 }
       ]
     `;

    console.log(`🧠 [${requestId}] Calling LLM for gift suggestions`);
    const formatted = formatMistralPrompt(systemPrompt, userPrompt);
    const raw = await generateCompletion(formatted, { temperature: 0.75, maxTokens: 1200 });

    // 2a) Strip any [INST] tags
    const cleaned = raw.replace(/\[\/?INST\]/g, '').trim();

    // 2b) Try JSON array, else fallback to individual {…} blocks
    let suggestions;
    const arrayMatch = cleaned.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (arrayMatch) {
      suggestions = JSON.parse(arrayMatch[0]);
    } else {
      const objMatches = cleaned.match(/\{[\s\S]*?\}/g) || [];
      suggestions = objMatches.map(str => JSON.parse(str));
    }
    console.log(`🧠 [${requestId}] Parsed ${suggestions.length} suggestions from LLM`);

    // 3) Insert unique gifts
    const uniqueTags = [...new Set(allTags)]
    const aiGifts = []

    for (const gift of suggestions) {
      // 3a) skip if name exists
      const [[exists]] = await pool.query(
        'SELECT id FROM gifts WHERE name = ?',
        [gift.name]
      )
      if (exists) {
        console.log(`⚠️ [${requestId}] "${gift.name}" exists (id=${exists.id}), skipping`)
        continue
      }

      // 3c) fetch image (skip re‑translate)
      // translate once
      let name_en = null
      try {
        name_en = await translateToEnglish(gift.name)
      } catch {
        console.warn(`⚠️ [${requestId}] Translation failed for "${gift.name}"`)
      }

      // fetch image
      let image_url = null
      try {
        const queryName = name_en || gift.name
        image_url = await getImageUrl(queryName, Boolean(name_en))
      } catch {
        console.warn(`⚠️ [${requestId}] No image for "${gift.name}"`)
      }

      // 3d) parse price_range → min/max
      const parts = gift.price_range.replace(/[^0-9.-]+/g, '').split('-')
      const budget_min = parseFloat(parts[0]) || 0
      const budget_max = parseFloat(parts[1]) || budget_min

      // 3e) insert gift
      const [ins] = await pool.query(
        `INSERT INTO gifts
          (name, name_en, description, price_range, budget_min, budget_max, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [gift.name, name_en, gift.description, gift.price_range, budget_min, budget_max, image_url]
      )
      const newId = ins.insertId
      console.log(`✅ [${requestId}] Inserted "${gift.name}" (id=${newId})`)

      // 3f) link tags
      for (const tagName of uniqueTags) {
        const [[tagRow]] = await pool.query(
          'SELECT id FROM tags WHERE name = ?',
          [tagName]
        )
        if (tagRow) {
          try {
            await pool.query(
              'INSERT INTO gift_tags (gift_id, tag_id) VALUES (?, ?)',
              [newId, tagRow.id]
            )
          } catch (err) {
            console.warn(`⚠️ [${requestId}] Could not link tag "${tagName}" → gift ${newId}: ${err.message}`)
          }
        }
      }

      // 3g) collect for response
      aiGifts.push({
        id: newId,
        name: name_en,
        name_en: name_en,
        description: gift.description,
        price_range: gift.price_range,
        budget_min,
        budget_max,
        image_url,
        ai_suggested: true
      })
    }

    // 4) complete
    console.log(`🧠 [${requestId}] AI done: ${aiGifts.length} new gifts`)
    pendingAiSuggestions.set(requestId, { status: 'completed', gifts: aiGifts })

  } catch (err) {
    console.error(`🧠 [${requestId}] AI error:`, err.message)
    pendingAiSuggestions.set(requestId, { status: 'error', error: err.message })
  }
}


let isImageFetchingInProgress = false;

async function fetchAndAssignImagesInBackground(force = false) {
  if (isImageFetchingInProgress) {
    console.log('🔄 Image fetching already in progress. Skipping new run.');
    return;
  }
  isImageFetchingInProgress = true;
  console.log(`🔄 Starting background image fetch (Force: ${force})`);

  try {
    // Select gifts that need images (or all if forced)
    const sql = force
      ? 'SELECT id, name, name_en FROM gifts WHERE name IS NOT NULL AND name != ""'
      : 'SELECT id, name, name_en FROM gifts WHERE (image_url IS NULL OR image_url = "") AND name IS NOT NULL AND name != ""';
    const [giftsToUpdate] = await pool.query(sql);

    if (giftsToUpdate.length === 0) {
      console.log('✅ No gifts require image fetching.');
      return;
    }
    console.log(`🔍 Found ${giftsToUpdate.length} gifts to fetch images for.`);

    let updatedCount = 0;
    let failedCount = 0;

    for (const gift of giftsToUpdate) {
      try {
        console.log(`⏳ Fetching image for "${gift.name}"...`);

        // Prefer English name if available
        const queryName = gift.name_en || gift.name;
        const isEnglish = Boolean(gift.name_en && gift.name_en.trim());

        // Call the Pexels service with the proper flag
        const imageUrl = await getImageUrl(queryName, isEnglish);

        if (imageUrl) {
          await pool.query(
            'UPDATE gifts SET image_url = ? WHERE id = ?',
            [imageUrl, gift.id]
          );
          updatedCount++;
          console.log(`✅ Assigned image for "${queryName}".`);
        } else {
          failedCount++;
        }
      } catch (err) {
        failedCount++;
        console.error(`❌ Error processing image for "${gift.name}":`, err.message);
      }
      // Optional delay to avoid rapid-fire requests:
      await new Promise(res => setTimeout(res, 500));
    }

    console.log(`✅ Background image fetch complete. Updated: ${updatedCount}, Failed: ${failedCount}`);
  } catch (err) {
    console.error('❌ Fatal error during background image fetch:', err);
  } finally {
    isImageFetchingInProgress = false;
    console.log('🔄 Background image fetch process finished.');
  }
}

app.get('/api/refresh-images', authenticateToken, async (req, res) => { // Added auth middleware
  const forceRefresh = req.query.force === 'true';

  if (isImageFetchingInProgress) {
    return res.status(409).json({ message: 'Image refresh already in progress. Please wait.' });
  }

  // Start the background task but don't wait for it
  fetchAndAssignImagesInBackground(forceRefresh);

  res.json({ message: `Image refresh started in background${forceRefresh ? ' (forcing all images)' : ''}.` });
});

// --- Analyze User Input Helper (Updated) ---
const analyzeUserInput = async (userInput) => {
  // Destructure new field: occasion
  const { age, gender, interests, profession, occasion } = userInput;

  // Updated System Prompt
  const systemPrompt = `You are a gift recommendation assistant that analyzes user input to identify relevant tags, including occasion.`;

  // Updated User Prompt
  const userPrompt = `
    I need to find appropriate gift tags for a person with these characteristics:

    Age: ${age || 'not specified'}
    Gender: ${gender || 'not specified'}
    Interests/Hobbies: ${interests || 'not specified'}
    Profession: ${profession || 'not specified'}
    Occasion: ${occasion || 'any'}

    Extract relevant tags from our database categories:

    Age tags: ["children", "teenagers", "young adults", "adults", "seniors"]
    Gender tags: ["male", "female", "unisex"]
    Interest tags: ["reading", "gaming", "cooking", "sports", "music", "art", "technology", "travel", "fashion", "fitness", "gardening", "photography"]
    Profession tags: ["student", "teacher", "programmer", "doctor", "artist", "engineer", "business"]
    Occasion tags: ["birthday", "christmas", "anniversary", "valentines", "graduation", "thank you", "any"]

    Return your response as a valid JSON object with ONLY DATABASE CATEGORIES. Choose the most relevant tags.
    If no specific occasion is mentioned or matches, use ["any"].
    Always choose categories from the database, even if input is vague.
    Return ONLY the JSON object without ANY additional text:
    {
      "ageTags": [relevant age tags],
      "genderTags": [relevant gender tags],
      "interestTags": [relevant interest tags],
      "professionTags": [relevant profession tags],
      "occasionTags": [relevant occasion tags or ["any"]]
    }
  `;

  try {
    const formattedPrompt = formatMistralPrompt(systemPrompt, userPrompt);
    const result = await generateCompletion(formattedPrompt, {
      temperature: 0.2, // Lower temp for more deterministic tag extraction
      maxTokens: 400 // Should be enough for tags
    });
    console.log("LLM tag analysis response: ", result);
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        // Ensure occasionTags exists and defaults to ['any'] if empty or missing
        if (!parsed.occasionTags || !Array.isArray(parsed.occasionTags) || parsed.occasionTags.length === 0) {
          parsed.occasionTags = ['any'];
        }
        return parsed;
      } catch (e) {
        console.error('Failed to parse LLM tag analysis as JSON:', e);
      }
    }
    // Fallback if LLM fails or JSON is bad
    console.warn("LLM tag analysis failed, using fallback.");
    return {
      ageTags: age ? [determineAgeGroup(age)] : ["adults"],
      genderTags: gender ? [gender.toLowerCase()] : ["unisex"],
      interestTags: interests ? interests.toLowerCase().split(/,\s*/).slice(0, 1) : [], // Limit fallback interests
      professionTags: profession ? [profession.toLowerCase()] : [],
      occasionTags: occasion ? [occasion.toLowerCase()] : ['any'] // Basic fallback for occasion
    };
  } catch (error) {
    console.error('Error in analyzeUserInput:', error);
    // Fallback on complete error
    return {
      ageTags: age ? [determineAgeGroup(age)] : ["adults"],
      genderTags: gender ? [gender.toLowerCase()] : ["unisex"],
      interestTags: interests ? interests.toLowerCase().split(/,\s*/).slice(0, 1) : [],
      professionTags: profession ? [profession.toLowerCase()] : [],
      occasionTags: ['any']
    };
  }
};

// Helper function to determine age group
const determineAgeGroup = (age) => {
  const numAge = parseInt(age);
  if (isNaN(numAge)) return "adults"; // Default if age is not a number
  if (numAge < 13) return "children";
  if (numAge < 18) return "teenagers";
  if (numAge < 30) return "young adults";
  if (numAge < 65) return "adults";
  return "seniors";
};


// Helper functions
// src/api/server.js

export async function enrichGiftsWithImages(gifts) {
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
      enrichedGifts[i] = {
        ...gift,
        image_url: imageUrl || null
      };
    } catch (error) {
      console.error(`❌ Could not find image for "${queryName}":`, error.message);
      // leave gift.image_url as null
    }
  }

  return enrichedGifts;
}

// Image initialization on startup
; (async () => {
  try {
    console.log('🚀 Server starting - checking for missing gift images');
    const [giftsWithoutImages] = await pool.query(
      'SELECT id, name, name_en FROM gifts WHERE image_url IS NULL OR image_url = ""'
    );

    if (giftsWithoutImages.length === 0) {
      console.log('✅ All gifts already have images - skipping image refresh');
      return;
    }

    console.log(`🔍 Found ${giftsWithoutImages.length} gifts without images - fetching from Pexels`);
    let updatedCount = 0;

    for (const gift of giftsWithoutImages) {
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
          console.warn(`⚠️ No image for "${queryName}" (rate‑limited or not found), skipping.`);
        }
      } catch (error) {
        console.error(`❌ Failed to add image for "${gift.name}" (using "${gift.name_en}")`, error);
      }
    }

    console.log(`✅ Added images for ${updatedCount} out of ${giftsWithoutImages.length} gifts`);
  } catch (error) {
    console.error('❌ Error during initial image check:', error);
  }
})();

// periodic retry unchanged...
setInterval(async () => {
  console.log('⏳ Periodic retry to fetch missing images…');
  try {
    await fetchAndAssignImagesInBackground(false);
  } catch (err) {
    console.error('Periodic image fetch failed:', err);
  }
}, 60 * 1000);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})