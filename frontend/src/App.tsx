import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Route, Switch, useLocation } from 'wouter';
import { Menu, PenTool, CheckCircle, Gamepad2, Terminal, Eye, EyeOff } from 'lucide-react';

import { useWebSocket } from './hooks/useWebSocket';
import UserList from './components/UserList';
import InputBar from './components/InputBar';
import LandingPage from './components/LandingPage';
import { Button } from './components/ui/button';
import { Message } from './components/ui/message';

import { pttAudioService } from './services/PTTAudioService';
import { identityService, OperatorIdentity } from './services/IdentityService';
import { AirGapDiode } from './components/ui/AirGapDiode';
import { TacticalGameModal } from './components/ui/TacticalGameModal';
import { TacticalBoardModal } from './components/TacticalBoardModal';
import { IdentityModal } from './components/IdentityModal';
import { DevSentryConsole } from './components/DevSentryConsole';
import { LightboxModal } from './components/ui/LightboxModal';
import { stalRouter, TransportStatus } from './services/transports/STALRouter';
import FavoritesHUD from './components/FavoritesHUD';
import { tacticalSoundFx } from './services/TacticalSoundFx';

const messageVariants = {
  initial: { opacity: 0, y: 10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
};

function ChatApp() {
  const [password, setPassword] = useState('defense-grid-apex');
  const [hasJoined, setHasJoined] = useState(false);
  const [passwordInput, setPasswordInput] = useState('defense-grid-apex');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Identity & Role Based Access Control (RBAC)
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showIdentityEdit, setShowIdentityEdit] = useState(false);
  const [identity, setIdentity] = useState<OperatorIdentity | null>(null);

  // Authoritative Host Identification
  const isHostNode = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || 
     window.location.hostname === '127.0.0.1' ||
     sessionStorage.getItem('apex_host_token') === 'APEX_MASTER_SEED');

  // Tactical Modals & Overlays
  const [isRecording, setIsRecording] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [showAirGap, setShowAirGap] = useState(false);
  const [showGameModal, setShowGameModal] = useState(false);
  const [showDevSentry, setShowDevSentry] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [transportStatus, setTransportStatus] = useState<TransportStatus>(stalRouter.getTransportStatus());

  const {
    messages,
    users,
    connected,
    myClientId,
    sendMessage,
    sendImage,
    stompClient,
    isGhostMode,
    setIsGhostMode
  } = useWebSocket(password);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return stalRouter.onStatusChange(setTransportStatus);
  }, []);

  useEffect(() => {
    identityService.initialize().then(id => {
      if (id && identityService.hasCompletedOnboarding()) {
        setIdentity(id);
      } else {
        setShowOnboarding(true);
      }
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.senderClientId !== myClientId && lastMsg.sender !== identity?.fullName) {
        if (typeof lastMsg.content === 'string' && (lastMsg.content.includes('RED ALERT') || lastMsg.content.includes('SOS'))) {
          tacticalSoundFx.playSirenAlert();
        } else {
          tacticalSoundFx.playTacticalChime();
        }
      }
    }
  }, [messages, myClientId, identity?.fullName]);

  // PTT Handlers
  const handlePttStart = async () => {
    const success = await pttAudioService.startRecording();
    if (success) setIsRecording(true);
  };

  const handlePttStop = async () => {
    setIsRecording(false);
    await pttAudioService.stopRecording();
  };

  const handleVerifyLedger = async () => {
    try {
      const res = await fetch('/api/audit/verify');
      const data = await res.json();
      if (res.ok) alert(`Ledger Verified: ${data.message}`);
      else alert(`Verification Failed: ${data.message}`);
    } catch (e) {
      alert("Ledger verify request error.");
    }
  };

  const handleOnboardingComplete = (newIdentity: OperatorIdentity) => {
    setIdentity(newIdentity);
    setShowOnboarding(false);
  };

  if (!hasJoined) {
    return (
      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-4 bg-[#070a13] font-mono">
        <div className="w-full max-w-md bg-[#0e1320] border border-neutral-800 rounded-2xl p-6 shadow-2xl">
          <div className="text-center mb-6">
            <h1 className="text-xl font-black tracking-widest text-white uppercase">
              LANCHAT <span className="text-green-400">APEX</span>
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              {isHostNode ? 'MASTER HOST NODE INITIALIZATION' : 'FIELD MEMBER NODE INITIALIZATION'}
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPassword(passwordInput);
              setHasJoined(true);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-[11px] text-neutral-300 uppercase tracking-wider mb-1.5">
                Channel Passphrase / Grid Key
              </label>
              <input
                type="password"
                placeholder="Enter passphrase"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                autoFocus
                className="w-full bg-[#141a29] border border-neutral-700 rounded-xl px-4 py-3 text-sm text-green-400 placeholder:text-neutral-500 font-mono focus:outline-none focus:border-green-500"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-green-600 hover:bg-green-500 text-black font-bold tracking-wide rounded-xl transition-all"
            >
              AUTHENTICATE GRID NODE
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-[100dvh] w-full bg-[#070a13] text-neutral-100 font-sans overflow-hidden">
      {/* Compulsory Onboarding Modal */}
      <IdentityModal
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
      />

      {/* Callsign / Rename Modal */}
      <IdentityModal
        isOpen={showIdentityEdit}
        allowEditMode={true}
        onComplete={handleOnboardingComplete}
        onClose={() => setShowIdentityEdit(false)}
      />

      {/* Synchronized Tactical Whiteboard */}
      <TacticalBoardModal
        isOpen={showBoard}
        onClose={() => setShowBoard(false)}
        stompClient={stompClient}
        localId={myClientId || 'local'}
      />

      {/* Tactical Mini-Games (Radar Strike) */}
      <TacticalGameModal
        isOpen={showGameModal}
        onClose={() => setShowGameModal(false)}
        stompClient={stompClient}
        localId={myClientId || 'local'}
        users={users}
      />

      {/* Lightbox Modal for Image Previews */}
      <LightboxModal
        isOpen={!!selectedImageSrc}
        imageSrc={selectedImageSrc}
        onClose={() => setSelectedImageSrc(null)}
      />

      {/* Host-Exclusive Dev Sentry Console Drawer (RBAC: Only rendered for HOST) */}
      {isHostNode && (
        <DevSentryConsole
          isOpen={showDevSentry}
          onClose={() => setShowDevSentry(false)}
          users={users}
          isGhostMode={isGhostMode}
          onToggleGhostMode={() => setIsGhostMode(!isGhostMode)}
          stompClient={stompClient}
        />
      )}

      {/* Multi-Transport Favorites HUD */}
      <FavoritesHUD />

      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-4 md:px-6 py-2.5 bg-[#090d18] border-b border-neutral-800 shrink-0 font-mono z-20">
        <div className="flex items-center gap-3">
          <button
            className="md:hidden p-1.5 text-neutral-400 hover:text-white rounded-lg border border-neutral-800"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-base font-black tracking-widest text-white uppercase">
              LANCHAT <span className="text-green-400">APEX</span>
            </span>
            <span className={`hidden sm:inline text-[10px] px-2 py-0.5 rounded border ${
              isHostNode 
                ? 'bg-amber-950/60 border-amber-800/60 text-amber-300 font-bold' 
                : 'bg-green-950/60 border-green-800/60 text-green-400'
            }`}>
              {isHostNode ? 'MASTER HOST' : 'FIELD NODE'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="text-neutral-300 hover:text-white text-xs h-8 px-2.5"
            onClick={() => setShowBoard(true)}
          >
            <PenTool className="w-3.5 h-3.5 mr-1 text-green-400" /> Board
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="text-neutral-300 hover:text-white text-xs h-8 px-2.5"
            onClick={() => setShowGameModal(true)}
          >
            <Gamepad2 className="w-3.5 h-3.5 mr-1 text-cyan-400" /> Games
          </Button>

          {/* Operational Stealth Toggle Button */}
          <Button
            size="sm"
            variant="ghost"
            className={`text-xs h-8 px-2.5 transition-colors ${
              identity?.isStealthActive 
                ? 'bg-amber-950/70 border border-amber-600 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]' 
                : 'text-neutral-300 hover:text-white'
            }`}
            onClick={() => {
              identityService.toggleStealthMode();
              setIdentity(identityService.getSafeState());
            }}
            title={identity?.isStealthActive ? "Stealth Active: Real name hidden" : "Toggle Operational Stealth Mode"}
          >
            {identity?.isStealthActive ? <EyeOff className="w-3.5 h-3.5 mr-1 text-amber-400" /> : <Eye className="w-3.5 h-3.5 mr-1 text-neutral-400" />}
            {identity?.isStealthActive ? 'STEALTH: ON' : 'Stealth'}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="text-neutral-300 hover:text-white text-xs h-8 px-2.5 hidden sm:flex"
            onClick={handleVerifyLedger}
          >
            <CheckCircle className="w-3.5 h-3.5 mr-1 text-indigo-400" /> Audit
          </Button>

          {/* RBAC: Dev Sentry Button Rendered EXCLUSIVELY for Host Node */}
          {isHostNode && (
            <Button
              size="sm"
              variant="ghost"
              className="bg-neutral-800 text-green-400 hover:bg-neutral-700 text-xs h-8 px-2.5 border border-neutral-700 shadow-md"
              onClick={() => setShowDevSentry(true)}
            >
              <Terminal className="w-3.5 h-3.5 mr-1" /> Dev Sentry
            </Button>
          )}

          {/* Connection Indicator */}
          <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-neutral-800 text-[11px] text-neutral-400">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-amber-500'}`} />
            <span className="hidden md:inline">{connected ? 'ONLINE' : 'RECONNECTING'}</span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden w-full relative">
        <UserList
          users={users}
          myClientId={myClientId || undefined}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onOpenIdentityModal={() => setShowIdentityEdit(true)}
        />

        {/* Chat Area */}
        <section className="flex flex-col flex-1 overflow-hidden relative bg-[#070a13]">
          {/* AirGap Modal */}
          {showAirGap && (
            <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-md p-4 flex flex-col items-center justify-center">
              <div className="w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-white font-bold tracking-widest text-sm uppercase">Air-Gap Data Diode</span>
                  <Button variant="ghost" size="sm" onClick={() => setShowAirGap(false)}>Close</Button>
                </div>
                <AirGapDiode />
              </div>
            </div>
          )}

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth w-full">
            {messages.length === 0 && (
              <div className="flex h-full items-center justify-center text-center text-xs font-mono text-neutral-500">
                TACTICAL SECURE CHANNEL ACTIVE • READY FOR ENCRYPTED TRANSMISSION
              </div>
            )}

            <div className="space-y-3 max-w-4xl mx-auto flex flex-col w-full pb-4">
              <AnimatePresence mode="popLayout">
                {messages.map((msg: any, index: number) => {
                  const isUser = msg.senderClientId === myClientId || msg.sender === identity?.fullName;
                  return (
                    <motion.div
                      key={msg.id || index}
                      variants={messageVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={{ duration: 0.15 }}
                      className="w-full"
                    >
                      <Message
                        id={msg.id}
                        from={isUser ? 'user' : 'assistant'}
                        content={msg.content}
                        senderName={msg.displayName || msg.sender || 'Operator'}
                        senderTag={msg.deviceTag || msg.tag || '#0000'}
                        timestamp={msg.timestamp}
                        type={msg.type}
                        audioData={msg.audioData}
                        durationSec={msg.durationSec}
                        replyTo={msg.replyTo}
                        pending={msg.pending}
                        onReply={() => setReplyingTo(msg)}
                        onOpenImage={(src) => setSelectedImageSrc(src)}
                      />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input Bar & Contextual Reply Preview */}
          <div className="p-3 md:p-4 bg-[#090d18] border-t border-neutral-800 z-10 w-full flex flex-col items-center">
            <AnimatePresence>
              {replyingTo && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="w-full max-w-4xl mb-2 flex justify-between items-center bg-indigo-950/40 border border-indigo-800/60 rounded-xl px-4 py-2 text-xs font-mono"
                >
                  <span className="text-indigo-300">
                    Replying to [{replyingTo.displayName || replyingTo.sender || 'Operator'}]: '{replyingTo.content?.substring(0, 40)}...'
                  </span>
                  <button onClick={() => setReplyingTo(null)} className="text-indigo-400 hover:text-white">✕</button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="max-w-4xl mx-auto w-full">
              <InputBar
                onSend={(msg) => {
                  sendMessage(msg, replyingTo);
                  setReplyingTo(null);
                }}
                onSendImage={(base64) => {
                  sendImage(base64, replyingTo);
                  setReplyingTo(null);
                }}
                onPttStart={handlePttStart}
                onPttStop={handlePttStop}
                isRecording={isRecording}
                activeTier={transportStatus.tier}
                disabled={!connected}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

const HomeRoute = () => {
  const [, setLocation] = useLocation();
  const handleJoin = React.useCallback(() => setLocation('/chat'), [setLocation]);
  return (
    <div className="flex-1 min-h-0 overflow-y-auto w-full">
      <LandingPage onJoin={handleJoin} />
    </div>
  );
};

export default function App() {
  return (
    <div className="relative flex flex-col h-[100dvh] w-full bg-[#070a13] font-sans overflow-hidden">
      <Switch>
        <Route path="/" component={HomeRoute} />
        <Route path="/chat" component={ChatApp} />
        <Route component={HomeRoute} />
      </Switch>
    </div>
  );
}
