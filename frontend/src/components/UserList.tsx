import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';

function getColorIndex(ip: string = '') {
  let sum = 0;
  for (let i = 0; i < ip.length; i++) {
    sum += ip.charCodeAt(i);
  }
  return sum % 6;
}

function getAvatarLabel(clientId: string = '') {
  if (!clientId || clientId.length < 2) return '?';
  return clientId.substring(0, 2).toUpperCase();
}

const colorClasses = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
];

export interface User {
  clientId: string;
  deviceType?: string;
}

interface UserItemProps {
  user: User;
  isMe: boolean;
}

function UserItem({ user, isMe }: UserItemProps) {
  const colorIndex = getColorIndex(user.clientId);
  const displayName = `User ${user.clientId?.substring(0, 4).toUpperCase()}`;

  return (
    <motion.div 
      initial={{ opacity: 0, x: -8, height: 0, marginBottom: 0 }}
      animate={{ opacity: 1, x: 0, height: 'auto', marginBottom: 8 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ opacity: { duration: 0.2 }, height: { duration: 0.2 }, x: { type: "spring", stiffness: 200, damping: 20 } }}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-black/5 dark:hover:border-white/10 overflow-hidden"
    >
      <div className={`w-11 h-11 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-sm sm:text-xs font-bold shrink-0 ${colorClasses[colorIndex]}`}>
        {getAvatarLabel(user.clientId)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-base sm:text-sm font-medium text-black dark:text-white truncate">
          {user.deviceType === 'MOBILE' || user.deviceType === 'TABLET' ? '📱 ' : '💻 '}
          {displayName}
        </div>
        {isMe && (
          <div className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-wider font-semibold">your device</div>
        )}
      </div>

      {isMe
        ? <span className="text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-md shrink-0">you</span>
        : <span className="w-2.5 h-2.5 sm:w-2 sm:h-2 rounded-full bg-green-500 shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
      }
    </motion.div>
  );
}

export interface UserListProps {
  users: User[];
  myIp?: string;
  myClientId?: string;
  typingUsers: string[];
  isOpen: boolean;
  onClose: () => void;
}

export default function UserList({ users, myIp, myClientId, typingUsers, isOpen, onClose }: UserListProps) {
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-[80vw] max-w-[320px] md:w-64 flex-shrink-0 flex flex-col h-full 
        bg-white dark:bg-neutral-950 md:bg-white md:dark:bg-neutral-950
        border-r border-black/10 dark:border-white/10
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex items-center justify-between px-4 py-4 md:py-3 border-b border-black/10 dark:border-white/10">
          <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 tracking-wider uppercase">
            Online — {users.length}
          </div>
          <button onClick={onClose} className="p-2 md:hidden text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 scroll-smooth">
          {users.length === 0 ? (
            <div className="p-4 text-xs text-neutral-500 dark:text-neutral-400 font-mono text-center">
              Connecting…
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {users.map(user => (
                <UserItem
                  key={user.clientId}
                  user={user}
                  isMe={user.clientId === myClientId}
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Typing indicator */}
        <AnimatePresence>
          {typingUsers.filter(id => id !== myClientId).length > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 py-3 md:py-2 text-[11px] font-mono text-black dark:text-white border-t border-black/10 dark:border-white/10 overflow-hidden"
            >
              {typingUsers
                .filter(id => id !== myClientId)
                .map(id => `User ${id.substring(0, 4).toUpperCase()}`)
                .join(', ')
              } is typing…
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-4 md:p-6 text-[11px] text-neutral-500 dark:text-neutral-400 border-t border-black/10 dark:border-white/10 leading-relaxed bg-black/[0.01] dark:bg-white/[0.01]">
          <span className="font-semibold text-amber-500">⚠ no history</span><br />
          Chat is wiped when<br />
          everyone disconnects.
        </div>
      </aside>
    </>
  );
}
