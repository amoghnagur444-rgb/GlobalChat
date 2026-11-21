import React, { useState, useEffect, useRef } from 'react';
import { 
  FiSend, 
  FiPaperclip, 
  FiGlobe, 
  FiLock,
  FiChevronLeft,
  FiAlertCircle,
  FiMoreVertical,
  FiUserPlus
} from 'react-icons/fi';

export default function ChatArea({ 
  activeChat, 
  isStrangerMode, 
  messages, 
  onSendMessage, 
  onSkipPeer, 
  onDisconnectStranger, 
  onAddFriend, // NEW PROP
  onTranslateMessage, 
  onBackMobile, 
  isMobileChatOpen, 
  onStartStrangerMatch,
  isPeerTyping,
  onTyping,
  isSearching, 
  onCancelSearch 
}) {
  const [inputText, setInputText] = useState('');
  const [showNextConfirm, setShowNextConfirm] = useState(false);
  const [showStrangerMenu, setShowStrangerMenu] = useState(false); // NEW STATE
  const [inactivityCount, setInactivityCount] = useState(60);
  const [isTimerActive, setIsTimerActive] = useState(true);
  
  const messagesEndRef = useRef(null);
  const nextMenuRef = useRef(null); 
  const strangerMenuRef = useRef(null); // NEW REF

  // --- Click-Outside Listener for Dropdowns ---
  useEffect(() => {
    function handleClickOutside(event) {
      if (nextMenuRef.current && !nextMenuRef.current.contains(event.target)) {
        setShowNextConfirm(false);
      }
      if (strangerMenuRef.current && !strangerMenuRef.current.contains(event.target)) {
        setShowStrangerMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isStrangerMode) return;
    if (messages.length > 1) {
      setIsTimerActive(false); 
    } else {
      setIsTimerActive(true);
      setInactivityCount(60);  
    }
  }, [messages, isStrangerMode]);

  useEffect(() => {
    if (!isStrangerMode || !isTimerActive) return;
    const interval = setInterval(() => {
      setInactivityCount((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isStrangerMode, isTimerActive]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPeerTyping]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  // --- EMPTY STATE (Welcome Screen) ---
  if (!activeChat && !isSearching) {
    return (
      <div className={`flex-1 bg-gray-50 dark:bg-gray-900 flex-col items-center justify-center p-6 transition-colors duration-200 ${isMobileChatOpen ? 'hidden' : 'hidden md:flex'}`}>
        <div className="bg-white dark:bg-gray-800 p-10 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center max-w-md w-full transition-colors duration-200">
          <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-6">
            <FiGlobe className="text-indigo-600 dark:text-indigo-400 w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">Welcome to Globally</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm leading-relaxed">
            Connect with friends worldwide or match with a stranger to start a brand new conversation.
          </p>
          <button 
            onClick={onStartStrangerMatch}
            className="bg-indigo-600 dark:bg-indigo-500 text-white px-8 py-3 rounded-full font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all shadow-md shadow-indigo-600/20"
          >
            Match with a Stranger
          </button>
        </div>

        <div className="absolute bottom-8 flex items-center gap-2 text-gray-400 dark:text-gray-500 text-xs">
          <FiLock />
          <span>Your personal messages are end-to-end encrypted</span>
        </div>
      </div>
    );
  }

  // --- SEARCHING STATE ---
  if (isSearching) {
    return (
      <div className={`flex-1 bg-gray-50 dark:bg-gray-900 flex-col items-center justify-center p-6 transition-colors duration-200 ${isMobileChatOpen ? 'flex' : 'hidden md:flex'}`}>
        <div className="bg-white dark:bg-gray-800 p-10 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center max-w-md w-full transition-colors duration-200">
          <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-6">
            <FiGlobe className="text-indigo-600 dark:text-indigo-400 w-12 h-12 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">Searching...</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm leading-relaxed">
             Looking for people globally to connect with you. Please wait a moment.
          </p>
          <button 
            onClick={onCancelSearch}
            className="bg-red-500 text-white px-8 py-3 rounded-full font-semibold hover:bg-red-600 transition-all shadow-md shadow-red-500/20"
          >
            Cancel Search
          </button>
        </div>

        <div className="absolute bottom-8 flex items-center gap-2 text-gray-400 dark:text-gray-500 text-xs">
          <FiLock />
          <span>Your personal messages are end-to-end encrypted</span>
        </div>
      </div>
    );
  }

  // --- ACTIVE CHAT STATE ---
  return (
    <div className={`flex-1 h-full bg-white dark:bg-gray-900 flex-col font-sans relative transition-colors duration-200 ${isMobileChatOpen ? 'flex' : 'hidden md:flex'}`}>
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900 z-10 transition-colors duration-200">
        <div className="flex items-center gap-3">
          
          {/* Conditionally hide the back button during Stranger Sessions on mobile */}
          {!isStrangerMode && (
            <button onClick={onBackMobile} className="md:hidden p-1.5 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
              <FiChevronLeft size={22} />
            </button>
          )}
          
          <img src={activeChat?.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=Stranger'} alt="Avatar" className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 object-cover" />
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              {activeChat?.display_name || 'Stranger'}
              {activeChat?.country && <span className="text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">{activeChat.country}</span>}
            </h3>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">{isStrangerMode ? 'Stranger Session' : 'Online'}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          {isStrangerMode && (
            <>
              {/* DESKTOP: Show Add Friend and Disconnect explicitly */}
              <div className="hidden md:flex items-center gap-2">
                <button 
                  onClick={onAddFriend} 
                  className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-sm font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <FiUserPlus size={14} /> Add Friend
                </button>
                <button 
                  onClick={onDisconnectStranger} 
                  className="px-4 py-1.5 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 text-sm font-semibold rounded-xl transition-colors"
                >
                  Disconnect
                </button>
              </div>

              {/* MOBILE: Three-dot menu for secondary actions */}
              <div className="md:hidden relative" ref={strangerMenuRef}>
                <button 
                  onClick={() => setShowStrangerMenu(!showStrangerMenu)}
                  className="p-2 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <FiMoreVertical size={20} />
                </button>
                
                {showStrangerMenu && (
                  <div className="absolute right-0 top-full mt-2 bg-white dark:bg-gray-800 p-2 rounded-xl shadow-xl z-50 flex flex-col gap-1 border border-gray-100 dark:border-gray-700 w-max">
                    <button 
                      onClick={() => { setShowStrangerMenu(false); onAddFriend(); }} 
                      className="px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-indigo-600 dark:text-indigo-400 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
                    >
                      <FiUserPlus size={14} /> Add Friend
                    </button>
                    <button 
                      onClick={() => { setShowStrangerMenu(false); onDisconnectStranger(); }} 
                      className="px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-red-600 dark:text-red-400 text-sm font-semibold rounded-lg transition-colors"
                    >
                      Disconnect Session
                    </button>
                  </div>
                )}
              </div>

              {/* ALWAYS VISIBLE: Next Button */}
              <div className="relative" ref={nextMenuRef}>
                {showNextConfirm && (
                  <div className="absolute right-0 top-full mt-2 bg-gray-900 dark:bg-gray-800 p-2 rounded-xl shadow-xl z-50 flex items-center gap-2 border border-gray-700 w-max">
                    <button 
                      onClick={() => { setShowNextConfirm(false); onSkipPeer(); }} 
                      className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      Skip
                    </button>
                    <button 
                      onClick={() => setShowNextConfirm(false)} 
                      className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      Stay
                    </button>
                  </div>
                )}
                <button 
                  onClick={() => setShowNextConfirm(!showNextConfirm)} 
                  className="px-4 py-1.5 ml-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-semibold rounded-xl transition-colors"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {isStrangerMode && isTimerActive && inactivityCount <= 10 && inactivityCount > 0 && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-4 py-2 text-xs flex items-center gap-2 border-b border-red-100 dark:border-red-900/30 animate-pulse">
          <FiAlertCircle size={16} />
          <span>Disconnecting in <strong>{inactivityCount}s</strong> due to inactivity! Send a message to keep active.</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-gray-950 transition-colors duration-200">
        {messages.map((msg, idx) => {
          const isSelf = msg.isSelf;
          return (
            <div key={idx} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
              <div className="flex items-end gap-2 max-w-[82%] md:max-w-[70%]">
                {!isSelf && <img src={activeChat?.avatar_url} alt="Peer" className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 mb-1" />}
                <div className={`p-3.5 rounded-3xl text-sm leading-relaxed relative group ${isSelf ? 'bg-violet-200 dark:bg-violet-700 text-violet-950 dark:text-white rounded-br-xs font-medium' : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-xs shadow-2xs border border-gray-100 dark:border-gray-700'}`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {!isSelf && (
                    <button onClick={() => onTranslateMessage(idx, msg.text)} className="absolute -top-3 right-0 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-full p-1 shadow-xs opacity-0 group-hover:opacity-100 hover:text-purple-600 dark:hover:text-purple-400 transition-opacity">
                      <FiGlobe size={12} />
                    </button>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 px-1">
                {msg.time || '15:05'} 
                {isSelf && (
                  <span className={msg.isRead ? "text-blue-500 font-bold" : "text-gray-400 dark:text-gray-500"}> ✓✓</span>
                )}
              </span>
            </div>
          );
        })}
        
        {isPeerTyping && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl px-4 py-3 text-sm text-gray-500 dark:text-gray-400 shadow-sm flex gap-1 items-center mb-2">
              <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
              <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 transition-colors duration-200">
        <div className="flex-1 flex items-center bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2">
          <input 
            type="text" 
            value={inputText} 
            onChange={(e) => {
              setInputText(e.target.value);
              if (onTyping) onTyping(); 
            }} 
            placeholder="Type your message..." 
            className="flex-1 bg-transparent text-sm focus:outline-hidden text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500" 
          />
          <button type="button" className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"><FiPaperclip size={18} /></button>
        </div>
        <button type="submit" className="w-10 h-10 rounded-full bg-violet-600 hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600 text-white flex items-center justify-center transition-colors"><FiSend size={16} /></button>
      </form>
    </div>
  );
}