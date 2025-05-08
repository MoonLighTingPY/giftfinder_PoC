// src/services/pexelsService.js
import axios from 'axios';
import process from 'process';
import dotenv from 'dotenv';
import { translate } from '@vitalets/google-translate-api';
import { formatMistralPrompt, generateCompletion } from './aiService.js';

dotenv.config();

const pexelsApiKey = process.env.VITE_PEXELS_API_KEY;
const imageCache = new Map();
const translationCache = new Map();

// Функція для перекладу тексту з української на англійську
export async function translateToEnglish(text) {
  // 0) Якщо текст вже є в кеші, повертаємо його
  if (translationCache.has(text)) {
    console.log(`🔄 Using cached translation for "${text}"`)
    return translationCache.get(text)
  }

  // 1) Пробуємо Google Translate
  try {
    const result = await translate(text, { to: 'en' })
    const translatedText = result.text.trim()
    translationCache.set(text, translatedText)
    console.log(`✅ Google translated "${text}" → "${translatedText}"`)
    return translatedText
  } catch (err) {
    // Вперлися в ліміт (код 429) або інша помилка
    console.warn(`❌ Google translation failed for "${text}": ${err.message}`)
  }

  // 2) Пробуємо вже ШІ, якщо гугл перекладач не спрацював
  try {
    console.log(`🤖 LLM translating "${text}" → English`)
    const systemPrompt =
      "You are a helpful assistant that translates Ukrainian to English. " +
      "Reply with ONLY the translation (no extra text). " +
      "If the input exceeds two words, ALWAYS produce a translation of at most two words. Never more than two twords!" +
      "If the text is already English, return it unchanged." +
      "NEVER add \"\" to your response, this is PROHIBITED! EVEN IF THE INPUT HAS \"\"!";
    const prompt = formatMistralPrompt(systemPrompt, text)
    const llamaResult = await generateCompletion(prompt, { temperature: 0, maxTokens: 100 })
    const llamaTranslation = llamaResult.trim()
    translationCache.set(text, llamaTranslation)
    console.log(`✅ Llama translated "${text}" → "${llamaTranslation}"`)
    return llamaTranslation
  } catch (err) {
    console.error(`❌ Llama translation failed for "${text}": ${err.message}`)
    return null
  }
}

// Функція для запиту до Pexels API
const makePexelsRequest = async (url, params) => {
  try {
    const response = await axios.get(url, {
      params,
      headers: { Authorization: pexelsApiKey }
    });
    return response.data; // Повертаємо дані з відповіді
  } catch (error) {
    // Перекриваємо помилку, чи це статус 429 (ліміт запитів)
    if (error.response?.status === 429) {
      console.warn(`⚠️ Pexels Rate Limit Hit`);
      return [];
    }
  }
};

// Функція для пошуку зображень за запитом
export const searchImages = async (query, perPage = 1) => {
  if (imageCache.has(query)) {
    console.log(`🔄 Using cached image for "${query}"`);
    return imageCache.get(query);
  }

  try {
    // Пробуємо знайти зображення за запитом
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
    // Помилка вже оброблена в makePexelsRequest
    return []; // Повертаємо пустий масив, якщо не вдалося знайти зображення
  }
};

export const getImageUrl = async (query, isEnglish) => {
  try {
    // Перекладаємо запит, якщо він не англійською
    if (!isEnglish) {
      const translated = await translateToEnglish(query);
      // Тільки використовуємо переклад, якщо він успішний (щоб не було null/українською)
      if (translated) {
        query = translated;
        console.log(`🔍 Using translated query: "${query}"`);
      } else {
        console.log(`⚠️ Translation failed, using original query: "${query}"`);
      }
    } else {
      console.log(`🔍 Searching for image with query: "${query}"`);
    }

    // Пошук зображень за запитом
    let photos = await searchImages(query, 1); // Повертаємо тільки перше зображення

    // Якщо знайдено зображення, повертаємо його URL
    if (photos && photos.length > 0) {
      console.log(`🖼️ Using image for "${query}": ${photos[0].src.medium}`);
      return photos[0].src.medium;  // Просто перше зображення
    }
    return null;

  } catch (error) {
    console.error(`❌ Error fetching image for "${query}":`, error.message);
    return null; // Повертаємо null, якщо не вдалося отримати зображення, щоб уникнути помилок
  }
};