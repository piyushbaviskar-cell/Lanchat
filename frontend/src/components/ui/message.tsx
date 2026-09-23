import React from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Reply, CornerDownRight, Check, Clock, ImageIcon, Eye } from 'lucide-react';
import { VoiceBubble } from './VoiceBubble';

export interface MessageProps {
  id?: string;
  from: 'user' | 'assistant';
  content?: string;
  senderName?: string;
  senderTag?: string;
  timestamp?: number;
  type?: string;
  audioData?: string;
  durationSec?: number;
  replyTo?: {
    id: string;
    sender: string;
    content: string;
  };
  pending?: boolean;
  onReply?: () => void;
  onOpenImage?: (src: string) => void;
}

export function Message({
  from,
  content,
  senderName,
  senderTag,
  timestamp,
  type,
  audioData,
  durationSec,
  replyTo,
  pending = false,
  onReply,
  onOpenImage
}: MessageProps) {
  const isUser = from === 'user';
  const controls = useAnimation();

  const handleDragEnd = (_e: any, info: any) => {
    if (info.offset.x > 50) {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { (navigator as any).vibrate(10); } catch(err) {}
      }
      onReply?.();
      controls.start({ x: 0, transition: { type: 'spring', stiffness: 350, damping: 25 } });
    } else {
      controls.start({ x: 0 });
    }
  };

  const isVoice = type === 'VOICE' || !!audioData;
  const isImage = type === 'IMAGE' || (content && content.startsWith('data:image/'));

  return (
    <div className={`flex w-full mb-3 group relative ${isUser ? 'justify-end' : 'justify-start'}`}>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 80 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        animate={controls}
        className={`flex max-w-[88%] sm:max-w-[75%] gap-2 items-end relative ${
          isUser ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        {/* Message Bubble Container */}
        <div className="flex flex-col">
          {/* Sender Header */}
          <div className={`flex items-center gap-1.5 mb-1 text-[11px] font-mono ${
            isUser ? 'justify-end text-indigo-400' : 'justify-start text-green-400'
          }`}>
            <span className="font-bold">{senderName || 'Operator'}</span>
            {senderTag && <span className="text-neutral-500 font-normal">{senderTag}</span>}
            {timestamp && (
              <span className="text-[10px] text-neutral-500 ml-1">
                {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {/* Main Bubble */}
          <div className={`p-3.5 rounded-2xl border text-sm font-sans shadow-md relative ${
            isUser 
              ? 'bg-[#151c30] border-indigo-900/60 text-indigo-100 rounded-br-sm' 
              : 'bg-[#0f1422] border-neutral-800 text-neutral-100 rounded-bl-sm'
          }`}>
            {/* Quoted Reference */}
            {replyTo && (
              <div className="mb-2 p-2 bg-black/40 border-l-2 border-indigo-500 rounded text-xs font-mono text-neutral-300">
                <div className="text-[10px] text-indigo-400 font-bold flex items-center gap-1">
                  <CornerDownRight className="w-3 h-3" /> Replying to {replyTo.sender}:
                </div>
                <div className="truncate text-neutral-400">{replyTo.content}</div>
              </div>
            )}

            {/* Content Rendering: Voice, Image, or Text */}
            {isVoice ? (
              <VoiceBubble
                audioBase64={audioData!}
                durationSec={durationSec || 3}
                senderName={senderName}
                senderTag={senderTag}
                isSelf={isUser}
              />
            ) : isImage ? (
              <div className="flex flex-col gap-1.5">
                <div 
                  onClick={() => onOpenImage?.(content!)}
                  className="relative group/img cursor-pointer overflow-hidden rounded-xl border border-neutral-700/80 bg-black/40 max-w-sm"
                >
                  <img
                    src={content}
                    alt="Tactical Asset"
                    className="w-full max-h-72 object-cover transition-transform group-hover/img:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1 text-xs font-mono text-white">
                    <Eye className="w-4 h-4" /> Expand
                  </div>
                </div>
                <span className="text-[10px] font-mono text-neutral-500 flex items-center gap-1">
                  <ImageIcon className="w-3 h-3 text-cyan-400" /> TACTICAL RECON IMAGE
                </span>
              </div>
            ) : (
              <div className="leading-relaxed whitespace-pre-wrap break-words">{content}</div>
            )}

            {/* Loopback pending / confirmed state */}
            {isUser && (
              <div className="flex justify-end mt-1 text-[10px] text-neutral-500">
                {pending ? (
                  <span className="flex items-center gap-1 text-amber-500 font-mono">
                    <Clock className="w-3 h-3 animate-spin" /> Transmitting
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-green-500 font-mono">
                    <Check className="w-3 h-3" /> Confirmed
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Desktop Hover Action [↩ Reply] */}
        <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center mb-4 ${
          isUser ? 'order-first mr-1' : 'ml-1'
        }`}>
          <button
            onClick={onReply}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg border border-neutral-700 shadow transition-colors"
            title="Reply"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function MessageAvatar({ src: _src, name }: { src?: string; name?: string }) {
  const initial = name ? name.charAt(0).toUpperCase() : 'O';
  return (
    <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-mono font-bold text-green-400 shrink-0">
      {initial}
    </div>
  );
}

export function MessageContent({ children }: { children: React.ReactNode }) {
  return <div className="leading-relaxed whitespace-pre-wrap">{children}</div>;
}
