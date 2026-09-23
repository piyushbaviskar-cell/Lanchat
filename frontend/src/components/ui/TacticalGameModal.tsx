import React from 'react';
import { Button } from './button';
import { TacticalRadarStrike } from '../../game/TacticalRadarStrike';
import { identityService } from '../../services/IdentityService';
import { X, Gamepad2 } from 'lucide-react';

interface TacticalGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  stompClient: any;
  localId: string;
  users?: any[];
}

export const TacticalGameModal: React.FC<TacticalGameModalProps> = ({ isOpen, onClose, stompClient, localId, users = [] }) => {
  const activeGame = 'RADAR_STRIKE';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#070a14]/95 backdrop-blur-md p-4 md:p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-4xl flex justify-between items-center mb-4 border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-3">
          <Gamepad2 className="text-cyan-400 w-6 h-6" />
          <div>
            <span className="text-white font-black tracking-widest text-base uppercase">APEX Tactical Mini-Games</span>
            <span className="ml-3 text-[11px] text-cyan-400 font-mono bg-cyan-500/10 px-2.5 py-1 rounded border border-cyan-500/20">
              OPERATOR: {identityService.getDisplayName()}
            </span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-neutral-400 hover:text-white">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="w-full max-w-4xl flex-1 flex flex-col items-center justify-center overflow-y-auto">
        {activeGame === 'RADAR_STRIKE' && (
          <TacticalRadarStrike stompClient={stompClient} localId={localId} users={users} />
        )}
      </div>
    </div>
  );
};
