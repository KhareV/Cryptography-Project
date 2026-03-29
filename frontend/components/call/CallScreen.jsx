"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCall } from "@/context/CallContext";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

const formatDuration = (startTime) => {
  if (!startTime) return "00:00";
  const start = new Date(startTime).getTime();
  const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const mins = Math.floor(diff / 60)
    .toString()
    .padStart(2, "0");
  const secs = (diff % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

export default function CallScreen() {
  const {
    activeCall,
    isMuted,
    toggleMute,
    endCall,
    isSpeakerOn,
    toggleSpeaker,
    isCallScreenOpen,
    setCallScreenOpen,
  } = useCall();

  const [duration, setDuration] = useState("00:00");

  const shouldShow = useMemo(() => {
    if (!activeCall) return false;
    if (activeCall.status === "ended") return true;
    if (activeCall.status === "ringing") return true;
    return isCallScreenOpen;
  }, [activeCall, isCallScreenOpen]);

  useEffect(() => {
    if (!activeCall?.startedAt || activeCall.status !== "active") {
      setDuration("00:00");
      return;
    }

    setDuration(formatDuration(activeCall.startedAt));
    const timer = window.setInterval(() => {
      setDuration(formatDuration(activeCall.startedAt));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeCall?.startedAt, activeCall?.status]);

  if (!activeCall) return null;

  const statusText =
    activeCall.status === "active"
      ? "Connected"
      : activeCall.status === "ended"
        ? "Call Ended"
        : "Calling...";

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.section
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[118] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-background px-6 py-8 shadow-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_55%)]" />

            <div className="relative z-10">
              {activeCall.status === "active" && (
                <button
                  type="button"
                  onClick={() => setCallScreenOpen(false)}
                  className="absolute right-0 top-0 rounded-full p-2 text-foreground-secondary hover:bg-background-secondary hover:text-foreground"
                  aria-label="Minimize call screen"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
              )}

              <div className="flex flex-col items-center text-center">
                <div className="mb-4 h-24 w-24 overflow-hidden rounded-full ring-2 ring-emerald-500/40">
                  <Avatar
                    src={activeCall.peerAvatar}
                    name={activeCall.peerName}
                    size="2xl"
                    className="h-full w-full"
                  />
                </div>

                <h2 className="text-2xl font-bold text-foreground">
                  {activeCall.peerName}
                </h2>
                <p className="mt-1 text-sm text-foreground-secondary">
                  {statusText}
                </p>

                <div className="mt-8 flex h-16 items-end justify-center gap-1.5">
                  {[0, 1, 2, 3, 4].map((index) => (
                    <motion.span
                      key={index}
                      animate={
                        activeCall.status === "active"
                          ? { height: [12, 36, 18, 30, 12] }
                          : { height: 10 }
                      }
                      transition={{
                        duration: 0.9,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: index * 0.08,
                      }}
                      className="w-2 rounded-full bg-emerald-500/80"
                    />
                  ))}
                </div>

                <p className="mt-4 text-lg font-mono text-foreground-secondary">
                  {duration}
                </p>
              </div>

              <div className="mt-10 flex items-center justify-center gap-4">
                <Button
                  type="button"
                  variant="ghost"
                  className={`h-14 w-14 rounded-full p-0 ${
                    isMuted
                      ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                      : ""
                  }`}
                  onClick={toggleMute}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <MicOff className="h-6 w-6" />
                  ) : (
                    <Mic className="h-6 w-6" />
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className={`h-14 w-14 rounded-full p-0 ${
                    isSpeakerOn
                      ? "bg-blue-500/20 text-blue-500 hover:bg-blue-500/30"
                      : ""
                  }`}
                  onClick={toggleSpeaker}
                  title={isSpeakerOn ? "Speaker on" : "Speaker off"}
                >
                  {isSpeakerOn ? (
                    <Volume2 className="h-6 w-6" />
                  ) : (
                    <VolumeX className="h-6 w-6" />
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="h-16 w-16 rounded-full bg-red-500 p-0 text-white hover:bg-red-600"
                  onClick={() => endCall()}
                  title="End call"
                >
                  <PhoneOff className="h-7 w-7" />
                </Button>
              </div>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
