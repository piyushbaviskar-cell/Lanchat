// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';

interface RollingBarcodeDiodeProps {
  payload: string; // Base64 ciphertext
  fps?: number; // Frames per second (e.g. 30, 60)
  chunkSize?: number; // Bytes per frame
}

// Visual Screen-to-Camera LiFi using animated high-density 2D barcodes
// This component slices a large payload into chunks and rapidly flashes them
// as 2D data matrices (simulated here via dense Canvas pixel blocks).
export function RollingBarcodeDiode({ payload, fps = 30, chunkSize = 128 }: RollingBarcodeDiodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const animationRef = useRef<number>();
  
  const toggleTransmission = () => {
    setIsTransmitting(!isTransmitting);
  };

  useEffect(() => {
    if (!isTransmitting || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    
    // Convert base64 payload to byte array
    const data = Uint8Array.from(atob(payload), c => c.charCodeAt(0));
    const totalChunks = Math.ceil(data.length / chunkSize);
    
    let currentChunk = 0;
    let lastDrawTime = performance.now();
    const frameInterval = 1000 / fps;

    const drawFrame = (time: number) => {
      if (time - lastDrawTime >= frameInterval) {
        lastDrawTime = time;
        
        // Clear canvas
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw synchronization header (Target finder patterns)
        ctx.fillStyle = '#000000';
        ctx.fillRect(10, 10, 40, 40); // Top Left
        ctx.fillRect(canvas.width - 50, 10, 40, 40); // Top Right
        ctx.fillRect(10, canvas.height - 50, 40, 40); // Bottom Left
        
        // Draw frame sequence metadata (8 bits)
        const sequenceHeader = currentChunk & 0xFF;
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = (sequenceHeader & (1 << i)) ? '#000000' : '#FFFFFF';
          ctx.fillRect(60 + (i * 20), 20, 20, 20);
        }
        
        // Draw payload chunk
        const startIdx = currentChunk * chunkSize;
        const chunk = data.slice(startIdx, startIdx + chunkSize);
        
        const blockSize = 10;
        const cols = Math.floor((canvas.width - 100) / blockSize);
        
        let x = 60;
        let y = 60;
        
        for (let i = 0; i < chunk.length; i++) {
          const byte = chunk[i];
          for (let bit = 7; bit >= 0; bit--) {
            ctx.fillStyle = (byte & (1 << bit)) ? '#000000' : '#FFFFFF';
            ctx.fillRect(x, y, blockSize, blockSize);
            
            x += blockSize;
            if (x >= canvas.width - 60) {
              x = 60;
              y += blockSize;
            }
          }
        }
        
        currentChunk = (currentChunk + 1) % totalChunks;
      }
      
      animationRef.current = requestAnimationFrame(drawFrame);
    };
    
    animationRef.current = requestAnimationFrame(drawFrame);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isTransmitting, payload, fps, chunkSize]);

  return (
    <div className="flex flex-col items-center gap-4 bg-neutral-900 p-6 rounded-xl border border-neutral-800">
      <div className="text-center space-y-1">
        <h3 className="text-white font-bold tracking-widest text-sm uppercase">Screen-to-Camera LiFi Diode</h3>
        <p className="text-neutral-400 text-xs">Align receiver camera with the target matrix.</p>
      </div>
      
      <div className="relative p-2 bg-white rounded-lg shadow-[0_0_30px_rgba(255,255,255,0.2)]">
        <canvas 
          ref={canvasRef} 
          width={400} 
          height={400} 
          className="bg-white rounded"
        />
        {!isTransmitting && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg backdrop-blur-sm">
            <span className="text-white text-sm font-mono opacity-50">TRANSMISSION STANDBY</span>
          </div>
        )}
      </div>
      
      <div className="flex gap-4 w-full justify-between items-center bg-black/40 px-4 py-2 rounded-lg border border-neutral-800">
        <div className="flex flex-col">
          <span className="text-[10px] text-neutral-500 font-mono uppercase">Payload Size</span>
          <span className="text-xs text-white font-mono">{Math.ceil(payload.length * 0.75)} Bytes</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-neutral-500 font-mono uppercase">Baud Rate</span>
          <span className="text-xs text-white font-mono">{fps * chunkSize * 8} bps</span>
        </div>
        <button 
          onClick={toggleTransmission}
          className={`px-6 py-2 rounded text-xs font-bold tracking-wider uppercase transition-colors ${
            isTransmitting ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-indigo-500 hover:bg-indigo-600 text-white'
          }`}
        >
          {isTransmitting ? 'Halt TX' : 'Start TX'}
        </button>
      </div>
    </div>
  );
}
