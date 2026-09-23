package com.localchat.controller;

import com.localchat.model.GameMessage;
import com.localchat.service.TeenPattiService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class GameController {

    private final SimpMessagingTemplate messagingTemplate;
    private final TeenPattiService teenPattiService;

    public GameController(SimpMessagingTemplate messagingTemplate, TeenPattiService teenPattiService) {
        this.messagingTemplate = messagingTemplate;
        this.teenPattiService = teenPattiService;
    }

    @MessageMapping("/game.action")
    public void handleGameAction(@Payload String message) {
        // Blind relay all game state mutations / Radar Strike actions
        messagingTemplate.convertAndSend("/topic/game", (Object) message);
    }

    @MessageMapping("/game.invite")
    public void handleGameInvite(@Payload String inviteMessage) {
        // Broadcast duel invites / acceptances across mesh
        messagingTemplate.convertAndSend("/topic/game.invite", (Object) inviteMessage);
    }
}
