import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Search, Radio } from 'lucide-react';
import { tacticalContactsService, TacticalContact } from '../services/TacticalContactsService';
import { stalRouter, TransportStatus } from '../services/transports/STALRouter';

export default function FavoritesHUD() {
  const [favorites, setFavorites] = useState<TacticalContact[]>([]);
  const [allContacts, setAllContacts] = useState<TacticalContact[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [transportStatus, setTransportStatus] = useState<TransportStatus>(stalRouter.getTransportStatus());

  useEffect(() => {
    loadContacts();
    return stalRouter.onStatusChange(setTransportStatus);
  }, []);

  const loadContacts = async () => {
    try {
      const contacts = await tacticalContactsService.getAllContacts();
      setAllContacts(contacts);
      setFavorites(contacts.filter(c => c.isFavorite));
    } catch (e) {
      console.warn('Failed to load contacts from IndexedDB:', e);
    }
  };

  const toggleFavorite = async (fingerprint: string, current: boolean) => {
    await tacticalContactsService.toggleFavorite(fingerprint, !current);
    loadContacts();
  };

  const filteredContacts = allContacts.filter(c => 
    (c.petname || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.declaredFullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.publicKeyFingerprint || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full bg-[#0a0e1a]/95 border-b border-neutral-800 px-4 py-2 font-mono text-xs text-white flex items-center justify-between pointer-events-auto z-30">
      {/* Left: Active Multi-Transport Status Badge */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-900 border border-neutral-700/80 rounded-lg">
          <Radio className="w-3.5 h-3.5 text-green-400 animate-pulse" />
          <span className="text-[10px] text-neutral-400">TRANSPORT:</span>
          <span className="text-[11px] font-bold text-green-400">{transportStatus.badge}</span>
        </div>
      </div>

      {/* Center: Pinned Tactical Favorites Bar */}
      <div className="flex items-center gap-2 overflow-x-auto max-w-xl py-0.5">
        {favorites.length === 0 ? (
          <span className="text-[10px] text-neutral-500 hidden sm:inline">
            No pinned favorites. Star contacts in directory to pin.
          </span>
        ) : (
          favorites.map(fav => (
            <div
              key={fav.publicKeyFingerprint}
              className="flex items-center gap-1.5 px-2 py-1 bg-neutral-900/90 border border-neutral-800 hover:border-amber-500/50 rounded-lg shrink-0 transition-colors"
            >
              <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
              <span className="text-[11px] font-bold text-neutral-200 truncate max-w-[90px]">
                {fav.petname || fav.declaredFullName}
              </span>
              <span className="text-[9px] px-1 bg-green-950 border border-green-800 text-green-400 rounded">
                🟢 2ms
              </span>
            </div>
          ))
        )}
      </div>

      {/* Right: Quick Directory Modal Toggle */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 rounded-lg text-neutral-300 hover:text-white transition-colors"
        >
          <Search className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[11px]">Directory ({allContacts.length})</span>
        </button>

        {/* Directory Dropdown */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 5, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.98 }}
              className="absolute right-0 top-full mt-2 w-80 bg-[#0e1322] border border-neutral-800 rounded-xl shadow-2xl p-3 z-50 flex flex-col max-h-80"
            >
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-neutral-800">
                <span className="text-xs font-bold text-white uppercase">Tactical Directory</span>
                <button onClick={() => setIsOpen(false)} className="text-neutral-400 hover:text-white text-xs">✕</button>
              </div>

              <input
                type="text"
                placeholder="Filter by name / #tag..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-green-400 mb-2 focus:outline-none"
              />

              <div className="flex-1 overflow-y-auto space-y-1">
                {filteredContacts.length === 0 ? (
                  <div className="text-center p-3 text-[11px] text-neutral-500">No matching contacts</div>
                ) : (
                  filteredContacts.map(c => (
                    <div key={c.publicKeyFingerprint} className="flex items-center justify-between p-2 rounded-lg bg-neutral-900/60 border border-neutral-800">
                      <div>
                        <div className="text-xs font-bold text-neutral-200">{c.petname || c.declaredFullName}</div>
                        <div className="text-[10px] text-neutral-500">{c.publicKeyFingerprint}</div>
                      </div>
                      <button
                        onClick={() => toggleFavorite(c.publicKeyFingerprint, c.isFavorite)}
                        className="p-1 text-neutral-400 hover:text-amber-400"
                      >
                        <Star className={`w-4 h-4 ${c.isFavorite ? 'text-amber-400 fill-amber-400' : ''}`} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
