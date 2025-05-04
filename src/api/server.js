// src/api/server.js
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mysql from 'mysql2/promise'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import process from 'process'
import { getImageUrl } from '../services/pexelsService.js';
import { generateCompletion, formatMistralPrompt } from '../services/llamaService.js';

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gift_finder',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  
  if (!token) return res.status(401).json({ message: 'Unauthorized' })
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Forbidden' })
    req.user = user
    next()
  })
}

// Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body
    
    // Check if user already exists
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, email]
    )
    
    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'Username or email already exists' })
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)
    
    // Insert new user
    // eslint-disable-next-line no-unused-vars
    const [_] = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    )
    
    res.status(201).json({ message: 'User created successfully' })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body
    
    // Find user
    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    )
    
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }
    
    const user = users[0]
    
    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash)
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }
    
    // Generate JWT
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )
    
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      token
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

const pendingAiSuggestions = new Map();

// src/api/server.js

// Gift recommendation endpoint
app.post('/api/gifts/recommend', authenticateToken, async (req, res) => {
  let requestId = null; // Declare requestId outside the try block

  try {
    const { age, gender, interests, profession } = req.body;
    requestId = Date.now().toString() + Math.random().toString(36).substring(2); // Assign value inside try

    // --- Start Background AI Gift Generation Immediately ---
    generateAiGifts(age, gender, interests, profession, requestId).catch(err => {
      console.error(`Background AI gift generation error for ${requestId}:`, err);
       if (pendingAiSuggestions.has(requestId)) {
           pendingAiSuggestions.set(requestId, { status: 'error', error: err.message || 'Unknown AI generation error' });
       }
    });
    // -----------------------------------------------------

    // 1. Analyze user input
    const aiTags = await analyzeUserInput({ age, gender, interests, profession });
    console.log('LLM suggested tags:', aiTags);

    // 2. Query database
    let dbGifts = [];
    const allSuggestedTags = [
      ...(aiTags.ageTags || []),
      ...(aiTags.genderTags || []),
      ...(aiTags.interestTags || []),
      ...(aiTags.professionTags || [])
    ].filter(tag => tag);

    if (allSuggestedTags.length > 0) {
      const query = `
        SELECT g.*, COUNT(DISTINCT t.id) as match_count
        FROM gifts g JOIN gift_tags gt ON g.id = gt.gift_id JOIN tags t ON gt.tag_id = t.id
        WHERE t.name IN (?) GROUP BY g.id ORDER BY match_count DESC, g.id LIMIT 8
      `;
      try {
        [dbGifts] = await pool.query(query, [allSuggestedTags]);
        console.log(`Found ${dbGifts.length} gifts from database matching tags`);
      } catch (sqlError) {
        console.error('SQL Error executing recommendation query:', sqlError);
        dbGifts = [];
      }
    } else {
      console.log('No valid tags suggested by LLM or extracted.');
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
    // Now requestId is accessible here
    if (requestId && pendingAiSuggestions.has(requestId)) {
         pendingAiSuggestions.set(requestId, { status: 'error', error: error.message || 'Initial request processing error' });
    }
    res.status(500).json({ message: 'Помилка сервера під час отримання рекомендацій.' });
  }
});

// Endpoint to check AI gift status (ensure this exists)
app.get('/api/gifts/ai-status/:requestId', authenticateToken, async (req, res) => {
  const { requestId } = req.params;
  const aiResult = pendingAiSuggestions.get(requestId);

  if (!aiResult) {
    // Maybe the request is still initializing or ID is wrong
    return res.json({ status: 'pending' }); // Or return 404 if you prefer
  }

  if (aiResult.status === 'completed' || aiResult.status === 'error') {
    // Send result and remove from map
    res.json(aiResult);
    pendingAiSuggestions.delete(requestId); // Clean up memory
  } else {
    // Still generating
    res.json({ status: aiResult.status });
  }
});


// Background AI gift generation function (ensure this exists and updates pendingAiSuggestions map)
async function generateAiGifts(age, gender, interests, profession, requestId) {
  // Store initial pending status
  pendingAiSuggestions.set(requestId, { status: 'generating' });
  console.log(`Starting background AI generation for ${requestId}`);

  try {
    // ... (rest of the AI generation logic as before: system/user prompts, generateCompletion, parsing, image fetching) ...
    // ... (ensure it correctly parses JSON and fetches images) ...

    // Example structure after successful generation and image fetching:
    // const finalAiGifts = aiGifts.map(gift => ({ ...gift, ai_suggested: true })); // Ensure flag is set

    // Store successful result
    // pendingAiSuggestions.set(requestId, {
    //   status: 'completed',
    //   gifts: finalAiGifts // The array of AI-generated gifts with images
    // });
    // console.log(`Completed background AI generation for ${requestId}`);

     let aiGifts = [];
     const systemPrompt = `
     You are a gift recommendation expert bot that suggests gifts based on user characteristics.
     You return your answer ONLY as a valid JSON array, always in Ukrainian language and at without ANY additional text
   `.trim();

   const userPrompt = `
     I need to find the perfect gift for a person with these characteristics:
     
     Age: ${age || 'not specified'}
     Gender: ${gender === 'male' ? 'male' : gender === 'female' ? 'female' : 'not specified'}
     Interests/Hobbies: ${interests || 'not specified'}
     Profession: ${profession || 'not specified'}
     
     Suggest 3 specific gift ideas with descriptions and approximate price ranges.
     Make sure they are not repetitive and are suitable for the given characteristics.
     Each gift should be unique, not repetitive and relevant to the user.
     Make sure the names and descriptions are not repetitive and are suitable for the given characteristics.
     Each gift should be presented in this JSON format:
     
     {
       "name": "Gift Name",
       "description": "Detailed description of why this gift is suitable",
       "price_range": "$XX-$YY",
       "match_count": 10
     }
     
     Return your answer ONLY as a valid JSON array, always in Ukrainian language and at all costs without ANY additional text:
     [
       { gift 1 },
       { gift 2 },
       { gift 3 }
     ]
   `;

    console.log(`🧠 [${requestId}] Using local LLM for gift suggestions`);
    const formattedPrompt = formatMistralPrompt(systemPrompt, userPrompt);
    const result = await generateCompletion(formattedPrompt, {
      temperature: 0.7,
      maxTokens: 1000
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
          ai_generated: true, // Keep this internal flag if needed
          ai_suggested: true, // Flag for frontend
          image_url: null
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
    // Ensure status is updated on error
    if (pendingAiSuggestions.has(requestId)) {
        pendingAiSuggestions.set(requestId, { status: 'error', error: error.message || 'Unknown AI generation error' });
    }
  }
}

// Image refresh endpoint
app.get('/api/refresh-images', async (req, res) => {
  try {
    console.log('🔄 Refreshing gift images from Pexels');
    
    // Get parameter for force refresh
    const forceRefresh = req.query.force === 'true';
    
    // Get gifts that need images
    const query = forceRefresh 
      ? 'SELECT id, name FROM gifts' 
      : 'SELECT id, name FROM gifts WHERE image_url IS NULL OR image_url = ""';
    
    const [giftsToUpdate] = await pool.query(query);
    
    if (giftsToUpdate.length === 0) {
      return res.json({ 
        message: 'All gifts already have images',
        refreshed: 0,
        total: 0
      });
    }
    
    console.log(`Found ${giftsToUpdate.length} gifts to update`);
    
    // For each gift, fetch a new image from Pexels
    let updatedCount = 0;
    
    for (const gift of giftsToUpdate) {
      try {
        const imageUrl = await getImageUrl(gift.name);
        
        // Update the gift with the new image URL
        await pool.query(
          'UPDATE gifts SET image_url = ? WHERE id = ?',
          [imageUrl, gift.id]
        );
        
        updatedCount++;
        console.log(`✅ Updated image for "${gift.name}": ${imageUrl}`);
      } catch (error) {
        console.error(`❌ Failed to update image for "${gift.name}":`, error);
      }
    }
    
    res.json({ 
      message: `Successfully refreshed ${updatedCount} out of ${giftsToUpdate.length} gift images`,
      refreshed: updatedCount,
      total: giftsToUpdate.length
    });
  } catch (error) {
    console.error('Error refreshing images:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

const analyzeUserInput = async (userInput) => {
  const { age, gender, interests, profession } = userInput;
  
  const systemPrompt = `You are a gift recommendation assistant that analyzes user input to identify relevant tags.`;
  
  const userPrompt = `
    I need to find appropriate gift tags for a person with these characteristics:
    
    Age: ${age || 'not specified'}
    Gender: ${gender || 'not specified'}
    Interests/Hobbies: ${interests || 'not specified'}
    Profession: ${profession || 'not specified'}
    
    Extract relevant tags from our database categories:
    
    Age tags: ["children", "teenagers", "young adults", "adults", "seniors"]
    Gender tags: ["male", "female", "unisex"]
    Interest tags: ["reading", "gaming", "cooking", "sports", "music", "art", "technology", "travel", "fashion", "fitness", "gardening", "photography"]
    Profession tags: ["student", "teacher", "programmer", "doctor", "artist", "engineer", "business"]
    
    Return your response as a valid JSON object with ONLY DATABASE CATEGORIES(dont just repeat the prompt, choose from what has been provided), even if
    the characteristics from the prompt are very different from the ones that are in the database - choose one random from the database. always choose categories from the database.
    and without ANY additional text:
    {
      "ageTags": [relevant age tags],
      "genderTags": [relevant gender tags],
      "interestTags": [relevant interest tags],
      "professionTags": [relevant profession tags]
    }
  `;
  
  try {
    const formattedPrompt = formatMistralPrompt(systemPrompt, userPrompt);
    const result = await generateCompletion(formattedPrompt, {
      temperature: 0.3,
      maxTokens: 3000
    });
    console.log("LLM response: ", result);
    // Extract JSON from response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('Failed to parse LLM tag analysis as JSON:', e);
        // Default fallback tags if parsing fails
        return {
          ageTags: age ? [determineAgeGroup(age)] : ["adults"],
          genderTags: gender ? [gender.toLowerCase()] : ["unisex"],
          interestTags: interests ? interests.toLowerCase().split(/,\s*/).slice(0, 3) : [],
          professionTags: profession ? [profession.toLowerCase()] : []
        };
      }
    }
    
    // If no JSON found, use basic tag extraction
    return {
      ageTags: age ? [determineAgeGroup(age)] : ["adults"],
      genderTags: gender ? [gender.toLowerCase()] : ["unisex"],
      interestTags: interests ? interests.toLowerCase().split(/,\s*/).slice(0, 3) : [],
      professionTags: profession ? [profession.toLowerCase()] : []
    };
  } catch (error) {
    console.error('Error in analyzeUserInput:', error);
    // Simple fallback tags if LLM fails completely
    return {
      ageTags: age ? [determineAgeGroup(age)] : ["adults"],
      genderTags: gender ? [gender.toLowerCase()] : ["unisex"],
      interestTags: interests ? interests.toLowerCase().split(/,\s*/).slice(0, 3) : [],
      professionTags: profession ? [profession.toLowerCase()] : []
    };
  }
};

/**
 * Helper function to determine age group from numerical age
 */
const determineAgeGroup = (age) => {
  const numAge = parseInt(age);
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