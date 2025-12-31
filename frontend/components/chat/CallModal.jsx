"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Mic, MicOff, Lock, Signal } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { formatCallDuration } from "@/lib/utils";

// --- Sub-Components ---

// 1. Simulated Audio Waveform (Visualizer)
const AudioWaveform = ({ isMuted }) => {
  return (
    <div className="flex items-center justify-center gap-1 h-8">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ height: 4 }}
          animate={{
            height: isMuted ? 4 : [8, 24, 8],
            opacity: isMuted ? 0.3 : 1,
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.1,
            ease: "easeInOut",
          }}
          className={`w-1.5 rounded-full ${
            isMuted
              ? "bg-zinc-600"
              : "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
          }`}
        />
      ))}
    </div>
  );
};

// 2. Sonar Ripple Effect (For Ringing)
const SonarRipple = () => {
  return (
    <div className="absolute inset-0 z-0 flex items-center justify-center">
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          initial={{ width: "100%", height: "100%", opacity: 0.8 }}
          animate={{
            width: "250%",
            height: "250%",
            opacity: 0,
            borderWidth: "1px",
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.6,
            ease: "easeOut",
          }}
          className="absolute rounded-full border border-blue-500/30 bg-blue-500/5"
        />
      ))}
    </div>
  );
};

// 3. Encrypted Badge
const EncryptedBadge = () => (
  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
    <Lock className="w-3 h-3 text-zinc-400" />
    <span className="text-[10px] font-medium text-zinc-400 tracking-wider uppercase">
      End-to-End Encrypted
    </span>
  </div>
);

// --- Main Component ---

export default function CallModal({
  isOpen,
  activeCall,
  callStatus,
  isMuted,
  isLoading,
  onEndCall,
  onToggleMute,
  localAudioRef,
  remoteAudioRef,
  currentUser,
}) {
  const [callDuration, setCallDuration] = useState("00:00");

  // Timer Logic
  useEffect(() => {
    let interval;
    if (callStatus === "connected" && activeCall?.answerTime) {
      interval = setInterval(() => {
        setCallDuration(formatCallDuration(activeCall.answerTime));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus, activeCall?.answerTime]);

  if (!isOpen || !activeCall) return null;

  const otherUser =
    activeCall.caller.id === currentUser?.id
      ? activeCall.recipient
      : activeCall.caller;

  const displayName =
    otherUser.firstName && otherUser.lastName
      ? `${otherUser.firstName} ${otherUser.lastName}`
      : otherUser.username;

  const isRinging = callStatus === "calling" || callStatus === "ringing";
  const isConnected = callStatus === "connected";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative w-full max-w-sm aspect-[3/4] md:h-[600px] overflow-hidden rounded-[2.5rem] border border-white/10 bg-zinc-900 shadow-2xl"
        >
          {/* Dynamic Background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Noise Overlay */}
            <div className="absolute inset-0 z-10 opacity-[0.05] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

            {/* Ambient Orb */}
            <motion.div
              animate={{
                background: isConnected
                  ? "radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.15), transparent 70%)" // Emerald for connected
                  : "radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.15), transparent 70%)", // Blue for ringing
              }}
              className="absolute inset-0 transition-colors duration-1000 ease-in-out"
            />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(255,255,255,0.03)_180deg,transparent_360deg)] opacity-30"
            />
          </div>

          {/* Content Layer */}
          <div className="relative z-20 flex flex-col items-center justify-between h-full py-12 px-6">
            {/* Top: Status & Encryption */}
            <div className="flex flex-col items-center gap-4">
              <EncryptedBadge />
              <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium tracking-wide">
                <Signal
                  className={`w-3 h-3 ${
                    isConnected ? "text-emerald-500" : "text-zinc-500"
                  }`}
                />
                {isConnected
                  ? "HD Voice Active"
                  : "Establishing Secure Connection..."}
              </div>
            </div>

            {/* Center: Identity & Visuals */}
            <div className="flex flex-col items-center gap-6 w-full relative">
              {/* Avatar Container with Physics */}
              <div className="relative">
                {isRinging && <SonarRipple />}

                <motion.div
                  className="relative z-10"
                  animate={isRinging ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <div className="relative p-1 rounded-full bg-gradient-to-b from-white/10 to-transparent border border-white/10 backdrop-blur-sm">
                    <Avatar
                      src={otherUser.avatar}
                      name={displayName}
                      size="2xl" // Custom size, assume large (~128px)
                      className="h-32 w-32 shadow-2xl"
                    />
                  </div>
                </motion.div>
              </div>

              {/* Text Info */}
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {displayName}
                </h2>

                <div className="h-8 flex items-center justify-center">
                  {isConnected ? (
                    <div className="flex flex-col items-center gap-2">
                      <span className="font-mono text-xl text-zinc-300 tracking-wider">
                        {callDuration}
                      </span>
                      <AudioWaveform isMuted={isMuted} />
                    </div>
                  ) : (
                    <span className="text-zinc-400 animate-pulse font-medium">
                      {callStatus === "ringing" ? "Ringing..." : "Calling..."}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom: Floating Controls Island */}
            <div className="w-full max-w-[280px]">
              <div className="flex items-center justify-between p-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl shadow-lg">
                {/* Mute Toggle */}
                <button
                  onClick={onToggleMute}
                  disabled={!isConnected}
                  className={`relative group flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300 ${
                    !isConnected
                      ? "opacity-30 cursor-not-allowed"
                      : "hover:bg-white/10"
                  }`}
                >
                  <div
                    className={`absolute inset-0 rounded-full transition-all duration-300 ${
                      isMuted
                        ? "bg-white text-black"
                        : "bg-transparent text-white border border-white/20"
                    }`}
                  />
                  <div className="relative z-10">
                    {isMuted ? (
                      <MicOff className="w-5 h-5" />
                    ) : (
                      <Mic className="w-5 h-5" />
                    )}
                  </div>
                </button>

                {/* End Call Swipe/Button */}
                <button
                  onClick={onEndCall}
                  className="relative group flex items-center justify-center w-20 h-14 rounded-full bg-red-500/90 hover:bg-red-500 transition-all duration-300 shadow-lg shadow-red-500/20 active:scale-95"
                >
                  <div className="absolute inset-0 bg-red-400 opacity-0 group-hover:animate-ping rounded-full" />
                  <PhoneOff className="w-6 h-6 text-white relative z-10" />
                </button>

                {/* Placeholder/Speaker Toggle (Optional expansion) */}
                <button className="flex items-center justify-center w-14 h-14 rounded-full border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
                  <User className="w-5 h-5" />
                </button>
              </div>

              {isLoading && (
                <p className="text-[10px] text-center text-zinc-500 mt-4 uppercase tracking-widest">
                  Synchronizing...
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Hidden Audio Elements */}
        <audio ref={localAudioRef} autoPlay muted playsInline />
        <audio ref={remoteAudioRef} autoPlay playsInline />
      </motion.div>
    </AnimatePresence>
  );
}
