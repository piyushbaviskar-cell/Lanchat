import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Star, Smartphone, Laptop, X, Users, UserCheck } from 'lucide-react';
import { tacticalContactsService } from '../services/TacticalContactsService';

export interface User {
  clientId: string;
  displayName?: string;
  deviceType?: 'MOBILE' | 'DESKTOP' | 'TABLET' | string;
}

interface UserListProps {
  users: User[];
  myIp?: string;
  myClientId?: string;
  typingUsers?: string[];
  isOpen: boolean;
  onClose: () => void;
  onOpenIdentityModal?: () => void;
}

export default function UserList({
  users,
  myClientId,
  isOpen,
  onClose,
  onOpenIdentityModal
}: UserListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteMap, setFavoriteMap] = useState<Record<string, boolean>>({});

  const handleToggleFavorite = async (user: User) => {
    const key = user.clientId;
    const nextState = !favoriteMap[key];
    setFavoriteMap(prev => ({ ...prev, [key]: nextState }));

    await tacticalContactsService.upsertContact({
      publicKeyFingerprint: user.clientId,
      rawPublicKey: user.clientId,
      declaredFullName: user.displayName || user.clientId,
      petname: user.displayName || user.clientId,
      isFavorite: nextState,
      trustStatus: 'VERIFIED_IN_PERSON',
      transportsAvailable: ['LOCAL_MESH'],
      lastKnownVector: {
        timestamp: Date.now(),
        transport: 'LOCAL_MESH'
      }
    });
  };

  const filteredUsers = users.filter(u => {
    const name = (u.displayName || u.clientId || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    return name.includes(q) || u.clientId.toLowerCase().includes(q);
  });

  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={`
        fixed md:static inset-y-0 left-0 z-40
        w-[85vw] max-w-[320px] md:w-72 flex-shrink-0 flex flex-col h-full 
        bg-[#090d18] border-r border-neutral-800
        transition-transform duration-300 ease-in-out font-mono
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-green-400" />
            <span className="text-xs font-bold text-white tracking-wider uppercase">
              MESH NODES ({users.length})
            </span>
          </div>
          <button onClick={onClose} className="p-1 md:hidden text-neutral-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Directory Search */}
        <div className="p-3 border-b border-neutral-800 bg-[#0b0f1a]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-500" />
            <input
              type="text"
              placeholder="Search callsign or #tag..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#131929] border border-neutral-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-green-400 placeholder:text-neutral-500 focus:outline-none focus:border-green-500/80"
            />
          </div>
        </div>

        {/* User Items */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
          {filteredUsers.length === 0 ? (
            <div className="p-4 text-xs text-neutral-500 text-center">
              {searchQuery ? 'No matching nodes' : 'Scanning local hotspot mesh...'}
            </div>
          ) : (
            filteredUsers.map(user => {
              const isMe = user.clientId === myClientId;
              const isFav = favoriteMap[user.clientId];
              const isMobile = user.deviceType === 'MOBILE' || user.deviceType === 'TABLET';

              return (
                <div
                  key={user.clientId}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                    isMe
                      ? 'bg-indigo-950/30 border-indigo-800/40 text-white'
                      : 'bg-neutral-900/40 border-neutral-800/80 hover:bg-neutral-900 text-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="text-sm shrink-0">
                      {isMobile ? <Smartphone className="w-4 h-4 text-indigo-400" /> : <Laptop className="w-4 h-4 text-green-400" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate flex items-center gap-1.5">
                        <span className="truncate">{user.displayName || user.clientId}</span>
                        {isMe && (
                          <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-500/30">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-500 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                        <span>{isMobile ? 'Mobile Hotspot' : 'Desktop Node'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {!isMe && (
                      <button
                        onClick={() => handleToggleFavorite(user)}
                        className="p-1.5 text-neutral-500 hover:text-amber-400 transition-colors"
                        title="Add to Favorites"
                      >
                        <Star className={`w-3.5 h-3.5 ${isFav ? 'text-amber-400 fill-amber-400' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Callsign / Rename Banner */}
        {onOpenIdentityModal && (
          <div className="p-3 border-t border-neutral-800 bg-neutral-900/60">
            <button
              onClick={onOpenIdentityModal}
              className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-xs font-bold text-neutral-200 flex items-center justify-center gap-2 transition-colors"
            >
              <UserCheck className="w-3.5 h-3.5 text-green-400" /> Callsign / Rename Ledger
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
