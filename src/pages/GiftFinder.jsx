// src/pages/GiftFinder.jsx
import { useState } from 'react'
import axios from 'axios'
import { useSelector } from 'react-redux'
import '../styles/pages/GiftFinder.css'

const GiftFinder = () => {
  const [recipientInfo, setRecipientInfo] = useState({
    age: '',
    gender: '',
    interests: '',
    profession: '',
  })
  const [gifts, setGifts] = useState([])
  const [loading, setLoading] = useState(false)
  const token = useSelector(state => state.auth.token)

  const handleChange = (e) => {
    const { name, value } = e.target
    setRecipientInfo(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/gifts/recommend`,
        recipientInfo,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )
      setGifts(response.data)
    } catch (error) {
      console.error('Error getting recommendations:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1>Gift Finder</h1>
      
      <form onSubmit={handleSubmit} className="gift-form">
        <div className="form-group">
          <label>Age:</label>
          <input 
            type="number" 
            name="age" 
            value={recipientInfo.age} 
            onChange={handleChange} 
            required 
          />
        </div>
        
        <div className="form-group">
          <label>Gender:</label>
          <select 
            name="gender" 
            value={recipientInfo.gender} 
            onChange={handleChange} 
            required
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Interests/Hobbies:</label>
          <textarea 
            name="interests" 
            value={recipientInfo.interests} 
            onChange={handleChange} 
            placeholder="Enter interests separated by commas" 
            required
          ></textarea>
        </div>
        
        <div className="form-group">
          <label>Profession:</label>
          <input 
            type="text" 
            name="profession" 
            value={recipientInfo.profession} 
            onChange={handleChange} 
          />
        </div>
        
        <button type="submit" disabled={loading}>
          {loading ? 'Finding gifts...' : 'Find Gifts'}
        </button>
      </form>
      
      {loading && <p>Looking for perfect gifts...</p>}
      
      {gifts.length > 0 && (
        <div className="gifts-container">
          <h2>Recommended Gifts</h2>
          <div className="gift-list">
            {gifts.map((gift) => (
              <div key={gift.id} className="gift-card">
                {gift.image_url && <img src={gift.image_url} alt={gift.name} />}
                <h3>{gift.name}</h3>
                <p>{gift.description}</p>
                <span className="price-range">{gift.price_range}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default GiftFinder