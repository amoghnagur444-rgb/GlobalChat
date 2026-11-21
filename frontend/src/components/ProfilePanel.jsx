import React from 'react';

export default function ProfilePanel({ user, isStrangerMode, onSendFriendRequest }) {
  // Hide panel entirely if no chat is selected
  if (!user) return null; 

  return (
    <div className="w-80 bg-gray-50/50 border-l border-gray-100 flex-col items-center py-8 px-6 hidden lg:flex h-full">
      
      {/* Avatar Section */}
      <div className="w-28 h-28 rounded-full bg-white p-1 shadow-sm border border-gray-100 mb-5 relative">
        <img 
          src={user.avatar_url || 'https://api.dicebear.com/7.x/bottts/svg?seed=Stranger'} 
          alt="Profile" 
          className="w-full h-full rounded-full object-cover bg-gray-50"
        />
        {!isStrangerMode && (
          <span className="absolute bottom-2 right-2 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></span>
        )}
      </div>

      {/* User Info Section */}
      <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">
        {user.display_name || 'Stranger'}
      </h2>
      
      <p className="text-sm text-gray-500 mb-4 text-center">
        {user.country || 'Unknown Location'}
      </p>

      {/* Status Badge */}
      <div className="bg-green-50 text-green-700 border border-green-100 px-4 py-1.5 rounded-full text-xs font-bold mb-8 tracking-wide">
        {isStrangerMode ? 'In Stranger Session' : 'Available'}
      </div>

      {/* Optional: Functional Actions (No Fake Data) */}
      {isStrangerMode && onSendFriendRequest && (
        <button 
          onClick={onSendFriendRequest}
          className="w-full py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm"
        >
          Add as Friend
        </button>
      )}
    </div>
  );
}