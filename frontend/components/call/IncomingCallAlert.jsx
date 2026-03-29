"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Phone, PhoneCall, PhoneOff } from "lucide-react";
import { useCall } from "@/context/CallContext";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

export default function IncomingCallAlert() {
  const { incomingCall, acceptCall, rejectCall } = useCall();

  useEffect(() => {
    if (!incomingCall) return;

    const audio = new Audio("/sounds/ringtone.mp3");
    audio.loop = true;
    audio.volume = 0.7;
    audio.play().catch(() => {});

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [incomingCall]);

  useEffect(() => {
    if (!incomingCall) return;

    const timeoutId = window.setTimeout(() => {
      rejectCall({ reason: "declined", missed: true });
    }, 30000);

    return () => window.clearTimeout(timeoutId);
  }, [incomingCall, rejectCall]);

  if (!incomingCall) return null;

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="fixed bottom-5 right-5 z-[120] w-[min(94vw,360px)] rounded-2xl border border-border bg-background/95 p-4 shadow-2xl backdrop-blur-xl"
      >
        <div className="mb-4 flex items-center gap-3">
          <Avatar
            src={incomingCall.callerAvatar}
            name={incomingCall.callerName}
            size="2xl"
            className="ring-2 ring-green-500/50"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-foreground">
              {incomingCall.callerName}
            </p>
            <p className="text-sm text-foreground-secondary">
              Incoming audio call
            </p>
          </div>
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="rounded-full bg-green-500/20 p-2"
          >
            <PhoneCall className="h-5 w-5 text-green-500" />
          </motion.div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            onClick={() => rejectCall()}
            className="bg-red-500 text-white hover:bg-red-600"
            leftIcon={<PhoneOff className="h-4 w-4" />}
          >
            Decline
          </Button>

          <Button
            type="button"
            onClick={acceptCall}
            className="bg-emerald-500 text-white hover:bg-emerald-600"
            leftIcon={<Phone className="h-4 w-4" />}
          >
            Accept
          </Button>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
