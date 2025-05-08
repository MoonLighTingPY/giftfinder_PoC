import axios from 'axios'
import dotenv from 'dotenv'
import process from 'process'
dotenv.config()

// Змінні оточення для Groq Cloud
const groqApiKey = process.env.VITE_GROG_CLOUD_API_KEY
const groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions'
const groqModel = process.env.VITE_GROG_MODEL

// Обгортає виклик до Groq Cloud API в правильний формат
export function formatMistralPrompt(systemMessage, userMessage) {
  if (systemMessage?.trim()) {
    return `<s>[INST] ${systemMessage}\n\n${userMessage} [/INST]\n`
  }
  return `<s>[INST] ${userMessage} [/INST]\n`
}

// Сам запит до ШІ від Groq Cloud, де вказується модель, повідомлення та параметри
export async function generateCompletion(prompt, options = {}) {
  const payload = {
    model: groqModel,
    messages: [{ role: 'user', content: prompt }],
    ...('temperature' in options && { temperature: options.temperature }),
    ...('max_tokens' in options && { max_tokens: options.maxTokens })
  }

  const res = await axios.post(
    groqEndpoint,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`
      }
    }
  )

  return res.data.choices?.[0]?.message?.content ?? ''
}