import React from 'react';

function getColorIndex(ip = '') {
  let sum = 0;
  for (let i = 0; i < ip.length; i++) {
    sum += ip.charCodeAt(i);
  }
  return sum % 6;
}

function getAvatarLabel(ip = '') {
  const parts = ip.split('.');
  return parts[parts.length - 1] || '?';
}

function UserItem({ user, isMe }) {
  const colorIndex = getColorIndex(user.ip);

  return (
    <div className="user-item">
      <div className={`user-avatar av-${colorIndex}`}>
        {getAvatarLabel(user.ip)}
      </div>

      <div className="user-info">
        <div className="user-name">
          {user.deviceType === 'MOBILE' || user.deviceType === 'TABLET' ? '📱 ' : '💻 '}
          {user.ip}
        </div>
        {isMe && (
          <div className="user-ip">your device</div>
        )}
      </div>

      {isMe
        ? <span className="user-you-badge">you</span>
        : <span className="user-online-dot" />
      }
    </div>
  );
}

export default function UserList({ users, myIp, typingUsers }) {
  return (
    <aside className="sidebar">

      <div className="sidebar-header">
        Online — {users.length}
      </div>

      <div className="sidebar-users">
        {users.length === 0 ? (
          <div style={{
            padding:    '16px 14px',
            fontSize:   '12px',
            color:      'var(--muted)',
            fontFamily: 'var(--mono)',
          }}>
            Connecting…
          </div>
        ) : (
          users.map(user => (
            <UserItem
              key={user.ip}
              user={user}
              isMe={user.ip === myIp}
            />
          ))
        )}
      </div>

      {/* Typing indicator — only shows other users typing, not yourself */}
      {typingUsers.filter(ip => ip !== myIp).length > 0 && (
        <div style={{
          padding:    '8px 14px',
          fontSize:   '11px',
          fontFamily: 'var(--mono)',
          color:      'var(--accent)',
          borderTop:  '1px solid var(--border)',
        }}>
          {typingUsers
            .filter(ip => ip !== myIp)
            .map(ip => {
              const parts = ip.split('.');
              return `User ${parts[parts.length - 1]}`;
            })
            .join(', ')
          } is typing…
        </div>
      )}

      <div className="sidebar-footer">
        <span>⚠ no history</span><br />
        Chat is wiped when<br />
        everyone disconnects.
      </div>

    </aside>
  );
}