// pages/Profile.jsx
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { logout } from '../store/slices/authSlice'
import '../styles/pages/Profile.css'

const Profile = () => {
  const { user } = useSelector((state) => state.auth)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  
  const handleLogout = () => {
    dispatch(logout())
    navigate('/')
  }
  
  return (
    <div className="profile-container">
      <h1>My Profile</h1>
      
      <div className="profile-card">
        <div className="profile-info">
          <h2>{user.username}</h2>
          <p>{user.email}</p>
        </div>
        
        <div className="profile-actions">
          <button className="button danger" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}

export default Profile