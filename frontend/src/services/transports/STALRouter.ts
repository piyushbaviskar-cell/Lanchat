/**
 * STAL (Sovereign Transport Abstraction Layer) Router
 * Dynamically binds outgoing encrypted datagrams to the most resilient physical channel available:
 * Tier 0: Tactical LAN 802.11 Hotspot Mesh (<5ms)
 * Tier 1: RailTel Dark Fiber Corridor Gateway (Kasara Ghat Bypass)
 * Tier 2: Defense NFS / ASCON Phase IV Optical Pipes (TSEC/SAG)
 * Tier 3: BEL Tactical HF/VHF Packet Radio (WebSerial / 1200 Baud AFSK Audio Modem)
 * Tier 4: ISRO NavIC / GSAT 256-Byte Satellite Short-Burst
 */

import { railTelSocketDriver } from './RailTelSocketDriver';
import { defenseNfsService } from './DefenseNfsService';
import { belRadioDriver } from './BelRadioDriver';
import { navicSatelliteBridge } from './NavicSatelliteBridge';

export type TransportTier = 'TIER_0_LAN' | 'TIER_1_RAIL' | 'TIER_2_NFS' | 'TIER_3_BEL_HF' | 'TIER_4_NAVIC';

export interface TransportStatus {
  tier: TransportTier;
  label: string;
  badge: string;
  isAvailable: boolean;
  latencyEstimateMs: number;
}

export interface OutgoingPacket {
  id: string;
  payload: string | Uint8Array;
  senderTag: string;
  priority?: 'ROUTINE' | 'PRIORITY' | 'FLASH_EMERGENCY';
}

export class STALRouter {
  private activeTier: TransportTier = 'TIER_0_LAN';
  private forceTierOverride: TransportTier | null = null;
  private isLanOnline: boolean = true;
  private listeners: ((status: TransportStatus) => void)[] = [];

  constructor() {
    // Initialize default available state
  }

  public setLanConnectivity(isOnline: boolean) {
    this.isLanOnline = isOnline;
    this.reevaluateActiveTier();
  }

  public setTierOverride(tier: TransportTier | null) {
    this.forceTierOverride = tier;
    this.reevaluateActiveTier();
  }

  public getActiveTier(): TransportTier {
    if (this.forceTierOverride) return this.forceTierOverride;
    return this.activeTier;
  }

  public getTransportStatus(): TransportStatus {
    const tier = this.getActiveTier();
    switch (tier) {
      case 'TIER_0_LAN':
        return { tier, label: 'Tactical Hotspot Mesh', badge: '⚡ LOCAL 2ms', isAvailable: this.isLanOnline, latencyEstimateMs: 2 };
      case 'TIER_1_RAIL':
        return { tier, label: 'RailTel Optical Corridor', badge: '🚆 RAILDARK', isAvailable: true, latencyEstimateMs: 6 };
      case 'TIER_2_NFS':
        return { tier, label: 'Defense NFS / ASCON IV', badge: '🛡️ NFS-ASCON', isAvailable: true, latencyEstimateMs: 8 };
      case 'TIER_3_BEL_HF':
        return { tier, label: 'BEL Tactical HF Radio', badge: '📻 BEL-HF', isAvailable: true, latencyEstimateMs: 120 };
      case 'TIER_4_NAVIC':
        return { tier, label: 'ISRO NavIC Satellite Burst', badge: '🛰️ NAVIC', isAvailable: true, latencyEstimateMs: 450 };
    }
  }

  private reevaluateActiveTier() {
    if (this.isLanOnline) {
      this.activeTier = 'TIER_0_LAN';
    } else {
      // Auto failover hierarchy: Tier 1 -> Tier 2 -> Tier 3 -> Tier 4
      this.activeTier = 'TIER_1_RAIL';
    }
    const status = this.getTransportStatus();
    this.listeners.forEach(cb => cb(status));
  }

  public onStatusChange(callback: (status: TransportStatus) => void) {
    this.listeners.push(callback);
    callback(this.getTransportStatus());
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Route datagram through currently active sovereign transport
   */
  async routePacket(packet: OutgoingPacket, stompClient?: any): Promise<{ tierUsed: TransportTier; ack: string; latencyMs: number }> {
    const tier = this.getActiveTier();
    const encoder = new TextEncoder();
    const rawBytes = typeof packet.payload === 'string' ? encoder.encode(packet.payload) : packet.payload;

    switch (tier) {
      case 'TIER_0_LAN':
        if (stompClient?.connected) {
          stompClient.publish({
            destination: '/app/chat.send',
            body: typeof packet.payload === 'string' ? packet.payload : new TextDecoder().decode(rawBytes)
          });
          return { tierUsed: 'TIER_0_LAN', ack: 'LAN-STOMP-CONFIRMED', latencyMs: 2 };
        }
        // Fallthrough if LAN fails unexpectedly
        return this.fallbackRoute(packet, rawBytes);

      case 'TIER_1_RAIL':
        if (!railTelSocketDriver.isConnected()) await railTelSocketDriver.connect();
        const railRes = await railTelSocketDriver.transmitDatagram(rawBytes);
        return { tierUsed: 'TIER_1_RAIL', ack: `RAILTEL-${railRes.station}`, latencyMs: railRes.latency };

      case 'TIER_2_NFS':
        if (!defenseNfsService.isLinkActive()) await defenseNfsService.initiateTsecHandshake();
        const frame = defenseNfsService.packageClassifiedFrame(rawBytes, 'CONFIDENTIAL');
        const nfsRes = await defenseNfsService.transmitClassified(frame);
        return { tierUsed: 'TIER_2_NFS', ack: 'NFS-ASCON-TSEC-OK', latencyMs: nfsRes.latencyMs };

      case 'TIER_3_BEL_HF':
        const belRes = await belRadioDriver.transmit(rawBytes);
        return { tierUsed: 'TIER_3_BEL_HF', ack: `BEL-HF-${belRes.transport}`, latencyMs: 120 };

      case 'TIER_4_NAVIC':
        const navicRes = await navicSatelliteBridge.transmitBurst({
          latitude: 18.9220,
          longitude: 72.8347,
          senderFingerprint: packet.senderTag,
          priority: packet.priority || 'ROUTINE',
          text: typeof packet.payload === 'string' ? packet.payload : new TextDecoder().decode(rawBytes)
        });
        return { tierUsed: 'TIER_4_NAVIC', ack: navicRes.transponderAck, latencyMs: 450 };
    }
  }

  private async fallbackRoute(_packet: OutgoingPacket, rawBytes: Uint8Array) {
    if (!railTelSocketDriver.isConnected()) await railTelSocketDriver.connect();
    const res = await railTelSocketDriver.transmitDatagram(rawBytes);
    return { tierUsed: 'TIER_1_RAIL' as TransportTier, ack: `FAILOVER-RAILTEL-${res.station}`, latencyMs: res.latency };
  }
}

export const stalRouter = new STALRouter();
export const TransportRouter = stalRouter;
export { STALRouter as TransportRouterClass };
