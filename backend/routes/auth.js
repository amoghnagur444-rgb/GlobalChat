const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db'); 
const verifyToken = require('../middleware/auth'); 
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// REGISTER
router.post('/register', async (req, res) => {
  try {
    // 1. Added 'email' to the extracted body parameters
    const { username, email, password, display_name, country, preferred_language = 'en' } = req.body;
    
    // 2. Explicitly check if this exact username#tag combination is already taken
    const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'This username and tag combination is already taken.' });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // 3. Added 'email' to the INSERT query so it saves to the database
    const newUser = await pool.query(
      `INSERT INTO users (username, email, password_hash, display_name, country, preferred_language) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, email, display_name, country, preferred_language`,
      [username, email, hashedPassword, display_name, country, preferred_language]
    );
    
    const token = jwt.sign({ id: newUser.rows[0].id, username }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ token, user: newUser.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/language
router.put('/language', verifyToken, async (req, res) => {
  try {
    const { languageCode } = req.body;
    await pool.query(
      `UPDATE users SET preferred_language = $1 WHERE id = $2`,
      [languageCode, req.user.id]
    );
    res.json({ message: 'Language updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (user.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.rows[0].id, username }, JWT_SECRET, { expiresIn: '7d' });
    
    delete user.rows[0].password_hash;
    res.json({ token, user: user.rows[0] });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

module.exports = router;