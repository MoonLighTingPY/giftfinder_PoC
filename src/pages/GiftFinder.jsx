// src/pages/GiftFinder.jsx
import { useState, useEffect } from 'react'; // Ensure useEffect is imported
import axios from 'axios';
import { useSelector } from 'react-redux';
import '../styles/pages/GiftFinder.css';

const GiftFinder = () => {
  const [recipientInfo, setRecipientInfo] = useState({}); // Recipient information
  const [gifts, setGifts] = useState([]); // Combined list for display
  const [dbGifts, setDbGifts] = useState([]); // Store DB gifts separately for merging
  const [isSearching, setIsSearching] = useState(false); // New state for overall search process
  const [error, setError] = useState('');
  const token = useSelector(state => state.auth.token);
  const [aiStatus, setAiStatus] = useState(null); // 'generating', 'completed', 'error', null
  const [requestId, setRequestId] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setRecipientInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGifts([]);      // Clear previous results
    setDbGifts([]);    // Clear previous DB results
    setAiStatus(null); // Reset AI status
    setRequestId(null); // Reset request ID
    setError('');
    setIsSearching(true); // Set searching state to true

    try {
      console.log('Sending request with:', recipientInfo);

      // Make the initial request
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/gifts/recommend`,
        recipientInfo,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('Received initial response:', response.data);

      // Process the initial response (contains DB gifts)
      const initialDbGifts = response.data.gifts || [];
      setDbGifts(initialDbGifts); // Store DB gifts
      setGifts(initialDbGifts);   // Display DB gifts immediately

      // Check if AI generation started and store ID for polling
      if (response.data.aiStatus === 'generating' && response.data.requestId) {
        setAiStatus('generating');
        setRequestId(response.data.requestId);
        console.log(`AI generation started with ID: ${response.data.requestId}`);
      } else {
        // If AI isn't generating (e.g., disabled or error in initial request)
        setIsSearching(false);
        setAiStatus('not_started'); // Or handle as appropriate
      }

      if (initialDbGifts.length === 0 && response.data.aiStatus !== 'generating') {
         // Only show error if DB gifts are empty AND AI isn't generating
         setError('На жаль, подарунків за вашими критеріями не знайдено. Спробуйте змінити параметри пошуку.');
      }

    } catch (error) {
      console.error('Помилка отримання початкових рекомендацій:', error);
      setError('Виникла помилка при пошуку подарунків. Будь ласка, спробуйте пізніше.');
      setAiStatus('error'); // Mark AI status as error too
    } finally {
      setIsSearching(false);
    }
  };

  // useEffect for polling AI status
  useEffect(() => {
    let intervalId = null;

    if (requestId && aiStatus === 'generating') {
      console.log(`Polling started for request ID: ${requestId}`);
      intervalId = setInterval(async () => {
        try {
          console.log(`Polling check for ${requestId}...`);
          const response = await axios.get(
            `${import.meta.env.VITE_API_URL}/api/gifts/ai-status/${requestId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          console.log(`Polling response for ${requestId}:`, response.data);

          if (response.data.status === 'completed') {
            clearInterval(intervalId);
            setAiStatus('completed');
            const aiGeneratedGifts = response.data.gifts || [];
            setGifts([...aiGeneratedGifts, ...dbGifts]);
            setIsSearching(false); // Stop "searching" when AI is done
          } else if (response.data.status === 'error') {
            clearInterval(intervalId);
            setAiStatus('error');
            setIsSearching(false); 
            console.error(`AI generation error for ${requestId}:`, response.data.error);
            // Optionally display a specific error message for AI failure
            // setError(prev => prev ? `${prev} Помилка генерації ШІ.` : 'Помилка генерації ШІ.');
          } else if (response.data.status === 'generating' || response.data.status === 'pending') {
            // Still generating, continue polling
            console.log(`AI still generating for ${requestId}...`);
          } else {
             // Unexpected status
             console.warn(`Unexpected AI status for ${requestId}:`, response.data.status);
             clearInterval(intervalId);
             setAiStatus('error');
          }
        } catch (error) {
          console.error(`Error polling for AI gifts (${requestId}):`, error);
          setAiStatus('error');
          clearInterval(intervalId); // Stop polling on error
        }
      }, 3000); // Poll every 3 seconds
    }

    // Cleanup function to clear interval when component unmounts or dependencies change
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [requestId, aiStatus, token, dbGifts]);
  return (
    <div className="container">
      <h1>Пошук Подарунків</h1>

      <form onSubmit={handleSubmit} className="gift-form">
        {/* Form inputs remain the same */}
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

        <button type="submit" disabled={isSearching}>
          {/* Show loading only during the initial request */}
          {isSearching ? 'Пошук...' : 'Знайти подарунки'}
        </button>
      </form>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Display gifts container if loading is finished AND we have gifts OR AI is generating */}
      {(!isSearching && gifts.length > 0) || aiStatus === 'generating' ? (
          <div className="gifts-container">
          {/* Show header only if there are gifts */}
          {gifts.length > 0 && <h2>Рекомендовані подарунки</h2>}

          {/* Recommendation note can be shown if gifts exist */}
          {gifts.length > 0 && (
             <p className="recommendation-note">
               Підібрано на основі ваших критеріїв:
               {recipientInfo.age && ` вік (${recipientInfo.age}),`}
               {/* ... other criteria */}
                {recipientInfo.gender && ` стать (${
                  recipientInfo.gender === 'male' ? 'чоловіча' :
                  recipientInfo.gender === 'female' ? 'жіноча' : 'інша'
                }),`}
                {recipientInfo.interests && ` інтереси (${recipientInfo.interests}),`}
                {recipientInfo.profession && ` професія (${recipientInfo.profession})`}
             </p>
          )}


          {/* Show AI generation status message */}
          {aiStatus === 'generating' && (
              <div className="ai-generating-message">
                <p>ШІ генерує додаткові подарунки...</p>
              </div>
            )}

          {/* Render the gift list */}
          {gifts.length > 0 ? (
               <div className="gift-list">
                 {gifts.map((gift) => (
                   <div key={gift.id} className={`gift-card ${gift.ai_suggested ? 'ai-suggested' : ''}`}>
                     {/* ... gift card content ... */}
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
                              e.target.style.display = 'none'; // Hide broken image
                              const parent = e.target.parentNode;
                              if (parent && !parent.querySelector('.no-image-placeholder')) {
                                 const placeholder = document.createElement('div');
                                 placeholder.className = 'no-image no-image-placeholder';
                                 placeholder.innerHTML = '<span>Зображення відсутнє</span>';
                                 parent.appendChild(placeholder);
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <div className="gift-image no-image">
                          <span>Зображення відсутнє</span>
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
            ) : (
               aiStatus === 'generating' && <p>База даних не містить відповідних подарунків, очікуємо на ШІ...</p>
            )}
          </div> // End gifts-container
        ) : (
          // Show the main "Searching..." message only when isSearching is true AND no results yet
          isSearching && <p>Шукаємо ідеальні подарунки...</p>
        )}

      {/* The rest of the component return continues after this */}
    </div> // End container
  );
};

export default GiftFinder;