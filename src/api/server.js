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

// Gift recommendation endpoint
// Gift recommendation endpoint
app.post('/api/gifts/recommend', authenticateToken, async (req, res) => {
  try {
    const { age, gender, interests, profession } = req.body;
    
    // First approach: Get database gifts based on tags
    const aiTags = await analyzeUserInput({ age, gender, interests, profession });
    console.log('LLM suggested tags:', aiTags);
    
    // Build the query with the LLM-suggested tags
    let query = `
      SELECT 
        g.*, 
        COUNT(DISTINCT t.id) as match_count
      FROM 
        gifts g
      JOIN 
        gift_tags gt ON g.id = gt.gift_id
      JOIN
        tags t ON gt.tag_id = t.id
      WHERE 1=1
    `;
    
    const queryParams = [];
    
    // Add conditions for age tags
    if (aiTags.ageTags.length > 0) {
      query += ` AND EXISTS (
        SELECT 1 FROM gift_tags gt2 
        JOIN tags t2 ON gt2.tag_id = t2.id 
        WHERE gt2.gift_id = g.id AND t2.category = 'age' AND t2.name IN (?)
      )`;
      queryParams.push(aiTags.ageTags);
    }
    
    // Add conditions for gender tags
    if (aiTags.genderTags.length > 0) {
      query += ` AND EXISTS (
        SELECT 1 FROM gift_tags gt3 
        JOIN tags t3 ON gt3.tag_id = t3.id 
        WHERE gt3.gift_id = g.id AND t3.category = 'gender' AND t3.name IN (?)
      )`;
      queryParams.push(aiTags.genderTags);
    }
    
    // Add conditions for interest tags if specified
    if (aiTags.interestTags.length > 0) {
      query += ` AND EXISTS (
        SELECT 1 FROM gift_tags gt4 
        JOIN tags t4 ON gt4.tag_id = t4.id 
        WHERE gt4.gift_id = g.id AND t4.category = 'interest' AND t4.name IN (?)
      )`;
      queryParams.push(aiTags.interestTags);
    }
    
    // Add conditions for profession tags if specified
    if (aiTags.professionTags.length > 0) {
      query += ` AND EXISTS (
        SELECT 1 FROM gift_tags gt5 
        JOIN tags t5 ON gt5.tag_id = t5.id 
        WHERE gt5.gift_id = g.id AND t5.category = 'profession' AND t5.name IN (?)
      )`;
      queryParams.push(aiTags.professionTags);
    }
    
    // Group by gift ID and order by match count and ID
    query += `
      GROUP BY g.id
      ORDER BY match_count DESC, g.id
      LIMIT 8
    `;
    
    // console.log('SQL query:', query);
    // console.log('Query params:', queryParams);
    
    // Execute the query
    const [dbGifts] = await pool.query(query, queryParams);
    console.log(`Found ${dbGifts.length} gifts from database`);
    
    // Get AI-generated gift suggestions using only Llama
    const systemPrompt = `You are a gift recommendation expert system that suggests personalized gifts based on a person's characteristics.`;

    const userPrompt = `
      I need to find the perfect gift for a person with these characteristics:
      
      Age: ${age || 'not specified'}
      Gender: ${gender === 'male' ? 'male' : gender === 'female' ? 'female' : 'not specified'}
      Interests/Hobbies: ${interests || 'not specified'}
      Profession: ${profession || 'not specified'}
      
      Suggest 3 specific gift ideas with descriptions and approximate price ranges.
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
    
    let aiGifts = [];
    
    try {
      console.log('🧠 Using local LLM for gift suggestions');
      const formattedPrompt = formatMistralPrompt(systemPrompt, userPrompt);
      const result = await generateCompletion(formattedPrompt, {
        temperature: 0.7,
        maxTokens: 3000
      });
      
      console.log('LLM gift suggestion response length:', result.length);
      console.log('LLM gift suggestion response:', result);
      
      // Extract JSON from text response
      const jsonMatch = result.match(/(\[[\s\S]*?\])/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          aiGifts = JSON.parse(jsonMatch[1]);
          
          // Ensure all AI gifts have an ID (negative to distinguish from DB gifts)
          aiGifts = aiGifts.map((gift, index) => ({
            ...gift,
            id: -1000 - index, // Use negative IDs for AI-generated gifts
            ai_generated: true,
            image_url: null // Will be populated by enrichGiftsWithImages
          }));
        } catch (e) {
          console.error('Failed to parse LLM gift suggestions as JSON:', e);
          aiGifts = [];
        }
      }
    } catch (error) {
      console.error('LLM gift suggestion error:', error.message);
      aiGifts = [];
    }
    
    // Combine database gifts with AI-generated gifts
    let combinedGifts = [...dbGifts];
    
    // Only add AI gifts if we have valid ones
    if (aiGifts.length > 0) {
      combinedGifts = [...combinedGifts, ...aiGifts];
    }
    
    // Ensure we have at least some gifts
    if (combinedGifts.length === 0) {
      const [randomGifts] = await pool.query(
        'SELECT * FROM gifts ORDER BY RAND() LIMIT 5'
      );
      combinedGifts = randomGifts;
    }
    
    // Enrich gifts with images
    const enrichedGifts = await enrichGiftsWithImages(combinedGifts);
    
    // Add a badge or indicator for AI-generated suggestions
    const finalGifts = enrichedGifts.map(gift => ({
      ...gift,
      ai_suggested: gift.ai_generated === true
    }));
    
    res.json(finalGifts);
    
  } catch (error) {
    console.error('Gift recommendation error:', error.message);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

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
  // Simply return the gifts without attempting to fetch missing images
  // AI-generated gifts still need a default null image_url if they don't have one
  return gifts.map(gift => {
    if (gift.ai_generated && !gift.image_url) {
      return { ...gift, image_url: null };
    }
    return gift;
  });
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