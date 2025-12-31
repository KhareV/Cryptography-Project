"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

export default function IncomingCallModal({
  incomingCall,
  onAnswer,
  onDecline,
  isLoading,
}) {
  if (!incomingCall) return null;

  const caller = incomingCall.caller;
  const displayName =
    caller.firstName && caller.lastName
      ? `${caller.firstName} ${caller.lastName}`
      : caller.username;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 50 }}
          className="absolute top-4 left-4 right-4 bottom-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-96 md:h-[500px] bg-gradient-to-br from-background via-background to-background-secondary border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Animated background */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10" />
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.1, 0.3],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.2),transparent_70%)]"
            />
          </div>

          <div className="relative flex-1 flex flex-col min-h-0">
            {/* Header */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-0">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="mb-3 flex-shrink-0"
              >
                <p className="text-sm text-foreground-secondary text-center">
                  Incoming Voice Call
                </p>
              </motion.div>

              {/* Avatar with pulse effect */}
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="mb-4 relative flex-shrink-0"
              >
                <Avatar
                  src={caller.avatar}
                  name={displayName}
                  size="xl"
                  className="ring-4 ring-blue-500/30 shadow-xl"
                />

                {/* Pulse rings */}
                <motion.div
                  animate={{
                    scale: [1, 2.5],
                    opacity: [0.8, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                  className="absolute inset-0 rounded-full bg-blue-500/20 -z-10"
                />

                <motion.div
                  animate={{
                    scale: [1, 2],
                    opacity: [0.6, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: 0.5,
                    ease: "easeOut",
                  }}
                  className="absolute inset-0 rounded-full bg-blue-500/30 -z-10"
                />
              </motion.div>

              {/* Caller Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center mb-4 flex-shrink-0"
              >
                <h2 className="text-xl md:text-2xl font-bold text-white mb-1">
                  {displayName}
                </h2>
                <p className="text-sm text-foreground-secondary">
                  @{caller.username}
                </p>
              </motion.div>

              {/* Call info */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-2 text-sm text-foreground-secondary mb-4 flex-shrink-0"
              >
                <Phone className="w-4 h-4" />
                Voice Call
              </motion.div>
            </div>

            {/* Action Buttons */}
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="p-4 md:p-6 flex-shrink-0"
            >
              <div className="flex items-center justify-center gap-6 md:gap-8">
                {/* Decline Button */}
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={onDecline}
                    disabled={isLoading}
                    className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-red-500/20 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all flex-shrink-0"
                  >
                    <PhoneOff className="w-6 h-6 md:w-7 md:h-7" />
                  </Button>
                </motion.div>

                {/* Answer Button */}
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  animate={
                    isLoading
                      ? {}
                      : {
                          boxShadow: [
                            "0 0 0 0 rgba(34, 197, 94, 0.4)",
                            "0 0 0 10px rgba(34, 197, 94, 0)",
                          ],
                        }
                  }
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                  }}
                >
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={onAnswer}
                    disabled={isLoading}
                    className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-green-500 border-2 border-green-400 text-white hover:bg-green-600 transition-all flex-shrink-0"
                  >
                    {isLoading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className="w-5 h-5 md:w-6 md:h-6 border-2 border-white border-t-transparent rounded-full"
                      />
                    ) : (
                      <Phone className="w-6 h-6 md:w-7 md:h-7" />
                    )}
                  </Button>
                </motion.div>
              </div>

              {/* Action labels */}
              <div className="flex items-center justify-center gap-6 md:gap-8 mt-2">
                <span className="text-xs text-red-400">Decline</span>
                <span className="text-xs text-green-400">Answer</span>
              </div>

              {/* Loading state */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-3 text-center"
                >
                  <p className="text-sm text-foreground-secondary">
                    Connecting...
                  </p>
                </motion.div>
              )}
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
