package com.localchat.controller;

import com.localchat.model.ChatMessage;
import com.localchat.model.ChatUser;
import com.localchat.service.MessageStore;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import jakarta.servlet.http.HttpServletRequest;

import java.time.Instant;
import java.util.List;

@Controller
public class ChatController {

    private final MessageStore messageStore;
    private final SimpMessageSendingOperations messaging;

    @Value("${app.chat.password:}")
    private String roomPassword;

    // Constructor injection — keeps dependencies explicit and testable
    public ChatController(MessageStore messageStore,
                          SimpMessageSendingOperations messaging) {
        this.messageStore = messageStore;
        this.messaging = messaging;
    }

    // Handles a new user announcing themselves to the room
    // Client sends to "/app/chat.join"
    // Server broadcasts the JOIN message to "/topic/public"
    @MessageMapping("/chat.join")
    public void joinUser(@Payload ChatMessage message,
                         SimpMessageHeaderAccessor accessor) {

        // Pull the IP that was captured at handshake time in WebSocketConfig
        // This is the only place IP should ever be read — never trust
        // anything the client sends in the message body itself
        String ip = (String) accessor.getSessionAttributes().get("ip");
        String clientId = (String) accessor.getSessionAttributes().get("clientId");
        if (ip == null) ip = "Unknown";
        if (clientId == null) clientId = accessor.getSessionId();

        String deviceType = (String) accessor.getSessionAttributes().get("deviceType");
        String displayName = ChatUser.deriveDisplayName(ip);

        // Store the username in the session so SessionService can
        // read it later when the disconnect event fires
        accessor.getSessionAttributes().put("username", displayName);

        // Build the enriched JOIN message with server-verified identity
        ChatMessage joinMessage = ChatMessage.builder()
            .type(ChatMessage.Type.JOIN)
            .senderIp(ip)
            .senderClientId(clientId)
            .senderName(displayName)
            .deviceType(deviceType)
            .content(displayName + " joined the chat")
            .timestamp(Instant.now())
            .build();

        // Save to history so late joiners can see who is in the room
        messageStore.saveMessage(joinMessage);

        // Broadcast to everyone subscribed to /topic/public
        messaging.convertAndSend("/topic/public", joinMessage);
    }

    // Handles every regular chat message
    // Client sends to "/app/chat.send"
    // Server broadcasts to "/topic/public"
    @MessageMapping("/chat.send")
    public void sendMessage(@Payload ChatMessage message,
                            SimpMessageHeaderAccessor accessor) {

        // Again — IP comes from the session, never from the client payload
        String ip = (String) accessor.getSessionAttributes().get("ip");
        String clientId = (String) accessor.getSessionAttributes().get("clientId");
        if (ip == null) ip = "Unknown";
        if (clientId == null) clientId = accessor.getSessionId();
        String deviceType = (String) accessor.getSessionAttributes().get("deviceType");

        message.setSenderIp(ip);
        message.setSenderClientId(clientId);
        message.setSenderName(ChatUser.deriveDisplayName(ip));
        message.setDeviceType(deviceType);
        message.setType(ChatMessage.Type.CHAT);
        message.setTimestamp(Instant.now());

        // Reject empty or blank messages before they touch the store
        if (message.getContent() == null || message.getContent().isBlank()) {
            return;
        }

        // Trim whitespace and cap length to prevent abuse
        String safeContent = message.getContent().trim();
        if (safeContent.length() > 1000) {
            safeContent = safeContent.substring(0, 1000);
        }

        String displayName = ChatUser.deriveDisplayName(ip);

        // Build the verified message — overwrite anything the client sent
        // in the senderIp or senderName fields with server-side values
        ChatMessage chatMessage = ChatMessage.builder()
            .type(ChatMessage.Type.CHAT)
            .content(safeContent)
            .senderIp(ip)
            .senderClientId(clientId)
            .senderName(displayName)
            .deviceType(deviceType)
            .timestamp(Instant.now())
            .build();

        messageStore.saveMessage(chatMessage);
        messaging.convertAndSend("/topic/public", chatMessage);
    }

    // REST endpoint — called by the frontend immediately after connecting
    // Returns the current message history so new joiners see past messages
    // Maps to GET http://<your-ip>:8080/api/messages
    @GetMapping("/api/messages")
    @ResponseBody
    public ResponseEntity<List<ChatMessage>> getMessageHistory(@RequestHeader(value = "X-Room-Password", required = false) String password) {
        if (!roomPassword.isEmpty() && !roomPassword.equals(password)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(messageStore.getAllMessages());
    }

    // REST endpoint — returns the list of currently connected users
    // Maps to GET http://<your-ip>:8080/api/users
    @GetMapping("/api/users")
    @ResponseBody
    public ResponseEntity<List<ChatUser>> getActiveUsers(@RequestHeader(value = "X-Room-Password", required = false) String password) {
        if (!roomPassword.isEmpty() && !roomPassword.equals(password)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(messageStore.getActiveUsers());
    }

    // REST endpoint — returns the caller's IP address
    @GetMapping("/api/me")
    @ResponseBody
    public ResponseEntity<String> getMyIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank()) {
            ip = request.getRemoteAddr();
        }
        return ResponseEntity.ok(ip);
    }
 // Handles typing indicator events
 // Client sends to "/app/chat.typing"
 // Server broadcasts to "/topic/public" so everyone sees it
 @MessageMapping("/chat.typing")
 public void typingIndicator(SimpMessageHeaderAccessor accessor) {
     String ip         = (String) accessor.getSessionAttributes().get("ip");
     String displayName = ChatUser.deriveDisplayName(ip);

     String clientId   = (String) accessor.getSessionAttributes().get("clientId");
     if (clientId == null) clientId = accessor.getSessionId();

     ChatMessage typingMessage = ChatMessage.builder()
         .type(ChatMessage.Type.TYPING)
         .senderIp(ip)
         .senderClientId(clientId)
         .senderName(displayName)
         .timestamp(Instant.now())
         .build();

     // Don't save typing events to history — they are transient
     messaging.convertAndSend("/topic/public", typingMessage);
 }
}