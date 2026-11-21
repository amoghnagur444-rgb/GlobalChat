import React, { useState, useEffect, useRef } from 'react';
import { 
  FiSearch, FiPlus, FiGlobe, FiCheck, FiMoreHorizontal, 
  FiX, FiUserPlus, FiUsers, FiUser, FiMoon, FiLogOut, FiBell 
} from 'react-icons/fi';

export default function Sidebar({ myProfile,friendRefreshKey, conversations, activeConv, onSelectConv, onStartStrangerMatch, isSearching, onCancelSearch, isMobileChatOpen, onLogout, onlineUsers }) {
  const [activeTab, setActiveTab] = useState('All');
  
  const [isSearchLocalOpen, setIsSearchLocalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [friendUsername, setFriendUsername] = useState('');
  const [requestStatus, setRequestStatus] = useState({ type: '', message: '' });
  const [groupName, setGroupName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState([]);
  
  const [pendingRequests, setPendingRequests] = useState([]);
  const [friendsList, setFriendsList] = useState([]);

  // Dark mode state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') === 'dark');

  const optionsMenuRef = useRef(null);
  const plusMenuRef = useRef(null);
  const notificationsRef = useRef(null);

  useEffect(() => {
    fetchFriendsData();

    // Rehydrate dark mode on mount
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    } else {
      document.documentElement.classList.remove('dark');
      setIsDarkMode(false);
    }

    function handleClickOutside(event) {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target)) setIsOptionsMenuOpen(false);
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target)) setIsPlusMenuOpen(false);
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) setIsNotificationsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchFriendsData();
  }, [friendRefreshKey]);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    setIsOptionsMenuOpen(false);
  };

  const fetchFriendsData = async () => {
    const token = localStorage.getItem('token');
    try {
      const [pendingRes, friendsRes] = await Promise.all([
        fetch('http://localhost:5000/api/friends/pending', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('http://localhost:5000/api/friends', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      if (pendingRes.ok) setPendingRequests(await pendingRes.json());
      if (friendsRes.ok) setFriendsList(await friendsRes.json());
    } catch (error) {
      console.error("Error fetching friend data:", error);
    }
  };

  const handleAcceptRequest = async (requesterId) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('http://localhost:5000/api/friends/accept', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ requesterId })
      });
      if (response.ok) {
        fetchFriendsData(); 
        setIsNotificationsOpen(false);
      }
    } catch (error) {
      console.error("Error accepting request:", error);
    }
  };

  const handleAddFriend = async (e) => {
    e.preventDefault();
    if (!friendUsername.trim()) return;

    setRequestStatus({ type: 'loading', message: 'Sending request...' });
    const token = localStorage.getItem('token');
    
    try {
      const response = await fetch('http://localhost:5000/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ targetUsername: friendUsername })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send request');

      setRequestStatus({ type: 'success', message: 'Friend request sent!' });
      setFriendUsername(''); 
      setTimeout(() => {
        setShowAddFriendModal(false); 
        setRequestStatus({ type: '', message: '' });
      }, 2000);
    } catch (err) {
      setRequestStatus({ type: 'error', message: err.message });
    }
  };

  const filteredChats = conversations.filter(chat => 
    chat.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`w-full md:w-80 lg:w-96 h-full bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex-col font-sans relative transition-colors duration-200 ${isMobileChatOpen ? 'hidden md:flex' : 'flex'}`}>
      
      <div className="px-5 py-4 flex items-center justify-between bg-white dark:bg-gray-900 z-20 transition-colors duration-200">
        <div className="relative" ref={optionsMenuRef}>
          <button 
            onClick={() => setIsOptionsMenuOpen(!isOptionsMenuOpen)}
            className={`transition-colors p-1.5 rounded-full ${isOptionsMenuOpen ? 'bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            <FiMoreHorizontal size={24} />
          </button>
          {isOptionsMenuOpen && (
            <div className="absolute left-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden z-50">
              <button 
                onClick={() => { setIsOptionsMenuOpen(false); setShowProfileModal(true); }}
                className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 border-b border-gray-50 dark:border-gray-700 transition-colors"
              >
                <FiUser className="text-gray-400 dark:text-gray-400" size={16} /> Profile
              </button>
              <button 
                onClick={toggleDarkMode}
                className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 border-b border-gray-50 dark:border-gray-700 transition-colors"
              >
                <FiMoon className="text-gray-400 dark:text-gray-400" size={16} /> {isDarkMode ? 'Light Mode' : 'Dark Mode'}
              </button>
              <button onClick={() => { setIsOptionsMenuOpen(false); onLogout(); }} className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-3 transition-colors">
                <FiLogOut className="text-red-500 dark:text-red-400" size={16} /> Log Out
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <div className="relative" ref={notificationsRef}>
            <button 
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={`relative p-2 rounded-full transition-colors ${isNotificationsOpen ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              <FiBell size={20} />
              {pendingRequests.length > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>
              )}
            </button>

            {isNotificationsOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden z-50">
                <div className="p-3 border-b border-gray-50 dark:border-gray-700 font-bold text-sm text-gray-800 dark:text-gray-200">Friend Requests</div>
                <div className="max-h-64 overflow-y-auto">
                  {pendingRequests.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">No pending requests</div>
                  ) : (
                    pendingRequests.map(req => (
                      <div key={req.requester_id} className="p-3 border-b border-gray-50 dark:border-gray-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img src={req.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${req.username}`} alt={req.username} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700" />
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{req.username}</span>
                        </div>
                        <button 
                          onClick={() => handleAcceptRequest(req.requester_id)}
                          className="px-3 py-1 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700"
                        >
                          Accept
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button onClick={() => setIsSearchLocalOpen(!isSearchLocalOpen)} className={`p-2 rounded-full transition-colors ${isSearchLocalOpen ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
            <FiSearch size={20} />
          </button>

          <div className="relative" ref={plusMenuRef}>
            <button onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)} className={`p-2 rounded-full transition-colors ${isPlusMenuOpen ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              <FiPlus size={22} />
            </button>
            {isPlusMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden z-50">
                <button onClick={() => { setIsPlusMenuOpen(false); setShowAddFriendModal(true); }} className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 border-b border-gray-50 dark:border-gray-700 transition-colors">
                  <FiUserPlus className="text-gray-400 dark:text-gray-400" size={16} /> Add Friend
                </button>
                <button onClick={() => { setIsPlusMenuOpen(false); setShowCreateGroupModal(true); }} className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors">
                  <FiUsers className="text-gray-400 dark:text-gray-400" size={16} /> Create Group
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`px-5 transition-all duration-300 ease-in-out overflow-hidden ${isSearchLocalOpen ? 'max-h-16 opacity-100 mb-4' : 'max-h-0 opacity-0 m-0'}`}>
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2.5 shadow-inner">
          <FiSearch size={16} className="text-gray-400 dark:text-gray-500" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search conversations..." className="flex-1 bg-transparent text-sm focus:outline-hidden px-3 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 w-full" />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><FiX size={14} /></button>}
        </div>
      </div>

      <div className="px-4 mb-2">
        {isSearching ? (
          <button
            onClick={onCancelSearch}
            className="w-full py-2.5 px-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-semibold shadow-sm flex items-center justify-center gap-2 transition-colors"
          >
            <span>Cancel Search</span>
          </button>
        ) : (
          <button
            onClick={onStartStrangerMatch}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl font-semibold shadow-sm flex items-center justify-center gap-2"
          >
            <FiGlobe size={18} /><span>Match with Stranger</span>
          </button>
        )}
      </div>

      <div className="px-4 py-2 flex items-center gap-2">
        {['All', 'Chats', 'Groups'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-1.5 rounded-full text-xs font-semibold ${activeTab === tab ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>{tab}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {filteredChats.map((conv) => {
          const isOnline = onlineUsers?.has(conv.peer_id);
          
          return (
            <div key={conv.conversation_id} onClick={() => onSelectConv(conv)} className={`p-3 rounded-2xl flex items-center gap-3 cursor-pointer ${activeConv?.conversation_id === conv.conversation_id ? 'bg-purple-50 dark:bg-purple-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
              <div className="relative">
                <img src={conv.avatar_url} alt={conv.display_name} className="w-12 h-12 rounded-full object-cover bg-gray-100 dark:bg-gray-800" />
                {isOnline && (
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full"></span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{conv.display_name}</h4>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{conv.last_message_time || '15:05'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{conv.last_message || 'Start chatting...'}</p>
                  {conv.unread_count ? <span className="bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{conv.unread_count}</span> : <FiCheck className="text-gray-400 dark:text-gray-500" size={14} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showAddFriendModal && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-xl border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Add a Friend</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Enter their username to send a request.</p>
            <form onSubmit={handleAddFriend} className="space-y-4">
              {requestStatus.message && (
                <div className={`p-3 rounded-xl text-sm font-medium text-center ${requestStatus.type === 'error' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'}`}>
                  {requestStatus.message}
                </div>
              )}
              <input type="text" required value={friendUsername} onChange={(e) => setFriendUsername(e.target.value)} placeholder="Username" className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm focus:outline-hidden focus:border-violet-500 dark:text-white" />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddFriendModal(false); setRequestStatus({ type: '', message: '' }); setFriendUsername(''); }} className="flex-1 px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">Cancel</button>
                <button type="submit" disabled={requestStatus.type === 'loading'} className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 rounded-xl">Send Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-xl border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Create a Group</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Name your group and add your friends.</p>
            <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group Name" className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm mb-4 dark:text-white" />
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Select Members</p>
              <div className="max-h-40 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-900 p-2 space-y-1">
                {friendsList.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">Add friends to create a group</div>
                ) : (
                  friendsList.map(friend => (
                    <label key={friend.id} className="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 text-violet-600 rounded border-gray-300 dark:border-gray-600" checked={selectedFriends.includes(friend.id)} onChange={(e) => { e.target.checked ? setSelectedFriends([...selectedFriends, friend.id]) : setSelectedFriends(selectedFriends.filter(id => id !== friend.id)); }} />
                      <img src={friend.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${friend.username}`} alt={friend.username} className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{friend.username}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowCreateGroupModal(false); setSelectedFriends([]); }} className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">Cancel</button>
              <button onClick={() => {
                if(!groupName.trim() || selectedFriends.length === 0) return alert("Please enter a name and select at least one friend.");
                alert(`Group "${groupName}" created!`);
                setShowCreateGroupModal(false); setGroupName(''); setSelectedFriends([]);
              }} className="px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* --- PROFILE MODAL --- */}
      {showProfileModal && myProfile && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 w-full max-w-sm shadow-xl flex flex-col items-center relative border border-gray-100 dark:border-gray-700">
            <button onClick={() => setShowProfileModal(false)} className="absolute top-4 right-4 p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full transition-colors">
              <FiX size={20} />
            </button>
            
            <img src={myProfile.avatar_url} alt="Profile" className="w-24 h-24 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border-4 border-white dark:border-gray-800 shadow-sm mb-4 object-cover" />
            
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{myProfile.display_name}</h3>
            <p className="text-gray-500 dark:text-gray-400 font-medium mb-4">@{myProfile.username}</p>
            
            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
              <FiGlobe />
              {myProfile.country || 'Global'}
            </div>

            <button onClick={() => setShowProfileModal(false)} className="w-full py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-semibold transition-colors">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}