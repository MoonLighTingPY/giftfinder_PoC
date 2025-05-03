// components/Header.jsx
import { Link } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { logout } from '../store/slices/authSlice'
import '../styles/components/Header.css'

const Header = () => {
  const { isAuthenticated, user } = useSelector((state) => state.auth)
  const dispatch = useDispatch()
  
  const handleLogout = () => {
    dispatch(logout())
  }
  
  return (
    <header className="header">
      <div className="header-container">
        <div className="logo">
          <Link to="/">
            <h1>Gift Finder</h1>
          </Link>
        </div>
        
        <nav className="nav-menu">
          <Link to="/" className="nav-link">Home</Link>
          {isAuthenticated && (
            <Link to="/gift-finder" className="nav-link">Gift Finder</Link>
          )}
        </nav>
        
        <div className="auth-menu">
          {isAuthenticated ? (
            <div className="user-menu">
              <span className="username">Hi, {user.username}</span>
              <div className="dropdown-menu">
                <Link to="/profile" className="dropdown-item">Profile</Link>
                <button 
                  onClick={handleLogout}
                  className="dropdown-item logout-btn"
                >
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="btn-login">Login</Link>
              <Link to="/register" className="btn-register">Register</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header