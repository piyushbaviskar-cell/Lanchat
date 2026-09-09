import React from 'react';

function getColorIndex(ip = '') {
  // Hash the full IP for consistent color per user
  let sum = 0;
  for (let i = 0; i < ip.length; i++) {
    sum += ip.charCodeAt(i);
  }
  return sum % 6;
}

function formatTime(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString([], {
    hour:   '2-digit',
    minute: '2-digit',
  });
}

function SystemMessage({ message }) {
  const icon   = message.type === 'JOIN' ? '→' : '←';
  const action = message.type === 'JOIN' ? 'joined' : 'left';

  return (
    <div className="sys-message">
      {icon} {message.senderIp} {action}
    </div>
  );
}

function ChatBubble({ message, myIp }) {
  const isMine     = message.senderIp === myIp;
  const colorIndex = getColorIndex(message.senderIp);

  return (
    <div className="message-group">
      <div className="message-header">

        {/* Show full IP as the sender name */}
        <span className={`message-sender sc-${colorIndex}`}>
          {message.deviceType === 'MOBILE' || message.deviceType === 'TABLET' ? '📱 ' : '💻 '}
          {isMine ? `You (${message.senderIp})` : message.senderIp}
        </span>

        <span className="message-time">
          {formatTime(message.timestamp)}
        </span>

      </div>

      <div className={`message-bubble ${isMine ? 'mine' : ''}`}>
        {message.content}
      </div>
    </div>
  );
}

export default function MessageBubble({ message, myIp }) {
  if (message.type === 'JOIN' || message.type === 'LEAVE') {
    return <SystemMessage message={message} />;
  }
  if (message.type === 'TYPING') return null;

  return <ChatBubble message={message} myIp={myIp} />;
}