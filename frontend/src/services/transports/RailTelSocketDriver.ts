/**
 * RailTel Rail Corridor Gateway Interface & Driver
 * Target: Indian Railways Dark Fiber Ducts (CSMT <-> KYN <-> KSRA <-> IGP <-> NK)
 */

export interface RailTelStationHop {
  stationCode: string;
  stationName: string;
  opticalLossDb: number;
  latencyMs: number;
}

export const RAIL_CORRIDOR_WAYPOINTS: RailTelStationHop[] = [
  { stationCode: 'CSMT', stationName: 'Mumbai CSMT Depot', opticalLossDb: 0.2, latencyMs: 1.2 },
  { stationCode: 'KYN', stationName: 'Kalyan Junction Edge Gateway', opticalLossDb: 0.5, latencyMs: 3.4 },
  { stationCode: 'KSRA', stationName: 'Kasara Ghat Optical Bypass', opticalLossDb: 1.1, latencyMs: 6.8 },
  { stationCode: 'IGP', stationName: 'Igatpuri High Altitude Relay', opticalLossDb: 1.4, latencyMs: 8.5 },
  { stationCode: 'NK', stationName: 'Nashik Road Regional Terminal', opticalLossDb: 1.8, latencyMs: 11.2 }
];

export class RailTelSocketDriver {
  private connected: boolean = false;
  private currentHopIndex: number = 0;
  private onMessageCallback: ((data: Uint8Array) => void) | null = null;

  async connect(stationCode: string = 'CSMT'): Promise<boolean> {
    const hopIdx = RAIL_CORRIDOR_WAYPOINTS.findIndex(h => h.stationCode === stationCode);
    this.currentHopIndex = hopIdx >= 0 ? hopIdx : 0;
    this.connected = true;
    console.log(`[RailTel] Connected to Layer-2 Station Gateway: ${RAIL_CORRIDOR_WAYPOINTS[this.currentHopIndex].stationName}`);
    return true;
  }

  disconnect() {
    this.connected = false;
    console.log('[RailTel] Disconnected from Rail Corridor optical duct.');
  }

  isConnected(): boolean {
    return this.connected;
  }

  getCurrentStation(): RailTelStationHop {
    return RAIL_CORRIDOR_WAYPOINTS[this.currentHopIndex];
  }

  advanceNextHop(): RailTelStationHop {
    this.currentHopIndex = (this.currentHopIndex + 1) % RAIL_CORRIDOR_WAYPOINTS.length;
    return this.getCurrentStation();
  }

  async transmitDatagram(payload: Uint8Array): Promise<{ success: boolean; latency: number; station: string }> {
    if (!this.connected) throw new Error('[RailTel] Optical pipe offline');
    
    // Simulate optical propagation latency through Ghat fiber duct
    const hop = this.getCurrentStation();
    await new Promise(resolve => setTimeout(resolve, Math.max(2, Math.round(hop.latencyMs))));

    // Simulate framed Ethernet/IP datagram encapsulation
    const framed = new Uint8Array(payload.length + 8);
    framed[0] = 0x52; // 'R'
    framed[1] = 0x54; // 'T'
    framed.set(payload, 8);

    if (this.onMessageCallback) {
      setTimeout(() => this.onMessageCallback?.(framed), 5);
    }

    return {
      success: true,
      latency: hop.latencyMs,
      station: hop.stationCode
    };
  }

  onMessage(callback: (data: Uint8Array) => void) {
    this.onMessageCallback = callback;
  }
}

export const railTelSocketDriver = new RailTelSocketDriver();
