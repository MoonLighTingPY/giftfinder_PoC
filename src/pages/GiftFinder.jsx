// src/pages/GiftFinder.jsx
import { useState } from 'react'
import axios from 'axios'
import { useSelector } from 'react-redux'
import '../styles/pages/GiftFinder.css'
import { useRef } from 'react';

const GiftFinder = () => {
  const imagesLoadedRef = useRef(false);
  const [recipientInfo, setRecipientInfo] = useState({
    age: '',
    gender: '',
    interests: '',
    profession: '',
  })
  const [gifts, setGifts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const token = useSelector(state => state.auth.token)



  const handleChange = (e) => {
    const { name, value } = e.target
    setRecipientInfo(prev => ({ ...prev, [name]: value }))
  }

  // Update handleSubmit in src/pages/GiftFinder.jsx
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setGifts([])
    setError('') // Clear any previous errors
    imagesLoadedRef.current = false;
    
    try {
      console.log('Sending request with:', recipientInfo)
      
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/gifts/recommend`,
        recipientInfo,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )
      
      console.log('Received gifts:', response.data)
      setGifts(response.data)
      
      if (response.data.length === 0) {
        setError('На жаль, подарунків за вашими критеріями не знайдено. Спробуйте змінити параметри пошуку.')
      }
    } catch (error) {
      console.error('Помилка отримання рекомендацій:', error)
      setError('Виникла помилка при пошуку подарунків. Будь ласка, спробуйте пізніше.')
    } finally {
      setLoading(false)
    }
  }

  

  return (
    <div className="container">
      <h1>Пошук Подарунків</h1>
      
      <form onSubmit={handleSubmit} className="gift-form">
        <div className="form-group">
          <label>Вік:</label>
          <input 
            type="number" 
            name="age" 
            value={recipientInfo.age} 
            onChange={handleChange} 
            required 
          />
        </div>
        
        <div className="form-group">
          <label>Стать:</label>
          <select 
            name="gender" 
            value={recipientInfo.gender} 
            onChange={handleChange} 
            required
          >
            <option value="">Оберіть стать</option>
            <option value="male">Чоловіча</option>
            <option value="female">Жіноча</option>
            <option value="other">Інша</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Інтереси/Хобі:</label>
          <textarea 
            name="interests" 
            value={recipientInfo.interests} 
            onChange={handleChange} 
            placeholder="Введіть інтереси, розділені комами" 
            required
          ></textarea>
        </div>
        
        <div className="form-group">
          <label>Професія:</label>
          <input 
            type="text" 
            name="profession" 
            value={recipientInfo.profession} 
            onChange={handleChange} 
          />
        </div>
        
        <button type="submit" disabled={loading}>
          {loading ? 'Пошук подарунків...' : 'Знайти подарунки'}
        </button>
      </form>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {loading && <p>Шукаємо ідеальні подарунки...</p>}
      
      {gifts.length > 0 && (
        <div className="gifts-container">
          <h2>Рекомендовані подарунки</h2>
          <p className="recommendation-note">
            Підібрано на основі ваших критеріїв: 
            {recipientInfo.age && ` вік (${recipientInfo.age}),`}
            {recipientInfo.gender && ` стать (${
              recipientInfo.gender === 'male' ? 'чоловіча' : 
              recipientInfo.gender === 'female' ? 'жіноча' : 'інша'
            }),`}
            {recipientInfo.interests && ` інтереси (${recipientInfo.interests}),`}
            {recipientInfo.profession && ` професія (${recipientInfo.profession})`}
          </p>
          <div className="gift-list">
          {gifts.map((gift) => (
            <div key={gift.id} className={`gift-card ${gift.ai_suggested ? 'ai-suggested' : ''}`}>
              {gift.ai_suggested && (
                <div className="ai-badge">AI</div>
              )}
              
              {gift.image_url ? (
                <div className="gift-image">
                  <img 
                    src={gift.image_url} 
                    alt={gift.name} 
                    onError={(e) => {
                      console.error(`Failed to load image: ${e.target.src}`);
                      e.target.parentNode.innerHTML = '<div class="no-image">Зображення відсутнє</div>';
                    }}
                  />
                </div>
              ) : (
                <div className=".no-image">
                  <span>Немає зображення</span>
                </div>
              )}
              
              <div className="gift-info">
                <h3>{gift.name}</h3>
                <p>{gift.description}</p>
                <span className="price-range">{gift.price_range}</span>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default GiftFinder