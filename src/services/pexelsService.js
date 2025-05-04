// src/services/pexelsService.js
import axios from 'axios';
import process from 'process';
import dotenv from 'dotenv';

dotenv.config();

// Use the API key
const pexelsApiKey = process.env.VITE_PEXELS_API_KEY;

// Cache for images we've already searched for
const imageCache = new Map();

export const searchImages = async (query, perPage = 1) => {
  // Check if we've already searched for this query
  if (imageCache.has(query)) {
    console.log(`🔄 Using cached image for "${query}"`);
    return imageCache.get(query);
  }
  
  console.log(`🔍 Searching Pexels for: "${query}" with key: ${pexelsApiKey.substring(0, 5)}...`);
  
  try {
    // First try with the exact query
    const response = await axios.get(`https://api.pexels.com/v1/search`, {
      params: {
        query,
        per_page: perPage,
        orientation: 'square'
      },
      headers: {
        Authorization: pexelsApiKey
      }
    });
    
    if (response.data.photos && response.data.photos.length > 0) {
      console.log(`✅ Found ${response.data.photos.length} images for "${query}"`);
      // Cache the results
      imageCache.set(query, response.data.photos);
      return response.data.photos;
    }
    
    // If no results, try with first word only
    if (query.includes(' ')) {
      const mainKeyword = query.split(' ')[0];
      console.log(`🔎 Trying with first word: "${mainKeyword}"`);
      
      const fallbackResponse = await axios.get(`https://api.pexels.com/v1/search`, {
        params: {
          query: mainKeyword,
          per_page: perPage,
          orientation: 'square'
        },
        headers: {
          Authorization: pexelsApiKey
        }
      });
      
      if (fallbackResponse.data.photos && fallbackResponse.data.photos.length > 0) {
        console.log(`✅ Found ${fallbackResponse.data.photos.length} images for "${mainKeyword}"`);
        // Cache the results
        imageCache.set(query, fallbackResponse.data.photos);
        return fallbackResponse.data.photos;
      }
    }
    
    // If still no results, search for "gift"
    console.log('🎁 Falling back to generic "gift" search');
    const giftResponse = await axios.get(`https://api.pexels.com/v1/search`, {
      params: {
        query: 'gift present',
        per_page: perPage,
        orientation: 'square'
      },
      headers: {
        Authorization: pexelsApiKey
      }
    });
    
    // Cache even generic results
    const fallbackResults = giftResponse.data.photos || [];
    imageCache.set(query, fallbackResults);
    return fallbackResults;
  } catch (error) {
    console.error('❌ Error fetching images from Pexels:', error);
    return [];
  }
};

export const getImageUrl = async (query) => {
  try {
    // Create a more unique search term by adding a random word from this list
    const diversifiers = ["colorful", "beautiful", "modern", "elegant", "creative", "unique", "special"];
    const randomDiversifier = diversifiers[Math.floor(Math.random() * diversifiers.length)];
    
    // Try to get images for the original query
    let photos = await searchImages(query);
    
    // If nothing found and it's falling back to generic "gift" search,
    // add a random page number and random diversifier to get different results
    if (!photos.length || photos[0].src.medium.includes("16116703")) {
      console.log(`🎨 Diversifying search with "${randomDiversifier} gift"`);
      const randomPage = Math.floor(Math.random() * 5) + 1; // Get a random page between 1-5
      
      const diverseResponse = await axios.get(`https://api.pexels.com/v1/search`, {
        params: {
          query: `${randomDiversifier} gift`,
          per_page: 15,
          page: randomPage,
          orientation: 'square'
        },
        headers: {
          Authorization: pexelsApiKey
        }
      });
      
      photos = diverseResponse.data.photos || [];
      
      // Pick a random photo from the results instead of always the first one
      if (photos.length > 0) {
        const randomIndex = Math.floor(Math.random() * photos.length);
        console.log(`🖼️ Using diversified random image (#${randomIndex}) for ${query}`);
        return photos[randomIndex].src.medium;
      }
    }
    
    if (photos && photos.length > 0) {
      console.log(`🖼️ Using image for ${query}: ${photos[0].src.medium}`);
      return photos[0].src.medium;
    }
    
    throw new Error('No images found');
  } catch (error) {
    console.error(`❌ Failed to get image for ${query}:`, error);
    throw error;
  }
};