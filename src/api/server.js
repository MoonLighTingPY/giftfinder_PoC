import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import process from 'process';
import { getImageUrl } from '../services/pexelsService.js';
import { generateCompletion, formatMistralPrompt } from '../services/llamaService.js';

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
    const { age, gender, interests, profession, budget, occasion } = req.body;
    requestId = Date.now().toString() + Math.random().toString(36).substring(2);

    // --- Start Background AI Gift Generation Immediately (Updated) ---
    generateAiGifts(age, gender, interests, profession, budget, occasion, requestId).catch(err => { // Pass budget & occasion
      console.error(`Background AI gift generation error for ${requestId}:`, err);
       if (pendingAiSuggestions.has(requestId)) {
           pendingAiSuggestions.set(requestId, { status: 'error', error: err.message || 'Unknown AI generation error' });
       }
    });
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

    // Enrich DB gifts
    const enrichedDbGifts = await enrichGiftsWithImages(dbGifts.map(g => ({...g, ai_suggested: false})));

    // 3. Return database gifts immediately
    console.log(`Sending initial response for ${requestId} with ${enrichedDbGifts.length} DB gifts.`);
    res.json({
      gifts: enrichedDbGifts,
      aiStatus: 'generating',
      requestId: requestId
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
async function generateAiGifts(age, gender, interests, profession, budget, occasion, requestId) { // Added budget, occasion
  pendingAiSuggestions.set(requestId, { status: 'generating' });
  console.log(`Starting background AI generation for ${requestId}`);

  try {
     let aiGifts = [];
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

       Поверніть відповідь ТІЛЬКИ як валідний JSON-масив, завжди українською мовою і без ДОДАТКОВОГО тексту:
       [
         { gift 1 },
         { gift 2 },
         { gift 3 }
       ]
     `;

    console.log(`🧠 [${requestId}] Using local LLM for gift suggestions (Budget: ${budget}, Occasion: ${occasion})`);
    const formattedPrompt = formatMistralPrompt(systemPrompt, userPrompt);
    const result = await generateCompletion(formattedPrompt, {
      temperature: 0.75, // Slightly higher for more variety
      maxTokens: 1200 // Increased slightly
    });

    console.log(`[${requestId}] LLM gift suggestion raw response:`, result);

    const jsonMatch = result.match(/(\[[\s\S]*?\])/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        const cleanedJsonString = jsonMatch[1].replace(/\\_/g, '_');
        aiGifts = JSON.parse(cleanedJsonString);

        aiGifts = aiGifts.map((gift, index) => ({
          ...gift,
          id: -1000 - index,
          ai_generated: true,
          ai_suggested: true,
          image_url: null,
          match_count: gift.match_count || 10 // Add default match_count if missing
        }));

        console.log(`[${requestId}] 📸 Fetching images for AI gifts...`);
        for (const gift of aiGifts) {
          if (gift.name && typeof gift.name === 'string' && gift.name.trim() !== '') {
            try {
              gift.image_url = await getImageUrl(gift.name);
              console.log(`[${requestId}] ✅ Added image for AI gift: "${gift.name}"`);
            } catch (imgError) {
              console.error(`[${requestId}] ❌ Failed image fetch for AI gift "${gift.name}":`, imgError.message);
            }
          } else {
             console.warn(`[${requestId}] ⚠️ Skipping image fetch for AI gift with invalid name:`, gift);
          }
        }

        pendingAiSuggestions.set(requestId, {
          status: 'completed',
          gifts: aiGifts
        });
        console.log(`[${requestId}] ✅ Completed background AI generation.`);

      } catch (parseError) {
        console.error(`[${requestId}] Failed to parse LLM suggestions:`, parseError);
        pendingAiSuggestions.set(requestId, { status: 'error', error: 'Failed to parse AI suggestions' });
      }
    } else {
      console.warn(`[${requestId}] ⚠️ No JSON array found in LLM response.`);
      pendingAiSuggestions.set(requestId, { status: 'error', error: 'No valid suggestions returned from AI' });
    }

  } catch (error) {
    console.error(`[${requestId}] Background AI generation error:`, error.message);
    if (pendingAiSuggestions.has(requestId)) {
        pendingAiSuggestions.set(requestId, { status: 'error', error: error.message || 'Unknown AI generation error' });
    }
  }
}


let isImageFetchingInProgress = false;
const IMAGE_FETCH_DELAY = 500; // delay between Pexels calls

// Helper function for delays (can be reused or imported)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchAndAssignImagesInBackground(force = false) {
  if (isImageFetchingInProgress) {
    console.log('🔄 Image fetching already in progress. Skipping new run.');
    return;
  }
  isImageFetchingInProgress = true;
  console.log(`🔄 Starting background image fetch (Force: ${force})`);

  try {
    const query = force
      ? 'SELECT id, name FROM gifts WHERE name IS NOT NULL AND name != ""' // Ensure name exists
      : 'SELECT id, name FROM gifts WHERE (image_url IS NULL OR image_url = "") AND name IS NOT NULL AND name != ""';

    const [giftsToUpdate] = await pool.query(query);

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
        const imageUrl = await getImageUrl(gift.name); // Uses the updated service with retry

        if (imageUrl) {
          await pool.query(
            'UPDATE gifts SET image_url = ? WHERE id = ?',
            [imageUrl, gift.id]
          );
          updatedCount++;
          console.log(`✅ Assigned image for "${gift.name}"`);
        } else {
          failedCount++;
          console.warn(`⚠️ Could not get image URL for "${gift.name}" after retries.`);
        }
      } catch (error) { // Catch errors during DB update or unexpected getImageUrl errors
        failedCount++;
        console.error(`❌ Error processing image for "${gift.name}":`, error.message);
      } finally {
        // IMPORTANT: Delay *between* processing each gift to respect rate limits
        await delay(IMAGE_FETCH_DELAY);
      }
    }
    console.log(`✅ Background image fetch complete. Updated: ${updatedCount}, Failed/Skipped: ${failedCount}`);

  } catch (error) {
    console.error('❌ Fatal error during background image fetch:', error);
  } finally {
    isImageFetchingInProgress = false; // Ensure flag is reset
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
async function enrichGiftsWithImages(gifts) {
  const enrichedGifts = [...gifts];
  
  // Process gifts without images (both DB and AI-generated)
  for (let i = 0; i < enrichedGifts.length; i++) {
    const gift = enrichedGifts[i];
    
    // Skip gifts that already have images
    if (gift.image_url) continue;
    
    try {
      // Use gift name to find an appropriate image
      const imageUrl = await getImageUrl(gift.name);
      enrichedGifts[i] = { ...gift, image_url: imageUrl };
      console.log(`✅ Added missing image for "${gift.name}"`);
    } catch (error) {
      console.error(`❌ Could not find image for "${gift.name}":`, error.message);
      // Keep the gift with null image_url
    }
  }
  
  return enrichedGifts;
}

// Image initialization on startup
(async () => {
  try {
    console.log('🚀 Server starting - checking for missing gift images');
    
    // Get all gifts WITHOUT images
    const [giftsWithoutImages] = await pool.query('SELECT id, name FROM gifts WHERE image_url IS NULL OR image_url = ""');
    
    if (giftsWithoutImages.length === 0) {
      console.log('✅ All gifts already have images - skipping image refresh');
      return;
    }
    
    console.log(`🔍 Found ${giftsWithoutImages.length} gifts without images - fetching from Pexels`);
    
    // For each gift without an image, fetch a new image from Pexels
    let updatedCount = 0;
    
    for (const gift of giftsWithoutImages) {
      try {
        const imageUrl = await getImageUrl(gift.name);
        
        // Update the gift with the new image URL
        await pool.query(
          'UPDATE gifts SET image_url = ? WHERE id = ?',
          [imageUrl, gift.id]
        );
        
        updatedCount++;
        console.log(`✅ Added image for "${gift.name}"`);
      } catch (error) {
        console.error(`❌ Failed to add image for "${gift.name}":`, error);
      }
    }
    
    console.log(`✅ Added images for ${updatedCount} out of ${giftsWithoutImages.length} gifts`);
  } catch (error) {
    console.error('❌ Error during initial image check:', error);
  }
})();

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})