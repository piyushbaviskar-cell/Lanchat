import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import { Crosshair, Bot, RotateCcw, Swords, Shield, Volume2, VolumeX, AlertTriangle } from 'lucide-react';
import { identityService } from '../services/IdentityService';
import { tacticalSoundFx } from '../services/TacticalSoundFx';

interface TacticalRadarStrikeProps {
  stompClient: Client | null;
  localId: string;
  users?: any[];
}

type CellState = 'EMPTY' | 'BEACON' | 'HIT' | 'MISS' | 'SCANNING';
type GamePhase = 'LOBBY' | 'PLACEMENT' | 'WAITING_OPPONENT' | 'BATTLE' | 'VICTORY' | 'DEFEAT';

interface DuelInvite {
  fromId: string;
  fromName: string;
  fromTag: string;
  toId: string;
  matchId: string;
}

interface GameState {
  myGrid: CellState[][]; // 6x6
  targetGrid: CellState[][]; // 6x6
  myBeaconsPlaced: number;
  beaconsNeeded: number;
  phase: GamePhase;
  isMyTurn: boolean;
  isSinglePlayer: boolean;
  opponentId: string | null;
  opponentName: string;
  matchId: string | null;
  myHits: number;
  enemyHits: number;
  radarAngle: number;
  hoverCell: { r: number; c: number } | null;
}

export const TacticalRadarStrike: React.FC<TacticalRadarStrikeProps> = ({ stompClient, localId, users = [] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<'SOLO_AI' | 'MULTIPLAYER'>('MULTIPLAYER');
  const [statusMsg, setStatusMsg] = useState('Select an opponent from the mesh or train in Solo AI mode.');
  const [incomingInvite, setIncomingInvite] = useState<DuelInvite | null>(null);
  const [isMuted, setIsMuted] = useState(tacticalSoundFx.getIsMuted());

  // Unmanaged mutable game state for 60 FPS animation loop (zero React state overhead during render loop)
  const stateRef = useRef<GameState>({
    myGrid: Array(6).fill(null).map(() => Array(6).fill('EMPTY')),
    targetGrid: Array(6).fill(null).map(() => Array(6).fill('EMPTY')),
    myBeaconsPlaced: 0,
    beaconsNeeded: 3,
    phase: 'LOBBY',
    isMyTurn: false,
    isSinglePlayer: false,
    opponentId: null,
    opponentName: 'AI Radar Sim',
    matchId: null,
    myHits: 0,
    enemyHits: 0,
    radarAngle: 0,
    hoverCell: null
  });

  const aiBeaconsRef = useRef<{ r: number; c: number }[]>([]);

  // Initialize Solo AI
  const startSoloGame = useCallback(() => {
    const aiBeacons: { r: number; c: number }[] = [];
    while (aiBeacons.length < 3) {
      const r = Math.floor(Math.random() * 6);
      const c = Math.floor(Math.random() * 6);
      if (!aiBeacons.some(b => b.r === r && b.c === c)) {
        aiBeacons.push({ r, c });
      }
    }
    aiBeaconsRef.current = aiBeacons;

    stateRef.current = {
      myGrid: Array(6).fill(null).map(() => Array(6).fill('EMPTY')),
      targetGrid: Array(6).fill(null).map(() => Array(6).fill('EMPTY')),
      myBeaconsPlaced: 0,
      beaconsNeeded: 3,
      phase: 'PLACEMENT',
      isMyTurn: true,
      isSinglePlayer: true,
      opponentId: 'SOLO_AI',
      opponentName: 'Simulated AI Drone',
      matchId: `ai-${Date.now()}`,
      myHits: 0,
      enemyHits: 0,
      radarAngle: 0,
      hoverCell: null
    };

    setMode('SOLO_AI');
    setStatusMsg('Deploy 3 Radar Beacons on your defensive grid (click left grid).');
    tacticalSoundFx.playSonarPing();
  }, []);

  // Send Duel Challenge to Peer
  const sendDuelChallenge = (targetUser: any) => {
    if (!stompClient?.connected) {
      alert('Cannot send challenge: Mesh socket is reconnecting.');
      return;
    }

    const myIdentity = identityService.getSafeState();
    const matchId = `match-${Date.now()}-${localId.substring(0, 4)}`;

    const invite: DuelInvite = {
      fromId: localId,
      fromName: myIdentity?.fullName || 'Operator',
      fromTag: myIdentity?.deviceTag || `#${localId.substring(0, 4)}`,
      toId: targetUser.clientId,
      matchId
    };

    stompClient.publish({
      destination: '/app/game.invite',
      body: JSON.stringify({ type: 'DUEL_CHALLENGE', ...invite })
    });

    // Set local state to waiting placement
    stateRef.current = {
      myGrid: Array(6).fill(null).map(() => Array(6).fill('EMPTY')),
      targetGrid: Array(6).fill(null).map(() => Array(6).fill('EMPTY')),
      myBeaconsPlaced: 0,
      beaconsNeeded: 3,
      phase: 'PLACEMENT',
      isMyTurn: true, // Challenger fires first
      isSinglePlayer: false,
      opponentId: targetUser.clientId,
      opponentName: targetUser.displayName || targetUser.clientId,
      matchId,
      myHits: 0,
      enemyHits: 0,
      radarAngle: 0,
      hoverCell: null
    };

    setMode('MULTIPLAYER');
    setStatusMsg(`Challenge sent to ${targetUser.displayName || 'Peer'}! Deploy 3 Beacons now.`);
    tacticalSoundFx.playSonarPing();
  };

  // Accept Incoming Duel
  const acceptDuel = () => {
    if (!incomingInvite || !stompClient?.connected) return;

    stompClient.publish({
      destination: '/app/game.invite',
      body: JSON.stringify({
        type: 'DUEL_ACCEPTED',
        fromId: localId,
        toId: incomingInvite.fromId,
        matchId: incomingInvite.matchId
      })
    });

    stateRef.current = {
      myGrid: Array(6).fill(null).map(() => Array(6).fill('EMPTY')),
      targetGrid: Array(6).fill(null).map(() => Array(6).fill('EMPTY')),
      myBeaconsPlaced: 0,
      beaconsNeeded: 3,
      phase: 'PLACEMENT',
      isMyTurn: false, // Defender fires second
      isSinglePlayer: false,
      opponentId: incomingInvite.fromId,
      opponentName: `${incomingInvite.fromName} ${incomingInvite.fromTag}`,
      matchId: incomingInvite.matchId,
      myHits: 0,
      enemyHits: 0,
      radarAngle: 0,
      hoverCell: null
    };

    setIncomingInvite(null);
    setMode('MULTIPLAYER');
    setStatusMsg(`Duel with ${incomingInvite.fromName} accepted! Deploy 3 Radar Beacons.`);
    tacticalSoundFx.playSonarPing();
  };

  const declineDuel = () => {
    setIncomingInvite(null);
  };

  // Confirm Deployment
  const confirmDeployment = () => {
    const s = stateRef.current;
    if (s.myBeaconsPlaced < s.beaconsNeeded) {
      alert(`Place all ${s.beaconsNeeded} radar beacons before confirming.`);
      return;
    }

    if (s.isSinglePlayer) {
      s.phase = 'BATTLE';
      setStatusMsg(s.isMyTurn ? 'RADAR ACTIVE — Select coordinate on target grid to fire missile!' : 'Opponent acquiring target...');
      tacticalSoundFx.playSonarPing();
      return;
    }

    s.phase = 'WAITING_OPPONENT';
    setStatusMsg('Beacons Locked. Awaiting opponent deployment confirmation...');

    if (stompClient?.connected && s.matchId) {
      stompClient.publish({
        destination: '/app/game.action',
        body: JSON.stringify({
          action: 'READY_TO_BATTLE',
          matchId: s.matchId,
          senderId: localId
        })
      });
    }
  };

  // Listen to STOMP Game & Invite Subscriptions
  useEffect(() => {
    if (!stompClient?.connected) return;

    // 1. Invites Subscription
    const inviteSub = stompClient.subscribe('/topic/game.invite', (frame) => {
      try {
        const msg = JSON.parse(frame.body);
        if (msg.type === 'DUEL_CHALLENGE' && msg.toId === localId && msg.fromId !== localId) {
          setIncomingInvite({
            fromId: msg.fromId,
            fromName: msg.fromName,
            fromTag: msg.fromTag,
            toId: msg.toId,
            matchId: msg.matchId
          });
          tacticalSoundFx.playTacticalChime();
        } else if (msg.type === 'DUEL_ACCEPTED' && msg.toId === localId) {
          setStatusMsg(`Opponent joined! Deploy 3 Beacons and confirm.`);
          tacticalSoundFx.playSonarPing();
        }
      } catch (e) {}
    });

    // 2. Action / Battle Subscription
    const actionSub = stompClient.subscribe('/topic/game', (frame) => {
      try {
        const msg = JSON.parse(frame.body);
        const s = stateRef.current;
        if (!s.matchId || msg.matchId !== s.matchId || msg.senderId === localId) return;

        if (msg.action === 'READY_TO_BATTLE') {
          if (s.phase === 'WAITING_OPPONENT' || s.phase === 'PLACEMENT') {
            s.phase = 'BATTLE';
            setStatusMsg(s.isMyTurn ? '🟢 YOUR TURN TO FIRE! Select sector on Target Grid.' : '🟡 ENEMY TURN — Enemy acquiring firing solution...');
            tacticalSoundFx.playSonarPing();
          }
        } else if (msg.action === 'FIRE_SECTOR') {
          const { r, c } = msg;
          const isHit = s.myGrid[r][c] === 'BEACON';
          s.myGrid[r][c] = isHit ? 'HIT' : 'MISS';

          if (isHit) {
            s.enemyHits++;
            tacticalSoundFx.playExplosion();
            if (s.enemyHits >= s.beaconsNeeded) {
              s.phase = 'DEFEAT';
              setStatusMsg('Defensive Perimeter Breached! Sector Compromised.');
            }
          } else {
            tacticalSoundFx.playSplashMiss();
          }

          s.isMyTurn = true;
          if (s.phase === 'BATTLE') {
            setStatusMsg('🟢 YOUR TURN TO FIRE! Select sector on Target Grid.');
          }

          // Transmit Hit Confirmation
          stompClient.publish({
            destination: '/app/game.action',
            body: JSON.stringify({
              action: 'HIT_RESULT',
              matchId: s.matchId,
              r,
              c,
              isHit,
              senderId: localId
            })
          });
        } else if (msg.action === 'HIT_RESULT') {
          const { r, c, isHit } = msg;
          s.targetGrid[r][c] = isHit ? 'HIT' : 'MISS';

          if (isHit) {
            s.myHits++;
            tacticalSoundFx.playExplosion();
            if (s.myHits >= s.beaconsNeeded) {
              s.phase = 'VICTORY';
              setStatusMsg('Direct Target Annihilation! Victory Confirmed.');
            }
          } else {
            tacticalSoundFx.playSplashMiss();
          }
        }
      } catch (e) {
        console.error('Game action parse failed:', e);
      }
    });

    return () => {
      try { inviteSub.unsubscribe(); } catch(e) {}
      try { actionSub.unsubscribe(); } catch(e) {}
    };
  }, [stompClient, localId]);

  // Handle Solo AI Turn Execution
  const triggerAiTurn = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'BATTLE' || !s.isSinglePlayer || s.isMyTurn) return;

    setTimeout(() => {
      let r = Math.floor(Math.random() * 6);
      let c = Math.floor(Math.random() * 6);
      while (s.myGrid[r][c] === 'HIT' || s.myGrid[r][c] === 'MISS') {
        r = Math.floor(Math.random() * 6);
        c = Math.floor(Math.random() * 6);
      }

      const isHit = s.myGrid[r][c] === 'BEACON';
      s.myGrid[r][c] = isHit ? 'HIT' : 'MISS';

      if (isHit) {
        s.enemyHits++;
        tacticalSoundFx.playExplosion();
        if (s.enemyHits >= s.beaconsNeeded) {
          s.phase = 'DEFEAT';
          setStatusMsg('Defensive Perimeter Breached! Sector Compromised.');
        }
      } else {
        tacticalSoundFx.playSplashMiss();
      }

      s.isMyTurn = true;
      if (s.phase === 'BATTLE') {
        setStatusMsg('🟢 YOUR TURN TO FIRE! Select sector on Target Grid.');
      }
    }, 800);
  }, []);

  // Click Coordinates Handler
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const s = stateRef.current;
    const gridSize = Math.min(canvas.width, canvas.height) * 0.42;
    const cellSize = gridSize / 6;

    // Left Grid (My Defense Grid): x in [20, 20 + gridSize], y in [45, 45 + gridSize]
    const leftX = 20;
    const topY = 45;

    // Right Grid (Offensive Target Grid): x in [canvas.width - gridSize - 20, canvas.width - 20]
    const rightX = canvas.width - gridSize - 20;

    // 1. Placement Phase: Place Beacons on Left Grid
    if (s.phase === 'PLACEMENT') {
      if (x >= leftX && x <= leftX + gridSize && y >= topY && y <= topY + gridSize) {
        const c = Math.floor((x - leftX) / cellSize);
        const r = Math.floor((y - topY) / cellSize);

        if (r >= 0 && r < 6 && c >= 0 && c < 6) {
          if (s.myGrid[r][c] === 'BEACON') {
            s.myGrid[r][c] = 'EMPTY';
            s.myBeaconsPlaced--;
            tacticalSoundFx.playSplashMiss();
          } else if (s.myBeaconsPlaced < s.beaconsNeeded) {
            s.myGrid[r][c] = 'BEACON';
            s.myBeaconsPlaced++;
            tacticalSoundFx.playSonarPing();
          }
          setStatusMsg(`Beacons Placed: ${s.myBeaconsPlaced} / ${s.beaconsNeeded}`);
        }
      }
      return;
    }

    // 2. Battle Phase: Fire Missiles on Right Target Grid
    if (s.phase === 'BATTLE' && s.isMyTurn) {
      if (x >= rightX && x <= rightX + gridSize && y >= topY && y <= topY + gridSize) {
        const c = Math.floor((x - rightX) / cellSize);
        const r = Math.floor((y - topY) / cellSize);

        if (r >= 0 && r < 6 && c >= 0 && c < 6) {
          if (s.targetGrid[r][c] !== 'EMPTY') return; // Already fired

          tacticalSoundFx.playMissileFire();

          if (s.isSinglePlayer) {
            const isHit = aiBeaconsRef.current.some(b => b.r === r && b.c === c);
            s.targetGrid[r][c] = isHit ? 'HIT' : 'MISS';

            if (isHit) {
              s.myHits++;
              tacticalSoundFx.playExplosion();
              if (s.myHits >= s.beaconsNeeded) {
                s.phase = 'VICTORY';
                setStatusMsg('Direct Target Annihilation! Victory Confirmed.');
                return;
              }
            } else {
              tacticalSoundFx.playSplashMiss();
            }

            s.isMyTurn = false;
            setStatusMsg('🟡 AI DRONE TARGETING...');
            triggerAiTurn();
          } else {
            // Multiplayer Mesh Fire
            s.isMyTurn = false;
            setStatusMsg('🟡 Missile in flight... Awaiting detonation telemetry.');

            if (stompClient?.connected && s.matchId) {
              stompClient.publish({
                destination: '/app/game.action',
                body: JSON.stringify({
                  action: 'FIRE_SECTOR',
                  matchId: s.matchId,
                  r,
                  c,
                  senderId: localId
                })
              });
            }
          }
        }
      }
    }
  };

  // 60 FPS Unmanaged Canvas Render Loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const parent = canvas.parentElement;
      const width = parent?.clientWidth || 750;
      const height = parent?.clientHeight || 460;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const s = stateRef.current;
      s.radarAngle = (s.radarAngle + 0.03) % (Math.PI * 2);

      // Background
      ctx.fillStyle = '#070a14';
      ctx.fillRect(0, 0, width, height);

      const gridSize = Math.min(width, height) * 0.42;
      const cellSize = gridSize / 6;
      const leftX = 20;
      const rightX = width - gridSize - 20;
      const topY = 45;

      const COLS = ['A', 'B', 'C', 'D', 'E', 'F'];
      const ROWS = ['1', '2', '3', '4', '5', '6'];

      // Function to render a 6x6 Tactical Grid
      const drawGrid = (startX: number, grid: CellState[][], title: string, isTarget: boolean) => {
        // Title
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = isTarget ? '#00d4ff' : '#00ff66';
        ctx.fillText(title, startX, topY - 12);

        // Grid border
        ctx.strokeStyle = isTarget ? 'rgba(0, 212, 255, 0.4)' : 'rgba(0, 255, 102, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, topY, gridSize, gridSize);

        // Header Labels
        ctx.font = '10px monospace';
        ctx.fillStyle = '#64748b';
        for (let i = 0; i < 6; i++) {
          ctx.fillText(COLS[i], startX + i * cellSize + cellSize / 2 - 3, topY - 3);
          ctx.fillText(ROWS[i], startX - 12, topY + i * cellSize + cellSize / 2 + 4);
        }

        // Cell Lines & Contents
        for (let r = 0; r < 6; r++) {
          for (let c = 0; c < 6; c++) {
            const cx = startX + c * cellSize;
            const cy = topY + r * cellSize;

            ctx.strokeStyle = isTarget ? 'rgba(0, 212, 255, 0.15)' : 'rgba(0, 255, 102, 0.15)';
            ctx.lineWidth = 1;
            ctx.strokeRect(cx, cy, cellSize, cellSize);

            const state = grid[r][c];

            if (state === 'BEACON') {
              // Glowing Green Beacon
              ctx.beginPath();
              ctx.arc(cx + cellSize / 2, cy + cellSize / 2, cellSize * 0.28, 0, Math.PI * 2);
              ctx.fillStyle = '#00ff66';
              ctx.shadowColor = '#00ff66';
              ctx.shadowBlur = 10;
              ctx.fill();
              ctx.shadowBlur = 0;
            } else if (state === 'HIT') {
              // Red Hit Explosion
              ctx.beginPath();
              ctx.arc(cx + cellSize / 2, cy + cellSize / 2, cellSize * 0.32, 0, Math.PI * 2);
              ctx.fillStyle = '#ff3344';
              ctx.shadowColor = '#ff3344';
              ctx.shadowBlur = 14;
              ctx.fill();
              ctx.shadowBlur = 0;

              // Crosshair on hit
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(cx + cellSize * 0.2, cy + cellSize * 0.2);
              ctx.lineTo(cx + cellSize * 0.8, cy + cellSize * 0.8);
              ctx.moveTo(cx + cellSize * 0.8, cy + cellSize * 0.2);
              ctx.lineTo(cx + cellSize * 0.2, cy + cellSize * 0.8);
              ctx.stroke();
            } else if (state === 'MISS') {
              // Gray Splash Dot
              ctx.beginPath();
              ctx.arc(cx + cellSize / 2, cy + cellSize / 2, cellSize * 0.15, 0, Math.PI * 2);
              ctx.fillStyle = '#475569';
              ctx.fill();
            }
          }
        }

        // Sweeping Radar Line on Target Grid
        if (isTarget && (s.phase === 'BATTLE' || s.phase === 'PLACEMENT')) {
          const centerX = startX + gridSize / 2;
          const centerY = topY + gridSize / 2;
          const radius = gridSize / 2;

          ctx.save();
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.clip();

          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(centerX + Math.cos(s.radarAngle) * radius, centerY + Math.sin(s.radarAngle) * radius);
          ctx.strokeStyle = 'rgba(0, 212, 255, 0.7)';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#00d4ff';
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.restore();
        }
      };

      // Draw Left & Right Grids
      drawGrid(leftX, s.myGrid, 'DEFENSIVE SECTOR (MY GRID)', false);
      drawGrid(rightX, s.targetGrid, `OFFENSIVE SECTOR (${s.opponentName.toUpperCase()})`, true);

      // Phase Banners & End Screens
      if (s.phase === 'VICTORY') {
        ctx.fillStyle = 'rgba(0, 255, 102, 0.15)';
        ctx.fillRect(0, 0, width, height);
        ctx.font = 'black 24px monospace';
        ctx.fillStyle = '#00ff66';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#00ff66';
        ctx.shadowBlur = 20;
        ctx.fillText('⚡ MISSION ACCOMPLISHED — VICTORY ⚡', width / 2, height / 2);
        ctx.shadowBlur = 0;
        ctx.font = '12px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('All 3 enemy radar beacons confirmed neutralized.', width / 2, height / 2 + 25);
        ctx.textAlign = 'left';
      } else if (s.phase === 'DEFEAT') {
        ctx.fillStyle = 'rgba(255, 51, 68, 0.2)';
        ctx.fillRect(0, 0, width, height);
        ctx.font = 'black 24px monospace';
        ctx.fillStyle = '#ff3344';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#ff3344';
        ctx.shadowBlur = 20;
        ctx.fillText('☠️ PERIMETER BREACHED — DEFEAT ☠️', width / 2, height / 2);
        ctx.shadowBlur = 0;
        ctx.font = '12px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Defensive grid neutralized by enemy missile strike.', width / 2, height / 2 + 25);
        ctx.textAlign = 'left';
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [triggerAiTurn]);

  const activePeers = users.filter(u => u.clientId !== localId);

  return (
    <div className="flex flex-col h-full w-full bg-[#080d1a] border border-neutral-800 rounded-2xl overflow-hidden font-mono select-none shadow-2xl relative">
      {/* Top Game Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-[#0e1424] border-b border-neutral-800 gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Crosshair className="w-5 h-5 text-cyan-400" />
          <span className="text-sm font-black tracking-wider text-white uppercase">Tactical Radar Strike</span>
          <span className={`text-[10px] px-2 py-0.5 rounded border ${
            mode === 'MULTIPLAYER' ? 'bg-cyan-950/60 border-cyan-800/60 text-cyan-400 font-bold' : 'bg-green-950/60 border-green-800/60 text-green-400'
          }`}>
            {mode === 'MULTIPLAYER' ? 'P2P MESH DUEL' : 'SOLO TRAINING'}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const muted = tacticalSoundFx.toggleMute();
              setIsMuted(muted);
            }}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs"
            title={isMuted ? "Unmute Tactical SFX" : "Mute SFX"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-green-400" />}
          </button>

          <button
            onClick={startSoloGame}
            className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs flex items-center gap-1.5 transition-colors"
          >
            <Bot className="w-3.5 h-3.5 text-green-400" /> Solo AI
          </button>

          {stateRef.current.phase === 'PLACEMENT' && (
            <button
              onClick={confirmDeployment}
              className="px-3 py-1 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg text-xs transition-colors shadow"
            >
              <Shield className="w-3.5 h-3.5 inline mr-1" /> Lock Beacons
            </button>
          )}

          {(stateRef.current.phase === 'VICTORY' || stateRef.current.phase === 'DEFEAT') && (
            <button
              onClick={() => {
                if (mode === 'SOLO_AI') startSoloGame();
                else stateRef.current.phase = 'LOBBY';
              }}
              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-black font-bold rounded-lg text-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 inline mr-1" /> Rematch
            </button>
          )}
        </div>
      </div>

      {/* Challenger Lobby Drawer when in LOBBY */}
      {stateRef.current.phase === 'LOBBY' && (
        <div className="absolute inset-0 z-30 bg-[#070a14]/95 backdrop-blur-md flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-lg bg-[#0e1424] border border-neutral-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-neutral-800">
              <Swords className="w-6 h-6 text-cyan-400" />
              <div>
                <h3 className="text-white font-black tracking-widest text-sm uppercase">Mesh Duel Challenger Lobby</h3>
                <p className="text-xs text-neutral-400">Select any online peer to challenge to a turn-based tactical naval duel.</p>
              </div>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto mb-4">
              {activePeers.length === 0 ? (
                <div className="p-4 text-center text-xs text-neutral-500 bg-neutral-900/60 rounded-xl border border-neutral-800">
                  NO SECONDARY OPERATORS CONNECTED TO HOTSPOT.
                  <br />
                  <span className="text-cyan-400 font-bold">Connect your mobile phone to this Wi-Fi network to duel!</span>
                </div>
              ) : (
                activePeers.map(peer => (
                  <div key={peer.clientId} className="flex items-center justify-between p-3 bg-[#131929] border border-neutral-800 rounded-xl">
                    <div>
                      <span className="text-xs font-bold text-white">{peer.displayName || 'Operator'}</span>
                      <span className="ml-2 text-[10px] text-green-400">{peer.deviceType === 'MOBILE' ? '📱 Mobile' : '💻 Desktop'}</span>
                    </div>
                    <button
                      onClick={() => sendDuelChallenge(peer)}
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-xs rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Swords className="w-3.5 h-3.5" /> Challenge
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={startSoloGame}
                className="flex-1 h-10 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Bot className="w-4 h-4 text-green-400" /> Play Solo AI Training
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming Duel Challenge Toast Modal */}
      {incomingInvite && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 bg-[#141b2d] border-2 border-cyan-500 p-4 rounded-2xl shadow-[0_0_25px_rgba(0,212,255,0.4)] flex flex-col gap-3 min-w-[320px]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-cyan-400 animate-pulse" />
            <div>
              <div className="text-xs text-cyan-300 font-bold uppercase">Incoming Duel Challenge!</div>
              <div className="text-sm font-black text-white">{incomingInvite.fromName} {incomingInvite.fromTag}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={acceptDuel}
              className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-black font-black text-xs rounded-xl"
            >
              ACCEPT DUEL
            </button>
            <button
              onClick={declineDuel}
              className="flex-1 py-2 bg-red-950/70 hover:bg-red-900 border border-red-800 text-red-300 text-xs rounded-xl"
            >
              DECLINE
            </button>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="px-4 py-2 bg-[#090e1c] border-b border-neutral-800 flex items-center justify-between text-xs text-neutral-300">
        <span className="text-cyan-300 font-bold">{statusMsg}</span>
        <span className="text-neutral-500 text-[11px] hidden sm:inline">6x6 Radar Grid • 3 Beacons Each</span>
      </div>

      {/* Interactive 60 FPS HTML5 Canvas Viewport */}
      <div className="relative flex-1 w-full h-full bg-[#070a14] overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="absolute inset-0 w-full h-full"
        />
      </div>
    </div>
  );
};
