import React, { useEffect, useRef, useState } from 'react';

import { useWebSocket }  from './hooks/useWebSocket';
import MessageBubble     from './components/MessageBubble';
import UserList          from './components/UserList';
import InputBar          from './components/InputBar';

export default function App() {
  const [password, setPassword] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  const { messages, users, connected, authError, myIp, myName, typingUsers,  sendMessage,sendTyping, } = useWebSocket(password);

  // Ref attached to the bottom of the message list
  // Used to auto-scroll when new messages arrive
  const bottomRef = useRef(null);

  // Auto-scroll to bottom whenever messages array changes
  // smooth behaviour gives a polished feel without being jarring
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // If we have an auth error after trying to join, go back
  useEffect(() => {
      if (authError && hasJoined) {
          setHasJoined(false);
          setPassword('');
      }
  }, [authError, hasJoined]);

  if (!hasJoined) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '20px', background: 'var(--bg-base)', fontFamily: 'var(--sans)' }}>
         <h1 style={{color: 'white', fontSize: '2rem'}}>localchat</h1>
         <div style={{color: 'var(--muted)', marginTop: '-10px', marginBottom: '20px'}}>Enter room password to join</div>
         {authError && <div style={{color: '#ff4444', marginBottom: '10px'}}>Incorrect password</div>}
         <form onSubmit={(e) => { e.preventDefault(); setPassword(passwordInput); setHasJoined(true); }} style={{display: 'flex'}}>
           <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} placeholder="Password" style={{padding: '10px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white', marginRight: '10px', outline: 'none'}} autoFocus />
           <button type="submit" style={{padding: '10px 20px', borderRadius: '4px', background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold'}}>Join</button>
         </form>
      </div>
    );
  }

  // ── Connection status label ──────────────────────────────────────────
  const statusLabel = connected ? 'Connected' : 'Reconnecting…';

  // ── Active user count for the top bar ───────────────────────────────
  const userCount = users.length;

  return (
    <div className="app-shell">

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header className="topbar">

        {/* App name */}
        <span className="topbar-logo">localchat</span>

        {/* LAN badge — reminds users this is a local-only tool */}
        <span className="topbar-badge">LAN only</span>

        {/* User count badge */}
        {userCount > 0 && (
          <span className="topbar-badge">
            {userCount} online
          </span>
        )}

        {/* Connection status — right aligned */}
        <div className="topbar-status">
          <span className={`status-dot ${connected ? '' : 'offline'}`} />
          <span>{statusLabel}</span>
        </div>

      </header>

      {/* ── Main workspace ───────────────────────────────────────────── */}
      <div className="workspace">

        {/* ── Sidebar: online users ────────────────────────────────── */}
        <UserList
          users={users}
        myIp={myIp}           // ← was myName
        typingUsers={typingUsers} 
        />

        {/* ── Chat area ────────────────────────────────────────────── */}
        <section className="chat-area">

          {/* ── Message list ───────────────────────────────────────── */}
          <div className="message-list">

            {/* Empty state — shown before any messages arrive */}
            {messages.length === 0 && (
              <div style={{
                margin:     'auto',
                textAlign:  'center',
                color:      'var(--muted)',
                fontFamily: 'var(--mono)',
                fontSize:   '12px',
                lineHeight: '1.8',
              }}>
                No messages yet.<br />
                Say hello to the team.
              </div>
            )}

            {/* Render each message — MessageBubble decides whether to   */}
            {/* show a chat bubble or a system notice based on msg.type  */}
            {messages.map((msg, index) => (
              <MessageBubble
                key={index}
                message={msg}
                  myIp={myIp} 
              />
            ))}

            {/* Invisible anchor element at the very bottom of the list  */}
            {/* scrollIntoView on this keeps the view pinned to newest   */}
            <div ref={bottomRef} />

          </div>

          {/* ── Input bar ──────────────────────────────────────────── */}
          <InputBar
            onSend={sendMessage}
            onTyping={sendTyping} 
            disabled={!connected}
          />

        </section>

      </div>

    </div>
  );
}