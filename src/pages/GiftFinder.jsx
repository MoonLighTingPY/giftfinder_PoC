// src/pages/GiftFinder.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import '../styles/pages/GiftFinder.css';

// Define budget options
const budgetOptions = [
  { value: 'any', label: 'Будь-який' },
  { value: '0-50', label: 'До $50' },
  { value: '50-100', label: '$50 - $100' },
  { value: '100-250', label: '$100 - $250' },
  { value: '250-500', label: '$250 - $500' },
  { value: '500+', label: '$500+' } // Represented as 500-99999 in backend
];

// Define occasion options (should match DB tags)
const occasionOptions = [
  { value: 'any', label: 'Будь-який' },
  { value: 'birthday', label: 'День народження' },
  { value: 'christmas', label: 'Різдво' },
  { value: 'anniversary', label: 'Річниця' },
  { value: 'valentines', label: 'День Валентина' },
  { value: 'graduation', label: 'Випускний' },
  { value: 'thank you', label: 'Подяка' }
];


const GiftFinder = () => {
  const [recipientInfo, setRecipientInfo] = useState({
    age: '',
    gender: '',
    interests: '',
    profession: '',
    budget: 'any', // Default budget
    occasion: 'any' // Default occasion
  });
  const [gifts, setGifts] = useState([]);
  const [dbGifts, setDbGifts] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const token = useSelector(state => state.auth.token);
  const [aiStatus, setAiStatus] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [submittedCriteria, setSubmittedCriteria] = useState(null);
  const [useAi, setUseAi] = useState(true)

  const handleChange = (e) => {
    const { name, value } = e.target;
    setRecipientInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGifts([]);
    setDbGifts([]);
    setAiStatus(null);
    setRequestId(null);
    setError('');
    setSubmittedCriteria(recipientInfo); // Store submitted criteria
    setIsSearching(true);

    try {
      console.log('Sending request with:', recipientInfo);

      // Prepare data, handle budget '500+' case
      let budgetToSend = recipientInfo.budget;
      if (budgetToSend === '500+') {
        budgetToSend = '500-99999'; // Match backend expectation
      }
      const payload = {
        ...recipientInfo,
        budget: budgetToSend,
        useAi
      };


      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/gifts/recommend`,
        payload, // Send updated payload
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('Received initial response:', response.data);

      const initialDbGifts = response.data.gifts || [];
      setDbGifts(initialDbGifts);
      setGifts(initialDbGifts);

      if (!useAi) {
        setAiStatus('not_started')
        setIsSearching(false)
        return
      }

      if (response.data.aiStatus === 'generating' && response.data.requestId) {
        setAiStatus('generating');
        setRequestId(response.data.requestId);
        console.log(`AI generation started with ID: ${response.data.requestId}`);
      } else {
        setIsSearching(false);
        setAiStatus('not_started');
      }

      if (initialDbGifts.length === 0 && response.data.aiStatus !== 'generating') {
        setError('На жаль, подарунків за вашими критеріями не знайдено. Спробуйте змінити параметри пошуку.');
      }

    } catch (error) {
      console.error('Помилка отримання початкових рекомендацій:', error);
      setError('Виникла помилка при пошуку подарунків. Будь ласка, спробуйте пізніше.');
      setAiStatus('error');
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
            setGifts([...aiGeneratedGifts, ...dbGifts]); // AI gifts first
            setIsSearching(false);
          } else if (response.data.status === 'error') {
            clearInterval(intervalId);
            setAiStatus('error');
            setIsSearching(false);
            console.error(`AI generation error for ${requestId}:`, response.data.error);
          } else if (response.data.status === 'generating' || response.data.status === 'pending') {
            console.log(`AI still generating for ${requestId}...`);
          } else {
            console.warn(`Unexpected AI status for ${requestId}:`, response.data.status);
            clearInterval(intervalId);
            setAiStatus('error');
            setIsSearching(false);
          }
        } catch (error) {
          console.error(`Error polling for AI gifts (${requestId}):`, error);
          setAiStatus('error');
          clearInterval(intervalId);
          setIsSearching(false);
        }
      }, 3000);
    }

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
        {/* Row 1: Age & Gender */}
        <div className="form-row">
          <div className="form-group form-group-half">
            <label>Вік:</label>
            <input
              type="number" name="age" value={recipientInfo.age}
              onChange={handleChange} min="1" required
            />
          </div>
          <div className="form-group form-group-half">
            <label>Стать:</label>
            <select name="gender" value={recipientInfo.gender} onChange={handleChange} required defaultValue="Чоловіча">
              <option value="">Оберіть стать</option>
              <option value="male">Чоловіча</option>
              <option value="female">Жіноча</option>
            </select>
          </div>
        </div>

        {/* Row 2: Budget & Occasion */}
        <div className="form-row">
          <div className="form-group form-group-half">
            <label>Бюджет:</label>
            <select name="budget" value={recipientInfo.budget} onChange={handleChange}>
              {budgetOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group form-group-half">
            <label>Привід:</label>
            <select name="occasion" value={recipientInfo.occasion} onChange={handleChange}>
              {occasionOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Interests */}
        <div className="form-group">
          <label>Інтереси/Хобі:</label>
          <textarea
            name="interests" value={recipientInfo.interests} onChange={handleChange}
            placeholder="Введіть інтереси, розділені комами" required
          ></textarea>
        </div>

        {/* Row 4: Profession */}
        <div className="form-group">
          <label>Професія:</label>
          <input
            type="text" name="profession" value={recipientInfo.profession}
            onChange={handleChange} placeholder="Напр., інженер, вчитель (необов'язково)"
          />
        </div>

        <button type="submit" disabled={isSearching}>
          {isSearching ? 'Пошук...' : 'Знайти подарунки'}
        </button>
        <div className="toggle-switch">
          <label className="switch">
            <input
              type="checkbox"
              checked={useAi}
              onChange={() => setUseAi(prev => !prev)}
            />
            <span className="slider" />
          </label>
          <span className="toggle-label">Використовувати генерацію AI</span>
        </div>
      </form>

      {error && <div className="error-message">{error}</div>}

      {/* Display Results Area */}
      <>
        {(!isSearching && gifts.length > 0) || aiStatus === 'generating' ? (
          <div className="gifts-container">
            {gifts.length > 0 && <h2>Рекомендовані подарунки</h2>}

            {submittedCriteria && gifts.length > 0 && (
              <p className="recommendation-note">
                Підібрано на основі ваших критеріїв:
                {submittedCriteria.age && ` вік (${submittedCriteria.age}),`}
                {submittedCriteria.gender && ` стать (${submittedCriteria.gender === 'male' ? 'чоловіча' : 'жіноча'}),`}
                {/* Display selected budget and occasion */}
                {submittedCriteria.budget && submittedCriteria.budget !== 'any' && ` бюджет (${budgetOptions.find(o => o.value === submittedCriteria.budget)?.label || submittedCriteria.budget}),`}
                {submittedCriteria.occasion && submittedCriteria.occasion !== 'any' && ` привід (${occasionOptions.find(o => o.value === submittedCriteria.occasion)?.label || submittedCriteria.occasion}),`}
                {submittedCriteria.interests && ` інтереси (${submittedCriteria.interests}),`}
                {submittedCriteria.profession && ` професія (${submittedCriteria.profession})`}
              </p>
            )}

            {aiStatus === 'generating' && (
              <div className="initial-searching-message">
                <p>ШІ генерує додаткові подарунки...</p>
              </div>
            )}

            {gifts.length > 0 ? (
              <div className="gift-list">
                {gifts.map(gift => (
                  <div
                    key={gift.id}
                    className={`gift-card ${gift.ai_generated || gift.ai_suggested ? 'ai-suggested' : ''}`}
                  >
                    {/* Show AI badge if DB‐generated or just‐generated */}
                    {(gift.ai_generated || gift.ai_suggested) && (
                      <div className="ai-badge">AI</div>
                    )}
                    {/* Show NEW badge on just‐generated items */}
                    {gift.ai_suggested && (
                      <div className="new-badge">NEW</div>
                    )}
                    {gift.image_url ? (
                      <div className="gift-image">
                        <img
                          src={gift.image_url} alt={gift.name}
                          onError={(e) => {
                            // Simply hide the broken image element
                            e.target.style.display = 'none';
                            // Add a class to the parent to show the placeholder text via CSS if needed
                            // but the existing .no-image class for null URLs already does this.
                            // We rely on the background color of .gift-image or the .no-image style.
                            const parent = e.target.parentNode;
                            parent.classList.add('image-error'); // Add a class to signal error state
                          }}
                        />
                        {/* Placeholder text can be added here and shown via CSS on error */}
                        <div className="no-image-text"><span>Зображення відсутнє</span></div>
                      </div>
                    ) : (
                      // This part handles when image_url is null initially
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
              aiStatus === 'generating' && <p className="initial-searching-message">База даних не містить відповідних подарунків, очікуємо на ШІ...</p>
            )}
          </div>
        ) : (
          isSearching && <p className="initial-searching-message">Шукаємо ідеальні подарунки...</p>
        )}
      </>
    </div>
  );
};

export default GiftFinder;