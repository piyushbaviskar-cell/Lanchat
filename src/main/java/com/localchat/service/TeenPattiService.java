package com.localchat.service;

import org.springframework.stereotype.Service;
import com.localchat.model.GameMessage;

import java.util.concurrent.ConcurrentHashMap;

@Service
public class TeenPattiService {
    
    // In-memory state for tables
    private final ConcurrentHashMap<String, Object> tables = new ConcurrentHashMap<>();

    public void processAction(GameMessage msg) {
        // Implementation for Dealer Authoritative Logic
        // This will be expanded in Phase 4
    }
}
