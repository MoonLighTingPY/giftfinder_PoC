// pages/Home.jsx
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import '../styles/pages/Home.css'

const Home = () => {
  const { isAuthenticated, user } = useSelector((state) => state.auth)
  
  return (
    <div className="home-container">
      <h1>Gift Finder</h1>
      <p className="tagline">
        Find the perfect gift for anyone based on their interests
      </p>
      
      {isAuthenticated ? (
        <div className="welcome-section">
          <h2>Welcome, {user.username}!</h2>
          <p>Ready to find the perfect gift?</p>
          <div className="action-buttons">
            <Link to="/gift-finder" className="button primary">
              Find Gifts
            </Link>
            <Link to="/profile" className="button secondary">
              My Profile
            </Link>
          </div>
        </div>
      ) : (
        <div className="auth-section">
          <p>Sign in to start finding the perfect gifts</p>
          <div className="action-buttons">
            <Link to="/login" className="button primary">
              Login
            </Link>
            <Link to="/register" className="button secondary">
              Register
            </Link>
          </div>
        </div>
      )}
      
      <div className="features-section">
        <h2>How It Works</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>Tell us about them</h3>
            <p>Enter information about the person you&apos;re shopping for</p>
          </div>
          <div className="feature-card">
            <h3>Smart Matching</h3>
            <p>Our system matches interests with perfect gift ideas</p>
          </div>
          <div className="feature-card">
            <h3>AI Powered</h3>
            <p>Get personalized recommendations for unique gifts</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home