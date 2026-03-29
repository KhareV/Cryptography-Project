"use client";

import { useEffect, useMemo, useState } from "react";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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

export default function ActiveCallBar() {
  const {
    activeCall,
    isMuted,
    toggleMute,
    endCall,
    setCallScreenOpen,
    isCallScreenOpen,
  } = useCall();

  const [duration, setDuration] = useState("00:00");

  const isActive = activeCall?.status === "active";

  useEffect(() => {
    if (!isActive || !activeCall?.startedAt) {
      setDuration("00:00");
      return;
    }

    setDuration(formatDuration(activeCall.startedAt));
    const timer = window.setInterval(() => {
      setDuration(formatDuration(activeCall.startedAt));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeCall?.startedAt, isActive]);

  const canShow = useMemo(() => {
    return isActive && !isCallScreenOpen;
  }, [isActive, isCallScreenOpen]);

  return (
    <AnimatePresence>
      {canShow && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.2 }}
          onClick={() => setCallScreenOpen(true)}
          className="fixed bottom-4 left-1/2 z-[115] flex w-[min(96vw,860px)] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-background/95 px-4 py-3 text-left shadow-xl backdrop-blur"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              src={activeCall.peerAvatar}
              name={activeCall.peerName}
              size="md"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {activeCall.peerName}
              </p>
              <div className="flex items-center gap-2 text-xs text-foreground-secondary">
                <span className="relative inline-flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span>{duration}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className={`h-10 w-10 rounded-full p-0 ${
                isMuted ? "bg-red-500/20 text-red-500 hover:bg-red-500/30" : ""
              }`}
              onClick={(event) => {
                event.stopPropagation();
                toggleMute();
              }}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="h-10 w-10 rounded-full bg-red-500 text-white hover:bg-red-600"
              onClick={(event) => {
                event.stopPropagation();
                endCall();
              }}
              title="End call"
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
