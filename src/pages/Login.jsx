import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import axios from 'axios'
import { setCredentials } from '../store/slices/authSlice'
import '../styles/pages/Login.css'

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()
  const dispatch = useDispatch()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/login`,
        formData
      )

      dispatch(setCredentials({
        user: response.data.user,
        token: response.data.token
      }))

      navigate('/')
    } catch (error) {
      setError(
        error.response?.data?.message ||
        'Помилка під час входу'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <h1>Вхід</h1>

      {error && <p className="error-message">{error}</p>}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="username">Ім&apos;я користувача</label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Пароль</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Вхід...' : 'Увійти'}
        </button>
      </form>

      <p>
        Ще немає облікового запису? <Link to="/register">Зареєструватися</Link>
      </p>
    </div>
  )
}

export default Login