const express = require('express');
const pool = require('../db');
const verifyToken = require('../middleware/auth');
const router = express.Router();

// GET /api/messages/:conversationId - Fetch chat history for a specific conversation
router.get('/:conversationId', verifyToken, async (req, res) => {
  const { conversationId } = req.params;

  try {
    const chatHistory = await pool.query(
      `SELECT id, sender_id, content, created_at, is_read 
       FROM messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC`,
      [conversationId]
    );
    res.json(chatHistory.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/messages - Save a new private message
router.post('/', verifyToken, async (req, res) => {
  const { conversationId, content } = req.body;
  const senderId = req.user.id;

  try {
    const newMessage = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, content, is_read) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [conversationId, senderId, content, false]
    );
    res.json(newMessage.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});
// PUT /api/messages/:conversationId/read
router.put('/:conversationId/read', verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const myId = req.user.id;

    // Update all unread messages in this chat sent BY the other person
    await pool.query(
      `UPDATE messages 
       SET is_read = true 
       WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false`,
      [conversationId, myId]
    );

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error("Failed to mark read:", error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;