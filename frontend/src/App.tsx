import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Route, Switch, useLocation } from 'wouter';
import { Menu } from 'lucide-react';

import { useWebSocket }  from './hooks/useWebSocket';
import UserList          from './components/UserList';
import InputBar          from './components/InputBar';
import LandingPage       from './components/LandingPage';
import { Button }        from './components/ui/button';
import { Message, MessageContent, MessageAvatar } from './components/ui/message';

const messageVariants = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
};

function ChatApp() {
  const [password, setPassword] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const { messages, users, connected, authError, myIp, myName, myClientId, typingUsers, sendMessage, sendTyping } = useWebSocket(password);

  const bottomRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
      if (authError && hasJoined) {
          setHasJoined(false);
          setPassword('');
      }
  }, [authError, hasJoined]);

  if (!hasJoined) {
    return (
      <div className="min-h-[100dvh] min-h-screen w-full flex flex-col items-center justify-center gap-6 bg-white dark:bg-neutral-950 px-4">
        <p className="text-lg text-neutral-600 dark:text-neutral-400">Enter room password to join</p>
        
        {authError && (
          <div className="text-[var(--red, #ef4444)] text-sm font-medium">
            Incorrect password
          </div>
        )}

        <form 
          onSubmit={(e) => { e.preventDefault(); setPassword(passwordInput); setHasJoined(true); }}
          className="flex w-full max-w-md gap-3"
        >
          <input
            type="password"
            placeholder="Password"
            value={passwordInput} 
            onChange={e => setPasswordInput(e.target.value)} 
            autoFocus 
            className="flex-1 rounded-xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-black/95 px-4 py-3 text-sm text-black dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20"
          />
          <Button
            type="submit"
            variant="ghost"
            className="h-auto rounded-xl px-6 backdrop-blur-md bg-white/95 hover:bg-white/100 dark:bg-black/95 dark:hover:bg-black/100 text-black dark:text-white border border-black/10 dark:border-white/10 transition-all duration-300"
          >
            Join
          </Button>
        </form>
      </div>
    );
  }

  const statusLabel = connected ? 'Connected' : 'Reconnecting…';
  const userCount = users.length;

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
      className="relative flex flex-col h-[100dvh] h-screen w-full bg-white dark:bg-neutral-950 font-sans overflow-hidden app-shell"
    >

      <div className="relative z-10 flex flex-col h-full w-full pointer-events-none">
        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <header className="topbar pt-[env(safe-area-inset-top)] pointer-events-auto flex items-center justify-between px-4 md:px-6 py-4 border-b border-[var(--border-md)] z-20 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden p-2 -ml-2 text-[var(--muted)] hover:text-[var(--text)] active:bg-black/5 dark:active:bg-white/5 rounded-lg transition-colors"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="text-xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-neutral-900 to-neutral-700/80 dark:from-white dark:to-white/80">
              localchat
            </span>
            <span className="px-2 py-0.5 text-xs font-medium bg-[var(--surface2)] text-[var(--muted)] rounded-full border border-[var(--border)] hidden sm:inline-block">
              LAN only
            </span>
            {userCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-[var(--surface2)] text-[var(--muted)] rounded-full border border-[var(--border)]">
                {userCount} online
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm font-medium text-[var(--muted)]">
            <motion.span 
              className={`w-2 h-2 rounded-full ${connected ? 'bg-[var(--green, #22c55e)]' : 'bg-amber-500'}`}
              animate={connected && !shouldReduceMotion ? {
                scale: [1, 1.15, 1],
                boxShadow: [
                  "0 0 0 0px var(--green, rgba(34, 197, 94, 0.6))",
                  "0 0 0 6px rgba(34, 197, 94, 0)",
                  "0 0 0 0px var(--green, rgba(34, 197, 94, 0.6))"
                ]
              } : { scale: 1, boxShadow: '0 0 0 0px rgba(34, 197, 94, 0)' }}
              transition={connected && !shouldReduceMotion ? { repeat: Infinity, duration: 2 } : {}}
            />
            <span className="hidden sm:inline">{statusLabel}</span>
          </div>
        </header>

        {/* ── Main workspace ───────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden pointer-events-auto z-10 w-full">
          <UserList
            users={users}
            myIp={myIp}
            myClientId={myClientId}
            typingUsers={typingUsers}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />

          {/* ── Chat area ────────────────────────────────────────────── */}
          <section className="flex flex-col flex-1 overflow-hidden relative border-l border-[var(--border-md)] bg-transparent w-full">
            {/* ── Message list ───────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth w-full">
              {messages.length === 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="flex h-full items-center justify-center text-center text-sm text-[var(--muted)] font-mono"
                >
                  No messages yet.<br />Say hello to the team.
                </motion.div>
              )}

              <div className="space-y-4 max-w-4xl mx-auto flex flex-col w-full pb-4">
                <AnimatePresence mode="popLayout">
                  {messages.map((msg: any, index: number) => {
                    const isSystem = msg.type === 'JOIN' || msg.type === 'LEAVE' || msg.type === 'SYSTEM';
                    
                    return (
                      <motion.div 
                        key={msg.id || index}
                        variants={messageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        layout={!shouldReduceMotion}
                        className={isSystem ? "w-full flex justify-center my-2" : "w-full flex"}
                      >
                        {isSystem ? (
                          <div className="bg-white/5 border border-white/10 text-neutral-400 text-xs px-3 py-1.5 rounded-full">
                            {msg.content || (msg.type === 'JOIN' ? `${msg.senderIp} joined the chat` : `${msg.senderIp} left the chat`)}
                          </div>
                        ) : (
                          <Message from={msg.senderClientId === myClientId ? 'user' : 'assistant'}>
                            <MessageContent>{msg.content}</MessageContent>
                            <MessageAvatar src="" name={msg.senderIp || 'Unknown'} />
                          </Message>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                <div ref={bottomRef} />
              </div>
            </div>

            {/* ── Input bar ──────────────────────────────────────────── */}
            <div className="input-bar p-4 md:p-6 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-transparent z-10 w-full">
              <div className="max-w-4xl mx-auto w-full">
                <InputBar
                  onSend={sendMessage}
                  onTyping={sendTyping} 
                  disabled={!connected}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}

export default function App() {
  const [location, setLocation] = useLocation();

  const handleJoin = React.useCallback(() => {
    setLocation('/chat');
  }, [setLocation]);

  return (
    <Switch>
      <Route path="/">
        <LandingPage onJoin={handleJoin} />
      </Route>
      <Route path="/chat">
        <ChatApp />
      </Route>
      {/* Fallback to landing page */}
      <Route>
        <LandingPage onJoin={handleJoin} />
      </Route>
    </Switch>
  );
}
