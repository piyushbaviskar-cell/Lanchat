package com.localchat.service;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.locks.ReentrantReadWriteLock;

@Slf4j
@Service
public class AuditLedgerService {

    private final List<LedgerBlock> chain = new ArrayList<>();
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    private final AtomicReference<String> headHash = new AtomicReference<>();

    public AuditLedgerService() {
        // Genesis block
        LedgerBlock genesis = new LedgerBlock(0, "0", Instant.now().toEpochMilli(), "GENESIS", "127.0.0.1", "0");
        genesis.setHash(calculateHash(genesis));
        chain.add(genesis);
        headHash.set(genesis.getHash());
        log.info("Genesis block initialized with hash: {}", genesis.getHash());
    }

    public LedgerBlock appendBlock(String payload, String senderIp) {
        lock.writeLock().lock();
        try {
            LedgerBlock previousBlock = chain.get(chain.size() - 1);
            long index = previousBlock.getIndex() + 1;
            long timestamp = Instant.now().toEpochMilli();
            
            LedgerBlock newBlock = new LedgerBlock(index, previousBlock.getHash(), timestamp, payload, senderIp, null);
            newBlock.setHash(calculateHash(newBlock));
            
            chain.add(newBlock);
            headHash.set(newBlock.getHash());
            
            if (index % 100 == 0) {
                log.debug("Ledger height reached {}", index);
            }
            
            return newBlock;
        } finally {
            lock.writeLock().unlock();
        }
    }

    public List<LedgerBlock> getFullChain() {
        lock.readLock().lock();
        try {
            return Collections.unmodifiableList(new ArrayList<>(chain));
        } finally {
            lock.readLock().unlock();
        }
    }

    public boolean verifyChain() {
        lock.readLock().lock();
        try {
            for (int i = 1; i < chain.size(); i++) {
                LedgerBlock currentBlock = chain.get(i);
                LedgerBlock previousBlock = chain.get(i - 1);

                if (!currentBlock.getHash().equals(calculateHash(currentBlock))) {
                    log.error("Ledger corruption detected at index {}!", currentBlock.getIndex());
                    return false;
                }

                if (!currentBlock.getPreviousHash().equals(previousBlock.getHash())) {
                    log.error("Ledger chain broken at index {}!", currentBlock.getIndex());
                    return false;
                }
            }
            return true;
        } finally {
            lock.readLock().unlock();
        }
    }

    private String calculateHash(LedgerBlock block) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String data = block.getIndex() + block.getPreviousHash() + block.getTimestamp() + block.getPayload() + block.getSenderIp();
            byte[] hash = digest.digest(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            log.error("SHA-256 not available", e);
            throw new RuntimeException(e);
        }
    }

    @Data
    public static class LedgerBlock {
        private final long index;
        private final String previousHash;
        private final long timestamp;
        private final String payload;
        private final String senderIp;
        private String hash;
        
        public LedgerBlock(long index, String previousHash, long timestamp, String payload, String senderIp, String hash) {
            this.index = index;
            this.previousHash = previousHash;
            this.timestamp = timestamp;
            this.payload = payload;
            this.senderIp = senderIp;
            this.hash = hash;
        }
    }
}
