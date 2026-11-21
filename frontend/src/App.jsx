import React, { useState, useEffect } from 'react';
import { socket } from './socket';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import Auth from './components/Auth';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  
  // Dynamically generate the profile based on the logged-in PostgreSQL user
  const myProfile = currentUser ? {
    id: currentUser.id,
    display_name: currentUser.display_name || currentUser.username,
    country: currentUser.country || 'Global',
    avatar_url: currentUser.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`
  } : null;

  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [isStrangerMode, setIsStrangerMode] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [isDuplicateSession, setIsDuplicateSession] = useState(false);
  const [friendRefreshKey, setFriendRefreshKey] = useState(0);

  // Real-time Presence State
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  const [messages, setMessages] = useState([
    { id: 1, text: 'Welcome to Globally!', isSelf: false, time: 'Now' }
  ]);

  // Join the user's personal WebSocket room and announce presence on login
  useEffect(() => {
    if (currentUser) {
      socket.emit('user_connected', currentUser.id); // Announce presence
      socket.emit('join_personal_room', currentUser.id); // Join private message room
    }
  }, [currentUser]);

  // Load conversation list when authenticated
  useEffect(() => {
    if (!currentUser) return;

    const fetchConversations = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5000/api/conversations', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setConversations(data);
        }
      } catch (error) {
        console.error("Failed to load chats:", error);
      }
    };

    fetchConversations();
  }, [currentUser]);

  // Fetch message history when opening a friend chat
  useEffect(() => {
    if (isStrangerMode || !activeChat?.conversation_id) return;

    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`http://localhost:5000/api/messages/${activeChat.conversation_id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          const formattedMessages = data.map(msg => ({
            id: msg.id,
            text: msg.content,
            isSelf: msg.sender_id === currentUser.id,
            time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }));
          setMessages(formattedMessages);
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      }
    };

    fetchMessages();
  }, [activeChat, isStrangerMode, currentUser]);

  // Sockets Event Router
  useEffect(() => {
    // --- NEW: Multi-Device Force Logout Listener ---
    socket.on('force_logout', ({ message }) => {
      // Clear token and disconnect, but DO NOT redirect yet
      localStorage.removeItem('token');
      if (socket) socket.disconnect();
      
      // Trigger the custom lock screen
      setIsDuplicateSession(true);
    });

    socket.on('peer_typing', ({ senderId, isStranger }) => {
      if (isStranger || (activeChat && activeChat.peer_id === senderId)) {
        setIsPeerTyping(true);
      }
    });

    socket.on('peer_stopped_typing', () => {
      setIsPeerTyping(false);
    });

    // Refresh sidebar chats for both users when a friend request is accepted
    socket.on('friendship_accepted', async () => {
      setFriendRefreshKey((prev) => prev + 1);
      const token = localStorage.getItem('token');
      try {
        const res = await fetch('http://localhost:5000/api/conversations', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) setConversations(await res.json());
      } catch (err) {
        console.error('Failed to refresh conversations:', err);
      }
    });

    // Show accurate feedback ("Sent!" vs "Already friends!")
    socket.on('friend_request_feedback', ({ message }) => {
      alert(message);
    });

    socket.on('peer_read_messages', ({ conversationId }) => {
      if (activeChat && activeChat.conversation_id === conversationId) {
        setMessages(prev => prev.map(msg => ({ ...msg, isRead: true })));
      }
    });

    // Presence Listeners
    socket.on('initial_presence', (userIds) => {
      setOnlineUsers(new Set(userIds));
    });

    socket.on('presence_update', ({ userId, isOnline }) => {
      setOnlineUsers((prev) => {
        const updated = new Set(prev);
        if (isOnline) updated.add(userId);
        else updated.delete(userId);
        return updated;
      });
    });

    socket.on('queue_waiting', (data) => {
      setIsSearching(true);
      setMessages([{ id: Date.now(), text: data.message, isSelf: false, time: 'Now' }]);
    });

    socket.on('match_found', ({ roomId, peer }) => {
      setIsSearching(false);
      setIsStrangerMode(true);
      setCurrentRoomId(roomId);
      
      // We added peer_id: peer.id here so the Add Friend button knows who to send it to
      setActiveChat({ 
        display_name: peer.display_name, 
        country: peer.country, 
        avatar_url: peer.avatar_url,
        peer_id: peer.id 
      });
      
      setMessages([{ id: Date.now(), text: `Matched with ${peer.display_name}! Say hi.`, isSelf: false, time: 'Now' }]);
    });

    socket.on('receive_ephemeral_message', (msgObj) => {
      setMessages((prev) => [
        ...prev, 
        { 
          id: msgObj.id, 
          text: msgObj.text, 
          isSelf: false, 
          time: new Date(msgObj.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        }
      ]);
    });

    // Real-time private message receiver
    socket.on('receive_private_message', (msgObj) => {
      if (activeChat && activeChat.conversation_id === msgObj.conversation_id) {
        setMessages((prev) => [...prev, msgObj]);
      }
      
      // Move the conversation with the new message to the top
      setConversations((prev) => {
        const convIndex = prev.findIndex(c => c.conversation_id === msgObj.conversation_id);
        if (convIndex === -1) return prev;

        const updatedConv = { ...prev[convIndex], last_message: msgObj.text, last_message_time: msgObj.time };
        const remainingConvs = prev.filter(c => c.conversation_id !== msgObj.conversation_id);
        
        return [updatedConv, ...remainingConvs];
      });
    });

    socket.on('chat_timeout', ({ message }) => {
      alert(message);
      setIsStrangerMode(false);
      setCurrentRoomId(null);
      setActiveChat(conversations[0] || null);
      setShowMobileChat(false); 
    });

    socket.on('peer_skipped', ({ message }) => {
      alert(message);
      setIsStrangerMode(false);
      setCurrentRoomId(null);
      setActiveChat(conversations[0] || null);
      setShowMobileChat(false);
    });

    socket.on('peer_disconnected', ({ message }) => {
      alert(message);
      setIsStrangerMode(false);
      setCurrentRoomId(null);
      setActiveChat(conversations[0] || null);
      setShowMobileChat(false);
    });

    socket.on('friend_request_received', () => {
      setFriendRefreshKey((prev) => prev + 1); // Updates the Sidebar bell icon
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: '🌟 The stranger sent you a friend request! Check the bell icon in your sidebar to accept it.',
          isSelf: false,
          time: 'System'
        }
      ]);
    });

    return () => {
      socket.off('force_logout'); // <-- Make sure to clean this up too!
      socket.off('initial_presence');
      socket.off('presence_update');
      socket.off('queue_waiting');
      socket.off('match_found');
      socket.off('receive_ephemeral_message');
      socket.off('receive_private_message');
      socket.off('chat_timeout');
      socket.off('peer_skipped');
      socket.off('peer_disconnected');
      socket.off('peer_typing');
      socket.off('peer_stopped_typing');
      socket.off('friend_request_received');
      socket.off('friendship_accepted');
      socket.off('friend_request_feedback');
    };
  }, [activeChat, conversations]);

  const handleStartStrangerMatch = () => {
    setIsStrangerMode(true);
    setIsSearching(true);
    setShowMobileChat(true);
    setActiveChat({ display_name: 'Searching...', country: 'Global', avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Searching' });
    setMessages([{ id: Date.now(), text: 'Looking for someone online...', isSelf: false, time: 'Now' }]);
    socket.emit('join_queue', myProfile);
  };

  const handleCancelSearch = () => {
    setIsSearching(false);
    socket.emit('leave_queue');
    
    // Reset the UI back to normal mode
    setIsStrangerMode(false);
    setActiveChat(conversations[0] || null); // Selects your first friend, or shows empty screen
    setShowMobileChat(false); // Takes mobile users back to the sidebar
  };

  let typingTimeout = null;
  const handleTyping = () => {
    if (isStrangerMode && currentRoomId) {
      socket.emit('typing', { roomId: currentRoomId });
    } else if (activeChat?.peer_id) {
      socket.emit('typing', { receiverId: activeChat.peer_id });
    }

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      if (isStrangerMode && currentRoomId) {
        socket.emit('stop_typing', { roomId: currentRoomId });
      } else if (activeChat?.peer_id) {
        socket.emit('stop_typing', { receiverId: activeChat.peer_id });
      }
    }, 2000);
  };

  const handleSendMessage = async (text) => {
    const messageTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Instantly show message in the chat window
    setMessages((prev) => [
      ...prev, 
      { id: Date.now(), text, isSelf: true, time: messageTime }
    ]);

    if (isStrangerMode && currentRoomId) {
      socket.emit('send_ephemeral_message', { roomId: currentRoomId, text, senderId: myProfile.id });
    } else if (activeChat?.conversation_id) {
      try {
        const token = localStorage.getItem('token');
        
        // 2. Save to PostgreSQL
        await fetch('http://localhost:5000/api/messages', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({ 
            conversationId: activeChat.conversation_id, 
            content: text 
          })
        });

        // 3. Push to friend's screen
        socket.emit('send_private_message', {
          receiverId: activeChat.peer_id,
          messageObj: {
            id: Date.now(),
            text,
            isSelf: false,
            time: messageTime,
            conversation_id: activeChat.conversation_id
          }
        });

        // 4. Update Sidebar & Move Chat to Top
        setConversations((prev) => {
          const convIndex = prev.findIndex(c => c.conversation_id === activeChat.conversation_id);
          if (convIndex === -1) return prev;

          const updatedConv = { ...prev[convIndex], last_message: text, last_message_time: messageTime };
          const remainingConvs = prev.filter(c => c.conversation_id !== activeChat.conversation_id);
          
          return [updatedConv, ...remainingConvs];
        });
      } catch (error) {
        console.error("Failed to send message:", error);
      }
    }
  };

  const handleTranslateMessage = async (idx, text) => {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      const translatedText = data[0].map(item => item[0]).join('');

      setMessages((prev) => 
        prev.map((msg, index) => 
          (msg.id === idx || index === idx) 
            ? { ...msg, text: `${msg.text}\n\n[Translated]: ${translatedText}` } 
            : msg
        )
      );
    } catch (error) {
      console.error("Translation error:", error);
      alert("Could not translate this message.");
    }
  };

  const handleSkipPeer = () => {
    socket.emit('skip_peer');
    handleStartStrangerMatch();
  };

  const handleDisconnectStranger = () => {
    socket.emit('skip_peer'); // Tells the backend to cleanly close the room for both users
    setIsStrangerMode(false);
    setCurrentRoomId(null);
    setActiveChat(conversations[0] || null); // Return to default screen
    setShowMobileChat(false);
  };

  const handleAddStrangerAsFriend = () => {
    console.log('📤 [Sender] Attempting friend request:', {
      myId: myProfile?.id,
      peerId: activeChat?.peer_id,
      roomId: currentRoomId,
      socketConnected: socket.connected
    });

    if (!activeChat || !activeChat.peer_id || !currentRoomId) return;

    socket.emit('send_friend_request', { 
      senderDbId: myProfile.id, 
      receiverDbId: activeChat.peer_id, 
      roomId: currentRoomId 
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    
    if (socket) {
      socket.disconnect();
    }

    window.location.href = '/'; 
  };

  if (!currentUser) {
    return <Auth onLogin={(user) => setCurrentUser(user)} />;
  }
  
  if (isDuplicateSession) {
    return (
      <div className="flex h-screen w-screen bg-gray-100 dark:bg-gray-950 items-center justify-center p-4 font-sans transition-colors duration-200">
        <div className="bg-white dark:bg-gray-900 p-10 rounded-3xl shadow-xl flex flex-col items-center text-center max-w-md w-full border border-gray-100 dark:border-gray-800 transition-colors duration-200">
          <div className="w-20 h-20 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
            <span className="text-4xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Session Paused</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
            You logged into this account from another tab or device. To prevent chat errors, this session has been securely disconnected.
          </p>
          <button 
            onClick={() => window.location.href = '/'} 
            className="w-full py-3 bg-violet-600 hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600 text-white rounded-xl font-semibold shadow-sm transition-colors"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-gray-100 dark:bg-gray-950 items-center justify-center p-0 md:p-4 overflow-hidden font-sans transition-colors duration-200">
      <div className="flex w-full h-full max-w-7xl bg-white dark:bg-gray-900 md:rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 relative transition-colors duration-200">
        
        <Sidebar
          myProfile={myProfile}
          friendRefreshKey={friendRefreshKey}
          conversations={conversations}
          activeConv={activeChat}
          onlineUsers={onlineUsers}
          isSearching={isSearching} 
          onCancelSearch={handleCancelSearch} 
          onSelectConv={async (conv) => {
            if (isStrangerMode) socket.emit('skip_peer');
            setIsStrangerMode(false);
            setCurrentRoomId(null);
            setActiveChat(conv);
            setShowMobileChat(true);

            if (conv.unread_count && conv.unread_count > 0) {
              setConversations((prev) => 
                prev.map((c) => 
                  c.conversation_id === conv.conversation_id 
                    ? { ...c, unread_count: 0 } 
                    : c
                )
              );

              try {
                const token = localStorage.getItem('token');
                await fetch(`http://localhost:5000/api/messages/${conv.conversation_id}/read`, {
                  method: 'PUT',
                  headers: { 'Authorization': `Bearer ${token}` }
                });
              } catch (error) {
                console.error("Failed to update read status:", error);
              }
              
              socket.emit('mark_messages_read', { 
                senderId: conv.peer_id || conv.friend_id, 
                conversationId: conv.conversation_id 
              });
            }
          }}
          onStartStrangerMatch={handleStartStrangerMatch}
          isMobileChatOpen={showMobileChat}
          onLogout={handleLogout}
        />

        <ChatArea
          activeChat={activeChat}
          isStrangerMode={isStrangerMode}
          messages={messages}
          isSearching={isSearching} 
          onCancelSearch={handleCancelSearch} 
          onSendMessage={handleSendMessage}
          onSkipPeer={handleSkipPeer}
          onDisconnectStranger={handleDisconnectStranger}
          onAddFriend={handleAddStrangerAsFriend} 
          onTranslateMessage={handleTranslateMessage} 
          onBackMobile={() => setShowMobileChat(false)}
          isMobileChatOpen={showMobileChat}
          onStartStrangerMatch={handleStartStrangerMatch} 
          isPeerTyping={isPeerTyping}
          onTyping={handleTyping}
        />
      </div>
    </div>
  );
}