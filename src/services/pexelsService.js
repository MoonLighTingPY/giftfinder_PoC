// src/services/pexelsService.js
import axios from 'axios';
import process from 'process';
import dotenv from 'dotenv';

dotenv.config();

const pexelsApiKey = process.env.VITE_PEXELS_API_KEY;
const imageCache = new Map();

// Helper function for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to make cancellable Pexels requests with retry
const makePexelsRequest = async (url, params, attempt = 1) => {
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 20000; // 2.5 seconds delay on retry

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

    // If no results, try with first word only
    if (query.includes(' ')) {
      const mainKeyword = query.split(' ')[0];
      console.log(`🔎 Trying with first word: "${mainKeyword}"`);
      data = await makePexelsRequest(`https://api.pexels.com/v1/search`, {
        query: mainKeyword,
        per_page: perPage,
        orientation: 'square'
      });

      if (data.photos && data.photos.length > 0) {
        console.log(`✅ Found ${data.photos.length} images for "${mainKeyword}"`);
        imageCache.set(query, data.photos); // Cache under original query
        return data.photos;
      }
    }

    // If still no results, search for "gift"
    console.log('🎁 Falling back to generic "gift" search');
    data = await makePexelsRequest(`https://api.pexels.com/v1/search`, {
      query: 'gift present', // Keep generic query simple
      per_page: perPage,
      orientation: 'square'
    });

    const fallbackResults = data.photos || [];
    imageCache.set(query, fallbackResults); // Cache fallback under original query
    return fallbackResults;

  // eslint-disable-next-line no-unused-vars
  } catch (error) {
    return []; // Return empty array on failure
  }
};

export const getImageUrl = async (query) => {
  try {
    const diversifiers = ["colorful", "beautiful", "modern", "elegant", "creative", "unique", "special"];
    const randomDiversifier = diversifiers[Math.floor(Math.random() * diversifiers.length)];

    let photos = await searchImages(query, 15); // Fetch more images initially

    // Check if fallback was used or specific problematic image appeared
    const isFallback = !photos.length || (photos[0]?.src?.medium?.includes("16116703"));

    if (isFallback) {
      console.log(`🎨 Diversifying search with "${randomDiversifier} gift"`);
      const randomPage = Math.floor(Math.random() * 5) + 1;
      const data = await makePexelsRequest(`https://api.pexels.com/v1/search`, {
        query: `${randomDiversifier} gift`,
        per_page: 15,
        page: randomPage,
        orientation: 'square'
      });
      photos = data.photos || [];

      if (photos.length > 0) {
        const randomIndex = Math.floor(Math.random() * photos.length);
        console.log(`🖼️ Using diversified random image (#${randomIndex}) for ${query}`);
        return photos[randomIndex].src.medium;
      }
    }

    // If we got results from the initial search (and it wasn't the problematic one)
    if (photos && photos.length > 0) {
       // Pick a random one from the initial results too for variety
       const randomIndex = Math.floor(Math.random() * Math.min(photos.length, 5)); // Pick from first 5
       console.log(`🖼️ Using image (#${randomIndex}) for ${query}: ${photos[randomIndex].src.medium}`);
       return photos[randomIndex].src.medium;
    }

    // If absolutely no images found after all attempts
    console.warn(`⚠️ No images found for query "${query}" after all fallbacks.`);
    return null; // Return null instead of throwing error

  // eslint-disable-next-line no-unused-vars
  } catch (error) {
    return null; // Return null on error
  }
};