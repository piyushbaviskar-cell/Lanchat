package com.localchat.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
public class HealthController {

    @GetMapping("/api/health")
    public ResponseEntity<Map<String, String>> checkHealth() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "tier", "APEX-TACTICAL-CORE",
            "timestamp", String.valueOf(System.currentTimeMillis())
        ));
    }
}
