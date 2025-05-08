import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import '../styles/pages/Home.css'

const Home = () => {
  const { isAuthenticated, user } = useSelector((state) => state.auth)

  return (
    <div className="home-container">
      <h1>Пошук Подарунків</h1>
      <p className="tagline">
        Знайдіть ідеальний подарунок для будь-кого на основі їхніх інтересів
      </p>

      {isAuthenticated ? (
        <div className="welcome-section">
          <h2>Вітаємо, {user.username}!</h2>
          <p>Готові знайти ідеальний подарунок?</p>
          <div className="action-buttons">
            <Link to="/gift-finder" className="button primary">
              Знайти Подарунки
            </Link>
            <Link to="/profile" className="button secondary">
              Мій Профіль
            </Link>
          </div>
        </div>
      ) : (
        <div className="auth-section">
          <p>Увійдіть, щоб почати пошук ідеальних подарунків</p>
          <div className="action-buttons">
            <Link to="/login" className="button primary">
              Увійти
            </Link>
            <Link to="/register" className="button secondary">
              Реєстрація
            </Link>
          </div>
        </div>
      )}

      <div className="features-section">
        <h2>Як це працює</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>Розкажіть про людину</h3>
            <p>Введіть інформацію про людину, для якої шукаєте подарунок</p>
          </div>
          <div className="feature-card">
            <h3>Розумний підбір</h3>
            <p>Наша система підбирає подарунки відповідно до інтересів</p>
          </div>
          <div className="feature-card">
            <h3>На основі ШІ</h3>
            <p>Отримуйте персоналізовані рекомендації унікальних подарунків</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home