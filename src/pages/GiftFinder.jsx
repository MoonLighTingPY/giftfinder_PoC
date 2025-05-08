import { useEffect } from 'react';
import axios from 'axios';
import { useSelector, useDispatch } from 'react-redux';
import '../styles/pages/GiftFinder.css';
import {
  updateFormField,
  toggleAi,
  setGifts,
  setDbGifts,
  setAiStatus,
  setRequestId,
  setError,
  setIsSearching,
  setSubmittedCriteria,
  resetSearch
} from '../store/slices/giftFinderSlice';


// Бюджет
const budgetOptions = [
  { value: 'any', label: 'Будь-який' },
  { value: '0-50', label: 'До $50' },
  { value: '50-100', label: '$50 - $100' },
  { value: '100-250', label: '$100 - $250' },
  { value: '250-500', label: '$250 - $500' },
  { value: '500+', label: '$500+' } // Вважається яе 500-99999 на бекенді
];

// Привід (мусить відповідати тегам в БД)
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
  // Використання Redux для управління станом, щоб дані не очищалися при переході між сторінками
  const dispatch = useDispatch();
  const {
    recipientInfo,
    useAi,
    gifts,
    dbGifts,
    aiStatus,
    requestId,
    error,
    isSearching,
    submittedCriteria
  } = useSelector(state => state.giftFinder);
  const token = useSelector(state => state.auth.token);

  const handleChange = (e) => {
    const { name, value } = e.target;
    dispatch(updateFormField({ name, value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(resetSearch());
    dispatch(setSubmittedCriteria(recipientInfo));
    dispatch(setIsSearching(true));

    try {
      // Підготовка даних для запиту, бюджет 500+ перетворюємо на 500-99999
      let budgetToSend = recipientInfo.budget;
      if (budgetToSend === '500+') {
        budgetToSend = '500-99999';
      }

      const payload = {
        ...recipientInfo,
        budget: budgetToSend,
        useAi,
        aiGiftCount: parseInt(recipientInfo.aiGiftCount || 3)
      };

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/gifts/recommend`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log('Received initial response:', response.data);

      const initialDbGifts = response.data.gifts || [];
      dispatch(setDbGifts(initialDbGifts));
      dispatch(setGifts(initialDbGifts));

      if (!useAi) {
        dispatch(setAiStatus('not_started'));
        dispatch(setIsSearching(false));
        return;
      }

      if (response.data.aiStatus === 'generating' && response.data.requestId) {
        dispatch(setAiStatus('generating'));
        dispatch(setRequestId(response.data.requestId));
        console.log(`AI generation started with ID: ${response.data.requestId}`);
      } else {
        dispatch(setIsSearching(false));
        dispatch(setAiStatus('not_started'));
      }

      if (initialDbGifts.length === 0 && response.data.aiStatus !== 'generating') {
        dispatch(setError('На жаль, подарунків за вашими критеріями не знайдено. Спробуйте змінити параметри пошуку.'));
      }
    } catch (error) {
      console.error('Помилка отримання початкових рекомендацій:', error);
      dispatch(setError('Виникла помилка: Схоже, вичерпався jwt-token. Авторизуйтеся заново.'));
      dispatch(setAiStatus('error'));
      dispatch(setIsSearching(false));
    }
  };

  // Для перевірки статусу генерації AI подарунків useEffect
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
            dispatch(setAiStatus('completed'));
            const aiGeneratedGifts = response.data.gifts || [];
            dispatch(setGifts([...aiGeneratedGifts, ...dbGifts]));
            dispatch(setIsSearching(false));
          }
          else if (response.data.status === 'error') {
            clearInterval(intervalId);
            dispatch(setAiStatus('error'));
            dispatch(setIsSearching(false));
            console.error(`AI generation error for ${requestId}:`, response.data.error);
          }
          else if (response.data.status === 'generating') {
            console.log(`AI still generating for ${requestId}...`);

            // Відображення нових AI подарунків, якщо вони вже згенеровані
            if (response.data.gifts && response.data.gifts.length > 0) {
              dispatch(setGifts([...response.data.gifts, ...dbGifts]));
            }
          }
          else {
            console.warn(`Unexpected AI status for ${requestId}:`, response.data.status);
            clearInterval(intervalId);
            dispatch(setAiStatus('error'));
            dispatch(setIsSearching(false));
          }
        } catch (error) {
          console.error(`Error polling for AI gifts (${requestId}):`, error);
          dispatch(setAiStatus('error'));
          clearInterval(intervalId);
          dispatch(setIsSearching(false));
        }
      }, 3000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [requestId, aiStatus, token, dbGifts, dispatch]);

  const handleToggleAi = () => {
    dispatch(toggleAi());
  };

  return (
    <div className="container">
      <h1>Пошук Подарунків</h1>

      <form onSubmit={handleSubmit} className="gift-form">
        {/* Вік і стать */}
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

        {/* Бюджет і привід */}
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

        {/* Інтереси/хобі */}
        <div className="form-group">
          <label>Інтереси/Хобі:</label>
          <textarea
            name="interests" value={recipientInfo.interests} onChange={handleChange}
            placeholder="Введіть інтереси, розділені комами" required
          ></textarea>
        </div>

        {/* Професія */}
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
              onChange={handleToggleAi}
            />
            <span className="slider" />
          </label>
          <span className="toggle-label">Використовувати генерацію AI</span>
          <div className="form-group">
            <label>Кількість AI подарунків:</label>
            <select
              name="aiGiftCount"
              value={recipientInfo.aiGiftCount}
              onChange={handleChange}
              disabled={!useAi}
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="5">5</option>
              <option value="7">7</option>
              <option value="10">10</option>
            </select>
          </div>
        </div>
      </form>

      {error && <div className="error-message">{error}</div>}

      {/* Результати пошуку */}
      <>
        {(!isSearching && gifts.length > 0) || aiStatus === 'generating' ? (
          <div className="gifts-container">
            {gifts.length > 0 && <h2>Рекомендовані подарунки</h2>}

            {submittedCriteria && gifts.length > 0 && (
              <p className="recommendation-note">
                Підібрано на основі ваших критеріїв:
                {submittedCriteria.age && ` вік (${submittedCriteria.age}),`}
                {submittedCriteria.gender && ` стать (${submittedCriteria.gender === 'male' ? 'чоловіча' : 'жіноча'}),`}
                {submittedCriteria.budget && submittedCriteria.budget !== 'any' && ` бюджет (${budgetOptions.find(o => o.value === submittedCriteria.budget)?.label || submittedCriteria.budget}),`}
                {submittedCriteria.occasion && submittedCriteria.occasion !== 'any' && ` привід (${occasionOptions.find(o => o.value === submittedCriteria.occasion)?.label || submittedCriteria.occasion}),`}
                {submittedCriteria.interests && ` інтереси (${submittedCriteria.interests}),`}
                {submittedCriteria.profession && ` професія (${submittedCriteria.profession})`}
              </p>
            )}

            {aiStatus === 'generating' && (
              <div className="ai-generating-message">
                <p>
                  {gifts.length > dbGifts.length
                    ? `Показано ${gifts.length - dbGifts.length} AI-подарунків. Генерація триває...`
                    : "ШІ генерує додаткові подарунки..."}
                </p>
              </div>
            )}

            {gifts.length > 0 ? (
              <div className="gift-list">
                {gifts.map(gift => (
                  <div
                    key={gift.id}
                    className={`gift-card ${(gift.ai_generated || gift.ai_suggested) ? 'ai-suggested' : ''
                      } ${gift.ai_suggested ? 'fresh-ai-suggestion' : ''}`}
                  >
                    {/* Показати AI-бейдж на згенерованих подарунках */}
                    {(gift.ai_generated || gift.ai_suggested) && (
                      <div className="ai-badge">AI</div>
                    )}
                    {/* Показати новий бейдж на подарунках, які були ЩОЙНО згенеровані ШІ + AI-бейдж */}
                    {gift.ai_suggested && (
                      <div className="new-badge">NEW</div>
                    )}
                    {gift.image_url ? (
                      <div className="gift-image">
                        <img
                          src={gift.image_url} alt={gift.name}
                          onError={(e) => {
                            // Приховати зображення при помилці
                            e.target.style.display = 'none';
                            const parent = e.target.parentNode;
                            parent.classList.add('image-error');
                          }}
                        />
                        <div className="no-image-text"><span>Зображення відсутнє</span></div>
                      </div>
                    ) : (
                      // Показати текст "Зображення відсутнє" при відсутності зображення початково
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