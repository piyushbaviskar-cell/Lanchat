import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs.min.js';

export function useWebSocket(password) {
  const clientRef = useRef(null);
  const [authError, setAuthError] = useState(false);

  const [messages,      setMessages]      = useState([]);
  const [users,         setUsers]         = useState([]);
  const [connected,     setConnected]     = useState(false);
  const [myIp,          setMyIp]          = useState('');
  const [myName,        setMyName]        = useState('');
  const [typingUsers,   setTypingUsers]   = useState([]);

  // Typing timer ref — clears the "X is typing" notice after 2s
  // of inactivity so it doesn't stay on screen forever
  const typingTimerRef = useRef(null);

  useEffect(() => {
    if (!password) return;
    setAuthError(false);

    const client = new Client({
      webSocketFactory: () => new SockJS('/ws?password=' + encodeURIComponent(password)),

      onConnect: () => {
        setConnected(true);

        // Subscribe to public chat channel
        client.subscribe('/topic/public', (frame) => {
          const msg = JSON.parse(frame.body);

          if (msg.type === 'CHAT') {
            setMessages(prev => [...prev, msg]);
          }

          if (msg.type === 'JOIN') {
            // Use full IP as the display name
            setUsers(prev =>
              prev.find(u => u.ip === msg.senderIp)
                ? prev
                : [...prev, {
                    name: msg.senderIp,
                    ip:   msg.senderIp,
                    deviceType: msg.deviceType
                  }]
            );
            setMessages(prev => [...prev, msg]);

            // First JOIN is our own — store our IP
            if (!myIp) {
              setMyIp(msg.senderIp);
              setMyName(msg.senderIp);  // IP is the display name
            }
          }

          if (msg.type === 'LEAVE') {
            setUsers(prev =>
              prev.filter(u => u.ip !== msg.senderIp)
            );
            setMessages(prev => [...prev, msg]);
          }

          if (msg.type === 'TYPING') {
            // Add to typing list if not already there
            setTypingUsers(prev =>
              prev.includes(msg.senderIp)
                ? prev
                : [...prev, msg.senderIp]
            );

            // Auto-remove after 2 seconds of no typing events
            setTimeout(() => {
              setTypingUsers(prev =>
                prev.filter(ip => ip !== msg.senderIp)
              );
            }, 2000);
          }
        });

        // Load history and users
        fetch('/api/messages', { headers: { 'X-Room-Password': password } })
          .then(res => {
              if (res.status === 401) throw new Error('Unauthorized');
              return res.json();
          })
          .then(history => {
            if (history.length > 0) setMessages(history);
          })
          .catch((err) => {
              if (err.message === 'Unauthorized') setAuthError(true);
              console.warn('[LocalChat] Could not load history')
          });

        fetch('/api/users', { headers: { 'X-Room-Password': password } })
          .then(res => res.json())
          .then(activeUsers => {
            setUsers(activeUsers.map(u => ({
              name: u.ip,
              ip:   u.ip,
              deviceType: u.deviceType
            })));
          })
          .catch(() => console.warn('[LocalChat] Could not load users'));

        // Announce presence
        client.publish({
          destination: '/app/chat.join',
          body: JSON.stringify({ type: 'JOIN' }),
        });
      },

      onDisconnect: () => setConnected(false),

      onStompError: (frame) => {
        console.error('[LocalChat] STOMP error:', frame.headers['message']);
      },

      reconnectDelay: 3000,
    });

    clientRef.current = client;
    client.activate();
    return () => client.deactivate();
  }, [password]);

  // Sends a typing event — throttled so we don't spam the server
  // Called by InputBar every time the user presses a key
  const sendTyping = useCallback(() => {
    if (!clientRef.current?.connected) return;

    // Clear previous timer
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    clientRef.current.publish({
      destination: '/app/chat.typing',
      body: JSON.stringify({ type: 'TYPING' }),
    });

    // Stop sending typing events after 1.5s of no keystrokes
    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
    }, 1500);
  }, []);

  const sendMessage = useCallback((content) => {
    if (!clientRef.current?.connected) return;
    if (!content?.trim()) return;

    clientRef.current.publish({
      destination: '/app/chat.send',
      body: JSON.stringify({
        type:    'CHAT',
        content: content.trim(),
      }),
    });
  }, []);

  return {
    messages,
    users,
    connected,
    authError,
    myIp,
    myName,
    typingUsers,
    sendMessage,
    sendTyping,
  };
}