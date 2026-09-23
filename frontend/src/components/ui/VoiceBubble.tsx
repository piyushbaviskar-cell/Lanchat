import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Mic } from 'lucide-react';

interface VoiceBubbleProps {
  audioBase64: string;
  durationSec?: number;
  senderName?: string;
  senderTag?: string;
  isSelf?: boolean;
}

export const VoiceBubble: React.FC<VoiceBubbleProps> = ({
  audioBase64,
  durationSec = 3,
  isSelf = false
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Construct base64 audio source
    const audioUrl = audioBase64.startsWith('data:') 
      ? audioBase64 
      : `data:audio/webm;codecs=opus;base64,${audioBase64}`;
    
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [audioBase64]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(e => {
        console.warn('Audio play error:', e);
      });
    }
  };

  const progressPct = durationSec > 0 ? (currentTime / durationSec) * 100 : 0;

  // Generate deterministic bar heights for waveform
  const bars = [40, 65, 80, 50, 90, 70, 45, 85, 95, 60, 75, 40, 80, 60, 90, 50, 70, 35];

  return (
    <div className={`flex flex-col p-3 rounded-2xl border max-w-xs ${
      isSelf 
        ? 'bg-indigo-950/60 border-indigo-700/50 text-indigo-100' 
        : 'bg-neutral-900 border-neutral-800 text-white'
    }`}>
      <div className="flex items-center justify-between mb-2 text-[11px] font-mono text-neutral-400">
        <span className="flex items-center gap-1 text-green-400 font-bold">
          <Mic className="w-3.5 h-3.5" /> PTT BURST
        </span>
        <span>{Math.round(currentTime * 10) / 10}s / {durationSec}s</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-xl bg-green-500 hover:bg-green-400 text-black flex items-center justify-center transition-transform active:scale-95 shrink-0"
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>

        {/* Waveform Visualizer */}
        <div className="flex-1 flex items-center gap-0.5 h-8">
          {bars.map((height, i) => {
            const barProgress = (i / bars.length) * 100;
            const isFilled = barProgress <= progressPct;
            return (
              <div
                key={i}
                className={`w-1 rounded-full transition-colors ${
                  isFilled 
                    ? 'bg-green-400' 
                    : isSelf ? 'bg-indigo-700/60' : 'bg-neutral-700'
                }`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
