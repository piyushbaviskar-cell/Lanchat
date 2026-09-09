package com.localchat.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatUser {

    // The user's LAN IP address — this is their unique identity
    private String ip;

    // Friendly name shown in the UI e.g. "User 42"
    // Derived from the last octet of the IP address
    private String displayName;

    // Device classification: MOBILE, TABLET, DESKTOP
    private String deviceType;

    // The WebSocket session ID assigned by Spring on connect
    // Used internally to map a disconnect event back to the right user
    private String sessionId;

    // When did this user join — useful for the "joined at" display
    private Instant joinedAt;

    // Convenience method — builds the display name from any IP string
    // e.g. "192.168.1.42" → "User 42"
    public static String deriveDisplayName(String ip) {
        if (ip == null || ip.isBlank()) return "Unknown";
        String[] parts = ip.split("\\.");
        return "User " + parts[parts.length - 1];
    }
}