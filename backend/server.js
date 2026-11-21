const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const cors = require('cors');
const activeUserSockets = new Map();
const verifyToken = require('./middleware/auth');
// Tracks user_id -> Set of active socket IDs
const onlineUsers = new Map();
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Removed app.use('/api/friends', friendRoutes) so /api/friends/* uses the
// friend_requests routes below (matching the socket handler).

const messageRoutes = require('./routes/messages');
app.use('/api/messages', messageRoutes);

const conversationRoutes = require('./routes/conversations');
app.use('/api/conversations', conversationRoutes);

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // Adjust to your frontend URL in production
        methods: ['GET', 'POST']
    }
});

// Database Pool Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) console.error('Database connection failed:', err.message);
    else console.log('Database connected successfully at:', res.rows[0].now);
});

// ==========================================
// IN-MEMORY STATE (Volatile Memory)
// ==========================================
const waitingQueue = [];      // Array of { socketId, userProfile }
const activeRooms = new Map();     // roomId -> { users: [s1, s2], profiles: { [s1]: data }, messages: [], timer: Timeout }
const socketToRoom = new Map();    // socketId -> roomId

// Helper: Start Initial Timer or Disable It
const resetInactivityTimer = (roomId) => {
    const room = activeRooms.get(roomId);
    if (!room) return;
    
    // Always clear the existing timer first
    if (room.timer) clearTimeout(room.timer);

    // If a human has sent a message, disable the timer completely.
    if (room.messages.length > 0) {
        room.timer = null; 
        return;
    }

    // Otherwise, start the initial 60-second ghosting timer
    room.timer = setTimeout(() => {
        io.to(roomId).emit('chat_timeout', { 
            message: 'Chat disconnected due to 60s initial inactivity.' 
        });
        cleanupRoom(roomId);
    }, 60000);
};

// Helper: Clean up Room & Memory
const cleanupRoom = (roomId, reason) => {
    const room = activeRooms.get(roomId);
    if (!room) return;

    clearTimeout(room.timer);
    room.users.forEach((sId) => {
        socketToRoom.delete(sId);
        const socketInstance = io.sockets.sockets.get(sId);
        if (socketInstance) socketInstance.leave(roomId);
    });

    activeRooms.delete(roomId);
};

// ==========================================
// SOCKET.IO REAL-TIME ROUTING
// ==========================================
io.on('connection', (socket) => {
    console.log(`[Connected]: Socket ${socket.id}`);
    
    // --- LIVE PRESENCE TRACKING & MULTI-DEVICE PREVENTION ---
    socket.on('user_connected', (userId) => {
        socket.userId = userId;

        // 1. Multi-device / Multi-tab forced logout check
        if (activeUserSockets.has(userId)) {
            const oldSocketId = activeUserSockets.get(userId);
            
            // Tell the old device to wipe its state and redirect to login
            io.to(oldSocketId).emit('force_logout', { 
                message: 'You have been logged out because your account was accessed from another device or tab.' 
            });
            
            // Force sever the old socket connection from the backend
            const oldSocket = io.sockets.sockets.get(oldSocketId);
            if (oldSocket) {
                oldSocket.disconnect(true);
            }
        }

        // 2. Register this new device as the authoritative socket
        activeUserSockets.set(userId, socket.id);

        // 3. Standard presence logic
        if (!onlineUsers.has(userId)) {
            onlineUsers.set(userId, new Set());
        }
        onlineUsers.get(userId).add(socket.id);

        io.emit('presence_update', { userId, isOnline: true });
        
        const currentlyOnline = Array.from(onlineUsers.keys());
        socket.emit('initial_presence', currentlyOnline);
    });

    // --- TYPING INDICATORS ---
    socket.on('typing', ({ receiverId, roomId }) => {
        if (roomId) {
            socket.to(roomId).emit('peer_typing', { isStranger: true });
        } else if (receiverId) {
            socket.to(`user_${receiverId}`).emit('peer_typing', { senderId: socket.userId });
        }
    });

    socket.on('stop_typing', ({ receiverId, roomId }) => {
        if (roomId) {
            socket.to(roomId).emit('peer_stopped_typing');
        } else if (receiverId) {
            socket.to(`user_${receiverId}`).emit('peer_stopped_typing', { senderId: socket.userId });
        }
    });

    socket.on('mark_messages_read', ({ senderId, conversationId }) => {
        socket.to(`user_${senderId}`).emit('peer_read_messages', { conversationId });
    });

    // --- PERSONAL ROOMS ---
    socket.on('join_personal_room', (userId) => {
        socket.join(`user_${userId}`);
    });

    socket.on('send_private_message', (data) => {
        socket.to(`user_${data.receiverId}`).emit('receive_private_message', data.messageObj);
    });

    // --- 1. RANDOM MATCHMAKING ---
    socket.on('join_queue', (userProfile) => {
        const existingIndex = waitingQueue.findIndex((q) => q.socketId === socket.id);
        if (existingIndex !== -1) return;

        const matchIndex = waitingQueue.findIndex((q) => q.userProfile.id !== userProfile.id);

        if (matchIndex !== -1) {
            const peer = waitingQueue.splice(matchIndex, 1)[0];
            const roomId = `room_${socket.id}_${peer.socketId}`;

            socket.join(roomId);
            const peerSocket = io.sockets.sockets.get(peer.socketId);
            if (peerSocket) peerSocket.join(roomId);

            activeRooms.set(roomId, {
                users: [socket.id, peer.socketId],
                profiles: {
                    [socket.id]: userProfile,
                    [peer.socketId]: peer.userProfile
                },
                messages: [], 
                timer: null
            });

            socketToRoom.set(socket.id, roomId);
            socketToRoom.set(peer.socketId, roomId);

            resetInactivityTimer(roomId);

            socket.emit('match_found', { roomId, peer: peer.userProfile });
            if (peerSocket) {
                peerSocket.emit('match_found', { roomId, peer: userProfile });
            }
            console.log(`[Matched]: Room created ${roomId}`);
        } else {
            waitingQueue.push({ socketId: socket.id, userProfile });
            socket.emit('queue_waiting', { message: 'Looking for a match...' });
        }
    });

    // Allow user to leave queue explicitly
    socket.on('leave_queue', () => {
        const queueIdx = waitingQueue.findIndex((q) => q.socketId === socket.id);
        if (queueIdx !== -1) {
            waitingQueue.splice(queueIdx, 1);
            console.log(`[Queue]: Socket ${socket.id} left the queue.`);
        }
    });

    // --- 2. EPHEMERAL CHAT ---
    socket.on('send_ephemeral_message', ({ roomId, text, senderId }) => {
        const room = activeRooms.get(roomId);
        if (!room) return;

        const msgObj = {
            id: `temp_${Date.now()}`,
            senderId,
            text,
            createdAt: new Date().toISOString()
        };

        room.messages.push(msgObj);
        resetInactivityTimer(roomId);
        socket.to(roomId).emit('receive_ephemeral_message', msgObj);
    });

    // --- 3. SKIP PEER ---
    socket.on('skip_peer', () => {
        let roomId = socketToRoom.get(socket.id);
        
        if (!roomId) {
            for (const [key, room] of activeRooms.entries()) {
                if (room.users.includes(socket.id)) { 
                    roomId = key;
                    break;
                }
            }
        }

        if (roomId) {
            socket.to(roomId).emit('peer_skipped', { message: 'Stranger disconnected the chat.' });
            cleanupRoom(roomId, 'skipped');
        }
    });

    // --- 4. FRIEND REQUEST & DATABASE PROMOTION ---
    socket.on('send_friend_request', async ({ senderDbId, receiverDbId, roomId }) => {
        try {
            await pool.query(
                `INSERT INTO friend_requests (sender_id, receiver_id, status)
                 VALUES ($1, $2, 'pending')
                 ON CONFLICT (sender_id, receiver_id) DO NOTHING`,
                [senderDbId, receiverDbId]
            );
            socket.to(roomId).to(`user_${receiverDbId}`).emit('friend_request_received', { senderDbId });
        } catch (err) {
            console.error('Friend request error:', err.message);
        }
    });

    socket.on('accept_friend_request', async ({ userOneId, userTwoId, roomId }) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                `UPDATE friend_requests 
                 SET status = 'accepted' 
                 WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`,
                [userOneId, userTwoId]
            );

            const [u1, u2] = [Math.min(userOneId, userTwoId), Math.max(userOneId, userTwoId)];
            const convRes = await client.query(
                `INSERT INTO conversations (user_one, user_two)
                 VALUES ($1, $2)
                 ON CONFLICT (user_one, user_two) DO UPDATE SET user_one = EXCLUDED.user_one
                 RETURNING id`,
                [u1, u2]
            );
            const conversationId = convRes.rows[0].id;

            const room = activeRooms.get(roomId);
            if (room && room.messages.length > 0) {
                for (const msg of room.messages) {
                    await client.query(
                        `INSERT INTO messages (conversation_id, sender_id, content, created_at)
                         VALUES ($1, $2, $3, $4)`,
                        [conversationId, msg.senderId, msg.text, msg.createdAt]
                    );
                }
            }

            await client.query('COMMIT');
            io.to(roomId).emit('friendship_confirmed', { conversationId });

        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Friendship upgrade transaction failed:', err.message);
        } finally {
            client.release();
        }
    });

    // --- 5. DISCONNECT & CLEANUP ---
    socket.on('disconnect', () => {
        console.log(`[Disconnected]: Socket ${socket.id} closed their connection.`);

        // 1. Active User Map cleanup
        if (socket.userId) {
            if (activeUserSockets.get(socket.userId) === socket.id) {
                activeUserSockets.delete(socket.userId);
            }
        }

        // 2. Presence cleanup
        if (socket.userId && onlineUsers.has(socket.userId)) {
            const userSockets = onlineUsers.get(socket.userId);
            userSockets.delete(socket.id);

            if (userSockets.size === 0) {
                onlineUsers.delete(socket.userId);
                io.emit('presence_update', { userId: socket.userId, isOnline: false });
            }
        }

        // 3. Queue cleanup
        const queueIdx = waitingQueue.findIndex((q) => q.socketId === socket.id);
        if (queueIdx !== -1) {
            waitingQueue.splice(queueIdx, 1);
        }

        // 4. Room cleanup
        let roomId = socketToRoom.get(socket.id);
        
        if (!roomId) {
            for (const [key, room] of activeRooms.entries()) {
                if (room.users.includes(socket.id)) { 
                    roomId = key;
                    break;
                }
            }
        }

        if (roomId) {
            socket.to(roomId).emit('peer_disconnected', { message: 'The stranger disconnected from the chat.' });
            cleanupRoom(roomId);
        }
    });
});

// ==========================================
// BASIC USER & CHAT REST ENDPOINTS
// ==========================================
app.get('/api/users/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT id, display_name, country, avatar_url FROM users WHERE id = $1', [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'User not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fetch persistent WhatsApp-mode conversations & friends list
app.get('/api/users/:id/conversations', async (req, res) => {
    try {
        const userId = req.params.id;
        const query = `
            SELECT c.id AS conversation_id,
                   u.id AS friend_id,
                   u.display_name,
                   u.country,
                   u.avatar_url,
                   (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
                   (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message_time
            FROM conversations c
            JOIN users u ON (u.id = CASE WHEN c.user_one = $1 THEN c.user_two ELSE c.user_one END)
            WHERE c.user_one = $1 OR c.user_two = $1
            ORDER BY last_message_time DESC NULLS LAST;
        `;
        const { rows } = await pool.query(query, [userId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fetch messages for a confirmed conversation
app.get('/api/conversations/:id/messages', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT id, sender_id, content, is_read, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
            [req.params.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// FRIEND REQUESTS REST ENDPOINTS
// ==========================================

// 1. GET PENDING FRIEND REQUESTS (For the Bell Icon)
app.get('/api/friends/pending', verifyToken, async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || req.userId;
        const result = await pool.query(
            `SELECT fr.sender_id AS requester_id, u.username, u.display_name, u.avatar_url
             FROM friend_requests fr
             JOIN users u ON u.id = fr.sender_id
             WHERE fr.receiver_id = $1 AND fr.status = 'pending'`,
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching pending requests:', err.message);
        res.status(500).json({ error: 'Failed to fetch pending requests' });
    }
});

// 2. GET ACCEPTED FRIENDS LIST (For Group Creation)
app.get('/api/friends', verifyToken, async (req, res) => {
    try {
        const userId = req.user?.id || req.user?.userId || req.userId;
        const result = await pool.query(
            `SELECT u.id, u.username, u.display_name, u.avatar_url
             FROM friend_requests fr
             JOIN users u ON (u.id = fr.sender_id OR u.id = fr.receiver_id)
             WHERE (fr.sender_id = $1 OR fr.receiver_id = $1)
               AND fr.status = 'accepted'
               AND u.id != $1`,
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching friends:', err.message);
        res.status(500).json({ error: 'Failed to fetch friends' });
    }
});

// 3. SEND FRIEND REQUEST BY USERNAME (For the "+" Menu)
app.post('/api/friends/request', verifyToken, async (req, res) => {
    try {
        const senderId = req.user?.id || req.user?.userId || req.userId;
        const { targetUsername } = req.body;

        const targetRes = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [targetUsername]
        );
        if (targetRes.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const receiverId = targetRes.rows[0].id;
        if (receiverId === senderId) {
            return res.status(400).json({ error: 'You cannot add yourself' });
        }

        await pool.query(
            `INSERT INTO friend_requests (sender_id, receiver_id, status)
             VALUES ($1, $2, 'pending')
             ON CONFLICT (sender_id, receiver_id) DO NOTHING`,
            [senderId, receiverId]
        );

        io.to(`user_${receiverId}`).emit('friend_request_received', { senderDbId: senderId });

        res.json({ message: 'Friend request sent!' });
    } catch (err) {
        console.error('Error sending friend request:', err.message);
        res.status(500).json({ error: 'Failed to send friend request' });
    }
});

// 4. ACCEPT FRIEND REQUEST (For the Bell "Accept" Button)
app.put('/api/friends/accept', verifyToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const receiverId = req.user?.id || req.user?.userId || req.userId;
        const { requesterId } = req.body;

        await client.query('BEGIN');

        await client.query(
            `UPDATE friend_requests
             SET status = 'accepted'
             WHERE (sender_id = $1 AND receiver_id = $2)
                OR (sender_id = $2 AND receiver_id = $1)`,
            [requesterId, receiverId]
        );

        const [u1, u2] = [Math.min(requesterId, receiverId), Math.max(requesterId, receiverId)];
        await client.query(
            `INSERT INTO conversations (user_one, user_two)
             VALUES ($1, $2)
             ON CONFLICT (user_one, user_two) DO NOTHING`,
            [u1, u2]
        );

        await client.query('COMMIT');

        // Notify both users in real time to refresh their sidebar conversations
        io.to(`user_${requesterId}`).to(`user_${receiverId}`).emit('friendship_accepted');

        res.json({ message: 'Friend request accepted!' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error accepting friend request:', err.message);
        res.status(500).json({ error: 'Failed to accept friend request' });
    } finally {
        client.release();
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Globally backend running on http://localhost:${PORT}`);
});