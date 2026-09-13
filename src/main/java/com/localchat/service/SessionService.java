package com.localchat.service;

import com.localchat.model.ChatMessage;
import com.localchat.model.ChatUser;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.time.Instant;

@Component
public class SessionService {

    private final MessageStore messageStore;
    private final SimpMessageSendingOperations messaging;

    // Constructor injection — preferred over @Autowired field injection
    // Makes dependencies explicit and easier to test
    public SessionService(MessageStore messageStore,
                          SimpMessageSendingOperations messaging) {
        this.messageStore = messageStore;
        this.messaging = messaging;
    }

    // Spring fires this automatically the moment a WebSocket connection
    // is established — before the user sends any message
    @EventListener
    public void handleConnect(SessionConnectEvent event) {
        StompHeaderAccessor accessor =
            StompHeaderAccessor.wrap(event.getMessage());

        String sessionId = accessor.getSessionId();
        String ip = (String) accessor.getSessionAttributes().get("ip");
        String deviceType = (String) accessor.getSessionAttributes().get("deviceType");
        String clientId = (String) accessor.getSessionAttributes().get("clientId");
        if (clientId == null) clientId = sessionId; // Fallback

        // Build the user object and store it immediately on connect
        ChatUser user = ChatUser.builder()
            .ip(ip)
            .displayName(ChatUser.deriveDisplayName(ip))
            .deviceType(deviceType)
            .sessionId(sessionId)
            .clientId(clientId)
            .joinedAt(Instant.now())
            .build();

        messageStore.addUser(user);
    }

    // Spring fires this automatically when a WebSocket session closes
    // This covers ALL disconnect scenarios:
    //   - User closes the browser tab
    //   - User loses Wi-Fi
    //   - Browser crashes
    //   - User navigates away
    // No client-side action needed — the server handles everything
    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor =
            StompHeaderAccessor.wrap(event.getMessage());

        String sessionId = accessor.getSessionId();

        // Look up the user before removing them so we know their name
        ChatUser user = messageStore.getUser(sessionId);

        if (user == null) {
            // Session was never fully registered — nothing to clean up
            return;
        }

        // Remove user and check if the room is now empty
        boolean roomEmpty = messageStore.removeUserAndCheckEmpty(sessionId);

        // Broadcast a LEAVE notice to all remaining users
        // If the room is empty this still runs but nobody receives it
        ChatMessage leaveMessage = ChatMessage.builder()
            .type(ChatMessage.Type.LEAVE)
            .senderName(user.getDisplayName())
            .senderIp(user.getIp())
            .senderClientId(user.getClientId())
            .timestamp(Instant.now())
            .build();

        messaging.convertAndSend("/topic/public", leaveMessage);

        if (roomEmpty) {
            // Log that history was wiped — useful during development
            // to confirm the privacy guarantee is working
            System.out.println(
                "[LocalChat] Room empty — all message history wiped."
            );
        }
    }
}