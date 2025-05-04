// src/services/pexelsService.js
import axios from 'axios';
import process from 'process';
import dotenv from 'dotenv';
import { translate } from '@vitalets/google-translate-api';

dotenv.config();

const pexelsApiKey = process.env.VITE_PEXELS_API_KEY;
const imageCache = new Map();
const translationCache = new Map();


// Helper function to translate Ukrainian to English
export async function translateToEnglish(text) {
  // Check cache first
  if (translationCache.has(text)) {
    console.log(`🔄 Using cached translation for "${text}"`);
    return translationCache.get(text);
  }

  try {
    const result = await translate(text, { to: 'en' });
    const translatedText = result.text;
    
    // Cache the result
    translationCache.set(text, translatedText);
    console.log(`✅ Translated: "${text}" → "${translatedText}"`);
    
    return translatedText;
  } catch (error) {
    console.error(`❌ Translation error for "${text}":`, error.message);
    return null; // Return null on error
  }
}

// Helper to make cancellable Pexels requests
const makePexelsRequest = async (url, params) => {
  try {
    const response = await axios.get(url, {
      params,
      headers: { Authorization: pexelsApiKey }
    });
    return response.data; // Return data on success
  } catch (error) {
    // Check if it's a rate limit error (429) and we haven't exceeded retries
    if (error.response?.status === 429) {
      console.warn(`⚠️ Pexels Rate Limit Hit`);
      return [];
    } 
  }
};

export const searchImages = async (query, perPage = 1) => {
  if (imageCache.has(query)) {
    console.log(`🔄 Using cached image for "${query}"`);
    return imageCache.get(query);
  }

  try {
    // First try with the exact query
    let data = await makePexelsRequest(`https://api.pexels.com/v1/search`, {
      query,
      per_page: perPage,
      orientation: 'square'
    });

    if (data.photos && data.photos.length > 0) {
      console.log(`✅ Found ${data.photos.length} images for "${query}"`);
      imageCache.set(query, data.photos);
      return data.photos;
    }

  // eslint-disable-next-line no-unused-vars
  } catch (error) {
    // Error already logged in makePexelsRequest
    return []; // Return empty array on failure
  }
};

export const getImageUrl = async (query, isEnglish) => {
  try {
    // Translate the query from Ukrainian to English
    if (!isEnglish) {
      const translated = await translateToEnglish(query);
      // Only use the translated value if translation succeeded
      if (translated) {
        query = translated;
        console.log(`🔍 Using translated query: "${query}"`);
      } else {
        console.log(`⚠️ Translation failed, using original query: "${query}"`);
      }
    } else {
      console.log(`🔍 Searching for image with query: "${query}"`);
    }
    
    // Use translated query for image search - only need 1 image
    let photos = await searchImages(query, 1);  // Changed from 15 to 1

    // If we got a result, use it
    if (photos && photos.length > 0) {
      console.log(`🖼️ Using image for "${query}": ${photos[0].src.medium}`);
      return photos[0].src.medium;  // Just use the first one directly
    }
    return null;

  } catch (error) {
    console.error(`❌ Error fetching image for "${query}":`, error.message);
    return null; // Return null on error
  }
};