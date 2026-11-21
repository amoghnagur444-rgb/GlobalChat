const express = require('express');
const pool = require('../db');
const verifyToken = require('../middleware/auth'); // Protects the route
const router = express.Router();

// POST /api/friends/request
router.post('/request', verifyToken, async (req, res) => {
  const { targetUsername } = req.body;
  const requesterId = req.user.id; // Extracted safely from the JWT

  try {
    // 1. Find the user they are trying to add
    const targetUser = await pool.query('SELECT id FROM users WHERE username = $1', [targetUsername]);
    
    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const receiverId = targetUser.rows[0].id;

    if (requesterId === receiverId) {
      return res.status(400).json({ error: 'You cannot add yourself' });
    }

    // 2. Insert the pending friend request
    await pool.query(
      'INSERT INTO friendships (requester_id, receiver_id, status) VALUES ($1, $2, $3)',
      [requesterId, receiverId, 'pending']
    );

    res.json({ message: 'Friend request sent successfully!' });

  } catch (error) {
    // Handle the unique constraint error if a request already exists
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Friend request already exists' });
    }
    console.error(error);
    res.status(500).json({ error: 'Server error while sending request' });
  }
});

// GET /api/friends/pending - View incoming friend requests
router.get('/pending', verifyToken, async (req, res) => {
  try {
    const pendingRequests = await pool.query(
      `SELECT f.requester_id, u.username, u.display_name, u.avatar_url 
       FROM friendships f 
       JOIN users u ON f.requester_id = u.id 
       WHERE f.receiver_id = $1 AND f.status = 'pending'`,
      [req.user.id]
    );
    res.json(pendingRequests.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

// PUT /api/friends/accept - Accept a friend request and create a conversation
router.put('/accept', verifyToken, async (req, res) => {
  const { requesterId } = req.body;
  const myId = req.user.id;
  
  try {
    // Start a transaction
    await pool.query('BEGIN');

    // 1. Update the friendship status
    const update = await pool.query(
      `UPDATE friendships 
       SET status = 'accepted' 
       WHERE requester_id = $1 AND receiver_id = $2 AND status = 'pending'
       RETURNING *`,
      [requesterId, myId]
    );

    if (update.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Friend request not found or already accepted' });
    }

    // 2. Create a new conversation row linking the two users
    await pool.query(
      `INSERT INTO conversations (user_one, user_two) 
       VALUES ($1, $2)`,
      [requesterId, myId]
    );

    // Commit the transaction
    await pool.query('COMMIT');
    res.json({ message: 'Friend request accepted and conversation created!' });

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

// GET /api/friends - Get list of accepted friends
router.get('/', verifyToken, async (req, res) => {
  try {
    const friends = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.country 
       FROM users u 
       JOIN friendships f ON (u.id = f.requester_id OR u.id = f.receiver_id) 
       WHERE (f.requester_id = $1 OR f.receiver_id = $1) 
       AND u.id != $1 AND f.status = 'accepted'`,
      [req.user.id]
    );
    res.json(friends.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

module.exports = router;