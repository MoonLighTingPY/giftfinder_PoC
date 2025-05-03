// api/server.js
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mysql from 'mysql2/promise'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import process from 'process'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gift_finder',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  
  if (!token) return res.status(401).json({ message: 'Unauthorized' })
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Forbidden' })
    req.user = user
    next()
  })
}

// Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body
    
    // Check if user already exists
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, email]
    )
    
    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'Username or email already exists' })
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)
    
    // Insert new user
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    )
    
    res.status(201).json({ message: 'User created successfully' })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body
    
    // Find user
    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    )
    
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }
    
    const user = users[0]
    
    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash)
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }
    
    // Generate JWT
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    )
    
    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      token
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

app.post('/api/gifts/recommend', authenticateToken, async (req, res) => {
  try {
    const { age, gender, interests, profession } = req.body
    
    // Build query conditions
    let conditions = []
    let params = []
    
    if (age) {
      // Map age to appropriate age category
      let ageCategory = 'adults' // default
      if (age < 13) ageCategory = 'children'
      else if (age < 20) ageCategory = 'teenagers'
      else if (age < 30) ageCategory = 'young adults'
      else if (age > 65) ageCategory = 'seniors'
      
      conditions.push('tags.name = ?')
      params.push(ageCategory)
    }
    
    if (gender && gender !== 'other') {
      conditions.push('(tags.name = ? OR tags.name = "unisex")')
      params.push(gender)
    }
    
    if (interests) {
      // Split interests by comma
      const interestList = interests.split(',').map(i => i.trim().toLowerCase())
      if (interestList.length > 0) {
        interestList.forEach(interest => {
          conditions.push('tags.name LIKE ?')
          params.push(`%${interest}%`)
        })
      }
    }
    
    if (profession) {
      conditions.push('tags.name LIKE ?')
      params.push(`%${profession}%`)
    }
    
    // Query to find matching gifts
    const queryCondition = conditions.length > 0 
      ? `WHERE ${conditions.join(' OR ')}` 
      : ''
    
    const query = `
      SELECT DISTINCT gifts.* 
      FROM gifts
      JOIN gift_tags ON gifts.id = gift_tags.gift_id
      JOIN tags ON gift_tags.tag_id = tags.id
      ${queryCondition}
      LIMIT 10
    `
    
    const [gifts] = await pool.query(query, params)
    
    res.json(gifts)
  } catch (error) {
    console.error('Gift recommendation error:', error)
    res.status(500).json({ message: 'Server error' })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})