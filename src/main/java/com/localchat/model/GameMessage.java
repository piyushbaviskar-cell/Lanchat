package com.localchat.model;

public class GameMessage {
    private String type; // GAME_INVITE, FIRE_COORDINATE, etc.
    private String gameType; // ARENA, TEEN_PATTI
    private String senderId;
    private Object payload; // Can be a base64 encoded byte[] for binary states

    public GameMessage() {}

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getGameType() { return gameType; }
    public void setGameType(String gameType) { this.gameType = gameType; }

    public String getSenderId() { return senderId; }
    public void setSenderId(String senderId) { this.senderId = senderId; }

    public Object getPayload() { return payload; }
    public void setPayload(Object payload) { this.payload = payload; }
}
