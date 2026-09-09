package com.localchat.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;

import java.util.Map;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Value("${app.chat.password:}")
    private String roomPassword;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
            .setAllowedOriginPatterns(
                // Standard LAN ranges
                "http://192.168.*.*",
                "http://10.*.*.*",
                // Your specific range from the error logs (172.25.x.x)
                "http://172.*.*.*",
                // Vite dev server on any port
                "http://localhost:*",
                "http://127.0.0.1:*"
            )
            .addInterceptors(new HandshakeInterceptor() {
                @Override
                public boolean beforeHandshake(
                        ServerHttpRequest request,
                        ServerHttpResponse response,
                        WebSocketHandler wsHandler,
                        Map<String, Object> attributes) {

                    // Check password
                    String query = request.getURI().getQuery();
                    if (!roomPassword.isEmpty()) {
                        boolean authSuccess = false;
                        if (query != null && query.contains("password=" + roomPassword)) {
                            authSuccess = true;
                        }
                        if (!authSuccess) {
                            response.setStatusCode(HttpStatus.UNAUTHORIZED);
                            return false;
                        }
                    }

                    String ip = request.getHeaders()
                                       .getFirst("X-Forwarded-For");
                    if (ip == null || ip.isBlank()) {
                        ip = request.getRemoteAddress()
                                    .getAddress()
                                    .getHostAddress();
                    }
                    attributes.put("ip", ip);

                    // Parse device type from User-Agent
                    String userAgent = request.getHeaders().getFirst("User-Agent");
                    String deviceType = "DESKTOP";
                    if (userAgent != null) {
                        String ua = userAgent.toLowerCase();
                        if (ua.contains("tablet") || ua.contains("ipad")) {
                            deviceType = "TABLET";
                        } else if (ua.contains("mobi") || ua.contains("android") || ua.contains("iphone")) {
                            deviceType = "MOBILE";
                        }
                    }
                    attributes.put("deviceType", deviceType);

                    return true;
                }

                @Override
                public void afterHandshake(
                        ServerHttpRequest request,
                        ServerHttpResponse response,
                        WebSocketHandler wsHandler,
                        Exception exception) {}
            })
            .withSockJS();
    }
}