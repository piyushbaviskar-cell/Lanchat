package com.localchat.service;

import com.localchat.controller.ChatController;
import com.localchat.model.ChatMessage;
import com.localchat.model.ChatUser;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Component
public class SessionService {

    private final MessageStore messageStore;
    private final SimpMessageSendingOperations messaging;

    public SessionService(MessageStore messageStore,
                          SimpMessageSendingOperations messaging) {
        this.messageStore = messageStore;
        this.messaging = messaging;
    }

    @EventListener
    public void handleConnect(SessionConnectEvent event) {
        StompHeaderAccessor accessor =
            StompHeaderAccessor.wrap(event.getMessage());

        String sessionId = accessor.getSessionId();
        Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
        String ip = sessionAttributes != null ? (String) sessionAttributes.get("ip") : "127.0.0.1";
        String deviceType = sessionAttributes != null ? (String) sessionAttributes.get("deviceType") : "DESKTOP";
        String clientId = sessionAttributes != null ? (String) sessionAttributes.get("clientId") : null;
        if (clientId == null) clientId = sessionId;

        ChatUser user = ChatUser.builder()
            .ip(ip)
            .displayName(ChatUser.deriveDisplayName(ip))
            .deviceType(deviceType)
            .sessionId(sessionId)
            .clientId(clientId)
            .joinedAt(Instant.now())
            .build();

        messageStore.addUser(user);
        if (sessionId != null && clientId != null) {
            ChatController.sessionToClientId.put(sessionId, clientId);
        }
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor =
            StompHeaderAccessor.wrap(event.getMessage());

        String sessionId = accessor.getSessionId();
        if (sessionId == null) return;

        // 1. Purge from ChatController presence maps
        String clientId = ChatController.sessionToClientId.remove(sessionId);
        if (clientId != null) {
            ChatController.activeUsers.remove(clientId);
        } else {
            // Check if any active user key matches sessionId
            ChatController.activeUsers.remove(sessionId);
        }

        // Broadcast updated presence immediately
        List<Map<String, Object>> presenceList = ChatController.activeUsers.values().stream().toList();
        messaging.convertAndSend("/topic/presence", (Object) presenceList);

        // 2. Clean up messageStore
        ChatUser user = messageStore.getUser(sessionId);
        if (user != null) {
            boolean roomEmpty = messageStore.removeUserAndCheckEmpty(sessionId);

            ChatMessage leaveMessage = ChatMessage.builder()
                .type(ChatMessage.Type.LEAVE)
                .senderName(user.getDisplayName())
                .senderIp(user.getIp())
                .senderClientId(user.getClientId())
                .timestamp(Instant.now())
                .build();

            messaging.convertAndSend("/topic/public", (Object) leaveMessage);

            if (roomEmpty) {
                System.out.println("[LocalChat] Room empty — all message history wiped.");
            }
        }
    }
}