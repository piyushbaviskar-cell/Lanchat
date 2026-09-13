import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { SendHorizontal } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';

export interface InputBarProps {
  onSend: (msg: string) => void;
  onTyping?: () => void;
  disabled?: boolean;
}

export default function InputBar({ onSend, onTyping, disabled }: InputBarProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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

  const charCount = value.length;
  const counterColor = charCount >= 1000 ? 'text-red-500' : charCount > 800 ? 'text-amber-500' : 'text-neutral-400';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2 items-center w-full"
    >
      <div className="flex-1 relative bg-gradient-to-b from-white/5 to-black/20 p-px rounded-2xl shadow-sm">
        <Input
          ref={inputRef}
          type="text"
          label="Message"
          value={value}
          maxLength={1000}
          disabled={disabled}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={true}
          className="rounded-[1.15rem] border border-white/10 bg-black/40 backdrop-blur-md text-white placeholder:text-neutral-500 focus:border-white/20 focus:ring-1 focus:ring-white/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 transition-all h-12 px-4"
        />
        {charCount > 700 && (
          <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-mono pointer-events-none ${counterColor} z-10`}>
            {charCount}/1000
          </span>
        )}
      </div>

      <div className="shrink-0 group">
        <Button
          size="icon"
          className="h-12 w-12 sm:w-14 sm:h-12 rounded-[1.15rem] bg-black/40 backdrop-blur-md hover:bg-white/10 text-white shadow-sm transition-colors border border-white/10"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          title="Send (Enter)"
        >
          <SendHorizontal className="w-5 h-5 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-transform group-active:scale-95" />
        </Button>
      </div>
    </motion.div>
  );
}
