package com.localchat.controller;

import com.localchat.service.AuditLedgerService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.boot.json.JsonParser;
import org.springframework.boot.json.JsonParserFactory;

import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import java.util.Collections;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Controller
public class ChatController {

    private final SimpMessagingTemplate messagingTemplate;
    private final AuditLedgerService auditLedgerService;

    // Authoritative In-Memory presence map: clientId -> UserInfo
    public static final ConcurrentHashMap<String, Map<String, Object>> activeUsers = new ConcurrentHashMap<>();
    // Mapping: sessionId -> clientId (for disconnect handling)
    public static final ConcurrentHashMap<String, String> sessionToClientId = new ConcurrentHashMap<>();

    public ChatController(SimpMessagingTemplate messagingTemplate, AuditLedgerService auditLedgerService) {
        this.messagingTemplate = messagingTemplate;
        this.auditLedgerService = auditLedgerService;
    }

    @MessageMapping("/presence.join")
    public void handleJoin(@Payload String payload, SimpMessageHeaderAccessor accessor) {
        try {
            JsonParser parser = JsonParserFactory.getJsonParser();
            Map<String, Object> map = parser.parseMap(payload);
            String clientId = (String) map.get("clientId");
            String displayName = map.containsKey("displayName") ? (String) map.get("displayName") : clientId;
            String deviceType = map.containsKey("deviceType") ? (String) map.get("deviceType") : "DESKTOP";
            String sessionId = accessor.getSessionId();

            if (clientId != null) {
                if (sessionId != null) {
                    sessionToClientId.put(sessionId, clientId);
                }
                activeUsers.put(clientId, Map.of(
                    "clientId", clientId,
                    "displayName", displayName,
                    "deviceType", deviceType
                ));
                broadcastPresence();
            }
        } catch (Exception e) {
            log.error("Error in handleJoin", e);
        }
    }

    @MessageMapping("/presence.leave")
    public void handleLeave(@Payload String payload, SimpMessageHeaderAccessor accessor) {
        try {
            JsonParser parser = JsonParserFactory.getJsonParser();
            Map<String, Object> map = parser.parseMap(payload);
            String clientId = (String) map.get("clientId");
            if (clientId != null) {
                activeUsers.remove(clientId);
                broadcastPresence();
            }
        } catch (Exception e) {
            log.error("Error in handleLeave", e);
        }
    }

    /**
     * Host Admin: Kick Peer Session
     */
    @MessageMapping("/admin.kick")
    public void handleAdminKick(@Payload String payload, SimpMessageHeaderAccessor accessor) {
        try {
            String ip = accessor.getSessionAttributes() != null ? (String) accessor.getSessionAttributes().get("ip") : "127.0.0.1";
            // Allow localhost or local subnet host administration
            JsonParser parser = JsonParserFactory.getJsonParser();
            Map<String, Object> map = parser.parseMap(payload);
            String targetClientId = (String) map.get("targetClientId");

            if (targetClientId != null) {
                activeUsers.remove(targetClientId);
                broadcastPresence();
                // Send administrative kick notice over public channel
                messagingTemplate.convertAndSend("/topic/public", (Object) Map.of(
                    "type", "SYSTEM",
                    "content", "[ADMIN NOTICE: Node " + targetClientId + " was disconnected from the tactical mesh by Host Authority]",
                    "timestamp", System.currentTimeMillis()
                ));
            }
        } catch (Exception e) {
            log.error("Error in handleAdminKick", e);
        }
    }

    /**
     * Host Admin: Transport Mode Broadcast
     */
    @MessageMapping("/admin.transport")
    public void handleAdminTransport(@Payload String payload) {
        messagingTemplate.convertAndSend("/topic/transport", (Object) payload);
    }

    /**
     * Alias for legacy/chaos-test clients
     */
    @MessageMapping("/chat.addUser")
    public void handleAddUser(@Payload String payload, SimpMessageHeaderAccessor accessor) {
        try {
            JsonParser parser = JsonParserFactory.getJsonParser();
            Map<String, Object> map = parser.parseMap(payload);
            String sender = (String) map.getOrDefault("sender", "Operator");
            String tag = (String) map.getOrDefault("tag", "#0000");
            String clientId = sender + "_" + tag;
            String sessionId = accessor.getSessionId();
            if (sessionId != null) {
                sessionToClientId.put(sessionId, clientId);
            }
            activeUsers.put(clientId, Map.of(
                "clientId", clientId,
                "displayName", sender + " " + tag,
                "deviceType", map.getOrDefault("deviceType", "DESKTOP")
            ));
            broadcastPresence();
            messagingTemplate.convertAndSend("/topic/public", (Object) payload);
        } catch (Exception e) {
            log.error("Error in handleAddUser", e);
        }
    }

    public void broadcastPresence() {
        List<Map<String, Object>> presenceList = activeUsers.values().stream().toList();
        messagingTemplate.convertAndSend("/topic/presence", (Object) presenceList);
    }

    /**
     * BLIND RELAY & AUDIT LEDGER ENDPOINT
     */
    @MessageMapping("/chat.send")
    public void sendMessage(@Payload String blindPayload, SimpMessageHeaderAccessor accessor) {
        String ip = accessor.getSessionAttributes() != null ? (String) accessor.getSessionAttributes().get("ip") : "127.0.0.1";
        if (ip == null) ip = "127.0.0.1";

        AuditLedgerService.LedgerBlock block = auditLedgerService.appendBlock(blindPayload, ip);
        messagingTemplate.convertAndSend("/topic/public", (Object) block);
    }

    /**
     * Plaintext / Chaos Test / Image Messaging Endpoint
     */
    @MessageMapping("/chat.sendMessage")
    public void sendRawMessage(@Payload String message) {
        messagingTemplate.convertAndSend("/topic/public", (Object) message);
    }

    private final List<String> boardVectorHistory = Collections.synchronizedList(new ArrayList<>());

    /**
     * High-Fidelity Voice Note Payload Handler
     */
    @MessageMapping("/chat.sendVoice")
    public void handleSendVoice(@Payload String voicePayload) {
        messagingTemplate.convertAndSend("/topic/public", (Object) voicePayload);
    }

    /**
     * Real-Time Collaborative Tactical Whiteboard Vector Distribution & History Replay
     */
    @MessageMapping("/board.draw")
    public void handleBoardDraw(@Payload String drawVector) {
        if (drawVector != null) {
            if (drawVector.contains("\"CLEAR\"")) {
                boardVectorHistory.clear();
            } else if (!drawVector.contains("\"POINTER\"")) {
                // Buffer draw actions (ignore transient pointer broadcasts from history)
                if (boardVectorHistory.size() > 2000) {
                    boardVectorHistory.remove(0);
                }
                boardVectorHistory.add(drawVector);
            }
        }
        messagingTemplate.convertAndSend("/topic/board", (Object) drawVector);
    }

    @MessageMapping("/board.requestHistory")
    public void handleBoardRequestHistory() {
        synchronized (boardVectorHistory) {
            for (String vec : boardVectorHistory) {
                messagingTemplate.convertAndSend("/topic/board", (Object) vec);
            }
        }
    }

    @GetMapping("/api/board/history")
    @ResponseBody
    public ResponseEntity<List<String>> getBoardHistory() {
        synchronized (boardVectorHistory) {
            return ResponseEntity.ok(new ArrayList<>(boardVectorHistory));
        }
    }

    @MessageMapping("/canvas.draw")
    public void handleCanvasDraw(@Payload String drawVector) {
        handleBoardDraw(drawVector);
    }

    @GetMapping("/api/ledger")
    @ResponseBody
    public ResponseEntity<List<AuditLedgerService.LedgerBlock>> getLedger() {
        return ResponseEntity.ok(auditLedgerService.getFullChain());
    }

    @GetMapping("/api/audit/verify")
    @ResponseBody
    public ResponseEntity<String> verifyLedger() {
        boolean isValid = auditLedgerService.verifyChain();
        if (isValid) {
            return ResponseEntity.ok("{\"status\":\"VERIFIED\", \"message\":\"Cryptographic hash chain is intact.\"}");
        } else {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("{\"status\":\"CORRUPTED\", \"message\":\"Ledger tampering detected!\"}");
        }
    }
}