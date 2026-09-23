import React, { useState, useEffect } from 'react';
import { Terminal, Activity, Radio, EyeOff, Eye, Cpu, UserX, X } from 'lucide-react';
import { stalRouter, TransportTier, TransportStatus } from '../services/transports/STALRouter';

interface DevSentryConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  users: any[];
  isGhostMode: boolean;
  onToggleGhostMode: () => void;
  stompClient?: any;
}

interface SniffedPacket {
  id: string;
  time: string;
  tier: TransportTier;
  direction: 'INBOUND' | 'OUTBOUND';
  bytes: number;
  info: string;
}

export const DevSentryConsole: React.FC<DevSentryConsoleProps> = ({
  isOpen,
  onClose,
  users,
  isGhostMode,
  onToggleGhostMode,
  stompClient
}) => {
  const [transportStatus, setTransportStatus] = useState<TransportStatus>(stalRouter.getTransportStatus());
  const [selectedTierOverride, setSelectedTierOverride] = useState<TransportTier | 'AUTO'>('AUTO');
  const [sniffedPackets, setSniffedPackets] = useState<SniffedPacket[]>([]);

  useEffect(() => {
    return stalRouter.onStatusChange(setTransportStatus);
  }, []);

  // Simulated live traffic sniffer
  useEffect(() => {
    const interval = setInterval(() => {
      const activeTier = stalRouter.getActiveTier();
      const packet: SniffedPacket = {
        id: `PKT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        time: new Date().toLocaleTimeString(),
        tier: activeTier,
        direction: Math.random() > 0.4 ? 'INBOUND' : 'OUTBOUND',
        bytes: Math.floor(Math.random() * 256) + 32,
        info: activeTier === 'TIER_0_LAN' ? 'AES-GCM STOMP Vector/Chat Frame' :
              activeTier === 'TIER_1_RAIL' ? 'L2 Ethernet Frame CSMT-KSRA Optical Pipe' :
              activeTier === 'TIER_2_NFS' ? 'TSEC/SAG ASCON Phase IV Encapsulation' :
              activeTier === 'TIER_3_BEL_HF' ? 'STANAG 5066 CRC-32 1200 Baud AFSK Audio' :
              'ISRO NavIC 256B Binary Telemetry Burst Frame'
      };

      setSniffedPackets(prev => [packet, ...prev.slice(0, 19)]);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  const handleTierChange = (tier: TransportTier | 'AUTO') => {
    setSelectedTierOverride(tier);
    const targetTier = tier === 'AUTO' ? null : tier;
    stalRouter.setTierOverride(targetTier);

    // Broadcast transport switch to all mesh nodes
    if (stompClient?.connected) {
      stompClient.publish({
        destination: '/app/admin.transport',
        body: JSON.stringify({
          tier: targetTier || 'TIER_0_LAN',
          badge: stalRouter.getTransportStatus().badge
        })
      });
    }
  };

  const handleKickPeer = (clientId: string) => {
    if (!clientId) return;
    if (stompClient?.connected) {
      stompClient.publish({
        destination: '/app/admin.kick',
        body: JSON.stringify({ targetClientId: clientId })
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-[#080c16]/95 backdrop-blur-xl border-l border-neutral-800 shadow-2xl flex flex-col font-mono">
      {/* Top Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-neutral-900/80 border-b border-neutral-800">
        <div className="flex items-center gap-2.5">
          <Terminal className="w-5 h-5 text-green-400" />
          <div>
            <span className="text-sm font-bold tracking-widest text-white uppercase">
              HOST DEV SENTRY // MASTER NODE
            </span>
            <div className="text-[10px] text-green-400">AUTHORITATIVE RBAC ACTIVE</div>
          </div>
        </div>
        <button onClick={onClose} className="text-neutral-400 hover:text-white text-sm p-1">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Controls & Ghost Mode */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
          <div className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" /> Host Tactical Controls & Ghost Mode
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onToggleGhostMode}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                isGhostMode 
                  ? 'bg-amber-500 text-black shadow-lg' 
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              {isGhostMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {isGhostMode ? 'GHOST MODE ACTIVE (Unannounced)' : 'ENABLE GHOST MODE'}
            </button>

            <div className="flex items-center gap-1.5 bg-neutral-800/80 px-2.5 py-1.5 rounded-lg text-xs">
              <span className="text-neutral-400">ACTIVE LINK:</span>
              <span className="text-green-400 font-bold">{transportStatus.badge}</span>
            </div>
          </div>

          {/* Transport Routing Failover Selector */}
          <div className="mt-4 pt-3 border-t border-neutral-800">
            <div className="text-[11px] text-neutral-400 mb-2">AUTHORITATIVE TRANSPORT OVERRIDE:</div>
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              {[
                { id: 'AUTO', label: 'AUTO (Failover)' },
                { id: 'TIER_0_LAN', label: 'T0: LAN Mesh' },
                { id: 'TIER_1_RAIL', label: 'T1: RailTel OFC' },
                { id: 'TIER_2_NFS', label: 'T2: Defense NFS' },
                { id: 'TIER_3_BEL_HF', label: 'T3: BEL-HF Radio' },
                { id: 'TIER_4_NAVIC', label: 'T4: ISRO NavIC' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTierChange(t.id as any)}
                  className={`p-2 rounded border transition-colors truncate text-left ${
                    selectedTierOverride === t.id 
                      ? 'bg-indigo-600 border-indigo-500 text-white font-bold' 
                      : 'bg-neutral-800/60 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Peer Moderation & Mesh Topology */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
          <div className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-400" /> Connected Mesh Nodes ({users.length})
            </span>
            <span className="text-[10px] text-neutral-500">PEER MODERATION</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {users.map((u, i) => (
              <div key={u.clientId || i} className="bg-[#0b0f19] border border-neutral-800 rounded-lg p-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-base">{u.deviceType === 'MOBILE' ? '📱' : '💻'}</span>
                  <div>
                    <div className="font-bold text-neutral-200">{u.displayName || u.clientId}</div>
                    <div className="text-[10px] text-neutral-500">ID: {u.clientId} • {u.deviceType || 'DESKTOP'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-green-400 bg-green-950/40 border border-green-800/40 px-2 py-0.5 rounded">
                    ONLINE
                  </span>
                  <button
                    onClick={() => handleKickPeer(u.clientId)}
                    className="p-1 bg-red-950/50 hover:bg-red-900 border border-red-800 text-red-300 rounded text-[10px] flex items-center gap-1 transition-colors"
                    title="Kick Peer from Mesh"
                  >
                    <UserX className="w-3.5 h-3.5" /> Kick
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Raw Packet Sniffer */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
          <div className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" /> Live Sovereign Packet Sniffer
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto text-[11px]">
            {sniffedPackets.map(pkt => (
              <div key={pkt.id} className="bg-[#070b14] border border-neutral-800/80 rounded p-2 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-500">{pkt.time}</span>
                    <span className={`font-bold ${pkt.direction === 'INBOUND' ? 'text-green-400' : 'text-indigo-400'}`}>
                      [{pkt.direction}]
                    </span>
                    <span className="text-cyan-300 font-bold">{pkt.tier}</span>
                  </div>
                  <div className="text-neutral-300 text-[10px] mt-0.5">{pkt.info}</div>
                </div>
                <span className="text-neutral-500 text-[10px] font-bold">{pkt.bytes}B</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
