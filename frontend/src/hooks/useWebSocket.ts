import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs.min.js';

export function useWebSocket(password: string) {
  const clientRef = useRef<Client | null>(null);
  const [authError, setAuthError] = useState(false);

  const [messages,      setMessages]      = useState<any[]>([]);
  const [users,         setUsers]         = useState<any[]>([]);
  const [connected,     setConnected]     = useState(false);
  const [myIp,          setMyIp]          = useState<string | null>(null);
  const [myName,        setMyName]        = useState<string | null>(null);
  const [myClientId,    setMyClientId]    = useState<string | null>(null);
  const [typingUsers,   setTypingUsers]   = useState<string[]>([]);

  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!password) return;
    
    // AuthError reset should ideally happen before reaching this effect or asynchronously
    // However, to satisfy React's warning and keep behavior, we queue it.
    queueMicrotask(() => setAuthError(false));

    let currentClientId = sessionStorage.getItem('clientId');
    if (!currentClientId) {
        currentClientId = Math.random().toString(36).substring(2, 10);
        sessionStorage.setItem('clientId', currentClientId);
    }
    setMyClientId(currentClientId);

    const client = new Client({
      brokerURL: `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws?password=${encodeURIComponent(password)}&clientId=${currentClientId}`,

      onConnect: () => {
        setConnected(true);

        client.subscribe('/topic/public', (frame) => {
          const msg = JSON.parse(frame.body);

          if (msg.type === 'CHAT') {
            setMessages(prev => [...prev, msg]);
          }

          if (msg.type === 'JOIN') {
            setUsers(prev =>
              prev.find(u => u.clientId === msg.senderClientId)
                ? prev
                : [...prev, {
                    name: msg.senderIp,
                    ip:   msg.senderIp,
                    clientId: msg.senderClientId,
                    deviceType: msg.deviceType
                  }]
            );
            setMessages(prev => [...prev, msg]);
          }

          if (msg.type === 'LEAVE') {
            setUsers(prev =>
              prev.filter(u => u.clientId !== msg.senderClientId)
            );
            setMessages(prev => [...prev, msg]);
          }

          if (msg.type === 'TYPING') {
            setTypingUsers(prev =>
              prev.includes(msg.senderClientId)
                ? prev
                : [...prev, msg.senderClientId]
            );

            setTimeout(() => {
              setTypingUsers(prev =>
                prev.filter(id => id !== msg.senderClientId)
              );
            }, 2000);
          }
        });

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
            setUsers(activeUsers.map((u: any) => ({
              name: u.ip,
              ip:   u.ip,
              clientId: u.clientId,
              deviceType: u.deviceType
            })));
          })
          .catch(() => console.warn('[LocalChat] Could not load users'));

        fetch('/api/me')
          .then(res => res.text())
          .then(ip => {
            setMyIp(ip);
            setMyName(ip);
          })
          .catch(() => console.warn('[LocalChat] Could not get own IP'));

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
    return () => {
      client.deactivate();
    };
  }, [password]);

  const sendTyping = useCallback(() => {
    if (!clientRef.current?.connected) return;

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    clientRef.current.publish({
      destination: '/app/chat.typing',
      body: JSON.stringify({ type: 'TYPING' }),
    });

    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
    }, 1500);
  }, []);

  const sendMessage = useCallback((content: string) => {
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
    myClientId,
    typingUsers,
    sendMessage,
    sendTyping,
  };
}
