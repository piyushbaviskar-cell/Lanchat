// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';

interface AirGapDiodeProps {
  payloadBase64?: string; // If provided, act as Sender
  onPayloadReceived?: (payload: string) => void; // If provided, act as Receiver
}

/**
 * Dynamic Animated QR-Code Air-Gap Data Diode
 * Sender loops QR frames at 15 FPS.
 * Receiver scans, tracks bitmask, and reassembles payload.
 */
export function AirGapDiode({ payloadBase64, onPayloadReceived }: AirGapDiodeProps) {
  const [mode, setMode] = useState<'send' | 'receive'>(payloadBase64 ? 'send' : 'receive');
  
  // -- SENDER STATE --
  const [frames, setFrames] = useState<string[]>([]);
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  
  // -- RECEIVER STATE --
  const [receivedChunks, setReceivedChunks] = useState<Map<number, string>>(new Map());
  const [totalExpected, setTotalExpected] = useState<number | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const readerElementId = "qr-reader";

  // 1. Initialize Sender (Chop payload into frames)
  useEffect(() => {
    if (mode === 'send' && payloadBase64) {
      // Chunk size ~ 300 chars per QR to maintain scannability
      const chunkSize = 300; 
      const total = Math.ceil(payloadBase64.length / chunkSize);
      
      const generatedFrames = [];
      for (let i = 0; i < total; i++) {
        const chunk = payloadBase64.substring(i * chunkSize, (i + 1) * chunkSize);
        // Format: [INDEX|TOTAL|PAYLOAD]
        generatedFrames.push(`[${i}|${total}|${chunk}]`);
      }
      setFrames(generatedFrames);
    }
  }, [mode, payloadBase64]);

  // 2. Sender Loop (15 FPS)
  useEffect(() => {
    if (mode === 'send' && frames.length > 0) {
      const interval = setInterval(() => {
        setCurrentFrameIdx((prev) => (prev + 1) % frames.length);
      }, 1000 / 15); // ~15 FPS
      
      return () => clearInterval(interval);
    }
  }, [mode, frames]);

  // 3. Initialize Receiver Scanner
  useEffect(() => {
    if (mode === 'receive') {
      const scanner = new Html5QrcodeScanner(
        readerElementId,
        { fps: 30, qrbox: { width: 250, height: 250 } },
        false
      );
      scannerRef.current = scanner;

      scanner.render(
        (decodedText) => {
          // Parse format: [INDEX|TOTAL|PAYLOAD]
          const match = decodedText.match(/^\[(\d+)\|(\d+)\|(.*)\]$/);
          if (match) {
            const index = parseInt(match[1], 10);
            const total = parseInt(match[2], 10);
            const chunk = match[3];

            if (totalExpected === null) setTotalExpected(total);

            setReceivedChunks((prev) => {
              if (!prev.has(index)) {
                const updated = new Map(prev);
                updated.set(index, chunk);
                return updated;
              }
              return prev;
            });
          }
        },
        (error) => {
          // Ignore scanning noise
        }
      );

      return () => {
        scanner.clear().catch(console.error);
      };
    }
  }, [mode, totalExpected]);

  // 4. Check if Receiver has all chunks
  useEffect(() => {
    if (mode === 'receive' && totalExpected !== null && receivedChunks.size === totalExpected) {
      // Reassemble!
      let fullPayload = "";
      for (let i = 0; i < totalExpected; i++) {
        fullPayload += receivedChunks.get(i);
      }
      
      if (onPayloadReceived) {
        onPayloadReceived(fullPayload);
      }
      
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    }
  }, [receivedChunks, totalExpected, mode, onPayloadReceived]);

  const progress = totalExpected 
    ? Math.round((receivedChunks.size / totalExpected) * 100) 
    : 0;

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-900 border border-slate-700 rounded-lg max-w-sm w-full mx-auto">
      <div className="flex gap-4 mb-4">
        <button 
          className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${mode === 'send' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
          onClick={() => setMode('send')}
        >
          Transmit
        </button>
        <button 
          className={`px-4 py-2 rounded text-sm font-semibold transition-colors ${mode === 'receive' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
          onClick={() => setMode('receive')}
        >
          Receive
        </button>
      </div>

      {mode === 'send' && frames.length > 0 && (
        <div className="flex flex-col items-center">
          <div className="bg-white p-4 rounded-xl mb-4">
            <QRCodeSVG value={frames[currentFrameIdx]} size={250} level="L" />
          </div>
          <div className="text-slate-400 text-sm font-mono">
            Transmitting frame {currentFrameIdx + 1} / {frames.length}
          </div>
        </div>
      )}

      {mode === 'receive' && (
        <div className="flex flex-col items-center w-full">
          <div id={readerElementId} className="w-full bg-black rounded-xl overflow-hidden min-h-[300px]"></div>
          
          <div className="w-full mt-4">
            <div className="flex justify-between text-xs text-slate-400 mb-1 font-mono">
              <span>Data Assembly</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-200" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
