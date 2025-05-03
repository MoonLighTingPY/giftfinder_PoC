// services/aiService.js
import axios from 'axios'

export const getAIRecommendations = async (recipientInfo) => {
  try {
    // Format the prompt for the AI
    const prompt = `Suggest gift ideas for a ${recipientInfo.age} year old ${recipientInfo.gender} 
      who is interested in ${recipientInfo.interests} and works as a ${recipientInfo.profession}.
      List 5 specific gift ideas with brief descriptions and price ranges.`
    
    // Using HuggingFace Inference API (free tier)
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/gpt2',
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 150,
          temperature: 0.7,
          return_full_text: false
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_AI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    return response.data[0].generated_text
  } catch (error) {
    console.error('AI recommendation error:', error)
    throw error
  }
}