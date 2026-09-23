import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import { Download, Trash2, Pen, Highlighter, ArrowRight, Square, Eraser, Grid } from 'lucide-react';
import { identityService } from '../../services/IdentityService';

export type CanvasTool = 'PEN' | 'HIGHLIGHTER' | 'ARROW' | 'RECT' | 'ERASER' | 'POINTER';

export interface DrawVector {
  action: 'DRAW' | 'CLEAR' | 'POINTER';
  tool?: CanvasTool;
  prevX: number; // Normalized 0.0 to 1.0
  prevY: number; // Normalized 0.0 to 1.0
  currX: number; // Normalized 0.0 to 1.0
  currY: number; // Normalized 0.0 to 1.0
  color: string;
  lineWidth: number;
  senderTag: string;
  senderName?: string;
  senderId: string;
  timestamp?: number;
}

interface RemotePointer {
  x: number; // Normalized 0.0 to 1.0
  y: number; // Normalized 0.0 to 1.0
  senderTag: string;
  senderName: string;
  color: string;
  lastSeen: number;
}

interface TacticalCanvasProps {
  stompClient: Client | null;
  localId: string;
}

export const TacticalCanvas: React.FC<TacticalCanvasProps> = ({ stompClient, localId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  const [activeTool, setActiveTool] = useState<CanvasTool>('PEN');
  const [color, setColor] = useState('#00ff66'); // Tactical Neon Green
  const [lineWidth, setLineWidth] = useState(3);
  const [showGrid, setShowGrid] = useState(true);
  const [remotePointers, setRemotePointers] = useState<Record<string, RemotePointer>>({});

  const isDrawing = useRef(false);
  const startPos = useRef<{ x: number; y: number } | null>(null); // Normalized
  const lastPos = useRef<{ x: number; y: number } | null>(null); // Normalized
  const lastPointerBroadcast = useRef(0);

  const TACTICAL_COLORS = [
    '#00ff66', // Tactical Green
    '#00d4ff', // Cyan Radar
    '#ff3344', // Warning Red
    '#ffaa00', // Amber Caution
    '#a855f7', // Purple IR
    '#ffffff', // White Beacon
  ];

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.06)';
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = step; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = step; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }, []);

  const executeDraw = useCallback((vec: DrawVector) => {
    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    const width = canvas.width;
    const height = canvas.height;

    if (vec.action === 'CLEAR') {
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, width, height);
      if (showGrid) drawGrid(ctx, width, height);
      return;
    }

    const x1 = vec.prevX * width;
    const y1 = vec.prevY * height;
    const x2 = vec.currX * width;
    const y2 = vec.currY * height;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const tool = vec.tool || 'PEN';

    if (tool === 'ERASER') {
      ctx.strokeStyle = '#0b0f19';
      ctx.lineWidth = vec.lineWidth * 4;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else if (tool === 'HIGHLIGHTER') {
      ctx.strokeStyle = vec.color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = vec.lineWidth * 5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else if (tool === 'RECT') {
      ctx.strokeStyle = vec.color;
      ctx.lineWidth = vec.lineWidth;
      ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    } else if (tool === 'ARROW') {
      ctx.strokeStyle = vec.color;
      ctx.fillStyle = vec.color;
      ctx.lineWidth = vec.lineWidth;

      // Draw Main line
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Draw Arrowhead
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headLen = 14 + vec.lineWidth * 2;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    } else {
      // Standard Tactical Freehand Pen
      ctx.strokeStyle = vec.color;
      ctx.lineWidth = vec.lineWidth;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.restore();
  }, [showGrid, drawGrid]);

  // Render Remote Laser Pointers on Overlay Canvas
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const now = Date.now();
    Object.values(remotePointers).forEach(ptr => {
      if (now - ptr.lastSeen > 4000) return; // Expire after 4s

      const x = ptr.x * overlay.width;
      const y = ptr.y * overlay.height;

      ctx.save();
      // Glowing Laser Dot
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = ptr.color;
      ctx.shadowColor = ptr.color;
      ctx.shadowBlur = 12;
      ctx.fill();

      // Laser Ring
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.strokeStyle = ptr.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Operator Tag Badge
      ctx.font = '10px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 0;
      const label = `${ptr.senderName || 'Operator'} ${ptr.senderTag}`;
      const textWidth = ctx.measureText(label).width;

      ctx.fillStyle = 'rgba(11, 15, 25, 0.85)';
      ctx.fillRect(x + 14, y - 10, textWidth + 8, 16);
      ctx.strokeStyle = ptr.color;
      ctx.strokeRect(x + 14, y - 10, textWidth + 8, 16);

      ctx.fillStyle = ptr.color;
      ctx.fillText(label, x + 18, y + 2);
      ctx.restore();
    });
  }, [remotePointers]);

  // Canvas Initialization & Vector History Ingestion
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;

    const parent = canvas.parentElement;
    const width = parent?.clientWidth || 800;
    const height = parent?.clientHeight || 600;

    canvas.width = width;
    canvas.height = height;
    overlay.width = width;
    overlay.height = height;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, width, height);
      if (showGrid) drawGrid(ctx, width, height);
      contextRef.current = ctx;
    }

    // Fetch in-memory vector history from backend
    fetch('/api/board/history')
      .then(res => res.json())
      .then((history: string[]) => {
        if (Array.isArray(history)) {
          history.forEach(raw => {
            try {
              const vec: DrawVector = JSON.parse(raw);
              executeDraw(vec);
            } catch (e) {}
          });
        }
      })
      .catch(() => {});

    // Subscribe to STOMP board vector stream
    if (stompClient?.connected) {
      const sub = stompClient.subscribe('/topic/board', (frame) => {
        try {
          const vec: DrawVector = JSON.parse(frame.body);
          if (vec.action === 'POINTER') {
            if (vec.senderId !== localId) {
              setRemotePointers(prev => ({
                ...prev,
                [vec.senderId]: {
                  x: vec.currX,
                  y: vec.currY,
                  senderTag: vec.senderTag,
                  senderName: vec.senderName || 'Peer',
                  color: vec.color || '#00d4ff',
                  lastSeen: Date.now()
                }
              }));
            }
          } else if (vec.senderId !== localId) {
            executeDraw(vec);
          }
        } catch (e) {
          console.error('Board vector parse failed:', e);
        }
      });

      return () => {
        try { sub.unsubscribe(); } catch(e) {}
      };
    }
  }, [stompClient, localId, executeDraw, showGrid, drawGrid]);

  const getNormalizedCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    return {
      x: Math.max(0, Math.min(1, rawX / rect.width)),
      y: Math.max(0, Math.min(1, rawY / rect.height))
    };
  };

  const broadcastPointer = (coords: { x: number; y: number }) => {
    const now = Date.now();
    if (now - lastPointerBroadcast.current < 40) return; // 25 FPS throttle
    lastPointerBroadcast.current = now;

    const idState = identityService.getSafeState();
    const tag = idState?.deviceTag || `#${localId.substring(0, 4)}`;
    const name = idState?.fullName || 'Operator';

    const ptrMsg: DrawVector = {
      action: 'POINTER',
      prevX: coords.x,
      prevY: coords.y,
      currX: coords.x,
      currY: coords.y,
      color,
      lineWidth,
      senderTag: tag,
      senderName: name,
      senderId: localId
    };

    if (stompClient?.connected) {
      stompClient.publish({
        destination: '/app/board.draw',
        body: JSON.stringify(ptrMsg)
      });
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawing.current = true;
    const coords = getNormalizedCoords(e);
    startPos.current = coords;
    lastPos.current = coords;
    broadcastPointer(coords);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const curr = getNormalizedCoords(e);
    broadcastPointer(curr);

    if (!isDrawing.current || !lastPos.current) return;
    const prev = lastPos.current;

    const idState = identityService.getSafeState();
    const tag = idState?.deviceTag || `#${localId.substring(0, 4)}`;
    const name = idState?.fullName || 'Operator';

    if (activeTool === 'PEN' || activeTool === 'HIGHLIGHTER' || activeTool === 'ERASER') {
      const vector: DrawVector = {
        action: 'DRAW',
        tool: activeTool,
        prevX: prev.x,
        prevY: prev.y,
        currX: curr.x,
        currY: curr.y,
        color,
        lineWidth,
        senderTag: tag,
        senderName: name,
        senderId: localId
      };

      executeDraw(vector);

      if (stompClient?.connected) {
        stompClient.publish({
          destination: '/app/board.draw',
          body: JSON.stringify(vector)
        });
      }

      lastPos.current = curr;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(err) {}

    if (isDrawing.current && startPos.current && (activeTool === 'ARROW' || activeTool === 'RECT')) {
      const curr = getNormalizedCoords(e);
      const prev = startPos.current;

      const idState = identityService.getSafeState();
      const tag = idState?.deviceTag || `#${localId.substring(0, 4)}`;
      const name = idState?.fullName || 'Operator';

      const vector: DrawVector = {
        action: 'DRAW',
        tool: activeTool,
        prevX: prev.x,
        prevY: prev.y,
        currX: curr.x,
        currY: curr.y,
        color,
        lineWidth,
        senderTag: tag,
        senderName: name,
        senderId: localId
      };

      executeDraw(vector);

      if (stompClient?.connected) {
        stompClient.publish({
          destination: '/app/board.draw',
          body: JSON.stringify(vector)
        });
      }
    }

    isDrawing.current = false;
    startPos.current = null;
    lastPos.current = null;
  };

  const handleClear = () => {
    const idState = identityService.getSafeState();
    const tag = idState?.deviceTag || `#${localId.substring(0, 4)}`;

    const vector: DrawVector = {
      action: 'CLEAR',
      prevX: 0,
      prevY: 0,
      currX: 0,
      currY: 0,
      color: '#0b0f19',
      lineWidth: 0,
      senderTag: tag,
      senderId: localId
    };

    executeDraw(vector);

    if (stompClient?.connected) {
      stompClient.publish({
        destination: '/app/board.draw',
        body: JSON.stringify(vector)
      });
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `tactical-whiteboard-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0b0f19] border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl font-mono">
      {/* Tactical Toolbar */}
      <div className="flex flex-wrap items-center justify-between p-2.5 bg-[#0e1320] border-b border-neutral-800 gap-2 shrink-0">
        {/* Tool Selectors */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTool('PEN')}
            className={`p-2 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${
              activeTool === 'PEN' ? 'bg-green-600 text-black font-bold' : 'text-neutral-400 hover:text-white bg-neutral-800/60'
            }`}
            title="Tactical Pen"
          >
            <Pen className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Pen</span>
          </button>

          <button
            onClick={() => setActiveTool('HIGHLIGHTER')}
            className={`p-2 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${
              activeTool === 'HIGHLIGHTER' ? 'bg-cyan-500 text-black font-bold' : 'text-neutral-400 hover:text-white bg-neutral-800/60'
            }`}
            title="Highlighter Marker"
          >
            <Highlighter className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Highlight</span>
          </button>

          <button
            onClick={() => setActiveTool('ARROW')}
            className={`p-2 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${
              activeTool === 'ARROW' ? 'bg-amber-500 text-black font-bold' : 'text-neutral-400 hover:text-white bg-neutral-800/60'
            }`}
            title="Vector Arrow"
          >
            <ArrowRight className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Arrow</span>
          </button>

          <button
            onClick={() => setActiveTool('RECT')}
            className={`p-2 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${
              activeTool === 'RECT' ? 'bg-purple-500 text-white font-bold' : 'text-neutral-400 hover:text-white bg-neutral-800/60'
            }`}
            title="Boundary Box"
          >
            <Square className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Perimeter</span>
          </button>

          <button
            onClick={() => setActiveTool('ERASER')}
            className={`p-2 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${
              activeTool === 'ERASER' ? 'bg-red-500 text-white font-bold' : 'text-neutral-400 hover:text-white bg-neutral-800/60'
            }`}
            title="Tactical Eraser"
          >
            <Eraser className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Eraser</span>
          </button>
        </div>

        {/* Color Palette */}
        <div className="flex items-center gap-1.5">
          {TACTICAL_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full border transition-transform ${
                color === c ? 'scale-125 border-white shadow-[0_0_8px_currentColor]' : 'border-neutral-700 hover:scale-110'
              }`}
              style={{ backgroundColor: c, color: c }}
            />
          ))}
        </div>

        {/* Width & Actions */}
        <div className="flex items-center gap-2">
          {/* Line Width */}
          <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 px-2 py-1 rounded-lg">
            <span className="text-[10px] text-neutral-400">Size</span>
            {[2, 4, 8].map(w => (
              <button
                key={w}
                onClick={() => setLineWidth(w)}
                className={`px-1.5 py-0.5 rounded text-[10px] ${
                  lineWidth === w ? 'bg-green-500 text-black font-bold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {w}px
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded-lg border text-xs ${
              showGrid ? 'bg-green-950/60 border-green-700 text-green-400' : 'bg-neutral-800 border-neutral-700 text-neutral-400'
            }`}
            title="Toggle Tactical Grid"
          >
            <Grid className="w-4 h-4" />
          </button>

          <button
            onClick={handleClear}
            className="p-1.5 bg-neutral-800 hover:bg-red-950/70 border border-neutral-700 hover:border-red-600 text-neutral-300 hover:text-red-400 rounded-lg text-xs"
            title="Clear All Vectors"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={handleDownload}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs"
            title="Export PNG Snapshot"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas Viewport with Touch Pointer Capture and Remote Laser Overlay */}
      <div className="relative flex-1 w-full h-full bg-[#0b0f19] cursor-crosshair overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute inset-0 w-full h-full"
        />
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
      </div>
    </div>
  );
};
