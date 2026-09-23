// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import { soundSynthesizer } from './SoundSynthesizer';
import { PredictionEngine } from './PredictionEngine';

interface ArenaGameProps {
  stompClient: any;
  localId: string;
}

export const ArenaGame: React.FC<ArenaGameProps> = ({ stompClient, localId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PredictionEngine | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    soundSynthesizer.init();

    engineRef.current = new PredictionEngine({
      id: localId,
      x: 400,
      y: 300,
      timestamp: Date.now()
    });

    let running = true;
    const keys = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => keys.add(e.key);
    const handleKeyUp = (e: KeyboardEvent) => keys.delete(e.key);
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Network Subscription for Game state
    const sub = stompClient.subscribe('/topic/game', (frame: any) => {
        try {
            const msg = JSON.parse(frame.body);
            if (msg.gameType === 'ARENA' && msg.senderId !== localId) {
                engineRef.current?.addRemoteState({
                    id: msg.senderId,
                    x: msg.payload.x,
                    y: msg.payload.y,
                    timestamp: msg.payload.timestamp
                });
            }
        } catch(e) {}
    });

    // Fixed-step physics loop (30Hz)
    const physicsInterval = setInterval(() => {
        let dx = 0;
        let dy = 0;
        if (keys.has('w')) dy -= 5;
        if (keys.has('s')) dy += 5;
        if (keys.has('a')) dx -= 5;
        if (keys.has('d')) dx += 5;
        
        if (dx !== 0 || dy !== 0) {
            engineRef.current?.applyInput({ dx, dy, sequence: Date.now() });
            
            // Broadcast state
            const state = engineRef.current?.getLocalState();
            stompClient.publish({
                destination: '/app/game.action',
                body: JSON.stringify({
                    type: 'MOVE',
                    gameType: 'ARENA',
                    senderId: localId,
                    payload: { x: state?.x, y: state?.y, timestamp: Date.now() }
                })
            });
        }
        
        if (keys.has(' ')) {
            soundSynthesizer.playGunshot();
            keys.delete(' '); // debounce
        }
    }, 1000 / 30);

    const render = () => {
      if (!running) return;
      
      // Clear canvas
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, 800, 600);

      const now = Date.now();
      
      // Render Local Player
      const localState = engineRef.current?.getLocalState();
      if (localState) {
          ctx.fillStyle = '#0f0';
          ctx.beginPath();
          ctx.arc(localState.x, localState.y, 15, 0, Math.PI * 2);
          ctx.fill();
      }
      
      // Render Remote Players (Interpolated 100ms in past)
      const renderTimestamp = now - 100; 
      // In a real implementation we'd iterate over known remote IDs
      
      requestAnimationFrame(render);
    };
    
    render();

    return () => {
      running = false;
      clearInterval(physicsInterval);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      sub.unsubscribe();
    };
  }, [stompClient, localId]);

  return (
    <div className="flex flex-col items-center">
        <canvas 
            ref={canvasRef} 
            width={800} 
            height={600} 
            className="border border-white/20 rounded shadow-lg bg-black cursor-crosshair"
        />
        <p className="text-white/50 text-sm mt-4 font-mono">WASD to move, SPACE to fire</p>
    </div>
  );
};
