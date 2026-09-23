/**
 * useWebSocket: Hardened STOMP WebSocket Hook with Singleton Lifecycle, RBAC Sync & Ghost User Exorcism
 * - Eliminates React 18 StrictMode double-mount and Vite HMR phantom socket connections
 * - Dynamic LAN/Hotspot origin resolution (wss:// / ws://)
 * - Synchronizes active transport states broadcast from Host
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import { webCryptoService } from '../services/WebCryptoService';
import { webRTCService } from '../services/WebRTCService';
import { pttAudioService } from '../services/PTTAudioService';
import { identityService } from '../services/IdentityService';
import { stalRouter } from '../services/transports/STALRouter';

export function getWebSocketEndpoint(): string {
  if (typeof window === 'undefined') return 'ws://127.0.0.1:8080/ws';
  const isHttps = window.location.protocol === 'https:';
  const protocol = isHttps ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws`;
}

// Global active client singleton instance
let globalStompClient: Client | null = null;

export function useWebSocket(password: string) {
  const [authError, setAuthError] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  const [myIp, setMyIp] = useState<string | null>(null);
  const [myClientId, setMyClientId] = useState<string | null>(null);
  const [isGhostMode, setIsGhostMode] = useState(false);

  const subscriptionsRef = useRef<any[]>([]);

  useEffect(() => {
    if (!password) return;

    let currentClientId = sessionStorage.getItem('apex_clientId');
    if (!currentClientId) {
      currentClientId = Math.random().toString(36).substring(2, 10);
      sessionStorage.setItem('apex_clientId', currentClientId);
    }
    setMyClientId(currentClientId);

    const initConnection = async () => {
      try {
        await webCryptoService.initializeKeyPair();
        await identityService.initialize();

        if (window.crypto?.subtle && password) {
          const encoder = new TextEncoder();
          const keyMaterial = await crypto.subtle.importKey(
            "raw",
            encoder.encode(password.padEnd(32, '0').substring(0, 32)),
            { name: "PBKDF2" },
            false,
            ["deriveBits", "deriveKey"]
          );

          (webCryptoService as any).aesKey = await crypto.subtle.deriveKey(
            {
              name: "PBKDF2",
              salt: encoder.encode("lanchat-salt"),
              iterations: 100000,
              hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
          );
        }
      } catch (e) {
        console.warn('Crypto init notice:', e);
      }

      if (globalStompClient) {
        try {
          globalStompClient.deactivate();
        } catch (e) {}
        globalStompClient = null;
      }

      const client = new Client({
        brokerURL: `${getWebSocketEndpoint()}?password=${encodeURIComponent(password)}&clientId=${currentClientId}`,
        maxWebSocketChunkSize: 8 * 1024 * 1024,
        reconnectDelay: 2500,
        connectionTimeout: 8000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,

        onConnect: () => {
          setConnected(true);
          setConnectionError(null);
          stalRouter.setLanConnectivity(true);

          webRTCService.initialize(client, currentClientId!);
          pttAudioService.initialize(client, currentClientId!);

          subscriptionsRef.current.forEach(sub => {
            try { sub.unsubscribe(); } catch(e) {}
          });
          subscriptionsRef.current = [];

          // 1. Public Chat Topic
          const pubSub = client.subscribe('/topic/public', async (frame) => {
            try {
              const body = JSON.parse(frame.body);
              let msg: any = body;

              if (body.payload && typeof body.payload === 'string') {
                try {
                  const decrypted = await webCryptoService.decryptMessage(body.payload);
                  msg = JSON.parse(decrypted);
                } catch (decErr) {
                  msg = body;
                }
              }

              if (msg) {
                setMessages(prev => {
                  if (msg.id && prev.some(m => m.id === msg.id)) {
                    return prev.map(m => m.id === msg.id ? { ...msg, pending: false } : m);
                  }
                  return [...prev, { ...msg, pending: false }];
                });
              }
            } catch (e) {
              console.error('Failed to parse incoming public message:', e);
            }
          });
          subscriptionsRef.current.push(pubSub);

          // 2. Presence Topic
          const presenceSub = client.subscribe('/topic/presence', (frame) => {
            try {
              const list = JSON.parse(frame.body);
              if (Array.isArray(list)) {
                setUsers(list);
              }
            } catch (e) {
              console.error("Presence parse failed:", e);
            }
          });
          subscriptionsRef.current.push(presenceSub);

          // 3. Transport Sync Topic
          const transportSub = client.subscribe('/topic/transport', (frame) => {
            try {
              const data = JSON.parse(frame.body);
              if (data.tier) {
                stalRouter.setTierOverride(data.tier);
              }
            } catch (e) {}
          });
          subscriptionsRef.current.push(transportSub);

          // Announce Presence (unless in ghost mode)
          if (!isGhostMode) {
            const idState = identityService.getSafeState();
            const displayName = idState ? identityService.getDisplayName() : `Operator_${currentClientId.substring(0, 4).toUpperCase()}`;
            const deviceType = idState ? idState.deviceType : identityService.getDeviceType();

            client.publish({
              destination: '/app/presence.join',
              body: JSON.stringify({
                clientId: currentClientId,
                displayName,
                deviceType
              })
            });
          }
        },

        onDisconnect: () => {
          setConnected(false);
          stalRouter.setLanConnectivity(false);
          setConnectionError("Local Mesh Disconnected. Failing over to Sovereign Transports...");
        },

        onWebSocketError: (err) => {
          console.error('[STOMP WebSocket Error]', err);
          setConnected(false);
          stalRouter.setLanConnectivity(false);
        },

        onStompError: (frame) => {
          console.error('[STOMP Protocol Error]', frame);
        }
      });

      globalStompClient = client;
      client.activate();
    };

    initConnection();

    return () => {
      if (globalStompClient?.connected) {
        try {
          globalStompClient.publish({
            destination: '/app/presence.leave',
            body: JSON.stringify({ clientId: currentClientId })
          });
        } catch (e) {}
      }
      subscriptionsRef.current.forEach(sub => {
        try { sub.unsubscribe(); } catch (e) {}
      });
      subscriptionsRef.current = [];
      if (globalStompClient) {
        globalStompClient.deactivate();
        globalStompClient = null;
      }
      webRTCService.disconnectAll();
    };
  }, [password, isGhostMode]);

  const sendMessage = useCallback(async (content: string, replyToMsg?: any) => {
    if (!content?.trim()) return;

    const idState = identityService.getSafeState();
    const displayName = idState ? identityService.getDisplayName() : `Operator_${(myClientId || '').substring(0, 4).toUpperCase()}`;
    const deviceTag = idState ? idState.deviceTag : '#0000';
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const messageObj: any = {
      id: msgId,
      type: 'CHAT',
      senderClientId: myClientId,
      displayName,
      deviceTag,
      content: content.trim(),
      timestamp: Date.now(),
      pending: true
    };

    if (replyToMsg) {
      messageObj.replyTo = {
        id: replyToMsg.id,
        sender: replyToMsg.displayName || replyToMsg.senderClientId,
        content: replyToMsg.content?.substring(0, 100)
      };
    }

    setMessages(prev => [...prev, messageObj]);

    try {
      if (globalStompClient?.connected) {
        const payloadString = JSON.stringify(messageObj);
        let ciphertext = payloadString;
        if (window.crypto?.subtle) {
          try {
            ciphertext = await webCryptoService.encryptMessage(payloadString);
          } catch (e) {}
        }

        await stalRouter.routePacket({
          id: msgId,
          payload: ciphertext,
          senderTag: deviceTag
        }, globalStompClient);
      } else {
        await stalRouter.routePacket({
          id: msgId,
          payload: JSON.stringify(messageObj),
          senderTag: deviceTag
        });
      }
    } catch (err) {
      console.error('Failed to dispatch message:', err);
    }
  }, [myClientId]);

  const sendImage = useCallback(async (base64Image: string, replyToMsg?: any) => {
    if (!base64Image) return;

    const idState = identityService.getSafeState();
    const displayName = idState ? identityService.getDisplayName() : `Operator_${(myClientId || '').substring(0, 4).toUpperCase()}`;
    const deviceTag = idState ? idState.deviceTag : '#0000';
    const msgId = `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const messageObj: any = {
      id: msgId,
      type: 'IMAGE',
      senderClientId: myClientId,
      displayName,
      deviceTag,
      content: base64Image,
      timestamp: Date.now(),
      pending: true
    };

    if (replyToMsg) {
      messageObj.replyTo = {
        id: replyToMsg.id,
        sender: replyToMsg.displayName || replyToMsg.senderClientId,
        content: '[Image Attachment]'
      };
    }

    setMessages(prev => [...prev, messageObj]);

    try {
      if (globalStompClient?.connected) {
        globalStompClient.publish({
          destination: '/app/chat.sendMessage',
          body: JSON.stringify(messageObj)
        });
      }
    } catch (err) {
      console.error('Failed to send image:', err);
    }
  }, [myClientId]);

  return {
    messages,
    users,
    connected,
    authError,
    connectionError,
    myIp,
    setMyIp,
    myClientId,
    sendMessage,
    sendImage,
    setAuthError,
    stompClient: globalStompClient,
    isGhostMode,
    setIsGhostMode
  };
}
