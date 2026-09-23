import { useState, useRef } from 'react';
import { SendHorizontal, Mic, Square, Camera, Satellite } from 'lucide-react';
import { Button } from './ui/button';
import { compressTacticalImage } from '../utils/ImageCompressor';
import { TransportTier } from '../services/transports/STALRouter';

export interface InputBarProps {
  onSend: (msg: string) => void;
  onSendImage?: (base64: string) => void;
  onPttStart?: () => void;
  onPttStop?: () => void;
  isRecording?: boolean;
  activeTier?: TransportTier;
  onTyping?: () => void;
  disabled?: boolean;
}

export default function InputBar({
  onSend,
  onSendImage,
  onPttStart,
  onPttStop,
  isRecording = false,
  activeTier = 'TIER_0_LAN',
  onTyping,
  disabled
}: InputBarProps) {
  const [value, setValue] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isNavicActive = activeTier === 'TIER_4_NAVIC';
  const maxChars = isNavicActive ? 230 : 1000;

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    onTyping?.();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onSendImage) return;

    try {
      setIsCompressing(true);
      const result = await compressTacticalImage(file);
      onSendImage(result.base64);
    } catch (err: any) {
      alert(`Image compression error: ${err.message || 'Failed to process image'}`);
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const charsRemaining = maxChars - value.length;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {/* Quick SITREP Status Beacons */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
        <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider shrink-0 hidden sm:inline">SITREP:</span>
        <button
          type="button"
          onClick={() => onSend('📍 SITREP: [GPS LOCKED: 18.9220° N, 72.8347° E • GRID POSITION SECURE]')}
          disabled={disabled}
          className="px-2 py-0.5 rounded-md bg-cyan-950/40 border border-cyan-800/50 text-cyan-400 hover:bg-cyan-900/60 text-[10px] font-mono shrink-0 transition-colors"
          title="Broadcast GPS Coordinates"
        >
          📍 GPS Ping
        </button>

        <button
          type="button"
          onClick={() => onSend('🛡️ SITREP: [STATUS GREEN • PERIMETER SECURE • 100% OPERATIONAL]')}
          disabled={disabled}
          className="px-2 py-0.5 rounded-md bg-green-950/40 border border-green-800/50 text-green-400 hover:bg-green-900/60 text-[10px] font-mono shrink-0 transition-colors"
          title="Broadcast All Clear"
        >
          🛡️ All Clear
        </button>

        <button
          type="button"
          onClick={() => onSend('🚨 RED ALERT: [SOS • HOSTILE ELECTRONIC INTERFERENCE DETECTED]')}
          disabled={disabled}
          className="px-2 py-0.5 rounded-md bg-red-950/40 border border-red-800/50 text-red-400 hover:bg-red-900/60 text-[10px] font-mono shrink-0 transition-colors"
          title="Broadcast Emergency Red Alert"
        >
          🚨 Red Alert
        </button>

        <button
          type="button"
          onClick={() => onSend('⚠️ SITREP: [RADIO SILENCE REQUESTED • SWITCH TO BACKUP TIER]')}
          disabled={disabled}
          className="px-2 py-0.5 rounded-md bg-amber-950/40 border border-amber-800/50 text-amber-400 hover:bg-amber-900/60 text-[10px] font-mono shrink-0 transition-colors"
          title="Broadcast Caution"
        >
          ⚠️ Caution
        </button>
      </div>

      {/* NavIC Space Telemetry Notice Banner */}
      {isNavicActive && (
        <div className="flex items-center justify-between px-3 py-1 bg-cyan-950/60 border border-cyan-800/60 rounded-lg text-[10px] font-mono text-cyan-300">
          <span className="flex items-center gap-1.5 font-bold">
            <Satellite className="w-3.5 h-3.5 animate-pulse" /> [🛰️ NAVIC BURST MODE — 256B PACKETS]
          </span>
          <span className={charsRemaining < 30 ? 'text-amber-400 font-bold' : 'text-neutral-400'}>
            {charsRemaining} Bytes Remaining
          </span>
        </div>
      )}

      <div className="flex gap-2 items-center w-full">
        {/* Hidden File Input for Tactical Image Capture */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleFileSelected}
        />

        {/* Small Image / Camera Attachment Button */}
        {onSendImage && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isCompressing || isNavicActive}
            className="h-12 w-12 rounded-xl bg-[#131929] border border-neutral-700/80 text-neutral-300 hover:text-cyan-400 hover:border-cyan-500/50 flex items-center justify-center transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            title={isNavicActive ? "Images disabled on 256-byte satellite links" : "Send Compressed Tactical Image (<150KB)"}
          >
            <Camera className={`w-5 h-5 ${isCompressing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        )}

        {/* PTT Hold / Speak Button */}
        {onPttStart && (
          <button
            type="button"
            onMouseDown={onPttStart}
            onMouseUp={onPttStop}
            onTouchStart={onPttStart}
            onTouchEnd={onPttStop}
            className={`h-12 w-12 rounded-xl border flex items-center justify-center transition-all shrink-0 ${
              isRecording
                ? 'bg-red-600 border-red-500 text-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                : 'bg-[#131929] border-neutral-700/80 text-neutral-300 hover:text-white hover:border-neutral-600'
            }`}
            title="Push-To-Talk: Hold or tap to speak"
          >
            {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
          </button>
        )}

        {/* Text Input */}
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            placeholder={
              isRecording 
                ? '🔴 Recording Tactical Audio Burst...' 
                : isNavicActive 
                ? 'Transmit 256-byte NavIC space datagram...' 
                : 'Transmit secure message (Enter)...'
            }
            value={value}
            maxLength={maxChars}
            disabled={disabled || isRecording}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
            className="w-full h-12 bg-[#131929] border border-neutral-700/80 rounded-xl px-4 text-sm font-mono text-green-400 placeholder:text-neutral-500 focus:outline-none focus:border-green-500/80 focus:ring-1 focus:ring-green-500/80 transition-all disabled:opacity-50"
          />
          {value.length > maxChars * 0.7 && (
            <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-mono pointer-events-none ${
              charsRemaining < 20 ? 'text-red-400' : 'text-neutral-500'
            }`}>
              {value.length}/{maxChars}
            </span>
          )}
        </div>

        {/* Dispatch Button */}
        <Button
          type="button"
          size="icon"
          className="h-12 w-12 rounded-xl bg-green-600 hover:bg-green-500 text-black shadow-lg transition-transform active:scale-95 shrink-0 disabled:opacity-40"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          title="Send"
        >
          <SendHorizontal className="w-5 h-5 font-bold" />
        </Button>
      </div>
    </div>
  );
}
