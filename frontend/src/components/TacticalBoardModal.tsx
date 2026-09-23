import React from 'react';
import { Button } from './ui/button';
import { TacticalCanvas } from './ui/TacticalCanvas';
import { X, PenTool } from 'lucide-react';

interface TacticalBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  stompClient: any;
  localId: string;
}

export const TacticalBoardModal: React.FC<TacticalBoardModalProps> = ({ isOpen, onClose, stompClient, localId }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md p-4 md:p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-5xl flex justify-between items-center mb-3 border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-2">
          <PenTool className="w-5 h-5 text-green-400" />
          <span className="text-sm font-black tracking-widest text-white uppercase">
            Synchronized Tactical Whiteboard
          </span>
          <span className="ml-2 text-[10px] font-mono text-green-400 bg-green-950/50 border border-green-800/50 px-2 py-0.5 rounded">
            Vector Sync Active (&lt;10ms)
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-neutral-400 hover:text-white">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="w-full max-w-5xl flex-1 h-[75vh]">
        <TacticalCanvas stompClient={stompClient} localId={localId} />
      </div>
    </div>
  );
};
