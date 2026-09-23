# 🛡️ LANCHAT APEX // Sovereign Tactical Communications Platform

<div align="center">

![Lanchat APEX](https://img.shields.io/badge/LANCHAT-APEX_v2.0-00ff66?style=for-the-badge&logo=shield&logoColor=black)
![Java](https://img.shields.io/badge/Java-17-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.3.6-6DB33F?style=for-the-badge&logo=springboot&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![STAL](https://img.shields.io/badge/Transport-STAL_Tiers_0--4-00d4ff?style=for-the-badge)

**Defense-Grade Sovereign Tactical Communications Suite**  
Air-gapped mesh networking • Role-Based Access Control (RBAC) • Multi-Transport STAL Router • Synchronized Collaborative Whiteboard • Turn-Based Mesh Naval Warfare

[System Architecture](#-system-architecture) • [Multi-Transport Layers](#-multi-transport-architecture-stal) • [Core Features](#-core-features) • [Quick Start](#-quick-start) • [Verification Audit](#-autonomous-chaos-audit)

</div>

---

## 📌 Executive Overview

**Lanchat APEX** is a defense-grade, sovereign tactical communication platform engineered for mission-critical air-gapped environments, rapid field deployments, and emergency mesh communication without internet reliance.

> 🛰️ **Zero Internet Dependency**: Operates entirely over local Wi-Fi hotspots, RailTel dark fiber, military microwave static links, tactical HF/VHF radio, or ISRO NavIC satellite bursts.  
> 🔒 **Role-Based Access Control (RBAC)**: Host/Developer console (`Dev Sentry`) is isolated from Field Member nodes.  
> ⚡ **Ghost User Elimination**: Deterministic heartbeat and WebSocket disconnect interception prevents phantom operators.  
> 🎨 **Proportional Vector Whiteboard**: 1:1 cross-device drawing synchronization between mobile phones and 4K displays.  
> ⚔️ **Turn-Based Tactical Radar Strike**: Multiplayer naval mesh duel with synthesized radar and missile telemetry.

---

## 🌐 System Architecture

```
                                  ┌────────────────────────────────┐
                                  │   HOST COMMAND NODE (Laptop)   │
                                  │   Role: HOST [Dev Sentry ON]   │
                                  └───────────────┬────────────────┘
                                                  │
                ┌─────────────────────────────────┼─────────────────────────────────┐
                │                                 │                                 │
                ▼                                 ▼                                 ▼
   ┌──────────────────────────┐     ┌──────────────────────────┐     ┌──────────────────────────┐
   │    FIELD NODE (Mobile)   │     │    FIELD NODE (Tablet)   │     │   FIELD NODE (Laptop)    │
   │    Role: MEMBER (Chat/   │     │    Role: MEMBER (Chat/   │     │   Role: MEMBER (Chat/    │
   │    Whiteboard/Games)     │     │    Whiteboard/Games)     │     │    Whiteboard/Games)     │
   └──────────────────────────┘     └──────────────────────────┘     └──────────────────────────┘
```

---

## 📡 Multi-Transport Architecture (STAL)

Lanchat APEX implements the **Sovereign Transport Abstraction Layer (STAL)**, allowing the Host to switch physical transit media at runtime:

| Tier | Physical Medium | Latency | Protocol & Framing |
| :--- | :--- | :--- | :--- |
| **Tier 0** | **Local Hotspot Mesh** | $< 5\text{ ms}$ | High-throughput direct WebSocket/STOMP over 802.11 |
| **Tier 1** | **RailTel Rail Corridor** | $\sim 15\text{ ms}$ | Layer-2 station corridor dark fiber (`CSMT -> KYN -> KSRA -> IGP -> NK`) |
| **Tier 2** | **Defense NFS / ASCON** | $\sim 8\text{ ms}$ | Classified military static pipes (`RESTRICTED` / `SECRET` headers) |
| **Tier 3** | **BEL Tactical HF Radio** | $\sim 180\text{ ms}$ | Web Serial API + Bell 202 AFSK audio modem (1200 baud) + STANAG 5066 CRC-32 |
| **Tier 4** | **ISRO NavIC Satellite** | $\sim 450\text{ ms}$ | Strict **256-byte space datagrams** with GPS bit-packing & FEC framing |

---

## ✨ Core Features

### 1. 🛡️ Role-Based Access Control (RBAC)
* **Host Node (`localhost` / `127.0.0.1` / Master Seed)**:
  - Exclusive access to the **Dev Sentry** console drawer.
  - Multi-Transport switching (Tiers 0–4).
  - Real-time Packet Sniffer & Transit Telemetry.
  - Peer Kick / Moderation controls (`/app/admin.kick`).
* **Field Member Nodes (Mobile / Wi-Fi Hotspot)**:
  - Dev Sentry button completely stripped from DOM.
  - Full access to chat, voice notes, drawing, image sharing, and games without configuration access.

### 2. 🎨 Synchronized Collaborative Whiteboard
* **Normalized Proportional Coordinates `(0.0 to 1.0)`**: Mathematical fractional vectors eliminate resolution clipping across different viewport sizes.
* **Vector History Buffer**: Backend in-memory ring buffer replays existing drawings to late-joining operators.
* **Live Remote Laser Pointers**: Glowing tactical laser dots with operator callsign tags float in real time.
* **Tactical Toolset**: Tactical Pen, Highlighter, Vector Arrow, Perimeter Box, Eraser, and Grid Background Toggle.

### 3. ⚔️ Turn-Based Mesh Multiplayer Radar Strike
* **Challenger Lobby**: View active mesh peers and send one-tap duel invitations.
* **Turn-Based Naval Warfare Engine**: 6x6 radar sectors, 3 defensive beacons, synchronized missile fire, hit/miss detection, and instant rematching.
* **Offline Solo AI Mode**: Autonomous drone AI for instant solo drills.

### 4. 🔊 Procedural Web Audio Sound Synthesizer
* Native browser Web Audio API oscillator synthesis (zero external audio file dependencies):
  - Sonar Radar Ping
  - Missile Launch Whoosh
  - Explosive Hit Rumble
  - Splash Miss
  - Tactical Message Chime & Red Alert Siren

### 5. 📷 Tactical Image Compression (<150 KB)
* Off-screen HTML5 `<canvas>` automatically downscales photos to $\le 800\text{px}$ and compresses them to $\le 150\text{ KB}$ WebP/JPEG base64 datagrams to safeguard WebSocket buffers.
* Chat feed features click-to-expand lightbox modals with PNG download capability.

### 6. 👁️‍🗨️ Operational Stealth & Identity Subsystem
* **Compulsory Onboarding**: Deterministic 4-character `#Tag` derived from WebCrypto ECDSA P-256 keypair (e.g. `#7F2A`).
* **Strict 1-Rename Lifetime Quota**: Locks callsign permanently after 1 modification (`🔒 Callsign Locked (1/1 Used)`).
* **`[Stealth]` Toggle**: Shields human identity to `Anonymous #Tag` while keeping cryptographic signature verifiable.

### 7. 📍 Rapid SITREP / GPS Burst Status Beacons
* Instant one-tap operational status broadcasts:
  - `[📍 GPS Ping]`: Broadcasts live GPS coordinates.
  - `[🛡️ All Clear]`: Status green perimeter check.
  - `[🚨 Red Alert]`: Emergency SOS alert with sweeping siren audio.
  - `[⚠️ Caution]`: Radio silence notification.

---

## 🚀 Quick Start

### Prerequisites
* Java 17+ JDK
* Node.js 18+ & npm

### 1. Launch Spring Boot Backend
```bash
.\mvnw.cmd spring-boot:run
```
*Backend runs on port `8080` (Direct LAN: `http://10.86.6.5:8080`).*

### 2. Launch Vite Frontend
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on HTTPS: `https://localhost:5173/` (Mobile/LAN: `https://10.86.6.5:5173/`).*

### 3. Connect Host & Field Devices
1. **Host**: Open `https://localhost:5173/` on the server laptop (Role: `HOST`).
2. **Field Phones/Laptops**: Connect to the same Wi-Fi network and open `https://10.86.6.5:5173/` (Role: `MEMBER`).
3. Enter Channel Passphrase: `defense-grid-apex` (or custom room key).

---

## 🧪 Autonomous Chaos Audit

Run the multi-client chaos verification suite:
```bash
cd frontend
node scripts/apex-chaos-audit.mjs
```

### Audit Results
```
======================================================
   LANCHAT APEX DEFENSE-GRADE CHAOS VERIFICATION LOOP 
======================================================
[TEST 1] Ghost Elimination & Handshake Verification... -> PASS
[TEST 2] Bidirectional Messaging & Contextual Quote Reply... -> PASS
[TEST 3] 1-Rename Quota & Audit Broadcast Verification... -> PASS
[TEST 4] Collaborative Whiteboard Vector Distribution (<20ms)... -> PASS
[TEST 5] High-Capacity PTT Voice Note Handling (128 KB)... -> PASS
[TEST 6] Tactical Radar Strike: Mesh Matchmaking & Turn-Based Battle... -> PASS
[TEST 7] Whiteboard Proportional Normalization & History Sync... -> PASS
======================================================
 CHAOS AUDIT COMPLETE: 7/7 TESTS PASSED (100% GREEN)
======================================================
```

---

## 📄 License
MIT License. Developed for sovereign, privacy-first tactical communications.
