package com.localchat.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;

import java.util.Map;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Value("${app.chat.password:}")
    private String roomPassword;

    @Bean
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(8 * 1024 * 1024);     // 8MB
        container.setMaxBinaryMessageBufferSize(8 * 1024 * 1024);   // 8MB
        container.setMaxSessionIdleTimeout(60000L);
        return container;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        ThreadPoolTaskScheduler taskScheduler = new ThreadPoolTaskScheduler();
        taskScheduler.setPoolSize(1);
        taskScheduler.setThreadNamePrefix("stomp-heartbeat-");
        taskScheduler.initialize();

        registry.enableSimpleBroker("/topic", "/queue")
                .setHeartbeatValue(new long[]{10000, 10000})
                .setTaskScheduler(taskScheduler);
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void configureWebSocketTransport(org.springframework.web.socket.config.annotation.WebSocketTransportRegistration registry) {
        // Increase payload limits to support base64 audio chunks and AES ciphertext overhead
        registry.setMessageSizeLimit(8 * 1024 * 1024);     // 8MB
        registry.setSendBufferSizeLimit(16 * 1024 * 1024); // 16MB
        registry.setSendTimeLimit(20000);                  // 20 seconds
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
            .setAllowedOriginPatterns("*")
            .addInterceptors(new HandshakeInterceptor() {
                @Override
                public boolean beforeHandshake(
                        ServerHttpRequest request,
                        ServerHttpResponse response,
                        WebSocketHandler wsHandler,
                        Map<String, Object> attributes) {

                    // Check password & extract clientId
                    String query = request.getURI().getQuery();
                    if (query != null) {
                        for (String param : query.split("&")) {
                            if (param.startsWith("clientId=")) {
                                attributes.put("clientId", param.split("=")[1]);
                            }
                        }
                    }

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
            });
            
        registry.addEndpoint("/ws")
            .setAllowedOriginPatterns("*")
            .addInterceptors(new HandshakeInterceptor() {
                @Override
                public boolean beforeHandshake(
                        ServerHttpRequest request,
                        ServerHttpResponse response,
                        WebSocketHandler wsHandler,
                        Map<String, Object> attributes) {
                    
                    // Duplicate interceptor logic for SockJS endpoint
                    String query = request.getURI().getQuery();
                    if (query != null) {
                        for (String param : query.split("&")) {
                            if (param.startsWith("clientId=")) {
                                attributes.put("clientId", param.split("=")[1]);
                            }
                        }
                    }
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
                    String ip = request.getHeaders().getFirst("X-Forwarded-For");
                    if (ip == null || ip.isBlank()) ip = request.getRemoteAddress().getAddress().getHostAddress();
                    attributes.put("ip", ip);
                    
                    return true;
                }
                @Override
                public void afterHandshake(ServerHttpRequest req, ServerHttpResponse res, WebSocketHandler ws, Exception ex) {}
            })
            .withSockJS();
    }
}