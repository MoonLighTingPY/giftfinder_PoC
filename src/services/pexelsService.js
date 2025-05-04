// src/services/pexelsService.js
import axios from 'axios';
import process from 'process';
import dotenv from 'dotenv';
import { translate } from '@vitalets/google-translate-api';

dotenv.config();

const pexelsApiKey = process.env.VITE_PEXELS_API_KEY;
const imageCache = new Map();
const translationCache = new Map();

// Helper function for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to translate Ukrainian to English
async function translateToEnglish(text) {
  // Check cache first
  if (translationCache.has(text)) {
    console.log(`🔄 Using cached translation for "${text}"`);
    return translationCache.get(text);
  }

  try {
    console.log(`🌐 Translating "${text}" to English`);
    const result = await translate(text, { to: 'en' });
    const translatedText = result.text;
    
    // Cache the result
    translationCache.set(text, translatedText);
    console.log(`✅ Translated: "${text}" → "${translatedText}"`);
    
    return translatedText;
  } catch (error) {
    console.error(`❌ Translation error for "${text}":`, error.message);
    return text; // Return original text on error
  }
}

// Helper to make cancellable Pexels requests with retry
const makePexelsRequest = async (url, params, attempt = 1) => {
  const MAX_RETRIES = 1;
  const RETRY_DELAY = 20000; // 20 seconds delay on retry

  try {
    const response = await axios.get(url, {
      params,
      headers: { Authorization: pexelsApiKey }
    });
    return response.data; // Return data on success
  } catch (error) {
    // Check if it's a rate limit error (429) and we haven't exceeded retries
    if (error.response?.status === 429 && attempt < MAX_RETRIES) {
      console.warn(`⚠️ Pexels Rate Limit Hit (Attempt ${attempt}). Retrying after ${RETRY_DELAY}ms...`);
      await delay(RETRY_DELAY);
      return makePexelsRequest(url, params, attempt + 1); // Retry
    } else {
      // For other errors or max retries exceeded, re-throw
      console.error(`❌ Pexels API Error (${error.response?.status || 'Network Error'}): ${error.message}`);
      throw error; // Re-throw the original error or a custom one
    }
  }
};

export const searchImages = async (query, perPage = 1) => {
  if (imageCache.has(query)) {
    console.log(`🔄 Using cached image for "${query}"`);
    return imageCache.get(query);
  }

  console.log(`🔍 Searching Pexels for: "${query}"`);

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

    const results = data.photos || [];
    imageCache.set(query, results); // Cache fallback under original query
    return results;

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
      console.log(`🌐 Translating "${query}" to English for image search`);
      query = await translateToEnglish(query);
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

    // Fallback to simple gift search if needed
    console.log('🎁 Falling back to generic "gift" search');
    const data = await makePexelsRequest(`https://api.pexels.com/v1/search`, {
      query: 'gift present',
      per_page: 1,  // Changed from 15 to 1
      orientation: 'square',
      page: Math.floor(Math.random() * 5) + 1 // Random page for variety
    });
    
    photos = data.photos || [];
    
    if (photos.length > 0) {
      console.log(`🖼️ Using fallback gift image`);
      return photos[0].src.medium;  // Just use the first one
    }

    // If absolutely no images found after all attempts
    console.warn(`⚠️ No images found for query "${query}" after all attempts`);
    return null;

  } catch (error) {
    console.error(`❌ Error fetching image for "${query}":`, error.message);
    return null; // Return null on error
  }
};