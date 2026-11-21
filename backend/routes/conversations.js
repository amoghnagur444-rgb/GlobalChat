const express = require('express');
const pool = require('../db');
const verifyToken = require('../middleware/auth');
const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  const myId = req.user.id;
  
  try {
    const query = `
      SELECT 
        c.id AS conversation_id,
        u.id AS peer_id,
        u.username,
        u.display_name,
        u.country,
        u.avatar_url,
        (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT TO_CHAR(created_at, 'HH24:MI') FROM messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != $1 AND m.is_read = false) as unread_count
      FROM conversations c
      JOIN users u ON (u.id = c.user_one OR u.id = c.user_two) AND u.id != $1
      WHERE c.user_one = $1 OR c.user_two = $1
    `;
    
    const result = await pool.query(query, [myId]);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

module.exports = router;